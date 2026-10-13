/**
 * Notifications (bell, panel, live toast, push opt-in) as a seeded teacher.
 *
 * Requires the dev stack (`npm run dev`) with the dev seed. The live part needs a test-only hook that creates a
 * notification for the signed-in user without running an AI job:
 *   POST /api/test/notifications { kind, tone, title, body?, link? } → NotificationDto
 * (mounted with the other /api/test routes when E2E_MAIL_CAPTURE is on). Without it, that test is skipped.
 */
import { expect, test, type Page } from '@playwright/test';

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL ?? 'anita@demo.school';
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD ?? 'Teacher@12345';
const RUN = Date.now().toString(36).slice(-5).toUpperCase();

async function teacherLogin(page: Page) {
  await page.goto('/teacher/login');
  await page.getByLabel('Email').fill(TEACHER_EMAIL);
  await page.getByLabel('Password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

const bell = (page: Page) => page.getByRole('button', { name: /^Notifications(, \d+\+? unread)?$/ });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Notifications' });

test.describe.serial('notifications', () => {
  test('bell opens the panel; keyboard and Esc work', async ({ page }) => {
    await teacherLogin(page);
    await expect(bell(page)).toBeVisible();

    // Keyboard: Enter opens and moves focus into the panel; Esc closes and returns focus to the bell.
    await bell(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: 'Notifications' })).toBeFocused();
    await expect(
      panel(page)
        .getByText("Nothing yet. When a lesson or resource finishes, you'll see it here.")
        .or(panel(page).getByRole('list', { name: 'Notifications' })),
    ).toBeVisible();
    await expect(panel(page).getByText('Notify me on this device')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(bell(page)).toBeFocused();

    // Space toggles too; the close button closes.
    await page.keyboard.press(' ');
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Close notifications' }).click();
    await expect(panel(page)).toBeHidden();
  });

  test('a new notification shows a toast, the badge, and opens its link', async ({ page }) => {
    await teacherLogin(page);
    await page.goto('/teacher/resources');
    await expect(bell(page)).toBeVisible();
    // Give the page's socket a moment to connect.
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const title = `Your worksheet is ready (${RUN}).`;
    const res = await page.request.post('/api/test/notifications', {
      data: { kind: 'resource.ready', tone: 'success', title, body: 'Open it to review and export.', link: '/teacher/lessons' },
    });
    test.skip(res.status() === 404, 'Needs the test-only POST /api/test/notifications hook (see the file header)');
    expect(res.ok()).toBeTruthy();

    // Live toast with an Open action.
    const toast = page.getByRole('status').filter({ hasText: title });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/teacher/lessons');

    // Badge count on the bell.
    await expect(bell(page)).toHaveAccessibleName(/^Notifications, \d+\+? unread$/);
    const before = Number((await bell(page).getAttribute('aria-label'))?.match(/(\d+)/)?.[1] ?? '0');

    // Open the panel, click the item: it's marked read and we land on its link.
    await bell(page).click();
    const item = panel(page).getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Unread');
    await item.click();
    await expect(page).toHaveURL(/\/teacher\/lessons$/);
    await expect(panel(page)).toBeHidden();
    if (before > 1) await expect(bell(page)).toHaveAccessibleName(`Notifications, ${before - 1} unread`);
    else await expect(bell(page)).toHaveAccessibleName('Notifications');

    // Mark all as read clears the count (survives a reload).
    await bell(page).click();
    const markAll = panel(page).getByRole('button', { name: 'Mark all as read' });
    if (await markAll.isVisible()) await markAll.click();
    await expect(bell(page)).toHaveAccessibleName('Notifications');
    await page.reload();
    await expect(bell(page)).toHaveAccessibleName('Notifications');
  });

  test('push setting shows this device’s state', async ({ page, context, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'Push permissions are granted through Chromium');
    await context.grantPermissions(['notifications'], { origin: new URL(baseURL ?? 'http://localhost:3000').origin });
    await teacherLogin(page);
    // Development registers the service worker only with NEXT_PUBLIC_SW_DEV=1; register it here so push can run.
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
        await navigator.serviceWorker.ready;
      }
    });
    await page.reload();
    await bell(page).click();
    await expect(panel(page).getByText('Checking this device…')).toBeHidden();
    const pushSwitch = panel(page).getByRole('switch', { name: 'Notify me on this device' });
    // Either the switch (push is set up and the service worker runs) or a plain explanation of why not.
    const explanation = panel(page).getByText(
      /aren't set up on this server yet|Alerts can't start on this page|can't show notifications|Home Screen first|push service isn't supported|blocked for this site/,
    );
    await expect(pushSwitch.or(explanation)).toBeVisible();
    if (await pushSwitch.isVisible()) {
      const was = await pushSwitch.getAttribute('aria-checked');
      await pushSwitch.click();
      await expect(pushSwitch).not.toHaveAttribute('aria-checked', was ?? 'false');
      await expect(panel(page).getByText(/On for this device|Get an alert on this phone/)).toBeVisible();
      // Put it back.
      await pushSwitch.click();
      await expect(pushSwitch).toHaveAttribute('aria-checked', was ?? 'false');
    }
  });

  test('phone: the bell is in the header and the panel is a sheet', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await teacherLogin(page);
    await expect(bell(page)).toBeVisible();
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    const box = await panel(page).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(388);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await context.close();
  });
});
