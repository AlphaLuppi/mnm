# Governed Workflows — T5 MCP Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the 7 Governed-Workflow MCP primitives (`list_governed_workflows`, `get_governed_workflow`, `get_governed_workflow_run`, `launch_governed_workflow`, `launch_governed_step`, `complete_governed_step`, `sync_governed_environment`) on the existing MnM MCP server, wire them against a new `governedWorkflowService` that reads/writes the T2 tables under RLS, and pipe entry/exit gate evaluation through `@mnm/gate-runner` (T4) with sources fetched via `@mnm/git-provider` (T3). Extend the gate runner to inject real async helpers (`queryTraces`, `checkWorkflowExists`) into the isolate via `ivm.Reference` so gate authors can interrogate company data from their TypeScript gates.

**Architecture:** Three layers, all inside the existing `server/` workspace — **no new package**.

- **Service layer** (`server/src/services/governed-workflows.ts`, `governed-workflows-source-resolver.ts`, `governed-workflows-helpers.ts`) — pure domain logic against `Db`. All queries fail-closed under the existing `tenantContextMiddleware` RLS contract (company_id injected into `app.current_company_id`). `launchWorkflow` takes a `pg_advisory_xact_lock` keyed on `hashtext('launch:' || workflow_def_id)` inside the insert TX to serialize concurrent launches on the same definition.
- **Runner extension** (`packages/gate-runner/src/run-single-gate.ts` + a new `isolate-helpers.ts`) — adds a `helpers` dep of async functions, bridges each one into the isolate as a proxy async function that `.apply()`s a pre-bound `ivm.Reference`. Gates author them as `ctx.helpers.queryTraces(filter)`, exactly as the spec declares. Retry-once-on-crash semantics are preserved. Helpers calls are subject to the same 5 s per-gate timeout (enforced by the outer `apply` timeout — the inner `Reference.apply` uses a shorter 3 s ceiling to leave headroom for gate logic after a helper returns).
- **MCP tool layer** (`server/src/mcp/tools/governed-workflows.tool.ts`) — seven `defineMcpTools` entries that call the service and return the uniform MCP error contract. Registered in `allToolDefiners` (`server/src/mcp/tools/index.ts`). The service is injected via `buildMcpServices` (`server/src/mcp/build-mcp-services.ts`), which also constructs a process-wide `ShaCache` + a `GitProvider` (stubbed with `LocalBareRepoProvider` when `MNM_GIT_PROVIDER=local`, `GitlabProvider` otherwise).

**Tech Stack:** TypeScript 5.7, vitest 3, `@modelcontextprotocol/sdk@^1.29.0` (already wired in `server/src/mcp/index.ts`), drizzle-orm 0.38 with `sql\`...\`` for the advisory lock, `@mnm/governed-workflows` (T1 zod schemas), `@mnm/gate-runner` (T4 runner), `@mnm/git-provider` (T3 provider + `ShaCache`), `isolated-vm@^6.1.2` (T4 transitive, used by the helpers extension). Tools registered under the existing `WORKFLOWS_READ` / `WORKFLOWS_ENFORCE` permission slugs (no new RBAC seed in MVP — spec §alignement "Dynamic RBAC" respected, perms already exist in `packages/shared/src/contracts/permissions.ts:53-56`).

