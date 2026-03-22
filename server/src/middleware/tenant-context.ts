import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { companies } from "@mnm/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

// Single-tenant cache: resolved once, reused forever
let singleTenantCompanyId: string | null = null;

/**
 * Resolves the single company ID for single-tenant deployments.
 * Cached after first call — only queries DB once.
 */
async function getSingleTenantCompanyId(db: Db): Promise<string | null> {
  if (singleTenantCompanyId) return singleTenantCompanyId;
  const rows = await db.select({ id: companies.id }).from(companies).limit(2);
  if (rows.length === 1) {
    singleTenantCompanyId = rows[0].id;
    logger.info({ companyId: singleTenantCompanyId }, "Single-tenant mode: auto-resolved companyId");
    return singleTenantCompanyId;
  }
  return null; // multi-tenant or no company yet
}

/**
 * Middleware that sets the PostgreSQL RLS tenant context.
 * Resolves companyId from (in order):
 *   1. req.params.companyId (explicit route parameter)
 *   2. req.actor.companyId (agent auth)
 *   3. req.actor.companyIds[0] (board user)
 *   4. Single company in DB (single-tenant auto-inject)
 * If no companyId resolved, RLS filters out ALL tenant rows (fail-closed).
 */
export function tenantContextMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      let companyId = resolveCompanyId(req);

      // Single-tenant fallback: if no companyId from request, auto-inject the only company
      if (!companyId) {
        companyId = await getSingleTenantCompanyId(db) ?? undefined;
      }

      if (companyId) {
        if (!isValidUuid(companyId)) {
          logger.warn({ companyId, method: req.method, url: req.originalUrl }, "Invalid companyId format for RLS context");
          next();
          return;
        }
        await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);

        // Inject companyId into req.params so routes without :companyId can still access it
        if (!req.params.companyId) {
          req.params.companyId = companyId;
        }
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

/**
 * Returns the cached single-tenant company ID, or null.
 * Useful for background jobs that need the companyId without a request.
 */
export function getCachedCompanyId(): string | null {
  return singleTenantCompanyId;
}

/**
 * Resets the single-tenant cache (for testing).
 */
export function resetTenantCache(): void {
  singleTenantCompanyId = null;
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
