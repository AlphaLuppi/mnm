import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import type { ResourceScope } from "@mnm/shared";
import { accessService } from "../services/access.js";
import { auditService } from "../services/audit.js";
import { forbidden, unauthorized } from "../errors.js";
import { logger } from "./logger.js";

/**
 * Fire-and-forget audit emission for access.denied events.
 * Errors are silently caught — audit must never block the 403 flow.
 */
function emitAccessDenied(
  db: Db,
  req: Request,
  companyId: string,
  permissionKey: string,
  actorId: string,
  actorType: "user" | "agent",
  resourceScope?: ResourceScope | null,
) {
  auditService(db).emit({
    companyId,
    actorId,
    actorType,
    action: "access.denied",
    targetType: "permission",
    targetId: permissionKey,
    metadata: {
      route: `${req.method} ${req.originalUrl}`,
      resourceScope: resourceScope ?? null,
    },
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.get("user-agent") ?? null,
    severity: "warning",
  }).catch(() => { /* audit must never block */ });
}

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
  permissionKey: string,
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
          const deniedEvent = resourceScope ? "access.scope_denied" : "access.denied";
          logger.warn({
            event: deniedEvent,
            permissionKey,
            companyId,
            actorType: "board",
            userId,
            resourceScope: resourceScope ?? null,
            route: `${req.method} ${req.originalUrl}`,
          }, `Permission denied: ${permissionKey} for user ${userId ?? "unknown"}`);
          emitAccessDenied(db, req, companyId, permissionKey, userId ?? "unknown-user", "user", resourceScope);
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
        // Agents inherit permissions from their creator (the user whose sandbox they run in)
        // First try agent's own permissions, then fall back to creator's permissions
        let allowed = await access.hasPermission(companyId, "agent", agentId, permissionKey, resourceScope);
        if (!allowed && req.actor.creatorUserId) {
          allowed = await access.canUser(companyId, req.actor.creatorUserId, permissionKey, resourceScope);
        }
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
          emitAccessDenied(db, req, companyId, permissionKey, agentId, "agent", resourceScope);
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
  permissionKey: string,
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
      emitAccessDenied(db, req, companyId, permissionKey, userId ?? "unknown-user", "user", resourceScope);
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
    // Agents inherit permissions from their creator
    let allowed = await access.hasPermission(companyId, "agent", agentId, permissionKey, resourceScope);
    if (!allowed && req.actor.creatorUserId) {
      allowed = await access.canUser(companyId, req.actor.creatorUserId, permissionKey, resourceScope);
    }
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
      emitAccessDenied(db, req, companyId, permissionKey, agentId, "agent", resourceScope);
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
