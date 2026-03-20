/**
 * TECH-05: RLS PostgreSQL — Row-Level Security — E2E Tests
 *
 * These tests verify the deliverables of TECH-05:
 *   - AC-01: Migration SQL file exists with correct RLS policies for all 41 tables
 *   - AC-02: Drizzle migration journal references the RLS migration
 *   - AC-03: Tenant context middleware exists with correct implementation
 *   - AC-04: Middleware integrated in app.ts after actorMiddleware
 *   - AC-05: Middleware exports in server/src/middleware/index.ts
 *   - AC-06: Health endpoint reports RLS status
 *   - AC-07: data-test-id values present in source
 *   - AC-08: Security verification (FORCE RLS, statement-breakpoints, excluded tables)
 *
 * All tests are file-content based — no server or database required.
 * TECH-05 is backend-only (no UI components).
 */
import { test, expect } from "@playwright/test";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const MIDDLEWARE_DIR = resolve(ROOT, "server/src/middleware");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "0030_rls_policies.sql");

/**
 * All 41 tables that must have RLS enabled.
 * 40 standard tables + 1 special table (invites — nullable company_id).
 */
const STANDARD_RLS_TABLES = [
  "agents",
  "agent_api_keys",
  "agent_config_revisions",
  "agent_runtime_state",
  "agent_task_sessions",
  "agent_wakeup_requests",
  "activity_log",
  "approvals",
  "approval_comments",
  "company_memberships",
  "company_secrets",
  "cost_events",
  "goals",
  "heartbeat_runs",
  "heartbeat_run_events",
  "issues",
  "issue_approvals",
  "issue_attachments",
  "issue_comments",
  "issue_labels",
  "issue_read_states",
  "join_requests",
  "labels",
  "principal_permission_grants",
  "projects",
  "project_workspaces",
  "project_goals",
  "workflow_templates",
  "workflow_instances",
  "stage_instances",
  "project_memberships",
  "automation_cursors",
  "chat_channels",
  "chat_messages",
  "container_profiles",
  "container_instances",
  "credential_proxy_rules",
  "audit_events",
  "sso_configurations",
  "import_jobs",
] as const;

/** The special table with nullable company_id */
const SPECIAL_TABLE = "invites" as const;

/** All 41 RLS tables combined */
const ALL_RLS_TABLES = [...STANDARD_RLS_TABLES, SPECIAL_TABLE] as const;

/** Tables explicitly EXCLUDED from RLS */
const EXCLUDED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "instance_user_roles",
  "companies",
  "assets",
  "inbox_dismissals",
  "company_secret_versions",
  "__drizzle_migrations",
] as const;

// ─── Group 1: Migration SQL file — RLS policies ────────────────────────────

test.describe("Group 1: Migration SQL file exists and contains RLS policies", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    migrationContent = await readFile(MIGRATION_FILE, "utf-8");
  });

  test("migration file 0030_rls_policies.sql exists", async () => {
    await expect(access(MIGRATION_FILE).then(() => true)).resolves.toBe(true);
  });

  // All 41 tables must have ENABLE ROW LEVEL SECURITY
  for (const table of ALL_RLS_TABLES) {
    test(`${table} has ALTER TABLE ENABLE ROW LEVEL SECURITY`, () => {
      expect(migrationContent).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    });
  }

  // All 41 tables must have FORCE ROW LEVEL SECURITY
  for (const table of ALL_RLS_TABLES) {
    test(`${table} has ALTER TABLE FORCE ROW LEVEL SECURITY`, () => {
      expect(migrationContent).toContain(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    });
  }

  // All 41 tables must have CREATE POLICY "tenant_isolation"
  for (const table of ALL_RLS_TABLES) {
    test(`${table} has CREATE POLICY "tenant_isolation"`, () => {
      expect(migrationContent).toContain(
        `CREATE POLICY "tenant_isolation" ON "${table}"`,
      );
    });
  }

  // All policies use AS RESTRICTIVE
  test("all policies use AS RESTRICTIVE", () => {
    // Count occurrences of AS RESTRICTIVE — should be at least 41
    const matches = migrationContent.match(/AS RESTRICTIVE/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(41);
  });

  // All policies use FOR ALL
  test("all policies use FOR ALL", () => {
    const matches = migrationContent.match(/FOR ALL/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(41);
  });

  // Standard policies use current_setting('app.current_company_id', true)::uuid
  test("standard policies use current_setting with missing_ok = true", () => {
    // Should appear at least 41 times (once per table)
    const matches = migrationContent.match(
      /current_setting\('app\.current_company_id',\s*true\)::uuid/g,
    );
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(41);
  });
});

// ─── Group 1b: invites special policy ─────────────────────────────────────

test.describe("Group 1b: invites table has special RLS policy", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    migrationContent = await readFile(MIGRATION_FILE, "utf-8");
  });

  test("invites policy includes OR company_id IS NULL clause", () => {
    // The invites table policy must handle nullable company_id
    // Extract the block around the invites policy
    const invitesIdx = migrationContent.indexOf(
      'CREATE POLICY "tenant_isolation" ON "invites"',
    );
    expect(invitesIdx).toBeGreaterThan(-1);

    // Get the policy block (from CREATE POLICY to the next semicolon)
    const policyBlock = migrationContent.substring(
      invitesIdx,
      migrationContent.indexOf(";", invitesIdx) + 1,
    );
    expect(policyBlock).toContain("company_id IS NULL");
  });

  test("standard tables do NOT have OR company_id IS NULL", () => {
    // For a standard table (e.g. agents), the policy should NOT have the NULL clause
    const agentsIdx = migrationContent.indexOf(
      'CREATE POLICY "tenant_isolation" ON "agents"',
    );
    expect(agentsIdx).toBeGreaterThan(-1);
    const policyBlock = migrationContent.substring(
      agentsIdx,
      migrationContent.indexOf(";", agentsIdx) + 1,
    );
    expect(policyBlock).not.toContain("company_id IS NULL");
  });
});

