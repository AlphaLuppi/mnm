import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_URL = new URL("./0082_step_assignments.sql", import.meta.url);
const sql = readFileSync(fileURLToPath(SQL_URL), "utf8");

describe("migration 0082_step_assignments", () => {
  it("creates the governed_step_assignments table", () => {
    expect(sql).toMatch(
      /CREATE TABLE\s+IF NOT EXISTS\s+"governed_step_assignments"/i,
    );
  });

  it("principal_id is text NOT NULL with no FK (mirrors workflow_hooks_config_principals)", () => {
    expect(sql).toMatch(/"principal_id"\s+text\s+NOT NULL/i);
    expect(sql).not.toMatch(/REFERENCES\s+"principals"\s*\(/i);
  });

  it("step_execution_id FK cascades on delete", () => {
    expect(sql).toMatch(
      /"step_execution_id"\s+uuid\s+NOT NULL\s+REFERENCES\s+"governed_step_executions"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
  });

  it("company_id FK cascades on delete", () => {
    expect(sql).toMatch(
      /"company_id"\s+uuid\s+NOT NULL\s+REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
  });

  it("has UNIQUE (step_execution_id, principal_id) — one assignment per (step, principal)", () => {
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*"step_execution_id"\s*,\s*"principal_id"\s*\)/i,
    );
  });

  it("creates principal_snapshot index ordered by snapshot_at DESC", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"governed_step_assignments_principal_snapshot_idx"[\s\S]+?"company_id"[\s\S]+?"principal_id"[\s\S]+?"snapshot_at"\s+DESC/i,
    );
  });

  it("creates partial index on governed_step_executions(company_id, state) WHERE waiting/running", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?"governed_step_executions_company_state_partial_idx"[\s\S]+?"company_id"[\s\S]+?"state"[\s\S]+?WHERE\s+"state"\s+IN\s*\(\s*'waiting'\s*,\s*'running'\s*\)/i,
    );
  });

  it("enables RLS + FORCE on governed_step_assignments", () => {
    expect(sql).toMatch(
      /ALTER TABLE\s+"governed_step_assignments"\s+ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).toMatch(
      /ALTER TABLE\s+"governed_step_assignments"\s+FORCE ROW LEVEL SECURITY/i,
    );
  });

  it("creates BOTH tenant_baseline_permissive AND tenant_isolation policy (post-0080 double-policy)", () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"tenant_baseline_permissive"\s+ON\s+"governed_step_assignments"[\s\S]*?AS PERMISSIVE\s+FOR ALL[\s\S]*?USING\s*\(\s*true\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE POLICY\s+"tenant_isolation"\s+ON\s+"governed_step_assignments"[\s\S]*?AS RESTRICTIVE\s+FOR ALL[\s\S]*?current_setting\('app\.current_company_id', true\)::uuid/i,
    );
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/-->\s*statement-breakpoint/);
  });
});
