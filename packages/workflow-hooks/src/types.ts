/**
 * Type contracts shared by hook authors, the runner, and the server-side
 * service that wires them into governed workflow runs.
 *
 * Hook authors import `defineHook` (re-exported from `@mnm/workflow-hooks`)
 * to declare a typed hook function. The runner constructs `HookContext` and
 * invokes the function inside an `isolated-vm` isolate with a host-helpers
 * bridge attached.
 *
 * Security invariants enforced by the runner / host (NOT by these types):
 *  - `ctx.helpers.credential` is always undefined inside the isolate
 *    (HOST-ONLY, decision-log §4.4). The host injects Authorization headers
 *    on outbound HTTP calls; the isolate never sees a token.
 *  - Authorization headers supplied in `HttpRequest.headers` are silently
 *    overridden by the host (the hook author cannot bypass auth selection).
 *  - `inject.context_md` is bounded by `MAX_INJECT_BYTES` (default 64 KiB).
 *    Larger values surface as `HOOK_INJECT_TOO_LARGE`.
 *  - Outbound HTTP URLs are passed through `assertSafePublicUrl` before the
 *    host issues the request — DNS rebind / link-local / RFC-1918 blocked.
 */

/**
 * The four lifecycle phases at which a hook can run. Wired into the
 * governed-workflows orchestrator at `launchWorkflow` (`before_run` /
 * `after_run`) and `launchStep` / `completeStep` (`before_step` /
 * `after_step`). See `docs/superpowers/handoff-2026-05-02-T2-resume.md` §4
 * for the exact insertion lines.
 */
export type HookPhase =
  | "before_run"
  | "before_step"
  | "after_step"
  | "after_run";

/**
 * Result returned by a hook function. Shape validated by `hookResultSchema`
 * inside the runner before propagation back to the orchestrator.
 *
 * - `ok: false` short-circuits the phase and surfaces `error_code` to the
 *   audit row + (optionally) the run state machine, depending on the phase
 *   fail-mode. `report` and `hints` are surfaced to the user UI.
 * - `inject.context_md` is merged into the next step's `prompt_context` for
 *   `before_step` / `before_run`. Ignored for `after_*` phases.
 */
export interface HookResult {
  ok: boolean;
  error_code?: string;
  report?: string;
  hints?: string[];
  data?: Record<string, unknown>;
  inject?: { context_md: string };
}

/**
 * Inputs to the runner from the orchestrator. The runner builds a
 * frozen-deep `HookContext` from these and passes it into the isolate.
 *
 * `previous_artifacts` carries the artifacts produced by completed steps in
 * the same run (used by `after_step` hooks to read the just-committed
 * artifact, or by `before_step` hooks to read upstream inputs).
 */
export interface HookRunMeta {
  id: string;
  workflow_name: string;
  /** Git tag pinned at launchWorkflow time (immutable for the run). */
  git_tag: string;
  /** Variables provided when the run was initiated. */
  params: Record<string, unknown>;
}

export interface HookStepMeta {
  id: string;
  /** Artifacts produced by previously-completed steps, keyed by step id. */
  previous_artifacts: Record<string, unknown>;
}

/**
 * Read-only context object passed into the hook function. Frozen-deep
 * before crossing the isolate boundary.
 *
 * Generic parameters mirror `defineGate` for parity:
 *  - `Artifact`: shape of the step artifact for `after_step`. Undefined for
 *    `before_*` phases or for run-level (`*_run`) hooks.
 *  - `Config`: shape of the `with` object declared on the hook item in
 *    `workflow.json` (defaults to a plain record).
 */
export interface HookContext<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
> {
  artifact: Artifact | undefined;
  run: HookRunMeta;
  step: HookStepMeta;
  config: Config;
  phase: HookPhase;
  helpers: HostHelpers;
  // INVARIANT (enforced at runner.ts construction time, NOT in this type):
  // ctx.helpers.credential is always undefined inside the isolate.
}

// ─── Host helpers (HOST-ONLY auth, never expose tokens to isolate) ──────────