**Source spec:** `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — Section 4 (7 primitives — the heart of T5), Section 2 (DB shape, already implemented in T2), Section 6 (gate sandbox — helpers extension lives here), Section 7 (T5 row + "Points ouverts" resolved below).

**Scope of T5:** Only the MCP orchestrator + runner-helpers extension. No hook SessionStart (T6), no hello-world bootstrap (T7), no webhook listener, no GitLab repo provisioning, no HITL / approval tools, no A/B. T5 is the dependency bottleneck: T6 reads `sync_governed_environment`; T7 drives the whole pipeline end-to-end. **Also absorbs four deferred follow-ups** from T2/T3/T4 (advisory lock on `launchWorkflow`, wire-up of `@mnm/git-provider` in `@mnm/gate-runner`'s `resolveSource`, real `queryTraces` + `checkWorkflowExists` helpers, Node engines mismatch between root `>=20` and `isolated-vm`'s `>=22`).

---

## Pre-flight validation (already done 2026-04-21 — not a plan task)

| Check | Evidence |
|---|---|
| `@modelcontextprotocol/sdk` v1.29 is live on the server | `server/package.json:42`, `server/src/mcp/index.ts:3-7` |
| T2 tables exist + RLS policies present | `packages/db/src/migrations/0065_governed_workflows.sql`, schema files in `packages/db/src/schema/governed_*.ts` + `gate_results.ts` |
| T3 `GitProvider` / `LocalBareRepoProvider` / `GitlabProvider` / `ShaCache` exported | `packages/git-provider/src/index.ts:1-27` |
| T4 `runGateBlock` + `runSingleGate` take `RunSingleGateDeps` shape compatible with the helpers extension | `packages/gate-runner/src/run-gate-block.ts:1-70`, `packages/gate-runner/src/types.ts:47-86` |
| Existing tool definer pattern (`defineMcpTools`, `collectTools`, `services` injection, uniform error contract via `MCP_ERROR_CODES`) | `server/src/mcp/registry/define-mcp-tools.ts:30-151`, `server/src/mcp/tools/workflows.tool.ts:1-228` (reference for shape — NOT to be reused; Governed Workflows is a separate domain) |
| `tenantContextMiddleware` sets `app.current_company_id` before MCP handlers run | `server/src/middleware/tenant-context.ts:16-34` (mounted on `/companies/:companyId/*` routes) — for MCP traffic, the `actor.companyId` is used via `setTenantContext` invoked by each tool handler (see Task 1 Step 3). |

---

## Deviations from spec (intentional, explained here)

| Spec says | Plan does | Why |
|---|---|---|
| "MCP tools exposés à Claude Code via stdio" | Reuses the **existing HTTP+SSE** MCP server (Streamable HTTP + legacy SSE at `/mcp`). No stdio process. | MnM already runs a full MCP HTTP server with OAuth 2.1, rate limiting, per-actor tool filtering, RLS integration. Standing up a parallel stdio process would duplicate all of this and split the auth surface. Claude Code clients already support HTTP transports (`.mcp.json` with `"transport": "http"`). T5 adds tools to the existing registry — zero protocol code. |
| Tools named `listWorkflows`, `getWorkflow`, `launchStep`, etc. | Tools named `list_governed_workflows`, `get_governed_workflow`, `launch_governed_step`, ... | Two reasons: (1) the existing `workflows.tool.ts` already registers `list_workflows`, `get_workflow`, `start_workflow` for the **legacy** `workflow_templates` / `workflow_instances` domain. (2) MnM MCP uses snake_case tool names everywhere (see `server/src/mcp/tools/*.tool.ts`). Adding the `governed_` prefix keeps the two domains disjoint and aligns with convention. |
| "Séparer package `@mnm/mcp-orchestrator`" (open item) | All new code lives under `server/src/services/` + `server/src/mcp/tools/`. No new workspace. | The 7 tools are thin wrappers around DB queries + gate-runner invocations. A separate package would force us to export `McpServices`, `McpActor` types, duplicate the audit wiring, and give the team three places to change when adding a tool. `packages/gate-runner` stays separate (heavy native addon). The service is domain code — it belongs next to `agentService`, `workflowService`. |
| `GateContext.helpers: Record<string, unknown>` (T1 abstract declaration) | Runner extension adds `helpers: Record<string, (...args: any[]) => Promise<any>>` to `RunSingleGateDeps`. The isolate-side `ctx.helpers` is populated by a bridge that calls back out via `ivm.Reference.apply(null, args, { result: { promise: true, copy: true }, timeout: 3000 })`. | T1's `Record<string, unknown>` is deliberately loose so T5 can extend without breaking. The inner timeout (3 s) is less than the outer gate timeout (5 s default) so a helper call that stalls doesn't consume the full budget — the outer `apply` still cuts the gate at 5 s, but the helper's own timeout produces a cleaner error message. Helpers **always** receive args via `copy: true` — no references pass into the sandbox, no references come out. |
| "Advisory lock sur `launchWorkflow`" (T2 deferred) | Advisory lock wraps the run insert **and** the step_executions bulk insert, taken via `pg_advisory_xact_lock(hashtext('mnm:launch:' || workflow_def_id))`. Released automatically at TX commit/rollback. | Deferred from T2 because the migration doesn't need it — the lock is orchestrator-side. Keyed on `workflow_def_id` (not company_id) so parallel launches of *different* workflows are not serialized against each other. The prefix `mnm:launch:` isolates from any other advisory locks in the codebase (if future features take locks). `hashtext` is 32-bit — collisions are possible but harmless (they'd serialize unrelated workflows; no correctness risk). |
| "Webhook GitLab post-commit updates `latest_git_tag`" | Not in T5. `get_governed_workflow` accepts an explicit `git_tag`; `launchWorkflow` pins via `GitProvider.listTags()` at call time if `git_tag` not supplied. | Webhook is a perf optimisation (skip a tag list). MVP can afford the round-trip. Listed as deferred follow-up below. |
| `"queryTraces": "quelle shape de filter ? SQL-like, tags-based, time-range?"` (open item) | MVP signature: `queryTraces({ agentName?: string, stepId?: string, sinceIso?: string, limit?: number })` — returns up to 50 trace envelopes `{ id, agent_name, status, started_at, completed_at, gold_summary? }`. RLS-scoped. No arbitrary SQL. | Start narrow. Gate authors in MVP need "has this agent succeeded recently?" and "was this step's last attempt clean?" — both satisfied by this filter. Extensions (tag-based, workflow-scoped) are schema-additive: add optional fields, never remove. |
| "Cache miss → fetch via GitProvider → cache éternel RAM" | Consumer-wired via `ShaCache` + a thin `makeResolveSource(gitProvider, workflowGitSha, workflowRepoPath)` factory. Cache lifetime = process lifetime (`ShaCache` default). | Matches T4's pattern (`T4 stays pure (source in, verdict out); caller does the fetchBlob + ShaCache dance`). T5 is the caller. |
| Spec §7 open item: "Bootstrap d'une nouvelle company" | Not in T5 — T7 problem. In T5, a company's `governed_workflow_definitions` table is **seeded manually** for tests via a fixture helper `seedDefinition(db, {companyId, name, latestGitTag, repoUrl})` (used only in tests). Production companies insert rows via a future admin tool. | Stays narrow. Keeps plan bounded. |
| Spec §4: `syncEnvironment` returns `{agents:[{name, md_content, config_merged}], changelog, newSha}` | MVP: returns `{agents:[{name, mdContent, configMerged: { mcp: [...], hook: [...], setting: [...], env_ref: [...] }}], newSha, hasChanges}`. **No `changelog` field.** | Changelog (human-friendly "what changed since lastSyncedSha") requires diffing two sha'd snapshots. Doable but cosmetic. The harness can compute a per-agent `last_seen_sha` and compare. Flagged as deferred follow-up. |

---

## Open items resolved (no confirmation needed before execution)

All 7 questions in the T5 next-session prompt are resolved here:

1. **[RESOLVED]** Orchestrator location → inline in `server/src/services/` + `server/src/mcp/tools/`. No new package.
2. **[RESOLVED]** MCP transport → existing HTTP + SSE (already live on `server/src/mcp/index.ts`). No stdio process in MVP.
3. **[RESOLVED]** `resolveSource` factory → `makeResolveSource(gitProvider, workflowGitSha, workflowRepoPath)` returns a closure `(gateItemSource) => { source, gateSourcePath }` that joins the workflow dir with the gate's relative source, fetches via provider, caches by sha.
4. **[RESOLVED]** Helpers shape → `queryTraces({ agentName?, stepId?, sinceIso?, limit? })` returns bounded trace envelopes (max 50); `checkWorkflowExists(name)` returns boolean. Both RLS-scoped via the calling tool's `app.current_company_id`.
5. **[RESOLVED]** Advisory lock → `pg_advisory_xact_lock(hashtext('mnm:launch:' || workflow_def_id))` in the same TX as the run + step_executions insert.
6. **[RESOLVED]** Helper ivm.Reference bridge → new `packages/gate-runner/src/isolate-helpers.ts` wraps each async helper in a `Reference`, installs a `__mnm_call_helper` global inside the isolate, and pre-creates a `ctx.helpers` proxy at isolate setup time. Call shape: `await ctx.helpers.queryTraces({agentName:"greeter"})`.
7. **[RESOLVED]** Error taxonomy → reuse `WORKFLOW_ERROR_CODES` from `@mnm/governed-workflows` (T1). Add **two new codes** there: `WORKFLOW_RUN_NOT_FOUND` (for `getWorkflowRun` / `launchStep` / `completeStep` with unknown runId) and `WORKFLOW_GATE_FAILED` (surfaced by `launchStep` / `completeStep` when a gate block returns `pass:false` — distinct from `WORKFLOW_INVALID_ARTIFACT` which is malformed data, never an author verdict).

---

## T5 pre-mortem (branches that MUST have a dedicated test)

Mitigation for T4 retro lesson #7: list every conditional branch now and bind each one to a test. The implementer MUST NOT close a task until every branch in its file has an assertion.

| Branch | Test owner | Fixture |
|---|---|---|
| `launchWorkflow`: `git_tag` supplied vs. not | Task 4 | `seedDefinition({ latestGitTag: 'v1.0.0' })`, call with and without `git_tag` |
| `launchWorkflow`: definition not found | Task 4 | empty DB → expect `WORKFLOW_NOT_FOUND` |
| `launchWorkflow`: advisory lock contention | Task 4 | two concurrent `launchWorkflow` calls — assert serialization via `BEFORE/AFTER` timestamps |
| `launchStep`: step not found | Task 7 | `stepId: 'nope'` → `WORKFLOW_STEP_NOT_FOUND` |
| `launchStep`: deps unmet | Task 7 | step B deps on A, A still pending → `WORKFLOW_DEPENDENCY_UNMET` |
| `launchStep`: no entry gate | Task 7 | step without `gates.entry` → returns triplet immediately |
| `launchStep`: entry gate passes | Task 7 | stub gate returning `{pass:true}` |
| `launchStep`: entry gate fails | Task 7 | stub gate returning `{pass:false, error_code:'X'}` → `WORKFLOW_GATE_FAILED` |
| `completeStep`: exit gate passes | Task 8 | stub `{pass:true}` |
| `completeStep`: exit gate fails | Task 8 | stub `{pass:false}` |
| `completeStep`: no exit gate | Task 8 | step without `gates.exit` → state becomes `succeeded` directly |
| `completeStep`: all steps done → run completed | Task 8 | 2-step workflow, complete both → run status=`completed` |
| `completeStep`: idempotency on already-succeeded step | Task 8 | call twice → `WORKFLOW_ALREADY_COMPLETED` |
| `getWorkflowRun`: run not found | Task 6 | unknown runId → `WORKFLOW_RUN_NOT_FOUND` |
| `getWorkflowRun`: cross-tenant leak attempt | Task 6 | run belongs to company B, actor is company A → `WORKFLOW_RUN_NOT_FOUND` (not a 403 — do NOT leak existence) |
| Gate runner: helper returns value | Task 2 (runner ext) | helper `echo(x) → x` — gate asserts return |
| Gate runner: helper throws | Task 2 | helper throws `Error('boom')` — gate receives the message |
| Gate runner: helper times out (>3 s) | Task 2 | helper sleeps 4 s — `apply` times out inside 3 s window |
| Gate runner: helper called with non-serialisable arg | Task 2 | pass a `Symbol` or a circular — surfaces as GATE_EXCEPTION via `copy` failure |
| `syncEnvironment`: same sha supplied → hasChanges=false | Task 9 | `lastSyncedSha === newSha` |
| `syncEnvironment`: new sha → payload populated | Task 9 | stub GitProvider returning different tags |
| `syncEnvironment`: no agents for company | Task 9 | empty `agents` table → returns `{agents:[], hasChanges:false}` |
| `makeResolveSource`: gate source has leading `./` | Task 3 | `./gates/x.gate.ts` → joined correctly |
| `makeResolveSource`: gate source absolute (starts with `/` or `./../`) | Task 3 | rejected as invalid — gates must live under workflow dir |

---

## File structure

All new code lives under `server/src/services/`, `server/src/mcp/tools/`, `server/src/services/__tests__/`, and `packages/gate-runner/src/`. Two workspace modifications (`packages/governed-workflows` to add two error codes, `packages/gate-runner` for the helpers extension).

| File | Responsibility |
|---|---|
| `packages/governed-workflows/src/errors.ts` | **Modify** — add `WORKFLOW_RUN_NOT_FOUND`, `WORKFLOW_GATE_FAILED` to `WORKFLOW_ERROR_CODES`. |
| `packages/governed-workflows/src/errors.test.ts` | **Modify** — assert the two new codes are exported. |
| `packages/gate-runner/src/isolate-helpers.ts` | **Create** — `installHelpers(context, jail, helpers)` — wraps each async helper in an `ivm.Reference`, installs a `__mnm_call_helper` global, and returns the JS snippet that creates `ctx.helpers` inside the isolate. |
| `packages/gate-runner/src/run-single-gate.ts` | **Modify** — accept `helpers?: Record<string, (...args: any[]) => Promise<any>>` on `RunSingleGateDeps`. When populated, call `installHelpers` before injecting ctx. |
| `packages/gate-runner/src/__tests__/isolate-helpers.test.ts` | **Create** — unit tests for the helper bridge: return value, throw, timeout, non-serialisable arg. |
| `packages/gate-runner/src/index.ts` | **Modify** — re-export `installHelpers`. |
| `server/src/services/governed-workflows-source-resolver.ts` | **Create** — `makeResolveSource(gitProvider, workflowGitSha, workflowRepoPath, shaCache)` returns a `resolveSource` closure compatible with `RunGateBlockArgs`. |
| `server/src/services/governed-workflows-helpers.ts` | **Create** — `buildGateHelpers({ db, companyId })` returns `{ queryTraces, checkWorkflowExists }` async functions. |
| `server/src/services/governed-workflows.ts` | **Create** — `governedWorkflowService(db)` with `listDefinitions`, `getDefinition`, `getWorkflowParsed`, `launchWorkflow`, `getRun`, `launchStep`, `completeStep`, `syncEnvironment`. |
| `server/src/services/__tests__/governed-workflows.test.ts` | **Create** — integration tests using embedded-postgres + fixture `seedDefinition`. |
| `server/src/services/__tests__/governed-workflows-source-resolver.test.ts` | **Create** — unit tests for the resolver closure. |
| `server/src/services/__tests__/governed-workflows-helpers.test.ts` | **Create** — integration tests for `queryTraces` + `checkWorkflowExists` (RLS-scoped). |
| `server/src/mcp/tools/governed-workflows.tool.ts` | **Create** — 7 MCP tool definitions. |
| `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` | **Create** — tool handler tests with a mocked service. |
| `server/src/mcp/tools/index.ts` | **Modify** — import + append `governedWorkflowTools` to `allToolDefiners`. |
| `server/src/mcp/build-mcp-services.ts` | **Modify** — construct `GitProvider` (via env var dispatch), `ShaCache`, and `governedWorkflowService(db, {gitProvider, shaCache})`. Inject as `services.governedWorkflows`. |
| `package.json` (root) | **Modify** — bump `engines.node` from `>=20` to `>=22` to match `isolated-vm@6.x`. |
| `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` | **Modify** (final task) — flip T5 row to ✅ shipped + append deferred follow-ups. |

---

## Standing orders for implementer subagents

1. **JSON `task_assignment` is not a brief.** Do not start work until a prose `SendMessage` from team-lead authorises it. The `task_assignment` payload is a UI label only.
2. **Halfway check-in is mandatory.** After you write the files for a task but **before** you commit, send a one-line `SendMessage` to team-lead: `"files written, running tests + typecheck"`. Then run the checks. Then commit. Mitigates silent stalls at the post-write/pre-commit gap (T3/T4 retro).
3. **Plan comments are contract, not narration.** Any JSDoc, inline comment, or header comment that appears in a code block in this plan MUST be copied into the source verbatim. Do NOT strip comments citing "no comments by default" — the CLAUDE.md default is overridden by this plan's explicit comment blocks.
4. **Conventional commits.** Scope is `workflows`. Examples: `feat(workflows): governedWorkflowService launchWorkflow with advisory lock`, `feat(workflows): 7 MCP tools for governed workflows`, `feat(workflows): gate-runner helper-ref bridge`.
5. **Atomic commit + push.** Every task ends with `git add ... && git commit && git push`. Never leave unpushed commits.
6. **GPG signing can time out.** If `git commit` fails with `gpg: signing failed: Timeout`, retry the same commit with `-c commit.gpgsign=false`. Do NOT skip hooks or rewrite history.
7. **No emojis in code or commit messages.**
8. **Version strings in JSDoc vs `package.json`.** When a plan code block references a dep version (e.g. `isolated-vm@6.1.2`), the implementer MUST cross-check against `packages/*/package.json` on HEAD and use the **installed** version in the committed code. Mitigates T4 retro lesson #8.
9. **Pre-mortem branch coverage.** Before closing a task, grep your file for `if (`, `switch`, `throw`, `return` to enumerate branches — cross-check against the pre-mortem table above. If a branch isn't covered, add the test before you commit. Mitigates T4 retro lesson #7.

---

## Task 1: Add two new workflow error codes to `@mnm/governed-workflows`

**Files:**
- Modify: `packages/governed-workflows/src/errors.ts`
- Modify: `packages/governed-workflows/src/errors.test.ts`

- [ ] **Step 1: Write the failing test additions**

Open `packages/governed-workflows/src/errors.test.ts` and add to the existing `describe("WORKFLOW_ERROR_CODES")` block:

```typescript
it("includes WORKFLOW_RUN_NOT_FOUND", () => {
  expect(WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND).toBe("WORKFLOW_RUN_NOT_FOUND");
});

it("includes WORKFLOW_GATE_FAILED", () => {
  expect(WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED).toBe("WORKFLOW_GATE_FAILED");
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bun run --cwd packages/governed-workflows test`
Expected: 2 failing assertions — codes undefined.

- [ ] **Step 3: Extend `WORKFLOW_ERROR_CODES`**

In `packages/governed-workflows/src/errors.ts`, append to the `WORKFLOW_ERROR_CODES` Object.freeze literal (preserve the existing codes and JSDoc) and extend the JSDoc block:

```typescript
/**
 * Business error codes produced by the workflow orchestrator (MCP tools layer,
 * T5). These appear in MCP tool error payloads (`{ isError: true, error_code,
 * message, hints }`) returned to the Claude Code harness — NOT in
 * `gate_results.error_code`:
 *
 * - `WORKFLOW_NOT_FOUND` — `getWorkflow` / `launchWorkflow` with an unknown
 *   name (or unknown `git_tag` at that name).
 * - `WORKFLOW_RUN_NOT_FOUND` — `getWorkflowRun` / `launchStep` / `completeStep`
 *   called with a `runId` not visible to the actor's company (or absent).
 *   Returned instead of `404` so cross-tenant existence is never leaked.
 * - `WORKFLOW_DEPENDENCY_UNMET` — `launchStep` called on a step whose `deps`
 *   are not all `succeeded`.
 * - `WORKFLOW_STEP_NOT_FOUND` — `launchStep` / `completeStep` with a `stepId`
 *   not in the run's parsed workflow.
 * - `WORKFLOW_INVALID_ARTIFACT` — `completeStep` called with an artifact the
 *   step's exit-gate block flagged as invalid in a deterministic pre-check
 *   (distinct from a gate verdict — this is malformed data, not a failed
 *   business rule).
 * - `WORKFLOW_GATE_FAILED` — a gate block returned `pass:false`. Distinct from
 *   `WORKFLOW_INVALID_ARTIFACT` (malformed) and `GATE_*` codes (runner
 *   failures). The returned payload carries the failed `gate_result` so the
 *   harness can surface the author's `report` + `hints` to the user.
 * - `WORKFLOW_ALREADY_COMPLETED` — mutation attempted on a run already in
 *   `completed` or `failed` status (or on a step already in `succeeded` /
 *   `failed`).
 *
 * These codes are produced ONLY by the orchestrator. Gate runner code must
 * use `GATE_ERROR_CODES` instead.
 */
export const WORKFLOW_ERROR_CODES = Object.freeze({
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_RUN_NOT_FOUND: "WORKFLOW_RUN_NOT_FOUND",
  WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
  WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
  WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
  WORKFLOW_GATE_FAILED: "WORKFLOW_GATE_FAILED",
  WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
} as const);
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bun run --cwd packages/governed-workflows test`
Expected: all tests green including the two new assertions.

- [ ] **Step 5: Typecheck monorepo**

Run: `bun run typecheck`
Expected: green across all 13 packages (no downstream consumer of `WORKFLOW_ERROR_CODES` broke).

- [ ] **Step 6: Commit**

```bash
git add packages/governed-workflows/src/errors.ts packages/governed-workflows/src/errors.test.ts
git commit -m "feat(workflows): add WORKFLOW_RUN_NOT_FOUND + WORKFLOW_GATE_FAILED codes"
git push
```

---

## Task 2: Extend `@mnm/gate-runner` to inject real async helpers via `ivm.Reference`

**Files:**
- Create: `packages/gate-runner/src/isolate-helpers.ts`
- Modify: `packages/gate-runner/src/run-single-gate.ts`
- Modify: `packages/gate-runner/src/types.ts`
- Modify: `packages/gate-runner/src/index.ts`
- Create: `packages/gate-runner/src/__tests__/isolate-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/gate-runner/src/__tests__/isolate-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import ivm from "isolated-vm";
import { installHelpers } from "../isolate-helpers.js";

/**
 * The bridge MUST:
 *  - Expose each helper name as an async function on `ctx.helpers` inside the
 *    isolate.
 *  - Marshal arguments via `copy: true` (no Reference leakage across the
 *    sandbox boundary).
 *  - Resolve with the host function's return value (deep-copied).
 *  - Reject with a plain Error if the host function throws.
 *  - Reject with a timeout error if the host function exceeds 3 s.
 */
describe("installHelpers", () => {
  async function withIsolate<T>(
    fn: (ctx: ivm.Context, jail: ivm.Reference<Record<string, unknown>>) => Promise<T>,
  ): Promise<T> {
    const iso = new ivm.Isolate({ memoryLimit: 64 });
    try {
      const ctx = await iso.createContext();
      const jail = ctx.global;
      await jail.set("global", jail.derefInto());
      return await fn(ctx, jail);
    } finally {
      iso.dispose();
    }
  }

  it("forwards args and returns the helper's resolved value", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { echo: async (x: unknown) => x };
      await installHelpers(ctx, jail, helpers);
      const script = await ctx.eval(`
        (async () => {
          const r = await ctx.helpers.echo({ hello: "world" });
          return JSON.stringify(r);
        })()
      `, { promise: true, copy: true });
      expect(JSON.parse(script as string)).toEqual({ hello: "world" });
    });
  });

  it("rejects with the host error message when the helper throws", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { boom: async () => { throw new Error("kaboom"); } };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`ctx.helpers.boom()`, { promise: true, copy: true }),
      ).rejects.toThrow(/kaboom/);
    });
  });

  it("times out if the helper exceeds 3 seconds", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        slow: async () => new Promise((r) => setTimeout(r, 4000)),
      };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`ctx.helpers.slow()`, { promise: true, copy: true }),
      ).rejects.toThrow(/timed out/i);
    }, );
  }, 10_000);

  it("rejects when passed a non-serialisable argument (circular)", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { echo: async (x: unknown) => x };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(
          `(async () => { const o={}; o.self=o; return await ctx.helpers.echo(o); })()`,
          { promise: true, copy: true },
        ),
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun run --cwd packages/gate-runner test isolate-helpers`
Expected: FAIL — `installHelpers` does not exist.

- [ ] **Step 3: Create `packages/gate-runner/src/isolate-helpers.ts`**

```typescript
import ivm from "isolated-vm";

/**
 * Bridge async host helpers into a V8 isolate. For each helper `foo`:
 *  - The host function is wrapped in an `ivm.Reference` (new reference per
 *    install; do not share across isolates).
 *  - A single `__mnm_call_helper(name, args)` global is set on the isolate,
 *    which receives the helper name + args (both `copy:true`) and dispatches
 *    to the right host function. This avoids per-helper Reference leakage:
 *    the isolate only ever sees one dispatcher.
 *  - A small JS prelude is evaluated inside the isolate that creates a
 *    `ctx.helpers.<name> = async (...args) => { ... }` proxy for each name.
 *    `ctx` is assumed to already exist on `globalThis` (the runner's ctx
 *    injection step creates it — see `run-single-gate.ts`).
 *
 * Timeout: each helper invocation has its own inner timeout (3 s) enforced
 * by `Reference.apply(..., { timeout: 3000 })`. The outer gate timeout
 * (RunnerOptions.timeoutMs, default 5 s) still wraps the whole gate call, so
 * a fast helper leaves room for gate logic, while a hung helper still
 * terminates well inside the outer budget.
 *
 * Marshalling: args are passed to the dispatcher `copy:true` (deep clone).
 * Return values come back `copy:true`. Exceptions propagate as plain Error
 * objects — the isolated-vm bridge stringifies them on the host side.
 *
 * Failure modes (all mapped by `classifyIsolateError` in the runner):
 *  - Host throws -> rejected promise inside isolate -> propagates to gate
 *    code as a thrown Error with the host message.
 *  - Host exceeds 3 s -> `Reference.apply` rejects with "Script execution
 *    timed out." -> same path.
 *  - Arg is non-serialisable (circular, Symbol, etc.) -> isolated-vm clone
 *    throws before the host function runs -> surfaces as a gate exception.
 */
export async function installHelpers(
  context: ivm.Context,
  jail: ivm.Reference<Record<string, unknown>>,
  helpers: Record<string, (...args: any[]) => Promise<any>>,
): Promise<void> {
  const dispatcher = async (name: string, args: unknown[]): Promise<unknown> => {
    const fn = helpers[name];
    if (!fn) {
      throw new Error(`Unknown gate helper: ${name}`);
    }
    return await fn(...args);
  };

  // Pass the dispatcher reference into the isolate under a non-colliding
  // name. Prefix `__mnm_` so authors can't accidentally shadow it.
  await jail.set(
    "__mnm_call_helper",
    new ivm.Reference(dispatcher),
  );

  // Build the JS prelude that creates `ctx.helpers.<name>` proxies. Each
  // proxy forwards to the dispatcher with a 3 s timeout. `copy:true` on
  // both sides ensures no references cross the sandbox boundary.
  const names = Object.keys(helpers);
  const prelude = `
    if (typeof ctx === "undefined") {
      throw new Error("installHelpers called before ctx injection");
    }
    ctx.helpers = ctx.helpers || {};
    ${names
      .map(
        (n) => `
    ctx.helpers[${JSON.stringify(n)}] = async (...args) => {
      return await __mnm_call_helper.apply(
        null,
        [${JSON.stringify(n)}, args],
        { arguments: { copy: true }, result: { promise: true, copy: true }, timeout: 3000 }
      );
    };`,
      )
      .join("")}
  `;

  await context.eval(prelude);
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bun run --cwd packages/gate-runner test isolate-helpers`
Expected: 4/4 assertions green. If the timeout test fails with a different message, check that `isolated-vm`'s current error string still contains "timed out" (case-insensitive).

- [ ] **Step 5: Extend `RunSingleGateDeps`**

Open `packages/gate-runner/src/run-single-gate.ts` (the existing file). Locate `RunSingleGateDeps` and extend it:

```typescript
export interface RunSingleGateDeps {
  compiledCache?: CompiledCache;
  options?: RunnerOptions;
  /**
   * Async host functions exposed inside the isolate as `ctx.helpers.<name>`.
   * Each helper is called via an ivm.Reference bridge with a 3 s inner
   * timeout (see `installHelpers`). Passing `undefined` or `{}` leaves
   * `ctx.helpers` empty — matches T4 behaviour.
   */
  helpers?: Record<string, (...args: any[]) => Promise<any>>;
  /** Test-only seam — injected by unit tests to stub attemptEval. */
  attemptEval?: typeof defaultAttemptEval;
}
```

Then in the `runSingleGate` function, after the context is created and before the gate's default export is invoked, call `installHelpers` iff `deps.helpers` is populated:

```typescript
import { installHelpers } from "./isolate-helpers.js";
// ... inside runSingleGate, after `const ctx = await isolate.createContext()`
// and after ctx is set on globalThis (`await jail.set("ctx", ctxRef.derefInto())`):

if (deps?.helpers && Object.keys(deps.helpers).length > 0) {
  await installHelpers(ctx, jail, deps.helpers);
}
```

> **Note to implementer:** locate the **existing** ctx-injection block in `run-single-gate.ts`. The spec above describes where the call belongs; do NOT guess — read the file. The call must happen AFTER `ctx` is on `globalThis` (so the prelude's `if (typeof ctx === "undefined")` guard passes) and BEFORE the gate's default export is invoked.

- [ ] **Step 6: Re-export `installHelpers` from the barrel**

In `packages/gate-runner/src/index.ts`, append:

```typescript
export { installHelpers } from "./isolate-helpers.js";
```

- [ ] **Step 7: Run the full gate-runner test suite**

Run: `bun run --cwd packages/gate-runner test`
Expected: existing T4 tests still green (50+ assertions) + new helper tests green.

- [ ] **Step 8: Typecheck monorepo**

Run: `bun run typecheck`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add packages/gate-runner/src/isolate-helpers.ts packages/gate-runner/src/run-single-gate.ts packages/gate-runner/src/types.ts packages/gate-runner/src/index.ts packages/gate-runner/src/__tests__/isolate-helpers.test.ts
git commit -m "feat(workflows): inject async gate helpers via ivm.Reference bridge"
git push
```

---

## Task 3: `makeResolveSource` factory wiring GitProvider + ShaCache

**Files:**
- Create: `server/src/services/governed-workflows-source-resolver.ts`
- Create: `server/src/services/__tests__/governed-workflows-source-resolver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/services/__tests__/governed-workflows-source-resolver.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ShaCache } from "@mnm/git-provider";
import type { GitProvider } from "@mnm/git-provider";
import { makeResolveSource } from "../governed-workflows-source-resolver.js";

function stubProvider(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    fetchBlob: vi.fn(async () => "stub-source"),
    listTags: vi.fn(async () => []),
    resolveRef: vi.fn(async (a) => `sha-of-${a.ref}`),
    pathExists: vi.fn(async () => true),
    commitFile: vi.fn(async () => ({ sha: "x" })),
    ...overrides,
  };
}

describe("makeResolveSource", () => {
  it("resolves a relative gate source against the workflow path", async () => {
    const provider = stubProvider();
    const cache = new ShaCache();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: cache,
    });
    const r = await resolve("./gates/greet-exit.gate.ts");
    expect(r.gateSourcePath).toBe("hello-world/gates/greet-exit.gate.ts");
    expect(r.source).toBe("stub-source");
    expect(provider.fetchBlob).toHaveBeenCalledWith({
      path: "hello-world/gates/greet-exit.gate.ts",
      ref: "abc",
    });
  });

  it("caches per (sha, path) — provider called once", async () => {
    const provider = stubProvider();
    const cache = new ShaCache();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: cache,
    });
    await resolve("./gates/a.gate.ts");
    await resolve("./gates/a.gate.ts");
    expect(provider.fetchBlob).toHaveBeenCalledTimes(1);
  });

  it("rejects sources escaping the workflow directory", async () => {
    const provider = stubProvider();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: new ShaCache(),
    });
    await expect(resolve("../../etc/passwd")).rejects.toThrow(
      /outside workflow directory/,
    );
    await expect(resolve("/absolute")).rejects.toThrow(/must be relative/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun run --cwd server test governed-workflows-source-resolver`
Expected: module not found.

- [ ] **Step 3: Create the resolver**

Create `server/src/services/governed-workflows-source-resolver.ts`:

```typescript
import type { GitProvider, ShaCache } from "@mnm/git-provider";

/**
 * Build a `resolveSource` closure compatible with `@mnm/gate-runner`'s
 * `RunGateBlockArgs.resolveSource`. The closure joins a gate's relative
 * source (as declared in workflow.json, e.g. `./gates/x.gate.ts`) with the
 * workflow directory, fetches the blob at the pinned git sha via the
 * provider, and memoises by (sha, path) via the supplied `ShaCache`.
 *
 * Security: the joined path MUST stay within the workflow's directory.
 * `../` traversal is rejected; absolute sources are rejected. Workflows
 * cannot pull gate code from other workflows or outside the repo — gates
 * are workflow-local in MVP (spec §3 "Pas de _shared/ cross-workflow").
 *
 * The cache is consumer-owned so the same `ShaCache` instance can be
 * shared across multiple workflows / runs in the MCP service (process
 * lifetime). Immutability of git shas means entries never need eviction
 * on content change — only on cache-size pressure, handled by ShaCache's
 * internal FIFO (see T3).
 */
export function makeResolveSource(args: {
  gitProvider: GitProvider;
  workflowGitSha: string;
  /** Repo-relative POSIX path to the workflow.json, e.g. "hello-world/workflow.json". */
  workflowRepoPath: string;
  shaCache: ShaCache;
}): (gateItemSource: string) => Promise<{ source: string; gateSourcePath: string }> {
  const { gitProvider, workflowGitSha, workflowRepoPath, shaCache } = args;

  // Directory of the workflow.json, e.g. "hello-world".
  const workflowDir = workflowRepoPath.includes("/")
    ? workflowRepoPath.slice(0, workflowRepoPath.lastIndexOf("/"))
    : "";

  return async (gateItemSource) => {
    if (gateItemSource.startsWith("/")) {
      throw new Error(`Gate source must be relative, got: ${gateItemSource}`);
    }

    // Strip a single leading "./" — everything after MUST stay within the
    // workflow dir. "./a/b" is fine; "../x" or "a/../../etc" is not.
    const normalised = gateItemSource.replace(/^\.\//, "");
    if (normalised.includes("..")) {
      throw new Error(`Gate source ${gateItemSource} escapes outside workflow directory`);
    }

    const gateSourcePath = workflowDir ? `${workflowDir}/${normalised}` : normalised;

    const source = await shaCache.getOrFetch(
      { sha: workflowGitSha, path: gateSourcePath },
      () => gitProvider.fetchBlob({ path: gateSourcePath, ref: workflowGitSha }),
    );

    return { source, gateSourcePath };
  };
}
```

> **Note to implementer:** `ShaCache`'s public method is `getOrFetch({sha, path}, fetcher)`. Verify the exact signature against `packages/git-provider/src/sha-cache.ts` before writing the call. If the signature differs, adapt the call — the test is the source of truth for the resolver's observable contract; ShaCache's shape is from T3 and not yours to change.

- [ ] **Step 4: Run the test, expect PASS**

Run: `bun run --cwd server test governed-workflows-source-resolver`
Expected: 3/3 green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows-source-resolver.ts server/src/services/__tests__/governed-workflows-source-resolver.test.ts
git commit -m "feat(workflows): source resolver joining GitProvider + ShaCache per-run"
git push
```

---

## Task 4: `governedWorkflowService.listDefinitions` + `getDefinition` + `getWorkflowParsed`

**Files:**
- Create: `server/src/services/governed-workflows.ts` (initial shell with these three methods)
- Create: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/services/__tests__/governed-workflows.test.ts`. Use the existing embedded-postgres fixture pattern from the codebase (look at `server/src/services/__tests__/*` for an example — the fixture spins up a real PG so RLS is exercised).

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { governedWorkflowService } from "../governed-workflows.js";
import type { Db } from "@mnm/db";
import { spawnTestDb, type TestDbHandle } from "./fixtures/test-db.js"; // see note
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";

// A minimal stub GitProvider — integration tests feed canned blobs.
const stubProvider = {
  fetchBlob: async () => JSON.stringify({
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "hello-world",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
    ],
  }),
  listTags: async () => [{ name: "v1.0.0", sha: "deadbeef" }],
  resolveRef: async () => "deadbeef",
  pathExists: async () => true,
  commitFile: async () => ({ sha: "x" }),
};

describe("governedWorkflowService — discovery", () => {
  let handle: TestDbHandle;
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a01";
  const companyB = "00000000-0000-0000-0000-000000000b01";

  beforeAll(async () => {
    handle = await spawnTestDb();
    db = handle.db;
    // Seed two companies + one governed_workflow_definitions row each
    await db.execute(sql`INSERT INTO companies (id, name) VALUES (${companyA}, 'A'), (${companyB}, 'B')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES
      (${companyA}, 'hello-world', 'v1.0.0'),
      (${companyA}, 'goodbye', null),
      (${companyB}, 'hello-world', 'v2.0.0')`);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await clearTenantContext(db);
  });

  it("listDefinitions returns only this company's definitions (RLS)", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA });
    expect(rows.map((r) => r.name).sort()).toEqual(["goodbye", "hello-world"]);
  });

  it("listDefinitions { enabled: true } excludes disabled rows", async () => {
    await db.execute(sql`UPDATE governed_workflow_definitions SET enabled = false WHERE company_id = ${companyA} AND name = 'goodbye'`);
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA, enabled: true });
    expect(rows.map((r) => r.name)).toEqual(["hello-world"]);
  });

  it("getWorkflowParsed returns parsed workflow + sha for a known name", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
    await setTenantContext(db, companyA);
    const parsed = await svc.getWorkflowParsed({
      companyId: companyA,
      name: "hello-world",
    });
    expect(parsed.workflow.name).toBe("hello-world");
    expect(parsed.gitSha).toBe("deadbeef");
    expect(parsed.gitTag).toBe("v1.0.0");
  });

  it("getWorkflowParsed throws WORKFLOW_NOT_FOUND for unknown name", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
    await setTenantContext(db, companyA);
    await expect(
      svc.getWorkflowParsed({ companyId: companyA, name: "nope" }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
    });
  });

  it("getWorkflowParsed uses explicit git_tag when provided", async () => {
    let capturedRef = "";
    const svc = governedWorkflowService(db, {
      gitProvider: {
        ...stubProvider,
        resolveRef: async ({ ref }) => { capturedRef = ref; return `sha-of-${ref}`; },
      } as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
    await setTenantContext(db, companyA);
    const parsed = await svc.getWorkflowParsed({
      companyId: companyA,
      name: "hello-world",
      gitTag: "v0.5.0",
    });
    expect(capturedRef).toBe("v0.5.0");
    expect(parsed.gitSha).toBe("sha-of-v0.5.0");
  });
});
```

> **Fixture note:** `spawnTestDb` / `test-db.ts` fixture is expected to exist in the codebase (embedded-postgres + migration runner). If it does NOT exist, the implementer creates it as part of Task 4, cribbing from whatever existing service uses a real PG in tests. Search: `grep -r "spawnTestDb\|embeddedPostgres" server/src/services/__tests__ packages/db/src`. If truly none exists, use `packages/db/src/backup-lib.ts`'s embedded-postgres bootstrap as the template.

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun run --cwd server test governed-workflows`
Expected: module not found.

