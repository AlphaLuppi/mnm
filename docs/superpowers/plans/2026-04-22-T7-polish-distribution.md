# T7 — Governed Workflows: polish + distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three T5 follow-up defects (DEF-1 real config merge, DEF-4 per-company git provider, DEF-9 multi-company MCP rejection), apply the T6 hot-reload spike verdict to docs/error payloads, ship an onboarding skill, and publish a plugin marketplace manifest — producing the MVP-complete MnM Governed Workflows stack.

**Architecture:** Server polish happens in three independent wiring tasks (parallelizable via fresh subagents). Plugin polish is sequential (README + AGENTS_STALE hint → onboarding skill → marketplace repo). Each task is TDD-first (failing test → implementation → green). Aligns with T6 retro discipline: pre-flight schema checks, plan comments verbatim, fresh subagent per task.

**Tech Stack:** TypeScript (strict), vitest, bun workspaces, drizzle-orm, @modelcontextprotocol/sdk, isolated-vm (inherited from T4), Claude Code plugin manifest format.

**Standing Orders (apply to every task):**
- **Plan comments = contract** — every JSDoc / inline comment in the code blocks below MUST be copied verbatim into the implementation. Stripping them is a plan failure.
- **Atomic commit + push** after each task (CLAUDE.md rule).
- **No emojis** in code or commit messages.
- **DB test credentials** : `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test`
- **Typecheck after every task**: `bun run typecheck` (13/13 packages must pass).

---

## File Structure

Files touched across the plan, grouped by responsibility:

**Server — governed-workflows service**
- `server/src/services/governed-workflows.ts` — replace `mergeAgentConfig` stub (T1); rename `SyncedAgent.configMerged.env_ref` → `credential` (T1); reshape AGENTS_STALE hints to include `/reload-plugins` instruction (T4).
- `server/src/services/__tests__/governed-workflows.test.ts` — extend config-merge + AGENTS_STALE assertions.
- `server/src/services/config-layer-conflict.ts` — read-only reference (already ships `mergePreview`).

**Server — MCP wiring**
- `server/src/mcp/build-mcp-services.ts` — convert `resolveGitProvider` from singleton to per-company resolver (T2).
- `server/src/mcp/auth/mcp-oauth-router.ts` — replace `getUserCompanyId`'s silent `LIMIT 1` with multi-company selection enforcement (T3).
- `server/src/mcp/__tests__/resolve-git-provider.test.ts` — new unit test file (T2).
- `server/src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts` — new unit test file (T3).
- `server/src/mcp/tools/governed-workflows.tool.ts` — no change beyond hint text echoing (covered via service change).
- `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` — update AGENTS_STALE hint assertion (T4).

**Plugin — docs + onboarding**
- `plugins/mnm/README.md` — elevate `/reload-plugins` instruction + add troubleshooting section (T4).
- `plugins/mnm/skills/mnm--onboard/SKILL.md` — new onboarding skill (T5).

**Marketplace**
- `docs/superpowers/specs/T7-marketplace-manifest.md` — standalone spec for the external repo (T6); user creates the actual GitHub repo from this spec.

**Completion artifacts**
- `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — add T7 row to §7 status table (T7).
- `docs/superpowers/plans/2026-04-22-T7-polish-distribution.md` — append completion report at the bottom (T7).

---

## Background pointers (read before starting)

- `docs/superpowers/specs/T6-hot-reload-spike-result.md` — spike verdict dictating T4/T5 doc changes.
- `server/src/services/config-layer-conflict.ts:163-208` — `mergePreview(companyId, agentId)` canonical merge.
- `packages/shared/src/validators/config-layer.ts:6` — `CONFIG_LAYER_ITEM_TYPES = ["mcp", "skill", "hook", "setting", "git_provider", "credential"]`.
- `server/src/services/governed-workflows.ts:38-52` — `GovernedWorkflowError` class (constructor signature, `.hints`, `.data`).
- `server/src/services/governed-workflows.ts:150-159` — current `SyncedAgent.configMerged` shape.
- `server/src/services/governed-workflows.ts:540-557` — current `AGENTS_STALE` error construction.
- `server/src/mcp/build-mcp-services.ts:32-47` — current singleton `resolveGitProvider` + wiring.
- `server/src/mcp/auth/mcp-oauth-router.ts:53-66` — current `getUserCompanyId` silent `LIMIT 1`.

---

## Task 1: T5-DEF-1 — Wire `mergeAgentConfig` to `mergePreview`

**Context:** The current `mergeAgentConfig` stub (`governed-workflows.ts:1163-1170`) returns empty buckets `{mcp, hook, setting, env_ref}`. `configLayerConflictService.mergePreview` already implements priority-merge and returns `{ items: MergedConfigItem[], layerSources }`. We must partition `items` by `itemType` into the `SyncedAgent.configMerged` envelope. We also rename `env_ref` → `credential` to align with the actual `ConfigLayerItemType` enum (no external consumers beyond tests per repo scan).

**Files:**
- Modify: `server/src/services/governed-workflows.ts:150-159` (interface rename)
- Modify: `server/src/services/governed-workflows.ts:1163-1170` (stub replacement)
- Modify: `server/src/services/governed-workflows.ts:1025-1069` (pass companyId)
- Test: `server/src/services/__tests__/governed-workflows.test.ts:650-660` (update fixture)
- Test: `server/src/services/__tests__/governed-workflows.test.ts` (append new suite)
- Test: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts:149` (update fixture)

- [ ] **Step 1: Write the failing test for real merge partitioning**

Append to `server/src/services/__tests__/governed-workflows.test.ts`:

