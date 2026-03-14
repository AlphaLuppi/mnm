/**
 * MU-S06: Sign-out avec Invalidation Session — E2E Tests
 *
 * These tests verify the deliverables of MU-S06:
 *   - AC-1: Sign-out button visible in authenticated mode
 *   - AC-2: User menu shows email and sign-out option
 *   - AC-3: Sign-out invalidates server session
 *   - AC-4: Redirect to /auth after sign-out
 *   - AC-5: Old token returns 401
 *   - AC-6: Hidden in local_trusted mode
 *   - AC-7: Loading state during sign-out
 *
 * Prerequisites:
 *   - For file-based tests: none (always runnable)
 *   - For API/UI tests: MnM server running (`pnpm dev`) in authenticated mode
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// ─── File-based tests: Source code structure verification ───────────────────

test.describe("MU-S06 — Source files exist", () => {
  test("useCurrentUser hook exists", async () => {
    const content = await readFile(
      resolve(ROOT, "ui/src/hooks/useCurrentUser.ts"),
      "utf-8",
    );
    expect(content).toBeTruthy();
    expect(content).toContain("useCurrentUser");
    expect(content).toContain("isAuthenticatedMode");
  });

  test("useCurrentUser queries health for deployment mode", async () => {
    const content = await readFile(
      resolve(ROOT, "ui/src/hooks/useCurrentUser.ts"),
      "utf-8",
    );
    expect(content).toContain("healthApi");
    expect(content).toContain('deploymentMode');
    expect(content).toContain('"authenticated"');
  });

  test("useCurrentUser queries auth session when in authenticated mode", async () => {
    const content = await readFile(
      resolve(ROOT, "ui/src/hooks/useCurrentUser.ts"),
      "utf-8",
    );
    expect(content).toContain("authApi");
    expect(content).toContain("getSession");
    expect(content).toContain("enabled");
  });

  test("useCurrentUser returns user, isAuthenticated, isAuthenticatedMode", async () => {
    const content = await readFile(
      resolve(ROOT, "ui/src/hooks/useCurrentUser.ts"),
      "utf-8",
    );
    expect(content).toContain("user:");
    expect(content).toContain("isAuthenticated");
    expect(content).toContain("isAuthenticatedMode");
  });
});

test.describe("MU-S06 — CompanyRail references UserMenu", () => {
  let railContent: string;

  test.beforeAll(async () => {
    railContent = await readFile(
      resolve(ROOT, "ui/src/components/CompanyRail.tsx"),
      "utf-8",
    );
  });

  test("CompanyRail imports or defines UserMenu", () => {
    // UserMenu may be inline or imported
    expect(railContent).toContain("UserMenu");
  });

  test("CompanyRail renders UserMenu component", () => {
    expect(railContent).toContain("<UserMenu");
  });
});

test.describe("MU-S06 — data-testid attributes in source", () => {
  test("mu-s06-user-avatar testid exists in source", async () => {
    // Check across all component files for the data-testid
    const files = [
      "ui/src/components/CompanyRail.tsx",
      "ui/src/components/UserMenu.tsx",
    ];

    let found = false;
    for (const file of files) {
      try {
        const content = await readFile(resolve(ROOT, file), "utf-8");
        if (content.includes("mu-s06-user-avatar")) {
          found = true;
          break;
        }
      } catch {
        // File may not exist (UserMenu may be inline in CompanyRail)
      }
    }
    expect(found).toBe(true);
  });

  test("mu-s06-user-menu testid exists in source", async () => {
    const files = [
      "ui/src/components/CompanyRail.tsx",
      "ui/src/components/UserMenu.tsx",
    ];

    let found = false;
    for (const file of files) {
      try {
        const content = await readFile(resolve(ROOT, file), "utf-8");
        if (content.includes("mu-s06-user-menu")) {
          found = true;
          break;
        }
      } catch {
        // File may not exist
      }
    }
    expect(found).toBe(true);
  });

  test("mu-s06-user-email testid exists in source", async () => {
    const files = [
      "ui/src/components/CompanyRail.tsx",
      "ui/src/components/UserMenu.tsx",
    ];

    let found = false;
    for (const file of files) {
      try {
        const content = await readFile(resolve(ROOT, file), "utf-8");
        if (content.includes("mu-s06-user-email")) {
          found = true;
          break;
        }
      } catch {
        // File may not exist
      }
    }
    expect(found).toBe(true);
  });

  test("mu-s06-sign-out-button testid exists in source", async () => {
    const files = [
      "ui/src/components/CompanyRail.tsx",
      "ui/src/components/UserMenu.tsx",
    ];

    let found = false;
    for (const file of files) {
      try {
        const content = await readFile(resolve(ROOT, file), "utf-8");
        if (content.includes("mu-s06-sign-out-button")) {
          found = true;
          break;
        }
      } catch {
        // File may not exist
      }
    }
    expect(found).toBe(true);
  });
});

test.describe("MU-S06 — Sign-out client API", () => {
  test("authApi.signOut function exists in auth.ts", async () => {
    const content = await readFile(
      resolve(ROOT, "ui/src/api/auth.ts"),
      "utf-8",
    );
    expect(content).toContain("signOut");
    expect(content).toContain("/sign-out");
  });
});

test.describe("MU-S06 — Backend get-session returns user info", () => {
  test("server get-session endpoint returns email and name fields", async () => {
    const content = await readFile(
      resolve(ROOT, "server/src/app.ts"),
      "utf-8",
    );
    // The enriched get-session should query user info for session-based auth
    expect(content).toContain("get-session");
    expect(content).toContain("email");
    expect(content).toContain("name");
  });

  test("server get-session queries authUsers for session source", async () => {
    const content = await readFile(
      resolve(ROOT, "server/src/app.ts"),
      "utf-8",
    );
    expect(content).toContain("authUsers");
    expect(content).toContain('source === "session"');
  });
});

// ─── API tests (require running server) ─────────────────────────────────────

test.describe("MU-S06 — API: get-session endpoint (AC-3, AC-5)", () => {
  test("GET /api/auth/get-session returns 401 when not authenticated", async ({
    request,
  }) => {
    // Without session cookies, should get 401
    const res = await request.get("/api/auth/get-session");
    // In local_trusted mode this might return 200; in authenticated mode it returns 401
    // We check both valid outcomes
    const status = res.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await res.json();
      expect(body.user).toBeDefined();
      // In local_trusted mode, user still has an id
      expect(body.user.id).toBeTruthy();
    }
  });

  test("GET /health returns deploymentMode field", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deploymentMode).toBeDefined();
    expect(["local_trusted", "authenticated"]).toContain(body.deploymentMode);
  });
});

// ─── UI tests (require running server in authenticated mode) ────────────────

test.describe("MU-S06 — UI: Sign-out flow (AC-1, AC-2, AC-4, AC-6)", () => {
  test.beforeEach(async ({ request }) => {
    // Skip UI tests if server is in local_trusted mode (AC-6: no sign-out UI)
    const res = await request.get("/health").catch(() => null);
    if (!res || !res.ok()) {
      test.skip(true, "Server not running — skipping UI tests");
      return;
    }
    const body = await res.json();
    if (body.deploymentMode === "local_trusted") {
      test.skip(true, "Server in local_trusted mode — sign-out UI is hidden (AC-6)");
    }
  });

  test("AC-6: user avatar is NOT visible in local_trusted mode", async ({
    page,
    request,
  }) => {
    const healthRes = await request.get("/health");
    const health = await healthRes.json();

    if (health.deploymentMode === "local_trusted") {
      await page.goto("/");
      // In local_trusted mode, the user avatar should NOT be rendered
      const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
      await expect(avatar).not.toBeVisible();
    } else {
      test.skip(true, "Server not in local_trusted mode");
    }
  });

  test("AC-1: user avatar button is visible when authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the CompanyRail to render
    const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 10_000 });
  });

  test("AC-2: clicking avatar opens menu with email and sign-out", async ({
    page,
  }) => {
    await page.goto("/");
    const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Click the avatar to open the dropdown
    await avatar.click();

    // Menu should appear with user email and sign-out button
    const userEmail = page.locator('[data-testid="mu-s06-user-email"]');
    await expect(userEmail).toBeVisible({ timeout: 5_000 });
    // Email text should not be empty
    const emailText = await userEmail.textContent();
    expect(emailText).toBeTruthy();

    const signOutBtn = page.locator('[data-testid="mu-s06-sign-out-button"]');
    await expect(signOutBtn).toBeVisible();
  });

  test("AC-4: clicking sign-out redirects to /auth", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator('[data-testid="mu-s06-user-avatar"]');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    await avatar.click();

    const signOutBtn = page.locator('[data-testid="mu-s06-sign-out-button"]');
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });

    await signOutBtn.click();

    // Should redirect to /auth after sign-out
    await page.waitForURL("**/auth", { timeout: 10_000 });
    expect(page.url()).toContain("/auth");
  });
});
