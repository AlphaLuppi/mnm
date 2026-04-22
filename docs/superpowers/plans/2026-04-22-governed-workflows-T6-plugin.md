# T6 — Governed Workflows: MnM Plugin + SessionStart Hook + Lazy Agent Materialization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the MnM Claude Code plugin (minimal bootstrap wrapper), the SessionStart hook (local-only dashboard), and enrich the MCP `launchStep` + add `setup_workspace` / `push_local_state` tools so the harness can materialize agents lazily via self-correction.

**Architecture:** Plugin is a thin delivery vehicle (manifest + .mcp.json + hook + binary). All dynamic artifacts live in user-scope `~/.claude/`, written by the harness via Write tool on instruction from MnM MCP tool responses. Single auth path = OAuth 2.1 on the live MCP server. Hook does zero network work.

**Tech Stack:** TypeScript (Node 22+), bun workspaces, esbuild (binary build), vitest (tests), zod (schema), drizzle (ORM), Express (server), @modelcontextprotocol/sdk (MCP).

**Spec** : `docs/superpowers/specs/2026-04-22-governed-workflows-T6-plugin-design.md`.

---

## Standing orders (carried from T5 retro)

- **Plan comments are contract** — every JSDoc / inline comment shown in this plan's code blocks MUST be copied verbatim into the implementation.
- **Atomic commit + push** per task (MnM CLAUDE.md rule).
- **Conventional commits scope** : `workflows`.
- **Test DB** : `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test`.
- **Issue prefix unique per test suite** : `T6HL` for any suite inserting companies, with `ON CONFLICT (id) DO NOTHING`.
- **Distinct shas per fixture** for CompiledCache isolation.
- **ShaCache API** : `get(providerId, path, sha)` / `set(providerId, path, sha, value)` — not `getOrFetch`.
- **Pre-flight DB schema validation** : verify any column names against `packages/db/src/schema/` BEFORE coding raw SQL.
- **No emojis** in code/commits.

---

## File structure (tasks produce these)

New files:
- `packages/mnm-plugin/package.json`
- `packages/mnm-plugin/tsconfig.json`
- `packages/mnm-plugin/vitest.config.ts`
- `packages/mnm-plugin/esbuild.config.mjs`
- `packages/mnm-plugin/src/types.ts`
- `packages/mnm-plugin/src/atomic-write.ts`
- `packages/mnm-plugin/src/session-start.ts`
- `packages/mnm-plugin/__tests__/atomic-write.test.ts`
- `packages/mnm-plugin/__tests__/session-start.test.ts`
- `plugins/mnm/.claude-plugin/plugin.json`
- `plugins/mnm/.mcp.json`
- `plugins/mnm/hooks/hooks.json`
- `plugins/mnm/bin/mnm-session-start` (compiled artifact)
- `plugins/mnm/README.md`
- `docs/superpowers/specs/T6-hot-reload-spike-result.md`
- `docs/superpowers/plans/next-session-T7-prompt.md`

Modified files:
- `package.json` (root) — add `packages/mnm-plugin` to workspaces, add `build:plugin` script
- `server/src/services/governed-workflows.ts` — add `setupWorkspace`, `pushLocalState`, enrich `launchStep`
- `server/src/services/__tests__/governed-workflows.test.ts` — tests for new methods + enriched launchStep
- `server/src/mcp/tools/governed-workflows.tool.ts` — add `setup_workspace` + `push_local_state` tools, enrich `launch_governed_step` schema
- `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` — tests for new tools
- `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — update §5 to reference T6 spec, mark T6 shipped in §7 table

---

## Task 1 — Scaffold `packages/mnm-plugin/` skeleton

**Files:**
- Create: `packages/mnm-plugin/package.json`
- Create: `packages/mnm-plugin/tsconfig.json`
- Create: `packages/mnm-plugin/vitest.config.ts`
- Create: `packages/mnm-plugin/esbuild.config.mjs`
- Modify: `package.json` (root) — add workspace entry if missing

- [ ] **Step 1: Check if monorepo already globs `packages/*`**

Run:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
grep -A3 '"workspaces"' package.json
```
Expected: `"workspaces"` includes `packages/*`. If so, new `packages/mnm-plugin/` auto-included. If not, add it explicitly.

- [ ] **Step 2: Create package.json**

Write `packages/mnm-plugin/package.json`:
```json
{
  "name": "@mnm/plugin",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "description": "MnM Claude Code plugin sources — SessionStart hook binary and plugin assets.",
  "scripts": {
    "build": "node --input-type=module -e \"import esbuild from 'esbuild'; import config from './esbuild.config.mjs'; await esbuild.build(config);\" && chmod +x ../../plugins/mnm/bin/mnm-session-start",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.12.0",
    "esbuild": "^0.24.2",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Write `packages/mnm-plugin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

Write `packages/mnm-plugin/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 5: Create esbuild.config.mjs**

Write `packages/mnm-plugin/esbuild.config.mjs`:
```javascript
// Build config for the MnM Claude Code plugin binary.
//
// Output: ../../plugins/mnm/bin/mnm-session-start (ESM bundle with shebang).
// This file is checked into git so users installing the plugin get a
// ready-to-run binary without needing Node toolchain bootstrapping beyond
// what Claude Code already requires.
export default {
  entryPoints: ["src/session-start.ts"],
  outfile: "../../plugins/mnm/bin/mnm-session-start",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // Shebang so the hook binary is directly executable. Claude Code invokes
  // it with the working directory = session cwd; we rely only on
  // CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA env vars so cwd does not matter.
  banner: { js: "#!/usr/bin/env node" },
  // Bundle everything — the binary must not depend on node_modules at
  // runtime, because the plugin cache directory ($CLAUDE_PLUGIN_ROOT) has
  // no npm install step.
  packages: "bundle",
  minify: false,
  sourcemap: false,
};
```

- [ ] **Step 6: Install workspace deps**

Run:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun install
```
Expected: no errors, `packages/mnm-plugin/node_modules` created.

- [ ] **Step 7: Verify typecheck passes on empty package**

Create empty `packages/mnm-plugin/src/session-start.ts` with `export {};` placeholder, then run:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run typecheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add packages/mnm-plugin/ package.json bun.lock
git commit -m "feat(workflows): scaffold @mnm/plugin package (T6)"
git push origin master
```

---

## Task 2 — Atomic write utility (TDD)

**Files:**
- Create: `packages/mnm-plugin/src/atomic-write.ts`
- Create: `packages/mnm-plugin/__tests__/atomic-write.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/mnm-plugin/__tests__/atomic-write.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFile } from "../src/atomic-write.js";

describe("atomicWriteFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "atomic-write-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a new file with the exact content provided", async () => {
    const target = join(dir, "new.txt");
    await atomicWriteFile(target, "hello");
    expect(readFileSync(target, "utf8")).toBe("hello");
  });

  it("overwrites an existing file", async () => {
    const target = join(dir, "existing.txt");
    writeFileSync(target, "old");
    await atomicWriteFile(target, "new");
    expect(readFileSync(target, "utf8")).toBe("new");
  });

  it("leaves no temp artifact after success", async () => {
    const target = join(dir, "clean.txt");
    await atomicWriteFile(target, "x");
    expect(existsSync(`${target}.tmp`)).toBe(false);
  });

  it("creates the parent directory if missing", async () => {
    const target = join(dir, "nested", "deeper", "file.txt");
    await atomicWriteFile(target, "deep");
    expect(readFileSync(target, "utf8")).toBe("deep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run test
```
Expected: FAIL with "Cannot find module '../src/atomic-write.js'" or similar.

- [ ] **Step 3: Write implementation**

Write `packages/mnm-plugin/src/atomic-write.ts`:
```typescript
import { promises as fs } from "node:fs";
import { dirname } from "node:path";

/**
 * Writes `content` to `targetPath` atomically: writes to `${targetPath}.tmp`
 * first, then renames onto the target. `fs.rename` is atomic on POSIX and
 * near-atomic on Windows NTFS (uses MoveFileEx internally). Creates parent
 * directories if they do not exist.
 *
 * Not concurrent-safe — two writers racing on the same target can clobber
 * each other's `.tmp` file. For our use case (single session-start hook +
 * harness Write tool) this is fine.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  await fs.mkdir(dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, targetPath);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run test
```
Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add packages/mnm-plugin/src/atomic-write.ts packages/mnm-plugin/__tests__/atomic-write.test.ts
git commit -m "feat(workflows): atomic write util for plugin hook (T6)"
git push origin master
```

---

## Task 3 — Types for session-start hook

**Files:**
- Create: `packages/mnm-plugin/src/types.ts`

- [ ] **Step 1: Write types file**

Write `packages/mnm-plugin/src/types.ts`:
```typescript
/**
 * Persistent cache the SessionStart hook reads from and the harness writes
 * to via the `push_local_state` MCP tool. Lives at
 * `${CLAUDE_PLUGIN_DATA}/last-session.json`.
 */
