# Governed Workflows — T1 Package `@mnm/governed-workflows` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the shared TypeScript package `@mnm/governed-workflows` that exposes the types, zod schemas, and authoring helpers used by every other tranche (DB, gate runner, MCP tools, hello-world repos).

**Architecture:** Pure TypeScript + zod, no runtime dependencies on the MnM server. The package is a source-only workspace (same pattern as `@mnm/shared`): `exports` points at `src/*.ts` for dev, `dist/*.js` for publish. All gates/workflows JSON validation lives here so the server, the MCP tools, and the user-land workflow repos share one source of truth. Types are framework-agnostic and can be consumed by the server (isolated-vm runner), by tests, and by the gate authors writing `.gate.ts` files in workflow repos.

**Tech Stack:** TypeScript 5.7 (strict, ESM NodeNext), zod 3.24, vitest 3, bun workspaces.

**Source spec:** `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` (sections 3, 6, 7 — T1 row).

**Scope of T1:** Only the package. No DB, no sandbox, no MCP wiring. Everything here is pure data modelling + type helpers. T1 is independent of T2 (DB) and T3 (git provider) — they can be built in parallel.

---

## File Structure

All new files live under `packages/governed-workflows/`. Root `vitest.config.ts` gets one line modified.

| File | Responsibility |
|---|---|
| `packages/governed-workflows/package.json` | Workspace manifest. Name `@mnm/governed-workflows`, zod dep, vitest scripts. |
| `packages/governed-workflows/tsconfig.json` | Extends root tsconfig, outputs to `dist/`. |
| `packages/governed-workflows/vitest.config.ts` | Node env, picks up `src/**/*.test.ts`. |
| `packages/governed-workflows/src/index.ts` | Public barrel — single entry point for consumers. |
| `packages/governed-workflows/src/errors.ts` | Frozen error code constants (gate + workflow). |
| `packages/governed-workflows/src/errors.test.ts` | Sanity test of exported code tables. |
| `packages/governed-workflows/src/gate-output.ts` | Zod schema + inferred type for a gate's return verdict. |
| `packages/governed-workflows/src/gate-output.test.ts` | Valid/invalid cases. |
| `packages/governed-workflows/src/gate-item.ts` | Zod schema + type for a single gate declaration in workflow.json. |
| `packages/governed-workflows/src/gate-item.test.ts` | Valid/invalid cases incl. `config` payload. |
| `packages/governed-workflows/src/gate-block.ts` | Nested-array schema: `Array<GateItem \| GateItem[]>`. |
| `packages/governed-workflows/src/gate-block.test.ts` | Sequential, parallel, mixed, reject-nested-of-nested, reject-empty-parallel. |
| `packages/governed-workflows/src/gate-context.ts` | Runtime context interface injected by the sandbox. Type-only. |
| `packages/governed-workflows/src/define-gate.ts` | `defineGate<Artifact, Config>()` identity helper with type inference. |
| `packages/governed-workflows/src/define-gate.test.ts` | Identity, sync, async, typed artifact + config. |
| `packages/governed-workflows/src/workflow-step.ts` | Zod schema + type for a single step in workflow.json. |
| `packages/governed-workflows/src/workflow-step.test.ts` | Defaults, gates presence, unknown-kind extensibility, required fields. |
| `packages/governed-workflows/src/workflow.ts` | Zod schema for the full workflow document incl. cross-step `superRefine` (duplicate ids, unknown deps). |
| `packages/governed-workflows/src/workflow.test.ts` | Minimal parse, duplicate id, unknown dep, apiVersion mismatch. |
| `packages/governed-workflows/src/define-workflow.ts` | `defineWorkflow()` helper: parses + returns typed result. |
| `packages/governed-workflows/src/define-workflow.test.ts` | Success case, rejection case. |
| `packages/governed-workflows/src/__fixtures__/hello-world.workflow.json` | The hello-world JSON verbatim from the spec (used in integration test). |
| `packages/governed-workflows/src/integration.test.ts` | Parse the hello-world fixture end-to-end. |
| `vitest.config.ts` (modify) | Register new workspace in `test.projects`. |

---

## Task 1: Package skeleton

**Files:**
- Create: `packages/governed-workflows/package.json`
- Create: `packages/governed-workflows/tsconfig.json`
- Create: `packages/governed-workflows/vitest.config.ts`
- Create: `packages/governed-workflows/src/index.ts`
- Modify: `vitest.config.ts` (root) — add `"packages/governed-workflows"` to `test.projects`

- [ ] **Step 1: Write the package manifest**

Create `packages/governed-workflows/package.json`:

```json
{
  "name": "@mnm/governed-workflows",
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
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Write the tsconfig**

Create `packages/governed-workflows/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the vitest config**

Create `packages/governed-workflows/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write an empty barrel**

Create `packages/governed-workflows/src/index.ts`:

```typescript
// Public barrel — populated in later tasks.
export {};
```

- [ ] **Step 5: Register the workspace in the root vitest config**

Edit `vitest.config.ts` (at repo root). Current content:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/db", "packages/adapters/opencode-local", "server", "ui", "cli"],
  },
});
```

Change to:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/governed-workflows",
      "packages/adapters/opencode-local",
      "server",
      "ui",
      "cli",
    ],
  },
});
```

- [ ] **Step 6: Install dependencies**

Run: `bun install`
Expected: bun picks up the new workspace, installs zod + typescript + vitest locally inside the new package (or hoists them). No errors.

- [ ] **Step 7: Verify typecheck passes on an empty package**

Run: `bun run --cwd packages/governed-workflows typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 8: Verify vitest picks up the new project**

