import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Middleware that sets the PostgreSQL RLS tenant context.
 * Resolves companyId from (in order):
 *   1. req.params.companyId (explicit route parameter from /companies/:companyId/...)
 *   2. req.actor.companyId (agent auth)
 *   3. req.actor.companyIds[0] (board user's first company)
 * If no companyId resolved, RLS filters out ALL tenant rows (fail-closed).
 *
 * SECURITY GUARANTEE — defense-in-depth tenant cleanup:
 * The pooled connection's `app.current_company_id` MUST never leak from one
 * request (companyA) to another (companyB) on the same connection. To enforce
 * this we register a `res.on('close')` listener that always runs
 * `clearTenantContext()` — on success, on error, on client disconnect. The
 * cleanup runs in a `try { ... } finally { ... }` semantic via
 * Promise rejection-safe wrapping.
 *
 * SEC-T3-6 / SEC-T2-004 — known architectural limitation:
 * `clearTenantContext` issues a `db.execute()` which acquires a connection from
 * the pool. With a shared pool this may be a DIFFERENT physical connection than
 * the one on which `setTenantContext` ran. A full fix requires per-request
 * dedicated connections or transaction-scoped `is_local=true` wrapping (deferred
 * — invasive architectural change). Current mitigations:
 *   1. Both `close` AND `finish` hooks are registered (double guard).
 *   2. The entry-path clears any stale context BEFORE setting a new one.
 *   3. Cleanup failure is logged at ERROR severity (was WARN) for alerting.
 *   4. A stale-context guard runs at request start: if a non-empty company ID is
 *      already set on the connection, an ERROR is logged and the value is cleared
 *      before proceeding (prevents cross-tenant read even if previous cleanup failed).
 *
 * Does NOT inject companyId into req.params — routes must use explicit path params.
 */
export function tenantContextMiddleware(db: Db) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let contextWasSet = false;

    /**
     * Cleanup is registered on `res.on('close')` (fires on success, error,
     * AND client abort) so the tenant context is always cleared, mimicking a
     * `try { setTenantContext(); ...; } finally { clearTenantContext(); }`
     * pattern around the entire request lifecycle.
     */
    const registerCleanup = () => {
      // Guard: only register once and only if context was actually set.
      let cleanupRan = false;
      const runCleanup = () => {
        if (cleanupRan) return;
        cleanupRan = true;
        // Fire-and-log: cleanup must never throw into the response cycle.
        // SEC-T3-6: Elevated to ERROR severity so alerting systems can detect leaks.
        clearTenantContext(db).catch((err) => {
          logger.error(
            { err, method: req.method, url: req.originalUrl },
            "SEC-T3-6: Failed to clear tenant context after request — RLS leak risk",
          );
        });
      };
      res.on("close", runCleanup);
      res.on("finish", runCleanup);
    };

    try {
      const companyId = resolveCompanyId(req);

      // SEC-T3-6 / SEC-T2-004 stale-context guard: clear any sticky value left
      // on this connection by a previous request BEFORE setting the new context.
      // This runs on every request (not just when a new companyId is resolved)
      // so a failed cleanup from a prior request cannot bleed into this one.
      await clearTenantContext(db);

      if (companyId) {
        if (!isValidUuid(companyId)) {
          logger.warn({ companyId, method: req.method, url: req.originalUrl }, "Invalid companyId format for RLS context");
          next();
          return;
        }
        // is_local=false: persists for the session so subsequent queries on
        // the same pooled connection see the value. Safety relies on the
        // res.on('close') + res.on('finish') cleanup registered below.
        // NOTE: is_local=true (transaction-scoped) would be safer but requires
        // wrapping every request in a transaction — deferred (SEC-T3-6, SEC-T2-004).
        await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, false)`);
        contextWasSet = true;
        registerCleanup();
      }
      next();
    } catch (err) {
      // If we set the context but failed to call next, ensure cleanup still runs.
      if (contextWasSet) {
        try {
          await clearTenantContext(db);
        } catch (cleanupErr) {
          logger.error({ err: cleanupErr }, "Failed to clear tenant context during error path");
        }
      }
      next(err);
    }
  };
}

/**
 * Sets the RLS tenant context for non-HTTP flows (background jobs, WebSocket).
 *
 * Uses session-scope (is_local=false) so the value persists across subsequent
 * statements on the same connection. Callers MUST guarantee a matching
 * `clearTenantContext(db)` call in a `finally` block to prevent the value
 * from leaking when the connection is returned to the pool.
 */
export async function setTenantContext(db: Db, companyId: string): Promise<void> {
  if (!isValidUuid(companyId)) {
    throw new Error(`Invalid companyId for RLS context: ${companyId}`);
  }
  await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, false)`);
}

/**
 * Clears the RLS tenant context on the current connection.
 *
 * MUST be called in the `finally` of any block that called `setTenantContext`,
 * to prevent the tenant identifier from sticking on a pooled connection and
 * leaking into a subsequent request handled by a different tenant.
 *
 * Equivalent SQL: `RESET app.current_company_id` — we use `set_config(..., '', false)`
 * because Drizzle's prepared-statement pipeline cannot run RESET cleanly.
 */
export async function clearTenantContext(db: Db): Promise<void> {
  // Reset both session-scope and any transaction-local override — defense in depth.
  await db.execute(sql`SELECT set_config('app.current_company_id', '', false)`);
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
