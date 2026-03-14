import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E configuration for MnM.
 *
 * Tests in e2e/tests/ run against the dev server (port 3100 by default).
 * For API-only tests the "default" project uses no browser — it relies on
 * Playwright's `request` fixture exclusively.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.MNM_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.spec\.ts/,
      use: {
        // API tests don't need a browser
      },
    },
  ],
  /* The server must be running before tests start.
     In CI, Playwright starts it automatically.
     In local dev, reuse the existing `pnpm dev` instance. */
  webServer: process.env.CI
    ? {
        command: "pnpm dev",
        url: "http://localhost:3100/health",
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
