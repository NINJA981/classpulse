/**
 * Secure exams, end to end against a running stack with the dev seed
 * (`npm run db:seed`): teacher builds a 5-question pool (3 per student) with an
 * access code and fullscreen, two students start with the code, one leaves
 * fullscreen and submits, the other is force-submitted from the live monitor,
 * and the teacher checks the monitor and the integrity timeline in the results.
 *
 * Questions are added through the teacher API (manual questions are approved),
 * so no AI provider is needed.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const TEACHER_EMAIL = process.env.E2E_EXAM_TEACHER_EMAIL ?? 'anita@demo.school';
const TEACHER_PASSWORD = process.env.E2E_EXAM_TEACHER_PASSWORD ?? 'Teacher@12345';
const SECTION_NAME = process.env.E2E_EXAM_SECTION ?? 'Grade 10 - A';
const STUDENT_PASSWORD = process.env.E2E_EXAM_STUDENT_PASSWORD ?? 'Student@12345';
const STUDENT_ROLLS = (process.env.E2E_EXAM_STUDENT_ROLLS ?? '10A-01,10A-02').split(',');
const LESSON_TITLE = `Exam pool ${RUN}`;
const EXAM_TITLE = `Unit test ${RUN}`;

const state: { examId: string; accessCode: string; names: string[] } = {
  examId: '',
  accessCode: '',
  names: [],
};

async function staffLogin(page: Page, email: string, password: string, role: 'admin' | 'teacher') {
  await page.goto(`/${role}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

async function studentLogin(page: Page, roll: string, password: string) {
  await page.goto('/student/login');
  await page.getByLabel('Roll number').fill(roll);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

/** Value for <input type="datetime-local"> in the local timezone (browser and runner share the machine). */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe.serial('Secure exams', () => {
  test('1. teacher creates and publishes an exam', async ({ browser }) => {
    const page = await newPage(browser);
    await staffLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD, 'teacher');

    // Pool: a lesson with 5 approved (manual) questions.
    const sections = (await (await page.request.get('/api/teacher/sections')).json()) as {
      id: string;
      name: string;
      subject: string | null;
    }[];
    const section = sections.find((s) => s.name === SECTION_NAME)!;
    expect(section).toBeTruthy();
    const lessonRes = await page.request.post('/api/lessons', {
      data: { title: LESSON_TITLE, sectionId: section.id, subject: 'Science' },
    });
    expect(lessonRes.ok()).toBeTruthy();
    const lesson = (await lessonRes.json()) as { id: string };
    for (let i = 1; i <= 5; i++) {
      const q = await page.request.post(`/api/lessons/${lesson.id}/questions`, {
        data: {
          stem: `${RUN} question ${i}: which is option ${'ABCD'[i % 4]}?`,
          options: [`Alpha ${i}`, `Beta ${i}`, `Gamma ${i}`, `Delta ${i}`],
          correctIndex: i % 4,
          explanation: `It is option ${'ABCD'[i % 4]}.`,
          difficulty: 'medium',
          topicTag: 'E2E',
        },
      });
      expect(q.ok()).toBeTruthy();
    }

    // Step 1: details & window.
    await page.goto('/teacher/exams');
    await page.getByRole('link', { name: 'New exam' }).first().click();
    await page.getByLabel('Exam title').fill(EXAM_TITLE);
    await page
      .getByLabel('Section')
      .selectOption({ label: section.subject ? `${section.name} — ${section.subject}` : section.name });
    await page.getByLabel('Instructions for students').fill('Work alone. No notes.');
    await page.getByLabel('Opens at').fill(localInput(new Date(Date.now() - 2 * 60_000)));
    await page.getByLabel('Closes at').fill(localInput(new Date(Date.now() + 60 * 60_000)));
    await page.getByLabel('Duration (minutes)').fill('20');
    await page.getByRole('button', { name: 'Create draft and continue' }).click();
    await expect(page).toHaveURL(/\/teacher\/exams\/[0-9a-f-]{36}$/);
    state.examId = new URL(page.url()).pathname.split('/').pop()!;

    // Step 2: questions.
    await page.getByRole('checkbox', { name: LESSON_TITLE, exact: true }).check();
    await expect(page.getByText('5 matching')).toBeVisible();
    await page.getByRole('button', { name: 'Select all shown' }).click();
    await expect(page.getByText(/^5 selected/)).toBeVisible();
    await page.getByLabel('Questions per student').fill('3');
    await page.getByRole('button', { name: 'Save questions and continue' }).click();

    // Step 3: security (defaults: shuffles, fullscreen, access code, one device) → publish.
    await expect(page.getByRole('checkbox', { name: /Require fullscreen/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Require an access code/ })).toBeChecked();
    await page.getByRole('button', { name: 'Publish exam' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/exams/${state.examId}/monitor$`));

    const exam = (await (await page.request.get(`/api/exams/${state.examId}`)).json()) as {
      accessCode: string;
      pool: unknown[];
    };
    expect(exam.accessCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(exam.pool).toHaveLength(5);
    state.accessCode = exam.accessCode;
    await expect(page.getByLabel(`Access code ${exam.accessCode.split('').join(' ')}`)).toBeVisible();

    const monitor = (await (await page.request.get(`/api/exams/${state.examId}/monitor`)).json()) as {
      rows: { student: { name: string; rollNumber: string | null }; status: string }[];
    };
    state.names = STUDENT_ROLLS.map(
      (roll) => monitor.rows.find((r) => r.student.rollNumber === roll)!.student.name,
    );
    expect(monitor.rows.every((r) => r.status === 'not_started')).toBe(true);
    await page.context().close();
  });

  test('2. two students take the exam; one leaves fullscreen and submits, the other is force-submitted', async ({
    browser,
  }) => {
    test.setTimeout(5 * 60_000);
    const players: Page[] = [];
    for (const roll of STUDENT_ROLLS) {
      const p = await newPage(browser);
      await studentLogin(p, roll, STUDENT_PASSWORD);
      await p.goto('/student/exams');
      await p.getByRole('link', { name: `Start ${EXAM_TITLE}` }).click();
      await expect(p.getByRole('heading', { name: 'Before you start' })).toBeVisible();
      await p.getByLabel('Access code').fill(state.accessCode.toLowerCase());
      await p.getByRole('button', { name: 'Start exam' }).click();
      await expect(p.getByRole('navigation', { name: 'Question navigator' })).toBeVisible();
      await expect(p.getByRole('button', { name: /^Question \d+, (answered|not answered)$/ })).toHaveCount(3);
      players.push(p);
    }
    const [a, b] = players as [Page, Page];

    // Student A answers every question (autosave), leaves fullscreen, returns, and submits.
    for (let q = 0; q < 3; q++) {
      await a
        .getByRole('radio')
        .nth(q % 4)
        .click();
      await expect(a.getByText('Saved', { exact: true })).toBeVisible();
      if (q < 2) await a.getByRole('button', { name: 'Next' }).click();
    }
    await expect(a.getByRole('button', { name: /^Question \d+, answered$/ })).toHaveCount(3);
    await a.evaluate(() => document.exitFullscreen());
    await expect(a.getByRole('heading', { name: 'Return to fullscreen to continue' })).toBeVisible();
    await expect(a.getByText(/You left fullscreen/)).toBeVisible();
    await a.getByRole('button', { name: 'Return to fullscreen' }).click();
    await expect(a.getByRole('heading', { name: 'Return to fullscreen to continue' })).toBeHidden();
    await a.getByRole('button', { name: 'Review and submit' }).first().click();
    await expect(a.getByRole('heading', { name: 'Ready to submit?' })).toBeVisible();
    await a.getByRole('button', { name: 'Submit exam' }).click();
    await expect(a.getByText('Submitted', { exact: true })).toBeVisible();
    await expect(a.getByText(/Results will be available after/)).toBeVisible();

    // Student B answers one question; the teacher force-submits from the monitor.
    await b.getByRole('radio').first().click();
    await expect(b.getByText('Saved', { exact: true })).toBeVisible();

    const teacher = await newPage(browser);
    await staffLogin(teacher, TEACHER_EMAIL, TEACHER_PASSWORD, 'teacher');
    await teacher.goto(`/teacher/exams/${state.examId}/monitor`);
    const table = teacher.getByRole('table', { name: 'Students' });
    await expect(
      table.getByRole('row', { name: new RegExp(state.names[0]!) }).getByText('Submitted', { exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole('row', { name: new RegExp(state.names[1]!) }).getByText('In progress', { exact: true }),
    ).toBeVisible();
    await teacher.getByRole('button', { name: `Force submit for ${state.names[1]}` }).click();
    await teacher.getByRole('dialog').getByRole('button', { name: 'Force submit', exact: true }).click();
    await expect(
      table
        .getByRole('row', { name: new RegExp(state.names[1]!) })
        .getByText('Auto-submitted', { exact: true }),
    ).toBeVisible();

    // B's next save is refused and the player switches to the result view.
    await b.getByRole('radio').nth(1).click();
    await expect(b.getByText('Auto-submitted', { exact: true })).toBeVisible();

    for (const p of [...players, teacher]) await p.context().close();
  });

  test('3. teacher sees results with the integrity timeline', async ({ browser }) => {
    const page = await newPage(browser);
    await staffLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD, 'teacher');
    await page.goto(`/teacher/exams/${state.examId}/results`);
    const results = page.getByRole('table', { name: 'Student results' });
    await expect(
      results.getByRole('row', { name: new RegExp(state.names[0]!) }).getByText('Submitted', { exact: true }),
    ).toBeVisible();
    await expect(
      results
        .getByRole('row', { name: new RegExp(state.names[1]!) })
        .getByText('Auto-submitted', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: `Show timeline for ${state.names[0]}` }).click();
    const timeline = page.getByRole('list', { name: `Integrity timeline for ${state.names[0]}` });
    await expect(timeline.getByText('Left fullscreen')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/results\.csv$/);
    await page.context().close();
  });
});
