/**
 * AI teaching tools, end to end: a teacher imports an NCERT course from the catalog, generates a
 * lesson plan and a presentation grounded in one chapter, downloads them, shares the plan with the
 * school, and opens a simulation in classroom mode.
 *
 * Requires the dev stack (`npm run dev`, seeded DB) with an OpenAI key, or PIPELINE_DEMO_FALLBACK=true
 * without keys (the generators then return labelled demo content).
 */
import { expect, test, type Page } from '@playwright/test';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const TEACHER_EMAIL = process.env.E2E_EXAM_TEACHER_EMAIL ?? 'anita@demo.school';
const TEACHER_PASSWORD = process.env.E2E_EXAM_TEACHER_PASSWORD ?? 'Teacher@12345';
const COURSE = 'Class 10 Science (NCERT)';

async function teacherLogin(page: Page) {
  await page.goto('/teacher/login');
  await expect(page.getByRole('heading', { name: 'Teacher sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(TEACHER_EMAIL);
  await page.getByLabel('Password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

async function generate(page: Page, type: 'Lesson plan' | 'Presentation', title: string) {
  await page.goto('/teacher/resources/new');
  await page.getByRole('radiogroup', { name: 'Resource type' }).getByRole('radio', { name: new RegExp(`^${type}`) }).click();
  await page.getByLabel('Describe what you want').fill('Introduce the chapter with one everyday example and a quick class activity.');
  await page.getByLabel('Title (optional)').fill(title);
  const course = page.getByLabel('Course');
  // Options read "<title> · <level>"; earlier runs may have imported the same course, any copy will do.
  const courseId = await course.locator('option', { hasText: COURSE }).first().getAttribute('value');
  await course.selectOption(courseId!);
  await page.getByRole('group', { name: 'Units / chapters' }).getByRole('checkbox').first().check();
  await page.getByRole('button', { name: `Generate ${type.toLowerCase()}` }).click();
  await page.waitForURL(/\/teacher\/resources\/[0-9a-f-]{36}$/);
  // Generation runs on the queue; the page polls until the resource is ready.
  await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible({ timeout: 4 * 60_000 });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test.describe.serial('teacher tools', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();
    await teacherLogin(page);
  });

  test('import an NCERT course from the catalog', async () => {
    await page.goto('/teacher/courses');
    await page.getByRole('button', { name: 'Import from catalog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import from catalog' });
    await dialog.getByRole('button', { name: `Import ${COURSE}` }).click();
    await page.waitForURL(/\/teacher\/courses\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: COURSE })).toBeVisible();
    await expect(page.getByText('Chemical Reactions and Equations').first()).toBeVisible();
  });

  test('generate a lesson plan, download it and share it with the school', async () => {
    const title = `Reactions plan ${RUN}`;
    await generate(page, 'Lesson plan', title);
    await expect(page.getByLabel('Overview')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download Word' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.docx$/);

    await page.getByRole('button', { name: 'Share with school' }).click();
    await expect(page.getByRole('button', { name: 'Unshare' })).toBeVisible();

    await page.goto('/teacher/resources');
    await page.getByRole('tab', { name: 'School library' }).click();
    await expect(page.getByText(title)).toBeVisible();
  });

  test('generate a presentation and download PowerPoint', async () => {
    const title = `Reactions deck ${RUN}`;
    await generate(page, 'Presentation', title);
    await expect(page.getByRole('region', { name: 'Slides' })).toBeVisible();
    await expect(page.getByText(/^Slide 1 of \d+$/)).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download PowerPoint' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pptx$/);
  });

  test('open a simulation in classroom mode', async () => {
    await page.goto('/teacher/simulations');
    await page.getByLabel('Search simulations').fill('ohm');
    const open = page.getByRole('button', { name: /^Open in class: / }).first();
    await expect(open).toBeVisible();
    await open.click();
    const player = page.getByRole('dialog', { name: /\(in class\)$/ });
    await expect(player).toBeVisible();
    await expect(player.locator('iframe')).toHaveAttribute('src', /phet\.colorado\.edu/);
    await player.getByRole('button', { name: 'Exit' }).click();
    await expect(player).toBeHidden();
  });
});
