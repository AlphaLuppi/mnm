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
| U5 | 4 pages UI | Monaco install + List / Editor / Runs / RunDetail + routes + parity + smoke | done | 4fc89a6, 87ff3b7, 7dfd246, f8b9219, 042dff9, 6b540f3, 36b07be |
| U6 | MCP tool parity | `createGovernedWorkflow`, `updateGovernedWorkflow`, `archiveGovernedWorkflow` + registry check | done | e7933a1 |
| U7 | Polish | Security regex, error_code, archive, listRuns sort, editor deadlock, AlertDialog, a11y, nav perm | done | 70fc10e, a094592, d89db26, 10684d9, 1188734, 8ec8156, c526b2c, 8dd8fe3, 44256eb |
| U8 | Monaco autocomplete + JSON schema validation | zod-to-json-schema, field descriptions, beforeMount schema reg, toolbar snippets | done | 59b00f9, 1e31ac0, 1c996ce, 4cea2a7 |

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
Status: done
Start: 2026-04-24
End: 2026-04-24
Commits:
  - 4fc89a6 chore(ui): add @monaco-editor/react + monaco-editor (U5.1)
  - 87ff3b7 feat(workflows): GovernedWorkflowsList page (U5.2)
  - 7dfd246 feat(workflows): GovernedWorkflowEditor page (Monaco + zod live) (U5.3)
  - f8b9219 feat(workflows): GovernedWorkflowRuns page (U5.4)
  - 042dff9 feat(workflows): GovernedWorkflowRunDetail page with SSE live updates (U5.5)
  - 6b540f3 feat(workflows): wire governed workflow routes (U5.6)
  - 36b07be chore(parity): track governed workflows UI features (U5.7)
Notes:
  - jsdom was not installed in the workspace; installed at root level as devDep.
    All 26 new page unit tests pass (4 test files x 4–9 tests each).
  - Breadcrumb interface uses `href` not `to` — pages corrected.
  - WorkflowDefinition schema uses flat `name` + step fields `agent`/`prompt_context`
    (no metadata.name, no kind/prompt). Default template corrected accordingly.
  - Kind literal is "GovernedWorkflow" (not "Workflow").
  - Tests are pure-logic (no React rendering) to avoid jsdom canvas for Monaco.
  - Monaco lazy-loaded via React.lazy() + Suspense as planned.
  - No setInterval/refetchInterval in any new code. SSE via useGovernedRunEvents.
  - All primitives used from ui/src/components/ui/ (Tabs, Badge, Card, Switch,
    Select, Dialog, Input, Textarea, Checkbox, Button).
  - Typecheck: 15/15 individual packages pass. Root mnm pre-existing Windows error.
  - Build: vite build succeeds in 31s with no new errors.
  - Pre-existing failing tests: 18 files / 23 tests (unchanged from before U5).

### U6 — MCP tool parity
Status: done
Start: 2026-04-24
End: 2026-04-24
Commits: e7933a1 feat(workflows): createGovernedWorkflow MCP tool
Notes: |
  All 3 tools (create/update/archive) implemented in a single commit because
  they share the same tool file, test file, and infrastructure (errors.ts,
  build-mcp-services.ts). Separate commits would have required split-staging
  a single file, which would have left the file in a broken intermediate state.

  Deviations from plan template:
  - Tool names use snake_case (create_governed_workflow, update_governed_workflow,
    archive_governed_workflow) to match the existing tool naming convention in
    the file (list_governed_workflows, launch_governed_workflow, etc.).
  - The plan template used camelCase (createGovernedWorkflow) but the file uses
    snake_case — existing convention wins.
  - Re-validation via workflowDefinitionSchema.safeParse in create handler is
    needed because collectTools does not validate input before calling handler.
  - resolveGitProvider added to buildMcpServices services object so tools can
    call saveDefinition without importing createResolveGitProvider directly.
  - No duplicate of saveDefinition/archiveDefinition logic — tools delegate to
    service helpers from governed-workflows-extensions.ts.

  Typecheck: 13/13 packages pass (pre-existing @embedded-postgres/windows-x64
  error on Windows root package is unrelated).
  Tests: 18/18 pass in governed-workflows.tool.test.ts (8 new tests for U6).

