import type { Locale, TranslationStatus } from './types';

/*
 * Client-safe locale facts (no dictionaries here, so the header and the share button can import this without
 * pulling every translation into the browser bundle). The dictionaries live in i18n/index.ts.
 */

export const LOCALES = ['en', 'hi', 'ta'] as const satisfies readonly Locale[];

/** Locales with their own route under /[locale]/about. English is /about. */
export const TRANSLATED_LOCALES = ['hi', 'ta'] as const satisfies readonly Exclude<Locale, 'en'>[];
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

/**
 * Review state of each translation. While a locale is 'draft' its page is `noindex`, it is left out of
 * sitemap.xml and of /about's hreflang links, and its footer says the translation is being reviewed.
 * Flip it to 'reviewed' only after a native speaker has signed it off (checklist in i18n/index.ts).
 */
export const TRANSLATION_STATUS: Record<TranslatedLocale, TranslationStatus> = {
  hi: 'draft',
  ta: 'draft',
};

export const LOCALE_INFO: Record<
  Locale,
  {
    /** The lang attribute for the page. */
    lang: string;
    /** hreflang (language + region): the page is written for schools in India. */
    hreflang: string;
    /** Open Graph locale. */
    ogLocale: string;
    /** The language's name in its own script, for the language switch. */
    nativeName: string;
    path: string;
  }
> = {
  en: { lang: 'en', hreflang: 'en-IN', ogLocale: 'en_IN', nativeName: 'English', path: '/about' },
  hi: { lang: 'hi', hreflang: 'hi-IN', ogLocale: 'hi_IN', nativeName: 'हिन्दी', path: '/hi/about' },
  ta: { lang: 'ta', hreflang: 'ta-IN', ogLocale: 'ta_IN', nativeName: 'தமிழ்', path: '/ta/about' },
};

export function isTranslatedLocale(value: string): value is TranslatedLocale {
  return (TRANSLATED_LOCALES as readonly string[]).includes(value);
}

/** English is always indexable; a translation only once it has been reviewed. */
export function isIndexable(locale: Locale): boolean {
  return locale === 'en' || TRANSLATION_STATUS[locale] === 'reviewed';
}

export const INDEXABLE_LOCALES: Locale[] = LOCALES.filter(isIndexable);
