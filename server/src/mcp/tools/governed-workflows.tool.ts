import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { workflowDefinitionSchema, WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { GitProviderError } from "@mnm/git-provider";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { GovernedWorkflowError } from "../../services/governed-workflows.js";
import {
  saveDefinition,
  archiveDefinition,
  registerDefinition,
  RegisterDefinitionNameMismatchError,
} from "../../services/governed-workflows-extensions.js";
import { setTenantContext } from "../../middleware/tenant-context.js";
import { publishLiveEvent } from "../../services/index.js";

const outputInputSchema = z.discriminatedUnion("kind", [
  z.object({
    name: z.string().min(1),
    kind: z.literal("file"),
    filename: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal("folder"),
    files: z.record(z.string(), z.string()),
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal("external_url"),
    url: z.string().url(),
  }),
]);

const artifactInputSchema = z.object({
  outputs: z.array(outputInputSchema),
  data: z.record(z.string(), z.unknown()),
});

/**
 * Map a GovernedWorkflowError to the MCP uniform error contract.
 * Cf. spec §4 "Contrat d'erreur uniforme".
 */
function governedError(err: GovernedWorkflowError) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: err.message,
          code: err.code,
          error_code: err.code,
          message: err.message,
          hints: err.hints,
          retryable: false,
          ...(err.data ?? {}),
        }),
      },
    ],
    isError: true,
  };
}

/**
 * Wrap a tool body so a thrown GovernedWorkflowError surfaces as the
 * uniform MCP error contract, and other throws fall through to the
 * registry's generic handler (INTERNAL_ERROR).
 */
async function wrap<T>(
  actor: { companyId: string },
  fn: () => Promise<T>,
): Promise<
  | { content: Array<{ type: "text"; text: string }>; isError?: boolean }
  | T
> {
  // Every governed-workflow tool sets the tenant context before running
  // its service call. This is defensive — the middleware chain should
  // have set it already for HTTP requests, but MCP tool invocations
  // happen inside a session and `app.current_company_id` needs to be
  // re-asserted here so the RLS filter applies.
  // (The existing MnM MCP wiring does NOT yet run tenantContextMiddleware
  // for /mcp endpoints — this is where we make it explicit.)
  try {
    const result = await fn();
    return result;
  } catch (err) {
    if (err instanceof GovernedWorkflowError) return governedError(err);
    if (err instanceof GitProviderError) {
      return governedError(
        new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_ERROR,
          `Git provider failed: ${err.message}`,
          [
            `Underlying git error code: ${err.code}`,
            "Check MnM server logs for full stack trace",
            "Verify the workflow repository is accessible and the configured credentials are valid",
          ],
        ),
      );
    }
    throw err;
  }
}

