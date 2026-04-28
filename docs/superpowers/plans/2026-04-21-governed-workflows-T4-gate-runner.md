# Governed Workflows — T4 Gate Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a server-side gate runner that loads a `.gate.ts` source string (fetched elsewhere via `@mnm/git-provider`), compiles it at runtime with `esbuild.transform`, executes it inside an `isolated-vm` isolate with a 5 s timeout and 256 MB memory limit, validates the returned verdict against `gateOutputSchema`, and returns a typed `GateEvaluationResult`. Compose multiple gates into a `GateBlock` (nested-array: sequential outer, parallel-race inner, short-circuit on first fail). Every error path is mapped to a fail-closed code from `GATE_ERROR_CODES` so the harness never sees a 500.

**Architecture:** New workspace package `@mnm/gate-runner` under `packages/gate-runner/`. Two primary entry points:
- `runSingleGate({ gateItem, source, gitSha, context, kind }, deps)` — evaluates one gate.
- `runGateBlock({ block, resolveSource, context, kind }, deps)` — orchestrates a `GateBlock`.

The runner is **agnostic to `kind`**: it receives `"entry"`, `"exit"`, or any future value as a string and stamps it on results without hardcoded branching. Source fetching (via `GitProvider.fetchBlob`) is the **caller's** job — T4 stays pure (source in, result out) so T5 can wire its MCP orchestrator with the real provider while tests feed literal source strings. A `CompiledCache` keyed by `(gitSha, gateSourcePath)` memoizes the esbuild-transformed JS so repeated evaluations of the same pinned gate compile once. Helpers in `GateContext.helpers` are stubbed to `{}` in MVP — `queryTraces` and `checkWorkflowExists` land in T5+ when real DB access is wired.

**Tech Stack:** TypeScript 5.7, vitest 3, `isolated-vm` 6.1.2 (native addon — smoke-tested on Node 22.17 / Windows, see Pre-flight; requires Node >=22 per its `engines` field), `esbuild` (already a root dev dep, promoted here to a runtime dep), `zod` (transitive via `@mnm/governed-workflows`). Runtime deps: `isolated-vm`, `esbuild`. Workspace deps: `@mnm/governed-workflows`, `@mnm/git-provider` (type-only for now).

> **Node engines note:** `isolated-vm` 6 requires Node >=22. The root `package.json` currently declares `"node": ">=20"`. This plan does NOT bump the root engines field — if CI runs on Node 20 the `@mnm/gate-runner` install will fail. Flag to T5 for coordination (either bump root engines to `>=22` or pin isolated-vm to a v4.x release that still supports Node 20). Recorded as a deferred follow-up.

