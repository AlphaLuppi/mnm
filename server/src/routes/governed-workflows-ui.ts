/**
 * REST routes for the Governed Workflows UI (Tranche U2).
 *
 * Mount: /api/companies/:companyId/governed-workflows
 * Middleware chain: assertCompanyMembership -> tenantContextMiddleware ->
 *   tagScopeMiddleware -> requirePermission (per route) -> handler.
 *
 * Error contract for 4xx:
 *   { isError: true, error_code: string, message: string, hints: string[] }
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { workflowDefinitionSchema, WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { requirePermission } from "../middleware/require-permission.js";
import { governedWorkflowService, GovernedWorkflowError } from "../services/governed-workflows.js";
import { publishLiveEvent } from "../services/live-events.js";
import {
  saveDefinition,
  archiveDefinition,
  listRuns,
  getRunWithSteps,
  upsertDefinition,
  setEnabled,
} from "../services/governed-workflows-extensions.js";
import {
  getRunLiveness,
  recoverRun,
} from "../services/governed-workflows-liveness.js";
import { createResolveGitProvider } from "../mcp/build-mcp-services.js";
import { ShaCache } from "@mnm/git-provider";
import { configLayers, configLayerItems, authUsers } from "@mnm/db";
import { and, eq, isNull } from "drizzle-orm";
import { runImport, PluginImportError } from "../services/cc-plugin-import/orchestrator.js";
import { buildSourceProvider } from "../services/cc-plugin-import/source-provider-factory.js";

// ── Error helpers ────────────────────────────────────────────────────────────

export function apiError(
  res: import("express").Response,
  status: number,
  error_code: string,
  message: string,
  hints: string[] = [],
) {
  return res.status(status).json({ isError: true, error_code, message, hints });
}

/**
 * Map a GovernedWorkflowError raised by cancelRun/reactivateRun onto the 4xx
 * HTTP contract. Returns true when the error was translated, false when the
 * caller should fall through to `next(err)` (500). Mirrors the pattern from
 * `governed-workflows-files.ts` so error handling stays consistent across the
 * cockpit surface.
 *
 * Mapping rationale:
 *   - 423 Locked for WORKFLOW_RUN_CANCELLED — semantically a "locked" run, the
 *     RFC 4918 status fits the "the resource is in a state preventing this"
 *     intent better than a generic 409.
 *   - 409 Conflict for the lifecycle-state errors (already cancelled, not
 *     cancelled, not active) — concurrent state changes.
 *   - 403 Forbidden for permission failures.
 *   - 400 Bad Request for invalid input (reason too short, non-uuid, etc.).
 */
function sendRunLifecycleError(
  res: import("express").Response,
  err: unknown,
): boolean {
  if (!(err instanceof GovernedWorkflowError)) return false;
  switch (err.code) {
    case WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND:
      apiError(res, 404, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED:
      apiError(res, 423, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ALREADY_CANCELLED:
    case WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_CANCELLED:
    case WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE:
      apiError(res, 409, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN:
      apiError(res, 403, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT:
      apiError(res, 400, err.code, err.message, err.hints);
      return true;
    default:
      return false;
  }
}

// ── Body schemas ──────────────────────────────────────────────────────────────

const saveBodySchema = z.object({
  definition: workflowDefinitionSchema,
  commitMessage: z.string().min(1).max(500),
  branch: z.string().optional().default("main"),
});

const patchEnabledSchema = z.object({
  enabled: z.boolean(),
});

const launchBodySchema = z.object({
  params: z.record(z.unknown()).optional().default({}),
  gitTagPreference: z.enum(["latest", "HEAD"]).optional().default("latest"),
});

// Body for POST /runs/:runId/cancel — `reason` is mandatory and surfaced in
// the audit log + live event payload. Min length matches the service-side
// guard so client-side feedback is symmetric with the server invariant.
const cancelRunBodySchema = z.object({
  reason: z.string().min(5, "Cancellation reason must be at least 5 characters."),
});

// Body for PUT /git-provider-config — upserts a per-company git_provider
// config_layer_item used by createResolveGitProvider (see build-mcp-services).
//
// `itemName` distinguishes named items inside the same layer (default:
// "default"). To split workflows + agents across two repos, send two PUTs
// with `itemName: "workflows"` (paths.workflows set) and
// `itemName: "agents"` (paths.agents set) — the resolver picks the right
// one off `resourceType` (see build-mcp-services.ts:399).
//
// `paths` are subtree prefixes inside the configured repo. Empty/omitted
// = files live at the repo root (default).
//
// The config is idempotent: rerunning with new values updates the row in
// place. Server restart required after change (resolveGitProvider cache
// is process-lifetime).
const gitProviderPathsSchema = z
  .object({
    workflows: z.string().optional(),
    agents: z.string().optional(),
  })
  .optional();

const gitProviderConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gitlab"),
    providerId: z.string().min(1).default("gitlab:primary"),
    baseUrl: z.string().url(),
    projectId: z.string().min(1),
    token: z.string().min(1),
    paths: gitProviderPathsSchema,
    itemName: z.string().min(1).max(64).default("default"),
  }),
  z.object({
    kind: z.literal("local"),
    providerId: z.string().min(1).default("local:dev"),
    repoDir: z.string().min(1),
    paths: gitProviderPathsSchema,
    itemName: z.string().min(1).max(64).default("default"),
  }),
]);

