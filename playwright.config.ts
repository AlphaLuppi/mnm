import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for MnM.
 *
 * Two project types:
 *   - "api": File-content and API tests (no browser needed)
 *   - "browser": Real UI tests with authenticated Chromium session
 *
 * Global setup creates an authenticated session via better-auth sign-up,
 * saved to e2e/.auth/storageState.json for browser tests to reuse.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.MNM_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
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
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/storageState.json",
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
