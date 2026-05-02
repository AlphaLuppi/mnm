import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { connectorService, ConnectorError } from "../services/connectors.js";
import { CONNECTOR_TEMPLATES, findTemplate } from "../services/connector-templates.js";
import { badRequest, forbidden, notFound, unprocessable } from "../errors.js";
import { logger } from "../middleware/logger.js";

/**
 * CONNECTORS-PLATFORM Sprint 2 — Task 5 REST routes (admin + user self-service).
 *
 * Mounted under the company-scoped prefix `api.use("/companies/:companyId", ...)`
 * which already wires assertCompanyMembership + tenantContextMiddleware +
 * tagScopeMiddleware. The OAuth callback dispatcher is mounted separately
 * (NON-tenant-scoped) in `connectors-callback.ts`.
 *
 * Endpoints :
 *   Admin (connectors:manage)
 *     GET    /companies/:companyId/connectors                      — list configured connectors
 *     POST   /companies/:companyId/connectors                      — create from template or custom
 *     PATCH  /companies/:companyId/connectors/:id                  — update
 *     DELETE /companies/:companyId/connectors/:id                  — remove
 *     GET    /companies/:companyId/connectors/:id/audit            — audit log (connectors:audit)
 *     GET    /companies/:companyId/connectors/templates            — 10 templates (no perm)
 *
 *   User self-service (mcp:connect)
 *     GET    /companies/:companyId/me/connected-accounts           — my status per connector
 *     POST   /companies/:companyId/me/connect/:connectorId         — initiate OAuth flow
 *     POST   /companies/:companyId/me/api-key/:connectorId         — set API key (api_key only)
 *     DELETE /companies/:companyId/me/connected-accounts/:connectorId — disconnect
 */
