import { api } from "./client";
import type { Visibility } from "@mnm/shared";

/**
 * Workflow Hooks API client (T2.9 plan).
 *
 * Wraps the REST endpoints exposed by `server/src/routes/workflow-hooks.ts`
 * (T2.8). All routes are tenant-scoped under `/companies/:companyId/`.
 *
 * Decision 12 of the plan: route paths in the UI stay simple (`/hooks`,
 * `/hooks/:configId`) — `companyId` is read from `useCompany()` context and
 * threaded into the API calls explicitly.
 */

export type HookPhase = "before_run" | "before_step" | "after_step" | "after_run";

export type HookExecutionStatus = "pending" | "success" | "failed" | "timeout";

export interface HookConfig {
  id: string;
  companyId: string;
  name: string;
  hookRef: string;
  defaultConfigJson: Record<string, unknown>;
  visibility: Visibility;
  /** Resolved tag ids when visibility = "tags". */
  tagIds: string[];
  /** Resolved principal ids when visibility = "principals". */
  principalIds: string[];
  createdByPrincipalId: string;
  enabled: boolean;
  /** Tier 3 — enforced by company across the listed phases. */
  enforced: boolean;
  enforcedPhases: HookPhase[];
  createdAt: string;
  updatedAt: string;
}

export interface HookExecution {
  id: string;
  hookRef: string;
  stepExecutionId: string | null;
  runId: string | null;
  phase: HookPhase;
  status: HookExecutionStatus;
  errorCode: string | null;
  durationMs: number | null;
  resultSummary: string | null;
  httpCallsCount: number;
  llmTokensIn: number;
  llmTokensOut: number;
  actorUserId: string | null;
  createdAt: string;
}

export type HookCatalogSource = "canonical" | "shared" | "local";

export interface HookCatalogEntry {
  source: HookCatalogSource;
  ref: string;
  name: string;
  description?: string;
  defaultConfig?: Record<string, unknown>;
}

export interface HookCatalog {
  canonical: HookCatalogEntry[];
  shared: HookCatalogEntry[];
  local: HookCatalogEntry[];
}

export interface CreateHookConfigPayload {
  name: string;
  hookRef: string;
  defaultConfigJson?: Record<string, unknown>;
  visibility?: Visibility;
  tagIds?: string[];
  principalIds?: string[];
  enabled?: boolean;
  enforced?: boolean;
  enforcedPhases?: HookPhase[];
}

export interface UpdateHookConfigPayload {
  name?: string;
  hookRef?: string;
  defaultConfigJson?: Record<string, unknown>;
  visibility?: Visibility;
  tagIds?: string[];
  principalIds?: string[];
  enabled?: boolean;
  enforced?: boolean;
  enforcedPhases?: HookPhase[];
}

export interface ListExecutionsFilters {
  configId?: string;
  runId?: string;
  status?: HookExecutionStatus;
  limit?: number;
  offset?: number;
}

function qs(filters?: ListExecutionsFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.configId) params.set("config_id", filters.configId);
  if (filters.runId) params.set("run_id", filters.runId);
  if (filters.status) params.set("status", filters.status);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Catalog query params — names mirror exactly the server-side reads in
 * `server/src/routes/workflow-hooks.ts` (`workflow_git_sha`, `shared_branch`,
 * `include_shared`, `include_local`).
 *
 * Historically the UI sent `workflow_ref` which the server silently ignored,
 * so the shared/local resolver never saw a workflow context. Fixed in P4-E.
 */
export interface CatalogQuery {
  /** Pinned commit SHA of the workflow.json that requested the catalog. */
  workflowGitSha?: string;
  /** Override branch for the shared hooks repo (defaults server-side). */
  sharedBranch?: string;
  /** Include shared:* entries (default true). */
  includeShared?: boolean;
  /** Include local:* entries (default false — server-side opt-in). */
  includeLocal?: boolean;
}

/**
 * Build the `?key=value&...` string for the catalog endpoint.
 * Exported for unit tests so we can assert the wire format directly.
 *
 * Back-compat: a bare string is treated as `workflowGitSha`, so call sites
 * still passing the legacy `workflowRef` string keep working (with the
 * correct server-side param name now).
 */
