import { Router } from "express";
import type { Db } from "@mnm/db";
import { count, sql } from "drizzle-orm";
import { instanceUserRoles, companies } from "@mnm/db";
import type { DeploymentExposure, DeploymentMode } from "@mnm/shared";
import type { RedisState } from "../redis.js";
import { pingRedis } from "../redis.js";

export function healthRoutes(
  db?: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    authReady: boolean;
    companyDeletionEnabled: boolean;
    redisState?: RedisState | null;
  } = {
    deploymentMode: "local_trusted",
    deploymentExposure: "private",
    authReady: true,
    companyDeletionEnabled: true,
  },
) {
  const router = Router();

  router.get("/", async (_req, res) => {
    if (!db) {
      res.json({ status: "ok" });
      return;
    }

    let dbConnected = true;
    let dbLatencyMs: number | undefined;
    let pgVersion: string | undefined;
    let dbError: string | undefined;

    try {
      const start = performance.now();
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Math.round((performance.now() - start) * 100) / 100;

      const versionResult = await db.execute(sql`SHOW server_version`);
      const row = versionResult[0] as Record<string, unknown> | undefined;
      pgVersion = (row?.server_version as string) ?? undefined;
    } catch (err) {
      dbConnected = false;
      dbError = err instanceof Error ? err.message : String(err);
    }

    // Redis health (optional — does not affect overall status)
    const redisConfigured = !!opts.redisState?.client;
    let redisConnected = false;
    let redisLatencyMs: number | undefined;
    if (opts.redisState) {
      redisConnected = opts.redisState.connected;
      const ping = await pingRedis(opts.redisState);
      if (ping) {
        redisLatencyMs = ping.latencyMs;
      }
    }
    const redisInfo = {
      configured: redisConfigured,
      connected: redisConnected,
      ...(redisLatencyMs !== undefined ? { latencyMs: redisLatencyMs } : {}),
    };

    if (!dbConnected) {
      res.status(503).json({
        status: "degraded",
        db: { connected: false, error: dbError },
        redis: redisInfo,
        deploymentMode: opts.deploymentMode,
        deploymentExposure: opts.deploymentExposure,
      });
      return;
    }

    let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
    if (opts.deploymentMode === "authenticated") {
      const roleCount = await db
        .select({ count: count() })
        .from(instanceUserRoles)
        .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
        .then((rows) => Number(rows[0]?.count ?? 0));
      bootstrapStatus = roleCount > 0 ? "ready" : "bootstrap_pending";
    }

    // RLS status: count tables with row-level security enabled
    let rlsTablesProtected = 0;
    try {
      const rlsResult = await db.execute(sql`
        SELECT count(*) as count FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = true
      `);
      const rlsRow = rlsResult[0] as Record<string, unknown> | undefined;
      rlsTablesProtected = Number(rlsRow?.count ?? 0);
    } catch {
      // pg_tables query may fail on non-PG backends; ignore
    }

    // Check if any company exists (used by frontend to block onboarding for non-admins)
    let hasCompany = false;
    try {
      const companyCount = await db
        .select({ count: count() })
        .from(companies)
        .then((rows) => Number(rows[0]?.count ?? 0));
      hasCompany = companyCount > 0;
    } catch {
      // ignore
    }

    res.json({
      status: "ok",
      db: {
        connected: true,
        latencyMs: dbLatencyMs,
        version: pgVersion,
      },
      rls: {
        tablesProtected: rlsTablesProtected,
      },
      redis: redisInfo,
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      bootstrapStatus,
      hasCompany,
      features: {
        companyDeletionEnabled: opts.companyDeletionEnabled,
      },
    });
  });

  return router;
}
