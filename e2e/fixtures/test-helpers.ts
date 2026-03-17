/**
 * Test Helpers — Common utilities for MnM E2E tests.
 *
 * Provides reusable functions for:
 *   - API request helpers
 *   - Audit event assertions
 *   - WebSocket helpers
 *   - Wait / retry utilities
 *   - Docker availability checks
 */
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { IDS, BASE_URL } from "./seed-data";

// ─── API Request Helpers ────────────────────────────────────────────────────

/**
 * Wait for the server to respond to the health endpoint.
 * Used in setup and to skip tests when the server is down.
 */
export async function waitForServer(maxWaitMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Check if the server is in authenticated deployment mode (not local_trusted).
 * Tests that require real auth should skip when running in local_trusted mode.
 */
export async function isAuthenticatedMode(request: APIRequestContext): Promise<boolean> {
  const res = await request.get("/api/health");
  if (!res.ok()) return false;
  const body = await res.json();
  return body.deploymentMode !== "local_trusted";
}

/**
 * Check if Docker is available for container-related tests.
 */
export async function isDockerAvailable(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get("/api/health");
    if (!res.ok()) return false;
    const body = await res.json();
    return body.docker?.available === true;
  } catch {
    return false;
  }
}

/**
 * Skip test if server is not running.
 */
export async function skipIfServerDown(request: APIRequestContext): Promise<void> {
  const res = await request.get("/api/health").catch(() => null);
  if (!res || !res.ok()) {
    // @ts-expect-error — test.skip is available in Playwright context
    test.skip(true, "Server not running");
  }
}

// ─── Audit Event Assertions ─────────────────────────────────────────────────

/**
 * Assert that an audit event was emitted for the given action.
 * Polls the audit API with a short retry for eventual consistency.
 */
export async function assertAuditEvent(
  request: APIRequestContext,
  companyId: string,
  expectedAction: string,
  expectedTargetType?: string,
  maxRetries = 3,
): Promise<Record<string, unknown>> {
  let lastBody: Record<string, unknown> = {};

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await request.get(`/api/companies/${companyId}/audit`, {
      params: { action: expectedAction, limit: "5" },
    });

    if (res.ok()) {
      const body = await res.json();
      lastBody = body;
      const events = (body as { events?: unknown[] }).events ?? [];

      if (events.length > 0) {
        const event = events[0] as Record<string, unknown>;
        expect(event.action).toBe(expectedAction);
        if (expectedTargetType) {
          expect(event.targetType).toBe(expectedTargetType);
        }
        return event;
      }
    }

    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error(
    `Audit event "${expectedAction}" not found after ${maxRetries} attempts. Last response: ${JSON.stringify(lastBody)}`,
  );
}

/**
 * Assert that a specific audit event does NOT exist (for negative RBAC tests).
 */
export async function assertNoAuditEvent(
  request: APIRequestContext,
  companyId: string,
  unexpectedAction: string,
): Promise<void> {
  const res = await request.get(`/api/companies/${companyId}/audit`, {
    params: { action: unexpectedAction, limit: "1" },
  });

  if (res.ok()) {
    const body = await res.json();
    const events = (body as { events?: unknown[] }).events ?? [];
    expect(events.length).toBe(0);
  }
}

// ─── RBAC Helpers ───────────────────────────────────────────────────────────

/**
 * Test matrix helper — generates test cases for each role.
 */
export interface RbacTestCase {
  role: "admin" | "manager" | "contributor" | "viewer";
  fixture: "adminPage" | "managerPage" | "contributorPage" | "viewerPage";
  expectedStatus: number;
}

export function rbacMatrix(
  expectations: Record<"admin" | "manager" | "contributor" | "viewer", number>,
): RbacTestCase[] {
  return [
    { role: "admin", fixture: "adminPage", expectedStatus: expectations.admin },
    { role: "manager", fixture: "managerPage", expectedStatus: expectations.manager },
    { role: "contributor", fixture: "contributorPage", expectedStatus: expectations.contributor },
    { role: "viewer", fixture: "viewerPage", expectedStatus: expectations.viewer },
  ];
}

// ─── Page Helpers ───────────────────────────────────────────────────────────

/**
 * Wait for a page to finish loading (networkidle).
 */
export async function waitForPageLoad(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout });
}

/**
 * Navigate to a page and wait for it to be ready.
 */
export async function navigateAndWait(page: Page, path: string, timeout = 15_000): Promise<void> {
  await page.goto(path);
  await waitForPageLoad(page, timeout);
}

/**
 * Wait for a data-testid element to be visible.
 */
export async function waitForTestId(
  page: Page,
  testId: string,
  timeout = 10_000,
): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({ timeout });
}

// ─── Data Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a unique test identifier to avoid collisions.
 */
export function uniqueTestId(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get the NovaTech company ID (convenience).
 */
export function getNovatechCompanyId(): string {
  return IDS.NOVATECH_COMPANY;
}

/**
 * Get the Atelier company ID (convenience).
 */
export function getAtelierCompanyId(): string {
  return IDS.ATELIER_COMPANY;
}
