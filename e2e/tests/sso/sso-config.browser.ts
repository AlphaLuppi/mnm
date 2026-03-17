/**
 * SSO — SSO Configuration Page (browser tests)
 *
 * Tests the /admin/sso page: provider list, create, toggle, verify.
 * Requires company:manage_sso permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { navigateAndWait, waitForTestId } from "../../fixtures/test-helpers";

test.describe("SSO Config — Admin View", () => {
  test("admin can access SSO config page", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    await waitForTestId(adminPage, "sso-s03-page");
  });

  test("displays SSO title", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-title"]')).toHaveText("SSO Configuration", { timeout: 15_000 });
  });

  test("shows Add SSO Provider button", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-btn-add"]')).toBeVisible({ timeout: 15_000 });
  });

  test("shows provider list or empty state", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    const hasProviders = await adminPage.locator('[data-testid="sso-s03-provider-list"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="sso-s03-empty-state"]').isVisible().catch(() => false);
    expect(hasProviders || hasEmpty).toBeTruthy();
  });

  test("empty state shows helpful description", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    const hasEmpty = await adminPage.locator('[data-testid="sso-s03-empty-state"]').isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(adminPage.locator('[data-testid="sso-s03-empty-title"]')).toHaveText("No SSO providers configured");
      await expect(adminPage.locator('[data-testid="sso-s03-empty-description"]')).toContainText("SAML 2.0");
    }
  });

  test("clicking Add SSO Provider opens create dialog", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/sso");
    await expect(adminPage.locator('[data-testid="sso-s03-btn-add"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-testid="sso-s03-btn-add"]').click();
    await adminPage.waitForTimeout(1_000);
    const hasDialog = await adminPage.locator('[role="dialog"]').isVisible().catch(() => false);
    expect(hasDialog).toBeTruthy();
  });
});

test.describe("SSO Config — RBAC Enforcement", () => {
  test("viewer cannot access SSO config (no company:manage_sso)", async ({ viewerPage }) => {
    await viewerPage.goto("/admin/sso");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/sso")).toBeTruthy();
  });

  test("manager cannot access SSO config (no company:manage_sso)", async ({ managerPage }) => {
    await managerPage.goto("/admin/sso");
    await managerPage.waitForTimeout(3_000);
    const url = managerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await managerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/sso")).toBeTruthy();
  });

  test("contributor cannot access SSO config (no company:manage_sso)", async ({ contributorPage }) => {
    await contributorPage.goto("/admin/sso");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/sso")).toBeTruthy();
  });
});
