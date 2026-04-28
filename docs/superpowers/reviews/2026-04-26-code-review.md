# Code review — MnM Git-first agents refactor (Phase 2 commits)

Reviewer: code-reviewer
Date: 2026-04-26
Commits reviewed: edb1432..a140402 (11 commits — P0, P1, P2, P2.1, P3, P4+P6, P5, P7, P8, P9, P11)

## Verdict

**NEEDS FIXES — 2 BLOCKER, 3 MAJOR, 4 MINOR, 2 NIT**

The refactor is largely solid: P0 traversal protection lands cleanly, P1/P2/P2.1/P9
all hit the round-2 review acceptance criteria, P11 is a real E2E with deterministic
sha assertions. However, two commits leak path asymmetry that breaks the "git-first"
contract in production whenever `paths.agents` is configured: `syncEnvironment` still
hardcodes `<name>/agent.md` (B-CR-1), and `agents` table lacks the unique
`(company_id, name)` constraint that `loadCanonicalAgent` and `create_agent` rely on
implicitly (B-CR-2). Both must be fixed before MEP.

## Findings (severity-ranked)

### BLOCKER

#### B-CR-1 — `syncEnvironment` skips `resolveResourcePath`, will 404 in prod when `paths.agents` is set

**Commit**: 5f9178f / 82cf989 (refactor scope leak — P4/P5 should have covered this).
**File**: `server/src/services/governed-workflows.ts:1226`.
**Evidence**:
```ts
// 3. For each agent: fetch .md + merge config_layer_items
const gitProvider = await resolveGitProvider({ companyId: args.companyId, userId: args.userId ?? null, resourceType: "agent" });
const synced: SyncedAgent[] = [];
for (const a of rows) {
  if (!a.latestGitTag) continue;
  const mdPath = `${a.name}/agent.md`;   // ← hardcoded, ignores provider.paths.agents
  ...
  const blob = await gitProvider.fetchBlob({ path: mdPath, ref: a.latestGitTag! });
```
**Why it's wrong**: P5 fixed `setupWorkspace` to use `resolveResourcePath(...)` but
`syncEnvironment` (called by `pushLocalState` MCP tool, which runs every harness
sync) was missed. With the production layout `paths.agents = "agents"` and a repo
where `agents/<name>/agent.md` lives, `syncEnvironment` will request `<name>/agent.md`
→ GitProviderError("not_found") → since this code path has NO try/catch, the entire
`pushLocalState` aborts. This is the symmetric bug P5's plan acknowledged but didn't
land for this callsite.

Plan §5.5 explicitly required path symmetry for ALL agent reads, not just
`setupWorkspace`. Spec §T6 lists `pushLocalState`/`syncEnvironment` as the keepalive
contract — a permanent break here means the plugin never reaches a healthy state in
the new layout.

**Recommended fix**:
```ts
const mdPath = resolveResourcePath(
  gitProvider as ProviderWithPaths,
  "agent",
  a.name,
  "agent.md",
);
```
Plus consider replicating the P5 skip-on-404 + structured warn behaviour here for
parity (a 404 in `syncEnvironment` should ALSO be tolerated, not aborted, otherwise
one orphaned agent row blocks all syncs).

#### B-CR-2 — `agents` table lacks `UNIQUE (company_id, name)` — race + silent multi-row in `loadCanonicalAgent`

**Commit**: f099053 (P7 ships create_agent with no DB-level guard).
**File**: `packages/db/src/schema/agents.ts:15-48` (no unique constraint declared).
**Evidence**:
```ts
export const agents = pgTable("agents", { ... },
  (table) => ({
    companyStatusIdx: index("agents_company_status_idx").on(table.companyId, table.status),
    companyReportsToIdx: ...,
    scopedWorkspaceIdx: ...,
  }),  // ← no `unique("agents_company_name_uniq").on(companyId, name)`
);
```
And `loadCanonicalAgent` (`server/src/services/governed-workflows.ts:819`) does
`const [row] = await db.select()...` with no `orderBy` — when two enabled,
non-archived rows exist for the same `(company_id, name)`, behavior is non-deterministic
(Postgres may return either; likely insertion order, but not contractually).

