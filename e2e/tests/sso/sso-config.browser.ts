/**
 * SSO — SSO Configuration Page (browser tests)
 *
 * Tests the /admin/sso page: provider list, create, toggle, verify.
 * Requires company:manage_sso permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("SSO Config — Admin View", () => {
  test("admin can access SSO config page", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test("displays SSO title", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-title"]')).toHaveText("SSO Configuration", { timeout: 15_000 });
  });

  test("shows Add SSO Provider button", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-btn-add"]')).toBeVisible({ timeout: 15_000 });
  });

  test("shows provider list or empty state", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await adminPage.waitForTimeout(3_000);
    const hasProviders = await adminPage.locator('[data-testid="sso-s03-provider-list"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="sso-s03-empty-state"]').isVisible().catch(() => false);
    expect(hasProviders || hasEmpty).toBeTruthy();
  });

  test("empty state shows helpful description", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await adminPage.waitForTimeout(3_000);
    const hasEmpty = await adminPage.locator('[data-testid="sso-s03-empty-state"]').isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(adminPage.locator('[data-testid="sso-s03-empty-title"]')).toHaveText("No SSO providers configured");
      await expect(adminPage.locator('[data-testid="sso-s03-empty-description"]')).toContainText("SAML 2.0");
    }
  });

  test("clicking Add SSO Provider opens create dialog", async ({ adminPage }) => {
    await adminPage.goto("/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-btn-add"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-testid="sso-s03-btn-add"]').click();
    // Should open a dialog
    await adminPage.waitForTimeout(1_000);
    const hasDialog = await adminPage.locator('[role="dialog"]').isVisible().catch(() => false);
    expect(hasDialog).toBeTruthy();
  });
});

test.describe("SSO Config — RBAC", () => {
  test("viewer cannot access SSO config (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/admin/sso");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/sso")).toBeTruthy();
  });

  test("manager cannot access SSO config (forbidden)", async ({ managerPage }) => {
    await managerPage.goto("/admin/sso");
    await managerPage.waitForTimeout(3_000);
    const url = managerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await managerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/sso")).toBeTruthy();
  });
});