// ── Author identity from actor ───────────────────────────────────────────────
// Produces the {name, email} stamp written on each git commit the workflow
// route triggers. In authenticated mode we look up the real BetterAuth user
// record so commits in the GitLab history carry the user's real identity
// (not an opaque uuid@mnm.local). Agents and local_trusted keep their
// synthesized identities — those are never a real person.

export async function resolveAuthor(
  db: Db,
  req: import("express").Request,
): Promise<{ name: string; email: string }> {
  if (req.actor.type === "board" && req.actor.userId) {
    const [row] = await db
      .select({ name: authUsers.name, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, req.actor.userId))
      .limit(1);
    if (row?.email) {
      return {
        name: row.name?.trim() || row.email,
        email: row.email,
      };
    }
    // BetterAuth user row missing — fallback to userId synthesis.
    return {
      name: req.actor.userId,
      email: `${req.actor.userId}@mnm.local`,
    };
  }
  if (req.actor.type === "agent" && req.actor.agentId) {
    return {
      name: `agent:${req.actor.agentId}`,
      email: `agent-${req.actor.agentId}@mnm.local`,
    };
  }
  // Fallback for local_trusted (no BetterAuth session at all).
  return { name: "MnM Dev", email: "dev@mnm.local" };
}

// ── Route factory ─────────────────────────────────────────────────────────────

