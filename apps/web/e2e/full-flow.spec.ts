/**
 * Full pilot flow, A → Z, against a running stack with REAL AI providers:
 *   admin onboarding → teacher (forced password change) uploads a lecture →
 *   AI transcription + quiz generation → review/edit/publish → student joins by
 *   code and takes the quiz → teacher analytics → live quiz with 2 students.
 *
 * Requires: `npm run dev` (or the prod stack via E2E_BASE_URL), seeded DB, and a
 * lecture recording at .e2e-fixtures/lecture-150s.mp3 (see docs/pilot-runbook.md).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const LECTURE = path.resolve(import.meta.dirname, '../../../.e2e-fixtures/lecture-150s.mp3');
const NEW_PASSWORD = 'Pilot@2026!';

const state: {
  teacherEmail: string;
  teacherPassword: string;
  sectionName: string;
  joinCode: string;
  students: { name: string; roll: string; password: string }[];
  lessonUrl: string;
} = {
  teacherEmail: `teacher.${RUN.toLowerCase()}@demo.school`,
  teacherPassword: '',
  sectionName: `E2E Section ${RUN}`,
  joinCode: '',
  students: [],
  lessonUrl: '',
};

async function staffLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function studentLogin(page: Page, roll: string, password: string) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Student' }).click();
  await page.getByLabel('Roll number').fill(roll);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function changePassword(page: Page, current: string) {
  await expect(page).toHaveURL(/\/change-password/);
  await page.getByLabel('Current password').fill(current);
  await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save and continue' }).click();
}

async function readOneTimePassword(page: Page): Promise<string> {
  const secret = page.getByRole('dialog').getByLabel('Initial password', { exact: true });
  await expect(secret).toBeVisible();
  const value = (await secret.textContent())?.trim() ?? '';
  expect(value).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
  await page.getByRole('button', { name: 'I have saved it' }).click();
  return value;
}

function startAgent(configPath: string): ChildProcess {
  const agentPy = path.resolve(import.meta.dirname, '../../classroom-agent/agent.py');
  const child = spawn(process.env.PYTHON ?? 'python', [agentPy, '--config', configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d: Buffer) => process.env.E2E_AGENT_LOGS && process.stdout.write(`[agent] ${d}`));
  child.stderr?.on('data', (d: Buffer) => process.env.E2E_AGENT_LOGS && process.stdout.write(`[agent] ${d}`));
  return child;
}

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test.describe.serial('ClassPulse pilot flow', () => {
  test('1. admin onboards a room, teacher, section and students', async ({ browser }) => {
    const page = await newPage(browser);
    await staffLogin(page, 'admin@demo.school', 'Admin@12345');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const dialog = page.getByRole('dialog');

    // AI provider selection (e.g. E2E_STT_PROVIDER=openai when no Sarvam key is available).
    if (process.env.E2E_STT_PROVIDER) {
      await page.goto('/admin/settings');
      await page.getByLabel('STT provider').selectOption(process.env.E2E_STT_PROVIDER);
      await page.getByLabel(/^STT model/).fill(process.env.E2E_STT_MODEL ?? 'whisper-1');
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText(/saved/i).first()).toBeVisible();
    }

    // Room
    await page.goto('/admin/rooms');
    await page.getByRole('button', { name: /add room/i }).first().click();
    await dialog.getByLabel('Room name').fill(`E2E Room ${RUN}`);
    await dialog.getByRole('button', { name: /create room|save room|add room/i }).click();
    await expect(page.getByRole('cell', { name: `E2E Room ${RUN}`, exact: true })).toBeVisible();

    // Teacher (initial password shown once)
    await page.goto('/admin/teachers');
    await page.getByRole('button', { name: 'Add teacher' }).first().click();
    await dialog.getByLabel('Full name').fill(`E2E Teacher ${RUN}`);
    await dialog.getByLabel('Email').fill(state.teacherEmail);
    await dialog.getByRole('button', { name: 'Create teacher' }).click();
    state.teacherPassword = await readOneTimePassword(page);

    // Section with room + teacher
    await page.goto('/admin/sections');
    await page.getByRole('button', { name: 'Create section' }).first().click();
    await dialog.getByLabel('Section name').fill(state.sectionName);
    await dialog.getByLabel('Grade').fill('9');
    await dialog.getByLabel('Subject').fill('Mathematics');
    await dialog.getByLabel('Room').selectOption({ label: `E2E Room ${RUN}` });
    await dialog.getByLabel(`E2E Teacher ${RUN}`).check();
    await dialog.getByRole('button', { name: 'Create section' }).click();
    await expect(page.getByRole('cell', { name: state.sectionName, exact: true })).toBeVisible();
    const sections = (await (await page.request.get('/api/admin/sections')).json()) as { name: string; joinCode: string }[];
    state.joinCode = sections.find((s) => s.name === state.sectionName)!.joinCode;
    expect(state.joinCode).toMatch(/^[A-Z0-9]{6}$/);

    // Two students: one enrolled by the admin, one who will join with the code
    await page.goto('/admin/students');
    for (const [i, enrol] of [
      [1, true],
      [2, false],
    ] as const) {
      const s = { name: `E2E Student ${RUN}-${i}`, roll: `E2E-${RUN}-${i}`, password: '' };
      await page.getByRole('button', { name: 'Add student' }).first().click();
      await dialog.getByLabel('Full name').fill(s.name);
      await dialog.getByLabel('Roll number').fill(s.roll);
      if (enrol) await dialog.getByLabel('Section').selectOption({ label: state.sectionName });
      await dialog.getByRole('button', { name: /create student|add student/i }).click();
      s.password = await readOneTimePassword(page);
      state.students.push(s);
    }
    await page.context().close();
  });

  test('2. teacher uploads a lecture; AI transcribes and drafts the quiz', async ({ browser }) => {
    test.setTimeout(8 * 60_000);
    const page = await newPage(browser);
    await staffLogin(page, state.teacherEmail, state.teacherPassword);
    await changePassword(page, state.teacherPassword);
    await expect(page).toHaveURL(/\/teacher$/);

    await page.goto('/teacher/record');
    await page.getByRole('tab', { name: 'Upload audio file' }).click();
    await page.getByLabel('Section').selectOption({ label: `${state.sectionName} — Mathematics` });
    await page.getByLabel('Lesson title').fill(`Measures of central tendency ${RUN}`);
    await page.getByLabel('Subject').fill('Mathematics');
    await page.getByLabel('Audio file').setInputFiles(LECTURE);
    await page.getByRole('button', { name: 'Upload and generate quiz' }).click();

    await expect(page).toHaveURL(/\/teacher\/lessons\/[0-9a-f-]{36}/, { timeout: 120_000 });
    state.lessonUrl = new URL(page.url()).pathname;
    // Real Sarvam/Whisper + OpenAI run here.
    await expect(page.getByRole('button', { name: 'Approve all' })).toBeVisible({ timeout: 6 * 60_000 });
    await expect(page.getByRole('button', { name: 'Edit question 1' })).toBeVisible();
    await page.context().close();
  });

  test('3. teacher edits, approves and publishes', async ({ browser }) => {
    const page = await newPage(browser);
    await staffLogin(page, state.teacherEmail, NEW_PASSWORD);
    await page.goto(state.lessonUrl);

    await page.getByRole('button', { name: 'Edit question 1' }).click();
    const editor = page.getByRole('dialog');
    const stem = editor.getByRole('textbox', { name: /^Question\s*\*?$/ });
    await stem.fill(`${await stem.inputValue()} (reviewed)`);
    await editor.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('(reviewed)').first()).toBeVisible();

    await page.getByRole('button', { name: 'Approve all' }).click();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await page.context().close();
  });

  test('4. students sign in, join by code and take the quiz', async ({ browser }) => {
    for (const [i, s] of state.students.entries()) {
      const page = await newPage(browser);
      await studentLogin(page, s.roll, s.password);
      await changePassword(page, s.password);
      await expect(page).toHaveURL(/\/student$/);

      if (i === 1) {
        await page.goto(`/student/join?code=${state.joinCode}`);
        await page.getByRole('button', { name: 'Join class' }).click();
        await expect(page).toHaveURL(/\/student$/);
      }

      await page.goto('/student/quizzes');
      await page.getByRole('link', { name: new RegExp(`Measures of central tendency ${RUN}`) }).first().click();
      await page.getByRole('button', { name: 'Start quiz' }).click();
      const radios = page.getByRole('radio');
      for (let q = 0; q < 5; q++) {
        await expect(radios.first()).toBeVisible();
        await radios.nth((q + i) % 4).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Submit quiz' }).click();
      await expect(page.getByRole('button', { name: 'Retake quiz' })).toBeVisible();
      await expect(page.getByText(/%/).first()).toBeVisible();
      await page.context().close();
    }
  });

  test('5. live quiz: teacher hosts, two students play to the end', async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const teacher = await newPage(browser);
    await staffLogin(teacher, state.teacherEmail, NEW_PASSWORD);
    await teacher.goto(`${state.lessonUrl}/live`);
    await teacher.getByLabel('Time per question').selectOption('20');
    await teacher.getByRole('button', { name: 'Create live session' }).click();
    await teacher.waitForURL(/session=/);
    const sessionId = new URL(teacher.url()).searchParams.get('session')!;
    const info = (await (await teacher.request.get(`/api/live-sessions/${sessionId}`)).json()) as { pin: string };
    expect(info.pin).toMatch(/^\d{6}$/);

    const players: Page[] = [];
    for (const s of state.students) {
      const p = await newPage(browser);
      await studentLogin(p, s.roll, NEW_PASSWORD);
      await p.goto(`/student/live?pin=${info.pin}`);
      await p.getByRole('button', { name: 'Join game' }).click();
      await expect(p.getByText(/waiting for your teacher/i)).toBeVisible();
      players.push(p);
    }
    await expect(teacher.getByText(state.students[0]!.name).first()).toBeVisible();

    await teacher.getByRole('button', { name: 'Start', exact: true }).click();
    for (let q = 0; q < 5; q++) {
      for (const [i, p] of players.entries()) {
        const options = p.getByRole('radio');
        await expect(options.first()).toBeEnabled();
        await options.nth(i).click();
        if (i === 1) await options.nth(2).click(); // revise the answer before the deadline
        await expect(p.getByText(/answer saved/i)).toBeVisible();
      }
      await expect(teacher.getByText(`${players.length} / ${players.length} answered`)).toBeVisible();
      await teacher.getByRole('button', { name: 'Close question' }).click();
      for (const p of players) await expect(p.getByText(/correct|time's up|not quite|incorrect/i).first()).toBeVisible();
      if (q < 4) await teacher.getByRole('button', { name: 'Next question' }).click();
      else await teacher.getByRole('button', { name: 'Finish quiz' }).click();
    }
    await expect(teacher.getByText(state.students[1]!.name).first()).toBeVisible();
    for (const p of players) await expect(p.getByRole('link', { name: /back to home/i })).toBeVisible();

    const results = (await (await teacher.request.get(`/api/live-sessions/${sessionId}/results`)).json()) as {
      leaderboard: { name: string; score: number }[];
    };
    expect(results.leaderboard).toHaveLength(2);
    for (const p of [teacher, ...players]) await p.context().close();
  });

  test('6. classroom Raspberry Pi records a class end-to-end', async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    // Admin provisions a device for the section's room.
    const admin = await newPage(browser);
    await staffLogin(admin, 'admin@demo.school', 'Admin@12345');
    await admin.goto('/admin/devices');
    await admin.getByRole('button', { name: 'Add classroom device' }).first().click();
    const dlg = admin.getByRole('dialog');
    await dlg.getByLabel('Room').selectOption({ label: `E2E Room ${RUN}` });
    await dlg.getByLabel('Device name').fill(`E2E Pi ${RUN}`);
    await dlg.getByRole('button', { name: /create|generate|add/i }).last().click();
    const token = ((await dlg.getByLabel('Enrollment token', { exact: true }).textContent()) ?? '').trim();
    expect(token.length).toBeGreaterThan(16);
    await dlg.getByRole('button', { name: 'Done' }).click();

    // Start the real agent with a WAV file as its "microphone".
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'cp-agent-'));
    const configPath = path.join(dataDir, 'agent.json');
    await writeFile(
      configPath,
      JSON.stringify({
        server_url: process.env.E2E_API_URL ?? 'http://localhost:5000',
        allow_insecure_http: !(process.env.E2E_API_URL ?? '').startsWith('https://'),
        ca_file: process.env.E2E_AGENT_CA_FILE ?? null,
        device_id: `e2e-pi-${RUN.toLowerCase()}`,
        enrollment_token: token,
        data_dir: dataDir,
        chunk_seconds: 15,
        heartbeat_interval_sec: 5,
        min_free_disk_mb: 1,
        audio_source: { type: 'file', path: path.resolve(import.meta.dirname, '../../../.e2e-fixtures/lecture-90s-16k.wav'), realtime: true },
      }),
    );
    let agent = startAgent(configPath);
    try {
      await expect
        .poll(async () => {
          const devices = (await (await admin.request.get('/api/admin/devices')).json()) as { name: string; status: string }[];
          return devices.find((d) => d.name === `E2E Pi ${RUN}`)?.status;
        }, { timeout: 60_000 })
        .toBe('online');
      await admin.reload();
      await expect(admin.getByText(`e2e-pi-${RUN.toLowerCase()}`, { exact: true })).toBeVisible();
      await admin.context().close();

      // Teacher starts the class recording from the web app.
      const teacher = await newPage(browser);
      await staffLogin(teacher, state.teacherEmail, NEW_PASSWORD);
      await teacher.goto('/teacher/record');
      await teacher.getByLabel('Section').selectOption({ label: `${state.sectionName} — Mathematics` });
      await teacher.getByLabel('Lesson title').fill(`Pi recorded class ${RUN}`);
      await teacher.getByLabel('Subject').fill('Mathematics');
      await teacher.getByRole('button', { name: 'Start recording' }).click();
      await expect(teacher.getByLabel('Elapsed time')).toBeVisible({ timeout: 60_000 });
      const recordingId = new URL(teacher.url()).searchParams.get('recording')!;

      // Simulate a Pi crash/reboot mid-class: chunks on disk must still be uploaded.
      await expect
        .poll(async () => ((await (await teacher.request.get(`/api/recordings/${recordingId}`)).json()) as { chunksReceived: number }).chunksReceived, {
          timeout: 90_000,
        })
        .toBeGreaterThanOrEqual(2);
      agent.kill();
      await new Promise((r) => setTimeout(r, 3_000));
      agent = startAgent(configPath);

      await new Promise((r) => setTimeout(r, 20_000));
      await teacher.getByRole('button', { name: 'Stop recording' }).click();
      await teacher.getByRole('button', { name: 'Stop and upload' }).click();
      // Once the device finalizes, the recording panel moves the teacher to the lesson.
      await teacher.waitForURL(/\/teacher\/lessons\/[0-9a-f-]{36}/, { timeout: 3 * 60_000 });
      // Real AI generation on the Pi-recorded audio.
      await expect(teacher.getByRole('button', { name: 'Approve all' })).toBeVisible({ timeout: 6 * 60_000 });
      await teacher.context().close();
    } finally {
      agent.kill();
    }
  });

  test('7. teacher sees analytics for the attempts', async ({ browser }) => {
    const page = await newPage(browser);
    await staffLogin(page, state.teacherEmail, NEW_PASSWORD);
    await page.goto(`${state.lessonUrl}/analytics`);
    await expect(page.getByText(state.students[0]!.name)).toBeVisible();
    await expect(page.getByText(state.students[1]!.name)).toBeVisible();
    await page.context().close();
  });
});