**Source spec:** `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — Section 6 (gate sandbox — the heart of T4), Section 7 (T4 row + "Points ouverts" resolved below).

**Scope of T4:** Only the gate runner (compile + isolate harness + composition). No MCP tools, no DB writes, no real `queryTraces` helper, no webhook, no Docker sandbox wrapper. T4 is independent of T5/T6/T7 but consumes T1 (types + `gateOutputSchema`) and T3 (at the type level — `GitProvider` is a phantom dep we keep for future source-fetching wire-up in T5). **Also ships the three T1 Important follow-ups** flagged at T1 close: `.strict()` on `gateOutputSchema`, JSDoc disambiguation on error codes, end-to-end integration test with non-empty `config` forwarded through the isolate.

---

## Pre-flight validation (already done 2026-04-21 on Node 22 / Windows 11)

These are **not** plan tasks — just a record of the smoke tests that de-risked T4 before writing it. The implementer does not need to re-run them.

| Check | Command used in team-lead session | Outcome |
|---|---|---|
| `isolated-vm` installs on Node 22 Windows | `npm install isolated-vm` in a throwaway tmp dir | 2 packages, no build errors |
| Sync eval works | `new ivm.Isolate({memoryLimit:128}).createContextSync().evalSync('1+2')` | returns `3` |
| Async apply + timeout works | `reference.apply(null, [json], { timeout: 500, result: { promise:true, copy:true }})` on an infinite loop | rejects with `Error: "Script execution timed out."` |
| Memory-limit OOM surfaces distinctly | `memoryLimit: 8` with a growing array loop | rejects with `Error: "Isolate was disposed during execution due to memory limit"` |
| User-thrown errors pass through | `globalThis.__throw = () => { throw new Error('boom') }` then apply | rejects with `Error: "boom"` (verbatim) |
| `esbuild.transform` strips TS types | `{ loader:'ts', format:'cjs' }` on a `defineGate` import | emits `require("@mnm/governed-workflows")` + CJS wrapper |

**Error-message strings are part of the T4 runner contract.** The classifier in `classifyIsolateError` uses **exact substring match** on these strings (case-sensitive). If a future `isolated-vm` upgrade changes them, the integration tests (Task 6, Task 8) will fail loudly.

---

## Deviations from spec (intentional, explained here)

| Spec says | Plan does | Why |
|---|---|---|
| "Gate Runner ... isolated-vm ... esbuild au runtime" | Uses `esbuild.transform` (single-file TS → CJS) **not** `esbuild.build` with bundling. | The only bare import in a gate is `@mnm/governed-workflows`, which at runtime exports one identity function (`defineGate`). We shim it inside the isolate via a scoped `require()` stub — no actual bundling required. Cuts complexity and avoids a virtual filesystem plugin. |
| "Cache compilé : keyed par `git_sha` ... éternel RAM + disk" | RAM-only `CompiledCache` (Map-backed, FIFO evict at 500 entries). No disk backup. | Matches T3's `ShaCache` pattern — process-lifetime is the MVP horizon. Disk caching is a post-MVP optimisation that would force cache-invalidation logic + a temp-dir contract we don't need yet. |
| "Runner charge le source `.gate.ts` via `fetchBlob(path, sha)`" | Runner takes `source: string` directly. The caller (T5 MCP orchestrator) does the `fetchBlob` + `ShaCache` dance. | Keeps T4 pure (source in, verdict out). Testing with literal source strings means zero fake-provider wiring. The `GitProvider` dep stays type-only in T4 so we can wire the real plumb in T5 without touching the runner. |
| "GateContext.helpers — `queryTraces`, `checkWorkflowExists`" | Helpers exposed to the isolate is `{}` (empty object) in MVP. No `queryTraces`, no `checkWorkflowExists`. | The real shape of `queryTraces` depends on the MCP tenant plumbing (RLS context, filtered trace shape) which lands in T5. Designing it now would be speculative. The `GateContext.helpers` type in `@mnm/governed-workflows` is already declared as `Record<string, unknown>` — open enough to extend without breaking T4 consumers. |
| "Retry 1× sur sandbox crash puis fail-closed" | Retry applies to `GATE_SANDBOX_CRASH` only (isolated-vm dispose / OOM / native crash). Timeouts, exceptions, invalid output are **not** retried. | Timeout + invalid output are deterministic outcomes of the gate's own logic — retrying masks bugs. Crashes are the only class that can be transient (native addon hiccup). |
| "gate lives in isolated-vm with 5 s timeout + 256 MB memory" | Timeout 5000 ms, memory 256 MB, **both tunable** at runner construction via `RunnerOptions`. | Spec defaults are baked in as defaults, not constants. Tests use 500 ms to keep the suite fast without changing semantics. |
| Open item: "Où vit le gate runner : nouveau package ou `packages/server/`" | New workspace `@mnm/gate-runner`. | Mirrors T3's choice (`@mnm/git-provider`). Lets T5 (server MCP tools) import it as a plain workspace. Keeps native addon install out of `packages/server` test suites that don't need it. |

---

## File Structure

All new code lives under `packages/gate-runner/`. One new workspace. Root `package.json` already includes `packages/*` — no workspace-config change.

| File | Responsibility |
|---|---|
| `packages/gate-runner/package.json` | Workspace manifest. Runtime deps: `isolated-vm`, `esbuild`, `zod`. Workspace deps: `@mnm/governed-workflows`, `@mnm/git-provider` (type-only). Dev deps: vitest, TS, @types/node. |
| `packages/gate-runner/tsconfig.json` | Inherits root. `rootDir: "src"`, `outDir: "dist"`. Excludes tests. |
| `packages/gate-runner/vitest.config.ts` | `environment: "node"` — isolated-vm is a native addon, needs real node. |
| `packages/gate-runner/src/index.ts` | Public barrel. Re-exports every type, class, and function. |
| `packages/gate-runner/src/types.ts` | `GateEvaluationResult`, `GateBlockResult`, `RunnerOptions`, `RunSingleGateArgs`, `RunGateBlockArgs` type declarations. |
| `packages/gate-runner/src/compiled-cache.ts` | `CompiledCache` class — RAM-only, FIFO evict, keyed by `(gitSha, sourcePath)`. |
| `packages/gate-runner/src/compile-gate.ts` | `compileGateSource(source, sourcePath)` — wraps `esbuild.transform` with fixed options. Returns `{ jsCode: string }`. Classifies bundler errors into `GATE_EXCEPTION` with a prefixed report. |
| `packages/gate-runner/src/classify-isolate-error.ts` | Pure function: takes an unknown thrown value from an isolated-vm call and returns `{ errorCode: GateErrorCode, report: string }`. Exact substring match on the 2 known isolated-vm messages; everything else = `GATE_EXCEPTION`. |
| `packages/gate-runner/src/run-single-gate.ts` | `runSingleGate(args, deps)` — compiles (or looks up in cache), spins up an Isolate, injects ctx JSON, invokes the gate's default export, parses the return, classifies errors, retries once on sandbox crash. |
| `packages/gate-runner/src/run-gate-block.ts` | `runGateBlock(args, deps)` — iterates a `GateBlock`. Outer array = sequential + short-circuit. Inner array = `Promise.all` fail-fast (waits for all settlements, aggregates). |
| `packages/gate-runner/src/__tests__/fixtures/gate-sources.ts` | Test-only — a library of literal `.gate.ts` source strings: `PASSING`, `FAILING`, `THROWING`, `INFINITE_LOOP`, `INVALID_OUTPUT`, `EXTRA_KEYS`, `CONFIG_ECHO`, `READS_PREVIOUS_ARTIFACT`. |
| `packages/gate-runner/src/__tests__/compile-gate.test.ts` | Unit — transform strips types; require() shim still present in output; cache reuse. |
| `packages/gate-runner/src/__tests__/compiled-cache.test.ts` | Unit — get/set/evict, key uniqueness. |
| `packages/gate-runner/src/__tests__/classify-isolate-error.test.ts` | Unit — maps every known isolated-vm error to the right code. |
| `packages/gate-runner/src/__tests__/run-single-gate.test.ts` | Integration — real isolated-vm. pass / fail / throw / infinite-loop / OOM / invalid output / strict-violation (extra keys) / config forwarding. |
| `packages/gate-runner/src/__tests__/run-gate-block.test.ts` | Integration — sequential short-circuit, parallel fail-fast, mixed composition, empty block. |
| `packages/gate-runner/src/__tests__/integration.test.ts` | End-to-end — `.gate.ts` source using `import { defineGate } from "@mnm/governed-workflows"`, config non-empty, previous_artifacts populated — goes through compile → isolate → verdict in one call. Covers T1 follow-up #3. |

Also modified (T1 follow-ups, Tasks 2 + 3):
- `packages/governed-workflows/src/gate-output.ts` — add `.strict()` on `gateOutputSchema`.
- `packages/governed-workflows/src/gate-output.test.ts` — extend to assert `.strict()` behaviour.
- `packages/governed-workflows/src/errors.ts` — JSDoc disambiguation on the two error-code groups.

---

## Open items resolved (no confirmation needed before execution)

All 5 open items from the T4 brief + the 3 T1 Important follow-ups are baked into the plan:

1. **[RESOLVED]** Package location → `packages/gate-runner/`, name `@mnm/gate-runner`.
2. **[RESOLVED]** `GateContext.helpers` in MVP → empty `{}`. `queryTraces` / `checkWorkflowExists` deferred to T5.
3. **[RESOLVED]** esbuild strategy → `transform` (single-file) + `require("@mnm/governed-workflows")` shim inside isolate. No bundling.
4. **[RESOLVED]** Cache → RAM-only Map, FIFO evict, 500 entries.
5. **[RESOLVED]** Windows isolated-vm native addon → smoke-tested, works. No `node:vm` fallback needed. If CI fails on a non-Windows platform later, a fallback is a T5 follow-up, not a T4 blocker.
6. **[RESOLVED]** T1 Important #1 — `.strict()` on `gateOutputSchema` → **Task 2**.
7. **[RESOLVED]** T1 Important #2 — JSDoc disambiguation on error codes → **Task 3**.
8. **[RESOLVED]** T1 Important #3 — integration test with non-empty `config` through the isolate → **Task 10** (the dedicated end-to-end integration suite).

---

## Standing orders for implementer subagents

These exist because of concrete T3 post-mortem findings. They apply to every task in this plan.

1. **JSON `task_assignment` is not a brief.** Do not start work until a prose `SendMessage` from team-lead authorises it. The `task_assignment` payload is a UI label only.
2. **Halfway check-in is mandatory.** After you write the files for a task but **before** you commit, send a one-line `SendMessage` to team-lead: `"files written, running tests + typecheck"`. Then run the checks. Then commit. This exists because T3 saw two silent stalls precisely at the post-write pre-commit gap.
3. **Plan comments are contract, not narration.** Any JSDoc, inline comment, or header comment that appears in a code block in this plan MUST be copied into the source verbatim. Do NOT strip comments citing "no comments by default" — the CLAUDE.md default is overridden by this plan's explicit comment blocks.
4. **Conventional commits.** Scope is `workflows`. Examples: `chore(workflows): scaffold @mnm/gate-runner package`, `feat(workflows): runSingleGate with isolated-vm sandbox`, `refactor(workflows): gateOutputSchema strict mode`.
5. **Atomic commit + push.** Every task ends with `git add ... && git commit && git push`. Never leave unpushed commits.
6. **GPG signing can time out.** If `git commit` fails with `gpg: signing failed: Timeout`, retry the same commit with `-c commit.gpgsign=false`. Do NOT skip hooks or rewrite history.
7. **No emojis in code or commit messages.**

---

## Task 1: Scaffold `@mnm/gate-runner` workspace

**Files:**
- Create: `packages/gate-runner/package.json`
- Create: `packages/gate-runner/tsconfig.json`
- Create: `packages/gate-runner/vitest.config.ts`
- Create: `packages/gate-runner/src/index.ts`
- Create: `packages/gate-runner/src/__tests__/scaffold.test.ts`

- [ ] **Step 1: Write the failing scaffold test**

Create `packages/gate-runner/src/__tests__/scaffold.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("@mnm/gate-runner scaffold", () => {
  it("package exports an index barrel", async () => {
    const mod = await import("../index.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("isolated-vm native addon loads and evaluates sync", async () => {
    const ivm = await import("isolated-vm");
    const iso = new ivm.default.Isolate({ memoryLimit: 32 });
    const ctx = iso.createContextSync();
    expect(ctx.evalSync("40 + 2")).toBe(42);
    iso.dispose();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bunx vitest run packages/gate-runner`
Expected: FAIL — module not found / package not discoverable.

- [ ] **Step 3: Create `packages/gate-runner/package.json`**

```json
{
  "name": "@mnm/gate-runner",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "publishConfig": {
    "access": "public",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      },
      "./*": {
        "types": "./dist/*.d.ts",
        "import": "./dist/*.js"
      }
    },
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@mnm/governed-workflows": "workspace:*",
    "@mnm/git-provider": "workspace:*",
    "esbuild": "^0.27.3",
    "isolated-vm": "^6.1.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 4: Create `packages/gate-runner/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/__tests__/**"]
}
```

- [ ] **Step 5: Create `packages/gate-runner/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 6: Create the empty barrel**

Create `packages/gate-runner/src/index.ts`:

```typescript
// Empty barrel — populated by subsequent tasks.
export {};
```

- [ ] **Step 7: Install workspace dependencies**

Run: `bun install`
Expected: `isolated-vm` and `esbuild` land under `packages/gate-runner/node_modules/` (or hoisted). No build errors. The `isolated-vm` postinstall compiles the native addon — this can take 30–60 s on first install.

- [ ] **Step 8: Halfway check-in**

Send `SendMessage` to team-lead: `"files written, running tests + typecheck"`.

- [ ] **Step 9: Run the scaffold tests, expect PASS**

Run: `bunx vitest run packages/gate-runner`
Expected: 2 passing.

- [ ] **Step 10: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output (success).

- [ ] **Step 11: Commit + push**

```bash
git add packages/gate-runner package.json bun.lock
git commit -m "chore(workflows): scaffold @mnm/gate-runner package"
git push
```

(If `bun.lockb` / `bun.lock` naming differs, stage whichever lockfile changed.)

---

## Task 2: T1 follow-up — `.strict()` on `gateOutputSchema`

Gate authors must not smuggle extra keys into their return value. Strict mode makes that a `GATE_INVALID_OUTPUT` at runtime instead of silent data loss.

**Files:**
- Modify: `packages/governed-workflows/src/gate-output.ts`
- Modify: `packages/governed-workflows/src/gate-output.test.ts`

- [ ] **Step 1: Extend the failing test**

Add to `packages/governed-workflows/src/gate-output.test.ts` (keep existing tests):

```typescript
import { describe, it, expect } from "vitest";
import { gateOutputSchema } from "./gate-output.js";

describe("gateOutputSchema strict mode", () => {
  it("rejects unknown keys alongside valid fields", () => {
    const result = gateOutputSchema.safeParse({
      pass: true,
      report: "ok",
      sneaky_extra: "bad",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("still accepts the documented optional fields", () => {
    const result = gateOutputSchema.safeParse({
      pass: false,
      report: "missing greeting",
      error_code: "MISSING_GREETING",
      hints: ["Return {greeting} from the greeter sub-agent"],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bunx vitest run packages/governed-workflows/src/gate-output.test.ts`
Expected: the first new test FAILS (schema currently accepts the extra key silently).

- [ ] **Step 3: Add `.strict()` to the schema**

Edit `packages/governed-workflows/src/gate-output.ts` — replace the file with:

```typescript
import { z } from "zod";

/**
 * Verdict returned by a gate function. Validated server-side by the runner
 * after each gate invocation. A missing/invalid output — including any
 * unrecognised top-level key — is reported to the client as
 * `GATE_INVALID_OUTPUT`. `.strict()` is load-bearing: gates occasionally try
 * to smuggle debugging fields (`reason`, `detail`, `stack`) that would be
 * silently dropped without it.
 */
