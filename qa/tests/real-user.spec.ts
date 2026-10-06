import { test, expect, Page, devices } from "@playwright/test";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const CUSTOMER_EMAIL = process.env.QA_CUSTOMER_EMAIL || "demo.customer1@vasudha.test";
const CUSTOMER_PASSWORD = process.env.QA_CUSTOMER_PASSWORD || "Demo@12345";
const PROFESSIONAL_EMAIL = process.env.QA_PROFESSIONAL_EMAIL || "demo.pro1@vasudha.test";
const PROFESSIONAL_PASSWORD = process.env.QA_PROFESSIONAL_PASSWORD || "Demo@12345";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for real-user QA.");
}

async function login(page: Page, mode: "customer" | "professional", email: string, password: string) {
  await page.goto(`/auth?mode=${mode}`);
  await expect(page.getByText("Welcome Back")).toBeVisible();
  await page.getByText("Email", { exact: true }).click();
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByText("Sign in with Email", { exact: true }).click();
  await page.waitForURL(/\/(home|basic-profile|professional-onboarding)/, { timeout: 20_000 });
}

const QA_SERVICE_CATEGORIES: Record<string, string> = {
  "AC Technician": "Property Services",
  "Carpenter": "Property Services",
};

async function chooseService(page: Page, serviceName: string) {
  const categoryName = QA_SERVICE_CATEGORIES[serviceName];
  if (!categoryName) throw new Error(`Unknown QA service: ${serviceName}`);
  const categories = page.getByText(categoryName, { exact: true });
  await expect.poll(async () => {
    const count = await categories.count();
    for (let i = 0; i < count; i += 1) {
      if (await categories.nth(i).isVisible()) return true;
    }
    return false;
  }, { timeout: 10_000 }).toBe(true);

  const categoryCount = await categories.count();
  for (let i = 0; i < categoryCount; i += 1) {
    const candidate = categories.nth(i);
    if (await candidate.isVisible()) {
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ force: true });
      break;
    }
  }

  const services = page.getByText(serviceName, { exact: true });
  await expect.poll(async () => {
    const count = await services.count();
    for (let i = 0; i < count; i += 1) {
      if (await services.nth(i).isVisible()) return true;
    }
    return false;
  }, { timeout: 10_000 }).toBe(true);

  const count = await services.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = services.nth(i);
    if (await candidate.isVisible()) {
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ force: true });
      return;
    }
  }
  throw new Error(`Service ${serviceName} was rendered but no visible option was clickable`);
}

test.describe.configure({ mode: "serial" });

