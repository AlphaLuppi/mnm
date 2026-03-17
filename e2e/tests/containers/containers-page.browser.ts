/**
 * Containers — Container Management Page (browser tests)
 *
 * Tests the /containers page: list, Docker health, status filter, actions.
 * Requires agents:manage_containers permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Containers Page — Admin View", () => {
  test("admin can access containers page", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test("displays containers title", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-title"]')).toHaveText("Containers", { timeout: 15_000 });
  });

  test("shows Docker health indicator", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-health-indicator"]')).toBeVisible({ timeout: 15_000 });
    // Should show either available or unavailable
    const available = await adminPage.locator('[data-testid="cont-s06-health-available"]').isVisible().catch(() => false);
    const unavailable = await adminPage.locator('[data-testid="cont-s06-health-unavailable"]').isVisible().catch(() => false);
    expect(available || unavailable).toBeTruthy();
  });

  test("shows auto-refresh indicator", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-refresh-indicator"]')).toBeVisible({ timeout: 15_000 });
  });

  test("status filter is available", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-filter-status"]')).toBeVisible({ timeout: 15_000 });
  });

  test("shows empty state or container table", async ({ adminPage }) => {
    await adminPage.goto("/containers");
    await adminPage.waitForTimeout(3_000);
    const hasTable = await adminPage.locator('[data-testid="cont-s06-table"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="cont-s06-empty-state"]').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});

test.describe("Containers Page — RBAC", () => {
  test("viewer cannot access containers (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/containers");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/containers")).toBeTruthy();
  });
});
