/**
 * Canonical hook: clickup-import-task
 *
 * Imports ClickUp task content into the step's prompt context, so the
 * agent can read task details (title, description, comments) before
 * executing.
 *
 * Phase: before_step
 *
 * Config:
 *   - taskIds (string[], required EXOR with taskIdsFromParam): explicit
 *     list of ClickUp task ids.
 *   - taskIdsFromParam (string, optional): name of the run-level param
 *     to read the task ids from (e.g. "linked_clickup_tasks").
 *   - includeComments (boolean, default true).
 *   - providerSlug (string, default "clickup").
 *
 * Returns inject.context_md with formatted task content.
 *
 * Error codes:
 *   - HOOK_INVALID_CONFIG — neither taskIds nor taskIdsFromParam
 *   - HOOK_INVALID_CONFIG — param value not an array of strings
 */
import { defineHook } from "@mnm/workflow-hooks";

interface ClickUpImportConfig extends Record<string, unknown> {
  taskIds?: unknown;
  taskIdsFromParam?: unknown;
  includeComments?: unknown;
  providerSlug?: unknown;
}

interface ClickUpTask {
  id: string;
  name?: string;
  description?: string;
  status?: { status?: string };
  url?: string;
}

interface ClickUpComment {
  id: string;
  comment_text?: string;
  user?: { username?: string };
  date?: string;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.some((v) => typeof v !== "string" || v.length === 0)) return null;
  return value as string[];
}

export default defineHook<unknown, ClickUpImportConfig>({
  name: "clickup-import-task",
  description:
    "Imports one or more ClickUp tasks (with optional comments) into the upcoming step's prompt context as Markdown. Use it before_step so the agent can read the task brief, status, description, and recent comments before running.",
  phase: "before_step",
  requiredScopes: ["read:tasks"],
  configSchema: {
    taskIds: {
      type: "string[]",
      description:
        "Explicit list of ClickUp task ids. Required unless taskIdsFromParam is set.",
    },
    taskIdsFromParam: {
      type: "string",
      description:
        "Run-level param name from which to read the task ids (e.g. \"linked_clickup_tasks\").",
    },
    includeComments: {
      type: "boolean",
      description: "Whether to fetch and include task comments. Defaults to true.",
    },
    providerSlug: {
      type: "string",
      description: "Connector slug. Defaults to \"clickup\".",
    },
  },
  defaultConfig: {
    taskIdsFromParam: "linked_clickup_tasks",
    includeComments: true,
  },
  execute: async (ctx) => {
  const directIds = asStringArray(ctx.config.taskIds);
  const paramName =
    typeof ctx.config.taskIdsFromParam === "string"
      ? ctx.config.taskIdsFromParam
      : null;
  const paramIds =
    paramName !== null ? asStringArray(ctx.run.params[paramName]) : null;

  const taskIds = directIds ?? paramIds;
  if (!taskIds || taskIds.length === 0) {
    return {
      ok: false,
      error_code: "HOOK_INVALID_CONFIG",
      report:
        "clickup-import-task: provide taskIds (string[]) or taskIdsFromParam (param key)",
      hints: [
        'Set `taskIds: ["abc123", "def456"]` directly in the hook config',
        'Or set `taskIdsFromParam: "my_param"` and pass `my_param` when launching the run',
      ],
    };
  }

  const provider =
    typeof ctx.config.providerSlug === "string"
      ? ctx.config.providerSlug
      : "clickup";
  const includeComments =
    typeof ctx.config.includeComments === "boolean"
      ? ctx.config.includeComments
      : true;

  const sections: string[] = [];
  for (const taskId of taskIds) {
    const taskRes = await ctx.helpers.http({
      provider,
      method: "GET",
      path: `/api/v2/task/${encodeURIComponent(taskId)}`,
    });
    if (taskRes.status < 200 || taskRes.status >= 300) {
      sections.push(
        `## Task ${taskId}\n\n_Failed to fetch (status ${taskRes.status})._`,
      );
      continue;
    }
    const task = taskRes.body as ClickUpTask;
    let section = `## Task ${task.id}: ${task.name ?? "(untitled)"}\n\n`;
    if (task.status?.status) {
      section += `**Status:** ${task.status.status}\n\n`;
    }
    if (task.description) {
      section += `${task.description}\n\n`;
    }
    if (task.url) {
      section += `[Open in ClickUp](${task.url})\n\n`;
    }

    if (includeComments) {
      const commentsRes = await ctx.helpers.http({
        provider,
        method: "GET",
        path: `/api/v2/task/${encodeURIComponent(taskId)}/comment`,
      });
      if (commentsRes.status >= 200 && commentsRes.status < 300) {
        const body = commentsRes.body as { comments?: ClickUpComment[] } | null;
        const comments = body?.comments ?? [];
        if (comments.length > 0) {
          section += `### Comments\n\n`;
          for (const c of comments) {
            const author = c.user?.username ?? "(unknown)";
            const date = c.date ? new Date(Number(c.date)).toISOString() : "";
            section += `- **${author}** ${date}: ${c.comment_text ?? ""}\n`;
          }
          section += "\n";
        }
      }
    }

    sections.push(section);
  }

  const contextMd = sections.join("\n---\n\n");

  return {
    ok: true,
    report: `Imported ${taskIds.length} ClickUp task(s) into prompt context`,
    inject: { context_md: contextMd },
    data: { taskIds, sectionsCount: sections.length },
  };
  },
});
