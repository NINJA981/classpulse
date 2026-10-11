/**
 * Platform console (super admin), end to end: first sign-in with the one-time password, authenticator
 * enrolment (codes computed from the setup key), recovery codes, forced password change; then create a
 * school with its admin, see the admin sign in on the school side, suspend the school (the admin is
 * refused), reactivate it, show a banner to school users, and open the ops pages.
 *
 * Requires the dev stack with a fresh platform admin created by
 *   npm run create-superadmin -w @classpulse/api -- --email <E2E_PLATFORM_EMAIL> --name "E2E Platform"
 * and E2E_PLATFORM_EMAIL / E2E_PLATFORM_PASSWORD (the printed initial password) in the environment.
 * The API needs PLATFORM_ENCRYPTION_KEY set. When the console has its own host (production), run with
 * E2E_BASE_URL=<console origin> and E2E_SCHOOL_URL=<school origin>.
 */
import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const PLATFORM_EMAIL = process.env.E2E_PLATFORM_EMAIL ?? '';
const PLATFORM_PASSWORD = process.env.E2E_PLATFORM_PASSWORD ?? '';
const PLATFORM_NEW_PASSWORD = `Platform@${RUN}2026!`;
const SCHOOL = { name: `E2E Platform School ${RUN}`, code: `P${RUN}` };
const ADMIN = { name: `Platform Admin ${RUN}`, email: `platform.admin.${RUN.toLowerCase()}@demo.school` };
const ADMIN_NEW_PASSWORD = `SchoolAdmin@${RUN}1!`;
/** School-side origin; empty when the console and the school site share one origin (dev). */
const SCHOOL_URL = (process.env.E2E_SCHOOL_URL ?? '').replace(/\/+$/, '');
const BANNER = `Scheduled maintenance tonight ${RUN}`;

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret. */
function totp(base32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const offset = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function schoolAdminLogin(page: Page, password: string) {
  await page.goto(`${SCHOOL_URL}/admin/login`);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe.serial('platform console', () => {
  test.skip(!PLATFORM_EMAIL || !PLATFORM_PASSWORD, 'Set E2E_PLATFORM_EMAIL and E2E_PLATFORM_PASSWORD (see the file header)');

  let consolePage: Page;
  let adminOneTimePassword = '';

  test.beforeAll(async ({ browser }) => {
    consolePage = await (await browser.newContext()).newPage();
  });

  test('first sign-in: password, authenticator enrolment, recovery codes, new password', async () => {
    const page = consolePage;
    // School sessions never open the console: an anonymous visit lands on the platform login.
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform\/login/);

    await expect(page.getByRole('heading', { name: 'Super admin sign in' })).toBeVisible();
    await page.getByLabel('Email').fill(PLATFORM_EMAIL);
    await page.getByLabel('Password').fill(PLATFORM_PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Set up two-factor sign-in' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible();
    const secret = ((await page.getByLabel('Setup key').textContent()) ?? '').replace(/\s/g, '');
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

    // A wrong code is refused.
    await page.getByLabel('Authenticator code').fill('000000' === totp(secret) ? '111111' : '000000');
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Authenticator code').fill(totp(secret));
    await page.getByRole('button', { name: 'Verify and continue' }).click();

    await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem')).toHaveCount(10);
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();
    await page.getByLabel('I’ve saved these codes').check();
    await continueBtn.click();

    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel(/^Current password/).fill(PLATFORM_PASSWORD);
    await page.getByLabel(/^New password/).fill(PLATFORM_NEW_PASSWORD);
    await page.getByLabel(/^Confirm new password/).fill(PLATFORM_NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible();
  });

  test('create a school with its first admin', async () => {
    const page = consolePage;
    await page.getByRole('navigation', { name: 'Platform' }).getByRole('link', { name: 'Schools' }).click();
    await page.getByRole('button', { name: 'New school' }).click();
    const dialog = page.getByRole('dialog', { name: 'New school' });
    await dialog.getByLabel('School name').fill(SCHOOL.name);
    await dialog.getByLabel('School code').fill(SCHOOL.code);
    await dialog.getByLabel('Admin name').fill(ADMIN.name);
    await dialog.getByLabel('Admin email').fill(ADMIN.email);
    await dialog.getByRole('button', { name: 'Create school' }).click();

    const secret = page.getByRole('dialog').getByLabel('Initial password', { exact: true });
    await expect(secret).toBeVisible();
    adminOneTimePassword = ((await secret.textContent()) ?? '').trim();
    expect(adminOneTimePassword.length).toBeGreaterThan(5);
    await page.getByRole('button', { name: 'I have saved it' }).click();
    await expect(page.getByRole('link', { name: SCHOOL.name })).toBeVisible();
  });

  test('the new admin signs in on the school side', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await schoolAdminLogin(page, adminOneTimePassword);
    await expect(page).toHaveURL(/\/change-password/);
    await page.getByLabel('Current password').fill(adminOneTimePassword);
    await page.getByLabel(/^New password/).fill(ADMIN_NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill(ADMIN_NEW_PASSWORD);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.waitForURL(/\/admin(\/|$)/);
    // The console is a different identity: a school session doesn't open it (and on its own host it doesn't exist).
    const res = await page.goto(`${SCHOOL_URL}/platform`);
    if (SCHOOL_URL) expect(res?.status()).toBe(404);
    else await expect(page).toHaveURL(/\/platform\/login/);
    await ctx.close();
  });

  test('suspending the school refuses its admin; reactivating restores access', async ({ browser }) => {
    const page = consolePage;
    await page.getByRole('link', { name: SCHOOL.name }).click();
    await expect(page.getByRole('heading', { name: SCHOOL.name })).toBeVisible();

    await page.getByRole('button', { name: 'Suspend school' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason').fill('E2E suspension check');
    await dialog.getByLabel(`Type ${SCHOOL.code} to confirm`).fill(SCHOOL.code);
    await dialog.getByRole('button', { name: 'Suspend', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reactivate school' })).toBeVisible();

    const ctx = await browser.newContext();
    const school = await ctx.newPage();
    await schoolAdminLogin(school, ADMIN_NEW_PASSWORD);
    await expect(school.getByText("Your school's access is paused. Contact support.")).toBeVisible();
    await expect(school).toHaveURL(/\/admin\/login/);

    await page.getByRole('button', { name: 'Reactivate school' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel(`Type ${SCHOOL.code} to confirm`).fill(SCHOOL.code);
    await dialog.getByRole('button', { name: 'Reactivate', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Suspend school' })).toBeVisible();

    await schoolAdminLogin(school, ADMIN_NEW_PASSWORD);
    await school.waitForURL(/\/admin(\/|$)/);
    await ctx.close();
  });

  test('a platform banner reaches school users', async ({ browser }) => {
    const page = consolePage;
    await page.getByRole('navigation', { name: 'Platform' }).getByRole('link', { name: 'Settings' }).click();
    await page.getByLabel('Show banner').check();
    await page.getByLabel('Banner message').fill(BANNER);
    await page.getByRole('button', { name: 'Save notices' }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved/i }).first()).toBeVisible();

    const ctx = await browser.newContext();
    const school = await ctx.newPage();
    await schoolAdminLogin(school, ADMIN_NEW_PASSWORD);
    await school.waitForURL(/\/admin(\/|$)/);
    await expect(school.getByText(BANNER)).toBeVisible({ timeout: 45_000 });
    await ctx.close();

    await page.getByLabel('Show banner').uncheck();
    await page.getByRole('button', { name: 'Save notices' }).click();
  });

  test('ops pages: health, logs, audit, usage, deployments', async () => {
    const page = consolePage;
    const nav = page.getByRole('navigation', { name: 'Platform' });

    await nav.getByRole('link', { name: 'Health' }).click();
    await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: /^Database: / })).toBeVisible();

    await nav.getByRole('link', { name: 'Logs' }).click();
    await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toBeVisible();
    await expect(page.getByRole('log', { name: 'Log lines' })).toBeVisible();

    await nav.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    // The suspension above was audited.
    await expect(page.getByRole('table', { name: 'Audit entries' }).getByText('platform.school.suspend').first()).toBeVisible();

    await nav.getByRole('link', { name: 'Usage & costs' }).click();
    await expect(page.getByRole('heading', { name: 'Usage & costs' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Estimated cost');

    await nav.getByRole('link', { name: 'Deployments' }).click();
    await expect(page.getByRole('heading', { name: 'Deployments' })).toBeVisible();
  });
});
