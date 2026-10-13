/**
 * Outgoing email over SMTP (Gmail / Google Workspace with an app password).
 * Callers normally go through `enqueueEmail` (jobs/emailQueue.ts) so sending is
 * retried and rate-limited; this module only knows how to deliver one message.
 * Message bodies and links are never logged.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailEnabled } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Validated address only (it becomes a header). */
  replyTo?: string;
}

type Sender = (msg: MailMessage) => Promise<void>;

let transport: Transporter | null = null;

const smtpSender: Sender = async (msg) => {
  if (!mailEnabled) throw new Error('Email is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM)');
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    // On the submission port, refuse to send credentials if the server doesn't offer STARTTLS (no downgrade).
    requireTLS: env.SMTP_PORT === 587,
    tls: { minVersion: 'TLSv1.2' },
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await transport.sendMail({
    from: env.MAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(msg.replyTo && { replyTo: msg.replyTo }),
  });
};

let sender: Sender = smtpSender;

export function sendMail(msg: MailMessage): Promise<void> {
  return sender(msg);
}

/** True when SMTP is configured, or a test sender is installed. */
export function emailEnabled(): boolean {
  return mailEnabled || sender !== smtpSender;
}

/** Tests: capture or fail deliveries instead of talking to SMTP; pass `null` to restore. */
export function setMailerForTests(fake: Sender | null): void {
  sender = fake ?? smtpSender;
}

export async function closeMailer(): Promise<void> {
  transport?.close();
  transport = null;
}
