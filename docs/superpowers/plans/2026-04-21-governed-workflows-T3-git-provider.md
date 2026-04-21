# Governed Workflows — T3 GitProvider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a minimal `GitProvider` abstraction (interface + 2 implementations) that lets the server fetch blobs / list tags / commit files against a git remote, so T4 (gate runner) and T5 (MCP tools) can pull `workflow.json`, `.gate.ts` sources, and `agent.md` at a pinned `git_sha`. User-initiated commits carry the user's author identity, not the bot token.

**Architecture:** New workspace package `@mnm/git-provider` under `packages/git-provider/`. Exposes `GitProvider` interface + two concrete classes: `GitlabProvider` (production — GitLab REST v4 over native `fetch`, bot token for auth, user email/name stamped as commit author) and `LocalBareRepoProvider` (tests + dev — shells out to `git` CLI against a `--bare` repo). In-memory sha-keyed cache (`ShaCache`) sits at the interface boundary so every `fetchBlob({ path, ref: "<sha>" })` is memoized for the process lifetime. No disk cache in MVP. Errors collapse to a typed `GitProviderError` with a closed-set `code` (`not_found | unauthorized | rate_limited | timeout | network | conflict | unknown`) so callers (gate runner, MCP orchestrator) can pattern-match deterministically. No webhook listener — spec §7 "Points ouverts" item (webhook GitLab post-commit) is **deferred to T5**; T3 is pull + push only.

**Tech Stack:** TypeScript 5.7, vitest 3, native `fetch` (Node 20+ global), `node:child_process`, `node:fs/promises`, `node:path`, `node:os` (for LocalBareRepoProvider temp worktrees). **Zero runtime dependencies.** The test for `LocalBareRepoProvider` shells out to the system `git` binary — every MnM dev environment already has git.

**Source spec:** `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — Section 1 (archi globale, role GitLab EnterpriseCustomer), Section 2 (fetch-on-demand), Section 7 (T3 row + "Points ouverts" list).

**Scope of T3:** Only the GitProvider abstraction + its two implementations + in-memory cache + error class. No orchestration, no DB writes, no MCP wiring, no ingestion of `workflow.json` / `agent.md`. T3 is independent of T1 (package) and T2 (DB) — they already shipped. Consumers land in T4 (gate runner loads `.gate.ts` via `fetchBlob`), T5 (MCP `loadWorkflowAtSha` and `listWorkflows` pull `workflow.json` + tags), T7 (hello-world bootstrap `commitFile`s the seed repo content).

---

## Deviations from spec (intentional, explained here)

| Spec says | Plan does | Why |
|---|---|---|
| "Webhook GitLab post-commit (pour update `latest_git_tag` async) — activer en T3 ou reporter à T5" | Deferred to T5. | T3 is strictly pull + push. A webhook listener needs an HTTP route, signature verification, a DB writer, and a company↔project mapping — all of which compose more naturally with T5's MCP/router stack. Locking the pull+push surface first lets T4 start in parallel. Flagged under "Deferred follow-ups" below. |
| "cache in-memory par `git_sha`" | Cache is a separate `ShaCache` class, not built into the providers. | The runner (T4) and the loader (T5) will reuse the same cache logic with different providers. Making it a standalone class avoids duplication and allows us to unit-test cache eviction/size semantics in isolation. |
| "MnM commit au nom de l'user (author) avec son token bot" | Provider takes `authorName` + `authorEmail` explicitly on `commitFile`. Caller is responsible for plumbing through the user identity. | Decouples auth (bot token at construction) from authorship (per-call). Same factory call, per-commit author swapping, matches how audit actors already work. Plumbing the actual user id lands in T5. |
| No explicit retry/timeout policy in spec. Open item: "Gestion d'erreurs : retries ? rate limit GitLab ? timeouts ?" | Fixed: `fetchWithRetry` — 3 attempts max, exponential backoff 250/750/2250 ms, retries only `5xx` / `429`, timeout 10s via `AbortSignal.timeout`, respects `RateLimit-Remaining` header (backoff if `<10`). | Closes the open item. Conservative defaults — tunable at provider construction. |
| Open item: "Où le GitProvider vit : nouveau package ou dans `packages/server/` ?" | New workspace package `@mnm/git-provider`. | Makes it importable from `server/`, from any future CLI worker, and from tests without pulling the server runtime. Matches the pattern of `@mnm/governed-workflows` (T1), `@mnm/adapter-utils`, `@mnm/shared`. |
| Open item: "Format exact du fetch blob (path + ref) vs fetch tree" | Single `fetchBlob({ path, ref })` method returning `string`. No tree API in MVP. | Callers know their paths (`workflow.json`, `agent.md`, `gates/<name>.gate.ts`). Tree listing is not on any consumer's critical path until skills / dynamic discovery lands post-MVP. |

---

## File Structure

All new code lives under `packages/git-provider/`. One new workspace. Root `package.json` already picks up `packages/*` — no workspace-config change needed.

| File | Responsibility |
|---|---|
| `packages/git-provider/package.json` | Workspace manifest, zero runtime deps, vitest + typescript devDeps. |
| `packages/git-provider/tsconfig.json` | Inherits root. `rootDir: "src"`, `outDir: "dist"`. |
| `packages/git-provider/vitest.config.ts` | Minimal — `environment: "node"`, mirrors `governed-workflows`. |
| `packages/git-provider/src/index.ts` | Public barrel — re-exports interface, error class, cache, both providers, every type. |
| `packages/git-provider/src/types.ts` | `GitProvider` interface + argument/return types (`FetchBlobArgs`, `ListTagsArgs`, `Tag`, `CommitFileArgs`, `CommitFileResult`, `ResolveRefArgs`, `PathExistsArgs`). |
| `packages/git-provider/src/errors.ts` | `GitProviderError` class + `GIT_PROVIDER_ERROR_CODES` frozen tuple + `GitProviderErrorCode` type. |
| `packages/git-provider/src/sha-cache.ts` | `ShaCache` class — Map-backed, keyed by `${providerId}|${path}|${sha}`, only caches sha-pinned reads. Stores `string` values. Max entries (default 500), FIFO eviction. |
| `packages/git-provider/src/local-bare-repo-provider.ts` | `LocalBareRepoProvider` — wraps a `git --git-dir=...` bare repo. Implements all 5 `GitProvider` methods. `commitFile` uses a temp worktree. |
| `packages/git-provider/src/gitlab-provider.ts` | `GitlabProvider` — wraps `https://<host>/api/v4/projects/<id>` with a bot token. Includes `fetchWithRetry` helper. |
| `packages/git-provider/src/__tests__/fixtures/make-bare-repo.ts` | Test helper — creates a throwaway bare repo in `os.tmpdir()` with a seed commit. Returned handle exposes `cleanup()`. |
| `packages/git-provider/src/__tests__/errors.test.ts` | Unit — `GitProviderError` construction + `code` tuple closed-set. |
| `packages/git-provider/src/__tests__/sha-cache.test.ts` | Unit — get/set/evict. |
| `packages/git-provider/src/__tests__/local-bare-repo-provider.test.ts` | Integration (spawns `git`) — every method against a real bare repo. |
| `packages/git-provider/src/__tests__/gitlab-provider.test.ts` | Unit — all HTTP calls through a mocked `fetch` (`vi.fn()` + `globalThis.fetch`). |
| `packages/git-provider/src/__tests__/integration.test.ts` | End-to-end — `LocalBareRepoProvider.commitFile` → `listTags` (via tag creation) → `resolveRef` → `fetchBlob` round-trip, no mocks. Uses the fixture helper. |

---

## Open items flagged for validation before execution

All 4 open items from spec §7 are resolved in this plan with **defaults** (marked below). Confirm or override before kickoff:

1. **[DEFAULT]** Package lives at `packages/git-provider/`, name `@mnm/git-provider`. Alternative: inside `packages/server/` — rejected for workspace cleanliness.
2. **[DEFAULT]** Webhook GitLab post-commit → **deferred to T5**. T3 = pull + push only.
3. **[DEFAULT]** API surface = 5 methods: `fetchBlob`, `listTags`, `resolveRef`, `pathExists`, `commitFile`. No tree listing, no branch listing, no blob writing outside of a commit.
4. **[DEFAULT]** Error + retry policy: 6 error codes closed-set, GitLab retries 5xx/429 with backoff 250/750/2250 ms, 10 s timeout via `AbortSignal.timeout`, respects `RateLimit-Remaining` header.

Nothing else to confirm before execution.

---

## Task 1: Scaffold `@mnm/git-provider` workspace

**Files:**
- Create: `packages/git-provider/package.json`
- Create: `packages/git-provider/tsconfig.json`
- Create: `packages/git-provider/vitest.config.ts`
- Create: `packages/git-provider/src/index.ts`
- Create: `packages/git-provider/src/__tests__/scaffold.test.ts`

- [ ] **Step 1: Write the failing scaffold test**

Create `packages/git-provider/src/__tests__/scaffold.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("@mnm/git-provider scaffold", () => {
  it("package exports an index barrel", async () => {
    const mod = await import("../index.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — module not found or package not discoverable from root vitest config.

- [ ] **Step 3: Create `packages/git-provider/package.json`**

```json
{
  "name": "@mnm/git-provider",
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
  "devDependencies": {
    "@types/node": "^24.6.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 4: Create `packages/git-provider/tsconfig.json`**

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

(`exclude` keeps test files out of the shipped `dist/` — same convention as `packages/db/tsconfig.json` after the T2 sweep.)

- [ ] **Step 5: Create `packages/git-provider/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 6: Create the empty barrel**

Create `packages/git-provider/src/index.ts`:

```typescript
// Empty barrel — populated by subsequent tasks.
export {};
```

- [ ] **Step 7: Install workspace dependencies**

Run: `bun install`
Expected: `@mnm/git-provider` appears in the workspace graph. No errors.

- [ ] **Step 8: Run the test, expect PASS**

Run: `bunx vitest run packages/git-provider`
Expected: 1 passing.

- [ ] **Step 9: Typecheck the new package**

Run: `bun run --filter @mnm/git-provider typecheck`
Expected: no output (success).

- [ ] **Step 10: Commit**

```bash
git add packages/git-provider package.json bun.lockb
git commit -m "chore(workflows): scaffold @mnm/git-provider package"
git push
```

(Only include `package.json` / `bun.lockb` if `bun install` modified them.)

---

## Task 2: `GitProviderError` class + error code tuple

**Files:**
- Create: `packages/git-provider/src/errors.ts`
- Create: `packages/git-provider/src/__tests__/errors.test.ts`
- Modify: `packages/git-provider/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  GIT_PROVIDER_ERROR_CODES,
  GitProviderError,
  type GitProviderErrorCode,
} from "../errors.js";

describe("GIT_PROVIDER_ERROR_CODES", () => {
  it("is a closed set of 7 codes", () => {
    expect(Object.values(GIT_PROVIDER_ERROR_CODES).sort()).toEqual(
      [
        "conflict",
        "network",
        "not_found",
        "rate_limited",
        "timeout",
        "unauthorized",
        "unknown",
      ].sort(),
    );
  });

  it("is frozen", () => {
    expect(Object.isFrozen(GIT_PROVIDER_ERROR_CODES)).toBe(true);
  });
});

describe("GitProviderError", () => {
  it("exposes code, message, status, cause", () => {
    const cause = new Error("boom");
    const err = new GitProviderError("not_found", "path not at ref", {
      status: 404,
      cause,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GitProviderError");
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("path not at ref");
    expect(err.status).toBe(404);
    expect(err.cause).toBe(cause);
  });

  it("accepts a code without options", () => {
    const err = new GitProviderError("network", "offline");
    expect(err.status).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });

  it("narrows the code type to GitProviderErrorCode", () => {
    // @ts-expect-error — "not-a-code" is not assignable
    new GitProviderError("not-a-code", "x");
    const code: GitProviderErrorCode = "timeout";
    expect(code).toBe("timeout");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — module `../errors.js` not found.

- [ ] **Step 3: Create `packages/git-provider/src/errors.ts`**

```typescript
/**
 * Closed-set error codes returned by every GitProvider implementation.
 * Callers (gate runner, MCP orchestrator) pattern-match on `.code` to decide
 * retry vs surface-to-user vs fail-closed.
 */