// ─── Group 1c: Excluded tables NOT in migration ──────────────────────────

test.describe("Group 1c: Excluded tables do NOT appear in migration", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    migrationContent = await readFile(MIGRATION_FILE, "utf-8");
  });

  for (const table of EXCLUDED_TABLES) {
    test(`excluded table "${table}" has no ENABLE ROW LEVEL SECURITY`, () => {
      expect(migrationContent).not.toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    });
  }
});

// ─── Group 2: Drizzle migration journal ─────────────────────────────────────

test.describe("Group 2: Drizzle migration journal references RLS migration", () => {
  let journalContent: string;

  test.beforeAll(async () => {
    journalContent = await readFile(
      resolve(MIGRATIONS_DIR, "meta/_journal.json"),
      "utf-8",
    );
  });

  test("_journal.json contains entry for 0030_rls_policies", () => {
    expect(journalContent).toContain("0030_rls_policies");
  });

  test("journal entry has correct index 30", () => {
    const journal = JSON.parse(journalContent);
    const entry = journal.entries.find(
      (e: { tag: string }) => e.tag === "0030_rls_policies",
    );
    expect(entry).toBeTruthy();
    expect(entry.idx).toBe(30);
  });
});

// ─── Group 3: Tenant context middleware ─────────────────────────────────────