export function connectorRoutes(db: Db) {
  const router = Router();
  const svc = connectorService(db);

  // ── Helper: surface ConnectorError as a clean HTTP response ────────────────
  function mapConnectorError(err: unknown): never {
    if (err instanceof ConnectorError) {
      switch (err.code) {
        case "CONNECTOR_USER_NOT_IN_COMPANY":
          throw forbidden(err.message);
        case "CONNECTOR_NOT_CONFIGURED":
        case "CONNECTOR_USER_NOT_CONNECTED":
          throw notFound(err.message);
        case "CONNECTOR_TOKEN_EXPIRED_NO_REFRESH":
        case "CONNECTOR_TOKEN_REVOKED":
          throw unprocessable(err.message);
        case "CONNECTOR_REFRESH_FAILED":
          throw unprocessable(err.message);
      }
    }
    throw err;
  }

  // ── Templates (public read, no perm) ───────────────────────────────────────
  // Mounted BEFORE the parameterized routes so `/templates` doesn't get matched
  // as a connectorId.
  router.get(
    "/companies/:companyId/connectors/templates",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      // No permission check — templates are public metadata, no secrets, no
      // tenant-specific data. Used by the wizard to render the grid.
      res.json({ templates: CONNECTOR_TEMPLATES });
    },
  );

  // ── Admin REST ─────────────────────────────────────────────────────────────

  router.get(
    "/companies/:companyId/connectors",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const rows = await svc.listConnectors(companyId);
      res.json({ connectors: rows });
    },
  );

  router.post(
    "/companies/:companyId/connectors",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      const actorUserId = req.actor.userId!;

      const body = (req.body ?? {}) as {
        templateSlug?: string;
        providerSlug?: string;
        displayName?: string;
        type?: string;
        authorizationUrl?: string | null;
        tokenUrl?: string | null;
        userinfoUrl?: string | null;
        scopes?: string[];
        redirectUri?: string | null;
        clientId?: string | null;
        clientSecret?: string | null;
        refreshSupported?: boolean;
        apiKeyLabel?: string | null;
        enabled?: boolean;
      };

      // If the admin picked a template, hydrate defaults from CONNECTOR_TEMPLATES.
      const template = body.templateSlug ? findTemplate(body.templateSlug) : undefined;
      if (body.templateSlug && !template) {
        throw badRequest(`Unknown template slug: ${body.templateSlug}`);
      }

      const providerSlug = body.providerSlug ?? template?.slug;
      const displayName = body.displayName ?? template?.displayName;
      const type = (body.type ?? template?.type) as "oauth2" | "api_key" | undefined;
      if (!providerSlug || !displayName || !type) {
        throw badRequest("providerSlug, displayName and type are required");
      }
      if (type !== "oauth2" && type !== "api_key") {
        throw badRequest(`Invalid type: ${type} (expected oauth2 | api_key)`);
      }

      try {
        const created = await svc.createConnector(companyId, actorUserId, {
          providerSlug,
          displayName,
          type,
          authorizationUrl: body.authorizationUrl ?? template?.authorizationUrl ?? null,
          tokenUrl: body.tokenUrl ?? template?.tokenUrl ?? null,
          userinfoUrl: body.userinfoUrl ?? template?.userinfoUrl ?? null,
          scopes: body.scopes ?? template?.scopes ?? [],
          redirectUri: body.redirectUri ?? null,
          clientId: body.clientId ?? null,
          clientSecret: body.clientSecret ?? null,
          refreshSupported: body.refreshSupported ?? template?.refreshSupported ?? true,
          apiKeyLabel: body.apiKeyLabel ?? template?.apiKeyLabel ?? null,
          enabled: body.enabled ?? true,
        });
        res.status(201).json(created);
      } catch (err) {
        mapConnectorError(err);
      }
    },
  );

  router.patch(
    "/companies/:companyId/connectors/:id",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertBoard(req);
      const actorUserId = req.actor.userId!;
      const body = (req.body ?? {}) as Parameters<typeof svc.updateConnector>[3];
      const updated = await svc.updateConnector(id, companyId, actorUserId, body);
      res.json(updated);
    },
  );

  router.delete(
    "/companies/:companyId/connectors/:id",
    requirePermission(db, PERMISSIONS.CONNECTORS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertBoard(req);
      const actorUserId = req.actor.userId!;
      await svc.deleteConnector(id, companyId, actorUserId);
      res.status(204).end();
    },
  );

  router.get(
    "/companies/:companyId/connectors/:id/audit",
    requirePermission(db, PERMISSIONS.CONNECTORS_AUDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      const limit = Number(req.query.limit ?? 50);
      const audit = await svc.listConnectorAudit(companyId, {
        connectorId: id,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      res.json({ audit });
    },
  );

  // ── User self-service REST ─────────────────────────────────────────────────

  router.get(
    "/companies/:companyId/me/connected-accounts",
    requirePermission(db, PERMISSIONS.MCP_CONNECT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      const userId = req.actor.userId!;
      try {
        const list = await svc.listConnectorsWithStatusForUser(userId, companyId);
        res.json({ accounts: list });
      } catch (err) {
        mapConnectorError(err);
      }
    },
  );

  router.post(
    "/companies/:companyId/me/connect/:connectorId",
    requirePermission(db, PERMISSIONS.MCP_CONNECT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const connectorId = req.params.connectorId as string;
      assertBoard(req);
      const userId = req.actor.userId!;
      const redirectAfter =
        typeof req.body?.redirectAfter === "string" ? req.body.redirectAfter : undefined;
      try {
        const { authorizeUrl } = await svc.signAuthorizeUrl({
          userId,
          companyId,
          connectorId,
          redirectAfter,
        });
        res.json({ authorizeUrl });
      } catch (err) {
        mapConnectorError(err);
      }
    },
  );

  router.post(
    "/companies/:companyId/me/api-key/:connectorId",
    requirePermission(db, PERMISSIONS.MCP_CONNECT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const connectorId = req.params.connectorId as string;
      assertBoard(req);
      const userId = req.actor.userId!;
      const key = typeof req.body?.key === "string" ? req.body.key : null;
      if (!key) {
        throw badRequest("Missing 'key' in request body");
      }
      // H3 redaction: never log `key`. Keep this log statement free of body.
      logger.info(
        { companyId, connectorId, userId },
        "[connectors] user setting api_key (key redacted)",
      );
      try {
        await svc.setUserApiKey({ userId, connectorId, companyId, key });
        res.status(204).end();
      } catch (err) {
        if (err instanceof ConnectorError) {
          mapConnectorError(err);
        }
        throw err;
      }
    },
  );

  router.delete(
    "/companies/:companyId/me/connected-accounts/:connectorId",
    requirePermission(db, PERMISSIONS.MCP_CONNECT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const connectorId = req.params.connectorId as string;
      assertBoard(req);
      const userId = req.actor.userId!;
      try {
        await svc.disconnectUser({ userId, connectorId, companyId });
        res.status(204).end();
      } catch (err) {
        mapConnectorError(err);
      }
    },
  );

  return router;
}
