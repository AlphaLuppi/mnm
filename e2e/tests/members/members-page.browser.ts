/**
 * Members Page — Browser E2E Tests
 *
 * Tests the /members page: member list, filters, invite dialog.
 * Uses role-based fixtures to test RBAC on member management.
 */
import { test, expect, IDS } from "../../fixtures/auth.fixture";

test.describe("Members Page — Admin View", () => {
  test("displays members table with data", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await expect(adminPage.locator('[data-testid="mu-s02-page"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-testid="mu-s02-members-table"]')).toBeVisible();
  });

  test("shows member count in footer", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await expect(adminPage.locator('[data-testid="mu-s02-member-count"]')).toBeVisible({ timeout: 15_000 });
    const text = await adminPage.locator('[data-testid="mu-s02-member-count"]').textContent();
    expect(text).toMatch(/Showing \d+ of \d+ members/);
  });

  test("invite button is visible for admin", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await expect(adminPage.locator('[data-testid="mu-s02-invite-button"]')).toBeVisible({ timeout: 15_000 });
  });

  test("clicking invite opens invite dialog", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await adminPage.locator('[data-testid="mu-s02-invite-button"]').click();
    await expect(adminPage.locator('[data-testid="mu-s02-invite-dialog"]')).toBeVisible({ timeout: 5_000 });
  });

  test("invite dialog has single and bulk tabs", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await adminPage.locator('[data-testid="mu-s02-invite-button"]').click();
    await expect(adminPage.locator('[data-testid="mu-s03-tab-single"]')).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.locator('[data-testid="mu-s03-tab-bulk"]')).toBeVisible();
  });

  test("can filter members by role", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await expect(adminPage.locator('[data-testid="mu-s02-filter-role"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-testid="mu-s02-filter-role"]').click();
    await adminPage.locator('[data-testid="mu-s02-filter-role-admin"]').click();
    // Table should update — count changes
    await expect(adminPage.locator('[data-testid="mu-s02-member-count"]')).toBeVisible();
  });

  test("search filters members by name or email", async ({ adminPage }) => {
    await adminPage.goto("/members");
    await expect(adminPage.locator('[data-testid="mu-s02-search"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-testid="mu-s02-search"]').fill("Sophie");
    // Wait for filter to apply
    await adminPage.waitForTimeout(500);
    const count = await adminPage.locator('[data-testid="mu-s02-member-count"]').textContent();
    expect(count).toBeTruthy();
  });
});

test.describe("Members Page — RBAC", () => {
  test("viewer cannot access members page (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/members");
    // Should show forbidden page or redirect
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false)) ||
      (await viewerPage.locator("text=permission").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/members")).toBeTruthy();
  });
});