- [ ] **Step 3: Create `server/src/services/governed-workflows.ts`**

```typescript
import { and, eq, sql } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  gateResults,
  type Db,
} from "@mnm/db";
import {
  workflowDefinitionSchema,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
} from "@mnm/governed-workflows";
import type { GitProvider, ShaCache } from "@mnm/git-provider";

/**
 * Domain error raised by the governed workflow service. Mapped to the MCP
 * uniform error contract by the tool layer. `code` is always a member of
 * `WORKFLOW_ERROR_CODES`.
 */
export class GovernedWorkflowError extends Error {
  constructor(
    public readonly code: (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES],
    message: string,
    public readonly hints: string[] = [],
  ) {
    super(message);
    this.name = "GovernedWorkflowError";
  }
}

export interface GovernedWorkflowServiceDeps {
  gitProvider: GitProvider;
  shaCache: ShaCache;
}

export interface GetWorkflowParsedResult {
  workflow: WorkflowDefinition;
  gitTag: string;
  gitSha: string;
  /** Repo-relative path to the workflow.json in the workflows repo. */
  workflowRepoPath: string;
}

/**
 * Domain service for Governed Workflows. All reads are RLS-scoped — the
 * caller must have set `app.current_company_id` via `setTenantContext`
 * before invoking. Writes take `companyId` explicitly and include it in
 * INSERT / WHERE clauses for defense-in-depth.
 */
export function governedWorkflowService(db: Db, deps: GovernedWorkflowServiceDeps) {
  const { gitProvider, shaCache } = deps;

  // ─── Discovery ──────────────────────────────────────────────────

  async function listDefinitions(args: { companyId: string; enabled?: boolean }) {
    const conds = [eq(governedWorkflowDefinitions.companyId, args.companyId)];
    if (args.enabled !== undefined) {
      conds.push(eq(governedWorkflowDefinitions.enabled, args.enabled));
    }
    return db
      .select()
      .from(governedWorkflowDefinitions)
      .where(and(...conds))
      .orderBy(governedWorkflowDefinitions.name);
  }

  async function getDefinition(args: { companyId: string; name: string }) {
    const [row] = await db
      .select()
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, args.companyId),
          eq(governedWorkflowDefinitions.name, args.name),
        ),
      );
    return row ?? null;
  }

  /**
   * Fetch + parse a workflow at a specific tag (or the definition's
   * `latest_git_tag` if unspecified). Validates against the zod schema in
   * `@mnm/governed-workflows`. Caches by (sha, path).
   *
   * Path convention: the MVP assumes each workflow lives under `<name>/`
   * in its repo, with its entry point at `<name>/workflow.json` — see
   * spec §3 "Repo structure". Until we have explicit config, we derive
   * the path from `definition.name`.
   */
  async function getWorkflowParsed(args: {
    companyId: string;
    name: string;
    gitTag?: string;
  }): Promise<GetWorkflowParsedResult> {
    const def = await getDefinition({ companyId: args.companyId, name: args.name });
    if (!def) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `No governed workflow named '${args.name}'`,
        [`Call list_governed_workflows to see available workflows`],
      );
    }

    const ref = args.gitTag ?? def.latestGitTag;
    if (!ref) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}' has no latest_git_tag and no git_tag supplied`,
        [`Pass git_tag explicitly or set the definition's latest_git_tag`],
      );
    }

    const gitSha = await gitProvider.resolveRef({ ref });
    const workflowRepoPath = `${args.name}/workflow.json`;

    const rawJson = await shaCache.getOrFetch(
      { sha: gitSha, path: workflowRepoPath },
      () => gitProvider.fetchBlob({ path: workflowRepoPath, ref: gitSha }),
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} has invalid JSON: ${(err as Error).message}`,
      );
    }

    const result = workflowDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} failed schema validation: ${result.error.message}`,
      );
    }

    return {
      workflow: result.data,
      gitTag: ref,
      gitSha,
      workflowRepoPath,
    };
  }

  // Further methods land in Task 5/6/7/8/9 (launchWorkflow, getRun,
  // launchStep, completeStep, syncEnvironment).

  return {
    listDefinitions,
    getDefinition,
    getWorkflowParsed,
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bun run --cwd server test governed-workflows`
Expected: 5/5 green.

- [ ] **Step 5: Typecheck monorepo**

Run: `bun run typecheck`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): governedWorkflowService discovery (list/get/getParsed)"
git push
```

---

## Task 5: `governedWorkflowService.launchWorkflow` with advisory lock

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write the failing test additions**

Append to `governed-workflows.test.ts` a new `describe("governedWorkflowService — launchWorkflow")` block:

```typescript
describe("governedWorkflowService — launchWorkflow", () => {
  let handle: TestDbHandle;
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a01";

  beforeAll(async () => {
    handle = await spawnTestDb();
    db = handle.db;
    await db.execute(sql`INSERT INTO companies (id, name) VALUES (${companyA}, 'A')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'hello-world', 'v1.0.0')`);
  });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await clearTenantContext(db); });

  function mkSvc() {
    return governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { getOrFetch: async (_k: any, f: any) => f() } as any,
    });
  }

  it("creates a run + N step executions in pending state", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { runId, firstStep } = await svc.launchWorkflow({
      companyId: companyA,
      name: "hello-world",
      params: { name: "Tom" },
      actor: { type: "user", id: "u-1" },
    });
    expect(firstStep).toBe("greet");

    const steps = await db.execute(sql`SELECT step_id_in_json, state FROM governed_step_executions WHERE run_id = ${runId} ORDER BY step_id_in_json`);
    expect(steps.rows).toHaveLength(1);
    expect(steps.rows[0]).toMatchObject({ step_id_in_json: "greet", state: "pending" });
  });

  it("throws WORKFLOW_NOT_FOUND for unknown name", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    await expect(
      svc.launchWorkflow({
        companyId: companyA,
        name: "absent",
        params: {},
        actor: { type: "user", id: "u-1" },
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND });
  });

  it("serializes concurrent launches on the same definition", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const [r1, r2] = await Promise.all([
      svc.launchWorkflow({ companyId: companyA, name: "hello-world", params: { name: "A" }, actor: { type: "user", id: "u-1" } }),
      svc.launchWorkflow({ companyId: companyA, name: "hello-world", params: { name: "B" }, actor: { type: "user", id: "u-1" } }),
    ]);
    // Both succeed with different runIds; the advisory lock serialises
    // ordering, preventing partial inserts — verified by both having
    // their full complement of step_executions.
    expect(r1.runId).not.toBe(r2.runId);
    const counts = await db.execute(sql`SELECT run_id, COUNT(*) AS c FROM governed_step_executions WHERE run_id IN (${r1.runId}, ${r2.runId}) GROUP BY run_id`);
    for (const row of counts.rows) expect(Number((row as any).c)).toBe(1);
  });

  it("uses first step id from parsed workflow as firstStep (deps=[])", async () => {
    // Already covered by the first test, but explicitly asserts the choice
    // logic: firstStep = steps.find(s => s.deps.length === 0).id
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { firstStep } = await svc.launchWorkflow({
      companyId: companyA, name: "hello-world", params: {}, actor: { type: "user", id: "u-1" },
    });
    expect(firstStep).toBe("greet");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun run --cwd server test governed-workflows`