```typescript
describe("mergeAgentConfig (real merge via mergePreview)", () => {
  it("partitions items by itemType into configMerged buckets", async () => {
    // Seed: 1 agent with 3 config_layer_items across 2 layers (enforced + base).
    //  - mcp:"github-api"      priority=999 (enforced) — wins over base
    //  - hook:"pre-commit"     priority=500 (base)
    //  - credential:"GL_TOKEN" priority=500 (base)
    const { companyId, agentId } = await seedAgentWithMergedConfig(db);

    const service = governedWorkflowService(db, {
      gitProvider: makeFakeGitProvider(),
      shaCache: new ShaCache(),
    });

    const { agents } = await service.syncEnvironment({
      companyId,
      agentFilter: [agentId],
    });

    expect(agents).toHaveLength(1);
    const merged = agents[0].configMerged;
    expect(merged.mcp).toHaveLength(1);
    expect(merged.mcp[0]).toMatchObject({ name: "github-api", priority: 999 });
    expect(merged.hook).toHaveLength(1);
    expect(merged.hook[0]).toMatchObject({ name: "pre-commit", priority: 500 });
    expect(merged.credential).toHaveLength(1);
    expect(merged.credential[0]).toMatchObject({ name: "GL_TOKEN" });
    expect(merged.setting).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write the `seedAgentWithMergedConfig` helper**

In the same test file (above the new describe block), add:

```typescript
async function seedAgentWithMergedConfig(db: Db): Promise<{ companyId: string; agentId: string }> {
  // Uses the existing test-db seeder pattern. RLS is set by syncEnvironment itself.
  const companyId = await createTestCompany(db);
  const agentId = await createTestAgent(db, { companyId, name: "t7-def1-agent" });

  const enforcedLayer = await createConfigLayer(db, {
    companyId,
    name: "company-enforced",
    scope: "company",
    enforced: true,
    priority: 999,
  });
  const baseLayer = await createConfigLayer(db, {
    companyId,
    name: "agent-base",
    scope: "private",
    enforced: false,
    priority: 500,
  });
  await attachLayerToAgent(db, { agentId, layerId: enforcedLayer.id });
  await attachLayerToAgent(db, { agentId, layerId: baseLayer.id });

  await createConfigLayerItem(db, {
    layerId: enforcedLayer.id,
    companyId,
    itemType: "mcp",
    name: "github-api",
    configJson: { endpoint: "https://api.github.com" },
  });
  await createConfigLayerItem(db, {
    layerId: baseLayer.id,
    companyId,
    itemType: "hook",
    name: "pre-commit",
    configJson: { command: "bun lint" },
  });
  await createConfigLayerItem(db, {
    layerId: baseLayer.id,
    companyId,
    itemType: "credential",
    name: "GL_TOKEN",
    configJson: { credentialId: "cred-abc" },
  });

  return { companyId, agentId };
}
```

If `createTestCompany`, `createTestAgent`, `createConfigLayer`, `attachLayerToAgent`, or `createConfigLayerItem` do not already exist in the test helpers module, add minimal wrappers around direct drizzle inserts. Grep first: `Grep --path server/src/services/__tests__ "createTestAgent|createConfigLayer"` — reuse what's there, only add missing pieces.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && bun test src/services/__tests__/governed-workflows.test.ts -t "partitions items by itemType" --run`
Expected: FAIL with `expect(merged.mcp).toHaveLength(1)` receiving 0 (stub returns empty arrays).

- [ ] **Step 4: Rename the interface field `env_ref` → `credential`**

In `server/src/services/governed-workflows.ts:150-159`, replace:

```typescript
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
```

with:

```typescript
export interface SyncedAgent {
  name: string;
  mdContent: string;
  /**
   * Merged config items partitioned by itemType. The four buckets map to
   * CONFIG_LAYER_ITEM_TYPES with two exclusions:
   *  - "skill"        — skills live as plugin artifacts, not per-agent config
   *  - "git_provider" — resolved by resolveGitProvider per-company (see T2)
   * Items within a bucket are priority-merged: one entry per `name`, winning
   * item comes from the highest-priority layer (company-enforced beats base).
   */
  configMerged: {
    mcp: MergedConfigItem[];
    hook: MergedConfigItem[];
    setting: MergedConfigItem[];
    credential: MergedConfigItem[];
  };
}
```

And add the import at the top of the file (find the existing shared-types import block):

```typescript
import type { MergedConfigItem } from "@mnm/shared";
```

- [ ] **Step 5: Replace the stub with real merge + partition**

In `server/src/services/governed-workflows.ts:1163-1170`, replace:

```typescript
async function mergeAgentConfig(_agentId: string) {
  // TODO: use `configLayerConflictService.mergePreview(companyId, agentId)`
  // as the canonical merge path (it already implements priority-merge).
  // For MVP, return empty buckets — tag-based isolation + real item
  // lookup land when the hook tests demand it in T6. The field shape is
  // stable.
  return { mcp: [], hook: [], setting: [], env_ref: [] };
}
```

with:

```typescript
async function mergeAgentConfig(
  companyId: string,
  agentId: string,
): Promise<SyncedAgent["configMerged"]> {
  // Delegates to the canonical priority-merge path. `mergePreview` returns a
  // flat `items[]` deduplicated by (itemType, name) with the highest-priority
  // layer winning — we just partition by itemType. Items of type "skill" and
  // "git_provider" are intentionally dropped from this envelope (see the
  // SyncedAgent.configMerged JSDoc).
  const conflictService = configLayerConflictService(db);
  const { items } = await conflictService.mergePreview(companyId, agentId);

  const buckets: SyncedAgent["configMerged"] = {
    mcp: [],
    hook: [],
    setting: [],
    credential: [],
  };
  for (const item of items) {
    if (item.itemType === "mcp") buckets.mcp.push(item);
    else if (item.itemType === "hook") buckets.hook.push(item);
    else if (item.itemType === "setting") buckets.setting.push(item);
    else if (item.itemType === "credential") buckets.credential.push(item);
    // "skill" and "git_provider" fall through by design.
  }
  return buckets;
}
```

Add `configLayerConflictService` to the existing import block at the top of `governed-workflows.ts` (grep for the nearest service import):

```typescript
import { configLayerConflictService } from "./config-layer-conflict.js";
```

- [ ] **Step 6: Update the caller to pass `companyId`**

In `server/src/services/governed-workflows.ts:1067`, change:

```typescript
      const configMerged = await mergeAgentConfig(a.id);
```

to:

```typescript
      const configMerged = await mergeAgentConfig(companyId, a.id);
```

(`companyId` is already in scope from the enclosing `syncEnvironment` method — confirm by reading lines 1025-1070 before editing.)

- [ ] **Step 7: Update existing test fixtures that still use `env_ref`**

In `server/src/services/__tests__/governed-workflows.test.ts:652`, change:

```typescript
      configMerged: { mcp: [], hook: [], setting: [], env_ref: [] },
```

to:

```typescript
      configMerged: { mcp: [], hook: [], setting: [], credential: [] },
```

In `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts:149`, change:

```typescript
        agents: [{ name: "greeter", mdContent: "# Greeter", configMerged: {} }],
```

to:

```typescript
        agents: [{ name: "greeter", mdContent: "# Greeter", configMerged: { mcp: [], hook: [], setting: [], credential: [] } }],
```