export function governedWorkflowUiRoutes(db: Db) {
  const router = Router({ mergeParams: true });
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  const svc = governedWorkflowService(db, { resolveGitProvider, shaCache });

  // ── GET /governed-workflows ─────────────────────────────────────────────────
  // List all non-archived workflow definitions for the company.
  router.get(
    "/",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const enabled = req.query.enabled !== undefined
          ? req.query.enabled === "true"
          : undefined;
        const rows = await svc.listDefinitions({ companyId, enabled });
        res.json({ items: rows, total: rows.length });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/git-provider-config ────────────────────────────
  // Defined BEFORE GET /:name so Express matches the literal path first
  // (otherwise "/:name" would capture "git-provider-config").
  // Returns the list of currently-configured git_provider items for the
  // company. Tokens are NEVER included — the UI only needs metadata to
  // render existing configuration.
  router.get(
    "/git-provider-config",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const rows = await db
          .select({
            itemId: configLayerItems.id,
            name: configLayerItems.name,
            displayName: configLayerItems.displayName,
            configJson: configLayerItems.configJson,
            enabled: configLayerItems.enabled,
          })
          .from(configLayerItems)
          .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
          .where(
            and(
              eq(configLayerItems.companyId, companyId),
              eq(configLayerItems.itemType, "git_provider"),
              eq(configLayers.scope, "company"),
              eq(configLayers.enforced, true),
              isNull(configLayers.archivedAt),
            ),
          );

        const items = rows.map((row) => {
          const cfg = row.configJson as Record<string, unknown>;
          // Strip the secret. Everything else is safe to expose to admins.
          const { token: _stripped, ...safe } = cfg;
          return {
            itemId: row.itemId,
            itemName: row.name,
            displayName: row.displayName,
            enabled: row.enabled,
            hasToken: typeof _stripped === "string" && _stripped.length > 0,
            config: safe,
          };
        });

        res.json({ items });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/:name ──────────────────────────────────────────
  // Fetch a single workflow definition + its parsed content from git.
  router.get(
    "/:name",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const def = await svc.getDefinition({ companyId, name });
        if (!def) {
          return apiError(res, 404, "WORKFLOW_NOT_FOUND", `Workflow '${name}' not found`, [
            "Use GET /governed-workflows to list available workflows",
          ]);
        }
        const gitTag = (req.query.gitTag as string | undefined) ?? def.latestGitTag ?? undefined;
        const userId = req.actor.type === "board" ? req.actor.userId : null;
        let parsed = null;
        let parseError: { error_code: string; message: string; hints: string[] } | null = null;
        if (gitTag) {
          try {
            parsed = await svc.getWorkflowParsed({ companyId, name, gitTag, userId });
          } catch (err) {
            parseError = {
              error_code: err instanceof GovernedWorkflowError ? err.code : "WORKFLOW_PARSE_FAILED",
              message: err instanceof Error ? err.message : String(err),
              hints: err instanceof GovernedWorkflowError ? err.hints : [],
            };
          }
        }
        res.json({ definition: def, parsed, parseError });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /governed-workflows ────────────────────────────────────────────────
  // Create a new workflow definition.
  router.post(
    "/",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const body = saveBodySchema.safeParse(req.body);
        if (!body.success) {
          return apiError(res, 422, "WORKFLOW_VALIDATION", body.error.message, [
            "Check the definition structure against the workflow schema",
          ]);
        }
        const { definition, commitMessage, branch } = body.data;
        const author = await resolveAuthor(db, req);
        const userId = req.actor.type === "board" ? req.actor.userId : null;
        const result = await saveDefinition(db, {
          companyId,
          userId,
          name: definition.name,
          description: (definition as Record<string, unknown>).description as string | null ?? null,
          definitionContent: JSON.stringify(definition, null, 2),
          commitMessage,
          branch,
          authorName: author.name,
          authorEmail: author.email,
          resolveGitProvider,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── PUT /governed-workflows/git-provider-config ────────────────────────────
  // Upsert the company-enforced git_provider config_layer_item. Defined BEFORE
  // PUT /:name so Express matches the literal path first (otherwise "/:name"
  // would capture "git-provider-config" as a workflow name).
  // Idempotent: re-running with new values updates the existing row.
  // Gated by workflows:create (admin-ish in local_trusted; prod should harden).
  // Note: the resolveGitProvider cache is process-lifetime — restart dev after.
  router.put(
    "/git-provider-config",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const parsed = gitProviderConfigSchema.safeParse(req.body);
        if (!parsed.success) {
          return apiError(
            res,
            422,
            "WORKFLOW_VALIDATION",
            "Invalid git provider config",
            parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          );
        }

        // 1. Find or create a company-enforced config layer named "Git Provider".
        const existingLayers = await db
          .select({ id: configLayers.id })
          .from(configLayers)
          .where(
            and(
              eq(configLayers.companyId, companyId),
              eq(configLayers.scope, "company"),
              eq(configLayers.enforced, true),
              eq(configLayers.name, "Git Provider"),
              isNull(configLayers.archivedAt),
            ),
          )
          .limit(1);

        let layerId: string;
        if (existingLayers.length > 0) {
          layerId = existingLayers[0]!.id;
        } else {
          const actorUserId =
            req.actor.type === "board" && req.actor.userId
              ? req.actor.userId
              : "system";
          const [created] = await db
            .insert(configLayers)
            .values({
              companyId,
              name: "Git Provider",
              description: "Per-company git backend for Governed Workflows",
              scope: "company",
              enforced: true,
              createdByUserId: actorUserId,
              ownerType: "system",
              visibility: "public",
            })
            .returning({ id: configLayers.id });
          layerId = created!.id;
        }

        // 2. Upsert the git_provider item in that layer (keyed by itemName so
        // a company can hold multiple items, e.g. one for workflows + one
        // for agents).
        const itemName = parsed.data.itemName;
        const existingItems = await db
          .select({ id: configLayerItems.id })
          .from(configLayerItems)
          .where(
            and(
              eq(configLayerItems.layerId, layerId),
              eq(configLayerItems.itemType, "git_provider"),
              eq(configLayerItems.name, itemName),
            ),
          )
          .limit(1);

        const displayName =
          itemName === "default"
            ? `Git Provider (${parsed.data.kind})`
            : `Git Provider — ${itemName} (${parsed.data.kind})`;

        if (existingItems.length > 0) {
          await db
            .update(configLayerItems)
            .set({
              configJson: parsed.data,
              displayName,
              enabled: true,
              updatedAt: new Date(),
            })
            .where(eq(configLayerItems.id, existingItems[0]!.id));
        } else {
          await db.insert(configLayerItems).values({
            companyId,
            layerId,
            itemType: "git_provider",
            name: itemName,
            displayName,
            configJson: parsed.data,
            enabled: true,
          });
        }

        res.json({
          ok: true,
          kind: parsed.data.kind,
          itemName,
          layerId,
          restartRequired: true,
          hint:
            "The resolveGitProvider cache is process-lifetime — restart the MnM dev server once for this change to take effect.",
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── DELETE /governed-workflows/git-provider-config/:itemName ───────────────
  // Removes a single git_provider item by its name. The "Git Provider"
  // config layer itself is left in place so re-adding an item later is
  // a single PUT.
  router.delete(
    "/git-provider-config/:itemName",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const itemName = req.params.itemName as string;
        const layers = await db
          .select({ id: configLayers.id })
          .from(configLayers)
          .where(
            and(
              eq(configLayers.companyId, companyId),
              eq(configLayers.scope, "company"),
              eq(configLayers.enforced, true),
              eq(configLayers.name, "Git Provider"),
              isNull(configLayers.archivedAt),
            ),
          )
          .limit(1);
        if (layers.length === 0) {
          return res.json({ ok: true, removed: 0 });
        }
        const removed = await db
          .delete(configLayerItems)
          .where(
            and(
              eq(configLayerItems.layerId, layers[0]!.id),
              eq(configLayerItems.itemType, "git_provider"),
              eq(configLayerItems.name, itemName),
            ),
          )
          .returning({ id: configLayerItems.id });
        res.json({ ok: true, removed: removed.length, restartRequired: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── PUT /governed-workflows/:name ──────────────────────────────────────────
  // Update an existing workflow definition (or create if it doesn't exist).
  // Rejects if the name in the URL doesn't match the body definition.name.
  router.put(
    "/:name",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const body = saveBodySchema.safeParse(req.body);
        if (!body.success) {
          return apiError(res, 422, "WORKFLOW_VALIDATION", body.error.message, [
            "Check the definition structure against the workflow schema",
          ]);
        }
        const { definition, commitMessage, branch } = body.data;
        if (definition.name !== name) {
          return apiError(
            res,
            422,
            "WORKFLOW_NAME_MISMATCH",
            `URL name '${name}' does not match body name '${definition.name}'`,
            ["Set definition.name to match the URL :name parameter"],
          );
        }
        const author = await resolveAuthor(db, req);
        const userId = req.actor.type === "board" ? req.actor.userId : null;
        const result = await upsertDefinition(db, {
          companyId,
          userId,
          name: definition.name,
          description: (definition as Record<string, unknown>).description as string | null ?? null,
          definition: definition as unknown as Record<string, unknown>,
          commitMessage,
          branch,
          authorName: author.name,
          authorEmail: author.email,
          resolveGitProvider,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── PATCH /governed-workflows/:name/enabled ─────────────────────────────────
  // Enable or disable a workflow definition.
  router.patch(
    "/:name/enabled",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const body = patchEnabledSchema.safeParse(req.body);
        if (!body.success) {
          return apiError(res, 422, "WORKFLOW_VALIDATION", "Field 'enabled' must be a boolean", [
            "Send { \"enabled\": true } or { \"enabled\": false }",
          ]);
        }
        const ok = await setEnabled(db, { companyId, name, enabled: body.data.enabled });
        if (!ok) {
          return apiError(res, 404, "WORKFLOW_NOT_FOUND", `Workflow '${name}' not found`, [
            "Use GET /governed-workflows to list available workflows",
          ]);
        }
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── DELETE /governed-workflows/:name ────────────────────────────────────────
  // Archive (soft-delete) a workflow definition.
  router.delete(
    "/:name",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const ok = await archiveDefinition(db, { companyId, name });
        if (!ok) {
          return apiError(res, 404, "WORKFLOW_NOT_FOUND", `Workflow '${name}' not found`, [
            "The workflow may already be archived or may not exist",
          ]);
        }
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/:name/tags ─────────────────────────────────────
  // List git tags for a workflow (prefixed by `<name>/v`).
  router.get(
    "/:name/tags",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const userId = req.actor.type === "board" ? req.actor.userId : null;
        const gitProvider = await resolveGitProvider({ companyId, userId, resourceType: "workflow" });
        const tags = await gitProvider.listTags({ prefix: `${name}/v` });
        res.json({ tags });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/:name/runs ─────────────────────────────────────
  // Paginated list of runs for a workflow.
  router.get(
    "/:name/runs",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
        const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100);
        const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
        const result = await listRuns(db, {
          companyId,
          workflowName: name,
          status: req.query.status as string | undefined,
          initiatedByActorId: req.query.initiatedByActorId as string | undefined,
          startedAfter: req.query.startedAfter as string | undefined,
          startedBefore: req.query.startedBefore as string | undefined,
          limit,
          offset: isNaN(offset) ? 0 : offset,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/:name/runs/:runId ──────────────────────────────
  // Fetch a single run with step executions and gate results.
  router.get(
    "/:name/runs/:runId",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;
        const result = await getRunWithSteps(db, { companyId, runId });
        if (!result) {
          return apiError(res, 404, "WORKFLOW_RUN_NOT_FOUND", `Run '${runId}' not found`, [
            "Verify the runId via GET /governed-workflows/:name/runs",
          ]);
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /governed-workflows/:name/runs ────────────────────────────────────
  // Launch a new run for a workflow.
  router.post(
    "/:name/runs",
    requirePermission(db, PERMISSIONS.WORKFLOWS_ENFORCE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const body = launchBodySchema.safeParse(req.body);
        if (!body.success) {
          return apiError(res, 422, "WORKFLOW_VALIDATION", body.error.message, [
            "Send { params: {}, gitTagPreference: 'latest' | 'HEAD' }",
          ]);
        }

        // Resolve actor for the run
        let actorType: "user" | "agent" | "system" = "system";
        let actorId = "system";
        if (req.actor.type === "board" && req.actor.userId) {
          actorType = "user";
          actorId = req.actor.userId;
        } else if (req.actor.type === "agent" && req.actor.agentId) {
          actorType = "agent";
          actorId = req.actor.agentId;
        }

        // Resolve git tag based on preference
        const userId = req.actor.type === "board" ? req.actor.userId : null;
        let gitTag: string | undefined;
        if (body.data.gitTagPreference === "HEAD") {
          const gitProvider = await resolveGitProvider({ companyId, userId, resourceType: "workflow" });
          const def = await svc.getDefinition({ companyId, name });
          if (!def) {
            return apiError(res, 404, "WORKFLOW_NOT_FOUND", `Workflow '${name}' not found`, [
              "Use GET /governed-workflows to list available workflows",
            ]);
          }
          // HEAD = latest commit on main branch (untagged)
          const sha = await gitProvider.resolveRef({ ref: "main" });
          gitTag = sha;
        }
        // "latest" uses default resolution (latestGitTag from DB)

        const result = await svc.launchWorkflow({
          companyId,
          name,
          gitTag,
          params: body.data.params,
          actor: { type: actorType, id: actorId },
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /governed-workflows/import-plugin ──────────────────────────────────
  // Import a Claude Code plugin from a source GitLab repo into the company's
  // workflows repo. Resolves both providers and delegates to runImport.
  router.post(
    "/import-plugin",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const { repo_url, ref, exclude_skills, exclude_agents } = (req.body ?? {}) as {
          repo_url?: string;
          ref?: string;
          exclude_skills?: string[];
          exclude_agents?: string[];
        };
        if (!repo_url || typeof repo_url !== "string") {
          return apiError(res, 400, "IMPORT_VALIDATION", "repo_url required (string)", [
            "Send { repo_url: 'https://...' } in the request body",
          ]);
        }

        const userId = req.actor.type === "board" ? (req.actor.userId ?? null) : null;
        const destProvider = await resolveGitProvider({ companyId, userId, resourceType: "workflow" });
        const sourceProvider = await buildSourceProvider({
          db,
          companyId,
          url: repo_url,
          userId,
        });
        const author = await resolveAuthor(db, req);

        const result = await runImport({
          db,
          companyId,
          createdByUserId: (req.actor.type === "board" ? req.actor.userId : req.actor.agentId) ?? "rest-actor",
          sourceProvider,
          destProvider,
          destBranch: "main",
          sourceUrl: repo_url,
          ref,
          excludeAgents: exclude_agents,
          excludeSkills: exclude_skills,
          authorName: author.name,
          authorEmail: author.email,
        });

        return res.status(201).json({ ok: true, ...result });
      } catch (err) {
        if (err instanceof PluginImportError) {
          const status = err.code.startsWith("CONFLICT") ? 409 : 400;
          return res.status(status).json({
            isError: true,
            error_code: err.code,
            message: err.message,
            details: err.details,
          });
        }
        next(err);
      }
    },
  );

  // ── POST /governed-workflows/runs/:runId/cancel ────────────────────────────
  // Cancel an active run. Cascades step executions (pending/running/gate_eval
  // → cancelled), blocks subsequent launch/complete calls until reactivated.
  // Auth: initiator OR `workflows:cancel_run` permission (enforced by the
  // service layer, not the route — same shape as the MCP tool). The route
  // gate is `workflows:enforce` (matches launch) so non-privileged board
  // users can't even reach the service-level auth check.
  router.post(
    "/runs/:runId/cancel",
    requirePermission(db, PERMISSIONS.WORKFLOWS_ENFORCE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;
        const body = cancelRunBodySchema.safeParse(req.body);
        if (!body.success) {
          return apiError(
            res,
            400,
            WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT,
            body.error.issues[0]?.message ?? "Invalid cancel payload",
            ["Send { reason: string (min 5 chars) }"],
          );
        }

        // Resolve actor for the cancel call. Same translation as launchWorkflow.
        let actorType: "user" | "agent" | "system" = "system";
        let actorId = "system";
        if (req.actor.type === "board" && req.actor.userId) {
          actorType = "user";
          actorId = req.actor.userId;
        } else if (req.actor.type === "agent" && req.actor.agentId) {
          actorType = "agent";
          actorId = req.actor.agentId;
        }

        const result = await svc.cancelRun({
          runId,
          companyId,
          actor: { type: actorType, id: actorId },
          reason: body.data.reason,
          publishLiveEvent,
        });
        res.json({
          runId: result.runId,
          cancelledAt: result.cancelledAt.toISOString(),
          cancelledStepIds: result.cancelledStepIds,
        });
      } catch (err) {
        if (sendRunLifecycleError(res, err)) return;
        next(err);
      }
    },
  );

  // ── POST /governed-workflows/runs/:runId/reactivate ────────────────────────
  // Reactivate a cancelled run. Restores cancelled step executions to
  // `pending` (if never started) or `running` (if started_at is set).
  // Auth: same model as cancel (initiator OR `workflows:cancel_run`).
  router.post(
    "/runs/:runId/reactivate",
    requirePermission(db, PERMISSIONS.WORKFLOWS_ENFORCE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;

        let actorType: "user" | "agent" | "system" = "system";
        let actorId = "system";
        if (req.actor.type === "board" && req.actor.userId) {
          actorType = "user";
          actorId = req.actor.userId;
        } else if (req.actor.type === "agent" && req.actor.agentId) {
          actorType = "agent";
          actorId = req.actor.agentId;
        }

        const result = await svc.reactivateRun({
          runId,
          companyId,
          actor: { type: actorType, id: actorId },
          publishLiveEvent,
        });
        res.json({
          runId: result.runId,
          reactivatedStepIds: result.reactivatedStepIds,
        });
      } catch (err) {
        if (sendRunLifecycleError(res, err)) return;
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/runs/:runId/steps ──────────────────────────────
  // T5.3 — composite sub-run drill-down. The UI's RunArtifactsTree calls this
  // when expanding a composite step's sub-run. Returns the same RunWithSteps
  // payload as the named-workflow endpoint, but takes only `runId` (the
  // sub-run's workflow name is internal to the chain — the caller doesn't
  // need to know it). Tenant scoped via companyId in the path; getRunWithSteps
  // already returns null when the run doesn't belong to the company, which
  // we surface as 404 (no cross-tenant existence leak).
  router.get(
    "/runs/:runId/steps",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;
        const result = await getRunWithSteps(db, { companyId, runId });
        if (!result) {
          return apiError(
            res,
            404,
            WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
            `Run '${runId}' not found`,
            ["Verify the runId — sub-runs only exist after launchStep on a composite parent."],
          );
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /governed-workflows/runs/:runId/liveness ───────────────────────────
  // Phase 4 — Liveness snapshot for the UI (LiveRunWidget) + watchdog status
  // probes. Returns:
  //   { runId, status, startedAt, lastUsefulActionAt, nextActionHint,
  //     recoveryAttempts, lastRecoveredAt, resumableTokenPresent,
  //     effectivePolicy, isStalled }
  // 404 with WORKFLOW_RUN_NOT_FOUND when the run is missing.
  // Auth: any board member with workflows:read can probe liveness.
  router.get(
    "/runs/:runId/liveness",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;
        const snapshot = await getRunLiveness(db, { runId, companyId });
        if (!snapshot) {
          return apiError(
            res,
            404,
            WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
            `Run '${runId}' not found`,
            ["Verify the runId via GET /governed-workflows/:name/runs"],
          );
        }
        res.json({
          runId: snapshot.runId,
          status: snapshot.status,
          startedAt: snapshot.startedAt?.toISOString() ?? null,
          lastUsefulActionAt: snapshot.lastUsefulActionAt?.toISOString() ?? null,
          nextActionHint: snapshot.nextActionHint,
          recoveryAttempts: snapshot.recoveryAttempts,
          lastRecoveredAt: snapshot.lastRecoveredAt?.toISOString() ?? null,
          resumableTokenPresent: snapshot.resumableTokenPresent,
          effectivePolicy: snapshot.effectivePolicy,
          isStalled: snapshot.isStalled,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /governed-workflows/runs/:runId/recover ───────────────────────────
  // Phase 4 — Manual operator-triggered recovery. Bypasses the policy
  // `enabled=false` advisory mode (forceManual) but still respects the retry
  // cap. Useful when the watchdog is in advisory mode (default) and an
  // operator wants to wake a single stalled run.
  // Auth: workflows:enforce — same gate as launch/cancel.
  router.post(
    "/runs/:runId/recover",
    requirePermission(db, PERMISSIONS.WORKFLOWS_ENFORCE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const runId = req.params.runId as string;
        const result = await recoverRun(
          db,
          { runId, companyId },
          { publishLiveEvent, forceManual: true },
        );
        if (!result.recovered) {
          // Translate the structured reason onto a 409/404 contract — same
          // shape the cancel/reactivate routes use so the UI handlers can
          // share the error parser.
          const status = result.reason === "run_not_found" ? 404 : 409;
          const code =
            result.reason === "run_not_found"
              ? WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND
              : result.reason === "max_retries_exceeded"
                ? "WORKFLOW_RUN_RECOVERY_EXHAUSTED"
                : result.reason === "run_not_active"
                  ? WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE
                  : "WORKFLOW_RUN_RECOVERY_DISABLED";
          return apiError(res, status, code, `Recovery skipped: ${result.reason}`, [
            "Inspect GET /runs/:runId/liveness for the current snapshot",
          ]);
        }
        res.json({
          runId: result.runId,
          recovered: result.recovered,
          recoveryAttempts: result.recoveryAttempts,
          recoveredAt: result.recoveredAt?.toISOString() ?? null,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