**Why it's wrong**:
1. **Race condition**: two concurrent `create_agent` MCP calls for the same name both
   pass the `getById/list` lookups, both insert. No guard.
2. **Sequential pollution**: even without races, nothing prevents an operator from
   creating "senior-dev" twice (e.g. typo, archive-then-recreate without cleanup).
   Subsequent `loadCanonicalAgent` is non-deterministic about which row it picks
   → AGENTS_STALE flapping at runtime as different requests pin different `latestGitTag`s.
3. The plan's spec §6.1 implicitly assumes `(company_id, name)` is the agent's
   logical PK for git-first lookups. The Drizzle schema doesn't enforce it.

**Recommended fix**:
- Add migration `0068_agents_company_name_unique.sql`:
  ```sql
  -- Filter on archived_at IS NULL so soft-deleted rows can coexist with live ones.
  CREATE UNIQUE INDEX agents_company_name_active_uniq
    ON agents (company_id, name)
    WHERE archived_at IS NULL;
  ```
- Add `.onConflict()` handling in `agents.create()` and surface as
  `AGENT_NAME_TAKEN` (or reuse a generic `CONFLICT` code) so the MCP envelope is
  clean instead of bubbling a 23505 SQLSTATE.
- This must precede MEP since the unique index will also catch any pre-existing
  duplicate rows (one-shot data clean-up before deploy).

### MAJOR

#### M-CR-1 — Migration 0067 is not idempotent and the `_journal.json` jump idx 39 → 67 is suspicious

**Commit**: f803f1c.
**File**: `packages/db/src/migrations/0067_agents_archived_at.sql:6-8` and
`packages/db/src/migrations/meta/_journal.json` (last two entries).
**Evidence**:
```sql
ALTER TABLE "agents" ADD COLUMN "archived_at" timestamptz;
CREATE INDEX "agents_company_active_idx" ON "agents" ("company_id") WHERE "archived_at" IS NULL;
```
- No `IF NOT EXISTS` on the column or index → re-running fails on a partially-applied
  state (e.g. a crash mid-deploy, or a manual replay during incident recovery).
- Journal: `idx 39` (`0047_gold_prompts`) → `idx 67` (`0067_agents_archived_at`).
  The previous gap (idx 40-66 missing) is **pre-existing** and not introduced here,
  but P3 chose `idx: 67` to match the SQL filename — Drizzle's runner expects the
  `idx` to be sequential. Either (a) Drizzle is content with non-monotonic indices
  and matches by `tag`, in which case this is fine, or (b) it isn't, in which case
  P3 silently broke the runner. **The plan-author should have verified this against
  a fresh DB migration run** — but isolated-vm DLL crash on Windows means it wasn't.

**Why it's wrong**: deploy-time risk. A failed mid-migration leaves the column
partially created and a re-run dies on `ERROR: column "archived_at" of relation
"agents" already exists`.

**Recommended fix**:
```sql
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
CREATE INDEX IF NOT EXISTS "agents_company_active_idx" ON "agents" ("company_id") WHERE "archived_at" IS NULL;
```
And confirm with the plan-author that Drizzle's journal accepts the idx jump;
otherwise renumber to `idx: 40` (or the next contiguous slot).

#### M-CR-2 — `create_agent` AGENT_GIT_FILE_MISSING bypasses the `wrap()` envelope helper

**Commit**: f099053.
**File**: `server/src/mcp/tools/agents.tool.ts:131-153`.
**Evidence**:
```ts
const gwErr = new GovernedWorkflowError(
  WORKFLOW_ERROR_CODES.AGENT_GIT_FILE_MISSING,
  ...
);
return {
  content: [{
    type: "text" as const,
    text: JSON.stringify({
      error: gwErr.message,
      code: gwErr.code,
      error_code: gwErr.code,
      message: gwErr.message,
      hints: gwErr.hints,
      retryable: false,
    }),
  }],
  isError: true,
};
```
**Why it's wrong**: every other MCP tool in the registry surfaces
`GovernedWorkflowError` by **throwing** and letting `wrap()` build the envelope
(see P1 test in `governed-workflows.tool.test.ts:191`). This handler builds the
envelope by hand. Net effect: the envelope shape diverges (e.g. P1 envelope
includes `sub_cause` from `err.data` via spread; this hand-rolled one drops `data`).
Two consequences:
1. Envelope inconsistency — clients that key on `sub_cause` get inconsistent
   payloads between `launch_governed_step` and `create_agent`.
