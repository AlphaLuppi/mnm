import { api } from "./client";
import type {
  GovernedWorkflowDefinitionRow,
  GovernedRunRow,
  GovernedStepExecutionRow,
  GateResultRow,
} from "@mnm/shared";
import type { WorkflowDefinition } from "@mnm/governed-workflows";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface SaveDefinitionResult {
  commitSha: string;
  newGitTag: string;
  created: boolean;
}

export interface StepWithGates extends GovernedStepExecutionRow {
  gateResults: GateResultRow[];
}

export interface RunWithSteps {
  run: GovernedRunRow;
  steps: StepWithGates[];
}

export interface ListRunsResult {
  items: GovernedRunRow[];
  total: number;
}

export interface ListWorkflowsResult {
  items: GovernedWorkflowDefinitionRow[];
  total: number;
}

export interface WorkflowParseError {
  error_code: string;
  message: string;
  hints: string[];
}

export interface WorkflowDetail {
  definition: GovernedWorkflowDefinitionRow;
  parsed: {
    workflow: WorkflowDefinition;
    gitTag: string;
    gitSha: string;
    workflowRepoPath: string;
  } | null;
  parseError: WorkflowParseError | null;
}

export interface GitTag {
  name: string;
  sha: string;
}

export interface LaunchRunResult {
  runId: string;
  firstStep: string;
  gitTag: string;
  gitSha: string;
}

// ── Workflow Studio (multi-file editor) ──────────────────────────────────────

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size: number | null;
}

export interface ListWorkflowFilesResult {
  tree: TreeEntry[];
}

export interface GetWorkflowFileResult {
  content: string;
  sha: string;
}

export interface BatchCommitResult {
  commitSha: string;
  newGitTag: string;
}

export interface WorkflowFileChange {
  path: string;
  content?: string;
  delete?: boolean;
}

const BASE = (companyId: string) => `/companies/${companyId}/governed-workflows`;

export const governedWorkflowsApi = {
  /**
   * List all non-archived workflow definitions for the company.
   */
  list(companyId: string, filters?: { enabled?: boolean }) {
    const params: Record<string, string | undefined> = {};
    if (filters?.enabled !== undefined) params.enabled = String(filters.enabled);
    return api.get<ListWorkflowsResult>(`${BASE(companyId)}${buildQuery(params)}`);
  },

  /**
   * Fetch a single workflow definition with its parsed content from git.
   */
  get(companyId: string, name: string, opts?: { gitTag?: string }) {
    const params: Record<string, string | undefined> = {};
    if (opts?.gitTag) params.gitTag = opts.gitTag;
    return api.get<WorkflowDetail>(`${BASE(companyId)}/${encodeURIComponent(name)}${buildQuery(params)}`);
  },

  /**
   * List git tags for a workflow (prefixed by `<name>/v`).
   */
  tags(companyId: string, name: string) {
    return api.get<{ tags: GitTag[] }>(`${BASE(companyId)}/${encodeURIComponent(name)}/tags`);
  },

  /**
   * Create a new workflow definition.
   */
  create(
    companyId: string,
    input: { definition: WorkflowDefinition; commitMessage: string; branch?: string },
  ) {
    return api.post<SaveDefinitionResult>(`${BASE(companyId)}`, input);
  },

  /**
   * Update an existing workflow definition (or create if it doesn't exist).
   */
  update(
    companyId: string,
    name: string,
    input: { definition: WorkflowDefinition; commitMessage: string; branch?: string },
  ) {
    return api.put<SaveDefinitionResult>(`${BASE(companyId)}/${encodeURIComponent(name)}`, input);
  },

  /**
   * Enable or disable a workflow definition.
   */
  setEnabled(companyId: string, name: string, enabled: boolean) {
    return api.patch<{ ok: boolean }>(`${BASE(companyId)}/${encodeURIComponent(name)}/enabled`, { enabled });
  },

  /**
   * Archive (soft-delete) a workflow definition.
   */
  delete(companyId: string, name: string) {
    return api.delete<void>(`${BASE(companyId)}/${encodeURIComponent(name)}`);
  },

  /**
   * Paginated list of runs for a workflow.
   */
  listRuns(
    companyId: string,
    name: string,
    filters?: {
      status?: string;
      initiatedByActorId?: string;
      startedAfter?: string;
      startedBefore?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const params: Record<string, string | number | undefined> = {
      status: filters?.status,
      initiatedByActorId: filters?.initiatedByActorId,
      startedAfter: filters?.startedAfter,
      startedBefore: filters?.startedBefore,
      limit: filters?.limit,
      offset: filters?.offset,
    };
    return api.get<ListRunsResult>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/runs${buildQuery(params)}`,
    );
  },

  /**
   * Fetch a single run with step executions and gate results.
   */
  getRun(companyId: string, name: string, runId: string) {
    return api.get<RunWithSteps>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/runs/${encodeURIComponent(runId)}`,
    );
  },

  /**
   * Launch a new run for a workflow.
   */
  launchRun(
    companyId: string,
    name: string,
    input?: { params?: Record<string, unknown>; gitTagPreference?: "latest" | "HEAD" },
  ) {
    return api.post<LaunchRunResult>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/runs`,
      input ?? {},
    );
  },

  // ── Workflow Studio file operations (U13.4) ───────────────────────────────

  /**
   * List every file under the workflow's subtree at the given ref (defaults to
   * the DB's latestGitTag on the server side).
   */
  listFiles(companyId: string, name: string, opts?: { ref?: string }) {
    const params: Record<string, string | undefined> = {};
    if (opts?.ref) params.ref = opts.ref;
    return api.get<ListWorkflowFilesResult>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/files${buildQuery(params)}`,
    );
  },

  /**
   * Fetch one workflow-relative file. `path` is encoded PER SEGMENT so nested
   * paths like `gates/lint.ts` keep their slashes — `encodeURIComponent` would
   * otherwise turn the `/` into `%2F` and break the Express wildcard.
   */
  getFile(companyId: string, name: string, path: string, opts?: { ref?: string }) {
    const params: Record<string, string | undefined> = {};
    if (opts?.ref) params.ref = opts.ref;
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return api.get<GetWorkflowFileResult>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/files/${encodedPath}${buildQuery(params)}`,
    );
  },

  /**
   * Atomic batch commit — creates/updates/deletes multiple files in a single
   * commit and returns the new semver tag.
   */
  batchCommitFiles(
    companyId: string,
    name: string,
    input: {
      commitMessage: string;
      branch?: string;
      changes: WorkflowFileChange[];
    },
  ) {
    return api.put<BatchCommitResult>(
      `${BASE(companyId)}/${encodeURIComponent(name)}/files`,
      input,
    );
  },
};
