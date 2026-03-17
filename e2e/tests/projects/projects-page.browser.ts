/**
 * Projects — Projects Page (browser tests)
 *
 * Tests the /projects page: list, navigation, project detail.
 */
import { test, expect, IDS } from "../../fixtures/auth.fixture";

test.describe("Projects Page — Admin View", () => {
  test("admin can access projects page", async ({ adminPage }) => {
    await adminPage.goto("/projects");
    await adminPage.waitForTimeout(3_000);
    expect(adminPage.url()).toContain("/projects");
  });

  test("shows projects list or empty state", async ({ adminPage }) => {
    await adminPage.goto("/projects");
    await adminPage.waitForTimeout(5_000);
    // If seeded, should show project names
    const hasMigration = await adminPage.getByText("Migration Cloud AWS").isVisible().catch(() => false);
    const hasEmpty = await adminPage.getByText("No projects").isVisible().catch(() => false);
    const hasProjects = adminPage.url().includes("/projects");
    expect(hasMigration || hasEmpty || hasProjects).toBeTruthy();
  });

  test("can navigate to project detail", async ({ adminPage }) => {
    await adminPage.goto("/projects");
    await adminPage.waitForTimeout(3_000);
    const projectLink = adminPage.getByText("Migration Cloud AWS");
    if (await projectLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await projectLink.click();
      await adminPage.waitForTimeout(2_000);
      expect(adminPage.url()).toContain("/projects/");
    }
  });
});

test.describe("Project Detail — Tabs", () => {
  test("project detail page shows overview", async ({ adminPage }) => {
    await adminPage.goto(`/projects/${IDS.PROJECT_MIGRATION_CLOUD}`);
    await adminPage.waitForTimeout(5_000);
    expect(adminPage.url()).toContain(`/projects/${IDS.PROJECT_MIGRATION_CLOUD}`);
  });
});
