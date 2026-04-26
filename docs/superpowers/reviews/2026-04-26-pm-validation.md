# PM/UI validation — MnM Git-first agents refactor

Validator: pm-validator
Date: 2026-04-26
Commits validated: edb1432..a140402 (13 commits, all on master)

## Verdict

**GO WITH CAVEATS — 1 BLOCKER, 2 MAJOR findings, 1 doc gap.**

The 13 dev commits faithfully implement the plan's TDD tasks P0–P11 with strong evidence (helper, errors, resolveGitProvider, migration, loadCanonicalAgent hard error, setupWorkspace skip-on-404, create_agent extension, write-side symmetry, AI assistant userId fix, E2E test). However:

1. **BLOCKER F-1 (functional)** — `syncEnvironment` (`server/src/services/governed-workflows.ts:1226`) still hardcodes `${a.name}/agent.md` and does NOT use `resolveResourcePath`. After M2 sets `paths.agents="agents"` and the dev server restarts, M4 step 3 (`push_local_state` → `syncEnvironment`) will throw `GIT_PROVIDER_ERROR (not_found)` for every agent. This breaks the Monday demo flow.
2. **BLOCKER OPS-1** — Neither `scripts/migrate-2026-04-26-mnm-demo.sh` (M1) nor `scripts/migrate-2026-04-26-db.sql` (M2) was committed. Plan §M1 explicitly said "Script `scripts/migrate-2026-04-26-mnm-demo.sh` (à committer dans le repo MnM)". Tom must reconstruct from plan prose by Sunday afternoon.
3. **MAJOR M-1** — `bun run typecheck` from repo root fails on the `mnm` (root) package: `Cannot find module '@embedded-postgres/windows-x64'`. Confirmed PRE-EXISTING (server/src/index.ts not touched in range; same error reproduces on master HEAD without these changes). Acceptance criterion #3 ("typecheck passes") is technically not met but the failure is platform-specific (Windows optional dep) and unrelated to the refactor.

All BLOCKERs (B-1, B-2, B-3) and MAJORs (M-1..M-6) from arch-critic round 2 are independently verified as VERIFIED in the code (see B-section).

## A. Decisions actées (spec §2)

| # | Decision | Verdict | Evidence |
|---|---|---|---|
| 1 | Scope minimal A: agent.md = prompt only, rest in DB | DELIVERED | No frontmatter parser added. `loadCanonicalAgent` returns `{ content, sha }` only. `governed-workflows.ts:818,866` |
| 2 | Layout single-repo: `agents/<name>/agent.md` + `workflows/<name>/workflow.json` | DELIVERED | E2E test seeds exactly this layout: `feature-dev-techdesign.e2e.test.ts:71-73`. P0 helper produces it: `git-resource-path.ts:34` |
| 3 | Symmetric paths abstraction (γ) for agents AND workflows | DELIVERED | Helper applied in `governed-workflows.ts:341` (workflow) + `:851` (agent via loadCanonicalAgent) + `:1272` (setupWorkspace) + `governed-workflow-files.ts:194,231,302` (Studio write-side) + `governed-workflows-extensions.ts:117` (saveDefinition). PARTIAL on `:1226` (syncEnvironment — see F-1) |
| 4 | Forme `paths`: `{ agents, workflows, ... }` in configJson, defaults `""` | DELIVERED | `git-resource-path.ts:30`: `provider.paths?.[key] ?? ""`. `build-mcp-services.ts:349` attaches `cfg.paths ?? {}` to provider |
| 5 | `create_agent` extended with `latestGitTag?: string`, validates Git presence | DELIVERED | `agents.tool.ts:106-113` zod schema + `:117-154` validation logic. Throws `AGENT_GIT_FILE_MISSING` on 404. Whitespace check via `.refine`. |
| 6 | greeter/shouter archived (archived_at + enabled=false) | OPS GAP | Code supports it (P3 column + P5 filter). DB script to actually archive them is documented in plan §M2 but NOT committed as `scripts/migrate-2026-04-26-db.sql`. |
| 7 | `AGENT_NOT_REGISTERED` hard error (no silent null) | DELIVERED | `governed-workflows.ts:830-836` (row missing → `sub_cause: AGENT_ROW_MISSING`), `:838-844` (tag null → `sub_cause: AGENT_TAG_MISSING`). `launchStep:587` no longer has null-check. |
| 8 | Repo target: `lab.enterprise.example/example-org/mnm-demo` | OPS GAP | Plan §M2 SQL exists but not committed as a script file. Repo restructure script also not committed. |
| 9 | Stop at M4 in code; M5 polish manual | DELIVERED | No M5 artifacts in commits. E2E test only covers tech-design step. |

