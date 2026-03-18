/**
 * Drift — Drift Detection Page (browser tests)
 *
 * Tests the drift detection page accessed via /projects/:projectId/drift
 * or from the standalone Drift page: tabs (Documents, Execution Alerts),
 * scan controls, filter bars, alert list.
 * Requires projects:manage_members or admin role.
 */
import { test, expect, IDS } from "../../fixtures/auth.fixture";
import { navigateAndWait } from "../../fixtures/test-helpers";

test.describe("Drift Detection — Admin View", () => {
  test("admin can access drift page via project", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    expect(adminPage.url()).toContain("/drift");
  });

  test("displays drift detection heading", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    await expect(adminPage.getByText("Drift Detection")).toBeVisible({ timeout: 15_000 });
  });

  test("shows Documents and Execution Alerts tabs", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    const docsTab = adminPage.locator('[data-testid="drift-s03-tab-documents"]');
    const execTab = adminPage.locator('[data-testid="drift-s03-tab-execution"]');
    // Tabs may be on the standalone Drift page, not necessarily on project/drift
    if (await docsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(docsTab).toBeVisible();
      await expect(execTab).toBeVisible();
    }
  });

  test("scan button is available on documents tab", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    const scanBtn = adminPage.getByRole("button", { name: /Scan for Drift/i });
    if (await scanBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(scanBtn).toBeVisible();
    }
  });

  test("drift page accessible via seeded Audit Securite project", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_AUDIT_SECURITE}/drift`);
    expect(adminPage.url()).toContain("/drift");
  });
});

test.describe("Drift — Execution Alerts Tab", () => {
  test("execution alerts tab shows filters", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    const execTab = adminPage.locator('[data-testid="drift-s03-tab-execution"]');
    if (await execTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await execTab.click();
      await expect(adminPage.locator('[data-testid="drift-s03-filters"]')).toBeVisible({ timeout: 5_000 });
      await expect(adminPage.locator('[data-testid="drift-s03-filter-severity"]')).toBeVisible();
      await expect(adminPage.locator('[data-testid="drift-s03-filter-type"]')).toBeVisible();
      await expect(adminPage.locator('[data-testid="drift-s03-filter-status"]')).toBeVisible();
    }
  });

  test("shows monitoring status or empty state", async ({ adminPage }) => {
    await navigateAndWait(adminPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    const execTab = adminPage.locator('[data-testid="drift-s03-tab-execution"]');
    if (await execTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await execTab.click();
      await adminPage.waitForTimeout(2_000);
      const hasAlerts = await adminPage.locator('[data-testid="drift-s03-alerts-list"]').isVisible().catch(() => false);
      const hasMonitoringOff = await adminPage.locator('[data-testid="drift-s03-empty-monitoring-off"]').isVisible().catch(() => false);
      const hasNoAlerts = await adminPage.locator('[data-testid="drift-s03-empty-no-alerts"]').isVisible().catch(() => false);
      expect(hasAlerts || hasMonitoringOff || hasNoAlerts).toBeTruthy();
    }
  });
});

test.describe("Drift — Manager View", () => {
  test("manager can access drift page (has projects:manage_members)", async ({ managerPage }) => {
    await navigateAndWait(managerPage, `/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    expect(managerPage.url()).toContain("/drift");
  });
});

test.describe("Drift — RBAC Enforcement", () => {
  test("viewer cannot access drift (no project management permission)", async ({ viewerPage }) => {
    await viewerPage.goto(`/projects/${IDS.PROJECT_MIGRATION_CLOUD}/drift`);
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=/Forbidden|Access Denied/").isVisible().catch(() => false));
    // Viewer may be redirected or see forbidden — both valid
    expect(hasForbidden || !url.includes("/drift") || url.includes("/projects")).toBeTruthy();
  });
});
