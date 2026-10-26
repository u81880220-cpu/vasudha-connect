const { test, expect } = require('@playwright/test');

const baseURL = (process.env.KAMPRO_BASE_URL || 'https://vasudha-connect-mobile.vercel.app').replace(/\/$/, '');
const routes = [
  { path: '/', label: 'app entry' },
  { path: '/onboarding', label: 'onboarding' },
  { path: '/home', label: 'customer home' },
  { path: '/admin', label: 'admin console' },
];

async function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

for (const route of routes) {
  test(`web smoke: ${route.label} (${route.path})`, async ({ page }) => {
    const runtimeErrors = await collectRuntimeErrors(page);
    const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
    expect(response, 'route should return a document response').not.toBeNull();
    expect(response.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

    await expect(page.locator('#root')).toBeVisible();
    await page.waitForTimeout(2500); // allow Expo Router and initial redirects to settle
    const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
    expect(rootText.length, `${route.path} should render visible text, not a blank app shell`).toBeGreaterThan(0);
    expect(runtimeErrors, `uncaught browser errors on ${route.path}`).toEqual([]);
  });
}

test('responsive customer home has no horizontal overflow', async ({ page }) => {
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.setViewportSize({ width: 360, height: 800 });
  const response = await page.goto(`${baseURL}/home`, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForTimeout(2500);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page, 'document should not overflow horizontally on a small mobile viewport').toBeLessThanOrEqual(dimensions.viewport + 2);
  expect(runtimeErrors).toEqual([]);
});

test('primary app routes remain reachable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
    expect(response, `${route.path} should respond`).not.toBeNull();
    expect(response.status(), `${route.path} should not return an HTTP error`).toBeLessThan(400);
    await expect(page.locator('#root')).toBeVisible();
  }
});