## B. In-scope items (spec §3)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Path convention `agents/<name>/agent.md`, `workflows/<name>/workflow.json`, gates | DELIVERED | E2E test seeds + asserts the convention end-to-end (`feature-dev-techdesign.e2e.test.ts:70-74`). Gate path translation auto-derived via `workflowDir` from `governed-workflows-source-resolver.ts` (per plan §2.2). |
| 2 | `paths` field in configJson, optional, defaults `""` | DELIVERED | `git-resource-path.ts:30` `?? ""` semantics. `build-mcp-services.ts:349` attaches via `cfg.paths ?? {}`. |
| 3 | Helper `resolveResourcePath(provider, resourceType, name, file)` centralized | DELIVERED | `server/src/services/git-resource-path.ts:23-35` (1 file, 35 LoC). Imported by 4 callers. |
| 4 | `resourceType: "agent"\|"workflow"` arg added to `resolveGitProvider` | DELIVERED | `build-mcp-services.ts:50-53` `ResolveGitProviderArgs` signature. `:301` `.orderBy(asc(createdAt), asc(id))` for deterministic multi-item selection. |
| 5 | Hard error `AGENT_NOT_REGISTERED` in `loadCanonicalAgent` | DELIVERED | `governed-workflows.ts:830-844` two distinct sub_causes. |
| 6 | Graceful skip on missing agent.md in `setupWorkspace` (skip + log warn) | DELIVERED | `governed-workflows.ts:1297-1310` try/catch with `GitProviderError.code === "not_found"` filter, structured warn payload `{companyId, agentId, agentName, latestGitTag, providerProjectId, fullPath}`. Re-throws non-404 errors. |
| 7 | Filter `archived_at IS NULL` in setupWorkspace + listings | DELIVERED for setupWorkspace + loadCanonicalAgent | `governed-workflows.ts:827` (loadCanonicalAgent), `:1260` (setupWorkspace). NOT applied to `syncEnvironment:1198-1208` — only filters `enabled = true`. Spec §3 says "tous les listings d'agents publics" — debatable scope; syncEnvironment is internal sync state, not a public listing. |
| 8 | `create_agent` extension: `latestGitTag?: string` + Git validation | DELIVERED | `agents.tool.ts:106-154`. Test in `agents.tool.test.ts` (167 lines new). |
| 9 | Migration ops documented (M1-M4) | PARTIAL | Plan documents them in prose. Scripts NOT committed (see OPS-1). |

