// examples/api/healthcheck.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Runs against your configured baseURL (playwright.config.ts -> use.baseURL).
 * Tags: @api and @risk:low so you can do:
 *   npx playwright test --grep "@api"
 *   npx playwright test --grep "@risk:low"
 */
test.describe('API Healthcheck', () => {
  test('GET /health returns 200 and healthy status @api @risk:low', async ({ request, config }) => {
    // Hit the canonical health endpoint at the API baseURL.
    // If you separate app vs API base URLs, you can also do:
    // const api = await request.newContext({ baseURL: process.env.API_BASE_URL });
    const res = await request.get('/health');

    // Basic availability
    expect(res.ok()).toBeTruthy();

    // Optional: lightweight schema/shape checks (keeps it framework-agnostic)
    const body = await res.json().catch(() => ({} as any));
    // Common shapes: { status: "ok" } or { healthy: true } or { status: "pass" }
    const normalized =
      typeof body === 'object' && body
        ? {
            status: String(body.status ?? (body.healthy === true ? 'ok' : undefined) ?? body.outcome ?? '').toLowerCase(),
          }
        : { status: '' };

    expect(['ok', 'pass', 'healthy']).toContain(normalized.status);

    // Useful trace in CI if things go sideways
    test.info().attach('health-response.json', {
      body: JSON.stringify(body, null, 2),
      contentType: 'application/json',
    });
  });
});
