'use client';

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import clsx from 'clsx';
import {
  CHAPTERS,
  LAST_CHAPTER,
  getChapterIndex,
  getLive,
  getPaused,
  setPaused,
  story,
  subscribeChapter,
  subscribeProgress,
  subscribeUi,
} from './chapters';
import { useLandingCopy } from '../i18n/copy-context';

/**
 * The chapter rail (lesson timecode + one marker per chapter) and the "Pause animation" toggle.
 *
 * Rendered after the captions in story.tsx, so keyboard focus reaches the hero's calls to action
 * before the six chapter markers; a sticky wrapper keeps it over the pinned stage.
 */
export function StoryRail() {
  const { rail: copy } = useLandingCopy();
  const active = useSyncExternalStore(subscribeChapter, getChapterIndex, () => 0);
  const live = useSyncExternalStore(subscribeUi, getLive, () => false);
  const paused = useSyncExternalStore(subscribeUi, getPaused, () => false);
  const railRef = useRef<HTMLDivElement>(null);

  // Per-scroll-frame updates go straight to the DOM (no React re-render).
  useEffect(() => {
    const update = () => {
      railRef.current?.style.setProperty('--p', String(story.progress / LAST_CHAPTER));
    };
    update();
    return subscribeProgress(update);
  }, []);

  return (
    <div
      className={clsx(
        'pointer-events-auto absolute flex items-center gap-2',
        // phones: a horizontal strip under the header; desktop: a vertical rail on the right edge
        'inset-x-4 top-[4.75rem] sm:inset-x-6',
        'md:inset-x-auto md:top-1/2 md:right-5 md:-translate-y-1/2 md:flex-col md:gap-3 lg:right-9',
      )}
    >
      <nav aria-label={copy.navLabel} className="flex flex-1 items-center gap-2 self-stretch md:flex-col md:gap-3">
        <div ref={railRef} className="relative h-px flex-1 [--p:0] md:h-[52svh] md:w-px md:flex-none">
          {/* Why the dark edge: the rail crosses both the green board and the pale walls. */}
          <div className="absolute inset-0 bg-chalk/60 shadow-[0_0_0_1px_color-mix(in_oklab,var(--cp-board)_55%,transparent)]" />
          <div className="absolute inset-0 origin-left scale-x-[var(--p)] bg-pulse md:origin-top md:scale-x-100 md:scale-y-[var(--p)]" />
          <ol className="absolute inset-0">
            {CHAPTERS.map((c, i) => (
              <li
                key={c.id}
                style={{ '--t': i / LAST_CHAPTER } as CSSProperties}
                className="absolute top-1/2 left-[calc(var(--t)*100%)] -translate-x-1/2 -translate-y-1/2 md:top-[calc(var(--t)*100%)] md:left-1/2"
              >
                <a
                  href={`#chapter-${c.id}`}
                  aria-current={active === i ? 'step' : undefined}
                  className="group/tick relative grid size-11 place-items-center rounded-card text-chalk focus-visible:outline-2 focus-visible:outline-pulse"
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'block size-[9px] rotate-45 transition-[background-color,transform,box-shadow] duration-300 ease-snap',
                      i <= active
                        ? 'bg-pulse shadow-[0_0_0_1.5px_var(--cp-board)]'
                        : 'bg-board shadow-[0_0_0_1.5px_var(--cp-chalk),0_0_0_3px_color-mix(in_oklab,var(--cp-board)_45%,transparent)]',
                      active === i && 'scale-[1.45]',
                    )}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-full mr-1 hidden -translate-y-1/2 rounded-card bg-chalk px-2 py-1 text-xs font-semibold whitespace-nowrap text-uniform opacity-0 transition-opacity duration-200 ease-snap group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100 md:block">
                    {copy.labels[i]}
                  </span>
                  <span className="sr-only md:hidden">{copy.labels[i]}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* WCAG 2.2.2: the live room moves on its own (teacher, fans, sound rings), so it can be paused. */}
      {live ? (
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? copy.playAnimation : copy.pauseAnimation}
          title={paused ? copy.playAnimation : copy.pauseAnimation}
          // Why so quiet: required (WCAG 2.2.2) but secondary — a small icon under the rail, full 44px target.
          className="group/pause grid size-11 shrink-0 place-items-center rounded-full text-chalk/75 transition-colors duration-200 ease-snap hover:text-chalk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse"
        >
          <span aria-hidden className="grid size-7 place-items-center rounded-full bg-board/70 ring-1 ring-chalk/20 transition-[box-shadow] duration-200 ease-snap group-hover/pause:ring-chalk/50">
          {paused ? (
            <svg aria-hidden viewBox="0 0 12 12" className="size-3 fill-current">
              <path d="M3 1.5v9l7.5-4.5z" />
            </svg>
          ) : (
            <svg aria-hidden viewBox="0 0 12 12" className="size-3 fill-current">
              <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />
            </svg>
          )}
          </span>
        </button>
      ) : null}
    </div>
  );
}