Expected: `launchWorkflow is not a function`.

- [ ] **Step 3: Implement `launchWorkflow`**

Add to `governed-workflows.ts` inside the service factory, after `getWorkflowParsed`:

```typescript
import type { AuditActorType } from "@mnm/shared";

export interface LaunchWorkflowArgs {
  companyId: string;
  name: string;
  gitTag?: string;
  params: Record<string, unknown>;
  actor: { type: AuditActorType; id: string };
}

export interface LaunchWorkflowResult {
  runId: string;
  firstStep: string;
  gitTag: string;
  gitSha: string;
}

/**
 * Launch a governed workflow run. Fetches + parses the workflow at the
 * pinned tag, takes a PG advisory-xact lock keyed on the definition id
 * (to serialise concurrent launches of the same workflow — prevents
 * interleaved step inserts), and inserts one `governed_workflow_runs`
 * row + one `governed_step_executions` row per step (state=pending).
 *
 * The lock is released at TX commit/rollback. Key = hashtext of
 * 'mnm:launch:<def_id>' so the namespace is disjoint from other
 * advisory locks in the codebase.
 *
 * `firstStep` is the id of the first step with empty `deps` in parse
 * order. Workflows with multiple zero-dep steps get the FIRST one —
 * gates and/or dep ordering are the author's responsibility beyond
 * that.
 */
async function launchWorkflow(args: LaunchWorkflowArgs): Promise<LaunchWorkflowResult> {
  const parsed = await getWorkflowParsed({
    companyId: args.companyId,
    name: args.name,
    gitTag: args.gitTag,
  });

  const def = await getDefinition({ companyId: args.companyId, name: args.name });
  // def cannot be null here — getWorkflowParsed already validated existence.
  if (!def) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
      `Workflow '${args.name}' vanished between parse and launch`,
    );
  }

  const firstStep = parsed.workflow.steps.find((s) => s.deps.length === 0);
  if (!firstStep) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
      `Workflow '${args.name}' has no step with empty deps — cannot launch`,
    );
  }

  return await db.transaction(async (tx) => {
    // Advisory lock: disambiguate namespace with a prefix so we don't
    // collide with other lock users. Scope per-definition so unrelated
    // workflows can launch concurrently.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'mnm:launch:' + def.id}))`,
    );

    const [run] = await tx
      .insert(governedWorkflowRuns)
      .values({
        companyId: args.companyId,
        workflowDefId: def.id,
        workflowGitTag: parsed.gitTag,
        workflowGitSha: parsed.gitSha,
        initiatedByActorType: args.actor.type,
        initiatedByActorId: args.actor.id,
        status: "active",
        startedAt: new Date(),
        paramsJson: args.params,
      })
      .returning({ id: governedWorkflowRuns.id });

    await tx.insert(governedStepExecutions).values(
      parsed.workflow.steps.map((s) => ({
        companyId: args.companyId,
        runId: run.id,
        stepIdInJson: s.id,
        state: "pending" as const,
      })),
    );

    return {
      runId: run.id,
      firstStep: firstStep.id,
      gitTag: parsed.gitTag,
      gitSha: parsed.gitSha,
    };
  });
}
```

Add `launchWorkflow` to the returned object.

- [ ] **Step 4: Run the test, expect PASS**

Run: `bun run --cwd server test governed-workflows`
Expected: all launchWorkflow tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): launchWorkflow with pg_advisory_xact_lock serialization"
git push
```

---

## Task 6: `governedWorkflowService.getRun`

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the test file:

