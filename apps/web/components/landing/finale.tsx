import { getImageProps } from 'next/image';
import clsx from 'clsx';
import { POSTERS } from './assets';
import { ChalkTray, ChalkWriting } from './chalk-writing';
import { CONTACT_EMAIL } from './contact';
import { DemoForm } from './demo-form';
import styles from './finale.module.css';
import type { LandingCopy } from './i18n';
import { ShareBrief } from './share-brief';

// The pilot's steps (copy: `finale.steps` in i18n) are in the order it actually happens. Numbering is
// meaningful here: it is a sequence.

/**
 * The page's last call to action: the same classroom at dusk, "Book a demo" written on its board in chalk,
 * the pilot in four steps, then the demo request form (id="book", where every "Book a demo" link lands).
 * Uses the rendered dusk poster when it exists, otherwise the textured board alone.
 */
export function Finale({ copy, mailtoHref }: { copy: LandingCopy['finale']; mailtoHref: string }) {
  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className={clsx(styles.board, 'relative isolate overflow-hidden text-chalk')}
    >
      {POSTERS.available ? (
        <DuskStage />
      ) : (
        <div className="landing-container pt-20 sm:pt-24 lg:pt-28">
          <ChalkWriting className="mx-auto block w-full max-w-[52rem] -rotate-2" />
        </div>
      )}

      <div className={clsx('landing-container relative', POSTERS.available ? styles.overlap : 'mt-12 sm:mt-16')}>
        <header className="grid gap-5 lg:grid-cols-12 lg:items-end">
          <h2
            id="demo-title"
            className="font-display text-display-l font-extrabold text-balance lg:col-span-7"
          >
            {copy.title}
          </h2>
          <p className="max-w-md text-lede text-chalk-dim lg:col-span-5 lg:justify-self-end">{copy.lede}</p>
        </header>

        <ol aria-label={copy.stepsLabel} className="mt-10 grid gap-x-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {copy.steps.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-chalk/25 py-3.5 sm:py-5 lg:block lg:pt-5"
            >
              <span
                aria-hidden
                className={clsx(
                  'font-display text-[2rem] leading-none font-extrabold [font-variation-settings:"wdth"_75] lg:text-[2.75rem]',
                  i === copy.steps.length - 1 ? 'text-pulse' : 'text-chalk',
                )}
              >
                {i + 1}
              </span>
              <div className="lg:mt-3">
                <h3 className="font-display text-lg leading-snug font-bold text-pretty">{step.title}</h3>
                <p className="mt-1 max-w-[34ch] text-sm leading-relaxed text-chalk-dim">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-10 pb-16 sm:pb-20 lg:mt-12 lg:grid-cols-12 lg:gap-12 lg:pb-24">
          <div id="book" className="min-w-0 lg:col-span-8">
            <DemoForm tone="onDark" />
          </div>
          <aside aria-label={copy.asideLabel} className="lg:col-span-4 lg:pt-1">
            <div className="border-t border-chalk/25 pt-5">
              <p className="font-display text-lg font-bold">{copy.preferEmail}</p>
              <a
                href={mailtoHref}
                lang="en"
                className="mt-1 inline-flex min-h-11 items-center font-semibold [overflow-wrap:anywhere] text-chalk underline decoration-chalk/50 decoration-2 underline-offset-4 hover:decoration-pulse"
              >
                {CONTACT_EMAIL}
              </a>
              <p className="mt-1 text-sm leading-relaxed text-chalk-dim">{copy.emailHint}</p>
            </div>
            <div className="mt-8 border-t border-chalk/25 pt-5">
              <p className="font-display text-lg font-bold">{copy.notDecider}</p>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-chalk-dim">{copy.notDeciderBody}</p>
              <ShareBrief tone="onDark" />
            </div>
          </aside>
        </div>
      </div>

      <ChalkTray />
    </section>
  );
}

/**
 * The dusk classroom, cropped to its board, with "Book a demo" chalked onto the board. The writing is placed
 * in the poster's own coordinates (finale.module.css), so it stays on the board at every width.
 */
function DuskStage() {
  const common = { alt: '', sizes: '(orientation: portrait) 130vw, 150vw', quality: 80 };
  const { props: wide } = getImageProps({ ...common, src: POSTERS.finale('wide'), width: 1920, height: 1200 });
  const {
    props: { srcSet: tallSrcSet },
  } = getImageProps({ ...common, src: POSTERS.finale('tall'), width: 1080, height: 1920 });
  return (
    <div aria-hidden className={styles.stage}>
      <div className={styles.frame}>
        <picture>
          <source media="(orientation: portrait)" srcSet={tallSrcSet} />
          <img {...wide} className="absolute inset-0 size-full object-cover" loading="lazy" />
        </picture>
        <ChalkWriting className={styles.onBoard} />
      </div>
    </div>
  );
}
