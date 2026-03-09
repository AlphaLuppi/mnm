import { test, expect } from "@playwright/test";

test.describe("FR7: Workflow Viewer", () => {
  // TODO: These tests will pass once the workflow viewer feature is built.
  // The workflow viewer displays BMAD workflows with their steps and connections.

  test.fixme("workflows page loads", async ({ page }) => {
    await page.goto("/workflows");
    await expect(
      page.getByRole("heading", { name: /workflow/i })
    ).toBeVisible();
  });

  test.fixme("workflow list shows discovered workflows", async ({ page }) => {
    await page.goto("/workflows");
    // Should list workflows found in _bmad/bmm/workflows/
    await expect(page.getByText(/test.workflow/i)).toBeVisible();
  });

  test.fixme("user can click workflow to see details", async ({ page }) => {
    await page.goto("/workflows");
    // Click on a workflow to view its steps
    await page.getByText(/test.workflow/i).click();

    // Should display workflow steps
    await expect(page.getByText(/step/i)).toBeVisible();
  });

  test.fixme("workflow detail shows step sequence", async ({ page }) => {
    await page.goto("/workflows");
    await page.getByText(/test.workflow/i).click();

    // Should show the steps from the workflow markdown
    await expect(page.getByText("Analyze requirements")).toBeVisible();
    await expect(page.getByText("Create spec")).toBeVisible();
    await expect(page.getByText("Implement feature")).toBeVisible();
  });

  test.fixme("workflow viewer shows agent assignments", async ({ page }) => {
    await page.goto("/workflows");
    await page.getByText(/test.workflow/i).click();

    // If workflows have agent assignments, they should be shown
    await expect(page.getByText(/agent/i)).toBeVisible();
  });
});
