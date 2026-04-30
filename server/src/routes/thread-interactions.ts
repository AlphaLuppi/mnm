/**
 * PAPERCLIP-PHASE2 — Inbox Interactive REST routes.
 *
 * All routes are mounted under `/companies/:companyId/issues/:issueId/...`
 * which means `assertCompanyMembership` + `tenantContextMiddleware` +
 * `tagScopeMiddleware` have already run before we touch the service.
 *
 * Routes:
 *   POST   /companies/:companyId/issues/:issueId/interactions
 *   GET    /companies/:companyId/issues/:issueId/interactions
 *   GET    /companies/:companyId/issues/:issueId/interactions/:interactionId
 *   POST   /companies/:companyId/issues/:issueId/interactions/:interactionId/accept
 *   POST   /companies/:companyId/issues/:issueId/interactions/:interactionId/reject
 *   POST   /companies/:companyId/issues/:issueId/interactions/:interactionId/respond
 *
 * Permission slugs (created in this commit):
 *   - thread_interactions:read   — list/get
 *   - thread_interactions:create — POST  (typically agents)
 *   - thread_interactions:resolve — accept/reject/respond (typically users/board)
 */
import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { issueService, threadInteractionsService } from "../services/index.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function threadInteractionRoutes(db: Db) {
  const router = Router();
  const svc = threadInteractionsService(db);
  const issuesSvc = issueService(db);

  function actorPair(req: Parameters<Router["get"]>[1] extends (req: infer R, ...args: any[]) => any ? R : never) {
    const a = getActorInfo(req as any);
    return {
      agentId: a.actorType === "agent" ? a.agentId : null,
      userId: a.actorType === "user" ? a.actorId : null,
    };
  }

  // POST: create a structured interaction
  router.post(
    "/companies/:companyId/issues/:issueId/interactions",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_CREATE),
    async (req, res) => {
      const { companyId, issueId } = req.params as { companyId: string; issueId: string };
      assertCompanyAccess(req, companyId);
      // Verify the issue exists & belongs to this tenant (RLS protects too).
      const issue = await issuesSvc.getById(issueId);
      if (!issue || issue.companyId !== companyId) throw notFound("Issue not found");

      const a = getActorInfo(req);
      const actor = {
        agentId: a.actorType === "agent" ? a.agentId : null,
        userId: a.actorType === "user" ? a.actorId : null,
      };
      const created = await svc.create(companyId, issueId, req.body, actor);
      res.status(201).json(created);
    },
  );

  // GET: list interactions on an issue (optional ?status=pending filter)
  router.get(
    "/companies/:companyId/issues/:issueId/interactions",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_READ),
    async (req, res) => {
      const { companyId, issueId } = req.params as { companyId: string; issueId: string };
      assertCompanyAccess(req, companyId);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const list = await svc.listByIssue(companyId, issueId, { status });
      res.json({ items: list, total: list.length });
    },
  );

  // GET: single interaction
  router.get(
    "/companies/:companyId/issues/:issueId/interactions/:interactionId",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_READ),
    async (req, res) => {
      const { companyId, interactionId } = req.params as {
        companyId: string;
        interactionId: string;
      };
      assertCompanyAccess(req, companyId);
      const row = await svc.getById(companyId, interactionId);
      if (!row) throw notFound("Thread interaction not found");
      res.json(row);
    },
  );

  // POST: accept (suggest_tasks → optionally with selectedClientKeys / request_confirmation)
  router.post(
    "/companies/:companyId/issues/:issueId/interactions/:interactionId/accept",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_RESOLVE),
    async (req, res) => {
      const { companyId, interactionId } = req.params as {
        companyId: string;
        interactionId: string;
      };
      assertCompanyAccess(req, companyId);
      const a = getActorInfo(req);
      const actor = {
        agentId: a.actorType === "agent" ? a.agentId : null,
        userId: a.actorType === "user" ? a.actorId : null,
      };
      const { interaction, selectedClientKeys } = await svc.accept(
        companyId,
        interactionId,
        req.body,
        actor,
      );

      // For suggest_tasks: actually create the issues, then record their IDs
      // back on the interaction's result.createdTasks.
      if (interaction.kind === "suggest_tasks" && selectedClientKeys && selectedClientKeys.length > 0) {
        const taskByKey = new Map(
          interaction.payload.tasks.map((t) => [t.clientKey, t] as const),
        );
        const createdTasks: Array<{
          clientKey: string;
          issueId: string;
          identifier: string | null;
        }> = [];
        // TODO(thread-interactions): topological sort by parentClientKey so
        // children are created after parents — for MVP we ignore the
        // hierarchy and create everything at the same level. The upstream
        // PR has a buildTaskCreationOrder() helper we can port if/when
        // multi-level suggested-task trees become a real use case.
        for (const key of selectedClientKeys) {
          const t = taskByKey.get(key);
          if (!t) continue;
          const created = await issuesSvc.create(companyId, {
            title: t.title,
            description: t.description ?? null,
            priority: t.priority ?? "medium",
            status: "backlog",
            assigneeAgentId: t.assigneeAgentId ?? null,
            parentId: interaction.issueId,
            createdByAgentId: actor.agentId ?? null,
            createdByUserId: actor.userId ?? null,
          } as any);
          createdTasks.push({
            clientKey: key,
            issueId: created.id,
            identifier: created.identifier ?? null,
          });
        }
        const finalInteraction = await svc.recordCreatedTasks(
          companyId,
          interactionId,
          createdTasks,
        );
        return res.status(200).json(finalInteraction);
      }
      res.status(200).json(interaction);
    },
  );

  // POST: reject
  router.post(
    "/companies/:companyId/issues/:issueId/interactions/:interactionId/reject",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_RESOLVE),
    async (req, res) => {
      const { companyId, interactionId } = req.params as {
        companyId: string;
        interactionId: string;
      };
      assertCompanyAccess(req, companyId);
      const a = getActorInfo(req);
      const actor = {
        agentId: a.actorType === "agent" ? a.agentId : null,
        userId: a.actorType === "user" ? a.actorId : null,
      };
      const interaction = await svc.reject(companyId, interactionId, req.body, actor);
      res.json(interaction);
    },
  );

  // POST: respond (ask_questions → answers)
  router.post(
    "/companies/:companyId/issues/:issueId/interactions/:interactionId/respond",
    requirePermission(db, PERMISSIONS.THREAD_INTERACTIONS_RESOLVE),
    async (req, res) => {
      const { companyId, interactionId } = req.params as {
        companyId: string;
        interactionId: string;
      };
      assertCompanyAccess(req, companyId);
      const a = getActorInfo(req);
      const actor = {
        agentId: a.actorType === "agent" ? a.agentId : null,
        userId: a.actorType === "user" ? a.actorId : null,
      };
      const interaction = await svc.respond(companyId, interactionId, req.body, actor);
      res.json(interaction);
    },
  );

  return router;
}
