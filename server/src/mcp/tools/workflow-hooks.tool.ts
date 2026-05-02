import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

/**
 * WORKFLOW-HOOKS T2.8 — MCP tools (6 tools, parity with REST routes).
 *
 * Tools wired into the registry (`./index.ts`):
 *   - list_hook_configs           — list configs visible to the actor
 *   - get_hook_config             — read one config (with visibility check)
 *   - update_hook_config          — create/replace a config (idempotent on name)
 *   - delete_hook_config          — remove a config + audit row
 *   - list_hook_catalog           — canonical + shared + local hooks visible
 *                                    to the actor
 *   - list_hook_executions        — runtime audit log (filterable)
 *
 * All six tools require `hooks:manage` (same as the REST admin routes).
 * Toggling `enforced=true` additionally requires `hooks:enforce` (the
 * service double-checks via `ctx.hasEnforcePermission`).
 *
 * Tenant context is set by the MCP wrap() before the handler runs (cf.
 * `governed-workflows.md` rule). The service layer ALSO calls
 * setTenantContext explicitly inside executeHook for the audit row
 * insert/update — that's a separate concern from this tool layer.
 */

const visibilitySchema = z.enum(["private", "tags", "principals", "company"]);

const upsertConfigInputSchema = z.object({
  name: z.string().min(1).max(120),
  hookRef: z
    .string()
    .regex(
      /^(canonical|shared|local):[a-z0-9-]+$/,
      "hookRef must match canonical|shared|local:[a-z0-9-]+",
    ),
  defaultConfigJson: z.record(z.unknown()).optional(),
  visibility: visibilitySchema,
  enabled: z.boolean().optional(),
  enforced: z.boolean().optional(),
  enforcedPhases: z
    .array(
      z.enum(["before_run", "before_step", "after_step", "after_run"]),
    )
    .optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  principalIds: z.array(z.string().min(1)).optional(),
});

export default defineMcpTools(({ tool, services }) => {
  // ─── 1. list_hook_configs ─────────────────────────────────────────────────
  tool("list_hook_configs", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] List all hook configs visible to the current actor.\n" +
      "Visibility tiers honored : private (creator only), tags (intersection),\n" +
      "principals (explicit list), company (everyone). Returns the joined\n" +
      "DTO with tagIds + principalIds.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const principalId = actor.userId ?? actor.agentId ?? "";
      const rows = await services.workflowHooks.listConfigs(
        actor.companyId,
        principalId,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ configs: rows }) },
        ],
      };
    },
  });

  // ─── 2. get_hook_config ───────────────────────────────────────────────────
  tool("get_hook_config", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] Get a single hook config by id. Returns null when the\n" +
      "config exists but is not visible to the actor (preserves existence\n" +
      "non-disclosure across visibility tiers).",
    input: z.object({
      configId: z.string().uuid().describe("Hook config id"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const principalId = actor.userId ?? actor.agentId ?? "";
      const dto = await services.workflowHooks.getConfig(
        actor.companyId,
        input.configId,
        principalId,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ config: dto }) },
        ],
      };
    },
  });

  // ─── 3. update_hook_config ────────────────────────────────────────────────
  tool("update_hook_config", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] Create OR update a hook config. When `configId` is\n" +
      "provided, the config is updated in place; otherwise a new config is\n" +
      "created. Toggling enforced=true requires the hooks:enforce permission\n" +
      "(checked server-side, not just at the tool layer). Visibility=company\n" +
      "is required when enforced=true (admin-imposed runs apply to everyone).",
    input: z.object({
      configId: z
        .string()
        .uuid()
        .optional()
        .describe("Optional. When set, the existing config is updated."),
      payload: upsertConfigInputSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const principalId = actor.userId ?? actor.agentId ?? "";
      const hasEnforcePermission = actor.effectivePermissions.has(
        PERMISSIONS.HOOKS_ENFORCE,
      );
      let dto;
      if (input.configId) {
        dto = await services.workflowHooks.updateConfig(
          actor.companyId,
          input.configId,
          input.payload,
          { actorPrincipalId: principalId, hasEnforcePermission },
        );
      } else {
        dto = await services.workflowHooks.createConfig(
          actor.companyId,
          input.payload,
          { actorPrincipalId: principalId, hasEnforcePermission },
        );
      }
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ config: dto }) },
        ],
      };
    },
  });

  // ─── 4. delete_hook_config ────────────────────────────────────────────────
  tool("delete_hook_config", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] Delete a hook config by id. Audit row written with\n" +
      "action='deleted'. Cascade-deletes the config_tags + config_principals\n" +
      "join rows ; preserves audit + execution rows (FKs are SET NULL).",
    input: z.object({
      configId: z.string().uuid(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const principalId = actor.userId ?? actor.agentId ?? "";
      const hasEnforcePermission = actor.effectivePermissions.has(
        PERMISSIONS.HOOKS_ENFORCE,
      );
      const removed = await services.workflowHooks.deleteConfig(
        actor.companyId,
        input.configId,
        { actorPrincipalId: principalId, hasEnforcePermission },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ removed }) },
        ],
      };
    },
  });

  // ─── 5. list_hook_catalog ─────────────────────────────────────────────────
  tool("list_hook_catalog", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] List all hooks available for use in workflow.json,\n" +
      "split by source : canonical (shipped with @mnm/workflow-hooks),\n" +
      "shared (loaded from the workflow repo's _shared branch), local\n" +
      "(loaded from a specific workflow at its pinned git_sha).\n" +
      "Pass `workflowGitSha` to include local hooks ; otherwise only\n" +
      "canonical + shared are returned.",
    input: z.object({
      workflowGitSha: z
        .string()
        .optional()
        .describe("Run's pinned sha — required to include local: hooks"),
      sharedRepoBranch: z.string().optional().describe("Default 'main'"),
      includeShared: z.boolean().optional().default(true),
      includeLocal: z.boolean().optional().default(false),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const userId = actor.userId ?? actor.agentId ?? "";
      const catalog = await services.workflowHooks.listCatalog({
        companyId: actor.companyId,
        actorUserId: userId,
        workflowGitSha: input.workflowGitSha,
        sharedRepoBranch: input.sharedRepoBranch,
        includeShared: input.includeShared !== false,
        includeLocal: input.includeLocal === true,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ catalog }) },
        ],
      };
    },
  });

  // ─── 6. list_hook_executions ──────────────────────────────────────────────
  tool("list_hook_executions", {
    permissions: [PERMISSIONS.HOOKS_MANAGE],
    description:
      "[Workflow Hooks] Read the runtime audit log of hook executions. Each\n" +
      "row carries phase, status (pending/success/failed/timeout), error_code,\n" +
      "duration_ms, and the actor_user_id (§1.7 traceability). Filterable by\n" +
      "config_id / run_id / status, ordered by created_at DESC.",
    input: z.object({
      configId: z.string().uuid().optional(),
      runId: z.string().uuid().optional(),
      status: z.enum(["pending", "success", "failed", "timeout"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const rows = await services.workflowHooks.listExecutions(
        actor.companyId,
        {
          configId: input.configId,
          runId: input.runId,
          status: input.status,
          limit: input.limit,
        },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ executions: rows }) },
        ],
      };
    },
  });
});
