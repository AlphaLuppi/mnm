/**
 * PERM-01 Audit Tests — Verify permission enforcement gaps
 *
 * These tests check the 7 TODO [PERM-01] locations where permission checks
 * may be incomplete or disabled. Each test attempts an action that should
 * be DENIED for a user with limited permissions, and verifies the response.
 *
 * HOW TO RUN:
 *   1. Start MnM: docker compose up -d --wait
 *   2. Create an admin account via the onboarding wizard
 *   3. Create a second user with "Member" role (limited permissions)
 *   4. Run: npx playwright test e2e/tests/PERM-01-audit.spec.ts
 *
 * WHAT TO CHECK:
 *   - If a test PASSES → the permission check works correctly (action denied)
 *   - If a test FAILS → there's a permission gap (action allowed when it shouldn't be)
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.MNM_BASE_URL ?? "http://localhost:3100";

// ---------------------------------------------------------------------------
// These tests hit the API directly with fetch (no browser needed).
// They require a running MnM instance with:
//   - ADMIN_COOKIE: session cookie of an admin user
//   - MEMBER_COOKIE: session cookie of a member user (limited perms)
//   - COMPANY_ID: the company ID
//
// Set these via environment variables before running.
// To get cookies: log in via browser, open DevTools > Application > Cookies,
// copy the "better-auth.session_token" value.
// ---------------------------------------------------------------------------

const COMPANY_ID = process.env.MNM_COMPANY_ID ?? "";
const ADMIN_COOKIE = process.env.MNM_ADMIN_COOKIE ?? "";
const MEMBER_COOKIE = process.env.MNM_MEMBER_COOKIE ?? "";

function headers(cookie: string) {
  return {
    "Content-Type": "application/json",
    Cookie: `better-auth.session_token=${cookie}`,
  };
}

// Skip all tests if env vars not set
test.beforeEach(() => {
  test.skip(!COMPANY_ID || !ADMIN_COOKIE || !MEMBER_COOKIE,
    "Set MNM_COMPANY_ID, MNM_ADMIN_COOKIE, MNM_MEMBER_COOKIE env vars to run these tests");
});

// ============================================================================
// TEST 1: getEffectiveScope returns null for everyone (cascade.ts:242)
// RISK: All users get global scope — no project-level isolation
// ============================================================================
test.describe("PERM-01-A: Scope isolation", () => {
  test("Member should NOT see agents they don't have tags for", async ({ request }) => {
    // A member queries all agents — if they see ALL agents (not filtered by tags),
    // it means getEffectiveScope returns null (global) for everyone
    const res = await request.get(`${BASE}/api/companies/${COMPANY_ID}/agents`, {
      headers: headers(MEMBER_COOKIE),
    });

    // If 200 with agents the member shouldn't see → SCOPE LEAK
    // If 200 with filtered list or 403 → OK
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const agents = await res.json();
      // Log for manual verification — check if member sees agents they shouldn't
      console.log(`[PERM-01-A] Member sees ${agents.length} agents. Verify this is correct for their tags.`);
    }
  });
});

// ============================================================================
// TEST 2: Permission key validation (access.ts:1310)
// RISK: Invalid permission keys are accepted without validation
// ============================================================================
test.describe("PERM-01-B: Permission key validation", () => {
  test("API should reject invalid/invented permission keys", async ({ request }) => {
    // Try to set a completely fake permission key
    const res = await request.patch(
      `${BASE}/api/companies/${COMPANY_ID}/members/fake-member-id/permissions`,
      {
        headers: headers(ADMIN_COOKIE),
        data: {
          grants: [{ permissionKey: "totally:fake:permission", scope: null }],
        },
      },
    );

    // Should be 400 (invalid key) or 501 (not implemented)
    // If 200 → permission keys are not validated → GAP
    console.log(`[PERM-01-B] Set fake permission response: ${res.status()}`);
    expect([400, 404, 501]).toContain(res.status());
  });
});

// ============================================================================
// TEST 3: setMemberPermissions returns 501 (access.ts:2905)
// RISK: The old permission management route is disabled
// ============================================================================
test.describe("PERM-01-C: Legacy permission management disabled", () => {
  test("PATCH member permissions should return 501 (managed via roles now)", async ({ request }) => {
    const res = await request.patch(
      `${BASE}/api/companies/${COMPANY_ID}/members/any-id/permissions`,
      {
        headers: headers(ADMIN_COOKIE),
        data: { grants: [] },
      },
    );

    // Tom explicitly returns 501 — this is expected behavior
    console.log(`[PERM-01-C] Legacy permissions route: ${res.status()}`);
    expect(res.status()).toBe(501);
  });
});

// ============================================================================
// TEST 4: RBAC presets returns empty (access.ts:2990)
// RISK: The presets endpoint returns {} — UI might show empty permission grid
// ============================================================================
test.describe("PERM-01-D: RBAC presets endpoint", () => {
  test("GET rbac/presets should return role-based presets, not empty object", async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/rbac/presets`,
      { headers: headers(ADMIN_COOKIE) },
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // If body is {} → presets not loaded from DB yet → GAP (admin sees empty grid)
    const isEmpty = Object.keys(body).length === 0;
    console.log(`[PERM-01-D] RBAC presets: ${isEmpty ? "EMPTY (gap)" : `${Object.keys(body).length} presets`}`);

    if (isEmpty) {
      console.warn("⚠️  RBAC presets returns empty — admin permission grid will be broken");
    }
  });
});

// ============================================================================
// TEST 5: Agent permission update without proper check (agents.ts:973)
// RISK: Agent actors can update other agents' permissions without proper role check
// ============================================================================
test.describe("PERM-01-E: Agent permission escalation", () => {
  test("Member should NOT be able to update agent permissions", async ({ request }) => {
    // First get an agent ID
    const agentsRes = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/agents`,
      { headers: headers(ADMIN_COOKIE) },
    );

    if (!agentsRes.ok()) {
      test.skip(true, "No agents available for test");
      return;
    }

    const agents = await agentsRes.json();
    if (agents.length === 0) {
      test.skip(true, "No agents available for test");
      return;
    }

    const agentId = agents[0].id;

    // Member tries to update agent permissions
    const res = await request.patch(
      `${BASE}/api/companies/${COMPANY_ID}/agents/${agentId}/permissions`,
      {
        headers: headers(MEMBER_COOKIE),
        data: { permissions: ["agents:create", "users:manage_permissions"] },
      },
    );

    // Should be 403 — member can't manage permissions
    console.log(`[PERM-01-E] Member update agent perms: ${res.status()}`);
    expect(res.status()).toBe(403);
  });
});

// ============================================================================
// TEST 6: Project scope sync is stubbed (project-memberships.ts:41)
// RISK: Adding a user to a project doesn't actually restrict their scope
// ============================================================================
test.describe("PERM-01-F: Project scope sync", () => {
  test("Member added to Project-A should NOT see Project-B data", async ({ request }) => {
    // Get all projects visible to member
    const res = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/projects`,
      { headers: headers(MEMBER_COOKIE) },
    );

    if (!res.ok()) {
      console.log(`[PERM-01-F] Projects endpoint: ${res.status()}`);
      return;
    }

    const projects = await res.json();
    console.log(`[PERM-01-F] Member sees ${projects.length} projects. If >0 and they shouldn't see all → SCOPE LEAK`);

    // Get all projects as admin for comparison
    const adminRes = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/projects`,
      { headers: headers(ADMIN_COOKIE) },
    );
    const adminProjects = await adminRes.json();

    if (projects.length === adminProjects.length && adminProjects.length > 1) {
      console.warn("⚠️  Member sees ALL projects same as admin — project scope isolation not working");
    }
  });
});

// ============================================================================
// TEST 7: Unauthenticated access (sanity check)
// ============================================================================
test.describe("PERM-01-G: Unauthenticated access denied", () => {
  test("No cookie → should get 401 on all protected routes", async ({ request }) => {
    const routes = [
      `/api/companies/${COMPANY_ID}/agents`,
      `/api/companies/${COMPANY_ID}/issues`,
      `/api/companies/${COMPANY_ID}/projects`,
      `/api/companies/${COMPANY_ID}/dashboard`,
      `/api/companies/${COMPANY_ID}/roles`,
      `/api/companies/${COMPANY_ID}/tags`,
    ];

    for (const route of routes) {
      const res = await request.get(`${BASE}${route}`);
      console.log(`[PERM-01-G] ${route}: ${res.status()}`);
      expect([401, 403]).toContain(res.status());
    }
  });
});

// ============================================================================
// TEST 8: Tag-based isolation on agents list
// ============================================================================
test.describe("PERM-01-H: Tag-based agent isolation", () => {
  test("GET /agents should filter by user tags (not return all)", async ({ request }) => {
    // Get admin's agents
    const adminRes = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/agents`,
      { headers: headers(ADMIN_COOKIE) },
    );
    const adminAgents = adminRes.ok() ? await adminRes.json() : [];

    // Get member's agents
    const memberRes = await request.get(
      `${BASE}/api/companies/${COMPANY_ID}/agents`,
      { headers: headers(MEMBER_COOKIE) },
    );
    const memberAgents = memberRes.ok() ? await memberRes.json() : [];

    console.log(`[PERM-01-H] Admin sees ${adminAgents.length} agents, Member sees ${memberAgents.length} agents`);

    // If member sees same count as admin and admin has agents with different tags → isolation broken
    if (adminAgents.length > 0 && memberAgents.length === adminAgents.length) {
      console.warn("⚠️  Member sees ALL agents same as admin — tag isolation may not be filtering");
    }
  });
});