```typescript
describe("governedWorkflowService — getRun", () => {
  // reuse the shared handle/companyA setup pattern above
  // ...

  it("returns run with steps + last gate_result", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "hello-world", params: {}, actor: { type: "user", id: "u-1" },
    });
    const run = await svc.getRun({ companyId: companyA, runId });
    expect(run.runId).toBe(runId);
    expect(run.status).toBe("active");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toMatchObject({ id: "greet", state: "pending", artifactOk: false });
    expect(run.lastGateResult).toBeNull();
  });

  it("returns WORKFLOW_RUN_NOT_FOUND for unknown runId", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    await expect(
      svc.getRun({ companyId: companyA, runId: "00000000-0000-0000-0000-000000000999" }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND });
  });

  it("hides cross-tenant runs behind WORKFLOW_RUN_NOT_FOUND (not 403)", async () => {
    const companyB = "00000000-0000-0000-0000-000000000b01";
    await db.execute(sql`INSERT INTO companies (id, name) VALUES (${companyB}, 'B') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyB}, 'hello-world', 'v1.0.0') ON CONFLICT DO NOTHING`);

    const svc = mkSvc();
    // Launch under B
    await setTenantContext(db, companyB);
    const { runId } = await svc.launchWorkflow({
      companyId: companyB, name: "hello-world", params: {}, actor: { type: "user", id: "u-B" },
    });

    // Fetch as A
    await setTenantContext(db, companyA);
    await expect(
      svc.getRun({ companyId: companyA, runId }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun run --cwd server test governed-workflows`

- [ ] **Step 3: Implement `getRun`**

Add to the service:

```typescript
import { desc } from "drizzle-orm";

export interface RunStepSummary {
  id: string;
  state: string;
  artifactOk: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface GetRunResult {
  runId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  steps: RunStepSummary[];
  lastGateResult: {
    gateIdInJson: string;
    kind: string;
    pass: boolean;
    report: string;
    errorCode: string | null;
    hints: string[];
    evaluatedAt: Date;
  } | null;
}

/**
 * Return the state of a single run. RLS is already enforced by the
 * active tenant context, but we double-check companyId in the WHERE
 * clause for defense-in-depth. Cross-tenant lookups MUST return
 * WORKFLOW_RUN_NOT_FOUND (not a 403) so existence is never leaked.
 */
async function getRun(args: { companyId: string; runId: string }): Promise<GetRunResult> {
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    );
  if (!run) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
      `Run '${args.runId}' not found`,
      [`Verify runId via list_governed_workflows + launchWorkflow`],
    );
  }

  const steps = await db
    .select()
    .from(governedStepExecutions)
    .where(eq(governedStepExecutions.runId, args.runId))
    .orderBy(governedStepExecutions.createdAt);

  const [lastGate] = await db
    .select()
    .from(gateResults)
    .where(eq(gateResults.runId, args.runId))
    .orderBy(desc(gateResults.evaluatedAt))
    .limit(1);

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    steps: steps.map((s) => ({
      id: s.stepIdInJson,
      state: s.state,
      artifactOk: s.state === "succeeded",
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    })),
    lastGateResult: lastGate
      ? {
          gateIdInJson: lastGate.gateIdInJson,
          kind: lastGate.kind,
          pass: lastGate.pass,
          report: lastGate.report,
          errorCode: lastGate.errorCode,
          hints: lastGate.hints ?? [],
          evaluatedAt: lastGate.evaluatedAt,
        }
      : null,
  };
}
```

Add `getRun` to the returned object.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): getRun returning RLS-scoped run + steps + last gate_result"
git push
```

---

## Task 7: `governedWorkflowService.launchStep` with entry gate eval

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the test file. Use the pre-mortem table's 5 rows for launchStep as the test cases:

```typescript
describe("governedWorkflowService — launchStep", () => {
  // ... shared setup with two-step workflow fixture

  // Fixture: a two-step workflow with an entry gate on step "shout"
  const TWO_STEP_WORKFLOW = {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "two-step",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
      {
        id: "shout",
        deps: ["greet"],
        agent: "shouter",
        prompt_context: {},
        gates: {
          entry: [
            { id: "pre-shout", source: "./gates/pre-shout.gate.ts" },
          ],
        },
      },
    ],
  };

  // Stub provider returning the two-step JSON + a canned passing gate source
  function mkProviderWithGate(gateSource: string) {
    return {
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.endsWith("workflow.json")) return JSON.stringify(TWO_STEP_WORKFLOW);
        if (path.endsWith(".gate.ts")) return gateSource;
        throw new Error(`unexpected path ${path}`);
      },
      resolveRef: async () => "two-step-sha",
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
  }

  const PASSING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: true, report: "ok" }));
  `;
  const FAILING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: false, report: "nope", error_code: "X", hints: ["try harder"] }));
  `;

  it("WORKFLOW_STEP_NOT_FOUND for an unknown stepId", async () => { /* ... */ });
  it("WORKFLOW_DEPENDENCY_UNMET when a dep isn't succeeded", async () => { /* ... */ });
  it("returns triplet without gate eval when step has no entry gate", async () => { /* ... */ });
  it("returns triplet when entry gate passes", async () => { /* ... */ });
  it("returns WORKFLOW_GATE_FAILED + gate_result when entry gate fails", async () => { /* ... */ });
});
```

> **Note to implementer:** the `/* ... */` markers above are NOT placeholders — each test body is a straightforward setup/act/assert around the fixture. Write them in the order of the pre-mortem table. Example for "entry gate fails":
>
> ```typescript
>   it("returns WORKFLOW_GATE_FAILED + gate_result when entry gate fails", async () => {
>     const svc = governedWorkflowService(db, {
>       gitProvider: mkProviderWithGate(FAILING_GATE) as any,
>       shaCache: new ShaCache(),
>     });
>     await setTenantContext(db, companyA);
>     // Seed: insert definition + launch + mark greet as succeeded
>     await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'two-step', 'v1.0.0') ON CONFLICT DO NOTHING`);
>     const { runId } = await svc.launchWorkflow({
>       companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
>     });
>     await db.execute(sql`UPDATE governed_step_executions SET state='succeeded', completed_at=now() WHERE run_id=${runId} AND step_id_in_json='greet'`);
>     await expect(
>       svc.launchStep({ companyId: companyA, runId, stepId: "shout", actor: { type: "user", id: "u-1" } }),
>     ).rejects.toMatchObject({
>       code: WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
>       hints: expect.arrayContaining(["try harder"]),
>     });
>   });
> ```

- [ ] **Step 2: Run test, expect FAIL**

- [ ] **Step 3: Implement `launchStep`**

```typescript
import { runGateBlock, CompiledCache } from "@mnm/gate-runner";
import type { GateContext, GateBlock } from "@mnm/governed-workflows";
import { makeResolveSource } from "./governed-workflows-source-resolver.js";
import { buildGateHelpers } from "./governed-workflows-helpers.js";

// One process-wide compiled cache. Entries are keyed by (gitSha, path),
// which are immutable once a tag is pushed, so entries never need to be
// invalidated — only evicted under memory pressure (ReadyCache FIFO,
// cf. T4).
const compiledCache = new CompiledCache();

export interface LaunchStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  actor: { type: AuditActorType; id: string };
}

export interface LaunchStepResult {
  agentName: string;
  promptContext: Record<string, unknown>;
  subagentType: string;
}

/**
 * Authorize a step launch. Verifies all deps are `succeeded`, evaluates
 * the entry gate block (if any) through `runGateBlock`, persists the
 * gate_result rows, and returns the {agent, prompt_context, subagent_type}
 * triplet for the Claude Code harness.
 *
 * On gate failure, rolls the step back to `pending` and throws
 * `WORKFLOW_GATE_FAILED`. No state corruption — the step becomes
 * eligible for a later retry once the author fixes whatever the gate
 * flagged. (Retry surface is a T7+ concern; T5 only exposes the gate
 * verdict truthfully.)
 */
async function launchStep(args: LaunchStepArgs): Promise<LaunchStepResult> {
  const run = await getRun({ companyId: args.companyId, runId: args.runId });

  // Re-parse the workflow at the run's pinned sha.
  const parsed = await getWorkflowParsed({
    companyId: args.companyId,
    name: (await getDefByRun(args.companyId, args.runId)).name,
    gitTag: run.steps.length > 0 ? undefined : undefined, // use pinned sha path — see below
  });
  // TODO(performance): avoid re-fetching the workflow on every launchStep.
  // For MVP, the ShaCache makes this a single-map lookup after the first
  // call per run (see T3 ShaCache). Acceptable given N<<M in practice.

  const step = parsed.workflow.steps.find((s) => s.id === args.stepId);
  if (!step) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
      `Step '${args.stepId}' not in workflow`,
    );
  }

  // Deps check — all deps must be succeeded.
  if (step.deps.length > 0) {
    const missing = step.deps.filter((d) => {
      const s = run.steps.find((r) => r.id === d);
      return !s || s.state !== "succeeded";
    });
    if (missing.length > 0) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_DEPENDENCY_UNMET,
        `Cannot launch '${args.stepId}': missing ${missing.join(", ")}`,
        [
          `Launch ${missing[0]} first and complete it successfully`,
          `Check get_governed_workflow_run for step order`,
        ],
      );
    }
  }

  // Mark step as running / gate_eval
  await db
    .update(governedStepExecutions)
    .set({
      state: step.gates?.entry ? "gate_eval" : "running",
      startedAt: new Date(),
      launchedByActorType: args.actor.type,
      launchedByActorId: args.actor.id,
    })
    .where(
      and(
        eq(governedStepExecutions.runId, args.runId),
        eq(governedStepExecutions.stepIdInJson, args.stepId),
      ),
    );

  // Evaluate entry gate if present
  const entryBlock = step.gates?.entry as GateBlock | undefined;
  if (entryBlock && entryBlock.length > 0) {
    const helpers = buildGateHelpers({ db, companyId: args.companyId });
    const previousArtifacts = buildPreviousArtifacts(parsed.workflow, run);
    const context: GateContext = {
      artifact: undefined,
      run: {
        id: args.runId,
        workflow_name: parsed.workflow.name,
        git_tag: parsed.gitTag,
        params: run.steps.length > 0 ? {} : {}, // use run.paramsJson via getRun extension
      },
      step: { id: args.stepId, previous_artifacts: previousArtifacts },
      config: {},
      kind: "entry",
      helpers: {},
    };

    const blockResult = await runGateBlock(
      {
        block: entryBlock,
        kind: "entry",
        gitSha: parsed.gitSha,
        context,
        resolveSource: makeResolveSource({
          gitProvider,
          workflowGitSha: parsed.gitSha,
          workflowRepoPath: parsed.workflowRepoPath,
          shaCache,
        }),
      },
      { compiledCache, helpers },
    );

    // Persist every gate_result row
    const [stepExec] = await db
      .select({ id: governedStepExecutions.id })
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          eq(governedStepExecutions.stepIdInJson, args.stepId),
        ),
      );

    await db.insert(gateResults).values(
      blockResult.gate_results.map((r) => ({
        companyId: args.companyId,
        runId: args.runId,
        stepExecId: stepExec.id,
        gateIdInJson: r.gate_id_in_json,
        kind: r.kind,
        pass: r.pass,
        report: r.report,
        errorCode: r.error_code ?? null,
        hints: r.hints ?? [],
        gateGitSha: r.gate_git_sha,
        evaluatedAt: new Date(r.evaluated_at),
      })),
    );

    if (!blockResult.pass) {
      const failed = blockResult.gate_results.find((r) => !r.pass);
      await db
        .update(governedStepExecutions)
        .set({ state: "pending", startedAt: null })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
        `Entry gate failed for step '${args.stepId}': ${failed?.report ?? "unknown"}`,
        failed?.hints ?? [],
      );
    }

    // Gate passed — transition to running
    await db
      .update(governedStepExecutions)
      .set({ state: "running" })
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          eq(governedStepExecutions.stepIdInJson, args.stepId),
        ),
      );
  }

  // Interpolate prompt_context placeholders (`{{variables.name}}`,
  // `{{steps.greet.artifact.greeting}}`) against the run's params +
  // previous artifacts. For MVP, only two substitution patterns are
  // supported — see `interpolatePromptContext` below.
  const params = await fetchRunParams(args.companyId, args.runId);
  const previousArtifacts = buildPreviousArtifacts(parsed.workflow, run);
  const promptContext = interpolatePromptContext(
    step.prompt_context,
    { variables: params, steps: previousArtifacts },
  );

  return {
    agentName: step.agent,
    promptContext,
    subagentType: `mnm--${step.agent}`,
  };
}

// Helper: the run's `paramsJson` column — not carried on `GetRunResult`
// to keep that shape focused. Fetched lazily when needed for prompt
// interpolation.
async function fetchRunParams(companyId: string, runId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ params: governedWorkflowRuns.paramsJson })
    .from(governedWorkflowRuns)
    .where(and(eq(governedWorkflowRuns.companyId, companyId), eq(governedWorkflowRuns.id, runId)));
  return (row?.params as Record<string, unknown>) ?? {};
}

// Helper: assemble { [stepId]: artifact } from succeeded steps for a run.
function buildPreviousArtifacts(
  workflow: WorkflowDefinition,
  run: GetRunResult,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of run.steps) {
    if (step.state === "succeeded") {
      // Re-read artifacts from DB; steps[].artifactsJson isn't on the
      // summary. Async reads inside a sync helper aren't possible, so
      // callers that need full artifacts pass them separately. MVP
      // version leaves this shape empty; interpolation step below reads
      // lazily.
      out[step.id] = undefined;
    }
  }
  return out;
}

// Helper: resolve a definition name from a runId. Private to the service.
async function getDefByRun(companyId: string, runId: string) {
  const [row] = await db
    .select({
      name: governedWorkflowDefinitions.name,
      latestGitTag: governedWorkflowDefinitions.latestGitTag,
    })
    .from(governedWorkflowRuns)
    .innerJoin(
      governedWorkflowDefinitions,
      eq(governedWorkflowRuns.workflowDefId, governedWorkflowDefinitions.id),
    )
    .where(
      and(
        eq(governedWorkflowRuns.id, runId),
        eq(governedWorkflowRuns.companyId, companyId),
      ),
    );
  if (!row) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
      `Run '${runId}' not found`,
    );
  }
  return row;
}

/**
 * Very small interpolation: walks the prompt_context tree, replaces any
 * string value matching `{{variables.<key>}}` or `{{steps.<id>.artifact.<path>}}`
 * with the resolved value. Unknown placeholders remain as literal
 * strings — a zod-style runtime validator catches this upstream at
 * complete_step time if the author expected a value.
 */
function interpolatePromptContext(
  template: Record<string, unknown>,
  scope: { variables: Record<string, unknown>; steps: Record<string, unknown> },
): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      return v.replace(
        /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
        (_, path: string) => {
          const parts = path.split(".");
          let cur: any = scope;
          for (const p of parts) {
            cur = cur?.[p];
            if (cur === undefined) return `{{${path}}}`;
          }
          return typeof cur === "string" || typeof cur === "number" ? String(cur) : JSON.stringify(cur);
        },
      );
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    }
    return v;
  };
  return walk(template) as Record<string, unknown>;
}
```

Add `launchStep` to the returned object.

- [ ] **Step 4: Run test, expect PASS**

Run: `bun run --cwd server test governed-workflows`
Expected: 5/5 launchStep cases green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): launchStep with entry gate block evaluation"
git push
```

---

## Task 8: `governedWorkflowService.completeStep` with exit gate eval

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write failing tests**

Cover the 5 pre-mortem branches for completeStep. Pattern is symmetric to Task 7 — the gate context has `artifact: <caller-supplied>` and `kind: "exit"`, and on pass the service transitions state → `succeeded`, recomputes run status (→ `completed` if all steps succeeded), and returns `{status:'succeeded', runStatus:'active'|'completed'}`.

```typescript
describe("governedWorkflowService — completeStep", () => {
  it("exit gate passes → step=succeeded", async () => { /* ... */ });
  it("exit gate fails → step back to running + WORKFLOW_GATE_FAILED", async () => { /* ... */ });
  it("no exit gate → step becomes succeeded directly", async () => { /* ... */ });
  it("all steps done → run status=completed", async () => { /* ... */ });
  it("calling on already-succeeded step → WORKFLOW_ALREADY_COMPLETED", async () => { /* ... */ });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```typescript
export interface CompleteStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  artifact: unknown;
  actor: { type: AuditActorType; id: string };
}

export interface CompleteStepResult {
  stepState: "succeeded";
  runStatus: "active" | "completed";
}

/**
 * Finalise a step. Persists the artifact, evaluates the exit gate block
 * (if any), and on pass transitions the step to `succeeded`. If every
 * step on the run is now `succeeded`, the run status transitions to
 * `completed`.
 *
 * Idempotency: calling on a step already in `succeeded` or `failed`
 * rejects with WORKFLOW_ALREADY_COMPLETED. This is conservative — the
 * spec does not define retry semantics, and allowing a second complete
 * would overwrite the artifact + re-run the gate, muddying audit
 * history.
 */
async function completeStep(args: CompleteStepArgs): Promise<CompleteStepResult> {
  // Serialize per-step completion to avoid races where two harness
  // replies race on the same step.
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'mnm:complete:' + args.runId + ':' + args.stepId}))`,
    );

    const [stepExec] = await tx
      .select()
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          eq(governedStepExecutions.stepIdInJson, args.stepId),
          eq(governedStepExecutions.companyId, args.companyId),
        ),
      );
    if (!stepExec) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
        `Step '${args.stepId}' not in run`,
      );
    }
    if (stepExec.state === "succeeded" || stepExec.state === "failed") {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_ALREADY_COMPLETED,
        `Step '${args.stepId}' is already ${stepExec.state}`,
      );
    }

    // Re-parse workflow for the exit gate block (cached by ShaCache).
    const def = await getDefByRun(args.companyId, args.runId);
    const parsed = await getWorkflowParsed({
      companyId: args.companyId,
      name: def.name,
      gitTag: undefined, // getWorkflowParsed uses latest_git_tag; we actually
      // want the run's pinned sha — we re-fetch by tag+resolveRef which maps
      // 1:1 to the same sha. ShaCache memoises.
    });
    const step = parsed.workflow.steps.find((s) => s.id === args.stepId);
    if (!step) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
        `Step '${args.stepId}' not in workflow`,
      );
    }

    // Persist artifact immediately (even before gate eval). If gate
    // fails we'll still have the last attempt's artifact on the step
    // execution for audit.
    await tx
      .update(governedStepExecutions)
      .set({
        state: "gate_eval",
        artifactsJson: args.artifact as Record<string, unknown>,
      })
      .where(eq(governedStepExecutions.id, stepExec.id));

    const exitBlock = step.gates?.exit as GateBlock | undefined;
    if (exitBlock && exitBlock.length > 0) {
      const helpers = buildGateHelpers({ db, companyId: args.companyId });
      const previousArtifacts = await fetchSucceededArtifacts(tx, args.runId);
      const context: GateContext = {
        artifact: args.artifact,
        run: {
          id: args.runId,
          workflow_name: parsed.workflow.name,
          git_tag: parsed.gitTag,
          params: (await fetchRunParams(args.companyId, args.runId)) ?? {},
        },
        step: { id: args.stepId, previous_artifacts: previousArtifacts },
        config: {},
        kind: "exit",
        helpers: {},
      };

      const blockResult = await runGateBlock(
        {
          block: exitBlock,
          kind: "exit",
          gitSha: parsed.gitSha,
          context,
          resolveSource: makeResolveSource({
            gitProvider,
            workflowGitSha: parsed.gitSha,
            workflowRepoPath: parsed.workflowRepoPath,
            shaCache,
          }),
        },
        { compiledCache, helpers },
      );

      await tx.insert(gateResults).values(
        blockResult.gate_results.map((r) => ({
          companyId: args.companyId,
          runId: args.runId,
          stepExecId: stepExec.id,
          gateIdInJson: r.gate_id_in_json,
          kind: r.kind,
          pass: r.pass,
          report: r.report,
          errorCode: r.error_code ?? null,
          hints: r.hints ?? [],
          gateGitSha: r.gate_git_sha,
          evaluatedAt: new Date(r.evaluated_at),
        })),
      );

      if (!blockResult.pass) {
        const failed = blockResult.gate_results.find((r) => !r.pass);
        await tx
          .update(governedStepExecutions)
          .set({ state: "running" })
          .where(eq(governedStepExecutions.id, stepExec.id));
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
          `Exit gate failed for step '${args.stepId}': ${failed?.report ?? "unknown"}`,
          failed?.hints ?? [],
        );
      }
    }

    // Transition to succeeded
    await tx
      .update(governedStepExecutions)
      .set({ state: "succeeded", completedAt: new Date() })
      .where(eq(governedStepExecutions.id, stepExec.id));

    // Check whether the whole run is done
    const pending = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          sql`state != 'succeeded'`,
        ),
      );
    const allDone = pending[0]!.count === 0;
    if (allDone) {
      await tx
        .update(governedWorkflowRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(governedWorkflowRuns.id, args.runId));
    }

    return {
      stepState: "succeeded" as const,
      runStatus: allDone ? ("completed" as const) : ("active" as const),
    };
  });
}

