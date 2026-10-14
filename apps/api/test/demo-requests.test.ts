/**
 * POST /api/public/demo-requests ("Book a demo" on /about): same-origin guard, strict input, honeypot,
 * duplicates, the fixed internal recipient, header safety and the rate limits.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DemoRequestInput } from '@classiq/shared';
import { setMailerForTests, type MailMessage } from '../src/lib/mailer.js';
import {
  DEMO_REQUESTS_PER_DAY,
  DEMO_REQUESTS_PER_IP,
  demoRequestLimiters,
} from '../src/middleware/rateLimit.js';
import { addressOf, CAPTURE_INBOX, demoRecipient } from '../src/modules/public/demoRequests.js';
import { anon } from './helpers.js';

const URL = '/api/public/demo-requests';
const OWN = 'http://localhost:3000'; // PUBLIC_ORIGIN in the test config
const INBOX = 'demo-inbox@benx.test'; // DEMO_REQUEST_TO in the test config

let outbox: MailMessage[] = [];
let n = 0;
/** A valid request; unique per call so the duplicate check never interferes between tests. */
const valid = (extra: Record<string, unknown> = {}) => ({
  name: 'Anita Rao',
  school: `Green Valley School ${++n}`,
  city: 'Hyderabad',
  phone: '+91 98765-43210',
  ...extra,
});
const post = (body: unknown) =>
  anon()
    .post(URL)
    .set('Origin', OWN)
    .send(body as object);

describe('POST /api/public/demo-requests', () => {
  beforeEach(() => {
    outbox = [];
    setMailerForTests(async (m) => void outbox.push(m));
  });
  afterEach(() => setMailerForTests(null));

  it('emails a valid request to the fixed inbox, never to the requester', async () => {
    const res = await post(
      valid({
        email: 'Anita@School.in',
        role: 'Principal',
        classrooms: 24,
        message: 'Two campuses.\nCall after 3 pm.',
      }),
    );
    expect(res.status).toBe(204);
    expect(outbox).toHaveLength(1);
    const mail = outbox[0]!;
    expect(mail.to).toBe(INBOX);
    expect(mail.replyTo).toBe('anita@school.in');
    expect(mail.subject).toMatch(/^Demo request: Green Valley School \d+, Hyderabad$/);
    expect(mail.text).toContain('Phone (WhatsApp): +919876543210');
    expect(mail.text).toContain('Classrooms: 24');
    expect(mail.text).toContain('Call after 3 pm.');
  });

  it('works without an email (no Reply-To)', async () => {
    expect((await post(valid())).status).toBe(204);
    expect(outbox[0]!.replyTo).toBeUndefined();
  });

  it('strips CR/LF and control characters from the subject, and escapes HTML in the body', async () => {
    const res = await post(
      valid({ school: 'Evil\r\nBcc: victim@x.in\u0000 <script>x</script>', city: 'Pune\nX-Header: 1' }),
    );
    expect(res.status).toBe(204);
    const mail = outbox[0]!;
    for (const c of ['\r', '\n', '\u0000']) expect(mail.subject).not.toContain(c);
    expect(mail.subject).toBe('Demo request: Evil Bcc: victim@x.in <script>x</script>, Pune X-Header: 1');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.to).toBe(INBOX);
  });

  it('drops a tripped honeypot silently (204, no email)', async () => {
    const res = await post(valid({ website: 'https://spam.example' }));
    expect(res.status).toBe(204);
    expect(outbox).toHaveLength(0);
  });

  it('answers a duplicate with 204 but emails it once', async () => {
    const body = valid();
    expect((await post(body)).status).toBe(204);
    expect((await post(body)).status).toBe(204);
    expect(outbox).toHaveLength(1);
  });

  it('refuses unknown fields and invalid values (400)', async () => {
    const extra = await post(valid({ to: 'someone@else.in' }));
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_FAILED');
    for (const bad of [
      valid({ name: '' }),
      valid({ name: 'x'.repeat(101) }),
      valid({ school: 'x'.repeat(151) }),
      valid({ city: 'x'.repeat(81) }),
      valid({ role: 'x'.repeat(81) }),
      valid({ message: 'x'.repeat(1001) }),
      valid({ phone: '12345' }),
      valid({ phone: '1'.repeat(21) }),
      valid({ phone: 'call me' }),
      valid({ email: 'not-an-email' }),
      valid({ email: 'a@b.in\r\nBcc: x@y.in' }),
      valid({ classrooms: 2.5 }),
      valid({ classrooms: '12' }),
      { name: 'Only a name' },
    ]) {
      const res = await post(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(outbox).toHaveLength(0);
  });

  it('blocks cross-site requests (403) and form-encodable bodies (415)', async () => {
    const cross = await anon().post(URL).set('Origin', 'https://evil.example').send(valid());
    expect(cross.status).toBe(403);
    expect(cross.body.error.code).toBe('FORBIDDEN');
    const text = await anon()
      .post(URL)
      .set('Origin', OWN)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(valid()));
    expect(text.status).toBe(415);
    const form = await anon().post(URL).set('Origin', OWN).type('form').send(valid());
    expect(form.status).toBe(415);
    expect(outbox).toHaveLength(0);
  });

  it('answers 503 EMAIL_UNAVAILABLE when email is not configured', async () => {
    setMailerForTests(null);
    const res = await post(valid());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EMAIL_UNAVAILABLE');
  });
});

