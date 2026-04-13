/**
 * Multi-Tenant Isolation — E2E Tests
 *
 * Verifies that tenant data is strictly isolated between companies.
 * Two seeded companies:
 *   - NovaTech Solutions (prefix: NTS, id: a1000000-...)
 *   - Atelier Numerique  (prefix: ATN, id: a2000000-...)
 *
 * Tests work in both local_trusted and authenticated modes.
 * In local_trusted: same user, but API responses scoped by companyId in path.
 * In authenticated: separate users with distinct company memberships.
 */
import { test, expect, IDS, COMPANIES, AGENTS } from "../../fixtures/auth.fixture";
import {
  navigateAndWait,
  getNovatechCompanyId,
  getAtelierCompanyId,
  uniqueTestId,
} from "../../fixtures/test-helpers";

// ─── Constants ─────────────────────────────────────────────────────────────

const NOVATECH_ID = getNovatechCompanyId();
const ATELIER_ID = getAtelierCompanyId();
const NOVATECH_AGENT_NAMES = AGENTS.map((a) => a.name);

// ─── Test 1: API-level data isolation per company ─────────────────────────

test.describe("Tenant Isolation — API Data Scoping", () => {
  test("NovaTech agents endpoint returns seeded agents", async ({ adminPage }) => {
    const res = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/agents`);
    expect(res.status()).toBe(200);
    const agents = await res.json();
    expect(agents.length).toBeGreaterThanOrEqual(NOVATECH_AGENT_NAMES.length);

    const names = agents.map((a: { name: string }) => a.name);
    for (const expectedName of NOVATECH_AGENT_NAMES) {
      expect(names, `Expected agent "${expectedName}" in NovaTech`).toContain(expectedName);
    }
  });

  test("Atelier agents endpoint returns NO NovaTech agents", async ({ adminPage }) => {
    const res = await adminPage.request.get(`/api/companies/${ATELIER_ID}/agents`);
    // In local_trusted, user has access to all companies → should return 200 but with Atelier-scoped data
    // In authenticated, if user is not a member of Atelier → should return 403
    if (res.status() === 403) {
      // Expected in authenticated mode — cross-company access denied
      return;
    }
    expect(res.status()).toBe(200);
    const agents = await res.json();
    const names = agents.map((a: { name: string }) => a.name);

    for (const novatechName of NOVATECH_AGENT_NAMES) {
      expect(names, `NovaTech agent "${novatechName}" should NOT appear in Atelier`).not.toContain(novatechName);
    }
  });

  test("NovaTech issues endpoint works", async ({ adminPage }) => {
    const res = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/issues`);
    expect(res.status()).toBe(200);
    const issues = await res.json();
    expect(Array.isArray(issues)).toBe(true);
  });

  test("Atelier issues endpoint returns NO NovaTech issues", async ({ adminPage }) => {
    // Create an issue in NovaTech first
    const createRes = await adminPage.request.post(`/api/companies/${NOVATECH_ID}/issues`, {
      data: { title: `Isolation Test ${uniqueTestId("iso")}`, priority: "medium" },
    });

    let createdIssueTitle: string | null = null;
    if (createRes.ok()) {
      const issue = await createRes.json();
      createdIssueTitle = issue.title;

      // Now check Atelier — the NovaTech issue should NOT appear
      const atelierRes = await adminPage.request.get(`/api/companies/${ATELIER_ID}/issues`);
      if (atelierRes.ok()) {
        const atelierIssues = await atelierRes.json();
        const titles = atelierIssues.map((i: { title: string }) => i.title);
        expect(titles).not.toContain(createdIssueTitle);
      }
      // If 403, that's fine — cross-company access denied

      // Cleanup
      await adminPage.request.delete(`/api/companies/${NOVATECH_ID}/issues/${issue.id}`);
    }
  });
});

// ─── Test 2: Agent CRUD isolation ─────────────────────────────────────────

