import { test as base } from "@playwright/test";

/**
 * Extended test fixtures for MnM E2E tests.
 * Add custom fixtures here as the test suite grows.
 */
export const test = base.extend({
  // Ensure each test starts from a clean page state
  page: async ({ page }, use) => {
    // Wait for the app to be interactive before running tests
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});

export { expect } from "@playwright/test";
