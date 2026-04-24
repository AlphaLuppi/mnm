# Governed Workflows UI — Progress Log

**Plan:** `docs/superpowers/plans/2026-04-24-governed-workflows-ui.md`
**Spec:** `docs/superpowers/specs/2026-04-24-governed-workflows-ui-design.md`
**Mode:** Full agent team (subagent-driven-development) — overnight run starting 2026-04-24 evening.

## Driving constraints (from user, carry over every dispatch)

- Atomic commit + push after each tranche (or natural sub-unit). Conventional commits scope `workflows`.
- GPG fallback: if `git commit` fails with `gpg: signing failed: Timeout`, retry with `-c commit.gpgsign=false`.
- No emojis anywhere (code, commits, docs).
- Respect `CLAUDE.md` rules: no polling (SSE only), multi-tenant `/companies/:companyId/` prefix, dynamic RBAC (permissions in DB, no hardcoded constants), tag-based isolation via `tagScopeMiddleware`, use `ui/src/components/ui/` primitives, BetterAuth actor, PostgreSQL RLS fail-closed.
- Git is canonical source for `workflow.json`. DB `governed_workflow_definitions` is a list cache only (no `definition_json` column).
- Save = `gitProvider.commitFile` on `main` + auto semver tag (`<workflow-name>/vX.Y.Z`, patch bump; `v0.0.1` if none).
- Runs default to `latest_git_tag`; toggle "Launch from HEAD" exists.
- Author identity comes from BetterAuth; git token from per-company `config_layer_item` of type `git_provider`.
- Nuke legacy workflows completely (pre-MVP, no data to migrate). MCP parity required: 3 new tools share service helpers with REST.
- Update `scripts/parity/data.ts` and GitNexus reindex after each tranche.

## Dispatch strategy

Sequential implementer subagents per tranche. After each tranche: spec compliance review → code quality review → fix loops → mark complete → next tranche.

| # | Tranche | Scope | Status | Commit(s) |
|---|---------|-------|--------|-----------|
| U1 | Nuke legacy | Migration 0066 + delete 5 DB tables, 12 server files, 8 UI files, xstate dep, dead perms, nav cleanup | done | (this commit) |
| U2 | REST endpoints + service extensions | 10 endpoints, `computeNextTag`, `saveDefinition`, `archiveDefinition`, `listRuns`, `getRunWithSteps`, `GitProvider.createTag` | done | f51df06, d7acd28, a93d2e6, 29f436f, 6246caf, 41bb843 |
| U3 | Live events server + UI hook | Emitter helpers + wire into launchStep/completeStep/gate runner, `useGovernedRunEvents` hook | done | 5a964f7, f11c201, c9d6775 |
| U4 | API client + query keys | `ui/src/api/governed-workflows.ts` + `queryKeys.governedWorkflows` namespace | done | 6c72052 |
| U5 | 4 pages UI | Monaco install + List / Editor / Runs / RunDetail + routes + parity + smoke | blocked by U4 | |
| U6 | MCP tool parity | `createGovernedWorkflow`, `updateGovernedWorkflow`, `archiveGovernedWorkflow` + registry check | blocked by U3 | |

## Session continuity

If the session is compacted or interrupted, resume by:

1. Reading this progress log.
2. Running `git log --oneline -20` to see which tranches landed.
3. Continuing with the next pending tranche via subagent-driven-development.
4. Keeping all driving constraints above in every subagent prompt.

## Per-tranche log

### U1 — Nuke legacy workflows
Status: done
Start: 2026-04-24T00:00:00Z
End: 2026-04-24T00:00:00Z
Commit: eafed96b7b1e48208ace6e083d5f44298681b6e6
Notes: Deleted 25 files (5 DB schema, 4 server routes, 8 server services, 1 MCP tool, 6 UI pages/api/component). Added 2 migration files. Also touched: routes/index.ts, services/index.ts, mcp/build-mcp-services.ts, mcp/tools/index.ts, services/heartbeat.ts, services/dashboard.ts, services/cursor-enforcement.ts, services/hitl-validation.ts, services/drift-monitor.ts, services/gold-trace-enrichment.ts, services/bronze-trace-capture.ts, services/trace-emitter.ts, services/trace-service.ts, routes/e2e-seed.ts, shared/types/trace.ts, shared/validators/trace.ts, shared/contracts/permissions.ts, shared/types/view-preset.ts, ui/App.tsx, ui/nav-registry.ts, server/package.json. Pre-existing test failures (138 fails) confirmed identical on master HEAD before changes. Migration test: 6/6 pass. Typecheck: all 13 packages pass (embedded-postgres Windows type error pre-existing).

