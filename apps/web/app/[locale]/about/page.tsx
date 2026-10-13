import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingPage, landingMetadata } from '@/components/landing/landing-page';
import { isTranslatedLocale, TRANSLATED_LOCALES } from '@/components/landing/i18n';

/*
 * The product page in Hindi (/hi/about) and Tamil (/ta/about), prerendered at build time. Any other first
 * segment is a 404 (dynamicParams = false). English stays at /about (app/about).
 * Translation review and the draft/noindex switch: components/landing/i18n/index.ts.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return landingMetadata(locale);
}

export default async function TranslatedAboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <LandingPage locale={locale} />;
}
