/**
 * REST routes for the Workflow Studio multi-file editor (Tranche U13.3).
 *
 * Mount: /api/companies/:companyId/governed-workflows/:name/files
 * Middleware chain: assertCompanyMembership -> tenantContextMiddleware ->
 *   tagScopeMiddleware -> requirePermission (per route) -> handler.
 *
 * Error contract for 4xx:
 *   { isError: true, error_code: string, message: string, hints: string[] }
 *
 * GovernedWorkflowError -> HTTP status mapping:
 *   - WORKFLOW_FILE_NOT_FOUND         -> 404
 *   - WORKFLOW_FILE_INVALID_PATH      -> 422
 *   - WORKFLOW_FILE_EMPTY_CHANGES     -> 422
 *   - GIT_PROVIDER_ERROR              -> 502
 *   - anything else                   -> forward to next(err) (500)
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { governedWorkflowDefinitions, type Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { ShaCache } from "@mnm/git-provider";
import { requirePermission } from "../middleware/require-permission.js";
import { createResolveGitProvider } from "../mcp/build-mcp-services.js";
import { GovernedWorkflowError } from "../services/governed-workflows.js";
import {
  listWorkflowFiles,
  getWorkflowFile,
  batchCommitWorkflowFiles,
} from "../services/governed-workflow-files.js";
import { apiError, resolveAuthor } from "./governed-workflows-ui.js";

// ── Body schemas ────────────────────────────────────────────────────────────

const batchBodySchema = z.object({
  commitMessage: z.string().min(1).max(500),
  branch: z.string().optional().default("main"),
  changes: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string().optional(),
        delete: z.boolean().optional(),
      }),
    )
    .min(1),
});

// ── Error translation ───────────────────────────────────────────────────────

/**
 * Map a GovernedWorkflowError onto the 4xx contract. Returns true when the
 * error was translated to an HTTP response, false when the caller should fall
 * through to `next(err)` (500).
 */
function sendWorkflowError(
  res: import("express").Response,
  err: unknown,
): boolean {
  if (!(err instanceof GovernedWorkflowError)) return false;
  switch (err.code) {
    case WORKFLOW_ERROR_CODES.WORKFLOW_FILE_NOT_FOUND:
      apiError(res, 404, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH:
    case WORKFLOW_ERROR_CODES.WORKFLOW_FILE_EMPTY_CHANGES:
      apiError(res, 422, err.code, err.message, err.hints);
      return true;
    case WORKFLOW_ERROR_CODES.GIT_PROVIDER_ERROR:
      apiError(res, 502, err.code, err.message, err.hints);
      return true;
    default:
      return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the workflow definition row. Needed to default `ref` to the latest
 * tag when the client doesn't pass one, and to produce a clean 404 when the
 * workflow doesn't exist yet.
 */
async function getWorkflowDefinitionRow(
  db: Db,
  companyId: string,
  name: string,
) {
  const [row] = await db
    .select({ latestGitTag: governedWorkflowDefinitions.latestGitTag })
    .from(governedWorkflowDefinitions)
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, companyId),
        eq(governedWorkflowDefinitions.name, name),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── Route factory ───────────────────────────────────────────────────────────

export function governedWorkflowFilesRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  const deps = { resolveGitProvider, shaCache };

  // ── GET / ────────────────────────────────────────────────────────────────
  // List every file in the workflow's subtree at a given ref. If no ref is
  // provided, we fall back to the DB's latestGitTag, or "main" when the DB
  // doesn't know about the workflow yet.
  router.get(
    "/",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const queryRef = req.query.ref as string | undefined;

        const def = await getWorkflowDefinitionRow(db, companyId, name);
        if (!def && !queryRef) {
          return apiError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            `Workflow '${name}' not found`,
            [
              "Create the workflow via POST /governed-workflows first, or pass ?ref=<branch|tag|sha>",
            ],
          );
        }
        const ref = queryRef ?? def?.latestGitTag ?? "main";

        const userId =
          req.actor.type === "board" ? req.actor.userId ?? null : null;
        const result = await listWorkflowFiles(deps, {
          companyId,
          userId,
          workflowName: name,
          ref,
        });
        res.json(result);
      } catch (err) {
        if (sendWorkflowError(res, err)) return;
        next(err);
      }
    },
  );

  // ── GET /*filePath ───────────────────────────────────────────────────────
  // Wildcard path param so `gates/lint.ts` is captured as a single path.
  // Express 5 / path-to-regexp 8 uses `*name` (not the legacy `:name(*)`).
  // The router surfaces the captured segments as a string array in
  // `req.params.filePath`, which we re-join with `/`.
  router.get(
    "/*filePath",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const raw = req.params.filePath as unknown;
        const rawPath = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
        // Segments arrive URI-decoded by the router, so `decodeURIComponent`
        // is idempotent here — we keep it for defence in depth. Validation
        // against traversal is the service's job.
        const path = decodeURIComponent(rawPath);
        const queryRef = req.query.ref as string | undefined;

        const def = await getWorkflowDefinitionRow(db, companyId, name);
        if (!def && !queryRef) {
          return apiError(
            res,
            404,
            "WORKFLOW_NOT_FOUND",
            `Workflow '${name}' not found`,
            [
              "Create the workflow via POST /governed-workflows first, or pass ?ref=<branch|tag|sha>",
            ],
          );
        }
        const ref = queryRef ?? def?.latestGitTag ?? "main";

        const userId =
          req.actor.type === "board" ? req.actor.userId ?? null : null;
        const result = await getWorkflowFile(deps, {
          companyId,
          userId,
          workflowName: name,
          ref,
          path,
        });
        res.json(result);
      } catch (err) {
        if (sendWorkflowError(res, err)) return;
        next(err);
      }
    },
  );

  // ── PUT / ────────────────────────────────────────────────────────────────
  // Atomic batch commit of create / update / delete actions. Produces a new
  // semver tag and bumps the DB row's `latest_git_tag`.
  router.put(
    "/",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const name = req.params.name as string;
        const body = batchBodySchema.safeParse(req.body);
        if (!body.success) {
          return apiError(
            res,
            422,
            "WORKFLOW_VALIDATION",
            body.error.message,
            [
              "Send { commitMessage, branch?, changes: [{ path, content?, delete? }, ...] }",
            ],
          );
        }
        const { commitMessage, branch, changes } = body.data;
        const author = await resolveAuthor(db, req);
        const userId =
          req.actor.type === "board" ? req.actor.userId ?? null : null;

        const result = await batchCommitWorkflowFiles(db, deps, {
          companyId,
          userId,
          workflowName: name,
          branch,
          commitMessage,
          authorName: author.name,
          authorEmail: author.email,
          changes,
        });
        res.json(result);
      } catch (err) {
        if (sendWorkflowError(res, err)) return;
        next(err);
      }
    },
  );

  return router;
}
