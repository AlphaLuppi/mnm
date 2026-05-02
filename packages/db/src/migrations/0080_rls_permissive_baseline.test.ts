import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_URL = new URL("./0080_rls_permissive_baseline.sql", import.meta.url);
const JOURNAL_URL = new URL("./meta/_journal.json", import.meta.url);

const COVERED_TABLES = [
  // 0030 baseline survivors (37)
  "agents", "agent_api_keys", "agent_config_revisions", "agent_runtime_state",
  "agent_task_sessions", "agent_wakeup_requests", "activity_log", "approvals",
  "approval_comments", "company_memberships", "company_secrets", "cost_events",
  "goals", "heartbeat_runs", "heartbeat_run_events", "invites", "issues",
  "issue_approvals", "issue_attachments", "issue_comments", "issue_labels",
  "issue_read_states", "join_requests", "labels", "projects", "project_workspaces",
  "project_goals", "project_memberships", "automation_cursors", "chat_channels",
  "chat_messages", "container_profiles", "container_instances",
  "credential_proxy_rules", "audit_events", "sso_configurations", "import_jobs",
  // 0049 RBAC (4)
  "permissions", "roles", "tags", "tag_assignments",
  // 0052 config layers post-0066-drops + 0061 rename (6)
  "config_layers", "config_layer_items", "config_layer_files",
  "config_layer_revisions", "agent_config_layers", "user_credentials",
  // 0055 collaborative chat (8)
  "documents", "document_chunks", "artifacts", "artifact_versions",
  "folders", "folder_items", "chat_shares", "chat_context_links",
  // 0065 governed workflows (4)
  "governed_workflow_definitions", "governed_workflow_runs",
  "governed_step_executions", "gate_results",
  // 0071 RLS hardening additions (11)
  "routines", "routine_triggers", "routine_runs", "feedback_votes",
  "folder_shares", "view_presets", "user_widgets", "inbox_items",
  "oauth_refresh_tokens", "agent_permissions", "role_permissions",
  // 0074 / 0075 / 0076 (3)
  "thread_interactions", "environments", "environment_leases",
  // 0079 connectors platform (4)
  "oauth_connectors", "connector_tokens", "user_api_keys", "oauth_connectors_audit",
] as const;

const EXCLUDED_TABLES = [
  "a2a_messages", "compaction_snapshots",
  "traces", "trace_observations", "trace_lenses", "trace_lens_results",
  "gold_prompts", "user_pods", "artifact_deployments",
] as const;

const sql = readFileSync(fileURLToPath(SQL_URL), "utf8");

describe("migration 0080_rls_permissive_baseline — file structure", () => {
  it("file is non-empty", () => {
    expect(sql.length).toBeGreaterThan(1000);
  });

  it("starts with the expected header comment", () => {
    expect(sql).toMatch(/NEW-S1.*RLS default-deny/i);
  });

  it("covers exactly 77 tables (commit-locked count: 73 pre-Sprint-1 + 4 connectors platform)", () => {
    expect(COVERED_TABLES.length).toBe(77);
  });
});

describe("migration 0080 — per-table assertions", () => {
  it.each(COVERED_TABLES)(
    "creates a tenant_baseline_permissive policy on %s",
    (table) => {
      const dropRe = new RegExp(
        `DROP POLICY IF EXISTS\\s+"tenant_baseline_permissive"\\s+ON\\s+"${table}"`,
        "i",
      );
      const createRe = new RegExp(
        `CREATE POLICY\\s+"tenant_baseline_permissive"\\s+ON\\s+"${table}"\\s+AS PERMISSIVE\\s+FOR ALL\\s+USING\\s*\\(\\s*true\\s*\\)`,
        "i",
      );
      expect(sql, `expected DROP POLICY IF EXISTS on ${table}`).toMatch(dropRe);
      expect(sql, `expected CREATE POLICY ... AS PERMISSIVE on ${table}`).toMatch(createRe);
    },
  );
});

describe("migration 0080 — exclusions (legacy PERMISSIVE-only tables)", () => {
  it.each(EXCLUDED_TABLES)(
    "intentionally does NOT add tenant_baseline_permissive on %s",
    (table) => {
      const re = new RegExp(
        `CREATE POLICY\\s+"tenant_baseline_permissive"\\s+ON\\s+"${table}"`,
        "i",
      );
      expect(
        sql,
        `must NOT add tenant_baseline_permissive on ${table} (would break isolation)`,
      ).not.toMatch(re);
    },
  );
});

describe("migration 0080 — counts + idempotence", () => {
  it("each table has exactly one DROP and one CREATE policy statement", () => {
    const dropCount = (sql.match(/DROP POLICY IF EXISTS\s+"tenant_baseline_permissive"/gi) ?? []).length;
    const createCount = (sql.match(/CREATE POLICY\s+"tenant_baseline_permissive"/gi) ?? []).length;
    expect(dropCount).toBe(COVERED_TABLES.length);
    expect(createCount).toBe(COVERED_TABLES.length);
  });

  it("uses --> statement-breakpoint between every policy operation", () => {
    const breakpointCount = (sql.match(/-->\s*statement-breakpoint/g) ?? []).length;
    // Each table issues 2 statements (DROP + CREATE). The very last CREATE
    // may not be followed by a breakpoint (file ends with `);`). Allow the
    // tolerance.
    expect(breakpointCount).toBeGreaterThanOrEqual(COVERED_TABLES.length * 2 - 1);
  });

  it("DROP precedes CREATE for every table (idempotence guard)", () => {
    for (const table of COVERED_TABLES) {
      const createIdx = sql.indexOf(`CREATE POLICY "tenant_baseline_permissive" ON "${table}"`);
      const dropIdx = sql.indexOf(`DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "${table}"`);
      expect(dropIdx, `${table}: expected DROP statement to exist`).toBeGreaterThan(-1);
      expect(createIdx, `${table}: expected CREATE statement to exist`).toBeGreaterThan(-1);
      expect(dropIdx, `${table}: DROP must come before CREATE`).toBeLessThan(createIdx);
    }
  });
});

describe("_journal.json — migration 0080 entry", () => {
  it("has an entry for 0080_rls_permissive_baseline", () => {
    const journal = JSON.parse(readFileSync(fileURLToPath(JOURNAL_URL), "utf8"));
    const entry = journal.entries.find(
      (e: { tag: string; idx: number }) => e.tag === "0080_rls_permissive_baseline",
    );
    expect(entry, "expected journal entry for 0080_rls_permissive_baseline").toBeDefined();
    expect(entry.idx).toBe(80);
    expect(entry.version).toBe("7");
    expect(entry.breakpoints).toBe(true);
  });
});
