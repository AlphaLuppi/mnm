import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const MIGRATION_URL = new URL("./0065_governed_workflows.sql", import.meta.url);

let sql: string;

beforeAll(async () => {
  sql = await readFile(fileURLToPath(MIGRATION_URL), "utf8");
});

describe("0065_governed_workflows migration — file exists", () => {
  it("is non-empty", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it("starts with the expected header comment", () => {
    expect(sql).toMatch(/^-- GOVERNED-WORKFLOWS: T2 /);
  });
});

describe("agents table extension", () => {
  it("adds latest_git_tag column (nullable text)", () => {
    expect(sql).toMatch(
      /ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "latest_git_tag" text;/,
    );
  });

  it("adds enabled column (boolean NOT NULL DEFAULT true)", () => {
    expect(sql).toMatch(
      /ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;/,
    );
  });
});

describe("config_layer_items CHECK extension", () => {
  it("drops the previous item_type check (IF EXISTS)", () => {
    expect(sql).toMatch(
      /ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;/,
    );
  });

  it("re-adds the check including env_ref (and keeping existing values)", () => {
    expect(sql).toMatch(
      /ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check\s+CHECK \(item_type IN \('mcp', 'skill', 'hook', 'setting', 'git_provider', 'credential', 'env_ref'\)\);/,
    );
  });

  it("does not introduce mcp_server (merged into existing 'mcp' per 2026-04-21 decision)", () => {
    expect(sql).not.toMatch(/'mcp_server'/);
  });
});

describe("governed_workflow_definitions table", () => {
  it("creates the table with the expected columns", () => {
    expect(sql).toContain('CREATE TABLE "governed_workflow_definitions" (');
    expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/"company_id" uuid NOT NULL REFERENCES "companies"\("id"\)/);
    expect(sql).toMatch(/"name" text NOT NULL/);
    expect(sql).toMatch(/"description" text/);
    expect(sql).toMatch(/"latest_git_tag" text/);
    expect(sql).toMatch(
      /"enabled" boolean NOT NULL DEFAULT true/,
    );
  });

  it("has a unique index on (company_id, name)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "governed_workflow_definitions_company_name_uq"\s+ON "governed_workflow_definitions"\("company_id", "name"\);/,
    );
  });

  it("enables + forces RLS", () => {
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_definitions" ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_definitions" FORCE ROW LEVEL SECURITY;/,
    );
  });

  it("has a tenant_isolation RESTRICTIVE policy", () => {
    expect(sql).toMatch(
      /CREATE POLICY "tenant_isolation" ON "governed_workflow_definitions" AS RESTRICTIVE FOR ALL USING \(company_id = current_setting\('app\.current_company_id', true\)::uuid\);/,
    );
  });
});
