import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { accessService } from "../services/access.js";
import type { WorkflowHooksService } from "../services/workflow-hooks.js";
import { badRequest } from "../errors.js";

/**
 * WORKFLOW-HOOKS T2.8 — REST routes (admin + audit).
 *
 * Mounted under the company-scoped prefix `api.use("/companies/:companyId", ...)`
 * which already wires assertCompanyMembership + tenantContextMiddleware +
 * tagScopeMiddleware. All endpoints require `hooks:manage` ; toggling
 * `enforced=true` additionally requires `hooks:enforce` (rechecked
 * server-side inside `workflowHooksService`, not just at route level).
 *
 * Endpoints (parity with the 6 MCP tools — see workflow-hooks.tool.ts) :
 *   GET    /companies/:companyId/workflow-hooks/configs
 *   GET    /companies/:companyId/workflow-hooks/configs/:configId
 *   POST   /companies/:companyId/workflow-hooks/configs
 *   PATCH  /companies/:companyId/workflow-hooks/configs/:configId
 *   DELETE /companies/:companyId/workflow-hooks/configs/:configId
 *   GET    /companies/:companyId/workflow-hooks/executions
 *   GET    /companies/:companyId/workflow-hooks/catalog
 *
 * The UI (T2.9) consumes these endpoints via `ui/src/api/hooks.ts` ; the
 * paths there match this router 1:1.
 */
const visibilitySchema = z.enum(["private", "tags", "principals", "company"]);