export default defineMcpTools(({ tool, services }) => {
  tool("list_governed_workflows", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] List governed-workflow definitions available to this actor's company. " +
      "Returns [{name, description, latest_git_tag, enabled}]. Use get_governed_workflow for details.",
    input: z.object({
      enabled: z.boolean().optional().describe("Filter to enabled workflows only"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const rows = await services.governedWorkflows.listDefinitions({
          companyId: actor.companyId,
          enabled: input.enabled,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(
              rows.map((r: any) => ({
                name: r.name,
                description: r.description,
                latest_git_tag: r.latestGitTag,
                enabled: r.enabled,
              })),
            ),
          }],
        };
      });
    },
  });

  tool("get_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Fetch + parse a workflow at a given git tag (default: latest_git_tag). " +
      "Returns the parsed workflow JSON plus {git_tag, git_sha}.",
    input: z.object({
      name: z.string().min(1),
      git_tag: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.getWorkflowParsed({
          companyId: actor.companyId,
          name: input.name,
          gitTag: input.git_tag,
          // userId so resolveGitProvider hits the user-token branch with
          // silent refresh — otherwise we'd fall to the company PAT.
          userId: actor.userId ?? null,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              workflow: r.workflow,
              git_tag: r.gitTag,
              git_sha: r.gitSha,
            }),
          }],
        };
      });
    },
  });

  tool("list_governed_workflow_runs", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] List runs for a workflow definition. " +
      "Filter by status (active|completed|failed|cancelled). " +
      "Returns {items: [{run_id, status, started_at, completed_at, cancelled_at, cancellation_reason, cancelled_by_actor_id, cancelled_by_actor_type, git_tag, git_sha, initiated_by_actor_type, initiated_by_actor_id}], total}. " +
      "Use this to discover run_ids to feed into get_governed_workflow_run when resuming work.",
    input: z.object({
      name: z.string().min(1).describe("Workflow definition name"),
      status: z.string().optional().describe("Filter: active|completed|failed|cancelled"),
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.listRuns({
          companyId: actor.companyId,
          workflowName: input.name,
          status: input.status,
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              items: r.items.map((row: any) => ({
                run_id: row.id,
                status: row.status,
                started_at: row.startedAt instanceof Date ? row.startedAt.toISOString() : row.startedAt,
                completed_at: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt,
                cancelled_at: row.cancelledAt instanceof Date ? row.cancelledAt.toISOString() : row.cancelledAt ?? null,
                cancellation_reason: row.cancellationReason ?? null,
                cancelled_by_actor_id: row.cancelledByActorId ?? null,
                cancelled_by_actor_type: row.cancelledByActorType ?? null,
                git_tag: row.gitTag,
                git_sha: row.gitSha,
                initiated_by_actor_type: row.initiatedByActorType,
                initiated_by_actor_id: row.initiatedByActorId,
              })),
              total: r.total,
            }),
          }],
        };
      });
    },
  });

  tool("get_governed_workflow_run", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Fetch the state of a run. Returns {status, cancelled_at, cancellation_reason, cancelled_by_actor_id, cancelled_by_actor_type, steps:[{id,state,artifact_ok}], last_gate_result}.",
    input: z.object({
      run_id: z.string().uuid(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.getRun({
          companyId: actor.companyId,
          runId: input.run_id,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              status: r.status,
              started_at: r.startedAt,
              completed_at: r.completedAt,
              cancelled_at: r.cancelledAt instanceof Date ? r.cancelledAt.toISOString() : r.cancelledAt ?? null,
              cancellation_reason: r.cancellationReason ?? null,
              cancelled_by_actor_id: r.cancelledByActorId ?? null,
              cancelled_by_actor_type: r.cancelledByActorType ?? null,
              steps: r.steps.map((s: any) => ({
                id: s.id,
                state: s.state,
                artifact_ok: s.artifactOk,
                started_at: s.startedAt,
                completed_at: s.completedAt,
              })),
              last_gate_result: r.lastGateResult,
            }),
          }],
        };
      });
    },
  });

  tool("launch_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Launch a new run. Pins the git tag at call time, creates the run row + one step_executions per step (pending). Returns {run_id, first_step, git_tag, git_sha}.",
    input: z.object({
      name: z.string().min(1),
      git_tag: z.string().optional(),
      params: z.record(z.unknown()).default({}),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.launchWorkflow({
          companyId: actor.companyId,
          name: input.name,
          gitTag: input.git_tag,
          params: input.params,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              first_step: r.firstStep,
              git_tag: r.gitTag,
              git_sha: r.gitSha,
            }),
          }],
        };
      });
    },
  });

  tool("launch_governed_step", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Authorize a step launch. Checks deps + evaluates the entry gate block if present. " +
      "Returns {agent_name, prompt_context, subagent_type} for the harness to Task() into.",
    input: z.object({
      run_id: z.string().uuid(),
      step_id: z.string().min(1),
      current_agents: z.record(z.string(), z.string()).optional(),
      session_tools: z.array(z.string()).optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.launchStep({
          companyId: actor.companyId,
          runId: input.run_id,
          stepId: input.step_id,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
          currentAgents: input.current_agents,
          sessionTools: input.session_tools,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agent_name: r.agentName,
              prompt_context: r.promptContext,
              subagent_type: r.subagentType,
              handoffs: r.handoffs,
              run_branch: r.runBranch,
            }),
          }],
        };
      });
    },
  });

  tool("complete_governed_step", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Finalise a step with its artifact. Evaluates the exit gate block. On pass: step=succeeded; if last step, run=completed.",
    input: z.object({
      run_id: z.string().uuid(),
      step_id: z.string().min(1),
      artifact: artifactInputSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.completeStep({
          companyId: actor.companyId,
          runId: input.run_id,
          stepId: input.step_id,
          artifact: input.artifact,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              step_state: r.stepState,
              run_status: r.runStatus,
            }),
          }],
        };
      });
    },
  });

  tool("setup_workspace", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Returns every agent the company expects to have " +
      "materialized in ~/.claude/agents/mnm--*.md. The harness MUST Write each " +
      "agent.content to its targetPath, then call push_local_state to persist " +
      "cache metadata.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.setupWorkspace({
          companyId: actor.companyId,
          userId: actor.userId ?? null,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agents: r.agents,
              instructions: r.instructions,
            }),
          }],
        };
      });
    },
  });

  tool("push_local_state", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Returns the payload the harness MUST write to " +
      "`${CLAUDE_PLUGIN_DATA}/last-session.json`. The SessionStart hook reads " +
      "this cache to detect plugin upgrades and prompt re-sync. " +
      "Active workflow state is NOT cached — discover it via list_governed_workflow_runs.",
    input: z.object({
      plugin_version: z.string(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.pushLocalState({
          companyId: actor.companyId,
          pluginVersion: input.plugin_version,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              target_relative_path: r.targetRelativePath,
              content: r.content,
            }),
          }],
        };
      });
    },
  });

  tool("sync_governed_environment", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Governed Workflows] Return the agent + config payload to stage in ~/.mnm/cache/. " +
      "Compares last_synced_sha to the server's current sha; returns agents[] only if changed.",
    input: z.object({
      last_synced_sha: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.syncEnvironment({
          companyId: actor.companyId,
          lastSyncedSha: input.last_synced_sha,
          userId: actor.userId ?? null,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agents: r.agents,
              new_sha: r.newSha,
              has_changes: r.hasChanges,
            }),
          }],
        };
      });
    },
  });

  // ── U6.1 — createGovernedWorkflow ────────────────────────────────────────

  tool("create_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_CREATE],
    description:
      "[Governed Workflows] Create a new governed workflow. " +
      "Commits workflow.json to the company's workflows git repo on main, " +
      "creates an auto-semver tag (<name>/vX.Y.Z), and inserts a row in " +
      "governed_workflow_definitions. Equivalent to the UI 'Nouveau workflow' flow.",
    input: z.object({
      definition: workflowDefinitionSchema,
      commit_message: z.string().min(1).max(500),
      branch: z.string().optional().default("main"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);

        // Validate definition name is non-empty (workflowDefinitionSchema already
        // enforces the shape, but we surface validation failures with WORKFLOW_VALIDATION).
        const parsed = workflowDefinitionSchema.safeParse(input.definition);
        if (!parsed.success) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                isError: true,
                error_code: WORKFLOW_ERROR_CODES.WORKFLOW_VALIDATION,
                message: parsed.error.message,
                hints: ["Check the definition structure against the workflow schema"],
              }),
            }],
            isError: true,
          };
        }

        const definition = parsed.data;
        const authorName = actor.userId
          ? `user:${actor.userId}`
          : actor.agentId
            ? `agent:${actor.agentId}`
            : "MnM MCP";
        const authorEmail = actor.userId
          ? `${actor.userId}@mnm.local`
          : actor.agentId
            ? `agent-${actor.agentId}@mnm.local`
            : "mcp@mnm.local";

        const result = await saveDefinition(services.db, {
          companyId: actor.companyId,
          userId: actor.userId,
          name: definition.name,
          description: (definition as Record<string, unknown>).description as string | null ?? null,
          definitionContent: JSON.stringify(definition, null, 2),
          commitMessage: input.commit_message,
          branch: input.branch,
          authorName,
          authorEmail,
          resolveGitProvider: services.resolveGitProvider,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              commit_sha: result.commitSha,
              new_git_tag: result.newGitTag,
              created: result.created,
            }),
          }],
        };
      });
    },
  });

  // ── registerGovernedWorkflow (option C: import from existing tag) ───────
  //
  // Symmetric to create_agent({latestGitTag}): adopts an existing workflow.json
  // pinned at a git tag without making a new commit. Idempotent — re-registering
  // re-pins the row to the supplied tag.

  tool("register_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_CREATE],
    description:
      "[Governed Workflows] Register an existing workflow.json from a git tag " +
      "into governed_workflow_definitions WITHOUT creating a new commit or tag. " +
      "Use to adopt a pre-existing workflow whose workflow.json is already in " +
      "the company's git repo (e.g. seeded via M1 import, or restored after " +
      "DB reset). Symmetric to create_agent({latestGitTag}). Idempotent: " +
      "re-registering updates the latest_git_tag pin.",
    input: z.object({
      name: z.string().min(1).describe("Workflow name (must match definition.name in workflow.json)"),
      git_tag: z.string().min(1).describe("Existing git tag where workflow.json is pinned (e.g. 'cba-feature-dev/v1.0.2')"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);

        try {
          const result = await registerDefinition(services.db, {
            companyId: actor.companyId,
            userId: actor.userId,
            name: input.name,
            gitTag: input.git_tag,
            resolveGitProvider: services.resolveGitProvider,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                id: result.id,
                name: input.name,
                latest_git_tag: result.latestGitTag,
                created: result.created,
              }),
            }],
          };
        } catch (err) {
          if (err instanceof GitProviderError && err.code === "not_found") {
            throw new GovernedWorkflowError(
              WORKFLOW_ERROR_CODES.WORKFLOW_FILE_NOT_FOUND,
              `workflow.json for '${input.name}' not found at tag '${input.git_tag}'.`,
              [
                `Verify the tag '${input.git_tag}' exists in the workflows git repo`,
                `Verify workflows/${input.name}/workflow.json (or your provider's configured paths) exists at that tag`,
                "Or use create_governed_workflow to commit a fresh definition",
              ],
              { workflow_name: input.name, git_tag: input.git_tag },
            );
          }
          if (err instanceof RegisterDefinitionNameMismatchError) {
            throw new GovernedWorkflowError(
              WORKFLOW_ERROR_CODES.WORKFLOW_NAME_MISMATCH,
              err.message,
              [`Either fix workflow.json or call register_governed_workflow with name '${err.definitionName}'.`],
              {
                workflow_name: err.requestedName,
                definition_name: err.definitionName,
                git_tag: err.gitTag,
              },
            );
          }
          if (err instanceof z.ZodError) {
            throw new GovernedWorkflowError(
              WORKFLOW_ERROR_CODES.WORKFLOW_VALIDATION,
              `workflow.json at tag '${input.git_tag}' fails schema validation: ${err.message}`,
              ["Check the workflow.json structure against the workflow schema."],
              { workflow_name: input.name, git_tag: input.git_tag },
            );
          }
          if (err instanceof SyntaxError) {
            throw new GovernedWorkflowError(
              WORKFLOW_ERROR_CODES.WORKFLOW_VALIDATION,
              `workflow.json at tag '${input.git_tag}' is not valid JSON.`,
              ["Ensure the file is well-formed JSON."],
              { workflow_name: input.name, git_tag: input.git_tag },
            );
          }
          throw err;
        }
      });
    },
  });

  // ── U6.2 — updateGovernedWorkflow ────────────────────────────────────────

  tool("update_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_CREATE],
    description:
      "[Governed Workflows] Update an existing governed workflow definition. " +
      "Bumps the patch version of the existing latestGitTag, commits the new " +
      "workflow.json, and updates the governed_workflow_definitions row. " +
      "Returns WORKFLOW_NOT_FOUND if the workflow has no DB row yet. " +
      "Returns WORKFLOW_NAME_MISMATCH if input.name != definition.name.",
    input: z.object({
      name: z.string().min(1),
      definition: workflowDefinitionSchema,
      commit_message: z.string().min(1).max(500),
      branch: z.string().optional().default("main"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);

        // Guard: name in URL must match definition.name
        if (input.name !== input.definition.name) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                isError: true,
                error_code: WORKFLOW_ERROR_CODES.WORKFLOW_NAME_MISMATCH,
                message: `input.name '${input.name}' does not match definition.name '${input.definition.name}'`,
                hints: ["Set definition.name to match the input.name parameter"],
              }),
            }],
            isError: true,
          };
        }

        // Guard: workflow must already exist in the DB
        const existing = await services.governedWorkflows.getDefinition({
          companyId: actor.companyId,
          name: input.name,
        });
        if (!existing) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                isError: true,
                error_code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
                message: `Workflow '${input.name}' not found`,
                hints: ["Use create_governed_workflow to create a new workflow"],
              }),
            }],
            isError: true,
          };
        }

        const definition = input.definition;
        const authorName = actor.userId
          ? `user:${actor.userId}`
          : actor.agentId
            ? `agent:${actor.agentId}`
            : "MnM MCP";
        const authorEmail = actor.userId
          ? `${actor.userId}@mnm.local`
          : actor.agentId
            ? `agent-${actor.agentId}@mnm.local`
            : "mcp@mnm.local";

        const result = await saveDefinition(services.db, {
          companyId: actor.companyId,
          userId: actor.userId,
          name: definition.name,
          description: (definition as Record<string, unknown>).description as string | null ?? null,
          definitionContent: JSON.stringify(definition, null, 2),
          commitMessage: input.commit_message,
          branch: input.branch,
          authorName,
          authorEmail,
          resolveGitProvider: services.resolveGitProvider,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              commit_sha: result.commitSha,
              new_git_tag: result.newGitTag,
              created: result.created,
            }),
          }],
        };
      });
    },
  });

  // ── U6.3 — archiveGovernedWorkflow ───────────────────────────────────────

  tool("archive_governed_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_CREATE],
    description:
      "[Governed Workflows] Soft-delete a governed workflow. " +
      "Sets archived_at=now() on the DB row. Does NOT delete anything in git " +
      "(history is preserved). Equivalent to the UI 'Supprimer' action.",
    input: z.object({
      name: z.string().min(1),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const archived = await archiveDefinition(services.db, {
          companyId: actor.companyId,
          name: input.name,
        });
        if (!archived) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                isError: true,
                error_code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
                message: `Workflow '${input.name}' not found or already archived`,
                hints: ["Use list_governed_workflows to see available workflows"],
              }),
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ archived: true, name: input.name }),
          }],
        };
      });
    },
  });

  // ── Task 8 — resumeGovernedWorkflowRun ───────────────────────────────────

  tool("resume_governed_workflow_run", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Returns a run's history (succeeded steps with their outputs+data) and the current pending step (with prompt + handoffs[]) so a fresh client can resume the run.",
    input: z.object({
      run_id: z.string().uuid(),
    }),
    // readOnlyHint: true because resumeRun only reads state — it does NOT call
    // launchStep and therefore does NOT transition any step to running.
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.resumeRun({
          companyId: actor.companyId,
          runId: input.run_id,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(r) }],
        };
      });
    },
  });

  // ── Task 9 — cancelGovernedWorkflowRun + reactivateGovernedWorkflowRun ────

  tool("cancel_governed_workflow_run", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Cancel a run. Cascades to running/pending/gate_eval step executions, " +
      "blocks subsequent launch/complete calls until reactivated. " +
      "Auth: initiator OR `workflows:cancel_run` permission. Reason min 5 chars. " +
      "Returns {run_id, cancelled_at, cancelled_step_ids}.",
    input: z.object({
      run_id: z.string().uuid(),
      reason: z.string().min(5, "reason must be at least 5 characters"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.cancelRun({
          runId: input.run_id,
          companyId: actor.companyId,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
          reason: input.reason,
          // Use the injected publisher when the test harness provides one
          // (services.publishLiveEvent), otherwise fall back to the live-events
          // singleton imported from services/index.js.
          publishLiveEvent: services.publishLiveEvent ?? publishLiveEvent,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              cancelled_at: r.cancelledAt.toISOString(),
              cancelled_step_ids: r.cancelledStepIds,
            }),
          }],
        };
      });
    },
  });

  tool("reactivate_governed_workflow_run", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Governed Workflows] Reactivate a cancelled run. Restores cancelled step executions to " +
      "pending (if never started) or running (if started_at is set). " +
      "Auth: initiator OR `workflows:cancel_run` permission. " +
      "Returns {run_id, reactivated_step_ids}.",
    input: z.object({
      run_id: z.string().uuid(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      return wrap(actor, async () => {
        await setTenantContext(services.db, actor.companyId);
        const r = await services.governedWorkflows.reactivateRun({
          runId: input.run_id,
          companyId: actor.companyId,
          actor: { type: actor.type, id: actor.userId ?? actor.agentId! },
          publishLiveEvent: services.publishLiveEvent ?? publishLiveEvent,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              run_id: r.runId,
              reactivated_step_ids: r.reactivatedStepIds,
            }),
          }],
        };
      });
    },
  });
});
