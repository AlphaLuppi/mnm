import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "./0066_nuke_legacy_workflows.sql"),
  "utf8",
);

describe("0066_nuke_legacy_workflows migration", () => {
  it("drops the 5 legacy workflow tables", () => {
    expect(sql).toMatch(/DROP TABLE IF EXISTS "stage_instances" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_stage_config_layers" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_template_stage_layers" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_instances" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_templates" CASCADE/);
  });

  it("nullifies legacy traces FKs before dropping the columns", () => {
    expect(sql).toMatch(
      /ALTER TABLE "traces" ALTER COLUMN "stage_instance_id" DROP NOT NULL/,
    );
    expect(sql).toMatch(/UPDATE "traces" SET "workflow_instance_id" = NULL, "stage_instance_id" = NULL/);
    expect(sql).toMatch(/ALTER TABLE "traces" DROP COLUMN IF EXISTS "workflow_instance_id"/);
    expect(sql).toMatch(/ALTER TABLE "traces" DROP COLUMN IF EXISTS "stage_instance_id"/);
  });

  it("drops legacy columns from compaction_snapshots", () => {
    expect(sql).toMatch(
      /ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "workflow_instance_id"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "stage_id"/,
    );
  });

  it("adds archived_at column to governed_workflow_definitions", () => {
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_definitions" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz/,
    );
  });

  it("creates a partial index on (company_id, enabled) filtering archived rows", () => {
    expect(sql).toMatch(
      /CREATE INDEX .*"governed_workflow_definitions_company_enabled_active_idx".*ON "governed_workflow_definitions".*\("company_id", "enabled"\).*WHERE "archived_at" IS NULL/s,
    );
  });

  it("does NOT drop the traces table itself", () => {
    expect(sql).not.toMatch(/DROP TABLE IF EXISTS "traces"/);
  });
});