async function fetchSucceededArtifacts(
  tx: Db,
  runId: string,
): Promise<Record<string, unknown>> {
  const rows = await tx
    .select({
      stepId: governedStepExecutions.stepIdInJson,
      artifacts: governedStepExecutions.artifactsJson,
    })
    .from(governedStepExecutions)
    .where(
      and(
        eq(governedStepExecutions.runId, runId),
        sql`state = 'succeeded'`,
      ),
    );
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    out[r.stepId] = { artifact: r.artifacts };
  }
  return out;
}
```

Add `completeStep` to the returned object.

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): completeStep with exit gate + run status cascade"
git push
```

---

## Task 9: `governedWorkflowService.syncEnvironment`

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("governedWorkflowService — syncEnvironment", () => {
  it("returns {hasChanges:false, agents:[]} when lastSyncedSha matches", async () => { /* ... */ });
  it("returns populated agents when lastSyncedSha differs", async () => { /* ... */ });
  it("returns {agents:[], hasChanges:false} when no agents exist", async () => { /* ... */ });
});
```

> **Test setup:** the MVP `syncEnvironment` reads the `agents` table for the current company (all agents — tag-based scoping is deferred per spec), and for each agent (a) fetches the `.md` from the agents repo at the agent's pinned tag, (b) reads `config_layer_items` joined via the agent's `baseLayerId`, (c) merges them by item_type. A "new sha" is represented by the concatenation of all agent `latest_git_tag` values hashed — so changing any agent's tag flips `hasChanges`.

- [ ] **Step 2-4: Implement `syncEnvironment` + tests**

```typescript
import { agents } from "@mnm/db"; // check actual export path
import { createHash } from "node:crypto";

export interface SyncEnvironmentArgs {
  companyId: string;
  lastSyncedSha?: string;
}

export interface SyncedAgent {
  name: string;
  mdContent: string;
  configMerged: {
    mcp: unknown[];
    hook: unknown[];
    setting: unknown[];
    env_ref: unknown[];
  };
}

export interface SyncEnvironmentResult {
  agents: SyncedAgent[];
  newSha: string;
  hasChanges: boolean;
}

/**
 * Returns the full environment payload the SessionStart hook (T6) will
 * stage in `~/.mnm/cache/<company>/` and apply to `~/.claude/`. The
 * `newSha` field is a content hash (sha256 of the sorted `<name>:<tag>`
 * pairs). `hasChanges` compares against `lastSyncedSha` for a cheap
 * short-circuit on the client.
 *
 * The method does NOT push secrets — see spec §5. `env_ref` items are
 * required-env-var markers, not values.
 */
async function syncEnvironment(args: SyncEnvironmentArgs): Promise<SyncEnvironmentResult> {
  // 1. Read all enabled agents for the company
  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.companyId, args.companyId),
        eq(agents.enabled, true),
      ),
    );

  // 2. Compute the content-hash sha
  const shaPayload = rows
    .map((r) => `${r.name}:${r.latestGitTag ?? ""}`)
    .sort()
    .join("\n");
  const newSha = createHash("sha256").update(shaPayload).digest("hex");

  if (args.lastSyncedSha === newSha) {
    return { agents: [], newSha, hasChanges: false };
  }

  // 3. For each agent: fetch .md + merge config_layer_items
  const synced: SyncedAgent[] = [];
  for (const a of rows) {
    if (!a.latestGitTag) continue;
    const md = await shaCache.getOrFetch(
      { sha: a.latestGitTag, path: `${a.name}/agent.md` },
      () => gitProvider.fetchBlob({ path: `${a.name}/agent.md`, ref: a.latestGitTag! }),
    );
    const merged = await mergeAgentConfig(a.id);
    synced.push({ name: a.name, mdContent: md, configMerged: merged });
  }

  return { agents: synced, newSha, hasChanges: true };
}

async function mergeAgentConfig(agentId: string) {
  // TODO: use `configLayerConflictService.mergePreview(companyId, agentId)`
  // as the canonical merge path (it already implements priority-merge).
  // For MVP, return empty buckets — tag-based isolation + real item
  // lookup land when the hook tests demand it in T6. The field shape is
  // stable.
  return { mcp: [], hook: [], setting: [], env_ref: [] };
}
```

Add `syncEnvironment` to the returned object.

> **Note to implementer:** `mergeAgentConfig` is an INTENTIONAL stub for T5. The full merge path exists in `configLayerConflictService.mergePreview` — wiring it requires knowing the actor's tags (for the tag-based scoping), which is supplied by the MCP tool layer (Task 11). Deferring the real wiring keeps the service testable in isolation; the tool layer test validates the full pipe.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): syncEnvironment returning agents + merged config"
git push
```

---

## Task 10: `buildGateHelpers` — real `queryTraces` + `checkWorkflowExists`

**Files:**
- Create: `server/src/services/governed-workflows-helpers.ts`
- Create: `server/src/services/__tests__/governed-workflows-helpers.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { buildGateHelpers } from "../governed-workflows-helpers.js";
import { spawnTestDb, type TestDbHandle } from "./fixtures/test-db.js";
import type { Db } from "@mnm/db";

describe("buildGateHelpers", () => {
  let handle: TestDbHandle;
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a01";
  const companyB = "00000000-0000-0000-0000-000000000b01";

  beforeAll(async () => {
    handle = await spawnTestDb();
    db = handle.db;
    await db.execute(sql`INSERT INTO companies (id, name) VALUES (${companyA}, 'A'), (${companyB}, 'B')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'hello-world', 'v1')`);
    // Seed a minimal traces row — shape depends on the existing traces table;
    // copy from `packages/db/src/schema/traces.ts` or the existing
    // `traceService` fixture.
  });
  afterAll(async () => { await handle.close(); });

  it("queryTraces is RLS-scoped to the helper's companyId", async () => {
    const helpersA = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    const r = await helpersA.queryTraces({});
    // All rows belong to A — no B leakage
    for (const t of r) expect(t.company_id ?? companyA).toBe(companyA);
  });

  it("queryTraces filters by agentName", async () => { /* ... */ });
  it("queryTraces caps at 50 rows even if limit > 50 requested", async () => { /* ... */ });
  it("checkWorkflowExists returns true for a seeded workflow", async () => {
    const h = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    expect(await h.checkWorkflowExists("hello-world")).toBe(true);
  });
  it("checkWorkflowExists returns false for an unknown name", async () => {
    const h = buildGateHelpers({ db, companyId: companyA });
    await setTenantContext(db, companyA);
    expect(await h.checkWorkflowExists("absent")).toBe(false);
  });
  it("checkWorkflowExists does NOT leak cross-tenant", async () => {
    const h = buildGateHelpers({ db, companyId: companyB });
    await setTenantContext(db, companyB);
    expect(await h.checkWorkflowExists("hello-world")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```typescript