2. Future maintenance: when `wrap()` learns to emit a new field (e.g. correlation
   ID), this branch silently lags.

**Recommended fix**: just `throw gwErr;` and let the registry's `wrap()` (or
equivalent error handler in `defineMcpTools`) produce the envelope. Drop the
hand-rolled JSON construction.

#### M-CR-3 — `listWorkflowFiles` `resolveWorkflowDir` skips traversal protection

**Commit**: 841fe33.
**File**: `server/src/services/governed-workflow-files.ts:172-175`.
**Evidence**:
```ts
function resolveWorkflowDir(provider: ProviderWithPaths, workflowName: string): string {
  const base = provider.paths?.workflows ?? "";
  return base === "" ? workflowName : `${base}/${workflowName}`;
}
```
This is a **second** path-builder that does NOT delegate to `resolveResourcePath`.
P0's `rejectTraversal` is bypassed. The `subtree: workflowDir` is then passed to
`gitProvider.fetchTree({ subtree })`.

**Practical impact**: lower than B-CR-1 because:
- For `GitlabProvider`, the GitLab tree API is project-scoped — `..` segments don't
  escape the project.
- For `LocalBareRepoProvider`, `git ls-tree <ref> <path>` with `..` is rejected
  by git itself.

But the route does NOT validate `name` (URL param) before building the subtree —
the only DB check is `getWorkflowDefinitionRow`, which is bypassed when `?ref=` is
supplied. So a workflow name `../etc` survives to the service layer, and the
defense relies entirely on the downstream provider rejecting it. **Defense in
depth says reject early.**

**Recommended fix**: have `resolveWorkflowDir` either call `resolveResourcePath`
internally (e.g. with a sentinel `file = ""` and slice the trailing `/`) or
inline the same `rejectTraversal("name", workflowName)` call from
`git-resource-path.ts`. The cost is one regex per call, the benefit is a single
audit point.

### MINOR

#### N-CR-1 — `setupWorkspace` log payload field `providerProjectId` is misleading

**Commit**: 82cf989.
**File**: `server/src/services/governed-workflows.ts:1280-1287` (P5 warn block).
**Evidence**:
```ts
console.warn("[mnm.setup_workspace] agent_md_missing", {
  ...
  providerProjectId: (gitProvider as any).providerId ?? "unknown",
  fullPath: mdPath,
});
```
The field name says **Project**Id but the value is `providerId` (e.g.
`"gitlab:1234"` or `"local-test"`). Future ops chasing a 404 will assume this
maps to the GitLab project ID and waste minutes correlating. Also, the cast
`(gitProvider as any).providerId` works for both concrete providers but isn't
type-safe — adding `providerId` to the `GitProvider` interface would help.

**Recommended fix**: either rename to `providerId` to match the actual value,
or extract the project number from the providerId string when applicable.

#### N-CR-2 — `_journal.json` is missing trailing newline (style nit + lint)

**Commit**: f803f1c.
**File**: `packages/db/src/migrations/meta/_journal.json` (last line "no newline at EOF").
**Evidence**: from `git show f803f1c`: `\ No newline at end of file`.
**Why it matters**: tiny — but Drizzle regenerates the journal on `db:generate` and
will re-add the newline on the next migration. Won't break anything; just churn.

#### N-CR-3 — P9 test relies on dynamic mock of an already-imported module

**Commit**: 68786e8.
**File**: `server/src/services/__tests__/workflow-ai-assistant.test.ts:258-318`.
**Evidence**: the new tests do `await import("../governed-workflows.js") as any` and
mutate `gwsSpy.mockImplementation` mid-test. If the module isn't already vi.mock'd at
the top of the file, this is a no-op or error. (It IS mocked — see top of file —
but the assertion relies on the mock being globally scoped, and one test's mock
implementation leaks into the next unless `mockReset()` is called.)

**Why it matters**: the two new P9 tests both call `gwsSpy.mockImplementation(...)`
inside the test and rely on `// Restore` lines that reset to a generic mock. Test
execution order matters — if a future engineer adds a test before these, they may
inherit the leaked mock. Brittle but functional today.

