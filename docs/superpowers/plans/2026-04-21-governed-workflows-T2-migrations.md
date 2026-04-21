# Governed Workflows — T2 DB Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the database schema for governed workflows — 4 new tables (`governed_workflow_definitions`, `governed_workflow_runs`, `governed_step_executions`, `gate_results`), extend `agents` (git tag + enabled flag) and `config_layer_items` (new item types), all with RLS, indexes, and Drizzle schema files matching the runtime contract expected by T4/T5.

**Architecture:** One new SQL migration `0065_governed_workflows.sql` (hand-written, following the post-0047 convention — Drizzle journal is frozen). All enum-like columns are modelled as `text` with `CHECK IN (...)` constraints (codebase convention — no pgEnum after 64 migrations). RLS uses the canonical `app.current_company_id` RESTRICTIVE pattern from migration 0030. Drizzle schemas mirror each table 1:1 and get re-exported from the schema barrel. File-content tests (vitest, in `packages/db/`) assert the migration contains the exact expected statements; type safety of the Drizzle schemas is covered by `bun run typecheck`.

**Tech Stack:** PostgreSQL 16, Drizzle ORM 0.38, vitest 3, `@mnm/shared` (for `AUDIT_ACTOR_TYPES`), bun workspaces.

**Source spec:** `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — Section 2 (data model) + Section 6 (gate results fields) + Section 7 (T2 row).

**Scope of T2:** Only schema + RLS + Drizzle mirrors. No runtime code, no services, no MCP wiring. T2 is independent of T1 (package) and T3 (git provider) — they can run in parallel. Runtime consumers (gate runner, MCP tools, sync service) land in T4/T5/T6.

---

## Deviations from spec (intentional, explained here)

| Spec says | Plan does | Why |
|---|---|---|
| `governed_run_status` / `governed_step_state` as pg enums | `status` / `state` columns as `text NOT NULL CHECK (... IN (...))` | Zero pgEnum exist across 64 migrations (grep confirmed). MnM convention is `text + CHECK`. Keeps parity with `scope`, `visibility`, `provider`, `status` already in `config_layers`, `user_mcp_credentials`, etc. Also avoids `ALTER TYPE ADD VALUE` pain if we add a state later. |
| `gate_results.kind` as text | Same — kept as `text` per spec with a supporting index. | Matches spec §2 "Contraintes systémiques" explicitly. |
| `initiated_by_actor_type` values: `user/agent/system/system-nightly` | CHECK constraint uses `('user', 'agent', 'system')` — the exact `AUDIT_ACTOR_TYPES` tuple in `packages/shared/src/types/audit.ts`. | `system-nightly` is not part of the canonical `AuditActorType`. Adding it would require broadening the shared type in a separate cross-cutting change. If T5 needs it, that lands with T5. Flagged as open item at bottom of this plan. |
| Extend `config_layer_items.item_type` with `(mcp_server, hook, setting, env_ref)` | Only add `env_ref`. `hook`, `setting`, and `mcp` already exist in the CHECK (since migration 0052). | Current post-0062 CHECK list: `('mcp', 'skill', 'hook', 'setting', 'git_provider', 'credential')`. Decision (user call, 2026-04-21): do NOT introduce a separate `mcp_server` item type — the existing `mcp` item is reused for both server-side and user-side MCP consumption. The `config_json` shape decides the behaviour: if auth material is present, the server or Claude Code consumes the MCP directly; if absent, SessionStart surfaces it to the user and the entry gate may fail-close until it is set up locally. Keeping one item type avoids shape discrimination at read time. |
| "Advisory locks (`pg_advisory_xact_lock`) on `launchWorkflow` (pattern MnM existant)" appears in the T2 row | Not addressed in this plan. | Advisory locks are a runtime concern, not DDL. No SQL statement to add. The lock will be acquired by T5's `launchWorkflow` service handler. Documented in the T2 completion report so T5 author picks it up. |

Three items from the T1 tranche completion report (`.strict()` on `gateOutputSchema`, JSDoc disambiguation, config-payload integration test) are **not** in T2's scope — per T1's plan they belong to T4's first PR.

---

## File Structure

All new code lives under `packages/db/`. One root `vitest.config.ts` entry is already in place (`packages/db` is registered as a vitest project but has no tests today — this plan adds the first one).

| File | Responsibility |
|---|---|
| `packages/db/src/migrations/0065_governed_workflows.sql` | New hand-written migration. All DDL for T2 in statement-breakpoint-separated blocks. |
| `packages/db/src/migrations/0065_governed_workflows.test.ts` | Vitest file reading the `.sql` file and asserting every ALTER/CREATE/POLICY/INDEX is present with the exact expected shape. Mirrors the `e2e/tests/TECH-05.spec.ts` pattern but lives inside the db package. |
| `packages/db/src/schema/governed_workflow_definitions.ts` | Drizzle schema for the 4 metadata rows. |
| `packages/db/src/schema/governed_workflow_runs.ts` | Drizzle schema for runs. |
| `packages/db/src/schema/governed_step_executions.ts` | Drizzle schema for step executions. |
| `packages/db/src/schema/gate_results.ts` | Drizzle schema for gate results. |
| `packages/db/src/schema/agents.ts` (modify) | Add `latestGitTag` and `enabled` columns. |
| `packages/db/src/schema/index.ts` (modify) | Export the 4 new tables. |

---

## Task 1: Empty migration file + file-content test skeleton

**Files:**
- Create: `packages/db/src/migrations/0065_governed_workflows.sql`
- Create: `packages/db/src/migrations/0065_governed_workflows.test.ts`

- [ ] **Step 1: Write the failing test skeleton**

Create `packages/db/src/migrations/0065_governed_workflows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../0065_governed_workflows.sql'`.

