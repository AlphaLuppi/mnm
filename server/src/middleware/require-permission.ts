import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import type { PermissionKey, ResourceScope } from "@mnm/shared";
import { accessService } from "../services/access.js";
import { forbidden, unauthorized } from "../errors.js";
import { logger } from "./logger.js";

export type ScopeExtractor = (req: Request) => ResourceScope | undefined;

/**
 * Express middleware that checks if the current actor has the given permission
 * for the company identified by `req.params.companyId`.
 *
 * For routes where companyId is NOT in the path, use the inline helper
 * `assertCompanyPermission()` instead.
 */
export function requirePermission(
  db: Db,
  permissionKey: PermissionKey,
  extractScope?: ScopeExtractor,
) {
  const access = accessService(db);

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const companyId = req.params.companyId as string | undefined;
      if (!companyId) {
        throw forbidden(`Missing companyId parameter for permission check: ${permissionKey}`);
      }

      const resourceScope = extractScope ? extractScope(req) : undefined;

      // local_implicit (local_trusted mode) bypasses permission checks
      if (req.actor.type === "board" && req.actor.source === "local_implicit") {
        next();
        return;
      }

      if (req.actor.type === "none") {
        throw unauthorized();
      }

      if (req.actor.type === "board") {
        const userId = req.actor.userId;
        const allowed = await access.canUser(companyId, userId, permissionKey, resourceScope);
        if (!allowed) {
          logger.warn({
            event: "access.denied",
            permissionKey,
            companyId,
            actorType: "board",
            userId,
            resourceScope: resourceScope ?? null,
            route: `${req.method} ${req.originalUrl}`,
          }, `Permission denied: ${permissionKey} for user ${userId ?? "unknown"}`);
          throw forbidden(`Missing permission: ${permissionKey}`, {
            requiredPermission: permissionKey,
            companyId,
            resourceScope: resourceScope ?? null,
          });
        }
        next();
        return;
      }

      if (req.actor.type === "agent") {
        const agentId = req.actor.agentId;
        if (!agentId) {
          throw forbidden("Agent identity required");
        }
        const allowed = await access.hasPermission(
          companyId,
          "agent",
          agentId,
          permissionKey,
          resourceScope,
        );
        if (!allowed) {
          logger.warn({
            event: "access.denied",
            permissionKey,
            companyId,
            actorType: "agent",
            agentId,
            resourceScope: resourceScope ?? null,
            route: `${req.method} ${req.originalUrl}`,
          }, `Permission denied: ${permissionKey} for agent ${agentId}`);
          throw forbidden(`Missing permission: ${permissionKey}`, {
            requiredPermission: permissionKey,
            companyId,
            resourceScope: resourceScope ?? null,
          });
        }
        next();
        return;
      }

      // Fallback — unknown actor type
      throw unauthorized();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Inline permission check for routes where companyId is NOT in `req.params`.
 * This is the "Pattern B" from the RBAC-S04 spec: you look up the entity first,
 * extract its companyId, then call this helper.
 *
 * Throws a 403 HttpError with `details.requiredPermission` if the actor lacks the permission.
 * Bypasses for `local_implicit` actors.
 */
export async function assertCompanyPermission(
  db: Db,
  req: Request,
  companyId: string,
  permissionKey: PermissionKey,
  resourceScope?: ResourceScope,
) {
  // local_implicit (local_trusted mode) bypasses permission checks
  if (req.actor.type === "board" && req.actor.source === "local_implicit") {
    return;
  }

  if (req.actor.type === "none") {
    throw unauthorized();
  }

  const access = accessService(db);

  if (req.actor.type === "board") {
    const userId = req.actor.userId;
    if (req.actor.isInstanceAdmin) return;
    const allowed = await access.canUser(companyId, userId, permissionKey, resourceScope);
    if (!allowed) {
      logger.warn({
        event: "access.denied",
        permissionKey,
        companyId,
        actorType: "board",
        userId,
        resourceScope: resourceScope ?? null,
        route: `${req.method} ${req.originalUrl}`,
      }, `Permission denied: ${permissionKey} for user ${userId ?? "unknown"}`);
      throw forbidden(`Missing permission: ${permissionKey}`, {
        requiredPermission: permissionKey,
        companyId,
        resourceScope: resourceScope ?? null,
      });
    }
    return;
  }

  if (req.actor.type === "agent") {
    const agentId = req.actor.agentId;
    if (!agentId) {
      throw forbidden("Agent identity required");
    }
    const allowed = await access.hasPermission(
      companyId,
      "agent",
      agentId,
      permissionKey,
      resourceScope,
    );
    if (!allowed) {
      logger.warn({
        event: "access.denied",
        permissionKey,
        companyId,
        actorType: "agent",
        agentId,
        resourceScope: resourceScope ?? null,
        route: `${req.method} ${req.originalUrl}`,
      }, `Permission denied: ${permissionKey} for agent ${agentId}`);
      throw forbidden(`Missing permission: ${permissionKey}`, {
        requiredPermission: permissionKey,
        companyId,
        resourceScope: resourceScope ?? null,
      });
    }
    return;
  }

  throw unauthorized();
}
