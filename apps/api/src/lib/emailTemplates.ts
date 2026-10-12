/**
 * Shared email layout. Feature modules build their messages with `renderEmail`
 * so every email looks the same and always has a plain-text alternative.
 * All interpolated values are HTML-escaped.
 */
import { env } from '../config/env.js';
import type { MailMessage } from './mailer.js';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface EmailContent {
  to: string;
  subject: string;
  /** Shown above the heading, e.g. the school name. */
  schoolName: string;
  heading: string;
  /** Plain-text paragraphs (escaped; no HTML). */
  paragraphs: string[];
  /** Optional call-to-action button. */
  button?: { label: string; url: string };
  /** Optional small print under the button (e.g. "This link expires in 72 hours"). */
  footnote?: string;
}

/** Absolute URL on the web app, e.g. appUrl('/set-password#token=…'). */
export function appUrl(path: string): string {
  return `${env.PUBLIC_ORIGIN.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function renderEmail(c: EmailContent): MailMessage {
  const paras = c.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#222">${escapeHtml(p)}</p>`).join('');
  const button = c.button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(c.button.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;font-size:15px">${escapeHtml(c.button.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#666;word-break:break-all">Or open this link: ${escapeHtml(c.button.url)}</p>`
    : '';
  const foot = c.footnote ? `<p style="margin:14px 0 0;font-size:12px;color:#666">${escapeHtml(c.footnote)}</p>` : '';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e2dc">
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#666;font-weight:700">${escapeHtml(c.schoolName)} · ClassPulse</p>
<h1 style="margin:8px 0 18px;font-size:22px;color:#111">${escapeHtml(c.heading)}</h1>${paras}${button}${foot}</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #eee;font-size:12px;color:#888">You received this email because your school uses ClassPulse. If you weren't expecting it, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `${c.schoolName} · ClassPulse`,
    '',
    c.heading,
    '',
    ...c.paragraphs.flatMap((p) => [p, '']),
    ...(c.button ? [`${c.button.label}: ${c.button.url}`, ''] : []),
    ...(c.footnote ? [c.footnote, ''] : []),
    "You received this email because your school uses ClassPulse. If you weren't expecting it, you can ignore it.",
  ].join('\n');
  return { to: c.to, subject: c.subject, html, text };
}
