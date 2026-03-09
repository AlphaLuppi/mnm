import { test, expect } from "@playwright/test";
import { interceptDiscoveryApi } from "./mocks/api-interceptors";

test.describe("FR9: Auto-Discovery", () => {
  // TODO: These tests will pass once the discovery feature is built.
  // The discovery feature scans the repo for BMAD artifacts, specs, workflows, and agents.

  test.fixme("discovery page loads with scan button", async ({ page }) => {
    await page.goto("/discovery");
    await expect(
      page.getByRole("heading", { name: /discovery/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /scan/i })
    ).toBeVisible();
  });

  test.fixme("user can trigger repo scan", async ({ page }) => {
    await interceptDiscoveryApi(page);
    await page.goto("/discovery");

    await page.getByRole("button", { name: /scan/i }).click();

    // Should show progress or loading state
    await expect(page.getByText(/scanning/i)).toBeVisible();
  });

  test.fixme("discovery results appear after scan", async ({ page }) => {
    await interceptDiscoveryApi(page);
    await page.goto("/discovery");

    await page.getByRole("button", { name: /scan/i }).click();

    // After scan completes, results should show
    await expect(page.getByText(/specs/i)).toBeVisible();
    await expect(page.getByText(/workflows/i)).toBeVisible();
    await expect(page.getByText(/agents/i)).toBeVisible();
  });

  test.fixme("discovery shows detected spec files", async ({ page }) => {
    await interceptDiscoveryApi(page);
    await page.goto("/discovery");

    await page.getByRole("button", { name: /scan/i }).click();

    // Should list discovered spec files
    await expect(page.getByText("prd.md")).toBeVisible();
    await expect(page.getByText("architecture.md")).toBeVisible();
  });

  test.fixme("discovery shows detected agents from manifest", async ({ page }) => {
    await interceptDiscoveryApi(page);
    await page.goto("/discovery");

    await page.getByRole("button", { name: /scan/i }).click();

    // Should list agents from the agent manifest
    await expect(page.getByText(/analyst/i)).toBeVisible();
    await expect(page.getByText(/developer/i)).toBeVisible();
  });
});
