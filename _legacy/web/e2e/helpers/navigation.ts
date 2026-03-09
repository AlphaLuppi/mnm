import type { Page } from "@playwright/test";

/**
 * Navigate to a page using the sidebar navigation.
 */
export async function navigateVia(page: Page, linkText: string): Promise<void> {
  await page.getByRole("link", { name: linkText }).click();
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the dashboard page.
 */
export async function goToDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the specs page.
 */
export async function goToSpecs(page: Page): Promise<void> {
  await page.goto("/specs");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the agents page.
 */
export async function goToAgents(page: Page): Promise<void> {
  await page.goto("/agents");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the drift page.
 */
export async function goToDrift(page: Page): Promise<void> {
  await page.goto("/drift");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the settings page.
 */
export async function goToSettings(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the onboarding page.
 */
export async function goToOnboarding(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await page.waitForLoadState("networkidle");
}