export interface HttpRequest {
  /**
   * Provider slug (matching `oauth_connectors.provider_slug`). The host looks
   * up the active connector for this `(companyId, providerSlug)` and injects
   * `Authorization: Bearer <token>` (oauth2) or `<api-key-header>: <key>`
   * (api_key) on the outbound request. Unknown / disabled provider →
   * `HOOK_PROVIDER_NOT_ALLOWED`.
   */
  provider: string;
  /**
   * Path to append to the connector's `base_url`. Must start with `/`. The
   * host concatenates `connector.base_url + path` and runs the result
   * through `assertSafePublicUrl` before issuing the fetch.
   */
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  /**
   * Additional request headers. Any `Authorization` / `Auth` / `X-API-Key`
   * header supplied here is silently dropped — the host re-injects from the
   * connector lookup. Authors cannot override auth selection from inside
   * the isolate.
   */
  headers?: Record<string, string>;
  /** Query string parameters appended after URL encoding. */
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface LlmRequest {
  prompt: string;
  /**
   * Optional system prompt prepended to the message. The host enforces a
   * per-run token budget; calls that would exceed the budget surface as
   * `HOOK_LLM_BUDGET_EXCEEDED` before any provider request is made.
   */
  system?: string;
  /** Anthropic Claude or OpenAI model id. Defaults to a small/fast model. */
  model?: string;
  /** Hard upper bound on output tokens. Default 4096. */
  max_tokens?: number;
}

export interface LlmResponse {
  text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface FetchHandoffArgs {
  /** Git sha pinned by the run; refusing dynamic refs prevents TOCTOU. */
  git_sha: string;
  /** Repo-relative POSIX path. */
  path: string;
}

/**
 * The bridge of host-side functions surfaced inside the isolate as
 * `ctx.helpers.<name>`. `installHelpers` from `@mnm/isolate-runtime` wires
 * each entry into a sandbox proxy with `helperTimeoutMs` enforced.
 *
 * Note: `credential` is INTENTIONALLY ABSENT here — host-only by design
 * (see decision-log §4.4). The runner constructs the helpers map without
 * it; an isolate that probes `ctx.helpers.credential` reads `undefined`.
 */
export interface HostHelpers {
  http(req: HttpRequest): Promise<HttpResponse>;
  llm(req: LlmRequest): Promise<LlmResponse>;
  fetchHandoff(args: FetchHandoffArgs): Promise<string>;
}

// ─── Connector token source (DI for the host helpers) ───────────────────────

/**
 * Subset of `connectorService` consumed by the host helpers. Decoupled to
 * avoid pulling the whole service into the package — keeps tests fast and
 * the dependency surface narrow.
 *
 * The `getUserToken` method MUST run `assertUserInCompany(userId, companyId)`
 * before the connector lookup (CONNECTOR_USER_NOT_IN_COMPANY → mapped to
 * `HOOK_USER_NOT_IN_COMPANY` by the host).
 */
export interface ConnectorTokenResult {
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
  /** "oauth2" | "api_key" — the host injects the appropriate header. */
  type: string;
}

export interface ConnectorTokenSource {
  getUserToken(
    userId: string,
    providerSlug: string,
    companyId: string,
  ): Promise<ConnectorTokenResult>;
  /**
   * Fetches the active connector for `(companyId, providerSlug)`. Used by
   * the host to read `base_url` + the api-key header name (when the
   * connector is `api_key` type). Returns null if no enabled connector
   * exists — the host translates this into `HOOK_PROVIDER_NOT_ALLOWED`.
   */
  getActiveConnectorBySlug(
    companyId: string,
    providerSlug: string,
  ): Promise<{
    id: string;
    type: string;
    baseUrl: string;
    /** Header name used to inject the api key, e.g. "X-API-Key". */
    apiKeyHeader?: string | null;
  } | null>;
}

// ─── Resolved hook (what the resolver hands to the runner) ──────────────────

/**
 * A fully-resolved hook source: either a canonical hook (registered in
 * `packages/workflow-hooks/canonical/`), a shared hook (loaded from the
 * `_shared` repo at `main`), or a local hook (loaded from the workflow's
 * own repo at the run's pinned git sha).
 */
export interface ResolvedHook {
  source: "canonical" | "shared" | "local";
  /** Bare hook id without the prefix (e.g. "jira-comment-on-complete"). */
  name: string;
  /**
   * Hook source code. For `source: "canonical"`, this is the import-resolved
   * function reference serialized as a require() call. For shared/local,
   * this is the raw `.hook.ts` content fetched via GitProvider.
   */
  code: string;
  /**
   * Pinned content sha. For `canonical`, this is a build-time digest of the
   * registered hook (or the package version for simplicity). For shared, the
   * sha of `main` at fetch time. For local, the run's pinned `git_tag` sha.
   */
  sha: string;
  /**
   * Source path used for the `compileHookSource` call (esbuild source map).
   * For canonical hooks, a synthetic path like `canonical/<name>.hook.ts`.
   * For shared/local, the actual repo-relative path.
   */
  sourcePath: string;
}

// ─── Runner options ─────────────────────────────────────────────────────────

export interface HookRunnerOptions {
  /**
   * Inner per-helper-call timeout. Default 30 000 ms (30 s). Helpers (HTTP,
   * LLM, fetchHandoff) are slower than gate helpers, hence the override
   * vs. gates' default of 3000 ms.
   */
  helperTimeoutMs?: number;
  /**
   * Outer timeout that wraps the entire isolate execution including
   * compilation + invocation. Default 35 000 ms — sized so a single helper
   * call at the inner ceiling still leaves room for the body to run.
   */
  outerTimeoutMs?: number;
  /** Memory limit for the isolate. Default 256 MiB. */
  memoryLimitMb?: number;
  /**
   * Maximum size in bytes of `result.inject.context_md`. Default 65 536
   * (64 KiB). Larger values surface as `HOOK_INJECT_TOO_LARGE`.
   */
  maxInjectBytes?: number;
  /** Retry once on `HOOK_SANDBOX_CRASH`. Default true (parity with gates). */
  retryOnSandboxCrash?: boolean;
}
