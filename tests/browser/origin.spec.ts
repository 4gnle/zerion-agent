import { test, expect } from '@playwright/test';
for (const host of ['127.0.0.1', 'localhost']) {
  test(`real endpoint accepts same-origin ${host}`, async ({ page }) => {
    await page.goto(`http://${host}:3000`);
    // Invalid schema deliberately stops before any model call or API billing.
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return { status: response.status, code: (await response.json()).code };
    });
    expect(result).toEqual({ status: 400, code: 'BODY' });
  });
}
