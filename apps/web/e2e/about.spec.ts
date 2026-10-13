/**
 * Public product page (/about) and the files search engines read. No sign-in and no seed data needed —
 * only a running web app (`npm run dev`, or E2E_BASE_URL for the production stack).
 */
import { expect, test } from '@playwright/test';
import { hi } from '../components/landing/i18n/hi';
import { LOCALE_INFO, TRANSLATION_STATUS } from '../components/landing/i18n/locales';
import { ta } from '../components/landing/i18n/ta';

test.describe('/about', () => {
  test('renders with a single headline', async ({ page }) => {
    const res = await page.goto('/about');
    expect(res?.status()).toBe(200);
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText('Every lecture');
  });

  test('"Book a demo" leads to the request form, which sends the request (or falls back to email)', async ({
    page,
    request,
  }) => {
    await page.goto('/about');
    const demo = page.getByRole('link', { name: /Book a demo/i }).first();
    await expect(demo).toHaveAttribute('href', '#book');

    // An email fallback sits beside the form whatever happens to it.
    const finale = page.locator('#demo');
    await expect(finale.locator('a[href^="mailto:admin@benxsolutions.in"]').first()).toBeAttached();

    const form = page.locator('#book').getByRole('form', { name: 'Book a demo' });
    await form.scrollIntoViewIfNeeded();
    await expect(form).toBeVisible();

    const school = `E2E Demo School ${Date.now()}`;
    await form.getByLabel('Your name').fill('Playwright Tester');
    await form.getByLabel('Phone (WhatsApp)').fill('+91 98765 43210');
    await form.getByLabel('School', { exact: true }).fill(school);
    await form.getByLabel('City', { exact: true }).fill('Hyderabad');
    await form.getByRole('button', { name: /Add details/ }).click();
    await form.getByLabel(/^Email/).fill('playwright.tester@example.com');

    const answer = page.waitForResponse(
      (r) => r.url().endsWith('/api/public/demo-requests') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Request a demo' }).click();
    const res = await answer;

    if (res.status() === 503) {
      // Email isn't configured on this stack (EMAIL_UNAVAILABLE): the form must offer email instead.
      expect((await res.json()).error.code).toBe('EMAIL_UNAVAILABLE');
      const alert = form.getByRole('alert');
      await expect(alert).toContainText(/can’t send requests from here/i);
      await expect(alert.getByRole('link', { name: /admin@benxsolutions\.in/ })).toHaveAttribute(
        'href',
        /^mailto:admin@benxsolutions\.in\?subject=.+&body=.*E2E%20Demo%20School/,
      );
      return;
    }

    expect(res.status(), 'the demo request should be accepted (429 = raise DEMO_REQUEST_RATE_LIMIT locally)').toBe(204);
    await expect(page.locator('#book').getByRole('status')).toContainText('Your request is in');

    // With mail capture on (dev/e2e stacks only), the email went to the BenX inbox, never to the visitor.
    const captured = await request.get('/api/test/emails');
    if (captured.ok()) {
      await expect
        .poll(async () => {
          const mails = (await (await request.get('/api/test/emails')).json()) as { to: string; subject: string }[];
          return mails.find((m) => m.subject.includes(school)) ?? null;
        })
        .toMatchObject({ to: expect.not.stringContaining('playwright.tester') });
    }
  });

  test('the demo form says what is missing', async ({ page }) => {
    await page.goto('/about');
    const form = page.locator('#book').getByRole('form', { name: 'Book a demo' });
    await form.scrollIntoViewIfNeeded();
    await form.getByRole('button', { name: 'Request a demo' }).click();
    const name = form.getByLabel('Your name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    await expect(form.getByText('Enter your name')).toBeVisible();
    await expect(form.getByLabel('Phone (WhatsApp)')).toHaveAttribute('aria-invalid', 'true');
  });

  test('"Sign in" goes to the sign-in chooser, which links back', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('link', { name: /^Sign in/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('a[href="/about"]').first()).toBeVisible();
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the story renders without a 3D canvas', async ({ page }) => {
      await page.goto('/about');
      const story = page.locator('#story');
      await expect(story).toBeVisible();
      // Give a lazily-mounted scene the chance to appear before asserting it didn't.
      await page.waitForTimeout(1500);
      await expect(story.locator('canvas')).toHaveCount(0);
    });
  });

  test('the sample question can be answered', async ({ page }) => {
    await page.goto('/about');
    const tryIt = page.locator('#try');
    await tryIt.scrollIntoViewIfNeeded();

    // A start button may come first; answering straight away is fine too.
    const answer = tryIt.getByRole('button', { name: /Chlorophyll/ });
    if (!(await answer.isVisible())) {
      await tryIt.getByRole('button').first().click();
    }
    await answer.click();

    const status = tryIt.locator('[role="status"], [aria-live="polite"], [aria-live="assertive"]');
    await expect(status.filter({ hasText: /correct|right|well done|nice/i }).first()).toBeVisible();
  });
});

