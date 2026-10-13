import Link from 'next/link';
import clsx from 'clsx';
import { CONTACT_EMAIL } from './contact';
import styles from './faq.module.css';
import { fillNodes } from './i18n/format';
import type { LandingCopy } from './i18n';

const link = 'font-semibold text-ink underline underline-offset-4';

/*
 * Seven questions (copy: `faq` in i18n), the last three about data: what principals ask before a pilot.
 * Data answers state only what the public privacy notice (/privacy) says. Keep them, in every language, in
 * step with it.
 */
export function Faq({ copy }: { copy: LandingCopy['faq'] }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-20 sm:py-24 lg:py-28">
      <div className="landing-container grid gap-10 lg:grid-cols-12 lg:gap-12">
        <header className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 id="faq-title" className="font-display text-display-l font-extrabold text-balance">
              {copy.title}
            </h2>
            <p className="mt-5 max-w-sm text-lede text-muted">
              {fillNodes(copy.askUs, {
                email: (
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    lang="en"
                    className="inline-block font-semibold [overflow-wrap:anywhere] text-ink underline underline-offset-4"
                  >
                    {CONTACT_EMAIL}
                  </a>
                ),
              })}
            </p>
          </div>
        </header>

        <div className="border-t-2 border-uniform lg:col-span-8">
          {copy.items.map(({ q, a, link: more }) => (
            <details
              key={q}
              className={clsx(styles.item, 'group border-b border-line-strong')}
              name="landing-faq"
            >
              <summary
                className={clsx(
                  styles.summary,
                  'flex min-h-11 cursor-pointer items-center justify-between gap-6 py-5 sm:py-6',
                  'focus-visible:outline-offset-4',
                )}
              >
                <h3 className="font-display text-xl leading-snug font-bold text-balance sm:text-2xl">{q}</h3>
                <span
                  aria-hidden
                  className="relative grid size-10 shrink-0 place-items-center border-2 border-uniform transition-colors duration-200 group-open:bg-uniform group-open:text-chalk"
                >
                  <span className={clsx(styles.bar, 'absolute h-0.5 w-4 bg-current')} />
                  <span className={clsx(styles.bar, styles.barV, 'absolute h-4 w-0.5 bg-current')} />
                </span>
              </summary>
              <p className="max-w-[62ch] pb-8 text-[1.0625rem] leading-relaxed text-muted">
                {a}
                {more ? (
                  <>
                    {' '}
                    <Link href={more.href} className={link}>
                      {more.label}
                    </Link>
                    {more.after}
                  </>
                ) : null}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