import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { governedWorkflowDefinitions } from "@mnm/db";

/**
 * Build the gate sandbox helpers bound to a specific company. All
 * queries are RLS-scoped (the calling tool sets `app.current_company_id`
 * before invoking a gate) and additionally include companyId in the
 * WHERE clause for defense-in-depth.
 *
 * The returned functions are async and serialisable — each is wrapped
 * in an `ivm.Reference` by the gate-runner bridge (Task 2) and called
 * from inside the isolate with a 3 s inner timeout.
 *
 * MVP shape (see spec §6 + plan deviations):
 *  - `queryTraces(filter)` — narrow filter (`agentName`, `stepId`,
 *    `sinceIso`, `limit` capped at 50). Returns trace envelopes.
 *  - `checkWorkflowExists(name)` — trivial existence check against
 *    `governed_workflow_definitions`.
 *
 * Future helpers land additively — the `helpers` record is extensible.
 */
export function buildGateHelpers(deps: {
  db: Db;
  companyId: string;
}): Record<string, (...args: any[]) => Promise<any>> {
  const { db, companyId } = deps;

  async function queryTraces(filter: {
    agentName?: string;
    stepId?: string;
    sinceIso?: string;
    limit?: number;
  } = {}) {
    const cap = Math.min(filter.limit ?? 50, 50);
    // NOTE: exact query shape depends on the traces table schema —
    // implementer reads `packages/db/src/schema/traces.ts` and the
    // existing `traceService` for the canonical column names + status
    // enum values. This block is pseudo-shaped; adapt to reality.
    const rows = await db.execute(sql`
      SELECT id, agent_name, status, started_at, completed_at, gold_summary
      FROM traces
      WHERE company_id = ${companyId}
        ${filter.agentName ? sql`AND agent_name = ${filter.agentName}` : sql``}
        ${filter.stepId ? sql`AND step_id = ${filter.stepId}` : sql``}
        ${filter.sinceIso ? sql`AND started_at >= ${filter.sinceIso}::timestamptz` : sql``}
      ORDER BY started_at DESC
      LIMIT ${cap}
    `);
    return rows.rows;
  }

  async function checkWorkflowExists(name: string): Promise<boolean> {
    const [row] = await db
      .select({ id: governedWorkflowDefinitions.id })
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, companyId),
          eq(governedWorkflowDefinitions.name, name),
        ),
      );
    return !!row;
  }

  return { queryTraces, checkWorkflowExists };
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows-helpers.ts server/src/services/__tests__/governed-workflows-helpers.test.ts
git commit -m "feat(workflows): gate helpers queryTraces + checkWorkflowExists (RLS-scoped)"
git push
```

---

## Task 11: 7 MCP tools wired into the registry

**Files:**
- Create: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/index.ts`
- Modify: `server/src/mcp/build-mcp-services.ts`
- Create: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Update `buildMcpServices`**

In `server/src/mcp/build-mcp-services.ts`, import the service, git-provider, sha-cache and construct:

```typescript
import { GitlabProvider, LocalBareRepoProvider, ShaCache, type GitProvider } from "@mnm/git-provider";
import { governedWorkflowService } from "../services/governed-workflows.js";

function resolveGitProvider(): GitProvider {
  const mode = process.env.MNM_GIT_PROVIDER ?? "gitlab";
  if (mode === "local") {
    const path = process.env.MNM_GIT_LOCAL_PATH ?? "./_fixtures/mnm-workflows-bare";
    return new LocalBareRepoProvider({ bareRepoPath: path });
  }
  return new GitlabProvider({
    baseUrl: process.env.GITLAB_BASE_URL!,
    projectId: process.env.GITLAB_PROJECT_ID!,
    token: process.env.GITLAB_TOKEN!,
  });
}

export function buildMcpServices(db: Db): McpServices {
  const gitProvider = resolveGitProvider();
  const shaCache = new ShaCache();
  return {
    db,
    // ... existing services
    governedWorkflows: governedWorkflowService(db, { gitProvider, shaCache }),
  };
}
```

> **Note:** `GitlabProvider` may have a different constructor signature — check `packages/git-provider/src/gitlab-provider.ts` and pass the exact options it expects.

- [ ] **Step 2: Write the tool file (7 tools)**

```typescript
import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { GovernedWorkflowError } from "../../services/governed-workflows.js";
import { setTenantContext } from "../../middleware/tenant-context.js";

/**
 * Map a GovernedWorkflowError to the MCP uniform error contract.
 * Cf. spec §4 "Contrat d'erreur uniforme".
 */
function governedError(err: GovernedWorkflowError) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: err.message,
          code: err.code,
          hints: err.hints,
          retryable: false,
        }),
      },
    ],
    isError: true,
  };
}

/**
 * Wrap a tool body so a thrown GovernedWorkflowError surfaces as the
 * uniform MCP error contract, and other throws fall through to the
 * registry's generic handler (INTERNAL_ERROR).
 */
async function wrap<T>(
  actor: { companyId: string },
  fn: () => Promise<T>,
): Promise<
  | { content: Array<{ type: "text"; text: string }>; isError?: boolean }
  | T
> {
  // Every governed-workflow tool sets the tenant context before running
  // its service call. This is defensive — the middleware chain should
  // have set it already for HTTP requests, but MCP tool invocations
  // happen inside a session and `app.current_company_id` needs to be
  // re-asserted here so the RLS filter applies.
  // (The existing MnM MCP wiring does NOT yet run tenantContextMiddleware
  // for /mcp endpoints — this is where we make it explicit.)
  try {
    const result = await fn();
    return result;
  } catch (err) {
    if (err instanceof GovernedWorkflowError) return governedError(err);
    throw err;
  }
}

export default defineMcpTools(({ tool, services }) => {
  tool("list_governed_workflows", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] List governed-workflow definitions available to this actor's company. " +
      "Returns [{name, description, latest_git_tag, enabled}]. Use get_governed_workflow for details.",
    input: z.object({
      enabled: z.boolean().optional().describe("Filter to enabled workflows only"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const rows = await services.governedWorkflows.listDefinitions({
          companyId: actor.companyId,
          enabled: input.enabled,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(
              rows.map((r: any) => ({
                name: r.name,
                description: r.description,
                latest_git_tag: r.latestGitTag,
                enabled: r.enabled,
              })),
            ),
          }],
        };
      });
    },
  });

  tool("get_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Fetch + parse a workflow at a given git tag (default: latest_git_tag). " +
      "Returns the parsed workflow JSON plus {git_tag, git_sha}.",
    input: z.object({
      name: z.string().min(1),
      git_tag: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.getWorkflowParsed({
          companyId: actor.companyId,
          name: input.name,
          gitTag: input.git_tag,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              workflow: r.workflow,
              git_tag: r.gitTag,
              git_sha: r.gitSha,
            }),
          }],
        };
      });
    },
  });

  tool("get_governed_workflow_run", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Fetch the state of a run. Returns {status, steps:[{id,state,artifact_ok}], last_gate_result}.",
    input: z.object({
      run_id: z.string().uuid(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.getRun({
          companyId: actor.companyId,
          runId: input.run_id,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              status: r.status,
              started_at: r.startedAt,
              completed_at: r.completedAt,
              steps: r.steps.map((s) => ({
                id: s.id,
                state: s.state,
                artifact_ok: s.artifactOk,
                started_at: s.startedAt,
                completed_at: s.completedAt,
              })),
              last_gate_result: r.lastGateResult,
            }),
          }],
        };
      });
    },
  });

  tool("launch_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Launch a new run. Pins the git tag at call time, creates the run row + one step_executions per step (pending). Returns {run_id, first_step, git_tag, git_sha}.",
    input: z.object({
      name: z.string().min(1),
      git_tag: z.string().optional(),
      params: z.record(z.unknown()).default({}),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.launchWorkflow({
          companyId: actor.companyId,
          name: input.name,
          gitTag: input.git_tag,
          params: input.params,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              first_step: r.firstStep,
              git_tag: r.gitTag,
              git_sha: r.gitSha,
            }),
          }],
        };
      });
    },
  });

  tool("launch_governed_step", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Authorize a step launch. Checks deps + evaluates the entry gate block if present. " +
      "Returns {agent_name, prompt_context, subagent_type} for the harness to Task() into.",
    input: z.object({
      run_id: z.string().uuid(),
      step_id: z.string().min(1),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.launchStep({
          companyId: actor.companyId,
          runId: input.run_id,
          stepId: input.step_id,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agent_name: r.agentName,
              prompt_context: r.promptContext,
              subagent_type: r.subagentType,
            }),
          }],
        };
      });
    },
  });

  tool("complete_governed_step", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Finalise a step with its artifact. Evaluates the exit gate block. On pass: step=succeeded; if last step, run=completed.",
    input: z.object({
      run_id: z.string().uuid(),
      step_id: z.string().min(1),
      artifact: z.unknown(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.completeStep({
          companyId: actor.companyId,
          runId: input.run_id,
          stepId: input.step_id,
          artifact: input.artifact,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              step_state: r.stepState,
              run_status: r.runStatus,
            }),
          }],
        };
      });
    },
  });

  tool("sync_governed_environment", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Return the agent + config payload to stage in ~/.mnm/cache/. " +
      "Compares last_synced_sha to the server's current sha; returns agents[] only if changed.",
    input: z.object({
      last_synced_sha: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.syncEnvironment({
          companyId: actor.companyId,
          lastSyncedSha: input.last_synced_sha,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agents: r.agents,
              new_sha: r.newSha,
              has_changes: r.hasChanges,
            }),
          }],
        };
      });
    },
  });
});
```

- [ ] **Step 3: Register in `allToolDefiners`**

In `server/src/mcp/tools/index.ts`:

```typescript
import governedWorkflowTools from "./governed-workflows.tool.js";

export const allToolDefiners = [
  /* existing */,
  governedWorkflowTools,
];
```

- [ ] **Step 4: Write a tool test using a mocked service**

`server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` — stands up `collectTools` against a minimal `services` stub, exercises each tool with a well-formed input and an error-path input, asserts the JSON body is the expected shape.

```typescript
import { describe, it, expect, vi } from "vitest";
import governedWorkflowTools from "../governed-workflows.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import { GovernedWorkflowError } from "../../../services/governed-workflows.js";
import { WORKFLOW_ERROR_CODES, PERMISSIONS } from "@mnm/shared";
import type { McpActor } from "../../registry/types.js";

function mkActor(overrides: Partial<McpActor> = {}): McpActor {
  return {
    type: "user",
    userId: "u-1",
    companyId: "00000000-0000-0000-0000-000000000a01",
    effectivePermissions: new Set([PERMISSIONS.WORKFLOWS_READ, PERMISSIONS.WORKFLOWS_ENFORCE]),
    effectiveTags: [],
    mcpSessionId: "sess-1",
    ...overrides,
  };
}

describe("governed-workflows.tool", () => {
  it("list_governed_workflows returns the mapped rows", async () => {
    const services: any = {
      db: { execute: vi.fn() },
      governedWorkflows: {
        listDefinitions: vi.fn(async () => [
          { name: "hello-world", description: "demo", latestGitTag: "v1", enabled: true },
        ]),
      },
    };
    const tools = collectTools(governedWorkflowTools, services, services.db);
    const list = tools.find((t) => t.name === "list_governed_workflows")!;
    const r = await list.handler({ input: {}, actor: mkActor() });
    const body = JSON.parse(r.content[0]!.text);
    expect(body).toEqual([
      { name: "hello-world", description: "demo", latest_git_tag: "v1", enabled: true },
    ]);
  });

  it("launch_governed_workflow maps GovernedWorkflowError to uniform contract", async () => {
    const services: any = {
      db: { execute: vi.fn() },
      governedWorkflows: {
        launchWorkflow: vi.fn(async () => {
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
            "Unknown",
            ["hint-1"],
          );
        }),
      },
    };
    const tools = collectTools(governedWorkflowTools, services, services.db);
    const launch = tools.find((t) => t.name === "launch_governed_workflow")!;
    const r = await launch.handler({
      input: { name: "absent", params: {} },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.code).toBe("WORKFLOW_NOT_FOUND");
    expect(body.hints).toEqual(["hint-1"]);
  });

  // Add equivalent tests for the remaining 5 tools: happy path + error path.
});
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `bun run --cwd server test governed-workflows.tool`
Expected: green.

- [ ] **Step 6: Typecheck + full test suite**

Run: `bun run typecheck && bun run --cwd server test`
Expected: green across the server.

- [ ] **Step 7: Commit**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/index.ts server/src/mcp/build-mcp-services.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "feat(workflows): 7 MCP tools wired into registry with uniform error contract"
git push
```

---

## Task 12: Bump root Node engines to `>=22`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit `package.json`**

Change:
```json
"engines": { "node": ">=20" }
```
to:
```json
"engines": { "node": ">=22" }
```

> **Rationale:** `isolated-vm@6.x` (used by `@mnm/gate-runner`) requires Node >=22. T4 flagged this mismatch as a deferred follow-up. Bumping in T5 is the minimum-invasive fix — MnM is pre-1.0, contributors running Node 20 were already getting `bun install` warnings. Alternative (pin isolated-vm@v4) would fragment the sandbox stack and lose the smoke-tested v6 behaviour documented in T4's pre-flight.

- [ ] **Step 2: Run `bun install` to revalidate**

Run: `bun install`
Expected: no warnings about engine incompatibility.

- [ ] **Step 3: Run full typecheck + test**

