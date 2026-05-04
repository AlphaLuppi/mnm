import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_URL = new URL("./0084_workflow_triggers.sql", import.meta.url);
const sql = readFileSync(fileURLToPath(SQL_URL), "utf8");

const TABLES = ["workflow_triggers", "workflow_trigger_audit"] as const;

describe("migration 0084_workflow_triggers", () => {
  it("creates exactly 2 tables", () => {
    for (const t of TABLES) {
      expect(
        sql,
        `expected CREATE TABLE IF NOT EXISTS "${t}"`,
      ).toMatch(new RegExp(`CREATE TABLE\\s+IF NOT EXISTS\\s+"${t}"`, "i"));
    }
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
    "creates BOTH tenant_baseline_permissive AND tenant_isolation policy on %s (double-policy pattern)",
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

  it("workflow_triggers has CHECK on kind IN (schedule,webhook,issue)", () => {
    expect(sql).toMatch(/workflow_triggers_kind_check/i);
    expect(sql).toMatch(/"kind"\s+IN\s*\(\s*'schedule'\s*,\s*'webhook'\s*,\s*'issue'\s*\)/i);
  });

  it("workflow_triggers has CHECK on action IN (launch_run,launch_step,complete_step)", () => {
    expect(sql).toMatch(/workflow_triggers_action_check/i);
    expect(sql).toMatch(/"action"\s+IN\s*\(\s*'launch_run'\s*,\s*'launch_step'\s*,\s*'complete_step'\s*\)/i);
  });

  it("workflow_triggers has CHECK on signing_mode (nullable, bearer or hmac_sha256)", () => {
    expect(sql).toMatch(/workflow_triggers_signing_mode_check/i);
    expect(sql).toMatch(/"signing_mode"\s+IS\s+NULL\s+OR\s+"signing_mode"\s+IN\s*\(\s*'bearer'\s*,\s*'hmac_sha256'\s*\)/i);
  });

  it("workflow_triggers has created_by_user_id text NOT NULL (§1.7 human traceability)", () => {
    expect(sql).toMatch(/"created_by_user_id"\s+text\s+NOT NULL/i);
  });

  it("workflow_triggers has partial unique index on public_id WHERE NOT NULL", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"workflow_triggers_public_id_uq"[\s\S]+?"public_id"[\s\S]+?WHERE\s+"public_id"\s+IS\s+NOT\s+NULL/i,
    );
  });

  it("workflow_triggers has partial index on next_run_at WHERE NOT NULL (cron tick scan)", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"workflow_triggers_next_run_at_idx"[\s\S]+?"next_run_at"[\s\S]+?WHERE\s+"next_run_at"\s+IS\s+NOT\s+NULL/i,
    );
  });

  it("workflow_triggers has company-first composite index on (company_id, kind, enabled)", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"workflow_triggers_company_kind_idx"[\s\S]+?"company_id"[\s\S]+?"kind"[\s\S]+?"enabled"/i,
    );
  });

  it("workflow_trigger_audit has FK trigger_id ON DELETE SET NULL (preserve audit history)", () => {
    expect(sql).toMatch(
      /"trigger_id"\s+uuid\s+REFERENCES\s+"workflow_triggers"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("workflow_trigger_audit has partial unique idempotency index on (company_id, trigger_id, idempotency_key)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"workflow_trigger_audit_idempotency_uq"[\s\S]+?"company_id"[\s\S]+?"trigger_id"[\s\S]+?"idempotency_key"[\s\S]+?WHERE\s+"idempotency_key"\s+IS\s+NOT\s+NULL/i,
    );
  });

  it("seeds the workflows:manage_triggers permission for every company (idempotent)", () => {
    expect(sql).toMatch(/INSERT INTO\s+"permissions"[\s\S]+?'workflows:manage_triggers'[\s\S]+?ON CONFLICT[\s\S]+?DO NOTHING/i);
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/-->\s*statement-breakpoint/);
  });

  it("workflow_triggers FK to companies uses ON DELETE CASCADE", () => {
    expect(sql).toMatch(
      /"company_id"\s+uuid\s+NOT NULL\s+REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
  });
});
