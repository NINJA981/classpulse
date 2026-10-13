'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import clsx from 'clsx';
import { DEMO_HREF } from './contact';
import { useLandingCopy } from './i18n/copy-context';
import { LOCALE_INFO, LOCALES } from './i18n/locales';
import type { Locale } from './i18n/types';
import { PrimaryCta, SecondaryCta } from './landing-buttons';
import { ShareBrief } from './share-brief';
import { focusTarget, getLenis, scrollToTarget } from './smooth-scroll';

const NAV = [
  { href: '#chapter-record', key: 'howItWorks' },
  { href: '#try', key: 'tryQuestion' },
  { href: '#inside', key: 'inside' },
  { href: '#faq', key: 'faq' },
] as const;

/**
 * Fixed header: a board-green bar (90%, hairline) over the whole 3D story, then a solid wall bar with a
 * hairline. Why not transparent over the story: the room behind it is pale (walls, a white frame while the
 * live room loads), and chalk text has to stay legible over anything, with captions scrolling beneath.
 * Wide screens (xl) get the section links and the language switch in the bar; smaller ones a full-screen
 * chalkboard menu (focus trapped, Esc closes, scroll locked, focus returned) that holds both.
 */
export function SiteHeader() {
  const { header: copy, locale } = useLandingCopy();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pendingTarget = useRef<string | null>(null);

  // Board green while any of the story is under the header; the wall bar once it has scrolled past.
  // Why two looks: chalk on board suits the room; the wall bar matches the light sections below it.
  useEffect(() => {
    const story = document.getElementById('story');
    if (!story) return;
    // -76px: a few pixels below the 72px bar, so a section that lands flush under the header after an anchor
    // jump (story's bottom edge touching the bar, which still counts as intersecting) gets the solid bar.
    const io = new IntersectionObserver(([entry]) => setSolid(!(entry?.isIntersecting ?? true)), {
      rootMargin: '-76px 0px 0px 0px',
    });
    io.observe(story);
    return () => io.disconnect();
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Menu sheet: lock scroll, make the page inert, trap focus, Esc closes, restore focus after.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    getLenis()?.stop();
    const outside = Array.from(document.querySelectorAll<HTMLElement>('main, footer, [data-header-bar]'));
    outside.forEach((el) => el.setAttribute('inert', ''));

    const sheet = sheetRef.current;
    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter(
        (el) => el.offsetParent !== null,
      );
    // Focus the first menu item once the sheet is actually visible (next frame); fall back to the dialog.
    const raf = requestAnimationFrame(() => {
      const first = focusables()[0];
      first?.focus();
      if (!sheet || (first && document.activeElement === first)) return;
      sheet.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      outside.forEach((el) => el.removeAttribute('inert'));
      root.style.overflow = prevOverflow;
      getLenis()?.start();
      const target = pendingTarget.current;
      pendingTarget.current = null;
      if (target) {
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(target);
          if (!el) return;
          scrollToTarget(el);
          history.pushState(null, '', target);
          focusTarget(el);
        });
      } else {
        menuButtonRef.current?.focus();
      }
    };
  }, [open]);

  const onSheetLink = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    pendingTarget.current = href;
    setOpen(false);
  };

  const dark = !solid;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        data-header-bar
        className={clsx(
          'border-b transition-[background-color,border-color,color] duration-300 ease-snap',
          solid
            ? 'border-line bg-wall text-uniform'
            : 'border-chalk/15 bg-board/92 text-chalk',
        )}
      >
        <div className="landing-container flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
          <Wordmark label={copy.wordmarkLabel} />

          <nav aria-label={copy.mainNavLabel} className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={clsx(
                      'inline-flex h-11 items-center rounded-card text-[0.9375rem] font-medium whitespace-nowrap',
                      locale === 'en' ? 'px-3.5' : 'px-2.5',
                      'underline decoration-transparent decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-200 ease-snap',
                      dark ? 'hover:decoration-pulse' : 'hover:decoration-uniform',
                    )}
                  >
                    {copy.nav[item.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch
              label={copy.languageNavLabel}
              current={locale}
              dark={dark}
              className="hidden border-r border-current/25 pr-2 xl:flex"
            />
            <Link
              href="/login"
              className="hidden h-11 items-center rounded-card px-3.5 text-[0.9375rem] font-medium whitespace-nowrap underline decoration-transparent decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-200 ease-snap hover:decoration-current sm:inline-flex"
            >
              {copy.signIn}
            </Link>
            {/* Always on screen: compact on phones, full size from sm up. (Wrappers, because display
                utilities on the link itself would fight its own inline-flex.) */}
            <span className="contents sm:hidden">
              <PrimaryCta href={DEMO_HREF} size="sm" variant={dark ? 'onDark' : 'onLight'}>
                {copy.bookDemoShort}
              </PrimaryCta>
            </span>
            <span className="hidden sm:contents">
              <PrimaryCta href={DEMO_HREF} size="md" variant={dark ? 'onDark' : 'onLight'}>
                {/* The bar is tight in Tamil; the menu sheet and the page keep the full wording. */}
                {locale === 'ta' ? copy.bookDemoShort : copy.bookDemo}
              </PrimaryCta>
            </span>
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={open}
              aria-controls="landing-menu"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 items-center gap-2.5 rounded-card px-2 text-[0.9375rem] font-semibold whitespace-nowrap xl:hidden"
            >
              <span aria-hidden className="flex w-5 flex-col gap-[5px]">
                <span className="h-0.5 w-full bg-current" />
                <span className="h-0.5 w-3/4 bg-current" />
              </span>
              {/* Tamil's longer "Book demo" leaves no room for the word on the narrowest phones; the icon stays. */}
              <span className={locale === 'ta' ? 'max-sm:sr-only' : undefined}>{copy.menu}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Phone menu */}
      <div
        id="landing-menu"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.menuDialogLabel}
        tabIndex={-1}
        className={clsx(
          'fixed inset-0 z-[60] flex flex-col bg-board text-chalk xl:hidden',
          // visibility flips at once on open (so focus can land) and only after the fade on close
          open
            ? 'visible translate-y-0 opacity-100 [transition:opacity_300ms_var(--ease-snap),transform_300ms_var(--ease-snap)]'
            : 'invisible -translate-y-3 opacity-0 [transition:opacity_250ms_var(--ease-snap),transform_250ms_var(--ease-snap),visibility_0s_250ms]',
        )}
      >
        <div className="landing-container flex h-16 shrink-0 items-center justify-between">
          <Wordmark onClick={close} label={copy.wordmarkLabel} />
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center gap-2.5 rounded-card px-2 text-[0.9375rem] font-semibold focus-visible:outline-pulse"
          >
            {copy.close}
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav
          aria-label={copy.mainNavLabel}
          className="landing-container flex flex-1 flex-col justify-center overflow-y-auto py-8"
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href} className="border-b border-chalk/15 first:border-t">
                <a
                  href={item.href}
                  onClick={(e) => onSheetLink(e, item.href)}
                  className="flex min-h-16 items-center justify-between py-3 font-display text-display-m font-bold [font-variation-settings:'wdth'_90] focus-visible:outline-pulse"
                >
                  {copy.nav[item.key]}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <p className="text-sm text-chalk-dim">{copy.notDecider}</p>
            <ShareBrief tone="onDark" quiet label={copy.shareToManagement} className="-ml-1" />
          </div>
          <LanguageSwitch label={copy.languageNavLabel} current={locale} dark className="mt-6 -ml-2 flex" />
        </nav>
        <div className="landing-container flex shrink-0 flex-col gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row">
          <PrimaryCta
            href={DEMO_HREF}
            variant="onDark"
            className="w-full sm:w-auto"
            onClick={(e) => onSheetLink(e, DEMO_HREF)}
          >
            {copy.bookDemo}
          </PrimaryCta>
          <SecondaryCta href="/login" variant="onDark" className="w-full sm:w-auto">
            {copy.signIn}
          </SecondaryCta>
        </div>
      </div>
    </header>
  );
}

