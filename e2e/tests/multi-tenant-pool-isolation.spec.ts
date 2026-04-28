/**
 * Multi-Tenant Pool Isolation — verifies that the Postgres tenant context
 * (`app.current_company_id`) does NOT leak between requests of different
 * companies that share the same pooled connection.
 *
 * Failure mode being prevented:
 *   1. companyA request runs `set_config('app.current_company_id', companyA, ...)`
 *      on connection #N. Handler completes; connection returned to the pool.
 *   2. companyB request immediately checks out connection #N. If the previous
 *      tenant context was not cleared, every RLS-filtered query in this
 *      handler still sees `current_setting('app.current_company_id')` =
 *      companyA → CRITICAL data leak.
 *
 * What this test verifies:
 *   - T1: companyA admin reads its own agents → succeeds, returns companyA data.
 *   - T2: companyB admin (different tenant) reads its own agents → must ONLY
 *     see companyB data; never sees companyA data even if the pool reuses the
 *     same connection.
 *   - T3: cross-tenant probe — companyB tries to access a companyA-scoped
 *     resource directly (by URL). Must be DENIED (403/404/membership check),
 *     never returns companyA data.
 *   - T4: hammering both tenants alternately ("ping-pong") for N iterations
 *     to maximise the probability of connection reuse and surface any leak.
 *
 * Pre-requisites:
 *   - Authenticated mode (Docker compose up).
 *   - Seed data loaded: TestCorp-A (NOVATECH) admin + TestCorp-B (ATELIER) admin.
 *
 * If this test fails, it means either:
 *   (a) `clearTenantContext` is not called in a finally-equivalent path, OR
 *   (b) `set_config(..., is_local=true)` is being used outside a transaction and
 *       therefore does not protect against connection reuse, OR
 *   (c) `assertCompanyMembership` is not enforced on the targeted route.
 */
import { test, expect } from "../fixtures/auth.fixture";
import { IDS, COMPANIES } from "../fixtures/seed-data";
import { isAuthenticatedMode } from "../fixtures/test-helpers";

const COMPANY_A = IDS.NOVATECH_COMPANY;
const COMPANY_B = IDS.ATELIER_COMPANY;

const urlA = (path: string) => `/api/companies/${COMPANY_A}${path}`;
const urlB = (path: string) => `/api/companies/${COMPANY_B}${path}`;

test.describe.configure({ mode: "serial" });