export interface LastSession {
  /** sha256 of the last syncEnvironment result (see governed-workflows service). */
  lastSyncedSha: string;
  /** ISO 8601 timestamp of the last successful sync. */
  syncedAt: string;
  /** Names of agents currently materialized in ~/.claude/agents/mnm--*.md. */
  agentNames: string[];
  /** Number of governed workflow runs in status=active for the user's company. */
  pendingRuns: number;
  /** Number of issues marked as open requiring user attention. */
  openIssues: number;
  /** Version string from plugin.json at last tool call. Used for update detection. */
  lastPluginVersion: string;
}

/**
 * Shape the SessionStart hook emits on stdout. Claude Code parses this JSON
 * and injects `additionalContext` into the session context. See
 * https://code.claude.com/docs/en/hooks for the full spec.
 */
export interface SessionStartHookOutput {
  hookSpecificOutput: {
    hookEventName: "SessionStart";
    additionalContext: string;
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add packages/mnm-plugin/src/types.ts
git commit -m "feat(workflows): plugin hook types (T6)"
git push origin master
```

---

## Task 4 — SessionStart hook binary (TDD)

**Files:**
- Create: `packages/mnm-plugin/src/session-start.ts` (replaces the placeholder from Task 1)
- Create: `packages/mnm-plugin/__tests__/session-start.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/mnm-plugin/__tests__/session-start.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSessionStart } from "../src/session-start.js";
import type { LastSession } from "../src/types.js";

describe("runSessionStart", () => {
  let root: string;
  let data: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mnm-plugin-root-"));
    data = mkdtempSync(join(tmpdir(), "mnm-plugin-data-"));
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "mnm", version: "1.2.3" }),
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(data, { recursive: true, force: true });
  });

  it("emits a first-run message when no state file exists", async () => {
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput.additionalContext).toContain("First run");
    expect(out.hookSpecificOutput.additionalContext).toContain("1.2.3");
    expect(out.hookSpecificOutput.additionalContext).toContain("Set me up for MnM");
  });

  it("emits a dashboard when state file is valid", async () => {
    const state: LastSession = {
      lastSyncedSha: "abc",
      syncedAt: "2026-04-22T08:00:00.000Z",
      agentNames: ["mnm--greeter", "mnm--shouter"],
      pendingRuns: 2,
      openIssues: 1,
      lastPluginVersion: "1.2.3",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(state));
    const out = await runSessionStart({ root, data });
    const ctx = out.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("2 workflows");
    expect(ctx).toContain("1 issue");
    expect(ctx).toContain("1.2.3");
  });

  it("surfaces a plugin-update hint when manifest version is newer than lastPluginVersion", async () => {
    const state: LastSession = {
      lastSyncedSha: "abc",
      syncedAt: "2026-04-22T08:00:00.000Z",
      agentNames: [],
      pendingRuns: 0,
      openIssues: 0,
      lastPluginVersion: "1.0.0",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(state));
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toContain("updated");
  });

  it("falls back to first-run message when state JSON is corrupted", async () => {
    writeFileSync(join(data, "last-session.json"), "{ not json");
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toContain("First run");
  });

  it("returns empty context when manifest is unreadable (fail-open)", async () => {
    rmSync(join(root, ".claude-plugin"), { recursive: true, force: true });
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run test
```
Expected: FAIL with `runSessionStart` not defined.

- [ ] **Step 3: Write implementation**

Replace `packages/mnm-plugin/src/session-start.ts` with:
```typescript
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { LastSession, SessionStartHookOutput } from "./types.js";

/**
 * Pure function form of the hook. Takes CLAUDE_PLUGIN_ROOT and
 * CLAUDE_PLUGIN_DATA (as if they were env vars) and returns the hook
 * output object. Accepts the paths as injectable args so tests can exercise
 * temp dirs without mutating process.env.
 *
 * Fail-open philosophy: if ANYTHING unexpected happens (missing manifest,
 * corrupted cache, etc.) the hook returns a safe empty or first-run message.
 * Claude Code should never fail to start a session because of the MnM hook.
 */
export async function runSessionStart(params: {
  root: string;
  data: string;
}): Promise<SessionStartHookOutput> {
  let currentVersion: string;
  try {
    const manifestPath = join(params.root, ".claude-plugin", "plugin.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    currentVersion = typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    // Manifest unreadable — should never happen in a correctly-installed
    // plugin, but never block the session. Return empty context.
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "",
      },
    };
  }

  let state: LastSession | null = null;
  try {
    const statePath = join(params.data, "last-session.json");
    state = JSON.parse(await fs.readFile(statePath, "utf8")) as LastSession;
  } catch {
    // ENOENT (first run) or malformed JSON — both fall back to first-run
    // guidance. No logging because stdout is reserved for the JSON output
    // and stderr would surface a spurious transcript warning.
  }

  if (state === null) {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `MnM plugin v${currentVersion}. First run detected. ` +
          `To provision your workspace, ask: "Set me up for MnM".`,
      },
    };
  }

  const lines: string[] = [];
  lines.push(`MnM plugin v${currentVersion}`);
  if (state.lastPluginVersion !== currentVersion) {
    lines.push(
      `Plugin updated from v${state.lastPluginVersion} — run "Set me up for MnM" to refresh agents.`,
    );
  }
  const runsLabel = state.pendingRuns === 1 ? "workflow" : "workflows";
  const issuesLabel = state.openIssues === 1 ? "issue" : "issues";
  lines.push(
    `${state.pendingRuns} ${runsLabel} in progress, ${state.openIssues} ${issuesLabel} pending.`,
  );
  if (state.syncedAt) {
    lines.push(`Last sync: ${state.syncedAt}.`);
  }
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: lines.join(" "),
    },
  };
}