export const GIT_PROVIDER_ERROR_CODES = Object.freeze({
  not_found: "not_found",
  unauthorized: "unauthorized",
  rate_limited: "rate_limited",
  timeout: "timeout",
  network: "network",
  conflict: "conflict",
  unknown: "unknown",
} as const);

export type GitProviderErrorCode =
  (typeof GIT_PROVIDER_ERROR_CODES)[keyof typeof GIT_PROVIDER_ERROR_CODES];

export interface GitProviderErrorOptions {
  status?: number;
  cause?: unknown;
}

export class GitProviderError extends Error {
  readonly code: GitProviderErrorCode;
  readonly status: number | undefined;

  constructor(
    code: GitProviderErrorCode,
    message: string,
    options: GitProviderErrorOptions = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "GitProviderError";
    this.code = code;
    this.status = options.status;
  }
}
```

- [ ] **Step 4: Wire into the barrel**

Edit `packages/git-provider/src/index.ts`:

```typescript
export {
  GIT_PROVIDER_ERROR_CODES,
  GitProviderError,
  type GitProviderErrorCode,
  type GitProviderErrorOptions,
} from "./errors.js";
```

- [ ] **Step 5: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/errors.ts packages/git-provider/src/__tests__/errors.test.ts packages/git-provider/src/index.ts
git commit -m "feat(workflows): add GitProviderError + closed-set error codes"
git push
```

---

## Task 3: `GitProvider` interface + argument/return types

**Files:**
- Create: `packages/git-provider/src/types.ts`
- Create: `packages/git-provider/src/__tests__/types.test.ts`
- Modify: `packages/git-provider/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "../types.js";

describe("GitProvider interface", () => {
  it("exposes five methods with the expected shapes", () => {
    expectTypeOf<GitProvider["fetchBlob"]>().parameters.toEqualTypeOf<[FetchBlobArgs]>();
    expectTypeOf<GitProvider["fetchBlob"]>().returns.toEqualTypeOf<Promise<string>>();

    expectTypeOf<GitProvider["listTags"]>().parameters.toEqualTypeOf<[ListTagsArgs?]>();
    expectTypeOf<GitProvider["listTags"]>().returns.toEqualTypeOf<Promise<Tag[]>>();

    expectTypeOf<GitProvider["resolveRef"]>().parameters.toEqualTypeOf<[ResolveRefArgs]>();
    expectTypeOf<GitProvider["resolveRef"]>().returns.toEqualTypeOf<Promise<string>>();

    expectTypeOf<GitProvider["pathExists"]>().parameters.toEqualTypeOf<[PathExistsArgs]>();
    expectTypeOf<GitProvider["pathExists"]>().returns.toEqualTypeOf<Promise<boolean>>();

    expectTypeOf<GitProvider["commitFile"]>().parameters.toEqualTypeOf<[CommitFileArgs]>();
    expectTypeOf<GitProvider["commitFile"]>().returns.toEqualTypeOf<Promise<CommitFileResult>>();
  });

  it("Tag is { name, sha }", () => {
    expectTypeOf<Tag>().toEqualTypeOf<{ name: string; sha: string }>();
  });

  it("CommitFileArgs requires author identity", () => {
    expectTypeOf<CommitFileArgs>().toMatchTypeOf<{
      path: string;
      content: string;
      message: string;
      branch: string;
      authorName: string;
      authorEmail: string;
    }>();
  });

  it("CommitFileResult exposes the created commit sha", () => {
    expectTypeOf<CommitFileResult>().toEqualTypeOf<{ sha: string }>();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — `../types.js` not resolvable.

- [ ] **Step 3: Create `packages/git-provider/src/types.ts`**

```typescript
/**
 * Arguments accepted by GitProvider methods.
 * `ref` is a sha OR a tag name OR a branch name. Implementations MUST resolve it.
 * `path` is POSIX-style, repo-relative, no leading slash (e.g. "hello-world/workflow.json").
 */

export interface FetchBlobArgs {
  path: string;
  ref: string;
}

export interface ListTagsArgs {
  prefix?: string;
}

export interface Tag {
  name: string;
  sha: string;
}

export interface ResolveRefArgs {
  ref: string;
}

export interface PathExistsArgs {
  path: string;
  ref: string;
}

export interface CommitFileArgs {
  path: string;
  content: string;
  message: string;
  branch: string;
  authorName: string;
  authorEmail: string;
}

export interface CommitFileResult {
  sha: string;
}

/**
 * Minimal git surface the governed-workflows runtime needs. Implemented by:
 * - `LocalBareRepoProvider` (tests + single-dev local mode)
 * - `GitlabProvider` (production — GitLab REST v4)
 *
 * Contract:
 * - Every method rejects with a `GitProviderError` (never a raw Error).
 * - `fetchBlob` / `pathExists` are memoizable by caller only when `ref` is a sha
 *   (implementations do NOT memoize — that's the `ShaCache`'s job, wired by the
 *   consumer in T4/T5).
 * - `commitFile` creates one commit stamped with the supplied author identity,
 *   even if the provider authenticates with a bot token.
 */
export interface GitProvider {
  fetchBlob(args: FetchBlobArgs): Promise<string>;
  listTags(args?: ListTagsArgs): Promise<Tag[]>;
  resolveRef(args: ResolveRefArgs): Promise<string>;
  pathExists(args: PathExistsArgs): Promise<boolean>;
  commitFile(args: CommitFileArgs): Promise<CommitFileResult>;
}
```

- [ ] **Step 4: Wire into the barrel**

Append to `packages/git-provider/src/index.ts`:

```typescript
export type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "./types.js";
```

- [ ] **Step 5: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/types.ts packages/git-provider/src/__tests__/types.test.ts packages/git-provider/src/index.ts
git commit -m "feat(workflows): define GitProvider interface + arg types"
git push
```

---

## Task 4: `ShaCache` — in-memory memoization keyed by sha