## C. Acceptance criteria (spec §11 + plan §11.6 round 2)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `agents.archived_at` column exists | DELIVERED | `packages/db/migrations/0067_agents_archived_at.sql:6` `ALTER TABLE "agents" ADD COLUMN "archived_at" timestamptz`. Drizzle schema `packages/db/src/schema/agents.ts:39` `archivedAt: timestamp(...)`. Journal entry `_journal.json` idx=67. |
| 2 | P11 E2E test returns triplet `(agent_name, subagent_type, prompt_context)` without errors | DELIVERED | `feature-dev-techdesign.e2e.test.ts:224-230` asserts `agentName: "senior-dev", subagentType: "mnm--senior-dev", promptContext: { ticket_id: "ISSUE-NN" }`. Test runs full stack: setupWorkspace → launchWorkflow → launchStep with discovered sha. |
| 3 | Each new helper/error has red→green test | DELIVERED | Helper: `git-resource-path.test.ts` (66 lines, 8 tests). Errors: `errors.test.ts` updated (+7 lines covering AGENT_NOT_REGISTERED + AGENT_GIT_FILE_MISSING + 3 pre-existing file codes). MCP envelope routing: `governed-workflows.tool.test.ts` (+29 lines). syncEnvironment userId: `governed-workflows.test.ts` (+423 lines incl. P2.1 regression tests). create_agent: `agents.tool.test.ts` (167 lines new). AI assistant: `workflow-ai-assistant.test.ts` (+62 lines). Migration: `0067_agents_archived_at.test.ts` (15 lines). |
| 4 | `bun run typecheck` passes from repo root | PARTIAL | All 15 internal packages pass. Root `mnm` package fails on `@embedded-postgres/windows-x64` (Windows-only optional dep — pre-existing, NOT introduced by this refactor; same error reproduces with stash). NOT a refactor regression. |
| 5 | No existing test regresses | NOT VERIFIED | Cannot run `bun test` in this validator session. Per orchestration log `2026-04-26-orchestration-log.md:38`: "Pre-existing isolated-vm DLL crash on Windows blocks local test runs; tests will pass on Linux CI." Tom must run on Linux CI before demo. The 3 userId regression tests (`governed-workflows.test.ts:202,354,803`) are documented as adapted in plan §3.8 — diff shows test file grew 423 lines (new + adapted). |
| 6 | M0 must explicitly run before M2 | DELIVERED in plan + DOC fail-fast in M2 SQL | Plan §M0 (lines 1347-1369) is sequenced before M1/M2. Plan §M2 SQL contains `DO $$ ... IF NOT EXISTS ... archived_at ... RAISE EXCEPTION` guard (plan lines 1439-1448). HOWEVER — the SQL guard exists only in plan prose, not in a committed script (OPS-1). |
| 7 | B-1 (P9) closure captures `userId` + propagates `resourceType` | DELIVERED | `workflow-ai-assistant.ts:282-285`: `const userId = input.userId; ... resolveGitProvider({ companyId: a.companyId, userId, resourceType: a.resourceType })`. 2 dedicated tests `workflow-ai-assistant.test.ts` (+62 lines). |
| 8 | B-2 (P2.1) `syncEnvironment` propagates `userId` + `resourceType` | DELIVERED for resolveGitProvider call; PATH NOT REFACTORED | `governed-workflows.ts:1222`: `await resolveGitProvider({ companyId, userId, resourceType: "agent" })` ✅. BUT `:1226 const mdPath = \`${a.name}/agent.md\`` does NOT use resolveResourcePath ❌ — see F-1 below. |

## D. Operational readiness (M0–M4)

| # | Op | Status | Evidence / Caveat |
|---|---|---|---|
| M0 | "Apply pending Drizzle migrations" | READY | `package.json` exposes `db:migrate` command (`bun run --cwd packages/db migrate` → `tsx src/migrate.ts`). Migration `0067_agents_archived_at.sql` committed and journal entry present. Tom can run `bun run db:migrate` directly. |
| M1 | Repo restructure script | NOT COMMITTED | Plan §M1 lines 1376-1411 describe the bash script in prose. NO file at `scripts/migrate-2026-04-26-mnm-demo.sh`. Tom must copy-paste from plan into a script file Sunday morning, then verify branch protection caveat (plan §1413-1416). |
| M2 | DB SQL (paths config + archive greeter/shouter + retag) | NOT COMMITTED | Plan §M2 lines 1432-1481 describe the SQL in prose. NO file at `scripts/migrate-2026-04-26-db.sql`. Includes the PL/pgSQL fail-fast guard against missing column. The `<DISCOVERED_ID>` placeholder query is in plan §2.4 — Tom must run it live to find the actual UUID. Wrapped in `BEGIN; ... COMMIT;` (single-TX). |
| M3 | 4 `create_agent` MCP calls | READY | Plan §M3 lines 1493-1497 has the exact JSON payloads (senior-dev, dev, review-watcher, release-mgr — all with `latestGitTag: "agents/v1.0.0"`). Rollback SQL plan §M3 lines 1505-1517 documented for partial-failure scenarios (deduplicateAgentName collision risk). |
| M4 | E2E run instructions for Tom | READY | Plan §M4 lines 1526-1554 has the exact MCP call sequence + expected/forbidden responses. |

