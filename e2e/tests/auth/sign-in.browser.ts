/**
 * Auth — Sign In Flow (browser tests)
 *
 * Tests the /auth page sign-in flow with real browser interactions.
 * Uses the unauthenticated browser context (no storageState).
 */
import { test, expect } from "@playwright/test";
import { USERS, TEST_PASSWORD } from "../../fixtures/seed-data";
import { isAuthenticatedMode } from "../../fixtures/test-helpers";

test.describe("Auth — Sign In Page", () => {
  test.beforeEach(async ({ page, request }) => {
    const res = await request.get("/api/health").catch(() => null);
    if (!res || !res.ok()) {
      test.skip(true, "Server not running");
      return;
    }
    if (!(await isAuthenticatedMode(request))) {
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

  test("button stays disabled with email only (password < 8 chars)", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });
    await page.locator('input[type="email"]').fill("test@test.dev");
    await page.locator('input[type="password"]').fill("short");
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

  test("sign-up mode requires name field", async ({ page }) => {
    await page.goto("/auth");
    await page.getByText("Create one").click();
    await expect(page.getByText("Create your MnM account")).toBeVisible({ timeout: 10_000 });

    // Fill email + password but not name — button should be disabled
    await page.locator('input[type="email"]').fill("test@test.dev");
    await page.locator('input[type="password"]').fill("ValidPass!2026");
    await expect(page.getByRole("button", { name: /create account/i })).toBeDisabled();

    // Fill name — button should enable
    await page.locator('input[autocomplete="name"]').fill("Test User");
    await expect(page.getByRole("button", { name: /create account/i })).toBeEnabled();
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

  test("successful sign-in redirects away from /auth", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to MnM")).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="email"]').fill(USERS.novaTechAdmin.email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect away from /auth
    await page.waitForURL(/(?!.*\/auth)/, { timeout: 15_000 });
    expect(page.url()).not.toContain("/auth");
  });
});