**Files:**
- Create: `packages/git-provider/src/sha-cache.ts`
- Create: `packages/git-provider/src/__tests__/sha-cache.test.ts`
- Modify: `packages/git-provider/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/sha-cache.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ShaCache } from "../sha-cache.js";

describe("ShaCache", () => {
  it("stores and retrieves a value by (providerId, path, sha)", () => {
    const cache = new ShaCache();
    cache.set("gitlab:42", "hello-world/workflow.json", "abc123", "{hello}");
    expect(cache.get("gitlab:42", "hello-world/workflow.json", "abc123")).toBe("{hello}");
  });

  it("returns undefined for a miss", () => {
    const cache = new ShaCache();
    expect(cache.get("gitlab:42", "x", "y")).toBeUndefined();
  });

  it("isolates keys by providerId", () => {
    const cache = new ShaCache();
    cache.set("gitlab:42", "p", "s", "A");
    cache.set("gitlab:43", "p", "s", "B");
    expect(cache.get("gitlab:42", "p", "s")).toBe("A");
    expect(cache.get("gitlab:43", "p", "s")).toBe("B");
  });

  it("isolates keys by path", () => {
    const cache = new ShaCache();
    cache.set("p", "a.json", "s", "A");
    cache.set("p", "b.json", "s", "B");
    expect(cache.get("p", "a.json", "s")).toBe("A");
    expect(cache.get("p", "b.json", "s")).toBe("B");
  });

  it("evicts the oldest entry when maxEntries is reached (FIFO)", () => {
    const cache = new ShaCache({ maxEntries: 2 });
    cache.set("p", "a", "s1", "A");
    cache.set("p", "b", "s2", "B");
    cache.set("p", "c", "s3", "C");
    expect(cache.get("p", "a", "s1")).toBeUndefined(); // evicted
    expect(cache.get("p", "b", "s2")).toBe("B");
    expect(cache.get("p", "c", "s3")).toBe("C");
  });

  it("`size()` reflects current entry count", () => {
    const cache = new ShaCache({ maxEntries: 10 });
    expect(cache.size()).toBe(0);
    cache.set("p", "a", "s", "A");
    expect(cache.size()).toBe(1);
  });

  it("`clear()` empties the cache", () => {
    const cache = new ShaCache();
    cache.set("p", "a", "s", "A");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("p", "a", "s")).toBeUndefined();
  });

  it("defaults maxEntries to 500", () => {
    const cache = new ShaCache();
    for (let i = 0; i < 500; i++) cache.set("p", `f${i}`, "s", "v");
    expect(cache.size()).toBe(500);
    cache.set("p", "f500", "s", "v"); // triggers eviction
    expect(cache.size()).toBe(500);
    expect(cache.get("p", "f0", "s")).toBeUndefined();
    expect(cache.get("p", "f500", "s")).toBe("v");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — `../sha-cache.js` not resolvable.

- [ ] **Step 3: Create `packages/git-provider/src/sha-cache.ts`**

```typescript
/**
 * Process-lifetime memoization for sha-pinned blob reads.
 *
 * Rationale: commit shas are immutable, so once we've resolved
 * `(providerId, path, sha) -> content`, the content will never change. This
 * cache lives at the consumer boundary (T4 gate runner, T5 MCP loader) so every
 * process reuse of the same workflow version is free.
 *
 * Eviction is FIFO by insertion order (JS `Map` iteration order) bounded by
 * `maxEntries`. Good enough for MVP — MnM runs are short-lived and the working
 * set is small (typically <50 files per active workflow revision).
 */
export interface ShaCacheOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class ShaCache {
  private readonly entries = new Map<string, string>();
  private readonly maxEntries: number;

  constructor(options: ShaCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private key(providerId: string, path: string, sha: string): string {
    return `${providerId}|${path}|${sha}`;
  }

  get(providerId: string, path: string, sha: string): string | undefined {
    return this.entries.get(this.key(providerId, path, sha));
  }

  set(providerId: string, path: string, sha: string, value: string): void {
    const k = this.key(providerId, path, sha);
    // Re-setting an existing key should not count as a new entry.
    if (!this.entries.has(k) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(k, value);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
```

- [ ] **Step 4: Wire into the barrel**

Append to `packages/git-provider/src/index.ts`:

```typescript
export { ShaCache, type ShaCacheOptions } from "./sha-cache.js";
```

- [ ] **Step 5: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/sha-cache.ts packages/git-provider/src/__tests__/sha-cache.test.ts packages/git-provider/src/index.ts
git commit -m "feat(workflows): add ShaCache for sha-keyed blob memoization"
git push
```

---

## Task 5: Test fixture — `makeBareRepo` helper

**Files:**
- Create: `packages/git-provider/src/__tests__/fixtures/make-bare-repo.ts`
- Create: `packages/git-provider/src/__tests__/fixtures/make-bare-repo.test.ts`

The fixture is used by Task 6, Task 7, and Task 10. Building it first (with its own tests) means the providers' tests get a known-good scaffolding.

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/fixtures/make-bare-repo.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { makeBareRepo } from "./make-bare-repo.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) {
    const cleanup = cleanups.pop();
    if (cleanup) await cleanup();
  }
});

describe("makeBareRepo fixture", () => {
  it("returns a path to a bare repo with a seed commit", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "README.md": "hello" },
      branch: "main",
    });
    cleanups.push(repo.cleanup);

    expect(existsSync(repo.dir)).toBe(true);
    const refs = execFileSync("git", ["--git-dir", repo.dir, "branch", "--list"], {
      encoding: "utf8",
    });
    expect(refs).toContain("main");
  });

  it("exposes the seed commit sha", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "a.txt": "1" },
      branch: "main",
    });
    cleanups.push(repo.cleanup);
    expect(repo.seedSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("cleanup removes the tmp dir", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "a.txt": "1" },
      branch: "main",
    });
    await repo.cleanup();
    expect(existsSync(repo.dir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — `./make-bare-repo.js` not resolvable.

- [ ] **Step 3: Create `packages/git-provider/src/__tests__/fixtures/make-bare-repo.ts`**

```typescript
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MakeBareRepoOptions {
  /**
   * Files committed to the initial (seed) revision. Keys are repo-relative
   * POSIX paths. Values are file contents.
   */
  seedFiles: Record<string, string>;
  /**
   * Branch name to point at the seed commit. Defaults to "main".
   */
  branch?: string;
}

export interface BareRepoHandle {
  /** Absolute path to the `--bare` repo (points `--git-dir` at this). */
  dir: string;
  /** Commit sha of the seed revision. */
  seedSha: string;
  /** Remove the tmp work/bare directories. Idempotent. */
  cleanup: () => Promise<void>;
}

/**
 * Creates a throwaway bare git repo seeded with the given files on the given
 * branch. Used by provider tests. Requires a `git` binary on PATH.
 */
export async function makeBareRepo(
  options: MakeBareRepoOptions,
): Promise<BareRepoHandle> {
  const branch = options.branch ?? "main";
  const root = await mkdtemp(join(tmpdir(), "mnm-git-provider-"));
  const bareDir = join(root, "repo.git");
  const workDir = join(root, "work");

  await mkdir(bareDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const runIn = async (cwd: string, args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  };

  // Initialise the bare repo.
  await runIn(bareDir, ["init", "--bare", "--initial-branch", branch]);

  // Seed via a throwaway worktree cloned from the bare repo.
  await runIn(workDir, ["init", "--initial-branch", branch]);
  await runIn(workDir, ["remote", "add", "origin", bareDir]);

  for (const [relPath, content] of Object.entries(options.seedFiles)) {
    const abs = join(workDir, relPath);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  await runIn(workDir, ["add", "-A"]);
  await runIn(workDir, [
    "-c",
    "user.name=seed",
    "-c",
    "user.email=seed@mnm.test",
    "commit",
    "-m",
    "seed",
  ]);
  await runIn(workDir, ["push", "origin", branch]);
  const seedSha = await runIn(workDir, ["rev-parse", "HEAD"]);

  return {
    dir: bareDir,
    seedSha,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bunx vitest run packages/git-provider`
Expected: 3 passing (scaffold + errors + types + sha-cache already green, fixture newly green).

- [ ] **Step 5: Commit**

```bash
git add packages/git-provider/src/__tests__/fixtures/make-bare-repo.ts packages/git-provider/src/__tests__/fixtures/make-bare-repo.test.ts
git commit -m "test(workflows): add makeBareRepo fixture for git-provider tests"
git push
```

---

## Task 6: `LocalBareRepoProvider` — read operations

**Files:**
- Create: `packages/git-provider/src/local-bare-repo-provider.ts`
- Create: `packages/git-provider/src/__tests__/local-bare-repo-provider.read.test.ts`
- Modify: `packages/git-provider/src/index.ts`

This task ships all the read methods (`fetchBlob`, `resolveRef`, `listTags`, `pathExists`). `commitFile` lands in Task 7.

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/local-bare-repo-provider.read.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { GitProviderError } from "../errors.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;

beforeAll(async () => {
  repo = await makeBareRepo({
    seedFiles: {
      "workflow.json": '{"name":"hello-world"}',
      "gates/greet.gate.ts": "export default () => ({ pass: true, report: 'ok' });",
    },
    branch: "main",
  });
  // Add a tag on the seed commit for listTags tests.
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v1.0.0", repo.seedSha]);
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v1.1.0", repo.seedSha]);
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "preview-1", repo.seedSha]);
  provider = new LocalBareRepoProvider({ providerId: "local-test", repoDir: repo.dir });
});

