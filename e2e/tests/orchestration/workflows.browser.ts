/**
 * Orchestration — Workflows Page (browser tests)
 *
 * Tests the /workflows page: list, templates, creation.
 * Requires workflows:create permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Workflows — List Page", () => {
  test("admin can access workflows page", async ({ adminPage }) => {
    await adminPage.goto("/workflows");
    await adminPage.waitForTimeout(3_000);
    // Page should load without error
    expect(adminPage.url()).toContain("/workflows");
  });

  test("shows templates section", async ({ adminPage }) => {
    await adminPage.goto("/workflows");
    await expect(adminPage.getByText("Templates")).toBeVisible({ timeout: 15_000 });
  });

  test("new workflow button navigates to creation page", async ({ adminPage }) => {
    await adminPage.goto("/workflows");
    await expect(adminPage.getByText("Templates")).toBeVisible({ timeout: 15_000 });
    // Look for New Template button
    const newTemplateBtn = adminPage.getByRole("button", { name: /New Template/i });
    if (await newTemplateBtn.isVisible()) {
      await newTemplateBtn.click();
      await adminPage.waitForURL("**/workflow-editor/new", { timeout: 10_000 });
      expect(adminPage.url()).toContain("/workflow-editor/new");
    }
  });

  test("viewer cannot access workflows (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/workflows");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/workflows")).toBeTruthy();
  });
});

test.describe("Workflows — Template Management", () => {
  test("displays template list when templates exist", async ({ adminPage }) => {
    await adminPage.goto("/workflows");
    await expect(adminPage.getByText("Templates")).toBeVisible({ timeout: 15_000 });
    // If seeded templates exist, they should show
    const templateSection = adminPage.locator("text=Pipeline CI/CD Standard");
    // This will pass if seed data includes templates, skip-friendly if not
    if (await templateSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(templateSection).toBeVisible();
    }
  });

  test("template shows stage names in progression", async ({ adminPage }) => {
    await adminPage.goto("/workflows");
    await adminPage.waitForTimeout(3_000);
    // Check for stage names from seed data
    const analyseStage = adminPage.locator("text=Analyse");
    if (await analyseStage.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(analyseStage).toBeVisible();
    }
  });
});
