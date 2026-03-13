import { test, expect } from "@playwright/test";

test.describe("Specs Page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/specs");
    await expect(
      page.getByRole("heading", { name: "Specs" })
    ).toBeVisible();
  });

  test("displays description text", async ({ page }) => {
    await page.goto("/specs");
    await expect(
      page.getByText("Browse and search project specifications")
    ).toBeVisible();
  });

  test("shows the spec tree container", async ({ page }) => {
    await page.goto("/specs");
    // The spec tree is in a bordered container
    const treeContainer = page.locator(".rounded-lg.border").first();
    await expect(treeContainer).toBeVisible();
  });

  test("has re-index button", async ({ page }) => {
    await page.goto("/specs");
    // The SpecReindexButton should be present
    const reindexBtn = page.getByRole("button", { name: /re-?index/i });
    await expect(reindexBtn).toBeVisible();
  });

  test("navigating to dashboard via sidebar works", async ({ page }) => {
    await page.goto("/specs");
    // Click "Dashboard" link in the sidebar using the data-sidebar attribute
    await page.locator("[data-sidebar] a", { hasText: "Dashboard" }).first().click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});