### U7 — Polish
Status: done
Start: 2026-04-24
End: 2026-04-24
Commits:
  - 70fc10e fix(workflows): harden workflow name with path-safe regex
  - a094592 fix(workflows): align validation error_code to spec WORKFLOW_VALIDATION
  - d89db26 fix(workflows): archive sets enabled=false atomically + exclude archived from list
  - 10684d9 fix(workflows): listRuns sort by started_at with capped limit
  - 1188734 fix(workflows): editor save dialog UX + list invalidation
  - 8ec8156 fix(workflows): UI polish — Textarea primitive, AlertDialog, a11y labels
  - c526b2c fix(workflows): nav workflow-editor requires workflows:create
  - 8dd8fe3 fix(workflows): omit status filter from runs query when Tous selected
  - 44256eb chore(workflows): drop dead legacy UI components + list_traces stale param

Summary: 10-commit polish pass addressing bugs identified by E2E test + 5-agent static review.
Fixed a CRITICAL path-traversal security hole in workflow name validation (regex + max 100 chars),
aligned all 5 mutation endpoints to emit WORKFLOW_VALIDATION (not VALIDATION_ERROR), made
archive atomically set enabled=false and listDefinitions filter archived_at IS NULL, capped
listRuns at 100/default 50 with started_at DESC ordering, fixed the editor Save button deadlock
(outer gate = JSON valid, inner = commit message), added list/detail cache invalidation on save,
scaffolded AlertDialog shadcn component to replace window.confirm in the archive flow, swapped
raw textarea for Textarea primitive in Runs launch dialog, added aria-labels for a11y, aligned
nav workflow-editor permission to workflows:create, fixed "__all__" status sentinel leaking into
API queries, deleted 2 orphan legacy components (StageEditorCard/WorkflowEditorPreview), and
removed the stale workflowInstanceId param from list_traces MCP tool (column dropped in m0066).

### U8 — Monaco editor autocomplete + live JSON schema validation
Status: done
Date: 2026-04-24
Commits:
  - 59b00f9 feat(governed-workflows): add French field descriptions on workflow schema
  - 1e31ac0 feat(governed-workflows): export workflowJsonSchema derived from zod
  - 1c996ce feat(workflows): Monaco editor autocomplete via JSON schema
  - 4cea2a7 feat(workflows): editor toolbar snippets — insert step/gate + format

Summary:
  - Installed zod-to-json-schema@3.25.2 in @mnm/governed-workflows (zero-dep, ~10KB).
  - Enriched all zod schema fields with .describe() French annotations:
    workflowDefinitionSchema (6 fields), workflowStepSchema (6 fields),
    gateItemSchema (3 fields), variableDefSchema (2 fields).
  - Exported workflowJsonSchema from @mnm/governed-workflows barrel via new
    packages/governed-workflows/src/workflow.jsonschema.ts. Uses $refStrategy:"none"
    (inline, no network calls) — Monaco resolves all refs client-side.
  - Wired into GovernedWorkflowEditor via beforeMount prop: registers the schema
    against URI "https://mnm.local/schemas/governed-workflow.json" with fileMatch:["*"].
    Options: validate:true, enableSchemaRequest:false, quickSuggestions, folding,
    suggestOnTriggerCharacters.
  - Editor ref captured via onMount. Snippet toolbar (3 buttons): "Insérer une étape"
    (step object at cursor), "Insérer une gate" (gate block at cursor), "Formater"
    (editor.action.formatDocument trigger).
  - Tests: 16 unit tests in workflow.jsonschema.test.ts (schema structure + descriptions
    + pattern assertions), 8 tests in GovernedWorkflowEditor.test.ts (beforeMount spy
    + workflowJsonSchema import), all 32 UI tests pass.
  - Typecheck: 15/15 packages pass (root pre-existing @embedded-postgres/windows-x64).
  - Live verification (chrome-devtools MCP):
    - INVALID_NAME → Monaco marker severity=4 on line 4, message "String does not match
      the pattern of ^[a-z0-9][a-z0-9_-]*$." — red squiggle confirmed in screenshot.
    - Side zod panel shows error simultaneously, "Enregistrer" button disabled.
    - Toolbar buttons render and fire (insert-step confirmed via screenshot).
  - Screenshots: u8-baseline-editor.png, u8-invalid-name-squiggle.png, u8-insert-step.png
  - No polling introduced. Monaco + schema remain lazy-loaded (import chain only resolves
    after the lazy() boundary). Side zod validation panel unaffected.
  - Deviation: $refStrategy:"none" wraps schema in { $ref, definitions:{GovernedWorkflow:{...}} }
    instead of flat root — Monaco handles this natively, tests adapted to unwrap the definitions
    key. The schema URI fileMatch:["*"] matches the in-memory model since it has no explicit URI.