- [ ] **Step 8: Run all tests**

Run: `cd server && bun test src/services/__tests__/governed-workflows.test.ts src/mcp/tools/__tests__/governed-workflows.tool.test.ts --run`
Expected: PASS (new partition test + all pre-existing tests green).

- [ ] **Step 9: Typecheck**

Run: `bun run typecheck`
Expected: PASS for all 13 packages.

- [ ] **Step 10: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/__tests__/governed-workflows.test.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "feat(workflows): wire mergeAgentConfig to mergePreview (T7 DEF-1)

Replace empty-bucket stub with real priority-merge via configLayerConflictService.mergePreview.
Partitions items by itemType into {mcp, hook, setting, credential} buckets.
Renames SyncedAgent.configMerged.env_ref -> credential to align with actual ConfigLayerItemType enum (no external consumers)."
git push
```

---

## Task 2: T5-DEF-4 — Per-company GitProvider resolution

**Context:** `resolveGitProvider()` currently reads `MNM_GIT_PROVIDER` / `GITLAB_*` env vars at app startup and returns a **single** provider shared across tenants. In multi-tenant prod each company has its own GitLab project + token. We store these as `config_layer_items` of `itemType = "git_provider"` in a company-enforced layer. The resolver must (a) accept `companyId`, (b) look up the company's git_provider item, (c) instantiate the matching provider, (d) cache per-company, (e) fall back to env vars only when no company config exists (dev/local mode).

**Files:**
- Modify: `server/src/mcp/build-mcp-services.ts:32-47`
- Create: `server/src/mcp/__tests__/resolve-git-provider.test.ts`
- Modify: `server/src/services/governed-workflows.ts` — update `GovernedWorkflowServiceDeps` to accept a resolver function instead of a `gitProvider` instance; update every call site.

- [ ] **Step 1: Read the existing injection surface**

Before writing code, grep to inventory every use of `deps.gitProvider` inside `governed-workflows.ts`:

Run: `Grep --path server/src/services/governed-workflows.ts "gitProvider"`

Expected matches (fetchBlob, resolveRef). Each will need the `companyId` variable in scope — verify that's already true (syncEnvironment, launchStep, and listDefinitions all receive companyId as input).

- [ ] **Step 2: Write the failing resolver test**

Create `server/src/mcp/__tests__/resolve-git-provider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Db } from "@mnm/db";
import { createResolveGitProvider } from "../build-mcp-services.js";

