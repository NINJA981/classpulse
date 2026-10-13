import type { Metadata } from 'next';
import { Bento } from './bento';
import { demoMailto, SITE_URL } from './contact';
import { Faq } from './faq';
import { Finale } from './finale';
import { landingFontVars } from './fonts';
import { HtmlLang } from './html-lang';
import {
  clientCopy,
  getLandingCopy,
  isIndexable,
  LOCALE_INFO,
  LOCALES,
  TRANSLATION_STATUS,
  type Locale,
} from './i18n';
import { LandingCopyProvider } from './i18n/copy-context';
import { LanguageWall } from './language-wall';
import { Roles } from './roles';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { Story } from './story/story';
import { StructuredData } from './structured-data';
import { TryQuestion } from './try-question';

/** The English page's Open Graph card (app/about/opengraph-image.tsx), reused by the translations. */
const OG_IMAGE = { url: '/about/opengraph-image', width: 1200, height: 630 } as const;

/**
 * The product page in one language: /about (English, canonical), /hi/about and /ta/about.
 * Server sections get their copy as props; client sections read it from <LandingCopyProvider>.
 */
export function LandingPage({ locale }: { locale: Locale }) {
  const copy = getLandingCopy(locale);
  const { lang } = LOCALE_INFO[locale];
  const draft = locale !== 'en' && TRANSLATION_STATUS[locale] === 'draft';
  return (
    <div data-theme="landing" lang={lang} className={`${landingFontVars} bg-canvas font-sans text-ink`}>
      {/* The root layout (shared by the whole app) renders <html lang="en">; this wrapper's lang covers the
          page's content from the first byte, and HtmlLang sets <html> itself once the page is running. */}
      <HtmlLang lang={lang} />
      <LandingCopyProvider copy={clientCopy(copy)}>
        <SiteHeader />
        <main id="main">
          <Story copy={copy.story} labels={copy.rail.labels} bookDemo={copy.header.bookDemo} />
          <TryQuestion />
          <LanguageWall />
          <Bento copy={copy.bento} />
          <Roles />
          <Faq copy={copy.faq} />
          <Finale copy={copy.finale} mailtoHref={demoMailto(copy.mailto)} />
        </main>
        <SiteFooter copy={copy.footer} draft={draft} />
      </LandingCopyProvider>
      <StructuredData locale={locale} meta={copy.meta} />
    </div>
  );
}

/**
 * Title, description, canonical, hreflang, Open Graph and robots for one language of the page.
 * hreflang lists only indexable pages (plus the page itself), so search engines never meet a draft through
 * /about. A draft translation is `noindex, follow` until TRANSLATION_STATUS marks it reviewed.
 */
export function landingMetadata(locale: Locale): Metadata {
  const { meta } = getLandingCopy(locale);
  const info = LOCALE_INFO[locale];
  const listed = LOCALES.filter((l) => l === locale || isIndexable(l));
  const languages =
    listed.length > 1
      ? {
          ...Object.fromEntries(listed.map((l) => [LOCALE_INFO[l].hreflang, LOCALE_INFO[l].path])),
          'x-default': LOCALE_INFO.en.path,
        }
      : undefined;
  const alternateLocale = LOCALES.filter((l) => l !== locale && isIndexable(l)).map(
    (l) => LOCALE_INFO[l].ogLocale,
  );
  // English uses its own file-based card; the translations point at it (it has no Indian-script text).
  const images = locale === 'en' ? undefined : [{ ...OG_IMAGE, alt: meta.ogImageAlt }];

  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: info.path, ...(languages ? { languages } : {}) },
    openGraph: {
      type: 'website',
      title: meta.title,
      description: meta.description,
      url: info.path,
      siteName: 'ClassPulse',
      locale: info.ogLocale,
      ...(alternateLocale.length ? { alternateLocale } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      ...(images ? { images } : {}),
    },
    ...(isIndexable(locale) ? {} : { robots: { index: false, follow: true } }),
  };
}