- [ ] **Step 3: Create the migration with a header comment**

Create `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- GOVERNED-WORKFLOWS: T2 — schema for governed workflow runs, steps, gate results
-- Spec: docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md §2
-- Depends on: migration 0052 (config_layer_items), 0062 (item_type CHECK)
-- Follow-on migrations will land with T4/T5 (runtime code).

-- All subsequent DDL added in later tasks of this plan.
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts
git commit -m "chore(workflows): scaffold T2 migration 0065_governed_workflows"
git push
```

---

## Task 2: Extend `agents` with `latest_git_tag` + `enabled`

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`
- Modify: `packages/db/src/schema/agents.ts`

- [ ] **Step 1: Extend the test with agent alteration assertions**

Append to `0065_governed_workflows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, expect FAIL** (2 new failures)

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: 2 new failures (regex does not match yet).

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- ===============================================================
-- 1. EXTEND existing tables
-- ===============================================================

-- 1a. agents: attach git metadata + toggle
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "latest_git_tag" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint
```

- [ ] **Step 4: Update the Drizzle schema for agents**

Edit `packages/db/src/schema/agents.ts`. Add the new columns alongside existing ones (alphabetical order within the block is not used in this file — place them together near `metadata`):

Current block ends with:

```typescript
    scopedToWorkspaceId: uuid("scoped_to_workspace_id"),
    baseLayerId: uuid("base_layer_id").references((): AnyPgColumn => configLayers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
```

Replace with:

```typescript
    scopedToWorkspaceId: uuid("scoped_to_workspace_id"),
    baseLayerId: uuid("base_layer_id").references((): AnyPgColumn => configLayers.id, { onDelete: "restrict" }),
    latestGitTag: text("latest_git_tag"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
```

And update the import tuple (it currently does not import `boolean`):

Current import block:

```typescript
import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
```

Replace with:

```typescript
import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 5: Run tests + typecheck, expect PASS**

Run in parallel:
```bash
bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts
bun run --filter @mnm/db typecheck
```
Expected: tests PASS, typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts packages/db/src/schema/agents.ts
git commit -m "feat(workflows): add agents.latest_git_tag + agents.enabled"
git push
```

---

## Task 3: Extend `config_layer_items.item_type` CHECK with `env_ref`

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`

No Drizzle change — `config_layer_items.itemType` is already typed as `text("item_type")` with no runtime CHECK mirrored in TS.

Decision (user call 2026-04-21): the existing `mcp` item_type is reused for user-side MCP entries too. `config_json` shape decides the behaviour — if auth material is present, the server or Claude Code can consume directly; if absent, SessionStart surfaces it to the user (and an entry gate may fail-close until set up locally). The only net-new item_type is `env_ref`, a reference to a required env var (e.g. `MNM_SENTRY_DSN`) that the SessionStart hook checks in the user's shell env.

- [ ] **Step 1: Extend the test**

Append to `0065_governed_workflows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: 2 of 3 new assertions fail (the `not.toMatch` already passes trivially); `add-check` and `drop-check` fail.

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- 1b. config_layer_items: extend item_type CHECK with 'env_ref'.
-- 'env_ref' is a required-env-var marker surfaced to the SessionStart hook so
-- the user knows which secrets must exist in their shell env for a given agent
-- or workflow to run (spec §5 — required_secrets in .mnm-managed.json).
-- NOTE: the existing 'mcp' item_type is reused for user-side MCP entries too
-- (decision 2026-04-21) — no separate 'mcp_server' value is introduced.
-- Keeping 'hook' and 'setting' unchanged (already allowed since migration 0052).
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;--> statement-breakpoint
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider', 'credential', 'env_ref'));--> statement-breakpoint
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: PASS (all 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts
git commit -m "feat(workflows): extend config_layer_items item_type with env_ref"
git push
```

---

## Task 4: `governed_workflow_definitions` table

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`
- Create: `packages/db/src/schema/governed_workflow_definitions.ts`

- [ ] **Step 1: Extend the test**

Append to `0065_governed_workflows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, expect FAIL** (4 new failures)

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`.

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- ===============================================================
-- 2. NEW TABLES
-- ===============================================================

-- 2a. governed_workflow_definitions — metadata only. No parsed workflow.json
-- cached here; the serveur fetches by git_sha on demand (spec §2 fetch-on-demand).
CREATE TABLE "governed_workflow_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "latest_git_tag" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "governed_workflow_definitions_company_name_uq"
  ON "governed_workflow_definitions"("company_id", "name");--> statement-breakpoint

ALTER TABLE "governed_workflow_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_workflow_definitions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_workflow_definitions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint
```

- [ ] **Step 4: Create the Drizzle schema**

Create `packages/db/src/schema/governed_workflow_definitions.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const governedWorkflowDefinitions = pgTable(
  "governed_workflow_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    latestGitTag: text("latest_git_tag"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUq: uniqueIndex("governed_workflow_definitions_company_name_uq")
      .on(table.companyId, table.name),
  }),
);
```

- [ ] **Step 5: Run tests + typecheck, expect PASS**

```bash
bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts
bun run --filter @mnm/db typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts packages/db/src/schema/governed_workflow_definitions.ts
git commit -m "feat(workflows): add governed_workflow_definitions table + RLS"
git push
```

---

## Task 5: `governed_workflow_runs` table

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`
- Create: `packages/db/src/schema/governed_workflow_runs.ts`

- [ ] **Step 1: Extend the test**

Append to `0065_governed_workflows.test.ts`:

```typescript
describe("governed_workflow_runs table", () => {
  it("creates the table with the expected columns and FKs", () => {
    expect(sql).toContain('CREATE TABLE "governed_workflow_runs" (');
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
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`.

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- 2b. governed_workflow_runs — one per launchWorkflow call. workflow_git_tag/sha
-- are the immutable ref captured at trigger time (spec §2).
-- initiated_by_actor_type aligns to AUDIT_ACTOR_TYPES canonical tuple.
-- status uses text + CHECK (no pgEnum in this codebase).
CREATE TABLE "governed_workflow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "workflow_def_id" uuid NOT NULL REFERENCES "governed_workflow_definitions"("id"),
  "workflow_git_tag" text NOT NULL,
  "workflow_git_sha" text NOT NULL,
  "initiated_by_actor_type" text NOT NULL CHECK ("initiated_by_actor_type" IN ('user', 'agent', 'system')),
  "initiated_by_actor_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'active', 'completed', 'failed')),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "params_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "governed_workflow_runs_company_status_idx"
  ON "governed_workflow_runs"("company_id", "status");--> statement-breakpoint
CREATE INDEX "governed_workflow_runs_def_started_idx"
  ON "governed_workflow_runs"("workflow_def_id", "started_at" DESC);--> statement-breakpoint

ALTER TABLE "governed_workflow_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_workflow_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_workflow_runs" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint
```

- [ ] **Step 4: Create the Drizzle schema**

Create `packages/db/src/schema/governed_workflow_runs.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { governedWorkflowDefinitions } from "./governed_workflow_definitions.js";

export const GOVERNED_RUN_STATUSES = ["draft", "active", "completed", "failed"] as const;
export type GovernedRunStatus = (typeof GOVERNED_RUN_STATUSES)[number];

export const GOVERNED_RUN_INITIATED_ACTOR_TYPES = ["user", "agent", "system"] as const;
export type GovernedRunInitiatedActorType = (typeof GOVERNED_RUN_INITIATED_ACTOR_TYPES)[number];

export const governedWorkflowRuns = pgTable(
  "governed_workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workflowDefId: uuid("workflow_def_id").notNull().references(() => governedWorkflowDefinitions.id),
    workflowGitTag: text("workflow_git_tag").notNull(),
    workflowGitSha: text("workflow_git_sha").notNull(),
    initiatedByActorType: text("initiated_by_actor_type").$type<GovernedRunInitiatedActorType>().notNull(),
    initiatedByActorId: text("initiated_by_actor_id").notNull(),
    status: text("status").$type<GovernedRunStatus>().notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    paramsJson: jsonb("params_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("governed_workflow_runs_company_status_idx")
      .on(table.companyId, table.status),
    // Note: DESC ordering for started_at lives in the SQL (source of truth for
    // migrations). Drizzle 0.38's per-column `.desc()` helper is not used
    // anywhere else in this codebase — keep the TS index declaration simple
    // and rely on the SQL for physical ordering.
    defStartedIdx: index("governed_workflow_runs_def_started_idx")
      .on(table.workflowDefId, table.startedAt),
  }),
);
```

- [ ] **Step 5: Run tests + typecheck, expect PASS**

```bash
bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts
bun run --filter @mnm/db typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts packages/db/src/schema/governed_workflow_runs.ts
git commit -m "feat(workflows): add governed_workflow_runs table + RLS"
git push
```

---

## Task 6: `governed_step_executions` table

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`
- Create: `packages/db/src/schema/governed_step_executions.ts`

- [ ] **Step 1: Extend the test**

Append to `0065_governed_workflows.test.ts`:

```typescript
describe("governed_step_executions table", () => {
  it("creates the table with the expected columns", () => {
    expect(sql).toContain('CREATE TABLE "governed_step_executions" (');
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
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`.

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- 2c. governed_step_executions — one row per step per run.
-- ON DELETE CASCADE on run_id so a cancelled/purged run cleans up its steps.
-- launched_by_actor_* are nullable because a pending step has not been launched yet.
CREATE TABLE "governed_step_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "run_id" uuid NOT NULL REFERENCES "governed_workflow_runs"("id") ON DELETE CASCADE,
  "step_id_in_json" text NOT NULL,
  "state" text NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending', 'running', 'gate_eval', 'succeeded', 'failed')),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "artifacts_json" jsonb,
  "launched_by_actor_type" text CHECK ("launched_by_actor_type" IN ('user', 'agent', 'system')),
  "launched_by_actor_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "governed_step_executions_run_step_uq"
  ON "governed_step_executions"("run_id", "step_id_in_json");--> statement-breakpoint
CREATE INDEX "governed_step_executions_run_state_idx"
  ON "governed_step_executions"("run_id", "state");--> statement-breakpoint

ALTER TABLE "governed_step_executions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_step_executions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_step_executions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint
```

- [ ] **Step 4: Create the Drizzle schema**

Create `packages/db/src/schema/governed_step_executions.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";

export const GOVERNED_STEP_STATES = [
  "pending",
  "running",
  "gate_eval",
  "succeeded",
  "failed",
] as const;
export type GovernedStepState = (typeof GOVERNED_STEP_STATES)[number];

export const GOVERNED_STEP_LAUNCHED_ACTOR_TYPES = ["user", "agent", "system"] as const;
export type GovernedStepLaunchedActorType = (typeof GOVERNED_STEP_LAUNCHED_ACTOR_TYPES)[number];

export const governedStepExecutions = pgTable(
  "governed_step_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    runId: uuid("run_id").notNull().references(() => governedWorkflowRuns.id, { onDelete: "cascade" }),
    stepIdInJson: text("step_id_in_json").notNull(),
    state: text("state").$type<GovernedStepState>().notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    artifactsJson: jsonb("artifacts_json").$type<Record<string, unknown>>(),
    launchedByActorType: text("launched_by_actor_type").$type<GovernedStepLaunchedActorType>(),
    launchedByActorId: text("launched_by_actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runStepUq: uniqueIndex("governed_step_executions_run_step_uq")
      .on(table.runId, table.stepIdInJson),
    runStateIdx: index("governed_step_executions_run_state_idx")
      .on(table.runId, table.state),
  }),
);
```

- [ ] **Step 5: Run tests + typecheck, expect PASS**

```bash
bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts
bun run --filter @mnm/db typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts packages/db/src/schema/governed_step_executions.ts
git commit -m "feat(workflows): add governed_step_executions table + RLS"
git push
```

---

## Task 7: `gate_results` table

**Files:**
- Modify: `packages/db/src/migrations/0065_governed_workflows.sql`
- Modify: `packages/db/src/migrations/0065_governed_workflows.test.ts`
- Create: `packages/db/src/schema/gate_results.ts`

- [ ] **Step 1: Extend the test**

Append to `0065_governed_workflows.test.ts`:

```typescript
describe("gate_results table", () => {
  it("creates the table with the expected columns", () => {
    expect(sql).toContain('CREATE TABLE "gate_results" (');
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
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`.

- [ ] **Step 3: Add the SQL**

Append to `packages/db/src/migrations/0065_governed_workflows.sql`:

```sql
-- 2d. gate_results — one row per evaluated gate. kind is open text (NOT an enum)
-- per spec §2 extensibility rule — adding a new gate type (on-failure, mid, ...)
-- must NOT require a migration. Hints stored as text[] to match the GateOutput
-- contract hints?: string[].
CREATE TABLE "gate_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "run_id" uuid NOT NULL REFERENCES "governed_workflow_runs"("id") ON DELETE CASCADE,
  "step_exec_id" uuid NOT NULL REFERENCES "governed_step_executions"("id") ON DELETE CASCADE,
  "gate_id_in_json" text NOT NULL,
  "kind" text NOT NULL,
  "pass" boolean NOT NULL,
  "report" text NOT NULL,
  "error_code" text,
  "hints" text[] NOT NULL DEFAULT '{}'::text[],
  "gate_git_sha" text NOT NULL,
  "evaluated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "gate_results_step_kind_evaluated_idx"
  ON "gate_results"("step_exec_id", "kind", "evaluated_at" DESC);--> statement-breakpoint
CREATE INDEX "gate_results_company_kind_idx"
  ON "gate_results"("company_id", "kind");--> statement-breakpoint

ALTER TABLE "gate_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gate_results" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "gate_results" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint
```

- [ ] **Step 4: Create the Drizzle schema**

Create `packages/db/src/schema/gate_results.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";
import { governedStepExecutions } from "./governed_step_executions.js";

export const gateResults = pgTable(
  "gate_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    runId: uuid("run_id").notNull().references(() => governedWorkflowRuns.id, { onDelete: "cascade" }),
    stepExecId: uuid("step_exec_id").notNull().references(() => governedStepExecutions.id, { onDelete: "cascade" }),
    gateIdInJson: text("gate_id_in_json").notNull(),
    kind: text("kind").notNull(),
    pass: boolean("pass").notNull(),
    report: text("report").notNull(),
    errorCode: text("error_code"),
    hints: text("hints").array().notNull().default(sql`'{}'::text[]`),
    gateGitSha: text("gate_git_sha").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // DESC on evaluated_at lives only in the SQL (see governed_workflow_runs comment).
    stepKindEvaluatedIdx: index("gate_results_step_kind_evaluated_idx")
      .on(table.stepExecId, table.kind, table.evaluatedAt),
    companyKindIdx: index("gate_results_company_kind_idx")
      .on(table.companyId, table.kind),
  }),
);
```

- [ ] **Step 5: Run tests + typecheck, expect PASS**

```bash
bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts
bun run --filter @mnm/db typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0065_governed_workflows.sql packages/db/src/migrations/0065_governed_workflows.test.ts packages/db/src/schema/gate_results.ts
git commit -m "feat(workflows): add gate_results table + RLS"
git push
```

---

## Task 8: Export the 4 new tables from the schema barrel

**Files:**
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add the exports**

Open `packages/db/src/schema/index.ts`. At the bottom, after the last `oauthRefreshTokens` line, append:

```typescript
// GOVERNED-WORKFLOWS: T2 — definition/run/step/gate metadata
export {
  governedWorkflowDefinitions,
} from "./governed_workflow_definitions.js";
export {
  governedWorkflowRuns,
  GOVERNED_RUN_STATUSES,
  GOVERNED_RUN_INITIATED_ACTOR_TYPES,
  type GovernedRunStatus,
  type GovernedRunInitiatedActorType,
} from "./governed_workflow_runs.js";
export {
  governedStepExecutions,
  GOVERNED_STEP_STATES,
  GOVERNED_STEP_LAUNCHED_ACTOR_TYPES,
  type GovernedStepState,
  type GovernedStepLaunchedActorType,
} from "./governed_step_executions.js";
export { gateResults } from "./gate_results.js";
```

- [ ] **Step 2: Typecheck the package**

Run: `bun run --filter @mnm/db typecheck`
Expected: PASS.

- [ ] **Step 3: Verify the exports are reachable from another workspace**

Run (one-liner sanity — no file written):

```bash
node --input-type=module -e "import('@mnm/db').then(m => { const keys = ['governedWorkflowDefinitions','governedWorkflowRuns','governedStepExecutions','gateResults','GOVERNED_RUN_STATUSES','GOVERNED_STEP_STATES']; for (const k of keys) { if (!(k in m)) throw new Error('Missing export: ' + k); } console.log('OK'); })"
```

Expected: `OK`. (If the package is not built, run `bun run --filter @mnm/db build` first — the `exports` field points at `dist/` in `publishConfig`, but workspace-internal consumption uses `src/` via root `exports`.)

Note: in MnM workspace configuration the root `exports` of `@mnm/db/package.json` is already `./src/index.ts`, so the import resolves against source in dev. No build required for the sanity check to pass.

- [ ] **Step 4: Add a barrel-export assertion to the migration test**

Append to `packages/db/src/migrations/0065_governed_workflows.test.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `bunx vitest run packages/db/src/migrations/0065_governed_workflows.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/src/migrations/0065_governed_workflows.test.ts
git commit -m "feat(workflows): expose T2 tables via @mnm/db barrel"
git push
```

---

## Task 9: Final cross-package checks + apply the migration against an embedded PG

**Files:** none (verification only).

- [ ] **Step 1: Typecheck everything**

Run: `bun run typecheck`
Expected: same green baseline as before T2 (no regression).

Pre-existing failures allowed:
- Root `mnm` `embedded-postgres-windows` (unrelated, documented in T1 completion report).

Any new failure in `@mnm/db`, `@mnm/server`, `@mnm/shared`, or a workspace that imports from `@mnm/db` is a T2 regression — fix before committing.

- [ ] **Step 2: Full test suite**

Run: `bun run test:run`
Expected: the 0065 test file and all its assertions pass. Pre-existing Windows `@mnm/server` + `@mnm/adapter-opencode-local` failures unchanged.

- [ ] **Step 3: Apply the migration against a real PG (embedded)**

`bun run dev` boots the server against an embedded Postgres and runs `applyPendingMigrations` automatically. The 0065 migration lands before any handler accepts traffic. Success criterion: server startup logs `Migrations complete` (or `No pending migrations` on a subsequent run).

If starting the dev server is impractical in the agent's environment, document that T2 was validated by file-content tests only. The migration will land the next time `bun run dev` or the deployment pipeline runs.

Run (optional — skip if the agent is non-interactive):

```bash
bun run dev
```

Stop after seeing `Migrations complete` and check the DB:

```bash
psql "$DATABASE_URL" -c "\\dt governed_workflow_definitions"
psql "$DATABASE_URL" -c "\\dt governed_workflow_runs"
psql "$DATABASE_URL" -c "\\dt governed_step_executions"
psql "$DATABASE_URL" -c "\\dt gate_results"
psql "$DATABASE_URL" -c "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('governed_workflow_definitions','governed_workflow_runs','governed_step_executions','gate_results');"
```

Expected: all 4 tables exist, `relrowsecurity = t` and `relforcerowsecurity = t` for every row.

- [ ] **Step 4: Parity tracker**

Per project CLAUDE.md rule: any PR touching schema adjacent to user-visible behaviour should consider the parity tracker. T2 is backend DDL only — no UI, no IPC, no desktop-native capability — so no `scripts/parity/data.ts` edit. Add this line to the PR body if opening one:

> No `scripts/parity/data.ts` change: T2 is pure backend DDL (new tables + column extensions), no UI or desktop surface is introduced. Parity entries will arrive with T5 (MCP) and T6 (hook).

- [ ] **Step 5: Completion report append**

Append a completion report section at the bottom of this plan file (after review, see template below). No commit — the completion report is part of the wrap-up PR for this tranche.

---

## Post-T2 handoff checklist

- [ ] `packages/db/src/migrations/0065_governed_workflows.sql` exists with header + all 4 new tables + `agents` extension + `config_layer_items` CHECK extension.
- [ ] `packages/db/src/migrations/0065_governed_workflows.test.ts` is green (all describe blocks PASS).
- [ ] 4 new Drizzle schema files under `packages/db/src/schema/` exist and typecheck.
- [ ] `packages/db/src/schema/index.ts` exports the 4 new tables + 2 const tuples + 4 union types.
- [ ] `packages/db/src/schema/agents.ts` has `latestGitTag` (text) and `enabled` (boolean, default true).
- [ ] `bun run typecheck` green (minus pre-existing Windows embedded-postgres failure).
- [ ] `bun run test:run` green for the 0065 test file.
- [ ] Each task committed as one conventional-commit message, all pushed to `origin/master`.
- [ ] Spec §7 table row for T2 updated to ✅ shipped with commit range.

---

## Open items flagged to the user before execution

These deserve a green light before the agent starts executing:

All 4 open items were resolved with the user on 2026-04-21 before execution:

1. **`initiated_by_actor_type` values** → confirmed: `('user', 'agent', 'system')`. `system-nightly` deferred to T5 if needed.
2. **`mcp` vs `mcp_server`** → confirmed: no `mcp_server`. Reuse existing `mcp` item_type for both server-side and user-side MCP entries. The `config_json` shape decides what Claude Code / the server can do with it (auth present = consumable directly; auth absent = user must set up locally, entry gate may enforce). Only `env_ref` is net-new. Plan updated accordingly.
3. **`status` / `state` as text + CHECK** → confirmed.
4. **Table-level `completed_at >= started_at` CHECK** → confirmed: skip. Will be revisited later as an evolution if needed.

Nothing left to confirm — ready to execute.

---

## Completion report — T2 shipped YYYY-MM-DD

(Populate after final review.)

### Shipped commits

```
(populate with git log --oneline <before>..<after>)
```

### Metrics

| Category | Count |
|---|---|
| SQL statements in migration 0065 | |
| New tables | 4 |
| New Drizzle schema files | 4 |
| Modified schema files | 2 (`agents`, `index`) |
| Vitest assertions in 0065 test | |
| Public exports added to `@mnm/db` | |

### Review outcome

(Two-stage review per tranche: spec compliance + code quality.)

### Deferred follow-ups (to address in T4 or T5)

| # | Item | File | Rationale |
|---|------|------|-----------|
| 1 | Advisory lock in `launchWorkflow` | T5 service | Spec §2 mentions `pg_advisory_xact_lock` but it's a runtime concern, not DDL. |
| 2 | | | |

### Next steps

- T3 (GitProvider) can run in parallel — independent of T2.
- T4 (gate runner) depends on T2 + T3. The 3 deferred Important items from T1 land in T4's first PR.
- T5 (MCP tools) depends on T2 + T4.
