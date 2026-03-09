import { test, expect } from "@playwright/test";

test.describe("Onboarding Page", () => {
  // Steps: 0=Welcome, 1=Repository, 2=API Key, 3=Detect Files, 4=Discovery, 5=Complete
  // Next: steps 0-3, Finish: step 4, Open Dashboard: step 5

  test("page loads and shows step indicators", async ({ page }) => {
    await page.goto("/onboarding");
    // 6 step indicators should be visible (numbered 1-6)
    for (let i = 1; i <= 6; i++) {
      await expect(page.getByText(String(i)).first()).toBeVisible();
    }
  });

  test("starts on the Welcome step with Next button", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Next", exact: true })
    ).toBeVisible();
  });

  test("has Skip Setup button", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Skip Setup" })
    ).toBeVisible();
  });

  test("can navigate through steps with Next button", async ({ page }) => {
    await page.goto("/onboarding");

    // Step 0 → 1 (Repository)
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    // Step 1 → 2 (API Key)
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 2 → 3 (Detect Files)
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 3 → 4 (Discovery) - this is lastStep-1, shows "Finish"
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
  });

  test("can go back to previous step", async ({ page }) => {
    await page.goto("/onboarding");
    // Go to step 1
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    // Go back to step 0
    await page.getByRole("button", { name: "Back" }).click();
    // Back button should not be visible on step 0
    await expect(page.getByRole("button", { name: "Back" })).not.toBeVisible();
  });

  test("can complete onboarding via Finish and Open Dashboard", async ({ page }) => {
    await page.goto("/onboarding");

    // Navigate to step 4 (Discovery) which shows Finish
    await page.getByRole("button", { name: "Next", exact: true }).click(); // → 1
    await page.getByRole("button", { name: "Next", exact: true }).click(); // → 2
    await page.getByRole("button", { name: "Next", exact: true }).click(); // → 3
    await page.getByRole("button", { name: "Next", exact: true }).click(); // → 4
    await page.getByRole("button", { name: "Finish" }).click(); // → 5 (Complete)

    // Step 5 has "Open Dashboard" button
    await expect(
      page.getByRole("button", { name: "Open Dashboard" })
    ).toBeVisible();
  });
});
