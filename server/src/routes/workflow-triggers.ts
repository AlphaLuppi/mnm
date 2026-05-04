/**
 * Routes for unified workflow autonomous triggers (Phase 2).
 *
 * **Public fire endpoint** — `POST /companies/:companyId/workflow-triggers/public/:publicId/fire`
 *   No BetterAuth session. Auth is purely by signed payload (HMAC-SHA256
 *   or Bearer) + a mandatory `Idempotency-Key` header. The route uses
 *   `express.text` so the raw body is preserved verbatim for HMAC
 *   verification — switching to `express.json` would silently
 *   re-serialise and break signatures from upstream callers.
 *
 * **CRUD endpoints** — guarded by `WORKFLOWS_MANAGE_TRIGGERS` permission.
 *   Each endpoint takes the standard `companyId` path param + an
 *   `assertCompanyAccess` check (defence in depth: the permission middleware
 *   already gates by membership, but multi-tenant code should always
 *   double-check the path companyId matches the actor's scope).
 *
 * The Governed Workflows service is constructed once per route factory
 * (re-used across requests in this router instance). The
 * `resolveGitProvider` cache is process-lifetime, like the other governed
 * workflow routes.
 */
import { Router } from "express";
import express from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { workflowTriggersService } from "../services/workflow-triggers.js";
import { governedWorkflowService } from "../services/governed-workflows.js";
import { createResolveGitProvider } from "../mcp/build-mcp-services.js";
import { ShaCache } from "@mnm/git-provider";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest, unauthorized } from "../errors.js";

const FIRE_BODY_LIMIT = "1mb";

export function workflowTriggersRoutes(db: Db) {
  const router = Router();
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  const governed = governedWorkflowService(db, { resolveGitProvider, shaCache });
  const svc = workflowTriggersService(db, { governed });

  // ── Public fire (no session, signed payload) ─────────────────────────────
  // express.text preserves the raw body, which is required for the HMAC
  // verification (any pretty-print round-trip would invalidate the digest).
  router.post(
    "/companies/:companyId/workflow-triggers/public/:publicId/fire",
    express.text({ type: "*/*", limit: FIRE_BODY_LIMIT }),
    async (req, res, next) => {
      try {
        const idempotencyKey = req.headers["idempotency-key"];
        if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
          throw badRequest("Idempotency-Key header is required");
        }

        const rawBody = typeof req.body === "string" ? req.body : "";

        const result = await svc.verifyAndFire({
          publicId: req.params.publicId as string,
          headers: {
            authorization: req.headers.authorization,
            "x-trigger-signature": req.headers["x-trigger-signature"] as string | undefined,
            "x-trigger-timestamp": req.headers["x-trigger-timestamp"] as string | undefined,
          },
          rawBody,
          idempotencyKey,
        });

        // 200 for replays (idempotent re-delivery), 202 for fresh fires
        // (downstream dispatch is async-ish but we awaited it; 202
        // signals "accepted, processing kicked off" and matches the
        // routine webhook contract).
        const status = result.outcome === "replayed" ? 200 : 202;
        res.status(status).json({
          ok: true,
          outcome: result.outcome,
          runId: result.runId,
          stepExecutionId: result.stepExecutionId,
          auditId: result.audit.id,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── List triggers ────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-triggers",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const filter: { workflowDefRef?: string; kind?: "schedule" | "webhook" | "issue" } = {};
        if (typeof req.query.workflowDefRef === "string") {
          filter.workflowDefRef = req.query.workflowDefRef;
        }
        if (
          req.query.kind === "schedule"
          || req.query.kind === "webhook"
          || req.query.kind === "issue"
        ) {
          filter.kind = req.query.kind;
        }

        const items = await svc.list(companyId, filter);
        // Strip the encrypted secret_hash before returning — it's never
        // useful to the client and shouldn't leave the server boundary.
        res.json(
          items.map((row) => {
            const { secretHash: _omit, ...rest } = row;
            return rest;
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Get a single trigger ─────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/workflow-triggers/:id",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const row = await svc.getById(req.params.id as string, companyId);
        const { secretHash: _omit, ...rest } = row;
        res.json(rest);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Create a trigger ─────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/workflow-triggers",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const actor = getActorInfo(req);
        if (actor.actorType !== "user") {
          throw unauthorized();
        }
        const createdByUserId = actor.actorId;

        const result = await svc.create(companyId, req.body, createdByUserId);
        // Strip secret_hash; the plaintext `secret` (when present) is
        // surfaced ONLY on this initial response so the caller can copy
        // it. Subsequent reads will not include it.
        const { secretHash: _omit, secret, ...rest } = result as typeof result & {
          secret?: string;
        };
        res.status(201).json(secret ? { ...rest, secret } : rest);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Update a trigger ─────────────────────────────────────────────────────
  router.patch(
    "/companies/:companyId/workflow-triggers/:id",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const updated = await svc.update(req.params.id as string, companyId, req.body);
        const { secretHash: _omit, ...rest } = updated;
        res.json(rest);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Delete a trigger ─────────────────────────────────────────────────────
  router.delete(
    "/companies/:companyId/workflow-triggers/:id",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        await svc.delete(req.params.id as string, companyId);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Rotate webhook secret ────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/workflow-triggers/:id/rotate-secret",
    requirePermission(db, PERMISSIONS.WORKFLOWS_MANAGE_TRIGGERS),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const result = await svc.rotateSecret(req.params.id as string, companyId);
        const { secretHash: _omit, ...rest } = result.trigger;
        // The plaintext secret is shown ONLY here, then never again.
        res.json({ ...rest, secret: result.secret });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