Run: `bun run --cwd packages/governed-workflows test`
Expected: vitest runs, reports 0 test files (no tests yet), exits 0.

- [ ] **Step 9: Commit**

```bash
git add packages/governed-workflows vitest.config.ts
git commit -m "$(cat <<'EOF'
chore(workflows): bootstrap @mnm/governed-workflows package

T1 scaffolding — package.json, tsconfig, vitest config, empty barrel.
Registered in root vitest projects so `bun run test` picks it up.
EOF
)"
```

---

## Task 2: Error code constants

**Files:**
- Create: `packages/governed-workflows/src/errors.ts`
- Test: `packages/governed-workflows/src/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/errors.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { GATE_ERROR_CODES, WORKFLOW_ERROR_CODES } from "./errors.js";

describe("GATE_ERROR_CODES", () => {
  it("exposes the MVP gate error codes", () => {
    expect(GATE_ERROR_CODES).toEqual({
      GATE_TIMEOUT: "GATE_TIMEOUT",
      GATE_EXCEPTION: "GATE_EXCEPTION",
      GATE_INVALID_OUTPUT: "GATE_INVALID_OUTPUT",
      GATE_SANDBOX_CRASH: "GATE_SANDBOX_CRASH",
    });
  });

  it("is frozen at runtime", () => {
    expect(Object.isFrozen(GATE_ERROR_CODES)).toBe(true);
  });
});

describe("WORKFLOW_ERROR_CODES", () => {
  it("exposes the MVP workflow error codes", () => {
    expect(WORKFLOW_ERROR_CODES).toEqual({
      WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
      WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
      WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
      WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
      WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
    });
  });

  it("is frozen at runtime", () => {
    expect(Object.isFrozen(WORKFLOW_ERROR_CODES)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test errors`
Expected: FAIL — `Cannot find module './errors.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/errors.ts`:

```typescript
/**
 * Uniform error codes returned by the gate runner (server-side).
 * Exposed via gate_results.error_code in DB and in MCP error payloads.
 */
export const GATE_ERROR_CODES = Object.freeze({
  GATE_TIMEOUT: "GATE_TIMEOUT",
  GATE_EXCEPTION: "GATE_EXCEPTION",
  GATE_INVALID_OUTPUT: "GATE_INVALID_OUTPUT",
  GATE_SANDBOX_CRASH: "GATE_SANDBOX_CRASH",
} as const);

export type GateErrorCode = (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];

/**
 * Uniform error codes returned by the workflow orchestrator (MCP tools).
 * Exposed to the Claude Code harness as `error_code` in MCP error payloads.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test errors`
Expected: 2 test suites, 4 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/errors.ts packages/governed-workflows/src/errors.test.ts
git commit -m "feat(workflows): add gate + workflow error code constants"
```

---

## Task 3: GateOutput zod schema

**Files:**
- Create: `packages/governed-workflows/src/gate-output.ts`
- Test: `packages/governed-workflows/src/gate-output.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/gate-output.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { gateOutputSchema } from "./gate-output.js";