// Entry point when executed as a binary (via hooks/hooks.json). Reads the
// two env vars Claude Code exports to plugin hook processes and writes the
// JSON result to stdout. Exits 0 on success — exits 0 even on unexpected
// failures because SessionStart does not support blocking (exit 2 would
// just print a warning in the transcript).
const isEntryPoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntryPoint) {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  const data = process.env.CLAUDE_PLUGIN_DATA;
  if (!root || !data) {
    // Running outside a plugin context — emit empty context silently.
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: "",
        },
      }),
    );
    process.exit(0);
  }
  runSessionStart({ root, data })
    .then((out) => {
      process.stdout.write(JSON.stringify(out));
      process.exit(0);
    })
    .catch(() => {
      // Unexpected — fail open.
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: "",
          },
        }),
      );
      process.exit(0);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run test
```
Expected: 5/5 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add packages/mnm-plugin/src/session-start.ts packages/mnm-plugin/__tests__/session-start.test.ts
git commit -m "feat(workflows): SessionStart hook binary (T6)"
git push origin master
```

---

## Task 5 — Build the hook binary to `plugins/mnm/bin/`

**Files:**
- Create: `plugins/mnm/bin/mnm-session-start` (artifact)

- [ ] **Step 1: Create target directory**

```bash
mkdir -p C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/plugins/mnm/bin
```

- [ ] **Step 2: Run build**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/mnm-plugin && bun run build
```
Expected: `../../plugins/mnm/bin/mnm-session-start` created, no errors.

- [ ] **Step 3: Smoke-test the binary**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
CLAUDE_PLUGIN_ROOT="$(pwd)/plugins/mnm" CLAUDE_PLUGIN_DATA="$(mktemp -d)" node plugins/mnm/bin/mnm-session-start
```
Expected: JSON output containing `"hookEventName":"SessionStart"` and `"First run detected"`. Exit code 0.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add plugins/mnm/bin/mnm-session-start
git commit -m "build(workflows): compile SessionStart hook binary (T6)"
git push origin master
```

---

## Task 6 — Plugin manifest, `.mcp.json`, `hooks.json`

**Files:**
- Create: `plugins/mnm/.claude-plugin/plugin.json`
- Create: `plugins/mnm/.mcp.json`
- Create: `plugins/mnm/hooks/hooks.json`

- [ ] **Step 1: Write plugin manifest**

Write `plugins/mnm/.claude-plugin/plugin.json`:
```json
{
  "name": "mnm",
  "version": "0.1.0",
  "description": "MnM Governed Workflows — supervise AI agent orchestration for your company.",
  "author": {
    "name": "MnM Platform"
  },
  "keywords": ["mnm", "governed-workflows", "ai-orchestration"],
  "userConfig": {
    "company_id": {
      "type": "string",
      "title": "Company ID",
      "description": "Your MnM company UUID. Ask your MnM admin.",
      "required": true
    },
    "server_url": {
      "type": "string",
      "title": "MnM server URL",
      "description": "Base URL of your MnM deployment (e.g. https://mnm.acme.com).",
      "required": true
    }
  }
}
```

- [ ] **Step 2: Write `.mcp.json`**

Write `plugins/mnm/.mcp.json`:
```json
{
  "mcpServers": {
    "mnm": {
      "type": "http",
      "url": "${user_config.server_url}/mcp",
      "oauth": {
        "authServerMetadataUrl": "${user_config.server_url}/.well-known/oauth-authorization-server"
      }
    }
  }
}
```

- [ ] **Step 3: Write `hooks/hooks.json`**

Write `plugins/mnm/hooks/hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/mnm-session-start",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Validate JSON files**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
node -e "JSON.parse(require('fs').readFileSync('plugins/mnm/.claude-plugin/plugin.json'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/mnm/.mcp.json'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/mnm/hooks/hooks.json'))"
```
Expected: no output (silent success).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add plugins/mnm/.claude-plugin/plugin.json plugins/mnm/.mcp.json plugins/mnm/hooks/hooks.json
git commit -m "feat(workflows): plugin manifest + .mcp.json + SessionStart hook config (T6)"
git push origin master
```

---

## Task 7 — Plugin README

**Files:**
- Create: `plugins/mnm/README.md`

- [ ] **Step 1: Write README**

Write `plugins/mnm/README.md`:
```markdown
# MnM Plugin for Claude Code

Supervise AI agent orchestration via Governed Workflows. This plugin wires
Claude Code to your MnM deployment and bootstraps the environment your
workflows need.

## What this plugin ships

- The `mnm` MCP server connection (HTTP, OAuth 2.1).
- A `SessionStart` hook that shows a lightweight dashboard (pending
  workflows, open issues, plugin version).

That is ALL. No bundled agents, skills, or commands — MnM materializes
those dynamically at user scope (`~/.claude/agents/mnm--*.md`) on first
use, driven by MCP tool responses.

## Install

```shell
/plugin install mnm@mnm-platform
```

Claude Code will prompt you for:

- **Company ID** — your MnM company UUID (from your admin).
- **MnM server URL** — e.g. `https://mnm.acme.com`.

## First run

After restarting Claude Code (or `/reload-plugins`), the SessionStart hook
runs and tells you:

> MnM plugin v0.1.0. First run detected. To provision your workspace, ask:
> "Set me up for MnM".

Type that prompt. Claude will trigger the `setup_workspace` MCP tool which
returns the list of agents to materialize under `~/.claude/agents/`.
Claude writes them via its Write tool. OAuth 2.1 login runs the first time
(browser flow).

After provisioning, you may need to run `/reload-plugins` once so Claude
Code picks up the new agents.

## Usage

Once bootstrapped, run workflows by asking Claude naturally:

> "Run the hello-world workflow."

The MnM MCP server orchestrates the steps, dispatches to the right agent,
and validates entry/exit gates server-side.

## Updating agents

Agents auto-update on every step launch: `launchStep` compares your local
agent shas against the canonical git-pinned versions and returns new
content if stale. Claude writes the update, then retries the step.

## Data locations

- **User agents** : `~/.claude/agents/mnm--*.md`
- **Plugin cache** (session state, last-sync marker) : `~/.claude/plugins/data/mnm-<marketplace>/last-session.json`

## Troubleshooting

- **Hook does nothing on SessionStart** : ensure the plugin binary is
  executable. Reinstall the plugin if corrupted.
- **OAuth loop** : clear the credential with `claude mcp logout mnm`.
- **Agent not found after `Write`** : run `/reload-plugins` once.
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add plugins/mnm/README.md
git commit -m "docs(workflows): plugin README (T6)"
git push origin master
```

---

## Task 8 — Service: `setupWorkspace` (TDD)

**Files:**
- Modify: `server/src/services/governed-workflows.ts` — add `SetupWorkspaceArgs`, `SetupWorkspaceResult`, and the `setupWorkspace` function to the service
- Modify: `server/src/services/__tests__/governed-workflows.test.ts` — add tests

- [ ] **Step 1: Validate DB schema**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
grep -n "agents" packages/db/src/schema/agents.ts | head -30
```
Confirm the `agents` table columns we will read: `id, companyId, name, enabled, latestGitTag, ...`. All used below must exist.

- [ ] **Step 2: Add failing test**