afterAll(async () => {
  await repo.cleanup();
});

describe("LocalBareRepoProvider.fetchBlob", () => {
  it("returns file content at a sha", async () => {
    const content = await provider.fetchBlob({ path: "workflow.json", ref: repo.seedSha });
    expect(content).toBe('{"name":"hello-world"}');
  });

  it("resolves a tag ref to the right blob", async () => {
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "v1.0.0" });
    expect(content).toBe('{"name":"hello-world"}');
  });

  it("throws GitProviderError(not_found) for a missing path", async () => {
    await expect(
      provider.fetchBlob({ path: "does/not/exist.json", ref: repo.seedSha }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws GitProviderError(not_found) for a missing ref", async () => {
    await expect(
      provider.fetchBlob({ path: "workflow.json", ref: "does-not-exist" }),
    ).rejects.toBeInstanceOf(GitProviderError);
  });
});

describe("LocalBareRepoProvider.resolveRef", () => {
  it("resolves a tag to a sha", async () => {
    const sha = await provider.resolveRef({ ref: "v1.0.0" });
    expect(sha).toBe(repo.seedSha);
  });

  it("resolves a branch to a sha", async () => {
    const sha = await provider.resolveRef({ ref: "main" });
    expect(sha).toBe(repo.seedSha);
  });

  it("passes a sha through unchanged", async () => {
    const sha = await provider.resolveRef({ ref: repo.seedSha });
    expect(sha).toBe(repo.seedSha);
  });

  it("throws not_found for an unknown ref", async () => {
    await expect(provider.resolveRef({ ref: "nope" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("LocalBareRepoProvider.listTags", () => {
  it("lists all tags sorted alphabetically with their shas", async () => {
    const tags = await provider.listTags();
    expect(tags.map((t) => t.name).sort()).toEqual(["preview-1", "v1.0.0", "v1.1.0"]);
    for (const tag of tags) {
      expect(tag.sha).toBe(repo.seedSha);
    }
  });

  it("filters by prefix", async () => {
    const tags = await provider.listTags({ prefix: "v1." });
    expect(tags.map((t) => t.name).sort()).toEqual(["v1.0.0", "v1.1.0"]);
  });

  it("returns [] for a prefix that matches nothing", async () => {
    const tags = await provider.listTags({ prefix: "beta-" });
    expect(tags).toEqual([]);
  });
});

describe("LocalBareRepoProvider.pathExists", () => {
  it("returns true for a tracked path", async () => {
    expect(await provider.pathExists({ path: "workflow.json", ref: "main" })).toBe(true);
  });

  it("returns true for a tracked nested path", async () => {
    expect(
      await provider.pathExists({ path: "gates/greet.gate.ts", ref: repo.seedSha }),
    ).toBe(true);
  });

  it("returns false for a missing path", async () => {
    expect(await provider.pathExists({ path: "nope.md", ref: "main" })).toBe(false);
  });

  it("throws not_found for an unknown ref", async () => {
    await expect(
      provider.pathExists({ path: "workflow.json", ref: "no-such-ref" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — `../local-bare-repo-provider.js` not resolvable.

- [ ] **Step 3: Create `packages/git-provider/src/local-bare-repo-provider.ts` (read operations only)**

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitProviderError } from "./errors.js";
import type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "./types.js";

const execFileAsync = promisify(execFile);

export interface LocalBareRepoProviderOptions {
  /** Stable id used for cache keys and error messages. */
  providerId: string;
  /** Absolute path to the bare repo (the `.git` dir or a `--bare` clone). */
  repoDir: string;
}

/**
 * GitProvider backed by a local `--bare` repo accessed through the `git` CLI.
 * Used by tests and by the single-dev local mode. Not production-grade — every
 * call spawns `git`.
 */
export class LocalBareRepoProvider implements GitProvider {
  readonly providerId: string;
  private readonly repoDir: string;

  constructor(options: LocalBareRepoProviderOptions) {
    this.providerId = options.providerId;
    this.repoDir = options.repoDir;
  }

  async fetchBlob(args: FetchBlobArgs): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "cat-file", "-p", `${args.ref}:${args.path}`],
        { maxBuffer: 1024 * 1024 * 16 },
      );
      // `git cat-file -p` appends a trailing newline for text blobs, but
      // preserves binary content byte-for-byte. We surface it verbatim — callers
      // parse JSON/TS which are byte-exact.
      return stdout;
    } catch (cause) {
      throw this.classifyGitError(cause, "fetchBlob", { path: args.path, ref: args.ref });
    }
  }

  async resolveRef(args: ResolveRefArgs): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "rev-parse", "--verify", `${args.ref}^{commit}`],
      );
      return stdout.trim();
    } catch (cause) {
      throw this.classifyGitError(cause, "resolveRef", { ref: args.ref });
    }
  }

  async listTags(args?: ListTagsArgs): Promise<Tag[]> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "--git-dir",
          this.repoDir,
          "for-each-ref",
          "--format=%(refname:short)\t%(objectname)",
          "refs/tags",
        ],
      );
      const lines = stdout.split("\n").filter((l) => l.length > 0);
      const all: Tag[] = lines.map((line) => {
        const [name = "", sha = ""] = line.split("\t");
        return { name, sha };
      });
      if (args?.prefix) {
        return all.filter((t) => t.name.startsWith(args.prefix!));
      }
      return all;
    } catch (cause) {
      throw this.classifyGitError(cause, "listTags", { prefix: args?.prefix });
    }
  }

  async pathExists(args: PathExistsArgs): Promise<boolean> {
    // Verify the ref first so we can distinguish "missing ref" (error) from
    // "missing path at valid ref" (boolean false).
    await this.resolveRef({ ref: args.ref });
    try {
      await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "cat-file", "-e", `${args.ref}:${args.path}`],
      );
      return true;
    } catch {
      return false;
    }
  }

  async commitFile(_args: CommitFileArgs): Promise<CommitFileResult> {
    // Implemented in Task 7.
    throw new GitProviderError("unknown", "commitFile not yet implemented");
  }

  private classifyGitError(
    cause: unknown,
    op: string,
    ctx: Record<string, unknown>,
  ): GitProviderError {
    const msg = cause instanceof Error ? cause.message : String(cause);
    const ctxStr = Object.entries(ctx)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    // Push-failure patterns → conflict (non-fast-forward, lock contention).
    // Callers (T4/T5) can retry after re-reading state.
    if (/rejected|non-fast-forward|cannot lock ref|failed to push/i.test(msg)) {
      return new GitProviderError(
        "conflict",
        `git ${op} conflict (${ctxStr}): ${msg}`,
        { cause },
      );
    }
    // git's stderr for missing refs/paths always includes one of these markers.
    // Case-insensitive /i means "not a valid" subsumes "Not a valid object".
    if (
      /unknown revision|not a valid|does not exist|bad revision|Needed a single revision|invalid object name/i.test(
        msg,
      )
    ) {
      return new GitProviderError(
        "not_found",
        `git ${op} failed (${ctxStr}): ${msg}`,
        { cause },
      );
    }
    return new GitProviderError(
      "unknown",
      `git ${op} failed (${ctxStr}): ${msg}`,
      { cause },
    );
  }
}
```

- [ ] **Step 4: Wire into the barrel**

Append to `packages/git-provider/src/index.ts`:

```typescript
export {
  LocalBareRepoProvider,
  type LocalBareRepoProviderOptions,
} from "./local-bare-repo-provider.js";
```

- [ ] **Step 5: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

Expected: all read-path assertions green. `commitFile` has no test yet.

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/local-bare-repo-provider.ts packages/git-provider/src/__tests__/local-bare-repo-provider.read.test.ts packages/git-provider/src/index.ts
git commit -m "feat(workflows): LocalBareRepoProvider read operations"
git push
```

---

## Task 7: `LocalBareRepoProvider.commitFile` via temp worktree