test.describe("Tenant Isolation — Agent CRUD", () => {
  test("agent created in NovaTech does not appear in Atelier", async ({ adminPage }) => {
    const agentName = `E2E-Isolation-${uniqueTestId("agent")}`;

    // Create agent in NovaTech
    const createRes = await adminPage.request.post(`/api/companies/${NOVATECH_ID}/agents`, {
      data: {
        name: agentName,
        title: "E2E Test Agent",
        adapterType: "claude_local",
        adapterConfig: {},
      },
    });
    expect(createRes.ok(), `Failed to create agent: ${createRes.status()}`).toBeTruthy();
    const agent = await createRes.json();

    try {
      // Verify it appears in NovaTech
      const ntRes = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/agents`);
      expect(ntRes.ok()).toBeTruthy();
      const ntAgents = await ntRes.json();
      expect(ntAgents.some((a: { id: string }) => a.id === agent.id)).toBe(true);

      // Verify it does NOT appear in Atelier
      const atRes = await adminPage.request.get(`/api/companies/${ATELIER_ID}/agents`);
      if (atRes.ok()) {
        const atAgents = await atRes.json();
        expect(atAgents.some((a: { id: string }) => a.id === agent.id)).toBe(false);
      }
      // 403 is also acceptable (cross-company denied)
    } finally {
      // Cleanup
      await adminPage.request.delete(`/api/companies/${NOVATECH_ID}/agents/${agent.id}`);
    }
  });
});

// ─── Test 3: Cross-company agent detail access ────────────────────────────

test.describe("Tenant Isolation — Cross-Company Detail Access", () => {
  test("in authenticated mode, accessing a NovaTech agent via Atelier path is denied", async ({ adminPage }) => {
    // This test validates cross-company isolation in authenticated mode.
    // In local_trusted, assertCompanyMembership bypasses for local_implicit actors,
    // so this test is skipped (isolation is enforced by auth, not by dev mode).
    const mode = process.env.E2E_DEPLOYMENT_MODE;
    test.skip(mode === "local_trusted", "Cross-company auth isolation not enforced in local_trusted dev mode");

    const ntRes = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/agents`);
    expect(ntRes.ok()).toBeTruthy();
    const ntAgents = await ntRes.json();
    expect(ntAgents.length).toBeGreaterThan(0);
    const novatechAgentId = ntAgents[0].id;

    const crossRes = await adminPage.request.get(
      `/api/companies/${ATELIER_ID}/agents/${novatechAgentId}`,
    );
    expect([403, 404]).toContain(crossRes.status());
  });
});

// ─── Test 4: Agent detail API returns correct company-scoped data ──────────

test.describe("Tenant Isolation — Agent Detail Scoping", () => {
  test("each NovaTech agent belongs to NovaTech company", async ({ adminPage }) => {
    const ntRes = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/agents`);
    expect(ntRes.ok()).toBeTruthy();
    const agents = await ntRes.json();
    expect(agents.length).toBeGreaterThan(0);

    // Every agent returned should have companyId matching NovaTech
    for (const agent of agents) {
      expect(agent.companyId, `Agent ${agent.name} should belong to NovaTech`).toBe(NOVATECH_ID);
    }
  });
});

// ─── Test 5: Heartbeat runs scoped per company ────────────────────────────

test.describe("Tenant Isolation — Heartbeat Runs", () => {
  test("heartbeat-runs endpoint is company-scoped", async ({ adminPage }) => {
    const ntRes = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/heartbeat-runs`);
    expect(ntRes.ok()).toBeTruthy();
    const ntRuns = await ntRes.json();
    expect(Array.isArray(ntRuns)).toBe(true);

    // If we also have access to Atelier, its runs should be separate
    const atRes = await adminPage.request.get(`/api/companies/${ATELIER_ID}/heartbeat-runs`);
    if (atRes.ok()) {
      const atRuns = await atRes.json();
      // NovaTech run IDs should not appear in Atelier
      const ntIds = new Set(ntRuns.map((r: { id: string }) => r.id));
      for (const atRun of atRuns) {
        expect(ntIds.has(atRun.id)).toBe(false);
      }
    }
  });
});

// ─── Test 6: Labels scoped per company ────────────────────────────────────

test.describe("Tenant Isolation — Labels", () => {
  test("label created in NovaTech does not appear in Atelier", async ({ adminPage }) => {
    const labelName = `test-label-${uniqueTestId("lbl")}`;

    // Create label in NovaTech
    const createRes = await adminPage.request.post(`/api/companies/${NOVATECH_ID}/labels`, {
      data: { name: labelName, color: "#ff0000" },
    });
    expect(createRes.ok()).toBeTruthy();
    const label = await createRes.json();

    try {
      // Verify it appears in NovaTech
      const ntRes = await adminPage.request.get(`/api/companies/${NOVATECH_ID}/labels`);
      expect(ntRes.ok()).toBeTruthy();
      const ntLabels = await ntRes.json();
      expect(ntLabels.some((l: { id: string }) => l.id === label.id)).toBe(true);

      // Verify it does NOT appear in Atelier
      const atRes = await adminPage.request.get(`/api/companies/${ATELIER_ID}/labels`);
      if (atRes.ok()) {
        const atLabels = await atRes.json();
        expect(atLabels.some((l: { id: string }) => l.id === label.id)).toBe(false);
      }
    } finally {
      await adminPage.request.delete(`/api/companies/${NOVATECH_ID}/labels/${label.id}`);
    }
  });
});
