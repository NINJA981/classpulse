import { en } from './en';
import { hi } from './hi';
import { ta } from './ta';
import type { LandingClientCopy, LandingCopy, Locale } from './types';

/*
 * The product page's copy, one typed dictionary per language (en.ts is the source; `LandingCopy` in types.ts
 * makes a missing or extra string a type error). Server components get their section's copy as props from
 * landing-page.tsx; client components read the client part through <LandingCopyProvider>.
 *
 * Reviewing a translation (hi.ts, ta.ts start as machine-assisted drafts):
 *   1. A native speaker who knows Indian schools reads the whole page at /hi/about or /ta/about, on a phone and
 *      on a laptop, against /about. Check meaning first (no promise the English doesn't make, nothing dropped),
 *      then register (a school circular, not a textbook and not slang), then the product words schools really
 *      use. The FAQ's data and consent answers must say exactly what /privacy says.
 *   2. Also read what is easy to miss: the demo form's errors (submit it empty, type a bad phone number), its
 *      failure and thank-you messages, the screen-reader-only strings (aria-labels, "Step 1 of 5: ", the sample
 *      question's announcements), the page title and description (metadata), and the WhatsApp share text.
 *   3. Fix strings in the dictionary, then set TRANSLATION_STATUS[locale] to 'reviewed' in i18n/locales.ts.
 *      That makes the page indexable, adds it to sitemap.xml and to /about's hreflang links, and removes the
 *      "being reviewed" note from its footer. Note the reviewer and date in the commit message.
 *   4. Whenever English copy changes, change hi.ts and ta.ts in the same commit and set the locale back to
 *      'draft' until the new strings have been reviewed.
 */

export { INDEXABLE_LOCALES, LOCALE_INFO, LOCALES, TRANSLATED_LOCALES, TRANSLATION_STATUS } from './locales';
export { isIndexable, isTranslatedLocale, type TranslatedLocale } from './locales';
export type { LandingClientCopy, LandingCopy, Locale } from './types';

const DICTIONARIES: Record<Locale, LandingCopy> = { en, hi, ta };

export function getLandingCopy(locale: Locale): LandingCopy {
  return DICTIONARIES[locale];
}

/** Only what the client components need, so the rest of the dictionary never ships to the browser. */
export function clientCopy(copy: LandingCopy): LandingClientCopy {
  const { locale, header, rail, tryQuestion, languageWall, roles, demoForm, mailto, share } = copy;
  return { locale, header, rail, tryQuestion, languageWall, roles, demoForm, mailto, share };
}
