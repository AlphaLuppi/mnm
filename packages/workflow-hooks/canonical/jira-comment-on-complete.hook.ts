/**
 * Canonical hook: jira-comment-on-complete
 *
 * Posts a Jira comment after a step completes successfully. Reads the
 * artifact's text content (or a configurable summary path) and converts
 * to Atlassian Document Format (ADF) basic shape before sending.
 *
 * Phase: after_step
 *
 * Config:
 *   - issueKey (string, required EXOR with issueKeyFromArtifactPath):
 *     The Jira issue key to comment on (e.g. "PROJ-123").
 *   - issueKeyFromArtifactPath (string, optional): Path inside the
 *     artifact data object to read the issue key from (e.g.
 *     "metadata.jira_key"). Used when the issue key is dynamically
 *     determined by the workflow step.
 *   - providerSlug (string, default "jira"): connector slug.
 *   - commentTemplate (string, optional): Mustache-light template for
 *     the comment body. Tokens: {{step.id}}, {{run.id}}, {{run.git_tag}},
 *     {{artifact.<path>}}. Defaults to a one-liner referencing the run.
 *
 * Error codes returned via HookResult:
 *   - HOOK_INVALID_CONFIG — missing both issueKey + issueKeyFromArtifactPath
 *   - HOOK_INVALID_CONFIG — issue key path not found in artifact data
 */
import { defineHook } from "@mnm/workflow-hooks";

interface ArtifactLike {
  data?: Record<string, unknown>;
  outputs?: Array<{ kind?: string; content?: string }>;
}

interface JiraCommentConfig extends Record<string, unknown> {
  issueKey?: unknown;
  issueKeyFromArtifactPath?: unknown;
  providerSlug?: unknown;
  commentTemplate?: unknown;
}

function readPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object" || !path) return undefined;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, raw: string) => {
    const key = raw.trim();
    const value = readPath(vars, key);
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * Minimal ADF shape converter — wraps a plain text string in the basic
 * paragraph node ADF expects. Sufficient for one-line / multi-paragraph
 * comments. Authors who need rich formatting should provide ADF JSON
 * directly and skip this helper.
 */
function mdToAdf(text: string): unknown {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.length > 0);
  return {
    version: 1,
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

export default defineHook<ArtifactLike, JiraCommentConfig>({
  name: "jira-comment-on-complete",
  description:
    "Posts a comment on a Jira issue when a workflow step completes successfully. Reads the issue key from config (or from a path inside the artifact data) and renders a Mustache-light template into Atlassian Document Format.",
  phase: "after_step",
  requiredScopes: ["read:jira-work", "write:jira-work"],
  configSchema: {
    issueKey: {
      type: "string",
      description:
        "Jira issue key (e.g. \"PROJ-123\"). Required unless issueKeyFromArtifactPath is set.",
    },
    issueKeyFromArtifactPath: {
      type: "string",
      description:
        "Dot-path inside artifact.data to read the issue key from (e.g. \"metadata.jira_key\").",
    },
    providerSlug: {
      type: "string",
      description: "Connector slug. Defaults to \"jira\".",
    },
    commentTemplate: {
      type: "string",
      description:
        "Mustache-light template for the comment body. Tokens: {{step.id}}, {{run.id}}, {{run.git_tag}}, {{artifact.<path>}}.",
    },
  },
  defaultConfig: {
    issueKey: "PROJ-123",
    commentTemplate:
      "Step `{{step.id}}` completed in run `{{run.id}}` (workflow `{{run.workflow_name}}@{{run.git_tag}}`).",
  },
  execute: async (ctx) => {
  const issueKey =
    typeof ctx.config.issueKey === "string" && ctx.config.issueKey.length > 0
      ? ctx.config.issueKey
      : typeof ctx.config.issueKeyFromArtifactPath === "string"
        ? readPath(ctx.artifact?.data, ctx.config.issueKeyFromArtifactPath)
        : undefined;

  if (typeof issueKey !== "string" || issueKey.length === 0) {
    return {
      ok: false,
      error_code: "HOOK_INVALID_CONFIG",
      report:
        "jira-comment-on-complete: issueKey or issueKeyFromArtifactPath required",
      hints: [
        "Add `issueKey: \"PROJ-123\"` to the hook config in workflow.json",
        "Or set `issueKeyFromArtifactPath` to a key path in artifact.data",
      ],
    };
  }

  const provider =
    typeof ctx.config.providerSlug === "string" ? ctx.config.providerSlug : "jira";
  const template =
    typeof ctx.config.commentTemplate === "string"
      ? ctx.config.commentTemplate
      : "Step `{{step.id}}` completed in run `{{run.id}}` (workflow `{{run.workflow_name}}@{{run.git_tag}}`).";

  const body = renderTemplate(template, {
    step: ctx.step,
    run: ctx.run,
    artifact: ctx.artifact ?? {},
  });

  const response = await ctx.helpers.http({
    provider,
    method: "POST",
    path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    body: { body: mdToAdf(body) },
  });

  if (response.status >= 200 && response.status < 300) {
    return {
      ok: true,
      report: `Commented on ${issueKey} (status ${response.status})`,
      data: { issueKey, status: response.status },
    };
  }

  return {
    ok: false,
    error_code: "HOOK_PROVIDER_ERROR",
    report: `Jira API returned ${response.status} for ${issueKey}`,
    data: { issueKey, status: response.status, body: response.body },
  };
  },
});
