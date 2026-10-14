/**
 * First-time student tour, against a running stack with the dev seed (`npm run db:seed`): the tour opens on
 * Home for a student who hasn't seen it, steps forward and back, closes with Esc / Skip tour / Finish, stays
 * closed after a reload, and "Take the tour again" on the profile page restarts it. Also checks that the
 * card fits a 390px phone screen and that nav steps point at the ☰ menu button there.
 *
 * Seeded students may already have seen the tour, so each test clears localStorage first.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const ROLL = (process.env.E2E_EXAM_STUDENT_ROLLS ?? '10A-01').split(',')[0]!.trim();
const PASSWORD = process.env.E2E_EXAM_STUDENT_PASSWORD ?? 'Student@12345';
const SCHOOL_CODE = process.env.E2E_INSTITUTION_CODE;

async function studentLogin(page: Page) {
  await page.goto('/student/login');
  await page.getByLabel('Roll number').fill(ROLL);
  await page.getByLabel('Password').fill(PASSWORD);
  const signIn = page.getByRole('button', { name: 'Sign in' });
  await signIn.click();
  if (SCHOOL_CODE) {
    // The school code field only appears when the roll number exists in more than one school.
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 }).catch(() => undefined);
    const code = page.getByLabel('School code');
    if (await code.isVisible()) {
      await code.fill(SCHOOL_CODE);
      await signIn.click();
    }
  }
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  await expect(page).toHaveURL(/\/student$/);
}

/** Forget that the tour was seen, then load Home again so it auto-starts. */
async function resetTour(page: Page) {
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });
  await page.goto('/student');
}

/** Reads N from "Step 1 of N". */
async function stepCount(tour: Locator): Promise<number> {
  const text = await tour.getByText(/^Step 1 of \d+$/).textContent();
  return Number(/of (\d+)/.exec(text ?? '')?.[1]);
}

test('student tour: first visit, stepping, no repeat after reload, replay from profile', async ({ page }) => {
  await studentLogin(page);
  await resetTour(page);

  const tour = page.getByRole('dialog');
  await expect(page.getByRole('dialog', { name: 'Welcome to ClassIQ' })).toBeVisible();
  await expect(tour).toBeFocused();
  const total = await stepCount(tour);
  // Welcome, Home, Join, Quizzes, Profile, Install, Finish always; Live/Assignments/Exams per school switches.
  expect(total).toBeGreaterThanOrEqual(7);
  await expect(tour.getByRole('button', { name: 'Back' })).toHaveCount(0);

  for (let i = 2; i <= total; i++) {
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour.getByText(`Step ${i} of ${total}`)).toBeVisible();
    if (i === 2) {
      // Home step highlights the dashboard stats (or the Home link while it loads).
      await expect(page.getByRole('dialog', { name: 'Your home page' })).toBeVisible();
      await expect(page.getByTestId('tour-spotlight')).toBeVisible();
    }
  }
  await expect(page.getByRole('dialog', { name: 'You’re all set!' })).toBeVisible();
  await expect(tour.getByRole('button', { name: 'Finish' })).toBeVisible();
  await expect(tour.getByRole('button', { name: 'Next' })).toHaveCount(0);
  await expect(tour.getByRole('button', { name: 'Skip tour' })).toHaveCount(0);

  await tour.getByRole('button', { name: 'Back' }).click();
  await expect(tour.getByText(`Step ${total - 1} of ${total}`)).toBeVisible();

  // Esc skips and remembers it for this user.
  await page.keyboard.press('Escape');
  await expect(tour).toBeHidden();
  const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('cp-tour-student-v1:')));
  expect(keys).toHaveLength(1);

  // Doesn't come back on reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Hi, / })).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Replay from the profile page: arrows move, Skip closes, focus returns to the button.
  await page.goto('/student/profile');
  const replay = page.getByRole('button', { name: 'Take the tour again' });
  await replay.click();
  await expect(page.getByRole('dialog', { name: 'Welcome to ClassIQ' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(tour.getByText(`Step 2 of ${total}`)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(tour.getByText(`Step 1 of ${total}`)).toBeVisible();
  await tour.getByRole('button', { name: 'Skip tour' }).click();
  await expect(tour).toBeHidden();
  await expect(replay).toBeFocused();

  // And all the way through to Finish.
  await replay.click();
  await expect(tour.getByText(`Step 1 of ${total}`)).toBeVisible();
  for (let i = 2; i <= total; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(tour.getByText(`Step ${i} of ${total}`)).toBeVisible();
  }
  await tour.getByRole('button', { name: 'Finish' }).click();
  await expect(tour).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the card fits the screen and nav steps point at the menu button', async ({ page }) => {
    await studentLogin(page);
    await resetTour(page);

    const tour = page.getByRole('dialog');
    await expect(page.getByRole('dialog', { name: 'Welcome to ClassIQ' })).toBeVisible();
    const total = await stepCount(tour);
    const menu = page.getByRole('button', { name: 'Open menu' });

    for (let i = 1; i <= total; i++) {
      await expect(tour.getByText(`Step ${i} of ${total}`)).toBeVisible();
      const box = (await tour.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(844);

      if (await page.getByRole('dialog', { name: 'Quizzes', exact: true }).isVisible()) {
        // The sidebar is collapsed, so the spotlight sits on the ☰ button.
        const button = (await menu.boundingBox())!;
        // The spotlight glides between targets (300 ms); wait until it has settled on the button.
        await expect
          .poll(async () => (await page.getByTestId('tour-spotlight').boundingBox())?.y ?? Infinity)
          .toBeLessThanOrEqual(button.y);
        const spot = (await page.getByTestId('tour-spotlight').boundingBox())!;
        expect(spot.x).toBeLessThanOrEqual(button.x);
        expect(spot.y).toBeLessThanOrEqual(button.y);
        expect(spot.x + spot.width).toBeGreaterThanOrEqual(button.x + button.width);
        expect(spot.y + spot.height).toBeGreaterThanOrEqual(button.y + button.height);
      }

      if (i < total) await tour.getByRole('button', { name: 'Next' }).click();
    }
    await tour.getByRole('button', { name: 'Finish' }).click();
    await expect(tour).toBeHidden();
  });
});