describe("gateOutputSchema", () => {
  it("accepts a minimal pass verdict", () => {
    const parsed = gateOutputSchema.parse({
      pass: true,
      report: "greeting ok",
    });
    expect(parsed).toEqual({ pass: true, report: "greeting ok" });
  });

  it("accepts a fail verdict with error_code and hints", () => {
    const parsed = gateOutputSchema.parse({
      pass: false,
      report: "missing greeting",
      error_code: "MISSING_GREETING",
      hints: ["Return {greeting: 'Hello, <name>!'} from the sub-agent"],
    });
    expect(parsed.pass).toBe(false);
    expect(parsed.hints).toHaveLength(1);
    expect(parsed.error_code).toBe("MISSING_GREETING");
  });

  it("rejects output without report", () => {
    expect(() => gateOutputSchema.parse({ pass: true })).toThrow();
  });

  it("rejects pass that is not boolean", () => {
    expect(() =>
      gateOutputSchema.parse({ pass: "yes", report: "nope" }),
    ).toThrow();
  });

  it("rejects empty report", () => {
    expect(() =>
      gateOutputSchema.parse({ pass: true, report: "" }),
    ).toThrow();
  });

  it("rejects hints containing empty strings", () => {
    expect(() =>
      gateOutputSchema.parse({
        pass: false,
        report: "fail",
        hints: [""],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test gate-output`
Expected: FAIL — `Cannot find module './gate-output.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/gate-output.ts`:

```typescript
import { z } from "zod";

/**
 * Verdict returned by a gate function. Validated server-side by the runner
 * after each gate invocation. A missing/invalid output is reported to the
 * client as `GATE_INVALID_OUTPUT`.
 */
export const gateOutputSchema = z.object({
  pass: z.boolean(),
  report: z.string().min(1),
  error_code: z.string().min(1).optional(),
  hints: z.array(z.string().min(1)).optional(),
});

export type GateOutput = z.infer<typeof gateOutputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test gate-output`
Expected: 1 suite, 6 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/gate-output.ts packages/governed-workflows/src/gate-output.test.ts
git commit -m "feat(workflows): add GateOutput zod schema"
```

---

## Task 4: GateItem zod schema

**Files:**
- Create: `packages/governed-workflows/src/gate-item.ts`
- Test: `packages/governed-workflows/src/gate-item.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/gate-item.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { gateItemSchema } from "./gate-item.js";

describe("gateItemSchema", () => {
  it("accepts a minimal item", () => {
    const parsed = gateItemSchema.parse({
      id: "greeting-ok",
      source: "./gates/greet-exit.gate.ts",
    });
    expect(parsed.id).toBe("greeting-ok");
    expect(parsed.source).toBe("./gates/greet-exit.gate.ts");
    expect(parsed.config).toBeUndefined();
  });

  it("accepts a parameterised item via config", () => {
    const parsed = gateItemSchema.parse({
      id: "has-greeting",
      source: "./gates/has-field.gate.ts",
      config: { field: "greeting", type: "string" },
    });
    expect(parsed.config).toEqual({ field: "greeting", type: "string" });
  });

  it("rejects an item without id", () => {
    expect(() =>
      gateItemSchema.parse({ source: "./gates/x.gate.ts" }),
    ).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      gateItemSchema.parse({ id: "", source: "./gates/x.gate.ts" }),
    ).toThrow();
  });

  it("rejects an item without source", () => {
    expect(() => gateItemSchema.parse({ id: "x" })).toThrow();
  });

  it("rejects an empty source", () => {
    expect(() =>
      gateItemSchema.parse({ id: "x", source: "" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test gate-item`
Expected: FAIL — `Cannot find module './gate-item.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/gate-item.ts`:

```typescript
import { z } from "zod";

/**
 * A single gate declaration in workflow.json. `source` is a path relative to
 * the workflow.json file; the server resolves it against the git fetch of the
 * workflow repo at the run's pinned sha. `config` (optional) is forwarded to
 * the gate function via `GateContext.config` for parameterised gates.
 */
export const gateItemSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

export type GateItem = z.infer<typeof gateItemSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test gate-item`
Expected: 1 suite, 6 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/gate-item.ts packages/governed-workflows/src/gate-item.test.ts
git commit -m "feat(workflows): add GateItem zod schema"
```

---

## Task 5: GateBlock nested-array schema

**Files:**
- Create: `packages/governed-workflows/src/gate-block.ts`
- Test: `packages/governed-workflows/src/gate-block.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/gate-block.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { gateBlockSchema } from "./gate-block.js";

describe("gateBlockSchema", () => {
  it("accepts a single sequential item", () => {
    const parsed = gateBlockSchema.parse([
      { id: "a", source: "./gates/a.gate.ts" },
    ]);
    expect(parsed).toHaveLength(1);
  });

  it("accepts an inner array as a parallel bag", () => {
    const parsed = gateBlockSchema.parse([
      [
        { id: "a", source: "./gates/a.gate.ts" },
        { id: "b", source: "./gates/b.gate.ts" },
      ],
    ]);
    expect(Array.isArray(parsed[0])).toBe(true);
  });

  it("accepts a mix of sequential and parallel entries", () => {
    const parsed = gateBlockSchema.parse([
      [
        { id: "a", source: "./gates/a.gate.ts" },
        { id: "b", source: "./gates/b.gate.ts" },
      ],
      { id: "c", source: "./gates/c.gate.ts" },
      [
        { id: "d", source: "./gates/d.gate.ts" },
        { id: "e", source: "./gates/e.gate.ts" },
      ],
    ]);
    expect(parsed).toHaveLength(3);
    expect(Array.isArray(parsed[0])).toBe(true);
    expect(Array.isArray(parsed[1])).toBe(false);
    expect(Array.isArray(parsed[2])).toBe(true);
  });

  it("accepts an empty block (zero gates = always pass)", () => {
    const parsed = gateBlockSchema.parse([]);
    expect(parsed).toEqual([]);
  });

  it("rejects nested-of-nested arrays", () => {
    expect(() =>
      gateBlockSchema.parse([[[{ id: "a", source: "./a.gate.ts" }]]]),
    ).toThrow();
  });

  it("rejects an empty parallel bag", () => {
    expect(() => gateBlockSchema.parse([[]])).toThrow();
  });

  it("rejects an invalid item inside a parallel bag", () => {
    expect(() =>
      gateBlockSchema.parse([[{ id: "a" /* missing source */ }]]),
    ).toThrow();
  });

  it("rejects a top-level non-array", () => {
    expect(() =>
      gateBlockSchema.parse({ id: "a", source: "./a.gate.ts" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test gate-block`
Expected: FAIL — `Cannot find module './gate-block.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/gate-block.ts`:

```typescript
import { z } from "zod";
import { gateItemSchema } from "./gate-item.js";

/**
 * A GateBlock is an array where each entry is either:
 *   - a single GateItem (sequential step)
 *   - an array of GateItems (run in parallel, fail-fast)
 *
 * Nesting is strictly 1 level: arrays of arrays of arrays are rejected.
 * This bounds the DAG by construction (no cycles possible).
 */
export const gateBlockSchema = z.array(
  z.union([gateItemSchema, z.array(gateItemSchema).min(1)]),
);

export type GateBlock = z.infer<typeof gateBlockSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test gate-block`
Expected: 1 suite, 8 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/gate-block.ts packages/governed-workflows/src/gate-block.test.ts
git commit -m "feat(workflows): add GateBlock nested-array schema"
```

---

## Task 6: GateContext interface + defineGate helper

**Files:**
- Create: `packages/governed-workflows/src/gate-context.ts`
- Create: `packages/governed-workflows/src/define-gate.ts`
- Test: `packages/governed-workflows/src/define-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/define-gate.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { defineGate } from "./define-gate.js";
import type { GateContext } from "./gate-context.js";

function mockContext<A, C extends Record<string, unknown>>(
  artifact: A | undefined,
  config: C,
  kind: string = "exit",
): GateContext<A, C> {
  return {
    artifact,
    run: {
      id: "run-1",
      workflow_name: "hello-world",
      git_tag: "v1.0.0",
      params: {},
    },
    step: { id: "greet", previous_artifacts: {} },
    config,
    kind,
    helpers: {},
  };
}

describe("defineGate", () => {
  it("returns the same function identity (no runtime wrapping)", () => {
    const fn = async () => ({ pass: true, report: "ok" });
    const wrapped = defineGate(fn);
    expect(wrapped).toBe(fn);
  });

  it("supports sync gate functions", async () => {
    const gate = defineGate(() => ({ pass: true, report: "sync ok" }));
    const result = await gate(mockContext(undefined, {}));
    expect(result).toEqual({ pass: true, report: "sync ok" });
  });

  it("supports async gate functions with typed artifact + config", async () => {
    type Artifact = { greeting: string };
    type Config = { minLength: number };

    const gate = defineGate<Artifact, Config>(async (ctx) => {
      if (!ctx.artifact || ctx.artifact.greeting.length < ctx.config.minLength) {
        return { pass: false, report: "too short" };
      }
      return { pass: true, report: `ok: ${ctx.artifact.greeting}` };
    });

    const pass = await gate(
      mockContext<Artifact, Config>({ greeting: "Hello, Tom!" }, { minLength: 3 }),
    );
    expect(pass.pass).toBe(true);
    expect(pass.report).toBe("ok: Hello, Tom!");

    const fail = await gate(
      mockContext<Artifact, Config>({ greeting: "Hi" }, { minLength: 3 }),
    );
    expect(fail.pass).toBe(false);
  });

  it("exposes the kind passed by the runner", async () => {
    const gate = defineGate((ctx) => ({ pass: true, report: `kind=${ctx.kind}` }));
    const result = await gate(mockContext(undefined, {}, "entry"));
    expect(result.report).toBe("kind=entry");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test define-gate`
Expected: FAIL — `Cannot find module './define-gate.js'` (and `./gate-context.js`).

- [ ] **Step 3: Write the GateContext interface**

Create `packages/governed-workflows/src/gate-context.ts`:

```typescript
/**
 * Runtime context passed to a gate function by the server-side runner
 * (isolated-vm). Read-only — gates MUST NOT mutate it.
 *
 * Generic parameters:
 *   - Artifact: shape of the step artifact. Undefined for entry gates.
 *   - Config: shape of the `config` object declared on the gate item in
 *     workflow.json (defaults to a plain record).
 */
export interface GateContext<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Artifact produced by completeStep. Undefined for entry gates. */
  artifact: Artifact | undefined;

  /** Metadata about the current workflow run. */
  run: {
    id: string;
    workflow_name: string;
    /** Git tag pinned at launchWorkflow time (immutable for the run). */
    git_tag: string;
    /** Variables provided when the run was initiated. */
    params: Record<string, unknown>;
  };

  /** Metadata about the current step. */
  step: {
    id: string;
    /** Artifacts produced by previously-completed steps, keyed by step id. */
    previous_artifacts: Record<string, unknown>;
  };

  /** Config object declared on the gate item in workflow.json. */
  config: Config;

  /** Lifecycle kind of this evaluation: "entry" | "exit" | future extension. */
  kind: string;

  /**
   * Read-only helpers exposed by the server sandbox. Populated in T4
   * (queryTraces, checkWorkflowExists, ...). Declared as an open record so
   * later tranches can extend without breaking gate authors in T1.
   */
  helpers: Record<string, unknown>;
}
```

- [ ] **Step 4: Write the defineGate helper**

Create `packages/governed-workflows/src/define-gate.ts`:

```typescript
import type { GateContext } from "./gate-context.js";
import type { GateOutput } from "./gate-output.js";

/**
 * Authoring helper for `.gate.ts` files in workflow repos.
 *
 * At runtime it is a pure identity function — TypeScript uses it to infer
 * the shape of the gate's artifact + config without the author having to
 * annotate `GateContext` explicitly. The actual output validation happens
 * server-side in the gate runner (T4).
 *
 * @example
 *   import { defineGate } from "@mnm/governed-workflows";
 *
 *   export default defineGate<{ greeting: string }>(async (ctx) => {
 *     if (!ctx.artifact?.greeting) {
 *       return { pass: false, report: "missing greeting" };
 *     }
 *     return { pass: true, report: "ok" };
 *   });
 */
export function defineGate<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
>(
  fn: (ctx: GateContext<Artifact, Config>) => Promise<GateOutput> | GateOutput,
): (ctx: GateContext<Artifact, Config>) => Promise<GateOutput> | GateOutput {
  return fn;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test define-gate`
Expected: 1 suite, 4 tests, all PASS.

- [ ] **Step 6: Verify typecheck passes**

Run: `bun run --cwd packages/governed-workflows typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/governed-workflows/src/gate-context.ts packages/governed-workflows/src/define-gate.ts packages/governed-workflows/src/define-gate.test.ts
git commit -m "feat(workflows): add GateContext interface + defineGate helper"
```

---

## Task 7: WorkflowStep zod schema

**Files:**
- Create: `packages/governed-workflows/src/workflow-step.ts`
- Test: `packages/governed-workflows/src/workflow-step.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/workflow-step.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { workflowStepSchema } from "./workflow-step.js";

describe("workflowStepSchema", () => {
  it("parses a minimal step and defaults deps + prompt_context", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      agent: "greeter",
    });
    expect(parsed).toEqual({
      id: "greet",
      deps: [],
      agent: "greeter",
      prompt_context: {},
    });
  });

  it("parses a step with exit gates (single item)", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      deps: [],
      agent: "greeter",
      prompt_context: { name: "{{variables.name}}" },
      gates: {
        exit: [{ id: "greeting-ok", source: "./gates/greet-exit.gate.ts" }],
      },
    });
    expect(parsed.gates?.exit).toHaveLength(1);
    expect(parsed.prompt_context).toEqual({ name: "{{variables.name}}" });
  });

  it("parses a step with a nested parallel gate block", () => {
    const parsed = workflowStepSchema.parse({
      id: "shout",
      agent: "shouter",
      gates: {
        exit: [
          [
            { id: "uppercase-ok", source: "./gates/uppercase.gate.ts" },
            { id: "length-ok", source: "./gates/length.gate.ts" },
          ],
        ],
      },
    });
    const exit = parsed.gates?.exit;
    expect(exit).toBeDefined();
    expect(Array.isArray(exit?.[0])).toBe(true);
  });

  it("parses a step with both entry and exit gates", () => {
    const parsed = workflowStepSchema.parse({
      id: "publish",
      agent: "publisher",
      gates: {
        entry: [{ id: "env-ok", source: "./gates/env-ok.gate.ts" }],
        exit: [{ id: "deploy-ok", source: "./gates/deploy-ok.gate.ts" }],
      },
    });
    expect(parsed.gates?.entry).toHaveLength(1);
    expect(parsed.gates?.exit).toHaveLength(1);
  });

  it("accepts an unknown gate kind (extensibility)", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      agent: "greeter",
      gates: {
        "on-failure": [{ id: "notify", source: "./gates/notify.gate.ts" }],
      },
    });
    expect(parsed.gates?.["on-failure"]).toHaveLength(1);
  });

  it("rejects a step without id", () => {
    expect(() =>
      workflowStepSchema.parse({ agent: "greeter" }),
    ).toThrow();
  });

  it("rejects a step without agent", () => {
    expect(() =>
      workflowStepSchema.parse({ id: "greet" }),
    ).toThrow();
  });

  it("rejects deps containing empty strings", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "greet",
        agent: "greeter",
        deps: [""],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test workflow-step`
Expected: FAIL — `Cannot find module './workflow-step.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/workflow-step.ts`:

```typescript
import { z } from "zod";
import { gateBlockSchema } from "./gate-block.js";

/**
 * A single step in a workflow.json `steps` array. Gates is an open record
 * keyed by kind ("entry", "exit" in MVP; extensible to "on-failure",
 * "on-success", "mid", ... without schema migration). Unknown kinds are
 * accepted here — the orchestrator logs a warning and ignores them.
 */
export const workflowStepSchema = z.object({
  id: z.string().min(1),
  deps: z.array(z.string().min(1)).default([]),
  agent: z.string().min(1),
  prompt_context: z.record(z.unknown()).default({}),
  gates: z.record(z.string().min(1), gateBlockSchema).optional(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test workflow-step`
Expected: 1 suite, 8 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/workflow-step.ts packages/governed-workflows/src/workflow-step.test.ts
git commit -m "feat(workflows): add WorkflowStep zod schema"
```

---

## Task 8: Workflow zod schema with cross-step validation

**Files:**
- Create: `packages/governed-workflows/src/workflow.ts`
- Test: `packages/governed-workflows/src/workflow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/workflow.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema } from "./workflow.js";

const minimalWorkflow = {
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "hello-world",
  steps: [{ id: "greet", agent: "greeter" }],
};

describe("workflowDefinitionSchema", () => {
  it("parses a minimal workflow", () => {
    const parsed = workflowDefinitionSchema.parse(minimalWorkflow);
    expect(parsed.name).toBe("hello-world");
    expect(parsed.variables).toEqual({});
    expect(parsed.steps).toHaveLength(1);
  });

  it("parses variables with required + optional typings", () => {
    const parsed = workflowDefinitionSchema.parse({
      ...minimalWorkflow,
      variables: {
        name: { type: "string", required: true },
        debug: { type: "boolean" },
      },
    });
    expect(parsed.variables.name).toEqual({ type: "string", required: true });
    expect(parsed.variables.debug).toEqual({ type: "boolean" });
  });

  it("rejects wrong apiVersion", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, apiVersion: "v0" }),
    ).toThrow();
  });

  it("rejects wrong kind", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, kind: "Pipeline" }),
    ).toThrow();
  });

  it("rejects duplicate step ids", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        steps: [
          { id: "greet", agent: "greeter" },
          { id: "greet", agent: "shouter" },
        ],
      }),
    ).toThrow(/duplicate step id: greet/);
  });

  it("rejects a step depending on an unknown step", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        steps: [
          {
            id: "shout",
            agent: "shouter",
            deps: ["nonexistent"],
          },
        ],
      }),
    ).toThrow(/unknown step 'nonexistent'/);
  });

  it("rejects an empty steps array", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, steps: [] }),
    ).toThrow();
  });

  it("rejects an unknown variable type", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        variables: { x: { type: "date" } },
      }),
    ).toThrow();
  });

  it("accepts valid forward dependency (shout depends on greet)", () => {
    const parsed = workflowDefinitionSchema.parse({
      ...minimalWorkflow,
      steps: [
        { id: "greet", agent: "greeter" },
        { id: "shout", agent: "shouter", deps: ["greet"] },
      ],
    });
    expect(parsed.steps[1].deps).toEqual(["greet"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test workflow.test`
Expected: FAIL — `Cannot find module './workflow.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/workflow.ts`:

```typescript
import { z } from "zod";
import { workflowStepSchema } from "./workflow-step.js";

const variableDefSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object"]),
  required: z.boolean().optional(),
});

/**
 * Full workflow document (content of `workflow.json` in a workflow repo).
 * Validates both shape (zod object schema) and cross-step invariants
 * (duplicate ids, unknown deps) via `superRefine`.
 */
export const workflowDefinitionSchema = z
  .object({
    apiVersion: z.literal("mnm/v1"),
    kind: z.literal("GovernedWorkflow"),
    name: z.string().min(1),
    description: z.string().optional(),
    variables: z.record(z.string().min(1), variableDefSchema).default({}),
    steps: z.array(workflowStepSchema).min(1),
  })
  .superRefine((wf, ctx) => {
    const seen = new Set<string>();
    for (const step of wf.steps) {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate step id: ${step.id}`,
          path: ["steps"],
        });
      }
      seen.add(step.id);
    }
    for (const step of wf.steps) {
      for (const dep of step.deps) {
        if (!seen.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `step '${step.id}' depends on unknown step '${dep}'`,
            path: ["steps"],
          });
        }
      }
    }
  });

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test workflow.test`
Expected: 1 suite, 9 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/workflow.ts packages/governed-workflows/src/workflow.test.ts
git commit -m "feat(workflows): add Workflow zod schema with cross-step validation"
```

