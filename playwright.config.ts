import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for MnM.
 *
 * Three project types:
 *   - "api": File-content and API tests (no browser needed)
 *   - "browser": Real UI tests with authenticated Chromium session (admin role)
 *   - "browser-rbac": RBAC-specific UI tests using role-based fixtures
 *
 * Global setup:
 *   - Registers 5 test users (4 roles + cross-tenant admin)
 *   - Seeds companies, agents, projects, workflows via e2e-seed API
 *   - Saves role-based auth states to e2e/.auth/
 *
 * Global teardown:
 *   - Cleans up test data via e2e-seed API (when available)
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.MNM_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
    video: "on",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.browser\.ts/,
    },
    {
      name: "browser",
      testMatch: /.*\.browser\.ts/,
      testIgnore: /.*\.rbac\.browser\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/storageState.json",
      },
    },
    {
      name: "browser-rbac",
      testMatch: /.*\.rbac\.browser\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // No storageState — role-based fixtures create their own contexts
      },
    },
  ],
  /* The server must be running before tests start.
     In CI, Playwright starts it automatically.
     In local dev, reuse the existing `pnpm dev` instance. */
  webServer: process.env.CI
    ? {
        command: "pnpm dev",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
