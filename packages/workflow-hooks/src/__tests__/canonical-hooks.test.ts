import { describe, it, expect } from "vitest";
import { runHook } from "../runner.js";
import { loadCanonical } from "../canonical-registry.js";
import type {
  HookContext,
  HostHelpers,
  ResolvedHook,
  HttpRequest,
  HttpResponse,
} from "../types.js";

/**
 * End-to-end coverage of the 4 canonical hooks shipped with
 * `@mnm/workflow-hooks`. Each test loads the actual `.hook.ts` source
 * via `loadCanonical`, runs it inside an isolate via `runHook`, and
 * asserts on:
 *   - Helper call sequence (provider + path + method + body shape)
 *   - HookResult shape
 *   - Error mapping when config is missing
 */

function resolved(name: string): ResolvedHook {
  const entry = loadCanonical(name);
  if (!entry) throw new Error(`unknown canonical hook: ${name}`);
  return {
    source: "canonical",
    name,
    code: entry.code,
    sha: entry.sha,
    sourcePath: `canonical/${name}.hook.ts`,
  };
}

function ctxFor(
  phase: HookContext["phase"],
  config: Record<string, unknown> = {},
  artifact: unknown = undefined,
  paramOverrides: Record<string, unknown> = {},
): HookContext {
  return {
    artifact,
    run: {
      id: "run-1",
      workflow_name: "demo-workflow",
      git_tag: "v1.0",
      params: paramOverrides,
    },
    step: { id: "step-1", previous_artifacts: {} },
    config,
    phase,
    helpers: {} as HostHelpers,
  };
}