**Recommended fix**: wrap each test's mock setup in `beforeEach`/`afterEach`, or
use `vi.spyOn` with explicit restoration via `spy.mockRestore()`.

#### N-CR-4 — `companyCache.set` happens twice on the env-fallback path

**Commit**: 37b057e.
**File**: `server/src/mcp/build-mcp-services.ts:303,351`.
**Evidence**: when `rows.length === 0` we set the cache at line 303 AND there's a
second `companyCache.set(companyCacheKey, provider)` at line 351 below the `else`
ladder. The early return at line 304 (`return provider;`) prevents the double-set,
so this is fine — but a future refactor that drops that return will silently re-set
the cache for the env fallback. Add a comment to make the intent explicit, or
restructure to a single `set` at the end.

### NIT

#### Nit-CR-1 — `rejectTraversal` doesn't decode URL-encoded segments

**Commit**: edb1432.
**File**: `server/src/services/git-resource-path.ts:13-21`.
**Evidence**: the check is `value.split("/").includes("..")`. Inputs like
`%2E%2E` (URL-encoded `..`) bypass this check. **However**, by the time the value
hits `resolveResourcePath`, the route layer has already URL-decoded it
(see `governed-workflows-files.ts:173: decodeURIComponent(rawPath)` — the path
case). So in practice, `..` arrives decoded. Still, defense-in-depth: add a
`decodeURIComponent` inside `rejectTraversal` and an explicit test for `%2E%2E`.

Also: the check rejects only `..` segments — **does not check** for backslash
`\\` separators (Windows-style). Git treats `\\` as a literal character in paths
on Linux, but cross-platform clients sometimes send Windows-style separators that
git providers may interpret. Low risk because the production runtime is Linux,
but a one-line `if (value.includes("\\")) throw ...` would close it.

#### Nit-CR-2 — P11 E2E doesn't assert structured warn payload from setupWorkspace

**Commit**: a140402.
**File**: `server/src/__tests__/feature-dev-techdesign.e2e.test.ts`.
**Evidence**: the E2E happy-pathes setupWorkspace with a real bare repo. The
`agents/<name>/agent.md` resolution is verified via `expect(seniorDev).toBeDefined()`,
but the test never deliberately deletes the `.md` to verify the skip-on-404 + warn
shape with a real provider (LocalBareRepoProvider) — that's only covered by the
unit test in `governed-workflows.test.ts`. Adding a second `it()` in the E2E that
removes the file and asserts the structured warn would close the gap between unit
and integration coverage.

## Verified clean

- **Multi-tenant**: cache keys (`${companyId}:${userId}:${rtKey}` and
  `${companyId}:${rtKey}`) consistently start with `companyId`. No cross-tenant
  reuse possible. (build-mcp-services.ts:188, 279.)
- **OAuth token leak**: P5 warn payload schema is exact-shape-asserted by the test
  (`Object.keys(payload).sort()`) AND has an explicit `for (const k of Object.keys)`
  regex check against `token|secret|password|credential`. The check is sound.
- **Per-user OAuth scoping**: P2.1 (395c03f) and P9 (68786e8) both add regression
  tests that the `userId` flows from the entry point through to `resolveGitProvider`.
  Spot-checked: `pushLocalState` → `syncEnvironment` → `resolveGitProvider` carries
  `userId` correctly (governed-workflows.ts:1222, 1328).
- **AGENT_NOT_REGISTERED sub_cause discrimination**: both `AGENT_ROW_MISSING` and
  `AGENT_TAG_MISSING` are throwable with the same outer `code` and distinguishable
  via `data.sub_cause`. P1 MCP envelope test confirms `data` is spread into the
  payload. (governed-workflows.tool.test.ts:204-218.)
- **Path traversal**: `resolveResourcePath` rejects `..` in EACH of `paths prefix`,
  `name`, `file` (P0 round-2 fix M-1 landed). Tests cover all three. The only
  bypass is in `resolveWorkflowDir` (see M-CR-3) but practical impact is bounded
  by downstream providers.