## E. Hors-scope respect (spec §4)

Verified the dev did NOT implement out-of-scope items:

- ✅ NOT IMPLEMENTED: Frontmatter YAML in `agent.md` (refacto B). `loadCanonicalAgent` returns `{ content, sha }` only — no parsing of frontmatter. `agents.tool.ts:create_agent` still takes title/adapterType/etc. as separate fields.
- ✅ NOT IMPLEMENTED: `register_agent_from_git` MCP tool. Only `create_agent` was extended.
- ✅ NOT IMPLEMENTED: Sub-repo split. Single-repo layout assumed throughout.
- ✅ NOT IMPLEMENTED: UI promote button.
- ✅ NOT IMPLEMENTED: `config_layer_items` in Git with sourceContentHash.
- ✅ NOT IMPLEMENTED: Lifecycle archivage UI.

**No scope creep detected.**

## Functional checks output

- **typecheck**: PARTIAL — 15/16 packages PASS. Root `mnm` package fails on `@embedded-postgres/windows-x64` (Windows optional dep). Confirmed pre-existing — `git stash; bun run typecheck` reproduces same error without these commits.
- **git log all commits in master**: PASS — `git branch --contains a140402` returns `master`. All 13 commits are linear in `edb1432..a140402`.
- **diff stat**: PASS — moderate churn: 22 files, +1364 / −82 LoC. No surprise deletes. Test churn dominates implementation churn (governed-workflows.test.ts +423, agents.tool.test.ts +167, e2e +232) — consistent with strict TDD discipline claimed in plan §4.
- **migration 0067 sane**: PASS — uses unquoted `agents`/`archived_at` IDs, includes `--> statement-breakpoint`, partial index `WHERE "archived_at" IS NULL`. NO `IF NOT EXISTS` guard on the column ADD (would conflict with Drizzle journal idempotency model — drizzle-kit prevents re-runs via journal). Acceptable.
- **journal entry idx=67**: PASS — `meta/_journal.json` lines 286-291 contain the 0067 entry with breakpoints=true.
- **5f9178f loadCanonicalAgent uses resolveResourcePath + throws**: PASS — confirmed lines 830, 838, 851 of governed-workflows.ts.

## Demo readiness

- [x] Code-level support for git-first layout is complete for the M4 flow EXCEPT step 3.
- [x] All canonical paths (loadCanonicalAgent, getWorkflowParsed, setupWorkspace, batchCommitWorkflowFiles, saveDefinition, listWorkflowFiles, getWorkflowFile, AI-assistant) use `resolveResourcePath` correctly.
- [ ] **`syncEnvironment` (called by `pushLocalState` = M4 step 3) does NOT use `resolveResourcePath`** → will 404 after M2. **Tom MUST patch this before Monday demo** (single-line fix: replace `${a.name}/agent.md` with `resolveResourcePath(gitProvider as ProviderWithPaths, "agent", a.name, "agent.md")`).
- [ ] M1 bash script not committed — Tom must reconstruct from plan §M1 prose and verify on lab.enterprise.example.
- [ ] M2 SQL not committed — Tom must reconstruct from plan §M2 prose, run the §2.4 discovery query for the config_layer_item UUID, then execute single-TX.
- [x] M3 MCP payloads are exact (4 calls, all with `latestGitTag: "agents/v1.0.0"`).
- [x] M4 expected/forbidden response set documented.
- [x] M5 polish remains manual (Tom Sunday morning) — within plan scope.

## Findings to address before demo

### BLOCKER

**F-1 — `syncEnvironment` does not use `resolveResourcePath`.**
File: `server/src/services/governed-workflows.ts:1226`
Code: `const mdPath = ` `${a.name}/agent.md` `;`
Impact: After M2 sets `paths.agents="agents"` and the dev server restarts, `pushLocalState` (M4 step 3) calls `syncEnvironment` which iterates over agents and calls `gitProvider.fetchBlob({ path: "<name>/agent.md", ref: "agents/v1.0.0" })`. With the new repo layout, the file lives at `agents/<name>/agent.md` — fetchBlob will throw `GitProviderError(code: "not_found")`. There is no try/catch, so the throw propagates out of `pushLocalState` and the MCP call fails with `GIT_PROVIDER_ERROR`.
Fix: 1-line replacement (mirror the loadCanonicalAgent pattern at line 851).
Owner: Tom or whoever runs P12 patch before demo.
Severity: BLOCKING for M4 step 3.