export const gateOutputSchema = z
  .object({
    pass: z.boolean(),
    report: z.string().min(1),
    error_code: z.string().min(1).optional(),
    hints: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type GateOutput = z.infer<typeof gateOutputSchema>;
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bunx vitest run packages/governed-workflows/src/gate-output.test.ts`
Expected: all tests passing.

- [ ] **Step 5: Typecheck the package**

Run: `bun run --filter @mnm/governed-workflows typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/governed-workflows/src/gate-output.ts packages/governed-workflows/src/gate-output.test.ts
git commit -m "refactor(workflows): gateOutputSchema strict mode rejects extra keys"
git push
```

---

## Task 3: T1 follow-up — JSDoc disambiguation on error codes

The current JSDoc says "gate runner" vs "orchestrator" but does not tell a caller **when** each code fires or **where** it surfaces. Tighten.

**Files:**
- Modify: `packages/governed-workflows/src/errors.ts`

- [ ] **Step 1: Replace the file content with expanded JSDoc**

Edit `packages/governed-workflows/src/errors.ts` — replace the whole file with:

```typescript
/**
 * Fail-closed error codes produced by the gate runner (`@mnm/gate-runner`) when
 * a gate invocation cannot produce a user-authored verdict. These appear in
 * `gate_results.error_code` (DB) and surface to the Claude Code harness as
 * part of the `GateEvaluationResult`:
 *
 * - `GATE_TIMEOUT` — isolate exceeded `RunnerOptions.timeoutMs` (default 5 s).
 * - `GATE_EXCEPTION` — user code threw, OR the esbuild transform of the source
 *   failed.
 * - `GATE_INVALID_OUTPUT` — gate returned, but the value did not match
 *   `gateOutputSchema` (missing `pass`/`report`, wrong types, or unrecognised
 *   keys — strict mode enforced).
 * - `GATE_SANDBOX_CRASH` — isolated-vm disposed the isolate mid-run (typically
 *   memory-limit breach or native addon fault). Retried once by the runner;
 *   a second crash surfaces this code.
 *
 * These codes are produced ONLY by the gate runner. Do not emit them from
 * other parts of the workflow orchestrator — use `WORKFLOW_ERROR_CODES` below.
 */
export const GATE_ERROR_CODES = Object.freeze({
  GATE_TIMEOUT: "GATE_TIMEOUT",
  GATE_EXCEPTION: "GATE_EXCEPTION",
  GATE_INVALID_OUTPUT: "GATE_INVALID_OUTPUT",
  GATE_SANDBOX_CRASH: "GATE_SANDBOX_CRASH",
} as const);

export type GateErrorCode = (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];

/**
 * Business error codes produced by the workflow orchestrator (MCP tools layer,
 * T5). These appear in MCP tool error payloads (`{ isError: true, error_code,
 * message, hints }`) returned to the Claude Code harness — NOT in
 * `gate_results.error_code`:
 *
 * - `WORKFLOW_NOT_FOUND` — `getWorkflow` / `launchWorkflow` with an unknown
 *   name (or unknown `git_tag` at that name).
 * - `WORKFLOW_DEPENDENCY_UNMET` — `launchStep` called on a step whose `deps`
 *   are not all `succeeded`.
 * - `WORKFLOW_STEP_NOT_FOUND` — `launchStep` / `completeStep` with a `stepId`
 *   not in the run's parsed workflow.
 * - `WORKFLOW_INVALID_ARTIFACT` — `completeStep` called with an artifact the
 *   step's exit-gate block flagged as invalid in a deterministic pre-check
 *   (distinct from a gate verdict — this is malformed data, not a failed
 *   business rule).
 * - `WORKFLOW_ALREADY_COMPLETED` — mutation attempted on a run already in
 *   `completed` or `failed` status.
 *
 * These codes are produced ONLY by the orchestrator. Gate runner code must
 * use `GATE_ERROR_CODES` instead.
 */
export const WORKFLOW_ERROR_CODES = Object.freeze({
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
  WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
  WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
  WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
} as const);

export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];
```

- [ ] **Step 2: Re-run the existing errors test suite**

Run: `bunx vitest run packages/governed-workflows/src/errors.test.ts`
Expected: all tests still pass (no behavioural change — JSDoc only).

- [ ] **Step 3: Typecheck**

Run: `bun run --filter @mnm/governed-workflows typecheck`
Expected: no output.

- [ ] **Step 4: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 5: Commit + push**

```bash
git add packages/governed-workflows/src/errors.ts
git commit -m "docs(workflows): disambiguate GATE_* vs WORKFLOW_* error codes in JSDoc"
git push
```

---

## Task 4: Runner types (`GateEvaluationResult`, `GateBlockResult`, `RunnerOptions`, args)

**Files:**
- Create: `packages/gate-runner/src/types.ts`
- Create: `packages/gate-runner/src/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing types test**

Create `packages/gate-runner/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  GateEvaluationResult,
  GateBlockResult,
  RunnerOptions,
  RunSingleGateArgs,
  RunGateBlockArgs,
} from "../types.js";
import { GATE_ERROR_CODES, type GateContext } from "@mnm/governed-workflows";

describe("gate-runner types", () => {
  it("GateEvaluationResult carries the DB-row-equivalent shape", () => {
    const sample: GateEvaluationResult = {
      gate_id_in_json: "greeting-ok",
      gate_git_sha: "deadbeef",
      gate_source_path: "hello-world/gates/greet-exit.gate.ts",
      kind: "exit",
      pass: true,
      report: "ok",
      evaluated_at: "2026-04-21T12:00:00.000Z",
      duration_ms: 42,
    };
    expect(sample.pass).toBe(true);
  });

  it("GateEvaluationResult allows error_code + hints on failure", () => {
    const sample: GateEvaluationResult = {
      gate_id_in_json: "greeting-ok",
      gate_git_sha: "deadbeef",
      gate_source_path: "hello-world/gates/greet-exit.gate.ts",
      kind: "exit",
      pass: false,
      report: "timed out",
      error_code: GATE_ERROR_CODES.GATE_TIMEOUT,
      hints: ["gate exceeded 5s"],
      evaluated_at: "2026-04-21T12:00:00.000Z",
      duration_ms: 5001,
    };
    expect(sample.error_code).toBe("GATE_TIMEOUT");
  });

  it("GateBlockResult aggregates evaluation results", () => {
    const block: GateBlockResult = { pass: true, gate_results: [] };
    expect(block.gate_results).toEqual([]);
  });

  it("RunnerOptions allows overriding timeout + memory + retry", () => {
    expectTypeOf<RunnerOptions>().toEqualTypeOf<{
      timeoutMs?: number;
      memoryLimitMb?: number;
      retryOnSandboxCrash?: boolean;
    }>();
  });

  it("RunSingleGateArgs carries everything the runner needs", () => {
    const args: RunSingleGateArgs = {
      gateItem: { id: "g1", source: "./gates/x.gate.ts" },
      source: "export default async () => ({ pass: true, report: 'ok' });",
      gateSourcePath: "hello-world/gates/x.gate.ts",
      gitSha: "deadbeef",
      kind: "exit",
      context: {} as GateContext,
    };
    expect(args.kind).toBe("exit");
  });

  it("RunGateBlockArgs takes a source resolver", () => {
    const args: RunGateBlockArgs = {
      block: [],
      kind: "exit",
      gitSha: "deadbeef",
      resolveSource: async (p: string) => ({
        source: "",
        gateSourcePath: p,
      }),
      context: {} as GateContext,
    };
    expect(args.kind).toBe("exit");
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/types.test.ts`
Expected: FAIL — `../types.js` not found.

- [ ] **Step 3: Create `packages/gate-runner/src/types.ts`**

```typescript
import type { GateBlock, GateContext, GateItem } from "@mnm/governed-workflows";

/**
 * Result of one gate invocation. Mirrors the `gate_results` DB row minus the
 * DB-only columns (id, run_id, step_exec_id, company_id) which are added by
 * the orchestrator (T5) when it persists the result.
 */
export interface GateEvaluationResult {
  /** `id` field from the workflow.json gate item. */
  gate_id_in_json: string;
  /** Pinned git sha of the run. Immutable — matches the DB column. */
  gate_git_sha: string;
  /** Repo-relative POSIX path of the .gate.ts source that was evaluated. */
  gate_source_path: string;
  /** Lifecycle kind — "entry", "exit", or future extension. Opaque string. */
  kind: string;
  /** True if the gate returned `{ pass: true }`; false for every failure. */
  pass: boolean;
  /** Human-readable explanation. Always present, even on failure. */
  report: string;
  /** Populated on failure. Value is a `GATE_ERROR_CODES` member OR an author-defined code string. */
  error_code?: string;
  /** Remediation hints for the harness / human reader. */
  hints?: string[];
  /** ISO-8601 timestamp stamped when the runner recorded the result. */
  evaluated_at: string;
  /** Wall-clock duration of the invocation, milliseconds. Includes compile + isolate spin-up on cold path. */
  duration_ms: number;
}

/**
 * Result of a full `GateBlock` — the nested-array composition from
 * workflow.json. `pass` is false as soon as any single gate fails
 * (short-circuit). `gate_results` contains every gate that was actually
 * invoked, in evaluation order; parallel-inner-array entries appear
 * contiguously but their relative order matches the original inner array.
 */
export interface GateBlockResult {
  pass: boolean;
  gate_results: GateEvaluationResult[];
}

/**
 * Runner-wide tunables. Defaults mirror spec §6: 5 s timeout, 256 MB memory,
 * retry-once on sandbox crash.
 */
export interface RunnerOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
  retryOnSandboxCrash?: boolean;
}

/**
 * Arguments for `runSingleGate`. Source fetching is the caller's job — pass
 * the literal source string and the path it came from so the cache key can
 * include the path.
 */
export interface RunSingleGateArgs {
  gateItem: GateItem;
  /** Raw TypeScript source of the gate file, exactly as stored in git. */
  source: string;
  /** Repo-relative POSIX path of the gate source. Used in the compile cache key and stamped on the result. */
  gateSourcePath: string;
  /** Pinned git sha of the run. Used in the compile cache key. */
  gitSha: string;
  /** Lifecycle kind ("entry" / "exit" / future). Opaque to the runner. */
  kind: string;
  /** Read-only runtime context injected into the isolate. */
  context: GateContext;
}

/**
 * Arguments for `runGateBlock`. The runner iterates the block and calls
 * `resolveSource` on demand for each gate item. `resolveSource` is where the
 * caller plugs in `GitProvider.fetchBlob` + `ShaCache`.
 */
export interface RunGateBlockArgs {
  block: GateBlock;
  kind: string;
  gitSha: string;
  context: GateContext;
  resolveSource: (gateItemSource: string) => Promise<{
    source: string;
    gateSourcePath: string;
  }>;
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/types.test.ts`
Expected: all passing.

- [ ] **Step 5: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/gate-runner/src/types.ts packages/gate-runner/src/__tests__/types.test.ts
git commit -m "feat(workflows): gate-runner types (GateEvaluationResult, GateBlockResult, args)"
git push
```

---

## Task 5: `CompiledCache` — RAM-only sha-keyed compile cache

**Files:**
- Create: `packages/gate-runner/src/compiled-cache.ts`
- Create: `packages/gate-runner/src/__tests__/compiled-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/gate-runner/src/__tests__/compiled-cache.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CompiledCache } from "../compiled-cache.js";

