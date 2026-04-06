import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { resolveActorTagContext } from "../services/tag-scope-resolver.js";
import { logger } from "./logger.js";

/**
 * TagScope — opaque type that controls tag-based data visibility.
 * Created ONLY by the tagScopeMiddleware — cannot be constructed manually.
 * Services MUST require a TagScope parameter for any filtered query.
 */
export interface TagScope {
  readonly __brand: "TagScope";
  readonly userId: string;
  readonly companyId: string;
  readonly tagIds: ReadonlySet<string>;
  readonly bypassTagFilter: boolean;
}

function createTagScope(
  userId: string,
  companyId: string,
  tagIds: Set<string>,
  bypassTagFilter: boolean,
): TagScope {
  return {
    __brand: "TagScope" as const,
    userId,
    companyId,
    tagIds,
    bypassTagFilter,
  };
}

// Extend Express Request to include tagScope
declare global {
  namespace Express {
    interface Request {
      tagScope?: TagScope;
    }
  }
}

/**
 * Middleware that resolves the current user's tag scope and injects it into req.tagScope.
 *
 * For board users: loads their tags from tag_assignments and their role's bypass_tag_filter flag.
 * For agent actors: agents don't get a TagScope (they access data through their own queries).
 * For local_implicit: bypass all tag filtering.
 *
 * This middleware runs AFTER auth and tenant-context, so req.actor and req.params.companyId are set.
 */
export function tagScopeMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const companyId = req.params.companyId as string | undefined;

      // No companyId = no tag scope (e.g., health check, auth routes)
      if (!companyId) {
        next();
        return;
      }

      // local_implicit (local_trusted mode) → bypass all tag filtering
      if (req.actor?.type === "board" && req.actor?.source === "local_implicit") {
        req.tagScope = createTagScope(
          req.actor.userId ?? "local",
          companyId,
          new Set(),
          true,
        );
        next();
        return;
      }

      // Board user → resolve role + tags via shared resolver
      if (req.actor?.type === "board" && req.actor?.userId) {
        const userId = req.actor.userId;
        const tagContext = await resolveActorTagContext(db, companyId, "user", userId, {
          isInstanceAdmin: req.actor.isInstanceAdmin,
        });
        req.tagScope = createTagScope(
          userId,
          companyId,
          tagContext.tagIds as Set<string>,
          tagContext.bypassTagFilter,
        );
        next();
        return;
      }

      // Agent actors don't get a TagScope — they use their own service queries
      // No-auth requests don't get a TagScope either
      next();
    } catch (err) {
      logger.error({ err }, "TagScope middleware error");
      next(err);
    }
  };
}

/**
 * Helper: get the TagScope from the request.
 * If tagScope was not set by middleware (e.g., companyId not resolved),
 * creates a restrictive fallback scope for board users (empty tags, no bypass = sees nothing except own items).
 * Throws for non-board actors (agents should not hit tag-filtered routes).
 */
export function requireTagScope(req: Request): TagScope {
  if (req.tagScope) {
    return req.tagScope;
  }

  // Fallback: board user without resolved tagScope → restrictive scope (sees nothing except owned items)
  if (req.actor?.type === "board" && req.actor?.userId) {
    const rawCompanyId = req.params.companyId;
    const companyId = (Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId) ?? "";
    logger.warn(
      { userId: req.actor.userId, companyId, url: req.originalUrl },
      "TagScope not set by middleware — creating restrictive fallback scope",
    );
    return createTagScope(req.actor.userId, companyId, new Set(), false);
  }

  throw new Error("TagScope required but not present — is tagScopeMiddleware active?");
}
