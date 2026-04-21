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
    expect(sql).toMatch(/CREATE TABLE "governed_workflow_definitions" \(/);
    expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/"company_id" uuid NOT NULL REFERENCES "companies"\("id"\)/);
    expect(sql).toMatch(/"name" text NOT NULL/);
    expect(sql).toMatch(/"description" text/);
    expect(sql).toMatch(/"latest_git_tag" text/);
    expect(sql).toMatch(
      /"enabled" boolean NOT NULL DEFAULT true/,
    );
    expect(sql).toMatch(/"created_at" timestamptz NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/"updated_at" timestamptz NOT NULL DEFAULT now\(\)/);
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

describe("governed_workflow_runs table", () => {
  it("creates the table with the expected columns and FKs", () => {
    expect(sql).toMatch(/CREATE TABLE "governed_workflow_runs" \(/);
    expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/"company_id" uuid NOT NULL REFERENCES "companies"\("id"\)/);
    expect(sql).toMatch(
      /"workflow_def_id" uuid NOT NULL REFERENCES "governed_workflow_definitions"\("id"\)/,
    );
    expect(sql).toMatch(/"workflow_git_tag" text NOT NULL/);
    expect(sql).toMatch(/"workflow_git_sha" text NOT NULL/);
    expect(sql).toMatch(
      /"initiated_by_actor_type" text NOT NULL CHECK \("initiated_by_actor_type" IN \('user', 'agent', 'system'\)\)/,
    );
    expect(sql).toMatch(/"initiated_by_actor_id" text NOT NULL/);
    expect(sql).toMatch(
      /"status" text NOT NULL DEFAULT 'draft' CHECK \("status" IN \('draft', 'active', 'completed', 'failed'\)\)/,
    );
    expect(sql).toMatch(/"started_at" timestamptz/);
    expect(sql).toMatch(/"completed_at" timestamptz/);
    expect(sql).toMatch(/"params_json" jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
    expect(sql).toMatch(/"created_at" timestamptz NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/"updated_at" timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("indexes by (company_id, status) for listRuns queries", () => {
    expect(sql).toMatch(
      /CREATE INDEX "governed_workflow_runs_company_status_idx"\s+ON "governed_workflow_runs"\("company_id", "status"\);/,
    );
  });

  it("indexes by (workflow_def_id, started_at DESC) for per-workflow history", () => {
    expect(sql).toMatch(
      /CREATE INDEX "governed_workflow_runs_def_started_idx"\s+ON "governed_workflow_runs"\("workflow_def_id", "started_at" DESC\);/,
    );
  });

  it("enables + forces RLS with tenant_isolation policy", () => {
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_runs" ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_runs" FORCE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /CREATE POLICY "tenant_isolation" ON "governed_workflow_runs" AS RESTRICTIVE FOR ALL USING \(company_id = current_setting\('app\.current_company_id', true\)::uuid\);/,
    );
  });
});

describe("governed_step_executions table", () => {
  it("creates the table with the expected columns", () => {
    expect(sql).toMatch(/CREATE TABLE "governed_step_executions" \(/);
    expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/"company_id" uuid NOT NULL REFERENCES "companies"\("id"\)/);
    expect(sql).toMatch(
      /"run_id" uuid NOT NULL REFERENCES "governed_workflow_runs"\("id"\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(/"step_id_in_json" text NOT NULL/);
    expect(sql).toMatch(
      /"state" text NOT NULL DEFAULT 'pending' CHECK \("state" IN \('pending', 'running', 'gate_eval', 'succeeded', 'failed'\)\)/,
    );
    expect(sql).toMatch(/"started_at" timestamptz/);
    expect(sql).toMatch(/"completed_at" timestamptz/);
    expect(sql).toMatch(/"artifacts_json" jsonb/);
    expect(sql).toMatch(
      /"launched_by_actor_type" text CHECK \("launched_by_actor_type" IN \('user', 'agent', 'system'\)\)/,
    );
    expect(sql).toMatch(/"launched_by_actor_id" text/);
    expect(sql).toMatch(/"created_at" timestamptz NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/"updated_at" timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("has a unique index on (run_id, step_id_in_json)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "governed_step_executions_run_step_uq"\s+ON "governed_step_executions"\("run_id", "step_id_in_json"\);/,
    );
  });

  it("indexes pending+running states for the scheduler", () => {
    expect(sql).toMatch(
      /CREATE INDEX "governed_step_executions_run_state_idx"\s+ON "governed_step_executions"\("run_id", "state"\);/,
    );
  });

  it("enables + forces RLS with tenant_isolation policy", () => {
    expect(sql).toMatch(
      /ALTER TABLE "governed_step_executions" ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "governed_step_executions" FORCE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /CREATE POLICY "tenant_isolation" ON "governed_step_executions" AS RESTRICTIVE FOR ALL USING \(company_id = current_setting\('app\.current_company_id', true\)::uuid\);/,
    );
  });
});

describe("gate_results table", () => {
  it("creates the table with the expected columns", () => {
    expect(sql).toMatch(/CREATE TABLE "gate_results" \(/);
    expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/"company_id" uuid NOT NULL REFERENCES "companies"\("id"\)/);
    expect(sql).toMatch(
      /"run_id" uuid NOT NULL REFERENCES "governed_workflow_runs"\("id"\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /"step_exec_id" uuid NOT NULL REFERENCES "governed_step_executions"\("id"\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(/"gate_id_in_json" text NOT NULL/);
    expect(sql).toMatch(/"kind" text NOT NULL/);
    expect(sql).not.toMatch(/"kind" text NOT NULL CHECK/); // kind is open text, no CHECK
    expect(sql).toMatch(/"pass" boolean NOT NULL/);
    expect(sql).toMatch(/"report" text NOT NULL/);
    expect(sql).toMatch(/"error_code" text/);
    expect(sql).toMatch(/"hints" text\[\] NOT NULL DEFAULT '\{\}'::text\[\]/);
    expect(sql).toMatch(/"gate_git_sha" text NOT NULL/);
    expect(sql).toMatch(/"evaluated_at" timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("indexes by (step_exec_id, kind, evaluated_at DESC) for per-step lookup", () => {
    expect(sql).toMatch(
      /CREATE INDEX "gate_results_step_kind_evaluated_idx"\s+ON "gate_results"\("step_exec_id", "kind", "evaluated_at" DESC\);/,
    );
  });

  it("indexes by (company_id, kind) for admin queries", () => {
    expect(sql).toMatch(
      /CREATE INDEX "gate_results_company_kind_idx"\s+ON "gate_results"\("company_id", "kind"\);/,
    );
  });

  it("enables + forces RLS with tenant_isolation policy", () => {
    expect(sql).toMatch(
      /ALTER TABLE "gate_results" ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "gate_results" FORCE ROW LEVEL SECURITY;/,
    );
    expect(sql).toMatch(
      /CREATE POLICY "tenant_isolation" ON "gate_results" AS RESTRICTIVE FOR ALL USING \(company_id = current_setting\('app\.current_company_id', true\)::uuid\);/,
    );
  });
});

describe("schema barrel exports", () => {
  it("exposes the 4 new Drizzle tables", async () => {
    const schema = await import("../schema/index.js");
    expect(schema).toHaveProperty("governedWorkflowDefinitions");
    expect(schema).toHaveProperty("governedWorkflowRuns");
    expect(schema).toHaveProperty("governedStepExecutions");
    expect(schema).toHaveProperty("gateResults");
  });

  it("exposes the state + status const tuples", async () => {
    const { GOVERNED_RUN_STATUSES, GOVERNED_STEP_STATES } = await import("../schema/index.js");
    expect(GOVERNED_RUN_STATUSES).toEqual(["draft", "active", "completed", "failed"]);
    expect(GOVERNED_STEP_STATES).toEqual(["pending", "running", "gate_eval", "succeeded", "failed"]);
  });
});
