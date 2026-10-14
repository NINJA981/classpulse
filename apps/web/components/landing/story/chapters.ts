/**
 * The scroll story contract shared by the DOM captions (story.tsx) and the 3D scene (scene/*).
 *
 * One number drives everything: `story.progress`, from 0 (hero) to CHAPTERS.length - 1 (insight).
 * Integer values are "at rest" on a chapter; fractions are mid-transition. The scene reads it every
 * frame (no React re-renders); captions subscribe to the active chapter index only.
 *
 * Progress values beyond the story are scene-only states used for poster captures:
 *   FINALE_STATE (6): the same room at dusk, lights on, the board wiped clean and the teacher waving.
 *   (The DOM finale writes "Book a demo" over that clean board, so the poster must not.)
 */

// The page's captions (titles, bodies, labels) are copy, per language, in components/landing/i18n. These English
// strings are the chapters' reference text and must match i18n/en.ts; ids and order are the contract.
export const CHAPTERS = [
  {
    id: 'hero',
    title: 'Every lecture, turned into learning.',
    body: 'ClassIQ listens to the lesson in Tamil, Hindi or English, mixed the way your teachers really speak. It writes a quiz from what was said and puts it on every student’s phone.',
  },
  {
    id: 'record',
    title: 'It starts with the lesson you already teach.',
    body: 'A small device on the teacher’s desk records the class. No device in the room? Upload a phone recording instead.',
  },
  {
    id: 'understand',
    title: 'It understands how your teachers actually speak.',
    body: 'Tamil, Hindi and eight more Indian languages, mixed with English the way real classrooms are. Subject terms stay in English.',
  },
  {
    id: 'quiz',
    title: 'Questions only from what was said.',
    body: 'AI writes multiple-choice questions from the lecture itself. Each one links to the moment it came from, and nothing reaches students until the teacher approves it.',
  },
  {
    id: 'play',
    title: 'Every phone in the room lights up.',
    body: 'Students answer on their own phones, at their own pace or as a live game-show round in class.',
  },
  {
    id: 'insight',
    title: 'See who understood, and what to teach again.',
    body: 'Results by student and by question, tagged by Bloom level, with a plan for what to re-teach tomorrow.',
  },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]['id'];
export const LAST_CHAPTER = CHAPTERS.length - 1;
export const FINALE_STATE = 6;

/** The codemix line spoken in chapter 2. English subject terms are marked so the scene can glow them. */
export const CODEMIX_LINE: { text: string; english?: boolean }[] = [
  { text: 'Photosynthesis', english: true },
  { text: '-ல' },
  { text: 'chlorophyll', english: true },
  { text: 'தான்' },
  { text: 'sunlight', english: true },
  { text: '-ஐ' },
  { text: 'absorb', english: true },
  { text: 'பண்ணுது.' },
];
export const CODEMIX_TRANSLATION = 'In photosynthesis, it’s chlorophyll that absorbs sunlight.';

/** The question the lecture becomes (chapter 3) and the playable demo below the story. */
export const DEMO_QUESTION = {
  timestamp: '12:41',
  promptTa: 'ஒளிச்சேர்க்கையில் sunlight-ஐ absorb செய்வது எது?',
  promptEn: 'In photosynthesis, what absorbs sunlight?',
  options: ['Chlorophyll', 'Stomata', 'Xylem', 'Glucose'],
  answer: 0,
  explanation: 'Chlorophyll in the leaf absorbs light energy. The teacher said it at 12:41.',
  reteach: 'Re-teach: light reaction',
} as const;

/** Chapter 5: the class report the insight overlay shows. Counts match the 24 students in the 3D room. */
export const INSIGHT = {
  reteach: 'light reaction',
  /** Share of the class answering correctly, by Bloom level. */
  bloom: [
    { level: 'Remember', score: 0.86 },
    { level: 'Understand', score: 0.68 },
    { level: 'Apply', score: 0.42 },
    { level: 'Analyse', score: 0.35 },
  ],
  /** Why 8: the four red-pen benches in the room (bench mastery < STRUGGLING) seat eight students. */
  confusion: { count: 8, picked: 'Stomata', question: 'Q3' },
  classSize: 24,
} as const;

// ---------------------------------------------------------------------------
// Store — a tiny mutable singleton. No React state on the per-frame path.
// ---------------------------------------------------------------------------

type Listener = () => void;

export const story = {
  /** 0 … LAST_CHAPTER while scrolling; FINALE_STATE in capture mode. */
  progress: 0,
  /** Pointer in [-1, 1] on both axes, for gentle camera parallax. */
  pointer: { x: 0, y: 0 },
  /** True when motion should be minimal (prefers-reduced-motion). */
  reducedMotion: false,
  /** The visitor pressed "Pause animation": no idle motion and no continuous rendering (WCAG 2.2.2). */
  paused: false,
  /** The live 3D room is on screen (its own overlays replace the caption's quote and question). */
  live: false,
};

const listeners = new Set<Listener>();
const progressListeners = new Set<Listener>();
const uiListeners = new Set<Listener>();
let chapterIndex = 0;

export function setStoryProgress(p: number) {
  story.progress = p;
  progressListeners.forEach((l) => l());
  const next = Math.min(LAST_CHAPTER, Math.max(0, Math.round(p)));
  if (next !== chapterIndex) {
    chapterIndex = next;
    listeners.forEach((l) => l());
  }
}

/** Every progress change (per scroll frame). Listeners must be cheap and must not set React state. */
export function subscribeProgress(listener: Listener) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function setPaused(paused: boolean) {
  if (story.paused === paused) return;
  story.paused = paused;
  uiListeners.forEach((l) => l());
}

export function setLive(live: boolean) {
  if (story.live === live) return;
  story.live = live;
  uiListeners.forEach((l) => l());
}

export function subscribeUi(listener: Listener) {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

export const getPaused = () => story.paused;
export const getLive = () => story.live;

export function subscribeChapter(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChapterIndex() {
  return chapterIndex;
}
