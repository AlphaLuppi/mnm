/**
 * COMP-S01: Compaction Watcher API Routes
 * COMP-S02: Kill+Relaunch routes added
 *
 * 7 routes for managing the CompactionWatcher:
 * - POST /companies/:companyId/compaction/start — start watching
 * - POST /companies/:companyId/compaction/stop — stop watching
 * - GET  /companies/:companyId/compaction/status — get watcher status
 * - GET  /companies/:companyId/compaction/snapshots — list snapshots
 * - GET  /companies/:companyId/compaction/snapshots/:snapshotId — get snapshot
 * - POST /companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch — kill and relaunch (COMP-S02)
 * - GET  /companies/:companyId/compaction/relaunch-history — list relaunch history (COMP-S02)
 */

import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  startCompactionWatcherSchema,
  compactionSnapshotFiltersSchema,
  killRelaunchSchema,
  relaunchHistoryFiltersSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { compactionWatcherService } from "../services/compaction-watcher.js";
import { compactionKillRelaunchService } from "../services/compaction-kill-relaunch.js";
import { emitAudit, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function compactionRoutes(db: Db) {
  const router = Router();
  const watcher = compactionWatcherService(db);
  const killRelaunch = compactionKillRelaunchService(db);

  // ──────────────────────────────────────────────────────────
  // comp-s01-route-start
  // POST /companies/:companyId/compaction/start
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/compaction/start",
    requirePermission(db, "workflows:enforce"),
    validate(startCompactionWatcherSchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const status = await watcher.startWatching(
        companyId as string,
        req.body,
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "compaction.watching_started",
        entityType: "company",
        entityId: companyId as string,
        details: { config: req.body },
      });

      await emitAudit({
        req, db, companyId: companyId as string,
        action: "compaction.watching_started",
        targetType: "company",
        targetId: companyId as string,
        metadata: { config: req.body },
      });

      res.json(status);
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s01-route-stop
  // POST /companies/:companyId/compaction/stop
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/compaction/stop",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      await watcher.stopWatching(companyId as string);

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "compaction.watching_stopped",
        entityType: "company",
        entityId: companyId as string,
        details: {},
      });

      await emitAudit({
        req, db, companyId: companyId as string,
        action: "compaction.watching_stopped",
        targetType: "company",
        targetId: companyId as string,
        metadata: {},
      });

      res.json({ stopped: true });
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s01-route-status
  // GET /companies/:companyId/compaction/status
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/compaction/status",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const status = await watcher.getWatcherStatus(companyId as string);
      res.json(status);
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s01-route-snapshots
  // GET /companies/:companyId/compaction/snapshots
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/compaction/snapshots",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const filters = compactionSnapshotFiltersSchema.parse(req.query);
      const snapshots = await watcher.getSnapshots(
        companyId as string,
        filters,
      );

      res.json(snapshots);
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s01-route-snapshot-by-id
  // GET /companies/:companyId/compaction/snapshots/:snapshotId
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/compaction/snapshots/:snapshotId",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId, snapshotId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const snapshot = await watcher.getSnapshotById(
        companyId as string,
        snapshotId as string,
      );

      if (!snapshot) {
        throw notFound("Compaction snapshot not found");
      }

      res.json(snapshot);
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s02-route-kill-relaunch
  // POST /companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch",
    requirePermission(db, "workflows:enforce"),
    validate(killRelaunchSchema),
    async (req, res) => {
      const { companyId, snapshotId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const result = await killRelaunch.executeKillRelaunch(
        companyId as string,
        snapshotId as string,
        actor.actorId,
        req.body,
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "compaction.kill_relaunch",
        entityType: "compaction_snapshot",
        entityId: snapshotId as string,
        details: { result },
      });

      await emitAudit({
        req, db, companyId: companyId as string,
        action: "compaction.kill_relaunch_requested",
        targetType: "compaction_snapshot",
        targetId: snapshotId as string,
        metadata: { result },
      });

      res.json(result);
    },
  );

  // ──────────────────────────────────────────────────────────
  // comp-s02-route-relaunch-history
  // GET /companies/:companyId/compaction/relaunch-history
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/compaction/relaunch-history",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const filters = relaunchHistoryFiltersSchema.parse(req.query);
      const history = await killRelaunch.getRelaunchHistory(
        companyId as string,
        filters,
      );

      res.json(history);
    },
  );

  return router;
}
