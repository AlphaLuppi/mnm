import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("page loads successfully with title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MnM/);
  });

  test("displays dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("displays welcome message", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Welcome to MnM")
    ).toBeVisible();
  });

  test("shows summary cards for Specs, Agents, Drift, Git", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Specs").first()).toBeVisible();
    await expect(page.getByText("Agents").first()).toBeVisible();
    await expect(page.getByText("Drift").first()).toBeVisible();
    await expect(page.getByText("Git").first()).toBeVisible();
  });

  test("displays spec count or placeholder", async ({ page }) => {
    await page.goto("/");
    // The card should show a number or "--" placeholder
    const specsCard = page.locator("text=indexed specifications").locator("..");
    await expect(specsCard).toBeVisible();
  });

  test("displays agent count or zero", async ({ page }) => {
    await page.goto("/");
    const agentsCard = page.locator("text=running agents").locator("..");
    await expect(agentsCard).toBeVisible();
  });

  test("sidebar navigation links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Specs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Drift" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("can navigate to Specs via sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Specs" }).click();
    await expect(page).toHaveURL(/\/specs/);
    await expect(
      page.getByRole("heading", { name: "Specs" })
    ).toBeVisible();
  });

  test("can navigate to Agents via sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Agents" }).click();
    await expect(page).toHaveURL(/\/agents/);
    await expect(
      page.getByRole("heading", { name: "Agent Dashboard" })
    ).toBeVisible();
  });

  test("can navigate to Drift via sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Drift" }).click();
    await expect(page).toHaveURL(/\/drift/);
    await expect(
      page.getByRole("heading", { name: "Drift Detection" })
    ).toBeVisible();
  });
});