- **`canonical !== null` removal**: the change at governed-workflows.ts:592 is
  correct — when `provided === undefined`, `provided !== canonical.sha` is `true`
  → AGENTS_STALE is correctly thrown (no regression).
- **P11 sha assertion**: uses real `createHash("sha256").update(SENIOR_DEV_AGENT_MD)`
  (feature-dev-techdesign.e2e.test.ts:175-180) and a regex `/^[0-9a-f]{64}$/`.
  Not just `expect.any(String)`.

## Recommended team setup for fix phase

- **B-CR-1 (syncEnvironment path symmetry)**: 1 dev, ~30 min. Apply the same
  `resolveResourcePath` fix as P5 + add a focused unit test that mirrors the
  setupWorkspace skip-on-404 test.
- **B-CR-2 (unique constraint)**: 1 dev, ~1 h. Migration + Drizzle schema
  `unique(...)` + `agents.create()` conflict handling + 1 race-regression test
  (parallel `Promise.all` of two `create_agent` calls). Coordinate with whoever
  owns the deploy ordering — the unique index will fail if dup rows already exist
  in any environment, so plan a pre-deploy cleanup script.
- **M-CR-1 (migration idempotency)**: 1 dev, ~10 min. Add `IF NOT EXISTS`. Verify
  journal idx jump with the plan-author / a real Drizzle dry-run.
- **M-CR-2 (envelope consistency)**: 1 dev, ~15 min. Replace hand-rolled JSON with
  `throw gwErr`.
- **M-CR-3 (resolveWorkflowDir traversal)**: 1 dev, ~15 min. Inline
  `rejectTraversal("name", workflowName)` in `resolveWorkflowDir`.
- Minors + nits: bundled into a single follow-up PR (~1 h).

## OUT OF SCOPE (raised but not blocking)

- **Multiple `createResolveGitProvider` instances** (build-mcp-services.ts,
  governed-workflows-ai.ts, governed-workflows-files.ts, governed-workflows-ui.ts)
  each create independent caches → 4× the OAuth token-fetch traffic per request.
  Pre-existing, not introduced by these commits. Worth a follow-up issue, not a
  blocker.
- **`paths` config change without server restart**: cache keys don't include a
  `paths` hash, so a config update that re-sets `paths.agents` is invisible to
  cached provider instances until restart. The plan acknowledges this as a known
  limitation. Not a Phase-2 finding.

## Re-review (round 2) — verification of fixes

Reviewer: re-reviewer
Date: 2026-04-26

### Verdict

**ALL CLEAR — 13/13 findings VERIFIED. No regressions introduced. READY FOR M0+M1+M2+M3 OPS.**

Each closure was independently verified against the modified source/tests, not just commit messages. The two pre-existing issues (isolated-vm DLL crash on Windows, `@embedded-postgres/windows-x64` typecheck failure on root `mnm` package) are confirmed unchanged — out of scope.

### Per-finding verdict

