import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/landing/contact';
import { INDEXABLE_LOCALES, LOCALE_INFO } from '@/components/landing/i18n/locales';

/**
 * The product page in every language that is ready for search (a draft translation stays out until it is
 * reviewed: components/landing/i18n), each listing the others as alternates, and the sign-in chooser.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages =
    INDEXABLE_LOCALES.length > 1
      ? Object.fromEntries(
          INDEXABLE_LOCALES.map((l) => [LOCALE_INFO[l].hreflang, `${SITE_URL}${LOCALE_INFO[l].path}`]),
        )
      : undefined;
  return [
    ...INDEXABLE_LOCALES.map((l) => ({
      url: `${SITE_URL}${LOCALE_INFO[l].path}`,
      changeFrequency: 'monthly' as const,
      priority: l === 'en' ? 1 : 0.9,
      ...(languages ? { alternates: { languages } } : {}),
    })),
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