**Files:**
- Modify: `packages/git-provider/src/local-bare-repo-provider.ts`
- Create: `packages/git-provider/src/__tests__/local-bare-repo-provider.commit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/local-bare-repo-provider.commit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;

beforeEach(async () => {
  repo = await makeBareRepo({
    seedFiles: { "README.md": "hello\n" },
    branch: "main",
  });
  provider = new LocalBareRepoProvider({ providerId: "local-test", repoDir: repo.dir });
});

afterEach(async () => {
  await repo.cleanup();
});

describe("LocalBareRepoProvider.commitFile", () => {
  it("adds a new file and returns the new commit sha", async () => {
    const result = await provider.commitFile({
      path: "workflow.json",
      content: '{"name":"hello-world"}',
      message: "add workflow",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.sha).not.toBe(repo.seedSha);

    // Verify the blob landed on main.
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "main" });
    expect(content.trim()).toBe('{"name":"hello-world"}');
  });

  it("stamps the requested author on the commit (not the runner's git config)", async () => {
    const result = await provider.commitFile({
      path: "file.txt",
      content: "x",
      message: "add file",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    const { stdout } = await execFileAsync(
      "git",
      [
        "--git-dir",
        repo.dir,
        "show",
        "--quiet",
        "--format=%an <%ae>",
        result.sha,
      ],
    );
    expect(stdout.trim()).toBe("Tom User <tom@example.com>");
  });

  it("updates an existing file", async () => {
    await provider.commitFile({
      path: "README.md",
      content: "updated\n",
      message: "bump readme",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });
    const content = await provider.fetchBlob({ path: "README.md", ref: "main" });
    expect(content).toBe("updated\n");
  });

  it("creates nested directories as needed", async () => {
    await provider.commitFile({
      path: "gates/deep/nested/check.gate.ts",
      content: "export default () => ({ pass: true, report: 'ok' });\n",
      message: "add nested gate",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });
    expect(
      await provider.pathExists({ path: "gates/deep/nested/check.gate.ts", ref: "main" }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — all 4 new commit tests throw `GitProviderError("unknown", "commitFile not yet implemented")`.

- [ ] **Step 3: Implement `commitFile`**

In `packages/git-provider/src/local-bare-repo-provider.ts`, add these imports at the top:

```typescript
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
```

Replace the placeholder `commitFile` method:

```typescript
  async commitFile(args: CommitFileArgs): Promise<CommitFileResult> {
    const work = await mkdtemp(join(tmpdir(), "mnm-git-provider-work-"));
    try {
      // Shallow clone the branch we're about to commit to.
      await execFileAsync(
        "git",
        ["clone", "--quiet", "--branch", args.branch, "--single-branch", this.repoDir, work],
      );

      // Write the file (creating nested dirs).
      const abs = join(work, args.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, args.content, "utf8");

      // Stage + commit with the requested author identity. Use -c flags rather
      // than env vars so the command is deterministic (no ambient GIT_* leakage).
      await execFileAsync("git", ["-C", work, "add", "--", args.path]);
      await execFileAsync(
        "git",
        [
          "-C",
          work,
          "-c",
          `user.name=${args.authorName}`,
          "-c",
          `user.email=${args.authorEmail}`,
          "commit",
          "-m",
          args.message,
          "--author",
          `${args.authorName} <${args.authorEmail}>`,
        ],
      );

      // Push back to the bare repo.
      await execFileAsync("git", ["-C", work, "push", "origin", args.branch]);

      // Read the new sha.
      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "rev-parse", `refs/heads/${args.branch}`],
      );
      return { sha: stdout.trim() };
    } catch (cause) {
      throw this.classifyGitError(cause, "commitFile", {
        path: args.path,
        branch: args.branch,
      });
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
```

- [ ] **Step 4: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/git-provider/src/local-bare-repo-provider.ts packages/git-provider/src/__tests__/local-bare-repo-provider.commit.test.ts
git commit -m "feat(workflows): LocalBareRepoProvider.commitFile via temp worktree"
git push
```

---

## Task 8: `GitlabProvider` — read operations + retry/timeout

**Files:**
- Create: `packages/git-provider/src/gitlab-provider.ts`
- Create: `packages/git-provider/src/__tests__/gitlab-provider.read.test.ts`
- Modify: `packages/git-provider/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/gitlab-provider.read.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitlabProvider } from "../gitlab-provider.js";

const BASE = "https://gitlab.example.com";
const PROJECT = "123";
const TOKEN = "glpat-test";

function makeProvider(overrides: { maxRetries?: number; timeoutMs?: number } = {}) {
  return new GitlabProvider({
    providerId: `gitlab:${PROJECT}`,
    baseUrl: BASE,
    projectId: PROJECT,
    token: TOKEN,
    maxRetries: overrides.maxRetries,
    timeoutMs: overrides.timeoutMs,
  });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabProvider.fetchBlob", () => {
  it("GETs /repository/files/:path/raw?ref=... with the bot token", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, '{"name":"hello"}'));
    const provider = makeProvider();
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "v1.0.0" });
    expect(content).toBe('{"name":"hello"}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/files/workflow.json/raw?ref=v1.0.0`,
    );
    expect((init as RequestInit).headers).toMatchObject({ "PRIVATE-TOKEN": TOKEN });
  });

  it("URL-encodes slashes in the path", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, "x"));
    const provider = makeProvider();
    await provider.fetchBlob({ path: "gates/greet.gate.ts", ref: "main" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/files/gates%2Fgreet.gate.ts/raw");
  });

  it("throws not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "File Not Found" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "missing", ref: "main" }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("throws unauthorized on 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "bad token" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("retries on 5xx up to maxRetries then fails", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(500, "boom"))
      .mockResolvedValueOnce(textResponse(502, "bad gw"))
      .mockResolvedValueOnce(textResponse(503, "unavailable"));
    const provider = makeProvider({ maxRetries: 2, timeoutMs: 1000 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unknown", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on 429 and succeeds on the retry", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(429, "slow down"))
      .mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider({ maxRetries: 2 });
    const content = await provider.fetchBlob({ path: "x", ref: "main" });
    expect(content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns rate_limited when 429 exhausts retries", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(429, "1"))
      .mockResolvedValueOnce(textResponse(429, "2"))
      .mockResolvedValueOnce(textResponse(429, "3"));
    const provider = makeProvider({ maxRetries: 2 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("throws timeout when the request aborts", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValue(err);
    const provider = makeProvider({ maxRetries: 0, timeoutMs: 50 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("throws network for other fetch errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const provider = makeProvider({ maxRetries: 0 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "network" });
  });
});

describe("GitlabProvider.resolveRef", () => {
  it("returns the sha from /repository/commits/:ref", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "abc123", short_id: "abc1" }),
    );
    const provider = makeProvider();
    const sha = await provider.resolveRef({ ref: "v1.0.0" });
    expect(sha).toBe("abc123");
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/commits/v1.0.0`,
    );
  });

  it("throws not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "404" }));
    const provider = makeProvider();
    await expect(provider.resolveRef({ ref: "nope" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("GitlabProvider.listTags", () => {
  it("GETs /repository/tags with search=<prefix> when provided", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { name: "v1.0.0", commit: { id: "aaa" } },
        { name: "v1.1.0", commit: { id: "bbb" } },
      ]),
    );
    const provider = makeProvider();
    const tags = await provider.listTags({ prefix: "v1." });
    expect(tags).toEqual([
      { name: "v1.0.0", sha: "aaa" },
      { name: "v1.1.0", sha: "bbb" },
    ]);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/tags?search=%5Ev1.`,
    );
  });

  it("GETs without search when no prefix", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    const provider = makeProvider();
    await provider.listTags();
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/tags`,
    );
  });
});

describe("GitlabProvider.pathExists", () => {
  it("HEAD /repository/files/:path?ref=... returns true on 200", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const provider = makeProvider();
    expect(await provider.pathExists({ path: "workflow.json", ref: "main" })).toBe(true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("HEAD");
  });

  it("returns false on 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = makeProvider();
    expect(await provider.pathExists({ path: "x", ref: "main" })).toBe(false);
  });

  it("propagates unauthorized on 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const provider = makeProvider();
    await expect(
      provider.pathExists({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — `../gitlab-provider.js` not resolvable.

- [ ] **Step 3: Create `packages/git-provider/src/gitlab-provider.ts`**

```typescript
import { GitProviderError, type GitProviderErrorCode } from "./errors.js";
import type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "./types.js";

export interface GitlabProviderOptions {
  /** Stable id used for cache keys and error messages (e.g. `gitlab:12345`). */
  providerId: string;
  /** API root, e.g. `https://gitlab.example.com`. No trailing slash required. */
  baseUrl: string;
  /** Numeric or URL-encoded project id (GitLab accepts both). */
  projectId: string;
  /** Bot token (`glpat-...`). Sent as `PRIVATE-TOKEN` header. */
  token: string;
  /** Per-request timeout, default 10s. */
  timeoutMs?: number;
  /** Max retries on 5xx/429, default 2 (so 3 attempts total). */
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_MS = [250, 750, 2250];

export class GitlabProvider implements GitProvider {
  readonly providerId: string;
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: GitlabProviderOptions) {
    this.providerId = options.providerId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.projectId = options.projectId;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private projectPath(): string {
    return `${this.baseUrl}/api/v4/projects/${encodeURIComponent(this.projectId)}`;
  }

  async fetchBlob(args: FetchBlobArgs): Promise<string> {
    const url = `${this.projectPath()}/repository/files/${encodeURIComponent(args.path)}/raw?ref=${encodeURIComponent(args.ref)}`;
    const res = await this.request(url, { method: "GET" }, "fetchBlob");
    return res.text();
  }

  async resolveRef(args: ResolveRefArgs): Promise<string> {
    const url = `${this.projectPath()}/repository/commits/${encodeURIComponent(args.ref)}`;
    const res = await this.request(url, { method: "GET" }, "resolveRef");
    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      throw new GitProviderError(
        "unknown",
        `GitLab resolveRef returned no commit id for ref=${args.ref}`,
      );
    }
    return body.id;
  }

  async listTags(args?: ListTagsArgs): Promise<Tag[]> {
    const qs = args?.prefix
      ? `?search=${encodeURIComponent(`^${args.prefix}`)}`
      : "";
    const url = `${this.projectPath()}/repository/tags${qs}`;
    const res = await this.request(url, { method: "GET" }, "listTags");
    const body = (await res.json()) as Array<{
      name: string;
      commit: { id: string };
    }>;
    return body.map((t) => ({ name: t.name, sha: t.commit.id }));
  }

  async pathExists(args: PathExistsArgs): Promise<boolean> {
    const url = `${this.projectPath()}/repository/files/${encodeURIComponent(args.path)}?ref=${encodeURIComponent(args.ref)}`;
    try {
      await this.request(url, { method: "HEAD" }, "pathExists");
      return true;
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") return false;
      throw err;
    }
  }

  async commitFile(_args: CommitFileArgs): Promise<CommitFileResult> {
    // Implemented in Task 9.
    throw new GitProviderError("unknown", "commitFile not yet implemented");
  }

  private async request(
    url: string,
    init: RequestInit,
    op: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "PRIVATE-TOKEN": this.token,
      ...(init.headers as Record<string, string> | undefined),
    };
    const attempts = this.maxRetries + 1;
    let lastError: GitProviderError | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.ok) return res;

        // Non-retryable: 4xx except 429.
        if (res.status !== 429 && res.status < 500) {
          throw this.httpError(res, op);
        }

        // Retryable. Save + maybe retry.
        lastError = this.httpError(res, op);
        if (attempt < attempts - 1) {
          await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
          continue;
        }
        throw lastError;
      } catch (cause) {
        if (cause instanceof GitProviderError) {
          // Already classified. Either retryable (loop continues) or not (rethrow).
          if (
            cause.code === "rate_limited" ||
            (cause.status !== undefined && cause.status >= 500)
          ) {
            if (attempt < attempts - 1) {
              await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
              lastError = cause;
              continue;
            }
          }
          throw cause;
        }
        // AbortError → timeout; TypeError etc → network. Do not retry network errors.
        const code: GitProviderErrorCode =
          cause instanceof Error && cause.name === "AbortError" ? "timeout" : "network";
        throw new GitProviderError(
          code,
          `GitLab ${op} ${code} (${url}): ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    }

    // Unreachable — loop either returned or threw. Satisfy TS.
    throw lastError ?? new GitProviderError("unknown", `GitLab ${op}: retries exhausted`);
  }

  private httpError(res: Response, op: string): GitProviderError {
    const code: GitProviderErrorCode =
      res.status === 404
        ? "not_found"
        : res.status === 401 || res.status === 403
          ? "unauthorized"
          : res.status === 429
            ? "rate_limited"
            : res.status >= 500
              ? "unknown"
              : "unknown";
    return new GitProviderError(
      code,
      `GitLab ${op} HTTP ${res.status} ${res.statusText}`,
      { status: res.status },
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Wire into the barrel**

Append to `packages/git-provider/src/index.ts`:

```typescript
export { GitlabProvider, type GitlabProviderOptions } from "./gitlab-provider.js";
```

- [ ] **Step 5: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/gitlab-provider.ts packages/git-provider/src/__tests__/gitlab-provider.read.test.ts packages/git-provider/src/index.ts
git commit -m "feat(workflows): GitlabProvider read ops + retry/timeout"
git push
```

---

## Task 9: `GitlabProvider.commitFile` with user-stamped author

**Files:**
- Modify: `packages/git-provider/src/gitlab-provider.ts`
- Create: `packages/git-provider/src/__tests__/gitlab-provider.commit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/git-provider/src/__tests__/gitlab-provider.commit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitlabProvider } from "../gitlab-provider.js";

const BASE = "https://gitlab.example.com";
const PROJECT = "123";
const TOKEN = "glpat-test";

function makeProvider() {
  return new GitlabProvider({
    providerId: `gitlab:${PROJECT}`,
    baseUrl: BASE,
    projectId: PROJECT,
    token: TOKEN,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabProvider.commitFile", () => {
  it("POSTs /repository/commits with a single action + user-stamped author", async () => {
    // Gate file exists? -> 404 means "create".
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 })) // HEAD files/<path>?ref=branch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "newsha123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    const result = await provider.commitFile({
      path: "hello-world/workflow.json",
      content: '{"name":"hello"}',
      message: "add hello-world workflow",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(result).toEqual({ sha: "newsha123" });

    // Second call is the commits POST.
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/commits`,
    );
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "PRIVATE-TOKEN": TOKEN,
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({
      branch: "main",
      commit_message: "add hello-world workflow",
      author_name: "Tom User",
      author_email: "tom@example.com",
      actions: [
        {
          action: "create",
          file_path: "hello-world/workflow.json",
          content: '{"name":"hello"}',
        },
      ],
    });
  });

  it("uses action=update when the file already exists on the branch", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // HEAD -> exists
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "sha2" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    await provider.commitFile({
      path: "README.md",
      content: "updated",
      message: "bump",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });

    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.actions[0].action).toBe("update");
  });

  it("throws conflict on 400 from GitLab commits endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "A file with this name already exists" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    await expect(
      provider.commitFile({
        path: "README.md",
        content: "x",
        message: "x",
        branch: "main",
        authorName: "Tom",
        authorEmail: "tom@example.com",
      }),
    ).rejects.toMatchObject({ code: "conflict", status: 400 });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bunx vitest run packages/git-provider`
Expected: FAIL — tests throw `"commitFile not yet implemented"` (3 failures).

- [ ] **Step 3: Replace `commitFile` in `gitlab-provider.ts`**

Replace the placeholder:

```typescript
  async commitFile(args: CommitFileArgs): Promise<CommitFileResult> {
    const exists = await this.pathExists({ path: args.path, ref: args.branch });
    const action = exists ? "update" : "create";

    const url = `${this.projectPath()}/repository/commits`;
    const payload = {
      branch: args.branch,
      commit_message: args.message,
      author_name: args.authorName,
      author_email: args.authorEmail,
      actions: [
        {
          action,
          file_path: args.path,
          content: args.content,
        },
      ],
    };

    let res: Response;
    try {
      res = await this.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "commitFile",
      );
    } catch (err) {
      // 400 from the commits endpoint is typically "file exists" / "branch conflict".
      if (err instanceof GitProviderError && err.status === 400) {
        throw new GitProviderError(
          "conflict",
          `GitLab commitFile conflict (${args.path}@${args.branch}): ${err.message}`,
          { status: 400, cause: err },
        );
      }
      throw err;
    }

    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      throw new GitProviderError(
        "unknown",
        `GitLab commitFile returned no commit id for ${args.path}`,
      );
    }
    return { sha: body.id };
  }