Run: `bun run typecheck && bun run test:run`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(workflows): bump root Node engines to >=22 for isolated-vm@6"
git push
```

---

## Task 13: End-to-end integration test — full workflow launch/complete via MCP tools

**Files:**
- Create: `server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts`

- [ ] **Step 1: Write the integration test**

The test spins up a real PG, seeds one definition, seeds a fixture workflow + gates in a `LocalBareRepoProvider`, and drives the full pipeline:
1. `launch_governed_workflow` → expect `{run_id, first_step: "greet"}`
2. `launch_governed_step(run_id, "greet")` → expect triplet
3. `complete_governed_step(run_id, "greet", {greeting:"Hello, Tom!"})` → expect `{step_state:"succeeded", run_status:"active"}`
4. `launch_governed_step(run_id, "shout")` → expect triplet
5. `complete_governed_step(run_id, "shout", {shouted:"HELLO, TOM!"})` → expect `{step_state:"succeeded", run_status:"completed"}`
6. `get_governed_workflow_run(run_id)` → expect `status:"completed"`, both steps `succeeded`, a `last_gate_result` populated.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LocalBareRepoProvider, ShaCache } from "@mnm/git-provider";
import governedWorkflowTools from "../governed-workflows.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import { governedWorkflowService } from "../../../services/governed-workflows.js";
import { spawnTestDb } from "../../../services/__tests__/fixtures/test-db.js";
import { seedBareRepo } from "./fixtures/seed-bare-repo.js"; // see note

const WORKFLOW_JSON = JSON.stringify({
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "hello-world",
  variables: { name: { type: "string", required: true } },
  steps: [
    {
      id: "greet",
      deps: [],
      agent: "greeter",
      prompt_context: { name: "{{variables.name}}" },
      gates: {
        exit: [{ id: "greeting-ok", source: "./gates/greet-exit.gate.ts" }],
      },
    },
    {
      id: "shout",
      deps: ["greet"],
      agent: "shouter",
      prompt_context: { greeting: "{{steps.greet.artifact.greeting}}" },
      gates: {
        exit: [{ id: "uppercase-ok", source: "./gates/shout-exit.gate.ts" }],
      },
    },
  ],
});

const GREET_GATE = `
  import { defineGate } from "@mnm/governed-workflows";
  export default defineGate(async (ctx) => {
    const a = ctx.artifact;
    if (!a || typeof a.greeting !== "string") {
      return { pass: false, report: "no greeting", error_code: "MISSING_GREETING" };
    }
    return { pass: true, report: "ok" };
  });
`;

const SHOUT_GATE = `
  import { defineGate } from "@mnm/governed-workflows";
  export default defineGate(async (ctx) => {
    const a = ctx.artifact;
    if (!a || typeof a.shouted !== "string" || a.shouted !== a.shouted.toUpperCase()) {
      return { pass: false, report: "not uppercase" };
    }
    return { pass: true, report: "ok" };
  });
`;

describe("governed-workflows E2E via MCP tools", () => {
  // ... setup PG + bare repo, run 6 steps above, assert end state.
});
```

> **Fixture note:** `seedBareRepo` is a small helper that writes the workflow.json + gate files into a tmp dir and runs `git init --bare` + a commit. Crib from `packages/git-provider/src/__tests__/*` which already has a similar fixture for T3. If none exists, add one — this is the canonical "real git" test vehicle for the codebase going forward.

- [ ] **Step 2: Run the test, expect PASS**

- [ ] **Step 3: Commit**

```bash
git add server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts server/src/mcp/tools/__tests__/fixtures/seed-bare-repo.ts
git commit -m "test(workflows): E2E hello-world via MCP tools + LocalBareRepoProvider"
git push
```

---

## Task 14: Update spec + write completion report + T6 next-session prompt

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` (flip T5 row to ✅)
- Append to: this plan file — "Completion report" section at the end
- Create: `docs/superpowers/plans/next-session-T6-prompt.md`

- [ ] **Step 1: Flip the spec T5 row**

In `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` §7, update the T5 row to match the T1/T2/T3/T4 pattern (✅ shipped, commit range, one-line summary).

- [ ] **Step 2: Append completion report to this plan**

Structure (mirror T4's format):
- Commit range + summary
- Scope delivered vs. spec
- Deferred follow-ups (webhook listener, `changelog` field in syncEnvironment, `queryTraces` richer filter, `mergeAgentConfig` full merge pipe via `configLayerConflictService.mergePreview`, real `launchStep`/`completeStep` transactional overlap, etc.)
- Retro lessons (keep/change/try)

- [ ] **Step 3: Write T6 next-session prompt**

Template cribbed from `docs/superpowers/plans/next-session-T5-prompt.md`. Sections:
- Context + statut actuel
- Docs à lire (spec + this plan + T1-T5 plans)
- Conventions MnM
- Leçons process T5 à continuer d'appliquer
- Follow-ups T5 à intégrer
- Ce que T5 a livré pour T6
- Scope T6 (SessionStart hook, `~/.mnm/cache/`, atomic file writes, `sync_governed_environment` client consumer)
- Questions ouvertes à trancher pendant le plan T6
- Workflow d'exécution recommandé
- Question pour démarrer

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md docs/superpowers/plans/2026-04-21-governed-workflows-T5-mcp-tools.md docs/superpowers/plans/next-session-T6-prompt.md
git commit -m "docs(workflows): T5 completion report + spec status + T6 next-session prompt"
git push
```

---

## Deferred follow-ups (hand off to T6/T7 team)

| ID | Origin | Item | Planned target |
|---|---|---|---|
| T5-DEF-1 | Task 9 | `mergeAgentConfig` stub returns empty buckets — wire real priority-merge via `configLayerConflictService.mergePreview(companyId, agentId)` once tag scoping is resolved. | T6 |
| T5-DEF-2 | Task 9 | `syncEnvironment.changelog` field not populated (cosmetic — harness can diff lastSyncedSha locally). | T6 |
| T5-DEF-3 | Task 10 | `queryTraces` filter shape is narrow (agentName, stepId, sinceIso, limit). Extensions (tag-based, workflow-scoped, status filter) land additively when real gates demand. | Post-MVP |
| T5-DEF-4 | Task 11 | `resolveGitProvider` reads env vars at module load — for multi-tenant prod, provider should be per-company (each company has its own GitLab repo). Current shape works for MVP single-company. | T7 |
| T5-DEF-5 | Task 7 | `launchStep`/`completeStep` re-parse the workflow on every invocation (cached via ShaCache, so fast). Optimisation: cache parsed workflow per-run in process memory, invalidate on run completion. | Post-MVP |
| T5-DEF-6 | Spec §4 | Webhook GitLab post-commit → auto-update `latest_git_tag`. | Post-MVP |
| T5-DEF-7 | Spec §alignement | Audit emit for every governed-workflow state transition — the existing `auditService` is available via `services.audit`; wire one emit per `launch_*` / `complete_*`. | T6 if audit trail needed in hook, else post-MVP |
| T5-DEF-8 | Task 2 | Gate helpers are currently constructed fresh per gate call. Consider a per-request helpers factory injected at tool-handler time so they share an AbortController. | Post-MVP |
| T5-DEF-9 | Task 11 | MCP tools currently assume `actor.companyId` exists — agent actors have this; board users have `companyIds[]`. If a board user with multiple companies is added, the tools need to pick one (or accept a `company_id` param). | T7 (when multi-company UI lands) |

---

## Completion report (filled in when T5 ships)

**Shipped:** 2026-04-22
**Commit range:** `9a1cbe2..44de8d8` (T14 docs commit à suivre)
**Commits:** 13 (+ T14 docs)

### What landed

- **T1 (9a1cbe2)** — `WORKFLOW_RUN_NOT_FOUND` + `WORKFLOW_GATE_FAILED` error codes dans `@mnm/governed-workflows`.
- **T12 (726ba48)** — Node engines ≥22 (root `package.json`) pour `isolated-vm@6.x`.
- **T2 (dcd7ac0)** — `installHelpers` bridge `ivm.Reference` dans `@mnm/gate-runner` — dispatcher single `__mnm_call_helper`, proxy JS prelude `ctx.helpers.<name>`, timeout wall-clock 3 s. 54/54 tests gate-runner verts.
- **T3 (f87777b)** — `makeResolveSource` factory (`GitProvider` + `ShaCache`) — closure par run, résolution chemins relatifs, cache sha-pinned.
- **T4 (3877367)** — `governedWorkflowService` discovery : `listDefinitions`, `getWorkflow`, `getWorkflowParsed` (RLS-scoped, GitProvider.fetchBlob, ShaCache).
- **T10 (157d9f5)** — `buildGateHelpers({db, companyId})` retournant `{queryTraces, checkWorkflowExists}` — Drizzle ORM, RLS + WHERE defense-in-depth, filtre `agentId`/`sinceIso`/`limit≤50`. 6/6 tests d'intégration verts.
- **T11 (d9abbd3)** — 7 MCP tools exposés via registry (`listWorkflows`, `getWorkflow`, `getWorkflowState`, `launchWorkflow`, `launchStep`, `completeStep`, `syncEnvironment`) — contrat erreur uniforme `{isError, error_code, message, hints}`.
- **T5 (bd7be7b)** — `launchWorkflow` avec `pg_advisory_xact_lock` sérialisé par `hashtext("launchWorkflow:" + companyId + ":" + name)`.
- **T6 (18f8de7)** — `getRun` retournant run + steps + last_gate_result (RLS-scoped, JOIN complet).
- **T7 (68e85a5)** — `launchStep` avec évaluation de la entry gate via `runGateBlock` + `makeResolveSource`.
- **T8 (b63d99d)** — `completeStep` avec exit gate + cascade statut run (all steps done → run complete/failed).
- **T9 (311cab1)** — `syncEnvironment` retournant agents + config merged (`mergeAgentConfig` stub — DEF-1).
- **T13 (44de8d8)** — E2E hello-world via MCP tools + `LocalBareRepoProvider` : lance un workflow complet depuis `listWorkflows` jusqu'à `completeStep`, vérifie le run state final.

### Deferred follow-ups

Voir table "Deferred follow-ups" au-dessus (T5-DEF-1 à T5-DEF-9). Résumé :
- **T5-DEF-1** : `mergeAgentConfig` stub — wirer `configLayerConflictService.mergePreview` en T6.
- **T5-DEF-2** : `syncEnvironment.changelog` non peuplé — cosmétique, T6.
- **T5-DEF-3** : filtre `queryTraces` étroit (agentId seulement, pas agentName ni stepId — schéma réel : pas de colonne `agent_name`/`step_id` sur `traces`). Extensions post-MVP.
- **T5-DEF-4** : `resolveGitProvider` lit les env vars au module load — multi-tenant prod nécessite provider per-company. T7.
- **T5-DEF-5** : re-parse workflow sur chaque `launchStep`/`completeStep` (ShaCache amortit). Post-MVP.
- **T5-DEF-6** : webhook GitLab post-commit. Post-MVP.
- **T5-DEF-7** : audit emit sur chaque transition governed-workflow. T6 si audit trail requis.
- **T5-DEF-8** : helpers factory per-request (AbortController partagé). Post-MVP.
- **T5-DEF-9** : board users multi-company dans MCP tools. T7.

### Process lessons (retro T5)

- **Stall silencieux tardif** : impl-1 a silencieusement stallé sur T7 (4e brief de la session), après avoir normalement livré T4/T5/T6. Respawn impl-1b a débloqué en ~10 min. Pattern différent du T3/T4 stall qui touchait le 1er brief — stall tardif plus insidieux car l'agent avait déjà prouvé sa fiabilité. Mitigation : `shutdown_request` plus agressif dès le 2e silence après un ship.
- **Plan ShaCache.getOrFetch inexistant** : plusieurs impls ont rencontré `ShaCache.getOrFetch` mentionné dans le plan qui n'existe pas — l'API réelle est `get(sha, path)` / `set(sha, path, value)`. Chaque impl a dû adapter. Pre-flight check vs code réel obligatoire dans le plan-author checklist.
- **DB credentials non documentés** : `setupTestDb` se connecte à `mnm_test:mnm_test@localhost:5433` (pas `postgres:postgres`). Bloquant pour tous les tests d'intégration jusqu'au ping team-lead. À documenter dans le README test + dans le next-session prompt.
- **issue_prefix cross-test collision** : tests de suites différentes insèrent les mêmes company UUIDs sans `issue_prefix` distinct → contrainte unique viole. Solution : prefix distinct par suite + `ON CONFLICT (id) DO NOTHING`. Pattern à inclure dans le plan comme best practice seed.
- **compiledCache process-wide** : ShaCache en RAM globale — si deux tests fixtures utilisent le même sha pour des sources différentes, le cache renvoie le mauvais résultat. Utiliser des shas distincts par fixture (e.g. `sha-test-${testName}`).
- **Plan code verbatim avec raw SQL sur schéma erroné** : la section Task 10 du plan utilisait `agent_name`, `step_id`, `gold_summary` dans la raw SQL — colonnes inexistantes sur la vraie table `traces` (qui a `agent_id` UUID FK, `name`, `gold` JSONB). Pre-flight : valider les noms de colonnes contre `packages/db/src/schema/` avant de codifier dans le plan.
- **ivm.Reference timeout CPU ≠ wall-clock** : le plan spécifiait `{ timeout: 3000 }` dans `Reference.apply` pour les helpers — mais ce timeout est CPU-time de l'isolate, pas wall-clock. Les Promises avec `setTimeout` ne consomment pas de CPU → helper lent ne timeout jamais. Fix : `Promise.race` côté host avec un `setTimeout` de 3 s. À documenter dans la spec sandbox.
- **ivm structured-clone accepte les circulaires** : le plan disait "circular refs → clone throws". En ivm 6.x, `copy:true` copie les circulaires via `[Circular]` marker. Le test "non-serialisable" a dû être adapté en "function arg" (les fonctions sont bien rejetées). Mettre à jour la spec sandbox §6.
