/**
 * Captures the landing page's static images from a running stack (default http://localhost:3000).
 *
 *   npx tsx scripts/capture-landing-assets.ts screens [admin|teacher|student]   # real app screenshots → public/landing/screens/*.webp
 *   npx tsx scripts/capture-landing-assets.ts posters   # 3D story poster frames → public/landing/posters/*.webp
 *   npx tsx scripts/capture-landing-assets.ts video [wide|tall]   # hero loop → public/landing/video/hero-*.{mp4,webm}
 *
 * `screens` signs in with the seeded demo accounts (apps/api/src/db/seed.dev.ts) — never point it at a
 * school's real data. It expects the demo school's staged "Grade 8 - B" showcase class (Anita Verma's
 * published Tamil-English photosynthesis lesson, students 8B-01 … 8B-10) in the dev database; pass a role
 * to capture only that shot. `posters` needs /about?capture=n (the scene sets data-scene-ready="1" when a frame
 * is stable). Set CAPTURE_BASE_URL to use another origin. Flip the `available` flags in
 * components/landing/assets.ts only after checking the output by eye.
 *
 * `video` renders /about?capture=0&clip=8 frame by frame (the scene advances its clock exactly one frame per
 * step and snaps every idle motion to whole cycles, so the loop is seamless), then encodes with the
 * ffmpeg-static binary: H.264 MP4 (yuv420p, faststart) and VP9 WebM. It uses the machine's GPU when headless
 * Chromium has one (set CAPTURE_SWIFTSHADER=1 to force software GL; slower, same frames).
 */
/* eslint-disable no-console -- CLI script: progress goes to stdout */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from 'playwright';
import sharp from 'sharp';

