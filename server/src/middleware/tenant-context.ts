import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Middleware that sets the PostgreSQL RLS tenant context.
 * Resolves companyId from req.params.companyId or req.actor.companyId/companyIds[0].
 * If no companyId resolved, RLS filters out ALL tenant rows (fail-closed).
 */
export function tenantContextMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const companyId = resolveCompanyId(req);
      if (companyId) {
        if (!isValidUuid(companyId)) {
          logger.warn({ companyId, method: req.method, url: req.originalUrl }, "Invalid companyId format for RLS context");
          next();
          return;
        }
        await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
        logger.debug({ companyId, method: req.method, url: req.originalUrl }, "RLS tenant context set");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Sets the RLS tenant context for non-HTTP flows (background jobs, WebSocket).
 */
export async function setTenantContext(db: Db, companyId: string): Promise<void> {
  if (!isValidUuid(companyId)) {
    throw new Error(`Invalid companyId for RLS context: ${companyId}`);
  }
  await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
}

/**
 * Clears the RLS tenant context.
 */
export async function clearTenantContext(db: Db): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_company_id', '', true)`);
}

function resolveCompanyId(req: Request): string | undefined {
  // Priority 1: explicit route parameter
  const paramCompanyId = req.params.companyId as string | undefined;
  if (paramCompanyId) return paramCompanyId;
  // Priority 2: agent actor
  if (req.actor?.type === "agent" && req.actor?.companyId) return req.actor.companyId;
  // Priority 3: board user — first companyId
  if (req.actor?.type === "board" && req.actor?.companyIds?.length) return req.actor.companyIds[0];
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
