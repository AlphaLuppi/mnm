/**
 * RBAC — Roles & Permissions Page (browser tests)
 *
 * Tests the /admin/roles page: overview, permission matrix, members by role.
 * Validates RBAC enforcement — only admins can access.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("RBAC — Admin Roles Page", () => {
  test("admin can access roles page", async ({ adminPage }) => {
    await adminPage.goto("/admin/roles");
    await expect(adminPage.locator('[data-testid="rbac-s06-page"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-testid="rbac-s06-page-title"]')).toHaveText("Roles & Permissions");
  });

  test("overview tab shows 4 role cards", async ({ adminPage }) => {
    await adminPage.goto("/admin/roles");
    await expect(adminPage.locator('[data-testid="rbac-s06-role-cards"]')).toBeVisible({ timeout: 15_000 });
    const cards = adminPage.locator('[data-testid="rbac-s06-role-cards"] > *');
    await expect(cards).toHaveCount(4);
  });

  test("permission matrix tab shows matrix", async ({ adminPage }) => {
    await adminPage.goto("/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-matrix"]').click();
    await expect(adminPage.locator('[data-testid="rbac-s06-tab-content-matrix"]')).toBeVisible({ timeout: 5_000 });
  });

  test("members by role tab shows table with filters", async ({ adminPage }) => {
    await adminPage.goto("/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-members"]').click();
    await expect(adminPage.locator('[data-testid="rbac-s06-members-section"]')).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.locator('[data-testid="rbac-s06-members-role-filter"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="rbac-s06-members-search"]')).toBeVisible();
  });

  test("members count is displayed", async ({ adminPage }) => {
    await adminPage.goto("/admin/roles");
    await adminPage.locator('[data-testid="rbac-s06-tab-members"]').click();
    await expect(adminPage.locator('[data-testid="rbac-s06-members-count"]')).toBeVisible({ timeout: 5_000 });
    const text = await adminPage.locator('[data-testid="rbac-s06-members-count"]').textContent();
    expect(text).toMatch(/\d+ members?/);
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
});
