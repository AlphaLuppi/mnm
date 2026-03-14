import { Router } from "express";
import type { Db } from "@mnm/db";
import { count, sql } from "drizzle-orm";
import { instanceUserRoles } from "@mnm/db";
import type { DeploymentExposure, DeploymentMode } from "@mnm/shared";

export function healthRoutes(
  db?: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    authReady: boolean;
    companyDeletionEnabled: boolean;
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

    if (!dbConnected) {
      res.status(503).json({
        status: "degraded",
        db: { connected: false, error: dbError },
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

    res.json({
      status: "ok",
      db: {
        connected: true,
        latencyMs: dbLatencyMs,
        version: pgVersion,
      },
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      bootstrapStatus,
      features: {
        companyDeletionEnabled: opts.companyDeletionEnabled,
      },
    });
  });

  return router;
}
