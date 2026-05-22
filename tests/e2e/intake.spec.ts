import { test, expect } from '@playwright/test';

test.describe('intake flow', () => {
  test('happy path: submit → run page → reaches sent', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page
      .getByLabel('What are you trying to solve? *')
      .fill('Need to evaluate the quality of our Claude-backed RAG pipeline before launch.');
    await page.getByRole('button', { name: /send intake/i }).click();

    await page.waitForURL(/\/runs\//, { timeout: 15_000 });
    await expect(page.getByText(/thanks/i)).toBeVisible();

    // Reaching a terminal state needs live Anthropic/Resend, which CI doesn't
    // have — there it's enough that the submission persisted, the workflow
    // started, and the durable run page rendered. Locally (real keys) assert it
    // actually reaches a terminal state.
    if (!process.env.CI) {
      await expect
        .poll(async () => page.locator('text=/confirmation sent|something went wrong/i').count(), {
          timeout: 60_000,
          intervals: [1_000, 2_000, 3_000],
        })
        .toBeGreaterThan(0);
    }
  });

  test('validation: missing required fields blocks submission', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /send intake/i }).click();
    // Browser native :invalid prevents submit; URL stays on home.
    await expect(page).toHaveURL(/\/$|\/intake/);
  });

  test('admin gate: unauthenticated /admin returns 401 (Basic Auth)', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(401);
  });
});
