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
 * - `WORKFLOW_RUN_NOT_FOUND` — `getWorkflowRun` / `launchStep` / `completeStep`
 *   called with a `runId` not visible to the actor's company (or absent).
 *   Returned instead of `404` so cross-tenant existence is never leaked.
 * - `WORKFLOW_DEPENDENCY_UNMET` — `launchStep` called on a step whose `deps`
 *   are not all `succeeded`.
 * - `WORKFLOW_STEP_NOT_FOUND` — `launchStep` / `completeStep` with a `stepId`
 *   not in the run's parsed workflow.
 * - `WORKFLOW_INVALID_ARTIFACT` — `completeStep` called with an artifact the
 *   step's exit-gate block flagged as invalid in a deterministic pre-check
 *   (distinct from a gate verdict — this is malformed data, not a failed
 *   business rule).
 * - `WORKFLOW_GATE_FAILED` — a gate block returned `pass:false`. Distinct from
 *   `WORKFLOW_INVALID_ARTIFACT` (malformed) and `GATE_*` codes (runner
 *   failures). The returned payload carries the failed `gate_result` so the
 *   harness can surface the author's `report` + `hints` to the user.
 * - `WORKFLOW_ALREADY_COMPLETED` — mutation attempted on a run already in
 *   `completed` or `failed` status (or on a step already in `succeeded` /
 *   `failed`).
 *
 * These codes are produced ONLY by the orchestrator. Gate runner code must
 * use `GATE_ERROR_CODES` instead.
 */