describe("CompiledCache", () => {
  it("stores and retrieves by (gitSha, path)", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "var js1 = 1;");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("var js1 = 1;");
  });

  it("returns undefined on miss", () => {
    const cache = new CompiledCache();
    expect(cache.get("sha1", "gates/a.gate.ts")).toBeUndefined();
  });

  it("treats different shas as different keys", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "v1");
    cache.set("sha2", "gates/a.gate.ts", "v2");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("v1");
    expect(cache.get("sha2", "gates/a.gate.ts")).toBe("v2");
  });

  it("treats different paths as different keys", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "v-a");
    cache.set("sha1", "gates/b.gate.ts", "v-b");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("v-a");
    expect(cache.get("sha1", "gates/b.gate.ts")).toBe("v-b");
  });

  it("FIFO-evicts the oldest entry once maxEntries is exceeded", () => {
    const cache = new CompiledCache({ maxEntries: 2 });
    cache.set("s1", "a", "v1");
    cache.set("s2", "b", "v2");
    cache.set("s3", "c", "v3");
    expect(cache.get("s1", "a")).toBeUndefined();
    expect(cache.get("s2", "b")).toBe("v2");
    expect(cache.get("s3", "c")).toBe("v3");
  });

  it("overwriting an existing key does not count as a new entry for eviction", () => {
    const cache = new CompiledCache({ maxEntries: 2 });
    cache.set("s1", "a", "v1");
    cache.set("s2", "b", "v2");
    cache.set("s1", "a", "v1-updated");
    expect(cache.size()).toBe(2);
    expect(cache.get("s1", "a")).toBe("v1-updated");
    expect(cache.get("s2", "b")).toBe("v2");
  });

  it("exposes size() and clear()", () => {
    const cache = new CompiledCache();
    cache.set("s1", "a", "v");
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("JSON-encodes keys so path/sha boundaries cannot collide", () => {
    const cache = new CompiledCache();
    cache.set("s1", "a|b", "v-one");
    cache.set("s1|a", "b", "v-two");
    expect(cache.get("s1", "a|b")).toBe("v-one");
    expect(cache.get("s1|a", "b")).toBe("v-two");
  });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/compiled-cache.test.ts`
Expected: FAIL — `../compiled-cache.js` not found.

- [ ] **Step 3: Create `packages/gate-runner/src/compiled-cache.ts`**

```typescript
/**
 * Process-lifetime memoization for esbuild-transformed gate source.
 *
 * Rationale: a pinned `(gitSha, gateSourcePath)` maps to an immutable TS
 * source file, which transforms deterministically to the same JS bundle
 * every time. Caching the transformed JS skips the esbuild overhead (~5 ms
 * per small gate) on every subsequent invocation in the same process.
 *
 * Mirrors the `@mnm/git-provider` `ShaCache` pattern (FIFO, Map-backed,
 * bounded by `maxEntries`). Kept as a separate class so consumers can size
 * each cache independently — compiled JS is a few kB per entry whereas blob
 * reads can be anything.
 */
export interface CompiledCacheOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class CompiledCache {
  private readonly entries = new Map<string, string>();
  private readonly maxEntries: number;

  constructor(options: CompiledCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private key(gitSha: string, gateSourcePath: string): string {
    // JSON encoding prevents separator-collision attacks when a `path`
    // contains the previous `|` separator.
    return JSON.stringify([gitSha, gateSourcePath]);
  }

  get(gitSha: string, gateSourcePath: string): string | undefined {
    return this.entries.get(this.key(gitSha, gateSourcePath));
  }

  set(gitSha: string, gateSourcePath: string, compiledJs: string): void {
    const k = this.key(gitSha, gateSourcePath);
    if (!this.entries.has(k) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(k, compiledJs);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
```

- [ ] **Step 4: Run the tests, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/compiled-cache.test.ts`
Expected: 8 passing.

- [ ] **Step 5: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/gate-runner/src/compiled-cache.ts packages/gate-runner/src/__tests__/compiled-cache.test.ts
git commit -m "feat(workflows): CompiledCache for esbuild-transformed gate sources"
git push
```

---

## Task 6: `compileGateSource` — esbuild transform wrapper

**Files:**
- Create: `packages/gate-runner/src/compile-gate.ts`
- Create: `packages/gate-runner/src/__tests__/compile-gate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/gate-runner/src/__tests__/compile-gate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { compileGateSource } from "../compile-gate.js";

const GOOD_SOURCE = `
import { defineGate } from "@mnm/governed-workflows";
import type { GateContext } from "@mnm/governed-workflows";

export default defineGate(async (ctx: GateContext) => {
  const a = ctx.artifact as { greeting?: string } | undefined;
  if (!a || typeof a.greeting !== "string") {
    return { pass: false, report: "no greeting" };
  }
  return { pass: true, report: "ok: " + a.greeting };
});
`;

describe("compileGateSource", () => {
  it("strips TypeScript types and emits CJS", async () => {
    const { jsCode } = await compileGateSource(GOOD_SOURCE, "gates/x.gate.ts");
    expect(jsCode).not.toContain(": GateContext");
    expect(jsCode).not.toContain("as { greeting?: string }");
    expect(jsCode).toContain("module.exports");
  });

  it("preserves the require('@mnm/governed-workflows') call so the isolate shim can handle it", async () => {
    const { jsCode } = await compileGateSource(GOOD_SOURCE, "gates/x.gate.ts");
    expect(jsCode).toContain('require("@mnm/governed-workflows")');
  });

  it("throws GitProviderError-style error on syntactically invalid TS", async () => {
    await expect(
      compileGateSource("export default function( syntax error {", "gates/bad.gate.ts"),
    ).rejects.toThrow(/compile/i);
  });

  it("stamps the source file name for better error messages", async () => {
    try {
      await compileGateSource("export default function( {", "gates/bad.gate.ts");
      throw new Error("expected compile to throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("gates/bad.gate.ts");
    }
  });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/compile-gate.test.ts`
Expected: FAIL — `../compile-gate.js` not found.

- [ ] **Step 3: Create `packages/gate-runner/src/compile-gate.ts`**

```typescript
import { transform } from "esbuild";

export interface CompileGateResult {
  jsCode: string;
}

/**
 * Transform a `.gate.ts` source string into plain CommonJS JavaScript suitable
 * for evaluation inside an `isolated-vm` isolate.
 *
 * Intentionally uses `esbuild.transform` (single-file, no filesystem lookups)
 * rather than `esbuild.build`. Gates only import from
 * `@mnm/governed-workflows` which at runtime exports identity helpers — the
 * isolate supplies a shim via `globalThis.require` (see `runSingleGate`).
 *
 * On transform failure this raises an Error whose message prefixes
 * "compile failed" and includes the source path, so the caller can classify
 * it as `GATE_EXCEPTION` without leaking esbuild internals into the user-
 * facing report.
 */
export async function compileGateSource(
  source: string,
  gateSourcePath: string,
): Promise<CompileGateResult> {
  try {
    const result = await transform(source, {
      loader: "ts",
      format: "cjs",
      target: "es2022",
      sourcefile: gateSourcePath,
      legalComments: "none",
    });
    return { jsCode: result.code };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `compile failed for ${gateSourcePath}: ${message}`,
      { cause },
    );
  }
}
```

- [ ] **Step 4: Run the tests, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/compile-gate.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/gate-runner/src/compile-gate.ts packages/gate-runner/src/__tests__/compile-gate.test.ts
git commit -m "feat(workflows): compileGateSource wraps esbuild.transform for gates"
git push
```

---

## Task 7: `classifyIsolateError` — map thrown values to `GateErrorCode`

Tiny but critical: every error path through the isolate must collapse to exactly one `GateErrorCode`. A dedicated pure function keeps the logic unit-testable and cheap to change.

**Files:**
- Create: `packages/gate-runner/src/classify-isolate-error.ts`
- Create: `packages/gate-runner/src/__tests__/classify-isolate-error.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/gate-runner/src/__tests__/classify-isolate-error.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GATE_ERROR_CODES } from "@mnm/governed-workflows";
import { classifyIsolateError } from "../classify-isolate-error.js";

describe("classifyIsolateError", () => {
  it("maps isolated-vm script-timeout message to GATE_TIMEOUT", () => {
    const err = new Error("Script execution timed out.");
    const { errorCode, report } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_TIMEOUT);
    expect(report).toMatch(/timed out/i);
  });

  it("maps isolated-vm memory-limit dispose message to GATE_SANDBOX_CRASH", () => {
    const err = new Error("Isolate was disposed during execution due to memory limit");
    const { errorCode } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_SANDBOX_CRASH);
  });

  it("maps any isolated-vm disposed message to GATE_SANDBOX_CRASH", () => {
    const err = new Error("Isolate was disposed");
    const { errorCode } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_SANDBOX_CRASH);
  });

  it("maps arbitrary Error from user code to GATE_EXCEPTION", () => {
    const err = new Error("boom from user code");
    const { errorCode, report } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report).toContain("boom from user code");
  });

  it("maps non-Error throws to GATE_EXCEPTION with a stringified message", () => {
    const { errorCode, report } = classifyIsolateError("weird string throw");
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report).toContain("weird string throw");
  });

  it("handles null / undefined throws safely", () => {
    const { errorCode, report } = classifyIsolateError(null);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/classify-isolate-error.test.ts`
Expected: FAIL — `../classify-isolate-error.js` not found.

- [ ] **Step 3: Create `packages/gate-runner/src/classify-isolate-error.ts`**

```typescript
import {
  GATE_ERROR_CODES,
  type GateErrorCode,
} from "@mnm/governed-workflows";

export interface ClassifiedIsolateError {
  errorCode: GateErrorCode;
  report: string;
}

/**
 * Deterministic mapping from an isolated-vm (or esbuild) thrown value to a
 * `GATE_ERROR_CODES` member. Substring matches are exact and case-sensitive;
 * the reference strings are the verbatim messages emitted by `isolated-vm`
 * 6.x as smoke-tested in the team-lead session on 2026-04-21:
 *
 *   - "Script execution timed out."
 *       → GATE_TIMEOUT
 *   - "Isolate was disposed..."  (any suffix, e.g. "...due to memory limit")
 *       → GATE_SANDBOX_CRASH
 *   - anything else
 *       → GATE_EXCEPTION
 *
 * If a future isolated-vm upgrade changes these strings, the integration
 * tests in `run-single-gate.test.ts` will catch the regression and force a
 * deliberate update here.
 */
export function classifyIsolateError(value: unknown): ClassifiedIsolateError {
  const message = extractMessage(value);
  if (message.includes("Script execution timed out.")) {
    return {
      errorCode: GATE_ERROR_CODES.GATE_TIMEOUT,
      report: `Gate timed out: ${message}`,
    };
  }
  if (message.includes("Isolate was disposed")) {
    return {
      errorCode: GATE_ERROR_CODES.GATE_SANDBOX_CRASH,
      report: `Sandbox crashed: ${message}`,
    };
  }
  return {
    errorCode: GATE_ERROR_CODES.GATE_EXCEPTION,
    report: `Gate threw: ${message}`,
  };
}

function extractMessage(value: unknown): string {
  if (value === null) return "<null thrown>";
  if (value === undefined) return "<undefined thrown>";
  if (value instanceof Error) return value.message || value.toString();
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
```

- [ ] **Step 4: Run the tests, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/classify-isolate-error.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/gate-runner/src/classify-isolate-error.ts packages/gate-runner/src/__tests__/classify-isolate-error.test.ts
git commit -m "feat(workflows): classifyIsolateError maps isolated-vm errors to GATE_* codes"
git push
```

---

## Task 8: `runSingleGate` — isolated-vm harness

This is the core task. It composes everything built so far: `compileGateSource`, `CompiledCache`, `classifyIsolateError`, and the `gateOutputSchema` validation into one async function that evaluates a gate.

**Files:**
- Create: `packages/gate-runner/src/__tests__/fixtures/gate-sources.ts`
- Create: `packages/gate-runner/src/run-single-gate.ts`
- Create: `packages/gate-runner/src/__tests__/run-single-gate.test.ts`

- [ ] **Step 1: Create the fixture library**

Create `packages/gate-runner/src/__tests__/fixtures/gate-sources.ts`:

```typescript
/**
 * Literal .gate.ts source strings used by the run-single-gate and
 * integration tests. Keeping them in one place (a) lets every test describe
 * behaviour by name instead of by copy-pasting the same 10 lines, and (b)
 * guarantees every test exercises the same `import { defineGate } from
 * "@mnm/governed-workflows"` bare specifier that the isolate shim has to
 * handle.
 */
export const PASSING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.greeting !== "string") {
    return { pass: false, report: "no greeting" };
  }
  return { pass: true, report: "ok: " + a.greeting };
});
`;

export const FAILING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({
  pass: false,
  report: "always fail",
  error_code: "ALWAYS_FAIL",
  hints: ["try something else"],
}));
`;

export const THROWING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => {
  throw new Error("boom from user gate");
});
`;

export const INFINITE_LOOP = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => {
  while (true) {}
});
`;

export const INVALID_OUTPUT_NON_OBJECT = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => "not an object");
`;

export const INVALID_OUTPUT_MISSING_PASS = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({ report: "ok" }));
`;

export const EXTRA_KEYS = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({
  pass: true,
  report: "ok",
  debug_note: "this should be rejected by strict mode",
}));
`;

export const CONFIG_ECHO = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => ({
  pass: true,
  report: "field=" + String(ctx.config.field) + ",kind=" + ctx.kind,
}));
`;

export const READS_PREVIOUS_ARTIFACT = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const prev = ctx.step.previous_artifacts["greet"];
  if (!prev || typeof prev.greeting !== "string") {
    return { pass: false, report: "missing previous greet artifact" };
  }
  return { pass: true, report: "previous greeting: " + prev.greeting };
});
`;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/gate-runner/src/__tests__/run-single-gate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GATE_ERROR_CODES, type GateContext } from "@mnm/governed-workflows";
import { runSingleGate } from "../run-single-gate.js";
import { CompiledCache } from "../compiled-cache.js";
import {
  PASSING,
  FAILING,
  THROWING,
  INFINITE_LOOP,
  INVALID_OUTPUT_NON_OBJECT,
  INVALID_OUTPUT_MISSING_PASS,
  EXTRA_KEYS,
  CONFIG_ECHO,
  READS_PREVIOUS_ARTIFACT,
} from "./fixtures/gate-sources.js";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: {} },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

const BASE = {
  gateItem: { id: "g1", source: "./gates/x.gate.ts" },
  gateSourcePath: "hello-world/gates/x.gate.ts",
  gitSha: "deadbeef",
  kind: "exit",
};

describe("runSingleGate", () => {
  it("returns pass:true when the gate passes", async () => {
    const result = await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "Hi" } }) },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("ok: Hi");
    expect(result.error_code).toBeUndefined();
    expect(result.gate_id_in_json).toBe("g1");
    expect(result.gate_source_path).toBe("hello-world/gates/x.gate.ts");
    expect(result.gate_git_sha).toBe("deadbeef");
    expect(result.kind).toBe("exit");
    expect(typeof result.evaluated_at).toBe("string");
    expect(typeof result.duration_ms).toBe("number");
  });

  it("returns pass:false with the gate-authored report + hints on deterministic failure", async () => {
    const result = await runSingleGate(
      { ...BASE, source: FAILING, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.report).toBe("always fail");
    expect(result.error_code).toBe("ALWAYS_FAIL");
    expect(result.hints).toEqual(["try something else"]);
  });

  it("maps thrown errors to GATE_EXCEPTION", async () => {
    const result = await runSingleGate(
      { ...BASE, source: THROWING, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(result.report).toContain("boom from user gate");
  });

  it("maps infinite loops to GATE_TIMEOUT via timeoutMs", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INFINITE_LOOP, context: ctx() },
      { compiledCache: new CompiledCache(), options: { timeoutMs: 300 } },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_TIMEOUT);
    expect(result.duration_ms).toBeGreaterThanOrEqual(300);
  }, 10000);

  it("maps non-object returns to GATE_INVALID_OUTPUT", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INVALID_OUTPUT_NON_OBJECT, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
  });

  it("maps missing required fields to GATE_INVALID_OUTPUT", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INVALID_OUTPUT_MISSING_PASS, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
  });

  it("maps extra keys to GATE_INVALID_OUTPUT (strict schema)", async () => {
    const result = await runSingleGate(
      { ...BASE, source: EXTRA_KEYS, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
    expect(result.report).toMatch(/debug_note|unrecognized/i);
  });

  it("forwards gateItem.config into ctx.config inside the isolate", async () => {
    const result = await runSingleGate(
      {
        ...BASE,
        source: CONFIG_ECHO,
        gateItem: { id: "g1", source: "./gates/x.gate.ts", config: { field: "greeting" } },
        context: ctx({ config: { field: "greeting" } }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("field=greeting,kind=exit");
  });

  it("exposes previous_artifacts to the gate", async () => {
    const result = await runSingleGate(
      {
        ...BASE,
        source: READS_PREVIOUS_ARTIFACT,
        context: ctx({
          step: { id: "shout", previous_artifacts: { greet: { greeting: "Hello, the maintainer!" } } },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("previous greeting: Hello, the maintainer!");
  });

  it("reuses the compiled cache on the second invocation", async () => {
    const cache = new CompiledCache();
    await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "A" } }) },
      { compiledCache: cache },
    );
    expect(cache.size()).toBe(1);
    await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "B" } }) },
      { compiledCache: cache },
    );
    expect(cache.size()).toBe(1);
  });

  it("always stamps evaluated_at as a valid ISO-8601 timestamp", async () => {
    const result = await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "X" } }) },
      { compiledCache: new CompiledCache() },
    );
    expect(() => new Date(result.evaluated_at).toISOString()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the tests, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/run-single-gate.test.ts`