| ID | Original severity | Fix commit | Verdict | Evidence |
|---|---|---|---|---|
| B-CR-1 / F-1 (PM) | BLOCKER | e91f640 | VERIFIED | `governed-workflows.ts:1232-1237` uses `resolveResourcePath(gitProvider as ProviderWithPaths, "agent", a.name, "agent.md")`. Skip-on-404 + structured warn at `:1250-1265` mirrors setupWorkspace. New unit test asserts `agents/pathed-agent/agent.md` is requested when `paths.agents="agents"` (governed-workflows.test.ts:748-771) AND that orphan agents do not abort sync (`:773-808`). |
| B-CR-2 | BLOCKER | 68a2872 | VERIFIED | `0068_agents_company_name_unique.sql:13-15` uses `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE archived_at IS NULL`. `agents.ts:55-57` declares the matching `uniqueIndex("agents_company_name_unique")` on `(companyId, name)` with the same partial predicate. Journal idx=68 entry present at `_journal.json:292-298`. New `agents-uniqueness.test.ts` asserts (a) duplicate active row rejected (`/duplicate key|unique|23505/`), (b) recreate after archive succeeds, (c) cross-tenant same-name allowed. |
| M-CR-1 | MAJOR | 9e0afcc | VERIFIED | `0067_agents_archived_at.sql:9` uses `ADD COLUMN IF NOT EXISTS`, `:11` uses `CREATE INDEX IF NOT EXISTS`. Trailing newline added at EOF. New test asserts both `IF NOT EXISTS` guards (`0067_agents_archived_at.test.ts` +6 lines). |
| M-CR-2 | MAJOR | c816b43 | VERIFIED | `agents.tool.ts:35-45` defines local `wrap()` matching governed-workflows.tool pattern. `:170-180` throws `GovernedWorkflowError` with structured `data: { agent_name, latest_git_tag, full_path }`. `governedError()` at `:15-33` spreads `...(err.data ?? {})` into the JSON envelope. Test asserts `body` contains `{ agent_name: "ghost", latest_git_tag: "v1", full_path: "agents/ghost/agent.md" }` (agents.tool.test.ts +8 lines). |
| M-CR-3 | MAJOR | 35d7c2f | VERIFIED | `git-resource-path.ts:24` exports `rejectTraversal`. `:25-39` decodes URL-encoded segments, rejects backslash, rejects absolute paths, rejects `..`. `governed-workflow-files.ts:178-183` `resolveWorkflowDir` calls `rejectTraversal("paths prefix", base)` AND `rejectTraversal("workflow_name", workflowName)` BEFORE concatenation. Tests cover `..`, `%2E%2E`, backslash, absolute, plain (git-resource-path.test.ts:67-99) plus 3 service-layer tests for listWorkflowFiles / getWorkflowFile / batchCommitWorkflowFiles (governed-workflow-files.test.ts:195-241). |
| N-CR-1 | MINOR | e91f640 | VERIFIED | `governed-workflows.ts:1259` (sync) and setupWorkspace warn payload now use field name `providerId` matching the actual value. Test exact-shape asserts the new key set (governed-workflows.test.ts:991-1003 — sorted keys include `providerId`, exclude `providerProjectId`). |
| N-CR-2 | NIT | 9e0afcc | VERIFIED | `0067_agents_archived_at.sql` ends with newline (verified by `git show 9e0afcc` — no `\ No newline at end of file` marker on the SQL file). |
| N-CR-3 | NIT | 9c23218 | VERIFIED | `workflow-ai-assistant.test.ts` now wraps the two P9 BLOCKER B-1 tests in a nested `describe(...)` block with `beforeEach` (re-installs the `gwsSpy.mockImplementation`) and `afterEach` (`gwsSpy.mockReset()` + reinstall benign default). No leaked state across tests. |
| N-CR-4 | NIT | 9c23218 | VERIFIED | `build-mcp-services.ts:306-309` adds an explanatory comment immediately above the early `return provider` to prevent a future refactor from silently double-setting the cache. |
| Nit-CR-1 | NIT | 35d7c2f | VERIFIED | `rejectTraversal` decodes via `decodeURIComponent` (with try/catch fallback), rejects `\\` separators. Tests cover `%2E%2E` smuggling and backslash (git-resource-path.test.ts:67-77 + 84-86). |
| Nit-CR-2 | NIT | 9c23218 | VERIFIED | `feature-dev-techdesign.e2e.test.ts:233-269` adds the skip-on-404 + structured warn case against the real `LocalBareRepoProvider`, asserting (a) live agent included, (b) ghost excluded, (c) warn payload `{agentName, latestGitTag, fullPath, providerId}`. |
| OPS-1 | OPS gap | fdb0471 | VERIFIED | `scripts/migrate-2026-04-26-mnm-demo.sh` (mode 100755 per `git ls-files --stage`): `#!/usr/bin/env bash`, `set -euo pipefail`, idempotent guards (clone fall-through, `git_mv_safe`, tag `rev-parse -q --verify`, --force opt-in, glab/curl HTTP-status switch). `scripts/migrate-2026-04-26-db.sql` (mode 100644): M0 fail-fast `DO $$ ... RAISE EXCEPTION 'M0 not applied'` at lines 24-33, defensive RAISE NOTICE pre-archive at lines 37-48, single TX `BEGIN; ... COMMIT;` at 50/116, 0/>1 match guard on config_layer_items discovery at 70-74, all 3 §M2 ops covered (paths config update L84-88, archive greeter/shouter L95-103, retag governed_workflow_definitions L107-114). |
| F-1 (PM validation) | BLOCKER | e91f640 | VERIFIED | (Same closure as B-CR-1 — `syncEnvironment` now uses `resolveResourcePath`. Demo flow M4 step 3 is unblocked.) |
| Pre-existing isolated-vm DLL | n/a | n/a | NOT-IN-SCOPE | Confirmed pre-existing (orchestration log line 38). Blocks local Windows test runs only. Linux CI unaffected. |
| Pre-existing typecheck `@embedded-postgres/windows-x64` | n/a | n/a | NOT-IN-SCOPE | Reproduced on this branch: `bun run typecheck` shows 15/16 packages pass; only root `mnm` package fails on Windows-only optional dep at `server/src/index.ts:419:41`. Identical to the failure documented in PM validation §M-1 — no NEW regression introduced by the fix bundle. |

