/**
 * PROJ-S03: Scope Filter Service
 *
 * Determines the allowed project IDs for the current user based on their
 * permission grants and project memberships. Used by route handlers to
 * filter list queries and deny single-entity access when out of scope.
 *
 * Returns null for global access (no filtering needed).
 * Returns string[] for scoped users (filter to these project IDs).
 */

import type { Request } from "express";
import type { Db } from "@mnm/db";
import { projectMembershipService } from "./project-memberships.js";
import { accessService } from "./access.js";

/**
 * Determines the allowed project IDs for the current user.
 * Returns null if the user has global access (no scope restriction).
 * Returns string[] if the user is scoped to specific projects.
 */
export async function getScopeProjectIds(
  db: Db,
  companyId: string,
  req: Request,
): Promise<string[] | null> {
  // Agent API keys bypass scope filtering
  if (req.actor.type === "agent") return null;

  // Board user
  if (req.actor.type === "board") {
    // Instance admin or local implicit = global access
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
      return null;
    }

    const userId = req.actor.userId;
    if (!userId) return null;

    // Check if user has any grant with scope: null (global access)
    const access = accessService(db);
    const hasGlobal = await access.hasGlobalScope(companyId, userId);
    if (hasGlobal) return null;

    // User is scoped -- get their project IDs
    const pmSvc = projectMembershipService(db);
    const projectIds = await pmSvc.getUserProjectIds(companyId, userId);
    return projectIds;
  }

  // Unknown actor type = no filtering (defensive)
  return null;
}