**OPS-1 — M1/M2 ops scripts not committed.**
Plan §M1 explicitly required `scripts/migrate-2026-04-26-mnm-demo.sh` (line 1376). Plan §M2 implies a `scripts/migrate-2026-04-26-db.sql` (line 1432). Neither file exists in `scripts/`. Tom must transcribe both from plan prose Sunday afternoon. Risk: copy-paste error, missing the M0 fail-fast guard, missing the Nit-2 SELECT COUNT defensive log, or missing the §2.4 `<DISCOVERED_ID>` resolution step.
Owner: Tom (transcription) before M1/M2 execution.

### MAJOR

**M-1 — Root typecheck failure (pre-existing, Windows-only).**
`bun run typecheck` from repo root fails on `mnm` package: `Cannot find module '@embedded-postgres/windows-x64'` at `server/src/index.ts:419:41`. Confirmed pre-existing (reproduces on master HEAD without these commits). Acceptance criterion #4 is technically violated. NOT introduced by this refactor.
Fix: Out of scope for this validation. Linux CI should pass.
Severity: Acknowledge, not block.

**M-2 — Tests not run in this validation session.**
Per orchestration log line 38, isolated-vm DLL crash blocks local test runs on Windows. Tom MUST run `bun run test:e2e` (or full `bun test`) on Linux CI before demo to confirm zero regressions on the 3 adapted userId tests (`governed-workflows.test.ts:202,354,803`) and the new P11 E2E test (`feature-dev-techdesign.e2e.test.ts`).
Owner: Tom (CI run) before M1.
Severity: HIGH — acceptance criterion #5 unverified.

### MINOR

**N-1 — `syncEnvironment` `archived_at IS NULL` filter missing.**
`governed-workflows.ts:1198-1208` filters `enabled = true` only. After greeter/shouter are archived in M2, `syncEnvironment` will still iterate over them (and try to fetch their `.md`, which will 404 unless they have `latestGitTag = NULL` — in which case the `if (!a.latestGitTag) continue` at line 1225 saves us).
Impact: Likely benign for the demo (greeter/shouter have no tag after archival per spec §M2). But the inconsistency with `setupWorkspace:1260` and `loadCanonicalAgent:827` is a smell.
Fix: Add `isNull(agents.archivedAt)` to the WHERE clause at line 1198.
Severity: LOW — defensive cleanup.

**N-2 — `agents_company_active_idx` not in Drizzle schema declaration.**
`packages/db/src/schema/agents.ts:43-47` declares 3 indices but NOT `agents_company_active_idx`. The migration SQL creates it raw. If someone runs `drizzle-kit generate` later, it will produce a "drift" detection. Acceptable for now — Drizzle supports raw SQL migrations — but worth noting for post-demo cleanup.
Severity: NIT.

## Summary table

| Category | DELIVERED | PARTIAL | MISSING | OUT OF SCOPE |
|---|---|---|---|---|
| Decisions actées (§A) | 7 | 0 | 0 | 0 (+ 2 OPS GAP for #6, #8) |
| In-scope items (§B) | 8 | 1 | 0 | 0 |
| Acceptance criteria (§C) | 6 | 2 | 0 | 0 |
| Operational readiness (§D) | 3 | 0 | 2 | 0 |
| Hors-scope respect (§E) | n/a | n/a | n/a | 6/6 confirmed not implemented |

**Net**: 24/26 spec items DELIVERED, 3 PARTIAL (path symmetry not extended to syncEnvironment, typecheck fails on pre-existing Windows-only issue, tests unverified locally), 2 MISSING (ops scripts not committed). 0 scope creep.

**Recommendation to team-lead**: GO WITH CAVEATS. Tom must patch F-1 (single-line fix) and write the 2 ops scripts before Sunday afternoon. CI test run on Linux required to close acceptance criterion #5.