describe('demo request recipient', () => {
  it('is DEMO_REQUEST_TO, else the address in MAIL_FROM, else the capture inbox under E2E_MAIL_CAPTURE', () => {
    expect(
      demoRecipient({
        DEMO_REQUEST_TO: 'sales@benx.in',
        MAIL_FROM: 'ClassIQ <noreply@benx.in>',
        E2E_MAIL_CAPTURE: false,
      }),
    ).toBe('sales@benx.in');
    expect(
      demoRecipient({
        DEMO_REQUEST_TO: '',
        MAIL_FROM: 'ClassIQ <noreply@benx.in>',
        E2E_MAIL_CAPTURE: false,
      }),
    ).toBe('noreply@benx.in');
    expect(
      demoRecipient({ DEMO_REQUEST_TO: '', MAIL_FROM: 'noreply@benx.in', E2E_MAIL_CAPTURE: false }),
    ).toBe('noreply@benx.in');
    expect(demoRecipient({ DEMO_REQUEST_TO: '', MAIL_FROM: '', E2E_MAIL_CAPTURE: true })).toBe(CAPTURE_INBOX);
    expect(demoRecipient({ DEMO_REQUEST_TO: '', MAIL_FROM: '', E2E_MAIL_CAPTURE: false })).toBeNull();
    expect(addressOf('Broken <not an address>')).toBeNull();
  });
});

describe('demo request input', () => {
  it('normalises phone numbers and text, and keeps line breaks only in the message', () => {
    const parsed = DemoRequestInput.parse({
      name: '  Anita\tRao ',
      school: 'Green‮Valley',
      city: 'Pune',
      phone: ' (040) 2345-6789 ',
      email: '',
      role: '',
      message: 'Line one\r\n\r\n\r\n\r\nLine two\u0007',
      website: '',
    });
    expect(parsed).toEqual({
      name: 'Anita Rao',
      school: 'Green Valley',
      city: 'Pune',
      phone: '04023456789',
      email: undefined,
      role: undefined,
      message: 'Line one\n\nLine two',
      website: '',
    });
  });
});

describe('demo request rate limits', () => {
  const appWith = (
    limiters: express.RequestHandler[],
    sent: (req: express.Request) => boolean = () => true,
  ) => {
    const app = express();
    app.use(express.json());
    app.post('/demo', ...limiters, (req, res) => {
      if (sent(req)) res.locals.demoEmailQueued = true;
      res.status(204).end();
    });
    return app;
  };

  it(`allows ${DEMO_REQUESTS_PER_IP} requests per IP per hour`, async () => {
    const [perIp] = demoRequestLimiters({ enforceInTests: true });
    const app = appWith([perIp!]);
    for (let i = 0; i < DEMO_REQUESTS_PER_IP; i++)
      expect((await request(app).post('/demo').send({})).status).toBe(204);
    const limited = await request(app).post('/demo').send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });

  it(`caps sent requests at ${DEMO_REQUESTS_PER_DAY} a day across all visitors; unsent ones don't count`, async () => {
    const [, perDay] = demoRequestLimiters({ enforceInTests: true });
    const app = appWith([perDay!], (req) => (req.body as { send?: boolean }).send === true);
    for (let i = 0; i < 10; i++)
      expect((await request(app).post('/demo').send({ send: false })).status).toBe(204);
    for (let i = 0; i < DEMO_REQUESTS_PER_DAY; i++)
      expect((await request(app).post('/demo').send({ send: true })).status).toBe(204);
    expect((await request(app).post('/demo').send({ send: true })).status).toBe(429);
  });
});
