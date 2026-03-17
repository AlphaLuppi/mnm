/**
 * Dashboard — Main Dashboard Page (browser tests)
 *
 * Tests the /dashboard page: metric cards, live indicator, charts, activity.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Dashboard — Admin View", () => {
  test("admin can access dashboard", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForTimeout(5_000);
    expect(adminPage.url()).toContain("/dashboard");
  });

  test("displays live indicator", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await expect(adminPage.locator('[data-testid="dash-s03-live-indicator"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-testid="dash-s03-live-label"]')).toHaveText("Live");
  });

  test("shows metric cards (Agents, Tasks, Spend, Approvals, Health)", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForTimeout(5_000);
    await expect(adminPage.getByText("Agents Enabled")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Tasks In Progress")).toBeVisible();
    await expect(adminPage.getByText("Month Spend")).toBeVisible();
    await expect(adminPage.getByText("Pending Approvals")).toBeVisible();
    await expect(adminPage.getByText("Project Health")).toBeVisible();
  });

  test("shows charts section", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForTimeout(5_000);
    await expect(adminPage.getByText("Run Activity")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Issues by Priority")).toBeVisible();
  });

  test("shows recent activity section", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForTimeout(5_000);
    // Check for section headers
    const recentActivity = adminPage.getByText("Recent Activity");
    const recentTasks = adminPage.getByText("Recent Tasks");
    // At least one section should be visible
    const hasActivity = await recentActivity.isVisible().catch(() => false);
    const hasTasks = await recentTasks.isVisible().catch(() => false);
    expect(hasActivity || hasTasks).toBeTruthy();
  });
});

test.describe("Dashboard — Viewer Access", () => {
  test("viewer can access dashboard (dashboard:view permission)", async ({ viewerPage }) => {
    await viewerPage.goto("/dashboard");
    await viewerPage.waitForTimeout(5_000);
    expect(viewerPage.url()).toContain("/dashboard");
    await expect(viewerPage.locator('[data-testid="dash-s03-live-indicator"]')).toBeVisible({ timeout: 15_000 });
  });
});
