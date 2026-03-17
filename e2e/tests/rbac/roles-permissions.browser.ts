/**
 * RBAC — Roles & Permissions Page (browser tests)
 *
 * Tests the /admin/roles page: overview, permission matrix, members by role.
 * Validates RBAC enforcement — only admins can access.
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { navigateAndWait, waitForTestId } from "../../fixtures/test-helpers";

test.describe("RBAC — Admin Roles Page", () => {
  test("admin can access roles page", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await waitForTestId(adminPage, "rbac-s06-page");
    await expect(adminPage.locator('[data-testid="rbac-s06-page-title"]')).toHaveText("Roles & Permissions");
  });

  test("overview tab shows 4 role cards (admin, manager, contributor, viewer)", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await waitForTestId(adminPage, "rbac-s06-role-cards");
    const cards = adminPage.locator('[data-testid="rbac-s06-role-cards"] > *');
    await expect(cards).toHaveCount(4);
  });

  test("permission matrix tab renders matrix table", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-matrix"]').click();
    await waitForTestId(adminPage, "rbac-s06-tab-content-matrix");
    await expect(adminPage.locator('[data-testid="rbac-s06-matrix-table"]')).toBeVisible();
    // Matrix should have headers for all 4 roles
    await expect(adminPage.locator('[data-testid="rbac-s06-matrix-header-admin"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="rbac-s06-matrix-header-viewer"]')).toBeVisible();
  });

  test("members tab shows member list with filters", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-members"]').click();
    await waitForTestId(adminPage, "rbac-s06-members-section");
    await expect(adminPage.locator('[data-testid="rbac-s06-members-role-filter"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="rbac-s06-members-search"]')).toBeVisible();
  });

  test("members count is displayed", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-members"]').click();
    await waitForTestId(adminPage, "rbac-s06-members-count");
    const text = await adminPage.locator('[data-testid="rbac-s06-members-count"]').textContent();
    expect(text).toMatch(/\d+ members?/);
  });

  test("members tab shows table or empty state", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-members"]').click();
    await adminPage.waitForTimeout(2_000);
    const hasTable = await adminPage.locator('[data-testid="rbac-s06-members-table"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="rbac-s06-members-empty"]').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});

test.describe("RBAC — Access Control", () => {
  test("viewer cannot access admin/roles (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/admin/roles");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/roles")).toBeTruthy();
  });

  test("contributor cannot access admin/roles (forbidden)", async ({ contributorPage }) => {
    await contributorPage.goto("/admin/roles");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/roles")).toBeTruthy();
  });

  test("manager cannot access admin/roles (no users:manage_permissions)", async ({ managerPage }) => {
    await managerPage.goto("/admin/roles");
    await managerPage.waitForTimeout(3_000);
    const url = managerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await managerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/admin/roles")).toBeTruthy();
  });
});
