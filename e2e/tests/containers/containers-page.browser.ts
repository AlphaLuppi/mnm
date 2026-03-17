/**
 * Containers — Container Management Page (browser tests)
 *
 * Tests the /containers page: list, Docker health, status filter, actions.
 * Requires agents:manage_containers permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { navigateAndWait, waitForTestId } from "../../fixtures/test-helpers";

test.describe("Containers Page — Admin View", () => {
  test("admin can access containers page", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    await waitForTestId(adminPage, "cont-s06-page");
  });

  test("displays containers title", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    await expect(adminPage.locator('[data-testid="cont-s06-title"]')).toHaveText("Containers", { timeout: 15_000 });
  });

  test("shows Docker health indicator", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    await waitForTestId(adminPage, "cont-s06-health-indicator");
    // Should show either available or unavailable
    const available = await adminPage.locator('[data-testid="cont-s06-health-available"]').isVisible().catch(() => false);
    const unavailable = await adminPage.locator('[data-testid="cont-s06-health-unavailable"]').isVisible().catch(() => false);
    expect(available || unavailable).toBeTruthy();
  });

  test("shows auto-refresh indicator", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    await waitForTestId(adminPage, "cont-s06-refresh-indicator");
  });

  test("status filter is available", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    await waitForTestId(adminPage, "cont-s06-filter-status");
  });

  test("shows table or empty state", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/containers");
    const hasTable = await adminPage.locator('[data-testid="cont-s06-table"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="cont-s06-empty-state"]').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});

test.describe("Containers Page — RBAC Enforcement", () => {
  test("viewer cannot access containers (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/containers");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/containers")).toBeTruthy();
  });

  test("contributor cannot access containers (no agents:manage_containers)", async ({ contributorPage }) => {
    await contributorPage.goto("/containers");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/containers")).toBeTruthy();
  });
});