export function buildCatalogQuery(q?: CatalogQuery | string): string {
  if (!q) return "";
  const opts: CatalogQuery = typeof q === "string" ? { workflowGitSha: q } : q;
  const params = new URLSearchParams();
  if (opts.workflowGitSha) {
    params.set("workflow_git_sha", opts.workflowGitSha);
  }
  if (opts.sharedBranch) {
    params.set("shared_branch", opts.sharedBranch);
  }
  if (typeof opts.includeShared === "boolean") {
    params.set("include_shared", opts.includeShared ? "true" : "false");
  }
  if (typeof opts.includeLocal === "boolean") {
    params.set("include_local", opts.includeLocal ? "true" : "false");
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const hooksApi = {
  list: (companyId: string) =>
    api.get<{ configs: HookConfig[] }>(
      `/companies/${companyId}/workflow-hooks/configs`,
    ),
  get: (companyId: string, configId: string) =>
    api.get<HookConfig>(
      `/companies/${companyId}/workflow-hooks/configs/${encodeURIComponent(configId)}`,
    ),
  create: (companyId: string, input: CreateHookConfigPayload) =>
    api.post<HookConfig>(
      `/companies/${companyId}/workflow-hooks/configs`,
      input,
    ),
  update: (companyId: string, configId: string, patch: UpdateHookConfigPayload) =>
    api.patch<HookConfig>(
      `/companies/${companyId}/workflow-hooks/configs/${encodeURIComponent(configId)}`,
      patch,
    ),
  remove: (companyId: string, configId: string) =>
    api.delete<void>(
      `/companies/${companyId}/workflow-hooks/configs/${encodeURIComponent(configId)}`,
    ),
  listExecutions: (companyId: string, filters?: ListExecutionsFilters) =>
    api.get<{ executions: HookExecution[] }>(
      `/companies/${companyId}/workflow-hooks/executions${qs(filters)}`,
    ),
  /**
   * `query` accepts either:
   *   - a `CatalogQuery` object with explicit fields
   *   - a bare string (legacy call sites) → treated as `workflowGitSha`
   *
   * Both shapes serialise to the server-side names: `workflow_git_sha`,
   * `shared_branch`, `include_shared`, `include_local`.
   */
  catalog: (companyId: string, query?: CatalogQuery | string) =>
    api
      .get<{ catalog: HookCatalog }>(
        `/companies/${companyId}/workflow-hooks/catalog${buildCatalogQuery(query)}`,
      )
      .then((r) => r.catalog),
};

// ─── Pure helpers (exported for unit tests) ────────────────────────────────

/**
 * `hook_ref` regex: `^(canonical|shared|local):[a-z0-9-]+$`
 *
 * - source segment limited to the three known catalog roots
 * - id segment is kebab-case ascii (lowercase letters, digits, dash)
 *
 * Mirrors the server-side validation; we duplicate it here so the UI can show
 * the error before hitting the wire.
 */
const HOOK_REF_RE = /^(canonical|shared|local):[a-z0-9-]+$/;

export function isValidHookRef(ref: string): boolean {
  return HOOK_REF_RE.test(ref);
}

/**
 * Filter a `HookCatalog` by source. Returns the merged list in the natural
 * UI order (canonical → shared → local) so the page renders deterministically.
 */
export function filterCatalogBySource(
  catalog: HookCatalog,
  source: HookCatalogSource | "all",
): HookCatalogEntry[] {
  const order: HookCatalogSource[] = ["canonical", "shared", "local"];
  if (source === "all") {
    return order.flatMap((s) => catalog[s] ?? []);
  }
  return catalog[source] ?? [];
}

/**
 * Format a date for the audit list. Returns a short relative label
 * ("just now", "5m ago", "3h ago", "2d ago") for the past week, falling
 * back to a localized YYYY-MM-DD for older dates. Pure so the helper is
 * trivially testable (we pass `now` rather than reading `Date.now()`).
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const deltaMs = now.getTime() - date.getTime();
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  // Older — show ISO date only (trim time part).
  return date.toISOString().slice(0, 10);
}
