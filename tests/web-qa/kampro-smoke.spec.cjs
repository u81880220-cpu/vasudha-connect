const { test, expect } = require('@playwright/test');

const baseURL = process.env.KAMPRO_BASE_URL || 'https://vasudha-connect-mobile.vercel.app';
const routes = [
  { path: '/', label: 'app entry' },
  { path: '/onboarding', label: 'onboarding' },
  { path: '/home', label: 'customer home' },
  { path: '/admin', label: 'admin console' },
];

for (const route of routes) {
  test(`web smoke: ${route.label} (${route.path})`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
    expect(response, 'route should return a document response').not.toBeNull();
    expect(response.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

    await expect(page.locator('#root')).toBeVisible();
    await page.waitForTimeout(2500); // allow Expo Router and the initial splash/redirect to settle
    const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
    const rootChildren = await page.locator('#root').locator('>*').count();
    expect(rootText.length > 0 || rootChildren > 0, `${route.path} should not render a blank root`).toBeTruthy();
    expect(pageErrors, `uncaught JavaScript errors on ${route.path}`).toEqual([]);
  });
}

test('responsive customer home has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${baseURL}/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page, 'document should not overflow horizontally on a small mobile viewport').toBeLessThanOrEqual(dimensions.viewport + 2);
});