Expected: FAIL — `../run-single-gate.js` not found.

- [ ] **Step 4: Create `packages/gate-runner/src/run-single-gate.ts`**

```typescript
import ivm from "isolated-vm";
import {
  GATE_ERROR_CODES,
  gateOutputSchema,
  type GateOutput,
} from "@mnm/governed-workflows";
import { compileGateSource } from "./compile-gate.js";
import { CompiledCache } from "./compiled-cache.js";
import { classifyIsolateError } from "./classify-isolate-error.js";
import type {
  GateEvaluationResult,
  RunnerOptions,
  RunSingleGateArgs,
} from "./types.js";

/**
 * Dependencies injected into `runSingleGate`. Exposing them this way keeps
 * the function testable (fresh `CompiledCache` per test) and lets T5 / T6
 * wire in process-wide singletons without changing the signature.
 */
export interface RunSingleGateDeps {
  compiledCache: CompiledCache;
  options?: RunnerOptions;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_RETRY_ON_SANDBOX_CRASH = true;

/**
 * Evaluate a single gate inside an `isolated-vm` isolate.
 *
 * Flow:
 *   1. Cache lookup (compiledCache) by (gitSha, gateSourcePath). Miss →
 *      `compileGateSource`.
 *   2. Spawn a fresh `ivm.Isolate` with the configured memory limit.
 *   3. Install a `globalThis.require` shim that maps
 *      `"@mnm/governed-workflows"` to a minimal `{ defineGate: fn => fn }`.
 *      Any other require target throws to surface misuse.
 *   4. Install `globalThis.module = { exports: {} }` + alias `exports`.
 *   5. Eval the compiled JS inside the isolate — populates
 *      `module.exports.default` with the gate function.
 *   6. Invoke `module.exports.default(ctx)` with the configured timeout.
 *   7. Parse the return value against `gateOutputSchema`.
 *   8. Always dispose the isolate in a finally block.
 *
 * Error → `GateErrorCode` mapping:
 *   - compile throws            → GATE_EXCEPTION (esbuild failure)
 *   - isolate init throws       → GATE_SANDBOX_CRASH
 *   - invoke timeout            → GATE_TIMEOUT (via classifyIsolateError)
 *   - invoke throws user-code   → GATE_EXCEPTION
 *   - invoke disposes isolate   → GATE_SANDBOX_CRASH (retry once, see below)
 *   - return schema-invalid     → GATE_INVALID_OUTPUT
 *
 * Retry semantics: if `retryOnSandboxCrash` is true (default), a single
 * `GATE_SANDBOX_CRASH` is retried once with a brand-new isolate. A second
 * crash surfaces as the final result — fail-closed.
 */
export async function runSingleGate(
  args: RunSingleGateArgs,
  deps: RunSingleGateDeps,
): Promise<GateEvaluationResult> {
  const timeoutMs = deps.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const memoryLimitMb = deps.options?.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const retryOnSandboxCrash =
    deps.options?.retryOnSandboxCrash ?? DEFAULT_RETRY_ON_SANDBOX_CRASH;

  const started = Date.now();
  const jsCode = await resolveCompiledJs(args, deps.compiledCache);

  let attempt = await attemptEval(jsCode, args, { timeoutMs, memoryLimitMb });
  if (
    !attempt.pass &&
    attempt.error_code === GATE_ERROR_CODES.GATE_SANDBOX_CRASH &&
    retryOnSandboxCrash
  ) {
    attempt = await attemptEval(jsCode, args, { timeoutMs, memoryLimitMb });
  }

  return stampResult(args, attempt, started);
}

async function resolveCompiledJs(
  args: RunSingleGateArgs,
  cache: CompiledCache,
): Promise<string> {
  const cached = cache.get(args.gitSha, args.gateSourcePath);
  if (cached !== undefined) return cached;
  const { jsCode } = await compileGateSource(args.source, args.gateSourcePath);
  cache.set(args.gitSha, args.gateSourcePath, jsCode);
  return jsCode;
}

interface AttemptResult {
  pass: boolean;
  report: string;
  error_code?: string;
  hints?: string[];
}

async function attemptEval(
  jsCode: string,
  args: RunSingleGateArgs,
  limits: { timeoutMs: number; memoryLimitMb: number },
): Promise<AttemptResult> {
  let isolate: ivm.Isolate | undefined;
  try {
    isolate = new ivm.Isolate({ memoryLimit: limits.memoryLimitMb });
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Bootstrap: stub require() + module/exports so the CJS bundle from
    // esbuild can install its default export on module.exports.default.
    const bootstrap = `
      globalThis.module = { exports: {} };
      globalThis.exports = globalThis.module.exports;
      globalThis.require = function (id) {
        if (id === "@mnm/governed-workflows") {
          return { defineGate: function (fn) { return fn; } };
        }
        throw new Error("require() not available in gate sandbox: " + id);
      };
    `;
    await (await isolate.compileScript(bootstrap)).run(context);

    // Evaluate the gate body. This populates module.exports.default.
    await (await isolate.compileScript(jsCode, {
      filename: args.gateSourcePath,
    })).run(context);

    // Invoker: pulls the default export, calls it with the supplied ctx,
    // and stringifies the return so we can copy it across the isolate
    // boundary without wrapping every nested value.
    const invokerSource = `
      globalThis.__invoke = async function (ctxJson) {
        const ctx = JSON.parse(ctxJson);
        const fn = globalThis.module && globalThis.module.exports && globalThis.module.exports.default;
        if (typeof fn !== "function") {
          throw new Error("gate source did not set module.exports.default to a function");
        }
        const result = await fn(ctx);
        return JSON.stringify(result === undefined ? null : result);
      };
    `;
    await (await isolate.compileScript(invokerSource)).run(context);

    const invoke = await jail.get("__invoke", { reference: true });
    const ctxJson = JSON.stringify(serializableContext(args));
    const returnedJson = (await invoke.apply(null, [ctxJson], {
      result: { promise: true, copy: true },
      timeout: limits.timeoutMs,
    })) as string;

    return validateOutput(returnedJson);
  } catch (cause) {
    const { errorCode, report } = classifyIsolateError(cause);
    return { pass: false, report, error_code: errorCode };
  } finally {
    if (isolate && !isolate.isDisposed) {
      try {
        isolate.dispose();
      } catch {
        // Already disposed by the runtime; swallow — any such error is
        // already captured by the catch above or is benign.
      }
    }
  }
}

function validateOutput(returnedJson: string): AttemptResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(returnedJson);
  } catch (cause) {
    return {
      pass: false,
      report: `Gate return could not be parsed as JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      error_code: GATE_ERROR_CODES.GATE_INVALID_OUTPUT,
    };
  }
  const schemaResult = gateOutputSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return {
      pass: false,
      report: `Gate output did not match schema: ${schemaResult.error.issues
        .map((i) => i.message)
        .join("; ")}`,
      error_code: GATE_ERROR_CODES.GATE_INVALID_OUTPUT,
    };
  }
  const out: GateOutput = schemaResult.data;
  return {
    pass: out.pass,
    report: out.report,
    error_code: out.error_code,
    hints: out.hints,
  };
}