export const WORKFLOW_ERROR_CODES = Object.freeze({
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_RUN_NOT_FOUND: "WORKFLOW_RUN_NOT_FOUND",
  WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
  WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
  WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
  WORKFLOW_GATE_FAILED: "WORKFLOW_GATE_FAILED",
  WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
  AGENTS_STALE: "AGENTS_STALE",
  MISSING_TOOLS: "MISSING_TOOLS",
  // Emitted by resolveGitProvider when a company has a git_provider config
  // layer item but its shape is invalid (unknown `kind`, missing required
  // fields). Fail-closed: we never silently fall back to env vars when the
  // company explicitly declared a provider.
  GIT_PROVIDER_MISCONFIG: "GIT_PROVIDER_MISCONFIG",
  // Emitted by create/updateGovernedWorkflow when the definition body fails
  // workflowDefinitionSchema validation before any git or DB operation.
  WORKFLOW_VALIDATION: "WORKFLOW_VALIDATION",
  // Emitted by updateGovernedWorkflow when input.name does not match
  // definition.name (guards against accidental cross-workflow overwrites).
  WORKFLOW_NAME_MISMATCH: "WORKFLOW_NAME_MISMATCH",
  // Emitted by resolveSource (governed-workflows-source-resolver) when the
  // GitProvider cannot find the gate source file at the pinned sha. Distinct
  // from GIT_PROVIDER_ERROR — this is always a missing-file condition, never
  // a network/auth issue, so the hints are specific to workflow authoring.
  GATE_SOURCE_NOT_FOUND: "GATE_SOURCE_NOT_FOUND",
  // Emitted by wrap() in governed-workflows.tool when a raw GitProviderError
  // escapes resolveSource (e.g. auth failure, network error). Carries the
  // underlying git error code in hints for diagnosis.
  GIT_PROVIDER_ERROR: "GIT_PROVIDER_ERROR",
  // Emitted by governed-workflow-files when a client-supplied file path is
  // not a safe workflow-relative POSIX path (contains `..`, is absolute, or
  // uses backslashes). Fail-closed — never sanitise silently.
  WORKFLOW_FILE_INVALID_PATH: "WORKFLOW_FILE_INVALID_PATH",
  // Emitted by governed-workflow-files.getWorkflowFile when the requested
  // path does not exist at the pinned ref (or is a tree, not a blob).
  WORKFLOW_FILE_NOT_FOUND: "WORKFLOW_FILE_NOT_FOUND",
  // Emitted by governed-workflow-files.batchCommitWorkflowFiles when the
  // client submits zero changes. We refuse to create an empty commit — the
  // caller almost certainly has a bug.
  WORKFLOW_FILE_EMPTY_CHANGES: "WORKFLOW_FILE_EMPTY_CHANGES",
  // Emitted by loadCanonicalAgent when no enabled, non-archived agents row
  // exists for the referenced step.agent name, OR when the row exists but
  // latest_git_tag is NULL. Hints guide the caller toward create_agent.
  AGENT_NOT_REGISTERED: "AGENT_NOT_REGISTERED",
  // Emitted by create_agent MCP tool when latestGitTag is supplied but the
  // corresponding agents/<name>/agent.md blob is not found at that tag in the
  // git provider. Distinct from AGENT_NOT_REGISTERED (DB row issue) — this is
  // a missing git file that prevents the agent from ever being usable.
  AGENT_GIT_FILE_MISSING: "AGENT_GIT_FILE_MISSING",
  // Emitted by cancelRun on success path metadata, and by completeStep /
  // launchStep when the targeted run is in `cancelled` status. The mutation is
  // refused to keep cancelled runs immutable from the harness perspective.
  WORKFLOW_RUN_CANCELLED: "WORKFLOW_RUN_CANCELLED",
  // Emitted by cancelRun when the run is already in `cancelled` status.
  // Idempotent-ish guard so double-cancel from the UI surfaces a clear message
  // rather than silently no-op.
  WORKFLOW_RUN_ALREADY_CANCELLED: "WORKFLOW_RUN_ALREADY_CANCELLED",
  // Emitted by reactivateRun when the run is NOT in `cancelled` status.
  // Reactivation only makes sense from a cancelled state.
  WORKFLOW_RUN_NOT_CANCELLED: "WORKFLOW_RUN_NOT_CANCELLED",
  // Emitted by cancelRun when the run is in a terminal status (`completed` or
  // `failed`). Only active (`running`) runs can be cancelled.
  WORKFLOW_RUN_NOT_ACTIVE: "WORKFLOW_RUN_NOT_ACTIVE",
  // Emitted by cancelRun / reactivateRun when the actor lacks the required
  // permission within the run's company. Distinct from cross-tenant access
  // (which surfaces WORKFLOW_RUN_NOT_FOUND to avoid leaking existence).
  WORKFLOW_FORBIDDEN: "WORKFLOW_FORBIDDEN",
  // Emitted when a service-method input fails a basic shape/length check
  // (e.g. cancelRun with reason shorter than 5 chars). Distinct from
  // WORKFLOW_VALIDATION (zod failure on a workflow definition body) — this
  // is a per-call argument validation, not a definition body validation.
  WORKFLOW_INVALID_INPUT: "WORKFLOW_INVALID_INPUT",
  // ── T5 — composite (meta-workflow) error codes ─────────────────────────
  // Emitted by parseCompositeUses when a composite step's `uses:` reference
  // doesn't match the canonical `workflows/<name>@<ref>` shape. Should not
  // happen in practice (the Zod schema already enforces the regex) but the
  // runtime check is fail-closed for paths that bypass parsing.
  WORKFLOW_USES_INVALID: "WORKFLOW_USES_INVALID",
  // Emitted by detectCycle when the static `uses:` graph walk closes a cycle
  // (A → B → A). Refused at launchRun time, never reaches runtime expansion.
  WORKFLOW_COMPOSITE_CYCLE: "WORKFLOW_COMPOSITE_CYCLE",
  // Emitted by detectCycle when a referenced sub-workflow is not registered
  // in the company's workflow set at the pinned ref. Distinct from
  // WORKFLOW_NOT_FOUND on the root workflow.
  WORKFLOW_COMPOSITE_USES_NOT_FOUND: "WORKFLOW_COMPOSITE_USES_NOT_FOUND",
  // Emitted by detectCycle when the composite chain exceeds maxDepth (32).
  // Belt-and-braces against pathological resolvers; the regex already
  // prevents anything outside `workflows/<name>@<ref>`.
  WORKFLOW_COMPOSITE_DEPTH_EXCEEDED: "WORKFLOW_COMPOSITE_DEPTH_EXCEEDED",
  // Emitted by enforceFanoutCap when a root_run_id chain reaches the
  // configured cap (default 1000 step_executions across descendants).
  // Mitigates M4 — denial-of-wallet via runaway sub-run expansion.
  WORKFLOW_COMPOSITE_FANOUT_EXCEEDED: "WORKFLOW_COMPOSITE_FANOUT_EXCEEDED",
} as const);

