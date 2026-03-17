/**
 * Audit Log — Audit Log Page (browser tests)
 *
 * Tests the /audit page: event table, filters, pagination, verify, export.
 * Requires audit:read permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Audit Log — Admin View", () => {
  test("admin can access audit log page", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test("displays audit log title", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-title"]')).toHaveText("Audit Log", { timeout: 15_000 });
  });

  test("shows verify integrity button", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-verify-button"]')).toBeVisible({ timeout: 15_000 });
  });

  test("shows export button for admin", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-export-menu"]')).toBeVisible({ timeout: 15_000 });
  });

  test("shows filter controls", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-filters"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-testid="obs-s04-filter-search"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="obs-s04-filter-actor-type"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="obs-s04-filter-severity"]')).toBeVisible();
  });

  test("shows audit events table or empty state", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await adminPage.waitForTimeout(3_000);
    const hasTable = await adminPage.locator('[data-testid="obs-s04-table"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="obs-s04-empty-state"]').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("clicking verify integrity shows result", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await expect(adminPage.locator('[data-testid="obs-s04-verify-button"]')).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-testid="obs-s04-verify-button"]').click();
    // Should show verify result (valid or invalid)
    await expect(adminPage.locator('[data-testid="obs-s04-verify-result"]')).toBeVisible({ timeout: 15_000 });
  });

  test("sort order toggle works", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    const sortBtn = adminPage.locator('[data-testid="obs-s04-sort-order"]');
    if (await sortBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(sortBtn).toContainText("desc");
      await sortBtn.click();
      await expect(sortBtn).toContainText("asc");
    }
  });

  test("pagination is shown when events exist", async ({ adminPage }) => {
    await adminPage.goto("/audit");
    await adminPage.waitForTimeout(3_000);
    const hasPagination = await adminPage.locator('[data-testid="obs-s04-pagination"]').isVisible().catch(() => false);
    // Pagination only shows when there are events
    if (hasPagination) {
      await expect(adminPage.locator('[data-testid="obs-s04-pagination-info"]')).toBeVisible();
    }
  });
});

test.describe("Audit Log — RBAC", () => {
  test("viewer can access audit log (audit:read permission)", async ({ viewerPage }) => {
    await viewerPage.goto("/audit");
    await expect(viewerPage.locator('[data-testid="obs-s04-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test("viewer cannot see export button (no audit:export permission)", async ({ viewerPage }) => {
    await viewerPage.goto("/audit");
    await viewerPage.waitForTimeout(5_000);
    const exportBtn = viewerPage.locator('[data-testid="obs-s04-export-menu"]');
    // Export requires audit:export which viewer doesn't have
    await expect(exportBtn).not.toBeVisible();
  });

  test("contributor cannot access audit log (no audit:read)", async ({ contributorPage }) => {
    await contributorPage.goto("/audit");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/audit")).toBeTruthy();
  });
});