---

## Task 9: defineWorkflow helper

**Files:**
- Create: `packages/governed-workflows/src/define-workflow.ts`
- Test: `packages/governed-workflows/src/define-workflow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/define-workflow.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { defineWorkflow } from "./define-workflow.js";

describe("defineWorkflow", () => {
  it("returns the parsed workflow with defaults applied", () => {
    const wf = defineWorkflow({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "test",
      steps: [{ id: "a", agent: "x" }],
    });
    expect(wf.name).toBe("test");
    expect(wf.variables).toEqual({});
    expect(wf.steps[0].deps).toEqual([]);
  });

  it("throws on missing apiVersion", () => {
    expect(() => defineWorkflow({ kind: "GovernedWorkflow" })).toThrow();
  });

  it("throws on unknown deps", () => {
    expect(() =>
      defineWorkflow({
        apiVersion: "mnm/v1",
        kind: "GovernedWorkflow",
        name: "test",
        steps: [{ id: "a", agent: "x", deps: ["nope"] }],
      }),
    ).toThrow(/unknown step 'nope'/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test define-workflow`
Expected: FAIL — `Cannot find module './define-workflow.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/governed-workflows/src/define-workflow.ts`:

```typescript
import {
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "./workflow.js";

/**
 * Authoring helper for workflow.json files (via TS transpile) or for tests.
 * Parses + validates the input and returns a typed `WorkflowDefinition`.
 *
 * In production, the server parses workflow.json directly via
 * `workflowDefinitionSchema` at fetch time — `defineWorkflow` is only a
 * convenience for authoring + testing.
 */
export function defineWorkflow(def: unknown): WorkflowDefinition {
  return workflowDefinitionSchema.parse(def);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test define-workflow`
