// examples/ui/login.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Minimal, production-friendly login flow using data-testid selectors.
 * Configure creds via env vars in CI (preferred) or your local .env:
 *   E2E_USER, E2E_PASS
 *
 * Tags: @ui @risk:high — treat auth as P0 in your gating.
 *
 * Example CI grep:
 *   npx playwright test --grep "@ui"
 *   npx playwright test --grep "@risk:high"
 */
const USER = process.env.E2E_USER || 'someone@example.com';
const PASS = process.env.E2E_PASS || 'changeme';

test.describe('Login flow', () => {
  test('User can log in and reach dashboard @ui @risk:high', async ({ page }) => {
    // If baseURL is set in playwright.config.ts, this can be relative:
    await page.goto('/login');

    // Stable selectors: prefer data-testid over brittle CSS or text
    await page.getByTestId('email-input').fill(USER);
    await page.getByTestId('password-input').fill(PASS);

    // Optional: visible password toggle, remember me, etc. left out intentionally
    await page.getByTestId('login-submit').click();

    // Post-login assertion: URL + key UI affordance
    await expect(page).toHaveURL(/\/dashboard/i, { timeout: 15_000 });
    await expect(page.getByTestId('dashboard-welcome')).toBeVisible();

    // Sanity: user menu shows an authenticated state (non-blocking)
    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible().catch(() => false)) {
      await expect(userMenu).toContainText(/(account|profile|sign out)/i);
    }
  });

  test('Rejects invalid credentials with a clear error @ui @risk:medium', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email-input').fill('invalid@example.com');
    await page.getByTestId('password-input').fill('wrong-password');
    await page.getByTestId('login-submit').click();

    // Clear, accessible error message
    const error = page.getByTestId('auth-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/invalid (email|credentials|password)/i);
    // Remains on login page
    await expect(page).toHaveURL(/\/login/i);
  });
});
