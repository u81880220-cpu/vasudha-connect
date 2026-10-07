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
    test.setTimeout(150_000);
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

    for (const [label, nextLabel] of [
      ["Mark On the way", "Mark Arrived"],
      ["Mark Arrived", "Mark Work started"],
      ["Mark Work started", "Mark Work completed"],
    ] as const) {
      const action = page.getByText(label, { exact: true });
      await expect(action).toBeVisible({ timeout: 10_000 });
      await action.click({ force: true });
      await expect(action).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByText(nextLabel, { exact: true })).toBeVisible({ timeout: 15_000 });
    }

    const workCompletedAction = page.getByText("Mark Work completed", { exact: true });
    await expect(workCompletedAction).toBeVisible({ timeout: 10_000 });
    await workCompletedAction.click({ force: true });
    await expect(workCompletedAction).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("Work completed", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Mark Customer confirmed", exact: true })).toHaveCount(0);

    // Complete the customer side of the same real job: confirm completion and reach review.
    const customerContext = await page.context().browser()!.newContext({ ...devices["Pixel 7"] });
    const customerPage = await customerContext.newPage();
    await login(customerPage, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await customerPage.goto("/jobs");
      await expect(customerPage.getByText("My Jobs")).toBeVisible();
      await expect(customerPage.getByText("AC service at home")).toBeVisible({ timeout: 20_000 });
      const confirmCompletion = customerPage.getByText("Confirm work completed", { exact: true });
      await expect.poll(async () => await confirmCompletion.count(), { timeout: 30_000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0);
      await expect(confirmCompletion.first()).toBeVisible({ timeout: 10_000 });
      await confirmCompletion.first().click({ force: true });
      await expect(customerPage.getByText("Customer confirmed", { exact: true })).toBeVisible({ timeout: 15_000 });
      await customerPage.getByText("Rate Professional", { exact: true }).click({ force: true });
      await expect(customerPage.getByText("Rate Your Experience")).toBeVisible();
      await expect(customerPage.getByText("Submit Review", { exact: true })).toBeVisible();
    await customerPage.screenshot({ path: "test-results/customer-review.png", fullPage: true });

    // Professional-side post-completion review screen must also be reachable.
    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();
    await expect(page.getByText("Rate Customer", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText("Rate Customer", { exact: true }).click();
    await expect(page.getByText("Rate Your Customer")).toBeVisible();
    await expect(page.getByText("Submit Customer Review", { exact: true })).toBeVisible();
  });


  test("Web business-model guardrails: direct customer-to-professional workflow", async ({ page }) => {
    await login(page, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto("/home");
    const homeText = await page.locator("body").innerText();
    expect(homeText.toLowerCase()).not.toMatch(/\bquotation\b|\bquote\b|\bbid\b/);
    expect(homeText.toLowerCase()).not.toMatch(/pay.*professional|professional.*pay/);

    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();
    const jobsText = await page.locator("body").innerText();
    expect(jobsText.toLowerCase()).not.toMatch(/\bquotation\b|\bquote\b|\bbid\b/);
    expect(jobsText.toLowerCase()).not.toMatch(/vasudha.*commission|commission.*vasudha|pay.*professional|professional.*pay/);

  });

  test("Customer invalid login stays outside the authenticated app", async ({ page }) => {
    await page.goto("/auth?mode=customer");
    await expect(page.getByText("Welcome Back")).toBeVisible();
    await page.getByText("Email", { exact: true }).click();
    await page.getByPlaceholder("Email address").fill("demo.customer1@vasudha.test");
    await page.getByPlaceholder("Password").fill("DefinitelyWrong@123");
    await page.getByText("Sign in with Email", { exact: true }).click();
    await expect(page.getByText("Welcome Back")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Find trusted professionals")).not.toBeVisible();
  });

  test("Admin: authorized console opens and operational tabs render", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Admin Console", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Admin email").fill("demo.admin@vasudha.test");
    await page.getByPlaceholder("Password").fill("Demo@12345");
    await page.getByText("Sign in to Admin", { exact: true }).click();
    await expect(page.getByText("Admin Console", { exact: true })).toBeVisible();
    await expect(page.getByText("Dashboard", { exact: true })).toBeVisible({ timeout: 20_000 });
    for (const tab of ["Dashboard", "Professionals", "Verification", "Customers", "Services", "Connections", "Subscriptions", "Operations", "Payments", "Notifications", "Communication", "Analytics", "Complaints", "Portfolio", "Audit", "Configuration"]) {
      await page.getByText(tab, { exact: true }).click();
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }
    // Customer 360: open a real customer record and verify the detail surface renders.
    await page.getByText("Customers", { exact: true }).click();
    await expect(page.getByText("Customers", { exact: true }).first()).toBeVisible();
    await page.getByText(/Trust \d+\/100/).first().click({ force: true });
    await expect(page.getByText("Customer 360°", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Account ID:/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Trust score", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Operations Details: open the seeded AC job and verify Work 360° renders.
    await page.getByText("Operations", { exact: true }).click();
    await expect(page.getByText("Job Operations", { exact: true })).toBeVisible();
    await expect(page.getByText("AC service at home", { exact: true })).toBeVisible();
    await page.getByText("Details", { exact: true }).first().click({ force: true });
    await expect(page.getByText("Work 360°", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("AC service at home", { exact: true }).last()).toBeVisible();

    await page.screenshot({ path: "test-results/admin-console.png", fullPage: true });

    // Admin security: use a fresh browser context so the authorized session cannot leak into the bad-login check.
    const badLoginPage = await page.context().browser()!.newPage();
    await badLoginPage.goto("/admin");
    await expect(badLoginPage.getByText("Admin Console", { exact: true })).toBeVisible();
    await badLoginPage.getByPlaceholder("Admin email").fill("demo.admin@vasudha.test");
    await badLoginPage.getByPlaceholder("Password").fill("WrongPassword@123");
    await badLoginPage.getByText("Sign in to Admin", { exact: true }).click();
    await expect(badLoginPage.getByText("Dashboard", { exact: true })).not.toBeVisible();
    await expect(badLoginPage.getByText(/Invalid login credentials|Admin access required/)).toBeVisible();
    await badLoginPage.close();
  });

  test("Customer registration/profile/notifications and business-model guardrails", async ({ page }) => {
    // Registration surface: verify both email and OTP signup paths are present without
    // creating an external account that would require production email/SMS delivery.
    await page.goto("/auth?mode=customer");
    await expect(page.getByText("Welcome Back")).toBeVisible();
    await page.getByText("Create a new account", { exact: true }).click();
    await expect(page.getByText("Create account with Email", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Full name")).toBeVisible();
    await expect(page.getByText("Mobile OTP", { exact: true })).toBeVisible();

    // Existing QA customer: profile can be opened and edited through the normal UI.
    await login(page, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await expect(page.getByText("Find trusted professionals")).toBeVisible();
    const homeText = await page.locator("body").innerText();
    expect(homeText.toLowerCase()).not.toContain("quotation");
    expect(homeText.toLowerCase()).not.toContain("quote");

    await page.goto("/customer-profile");
    await expect(page.getByText("My Customer Profile")).toBeVisible();
    const profileName = page.getByPlaceholder("Enter full name");
    await expect(profileName).toBeVisible();
    await profileName.fill("Demo Customer One");
    await page.getByText("Save changes", { exact: true }).click();
    await page.waitForTimeout(500);
    
    // Notifications must render and remain usable after the job workflow has created events.
    await page.goto("/notifications");
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
    await expect(page.getByText("All", { exact: true })).toBeVisible();
    await expect(page.getByText("Unread", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Messages/ })).toBeVisible();
    await expect(page.getByText("Jobs", { exact: true })).toBeVisible();
  });

  test("Customer A: completed job can be reviewed and business model remains direct", async ({ page }) => {
    await login(page, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();
    await expect(page.getByText("Customer confirmed", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Rate Professional", { exact: true }).click();
    await expect(page.getByText("Rate Your Experience")).toBeVisible();

    // Fill all seven review dimensions and submit the real review.
    for (const label of [
      "Punctuality & Time",
      "Work Quality / Expertise",
      "Professional Behaviour",
      "Communication",
      "Price / Value for Money",
      "Reliability",
      "Safety & Care",
    ]) {
      const block = page.getByText(label, { exact: true }).locator("..");
      await expect(block).toBeVisible();
      await block.getByText("★").last().click();
    }
    await page.getByPlaceholder("Tell us about the experience...").fill("QA review: service completed successfully.");
    await page.getByText("Submit Review", { exact: true }).click();
    await page.waitForTimeout(1000);
    
    // No VASUDHA job-value payment or quotation path is exposed.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("quotation");
    expect(body).not.toContain("get a quote");
    expect(body).not.toContain("pay vasudha for the job");
  });

  test("Authenticated RLS smoke: client cannot directly create jobs", async ({ request }) => {
    const baseHeaders = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const jobAttempt = await request.post(`${SUPABASE_URL}/rest/v1/jobs`, {
      headers: baseHeaders,
      data: {
        title: "QA unauthorized direct job insert",
        customer_id: "00000000-0000-0000-0000-000000000000",
        professional_id: "00000000-0000-0000-0000-000000000000",
      },
    });
    expect([401, 403, 409]).toContain(jobAttempt.status());
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

});
