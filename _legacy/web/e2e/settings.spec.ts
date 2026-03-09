import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" })
    ).toBeVisible();
  });

  test("displays description text", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByText("Configure MnM preferences and API keys")
    ).toBeVisible();
  });

  test("shows settings tabs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Git" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Agent" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "API" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Privacy" })).toBeVisible();
  });

  test("General tab is active by default", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("tab", { name: "General" })
    ).toHaveAttribute("data-state", "active");
  });

  test("can switch to Git tab", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Git" }).click();
    await expect(
      page.getByRole("tab", { name: "Git" })
    ).toHaveAttribute("data-state", "active");
  });

  test("can switch to API tab", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "API" }).click();
    await expect(
      page.getByRole("tab", { name: "API" })
    ).toHaveAttribute("data-state", "active");
  });
});