function recordingHelpers(
  responses: Array<HttpResponse | ((req: HttpRequest) => HttpResponse)>,
): { helpers: HostHelpers; calls: HttpRequest[] } {
  const calls: HttpRequest[] = [];
  let i = 0;
  return {
    calls,
    helpers: {
      http: async (req) => {
        calls.push(req);
        const slot = responses[i] ?? responses[responses.length - 1];
        i++;
        const result = typeof slot === "function" ? slot(req) : slot!;
        return result;
      },
      llm: async () => ({
        text: "",
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      fetchHandoff: async () => "",
    },
  };
}

const OK_201: HttpResponse = { status: 201, body: { key: "PROJ-42", id: "10042" }, headers: {} };
const OK_204: HttpResponse = { status: 204, body: null, headers: {} };

// ─── jira-comment-on-complete ──────────────────────────────────────────────

describe("canonical hook: jira-comment-on-complete", () => {
  it("posts a comment to the configured issueKey via /rest/api/3/issue/<key>/comment", async () => {
    const { helpers, calls } = recordingHelpers([OK_204]);
    const result = await runHook(
      resolved("jira-comment-on-complete"),
      ctxFor("after_step", { issueKey: "PROJ-42" }),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toContain("PROJ-42");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.provider).toBe("jira");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.path).toBe("/rest/api/3/issue/PROJ-42/comment");
    const body = calls[0]!.body as { body: { type: string; content: unknown[] } };
    expect(body.body.type).toBe("doc");
    expect(Array.isArray(body.body.content)).toBe(true);
  });

  it("reads issueKey from artifact path when issueKeyFromArtifactPath is set", async () => {
    const { helpers, calls } = recordingHelpers([OK_204]);
    const result = await runHook(
      resolved("jira-comment-on-complete"),
      ctxFor(
        "after_step",
        { issueKeyFromArtifactPath: "metadata.jira_key" },
        { data: { metadata: { jira_key: "PROJ-99" } } },
      ),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(calls[0]!.path).toBe("/rest/api/3/issue/PROJ-99/comment");
  });

  it("returns HOOK_INVALID_CONFIG when no issueKey is provided", async () => {
    const { helpers } = recordingHelpers([OK_204]);
    const result = await runHook(
      resolved("jira-comment-on-complete"),
      ctxFor("after_step"),
      helpers,
    );
    expect(result.ok).toBe(false);
    expect(result.result?.error_code).toBe("HOOK_INVALID_CONFIG");
  });

  it("returns HOOK_PROVIDER_ERROR on non-2xx response", async () => {
    const { helpers } = recordingHelpers([
      { status: 404, body: { errorMessage: "Issue not found" }, headers: {} },
    ]);
    const result = await runHook(
      resolved("jira-comment-on-complete"),
      ctxFor("after_step", { issueKey: "PROJ-NOPE" }),
      helpers,
    );
    expect(result.ok).toBe(false);
    expect(result.result?.error_code).toBe("HOOK_PROVIDER_ERROR");
  });
});

// ─── jira-create-issue-on-complete ─────────────────────────────────────────

describe("canonical hook: jira-create-issue-on-complete", () => {
  it("creates an issue in the configured projectKey", async () => {
    const { helpers, calls } = recordingHelpers([OK_201]);
    const result = await runHook(
      resolved("jira-create-issue-on-complete"),
      ctxFor("after_step", { projectKey: "PROJ" }),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.data?.issueKey).toBe("PROJ-42");
    expect(calls[0]!.path).toBe("/rest/api/3/issue");
    expect(calls[0]!.method).toBe("POST");
    const body = calls[0]!.body as {
      fields: { project: { key: string }; issuetype: { name: string } };
    };
    expect(body.fields.project.key).toBe("PROJ");
    expect(body.fields.issuetype.name).toBe("Task");
  });

  it("uses custom issueTypeName when provided", async () => {
    const { helpers, calls } = recordingHelpers([OK_201]);
    await runHook(
      resolved("jira-create-issue-on-complete"),
      ctxFor("after_step", {
        projectKey: "PROJ",
        issueTypeName: "Bug",
      }),
      helpers,
    );
    const body = calls[0]!.body as {
      fields: { issuetype: { name: string } };
    };
    expect(body.fields.issuetype.name).toBe("Bug");
  });

  it("returns HOOK_INVALID_CONFIG when projectKey missing", async () => {
    const { helpers } = recordingHelpers([OK_201]);
    const result = await runHook(
      resolved("jira-create-issue-on-complete"),
      ctxFor("after_step"),
      helpers,
    );
    expect(result.ok).toBe(false);
    expect(result.result?.error_code).toBe("HOOK_INVALID_CONFIG");
  });
});

// ─── clickup-import-task ───────────────────────────────────────────────────

describe("canonical hook: clickup-import-task", () => {
  it("imports tasks via two GETs per task (task + comments) and injects context_md", async () => {
    const { helpers, calls } = recordingHelpers([
      // task fetch
      {
        status: 200,
        body: {
          id: "abc123",
          name: "Hello task",
          description: "Some description",
          status: { status: "to do" },
          url: "https://app.clickup.com/t/abc123",
        },
        headers: {},
      },
      // comments fetch
      {
        status: 200,
        body: {
          comments: [
            {
              id: "c1",
              comment_text: "First comment",
              user: { username: "alice" },
              date: "1700000000000",
            },
          ],
        },
        headers: {},
      },
    ]);
    const result = await runHook(
      resolved("clickup-import-task"),
      ctxFor("before_step", { taskIds: ["abc123"] }),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.inject?.context_md).toContain("Hello task");
    expect(result.result?.inject?.context_md).toContain("First comment");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.path).toBe("/api/v2/task/abc123");
    expect(calls[1]!.path).toBe("/api/v2/task/abc123/comment");
  });

  it("reads taskIds from a run param when taskIdsFromParam is set", async () => {
    const { helpers, calls } = recordingHelpers([
      { status: 200, body: { id: "fromparam", name: "x" }, headers: {} },
      { status: 200, body: { comments: [] }, headers: {} },
    ]);
    const result = await runHook(
      resolved("clickup-import-task"),
      ctxFor(
        "before_step",
        { taskIdsFromParam: "linked_clickup_tasks" },
        undefined,
        { linked_clickup_tasks: ["fromparam"] },
      ),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(calls[0]!.path).toBe("/api/v2/task/fromparam");
  });

  it("returns HOOK_INVALID_CONFIG when neither taskIds nor taskIdsFromParam", async () => {
    const { helpers } = recordingHelpers([]);
    const result = await runHook(
      resolved("clickup-import-task"),
      ctxFor("before_step"),
      helpers,
    );
    expect(result.ok).toBe(false);
    expect(result.result?.error_code).toBe("HOOK_INVALID_CONFIG");
  });

  it("skips comments when includeComments is false", async () => {
    const { helpers, calls } = recordingHelpers([
      { status: 200, body: { id: "x", name: "n" }, headers: {} },
    ]);
    await runHook(
      resolved("clickup-import-task"),
      ctxFor("before_step", { taskIds: ["x"], includeComments: false }),
      helpers,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path).toBe("/api/v2/task/x");
  });
});

// ─── clickup-create-task-on-complete ───────────────────────────────────────

describe("canonical hook: clickup-create-task-on-complete", () => {
  it("creates a task in the configured listId", async () => {
    const { helpers, calls } = recordingHelpers([
      {
        status: 200,
        body: { id: "task-new-1", url: "https://app.clickup.com/t/task-new-1" },
        headers: {},
      },
    ]);
    const result = await runHook(
      resolved("clickup-create-task-on-complete"),
      ctxFor("after_step", { listId: "list-42" }),
      helpers,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.data?.taskId).toBe("task-new-1");
    expect(calls[0]!.path).toBe("/api/v2/list/list-42/task");
    expect(calls[0]!.method).toBe("POST");
    const body = calls[0]!.body as { name: string; description: string };
    expect(body.name).toContain("step-1");
    expect(body.description).toContain("demo-workflow");
  });

  it("forwards status + assignees when configured", async () => {
    const { helpers, calls } = recordingHelpers([
      { status: 200, body: { id: "x", url: "https://app.clickup.com/t/x" }, headers: {} },
    ]);
    await runHook(
      resolved("clickup-create-task-on-complete"),
      ctxFor("after_step", {
        listId: "list-42",
        status: "in progress",
        assignees: [101, 202],
      }),
      helpers,
    );
    const body = calls[0]!.body as {
      status?: string;
      assignees?: number[];
    };
    expect(body.status).toBe("in progress");
    expect(body.assignees).toEqual([101, 202]);
  });

  it("returns HOOK_INVALID_CONFIG when listId missing", async () => {
    const { helpers } = recordingHelpers([]);
    const result = await runHook(
      resolved("clickup-create-task-on-complete"),
      ctxFor("after_step"),
      helpers,
    );
    expect(result.ok).toBe(false);
    expect(result.result?.error_code).toBe("HOOK_INVALID_CONFIG");
  });
});