test.describe("VASUDHA real-user free QA", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", async dialog => {
      await dialog.accept();
    });
  });

  test("Customer A: discover → unlock free connection → chat → request job", async ({ page }) => {
    await login(page, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await expect(page.getByText("Find trusted professionals")).toBeVisible();
    await page.screenshot({ path: "test-results/customer-home.png", fullPage: true });

    await page.getByRole("button", { name: "Search for services" }).click();
    await expect(page.getByText("Find Skills Around You").first()).toBeVisible();
    await expect(page.getByText("Nearby professionals", { exact: true })).toBeVisible();

    await chooseService(page, "AC Technician");
    await expect(page.getByText("Demo AC Professional")).toBeVisible();

    await page.getByText("Demo AC Professional", { exact: true }).click();
    await expect(page.getByText("Unlock this professional")).toBeVisible();

    const unlock = page.getByText(/^(Use 1 connection|Get connections)$/).last();
    await expect(unlock).toBeVisible({ timeout: 15_000 });
    await unlock.click();
    await expect(page.getByText("Contact unlocked")).toBeVisible();
    await expect(page.getByText("+919000000003")).toBeVisible();
    await page.screenshot({ path: "test-results/customer-unlocked.png", fullPage: true });

    await page.getByText("Message", { exact: true }).click();
    await expect(page).toHaveURL(/\/chat\?/, { timeout: 15_000 });
    await expect(page.getByPlaceholder("Write a message...")).toBeVisible({ timeout: 15_000 });

    const composer = page.getByPlaceholder("Write a message...");
    await composer.click();
    await composer.fill("Hello, I need AC service.");
    await expect(page.getByText("Send", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByText("Send", { exact: true }).click();
    await expect(page.getByText("Hello, I need AC service.", { exact: true })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Request Job", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByText("Request Job", { exact: true }).click();
    await expect(page.getByText("Create Job Request")).toBeVisible();
    await chooseService(page, "AC Technician");
    await page.getByPlaceholder("e.g. Fix kitchen plumbing").fill("AC service at home");
    await page.getByPlaceholder("Describe the work required...").fill("AC is not cooling. Please inspect and repair.");
    await page.getByPlaceholder("Enter the property/service address").fill("Varanasi, Uttar Pradesh");
    await page.getByText("Send Job Request", { exact: true }).click();

    await expect(page.getByText("Hello, I need AC service.")).toBeVisible({ timeout: 20_000 });

    // Validate authenticated-session exit from the authenticated home screen.
    await page.goto("/home");
    const signOutButton = page.getByRole("button", { name: "Sign out", exact: true });
    await expect(signOutButton).toBeVisible({ timeout: 10_000 });
    await signOutButton.click({ force: true });
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Welcome Back")).toBeVisible();
  });

  test("Professional A: subscription is free in QA and job request is actionable", async ({ page }) => {
    await login(page, "professional", PROFESSIONAL_EMAIL, PROFESSIONAL_PASSWORD);

    await expect(page.getByText("Grow your business.")).toBeVisible();
    await page.screenshot({ path: "test-results/professional-home.png", fullPage: true });

    await page.goto("/professional-dashboard");
    await expect(page.getByText("Professional Dashboard")).toBeVisible();

    await page.getByText("Manage Professional Subscription", { exact: true }).click();
    await expect(page.getByText("TEST MODE · FREE SUBSCRIPTION")).toBeVisible();
    await expect(page.getByText("Activate Free QA Subscription", { exact: true })).toBeVisible();

    await page.getByText("Activate Free QA Subscription", { exact: true }).click();
    await expect(page.getByText("Subscription active")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "test-results/professional-subscription-free.png", fullPage: true });

    await page.goto("/professional-dashboard");
    await expect(page.getByText("Professional Dashboard")).toBeVisible();
    await expect(page.getByText("Job requests", { exact: true })).toBeVisible();
    await expect(page.getByText("AC service at home")).toBeVisible({ timeout: 20_000 });

    await page.getByText("Accept Job", { exact: true }).click();
    await page.waitForURL(/\/job-tracking\?jobId=/);
    await expect(page.getByText("Professional accepted")).toBeVisible();
    await expect(page.getByText("Service location")).toBeVisible();
    await expect(page.getByText(/Customer:/)).toBeVisible();
    await page.screenshot({ path: "test-results/professional-job-accepted.png", fullPage: true });

    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();

    for (const label of ["Mark On the way", "Mark Arrived", "Mark Work started", "Mark Work completed"]) {
      const action = page.getByText(label, { exact: true });
      const actionCount = await action.count();
      for (let i = 0; i < actionCount; i += 1) {
        const candidate = action.nth(i);
        if (await candidate.isVisible()) {
          await candidate.click({ force: true });
          break;
        }
      }
      const statusText = page.getByText(label.replace("Mark ", ""), { exact: true });
      await expect(statusText.first()).toBeVisible({ timeout: 15_000 });
    }

    // Complete the customer side of the same real job: confirm completion and reach review.
    const customerContext = await page.context().browser()!.newContext({ ...devices["Pixel 7"] });
    const customerPage = await customerContext.newPage();
    try {
      await login(customerPage, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await customerPage.goto("/jobs");
      await expect(customerPage.getByText("My Jobs")).toBeVisible();
      await expect(customerPage.getByText("AC service at home")).toBeVisible({ timeout: 20_000 });
      await customerPage.getByText("Confirm work completed", { exact: true }).click();
      await expect(customerPage.getByText("Customer confirmed", { exact: true })).toBeVisible({ timeout: 15_000 });
      await customerPage.getByText("Rate Professional", { exact: true }).click();
      await expect(customerPage.getByText("Rate Your Experience")).toBeVisible();
      await expect(customerPage.getByText("Submit Review", { exact: true })).toBeVisible();
      await customerPage.screenshot({ path: "test-results/customer-review.png", fullPage: true });
    } finally {
      await customerContext.close();
    }

    // Professional-side post-completion review screen must also be reachable.
    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();
    await expect(page.getByText("Rate Customer", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText("Rate Customer", { exact: true }).click();
    await expect(page.getByText("Rate Your Customer")).toBeVisible();
    await expect(page.getByText("Submit Customer Review", { exact: true })).toBeVisible();
  });


  test("Admin: authorized console opens and operational tabs render", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("VASUDHA CONNECT ADMIN")).toBeVisible();
    await page.getByPlaceholder("Admin email").fill("demo.admin@vasudha.test");
    await page.getByPlaceholder("Password").fill("Demo@12345");
    await page.getByText("Sign in", { exact: true }).click();
    await expect(page.getByText("VASUDHA CONNECT ADMIN")).toBeVisible();
    await expect(page.getByText("Dashboard", { exact: true })).toBeVisible({ timeout: 20_000 });
    for (const tab of ["Dashboard", "Professionals", "Verification", "Customers", "Service Catalogue", "Jobs", "Payments", "Notifications", "Complaints", "Portfolio", "Audit Logs"]) {
      await page.getByText(tab, { exact: true }).click();
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/admin-console.png", fullPage: true });

    // Admin security: a bad password must not expose the operational console.
    await page.goto("/admin");
    await page.getByPlaceholder("Admin email").fill("demo.admin@vasudha.test");
    await page.getByPlaceholder("Password").fill("WrongPassword@123");
    await page.getByText("Sign in", { exact: true }).click();
    await expect(page.getByText("Admin control centre")).toBeVisible();
    await expect(page.getByText("Dashboard", { exact: true })).not.toBeVisible();
  });

  test("Customer B and Professional B: account isolation and independent login", async ({ browser }) => {
    const customerB = await browser.newContext({ ...devices["Pixel 7"] });
    const professionalB = await browser.newContext({ ...devices["Pixel 7"] });
    const cp = await customerB.newPage();
    const pp = await professionalB.newPage();

    try {
      await login(cp, "customer", "demo.customer2@vasudha.test", "Demo@12345");
      await expect(cp.getByText("Find trusted professionals")).toBeVisible();

      await login(pp, "professional", "demo.pro2@vasudha.test", "Demo@12345");
      await expect(pp.getByText("Grow your business.")).toBeVisible();

      await cp.goto("/connections");
      await expect(cp.getByText("My Connections")).toBeVisible();
      await expect(cp.getByText("No active connections")).toBeVisible();

      await pp.goto("/professional-subscription");
      await expect(pp.getByText("TEST MODE · FREE SUBSCRIPTION")).toBeVisible();
      await expect(pp.getByText("Activate Free QA Subscription", { exact: true })).toBeVisible();
    } finally {
      await customerB.close();
      await professionalB.close();
    }

});