const BASE_URL = (process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = join(WEB_ROOT, 'public/landing/screens');
const POSTERS_DIR = join(WEB_ROOT, 'public/landing/posters');
const VIDEO_DIR = join(WEB_ROOT, 'public/landing/video');
/** Seconds in the hero loop. */
const CLIP_SECONDS = 8;

// Demo accounts only: the dev seed (apps/api/src/db/seed.dev.ts) plus the staged "Grade 8 - B" showcase class
// (Anita Verma's Tamil-English science lessons; students 8B-01 … 8B-10 share the seed student password).
const DEMO = {
  admin: { login: 'admin@demo.school', password: 'Admin@12345' },
  teacher: { login: 'anita@demo.school', password: 'Teacher@12345' },
  student: { login: '8B-01', password: 'Student@12345' },
} as const;
type Role = keyof typeof DEMO;

/** The one story all three shots tell: Class 8B's photosynthesis lesson, taught in Tamil-English. */
const SHOWCASE_LESSON = 'Photosynthesis — Class 8B science (Tamil-English)';
const SHOWCASE_SECTION = 'Grade 8 - B';
/** Tall enough for the lesson header, the first question with its review buttons, and the transcript. */
const TEACHER_HEIGHT = 1040;
/** Q1 of the showcase lesson cites 12:41–13:05 — the transcript panel highlights that line. */
const SHOWCASE_MOMENT_SEC = 770;

/** Hides the Next dev indicator / error overlay and any route announcer so frames are clean. */
const HIDE_DEV_CHROME = `
  nextjs-portal, script[data-nextjs-dev-overlay], [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

async function newContext(browser: Browser, options: BrowserContextOptions): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: BASE_URL, reducedMotion: 'reduce', locale: 'en-IN', ...options });
  await context.addInitScript((css: string) => {
    const add = () => {
      const style = document.createElement('style');
      style.dataset.capture = '1';
      style.textContent = css;
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  }, HIDE_DEV_CHROME);
  return context;
}

/** Waits for data and spinners to settle (socket.io keeps a connection open, so networkidle may never come). */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('.animate-spin, [aria-busy="true"]'), undefined, { timeout: 15_000 })
    .catch(() => console.warn('  (a spinner is still visible)'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await hideDevChrome(page);
}

/** The init-script stylesheet can be dropped when React takes over <head>; re-apply just before a shot. */
async function hideDevChrome(page: Page) {
  await page.addStyleTag({ content: HIDE_DEV_CHROME });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('nextjs-portal, [data-nextjs-dev-overlay]')) {
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

async function signIn(page: Page, role: Role) {
  const { login, password } = DEMO[role];
  await page.goto(`/${role}/login`);
  await page.getByLabel(role === 'student' ? 'Roll number' : 'Email').fill(login);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Client-side redirect after sign-in: wait for the URL, not a full page load.
  await page.waitForURL((url) => url.pathname === `/${role}` || (url.pathname.startsWith(`/${role}/`) && !url.pathname.endsWith('/login')), {
    timeout: 60_000,
    waitUntil: 'commit',
  });
}

async function toWebp(png: Buffer, file: string, quality: number) {
  await mkdir(dirname(file), { recursive: true });
  const out = await sharp(png).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
  await writeFile(file, out);
  const { width, height } = await sharp(out).metadata();
  console.log(`  ✓ ${relative(WEB_ROOT, file)}  ${width}×${height}  ${(out.length / 1024).toFixed(0)} KB`);
}

interface LessonSummary {
  id: string;
  title: string;
  status: string;
  language: string;
  questionCount: number;
}

/** The showcase lesson; otherwise one with AI questions ready, preferably a non-English (codemix) lecture. */
async function pickLesson(page: Page): Promise<LessonSummary | undefined> {
  const res = await page.request.get('/api/lessons?pageSize=100');
  if (!res.ok()) return undefined;
  const { items } = (await res.json()) as { items: LessonSummary[] };
  const candidates = items.filter(
    (l) => (l.status === 'ready_for_review' || l.status === 'published') && l.questionCount > 0 && !/smoke|pool|test/i.test(l.title),
  );
  return candidates.find((l) => l.title === SHOWCASE_LESSON) ?? candidates.find((l) => l.language !== 'en-IN') ?? candidates[0];
}

/**
 * The landing page shows the teacher *reviewing* the quiz, but the showcase lesson is already published
 * (its class has taken the quiz). Present that lesson's own data as it stood before publishing — ready for
 * review, every question still waiting for the teacher — so the review controls show. Only this one
 * response is rewritten in the browser; nothing is changed on the server.
 */
async function showAsInReview(page: Page, lessonId: string) {
  await page.route(`**/api/lessons/${lessonId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const lesson = (await response.json()) as { status: string; publishedAt: string | null; questions: { position: number; status: string }[] };
    lesson.status = 'ready_for_review';
    lesson.publishedAt = null;
    for (const q of lesson.questions) q.status = 'draft';
    await route.fulfill({ response, json: lesson });
  });
}

