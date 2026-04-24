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

export interface WorkflowDetail {
  definition: GovernedWorkflowDefinitionRow;
  parsed: {
    workflow: WorkflowDefinition;
    gitTag: string;
    gitSha: string;
    workflowRepoPath: string;
  } | null;
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
};
