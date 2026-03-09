import type { Page } from "@playwright/test";

/**
 * Database helpers for E2E tests.
 * Uses API endpoints to seed and clean up data.
 */

/**
 * Trigger a spec re-index via the API.
 * This populates the specs table from the filesystem.
 */
export async function reindexSpecs(page: Page): Promise<void> {
  await page.request.post("/api/specs/reindex");
}

/**
 * Fetch current specs from the API.
 */
export async function getSpecs(page: Page) {
  const response = await page.request.get("/api/specs");
  return response.json();
}

/**
 * Fetch current agents from the API.
 */
export async function getAgents(page: Page) {
  const response = await page.request.get("/api/agents");
  return response.json();
}

/**
 * Fetch dashboard data from the API.
 */
export async function getDashboard(page: Page) {
  const response = await page.request.get("/api/dashboard");
  return response.json();
}

/**
 * Fetch settings from the API.
 */
export async function getSettings(page: Page) {
  const response = await page.request.get("/api/settings");
  return response.json();
}