```

Note: `request()` already throws `GitProviderError` on 4xx responses, so we catch there and rewrite 400 → `conflict`. 404/401 retain their codes.

- [ ] **Step 4: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/git-provider/src/gitlab-provider.ts packages/git-provider/src/__tests__/gitlab-provider.commit.test.ts
git commit -m "feat(workflows): GitlabProvider.commitFile with user-stamped author"
git push
```

---

## Task 10: End-to-end integration test (Local bare repo round-trip)

**Files:**
- Create: `packages/git-provider/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `packages/git-provider/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider, ShaCache } from "../index.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;
const cache = new ShaCache();

beforeAll(async () => {
  repo = await makeBareRepo({
    seedFiles: { ".keep": "" },
    branch: "main",
  });
  provider = new LocalBareRepoProvider({
    providerId: "local-e2e",
    repoDir: repo.dir,
  });
});

afterAll(async () => {
  await repo.cleanup();
});

describe("GitProvider round-trip (Local bare repo)", () => {
  it("commits a workflow, tags it, then fetches it back by tag and sha", async () => {
    // 1. commit the workflow.
    const { sha } = await provider.commitFile({
      path: "hello-world/workflow.json",
      content: '{"name":"hello-world","steps":[]}',
      message: "seed hello-world",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(sha).toMatch(/^[0-9a-f]{40}$/);

    // 2. create a tag on the bare repo directly (tagging via MCP is T5 scope).
    await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v0.1.0", sha]);

    // 3. listTags sees the tag.
    const tags = await provider.listTags({ prefix: "v" });
    expect(tags).toEqual([{ name: "v0.1.0", sha }]);

    // 4. resolveRef returns the same sha.
    expect(await provider.resolveRef({ ref: "v0.1.0" })).toBe(sha);

    // 5. fetchBlob by tag + sha returns identical content.
    const byTag = await provider.fetchBlob({ path: "hello-world/workflow.json", ref: "v0.1.0" });
    const bySha = await provider.fetchBlob({ path: "hello-world/workflow.json", ref: sha });
    expect(byTag.trim()).toBe('{"name":"hello-world","steps":[]}');
    expect(bySha).toBe(byTag);

    // 6. pathExists for a known tracked path.
    expect(
      await provider.pathExists({ path: "hello-world/workflow.json", ref: sha }),
    ).toBe(true);
    expect(
      await provider.pathExists({ path: "not-here.json", ref: sha }),
    ).toBe(false);

    // 7. ShaCache memoizes the sha-keyed read.
    cache.set(provider.providerId, "hello-world/workflow.json", sha, bySha);
    expect(cache.get(provider.providerId, "hello-world/workflow.json", sha)).toBe(bySha);
  });
});
```

- [ ] **Step 2: Run test + typecheck, expect PASS**

```bash
bunx vitest run packages/git-provider
bun run --filter @mnm/git-provider typecheck
```

Expected: integration test green. No mocks involved.

- [ ] **Step 3: Commit**

```bash
git add packages/git-provider/src/__tests__/integration.test.ts
git commit -m "test(workflows): add GitProvider round-trip integration test"
git push
```

---

## Task 11: Final barrel audit + cross-package typecheck + sweep

**Files:** verification only (potentially minor edits).

- [ ] **Step 1: Audit the final barrel**

Read `packages/git-provider/src/index.ts` and verify the complete export list matches:

```typescript
// errors
export {
  GIT_PROVIDER_ERROR_CODES,
  GitProviderError,
  type GitProviderErrorCode,
  type GitProviderErrorOptions,
} from "./errors.js";

// types
export type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "./types.js";

// cache
export { ShaCache, type ShaCacheOptions } from "./sha-cache.js";

// providers
export {
  LocalBareRepoProvider,
  type LocalBareRepoProviderOptions,
} from "./local-bare-repo-provider.js";
export { GitlabProvider, type GitlabProviderOptions } from "./gitlab-provider.js";
```

If the actual file diverges (e.g. one provider forgot to re-export its options), fix it inline and move to Step 2.

- [ ] **Step 2: Add a public-surface barrel assertion**

Append to an existing test (`packages/git-provider/src/__tests__/scaffold.test.ts`) — keeps scaffold lightweight but pins the public surface:

```typescript
describe("public barrel surface", () => {
  it("exposes every T3 export", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    const expected = [
      "GIT_PROVIDER_ERROR_CODES",
      "GitProviderError",
      "ShaCache",
      "LocalBareRepoProvider",
      "GitlabProvider",
    ];
    for (const k of expected) {
      expect(mod).toHaveProperty(k);
    }
  });
});
```

Run `bunx vitest run packages/git-provider` — expect PASS.

- [ ] **Step 3: Full-workspace typecheck**

Run: `bun run typecheck`
Expected: same green baseline as before T3. Pre-existing failures allowed (Windows `embedded-postgres-windows`, etc. — see T2 completion report).

Any new failure in `@mnm/git-provider`, `@mnm/server`, `@mnm/shared`, or a workspace that imports from `@mnm/git-provider` is a T3 regression — fix before committing.

- [ ] **Step 4: Full test suite**

Run: `bun run test:run`
Expected: every `packages/git-provider` test file green (unit + integration + barrel). No regression elsewhere.

- [ ] **Step 5: Verify reachability from another workspace**

One-liner sanity check (no file written):

```bash
node --input-type=module -e "import('@mnm/git-provider').then(m => { const keys=['GitProviderError','ShaCache','LocalBareRepoProvider','GitlabProvider','GIT_PROVIDER_ERROR_CODES']; for (const k of keys) { if (!(k in m)) throw new Error('Missing: '+k); } console.log('OK'); })"
```

Expected: `OK`.

- [ ] **Step 6: Parity tracker**

Per project CLAUDE.md rule: any PR touching desktop/web parity should consider `scripts/parity/data.ts`. T3 is pure server-side plumbing — no UI, no IPC, no desktop-native capability — so no parity change. Add this line to the PR body:

> No `scripts/parity/data.ts` change: T3 is server-side plumbing (GitProvider abstraction), no UI or desktop surface introduced. Parity entries will arrive with T5 (MCP tools) and T6 (SessionStart hook).

- [ ] **Step 7: Sweep commit (only if Step 1 surfaced edits)**

If Step 1 found any export drift fixed inline, or if `bun install` dirtied the lockfile, stage and commit:

```bash
git add -A
git commit -m "chore(workflows): T3 final sweep — barrel + lockfile"
git push
```

Otherwise skip — no empty commit.

- [ ] **Step 8: Completion report append**

Append a completion report section at the bottom of this plan file following the T2 template. No commit — the completion report is part of the tranche wrap-up.

---

## Post-T3 handoff checklist

- [ ] `packages/git-provider/` workspace exists and is picked up by `bun install`.
- [ ] `GitProvider` interface + all 5 method signatures match the types documented in this plan.
- [ ] `GitProviderError` with closed-set `code` (7 values) is shipped and re-exported from the barrel.
- [ ] `ShaCache` with FIFO eviction + configurable max is shipped with unit tests.
- [ ] `LocalBareRepoProvider` implements all 5 methods; tests cover read, commit, author stamping, nested-dir creation.
- [ ] `GitlabProvider` implements all 5 methods; tests cover read paths, retry-on-5xx/429, timeout, 404/401/429 classification, commit-file create/update, 400→conflict remap.
- [ ] End-to-end integration test green (commit → tag → listTags → resolveRef → fetchBlob round-trip).
- [ ] `bun run typecheck` green (minus pre-existing Windows embedded-postgres failure).
- [ ] `bun run test:run` green for every `packages/git-provider/**.test.ts`.
- [ ] Each task committed as one conventional-commit message, all pushed to `origin/master`.
- [ ] Spec §7 table row for T3 updated to ✅ shipped with commit range.

---

## Deferred follow-ups

| # | Item | Owner | Rationale |
|---|------|-------|-----------|
| 1 | Webhook GitLab post-commit → update `governed_workflow_definitions.latest_git_tag` async | T5 | Needs HTTP route, signature verification, DB writer. Composes with T5's MCP stack. |
| 2 | Disk-backed cache layer under `ShaCache` | Post-MVP | MVP memory cache is plenty. Disk would help across cold starts but MnM processes are long-lived. |
| 3 | GitHubProvider / GiteaProvider | Post-MVP | MVP targets GitLab EnterpriseCustomer exclusively. Abstraction is already in place — a 3rd provider is an additive change. |
| 4 | Tree listing / dynamic discovery API (`listTree`) | Post-MVP | Not on any MVP consumer's critical path. `workflow.json` drives the path list. |
| 5 | Commit signing (GPG/SSH) | Post-MVP | Spec doesn't require it MVP. GitLab bot token + audited user author is sufficient audit trail. |
| 6 | Rate limit header introspection (`RateLimit-Remaining`) | T5 / T6 | Current retry strategy treats 429 as signal enough. Reading `RateLimit-Remaining` pre-emptively would avoid one hit before backoff. Low priority. |

---

## Agent team standing orders (Option B execution)

If this plan is executed by a persistent team (T2-style `impl`/`spec-rev`/`quality-rev`), the team-lead MUST include the following standing orders in the `TeamCreate` brief. They encode the T2 retrospective lessons:

1. **TaskList ownership is advisory only.** `TaskUpdate owner=...` is a labelling operation. Work starts ONLY when the team-lead sends a `SendMessage` to the assigned teammate. Ignore self-claimed tasks.
2. **Pre-commit staged-diff audit is mandatory.** Before every `git commit`, run `git diff --staged` and ban the following paths unless explicitly part of the task: `.claude/`, `node_modules/`, `dist/`, `bun.lockb` (unless Task 1 touched it), `/tmp/`, any binary or compiled artifact.
3. **N Minors from review → 1 fix commit.** Do not ship N separate fix commits for N Minors from the same review cycle. Collect, batch, one commit with subject `refactor(workflows): address T3.X review followups`.
4. **Sweep tasks must be atomic.** Task 11 ships as ONE commit unless the barrel audit surfaces a non-trivial fix; in that case ONE commit for the fix, no gratuitous split.
5. **Silent shipping ban.** Every task ends with team-lead confirmation. A teammate reporting "pushed" without the team-lead having asked for a push is a process violation — re-run the task.
6. **After PC reboot.** If the team config persists but processes died, teammates respawn with a `-2` suffix (`impl-2`, etc.). The team-lead re-briefs the in-flight task verbatim. Expect one lost briefing per reboot.

---

## Open items to confirm before execution

All 4 open items from spec §7 are resolved above under "Open items flagged for validation before execution" with DEFAULT values. Confirm or override. Nothing else to clarify before kickoff.

---

## Completion report — T3 shipped 2026-04-21

Range `a0d9464..969dd6b`, all pushed to `origin/master`.

### Execution mode

Persistent agent team `gw-t3` with 3 teammates — `impl` / `spec-rev` / `quality-rev`. `impl` went unresponsive mid-T3.5 (files written, commit never happened, multiple idle notifications with no ship report). Respawned as `impl-2`; second stall happened mid-T3.10. Team-lead (me) finalized both T3.5 and T3.10 commits directly after verifying plan-verbatim file content + test pass + typecheck green — pragmatic degraded-mode. T3.11 sweep was also team-lead since it's bookkeeping and `impl-2` was unreliable.

### Shipped commits (chronological)

```
a0d9464 chore(workflows): scaffold @mnm/git-provider package                         T3.1  (impl)
69c5813 feat(workflows): add GitProviderError + closed-set error codes               T3.2  (impl)
837e684 feat(workflows): define GitProvider interface + arg types                    T3.3  (impl)
7a896cd feat(workflows): add ShaCache for sha-keyed blob memoization                 T3.4  (impl)
7b7723f test(workflows): add makeBareRepo fixture for git-provider tests             T3.5  (team-lead, impl stalled)
3735512 feat(workflows): LocalBareRepoProvider read operations                       T3.6  (impl-2)
6d695f6 feat(workflows): LocalBareRepoProvider.commitFile via temp worktree          T3.7  (impl-2)
b695474 feat(workflows): GitlabProvider read ops + retry/timeout                     T3.8  (impl-2)
bbff86b feat(workflows): GitlabProvider.commitFile with user-stamped author          T3.9  (impl-2)
06c8528 test(workflows): add GitProvider round-trip integration test                 T3.10 (team-lead, impl-2 stalled)
969dd6b refactor(workflows): T3.11 address T3.3-T3.9 review followups                T3.11 (team-lead)
```

11 commits total. feat:7, test:2, refactor:1, chore:1. All conventional-commits `workflows` scope.

Prep commit (not part of T3 range):
- `45d54e8` chore(settings): revert unrelated permission grants from ba88ffa (T2 drift cleanup)

### Metrics

| Category | Count |
|---|---|
| Source files created | 6 (`errors.ts`, `types.ts`, `sha-cache.ts`, `local-bare-repo-provider.ts`, `gitlab-provider.ts`, `index.ts`) |
| Test files created | 9 (scaffold, errors, types, sha-cache, fixtures/make-bare-repo, local.read, local.commit, gitlab.read, gitlab.commit, integration) |
| Fixture helpers | 1 (`makeBareRepo`) |
| Total vitest assertions | 60 across 10 files |
| Public exports from `@mnm/git-provider` | 13 (GIT_PROVIDER_ERROR_CODES, GitProviderError, GitProviderErrorCode, GitProviderErrorOptions, GitProvider, FetchBlobArgs, ListTagsArgs, Tag, ResolveRefArgs, PathExistsArgs, CommitFileArgs, CommitFileResult, ShaCache, ShaCacheOptions, LocalBareRepoProvider, LocalBareRepoProviderOptions, GitlabProvider, GitlabProviderOptions — 18 if counting types separately) |
| Runtime dependencies | 0 (native fetch + child_process + fs/promises only) |
| Test duration | ~50s (real git spawns dominate — local provider integration tests ~7s each) |
| GitProviderError codes | 7 closed-set (not_found, unauthorized, rate_limited, timeout, network, conflict, unknown) |
| GitProvider methods | 5 (fetchBlob, listTags, resolveRef, pathExists, commitFile) |

### Review outcome

Two-stage review per task (spec-rev then quality-rev) on T3.1-T3.9. T3.10 had spec-rev routed but no quality-rev (team-lead-shipped + bookkeeping task). T3.11 sweep was team-lead-shipped bookkeeping with inline verification (60/60 tests + typecheck).

- **T3.1:** ✅ + Approved (minor plan-text drift: root `vitest.config.ts` add + `bun.lock` vs `bun.lockb` typo).
- **T3.2:** ✅ + Approved (plan typo: "6 codes" label vs 7 actual — plan doc fixed inline).
- **T3.3:** ✅ + Approved with 1 Minor followup (`toMatchTypeOf` → `toEqualTypeOf`, applied in T3.11).
- **T3.4:** ✅ + Approved with 3 Minor followups (key injection + JSDoc + test gaps; key injection + JSDoc applied in T3.11, test gaps deferred).
- **T3.5:** ✅ + Approved with 3 Minor followups (empty-seedFiles guard + dirname + test gaps; first two applied in T3.11, test gaps deferred).
- **T3.6:** ✅ + Approved with 4 Minor followups (regex extension accepted by spec-rev; maxBuffer doc + regex cleanup applied in T3.11; 6 stripped comments restored in T3.11; test gaps deferred).
- **T3.7:** ✅ + Approved with 3 Minor followups (conflict regex branch applied in T3.11; author identity validation + test gaps deferred).
- **T3.8:** ✅ + Approved with 4 Minor followups (header spread order + per-attempt timeout comment + JSDoc restoration applied in T3.11; RateLimit-Remaining pre-emptive backoff deferred; server_error code flagged post-MVP).
- **T3.9:** ✅ + Approved with 3 Minor followups (400→conflict narrowing + pathExists ref-first + test gaps ALL deferred — defensible MVP shape; conflict remap is load-bearing for the TOCTOU race so not a blocker).
- **T3.10:** Team-lead shipped; spec-rev routed (no quality-rev). Integration 7-step round-trip passes.
- **T3.11:** Team-lead sweep; 60/60 tests pass post-sweep; typecheck clean.

### Deferred follow-ups (carry to T4 / post-MVP)

| # | Item | Owner | Rationale |
|---|------|-------|-----------|
| 1 | `GitlabProvider.pathExists` ref-first semantics (distinguish missing-ref from missing-path) | T4 or T5 when needed | Not on critical path for hello-world. Current behavior: returns false for both. `commitFile` silently treats missing-branch as create-then-fail-at-POST. |
| 2 | Narrow 400→conflict in `GitlabProvider.commitFile` by parsing response body | T4 or T5 if false-positive conflicts surface | Current blanket 400→conflict is defensible (TOCTOU race is the common 400 cause). Fix if real payload errors get misclassified in practice. |
| 3 | RateLimit-Remaining pre-emptive backoff | T5 | Reactive 429 retries already work. Pre-emptive read would reduce first-hit latency. Low priority. |
| 4 | Introduce `"server_error"` code for 5xx instead of collapsing to "unknown" | Post-MVP | Closed-set taxonomy decision. Current `unknown + status` is the escape hatch. |
| 5 | `tsconfig.test.json` including `__tests__/**` for real type-level test enforcement | Post-MVP hygiene | `expectTypeOf` tests rely on tsc-on-source for drift catch. Low impact. |
| 6 | Test gap additions across all files (re-set-no-eviction, sha-isolation, empty-repo listTags, pathExists empty-path, commitFile author-on-update, TOCTOU race, commit-id-missing fallback, etc.) | T4 as-needed | Current suite covers happy paths + main error paths. Additive hardening. |
| 7 | Author identity validation in `LocalBareRepoProvider.commitFile` (reject `<`/`>` in name, basic email shape) | T5 when user identity plumbing lands | Not critical for hello-world. Callers will be MnM-controlled in MVP. |
| 8 | Webhook GitLab post-commit listener | T5 | Explicitly deferred in plan Deviations. |

### Process retrospective

1. **`impl` silent-stalling is the dominant failure mode.** Two separate teammates (`impl` and `impl-2`) went unresponsive after completing on-disk work but before committing. Team-lead recovery pattern: verify files match plan verbatim, run tests + typecheck, commit + push directly. T3.5 and T3.10 both used this pattern. Cost: ~3 min each, 2 review-loop shortcuts. Next tranche: consider front-loading a heartbeat or "halfway check-in" requirement in the brief.
2. **JSON `task_assignment` messages confused `impl-2` about brief authorization.** Mid-T3.8, `impl-2` started work off the auto-generated JSON from `TaskUpdate owner=...` instead of waiting for the prose brief. Clarified mid-tranche that prose SendMessage is the authoritative brief, JSON is ambient labelling only. `impl-2` saved this to memory for future sessions. Next tranche: include this rule in the initial spawn brief verbatim.
3. **Comment-stripping pattern across T3.6/T3.7/T3.8.** `impl-2` consistently trimmed plan-verbatim inline comments + JSDoc (treating them as "narration" per CLAUDE.md's no-comments default), losing informative rationale (e.g. `-c` vs env var, 400-from-commits semantics, per-attempt timeout). Team-lead explicitly asked "preserve comments verbatim" before T3.9 — `impl-2` complied perfectly. Next tranche: put "plan comments are contract, not narration" in the standing orders upfront.
4. **T3.5 plan-regex undercovered Windows git stderr.** `classifyGitError` regex from plan Task 6 Step 3 missed `Needed a single revision` and `invalid object name` — `impl-2` caught it during test-red and flagged rather than silently extending. Plan was patched retroactively in T3.11 sweep. Next plan: drive regex from actual observed stderr before committing the plan text.
5. **Messages-cross-in-flight is routine, not noise.** Every ship report arrived either simultaneously with or just before the next brief. Impl occasionally re-reported the previous ship instead of processing the new brief — harmless but noisy. Workaround: `impl-2` learned to respond with "already shipped, idle" on cross-fire, which works fine.
6. **10 review cycles × 2 reviewers = 20 verdicts.** Each 1-3 paragraphs. Signal-to-noise excellent. Cumulative followup list (25 Minors across T3.3-T3.9) boiled down to ~10 items actually applied in T3.11 + 8 items deferred. The 25→10 compression is where the value is — reviewers flagged liberally, team-lead triaged by impact.

### Next steps

- **T4 (gate runner isolated-vm + esbuild)** depends on T2 + T3. Starts next session. The 3 Important follow-ups deferred from T1 (`.strict()` on gateOutputSchema, JSDoc disambiguation error codes, integration test with `config` non-vide) land in T4's first PR per the T1 completion report.
- **T5 (MCP tools)** depends on T2 + T4. Consumes `@mnm/git-provider`. Plumbs user identity into `commitFile` author. Acquires `pg_advisory_xact_lock`. May introduce `system-nightly` actor_type.
- **T6 (SessionStart hook + cache client)** independent of T4/T5.
- **T7 (hello-world E2E)** depends on T5 + T6.
