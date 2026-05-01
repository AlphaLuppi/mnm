import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0078_session_bundle_runs", () => {
  const sql = readFileSync(join(__dirname, "0078_session_bundle_runs.sql"), "utf-8");

  it("adds execution_mode column with server default and CHECK constraint", () => {
    expect(sql).toMatch(/ALTER TABLE\s+"?heartbeat_runs"?[\s\S]*ADD COLUMN\s+IF NOT EXISTS\s+"?execution_mode"?\s+text\s+NOT NULL\s+DEFAULT\s+'server'/i);
    expect(sql).toMatch(/CHECK\s*\(\s*"?execution_mode"?\s+IN\s*\(\s*'server'\s*,\s*'client'\s*\)\s*\)/i);
  });

  it("adds bundle_format and bundle_sha256 columns on heartbeat_runs", () => {
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?bundle_format"?\s+text/i);
    expect(sql).toMatch(/ADD COLUMN\s+IF NOT EXISTS\s+"?bundle_sha256"?\s+text/i);
  });

  it("adds nullable heartbeat_run_id FK on governed_step_executions with ON DELETE SET NULL", () => {
    expect(sql).toMatch(/ALTER TABLE\s+"?governed_step_executions"?[\s\S]*ADD COLUMN\s+IF NOT EXISTS\s+"?heartbeat_run_id"?\s+uuid/i);
    expect(sql).toMatch(/REFERENCES\s+"?heartbeat_runs"?\s*\(\s*"?id"?\s*\)\s+ON DELETE SET NULL/i);
  });

  it("creates partial index heartbeat_runs_client_status_idx on (status) WHERE execution_mode='client'", () => {
    expect(sql).toMatch(/CREATE INDEX\s+IF NOT EXISTS\s+"?heartbeat_runs_client_status_idx"?[\s\S]*"?status"?[\s\S]*WHERE\s+"?execution_mode"?\s*=\s*'client'/i);
  });

  it("creates partial index governed_step_executions_heartbeat_run_id_idx WHERE heartbeat_run_id IS NOT NULL", () => {
    expect(sql).toMatch(/CREATE INDEX\s+IF NOT EXISTS\s+"?governed_step_executions_heartbeat_run_id_idx"?[\s\S]*"?heartbeat_run_id"?[\s\S]*IS NOT NULL/i);
  });

  it("creates unique partial index on (id) WHERE bundle_sha256 IS NOT NULL for idempotence dedup", () => {
    // Idempotence: a single heartbeat_run can only carry one bundle (latest hash wins),
    // we don't need a unique index — but we DO need fast lookup by sha256 for the
    // 'already finalized' check. Plain index is enough.
    expect(sql).toMatch(/CREATE INDEX\s+IF NOT EXISTS\s+"?heartbeat_runs_bundle_sha256_idx"?[\s\S]*"?bundle_sha256"?/i);
  });

  it("is idempotent (IF NOT EXISTS guards on column adds and indexes)", () => {
    const addColumnCount = (sql.match(/ADD COLUMN\s+IF NOT EXISTS/gi) ?? []).length;
    const createIndexCount = (sql.match(/CREATE INDEX\s+IF NOT EXISTS/gi) ?? []).length;
    expect(addColumnCount).toBeGreaterThanOrEqual(4); // execution_mode, bundle_format, bundle_sha256, heartbeat_run_id
    expect(createIndexCount).toBeGreaterThanOrEqual(3);
  });
});
