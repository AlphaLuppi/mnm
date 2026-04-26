import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0067_agents_archived_at", () => {
  const sql = readFileSync(join(__dirname, "0067_agents_archived_at.sql"), "utf-8");

  it("adds archived_at timestamptz column on agents", () => {
    expect(sql).toMatch(/ALTER TABLE\s+"?agents"?\s+ADD COLUMN\s+"?archived_at"?\s+timestamptz/i);
  });

  it("creates a partial index on (company_id) WHERE archived_at IS NULL", () => {
    expect(sql).toMatch(/CREATE INDEX[\s\S]*agents[\s\S]*company_id[\s\S]*"?archived_at"? IS NULL/i);
  });
});
