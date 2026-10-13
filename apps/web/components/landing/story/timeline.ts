import { CHAPTERS } from './chapters';

// The chapters' short names (rail and caption labels) are copy: `rail.labels` in components/landing/i18n.

/** The rail reads as one 45-minute lesson played back as you scroll. */
export const LESSON_SECONDS = 45 * 60;

export function formatTimecode(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Story progress (0 … last chapter) as lesson time. */
export function progressTimecode(progress: number) {
  return formatTimecode((progress / (CHAPTERS.length - 1)) * LESSON_SECONDS);
}