test.describe("Group 3: Tenant context middleware", () => {
  let middlewareContent: string;
  const MIDDLEWARE_FILE = resolve(MIDDLEWARE_DIR, "tenant-context.ts");

  test.beforeAll(async () => {
    middlewareContent = await readFile(MIDDLEWARE_FILE, "utf-8");
  });

  test("tenant-context.ts exists", async () => {
    await expect(access(MIDDLEWARE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("exports tenantContextMiddleware function", () => {
    expect(middlewareContent).toMatch(
      /export\s+function\s+tenantContextMiddleware/,
    );
  });

  test("exports setTenantContext function", () => {
    expect(middlewareContent).toMatch(
      /export\s+async\s+function\s+setTenantContext/,
    );
  });

  test("exports clearTenantContext function", () => {
    expect(middlewareContent).toMatch(
      /export\s+async\s+function\s+clearTenantContext/,
    );
  });

  test("contains UUID validation regex", () => {
    // Should have a UUID regex pattern for input validation
    expect(middlewareContent).toContain(
      "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    );
  });

  test("resolveCompanyId handles route params (priority 1)", () => {
    expect(middlewareContent).toContain("req.params.companyId");
  });

  test("resolveCompanyId handles agent actor (priority 2)", () => {
    expect(middlewareContent).toContain("agent");
    expect(middlewareContent).toContain("companyId");
  });

  test("resolveCompanyId handles board actor (priority 3)", () => {
    expect(middlewareContent).toContain("board");
    expect(middlewareContent).toContain("companyIds");
  });

  test("uses set_config for app.current_company_id", () => {
    expect(middlewareContent).toContain(
      "set_config('app.current_company_id'",
    );
  });

  test("set_config uses true for is_local parameter", () => {
    // The set_config call should use `true` for the is_local parameter
    // Format: set_config('app.current_company_id', value, true)
    expect(middlewareContent).toMatch(
      /set_config\('app\.current_company_id',\s*.*,\s*true\)/,
    );
  });
});

// ─── Group 4: Integration in app.ts ──────────────────────────────────────

test.describe("Group 4: Middleware integrated in app.ts", () => {
  let appContent: string;

  test.beforeAll(async () => {
    appContent = await readFile(resolve(ROOT, "server/src/app.ts"), "utf-8");
  });

  test("app.ts imports tenantContextMiddleware", () => {
    expect(appContent).toContain("tenantContextMiddleware");
    expect(appContent).toMatch(
      /import\s.*tenantContextMiddleware.*from/s,
    );
  });

  test("app.ts calls app.use(tenantContextMiddleware(db))", () => {
    expect(appContent).toMatch(/app\.use\(\s*tenantContextMiddleware\(db\)/);
  });

  test("tenantContextMiddleware is placed AFTER actorMiddleware", () => {
    const actorIdx = appContent.indexOf("actorMiddleware");
    const tenantIdx = appContent.indexOf("tenantContextMiddleware(db)");
    expect(actorIdx).toBeGreaterThan(-1);
    expect(tenantIdx).toBeGreaterThan(-1);
    expect(tenantIdx).toBeGreaterThan(actorIdx);
  });
});

// ─── Group 5: Middleware exports in index.ts ─────────────────────────────

test.describe("Group 5: Middleware exports in index.ts", () => {
  let indexContent: string;

  test.beforeAll(async () => {
    indexContent = await readFile(
      resolve(MIDDLEWARE_DIR, "index.ts"),
      "utf-8",
    );
  });

  test("index.ts exports tenantContextMiddleware", () => {
    expect(indexContent).toContain("tenantContextMiddleware");
  });

  test("index.ts exports setTenantContext", () => {
    expect(indexContent).toContain("setTenantContext");
  });

  test("index.ts exports clearTenantContext", () => {
    expect(indexContent).toContain("clearTenantContext");
  });

  test("exports come from tenant-context module", () => {
    expect(indexContent).toMatch(/from\s+["']\.\/tenant-context/);
  });
});

// ─── Group 6: Health endpoint reports RLS status ────────────────────────

test.describe("Group 6: Health endpoint RLS status", () => {
  let healthContent: string;

  test.beforeAll(async () => {
    healthContent = await readFile(
      resolve(ROOT, "server/src/routes/health.ts"),
      "utf-8",
    );
  });

  test("health.ts queries pg_tables for rowsecurity status", () => {
    expect(healthContent).toContain("pg_tables");
    expect(healthContent).toContain("rowsecurity");
  });

  test("health.ts includes RLS-related information in response", () => {
    // Should reference rls or RLS in the response building
    expect(healthContent).toMatch(/rls/i);
  });
});

// ─── Group 7: data-test-id verification ──────────────────────────────────

test.describe("Group 7: data-test-id values in source files", () => {
  test('health.ts contains data-testid "tech-05-rls-table-count" or equivalent RLS count', async () => {
    const healthContent = await readFile(
      resolve(ROOT, "server/src/routes/health.ts"),
      "utf-8",
    );
    // The health endpoint should report the count of RLS-protected tables
    // Either via a data-testid marker or a tablesProtected/tableCount field
    const hasTableCount =
      healthContent.includes("tech-05-rls-table") ||
      healthContent.includes("tablesProtected") ||
      healthContent.includes("tableCount") ||
      healthContent.includes("tables_protected");
    expect(hasTableCount).toBe(true);
  });
});

// ─── Group 8: Security verification ──────────────────────────────────────

test.describe("Group 8: Security verification", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    migrationContent = await readFile(MIGRATION_FILE, "utf-8");
  });

  test("FORCE ROW LEVEL SECURITY is used (not just ENABLE)", () => {
    // Every ENABLE must have a corresponding FORCE
    const enableCount = (
      migrationContent.match(/ENABLE ROW LEVEL SECURITY/g) ?? []
    ).length;
    const forceCount = (
      migrationContent.match(/FORCE ROW LEVEL SECURITY/g) ?? []
    ).length;
    expect(enableCount).toBe(41);
    expect(forceCount).toBe(41);
  });

  test("migration uses statement-breakpoint separators", () => {
    const breakpoints = (
      migrationContent.match(/--> statement-breakpoint/g) ?? []
    ).length;
    // At least 40 breakpoints (between 41 table blocks)
    expect(breakpoints).toBeGreaterThanOrEqual(40);
  });

  test("no excluded table appears with ENABLE ROW LEVEL SECURITY", () => {
    for (const table of EXCLUDED_TABLES) {
      expect(migrationContent).not.toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }
  });

  test("migration contains ADR-001 reference in comments", () => {
    expect(migrationContent).toContain("ADR-001");
  });

  test("exactly 41 ENABLE ROW LEVEL SECURITY statements", () => {
    const matches = migrationContent.match(/ENABLE ROW LEVEL SECURITY/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBe(41);
  });

  test("exactly 41 CREATE POLICY statements", () => {
    const matches = migrationContent.match(/CREATE POLICY/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBe(41);
  });

  test("all policies are named tenant_isolation", () => {
    const policyMatches = migrationContent.match(
      /CREATE POLICY "([^"]+)"/g,
    );
    expect(policyMatches).toBeTruthy();
    for (const match of policyMatches!) {
      expect(match).toContain('"tenant_isolation"');
    }
  });

  test("invites is the ONLY table with company_id IS NULL in policy", () => {
    // Find all occurrences of "company_id IS NULL" in the migration
    const nullMatches = migrationContent.match(/company_id IS NULL/g);
    expect(nullMatches).toBeTruthy();
    // Should appear exactly once (only for invites)
    expect(nullMatches!.length).toBe(1);
  });
});
