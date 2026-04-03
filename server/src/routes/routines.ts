import { Router } from "express";
import express from "express";
import type { Db } from "@mnm/db";
import {
  createRoutineSchema,
  updateRoutineSchema,
  createRoutineTriggerSchema,
  updateRoutineTriggerSchema,
  runRoutineSchema,
} from "@mnm/shared";
import { routineService } from "../services/routines.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function routineRoutes(db: Db) {
  const router = Router();
  const svc = routineService(db);

  // ── List routines ────────────────────────────────────────────────────────
  router.get("/companies/:companyId/routines", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const items = await svc.list(companyId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  // ── Create routine ───────────────────────────────────────────────────────
  router.post("/companies/:companyId/routines", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const data = createRoutineSchema.parse(req.body);
      const actor = getActorInfo(req);
      const routine = await svc.create(companyId, data, {
        userId: actor.actorType === "user" ? actor.actorId : null,
        agentId: actor.agentId,
      });

      res.status(201).json(routine);
    } catch (err) {
      next(err);
    }
  });

  // ── Get routine by ID ────────────────────────────────────────────────────
  router.get("/companies/:companyId/routines/:id", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const routine = await svc.getById(companyId, req.params.id as string);
      if (!routine) {
        res.status(404).json({ error: "Routine not found" });
        return;
      }
      res.json(routine);
    } catch (err) {
      next(err);
    }
  });

  // ── Update routine ───────────────────────────────────────────────────────
  router.patch("/companies/:companyId/routines/:id", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const data = updateRoutineSchema.parse(req.body);
      const actor = getActorInfo(req);
      const updated = await svc.update(req.params.id as string, companyId, data, {
        userId: actor.actorType === "user" ? actor.actorId : null,
        agentId: actor.agentId,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ── Create trigger ───────────────────────────────────────────────────────
  router.post("/companies/:companyId/routines/:id/triggers", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const data = createRoutineTriggerSchema.parse(req.body);
      const actor = getActorInfo(req);
      const trigger = await svc.createTrigger(req.params.id as string, companyId, data, {
        userId: actor.actorType === "user" ? actor.actorId : null,
        agentId: actor.agentId,
      });

      res.status(201).json(trigger);
    } catch (err) {
      next(err);
    }
  });

  // ── Update trigger ───────────────────────────────────────────────────────
  router.patch("/companies/:companyId/routine-triggers/:id", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const data = updateRoutineTriggerSchema.parse(req.body);
      const updated = await svc.updateTrigger(req.params.id as string, companyId, data);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete trigger ───────────────────────────────────────────────────────
  router.delete("/companies/:companyId/routine-triggers/:id", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      await svc.deleteTrigger(req.params.id as string, companyId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Manual run ───────────────────────────────────────────────────────────
  router.post("/companies/:companyId/routines/:id/run", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const data = runRoutineSchema.parse(req.body);
      const actor = getActorInfo(req);
      const result = await svc.runRoutine(req.params.id as string, companyId, data, {
        userId: actor.actorType === "user" ? actor.actorId : null,
        agentId: actor.agentId,
      });

      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── List runs ────────────────────────────────────────────────────────────
  router.get("/companies/:companyId/routines/:id/runs", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const runs = await svc.listRuns(req.params.id as string, companyId, limit);
      res.json(runs);
    } catch (err) {
      next(err);
    }
  });

  // ── Webhook fire (no auth required) ──────────────────────────────────────
  // The signing/bearer check is handled internally by the service.
  // Single-tenant rewrite middleware adds /companies/:companyId/ prefix to all
  // incoming requests, so we define the route with that prefix.
  router.post(
    "/companies/:companyId/routine-triggers/public/:publicId/fire",
    express.text({ type: "*/*", limit: "1mb" }),
    async (req, res, next) => {
      try {
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        const result = await svc.verifyWebhookAndFire(
          req.params.publicId as string,
          {
            authorization: req.headers.authorization,
            "x-routine-signature": req.headers["x-routine-signature"] as string | undefined,
            "x-routine-timestamp": req.headers["x-routine-timestamp"] as string | undefined,
          },
          rawBody,
        );

        res.status(202).json({
          ok: true,
          runId: result.run.id,
          coalesced: result.coalesced,
          skipped: result.skipped,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