At the end of `server/src/services/__tests__/governed-workflows.test.ts`, in the existing describe block (or new `describe("setupWorkspace")`), add:
```typescript
  describe("setupWorkspace", () => {
    it("returns all enabled agents with content and sha, plus write instructions", async () => {
      // Arrange: seed 2 enabled agents for the test company.
      const companyId = await seedCompanyWithAgents({
        issuePrefix: "T6HL",
        agents: [
          { name: "greeter", enabled: true },
          { name: "shouter", enabled: true },
          { name: "disabled-one", enabled: false },
        ],
      });

      // Act
      const result = await service.setupWorkspace({ companyId });

      // Assert — disabled agents excluded, mnm-- prefix applied in output name.
      expect(result.agents.map((a) => a.name).sort()).toEqual([
        "mnm--greeter",
        "mnm--shouter",
      ]);
      for (const agent of result.agents) {
        expect(agent.content.length).toBeGreaterThan(0);
        expect(agent.sha.length).toBeGreaterThan(0);
        expect(agent.targetPath).toMatch(/^~\/\.claude\/agents\/mnm--[a-z0-9-]+\.md$/);
      }
      expect(result.instructions).toContain("Write");
    });

    it("returns an empty array if the company has no enabled agents", async () => {
      const companyId = await seedCompanyWithAgents({ issuePrefix: "T6HL", agents: [] });
      const result = await service.setupWorkspace({ companyId });
      expect(result.agents).toEqual([]);
    });
  });
```

If `seedCompanyWithAgents` helper doesn't exist, inline the fixture setup using the patterns in the existing tests (see existing `launchWorkflow` tests for reference). Use prefix `T6HL` and `ON CONFLICT (id) DO NOTHING` for company inserts.

- [ ] **Step 3: Run test to verify it fails**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t setupWorkspace
```
Expected: FAIL with "service.setupWorkspace is not a function".

- [ ] **Step 4: Add types + implementation**

In `server/src/services/governed-workflows.ts`, near the other exported interfaces (after `SyncEnvironmentResult`), add:
```typescript
export interface SetupWorkspaceArgs {
  companyId: string;
}

/**
 * Agent record returned by setupWorkspace for the harness to materialize
 * at user scope. The `name` is pre-prefixed with `mnm--` to avoid name
 * collisions with user-defined agents in `~/.claude/agents/`. `targetPath`
 * uses `~` placeholder — the harness is responsible for resolving home.
 */
export interface SetupWorkspaceAgent {
  /** Namespaced agent name, e.g. "mnm--greeter". */
  name: string;
  /** Full agent.md content (frontmatter + body). */
  content: string;
  /** Git sha of the content for stale-detection on subsequent launchStep calls. */
  sha: string;
  /** Instruction-style path hint: `~/.claude/agents/mnm--<name>.md`. */
  targetPath: string;
}

export interface SetupWorkspaceResult {
  agents: SetupWorkspaceAgent[];
  /**
   * Human-readable directive for the harness. The harness should Write each
   * `agent.content` to `agent.targetPath`. Emitted as a plain string so the
   * MCP tool can bubble it to the Claude Code session.
   */
  instructions: string;
}
```

In the `governedWorkflowService` factory, next to the other functions, add:
```typescript
  /**
   * Returns the full set of agents this company expects a newly-bootstrapped
   * user session to have in `~/.claude/agents/`. Called once by the harness
   * when the user asks "Set me up for MnM" (onboarding flow — spec §T6).
   *
   * Agent names are prefixed with `mnm--` so they cannot collide with
   * user-defined agents. The content is fetched via the git provider and
   * cached in the shaCache. Disabled agents are skipped.
   */
  async function setupWorkspace(args: SetupWorkspaceArgs): Promise<SetupWorkspaceResult> {
    const rows = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, args.companyId),
          eq(agents.enabled, true),
        ),
      );

    const out: SetupWorkspaceAgent[] = [];
    for (const a of rows) {
      if (!a.latestGitTag) continue;
      const mdPath = `${a.name}/agent.md`;
      const cached = shaCache.get(PROVIDER_ID, mdPath, a.latestGitTag);
      const content = cached !== undefined
        ? cached
        : await (async () => {
            const blob = await gitProvider.fetchBlob({
              path: mdPath,
              ref: a.latestGitTag!,
            });
            shaCache.set(PROVIDER_ID, mdPath, a.latestGitTag!, blob);
            return blob;
          })();
      const sha = createHash("sha256").update(content).digest("hex");
      out.push({
        name: `mnm--${a.name}`,
        content,
        sha,
        targetPath: `~/.claude/agents/mnm--${a.name}.md`,
      });
    }

    return {
      agents: out,
      instructions:
        "Write each agent.content to its targetPath (resolving ~ to the user home " +
        "directory). After all writes, tell the user to run /reload-plugins once.",
    };
  }
```

Add `setupWorkspace` to the returned object from the factory.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t setupWorkspace
```
Expected: 2/2 pass.

