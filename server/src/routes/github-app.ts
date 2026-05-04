import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { githubAppService, GitHubAppError } from "../services/github-app.js";
import { badRequest, conflict, notFound } from "../errors.js";

/**
 * GITHUB-PROVIDER Phase 1 — REST routes for the per-company GitHub App
 * config attached to a `github` connector.
 *
 * Mounted on the company-scoped prefix `api.use("/companies/:companyId", ...)`
 * which already wires assertCompanyMembership + tenantContextMiddleware +
 * tagScopeMiddleware. All routes require `connectors:manage` permission
 * (same gate as the rest of the connectors admin surface).
 *
 * Endpoints (per plan §Phase 1 step 4) :
 *   POST   /companies/:companyId/connectors/:connectorId/github/app
 *     → create. Validates by signing JWT and POSTing to GitHub /app.
 *   GET    /companies/:companyId/connectors/:connectorId/github/app
 *     → returns App config (no privateKey) + active installations.
 *   POST   /companies/:companyId/connectors/:connectorId/github/app/installations/sync
 *     → re-sync installations from GitHub.
 *   DELETE /companies/:companyId/connectors/:connectorId/github/app
 *     → soft-delete (revoked_at = now). The OAuth side of the connector
 *       remains active.
 *
 * Error contract: never `res.status(...)` directly — throws via the
 * `errors.ts` helpers (badRequest / notFound / conflict) so the global
 * errorHandler maps to the JSON shape consistent with other admin routes.
 */

const createBodySchema = z.object({
  appId: z
    .string()
    .min(1, "appId required")
    .max(64, "appId too long")
    .regex(/^[0-9]+$/, "appId must be the numeric GitHub App id (digits only)"),
  privateKey: z
    .string()
    .min(100, "privateKey looks too short to be a real .pem")
    .refine(
      (v) =>
        v.includes("-----BEGIN PRIVATE KEY-----") &&
        v.includes("-----END PRIVATE KEY-----"),
      "privateKey must be a PKCS#8 PEM (-----BEGIN PRIVATE KEY-----)",
    ),
  webhookSecret: z.string().min(8).max(256).optional(),
});

export function githubAppRoutes(db: Db) {
  const router = Router();
  const svc = githubAppService(db);

  // ── POST — create the App config attached to a connector ──────────────────
  router.post(
    "/companies/:companyId/connectors/:connectorId/github/app",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const connectorId = req.params.connectorId as string;
        assertCompanyAccess(req, companyId);
        assertBoard(req);

        const parsed = createBodySchema.safeParse(req.body);
        if (!parsed.success) {
          throw badRequest(
            parsed.error.issues
              .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
              .join("; "),
          );
        }

        const out = await svc.createGitHubApp({
          companyId,
          connectorId,
          userId: req.actor.userId!,
          appId: parsed.data.appId,
          privateKey: parsed.data.privateKey,
          webhookSecret: parsed.data.webhookSecret ?? null,
        });

        res.status(201).json({ app: out });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET — read the App config + installations (no privateKey) ─────────────
  router.get(
    "/companies/:companyId/connectors/:connectorId/github/app",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const connectorId = req.params.connectorId as string;
        assertCompanyAccess(req, companyId);

        const app = await svc.getGitHubAppByConnector(companyId, connectorId);
        if (!app) throw notFound("No GitHub App attached to this connector");

        // We don't sync from GitHub on every read — just return what's in DB.
        // The sync endpoint below is the explicit refresh.
        const installations = await svc.listInstallations({
          companyId,
          githubAppId: app.id,
        });

        res.json({ app, installations });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST .../sync — re-sync installations from GitHub ─────────────────────
  router.post(
    "/companies/:companyId/connectors/:connectorId/github/app/installations/sync",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const connectorId = req.params.connectorId as string;
        assertCompanyAccess(req, companyId);

        const app = await svc.getGitHubAppByConnector(companyId, connectorId);
        if (!app) throw notFound("No GitHub App attached to this connector");

        try {
          const installations = await svc.listInstallations({
            companyId,
            githubAppId: app.id,
          });
          res.json({ installations });
        } catch (err) {
          if (err instanceof GitHubAppError) {
            throw conflict(`GitHub sync failed: ${err.message}`);
          }
          throw err;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  // ── DELETE — soft-delete (revoke) the App config ──────────────────────────
  router.delete(
    "/companies/:companyId/connectors/:connectorId/github/app",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        const connectorId = req.params.connectorId as string;
        assertCompanyAccess(req, companyId);
        assertBoard(req);

        const app = await svc.getGitHubAppByConnector(companyId, connectorId);
        if (!app) throw notFound("No GitHub App attached to this connector");

        await svc.revokeGitHubApp({
          companyId,
          githubAppId: app.id,
          actorUserId: req.actor.userId!,
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
