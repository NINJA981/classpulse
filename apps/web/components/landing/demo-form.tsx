'use client';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronDown, Mail, TriangleAlert } from 'lucide-react';
import {
  DEMO_REQUEST_LIMITS,
  DemoRequestInput,
  type ApiErrorBody,
  type DemoRequestBody,
} from '@classiq/shared';
import { CONTACT_EMAIL, demoMailto } from './contact';
import { useLandingCopy } from './i18n/copy-context';
import { fill, fillNodes } from './i18n/format';
import type { DemoFailure, DemoFormErrors, LandingClientCopy } from './i18n/types';
import { ctaClassName } from './landing-buttons';
import { ShareBrief } from './share-brief';

/**
 * "Book a demo" request form (/about, inside the finale's `#book`). Validates with the same zod schema as
 * the API (DemoRequestInput in @classiq/shared) and posts JSON to its own origin. The API emails the
 * request to the BenX inbox; nothing is sent to the visitor. If it can't be sent (rate limit, email not
 * configured here, network), the visitor gets an email link with what they typed already filled in.
 *
 * Plain fetch rather than `api` from lib/api: that client redirects to sign-in pages on some errors,
 * which is wrong for a public page.
 *
 * Copy comes from the page's language (i18n). The schema's messages are English; on translated pages
 * localiseError() maps each one it knows to the dictionary's `demoForm.errors`.
 */

type FieldName = 'name' | 'school' | 'city' | 'phone' | 'email' | 'role' | 'classrooms' | 'message';
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;
type Failure = DemoFailure;
type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; name: string; phone: string }
  | { kind: 'error'; failure: Failure };

const EMPTY: Values = {
  name: '',
  school: '',
  city: '',
  phone: '',
  email: '',
  role: '',
  classrooms: '',
  message: '',
};
const ORDER: FieldName[] = ['name', 'school', 'city', 'phone', 'email', 'role', 'classrooms', 'message'];
const OPTIONAL: FieldName[] = ['email', 'role', 'classrooms', 'message'];

/** The request body: optional fields only when filled in, the class count as a number. */
function toBody(v: Values, website = ''): DemoRequestBody {
  const trimmed = (s: string) => s.trim();
  const body: DemoRequestBody = { name: v.name, school: v.school, city: v.city, phone: v.phone };
  if (trimmed(v.email)) body.email = v.email;
  if (trimmed(v.role)) body.role = v.role;
  if (trimmed(v.classrooms)) body.classrooms = Number(trimmed(v.classrooms));
  if (trimmed(v.message)) body.message = v.message;
  if (website) body.website = website;
  return body;
}

/**
 * The schema's (English) message in the page's language. `errors` null (English) keeps the schema's own words;
 * a message this doesn't recognise also stays as it is, so a new rule in the schema still shows something true.
 */
function localiseError(field: FieldName, message: string, errors: DemoFormErrors | null): string {
  if (!errors) return message;
  const n = (m: RegExpMatchArray) => m[1] ?? '';
  let m: RegExpMatchArray | null;
  const required = field === 'name' || field === 'school' || field === 'city';
  if (required && /^Enter your /.test(message)) return errors.required[field];
  if ((m = message.match(/^Keep .* under (\d+) characters$/))) return fill(errors.tooLong, { max: n(m) });
  if (message === 'Enter a phone number') return errors.phoneRequired;
  if (message.startsWith('Use digits only')) return errors.phoneDigitsOnly;
  if ((m = message.match(/^Enter at least (\d+) digits$/))) return fill(errors.phoneMinDigits, { n: n(m) });
  if ((m = message.match(/^Use at most (\d+) digits$/))) return fill(errors.phoneMaxDigits, { n: n(m) });
  if (message === 'Enter a valid email address') return errors.email;
  if (message === 'Enter a whole number') return errors.wholeNumber;
  if ((m = message.match(/^Enter at least (\d+)$/))) return fill(errors.minNumber, { n: n(m) });
  if ((m = message.match(/^Enter at most (\d+)$/))) return fill(errors.maxNumber, { n: n(m) });
  // zod's own wording (e.g. a missing field): the field's plain "enter …" message.
  if (required) return errors.required[field];
  if (field === 'phone') return errors.phoneRequired;
  return message;
}

function validate(v: Values, messages: DemoFormErrors | null): Errors {
  const parsed = DemoRequestInput.safeParse(toBody(v));
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as FieldName;
    if (ORDER.includes(field)) errors[field] ??= localiseError(field, issue.message, messages);
  }
  return errors;
}