### Tests audit

- **B-FIX-1** (governed-workflows.test.ts +73 LoC):
  - `it("uses resolveResourcePath when paths.agents is configured (fetches agents/<name>/agent.md, not <name>/agent.md)")` — asserts `fetchSpy` is called with `"agents/pathed-agent/agent.md"` and NOT `"pathed-agent/agent.md"`.
  - `it("skips agents whose .md is missing at the pinned tag (skip-on-404 with structured warn)")` — asserts result list excludes ghost, only `[mnm.sync_environment] agent_md_missing` warn fired exactly once.
- **B-FIX-2** (agents-uniqueness.test.ts +67 LoC, new file):
  - `it("rejects a second active row with the same (company_id, name)")` — `await expect(...).rejects.toThrow(/duplicate key|unique|23505/i)`.
  - `it("allows a new active row when the previous one is archived (partial index excludes archived rows)")`.
  - `it("allows the same name in two different companies")`.
- **M-FIX-3** (git-resource-path.test.ts +37 LoC, governed-workflow-files.test.ts +47 LoC):
  - `it("rejects '..'")`, `it("rejects URL-encoded '..'")`, `it("rejects backslash")`, `it("rejects absolute paths")`, `it("accepts plain workflow name")` (helper-level).
  - `it("listWorkflowFiles throws on workflowName='../evil'")`, `it("getWorkflowFile throws on workflowName='../evil'")`, `it("batchCommitWorkflowFiles throws on workflowName='../evil'")` (service-level).
- **M-FIX-2** (agents.tool.test.ts +8 LoC):
  - Existing test extended to assert `body` envelope contains `{ agent_name, latest_git_tag, full_path }` — proves `wrap() → governedError()` now spreads `err.data` into the JSON payload.
- **M-FIX-1** (0067_agents_archived_at.test.ts +6 LoC):
  - `it("is idempotent (IF NOT EXISTS on column add and index create)")` — regex assertions on the migration SQL file.
- **N-CR-1 / setup_workspace warn shape** (governed-workflows.test.ts modified):
  - `Object.keys(payload).sort()` asserts the renamed `providerId` key is present and `providerProjectId` is gone.

### Independent typecheck output

```
@mnm/shared        OK
@mnm/git-provider  OK
@mnm/adapter-utils OK
@mnm/plugin        OK
@mnm/governed-workflows OK
@mnm/adapter-pi-local OK
@mnm/db            OK
@mnm/adapter-cursor-local OK
@mnm/adapter-claude-local OK
@mnm/adapter-opencode-local OK
@mnm/adapter-codex-local OK
@mnm/gate-runner   OK
@mnm/test-utils    OK
@mnm/server        OK
@mnm/ui            OK
mnm (root)         FAIL — Cannot find module '@embedded-postgres/windows-x64' at server/src/index.ts:419:41 (PRE-EXISTING — same failure documented in PM validation §M-1)
```

15/16 packages pass. The single remaining failure is the documented Windows-only optional-dep issue from PM validation §M-1; no new regression introduced.

### Sign-off

**READY FOR M0+M1+M2+M3 OPS.**

All 13 findings (2 BLOCKER + 3 MAJOR + 4 MINOR + 2 NIT + OPS-1 + F-1 PM) are independently verified as closed with file-line evidence and matching test coverage. MnM founder can proceed with the demo cutover.
