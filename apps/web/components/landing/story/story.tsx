import { CHAPTERS, CODEMIX_LINE, DEMO_QUESTION } from './chapters';
import { StoryStage } from './story-stage';
import { StoryRail } from './story-rail';
import { SmoothScroll } from '../smooth-scroll';
import { DEMO_HREF } from '../contact';
import { fill } from '../i18n/format';
import type { LandingCopy } from '../i18n';
import { PrimaryCta, SecondaryCta } from '../landing-buttons';

/**
 * "The room that listens" — a pinned 3D classroom (StoryStage) with six chapter captions scrolling over it.
 * Captions are plain server-rendered articles in normal flow, so they read top to bottom without JavaScript.
 *
 * Layering: the caption layer spans the stage but lets pointer events through (only the cards and calls to
 * action take them), and the chapter rail comes last in the DOM so keyboard focus meets the hero's
 * buttons first.
 */

// Capture mode (?capture=n) renders only the stage for poster screenshots; everything else is hidden.
// Sections focused programmatically after an anchor jump (tabindex=-1) don't need a ring.
// With the live room on screen, its pinned overlays show the codemix line and the quiz card, so the
// captions drop their poster-only copies of them.
// Once the scroll driver runs (data-active), only the active chapter's caption shows. Why: chapters are
// shorter than a screen, so on phones the previous bottom-sheet caption would otherwise peek in under the
// header, over the room's pinned overlays. Without JavaScript every caption stays visible.
const CAPTURE_CSS = `
html[data-capture='1'], html[data-capture='1'] body { overflow: hidden !important; }
html[data-capture='1'] body * { visibility: hidden !important; }
html[data-capture='1'] [data-capture-stage], html[data-capture='1'] [data-capture-stage] * { visibility: visible !important; }
[data-theme='landing'] [tabindex='-1']:focus { outline: none; }
#story[data-live='1'] [data-poster-only] { display: none; }
#story[data-active] [data-chapter] > * { transition: opacity 0.35s cubic-bezier(0.2, 0.7, 0.2, 1); }
${CHAPTERS.map((_, i) => `#story[data-active='${i}'] [data-chapter]:not([data-chapter='${i}']) > * { opacity: 0; }`).join(' ')}
@media (prefers-reduced-motion: reduce) { #story[data-active] [data-chapter] > * { transition: none; } }
`;

type StoryCopy = LandingCopy['story'];

export function Story({
  copy,
  labels,
  bookDemo,
}: {
  copy: StoryCopy;
  /** The chapters' short names (shared with the rail). */
  labels: LandingCopy['rail']['labels'];
  bookDemo: string;
}) {
  const [hero, ...chapters] = CHAPTERS;
  return (
    <section id="story" aria-label={copy.sectionLabel} className="relative isolate bg-board text-chalk">
      <style>{CAPTURE_CSS}</style>
      <SmoothScroll />
      {/* Must stay a direct child of the section (it sets data-active / data-live on its parent). Its overlays
          are the app's own English screens, so globals.css keeps them in the Latin faces on translated pages. */}
      <StoryStage />

      <div className="pointer-events-none relative z-10 -mt-[100svh]">
        <article
          id={`chapter-${hero.id}`}
          data-chapter={0}
          className="flex min-h-svh flex-col justify-end pt-28 pb-[max(3.5rem,7svh)] md:pb-[max(4.5rem,10svh)]"
        >
          <div className="landing-container pointer-events-auto">
            <h1 className="max-w-[11ch] font-display [&:lang(hi)]:max-w-[13ch] [&:lang(ta)]:max-w-[20ch] text-display-xl font-extrabold text-balance text-chalk [font-variation-settings:'wdth'_100,'opsz'_96] [text-shadow:0_2px_32px_color-mix(in_oklab,var(--cp-board)_75%,transparent)] md:max-w-[12ch]">
              {copy.chapters[hero.id].title}
            </h1>
            <div className="mt-7 flex flex-col gap-8 md:mt-9">
              <p className="max-w-[38ch] text-lede text-chalk-dim [&:lang(ta)]:max-w-[46ch] [text-shadow:0_1px_18px_var(--cp-board)]">
                {copy.chapters[hero.id].body}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <PrimaryCta href={DEMO_HREF} variant="onDark">
                  {bookDemo}
                </PrimaryCta>
                <SecondaryCta href="#try" variant="onDark">
                  {copy.tryQuestion}
                </SecondaryCta>
              </div>
            </div>
          </div>
        </article>

        {chapters.map((c, k) => {
          const i = k + 1;
          return (
            <article
              key={c.id}
              id={`chapter-${c.id}`}
              data-chapter={i}
              aria-labelledby={`chapter-${c.id}-title`}
              // Why 80svh (the last one a full screen): the story reads in about five screens, and the scroll
              // driver still holds each chapter still for a beat around its caption (dwell in story-stage).
              className={`flex items-end pb-6 md:items-center md:pb-0 ${i === LAST ? 'min-h-svh' : 'min-h-[80svh]'}`}
            >
              <div className="landing-container">
                {/* Phones: a bottom sheet of at most ~38svh, under the room's pinned overlays. */}
                <div data-caption-card className="pointer-events-auto relative w-full max-w-[26rem] rounded-card bg-chalk p-5 text-uniform shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--cp-uniform)_55%,transparent)] sm:p-7">
                  <p className="flex items-center gap-2.5 text-sm font-semibold text-uniform">
                    <span aria-hidden className="h-3.5 w-1 rounded-[1px] bg-pulse ring-1 ring-uniform" />
                    <span>
                      <span className="sr-only">{fill(copy.stepOf, { step: i, total: LAST })}</span>
                      {labels[i]}
                    </span>
                  </p>
                  <h2
                    id={`chapter-${c.id}-title`}
                    className="mt-3 font-display text-[1.625rem] leading-[1.1] font-bold text-balance [font-variation-settings:'wdth'_92,'opsz'_48] sm:mt-5 sm:text-display-m"
                  >
                    {copy.chapters[c.id].title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-ink-2 sm:mt-4 sm:text-[1.0625rem]">
                    {copy.chapters[c.id].body}
                  </p>
                  {c.id === 'understand' ? <CodemixQuote translation={copy.codemixTranslation} /> : null}
                  {c.id === 'quiz' ? <QuestionStub label={copy.questionLinked} prompt={copy.questionPrompt} /> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Sticky to the bottom of the viewport from the end of the section: it covers the pinned stage the
          whole way without taking up any height. */}
      <div className="pointer-events-none sticky bottom-0 z-20 -mt-[100svh] h-svh">
        <StoryRail />
      </div>
    </section>
  );
}

const LAST = CHAPTERS.length - 1;

function CodemixQuote({ translation }: { translation: string }) {
  return (
    <figure data-poster-only className="mt-6 border-l-2 border-uniform pl-4">
      <blockquote lang="ta" className="font-indic text-[1.0625rem] leading-relaxed">
        {CODEMIX_LINE.map((w, i) => (
          <span key={i}>
            {w.english ? (
              <span lang="en" className="rounded-[1px] bg-pulse px-0.5 box-decoration-clone">
                {w.text}
              </span>
            ) : (
              w.text
            )}
            {CODEMIX_LINE[i + 1]?.text.startsWith('-') ? '' : ' '}
          </span>
        ))}
      </blockquote>
      <figcaption className="mt-2 text-sm text-muted">{translation}</figcaption>
    </figure>
  );
}

function QuestionStub({ label, prompt }: { label: string; prompt: string }) {
  return (
    <div data-poster-only className="mt-6 flex items-start gap-3 border-t border-line pt-5">
      <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-card border border-uniform px-1.5 font-mono text-[0.8125rem] tabular-nums">
        {DEMO_QUESTION.timestamp}
      </span>
      <p className="text-[0.9375rem] leading-snug text-ink-2">
        <span className="block text-xs text-muted">{label}</span>
        <span className="font-semibold text-uniform">{prompt}</span>
      </p>
    </div>
  );
}
