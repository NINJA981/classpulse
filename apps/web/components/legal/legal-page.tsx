import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { LegalLinks } from './legal-links';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Public, static legal page (privacy notice, terms of use): readable without signing in, on a phone,
 * with a table of contents and a visible "needs legal review" box until counsel has approved the text.
 */
export function LegalPage({
  eyebrow,
  title,
  effective,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  effective: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-xl font-black tracking-tight text-ink">
            ClassPulse
          </Link>
          <LegalLinks />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Effective {effective}</p>

        <div role="note" className="mt-6 flex gap-3 border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning rounded-control">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Draft — needs legal review</p>
            <p className="font-medium">
              TODO: This text has not yet been reviewed by a lawyer. Do not rely on it as final until counsel has checked it
              against the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025. Items marked “TODO” still need
              the owner’s input.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 text-base leading-relaxed text-ink-2">{intro}</div>

        <nav aria-label="On this page" className="mt-8 border border-line bg-surface p-5 rounded-card shadow-card">
          <p className="eyebrow mb-3">On this page</p>
          <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-6">
              <h2 id={`${s.id}-title`} className="font-display text-xl font-extrabold text-ink">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>ClassPulse is operated by BenX Solutions.</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

/** A visible placeholder the owner must fill in before publishing. */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="bg-warning-soft px-1 font-semibold text-warning rounded-control">TODO: {children}</mark>;
}