function serializableContext(args: RunSingleGateArgs): unknown {
  // Strip non-serializable surfaces. `helpers` is `{}` in MVP (see
  // plan Task 4 + spec §6). Keep the same shape as GateContext so author
  // code reads identical properties.
  return {
    artifact: args.context.artifact,
    run: args.context.run,
    step: args.context.step,
    config: args.context.config,
    kind: args.kind,
    helpers: {},
  };
}

function stampResult(
  args: RunSingleGateArgs,
  attempt: AttemptResult,
  startedEpochMs: number,
): GateEvaluationResult {
  const evaluated_at = new Date().toISOString();
  const duration_ms = Date.now() - startedEpochMs;
  return {
    gate_id_in_json: args.gateItem.id,
    gate_git_sha: args.gitSha,
    gate_source_path: args.gateSourcePath,
    kind: args.kind,
    pass: attempt.pass,
    report: attempt.report,
    ...(attempt.error_code !== undefined ? { error_code: attempt.error_code } : {}),
    ...(attempt.hints !== undefined ? { hints: attempt.hints } : {}),
    evaluated_at,
    duration_ms,
  };
}
```

- [ ] **Step 5: Run the tests, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/run-single-gate.test.ts`
Expected: 11 passing. The `infinite loop → GATE_TIMEOUT` test has a 10 s per-test timeout so it has room to land the 300 ms timeout.

- [ ] **Step 6: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 7: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 8: Commit + push**

```bash
git add packages/gate-runner/src/run-single-gate.ts packages/gate-runner/src/__tests__/run-single-gate.test.ts packages/gate-runner/src/__tests__/fixtures/gate-sources.ts
git commit -m "feat(workflows): runSingleGate with isolated-vm sandbox + retry-once policy"
git push
```

---

## Task 9: `runGateBlock` — sequential + parallel composition

**Files:**
- Create: `packages/gate-runner/src/run-gate-block.ts`
- Create: `packages/gate-runner/src/__tests__/run-gate-block.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/gate-runner/src/__tests__/run-gate-block.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { GateBlock, GateContext } from "@mnm/governed-workflows";
import { runGateBlock } from "../run-gate-block.js";
import { CompiledCache } from "../compiled-cache.js";
import {
  PASSING,
  FAILING,
  THROWING,
} from "./fixtures/gate-sources.js";

function ctx(): GateContext {
  return {
    artifact: { greeting: "Hi" },
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: {} },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
  };
}

function resolverFor(map: Record<string, string>) {
  return async (itemSource: string) => ({
    source: map[itemSource] ?? (() => { throw new Error("unknown source: " + itemSource); })(),
    gateSourcePath: itemSource.replace(/^\.\//, "hello-world/"),
  });
}

const BASE = { kind: "exit" as const, gitSha: "deadbeef" };

describe("runGateBlock", () => {
  it("returns pass:true + empty results for an empty block", async () => {
    const result = await runGateBlock(
      { block: [], context: ctx(), resolveSource: async () => { throw new Error("unreached"); }, ...BASE },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toEqual([]);
  });

  it("evaluates a single sequential gate", async () => {
    const block: GateBlock = [{ id: "g1", source: "./gates/pass.gate.ts" }];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/pass.gate.ts": PASSING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(1);
    expect(result.gate_results[0]?.gate_id_in_json).toBe("g1");
  });

  it("short-circuits sequential evaluation on the first failure", async () => {
    const block: GateBlock = [
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/fail.gate.ts" },
      { id: "g3", source: "./gates/pass.gate.ts" },
    ];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results[1]?.pass).toBe(false);
  });

  it("runs an inner array in parallel and succeeds when all pass", async () => {
    const block: GateBlock = [[
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/pass.gate.ts" },
    ]];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/pass.gate.ts": PASSING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(2);
  });

  it("fails fast when any parallel gate fails; still records all settled gates", async () => {
    const block: GateBlock = [[
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/fail.gate.ts" },
    ]];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results.some((r) => r.pass === false)).toBe(true);
  });

  it("mixes sequential and parallel entries, short-circuits after the failing group", async () => {
    const block: GateBlock = [
      [
        { id: "p1", source: "./gates/pass.gate.ts" },
        { id: "p2", source: "./gates/pass.gate.ts" },
      ],
      { id: "s1", source: "./gates/fail.gate.ts" },
      { id: "s2", source: "./gates/pass.gate.ts" },
    ];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results.map((r) => r.gate_id_in_json)).toEqual(["p1", "p2", "s1"]);
  });

  it("classifies a throwing gate without aborting the whole block computation", async () => {
    const block: GateBlock = [{ id: "g1", source: "./gates/throw.gate.ts" }];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/throw.gate.ts": THROWING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results[0]?.error_code).toBe("GATE_EXCEPTION");
  });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `bunx vitest run packages/gate-runner/src/__tests__/run-gate-block.test.ts`
Expected: FAIL — `../run-gate-block.js` not found.

- [ ] **Step 3: Create `packages/gate-runner/src/run-gate-block.ts`**

```typescript
import type { GateItem } from "@mnm/governed-workflows";
import { runSingleGate, type RunSingleGateDeps } from "./run-single-gate.js";
import type {
  GateBlockResult,
  GateEvaluationResult,
  RunGateBlockArgs,
} from "./types.js";