test.describe('search engine files', () => {
  test('robots.txt keeps the signed-in areas out', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^Disallow: \/admin$/m);
    expect(body).toMatch(/^Allow: \/about$/m);
    expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test('sitemap.xml lists /about', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/<loc>https?:\/\/[^<]+\/about<\/loc>/);
  });

  test("draft translations stay out of the sitemap and of /about's hreflang links", async ({ page, request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    await page.goto('/about');
    for (const locale of ['hi', 'ta'] as const) {
      const listed = TRANSLATION_STATUS[locale] === 'reviewed';
      expect(sitemap.includes(`/${locale}/about</loc>`), `${locale} in sitemap`).toBe(listed);
      await expect(page.locator(`link[rel="alternate"][hreflang="${LOCALE_INFO[locale].hreflang}"]`)).toHaveCount(
        listed ? 1 : 0,
      );
    }
  });
});

/*
 * The Hindi and Tamil pages: same page, own language. While a translation is a draft (TRANSLATION_STATUS in
 * components/landing/i18n/locales.ts) it must not be indexed.
 */
for (const copy of [hi, ta]) {
  const { locale } = copy;
  const path = `/${locale}/about`;

  test.describe(path, () => {
    test('renders in its own language with a single headline', async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('[data-theme="landing"]')).toHaveAttribute('lang', locale);
      // Set once the page is running (the root layout is shared with the English app).
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(copy.story.chapters.hero.title);
      await expect(page).toHaveTitle(copy.meta.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`));
    });

    test('is kept out of search while its translation is a draft', async ({ page }) => {
      await page.goto(path);
      const robots = page.locator('meta[name="robots"]');
      if (TRANSLATION_STATUS[locale] === 'draft') {
        await expect(robots).toHaveAttribute('content', /noindex/);
        await expect(page.locator('footer')).toContainText(copy.footer.draftNote);
      } else {
        await expect(robots).toHaveCount(0);
        await expect(page.locator('footer')).not.toContainText(copy.footer.draftNote);
      }
    });

    test('"Book a demo" leads to the request form', async ({ page }) => {
      await page.goto(path);
      const demo = page.getByRole('link', { name: copy.header.bookDemo }).first();
      await expect(demo).toHaveAttribute('href', '#book');
      await page.locator('#story').getByRole('link', { name: copy.header.bookDemo }).click();
      await expect(page).toHaveURL(new RegExp(`${path}#book$`));
      const form = page.locator('#book').getByRole('form', { name: copy.demoForm.title });
      await expect(form).toBeInViewport();
      // Its messages are in the page's language too.
      await form.getByRole('button', { name: copy.demoForm.submit }).click();
      await expect(form.getByLabel(copy.demoForm.fields.name)).toBeFocused();
      await expect(form.getByText(copy.demoForm.errors!.required.name)).toBeVisible();
    });

    test('the header switches between languages', async ({ page }) => {
      await page.goto(path);
      const switcher = page.getByRole('navigation', { name: copy.header.languageNavLabel }).first();
      await expect(switcher.getByRole('link', { name: LOCALE_INFO[locale].nativeName })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute('hreflang', 'en-IN');
      await switcher.getByRole('link', { name: 'English' }).click();
      await expect(page).toHaveURL(/\/about$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      const other = locale === 'hi' ? 'ta' : 'hi';
      await page.getByRole('navigation', { name: 'Language' }).first().getByRole('link', { name: LOCALE_INFO[other].nativeName }).click();
      await expect(page).toHaveURL(new RegExp(`/${other}/about$`));
      await expect(page.locator('html')).toHaveAttribute('lang', other);
    });
  });
}
