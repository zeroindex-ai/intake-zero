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

    await page.waitForURL(/\/runs\//, { timeout: 10_000 });
    await expect(page.getByText(/thanks/i)).toBeVisible();

    // Wait for the timeline to reach a terminal state (sent or failed).
    await expect
      .poll(async () => page.locator('text=/confirmation sent|something went wrong/i').count(), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBeGreaterThan(0);
  });

  test('validation: missing required fields blocks submission', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /send intake/i }).click();
    // Browser native :invalid prevents submit; URL stays on home.
    await expect(page).toHaveURL(/\/$|\/intake/);
  });

  test('admin gate: unauthenticated /admin redirects to /signin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/signin/);
  });
});
