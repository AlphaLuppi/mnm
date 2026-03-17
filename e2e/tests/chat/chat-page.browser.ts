/**
 * Chat — Chat Page (browser tests)
 *
 * Tests the /chat page: channel list, status filter, channel selection.
 * Requires chat:agent permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { navigateAndWait, waitForTestId } from "../../fixtures/test-helpers";

test.describe("Chat Page — Admin View", () => {
  test("admin can access chat page", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/chat");
    await waitForTestId(adminPage, "chat-s04-page");
  });

  test("displays chat title", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/chat");
    await expect(adminPage.locator('[data-testid="chat-s04-title"]')).toHaveText("Chat", { timeout: 15_000 });
  });

  test("shows empty state or channel list", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/chat");
    const hasChannels = await adminPage.locator('[data-testid="chat-s04-channel-list"]').isVisible().catch(() => false);
    const hasEmpty = await adminPage.locator('[data-testid="chat-s04-empty-channels"]').isVisible().catch(() => false);
    expect(hasChannels || hasEmpty).toBeTruthy();
  });

  test("status filter is available", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/chat");
    await waitForTestId(adminPage, "chat-s04-page");
    await expect(adminPage.locator("text=All statuses").first()).toBeVisible();
  });
});

test.describe("Chat Page — Contributor View", () => {
  test("contributor can access chat (has chat:agent)", async ({ contributorPage }) => {
    await navigateAndWait(contributorPage, "/chat");
    await waitForTestId(contributorPage, "chat-s04-page");
  });
});

test.describe("Chat Page — RBAC Enforcement", () => {
  test("viewer cannot access chat (no chat:agent)", async ({ viewerPage }) => {
    await viewerPage.goto("/chat");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/chat")).toBeTruthy();
  });
});
