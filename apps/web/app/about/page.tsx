import type { Metadata } from 'next';
import { LandingPage, landingMetadata } from '@/components/landing/landing-page';

// The product page in English, the canonical version. Translations: app/[locale]/about.
export const metadata: Metadata = landingMetadata('en');

export default function AboutPage() {
  return <LandingPage locale="en" />;
}