const upsertConfigSchema = z.object({
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

const patchConfigSchema = upsertConfigSchema.partial();

const phaseSchema = z.enum([
  "before_run",
  "before_step",
  "after_step",
  "after_run",
]);

/**
 * Resolve the human principal id from `req.actor` for traceability.
 *
 * MnM mandates that every audit row has a non-empty `actor_user_id`
 * (see `docs/decision-log.md §1.7` — universal human traceability).
 *
 * - `local_implicit` (local_trusted mode) : `actorMiddleware` already pins
 *   `userId = "local-board"` (cf. `server/src/middleware/auth.ts`), so this
 *   helper returns it as-is. The sentinel is documented and surfaces in the
 *   audit log as the local admin operator.
 * - `authenticated` mode : `userId` is the BetterAuth session userId. If it
 *   is missing we refuse to proceed rather than silently writing an empty
 *   string into the audit row — that would break universal traceability.
 */
function resolvePrincipalId(req: Request): string {
  const userId = req.actor.userId;
  if (!userId) {
    throw badRequest("actorPrincipalId is required (no userId on req.actor)");
  }
  return userId;
}

export function workflowHooksRoutes(db: Db, hooks: WorkflowHooksService) {
  const router = Router();
  const access = accessService(db);

  // ─── Helper: check whether the actor has hooks:enforce ──────────────────
  // The `enforced` flag on a hook config is admin-imposed (everyone in
  // the company sees it), so we gate creation / update of `enforced=true`
  // on the dedicated permission. Local_implicit (local_trusted mode)
  // bypasses, mirroring requirePermission's logic.
  async function actorHasEnforcePermission(
    req: Parameters<Parameters<typeof router.get>[1]>[0],
    companyId: string,
  ): Promise<boolean> {
    if (req.actor.type === "board" && req.actor.source === "local_implicit") {
      return true;
    }
    if (req.actor.type === "board") {
      return access.canUser(
        companyId,
        req.actor.userId!,
        PERMISSIONS.HOOKS_ENFORCE,
      );
    }
    if (req.actor.type === "agent") {
      return access.hasPermission(
        companyId,
        "agent",
        req.actor.agentId!,
        PERMISSIONS.HOOKS_ENFORCE,
      );
    }
    return false;
  }

  // ─── List configs ────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-hooks/configs",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const principalId = resolvePrincipalId(req);
      const rows = await hooks.listConfigs(companyId, principalId);
      res.json({ configs: rows });
    },
  );

  // ─── Get a single config ─────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-hooks/configs/:configId",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const configId = req.params.configId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const principalId = resolvePrincipalId(req);
      const dto = await hooks.getConfig(companyId, configId, principalId);
      if (!dto) {
        // Return 404 rather than 403 so existence stays opaque across
        // visibility tiers (mirror the connectors / governed-workflows
        // pattern).
        res.status(404).json({ error: "Hook config not found" });
        return;
      }
      res.json({ config: dto });
    },
  );

  // ─── Create a config ─────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/workflow-hooks/configs",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const parsed = upsertConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(
          `Invalid hook config payload: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      const principalId = resolvePrincipalId(req);
      const hasEnforcePermission = await actorHasEnforcePermission(req, companyId);
      const dto = await hooks.createConfig(companyId, parsed.data, {
        actorPrincipalId: principalId,
        hasEnforcePermission,
      });
      res.status(201).json({ config: dto });
    },
  );

  // ─── Update a config ─────────────────────────────────────────────────────
  router.patch(
    "/companies/:companyId/workflow-hooks/configs/:configId",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const configId = req.params.configId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const parsed = patchConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(
          `Invalid hook config patch: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      const principalId = resolvePrincipalId(req);
      const hasEnforcePermission = await actorHasEnforcePermission(req, companyId);
      const dto = await hooks.updateConfig(
        companyId,
        configId,
        parsed.data,
        { actorPrincipalId: principalId, hasEnforcePermission },
      );
      res.json({ config: dto });
    },
  );

  // ─── Delete a config ─────────────────────────────────────────────────────
  router.delete(
    "/companies/:companyId/workflow-hooks/configs/:configId",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const configId = req.params.configId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const principalId = resolvePrincipalId(req);
      const hasEnforcePermission = await actorHasEnforcePermission(req, companyId);
      const removed = await hooks.deleteConfig(companyId, configId, {
        actorPrincipalId: principalId,
        hasEnforcePermission,
      });
      if (!removed) {
        res.status(404).json({ error: "Hook config not found" });
        return;
      }
      res.status(204).end();
    },
  );

  // ─── List executions (audit log) ─────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-hooks/executions",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      // P0.2 — assertBoard for parity with the 6 sibling endpoints. Without
      // this an agent actor that somehow held hooks:manage would slip past
      // the board-only audit log.
      assertBoard(req);
      const principalId = resolvePrincipalId(req);

      // Date filters — parse + validate strictly so a malformed query string
      // never silently degrades to "no filter".
      const sinceRaw =
        typeof req.query.since === "string" ? req.query.since : undefined;
      const untilRaw =
        typeof req.query.until === "string" ? req.query.until : undefined;
      const since = sinceRaw ? new Date(sinceRaw) : undefined;
      const until = untilRaw ? new Date(untilRaw) : undefined;
      if (since && Number.isNaN(since.getTime())) {
        throw badRequest("Invalid since (expected ISO 8601 date)");
      }
      if (until && Number.isNaN(until.getTime())) {
        throw badRequest("Invalid until (expected ISO 8601 date)");
      }

      // Phase filter — validate against the canonical enum.
      let phase: z.infer<typeof phaseSchema> | undefined;
      if (typeof req.query.phase === "string") {
        const parsedPhase = phaseSchema.safeParse(req.query.phase);
        if (!parsedPhase.success) {
          throw badRequest(
            "Invalid phase (expected before_run|before_step|after_step|after_run)",
          );
        }
        phase = parsedPhase.data;
      }

      // Numeric filters — clamp limit to [1, 500], offset to [0, ∞).
      const limit =
        typeof req.query.limit === "string"
          ? Math.min(500, Math.max(1, Number(req.query.limit) || 100))
          : undefined;
      const offsetRaw =
        typeof req.query.offset === "string" ? Number(req.query.offset) : NaN;
      const offset = Number.isFinite(offsetRaw)
        ? Math.max(0, Math.floor(offsetRaw))
        : undefined;

      // TODO: aligned with P4-A service patch — the service signature is
      // `listExecutions(companyId, actorPrincipalId, filter)` and the
      // filter type already accepts `phase`/`since`/`until`/`offset`.
      const filter = {
        configId:
          typeof req.query.config_id === "string" ? req.query.config_id : undefined,
        runId:
          typeof req.query.run_id === "string" ? req.query.run_id : undefined,
        status:
          typeof req.query.status === "string"
            ? (req.query.status as "pending" | "success" | "failed" | "timeout")
            : undefined,
        phase,
        since,
        until,
        limit,
        offset,
      };
      const rows = await hooks.listExecutions(companyId, principalId, filter);
      res.json({ executions: rows });
    },
  );

  // ─── Catalog ─────────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-hooks/catalog",
    requirePermission(db, PERMISSIONS.HOOKS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const userId = resolvePrincipalId(req);
      const workflowGitSha =
        typeof req.query.workflow_git_sha === "string"
          ? req.query.workflow_git_sha
          : undefined;
      const sharedRepoBranch =
        typeof req.query.shared_branch === "string"
          ? req.query.shared_branch
          : undefined;
      // P1.1 — opt-in strict (mirrors include_local). Express parses
      // `?include_shared[]=false` as `["false"]` which would slip past
      // a `!== "false"` check, so we require the explicit string "true".
      // Breaking change: clients that relied on the previous default-true
      // must now send `?include_shared=true` explicitly.
      const includeShared = req.query.include_shared === "true";
      const includeLocal = req.query.include_local === "true";
      const catalog = await hooks.listCatalog({
        companyId,
        actorUserId: userId,
        workflowGitSha,
        sharedRepoBranch,
        includeShared,
        includeLocal,
      });
      res.json({ catalog });
    },
  );

  return router;
}
