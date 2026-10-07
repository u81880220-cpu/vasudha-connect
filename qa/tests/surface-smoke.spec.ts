import { test, expect, Page } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.QA_CUSTOMER_EMAIL || "demo.customer1@vasudha.test";
const CUSTOMER_PASSWORD = process.env.QA_CUSTOMER_PASSWORD || "Demo@12345";
const PROFESSIONAL_EMAIL = process.env.QA_PROFESSIONAL_EMAIL || "demo.pro1@vasudha.test";
const PROFESSIONAL_PASSWORD = process.env.QA_PROFESSIONAL_PASSWORD || "Demo@12345";
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || "demo.admin@vasudha.test";
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || "Demo@12345";

async function login(page: Page, mode: "customer" | "professional", email: string, password: string) {
  await page.goto(`/auth?mode=${mode}`);
  await expect(page.getByText("Welcome Back")).toBeVisible();
  await page.getByText("Email", { exact: true }).click();
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByText("Sign in with Email", { exact: true }).click();
  await page.waitForURL(/\/(home|basic-profile|professional-onboarding)/, { timeout: 20_000 });
}

test.describe("VASUDHA surface smoke", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", async dialog => dialog.accept());
  });

  test("customer trust and account surfaces are reachable", async ({ page }) => {
    await login(page, "customer", CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    const surfaces: [string, string][] = [
      ["/connections", "My Connections"],
      ["/connection-packages", "Connection Packages"],
      ["/complaints", "Complaints & Reports"],
      ["/notifications", "Notifications"],
      ["/customer-profile", "My Customer Profile"],
      ["/delete-account", "Delete your account"],
    ];

    for (const [path, heading] of surfaces) {
      await page.goto(path);
      await expect(page.getByText(heading, { exact: true })).toBeVisible({ timeout: 10_000 });
    }

    await page.goto("/professional-verification");
    await expect(page).toHaveURL(/\/(home|customer-dashboard)/);
  });

  test("professional trust surfaces are reachable", async ({ page }) => {
    await login(page, "professional", PROFESSIONAL_EMAIL, PROFESSIONAL_PASSWORD);

    const surfaces: [string, string][] = [
      ["/professional-profile", "My Professional Profile"],
      ["/professional-verification", "Professional Verification"],
      ["/professional-subscription", "TEST MODE · FREE SUBSCRIPTION"],
      ["/earnings", "My Performance"],
      ["/notifications", "Notifications"],
      ["/complaints", "Complaints & Reports"],
    ];

    for (const [path, heading] of surfaces) {
      await page.goto(path);
      await expect(page.getByText(heading, { exact: true })).toBeVisible({ timeout: 10_000 });
    }
  });

  test("admin exposes all operational areas and rejects bad password", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Admin Console", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Admin email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByText("Sign in to Admin", { exact: true }).click();
    await expect(page.getByText("Dashboard", { exact: true })).toBeVisible({ timeout: 20_000 });

    for (const tab of [
      "Dashboard", "Professionals", "Verification", "Customers", "Services",
      "Connections", "Subscriptions", "Operations", "Payments", "Notifications",
      "Communication", "Analytics", "Complaints", "Portfolio", "Audit", "Configuration",
    ]) {
      await page.getByText(tab, { exact: true }).click();
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }

    await page.goto("/admin");
    await page.getByPlaceholder("Admin email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill("WrongPassword@123");
    await page.getByText("Sign in", { exact: true }).click();
    await expect(page.getByText("Marketplace control centre")).toBeVisible();
    await expect(page.getByText("Dashboard", { exact: true })).not.toBeVisible();
  });
});
