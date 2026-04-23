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
| U2 | REST endpoints + service extensions | 10 endpoints, `computeNextTag`, `saveDefinition`, `archiveDefinition`, `listRuns`, `getRunWithSteps`, `GitProvider.createTag` | blocked by U1 | |
| U3 | Live events server + UI hook | Emitter helpers + wire into launchStep/completeStep/gate runner, `useGovernedRunEvents` hook | blocked by U2 | |
| U4 | API client + query keys | `ui/src/api/governed-workflows.ts` + `queryKeys.governedWorkflows` namespace | blocked by U2 | |
| U5 | 4 pages UI | Monaco install + List / Editor / Runs / RunDetail + routes + parity + smoke | blocked by U4 | |
| U6 | MCP tool parity | `createGovernedWorkflow`, `updateGovernedWorkflow`, `archiveGovernedWorkflow` + registry check | blocked by U2 | |

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
Status: blocked by U1
Start:
End:
Commits:
Notes:

### U3 — Live events
Status: blocked by U2
Start:
End:
Commits:
Notes:

### U4 — API client
Status: blocked by U2
Start:
End:
Commit:
Notes:

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
