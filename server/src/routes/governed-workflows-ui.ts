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
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { requirePermission } from "../middleware/require-permission.js";
import { governedWorkflowService } from "../services/governed-workflows.js";
import {
  saveDefinition,
  archiveDefinition,
  listRuns,
  getRunWithSteps,
  upsertDefinition,
  setEnabled,
} from "../services/governed-workflows-extensions.js";
import { createResolveGitProvider } from "../mcp/build-mcp-services.js";
import { ShaCache } from "@mnm/git-provider";
import { configLayers, configLayerItems } from "@mnm/db";
import { and, eq, isNull } from "drizzle-orm";

// ── Error helpers ────────────────────────────────────────────────────────────

function apiError(
  res: import("express").Response,
  status: number,
  error_code: string,
  message: string,
  hints: string[] = [],
) {
  return res.status(status).json({ isError: true, error_code, message, hints });
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

// Body for PUT /git-provider-config — sets the per-company git_provider
// config_layer_item used by createResolveGitProvider (see build-mcp-services).
// The config is idempotent: rerunning with new values updates the row in place.
// Server restart required after change (resolveGitProvider cache is process-lifetime).
const gitProviderConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gitlab"),
    providerId: z.string().min(1).default("cba-lab"),
    baseUrl: z.string().url(),
    projectId: z.string().min(1),
    token: z.string().min(1),
  }),
  z.object({
    kind: z.literal("local"),
    providerId: z.string().min(1).default("local:dev"),
    repoDir: z.string().min(1),
  }),
]);

// ── Author identity from actor ───────────────────────────────────────────────

function resolveAuthor(req: import("express").Request): { name: string; email: string } {
  if (req.actor.type === "board" && req.actor.userId) {
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
  // Fallback for local_trusted
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
        let parsed = null;
        if (gitTag) {
          try {
            parsed = await svc.getWorkflowParsed({ companyId, name, gitTag });
          } catch {
            // Parsed is optional — return def row even if git fetch fails
          }
        }
        res.json({ definition: def, parsed: parsed ?? null });
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
        const author = resolveAuthor(req);
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

        // 2. Upsert the git_provider item in that layer.
        const existingItems = await db
          .select({ id: configLayerItems.id })
          .from(configLayerItems)
          .where(
            and(
              eq(configLayerItems.layerId, layerId),
              eq(configLayerItems.itemType, "git_provider"),
              eq(configLayerItems.name, "default"),
            ),
          )
          .limit(1);

        if (existingItems.length > 0) {
          await db
            .update(configLayerItems)
            .set({
              configJson: parsed.data,
              enabled: true,
              updatedAt: new Date(),
            })
            .where(eq(configLayerItems.id, existingItems[0]!.id));
        } else {
          await db.insert(configLayerItems).values({
            companyId,
            layerId,
            itemType: "git_provider",
            name: "default",
            displayName: `Git Provider (${parsed.data.kind})`,
            configJson: parsed.data,
            enabled: true,
          });
        }

        res.json({
          ok: true,
          kind: parsed.data.kind,
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
        const author = resolveAuthor(req);
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
        const gitProvider = await resolveGitProvider({ companyId, userId });
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
          const gitProvider = await resolveGitProvider({ companyId, userId });
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

  return router;
}
