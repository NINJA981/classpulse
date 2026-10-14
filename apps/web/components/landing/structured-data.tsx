import { CONTACT_EMAIL, SITE_URL } from './contact';
import { LOCALE_INFO, type LandingCopy, type Locale } from './i18n';

/** The 11 languages ClassIQ understands, as BCP-47 tags (English as spoken in India first). */
const LANGUAGES = ['en-IN', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'] as const;

const ORG_ID = `${SITE_URL}/#organization`;
const APP_ID = `${SITE_URL}/#classiq`;

/**
 * schema.org description of the product page, per language: the WebPage carries the language the page is
 * written in (inLanguage), the app the eleven it understands. Pilot stage: deliberately no `offers`, prices or
 * ratings — add them only when they are real.
 */
function graph(locale: Locale, meta: LandingCopy['meta']) {
  const url = `${SITE_URL}${LOCALE_INFO[locale].path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: meta.title,
        description: meta.description,
        inLanguage: LOCALE_INFO[locale].hreflang,
        about: { '@id': APP_ID },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'BenX Solutions',
        url: SITE_URL,
        email: CONTACT_EMAIL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: CONTACT_EMAIL, areaServed: 'IN' },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: 'ClassIQ',
        url: `${SITE_URL}/about`,
        image: `${SITE_URL}/icons/icon-512.png`,
        applicationCategory: 'EducationalApplication',
        // Runs in the browser and installs as a PWA on phones.
        operatingSystem: 'Web, Android, iOS',
        description:
          'ClassIQ records classroom lectures, understands mixed-language speech in 11 Indian languages, writes quiz questions linked to the moment in the lecture, and lets students answer on their phones while teachers see what to re-teach.',
        inLanguage: LANGUAGES,
        audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' },
        publisher: { '@id': ORG_ID },
        creator: { '@id': ORG_ID },
      },
    ],
  };
}

export function StructuredData({ locale, meta }: { locale: Locale; meta: LandingCopy['meta'] }) {
  // JSON can't break out of the script element: escape '<' so "</script>" or "<!--" never appears literally.
  const json = JSON.stringify(graph(locale, meta)).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
