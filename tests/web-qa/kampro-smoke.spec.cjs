const { test, expect } = require('@playwright/test');

const baseURL = (process.env.KAMPRO_BASE_URL || 'https://vasudha-connect-mobile.vercel.app').replace(/\/$/, '');
const routes = [
  { path: '/', label: 'app entry' },
  { path: '/onboarding', label: 'onboarding' },
  { path: '/auth', label: 'authentication' },
  { path: '/select-mode', label: 'mode selection' },
  { path: '/basic-profile', label: 'basic profile' },
  { path: '/home', label: 'customer home' },
  { path: '/marketplace', label: 'marketplace' },
  { path: '/service-request', label: 'service request' },
  { path: '/jobs', label: 'jobs list' },
  { path: '/job-details', label: 'job details' },
  { path: '/job-tracking', label: 'job tracking' },
  { path: '/connections', label: 'connections' },
  { path: '/connection-packages', label: 'connection packages' },
  { path: '/chat', label: 'chat' },
  { path: '/notifications', label: 'notifications' },
  { path: '/customer-dashboard', label: 'customer dashboard' },
  { path: '/customer-profile', label: 'customer profile' },
  { path: '/customer-review', label: 'customer review' },
  { path: '/professional-onboarding', label: 'professional onboarding' },
  { path: '/professional-dashboard', label: 'professional dashboard' },
  { path: '/professional-profile', label: 'professional profile' },
  { path: '/professional-public', label: 'public professional profile' },
  { path: '/professional-verification', label: 'professional verification' },
  { path: '/professional-subscription', label: 'professional subscription' },
  { path: '/earnings', label: 'earnings' },
  { path: '/complaints', label: 'complaints' },
  { path: '/complaint', label: 'complaint form' },
  { path: '/review', label: 'review' },
  { path: '/profile', label: 'profile' },
  { path: '/admin', label: 'admin console' },
  { path: '/privacy-policy', label: 'privacy policy' },
  { path: '/terms', label: 'terms' },
  { path: '/delete-account', label: 'delete account' },
];

function attachRuntimeChecks(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

for (const route of routes) {
  test(`route smoke: ${route.label} (${route.path})`, async ({ page }) => {
    const runtimeErrors = attachRuntimeChecks(page);
    const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
    expect(response, 'route should return a document response').not.toBeNull();
    expect(response.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

    await expect(page.locator('#root')).toBeVisible();
    await page.waitForTimeout(1200);
    const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
    expect(rootText.length, `${route.path} should render a non-empty app view (or auth redirect)`).toBeGreaterThan(0);
    expect(runtimeErrors, `uncaught JavaScript errors on ${route.path}`).toEqual([]);
  });
}

test('responsive customer home has no horizontal overflow', async ({ page }) => {
  const runtimeErrors = attachRuntimeChecks(page);
  await page.setViewportSize({ width: 360, height: 800 });
  const response = await page.goto(`${baseURL}/home`, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForTimeout(1800);
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
