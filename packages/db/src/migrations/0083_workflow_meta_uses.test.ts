import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_URL = new URL("./0083_workflow_meta_uses.sql", import.meta.url);
const sql = readFileSync(fileURLToPath(SQL_URL), "utf8");

describe("migration 0083_workflow_meta_uses", () => {
  it("adds parent_step_execution_id with self-FK ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /ADD COLUMN\s+IF NOT EXISTS\s+"parent_step_execution_id"\s+uuid[\s\S]+?REFERENCES\s+"governed_step_executions"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("adds composite_run_id referencing governed_workflow_runs ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /ADD COLUMN\s+IF NOT EXISTS\s+"composite_run_id"\s+uuid[\s\S]+?REFERENCES\s+"governed_workflow_runs"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("adds root_run_id referencing governed_workflow_runs ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /ADD COLUMN\s+IF NOT EXISTS\s+"root_run_id"\s+uuid[\s\S]+?REFERENCES\s+"governed_workflow_runs"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("creates partial index on (company_id, root_run_id) WHERE root_run_id IS NOT NULL", () => {
    expect(sql).toMatch(
      /CREATE INDEX[\s\S]+?IF NOT EXISTS[\s\S]+?"governed_step_executions_root_run_idx"[\s\S]+?"company_id"[\s\S]+?"root_run_id"[\s\S]+?WHERE\s+"root_run_id"\s+IS NOT NULL/i,
    );
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/-->\s*statement-breakpoint/);
  });

  it("does not create new RLS policy (inherits from governed_step_executions baseline)", () => {
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]+?ON\s+"governed_step_executions"/i);
  });
});
