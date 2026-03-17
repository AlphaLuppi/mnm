/**
 * Auth — Sign Out Flow (browser tests)
 *
 * Tests sign-out via the user avatar menu.
 * Uses the admin role fixture (authenticated browser context).
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { isAuthenticatedMode } from "../../fixtures/test-helpers";

test.describe("Auth — Sign Out Flow", () => {
  test.beforeEach(async ({ adminPage }) => {
    const res = await adminPage.request.get("/api/health").catch(() => null);
    if (!res || !res.ok()) {
      test.skip(true, "Server not running");
      return;
    }
    if (!(await isAuthenticatedMode(adminPage.request))) {
      test.skip(true, "Server in local_trusted mode — sign-out UI hidden");
    }
  });

  test("user avatar is visible when authenticated", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 });
    const avatar = adminPage.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 15_000 });
  });

  test("clicking avatar opens menu with sign-out option", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 });
    const avatar = adminPage.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    await avatar.click();

    const signOutBtn = adminPage.locator('[data-testid="mu-s06-sign-out-button"]');
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });
  });

  test("sign-out redirects to /auth", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 });
    const avatar = adminPage.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    await avatar.click();

    const signOutBtn = adminPage.locator('[data-testid="mu-s06-sign-out-button"]');
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });
    await signOutBtn.click();

    await adminPage.waitForURL("**/auth", { timeout: 10_000 });
    expect(adminPage.url()).toContain("/auth");
  });
});
