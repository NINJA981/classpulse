/**
 * Account emails, end to end: an admin downloads the teacher CSV template, imports two
 * teachers, each gets an invitation email, the first one sets a password from the link and
 * lands on /teacher; then the "Forgot password?" flow works the same way.
 *
 * Requires the dev stack (`npm run dev`, seeded DB) with the API started with
 * E2E_MAIL_CAPTURE=true, which captures outgoing email and serves it at
 * GET {E2E_API_URL}/api/test/emails?to=<address> instead of sending it.
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const RUN = Date.now().toString(36).slice(-5).toLowerCase();
const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.school';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin@12345';

const TEACHERS = [
  { name: `Invite Alpha ${RUN}`, email: `invite.alpha.${RUN}@demo.school`, department: 'Mathematics' },
  { name: `Invite Beta ${RUN}`, email: `invite.beta.${RUN}@demo.school`, department: '' },
];
const FIRST_PASSWORD = 'Invited@2026!';
const RESET_PASSWORD = 'Resetted@2026!';

interface CapturedEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  at: string;
}

async function emailsTo(request: APIRequestContext, to: string): Promise<CapturedEmail[]> {
  const res = await request.get(`${API_URL}/api/test/emails`, { params: { to } });
  expect(res.ok(), 'GET /api/test/emails failed — start the API with E2E_MAIL_CAPTURE=true').toBe(true);
  return (await res.json()) as CapturedEmail[];
}

/** Waits for an email with `subject` to `to` and returns the set-password link as a same-origin path. */
async function linkFromEmail(request: APIRequestContext, to: string, subject: string): Promise<string> {
  let link = '';
  await expect
    .poll(
      async () => {
        const mail = (await emailsTo(request, to)).find((m) => m.subject === subject);
        link = /https?:\/\/\S+\/set-password[#?]token=[A-Za-z0-9_%-]+/.exec(mail?.text ?? '')?.[0] ?? '';
        return link;
      },
      { timeout: 30_000, message: `waiting for "${subject}" to ${to}` },
    )
    .not.toBe('');
  // The email uses PUBLIC_ORIGIN; open it against the app under test.
  const url = new URL(link);
  return `${url.pathname}${url.search}${url.hash}`; // links carry the token in the fragment (#token=…)
}

async function staffLogin(page: Page, email: string, password: string, role: 'admin' | 'teacher') {
  await page.goto(`/${role}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

/** Opens a set-password link in a fresh browser (no admin session) and signs in. */
async function setPasswordFromLink(browser: Browser, path: string, name: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(path);
  await expect(page.getByRole('heading', { name: `Hi ${name}` })).toBeVisible();
  await page.getByLabel(/^New password/).fill(password);
  await page.getByLabel(/^Confirm new password/).fill(password);
  await page.getByRole('button', { name: 'Set password and sign in' }).click();
  await page.waitForURL(/\/teacher(\/|$)/);
  // A used link can't be opened again.
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'This link can’t be used' })).toBeVisible();
  await ctx.close();
}

test.describe.serial('account emails', () => {
  test('admin imports teachers from CSV and invitations are emailed', async ({ page }) => {
    await staffLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    await page.goto('/admin/teachers');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    // <dialog>s are located by their heading text.
    const dialog = page.getByRole('dialog').filter({ hasText: 'Import teachers from CSV' });
    await expect(dialog).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download template' }).click()]);
    expect(download.suggestedFilename()).toBe('classiq-teachers-template.csv');

    const csv = ['name,email,department', ...TEACHERS.map((t) => `${t.name},${t.email},${t.department}`)].join('\n');
    await dialog.getByLabel('CSV file').setInputFiles({ name: 'teachers.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(dialog.getByText('2 ready')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import 2 teachers' }).click();

    const result = page.getByRole('dialog').filter({ hasText: 'Import complete' });
    await expect(result.getByText(/2 invitation emails queued/)).toBeVisible();
    await expect(result.getByRole('button', { name: 'Download credentials CSV' })).toBeVisible();
    await result.getByRole('button', { name: 'Done' }).click();

    // Both rows appear with an invite badge.
    for (const t of TEACHERS) await expect(page.getByRole('row', { name: t.email })).toBeVisible();
  });

  test('an invited teacher sets a password from the email and lands on /teacher', async ({ browser, request }) => {
    const [teacher] = TEACHERS;
    const path = await linkFromEmail(request, teacher!.email, 'Welcome to ClassIQ — set your password');
    await setPasswordFromLink(browser, path, teacher!.name, FIRST_PASSWORD);
  });

  test('"Forgot password?" emails a reset link that works the same way', async ({ browser, request }) => {
    const [teacher] = TEACHERS;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await page.getByRole('tab', { name: 'Staff email' }).click();
    await page.getByLabel('Email').fill(teacher!.email);
    await page.getByRole('button', { name: 'Email me a reset link' }).click();
    await expect(page.getByText("If an account matches, we've emailed a reset link.")).toBeVisible();
    await ctx.close();

    const path = await linkFromEmail(request, teacher!.email, 'Reset your ClassIQ password');
    await setPasswordFromLink(browser, path, teacher!.name, RESET_PASSWORD);

    // The new password works for a normal sign-in.
    const again = await browser.newContext();
    const login = await again.newPage();
    await staffLogin(login, teacher!.email, RESET_PASSWORD, 'teacher');
    await expect(login).toHaveURL(/\/teacher(\/|$)/);
    await again.close();
  });
});