Expected: 1 suite, 3 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/define-workflow.ts packages/governed-workflows/src/define-workflow.test.ts
git commit -m "feat(workflows): add defineWorkflow helper"
```

---

## Task 10: Hello-world fixture + integration test

**Files:**
- Create: `packages/governed-workflows/src/__fixtures__/hello-world.workflow.json`
- Test: `packages/governed-workflows/src/integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/governed-workflows/src/integration.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema } from "./workflow.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "__fixtures__", "hello-world.workflow.json");
const helloWorld: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("integration: hello-world workflow fixture", () => {
  it("parses the spec's hello-world workflow end-to-end", () => {
    const parsed = workflowDefinitionSchema.parse(helloWorld);

    expect(parsed.apiVersion).toBe("mnm/v1");
    expect(parsed.kind).toBe("GovernedWorkflow");
    expect(parsed.name).toBe("hello-world");
    expect(parsed.steps).toHaveLength(2);

    const [greet, shout] = parsed.steps;
    expect(greet.id).toBe("greet");
    expect(greet.agent).toBe("greeter");
    expect(greet.deps).toEqual([]);
    expect(greet.gates?.exit).toHaveLength(1);

    expect(shout.id).toBe("shout");
    expect(shout.agent).toBe("shouter");
    expect(shout.deps).toEqual(["greet"]);
    expect(shout.gates?.exit).toHaveLength(1);
  });

  it("declares the `name` variable as required string", () => {
    const parsed = workflowDefinitionSchema.parse(helloWorld);
    expect(parsed.variables.name).toEqual({
      type: "string",
      required: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/governed-workflows test integration`
Expected: FAIL — `ENOENT: no such file or directory ... hello-world.workflow.json`.

- [ ] **Step 3: Create the fixture file**

Create `packages/governed-workflows/src/__fixtures__/hello-world.workflow.json` (verbatim from spec section 3):

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "hello-world",
  "description": "Demo MVP — 2 steps, sub-agents + gates TS",
  "variables": {
    "name": { "type": "string", "required": true }
  },
  "steps": [
    {
      "id": "greet",
      "deps": [],
      "agent": "greeter",
      "prompt_context": { "name": "{{variables.name}}" },
      "gates": {
        "exit": [
          { "id": "greeting-ok", "source": "./gates/greet-exit.gate.ts" }
        ]
      }
    },
    {
      "id": "shout",
      "deps": ["greet"],
      "agent": "shouter",
      "prompt_context": { "greeting": "{{steps.greet.artifact.greeting}}" },
      "gates": {
        "exit": [
          { "id": "uppercase-ok", "source": "./gates/shout-exit.gate.ts" }
        ]
      }
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/governed-workflows test integration`
Expected: 1 suite, 2 tests, all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/__fixtures__ packages/governed-workflows/src/integration.test.ts
git commit -m "test(workflows): integration test with hello-world fixture"
```

---

## Task 11: Public barrel export

**Files:**
- Modify: `packages/governed-workflows/src/index.ts`

- [ ] **Step 1: Replace the empty barrel with the full public API**

Overwrite `packages/governed-workflows/src/index.ts`:

```typescript
// Error codes
export {
  GATE_ERROR_CODES,
  WORKFLOW_ERROR_CODES,
  type GateErrorCode,
  type WorkflowErrorCode,
} from "./errors.js";

// Gate schemas + types
export { gateItemSchema, type GateItem } from "./gate-item.js";
export { gateBlockSchema, type GateBlock } from "./gate-block.js";
export { gateOutputSchema, type GateOutput } from "./gate-output.js";
export type { GateContext } from "./gate-context.js";

// Workflow schemas + types
export { workflowStepSchema, type WorkflowStep } from "./workflow-step.js";
export {
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "./workflow.js";

// Authoring helpers
export { defineGate } from "./define-gate.js";
export { defineWorkflow } from "./define-workflow.js";
```

- [ ] **Step 2: Write a barrel smoke test**

Create `packages/governed-workflows/src/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import * as pkg from "./index.js";

describe("public barrel", () => {
  it("exposes the expected runtime exports", () => {
    const exported = Object.keys(pkg).sort();
    expect(exported).toEqual([
      "GATE_ERROR_CODES",
      "WORKFLOW_ERROR_CODES",
      "defineGate",
      "defineWorkflow",
      "gateBlockSchema",
      "gateItemSchema",
      "gateOutputSchema",
      "workflowDefinitionSchema",
      "workflowStepSchema",
    ]);
  });

  it("runtime helpers are callable", () => {
    expect(typeof pkg.defineGate).toBe("function");
    expect(typeof pkg.defineWorkflow).toBe("function");
    expect(pkg.GATE_ERROR_CODES.GATE_TIMEOUT).toBe("GATE_TIMEOUT");
  });
});
```

- [ ] **Step 3: Run the barrel test**

Run: `bun run --cwd packages/governed-workflows test index.test`
Expected: 1 suite, 2 tests, all PASS.

- [ ] **Step 4: Run the full test suite on the package**

Run: `bun run --cwd packages/governed-workflows test`
Expected: all 10 test files pass (errors, gate-output, gate-item, gate-block, define-gate, workflow-step, workflow, define-workflow, integration, index).

- [ ] **Step 5: Commit**

```bash
git add packages/governed-workflows/src/index.ts packages/governed-workflows/src/index.test.ts
git commit -m "feat(workflows): expose public API via barrel"
```

---

## Task 12: Final typecheck + build + sanity from repo root

**Files:** (none new — verification only)

- [ ] **Step 1: Typecheck the package in isolation**

Run: `bun run --cwd packages/governed-workflows typecheck`
Expected: exits 0, no errors.

- [ ] **Step 2: Build the package (tsc to dist/)**

Run: `bun run --cwd packages/governed-workflows build`
Expected: exits 0. `packages/governed-workflows/dist/` exists with `index.js`, `index.d.ts`, and per-file outputs.

- [ ] **Step 3: Verify dist shape**

Run: `ls packages/governed-workflows/dist`
Expected output contains at least:

```
define-gate.d.ts
define-gate.js
define-workflow.d.ts
define-workflow.js
errors.d.ts
errors.js
gate-block.d.ts
gate-block.js
gate-context.d.ts
gate-context.js
gate-item.d.ts
gate-item.js
gate-output.d.ts
gate-output.js
index.d.ts
index.js
workflow.d.ts
workflow.js
workflow-step.d.ts
workflow-step.js
```

- [ ] **Step 4: Clean the dist (it is gitignored at the repo level, but tidy anyway)**

Run: `bun run --cwd packages/governed-workflows clean`
Expected: `dist/` removed.

- [ ] **Step 5: Run the repo-wide typecheck to confirm no other workspace broke**

Run: `bun run typecheck`
Expected: all 14 packages (13 existing + 1 new) pass.

- [ ] **Step 6: Run the repo-wide test suite**

Run: `bun run test:run`
Expected: all projects' tests pass; the new `packages/governed-workflows` project reports ~10 test files, ~50 tests, all green.

- [ ] **Step 7: Final commit (only if typecheck or tests required fixes)**

If no fixes were needed in Steps 5–6, skip this step. Otherwise:

```bash
git add -A
git commit -m "chore(workflows): align T1 package with repo-wide typecheck"
```

- [ ] **Step 8: Push the T1 branch**

Run: `git push`
Expected: branch up to date on origin. Atomic commit + push per `CLAUDE.md` rule.

---

## Post-T1 handoff checklist

- [x] `packages/governed-workflows` exists with all 10 source files + 10 test files + 1 fixture.
- [x] `@mnm/governed-workflows` is importable from another workspace as `import { defineGate } from "@mnm/governed-workflows"`.
- [x] `bun run test:run` is green for this package (52/52). Pre-existing Windows failures in `@mnm/server` + `@mnm/adapter-opencode-local` unchanged.
- [x] `bun run typecheck` is green for this package. Pre-existing root `mnm` `embedded-postgres-windows` failure unchanged.
- [x] All tasks are committed as individual conventional-commit messages (11 feature commits + 1 chore cleanup; Task 12 was verification-only, no commit).
- [x] `vitest.config.ts` at the repo root includes `packages/governed-workflows` in `test.projects`.

---

## Completion report — T1 shipped 2026-04-21

### Shipped commits (chronological)

```
90eb159 chore(workflows): bootstrap @mnm/governed-workflows package      Task 1
6e476e0 feat(workflows): add gate + workflow error code constants        Task 2
547cb8e chore: permission grants accrued during T1 Tasks 1-2             (non-impl)
50889b6 feat(workflows): add GateOutput zod schema                       Task 3
9a19374 feat(workflows): add GateItem zod schema                         Task 4
881ca71 feat(workflows): add GateBlock nested-array schema               Task 5
225f16f feat(workflows): add GateContext interface + defineGate helper   Task 6
fef8814 feat(workflows): add WorkflowStep zod schema                     Task 7
68c1ce5 feat(workflows): add Workflow zod schema with cross-step vali..  Task 8
5f236c6 feat(workflows): add defineWorkflow helper                       Task 9
ed6c22a test(workflows): integration test with hello-world fixture       Task 10
1c483e1 feat(workflows): expose public API via barrel                    Task 11
```

Range `fb028ae..1c483e1`. All pushed to `origin/master`.

### Metrics

| Category | Count |
|---|---|
| Source files | 10 (`errors`, `gate-output`, `gate-item`, `gate-block`, `gate-context`, `define-gate`, `workflow-step`, `workflow`, `define-workflow`, `index`) |
| Test files | 10 (sibling `.test.ts` for each source + `integration.test.ts`) |
| Fixtures | 1 (`__fixtures__/hello-world.workflow.json`) |
| Total tests | 52, all passing |
| Package dist output (on `bun run build`) | 20 files (`.js` + `.d.ts` pair per module) |
| Public runtime exports | 9 |
| Public type-only exports | 8 |

### Review outcome

Each task passed both a **spec compliance review** and a **code quality review** during execution. A **tranche-level final review** (`superpowers:code-reviewer`) after Task 12 verdict:

> **Ready to merge T1 as a whole? Yes, with the 3 Important fixes recommended before T4 begins consumption.**
>
> The tranche delivers exactly the spec's T1 row — no more, no less — with disciplined file decomposition, 52 passing tests, zero downstream coupling, and a public barrel that reads like one designed surface. Nothing Critical and no plan deviations.

### Deferred follow-ups (to address in T4's first PR)

The final reviewer flagged three Important items. None block T1 shipping, but **all three should be applied in T4's first PR** — they are only actually exercised when T4's gate runner and T5's MCP tools start consuming this package.

| # | Item | File | Rationale |
|---|------|------|-----------|
| 1 | Add `.strict()` to `gateOutputSchema` | `src/gate-output.ts:8-13` | Strip-mode silently drops typos like `hits` instead of `hints`. Fail-loudly at the sandbox-to-server boundary where debuggability matters most. Add one positive test `"rejects output with unknown keys"`. Two-line change, no API breakage. |
| 2 | JSDoc disambiguating `WORKFLOW_STEP_NOT_FOUND` vs `WORKFLOW_DEPENDENCY_UNMET` | `src/errors.ts:18-24` | These codes are the public contract with the Claude Code harness. T5 authors must know which to emit when (step id doesn't exist vs. exists but upstream deps not succeeded yet). Add `@remarks` per constant. No runtime change. |
| 3 | Integration coverage for `config` payloads in a full workflow parse | `src/__fixtures__/` or `src/workflow.test.ts` | `config` is unit-tested at `gateItemSchema` level but never exercised through a full `workflow.json` → `WorkflowDefinition` roundtrip. T4 will read `workflow.steps[i].gates.exit[j].config` — regression here only caught when T4 lands. Add one fixture or one test case. |

### Backlog (minor, not required for any specific tranche)

| Item | File | Notes |
|---|------|-------|
| Style alignment: `Object.freeze({...} as const)` vs the `@mnm/shared` pattern (`[...] as const`) | `src/errors.ts:5, 18` | Plan-prescribed; accepted for T1. Decide repo-wide in a separate ADR. |
| JSDoc "cycle detection deferred to T5 orchestrator" | `src/workflow.ts:23-46` | Consumer expectation management. One line. |
| `Readonly<>` hardening of `GateContext` passed to gate functions | `src/gate-context.ts` / `src/define-gate.ts` | Gates should not mutate ctx. JS interfaces don't enforce this; isolated-vm will freeze at runtime in T4. |
| `Gate<Artifact, Config>` type alias | Package-level | Would DRY the `(ctx: GateContext<A,C>) => Promise<GateOutput> \| GateOutput` signature used in `defineGate`. Lift when T4's runner also wants to type imported gates. |
| Type-level assertions via `expectTypeOf` | `src/define-gate.test.ts`, `src/define-workflow.test.ts` | Pin inferred generic narrowing. Adds resilience if zod's inference semantics change. |

### Next steps

**T1 unblocks the next three tranches to proceed in parallel**:

1. **T2 — DB migrations** (4 new tables + RLS + pg enums + `config_layer_items` extension). Independent of T1. Can consume `GateErrorCode`/`WorkflowErrorCode` as a type-level sanity check on the `gate_results.error_code TEXT` column, but must not add a `pgEnum` — spec keeps the column as open text.
2. **T3 — GitProvider** (GitlabProvider + LocalBareRepoProvider for fetching workflow.json, gates, agents at a pinned sha). Independent of T1.
3. **T4 — Gate runner** (isolated-vm + esbuild + `runGateBlock(block, ctx, kind)` generic runner with cache-by-sha + fail-closed). Depends on T1 (`GateContext`, `GateOutput`, `GateBlock`, `gateOutputSchema`) AND on T2 (for writing `gate_results` rows) AND on T3 (for fetching gate sources).

Recommended order: kick off **T2 + T3 in parallel** next. Then **T4** once both land. The three deferred Important items above should land in T4's first PR.

**After T4**: T5 (MCP tools), T6 (hook SessionStart + client cache), T7 (hello-world bootstrap + E2E demo).
