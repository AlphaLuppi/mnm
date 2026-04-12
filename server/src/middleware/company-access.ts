import type { Request, Response, NextFunction } from "express";
import { badRequest, forbidden, unauthorized } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Express middleware that verifies the current actor belongs to the company
 * identified by `req.params.companyId`.
 *
 * Mount on `/companies/:companyId` so Express extracts the param before this runs.
 *
 * - Board (local_implicit / instanceAdmin): bypass
 * - Board (authenticated): must have companyId in actor.companyIds
 * - Agent: actor.companyId must match path companyId
 * - None: 401
 * - Unknown actor type: fail-closed (403)
 */
export function assertCompanyMembership() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      next();
      return;
    }

    // Validate UUID format early — reject malformed path segments
    if (!UUID_RE.test(companyId)) {
      next(badRequest("Invalid companyId format"));
      return;
    }

    if (req.actor.type === "none") {
      next(unauthorized());
      return;
    }

    if (req.actor.type === "board") {
      // Dev mode — single-tenant trusted, skip check
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
        next();
        return;
      }
      const allowedCompanies = req.actor.companyIds ?? [];
      if (!allowedCompanies.includes(companyId)) {
        next(forbidden("Not a member of this company"));
        return;
      }
      next();
      return;
    }

    if (req.actor.type === "agent") {
      if (req.actor.companyId !== companyId) {
        next(forbidden("Agent does not belong to this company"));
        return;
      }
      next();
      return;
    }

    // Fail-closed: unknown actor type
    next(forbidden("Access denied"));
  };
}