describe("createResolveGitProvider", () => {
  let db: Db;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    db = makeMockDb() as unknown as Db;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns company-specific GitlabProvider when git_provider item exists", async () => {
    // Seed: company "acme" has a git_provider item with kind="gitlab" and per-company creds.
    mockMergePreviewForCompany(db, "acme", [
      {
        itemType: "git_provider",
        name: "default",
        configJson: {
          kind: "gitlab",
          providerId: "gitlab:acme",
          baseUrl: "https://gitlab.acme.internal",
          projectId: "42",
          token: "ACME_TOKEN",
        },
      },
    ]);

    const resolve = createResolveGitProvider(db);
    const provider = await resolve("acme");

    expect(provider.constructor.name).toBe("GitlabProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
  });

  it("caches providers per companyId (same instance across calls)", async () => {
    mockMergePreviewForCompany(db, "acme", [
      {
        itemType: "git_provider",
        name: "default",
        configJson: { kind: "gitlab", providerId: "gitlab:acme", baseUrl: "x", projectId: "1", token: "t" },
      },
    ]);
    const resolve = createResolveGitProvider(db);
    const p1 = await resolve("acme");
    const p2 = await resolve("acme");
    expect(p1).toBe(p2);
  });

  it("returns distinct providers for distinct companies", async () => {
    mockMergePreviewForCompany(db, "acme", [
      { itemType: "git_provider", name: "default", configJson: { kind: "gitlab", providerId: "gitlab:acme", baseUrl: "x", projectId: "1", token: "t1" } },
    ]);
    mockMergePreviewForCompany(db, "globex", [
      { itemType: "git_provider", name: "default", configJson: { kind: "gitlab", providerId: "gitlab:globex", baseUrl: "y", projectId: "2", token: "t2" } },
    ]);
    const resolve = createResolveGitProvider(db);
    const pA = await resolve("acme");
    const pG = await resolve("globex");
    expect(pA).not.toBe(pG);
    expect((pA as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
    expect((pG as unknown as { providerId: string }).providerId).toBe("gitlab:globex");
  });

  it("falls back to env-var provider when company has no git_provider item (dev mode)", async () => {
    mockMergePreviewForCompany(db, "dev-co", []);
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "./_fixtures/mnm-workflows-bare";
    const resolve = createResolveGitProvider(db);
    const provider = await resolve("dev-co");
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("throws GovernedWorkflowError with code GIT_PROVIDER_MISCONFIG when config is invalid", async () => {
    mockMergePreviewForCompany(db, "bad-co", [
      { itemType: "git_provider", name: "default", configJson: { kind: "unknown-vendor" } },
    ]);
    const resolve = createResolveGitProvider(db);
    await expect(resolve("bad-co")).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
    });
  });
});

function makeMockDb() {
  // Minimal db stub — tests inject mergePreview behavior via mockMergePreviewForCompany.
  return { _fakeMergePreview: new Map<string, unknown[]>() };
}

function mockMergePreviewForCompany(db: any, companyId: string, items: unknown[]) {
  db._fakeMergePreview.set(companyId, items);
  // Monkey-patch configLayerConflictService at module level. Implement via vi.mock at top of file
  // if direct monkey-patching is awkward — adjust once implementation lands.
}
```

Note: the mocking strategy above is a sketch. When implementing, prefer `vi.mock("../../services/config-layer-conflict.js", ...)` at module level and expose `mergePreview` as a module-level spy. Adjust only once the production resolver is written.

- [ ] **Step 3: Add `GIT_PROVIDER_MISCONFIG` to the workflow error codes**

Find the existing `WORKFLOW_ERROR_CODES` constant in `server/src/services/governed-workflows.ts` (grep first — likely near the top). Add a new member:

```typescript
// Emitted by resolveGitProvider when a company has a git_provider config
// layer item but its shape is invalid (unknown `kind`, missing required
// fields). Fail-closed: we never silently fall back to env vars when the
// company explicitly declared a provider.
GIT_PROVIDER_MISCONFIG: "GIT_PROVIDER_MISCONFIG",
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd server && bun test src/mcp/__tests__/resolve-git-provider.test.ts --run`
Expected: FAIL with `createResolveGitProvider is not a function` (not yet exported).

- [ ] **Step 5: Implement `createResolveGitProvider`**

Replace `server/src/mcp/build-mcp-services.ts:32-47`:

```typescript
function resolveGitProvider(): GitProvider {
  const mode = process.env.MNM_GIT_PROVIDER ?? "gitlab";
  if (mode === "local") {
    const repoDir = process.env.MNM_GIT_LOCAL_PATH ?? "./_fixtures/mnm-workflows-bare";
    return new LocalBareRepoProvider({ providerId: "local:mnm-workflows", repoDir });
  }
  return new GitlabProvider({
    providerId: "gitlab:mnm-workflows",
    baseUrl: process.env.GITLAB_BASE_URL!,
    projectId: process.env.GITLAB_PROJECT_ID!,
    token: process.env.GITLAB_TOKEN!,
  });
}
```

with:

```typescript
/**
 * Build a companyId -> GitProvider resolver. Multi-tenant prod stores each
 * company's git backend as a config_layer_item of itemType "git_provider".
 * Shape of the configJson:
 *   { kind: "gitlab", providerId, baseUrl, projectId, token }
 *   { kind: "local",  providerId, repoDir }
 *
 * Fallback: when no git_provider item exists for the company, we fall back to
 * process env vars (dev / local bootstrap). When a company declares an item
 * with an unknown kind or missing fields, we fail-closed with
 * GIT_PROVIDER_MISCONFIG rather than silently fall back.
 *
 * Providers are cached per companyId for the lifetime of the process. When a
 * company rotates credentials, restart is required — the config-layer UI
 * already warns users about this (spec §5).
 */
export function createResolveGitProvider(db: Db): (companyId: string) => Promise<GitProvider> {
  const cache = new Map<string, GitProvider>();

  return async function resolveGitProvider(companyId: string): Promise<GitProvider> {
    const cached = cache.get(companyId);
    if (cached) return cached;

    const conflictService = configLayerConflictService(db);
    const { items } = await conflictService.mergePreview(companyId, "__company_default__");
    // Agent id "__company_default__" is a sentinel for company-scope lookups
    // that don't target a specific agent — mergePreview's active_layers CTE
    // still returns company-enforced + shared-default layers. If the CTE
    // implementation rejects unknown agents, we fall back to a direct query
    // over config_layer_items WHERE itemType='git_provider' AND layer.scope='company'.

    const gitProviderItems = items.filter((i) => i.itemType === "git_provider");
    if (gitProviderItems.length === 0) {
      const provider = buildEnvFallbackProvider();
      cache.set(companyId, provider);
      return provider;
    }

    // Pick the highest-priority item (mergePreview already dedupes by (type, name)).
    const top = gitProviderItems[0];
    const cfg = top.configJson as { kind?: string } & Record<string, unknown>;
    let provider: GitProvider;
    if (cfg.kind === "gitlab") {
      const { providerId, baseUrl, projectId, token } = cfg as {
        providerId?: string; baseUrl?: string; projectId?: string; token?: string;
      };
      if (!providerId || !baseUrl || !projectId || !token) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required gitlab fields.`,
          ["Set providerId, baseUrl, projectId, token on the git_provider config layer item."],
        );
      }
      provider = new GitlabProvider({ providerId, baseUrl, projectId, token });
    } else if (cfg.kind === "local") {
      const { providerId, repoDir } = cfg as { providerId?: string; repoDir?: string };
      if (!providerId || !repoDir) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required local fields.`,
          ["Set providerId and repoDir on the git_provider config layer item."],
        );
      }
      provider = new LocalBareRepoProvider({ providerId, repoDir });
    } else {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
        `Company ${companyId} git_provider item has unknown kind: ${String(cfg.kind)}`,
        ["Supported kinds are 'gitlab' and 'local'."],
      );
    }

    cache.set(companyId, provider);
    return provider;
  };
}

function buildEnvFallbackProvider(): GitProvider {
  const mode = process.env.MNM_GIT_PROVIDER ?? "gitlab";
  if (mode === "local") {
    const repoDir = process.env.MNM_GIT_LOCAL_PATH ?? "./_fixtures/mnm-workflows-bare";
    return new LocalBareRepoProvider({ providerId: "local:mnm-workflows", repoDir });
  }
  return new GitlabProvider({
    providerId: "gitlab:mnm-workflows",
    baseUrl: process.env.GITLAB_BASE_URL!,
    projectId: process.env.GITLAB_PROJECT_ID!,
    token: process.env.GITLAB_TOKEN!,
  });
}
```

Add the imports at the top of the file:

```typescript
import { configLayerConflictService } from "../services/config-layer-conflict.js";
import { GovernedWorkflowError, WORKFLOW_ERROR_CODES } from "../services/governed-workflows.js";
```

Update `buildMcpServices` (same file, ~line 47) to inject the resolver instead of the singleton:

```typescript
export function buildMcpServices(db: Db): McpServices {
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  return {
    // ...existing services...
    governedWorkflows: governedWorkflowService(db, { resolveGitProvider, shaCache }),
  };
}
```

- [ ] **Step 6: Update `GovernedWorkflowServiceDeps` + internal calls**

In `server/src/services/governed-workflows.ts`, find the `GovernedWorkflowServiceDeps` interface (grep for it). Replace:

```typescript
interface GovernedWorkflowServiceDeps {
  gitProvider: GitProvider;
  shaCache: ShaCache;
}
```

with:

```typescript
interface GovernedWorkflowServiceDeps {
  /**
   * Per-company GitProvider resolver. The service caches nothing itself —
   * the resolver owns the per-companyId instance cache (see T2).
   */
  resolveGitProvider: (companyId: string) => Promise<GitProvider>;
  shaCache: ShaCache;
}
```

For every call site inside `governed-workflows.ts` that reads `deps.gitProvider`, replace with `await deps.resolveGitProvider(companyId)`. Use grep to find them all; typical pattern:

Before:
```typescript
    const blob = await deps.gitProvider.fetchBlob(mdPath, a.latestGitTag);
```

After:
```typescript
    const gitProvider = await deps.resolveGitProvider(companyId);
    const blob = await gitProvider.fetchBlob(mdPath, a.latestGitTag);
