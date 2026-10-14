'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLandingCopy } from './i18n/copy-context';
import type { WallLanguage } from './i18n/types';

type Tier = 'xl' | 'l' | 'm' | 's';

/**
 * "Learning" in the eleven languages ClassIQ transcribes, in the order the wall is composed. The Indian words are
 * set in fonts cut to their letters: change one, then re-run components/landing/wall-fonts/subset.py.
 */
const WORDS: { lang: WallLanguage; word: string; tier: Tier; place: string }[] = [
  { lang: 'en', word: 'learning', tier: 'xl', place: 'md:col-span-6' },
  { lang: 'ta', word: 'கற்றல்', tier: 'l', place: 'md:col-span-6 md:justify-self-end md:self-start' },
  { lang: 'hi', word: 'सीखना', tier: 'l', place: 'md:col-span-4' },
  { lang: 'kn', word: 'ಕಲಿಕೆ', tier: 's', place: 'md:col-span-2 md:self-start' },
  { lang: 'te', word: 'నేర్చుకోవడం', tier: 'm', place: 'md:col-span-6 md:justify-self-end' },
  { lang: 'pa', word: 'ਸਿੱਖਣਾ', tier: 's', place: 'md:col-span-2 md:self-end md:pb-4' },
  { lang: 'bn', word: 'শেখা', tier: 'xl', place: 'md:col-span-5' },
  { lang: 'ml', word: 'പഠനം', tier: 'l', place: 'md:col-span-5 md:justify-self-end' },
  { lang: 'mr', word: 'शिकणे', tier: 'm', place: 'md:col-span-3 md:col-start-2' },
  { lang: 'or', word: 'ଶିଖିବା', tier: 'm', place: 'md:col-span-4 md:justify-self-center' },
  { lang: 'gu', word: 'શીખવું', tier: 'l', place: 'md:col-span-4 md:justify-self-end' },
];

const SIZES: Record<Tier, string> = {
  xl: 'text-[clamp(3.25rem,0.9rem+8.6vw,9.75rem)] text-chalk',
  l: 'text-[clamp(2.4rem,0.9rem+5.2vw,6rem)] text-chalk',
  m: 'text-[clamp(1.85rem,0.9rem+3.3vw,4rem)] text-chalk-dim',
  s: 'text-[clamp(1.5rem,0.9rem+1.9vw,2.75rem)] text-chalk-dim',
};

/** Anek, subset to these words, one file per script (components/landing/fonts.ts). Marathi is written in Devanagari. */
const FAMILY: Record<string, string> = {
  ta: 'var(--font-wall-tamil)',
  hi: 'var(--font-wall-deva)',
  mr: 'var(--font-wall-deva)',
  kn: 'var(--font-wall-kannada)',
  te: 'var(--font-wall-telugu)',
  pa: 'var(--font-wall-gurmukhi)',
  bn: 'var(--font-wall-bangla)',
  ml: 'var(--font-wall-malayalam)',
  or: 'var(--font-wall-odia)',
  gu: 'var(--font-wall-gujarati)',
};

/*
 * The breath. One number, --breath (0 = narrowest, 1 = widest), set on the list and read by all eleven words, so
 * the wall widens and narrows as one. Anek's width runs 82 to 118 around its normal 100; Bricolage, whose axis
 * stops at 100, runs 76 to 100 for "learning". Each word sits on an invisible copy of itself at full width, which
 * holds its place, so lines never re-wrap while the wall breathes. Without scroll animation (reduced motion, no JS)
 * --breath rests at 0.5: Anek at its normal width.
 */
const WIDTH = {
  indic: { min: 82, span: 36 },
  latin: { min: 76, span: 24 },
} as const;

function widthAt(lang: string, breath: string) {
  const { min, span } = lang === 'en' ? WIDTH.latin : WIDTH.indic;
  return `'wdth' calc(${min} + ${span} * ${breath})`;
}

function wordStyle(lang: string, breath: string): CSSProperties {
  return lang === 'en'
    ? { fontVariationSettings: `${widthAt(lang, breath)}, 'opsz' 96` }
    : { fontFamily: `${FAMILY[lang]}, var(--cp-font-indic)`, fontVariationSettings: widthAt(lang, breath) };
}

export function LanguageWall() {
  const { languageWall: copy } = useLandingCopy();
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll scrubs the breath: narrow as the wall comes up, widest as it crosses the middle of the screen, narrow
  // again as it leaves. Only with motion allowed; reduced motion (or capture mode) leaves it at rest.
  useEffect(() => {
    const list = listRef.current;
    if (!list || document.documentElement.dataset.capture === '1') return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap
        .timeline({
          defaults: { ease: 'sine.inOut' },
          scrollTrigger: { trigger: list, start: 'top bottom', end: 'bottom top', scrub: 0.4 },
        })
        .fromTo(list, { '--breath': 0 }, { '--breath': 1 })
        .to(list, { '--breath': 0 });
      return () => gsap.set(list, { clearProps: '--breath' });
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      id="languages"
      aria-labelledby="languages-title"
      className="relative overflow-hidden bg-board py-20 text-chalk md:py-28"
    >
      <div className="landing-container">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2
            id="languages-title"
            className="font-display text-display-l font-extrabold text-balance md:col-span-7 [font-variation-settings:'wdth'_96,'opsz'_72]"
          >
            {copy.title}
          </h2>
          <div className="md:col-span-5 md:pb-2">
            <p className="max-w-[40ch] text-lede text-chalk-dim">{copy.lede}</p>
          </div>
        </div>

        <ul
          ref={listRef}
          className="mt-12 flex flex-wrap items-baseline gap-x-[0.18em] gap-y-1 [--breath:0.5] md:mt-16 md:grid md:grid-cols-12 md:gap-x-6 md:gap-y-2"
        >
          {WORDS.map((w) => {
            const on = active === w.lang;
            const face =
              w.lang === 'en' ? 'font-display font-extrabold tracking-[-0.03em]' : 'font-semibold';
            return (
              <li key={w.lang} className={clsx(SIZES[w.tier], w.place, 'leading-[1.2]')}>
                <button
                  type="button"
                  data-active={on || undefined}
                  onClick={() => setActive(on ? null : w.lang)}
                  className={clsx(
                    // min-h-11: the smallest words still give a 44px target on phones.
                    'group relative inline-flex min-h-11 flex-col justify-end rounded-card px-[0.12em] pt-[0.5rem] transition-[color,transform] duration-300 ease-snap',
                    'hover:text-pulse focus-visible:text-pulse focus-visible:outline-pulse data-active:text-pulse',
                  )}
                >
                  <span className="grid justify-items-start">
                    {/* Holds the word's widest footprint so the line never re-wraps. */}
                    <span
                      aria-hidden
                      lang={w.lang}
                      className={clsx('invisible col-start-1 row-start-1 select-none', face)}
                      style={wordStyle(w.lang, '1')}
                    >
                      {w.word}
                    </span>
                    <span
                      lang={w.lang}
                      className={clsx('col-start-1 row-start-1', face)}
                      style={wordStyle(w.lang, 'var(--breath)')}
                    >
                      {w.word}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      'pointer-events-none absolute top-0 left-[0.12em] font-mono text-xs leading-none font-normal tracking-normal whitespace-nowrap text-pulse sm:text-[0.8125rem]',
                      'translate-y-1 opacity-0 transition-[opacity,transform] duration-200 ease-snap',
                      'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 group-data-active:translate-y-0 group-data-active:opacity-100',
                    )}
                  >
                    {copy.names[w.lang]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-sm text-chalk-dim md:mt-14">{copy.hint}</p>
      </div>
    </section>
  );
}
