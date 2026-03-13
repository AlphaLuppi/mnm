import { test, expect } from "@playwright/test";

test.describe("Agents Page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/agents");
    await expect(
      page.getByRole("heading", { name: "Agent Dashboard" })
    ).toBeVisible();
  });

  test("displays description text", async ({ page }) => {
    await page.goto("/agents");
    await expect(
      page.getByText("Manage AI agents for your development workflow")
    ).toBeVisible();
  });

  test("shows Available Agents section", async ({ page }) => {
    await page.goto("/agents");
    await expect(
      page.getByRole("heading", { name: "Available Agents" })
    ).toBeVisible();
  });

  test("shows Running Agents section", async ({ page }) => {
    await page.goto("/agents");
    await expect(
      page.getByRole("heading", { name: "Running Agents" })
    ).toBeVisible();
  });

  test("displays agent count summary", async ({ page }) => {
    await page.goto("/agents");
    // The card header shows "X active / Y total"
    await expect(page.getByText(/active \/ \d+ total/)).toBeVisible();
  });
});