test.describe("multi-tenant pool isolation — RLS context cleanup", () => {
  test.beforeAll(async ({ request }) => {
    const isAuth = await isAuthenticatedMode(request);
    test.skip(
      !isAuth,
      "Pool isolation test requires authenticated mode (Docker) — skipping in local_trusted",
    );
  });

  test("T1 — companyA admin sees only companyA agents", async ({ adminContext }) => {
    const res = await adminContext.request.get(urlA("/agents"));
    expect(res.status()).toBe(200);
    const agents = (await res.json()) as Array<{ id: string; companyId: string }>;
    expect(Array.isArray(agents)).toBe(true);
    // Every returned agent must belong to companyA — no leak from companyB.
    for (const agent of agents) {
      // companyId may be omitted from the API shape; if present, must match.
      if (agent.companyId !== undefined) {
        expect(agent.companyId).toBe(COMPANY_A);
      }
    }
  });

  test("T2 — companyB admin sees only companyB agents (no leak from companyA)", async ({
    atelierAdminContext,
  }) => {
    const res = await atelierAdminContext.request.get(urlB("/agents"));
    expect(res.status()).toBe(200);
    const agents = (await res.json()) as Array<{ id: string; companyId: string; name?: string }>;
    expect(Array.isArray(agents)).toBe(true);
    for (const agent of agents) {
      if (agent.companyId !== undefined) {
        expect(agent.companyId).toBe(COMPANY_B);
      }
    }
    // Sentinel: companyB should not see any of the well-known companyA agent IDs.
    const companyAIds = new Set([
      IDS.AGENT_CLAUDE_STRATEGE,
      IDS.AGENT_MARCUS_ARCHITECTE,
      IDS.AGENT_LUNA_DEVELOPPEUR,
      IDS.AGENT_ARIA_QA,
      IDS.AGENT_PHOENIX_DEVOPS,
    ]);
    for (const agent of agents) {
      expect(companyAIds.has(agent.id)).toBe(false);
    }
  });

  test("T3 — companyB admin attempting to read companyA scope is DENIED", async ({
    atelierAdminContext,
  }) => {
    const res = await atelierAdminContext.request.get(urlA("/agents"));
    // Must be denied by assertCompanyMembership — 403 or 404 acceptable, but
    // crucially NOT 200 with companyA data.
    expect([401, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      // Defensive: even if the membership middleware mis-fires, RLS must save us.
      const agents = (await res.json()) as unknown[];
      expect(agents).toEqual([]);
    }
  });

  test("T4 — ping-pong between tenants stresses pool reuse — no cross-leak", async ({
    adminContext,
    atelierAdminContext,
  }) => {
    // 20 alternating requests maximise the chance that the pool reuses a
    // connection between tenants. Each pair checks isolation in BOTH directions.
    const ITERATIONS = 20;

    for (let i = 0; i < ITERATIONS; i++) {
      // Tenant A request — must succeed and only see companyA data.
      const resA = await adminContext.request.get(urlA("/agents"));
      expect(resA.status(), `iteration ${i}: companyA agents request`).toBe(200);
      const agentsA = (await resA.json()) as Array<{ id: string; companyId?: string }>;
      for (const a of agentsA) {
        if (a.companyId !== undefined) {
          expect(a.companyId, `iteration ${i}: leaked companyId in A`).toBe(COMPANY_A);
        }
      }

      // Tenant B request — must succeed and only see companyB data, even though
      // the pool likely just returned a connection that had companyA's
      // app.current_company_id set on it.
      const resB = await atelierAdminContext.request.get(urlB("/agents"));
      expect(resB.status(), `iteration ${i}: companyB agents request`).toBe(200);
      const agentsB = (await resB.json()) as Array<{ id: string; companyId?: string }>;
      for (const b of agentsB) {
        if (b.companyId !== undefined) {
          expect(b.companyId, `iteration ${i}: leaked companyId in B`).toBe(COMPANY_B);
        }
      }
    }
  });

  test("T5 — sentinel: cross-tenant probe with parallel-burst", async ({
    adminContext,
    atelierAdminContext,
  }) => {
    // Fire a burst of parallel requests across both tenants — Promise.all forces
    // the pool to hand out multiple connections concurrently, then return them
    // back. Subsequent rounds must still see only their own tenant.
    const round = async () => {
      const [a, b] = await Promise.all([
        adminContext.request.get(urlA("/agents")),
        atelierAdminContext.request.get(urlB("/agents")),
      ]);
      expect(a.status()).toBe(200);
      expect(b.status()).toBe(200);
      const dataA = (await a.json()) as Array<{ id: string; companyId?: string }>;
      const dataB = (await b.json()) as Array<{ id: string; companyId?: string }>;
      for (const x of dataA) if (x.companyId !== undefined) expect(x.companyId).toBe(COMPANY_A);
      for (const x of dataB) if (x.companyId !== undefined) expect(x.companyId).toBe(COMPANY_B);
      return { dataA, dataB };
    };

    for (let r = 0; r < 5; r++) {
      const { dataA, dataB } = await round();
      // Sanity: companyA should have at least the seeded agents.
      expect(dataA.length).toBeGreaterThan(0);
      // Cross-id leak check: no agent from one tenant should appear in the other.
      const idsA = new Set(dataA.map((a) => a.id));
      const idsB = new Set(dataB.map((b) => b.id));
      for (const id of idsA) expect(idsB.has(id)).toBe(false);
      for (const id of idsB) expect(idsA.has(id)).toBe(false);
    }
  });
});