function Wordmark({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <a
      href="#main"
      onClick={onClick}
      aria-label={label}
      data-wordmark
      className="-ml-1 inline-flex h-11 shrink-0 items-center gap-2.5 rounded-card px-1"
    >
      <img src="/icons/icon.svg" alt="" width={28} height={28} className="size-7 rounded-[7px]" />
      <span
        lang="en"
        className="font-display text-[1.3125rem] font-bold tracking-[-0.02em] [font-variation-settings:'wdth'_88]"
      >
        ClassPulse
      </span>
    </a>
  );
}

/** Each language's own face, so its name reads right on every page (Bricolage has no Indian scripts). */
const NAME_FONT: Record<Locale, string> = {
  en: 'font-display',
  hi: 'font-[family-name:var(--font-anek-deva)]',
  ta: 'font-[family-name:var(--font-anek-tamil)]',
};

/**
 * English, हिन्दी, தமிழ்: each name in its own script and with its own lang, so readers find their language
 * whichever page they landed on. Plain links: every language is its own page, and a full load resets the
 * 3D story and <html lang>.
 */
function LanguageSwitch({
  label,
  current,
  dark,
  className,
}: {
  label: string;
  current: Locale;
  dark: boolean;
  className: string;
}) {
  return (
    <nav aria-label={label} className={clsx('items-center', className)}>
      <ul className="flex items-center">
        {LOCALES.map((l) => {
          const info = LOCALE_INFO[l];
          const active = l === current;
          return (
            <li key={l}>
              <a
                href={info.path}
                lang={info.lang}
                hrefLang={info.hreflang}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'inline-flex h-11 min-w-11 items-center justify-center rounded-card px-2 text-[0.9375rem] whitespace-nowrap',
                  'underline decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-200 ease-snap',
                  NAME_FONT[l],
                  active
                    ? clsx('font-bold', dark ? 'decoration-pulse' : 'decoration-current')
                    : clsx('font-medium decoration-transparent', dark ? 'hover:decoration-pulse' : 'hover:decoration-current'),
                )}
              >
                {info.nativeName}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
