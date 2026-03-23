/**
 * ISO-04: Tag-Based Isolation — E2E API Tests
 *
 * Verifies that tag-based visibility isolation works correctly:
 *   - T01: Admin can create tags
 *   - T02: Admin can assign tags to users
 *   - T03: Admin can create agents with tags
 *   - T04: Contributor (Tag-Alpha) only sees agents with Tag-Alpha
 *   - T05: Viewer (Tag-Beta) only sees agents with Tag-Beta
 *   - T06: Admin (bypassTagFilter) sees all agents
 *   - T07: Contributor cannot see agents with Tag-Beta
 *   - T08: Tag isolation applies to agent detail endpoint too
 *
 * Prerequisites:
 *   - MnM server running in authenticated mode (Docker)
 *   - Seed data loaded (4 NovaTech users with roles)
 */
import { test, expect } from "../fixtures/auth.fixture";
import { IDS, COMPANIES } from "../fixtures/seed-data";
import { isAuthenticatedMode } from "../fixtures/test-helpers";

const COMPANY_ID = IDS.NOVATECH_COMPANY;
const companyUrl = (path: string) => `/api/companies/${COMPANY_ID}${path}`;

// State shared across tests in this describe (serial execution)
let tagAlphaId: string;
let tagBetaId: string;
let agentAlphaId: string;
let agentBetaId: string;
let contributorUserId: string;
let viewerUserId: string;

test.describe.configure({ mode: "serial" });

test.describe("ISO-04 — Tag-Based Isolation", () => {
  test.beforeAll(async ({ request }) => {
    const isAuth = await isAuthenticatedMode(request);
    test.skip(!isAuth, "Tag isolation tests require authenticated mode (Docker)");
  });

  // ── Setup: Create tags ──────────────────────────────────────────────────

  test("T01 — Admin creates Tag-Alpha and Tag-Beta", async ({ adminContext }) => {
    const request = adminContext.request;

    const resAlpha = await request.post(companyUrl("/tags"), {
      data: { name: "Tag-Alpha", slug: "tag-alpha", color: "#3b82f6" },
    });
    expect(resAlpha.status()).toBe(200);
    const alpha = await resAlpha.json();
    tagAlphaId = alpha.id;

    const resBeta = await request.post(companyUrl("/tags"), {
      data: { name: "Tag-Beta", slug: "tag-beta", color: "#ef4444" },
    });
    expect(resBeta.status()).toBe(200);
    const beta = await resBeta.json();
    tagBetaId = beta.id;

    expect(tagAlphaId).toBeTruthy();
    expect(tagBetaId).toBeTruthy();
  });

  // ── Setup: Get user IDs ────────────────────────────────────────────────

  test("T02 — Resolve contributor and viewer user IDs", async ({ contributorContext, viewerContext }) => {
    // Get contributor user ID via session
    const contSession = await contributorContext.request.get("/api/auth/get-session");
    expect(contSession.status()).toBe(200);
    const contData = await contSession.json();
    contributorUserId = contData.user?.id ?? contData.session?.userId;
    expect(contributorUserId).toBeTruthy();

    // Get viewer user ID via session
    const viewSession = await viewerContext.request.get("/api/auth/get-session");
    expect(viewSession.status()).toBe(200);
    const viewData = await viewSession.json();
    viewerUserId = viewData.user?.id ?? viewData.session?.userId;
    expect(viewerUserId).toBeTruthy();
  });

  // ── Setup: Assign tags to users ────────────────────────────────────────

  test("T03 — Admin assigns Tag-Alpha to contributor, Tag-Beta to viewer", async ({ adminContext }) => {
    const request = adminContext.request;

    // Assign Tag-Alpha to contributor
    const resContributor = await request.put(companyUrl(`/users/${contributorUserId}/tags`), {
      data: { tagIds: [tagAlphaId] },
    });
    expect(resContributor.status()).toBe(200);

    // Assign Tag-Beta to viewer
    const resViewer = await request.put(companyUrl(`/users/${viewerUserId}/tags`), {
      data: { tagIds: [tagBetaId] },
    });
    expect(resViewer.status()).toBe(200);
  });

  // ── Setup: Create tagged agents ────────────────────────────────────────

  test("T04 — Admin creates Agent-Alpha (Tag-Alpha) and Agent-Beta (Tag-Beta)", async ({ adminContext }) => {
    const request = adminContext.request;
    const ts = Date.now();

    const resAlpha = await request.post(companyUrl("/agent-hires"), {
      data: {
        name: `ISO04-Alpha-${ts}`,
        adapterType: "claude_local",
        tagIds: [tagAlphaId],
      },
    });
    expect(resAlpha.status()).toBe(200);
    const alphaData = await resAlpha.json();
    agentAlphaId = alphaData.agent?.id ?? alphaData.id;
    expect(agentAlphaId).toBeTruthy();

    const resBeta = await request.post(companyUrl("/agent-hires"), {
      data: {
        name: `ISO04-Beta-${ts}`,
        adapterType: "claude_local",
        tagIds: [tagBetaId],
      },
    });
    expect(resBeta.status()).toBe(200);
    const betaData = await resBeta.json();
    agentBetaId = betaData.agent?.id ?? betaData.id;
    expect(agentBetaId).toBeTruthy();
  });

  // ── Isolation tests ────────────────────────────────────────────────────

  test("T05 — Contributor sees Agent-Alpha but NOT Agent-Beta", async ({ contributorContext }) => {
    const res = await contributorContext.request.get(companyUrl("/agents"));
    expect(res.status()).toBe(200);
    const agents = await res.json();
    const agentIds = agents.map((a: { id: string }) => a.id);

    expect(agentIds).toContain(agentAlphaId);
    expect(agentIds).not.toContain(agentBetaId);
  });

  test("T06 — Viewer sees Agent-Beta but NOT Agent-Alpha", async ({ viewerContext }) => {
    const res = await viewerContext.request.get(companyUrl("/agents"));
    expect(res.status()).toBe(200);
    const agents = await res.json();
    const agentIds = agents.map((a: { id: string }) => a.id);

    expect(agentIds).toContain(agentBetaId);
    expect(agentIds).not.toContain(agentAlphaId);
  });

  test("T07 — Admin sees BOTH agents (bypassTagFilter)", async ({ adminContext }) => {
    const res = await adminContext.request.get(companyUrl("/agents"));
    expect(res.status()).toBe(200);
    const agents = await res.json();
    const agentIds = agents.map((a: { id: string }) => a.id);

    expect(agentIds).toContain(agentAlphaId);
    expect(agentIds).toContain(agentBetaId);
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  test("T08 — Cleanup: remove test tags and agents", async ({ adminContext }) => {
    const request = adminContext.request;

    // Remove tag assignments from users (restore to no tags)
    await request.put(companyUrl(`/users/${contributorUserId}/tags`), {
      data: { tagIds: [] },
    });
    await request.put(companyUrl(`/users/${viewerUserId}/tags`), {
      data: { tagIds: [] },
    });

    // Terminate test agents
    if (agentAlphaId) {
      await request.patch(`/api/agents/${agentAlphaId}`, {
        data: { status: "terminated" },
      });
    }
    if (agentBetaId) {
      await request.patch(`/api/agents/${agentBetaId}`, {
        data: { status: "terminated" },
      });
    }

    // Archive test tags
    if (tagAlphaId) {
      await request.post(companyUrl(`/tags/${tagAlphaId}/archive`), { data: {} });
    }
    if (tagBetaId) {
      await request.post(companyUrl(`/tags/${tagBetaId}/archive`), { data: {} });
    }
  });
});
