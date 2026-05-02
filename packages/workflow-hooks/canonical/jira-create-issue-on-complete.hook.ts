/**
 * Canonical hook: jira-create-issue-on-complete
 *
 * Creates a new Jira issue after a step completes successfully.
 * Templates the summary + description from artifact data using a
 * Mustache-light syntax.
 *
 * Phase: after_step
 *
 * Config:
 *   - projectKey (string, required): Jira project key (e.g. "PROJ").
 *   - issueTypeName (string, default "Task"): Jira issue type.
 *   - summaryTemplate (string, default sensible): summary template.
 *   - descriptionTemplate (string, optional): description template.
 *   - providerSlug (string, default "jira"): connector slug.
 *
 * Error codes returned via HookResult:
 *   - HOOK_INVALID_CONFIG — projectKey missing
 */
import { defineHook } from "@mnm/workflow-hooks";

interface ArtifactLike {
  data?: Record<string, unknown>;
  outputs?: Array<{ kind?: string; content?: string }>;
}

interface JiraCreateConfig extends Record<string, unknown> {
  projectKey?: unknown;
  issueTypeName?: unknown;
  summaryTemplate?: unknown;
  descriptionTemplate?: unknown;
  providerSlug?: unknown;
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

export default defineHook<ArtifactLike, JiraCreateConfig>(async (ctx) => {
  const projectKey =
    typeof ctx.config.projectKey === "string" ? ctx.config.projectKey : undefined;
  if (!projectKey) {
    return {
      ok: false,
      error_code: "HOOK_INVALID_CONFIG",
      report: "jira-create-issue-on-complete: projectKey required",
      hints: ['Add `projectKey: "PROJ"` to the hook config'],
    };
  }

  const issueTypeName =
    typeof ctx.config.issueTypeName === "string"
      ? ctx.config.issueTypeName
      : "Task";
  const summaryTemplate =
    typeof ctx.config.summaryTemplate === "string"
      ? ctx.config.summaryTemplate
      : "[{{run.workflow_name}}] Step `{{step.id}}` completed in run {{run.id}}";
  const descriptionTemplate =
    typeof ctx.config.descriptionTemplate === "string"
      ? ctx.config.descriptionTemplate
      : "Workflow `{{run.workflow_name}}@{{run.git_tag}}` finished step `{{step.id}}`.";
  const provider =
    typeof ctx.config.providerSlug === "string"
      ? ctx.config.providerSlug
      : "jira";

  const tplVars = {
    step: ctx.step,
    run: ctx.run,
    artifact: ctx.artifact ?? {},
  };
  const summary = renderTemplate(summaryTemplate, tplVars);
  const description = renderTemplate(descriptionTemplate, tplVars);

  const response = await ctx.helpers.http({
    provider,
    method: "POST",
    path: "/rest/api/3/issue",
    body: {
      fields: {
        project: { key: projectKey },
        summary,
        description: mdToAdf(description),
        issuetype: { name: issueTypeName },
      },
    },
  });

  if (response.status >= 200 && response.status < 300) {
    const body = response.body as { key?: string; id?: string } | null;
    return {
      ok: true,
      report: `Created Jira issue ${body?.key ?? "(unknown)"} in ${projectKey}`,
      data: { issueKey: body?.key, issueId: body?.id, status: response.status },
    };
  }

  return {
    ok: false,
    error_code: "HOOK_PROVIDER_ERROR",
    report: `Jira API returned ${response.status} on issue create`,
    data: { projectKey, status: response.status, body: response.body },
  };
});
