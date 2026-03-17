/**
 * Auth — Sign In Flow (browser tests)
 *
 * Tests the /auth page sign-in flow with real browser interactions.
 * Uses the unauthenticated browser context (no storageState).
 */
import { test, expect } from "@playwright/test";

test.describe("Auth — Sign In Page", () => {
  test.beforeEach(async ({ page, request }) => {
    const res = await request.get("/api/health").catch(() => null);
    if (!res || !res.ok()) {
      test.skip(true, "Server not running");
      return;
    }
    const body = await res.json();
    if (body.deploymentMode === "local_trusted") {
      test.skip(true, "Server in local_trusted mode — auth UI not used");
    }
  });

  test("displays sign-in form with email and password fields", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("sign-in button is disabled when fields are empty", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /sign in/i })).toBeDisabled();
  });

  test("can toggle between sign-in and sign-up modes", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });

    // Switch to sign-up
    await page.getByText("Create one").click();
    await expect(page.getByText("Create your MnM account")).toBeVisible();
    await expect(page.locator('input[autocomplete="name"]')).toBeVisible();

    // Switch back to sign-in
    await page.getByText("Sign in").click();
    await expect(page.getByText("Sign in to MnM")).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="email"]').fill("nonexistent@test.dev");
    await page.locator('input[type="password"]').fill("WrongPassword!123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should show error message
    await expect(page.locator(".text-destructive")).toBeVisible({ timeout: 10_000 });
  });

  test("successful sign-in redirects to dashboard", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="email"]').fill("admin@novatech.test");
    await page.locator('input[type="password"]').fill("E2eTestPass!2026");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect away from /auth
    await page.waitForURL(/(?!.*\/auth)/, { timeout: 15_000 });
    expect(page.url()).not.toContain("/auth");
  });
});
