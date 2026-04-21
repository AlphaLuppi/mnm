import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { buildGateHelpers } from "../governed-workflows-helpers.js";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";

describe("buildGateHelpers", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a01";
  const companyB = "00000000-0000-0000-0000-000000000b01";
  const agentA = "00000000-0000-0000-0000-000000000a10";
  const agentB = "00000000-0000-0000-0000-000000000b10";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES
      (${companyA}, 'A-Helpers', 'GWHLA'),
      (${companyB}, 'B-Helpers', 'GWHLB')
      ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyA}, 'hello-world', 'v1')`);
    // Seed one agent per company (traces require agent_id FK)
    await db.execute(sql`INSERT INTO agents (id, company_id, name, adapter_type)
      VALUES (${agentA}, ${companyA}, 'agent-a', 'process'),
             (${agentB}, ${companyB}, 'agent-b', 'process')`);
    // Seed one trace per company
    await db.execute(sql`INSERT INTO traces (id, company_id, agent_id, name, status)
      VALUES
        ('00000000-0000-0000-0000-000000001001', ${companyA}, ${agentA}, 'trace-a', 'completed'),
        ('00000000-0000-0000-0000-000000002001', ${companyB}, ${agentB}, 'trace-b', 'completed')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(async () => {
    await clearTenantContext(db);
  });

  it("queryTraces is RLS-scoped to the helper's companyId", async () => {
    const helpersA = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    const r = await helpersA.queryTraces({});
    expect(r.length).toBeGreaterThan(0);
    for (const t of r) expect(t.companyId).toBe(companyA);
  });

  it("queryTraces filters by agentId", async () => {
    const helpersA = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    const r = await helpersA.queryTraces({ agentId: agentA });
    expect(r.length).toBeGreaterThan(0);
    for (const t of r) expect(t.agentId).toBe(agentA);
  });

  it("queryTraces caps at 50 rows even if limit > 50 requested", async () => {
    const helpersA = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    const r = await helpersA.queryTraces({ limit: 999 });
    expect(r.length).toBeLessThanOrEqual(50);
  });

  it("checkWorkflowExists returns true for a seeded workflow", async () => {
    const h = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    expect(await h.checkWorkflowExists("hello-world")).toBe(true);
  });

  it("checkWorkflowExists returns false for an unknown name", async () => {
    const h = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    expect(await h.checkWorkflowExists("absent")).toBe(false);
  });

  it("checkWorkflowExists does NOT leak cross-tenant", async () => {
    const h = buildGateHelpers({ db, companyId: companyB });
    await setTenantContext(db, companyB);
    expect(await h.checkWorkflowExists("hello-world")).toBe(false);
  });
});
