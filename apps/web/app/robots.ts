import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/landing/contact';
import { LOCALE_INFO, LOCALES } from '@/components/landing/i18n/locales';

/**
 * Only the public product page (in every language) and the sign-in chooser are worth indexing; every signed-in
 * area stays out. Draft translations are crawlable on purpose: their `noindex` meta is what keeps them out of
 * results, and a crawler has to fetch the page to see it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [...LOCALES.map((l) => LOCALE_INFO[l].path), '/login'],
      disallow: ['/admin', '/teacher', '/student', '/platform', '/api', '/change-password', '/set-password'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
