import { z } from 'zod';

/*
 * "Book a demo" requests from the public product page (/about). The same schema validates the form in the
 * browser and the request on the API (POST /api/public/demo-requests), so both give the same answers.
 * Every text field is normalised here: control characters (CR/LF included) never survive into the email
 * the API builds from it.
 */

export const DEMO_REQUEST_LIMITS = {
  name: 100,
  school: 150,
  role: 80,
  city: 80,
  message: 1000,
  phoneMinDigits: 8,
  phoneMaxDigits: 20,
  classrooms: 5000,
} as const;

/** C0/C1 control characters, line/paragraph separators, zero-width and bidi-override characters. */
const isControl = (c: number) =>
  c < 0x20 ||
  (c >= 0x7f && c <= 0x9f) ||
  c === 0x2028 ||
  c === 0x2029 ||
  (c >= 0x200b && c <= 0x200f) ||
  (c >= 0x202a && c <= 0x202e) ||
  (c >= 0x2066 && c <= 0x2069);

/** One line of plain text: every control character (CR and LF included) becomes a space; runs of spaces collapse. */
export function toSingleLine(value: string): string {
  return Array.from(value, (ch) => (isControl(ch.codePointAt(0) ?? 0) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Multi-line plain text: keeps line breaks (as \n, at most one blank line in a row), drops every other control character. */
export function toPlainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(toSingleLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "+91 98765-43210" -> "+919876543210": a leading + and the digits, nothing else. */
export function normalisePhone(value: string): string {
  const line = toSingleLine(value);
  return `${line.startsWith('+') ? '+' : ''}${line.replace(/\D/g, '')}`;
}

/** Raw strings are capped before any processing, whatever the field. */
const RAW_MAX = 4000;

const requiredLine = (label: string, max: number) =>
  z
    .string({ error: `Enter ${label}` })
    .max(RAW_MAX)
    .transform(toSingleLine)
    .pipe(z.string().min(1, `Enter ${label}`).max(max, `Keep ${label} under ${max} characters`));

const optionalLine = (label: string, max: number) =>
  z
    .string()
    .max(RAW_MAX)
    .transform(toSingleLine)
    .pipe(z.string().max(max, `Keep ${label} under ${max} characters`))
    .transform((v) => v || undefined)
    .optional();

const { phoneMinDigits: minDigits, phoneMaxDigits: maxDigits } = DEMO_REQUEST_LIMITS;

export const DemoRequestInput = z.strictObject({
  name: requiredLine('your name', DEMO_REQUEST_LIMITS.name),
  school: requiredLine('your school or organisation', DEMO_REQUEST_LIMITS.school),
  city: requiredLine('your city', DEMO_REQUEST_LIMITS.city),
  /** Primary contact (WhatsApp/phone). Spaces, dashes, dots and brackets are accepted and removed. */
  phone: z
    .string({ error: 'Enter a phone number' })
    .max(64)
    .refine((v) => /^\s*\+?[\d\s().-]*$/.test(v), 'Use digits only (a leading + is fine)')
    .transform(normalisePhone)
    .pipe(
      z
        .string()
        .regex(/^\+?\d+$/, 'Enter a phone number')
        .refine((v) => v.replace('+', '').length >= minDigits, `Enter at least ${minDigits} digits`)
        .refine((v) => v.replace('+', '').length <= maxDigits, `Use at most ${maxDigits} digits`),
    ),
  /** Optional. Used only as the Reply-To of the internal email; nothing is ever sent to it. */
  email: z
    .string()
    .max(RAW_MAX)
    .transform(toSingleLine)
    .refine(
      (v) => v === '' || (v.length <= 254 && z.email().safeParse(v).success),
      'Enter a valid email address',
    )
    .transform((v) => (v ? v.toLowerCase() : undefined))
    .optional(),
  role: optionalLine('your role', DEMO_REQUEST_LIMITS.role),
  classrooms: z
    .int('Enter a whole number')
    .min(1, 'Enter at least 1')
    .max(DEMO_REQUEST_LIMITS.classrooms, `Enter at most ${DEMO_REQUEST_LIMITS.classrooms}`)
    .optional(),
  message: z
    .string()
    .max(RAW_MAX)
    .transform(toPlainText)
    .pipe(
      z
        .string()
        .max(DEMO_REQUEST_LIMITS.message, `Keep the message under ${DEMO_REQUEST_LIMITS.message} characters`),
    )
    .transform((v) => v || undefined)
    .optional(),
  /** Honeypot: hidden from people, filled by bots. A filled one is accepted (204) and dropped. */
  website: z.string().max(RAW_MAX).optional(),
});
/** What the browser sends. */
export type DemoRequestBody = z.input<typeof DemoRequestInput>;
/** The normalised request. */
export type DemoRequestInput = z.output<typeof DemoRequestInput>;
