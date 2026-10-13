import clsx from 'clsx';
import { Check, FileText, Lock, Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LandingCopy } from './i18n';

type BentoCopy = LandingCopy['bento'];

/**
 * "What else is inside": the features the scroll story doesn't cover. (The device and the class reports have
 * their own chapters in the story, so they aren't repeated here.)
 * One skin for every card: chalk-white paper with a navy rule, each holding a small vignette of the real UI
 * built in HTML. Cards differ in size, not costume: a 7/5 then 5/7 grid. Pulse yellow appears only where
 * ClassPulse itself is acting: the mic listening, the AI's suggestions, the install prompt.
 */
export function Bento({ copy }: { copy: BentoCopy }) {
  return (
    <section id="inside" aria-labelledby="inside-title" className="py-20 sm:py-24 lg:py-28">
      <div className="landing-container">
        <header className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2
            id="inside-title"
            className="font-display text-display-l font-extrabold text-balance lg:col-span-7"
          >
            {copy.title}
          </h2>
          <p className="max-w-md text-lede text-muted lg:col-span-5 lg:justify-self-end">{copy.lede}</p>
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-6 lg:mt-14 lg:grid-cols-12 lg:gap-5">
          <ExamsCard copy={copy.exams} />
          <AssignmentsCard copy={copy.homework} />
          <PhonesCard copy={copy.phones} />
          <StudioCard copy={copy.studio} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CardCopy({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[1.375rem] leading-tight font-bold tracking-[-0.015em] text-balance sm:text-2xl">
        {title}
      </h3>
      <p className="mt-2 max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/** The one card skin. */
const card = 'rounded-card border border-line-strong bg-surface';
const pad = 'p-5 sm:p-8';

type CardText = BentoCopy['exams'];

/*
 * The vignettes are pictures of the product's own screens, which are in English, so they keep lang="en" on
 * every version of the page (and are aria-hidden: the card copy says what they show).
 */

// --- Exams ------------------------------------------------------------------

const MONITOR = [
  { name: 'Aarav S.', state: 'Question 14 of 20', warn: null },
  { name: 'Divya R.', state: 'Submitted', warn: null },
  { name: 'Karthik M.', state: 'Question 9 of 20', warn: 'Left fullscreen at 10:42' },
  { name: 'Meena P.', state: 'Question 17 of 20', warn: null },
] as const;

function ExamsCard({ copy }: { copy: CardText }) {
  return (
    <article className={clsx(card, pad, 'flex flex-col md:col-span-6 lg:col-span-7')}>
      <CardCopy title={copy.title}>{copy.body}</CardCopy>

      <div lang="en" className="mt-8 flex flex-1 flex-col border border-line-strong bg-canvas" aria-hidden>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-strong px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-semibold">Science unit test</p>
            <p className="text-xs text-muted">Class 8B, live monitor</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 border border-line-strong px-2 py-1 text-xs font-semibold">
              <Lock className="size-3.5" strokeWidth={2.25} /> Fullscreen on
            </span>
            <span className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">24:13</span>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {MONITOR.map((row, i) => (
            <li
              key={row.name}
              className={clsx(
                'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:px-5',
                // Phones show three students; the fourth only adds height.
                i === MONITOR.length - 1 && 'max-sm:hidden',
              )}
            >
              <span className="text-sm font-semibold">{row.name}</span>
              <span className="text-right text-xs text-muted sm:text-left sm:text-sm">{row.state}</span>
              {row.warn ? (
                <span className="col-span-2 inline-flex items-center gap-1.5 text-xs font-semibold text-redpen sm:col-span-1">
                  <span className="grid size-4 place-items-center rounded-full border border-redpen font-mono text-[10px]">
                    1
                  </span>
                  {row.warn}
                </span>
              ) : (
                <span className="hidden sm:block" />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-line-strong px-4 py-3 sm:px-5">
          {['Extra time', 'Unlock device', 'Submit for student'].map((a, i) => (
            <span
              key={a}
              className={clsx(
                'border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold',
                i === 2 && 'max-sm:hidden',
              )}
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

// --- Teacher studio --------------------------------------------------------------

function StudioCard({ copy }: { copy: CardText }) {
  return (
    <article className={clsx(card, pad, 'flex flex-col md:col-span-6 lg:col-span-7')}>
      <CardCopy title={copy.title}>{copy.body}</CardCopy>

      <div aria-hidden lang="en" className="mt-7 flex flex-1 flex-col gap-3 border border-line-strong bg-canvas p-3 sm:p-4">
        <div className="flex items-stretch gap-3 border border-line-strong bg-surface p-1.5 pl-3.5">
          <p className="flex-1 self-center py-1 text-sm leading-snug">
            Worksheet on photosynthesis for Class 8B, ten questions with answers
          </p>
          <span className="flex shrink-0 items-center gap-2 bg-pulse px-3 text-uniform ring-1 ring-uniform">
            <Mic className="size-4" strokeWidth={2.5} />
            <Waveform />
          </span>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <StudioDoc label="Lesson plan">
            {[90, 70, 80].map((w, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 font-mono text-[10px] text-muted">{`${i * 15}′`}</span>
                <span className="h-1.5 bg-uniform/25" style={{ width: `${w}%` }} />
              </span>
            ))}
          </StudioDoc>
          <StudioDoc label="Worksheet">
            {[1, 2, 3].map((n) => (
              <span key={n} className="flex items-end gap-2">
                <span className="font-mono text-[10px] text-muted">{n}.</span>
                <span className="h-px flex-1 border-b border-dashed border-uniform/40" />
              </span>
            ))}
          </StudioDoc>
          <StudioDoc label="Question paper" wide>
            {['A', 'B'].map((sec, i) => (
              <span key={sec} className="flex items-center justify-between gap-2">
                <span className="flex flex-1 items-center gap-2">
                  <span className="font-mono text-[10px] text-muted">{sec}</span>
                  <span className="h-1.5 flex-1 bg-uniform/25" />
                </span>
                <span className="font-mono text-[10px] text-muted">{i === 0 ? '10' : '15'}m</span>
              </span>
            ))}
          </StudioDoc>
          <StudioDoc label="Slides" wide>
            <span className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((n) => (
                <span key={n} className="aspect-video border border-uniform/40 p-1">
                  <span className="block h-1 w-2/3 bg-uniform/35" />
                </span>
              ))}
            </span>
          </StudioDoc>
        </div>
      </div>
    </article>
  );
}

function StudioDoc({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={clsx(
        'min-h-28 flex-col justify-between gap-4 border border-line bg-surface p-3',
        // Phones show two of the four documents.
        wide ? 'hidden sm:flex' : 'flex',
      )}
    >
      <span className="flex flex-col gap-2">{children}</span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function Waveform() {
  const bars = [6, 12, 8, 14, 5, 10];
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" className="fill-current">
      {bars.map((h, i) => (
        <rect key={i} x={i * 4.4} y={(16 - h) / 2} width="2.2" height={h} rx="1" />
      ))}
    </svg>
  );
}

// --- Assignments -----------------------------------------------------------

function AssignmentsCard({ copy }: { copy: CardText }) {
  return (
    <article
      className={clsx(
        card,
        'relative flex flex-col overflow-hidden md:col-span-3 lg:col-span-5',
      )}
    >
      <div className="p-6 pb-0 sm:p-8 sm:pb-0">
        <CardCopy title={copy.title}>{copy.body}</CardCopy>
      </div>

      {/* Exercise-book paper under the work: ruled lines and a red margin. */}
      <div
        aria-hidden
        lang="en"
        className="relative mt-7 flex-1 space-y-3 border-t border-line bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,var(--color-line)_23px,var(--color-line)_24px)] p-6 pt-5 sm:p-8 sm:pt-6"
      >
        <span className="absolute inset-y-0 left-3 w-px bg-redpen/50 sm:left-4" />
        <div className="flex items-center gap-3 border border-line-strong bg-surface px-3 py-2.5">
          <FileText className="size-5 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">lab-report-meena.pdf</span>
          <span className="font-mono text-xs text-muted">1.4 MB</span>
        </div>
        <div className="border border-line-strong bg-surface px-3 py-3">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-muted">Suggested grade</span>
            <span className="bg-pulse px-1.5 font-mono text-sm font-semibold">8 / 10</span>
          </p>
          <p className="mt-2 text-sm leading-snug">
            Method is clear. The conclusion doesn’t mention the control.
          </p>
        </div>
        <p className="flex items-center gap-3">
          <span className="inline-flex min-h-9 items-center gap-1.5 bg-uniform px-3 text-sm font-semibold text-chalk">
            <Check className="size-4" strokeWidth={2.5} /> Confirm
          </span>
          <span className="inline-flex min-h-9 items-center border border-line-strong bg-surface px-3 text-sm font-semibold">
            Change
          </span>
          <RedTick />
        </p>
      </div>
    </article>
  );
}

function RedTick() {
  return (
    <svg
      viewBox="0 0 48 32"
      className="ml-auto h-8 w-12 stroke-redpen"
      fill="none"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 18 C 9 21, 12 25, 15 28 C 22 17, 32 8, 45 3" />
    </svg>
  );
}

// --- Any phone -------------------------------------------------------------

function PhonesCard({ copy }: { copy: CardText }) {
  return (
    <article className={clsx(card, pad, 'relative flex flex-col overflow-hidden pb-0 sm:pb-0 md:col-span-3 lg:col-span-5')}>
      <div className="flex flex-1 flex-col justify-between gap-8">
        <div>
          <CardCopy title={copy.title}>{copy.body}</CardCopy>
        </div>
        <div aria-hidden lang="en" className="flex items-end justify-center gap-3 sm:gap-5">
          <MiniPhone className="h-32 w-[4.5rem] sm:h-44 sm:w-[5.5rem]" selected={1} />
          <MiniPhone className="h-44 w-[6rem] sm:h-60 sm:w-[7.5rem]" install />
          <MiniPhone className="h-36 w-20 sm:h-48 sm:w-24" selected={2} />
        </div>
      </div>
    </article>
  );
}

function MiniPhone({
  className,
  selected,
  install,
}: {
  className: string;
  selected?: number;
  install?: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative shrink-0 translate-y-3 rounded-t-[1.1rem] border-x-[5px] border-t-[5px] border-uniform bg-surface-2 p-2',
        className,
      )}
    >
      <span className="mx-auto mb-2 block h-1 w-6 rounded-full bg-uniform/70" />
      <span className="mb-2 block h-1.5 w-4/5 bg-uniform/70" />
      <span className="mb-3 block h-1.5 w-3/5 bg-uniform/40" />
      <span className="flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={clsx(
              'block h-3.5 border',
              i === selected ? 'border-uniform bg-uniform' : 'border-uniform/35',
            )}
          />
        ))}
      </span>
      {install ? (
        <span className="absolute inset-x-0 bottom-0 border-t border-uniform bg-surface p-2.5">
          <span className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center bg-pulse font-display text-xs font-black text-uniform">
              C
            </span>
            <span className="min-w-0 truncate text-[10px] leading-tight font-semibold">ClassPulse</span>
          </span>
          <span className="mt-2 block bg-uniform py-1 text-center text-[10px] font-semibold text-chalk">
            Install
          </span>
        </span>
      ) : null}
    </div>
  );
}
