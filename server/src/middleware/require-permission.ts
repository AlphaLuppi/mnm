import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import type { PermissionKey, ResourceScope } from "@mnm/shared";
import { accessService } from "../services/access.js";
import { forbidden, unauthorized } from "../errors.js";
import { logger } from "./logger.js";

export type ScopeExtractor = (req: Request) => ResourceScope | undefined;

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
            event: "access.scope_denied",
            permissionKey,
            companyId,
            actorType: "board",
            userId,
            resourceScope: resourceScope ?? null,
          }, `Permission denied: ${permissionKey} for user ${userId ?? "unknown"}`);
          throw forbidden(`Missing permission: ${permissionKey}`);
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
            event: "access.scope_denied",
            permissionKey,
            companyId,
            actorType: "agent",
            agentId,
            resourceScope: resourceScope ?? null,
          }, `Permission denied: ${permissionKey} for agent ${agentId}`);
          throw forbidden(`Missing permission: ${permissionKey}`);
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
