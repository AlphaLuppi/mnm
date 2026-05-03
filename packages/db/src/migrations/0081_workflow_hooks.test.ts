import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_URL = new URL("./0081_workflow_hooks.sql", import.meta.url);
const sql = readFileSync(fileURLToPath(SQL_URL), "utf8");

const TABLES = [
  "workflow_hooks_config",
  "workflow_hooks_config_tags",
  "workflow_hooks_config_principals",
  "workflow_hooks_config_audit",
  "workflow_hook_executions",
] as const;

describe("migration 0081_workflow_hooks", () => {
  it("creates exactly 5 tables", () => {
    for (const t of TABLES) {
      expect(
        sql,
        `expected CREATE TABLE IF NOT EXISTS "${t}"`,
      ).toMatch(new RegExp(`CREATE TABLE\\s+IF NOT EXISTS\\s+"${t}"`, "i"));
    }
  });

  it("does NOT create a workflow_hooks_providers_whitelist table (RF-2)", () => {
    // Comments mentioning the dropped table name are OK; only forbid the
    // actual CREATE TABLE statement.
    expect(sql).not.toMatch(
      /CREATE\s+TABLE[^\n]*workflow_hooks_providers_whitelist/i,
    );
  });

  it("does NOT create an instance_settings table (RF-4 env-only kill-switch)", () => {
    expect(sql).not.toMatch(/CREATE\s+TABLE[\s\S]+?instance_settings/i);
  });

  it.each(TABLES)("enables RLS + FORCE on %s", (table) => {
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE\\s+"${table}"\\s+ENABLE ROW LEVEL SECURITY`, "i"),
    );
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE\\s+"${table}"\\s+FORCE ROW LEVEL SECURITY`, "i"),
    );
  });

  it.each(TABLES)(
    "creates BOTH tenant_baseline_permissive AND tenant_isolation policy on %s (RF-1 double-policy)",
    (table) => {
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY\\s+"tenant_baseline_permissive"\\s+ON\\s+"${table}"[\\s\\S]*?AS PERMISSIVE\\s+FOR ALL[\\s\\S]*?USING\\s*\\(\\s*true\\s*\\)`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY\\s+"tenant_isolation"\\s+ON\\s+"${table}"[\\s\\S]*?AS RESTRICTIVE\\s+FOR ALL[\\s\\S]*?current_setting\\('app\\.current_company_id', true\\)::uuid`,
          "i",
        ),
      );
    },
  );

  it("workflow_hooks_config has CHECK on visibility IN (private,tags,principals,company)", () => {
    expect(sql).toMatch(/workflow_hooks_config_visibility_check/i);
    expect(sql).toMatch(
      /"visibility"\s+IN\s*\(\s*'private'\s*,\s*'tags'\s*,\s*'principals'\s*,\s*'company'\s*\)/i,
    );
  });

  it("workflow_hooks_config has CHECK on hook_ref kebab-case canonical|shared|local", () => {
    expect(sql).toMatch(/workflow_hooks_config_hook_ref_check/i);
    expect(sql).toMatch(/canonical\|shared\|local/);
  });

  it("workflow_hooks_config has UNIQUE (company_id, name)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"workflow_hooks_config_company_name_idx"[\s\S]*?"company_id"[\s\S]*?"name"/i,
    );
  });

  it("workflow_hooks_config has partial index on (company_id, enforced, enabled) WHERE enforced=true", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"workflow_hooks_config_company_enforced_idx"[\s\S]+?"company_id"[\s\S]+?"enforced"[\s\S]+?"enabled"[\s\S]+?WHERE\s+"enforced"\s*=\s*true/i,
    );
  });

  it("workflow_hooks_config_audit has CHECK on action whitelist (7 values)", () => {
    expect(sql).toMatch(/workflow_hooks_config_audit_action_check/i);
    for (const action of [
      "created",
      "updated",
      "deleted",
      "enforced_on",
      "enforced_off",
      "enabled_on",
      "enabled_off",
    ]) {
      expect(sql).toMatch(new RegExp(`'${action}'`));
    }
  });

  it("workflow_hook_executions has CHECK on status (pending,success,failed,timeout)", () => {
    expect(sql).toMatch(/workflow_hook_executions_status_check/i);
    expect(sql).toMatch(
      /"status"\s+IN\s*\(\s*'pending'\s*,\s*'success'\s*,\s*'failed'\s*,\s*'timeout'\s*\)/i,
    );
  });

  it("workflow_hook_executions has CHECK on phase (4 phases)", () => {
    expect(sql).toMatch(/workflow_hook_executions_phase_check/i);
    expect(sql).toMatch(
      /"phase"\s+IN\s*\(\s*'before_run'\s*,\s*'before_step'\s*,\s*'after_step'\s*,\s*'after_run'\s*\)/i,
    );
  });

  it("workflow_hook_executions has actor_user_id text REFERENCES \"user\"(id) (§1.7 human traceability)", () => {
    expect(sql).toMatch(/"actor_user_id"\s+text\s+REFERENCES\s+"user"\s*\(\s*"id"\s*\)/i);
  });

  it("workflow_hook_executions FK to governed_step_executions and governed_workflow_runs use ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /"step_execution_id"\s+uuid\s+REFERENCES\s+"governed_step_executions"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
    expect(sql).toMatch(
      /"run_id"\s+uuid\s+REFERENCES\s+"governed_workflow_runs"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("workflow_hook_executions has index on (company_id, run_id, created_at DESC)", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"workflow_hook_executions_company_run_idx"[\s\S]+?"company_id"[\s\S]+?"run_id"[\s\S]+?"created_at"\s+DESC/i,
    );
  });

  it("config_id FK to workflow_hooks_config uses ON DELETE SET NULL on audit/executions, CASCADE on join tables", () => {
    // Audit + executions: SET NULL (preserve history when config deleted)
    expect(
      (sql.match(
        /"config_id"\s+uuid\s+REFERENCES\s+"workflow_hooks_config"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/gi,
      ) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    // Join tables: CASCADE (no orphans)
    expect(
      (sql.match(
        /"config_id"\s+uuid[\s\S]+?REFERENCES\s+"workflow_hooks_config"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/gi,
      ) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("FK on company_id always cascades on delete (5 tables)", () => {
    expect(
      (sql.match(
        /REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/gi,
      ) ?? []).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("seeds 2 permissions per company (hooks:manage + hooks:enforce)", () => {
    expect(sql).toMatch(
      /INSERT INTO\s+"permissions"[\s\S]*?'hooks:manage'[\s\S]*?'hooks:enforce'/i,
    );
    expect(sql).toMatch(/'hooks'/);
    expect(sql).toMatch(/ON CONFLICT\s*\(\s*"company_id"\s*,\s*"slug"\s*\)\s+DO NOTHING/i);
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/-->\s*statement-breakpoint/);
  });

  it("workflow_hook_executions has 3 quota counters (http/llm in/out) NOT NULL DEFAULT 0", () => {
    expect(sql).toMatch(/"http_calls_count"\s+integer\s+NOT NULL\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/"llm_tokens_in"\s+integer\s+NOT NULL\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/"llm_tokens_out"\s+integer\s+NOT NULL\s+DEFAULT\s+0/i);
  });

  it("workflow_hooks_config has enforced_phases text[] DEFAULT '{}'", () => {
    expect(sql).toMatch(/"enforced_phases"\s+text\[\]\s+NOT NULL\s+DEFAULT\s+'\{\}'/i);
  });

  it("created_by_principal_id is text NOT NULL with no FK (no principals table)", () => {
    expect(sql).toMatch(/"created_by_principal_id"\s+text\s+NOT NULL/i);
    // No FK clause that would reference "principals"(id)
    expect(sql).not.toMatch(/REFERENCES\s+"principals"\s*\(/i);
  });
});
