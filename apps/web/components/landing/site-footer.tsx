import Link from 'next/link';
import { CONTACT_EMAIL } from './contact';
import type { LandingCopy } from './i18n';

/**
 * Uniform-navy footer: who makes it, how to reach them, three links, and the wordmark set wide across the page
 * with the yellow pulse running beneath it. On a translation that is still a draft, a quiet line says so.
 */
export function SiteFooter({ copy, draft = false }: { copy: LandingCopy['footer']; draft?: boolean }) {
  // Privacy and Terms are English-only pages: their links say so with hrefLang on translated pages.
  const links = [
    { href: '/login', label: copy.signIn, english: false },
    { href: '/privacy', label: copy.privacy, english: true },
    { href: '/terms', label: copy.terms, english: true },
  ];
  return (
    <footer className="overflow-hidden bg-uniform text-chalk">
      <div className="landing-container pt-16 sm:pt-20 lg:pt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="max-w-md text-lede text-chalk-dim">{copy.madeBy}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              lang="en"
              className="mt-4 inline-block font-display text-[clamp(1.375rem,1rem+1.6vw,2.25rem)] font-bold [overflow-wrap:anywhere] underline decoration-chalk/40 decoration-2 underline-offset-[6px] hover:decoration-pulse"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <nav aria-label={copy.navLabel} className="lg:col-span-5 lg:justify-self-end">
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    hrefLang={l.english ? 'en' : undefined}
                    className="inline-flex min-h-11 items-center text-base font-semibold underline-offset-[6px] hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div aria-hidden lang="en" className="relative mt-16 select-none sm:mt-20">
          <p className="font-display text-[calc((100vw-2rem)/4.6)] leading-[0.78] font-extrabold tracking-[-0.05em] whitespace-nowrap [font-variation-settings:'wdth'_100] sm:text-[calc((100vw-3rem)/4.6)] lg:text-[min(calc((100vw-5rem)/4.6),16rem)]">
            ClassPulse
          </p>
          <PulseLine />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-chalk/20 py-6 text-sm text-chalk-dim">
          <p>© 2026 BenX Solutions</p>
          {draft ? <p data-translation-status="draft">{copy.draftNote}</p> : null}
          <a
            href="#main"
            className="inline-flex min-h-11 items-center hover:text-chalk hover:underline underline-offset-4"
          >
            {copy.backToTop}
          </a>
        </div>
      </div>
    </footer>
  );
}

/** A flat line with one beat in it: the brand's pulse. */
function PulseLine() {
  return (
    <svg viewBox="0 0 1000 64" preserveAspectRatio="none" className="mt-4 mb-6 block h-10 w-full sm:h-14">
      <path
        d="M0 40 H640 L656 40 L672 6 L692 60 L710 22 L722 40 H1000"
        fill="none"
        className="stroke-pulse"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
