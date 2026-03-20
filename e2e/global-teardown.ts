/**
 * Playwright Global Teardown — Cleanup test data after E2E suite.
 *
 * Strategy:
 *   - Calls the server's e2e-seed cleanup endpoint (if available)
 *   - This endpoint truncates test-specific data while preserving schema
 *   - Falls back gracefully if the endpoint is not available
 *
 * Requires:
 *   - MnM server still running with MNM_E2E_SEED=true
 */
import { request } from "@playwright/test";
import { BASE_URL, AUTH_STATES } from "./fixtures/seed-data";

export default async function globalTeardown(): Promise<void> {
  console.log("[e2e-teardown] Starting global teardown...");

  // Check if server is still running
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (!healthRes.ok) {
      console.log("[e2e-teardown] Server not responding — skipping cleanup.");
      return;
    }
  } catch {
    console.log("[e2e-teardown] Server unreachable — skipping cleanup.");
    return;
  }

  // Use admin auth state for cleanup
  let ctx;
  try {
    ctx = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Origin: BASE_URL },
      storageState: AUTH_STATES.admin,
    });
  } catch {
    console.log("[e2e-teardown] Could not create auth context — skipping cleanup.");
    return;
  }

  try {
    // Call cleanup endpoint
    const cleanupRes = await ctx.post("/api/e2e-seed/cleanup");

    if (cleanupRes.ok()) {
      const result = await cleanupRes.json();
      console.log(`[e2e-teardown] Cleanup complete:`, JSON.stringify(result));
    } else if (cleanupRes.status() === 404) {
      console.log(
        "[e2e-teardown] Cleanup endpoint not available (MNM_E2E_SEED not set). " +
          "Test data will persist until next seed run.",
      );
    } else {
      console.warn(
        `[e2e-teardown] Cleanup failed (${cleanupRes.status()}): ${await cleanupRes.text()}`,
      );
    }
  } catch (err) {
    console.warn(`[e2e-teardown] Cleanup error: ${err}`);
  } finally {
    await ctx.dispose();
  }

  console.log("[e2e-teardown] Global teardown complete.");
}
