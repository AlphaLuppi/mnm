/**
 * MCP tools for unified workflow autonomous triggers (Phase 2 — REST/MCP parity).
 *
 * The Studio UI (REST) and Claude Code agents (MCP) reach the SAME service
 * instance — `services.workflowTriggers` is wired in `build-mcp-services.ts`.
 * Tool surface mirrors the REST CRUD endpoints; the public webhook fire
 * lives only on REST (agents never proxy webhooks — they should call
 * `launch_governed_workflow` directly when they want to start a run).
 *
 * Permission: every tool requires `WORKFLOWS_MANAGE_TRIGGERS`.
 * Identity: trigger creation captures `actor.userId` as
 * `created_by_user_id` (§1.7 human traceability invariant).
 */
import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { setTenantContext } from "../../middleware/tenant-context.js";
import type { Db } from "@mnm/db";

const TRIGGER_KIND_VALUES = ["schedule", "webhook", "issue"] as const;
const TRIGGER_ACTION_VALUES = ["launch_run", "launch_step", "complete_step"] as const;
const SIGNING_MODE_VALUES = ["bearer", "hmac_sha256"] as const;

const createInputSchema = z.object({
  workflow_def_ref: z.string().min(1)
    .describe("Target workflow ref. Canonical form: 'workflows/<name>@<git-tag>'."),
  kind: z.enum(TRIGGER_KIND_VALUES),
  action: z.enum(TRIGGER_ACTION_VALUES),
  step_key: z.string().min(1).optional()
    .describe("Required for launch_step / complete_step. The step id in workflow.json."),
  allowed_step_keys: z.array(z.string().min(1)).optional()
    .describe("Whitelist for complete_step. Must include step_key when action=complete_step."),
  label: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  cron_expression: z.string().optional()
    .describe("5-field POSIX cron, e.g. '*/5 * * * *'. Required for kind=schedule."),
  timezone: z.string().optional()
    .describe("IANA timezone for the cron, e.g. 'Europe/Paris'. Required for kind=schedule."),
  signing_mode: z.enum(SIGNING_MODE_VALUES).optional()
    .describe("Required for kind=webhook."),
  replay_window_sec: z.number().int().min(30).max(86_400).optional().default(300),
  issue_match: z.record(z.unknown()).optional(),
  payload_template: z.record(z.unknown()).optional().default({}),
});

const updateInputSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  label: z.string().nullable().optional(),
  cron_expression: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  replay_window_sec: z.number().int().min(30).max(86_400).nullable().optional(),
  signing_mode: z.enum(SIGNING_MODE_VALUES).optional(),
  step_key: z.string().nullable().optional(),
  allowed_step_keys: z.array(z.string().min(1)).optional(),
  issue_match: z.record(z.unknown()).nullable().optional(),
  payload_template: z.record(z.unknown()).optional(),
});

function toCamel<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

/**
 * Strip the encrypted secret_hash before serialising a trigger to MCP. The
 * plaintext `secret` returned by create + rotate is preserved (and surfaced
 * one-shot to the caller).
 */
function projectTrigger(row: Record<string, unknown>) {
  const { secretHash: _omit, ...rest } = row as Record<string, unknown> & { secretHash?: string };
  return rest;
}

async function ensureTenantContext(db: Db, companyId: string): Promise<void> {
  await setTenantContext(db, companyId);
}

export default defineMcpTools(({ tool, services }) => {
  tool("list_workflow_triggers", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description:
      "[Workflow Triggers] List autonomous triggers for a workflow. " +
      "Filter by `workflow_def_ref` and/or `kind`. Returns rows without the encrypted secret_hash.",
    input: z.object({
      workflow_def_ref: z.string().optional(),
      kind: z.enum(TRIGGER_KIND_VALUES).optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      await ensureTenantContext(services.db, actor.companyId);
      const rows = await services.workflowTriggers.list(actor.companyId, {
        workflowDefRef: input.workflow_def_ref,
        kind: input.kind,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ items: rows.map((r: Record<string, unknown>) => projectTrigger(r)) }),
        }],
      };
    },
  });

  tool("get_workflow_trigger", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description: "[Workflow Triggers] Fetch a single trigger by id.",
    input: z.object({ id: z.string().uuid() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      await ensureTenantContext(services.db, actor.companyId);
      const row = await services.workflowTriggers.getById(input.id, actor.companyId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projectTrigger(row as unknown as Record<string, unknown>)) }],
      };
    },
  });

  tool("create_workflow_trigger", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description:
      "[Workflow Triggers] Create a trigger on a Governed Workflow. " +
      "kind=webhook returns a one-shot plaintext `secret` in the response — " +
      "the caller MUST copy it now, it is encrypted at rest and never re-shown. " +
      "Use rotate_workflow_trigger_secret to get a new one.",
    input: createInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (actor.type !== "user" && actor.type !== "agent") {
        throw new Error("create_workflow_trigger requires an authenticated actor");
      }
      const createdByUserId = actor.userId ?? actor.agentId!;

      await ensureTenantContext(services.db, actor.companyId);
      const result = await services.workflowTriggers.create(
        actor.companyId,
        toCamel(input as unknown as Record<string, unknown>) as Parameters<
          typeof services.workflowTriggers.create
        >[1],
        createdByUserId,
      );

      const { secret, ...row } = result as typeof result & { secret?: string };
      const projected = projectTrigger(row as unknown as Record<string, unknown>);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(secret ? { ...projected, secret } : projected),
        }],
      };
    },
  });

  tool("update_workflow_trigger", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description: "[Workflow Triggers] Update mutable fields. Cannot change kind or action.",
    input: updateInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { id, ...patch } = input;
      await ensureTenantContext(services.db, actor.companyId);
      const updated = await services.workflowTriggers.update(
        id,
        actor.companyId,
        toCamel(patch as unknown as Record<string, unknown>) as Parameters<
          typeof services.workflowTriggers.update
        >[2],
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(projectTrigger(updated as unknown as Record<string, unknown>)),
        }],
      };
    },
  });

  tool("delete_workflow_trigger", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description: "[Workflow Triggers] Delete a trigger. Audit history is preserved (FK SET NULL).",
    input: z.object({ id: z.string().uuid() }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      await ensureTenantContext(services.db, actor.companyId);
      await services.workflowTriggers.delete(input.id, actor.companyId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
    },
  });

  tool("rotate_workflow_trigger_secret", {
    permissions: [PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS],
    description:
      "[Workflow Triggers] Rotate a webhook trigger's secret. Returns the new plaintext " +
      "`secret` ONCE. The previous secret is invalidated immediately — update upstream " +
      "callers (GitLab CI variables, GitHub Actions secrets, N8N credential store) " +
      "before rotating.",
    input: z.object({ id: z.string().uuid() }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      await ensureTenantContext(services.db, actor.companyId);
      const result = await services.workflowTriggers.rotateSecret(input.id, actor.companyId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...projectTrigger(result.trigger as unknown as Record<string, unknown>),
            secret: result.secret,
          }),
        }],
      };
    },
  });
});