/** An email to BenX with whatever the visitor typed, for when the form can't be sent. */
function mailtoWith(v: Values, mailto: LandingClientCopy['mailto']): string {
  const { labels } = mailto;
  const lines = [
    [labels.name, v.name],
    [labels.school, v.school],
    [labels.city, v.city],
    [labels.phone, v.phone],
    [labels.role, v.role],
    [labels.classrooms, v.classrooms],
  ]
    .filter(([, value]) => value!.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`);
  if (lines.length === 0) return demoMailto(mailto);
  const body = [...lines, ...(v.message.trim() ? ['', v.message.trim()] : [])].join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailto.subject)}&body=${encodeURIComponent(body)}`;
}

export function DemoForm({ tone = 'onDark' }: { tone?: 'onDark' | 'onLight' }) {
  const { demoForm: copy, mailto } = useLandingCopy();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const sending = status.kind === 'sending';

  const set = (field: FieldName) => (value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field has been left (or a submit tried), keep its message in step with what's typed.
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validate(next, copy.errors)[field] }));
  };
  const blur = (field: FieldName) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(values, copy.errors)[field] }));
  };

  const focusFirstInvalid = (errs: Errors) => {
    const first = ORDER.find((f) => errs[f]);
    if (!first) return;
    if (OPTIONAL.includes(first)) setDetailsOpen(true);
    // After the details panel has opened.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    // Read from the DOM: bots may fill the honeypot without firing input events.
    const website = String(new FormData(e.currentTarget).get('website') ?? '');
    const errs = validate(values, copy.errors);
    setTouched(Object.fromEntries(ORDER.map((f) => [f, true])));
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setStatus({ kind: 'idle' });
      focusFirstInvalid(errs);
      return;
    }

    setStatus({ kind: 'sending' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let failure: Failure;
    try {
      const res = await fetch('/api/public/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(toBody(values, website)),
        signal: controller.signal,
      });
      if (res.ok) {
        setStatus({
          kind: 'sent',
          name: values.name.trim().split(/\s+/)[0] ?? '',
          phone: values.phone.trim(),
        });
        requestAnimationFrame(() => sentRef.current?.focus());
        return;
      }
      const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
      if (res.status === 400 && Array.isArray(data?.error.details)) {
        const serverErrors: Errors = {};
        for (const d of data.error.details as { path: string; message: string }[]) {
          const field = d.path.split('.')[0] as FieldName;
          if (ORDER.includes(field)) serverErrors[field] ??= localiseError(field, d.message, copy.errors);
        }
        setErrors(serverErrors);
        failure = 'invalid';
      } else if (res.status === 429) failure = 'rate';
      else if (res.status === 503 || data?.error.code === 'EMAIL_UNAVAILABLE') failure = 'unavailable';
      else failure = 'other';
    } catch {
      failure = 'network';
    } finally {
      clearTimeout(timer);
    }
    setStatus({ kind: 'error', failure });
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  const card = clsx(
    'relative border-2 border-uniform bg-chalk text-uniform rounded-card',
    tone === 'onDark' ? 'shadow-[8px_8px_0_var(--cp-uniform)]' : 'shadow-hard',
  );

  if (status.kind === 'sent') {
    return (
      <div className={clsx(card, 'p-6 sm:p-8')} role="status">
        <span
          aria-hidden
          className="mb-5 inline-flex size-11 items-center justify-center rounded-full border-2 border-uniform bg-pulse"
        >
          <Check className="size-5" strokeWidth={3} />
        </span>
        <h3
          ref={sentRef}
          tabIndex={-1}
          className="font-display text-2xl font-extrabold tracking-tight text-balance focus:outline-none"
        >
          {status.name ? fill(copy.sent.titleNamed, { name: status.name }) : copy.sent.title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-ink-2">
          {fillNodes(copy.sent.body, {
            phone: <span className="font-semibold whitespace-nowrap text-uniform">{status.phone}</span>,
          })}
        </p>
        <ShareBrief tone="onLight" label={copy.sent.share} className="mt-5" />
        <p className="mt-5 border-t-2 border-dashed border-line pt-4 text-sm text-muted">
          {fillNodes(copy.sent.addSomething, {
            email: (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                lang="en"
                className="font-semibold [overflow-wrap:anywhere] text-uniform underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            ),
          })}
        </p>
      </div>
    );
  }

  const failure = status.kind === 'error' ? copy.failures[status.failure] : null;
  const detailsId = `${id}-details`;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={`${id}-title`}
      aria-busy={sending}
      className={clsx(card, 'p-5 sm:p-7')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-title`} className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          {copy.title}
        </h3>
        <p className="text-sm text-muted">{copy.subtitle}</p>
      </div>

      <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <TextField
          id={id}
          name="name"
          label={copy.fields.name}
          autoComplete="name"
          maxLength={DEMO_REQUEST_LIMITS.name}
          value={values.name}
          error={errors.name}
          onChange={set('name')}
          onBlur={blur('name')}
        />
        <TextField
          id={id}
          name="phone"
          label={copy.fields.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={32}
          value={values.phone}
          error={errors.phone}
          onChange={set('phone')}
          onBlur={blur('phone')}
          hint={copy.fields.phoneHint}
        />
        <TextField
          id={id}
          name="school"
          label={copy.fields.school}
          autoComplete="organization"
          maxLength={DEMO_REQUEST_LIMITS.school}
          value={values.school}
          error={errors.school}
          onChange={set('school')}
          onBlur={blur('school')}
        />
        <TextField
          id={id}
          name="city"
          label={copy.fields.city}
          autoComplete="address-level2"
          maxLength={DEMO_REQUEST_LIMITS.city}
          value={values.city}
          error={errors.city}
          onChange={set('city')}
          onBlur={blur('city')}
        />
      </div>

      <div className="mt-5 border-t-2 border-dashed border-line pt-3">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((o) => !o)}
          className="group inline-flex min-h-11 items-center gap-2 text-sm font-bold text-uniform underline-offset-4 hover:underline"
        >
          <ChevronDown
            aria-hidden
            className={clsx(
              'size-4 motion-safe:transition-transform motion-safe:duration-200',
              detailsOpen && 'rotate-180',
            )}
          />
          {detailsOpen ? copy.fewerDetails : copy.addDetails}
          <span className="font-normal text-muted">{copy.optional}</span>
        </button>
        <div id={detailsId} hidden={!detailsOpen} className="grid gap-x-4 gap-y-4 pt-2 pb-1 sm:grid-cols-2">
          <TextField
            id={id}
            name="email"
            label={copy.fields.email}
            optional={copy.optional}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={values.email}
            error={errors.email}
            onChange={set('email')}
            onBlur={blur('email')}
          />
          <TextField
            id={id}
            name="role"
            label={copy.fields.role}
            optional={copy.optional}
            autoComplete="organization-title"
            maxLength={DEMO_REQUEST_LIMITS.role}
            value={values.role}
            error={errors.role}
            onChange={set('role')}
            onBlur={blur('role')}
            placeholder={copy.fields.rolePlaceholder}
          />
          <TextField
            id={id}
            name="classrooms"
            label={copy.fields.classrooms}
            optional={copy.optional}
            type="number"
            inputMode="numeric"
            min={1}
            max={DEMO_REQUEST_LIMITS.classrooms}
            step={1}
            value={values.classrooms}
            error={errors.classrooms}
            onChange={set('classrooms')}
            onBlur={blur('classrooms')}
          />
          <TextField
            id={id}
            name="message"
            label={copy.fields.message}
            optional={copy.optional}
            multiline
            maxLength={DEMO_REQUEST_LIMITS.message}
            value={values.message}
            error={errors.message}
            onChange={set('message')}
            onBlur={blur('message')}
            className="sm:col-span-2"
          />
        </div>
      </div>

      {/* Honeypot: invisible to people and assistive tech; bots that fill it in are dropped by the API. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
      >
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {failure ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 flex gap-3 border-2 border-redpen bg-chalk p-4 text-sm focus:outline-none"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-redpen" />
          <div>
            <p className="font-bold text-redpen">{failure.title}</p>
            <p className="mt-1 text-ink-2">{failure.body}</p>
            <a
              href={mailtoWith(values, mailto)}
              className="mt-2 inline-flex min-h-11 items-center gap-2 font-bold text-uniform underline underline-offset-4"
            >
              <Mail aria-hidden className="size-4" />
              <span>{fillNodes(copy.emailUs, { email: <span lang="en">{CONTACT_EMAIL}</span> })}</span>
            </a>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          aria-disabled={sending}
          className={clsx(
            ctaClassName('primary', 'onLight', 'lg'),
            'w-full sm:w-auto',
            sending && 'cursor-progress',
          )}
        >
          <span>{sending ? copy.sending : copy.submit}</span>
          <ArrowRight
            aria-hidden
            className={clsx(
              'size-5',
              sending
                ? 'opacity-0'
                : 'motion-safe:transition-transform motion-safe:group-hover/cta:translate-x-0.5',
            )}
          />
        </button>
        <p className="text-xs text-muted sm:max-w-[16rem] sm:text-right">{copy.privacyNote}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {sending ? copy.sendingAnnouncement : ''}
      </p>
    </form>
  );
}

interface TextFieldProps {
  /** The form's id prefix. */
  id: string;
  name: FieldName;
  label: string;
  value: string;
  error?: string;
  hint?: ReactNode;
  /** The "(optional)" suffix, in the page's language; absent for required fields. */
  optional?: string;
  multiline?: boolean;
  type?: 'text' | 'tel' | 'email' | 'number';
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function TextField({
  id,
  name,
  label,
  value,
  error,
  hint,
  optional,
  multiline,
  onChange,
  onBlur,
  className,
  type = 'text',
  ...rest
}: TextFieldProps) {
  const fieldId = `${id}-${name}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const control = clsx(
    'w-full border-2 bg-surface px-3 text-base text-uniform rounded-control placeholder:text-muted/70',
    'motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150',
    // The landing theme's focus outline (current colour, navy) stays; the yellow offset is extra.
    'focus:shadow-[4px_4px_0_var(--cp-pulse)]',
    error ? 'border-redpen' : 'border-uniform/70 hover:border-uniform focus:border-uniform',
  );
  const shared = {
    id: fieldId,
    name,
    value,
    required: !optional,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
    onBlur,
  };
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-bold">
        {label}
        {optional ? <span className="font-normal text-muted"> {optional}</span> : null}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          {...rest}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(control, 'resize-y py-2.5 leading-relaxed')}
        />
      ) : (
        <input
          {...shared}
          {...rest}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(control, 'h-12')}
        />
      )}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-redpen">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
