import { test, expect, Page, devices } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const CUSTOMER_EMAIL = process.env.QA_CUSTOMER_EMAIL || "demo.customer1@vasudha.test";
const CUSTOMER_PASSWORD = process.env.QA_CUSTOMER_PASSWORD || "Demo@12345";
const PROFESSIONAL_EMAIL = process.env.QA_PROFESSIONAL_EMAIL || "demo.pro1@vasudha.test";
const PROFESSIONAL_PASSWORD = process.env.QA_PROFESSIONAL_PASSWORD || "Demo@12345";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for real-user QA.");
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function login(page: Page, mode: "customer" | "professional", email: string, password: string) {
  await page.goto(`/auth?mode=${mode}`);
  await expect(page.getByText("Welcome Back")).toBeVisible();
  await page.getByText("Email", { exact: true }).click();
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByText("Sign in with Email", { exact: true }).click();
  await page.waitForURL(/\/(home|basic-profile|professional-onboarding)/, { timeout: 20_000 });
}

async function serviceInfo(serviceName: string) {
  const { data, error } = await db
    .from("service_catalogue_services")
    .select("id,name,category_id")
    .eq("name", serviceName)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error(`Service not found: ${serviceName}`);
  const { data: category, error: categoryError } = await db
    .from("service_categories")
    .select("id,name")
    .eq("id", data.category_id)
    .maybeSingle();
  if (categoryError || !category) throw new Error(`Category not found for ${serviceName}`);
  return { ...data, category };
}

async function chooseService(page: Page, serviceName: string) {
  const svc = await serviceInfo(serviceName);
  await page.getByText(svc.category.name, { exact: true }).first().click();
  await page.getByText(serviceName, { exact: true }).first().click();
}

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

    const unlock = page.getByRole("button", { name: /Use 1 connection|Get connections/ });
    await unlock.click();
    await expect(page.getByText("Contact unlocked")).toBeVisible();
    await expect(page.getByText("+919000000003")).toBeVisible();
    await page.screenshot({ path: "test-results/customer-unlocked.png", fullPage: true });

    await page.getByRole("button", { name: "Message" }).click();
    await expect(page.getByText("Start the conversation.")).toBeVisible();

    await page.getByPlaceholder("Write a message...").fill("Hello, I need AC service.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Hello, I need AC service.")).toBeVisible();

    await page.getByRole("button", { name: "Request Job" }).click();
    await expect(page.getByText("Create Job Request")).toBeVisible();
    await chooseService(page, "AC Technician");
    await page.getByPlaceholder("e.g. Fix kitchen plumbing").fill("AC service at home");
    await page.getByPlaceholder("Describe the work required...").fill("AC is not cooling. Please inspect and repair.");
    await page.getByPlaceholder("Enter the property/service address").fill("Varanasi, Uttar Pradesh");
    await page.getByRole("button", { name: "Send Job Request" }).click();

    await expect(page.getByText("Hello, I need AC service.")).toBeVisible({ timeout: 20_000 });

    // Validate authenticated-session exit: a real user can sign out cleanly.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\\/auth/);
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
    await expect(page.getByText("Job requests")).toBeVisible();
    await expect(page.getByText("AC service at home")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Accept Job" }).click();
    await page.waitForURL(/\/job-tracking\?jobId=/);
    await expect(page.getByText("Professional accepted")).toBeVisible();
    await expect(page.getByText("Service location")).toBeVisible();
    await expect(page.getByText(/Customer:/)).toBeVisible();
    await page.screenshot({ path: "test-results/professional-job-accepted.png", fullPage: true });

    await page.goto("/jobs");
    await expect(page.getByText("My Jobs")).toBeVisible();

    for (const label of ["Mark On the way", "Mark Arrived", "Mark Work started", "Mark Work completed"]) {
      await page.getByRole("button", { name: label }).click();
      await expect(page.getByText(label.replace("Mark ", ""), { exact: false })).toBeVisible({ timeout: 15_000 });
    }
  });


  test("Admin: authorized console opens and operational tabs render", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Admin Console")).toBeVisible();
    await page.getByPlaceholder("Admin email").fill("demo.admin@vasudha.test");
    await page.getByPlaceholder("Password").fill("Demo@12345");
    await page.getByText("Sign in to Admin", { exact: true }).click();
    await expect(page.getByText("Admin Console")).toBeVisible();
    await expect(page.getByText("Dashboard", { exact: true })).toBeVisible({ timeout: 20_000 });
    for (const tab of ["Professionals", "Customers", "Connections", "Operations", "Subscriptions", "Payments", "Analytics", "Complaints", "Audit", "Configuration"]) {
      await page.getByText(tab, { exact: true }).click();
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/admin-console.png", fullPage: true });
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
