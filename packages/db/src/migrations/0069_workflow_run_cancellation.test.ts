import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0069_workflow_run_cancellation", () => {
  const sql = readFileSync(
    join(__dirname, "0069_workflow_run_cancellation.sql"),
    "utf-8",
  );

  it("adds 4 cancellation columns to governed_workflow_runs", () => {
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?cancelled_at"?\s+timestamptz/i);
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?cancelled_by_actor_id"?\s+text/i);
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?cancelled_by_actor_type"?\s+text/i);
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?cancellation_reason"?\s+text/i);
  });

  it("creates partial index governed_workflow_runs_cancelled_at_idx on (company_id, cancelled_at) WHERE cancelled_at IS NOT NULL", () => {
    expect(sql).toMatch(
      /CREATE INDEX\s+IF NOT EXISTS\s+"?governed_workflow_runs_cancelled_at_idx"?[\s\S]*"?cancelled_at"? IS NOT NULL/i,
    );
  });

  it("extends governed_step_executions.state CHECK constraint with 'cancelled'", () => {
    // The migration drops & re-adds the CHECK to include 'cancelled'.
    expect(sql).toMatch(/DROP CONSTRAINT\s+IF EXISTS\s+"?governed_step_executions_state_check"?/i);
    expect(sql).toMatch(
      /CHECK\s*\(\s*"?state"?\s+IN\s*\([^)]*'cancelled'[^)]*\)\s*\)/i,
    );
  });

  it("is idempotent (IF NOT EXISTS / DROP IF EXISTS guards)", () => {
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS/i);
    expect(sql).toMatch(/CREATE INDEX\s+IF NOT EXISTS/i);
    expect(sql).toMatch(/DROP CONSTRAINT\s+IF EXISTS/i);
  });
});