export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];

/**
 * Fail-closed error codes produced by the hook runner (`@mnm/workflow-hooks`)
 * when a hook invocation cannot produce a user-authored result.
 *
 * Sandbox / runtime failures (parity with `GATE_ERROR_CODES`):
 * - `HOOK_TIMEOUT` — isolate exceeded the hook's outer timeout (default 30 s).
 * - `HOOK_EXCEPTION` — user code threw, OR esbuild/transform of the source
 *   failed, OR the host failed to wire the hook before invoking.
 * - `HOOK_INVALID_OUTPUT` — hook returned but the value did not match
 *   `HookResult` shape (missing `ok`, wrong types, oversized `inject`).
 * - `HOOK_SANDBOX_CRASH` — isolated-vm disposed the isolate mid-run
 *   (typically memory-limit breach or native addon fault). Like gates,
 *   the runner retries once before surfacing this code.
 *
 * Provider / connector mapping (host-side, before the isolate even starts):
 * - `HOOK_PROVIDER_NOT_ALLOWED` — `helpers.http({provider})` referenced a slug
 *   that has no enabled connector for the company. Maps from
 *   `CONNECTOR_NOT_CONFIGURED`.
 * - `HOOK_USER_NOT_CONNECTED` — the actor user has no token for the requested
 *   provider. Maps from `CONNECTOR_USER_NOT_CONNECTED`.
 * - `HOOK_TOKEN_EXPIRED` — token expired with no refresh available, OR refresh
 *   failed and the upstream token is now revoked. Maps from
 *   `CONNECTOR_TOKEN_EXPIRED_NO_REFRESH` and `CONNECTOR_TOKEN_REVOKED`. Both
 *   conditions require the user to reconnect — same operator action.
 * - `HOOK_USER_NOT_IN_COMPANY` — actor user is not a member of the company
 *   the hook is running for. Maps from `CONNECTOR_USER_NOT_IN_COMPANY`. Note:
 *   this check fires inside `getUserToken` BEFORE the connector lookup, so it
 *   can preempt `HOOK_PROVIDER_NOT_ALLOWED` even when the provider does not
 *   exist.
 *
 * Defense-in-depth:
 * - `HOOK_SSRF_BLOCKED` — `helpers.http` URL failed `assertSafePublicUrl`
 *   (private IP / loopback / link-local / private TLD).
 * - `HOOK_LLM_BUDGET_EXCEEDED` — `helpers.llm` call would exceed the per-run
 *   token budget configured by the company.
 * - `HOOK_INJECT_TOO_LARGE` — `result.inject.context_md` exceeds the max
 *   inject size (default 64 KiB).
 *
 * These codes are produced ONLY by the hook runner / host helpers. Do not
 * emit them from gates or from the orchestrator.
 */
export const HOOK_ERROR_CODES = Object.freeze({
  HOOK_TIMEOUT: "HOOK_TIMEOUT",
  HOOK_EXCEPTION: "HOOK_EXCEPTION",
  HOOK_INVALID_OUTPUT: "HOOK_INVALID_OUTPUT",
  HOOK_SANDBOX_CRASH: "HOOK_SANDBOX_CRASH",
  HOOK_PROVIDER_NOT_ALLOWED: "HOOK_PROVIDER_NOT_ALLOWED",
  HOOK_USER_NOT_CONNECTED: "HOOK_USER_NOT_CONNECTED",
  HOOK_TOKEN_EXPIRED: "HOOK_TOKEN_EXPIRED",
  HOOK_USER_NOT_IN_COMPANY: "HOOK_USER_NOT_IN_COMPANY",
  HOOK_SSRF_BLOCKED: "HOOK_SSRF_BLOCKED",
  HOOK_LLM_BUDGET_EXCEEDED: "HOOK_LLM_BUDGET_EXCEEDED",
  HOOK_INJECT_TOO_LARGE: "HOOK_INJECT_TOO_LARGE",
} as const);

export type HookErrorCode = (typeof HOOK_ERROR_CODES)[keyof typeof HOOK_ERROR_CODES];