async function captureScreens(browser: Browser, only?: string) {
  // Admin: the showcase class (teacher, room, enrolled students); the dashboard home without it.
  if (!only || only === 'admin') {
    console.log('admin');
    const context = await newContext(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await signIn(page, 'admin');
    const sections = (await (await page.request.get('/api/admin/sections')).json()) as { id: string; name: string }[];
    const section = Array.isArray(sections) ? sections.find((s) => s.name === SHOWCASE_SECTION) : undefined;
    if (section) console.log(`  section: ${section.name}`);
    else console.warn(`  no "${SHOWCASE_SECTION}" section — capturing the admin overview instead`);
    await page.goto(section ? `/admin/sections/${section.id}` : '/admin');
    await settle(page);
    await toWebp(await page.screenshot(), join(SCREENS_DIR, 'admin.webp'), 88);
    await context.close();
  }

  // Teacher: a lesson's AI-written questions, each linked to its moment in the lecture.
  if (!only || only === 'teacher') {
    console.log('teacher');
    const context = await newContext(browser, { viewport: { width: 1440, height: TEACHER_HEIGHT }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await signIn(page, 'teacher');
    const lesson = await pickLesson(page);
    if (lesson) {
      console.log(`  lesson: ${lesson.title}`);
      if (lesson.title === SHOWCASE_LESSON && lesson.status === 'published') await showAsInReview(page, lesson.id);
      await page.goto(`/teacher/lessons/${lesson.id}`);
      await page.locator('#questions-heading').waitFor({ timeout: 30_000 });
      await settle(page);
      // The whole workspace from the top: lesson title, the questions under review, and the recording beside them.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      // Cue the recording to the moment Q1 cites (no playback): the transcript highlights that line.
      await page.evaluate((sec) => {
        const audio = document.querySelector('audio');
        if (audio) audio.currentTime = sec;
      }, SHOWCASE_MOMENT_SEC);
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const active = document.querySelector<HTMLElement>('ol button[aria-current="true"]');
        const list = active?.closest('ol');
        if (active && list) list.scrollTop = active.offsetTop - list.offsetTop - 8;
      });
      await page.waitForTimeout(400);
    } else {
      console.warn('  no lesson with questions — capturing the teacher home instead');
      await page.goto('/teacher');
      await settle(page);
    }
    await toWebp(await page.screenshot(), join(SCREENS_DIR, 'teacher.webp'), 88);
    await context.close();
  }

  // Student: a quiz question on a phone (the student home when there is no quiz).
  if (!only || only === 'student') {
    console.log('student');
    const context = await newContext(browser, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });
    const page = await context.newPage();
    await signIn(page, 'student');
    // Mark the first-run tour as seen so it doesn't cover the screen.
    const me = (await (await page.request.get('/api/auth/me')).json()) as { id?: string; user?: { id?: string } };
    const userId = me.user?.id ?? me.id;
    if (userId) await page.evaluate((key) => window.localStorage.setItem(key, new Date().toISOString()), `cp-tour-student-v1:${userId}`);
    // Best frame: the first question of a published quiz (opening and starting it is client-side only —
    // nothing is submitted). Without one, the student home.
    const quizzes = (await (await page.request.get('/api/student/quizzes')).json()) as { lessonId: string; title: string }[];
    const quiz = Array.isArray(quizzes) ? (quizzes.find((q) => q.title === SHOWCASE_LESSON) ?? quizzes[0]) : undefined;
    if (quiz) {
      console.log(`  quiz: ${quiz.title}`);
      await page.goto(`/student/quizzes/${quiz.lessonId}`);
      await settle(page);
      const start = page.getByRole('button', { name: 'Start quiz' });
      if (await start.isVisible()) {
        await start.click();
        await settle(page);
      }
      // Show the question in the class's language (Tamil, with the science terms in English).
      const local = page.getByRole('group', { name: 'Question language' }).getByRole('button', { name: 'Local language' });
      if (await local.isVisible()) {
        await local.click();
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(200);
    } else {
      console.warn('  no published quiz for this student — capturing the student home instead');
      await page.goto('/student');
      await settle(page);
    }
    await toWebp(await page.screenshot(), join(SCREENS_DIR, 'student.webp'), 88);
    await context.close();
  }
}

const SHAPES = {
  wide: { width: 1600, height: 1000 },
  tall: { width: 900, height: 1600 },
} as const;

async function capturePosters(browser: Browser) {
  for (const [shape, viewport] of Object.entries(SHAPES) as [keyof typeof SHAPES, (typeof SHAPES)[keyof typeof SHAPES]][]) {
    // Full motion: with reduced motion the page shows the posters instead of rendering the scene.
    const context = await newContext(browser, { viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    for (let n = 0; n <= 6; n++) {
      const name = n === 6 ? `finale-${shape}` : `chapter-${n}-${shape}`;
      console.log(name);
      await page.goto(`/about?capture=${n}`);
      await page.waitForFunction(() => document.documentElement.dataset.sceneReady === '1', undefined, { timeout: 120_000 });
      await page.evaluate(() => document.fonts.ready);
      await hideDevChrome(page);
      await toWebp(await page.screenshot({ timeout: 120_000 }), join(POSTERS_DIR, `${name}.webp`), 82);
    }
    await context.close();
  }
  // TODO(landing): `device` crop (POSTERS.device, transparent background) — needs a capture mode that frames
  // the Raspberry Pi + mic alone on a transparent canvas (omitBackground: true) once the scene supports it.
}

/** The ffmpeg binary from ffmpeg-static (a dependency of apps/api; hoisted to the repo's node_modules). */
function ffmpegPath(): string {
  const require = createRequire(join(WEB_ROOT, '../api/package.json'));
  const path = require('ffmpeg-static') as unknown;
  if (typeof path !== 'string') throw new Error('ffmpeg-static has no binary for this platform');
  return path;
}

const run = promisify(execFile);

async function encode(frames: string, fps: number, file: string, codec: 'h264' | 'vp9') {
  const args =
    codec === 'h264'
      ? // Why these: yuv420p + main profile play everywhere; faststart puts the index first so playback can
        // begin while it downloads; CRF 30 at veryslow keeps the gentle motion clean at ~0.5 MB; VP9 at CRF 48 lands a little smaller.
        ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '30', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
      : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '48', '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1', '-pix_fmt', 'yuv420p'];
  await run(ffmpegPath(), ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(frames, 'f%04d.png'), ...args, '-an', file], {
    maxBuffer: 16 * 1024 * 1024,
  });
  const { size } = await stat(file);
  console.log(`  ✓ ${relative(WEB_ROOT, file)}  ${(size / 1024).toFixed(0)} KB`);
}

async function captureVideo(browser: Browser, only?: string) {
  for (const [shape, viewport] of Object.entries(SHAPES) as [keyof typeof SHAPES, (typeof SHAPES)[keyof typeof SHAPES]][]) {
    if (only && only !== shape) continue;
    console.log(`hero-${shape}`);
    const context = await newContext(browser, { viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.goto(`/about?capture=0&clip=${CLIP_SECONDS}`);
    await page.waitForFunction(() => document.documentElement.dataset.sceneReady === '1', undefined, { timeout: 180_000 });
    await page.evaluate(() => document.fonts.ready);
    await hideDevChrome(page);
    const { frames, fps } = await page.evaluate(() => {
      const clip = (window as Window & { __classpulseClip?: { frames: number; fps: number } }).__classpulseClip;
      if (!clip) throw new Error('clip capture API missing (is ?clip= handled by the scene?)');
      return { frames: clip.frames, fps: clip.fps };
    });
    const dir = await mkdtemp(join(tmpdir(), `classpulse-hero-${shape}-`));
    try {
      for (let i = 0; i < frames; i++) {
        await page.evaluate(
          (n) => (window as unknown as Window & { __classpulseClip: { step: (f: number) => Promise<void> } }).__classpulseClip.step(n),
          i,
        );
        await writeFile(join(dir, `f${String(i).padStart(4, '0')}.png`), await page.screenshot({ timeout: 120_000 }));
        if (i % 30 === 0) console.log(`  frame ${i}/${frames}`);
      }
      await mkdir(VIDEO_DIR, { recursive: true });
      await encode(dir, fps, join(VIDEO_DIR, `hero-${shape}.mp4`), 'h264');
      await encode(dir, fps, join(VIDEO_DIR, `hero-${shape}.webm`), 'vp9');
    } finally {
      await rm(dir, { recursive: true, force: true });
      await context.close();
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'screens' && mode !== 'posters' && mode !== 'video') {
    console.error('Usage: npx tsx scripts/capture-landing-assets.ts <screens|posters|video>');
    process.exit(2);
  }
  // The video is 480 full frames: use the real GPU when there is one (new headless mode), unless told not to.
  const gpu = mode === 'video' && process.env.CAPTURE_SWIFTSHADER !== '1';
  const browser = await chromium.launch(
    gpu
      ? { channel: 'chromium', args: ['--ignore-gpu-blocklist'] }
      : {
          // Software WebGL so the 3D scene renders on machines/CI without a usable GPU.
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        },
  );
  try {
    if (mode === 'screens') await captureScreens(browser, process.argv[3]);
    else if (mode === 'video') await captureVideo(browser, process.argv[3]);
    else await capturePosters(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
