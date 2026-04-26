import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0068_agents_company_name_unique", () => {
  const sql = readFileSync(join(__dirname, "0068_agents_company_name_unique.sql"), "utf-8");

  it("creates a unique index on (company_id, name)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*"?agents_company_name_unique"?[\s\S]*"?agents"?[\s\S]*"?company_id"?[\s\S]*"?name"?/i,
    );
  });

  it("filters on archived_at IS NULL so soft-deleted rows can coexist with live ones", () => {
    expect(sql).toMatch(/WHERE\s+"?archived_at"?\s+IS\s+NULL/i);
  });

  it("is idempotent (uses IF NOT EXISTS)", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX\s+IF NOT EXISTS/i);
  });
});