```

When multiple provider calls happen inside the same block, resolve once at the top of that block — don't re-call `resolveGitProvider` per fetch.

- [ ] **Step 7: Update E2E test fixture to use the resolver shape**

Find the E2E setup in `server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts` — it constructs `governedWorkflowService(db, { gitProvider, shaCache })`. Replace:

```typescript
governedWorkflowService(db, { gitProvider, shaCache })
```

with:

```typescript
governedWorkflowService(db, {
  resolveGitProvider: async () => gitProvider,
  shaCache,
})
```

Do the same in any other test that instantiates `governedWorkflowService` directly — grep `governedWorkflowService(db, {` across `server/src`.

- [ ] **Step 8: Run tests**

Run: `cd server && bun test src/mcp/__tests__/resolve-git-provider.test.ts src/mcp/tools/__tests__/governed-workflows.e2e.test.ts --run`
Expected: PASS (5 new resolver tests + existing E2E green).

- [ ] **Step 9: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/mcp/build-mcp-services.ts server/src/mcp/__tests__/resolve-git-provider.test.ts server/src/services/governed-workflows.ts server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts
git commit -m "feat(workflows): per-company GitProvider resolution (T7 DEF-4)

Convert resolveGitProvider from process-wide singleton to per-company
resolver. Each company's git backend is a git_provider config_layer_item
(kind: gitlab | local). Env vars act as dev/local fallback only when no
company item exists. Unknown kind or missing fields => GIT_PROVIDER_MISCONFIG
(fail-closed). Providers are cached per companyId."
git push
```

---

## Task 3: T5-DEF-9 — Multi-company MCP OAuth rejection

**Context:** `server/src/mcp/auth/mcp-oauth-router.ts:53-66` has `getUserCompanyId` which picks the first active membership with `.limit(1)`. This is silent: a board user with 3 companies gets bound to whichever row the DB returns first, and MCP operates against that tenant with no user awareness. Fix: if the user has more than one active membership, the OAuth flow must require an explicit `company_id` selection (via query param on the authorize URL, falling back to a simple select form). If neither is present for a multi-company user, respond with `invalid_request` + a clear message.

**Files:**
- Modify: `server/src/mcp/auth/mcp-oauth-router.ts:51-66` (replace helper) + `~370-380` (caller of `getUserCompanyId`)
- Create: `server/src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts`

- [ ] **Step 1: Read the full caller context**

Read `server/src/mcp/auth/mcp-oauth-router.ts:360-400` before editing. You need to see the `authorize` handler's full param surface (how `req.query.company_id` would be threaded). Also grep `getUserCompanyId` to confirm it's only called once.

- [ ] **Step 2: Write the failing test**

Create `server/src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../../../__tests__/helpers/build-test-app.js";

describe("MCP OAuth multi-company enforcement (DEF-9)", () => {
  let app: ReturnType<typeof buildTestApp>;
  const userMultiCo = "user-multi-1";
  const userSingleCo = "user-single-1";
  const companyA = "co-a";
  const companyB = "co-b";

  beforeEach(async () => {
    app = await buildTestApp();
    await seedUserWithMemberships(app.db, userMultiCo, [companyA, companyB]);
    await seedUserWithMemberships(app.db, userSingleCo, [companyA]);
  });

  it("rejects authorize when multi-company user provides no company_id", async () => {
    const res = await request(app.express)
      .get("/mcp/oauth/authorize")
      .set("Cookie", signedSessionCookie(userMultiCo))
      .query({ client_id: "test-client", response_type: "code", redirect_uri: "http://localhost/cb", state: "s" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "invalid_request",
      error_description: expect.stringContaining("company_id"),
    });
  });

  it("accepts authorize when multi-company user provides valid company_id", async () => {
    const res = await request(app.express)
      .get("/mcp/oauth/authorize")
      .set("Cookie", signedSessionCookie(userMultiCo))
      .query({
        client_id: "test-client",
        response_type: "code",
        redirect_uri: "http://localhost/cb",
        state: "s",
        company_id: companyA,
      });

    // Success path emits a consent redirect or issues an auth code.
    expect([200, 302]).toContain(res.status);
  });

  it("rejects authorize when multi-company user provides non-member company_id", async () => {
    const res = await request(app.express)
      .get("/mcp/oauth/authorize")
      .set("Cookie", signedSessionCookie(userMultiCo))
      .query({
        client_id: "test-client",
        response_type: "code",
        redirect_uri: "http://localhost/cb",
        state: "s",
        company_id: "co-other",
      });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "access_denied" });
  });

  it("single-company user succeeds without company_id (backward-compat)", async () => {
    const res = await request(app.express)
      .get("/mcp/oauth/authorize")
      .set("Cookie", signedSessionCookie(userSingleCo))
      .query({ client_id: "test-client", response_type: "code", redirect_uri: "http://localhost/cb", state: "s" });

    expect([200, 302]).toContain(res.status);
  });
});
```

Use the existing `buildTestApp` helper. If `signedSessionCookie` doesn't exist, grep for how other MCP OAuth tests authenticate the user session — reuse that pattern (don't invent a new one).

- [ ] **Step 3: Run test to verify failure**

Run: `cd server && bun test src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts --run`
Expected: FAIL — the "rejects when no company_id" test will hit 302 (current silent behavior) instead of 400.

- [ ] **Step 4: Replace `getUserCompanyId` with multi-company-aware resolver**

In `server/src/mcp/auth/mcp-oauth-router.ts:51-66`, replace the function entirely:

```typescript
// ── Resolve user's companyId ────────────────────────────────────────────────

async function getUserCompanyId(db: Db, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.status, "active"),
      ),
    )
    .limit(1);
  return membership?.companyId ?? null;
}
```

with:

```typescript
// ── Resolve user's companyId for MCP OAuth ──────────────────────────────────

/**
 * Multi-tenant boundary for MCP OAuth consent. Board users may belong to
 * multiple active companies; we MUST NOT silently pick one on their behalf
 * because the resulting JWT would scope MCP tool calls to the wrong tenant.
 *
 * Resolution rules:
 *  - 0 memberships       -> null (caller emits 403 access_denied)
 *  - 1 membership        -> return it (backward-compat for the common case)
 *  - 2+ memberships:
 *      - explicit company_id matching one -> return it
 *      - explicit company_id not matching -> throw { kind: "forbidden", companyId }
 *      - no explicit company_id           -> throw { kind: "ambiguous", available }
 *
 * The caller maps each throw to a standard OAuth error response.
 */
async function resolveOAuthCompanyId(
  db: Db,
  userId: string,
  requestedCompanyId: string | null,
): Promise<string | null> {
  const memberships = await db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.status, "active"),
      ),
    );

  if (memberships.length === 0) return null;

  if (memberships.length === 1) {
    const only = memberships[0].companyId;
    if (requestedCompanyId && requestedCompanyId !== only) {
      throw { kind: "forbidden" as const, companyId: requestedCompanyId };
    }
    return only;
  }

  // Multi-company user: explicit selection required.
  if (!requestedCompanyId) {
    throw {
      kind: "ambiguous" as const,
      available: memberships.map((m) => m.companyId),
    };
  }
  const match = memberships.find((m) => m.companyId === requestedCompanyId);
  if (!match) {
    throw { kind: "forbidden" as const, companyId: requestedCompanyId };
  }
  return match.companyId;
}
```

- [ ] **Step 5: Update the authorize handler to thread `company_id` + handle throws**

In the authorize handler (around line 377 — grep `await getUserCompanyId` to locate the exact site), replace:

```typescript
    const companyId = await getUserCompanyId(db, userId);
    if (!companyId) {
      res.status(403).json({ error: "access_denied", error_description: "User has no active company membership" });
      return;
    }
```

with:

```typescript
    const requestedCompanyId = typeof req.query.company_id === "string" && req.query.company_id.length > 0
      ? req.query.company_id
      : null;
    let companyId: string | null;
    try {
      companyId = await resolveOAuthCompanyId(db, userId, requestedCompanyId);
    } catch (e) {
      const err = e as { kind: "ambiguous"; available: string[] } | { kind: "forbidden"; companyId: string };
      if (err.kind === "ambiguous") {
        res.status(400).json({
          error: "invalid_request",
          error_description:
            "User belongs to multiple companies; add ?company_id=<uuid> to the authorize URL.",
          available_companies: err.available,
        });
        return;
      }
      // err.kind === "forbidden"
      res.status(403).json({
        error: "access_denied",
        error_description: `User is not a member of company ${err.companyId}`,
      });
      return;
    }
    if (!companyId) {
      res.status(403).json({ error: "access_denied", error_description: "User has no active company membership" });
      return;
    }
```

- [ ] **Step 6: Run tests**

Run: `cd server && bun test src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts --run`
Expected: PASS (4/4).

Then regression: `cd server && bun test src/mcp/auth --run`
Expected: existing tests still green.

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/mcp/auth/mcp-oauth-router.ts server/src/mcp/auth/__tests__/mcp-oauth-multi-company.test.ts
git commit -m "feat(workflows): enforce explicit company_id for multi-tenant OAuth (T7 DEF-9)

Board users with 2+ active company memberships must now pass company_id on
the MCP authorize URL. Without it the flow fails-closed with 400 invalid_request
(listing available company ids) instead of silently picking the first membership.
Single-company users remain unaffected. Non-member company_id => 403 access_denied."
git push
```

---

## Task 4: Plugin README + AGENTS_STALE hint polish

**Context:** The T6 hot-reload spike confirmed that user-level agent files are not hot-reloaded; the user must run `/reload-plugins` after any `Write` to `~/.claude/agents/`. The plugin README already mentions this on lines 34, 41, 69, but it's buried. We elevate it to a top-level step in the bootstrap flow and add a short troubleshooting section. We also update `AGENTS_STALE.hints` in `launchStep` to include the reload instruction explicitly (currently it says "Write the returned content ... Re-call launchStep" without mentioning the reload).

**Files:**
- Modify: `plugins/mnm/README.md`
- Modify: `server/src/services/governed-workflows.ts:540-557` (AGENTS_STALE hints)
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts:193-234` (hint assertions)

- [ ] **Step 1: Write failing hint assertion**

In `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` find the existing `AGENTS_STALE` test (around line 193). Extend the assertion:

```typescript
    expect(result.hints).toEqual([
      expect.stringContaining("Write the returned content"),
      expect.stringContaining("/reload-plugins"),
      expect.stringContaining("Re-call launchStep"),
    ]);
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd server && bun test src/mcp/tools/__tests__/governed-workflows.tool.test.ts -t "AGENTS_STALE" --run`
Expected: FAIL — current hints are only 2 entries, missing the `/reload-plugins` line.

- [ ] **Step 3: Update the AGENTS_STALE error construction**

In `server/src/services/governed-workflows.ts:540-557`, change:

```typescript
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
```

to:

```typescript
throw new GovernedWorkflowError(
  WORKFLOW_ERROR_CODES.AGENTS_STALE,
  `Local agent '${namespacedName}' is stale; harness must update.`,
  [
    `Write the returned content to ~/.claude/agents/${namespacedName}.md`,
    // Claude Code does NOT hot-reload user-level agents; the in-session
    // subagent registry is frozen at SessionStart. After the Write, the
    // user must run /reload-plugins (or restart Claude Code) before the
    // next dispatch — see T6 hot-reload spike.
    "Run /reload-plugins in Claude Code so the new agent becomes dispatchable",
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
```

- [ ] **Step 4: Run the test to verify pass**

Run: `cd server && bun test src/mcp/tools/__tests__/governed-workflows.tool.test.ts -t "AGENTS_STALE" --run`
Expected: PASS.

- [ ] **Step 5: Rewrite the plugin README bootstrap section**

Open `plugins/mnm/README.md`. Replace the current ordered-list bootstrap section (the block that currently has the "After restarting Claude Code (or `/reload-plugins`)..." line) with:

```markdown
## First-run bootstrap

1. Install the plugin (`/plugin install mnm@mnm-platform` — see Marketplace section below).
2. Configure `company_id` and `server_url` in the plugin config dialog.
3. Authenticate (the `mcp__mnm__authenticate` tool will prompt you through the OAuth flow).
4. Run the **first** `launch_governed_step` for any workflow. The server returns an `AGENTS_STALE` error carrying the canonical agent content.
5. Follow the harness prompt: `Write` each returned file to `~/.claude/agents/`, then **run `/reload-plugins`** in the Claude Code session. This step is required — Claude Code does not hot-reload user-level agents mid-session.
6. Re-call `launch_governed_step`. The dispatch now succeeds.

> **Why `/reload-plugins`?** Claude Code freezes the list of available subagents at session start. Writing a new file to `~/.claude/agents/` does not invalidate that list; the only way to pick up new agents without restarting is `/reload-plugins`. This is a one-time action per agent set change.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Task(subagent_type: "mnm--X")` returns `agent not found` | Run `/reload-plugins`. If still failing, fully restart Claude Code. |
| `launch_governed_step` keeps returning `AGENTS_STALE` after a `Write` | You skipped `/reload-plugins`. Run it, then retry. |
| `MISSING_TOOLS` error | Install the plugin/MCP listed in `error.data.required[]`, then `/reload-plugins`. |
| Authentication loop in browser | Check that `server_url` in plugin config points at an HTTPS endpoint serving `/.well-known/oauth-authorization-server`. |
```

Preserve any other sections of the README that describe the plugin scope or link to the server docs — only replace the bootstrap + troubleshooting blocks. If there is no existing troubleshooting section, insert the new one after bootstrap.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plugins/mnm/README.md server/src/services/governed-workflows.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "docs(workflows): apply T6 hot-reload spike verdict to plugin UX (T7)

README bootstrap now calls out /reload-plugins as a required explicit step
(with a short \"why\" paragraph) and adds a troubleshooting table.
AGENTS_STALE.hints now include the reload instruction as a distinct line,
so the harness can display it verbatim to the user."
git push
```

---

## Task 5: Onboarding skill `mnm--onboard`

**Context:** New users install the plugin and need a guided first-run. The onboarding skill replaces a prose checklist: it invokes `setup_workspace` (T6 tool), writes the returned agent files, tells the user to run `/reload-plugins`, then offers to run the first `launch_governed_step` or a diagnostic `push_local_state`. The skill lives inside the plugin so it's distributed atomically with the rest of the plugin.

**Files:**
- Create: `plugins/mnm/skills/mnm--onboard/SKILL.md`

- [ ] **Step 1: Create the skill file**

Write `plugins/mnm/skills/mnm--onboard/SKILL.md`:

```markdown
---
name: mnm--onboard
description: Guide the user through first-run bootstrap of the MnM Governed Workflows plugin — calls setup_workspace, writes agent files, prompts /reload-plugins, and runs a verification push_local_state. Use when the user installs the plugin, runs /mnm--onboard explicitly, or asks how to "get started with MnM".
---

# MnM Onboarding

You are guiding a user through first-run setup of the MnM Governed Workflows plugin. Execute these steps in order — do not skip or reorder.

## Step 1: Confirm authentication

Before any MCP call, verify the user is authenticated. Attempt:

\`\`\`
mcp__mnm__authenticate
\`\`\`

If it returns `already_authenticated`, continue. If it returns an auth URL, wait for the user to complete the OAuth flow, then call `mcp__mnm__complete_authentication` with the returned code.

If the user has multiple company memberships, the OAuth flow will return `invalid_request` with `available_companies[]`. Ask the user which `company_id` to use and re-attempt authentication with that value.

## Step 2: Call setup_workspace

\`\`\`
mnm.setup_workspace
\`\`\`

The response shape:

\`\`\`json
{
  "agents": [
    { "name": "mnm--<id>", "content": "...", "sha": "...", "target_path": "~/.claude/agents/mnm--<id>.md" }
  ],
  "session_tools": [...]
}
\`\`\`

## Step 3: Write every agent file

For each entry in `agents[]`, use the `Write` tool with `file_path = target_path` and `content = content`. Expand `~` to the user's home directory resolved from the Claude Code harness environment (on Windows: `$HOME` maps to `C:\\Users\\<username>`).

Do not batch the writes in a single tool call — call `Write` once per agent. Report progress as you go.

## Step 4: Prompt /reload-plugins — MANDATORY

After all writes succeed, emit exactly this message to the user:

> **Action required** — I've written N agent files to `~/.claude/agents/`. Claude Code does not hot-reload these mid-session. Please run `/reload-plugins` now and then send me any short message (even "ok") so I can continue.

STOP. Do not proceed to Step 5 until the user confirms.

## Step 5: Verify with push_local_state

After the user confirms, call:

\`\`\`
mnm.push_local_state  with  { agents_sha: "<sha from setup_workspace response>" }
\`\`\`

A 200 response confirms the server now tracks this session's local agent state.

## Step 6: Offer next steps

Tell the user onboarding is complete and list two options:

1. "Launch the hello-world workflow" — call `mnm.list_governed_workflows`, pick the `hello-world` entry, then `mnm.launch_governed_workflow`, then walk through each step with `mnm.launch_governed_step`.
2. "Install a custom workflow" — direct them to `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`.

## Error handling

- `AGENTS_STALE` from launch_governed_step after onboarding means the user skipped Step 4. Ask them to run `/reload-plugins` and retry.
- `MISSING_TOOLS` means the plugin is misconfigured — surface `error.data.required[]` verbatim and stop.
- Any other error: surface `error.code` and `error.hints[]` verbatim; do not attempt to recover silently.
```

- [ ] **Step 2: Typecheck (sanity)**

Run: `bun run typecheck`
Expected: PASS (no code changed but verify monorepo is still clean).

- [ ] **Step 3: Commit**

```bash
git add plugins/mnm/skills/mnm--onboard/SKILL.md
git commit -m "feat(workflows): mnm--onboard skill for first-run plugin bootstrap (T7)

Guides the user through authenticate -> setup_workspace -> Write agents ->
/reload-plugins -> push_local_state -> launch_governed_workflow. Mandatory
stop at the /reload-plugins prompt (hot-reload spike verdict). Bundled with
the plugin so it's distributed atomically."
git push
```

---

## Task 6: Marketplace manifest spec

**Context:** The plugin lives in `plugins/mnm/` inside the main MnM repo. To distribute via Claude Code's `/plugin marketplace add` / `/plugin install`, we need a separate marketplace repo at `mnm-platform/claude-plugins` with a `marketplace.json` that points at this plugin. Creating that repo is a user action (external side-effect); the plan's deliverable is the manifest file and a setup spec the user executes outside Claude Code.

**Files:**
- Create: `docs/superpowers/specs/T7-marketplace-manifest.md`

- [ ] **Step 1: Write the marketplace manifest spec**

Create `docs/superpowers/specs/T7-marketplace-manifest.md`:

```markdown
# T7 — Marketplace manifest spec

## Goal

Publish the MnM Governed Workflows plugin so Claude Code users can install it via:

\`\`\`
/plugin marketplace add https://github.com/mnm-platform/claude-plugins
/plugin install mnm@mnm-platform
\`\`\`

## Repo structure

Create `github.com/mnm-platform/claude-plugins` with:

\`\`\`
claude-plugins/
├── marketplace.json
├── README.md
└── mnm/
    └── (contents mirrored from this repo's plugins/mnm/)
\`\`\`

## marketplace.json

\`\`\`json
{
  "schemaVersion": 1,
  "id": "mnm-platform",
  "name": "MnM Platform",
  "description": "Plugins published by the MnM Governed Workflows team.",
  "plugins": [
    {
      "id": "mnm",
      "name": "MnM Governed Workflows",
      "description": "Supervise AI agent orchestration for your company.",
      "path": "mnm",
      "homepage": "https://github.com/AlphaLuppi/mnm",
      "license": "MIT"
    }
  ]
}
\`\`\`

## Publication workflow

1. From this repo, copy `plugins/mnm/` into the marketplace repo's `mnm/` folder (preserve the `.claude-plugin/`, `.mcp.json`, `hooks/`, `bin/`, `skills/`, `README.md` subtree).
2. Commit to the marketplace repo: `chore: publish mnm@0.1.0`.
3. Tag and push: `git tag mnm-v0.1.0 && git push --tags`.

## Sync strategy

For now, the marketplace repo is a **manual** mirror — cut a new commit each time `plugins/mnm/` changes on master. Automate via a GitHub Action in T8 if/when release cadence demands it.

## Verification

After publishing:

1. In a fresh Claude Code session, run `/plugin marketplace add https://github.com/mnm-platform/claude-plugins`.
2. Run `/plugin install mnm@mnm-platform`.
3. Restart Claude Code. Confirm the SessionStart hook fires (`bin/mnm-session-start`) and the `mcp__mnm__*` tools appear.
4. Run the `mnm--onboard` skill (Task 5) to complete first-run.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/T7-marketplace-manifest.md
git commit -m "docs(workflows): marketplace manifest spec + publish workflow (T7)

Defines the external mnm-platform/claude-plugins repo layout, the
marketplace.json schema, the manual publication flow, and the
verification steps. User executes the repo creation outside Claude Code."
git push
```

- [ ] **Step 3 (user action — not Claude-executed)**

Create the `mnm-platform/claude-plugins` repo on GitHub and run the publication workflow described in the spec. Report success in the T7 completion report once `/plugin install mnm@mnm-platform` is verified.

---

## Task 7: Completion report + spec update

**Context:** Close the loop — update the MVP design spec's §7 status table, append a completion report to this plan file, and decide whether T8 is needed or the MVP is closed.

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` (§7 table)
- Modify: `docs/superpowers/plans/2026-04-22-T7-polish-distribution.md` (this file — append report)

- [ ] **Step 1: Update §7 status table**

Grep for the §7 table in `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`. Add a T7 row with:
- Scope column: "DEF-1 real merge, DEF-4 per-company git, DEF-9 multi-company OAuth, README/AGENTS_STALE polish, mnm--onboard skill, marketplace manifest"
- Status: "shipped 2026-04-22" (use today's date, formatted like existing rows)
- Commit range: fill in with `git log --oneline cb16993..HEAD | tail -1`..`git rev-parse HEAD` after Task 7 Step 3's final commit.

- [ ] **Step 2: Append completion report to this plan file**

Append at the bottom of `docs/superpowers/plans/2026-04-22-T7-polish-distribution.md`:

```markdown
---

## Completion Report (2026-04-22)

### Shipped
- **DEF-1** — `mergeAgentConfig` wired to `configLayerConflictService.mergePreview`, envelope renamed `env_ref`->`credential`.
- **DEF-4** — Per-company `resolveGitProvider` with git_provider config_layer_item lookup, per-companyId cache, env-var fallback, fail-closed on misconfig.
- **DEF-9** — MCP OAuth rejects multi-company users without explicit `company_id`; returns `invalid_request` with `available_companies[]`.
- **Hot-reload polish** — Plugin README bootstrap elevated, troubleshooting table added, AGENTS_STALE hints include `/reload-plugins` instruction.
- **Onboarding skill** — `mnm--onboard` guides user through authenticate → setup_workspace → Write → /reload-plugins → push_local_state.
- **Marketplace** — Manifest spec written; external repo creation + `/plugin install` verification is a user action.

### Post-T7 follow-ups (not blocking MVP)
- T5-DEF-3 (extended queryTraces filter)
- T5-DEF-5 (workflow cache per-run)
- T5-DEF-6 (GitLab webhook ingest)
- T5-DEF-7 (audit emit)
- T5-DEF-8 (helpers AbortController)
- Marketplace automation (GitHub Action to sync plugins/mnm/ on master push)

### Process lessons (for T8 or future epics)
- TODO: fill in after execution — note any deviations from the plan and any new discipline worth carrying forward.

### MVP status
- TODO: mark "MVP complete" or "T8 scope TBD" based on remaining follow-ups.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md docs/superpowers/plans/2026-04-22-T7-polish-distribution.md
git commit -m "docs(workflows): T7 completion report + spec status (T7)"
git push
```

---

## Self-Review Checklist (ran by plan author)

**Spec coverage:**
- Hot-reload spike → covered by T4 (README + AGENTS_STALE) and T5 (onboarding skill).
- DEF-1 → T1.
- DEF-4 → T2.
- DEF-9 → T3.
- Marketplace → T6 (manifest) + user action for external repo.
- Onboarding skill → T5.
- All six T7 scope items have tasks.

**Placeholder scan:**
- No "TBD" / "fill in later" in implementation code blocks.
- Completion report (Task 7) has explicit TODOs for lessons + MVP decision — those are post-execution judgment calls, not implementation placeholders.

**Type consistency:**
- `SyncedAgent.configMerged` field name: `credential` (renamed from `env_ref`) — used consistently in T1 steps 4, 5, 7, and referenced by no other task.
- `resolveGitProvider` signature: `(companyId: string) => Promise<GitProvider>` — consistent in T2 steps 5, 6, 7 and T2 Step 10 commit.
- `GIT_PROVIDER_MISCONFIG` error code: introduced in T2 Step 3, used in T2 Step 5 throws.
- `resolveOAuthCompanyId` throw shape: `{ kind: "ambiguous"; available } | { kind: "forbidden"; companyId }` — used in T3 Step 4 and handled in T3 Step 5.
- `AGENTS_STALE.hints` shape: 3 strings — asserted in T4 Step 1, produced in T4 Step 3.

All three are internally consistent.

**No spec gap found that lacks a task.**
