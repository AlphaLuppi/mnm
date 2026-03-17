/**
 * MU-S06 — Real browser tests for sign-out flow.
 *
 * These run in the "browser" project with an authenticated Chromium session
 * (storageState from global-setup). Requires a running MnM server in
 * "authenticated" deployment mode.
 */
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/health").catch(() => null);
  if (!res || !res.ok()) {
    test.skip(true, "Server not running");
    return;
  }
  const body = await res.json();
  if (body.deploymentMode === "local_trusted") {
    test.skip(true, "Server in local_trusted mode — sign-out UI hidden");
  }
});

test("AC-1: user avatar is visible when authenticated", async ({ page }) => {
  await page.goto("/");
  const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
  await expect(avatar).toBeVisible({ timeout: 15_000 });
});

test("AC-2: clicking avatar opens menu with email and sign-out", async ({
  page,
}) => {
  await page.goto("/");
  const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
  await expect(avatar).toBeVisible({ timeout: 15_000 });

  await avatar.click();

  const userEmail = page.locator('[data-testid="mu-s06-user-email"]');
  await expect(userEmail).toBeVisible({ timeout: 5_000 });
  const emailText = await userEmail.textContent();
  expect(emailText).toBeTruthy();

  const signOutBtn = page.locator('[data-testid="mu-s06-sign-out-button"]');
  await expect(signOutBtn).toBeVisible();
});

test("AC-4: clicking sign-out redirects to /auth", async ({ page }) => {
  await page.goto("/");
  const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
  await expect(avatar).toBeVisible({ timeout: 15_000 });

  await avatar.click();

  const signOutBtn = page.locator('[data-testid="mu-s06-sign-out-button"]');
  await expect(signOutBtn).toBeVisible({ timeout: 5_000 });

  await signOutBtn.click();

  await page.waitForURL("**/auth", { timeout: 10_000 });
  expect(page.url()).toContain("/auth");
});

test("AC-6: user avatar is NOT visible in local_trusted mode", async ({
  page,
  request,
}) => {
  const healthRes = await request.get("/api/health");
  const health = await healthRes.json();

  if (health.deploymentMode !== "local_trusted") {
    test.skip(true, "Server not in local_trusted mode");
    return;
  }

  await page.goto("/");
  const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
  await expect(avatar).not.toBeVisible({ timeout: 5_000 });
});
