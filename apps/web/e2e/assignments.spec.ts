/**
 * Homework flow against a running stack (`npm run dev` + seeded DB) with the REAL AI provider:
 * the teacher creates a standalone assignment (files allowed, due yesterday with "allow late") and
 * publishes it → a student hands in text + a PNG (flagged late) → the teacher opens the submission,
 * asks the AI for a suggestion, adjusts a mark and returns it → the student sees marks and feedback.
 *
 * People and the class are created through the admin API (credentials via E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
 */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.school';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin@12345';
const INSTITUTION_CODE = process.env.E2E_INSTITUTION_CODE;
const FIRST_PASSWORD = 'First@2026!x';
const PASSWORD = 'Pilot@2026!';

/** A valid 1x1 PNG ("photo of the work"). */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const SECTION = `E2E Homework ${RUN}`;
const SUBJECT = 'Science';
const TITLE = `Leaf structure ${RUN}`;
const TEACHER = { name: `E2E Teacher ${RUN}`, email: `hw.teacher.${RUN.toLowerCase()}@demo.school` };
const STUDENT = { name: `E2E Student ${RUN}`, roll: `HW${RUN}` };

let teacher: BrowserContext;
let student: BrowserContext;
let assignmentUrl = '';

async function ok<T>(res: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  expect(res.ok(), `${res.url()} → ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** A browser context signed in through the API, with the forced first password change done. */
async function signedIn(browser: Browser, login: { path: string; body: Record<string, string> }): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  await ok(await ctx.request.post(login.path, { data: { ...login.body, password: FIRST_PASSWORD } }));
  await ok(await ctx.request.post('/api/auth/change-password', { data: { currentPassword: FIRST_PASSWORD, newPassword: PASSWORD } }));
  return ctx;
}

/** "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, in the browser's (= this machine's) timezone. */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const admin = await browser.newContext();
  await ok(await admin.request.post('/api/auth/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }));
  const t = await ok<{ record: { id: string } }>(
    await admin.request.post('/api/admin/teachers', { data: { name: TEACHER.name, email: TEACHER.email, password: FIRST_PASSWORD } }),
  );
  const section = await ok<{ id: string }>(
    await admin.request.post('/api/admin/sections', { data: { name: SECTION, subject: SUBJECT, teacherIds: [t.record.id] } }),
  );
  await ok(
    await admin.request.post('/api/admin/students', {
      data: { name: STUDENT.name, rollNumber: STUDENT.roll, sectionId: section.id, password: FIRST_PASSWORD },
    }),
  );
  await admin.close();

  teacher = await signedIn(browser, { path: '/api/auth/teacher/login', body: { email: TEACHER.email } });
  student = await signedIn(browser, {
    path: '/api/auth/student/login',
    body: { rollNumber: STUDENT.roll, ...(INSTITUTION_CODE ? { institutionCode: INSTITUTION_CODE } : {}) },
  });
});

test.afterAll(async () => {
  await teacher?.close();
  await student?.close();
});

test('teacher creates and publishes a standalone assignment', async () => {
  const page = await teacher.newPage();
  await page.goto('/teacher/assignments');
  await page.getByRole('button', { name: 'New assignment' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Class').selectOption({ label: `${SECTION} — ${SUBJECT}` });
  await expect(dialog.getByLabel('Lesson (optional)')).toHaveValue('');
  await dialog.getByLabel('Assignment title').fill(TITLE);
  await dialog.getByLabel('Instructions').fill('Draw a leaf, label its parts and explain what each part does.');
  await dialog.getByRole('button', { name: 'Add criterion' }).click();
  await dialog.getByLabel('Criterion 1', { exact: true }).fill('Explanation');
  await dialog.getByLabel('Marks for criterion 1').fill('10');
  await dialog.getByRole('button', { name: 'Add criterion' }).click();
  await dialog.getByLabel('Criterion 2', { exact: true }).fill('Diagram');
  await dialog.getByLabel('Marks for criterion 2').fill('5');
  // Due yesterday, late work allowed: the student's work is flagged late.
  await dialog.getByLabel('Due date', { exact: true }).fill(localInput(new Date(Date.now() - 24 * 3600_000)));
  await dialog.getByLabel('Late submissions').selectOption({ label: 'Allow late (flagged)' });
  await expect(dialog.getByLabel('Allow file uploads (photos of written work, PDF, Word)')).toBeChecked();
  await dialog.getByLabel('Maximum files per student').fill('3');
  await dialog.getByRole('button', { name: 'Create assignment' }).click();

  await page.waitForURL(/\/teacher\/assignments\/[0-9a-f-]{36}$/);
  assignmentUrl = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Close submissions' })).toBeVisible();
  await page.close();
});

test('student hands in text and a photo (late)', async () => {
  const page = await student.newPage();
  await page.goto('/student/assignments');
  await page.getByRole('button', { name: new RegExp(TITLE) }).click();
  await expect(page.getByText('The due date has passed. You can still hand in work, but it will be marked late.')).toBeVisible();
  await page.getByLabel('Your answer').fill('The blade makes food by photosynthesis; the veins carry water; the stomata let gases in and out.');
  await page.getByLabel('Attach files').setInputFiles({ name: 'leaf-diagram.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('list', { name: 'Files to upload' })).toContainText('leaf-diagram.png');
  await page.getByRole('button', { name: 'Submit assignment' }).click();
  await expect(page.getByText(/^Handed in late/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'leaf-diagram.png' })).toBeVisible();
  await page.close();
});

test('teacher grades with an AI suggestion and returns the work', async () => {
  const page = await teacher.newPage();
  await page.goto(assignmentUrl);
  await page.getByRole('tab', { name: 'Submissions' }).click();
  await page.getByRole('button', { name: `Grade work by ${STUDENT.name}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img', { name: 'Photo leaf-diagram.png' })).toBeVisible();
  await expect(dialog.getByText('Late', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Suggest with AI' }).click();
  await expect(dialog.getByText('AI suggestion — review before returning')).toBeVisible({ timeout: 3 * 60_000 });
  await expect(dialog.getByLabel('Feedback for the student')).not.toHaveValue('');
  await dialog.getByLabel('Diagram (out of 5)').fill('4');
  await dialog.getByLabel('Explanation (out of 10)').fill('8.5');
  await expect(dialog.getByText('Total: 12.5 / 15')).toBeVisible();
  await dialog.getByRole('button', { name: 'Return to student' }).click();
  await expect(dialog.getByRole('button', { name: 'Return to student' })).toBeHidden();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: `View work by ${STUDENT.name}` })).toBeVisible();
  await page.close();
});

test('student sees marks and feedback', async () => {
  const page = await student.newPage();
  await page.goto('/student/assignments');
  await page.getByRole('button', { name: new RegExp(TITLE) }).click();
  await expect(page.getByRole('heading', { name: 'Returned by your teacher' })).toBeVisible();
  await expect(page.getByText('12.5')).toBeVisible();
  const marks = page.getByRole('list', { name: 'Marks per criterion' });
  await expect(marks).toContainText('Explanation');
  await expect(marks).toContainText('8.5');
  await expect(marks).toContainText('Diagram');
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit assignment' })).toHaveCount(0);
  await page.close();
});
