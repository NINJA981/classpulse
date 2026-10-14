'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import clsx from 'clsx';
import { Check, Link2, Send } from 'lucide-react';
import { SITE_URL } from './contact';
import { useLandingCopy } from './i18n/copy-context';
import { LOCALE_INFO } from './i18n/locales';
import { ctaClassName } from './landing-buttons';

/*
 * "Send to your management": in most schools the people who decide (trustees, the correspondent, the principal)
 * hear about a product from a teacher, usually on WhatsApp. This hands them a short, honest brief and the link.
 *
 * The control is a plain link to WhatsApp's own share page (wa.me, no phone number), so it works without
 * JavaScript. Where the browser has a share sheet (Android, most phones), a click opens that instead, so the visitor
 * picks WhatsApp, email or anything else. "Copy link" is there for everything else. No tracking of any kind.
 */

// The brief and the link are in the page's language: a Hindi reader forwards the Hindi page.

type Tone = 'onLight' | 'onDark';

const textAction =
  'inline-flex min-h-11 items-center gap-2 rounded-card px-1 font-semibold underline decoration-2 underline-offset-4';
const textOnDark = 'text-chalk decoration-chalk/40 hover:decoration-pulse focus-visible:outline-pulse';
const textOnLight = 'text-uniform decoration-uniform/40 hover:decoration-uniform';
type CopyState = 'idle' | 'copied' | 'failed';

export interface ShareBriefProps {
  /** Background it sits on, as for the landing CTAs. */
  tone?: Tone;
  size?: 'md' | 'lg';
  /** Button text. Default: the page's "Send to your management". */
  label?: string;
  /** A text link rather than an outlined button, for places that already have their buttons (the phone menu). */
  quiet?: boolean;
  className?: string;
}

export function ShareBrief({
  tone = 'onDark',
  size = 'md',
  label,
  quiet = false,
  className,
}: ShareBriefProps) {
  const { share: copy, locale } = useLandingCopy();
  const pageUrl = `${SITE_URL}${LOCALE_INFO[locale].path}`;
  const brief = copy.brief;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${brief} ${pageUrl}`)}`;
  const [copied, setCopy] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onShare = async (e: MouseEvent<HTMLAnchorElement>) => {
    // No share sheet (most desktops): follow the link to WhatsApp in a new tab.
    if (typeof navigator.share !== 'function') return;
    const data = { title: 'ClassIQ', text: brief, url: pageUrl };
    if (navigator.canShare && !navigator.canShare(data)) return;
    e.preventDefault();
    try {
      await navigator.share(data);
    } catch (err) {
      // Closing the sheet is not an error. Anything else (blocked, unsupported): the link still works.
      if ((err as DOMException)?.name !== 'AbortError') window.open(whatsappHref, '_blank', 'noopener,noreferrer');
    }
  };

  const onCopy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopy('copied');
      timer.current = setTimeout(() => setCopy('idle'), 4000);
    } catch {
      setCopy('failed');
    }
  };

  const onDark = tone === 'onDark';

  return (
    <div className={clsx('flex flex-wrap items-center gap-x-5 gap-y-2', className)}>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onShare}
        className={
          quiet
            ? clsx(textAction, onDark ? textOnDark : textOnLight, 'text-base')
            : clsx(ctaClassName('secondary', tone, size), 'max-sm:w-full')
        }
      >
        <Send aria-hidden className="size-[1.1em]" strokeWidth={2.25} />
        <span>{label ?? copy.label}</span>
      </a>
      <button
        type="button"
        onClick={onCopy}
        className={clsx(textAction, onDark ? textOnDark : textOnLight, 'text-sm')}
      >
        {copied === 'copied' ? (
          <Check aria-hidden className="size-4" strokeWidth={3} />
        ) : (
          <Link2 aria-hidden className="size-4" />
        )}
        {copied === 'copied' ? copy.copied : copy.copyLink}
      </button>
      {/* Announced politely; shown only when the link has to be copied by hand. Not role="status": the demo
          form's sent card already is one. */}
      <p
        aria-live="polite"
        className={clsx(
          copied === 'failed' ? 'w-full text-sm [overflow-wrap:anywhere]' : 'sr-only',
          onDark ? 'text-chalk-dim' : 'text-muted',
        )}
      >
        {copied === 'copied' ? copy.copied : null}
        {copied === 'failed' ? (
          <>
            {copy.copyFailed}{' '}
            <span className={clsx('font-semibold select-all', onDark ? 'text-chalk' : 'text-uniform')}>{pageUrl}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
