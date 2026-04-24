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

// ── AI assistant SSE stream (U14.3) ─────────────────────────────────────────

/**
 * Typed event forwarded by the server's `/ai/chat` SSE endpoint. Mirrors the
 * `AiAssistantEvent` union from `server/src/services/workflow-ai-assistant.ts`.
 */
export interface AiChatEvent {
  type: "token" | "file-proposal" | "done" | "error";
  value?: string;
  path?: string;
  content?: string;
  delete?: boolean;
  error_code?: string;
  message?: string;
  hints?: string[];
}

export interface StreamAiChatHandlers {
  onToken?: (delta: string) => void;
  onFileProposal?: (proposal: {
    path: string;
    content?: string;
    delete?: boolean;
  }) => void;
  onError?: (err: { error_code: string; message: string; hints: string[] }) => void;
  onDone?: () => void;
  signal?: AbortSignal;
}

export interface StreamAiChatBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  ref?: string;
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

  /**
   * Stream an AI chat completion from the governed workflow assistant. The
   * server returns `text/event-stream` frames shaped as `data: <json>\n\n`
   * where each payload is an `AiChatEvent`. EventSource can't POST, so we
   * use `fetch` + `ReadableStream.getReader()` and parse frames manually.
   *
   * Cross-origin dev: when the UI runs on :5173 (Vite dev) we POST directly
   * to :3100 with `credentials: "include"` so the session cookie rides along
   * — same pattern as `authApi.linkSocial` to avoid the proxy rewriting
   * SSE keep-alives. In prod the UI + API share an origin so a relative
   * URL works.
   *
   * The returned promise resolves when the stream naturally closes OR a
   * `done` event arrives OR the caller aborts via `handlers.signal`. An
   * `AbortError` is swallowed (treated as a clean close). Any other fetch
   * error is rethrown so callers can surface it.
   */
  async streamAiChat(
    companyId: string,
    name: string,
    body: StreamAiChatBody,
    handlers: StreamAiChatHandlers,
  ): Promise<void> {
    const isViteDev =
      typeof window !== "undefined" && window.location.port === "5173";
    const path = `/api${BASE(companyId)}/${encodeURIComponent(name)}/ai/chat`;
    const url = isViteDev ? `http://localhost:3100${path}` : path;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: handlers.signal,
      });
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") {
        handlers.onDone?.();
        return;
      }
      throw err;
    }

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message =
        (payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "") || res.statusText;
      const err = new Error(message);
      if (res.status === 429) {
        (err as Error & { code?: string }).code = "RATE_LIMITED";
      }
      throw err;
    }

    if (!res.body) {
      handlers.onDone?.();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneSeen = false;

    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          if ((err as { name?: string } | null)?.name === "AbortError") {
            handlers.onDone?.();
            return;
          }
          throw err;
        }
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });

        // SSE frames are separated by a blank line (\n\n). Each frame may
        // contain multiple lines but we only look at the `data:` line.
        let sepIdx = buffer.indexOf("\n\n");
        while (sepIdx !== -1) {
          const frame = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          sepIdx = buffer.indexOf("\n\n");

          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const raw = dataLine.slice(5).trim();
          if (!raw) continue;

          let event: AiChatEvent;
          try {
            event = JSON.parse(raw) as AiChatEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "token":
              if (typeof event.value === "string") {
                handlers.onToken?.(event.value);
              }
              break;
            case "file-proposal":
              if (typeof event.path === "string") {
                handlers.onFileProposal?.({
                  path: event.path,
                  content: event.content,
                  delete: event.delete,
                });
              }
              break;
            case "error":
              handlers.onError?.({
                error_code: event.error_code ?? "LLM_ERROR",
                message: event.message ?? "Erreur du flux IA",
                hints: event.hints ?? [],
              });
              break;
            case "done":
              doneSeen = true;
              handlers.onDone?.();
              break;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }

    if (!doneSeen) {
      handlers.onDone?.();
    }
  },
};
