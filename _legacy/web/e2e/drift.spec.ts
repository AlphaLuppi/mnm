import { test, expect } from "@playwright/test";

test.describe("Drift Detection Page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/drift");
    await expect(
      page.getByRole("heading", { name: "Drift Detection" })
    ).toBeVisible();
  });

  test("displays description text", async ({ page }) => {
    await page.goto("/drift");
    await expect(
      page.getByText("Review when code diverges from specifications")
    ).toBeVisible();
  });

  test("shows tab navigation with Code vs Spec and Cross-Document", async ({ page }) => {
    await page.goto("/drift");
    await expect(page.getByRole("tab", { name: /Code vs Spec/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Cross-Document/ })).toBeVisible();
  });

  test("Code vs Spec tab is selected by default", async ({ page }) => {
    await page.goto("/drift");
    const codeTab = page.getByRole("tab", { name: /Code vs Spec/ });
    await expect(codeTab).toHaveAttribute("data-state", "active");
  });

  test("shows empty state when no drift detections exist", async ({ page }) => {
    await page.goto("/drift");
    // When no drifts exist, should show the empty message
    await expect(
      page.getByText(/No drift detections yet/)
    ).toBeVisible();
  });

  test("can switch to Cross-Document tab", async ({ page }) => {
    await page.goto("/drift");
    await page.getByRole("tab", { name: /Cross-Document/ }).click();
    await expect(
      page.getByRole("tab", { name: /Cross-Document/ })
    ).toHaveAttribute("data-state", "active");
  });

  test("Code vs Spec tab has filter buttons for All, Pending, Resolved", async ({ page }) => {
    await page.goto("/drift");
    // These are buttons within the Code vs Spec tab panel
    await expect(page.getByRole("button", { name: /All/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pending/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Resolved/ })).toBeVisible();
  });
});
