/**
 * Canonical hook: clickup-create-task-on-complete
 *
 * Creates a new ClickUp task after a step completes successfully.
 * Templates name + description from artifact data using a Mustache-light
 * syntax.
 *
 * Phase: after_step
 *
 * Config:
 *   - listId (string, required): ClickUp list id (target for the task).
 *   - nameTemplate (string, default sensible): task name template.
 *   - descriptionTemplate (string, optional).
 *   - status (string, optional): default ClickUp list status (e.g. "to do").
 *   - assignees (number[], optional): ClickUp user ids.
 *   - providerSlug (string, default "clickup").
 *
 * Error codes:
 *   - HOOK_INVALID_CONFIG — listId missing
 */
import { defineHook } from "@mnm/workflow-hooks";

interface ArtifactLike {
  data?: Record<string, unknown>;
  outputs?: Array<{ kind?: string; content?: string }>;
}

interface ClickUpCreateConfig extends Record<string, unknown> {
  listId?: unknown;
  nameTemplate?: unknown;
  descriptionTemplate?: unknown;
  status?: unknown;
  assignees?: unknown;
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

export default defineHook<ArtifactLike, ClickUpCreateConfig>(async (ctx) => {
  const listId =
    typeof ctx.config.listId === "string" ? ctx.config.listId : undefined;
  if (!listId) {
    return {
      ok: false,
      error_code: "HOOK_INVALID_CONFIG",
      report: "clickup-create-task-on-complete: listId required",
      hints: ['Add `listId: "<your-list-id>"` to the hook config'],
    };
  }

  const nameTemplate =
    typeof ctx.config.nameTemplate === "string"
      ? ctx.config.nameTemplate
      : "[{{run.workflow_name}}] Step `{{step.id}}` completed";
  const descriptionTemplate =
    typeof ctx.config.descriptionTemplate === "string"
      ? ctx.config.descriptionTemplate
      : "Completed step `{{step.id}}` in run `{{run.id}}` of workflow `{{run.workflow_name}}@{{run.git_tag}}`.";
  const status =
    typeof ctx.config.status === "string" ? ctx.config.status : undefined;
  const assignees = Array.isArray(ctx.config.assignees)
    ? (ctx.config.assignees as unknown[]).filter(
        (v): v is number => typeof v === "number",
      )
    : undefined;
  const provider =
    typeof ctx.config.providerSlug === "string"
      ? ctx.config.providerSlug
      : "clickup";

  const tplVars = {
    step: ctx.step,
    run: ctx.run,
    artifact: ctx.artifact ?? {},
  };
  const name = renderTemplate(nameTemplate, tplVars);
  const description = renderTemplate(descriptionTemplate, tplVars);

  const body: Record<string, unknown> = { name, description };
  if (status) body.status = status;
  if (assignees && assignees.length > 0) body.assignees = assignees;

  const response = await ctx.helpers.http({
    provider,
    method: "POST",
    path: `/api/v2/list/${encodeURIComponent(listId)}/task`,
    body,
  });

  if (response.status >= 200 && response.status < 300) {
    const respBody = response.body as { id?: string; url?: string } | null;
    return {
      ok: true,
      report: `Created ClickUp task ${respBody?.id ?? "(unknown)"} in list ${listId}`,
      data: {
        taskId: respBody?.id,
        url: respBody?.url,
        status: response.status,
      },
    };
  }

  return {
    ok: false,
    error_code: "HOOK_PROVIDER_ERROR",
    report: `ClickUp API returned ${response.status} on task create`,
    data: { listId, status: response.status, body: response.body },
  };
});