/**
 * Execute a `GateBlock` — the nested-array composition declared in
 * workflow.json under `gates.entry` / `gates.exit`.
 *
 *   - Outer array entries run **sequentially** and short-circuit on the
 *     first failing result.
 *   - Inner arrays (one level deep, guaranteed by `gateBlockSchema`) run
 *     **in parallel** via `Promise.all`. All parallel gates are awaited to
 *     settlement even when one fails early, so every invocation is recorded
 *     in `gate_results`. The block is marked `pass:false` as soon as any
 *     inner gate reports `pass:false`.
 *
 * The runner is `kind`-agnostic — the same function handles `entry`,
 * `exit`, and any future lifecycle hook. Adding a new kind = one new call
 * site in the orchestrator (T5), zero change here.
 */
export async function runGateBlock(
  args: RunGateBlockArgs,
  deps: RunSingleGateDeps,
): Promise<GateBlockResult> {
  const collected: GateEvaluationResult[] = [];

  for (const entry of args.block) {
    if (Array.isArray(entry)) {
      const results = await Promise.all(
        entry.map((item) => evalOne(item, args, deps)),
      );
      collected.push(...results);
      if (results.some((r) => !r.pass)) {
        return { pass: false, gate_results: collected };
      }
    } else {
      const r = await evalOne(entry, args, deps);
      collected.push(r);
      if (!r.pass) return { pass: false, gate_results: collected };
    }
  }
  return { pass: true, gate_results: collected };
}

async function evalOne(
  item: GateItem,
  args: RunGateBlockArgs,
  deps: RunSingleGateDeps,
): Promise<GateEvaluationResult> {
  const { source, gateSourcePath } = await args.resolveSource(item.source);
  return runSingleGate(
    {
      gateItem: item,
      source,
      gateSourcePath,
      gitSha: args.gitSha,
      kind: args.kind,
      context: {
        ...args.context,
        config: (item.config ?? {}) as Record<string, unknown>,
        kind: args.kind,
      },
    },
    deps,
  );
}
```

- [ ] **Step 4: Run the tests, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/run-gate-block.test.ts`
Expected: 7 passing.

- [ ] **Step 5: Typecheck**

Run: `bun run --filter @mnm/gate-runner typecheck`
Expected: no output.

- [ ] **Step 6: Halfway check-in**

Send `SendMessage`: `"files written, tests + typecheck green"`.

- [ ] **Step 7: Commit + push**

```bash
git add packages/gate-runner/src/run-gate-block.ts packages/gate-runner/src/__tests__/run-gate-block.test.ts
git commit -m "feat(workflows): runGateBlock composes gates sequentially + in parallel"
git push
```

---

## Task 10: End-to-end integration — real `.gate.ts` + non-empty config (T1 follow-up #3)

This suite is the signal that T4 actually works end-to-end, and it is the third T1 Important follow-up delivered.

**Files:**
- Create: `packages/gate-runner/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write the integration suite**

Create `packages/gate-runner/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { GateBlock, GateContext } from "@mnm/governed-workflows";
import { runGateBlock } from "../run-gate-block.js";
import { runSingleGate } from "../run-single-gate.js";
import { CompiledCache } from "../compiled-cache.js";

/**
 * Gate source written exactly as a real .gate.ts in a workflow repo would
 * be — import from the bare specifier, use GateContext types at author time,
 * return the gateOutputSchema-compatible shape.
 */
const HAS_FIELD_GATE = `
import { defineGate } from "@mnm/governed-workflows";
import type { GateContext } from "@mnm/governed-workflows";

export default defineGate<
  Record<string, unknown>,
  { field: string; type: "string" | "number" }
>(async (ctx: GateContext<Record<string, unknown>, { field: string; type: "string" | "number" }>) => {
  const artifact = ctx.artifact;
  if (!artifact || typeof artifact !== "object") {
    return { pass: false, report: "artifact missing", error_code: "NO_ARTIFACT" };
  }
  const value = (artifact as Record<string, unknown>)[ctx.config.field];
  if (ctx.config.type === "string" && typeof value !== "string") {
    return {
      pass: false,
      report: "field " + ctx.config.field + " is not a string",
      error_code: "FIELD_TYPE_MISMATCH",
      hints: ["Return " + ctx.config.field + " as a string"],
    };
  }
  if (ctx.config.type === "number" && typeof value !== "number") {
    return {
      pass: false,
      report: "field " + ctx.config.field + " is not a number",
      error_code: "FIELD_TYPE_MISMATCH",
    };
  }
  return { pass: true, report: "field " + ctx.config.field + " ok" };
});
`;

function baseCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: { name: "the maintainer" } },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