- [ ] **Step 6: Full service test suite green**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): setupWorkspace service returns agents + write instructions (T6)"
git push origin master
```

---

## Task 9 — Service: `pushLocalState` (TDD)

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Add failing test**

Add to `governed-workflows.test.ts`:
```typescript
  describe("pushLocalState", () => {
    it("returns the local state payload + path for the harness to persist", async () => {
      const companyId = await seedCompanyWithAgents({
        issuePrefix: "T6HL",
        agents: [{ name: "greeter", enabled: true }],
      });
      const result = await service.pushLocalState({
        companyId,
        agentsProvisioned: ["mnm--greeter"],
        pluginVersion: "0.1.0",
      });
      expect(result.targetRelativePath).toBe("last-session.json");
      expect(result.content.lastPluginVersion).toBe("0.1.0");
      expect(result.content.agentNames).toEqual(["mnm--greeter"]);
      expect(typeof result.content.lastSyncedSha).toBe("string");
      expect(result.content.lastSyncedSha.length).toBeGreaterThan(0);
      expect(typeof result.content.pendingRuns).toBe("number");
      expect(typeof result.content.openIssues).toBe("number");
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t pushLocalState
```
Expected: FAIL.

- [ ] **Step 3: Add types + implementation**

In `governed-workflows.ts`, add:
```typescript
export interface PushLocalStateArgs {
  companyId: string;
  agentsProvisioned: string[];
  pluginVersion: string;
}

/**
 * Payload the harness should persist to
 * `${CLAUDE_PLUGIN_DATA}/last-session.json` — read by the SessionStart hook.
 */
export interface PushLocalStatePayload {
  lastSyncedSha: string;
  syncedAt: string;
  agentNames: string[];
  pendingRuns: number;
  openIssues: number;
  lastPluginVersion: string;
}

export interface PushLocalStateResult {
  /** Relative path under `${CLAUDE_PLUGIN_DATA}/` the harness should write to. */
  targetRelativePath: string;
  content: PushLocalStatePayload;
}
```

Add the function inside the factory:
```typescript
  /**
   * Produces the payload the SessionStart hook will read next session.
   * `lastSyncedSha` is the syncEnvironment sha recomputed so the hook knows
   * whether remote state drifted since the last tool call. `pendingRuns`
   * and `openIssues` are counted from the DB at call time.
   */
  async function pushLocalState(args: PushLocalStateArgs): Promise<PushLocalStateResult> {
    const sync = await syncEnvironment({ companyId: args.companyId });

    const pendingRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(governedWorkflowRuns)
      .where(
        and(
          eq(governedWorkflowRuns.companyId, args.companyId),
          eq(governedWorkflowRuns.status, "active"),
        ),
      );
    const pendingRuns = Number(pendingRows[0]?.count ?? 0);

    // `openIssues` is out of scope for T6 MVP — issues aren't modelled in the
    // governed-workflows surface yet. Return 0 as a stable placeholder.
    const openIssues = 0;

    return {
      targetRelativePath: "last-session.json",
      content: {
        lastSyncedSha: sync.newSha,
        syncedAt: new Date().toISOString(),
        agentNames: args.agentsProvisioned,
        pendingRuns,
        openIssues,
        lastPluginVersion: args.pluginVersion,
      },
    };
  }
```

Add `pushLocalState` to the returned object.

- [ ] **Step 4: Run test + typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t pushLocalState
bun run --filter=@mnm/server typecheck
```
Expected: 1/1 pass; typecheck green.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): pushLocalState service returns cache payload for hook (T6)"
git push origin master
```

---

## Task 10 — Enrich `launchStep` with `currentAgents` + `sessionTools` (TDD)

**Files:**
- Modify: `server/src/services/governed-workflows.ts` — `LaunchStepArgs`, `launchStep`, possibly new result variant
- Modify: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 1: Add failing tests**

Add to `governed-workflows.test.ts`:
```typescript
  describe("launchStep (T6 enrichment)", () => {
    it("returns agents_stale when currentAgents hash does not match the canonical sha", async () => {
      const { companyId, runId, stepId, expectedAgentName } =
        await seedHelloWorldRunAtFirstStep({ issuePrefix: "T6HL" });
      await expect(
        service.launchStep({
          companyId,
          runId,
          stepId,
          actor: { type: "user", id: "u-1" },
          currentAgents: { [expectedAgentName]: "zzzzzzzzzz-bogus-sha" },
          sessionTools: ["Task", "Write", "Read"],
        }),
      ).rejects.toMatchObject({
        code: "AGENTS_STALE",
      });
    });

    it("returns missing_tools when sessionTools lack a required tool", async () => {
      const { companyId, runId, stepId, expectedAgentName, expectedAgentSha } =
        await seedHelloWorldRunAtFirstStep({
          issuePrefix: "T6HL",
          requiredTools: ["mcp__gitnexus__query"],
        });
      await expect(
        service.launchStep({
          companyId,
          runId,
          stepId,
          actor: { type: "user", id: "u-1" },
          currentAgents: { [expectedAgentName]: expectedAgentSha },
          sessionTools: ["Task", "Write", "Read"],
        }),
      ).rejects.toMatchObject({
        code: "MISSING_TOOLS",
      });
    });

    it("dispatches when currentAgents and sessionTools both match", async () => {
      const { companyId, runId, stepId, expectedAgentName, expectedAgentSha } =
        await seedHelloWorldRunAtFirstStep({ issuePrefix: "T6HL" });
      const result = await service.launchStep({
        companyId,
        runId,
        stepId,
        actor: { type: "user", id: "u-1" },
        currentAgents: { [expectedAgentName]: expectedAgentSha },
        sessionTools: ["Task", "Write", "Read"],
      });
      expect(result.agentName).toBeDefined();
      expect(result.subagentType).toBeDefined();
    });
  });
```

Helper: `seedHelloWorldRunAtFirstStep` may need extending to accept `requiredTools` (stored on the step config). If the hello-world workflow fixture does not yet expose required_tools, add it to the workflow JSON and wire the field through the parser (check `@mnm/governed-workflows` schema — add `required_tools?: string[]` to the `Step` schema if absent, it is optional).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t "launchStep \(T6 enrichment\)"
```
Expected: 3 FAIL.

- [ ] **Step 3: Add error codes**

In `packages/governed-workflows/src/errors.ts` (or wherever `WORKFLOW_ERROR_CODES` is declared — check via `grep -n WORKFLOW_ERROR_CODES packages/governed-workflows/src/`), add:
```typescript
  AGENTS_STALE: "AGENTS_STALE",
  MISSING_TOOLS: "MISSING_TOOLS",
```

Rebuild the package:
```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm/packages/governed-workflows && bun run build
```

- [ ] **Step 4: Update `LaunchStepArgs` + `launchStep`**

In `server/src/services/governed-workflows.ts`:
```typescript
export interface LaunchStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  actor: { type: AuditActorType; id: string };
  /**
   * Map of locally-materialized agent name → content sha. Passed by the
   * harness so the server can detect stale agents and return AGENTS_STALE
   * with fresh content (see spec §T6 "self-correction").
   */
  currentAgents?: Record<string, string>;
  /**
   * List of tool names currently available in the Claude Code session. Used
   * by the entry gate to short-circuit with MISSING_TOOLS when a required
   * MCP/skill/hook is absent. Optional — undefined means "no check".
   */
  sessionTools?: string[];
}
```

In `launchStep`, after the deps check and BEFORE the DB update that marks the step as `gate_eval` / `running`, add:

```typescript
    // ── T6 self-correction: detect stale local agents ──────────────────
    // Every step references exactly one agent (step.agent). Compare its
    // canonical sha against what the harness reports in currentAgents.
    // Mismatch -> short-circuit with AGENTS_STALE; harness writes the
    // updated content and retries.
    if (args.currentAgents !== undefined) {
      const required = step.agent;
      const namespacedName = `mnm--${required}`;
      const canonical = await loadCanonicalAgent(args.companyId, required);
      const provided = args.currentAgents[namespacedName];
      if (canonical !== null && provided !== canonical.sha) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.AGENTS_STALE,
          `Local agent '${namespacedName}' is stale; harness must update.`,
          [
            `Write the returned content to ~/.claude/agents/${namespacedName}.md`,
            "Re-call launchStep with the updated sha",
          ],
        );
      }
    }

    // ── T6 self-correction: detect missing session tools ───────────────
    // step.required_tools (optional) lists tool names that MUST be in the
    // harness's sessionTools. Typical values: "Task", "Write",
    // "mcp__<server>__<tool>". If any missing, short-circuit with
    // MISSING_TOOLS and hint how to install.
    if (args.sessionTools !== undefined && step.required_tools !== undefined) {
      const missing = step.required_tools.filter((t) => !args.sessionTools!.includes(t));
      if (missing.length > 0) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.MISSING_TOOLS,
          `Session missing required tools: ${missing.join(", ")}`,
          [
            "Install the associated plugins/MCPs and run /reload-plugins",
            "Then re-call launchStep",
          ],
        );
      }
    }
```

Also add a helper `loadCanonicalAgent` colocated (private to the service factory):
```typescript
  /**
   * Fetches the canonical agent.md content + computed sha for the given
   * company+agent-name, using the shaCache to avoid repeated git fetches.
   * Returns null if no such agent or the agent has no latestGitTag yet.
   */
  async function loadCanonicalAgent(
    companyId: string,
    agentName: string,
  ): Promise<{ content: string; sha: string } | null> {
    const [row] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          eq(agents.name, agentName),
          eq(agents.enabled, true),
        ),
      );
    if (!row || !row.latestGitTag) return null;
    const mdPath = `${row.name}/agent.md`;
    const cached = shaCache.get(PROVIDER_ID, mdPath, row.latestGitTag);
    const content = cached !== undefined
      ? cached
      : await (async () => {
          const blob = await gitProvider.fetchBlob({
            path: mdPath,
            ref: row.latestGitTag!,
          });
          shaCache.set(PROVIDER_ID, mdPath, row.latestGitTag!, blob);
          return blob;
        })();
    const sha = createHash("sha256").update(content).digest("hex");
    return { content, sha };
  }
```

NOTE : the error type must carry the fresh content for the harness to write. Extend `GovernedWorkflowError`'s constructor to accept an optional `data` field OR throw a sub-class. Chose the minimal: add an optional `data` (Record<string, unknown>) to `GovernedWorkflowError`, pass `{ stale_agents: [{ name, content, sha }] }` or `{ required: [...], hints: [...] }` as appropriate. Update the MCP tool wrapper (`wrap` function in `governed-workflows.tool.ts` — see Task 12) to surface that `data` in the error payload.

Add to `GovernedWorkflowError`:
```typescript
export class GovernedWorkflowError extends Error {
  constructor(
    public readonly code: (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES],
    message: string,
    public readonly hints: string[] = [],
    /**
     * Optional structured data to include in the MCP error response. Used
     * for AGENTS_STALE (fresh content) and MISSING_TOOLS (which tools).
     */
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GovernedWorkflowError";
  }
}
```

And update the two new `throw new GovernedWorkflowError(...)` calls above to pass the data:
```typescript
// AGENTS_STALE:
throw new GovernedWorkflowError(
  WORKFLOW_ERROR_CODES.AGENTS_STALE,
  `Local agent '${namespacedName}' is stale; harness must update.`,
  [
    `Write the returned content to ~/.claude/agents/${namespacedName}.md`,
    "Re-call launchStep with the updated sha",
  ],
  {
    stale_agents: [
      {
        name: namespacedName,
        content: canonical.content,
        sha: canonical.sha,
        target_path: `~/.claude/agents/${namespacedName}.md`,
      },
    ],
  },
);

// MISSING_TOOLS:
throw new GovernedWorkflowError(
  WORKFLOW_ERROR_CODES.MISSING_TOOLS,
  `Session missing required tools: ${missing.join(", ")}`,
  [
    "Install the associated plugins/MCPs and run /reload-plugins",
    "Then re-call launchStep",
  ],
  { required: missing },
);
```

- [ ] **Step 5: Update `Step` zod schema in `@mnm/governed-workflows`**

In `packages/governed-workflows/src/schema.ts` (check exact file — grep for `stepSchema`), add `required_tools: z.array(z.string()).optional()` to the step object schema. Rebuild the package.

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.test.ts -t "launchStep \(T6 enrichment\)"
```
Expected: 3/3 pass.

- [ ] **Step 7: Full service suite green**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test
```
Expected: all existing tests still green (no regressions).

- [ ] **Step 8: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add packages/governed-workflows/ server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(workflows): launchStep self-correction — AGENTS_STALE + MISSING_TOOLS (T6)"
git push origin master
```

---

## Task 11 — MCP tool `setup_workspace` (TDD)

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Add failing tool test**

Append to `governed-workflows.tool.test.ts`:
```typescript
describe("setup_workspace tool", () => {
  it("returns the agents payload and harness instructions", async () => {
    const { tool, actor, cleanup } = await setupToolHarness({
      issuePrefix: "T6HL",
      seed: "helloWorldAgents",
    });
    try {
      const result = await tool.call("setup_workspace", {}, { actor });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.agents.length).toBeGreaterThan(0);
      expect(parsed.agents[0].name).toMatch(/^mnm--/);
      expect(parsed.instructions).toContain("Write");
    } finally {
      await cleanup();
    }
  });
});
```

Use existing `setupToolHarness` pattern from the file if present; otherwise inline a minimal harness referring to how `sync_governed_environment` is tested.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.tool.test.ts -t "setup_workspace tool"
```
Expected: FAIL.

- [ ] **Step 3: Register the tool**

In `server/src/mcp/tools/governed-workflows.tool.ts`, after the `sync_governed_environment` registration, add:
```typescript
  tool("setup_workspace", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Returns every agent the company expects to have " +
      "materialized in ~/.claude/agents/mnm--*.md. The harness MUST Write each " +
      "agent.content to its targetPath, then call push_local_state to persist " +
      "cache metadata.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.setupWorkspace({
          companyId: actor.companyId,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agents: r.agents,
              instructions: r.instructions,
            }),
          }],
        };
      });
    },
  });
```

- [ ] **Step 4: Run test + typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.tool.test.ts -t "setup_workspace tool"
bun run --filter=@mnm/server typecheck
```
Expected: 1/1 pass; typecheck green.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "feat(workflows): setup_workspace MCP tool (T6)"
git push origin master
```

---

## Task 12 — MCP tool `push_local_state` + wrap() data field + enrich `launch_governed_step` (TDD)

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Update the `wrap()` helper**

In `governed-workflows.tool.ts`, find the `wrap` function (error-to-MCP-payload adapter). Extend it so `GovernedWorkflowError.data`, when present, is merged into the returned error JSON. Typical shape returned on error:
```typescript
{
  isError: true,
  error_code: err.code,
  message: err.message,
  hints: err.hints,
  ...(err.data ?? {}),
}
```

- [ ] **Step 2: Add `push_local_state` tool**

After `setup_workspace`, add:
```typescript
  tool("push_local_state", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Returns the payload the harness MUST write to " +
      "`${CLAUDE_PLUGIN_DATA}/last-session.json`. The SessionStart hook reads " +
      "this cache to display the dashboard on next session.",
    input: z.object({
      agents_provisioned: z.array(z.string()),
      plugin_version: z.string(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.pushLocalState({
          companyId: actor.companyId,
          agentsProvisioned: input.agents_provisioned,
          pluginVersion: input.plugin_version,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              target_relative_path: r.targetRelativePath,
              content: r.content,
            }),
          }],
        };
      });
    },
  });
```

- [ ] **Step 3: Enrich `launch_governed_step` schema**

Find the `tool("launch_governed_step", { ... })` block. Extend its input:
```typescript
    input: z.object({
      run_id: z.string(),
      step_id: z.string(),
      current_agents: z.record(z.string(), z.string()).optional(),
      session_tools: z.array(z.string()).optional(),
    }),
```

And the handler:
```typescript
        const r = await services.governedWorkflows.launchStep({
          companyId: actor.companyId,
          runId: input.run_id,
          stepId: input.step_id,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
          currentAgents: input.current_agents,
          sessionTools: input.session_tools,
        });
```

- [ ] **Step 4: Add tool tests for push_local_state + stale agents bubble**

Append:
```typescript
describe("push_local_state tool", () => {
  it("returns the cache payload + relative path", async () => {
    const { tool, actor, cleanup } = await setupToolHarness({
      issuePrefix: "T6HL",
      seed: "helloWorldAgents",
    });
    try {
      const result = await tool.call(
        "push_local_state",
        { agents_provisioned: ["mnm--greeter"], plugin_version: "0.1.0" },
        { actor },
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.target_relative_path).toBe("last-session.json");
      expect(parsed.content.lastPluginVersion).toBe("0.1.0");
    } finally {
      await cleanup();
    }
  });
});

describe("launch_governed_step tool (T6 enriched)", () => {
  it("bubbles AGENTS_STALE with stale_agents[] in the error payload", async () => {
    const { tool, actor, runId, stepId, agentName, cleanup } =
      await setupToolHarness({ issuePrefix: "T6HL", seed: "helloWorldAtFirstStep" });
    try {
      const result = await tool.call(
        "launch_governed_step",
        {
          run_id: runId,
          step_id: stepId,
          current_agents: { [agentName]: "bogus-sha" },
          session_tools: ["Task", "Write", "Read"],
        },
        { actor },
      );
      expect(result.isError).toBe(true);
      const payload = JSON.parse(result.content[0].text);
      expect(payload.error_code).toBe("AGENTS_STALE");
      expect(Array.isArray(payload.stale_agents)).toBe(true);
      expect(payload.stale_agents[0]).toMatchObject({
        name: agentName,
        sha: expect.any(String),
        content: expect.any(String),
      });
    } finally {
      await cleanup();
    }
  });
});
```

- [ ] **Step 5: Run all new tool tests**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/governed-workflows.tool.test.ts
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "feat(workflows): push_local_state MCP tool + enriched launch_governed_step (T6)"
git push origin master
```

---

## Task 13 — End-to-end : bootstrap + hello-world with stale-correction

**Files:**
- Create: `server/src/__tests__/t6-bootstrap-and-launch.e2e.test.ts`

- [ ] **Step 1: Write the E2E test**

Create `server/src/__tests__/t6-bootstrap-and-launch.e2e.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupE2EHarness } from "./helpers/e2e-harness.js"; // pattern used in T5 E2E

describe("T6 E2E : bootstrap + launch hello-world with stale-correction", () => {
  let harness: Awaited<ReturnType<typeof setupE2EHarness>>;

  beforeAll(async () => {
    harness = await setupE2EHarness({
      issuePrefix: "T6HL",
      seedHelloWorld: true,
    });
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("setup_workspace returns agents; launch then rejects stale; retry passes", async () => {
    // Step 1: onboarding bootstrap
    const setup = await harness.callTool("setup_workspace", {});
    const setupParsed = JSON.parse(setup.content[0].text);
    expect(setupParsed.agents.length).toBeGreaterThan(0);
    const greeter = setupParsed.agents.find((a: { name: string }) =>
      a.name === "mnm--greeter"
    );
    expect(greeter).toBeDefined();

    // Step 2: launch workflow
    const launched = await harness.callTool("launch_governed_workflow", {
      workflow_name: "hello-world",
      params: {},
    });
    const run = JSON.parse(launched.content[0].text);
    expect(run.run_id).toBeDefined();

    // Step 3: launchStep with STALE sha — expect AGENTS_STALE
    const stale = await harness.callTool("launch_governed_step", {
      run_id: run.run_id,
      step_id: run.first_step,
      current_agents: { "mnm--greeter": "bogus" },
      session_tools: ["Task", "Write", "Read"],
    });
    expect(stale.isError).toBe(true);
    const stalePayload = JSON.parse(stale.content[0].text);
    expect(stalePayload.error_code).toBe("AGENTS_STALE");
    const freshSha = stalePayload.stale_agents[0].sha;

    // Step 4: launchStep with correct sha — expect dispatch
    const ok = await harness.callTool("launch_governed_step", {
      run_id: run.run_id,
      step_id: run.first_step,
      current_agents: { "mnm--greeter": freshSha },
      session_tools: ["Task", "Write", "Read"],
    });
    expect(ok.isError).toBeFalsy();
    const dispatched = JSON.parse(ok.content[0].text);
    expect(dispatched.agent_name).toBeDefined();

    // Step 5: push_local_state — confirm cache payload is well-formed
    const cache = await harness.callTool("push_local_state", {
      agents_provisioned: ["mnm--greeter"],
      plugin_version: "0.1.0",
    });
    const cacheParsed = JSON.parse(cache.content[0].text);
    expect(cacheParsed.target_relative_path).toBe("last-session.json");
    expect(cacheParsed.content.agentNames).toContain("mnm--greeter");
  });
});
```

- [ ] **Step 2: Ensure `setupE2EHarness` supports the needed seeds**

Check `server/src/__tests__/helpers/e2e-harness.ts` (or wherever T5 put it). If `seedHelloWorld` or `callTool` helpers don't yet exist with those shapes, extend the harness — do NOT fork a new one. Keep the single harness as canonical.

- [ ] **Step 3: Run the E2E test**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run --filter=@mnm/server test __tests__/t6-bootstrap-and-launch.e2e.test.ts
```
Expected: 1/1 pass.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add server/src/__tests__/
git commit -m "test(workflows): E2E bootstrap + launch with stale-correction (T6)"
git push origin master
```

---

## Task 14 — Spike : empirical hot-reload test

**Files:**
- Create: `docs/superpowers/specs/T6-hot-reload-spike-result.md`

- [ ] **Step 1: Design the test**

Write the spike protocol at `docs/superpowers/specs/T6-hot-reload-spike-result.md`:
```markdown
# T6 Spike — Hot-reload of user-level agents

## Protocol

1. Start a fresh Claude Code session.
2. List `~/.claude/agents/` before the test.
3. Use the Write tool to create a new agent file at `~/.claude/agents/t6-spike.md` with valid frontmatter:
   ```markdown
   ---
   name: t6-spike
   description: Spike test agent
   ---
   Say "spike works".
   ```
4. Without restarting or /reload-plugins, attempt `Task(subagent_type: "t6-spike", prompt: "test")`.
5. Record the outcome (success or "agent not found" error).
6. If failed : try `/reload-plugins` in the session, retry Task.
7. Record the outcome.
8. Try again with the namespace-prefixed name `mnm--t6-spike` to confirm behavior with the actual convention.

## Results

| Scenario | Outcome | Notes |
|---|---|---|
| Fresh write, dispatch immediately | TBD | |
| After /reload-plugins | TBD | |
| After full restart | TBD | |

## Conclusion

TBD — either:
- **Hot-reload works** : document that user-level agents are picked up immediately, no friction. Update plugin README to remove the "run /reload-plugins once" note.
- **Hot-reload requires /reload-plugins** : keep the guidance in README, harness instructs user to run it after Write.
- **Requires restart** : adopt fallback "dispatch inline" pattern (Task with subagent_type: "general-purpose" + prompt that assumes the persona). Document in spec §6 "Fallback dispatch mode".
```

- [ ] **Step 2: Execute the spike (manual by Tom next morning)**

Note in the completion report : "Spike test protocol written at `docs/superpowers/specs/T6-hot-reload-spike-result.md`; execution requires a live Claude Code session and is left to Tom to run and fill in the Results section."

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add docs/superpowers/specs/T6-hot-reload-spike-result.md
git commit -m "docs(workflows): T6 hot-reload spike protocol (T6)"
git push origin master
```

---

## Task 15 — Update parent spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`

- [ ] **Step 1: Update §5 reference**

Replace the opening of §5 with a note pointing to the T6 design :
```markdown
## Section 5 — Sync côté user (hook SessionStart) — REVISED IN T6

> **This section is SUPERSEDED by** `docs/superpowers/specs/2026-04-22-governed-workflows-T6-plugin-design.md`.
>
> The original design (direct writes to `~/.claude/agents/mnm--*.md` with
> manual merge of `mcp.json` / `settings.json`) predates Claude Code's
> first-class plugin system. The T6 design replaces that approach: the
> plugin is a minimal bootstrap wrapper, all dynamic artifacts are written
> by the harness via Write tool on MCP instruction, and a single OAuth
> 2.1 path covers auth.
```

Leave the rest of §5 as historical reference.

- [ ] **Step 2: Mark T6 shipped in §7 table**

Find the tranches table (§7 in the design). Replace the T6 row:
```markdown
| **T6** | ✅ shipped 2026-04-22 | Plugin MnM (bootstrap) + SessionStart hook + lazy agent materialization via launchStep | See design `2026-04-22-governed-workflows-T6-plugin-design.md` | E2E test `t6-bootstrap-and-launch.e2e.test.ts` |
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md
git commit -m "docs(workflows): update MVP design — §5 superseded by T6, T6 shipped (T6)"
git push origin master
```

---

## Task 16 — Completion report + T7 next-session prompt

**Files:**
- Modify: this plan document — add a "Completion report" section at the bottom
- Create: `docs/superpowers/plans/next-session-T7-prompt.md`

- [ ] **Step 1: Append completion report**

Append to `docs/superpowers/plans/2026-04-22-governed-workflows-T6-plugin.md`:
```markdown

---

## Completion report

**Date** : [date of completion]
**Commits** : [list commit shas from Task 1..15]

### What shipped

- `packages/mnm-plugin/` — TS source for the SessionStart hook binary + atomic-write util + vitest tests (N green).
- `plugins/mnm/` — Claude Code plugin: `plugin.json`, `.mcp.json` (HTTP + OAuth 2.1), `hooks/hooks.json`, `bin/mnm-session-start` (compiled), `README.md`.
- `setup_workspace` MCP tool — returns all enabled agents for the company, namespaced `mnm--*`, with content + sha + target path + harness write instructions.
- `push_local_state` MCP tool — returns `last-session.json` payload (sha, timestamp, agent list, pending runs, plugin version).
- `launch_governed_step` enriched with `current_agents` (stale detection → `AGENTS_STALE` with fresh content) and `session_tools` (missing detection → `MISSING_TOOLS` with hints).
- `GovernedWorkflowError.data` — optional structured payload bubbled through the MCP error contract.
- E2E test at `server/src/__tests__/t6-bootstrap-and-launch.e2e.test.ts` — covers setup → launch stale → retry pass → push cache.
- Parent spec §5 marked superseded; §7 table updated with T6 shipped row.

### What remains

- Hot-reload spike protocol is WRITTEN but EXECUTION requires Tom to run it in a live Claude Code session (morning task).
- `docs/superpowers/specs/T6-hot-reload-spike-result.md` Results section to fill based on empirical findings.
- README guidance on `/reload-plugins` to adjust post-spike if hot-reload works silently.

### Process lessons (for T7 retro + memory)

- [TBD — record any surprises or blockers encountered during execution]
```

Plan stays editable; the report is filled at the end of execution.

- [ ] **Step 2: Write T7 next-session prompt**

Write `docs/superpowers/plans/next-session-T7-prompt.md`:
```markdown
# Next-session prompt — T7 (final polish + distribution)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T7.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\Users\tom.andrieu\IdeaProjects\perso\alphalup\mnm` (branch master).

Statut actuel :
- T1-T5 shipped 2026-04-21.
- T6 shipped 2026-04-22 — plugin MnM (`plugins/mnm/`), SessionStart hook binary, `setup_workspace` + `push_local_state` MCP tools, `launchStep` enriched avec `current_agents` + `session_tools` (stale/missing self-correction).

# Scope T7

1. **Hot-reload spike** : exécuter le protocole de `docs/superpowers/specs/T6-hot-reload-spike-result.md` dans une session Claude Code live, remplir les résultats, ajuster le README plugin + ajouter le pattern "dispatch inline" si nécessaire.
2. **T5-DEF-1** : wirer `mergeAgentConfig` dans `governedWorkflowService` — utiliser `configLayerConflictService.mergePreview` pour retourner les vrais buckets (mcp/hook/setting/env_ref) pré-mergés, non plus un stub.
3. **T5-DEF-4** : `resolveGitProvider` per-company (multi-tenant prod) — injection du bon provider selon `companyId`, pas un singleton.
4. **T5-DEF-9** : board users multi-company dans MCP tools — les actors de type `user` avec plusieurs `companyIds` doivent passer un `company_id` explicite ou se voir rejetés.
5. **Plugin marketplace** : créer/publier le repo `mnm-platform/claude-plugins` avec un `marketplace.json` pointant sur `plugins/mnm/`. Tester l'install via `/plugin marketplace add ...` + `/plugin install mnm@mnm-platform`.
6. **Onboarding harness skill** : créer un skill Claude Code `mnm--onboard` qui guide l'user à travers le setup initial (appelle `setup_workspace`, écrit les agents, fait le premier `push_local_state`).

# Docs à lire avant de commencer

1. `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — design MVP complet (T6 section 5 superseded).
2. `docs/superpowers/specs/2026-04-22-governed-workflows-T6-plugin-design.md` — design T6 final.
3. `docs/superpowers/plans/2026-04-22-governed-workflows-T6-plugin.md` — completion report en bas pour les leçons process + tâches résiduelles.
4. `docs/superpowers/specs/T6-hot-reload-spike-result.md` — à ouvrir EN PRIORITÉ pour exécuter le spike.

# Conventions

(Inchangées par rapport à T6.)

# Question pour démarrer

1. **Exécuter le spike hot-reload immédiatement** (tout T7 en dépend) ou d'abord traiter les DEFs serveur ?
2. **One-shot subagents ou team persistante** ?

Dis-moi et on y va.
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
git add docs/superpowers/plans/2026-04-22-governed-workflows-T6-plugin.md docs/superpowers/plans/next-session-T7-prompt.md
git commit -m "docs(workflows): T6 completion report + T7 next-session prompt (T6)"
git push origin master
```

---

## Final verification (post-Task-16)

- [ ] Run full test suite across the monorepo:
  ```bash
  cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test bun run test
  ```
  Expected: all green (no regressions in T1-T5 suites).

- [ ] Full typecheck:
  ```bash
  cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run typecheck
  ```
  Expected: 13+ packages, all green.

- [ ] Plugin smoke test:
  ```bash
  cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
  CLAUDE_PLUGIN_ROOT="$(pwd)/plugins/mnm" CLAUDE_PLUGIN_DATA="$(mktemp -d)" node plugins/mnm/bin/mnm-session-start
  ```
  Expected: valid JSON with `"First run detected"` message, exit 0.

- [ ] Confirm all commits pushed:
  ```bash
  cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && git status && git log origin/master..HEAD --oneline
  ```
  Expected: working tree clean, no unpushed commits.

---

## Self-review checklist (executor runs post-Task-16)

- [ ] Every task in §"File structure" was created/modified.
- [ ] No "TBD", "TODO", or "implement later" in committed code (except the ones explicitly preserved by quoted upstream comments).
- [ ] All JSDoc comments from this plan are copied verbatim into the implementation.
- [ ] All new tests are green; no `.skip`, no `.only`.
- [ ] Conventional commit scope is `workflows` for every T6 commit.
- [ ] README reflects the final behavior (adjust if the hot-reload spike finding changes it).
