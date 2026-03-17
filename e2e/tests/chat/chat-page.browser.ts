/**
 * Chat — Chat Page (browser tests)
 *
 * Tests the /chat page: channel list, status filter, channel selection.
 * Requires chat:agent permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Chat Page — Admin View", () => {
  test("admin can access chat page", async ({ adminPage }) => {
    await adminPage.goto("/chat");
    await expect(adminPage.locator('[data-testid="chat-s04-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test("displays chat title", async ({ adminPage }) => {
    await adminPage.goto("/chat");
    await expect(adminPage.locator('[data-testid="chat-s04-title"]')).toHaveText("Chat", { timeout: 15_000 });
  });

  test("shows empty state or channel list", async ({ adminPage }) => {
    await adminPage.goto("/chat");
    await adminPage.waitForTimeout(3_000);
    const hasChannels = await adminPage.locator('[data-testid="chat-s04-channel-list"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="chat-s04-empty-channels"]').isVisible().catch(() => false);
    expect(hasChannels || hasEmpty).toBeTruthy();
  });

  test("status filter is available", async ({ adminPage }) => {
    await adminPage.goto("/chat");
    await expect(adminPage.locator('[data-testid="chat-s04-page"]')).toBeVisible({ timeout: 15_000 });
    // Filter select should be present
    await expect(adminPage.locator("text=All statuses").first()).toBeVisible();
  });
});

test.describe("Chat Page — RBAC", () => {
  test("viewer cannot access chat (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/chat");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/chat")).toBeTruthy();
  });
});