describe("gate-runner integration", () => {
  it("runs a config-parameterised gate end-to-end (T1 follow-up #3)", async () => {
    const result = await runSingleGate(
      {
        gateItem: { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
        source: HAS_FIELD_GATE,
        gateSourcePath: "hello-world/gates/has-field.gate.ts",
        gitSha: "deadbeef",
        kind: "exit",
        context: baseCtx({
          artifact: { greeting: "Hello, the maintainer!" },
          config: { field: "greeting", type: "string" },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("field greeting ok");
  });

  it("returns a structured FIELD_TYPE_MISMATCH when config contract is violated", async () => {
    const result = await runSingleGate(
      {
        gateItem: { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
        source: HAS_FIELD_GATE,
        gateSourcePath: "hello-world/gates/has-field.gate.ts",
        gitSha: "deadbeef",
        kind: "exit",
        context: baseCtx({
          artifact: { greeting: 42 },
          config: { field: "greeting", type: "string" },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("FIELD_TYPE_MISMATCH");
    expect(result.hints).toEqual(["Return greeting as a string"]);
  });

  it("drives the hello-world greet-exit scenario through runGateBlock with two parallel gates", async () => {
    const block: GateBlock = [[
      { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
      { id: "has-greeting-again", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
    ]];
    const result = await runGateBlock(
      {
        block,
        kind: "exit",
        gitSha: "deadbeef",
        context: baseCtx({ artifact: { greeting: "Hi" } }),
        resolveSource: async (sourcePath: string) => ({
          source: HAS_FIELD_GATE,
          gateSourcePath: "hello-world/" + sourcePath.replace(/^\.\//, ""),
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results.every((r) => r.pass)).toBe(true);
    expect(result.gate_results[0]?.kind).toBe("exit");
  });
});
```

- [ ] **Step 2: Run the suite, expect PASS**

Run: `bunx vitest run packages/gate-runner/src/__tests__/integration.test.ts`
Expected: 3 passing.

- [ ] **Step 3: Run the full gate-runner test suite**

Run: `bunx vitest run packages/gate-runner`
Expected: all suites green — scaffold (2) + types (5) + compiled-cache (8) + compile-gate (4) + classify-isolate-error (6) + run-single-gate (11) + run-gate-block (7) + integration (3) = 46 passing.

- [ ] **Step 4: Halfway check-in**

Send `SendMessage`: `"integration suite green, full runner suite 46/46"`.

- [ ] **Step 5: Commit + push**

```bash
git add packages/gate-runner/src/__tests__/integration.test.ts
git commit -m "test(workflows): gate-runner end-to-end with config-parameterised gate"
git push
```

---

## Task 11: Barrel export + workspace-wide typecheck

**Files:**
- Modify: `packages/gate-runner/src/index.ts`

- [ ] **Step 1: Replace the empty barrel with the full export surface**

Edit `packages/gate-runner/src/index.ts`:

```typescript
export type {
  GateEvaluationResult,
  GateBlockResult,
  RunnerOptions,
  RunSingleGateArgs,
  RunGateBlockArgs,
} from "./types.js";

export { CompiledCache, type CompiledCacheOptions } from "./compiled-cache.js";
export { compileGateSource, type CompileGateResult } from "./compile-gate.js";
export {
  classifyIsolateError,
  type ClassifiedIsolateError,
} from "./classify-isolate-error.js";
export { runSingleGate, type RunSingleGateDeps } from "./run-single-gate.js";
export { runGateBlock } from "./run-gate-block.js";
```

- [ ] **Step 2: Run the full package test suite**

Run: `bunx vitest run packages/gate-runner`
Expected: 46 passing (scaffold test still validates the barrel is importable).

- [ ] **Step 3: Typecheck the whole monorepo**

Run: `bun run typecheck`
Expected: every package green, including `@mnm/gate-runner`. Same count as the current T3-ship baseline + 1 new package.

- [ ] **Step 4: Halfway check-in**

Send `SendMessage`: `"barrel wired, 46 tests green, monorepo typecheck green"`.

- [ ] **Step 5: Commit + push**

```bash
git add packages/gate-runner/src/index.ts
git commit -m "feat(workflows): export @mnm/gate-runner public barrel"
git push
```

---

## Task 12: Spec §7 status update + T5 next-session prompt

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` (T4 row in the status table)
- Modify: `docs/superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md` (append completion report — the implementer writes this from memory of the session)
- Create: `docs/superpowers/plans/next-session-T5-prompt.md`

- [ ] **Step 1: Update the T4 row in spec §7**

In `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`, locate the tranche table (`| # | Statut | Tranche | Livre | Test de validation |`) and replace the `T4` row with:

```markdown
| **T4** | ✅ shipped 2026-04-21 (commit range from `git log`, see plan completion report) | Gate runner générique (`@mnm/gate-runner` — isolated-vm + esbuild + `runGateBlock(block, ctx, kind)` agnostique au kind + `CompiledCache` RAM par sha + fail-closed errors + retry-once sur sandbox crash). Inclut les 3 T1 follow-ups: `.strict()` sur gateOutputSchema, JSDoc disambiguation GATE_* vs WORKFLOW_*, integration test config non-vide. | Eval un `GateBlock` nested-array | 46/46 vitest green (scaffold + types + compiled-cache + compile-gate + classify-isolate-error + run-single-gate + run-gate-block + integration). Monorepo typecheck green. |
```

(Commit range will be filled in after all T4 commits land — leave as written in the completion-report template and the implementer replaces it in the final commit of this task.)

- [ ] **Step 2: Append a completion report to the plan file**

Append the following template to the **end** of `docs/superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md`. Fill in the bracketed fields during / after execution from the actual session:

```markdown
---

## Completion report (filled in when T4 ships)

**Shipped:** 2026-04-21
**Commit range:** `<first>..<last>`
**Commits:** <N>

### What landed

- New workspace `@mnm/gate-runner` (runtime deps: `isolated-vm`, `esbuild`, `zod` via governed-workflows).
- `runSingleGate` — isolated-vm harness (5 s timeout, 256 MB memory, retry-once on GATE_SANDBOX_CRASH).
- `runGateBlock` — kind-agnostic composition: sequential outer + parallel inner with fail-fast.
- `compileGateSource` (esbuild.transform) + `CompiledCache` (RAM-only, FIFO, 500 entries).
- `classifyIsolateError` — deterministic mapping to GATE_* error codes.
- T1 follow-ups #1/#2/#3 delivered: strict gateOutputSchema, JSDoc disambiguation, non-empty-config integration test.

### Deferred follow-ups (flagged for T5+)

- <list each deferred item with one-line rationale>

### Process lessons (append to the T5 next-session prompt)

- <short punch list of what worked / didn't>
```

- [ ] **Step 3: Create the T5 next-session prompt**

Create `docs/superpowers/plans/next-session-T5-prompt.md`:

```markdown
# Next-session prompt — T5 (MCP tools)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T5.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\path\to\mnm` (branch master).

Statut :
- T1 shipped (package `@mnm/governed-workflows`).
- T2 shipped (migrations DB).
- T3 shipped (package `@mnm/git-provider`).
- T4 shipped (package `@mnm/gate-runner` — isolated-vm + esbuild + runGateBlock).
- T5 pending ← cette session.

# Scope T5 (spec §4)

Les 7 primitives MCP : `listWorkflows`, `getWorkflow`, `getWorkflowState`, `launchWorkflow`, `launchStep`, `completeStep`, `syncEnvironment`. Orchestrateur wire-up :
- DB writes (via Drizzle + migrations 0055-0058 déjà en place T2)
- Chargement source workflow.json + gates via `GitProvider` + `ShaCache` (T3)
- Appel `runGateBlock` pour entry/exit gates (T4)
- Définition de `GateContext.helpers.queryTraces` + `checkWorkflowExists` réels (stubs en T4)

# Docs à lire

1. Spec §4 (MCP tools) + §2 (data model) + §6 (gate runner flow).
2. Plan T4 (completion report pour les follow-ups différés).
3. Plan T3 (GitProvider API — `fetchBlob`, `listTags`, `resolveRef`, `pathExists`, `commitFile`).

# Leçons process à continuer d'appliquer

- Halfway check-in obligatoire avant commit
- JSON task_assignment ≠ brief authorization
- Plan comments are contract
- Option A (one-shot subagents) recommandé

Dis-moi et on y va.
```

- [ ] **Step 4: Commit + push**

```bash
git add docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md docs/superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md docs/superpowers/plans/next-session-T5-prompt.md
git commit -m "docs(workflows): T4 completion report + spec status + T5 next-session prompt"
git push
```

---

## Self-review notes (team-lead, pre-execution)

Checked against spec §6 + §7 + T1 plan completion report + T3 plan completion report + Pre-flight probes.

**Spec coverage:**
- §6 "Stack" (isolated-vm, esbuild, cache by sha) → Tasks 1 (install) + 5 (cache) + 6 (compile) + 8 (isolate).
- §6 "Flow d'éval" (8 steps) → Task 8 bootstrap + invoker + timeout + validation.
- §6 "Runner générique — runGateBlock" → Task 9 (`kind` is an opaque string throughout).
- §6 "Contexte exposé" → Task 8 `serializableContext` + Task 4 type. `helpers = {}` in MVP per deviation table.
- §6 "Limites sandbox" (timeout, memory, 0 fetch, 0 FS, no dynamic require) → Task 8 `require` shim + limits. Network and FS are 0 by construction: isolated-vm does not expose `fetch` / `fs`.
- §6 "Erreurs — fail-closed" (4 codes + retry-once) → Task 7 classifier + Task 8 retry.
- §7 T4 row "Fake gates : pass, fail, throw, infinite-loop, invalid output, composition parallel/sequential, DAG interne" → Task 8 (single-gate) + Task 9 (composition) + Task 10 (integration).

**Placeholder scan:** no TBDs, no "similar to task N" — every code block is self-contained.

**Type consistency:** `GateEvaluationResult` shape is stable across Tasks 4, 8, 9, 10. `RunSingleGateDeps` named the same way everywhere. `kind` is always `string` (never a specific union) — critical for the "kind-agnostic" contract.

**Placeholder scan for common AI drift patterns:** no "TODO", "TBD", "implement later", or "add error handling appropriately" anywhere.

Plan is ready for execution.

---

## Completion report (filled in when T4 ships)

**Shipped:** 2026-04-21
**Commit range:** `7dec547..49d426f`
**Commits:** 13

### What landed

- New workspace `@mnm/gate-runner` (runtime deps: `isolated-vm`, `esbuild`, `zod` via governed-workflows).
- `runSingleGate` — isolated-vm harness (5 s timeout, 256 MB memory, retry-once on GATE_SANDBOX_CRASH).
- `runGateBlock` — kind-agnostic composition: sequential outer + parallel inner with fail-fast.
- `compileGateSource` (esbuild.transform) + `CompiledCache` (RAM-only, FIFO, 500 entries).
- `classifyIsolateError` — deterministic mapping to GATE_* error codes.
- T1 follow-ups #1/#2/#3 delivered: strict gateOutputSchema, JSDoc disambiguation, non-empty-config integration test.
- `attemptEval` test-only dep seam added post-review (commit `1f5c456`) — 3 retry-branch tests (success / both-crash / no-retry-on-timeout) lock in the retry-once discriminator without relying on real memory-limit breaches.
- Public barrel export + monorepo-wide typecheck green (13/13 packages).
- 50/50 vitest green across 8 test files (scaffold, types, compiled-cache, compile-gate, classify-isolate-error, run-single-gate, run-gate-block, integration).

### Deferred follow-ups (flagged for T5+)

- **T4.4 code-rev minors (4)**: narrow `kind` from `string` to a lifecycle union; type `error_code` as `GateErrorCode | string`; cross-reference JSDoc on `gate_source_path` vs `GateItem.source`; strengthen multi-entry `GateBlockResult` test. All IDE/polish; no behavioural impact.
- **T4.8 patch-seam minor**: add an inline comment explaining the `jail.set("global", jail.derefInto())` rationale (stylistic). Fixture file doc-comment tightening (stylistic).
- **T4.9 code-rev minors (3)**: (a) redundant `as Record<string, unknown>` cast in `run-gate-block.ts:63` — typecheck was green with it, may be a generics edge case, leave unless a future touch of the file surfaces it; (b) `resolverFor` throwing IIFE style in the test helper (stylistic); (c) block-level config override test — **satisfied implicitly by T4.10 integration per code-rev's T4.10 review — CLOSED, not deferred.**
- **Node engines mismatch**: root `package.json` declares `"node": ">=20"` but `isolated-vm@6.x` requires `>=22`. Coordinate in T5 — either bump root engines to `>=22` or pin `isolated-vm` to `v4.x`.
- **`@mnm/git-provider` type-only dep**: declared in `packages/gate-runner/package.json` dependencies but not imported by any gate-runner source yet. Wire-up lands in T5 when the MCP orchestrator adds the source-fetching pipeline via `GitProvider.fetchBlob` + `ShaCache`.

### Process lessons (append to the T5 next-session prompt)

- **Team persistence worked**: 5 teammates in parallel, 13 commits shipped in ~25 min wall-clock.
- **Silent-stall still observed early** in the session: impl-1 stalled on the first T4.1 brief; impl-2 and impl-3 stalled on their Wave 1 briefs. Each resolved by a nudge from team-lead. Pattern: the first brief per session tends to stall; follow-ups land smoothly once the rhythm is set.
- **Messages-cross-in-flight is routine** — observed on every ship (implementer resends status after team-lead's next brief crosses the wire). Harmless, but surfaces the need for idempotent "ship" notifications.
- **Halfway check-ins held across all substantive tasks** — 0 stalls detected *at* halfway, but the visibility gave team-lead fast feedback on errors (e.g. `cpu-features` optional-dep noise in T4.1, red-step weakness on type-only tests in T4.4, rebase-on-push in T4.5).
- **Plan comment fidelity was perfect** — 0 stripped JSDoc blocks across 13 commits. Standing order "plan comments are contract" front-loaded in every brief worked.
- **Code-rev caught one legitimate plan gap**: the retry-once policy was named in the `runSingleGate` JSDoc but had zero test coverage in the plan's 11-test suite. Retroactively fixed via `1f5c456` with a test-only dep seam (`RunSingleGateDeps.attemptEval`). **Pattern for future plans**: explicitly list every conditional branch that deserves test coverage, not just the happy paths.
- **Plan had 2 stale refs**: JSDoc mentioned `isolated-vm 5.x` when the actual install is `6.1.2` (fixed in `50cbf1d`); root `vitest.config.ts` projects-list edit required but not mentioned in Task 1 (impl-1 applied it during T4.1). Pre-flight probes caught the API shape + isolated-vm error strings but missed the version string — add "verify version strings in inline docs match `package.json`" to the plan-author checklist for next session.
- **Parallelism payoff was real**: Waves 2 (Tasks 5/6/7 in parallel) and Wave 3 (Task 8 solo while 2/3 stayed idle) mapped cleanly onto the task dependency graph. No merge conflicts across the whole session — each implementer's first push landed via fast-forward; one push collision (impl-1 T4.5 vs impl-2 T4.6) resolved with `git pull --rebase origin master`, no force-push.