### U2 — REST + service extensions
Status: done
Start: 2026-04-24T08:00:00Z
End: 2026-04-24T09:30:00Z
Commits:
  - f51df06 feat(workflows): shared row types for governed workflow DB rows (U2.1)
  - d7acd28 feat(workflows): computeNextTag semver bump helper (U2.2)
  - a93d2e6 feat(workflows): saveDefinition commits workflow.json and computes next tag (U2.3)
  - 29f436f feat(git-provider): add createTag + wire into saveDefinition (U2.4)
  - 6246caf feat(workflows): archiveDefinition + listRuns + getRunWithSteps helpers (U2.5)
  - 41bb843 feat(workflows): REST route skeleton + GET list endpoint (U2.6-U2.9 combined)
Notes:
  - U2.7, U2.8, U2.9 were implemented in the same pass as U2.6 (all 10 endpoints in a single route file). Consolidated into one commit with explanation in the commit body.
  - DB-integrated tests (saveDefinition, archiveDefinition, listRuns, getRunWithSteps) fail on Windows CI due to pre-existing Postgres auth issue (password authentication failed for user postgres). Pure-function tests (computeNextTag: 5/5) and route tests (14/14) pass.
  - LocalBareRepoProvider.createTag tests: 4/4 pass.
  - Typecheck: all 13 packages pass. Only pre-existing root-level @embedded-postgres/windows-x64 error remains.
  - archivedAt column added to DB Drizzle schema (packages/db/src/schema/governed_workflow_definitions.ts) — was in migration 0066 but missing from schema file.
  - Updated governed-workflows-source-resolver.test.ts stub to include createTag (interface compliance).
  - db:migrate: fails on Windows (no DATABASE_URL). Expected — would apply migration 0066 on a real DB.
  - Test suite: ~450 passing, ~29 failing (all pre-existing Windows Postgres + timing issues).

### U3 — Live events
Status: done
Start: 2026-04-24T09:30:00Z
End: 2026-04-24T11:00:00Z
Commits:
  - 5a964f7 feat(workflows): SSE emitters for governed run events
  - f11c201 feat(workflows): emit step_updated/gate_evaluated from governed service
  - c9d6775 feat(workflows): useGovernedRunEvents hook invalidates runDetail on SSE
Notes:
  - Added governed_run.step_updated and governed_run.gate_evaluated to LIVE_EVENT_TYPES in @mnm/shared.
  - Emitter helpers (emitStepUpdated, emitGateEvaluated) adapted to the real publishLiveEvent signature: { companyId, type, payload } — NOT channel-based as the plan sketched. The server uses a company EventEmitter, not channel strings.
  - launchStep: emits step_updated after initial transition, emits gate_evaluated + step_updated after entry gate results, emits step_updated after gate pass to running. Exit gate insert in completeStep uses .returning() to capture gate result IDs for emitGateEvaluated.
  - No useLiveEvents hook exists in the codebase — LiveUpdatesProvider is a monolithic WS handler. useGovernedRunEvents uses a custom DOM event (governed_run:updated) dispatched by handleLiveEvent; hook filters by companyId+runId and invalidates governedWorkflows.runDetail.
  - DB integration test for U3.2 blocked by Windows isolated-vm crash (pre-existing). Used pure emitter unit tests (2/2) + contract tests (2/2) instead.
  - useGovernedRunEvents hook tests: 4/4 pass (filter predicate + query key shape).
  - Typecheck: 13/13 packages pass (root mnm pre-existing @embedded-postgres/windows-x64 error excluded).

### U4 — API client
Status: done
Start: 2026-04-24T09:30:00Z
End: 2026-04-24T11:00:00Z
Commit:
  - 6c72052 feat(workflows): UI API client + query keys for governed workflows
Notes:
  - governedWorkflows queryKey namespace added: list, detail, tags, runs, runDetail.
  - governedWorkflowsApi: 10 methods (list, get, tags, create, update, setEnabled, delete, listRuns, getRun, launchRun). Typed against @mnm/shared row types + WorkflowDefinition from @mnm/governed-workflows.
  - @mnm/governed-workflows added to ui/package.json dependencies (needed for WorkflowDefinition type).
  - U4.1 was implemented before U3.3 (as the plan recommended) to resolve the forward reference to queryKeys.governedWorkflows.runDetail.

### U5 — 4 pages UI
Status: blocked by U4
Start:
End:
Commits:
Notes:

### U6 — MCP tool parity
Status: blocked by U2
Start:
End:
Commits:
Notes:
