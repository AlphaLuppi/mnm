import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { validate } from "../middleware/validate.js";
import { requireTagScope } from "../middleware/tag-scope.js";
import { activityService } from "../services/activity.js";
import { tagFilterService } from "../services/tag-filter.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { issueService } from "../services/index.js";
import { sanitizeRecord } from "../redaction.js";

const createActivitySchema = z.object({
  actorType: z.enum(["agent", "user", "system"]).optional().default("system"),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  agentId: z.string().uuid().optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
});

export function activityRoutes(db: Db) {
  const router = Router();
  const svc = activityService(db);
  const issueSvc = issueService(db);
  const tagFilter = tagFilterService(db);

  router.get("/companies/:companyId/activity", requirePermission(db, "audit:read"), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const tagScope = requireTagScope(req);

    const agentId = req.query.agentId as string | undefined;

    // Tag isolation: if filtering by agentId, verify it's visible
    if (agentId && !tagScope.bypassTagFilter) {
      const visible = await tagFilter.isAgentVisible(companyId, agentId, tagScope);
      if (!visible) {
        res.json([]);
        return;
      }
    }

    const filters = {
      companyId,
      agentId,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
    };
    let result = await svc.list(filters);

    // Tag isolation: filter activity to only visible agents
    if (!tagScope.bypassTagFilter && !agentId) {
      const visibleAgents = await tagFilter.listAgentsFiltered(companyId, tagScope);
      const visibleIds = new Set(visibleAgents.map((a) => a.id));
      result = result.filter((r: any) => !r.agentId || visibleIds.has(r.agentId));
    }

    res.json(result);
  });

  router.post("/companies/:companyId/activity", validate(createActivitySchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const event = await svc.create({
      companyId,
      ...req.body,
      details: req.body.details ? sanitizeRecord(req.body.details) : null,
    });
    res.status(201).json(event);
  });

  // Resolve issue identifiers (e.g. "PAP-39") to UUIDs
  router.param("id", async (req, res, next, rawId) => {
    try {
      if (/^[A-Z]+-\d+$/i.test(rawId)) {
        const issue = await issueSvc.getByIdentifier(rawId);
        if (issue) {
          req.params.id = issue.id;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  router.get("/issues/:id/activity", async (req, res) => {
    const id = req.params.id as string;
    const issue = await issueSvc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    // Tag isolation: verify user can see this issue
    const tagScope = requireTagScope(req);
    if (!tagScope.bypassTagFilter) {
      const visible = await tagFilter.isIssueVisible(issue.companyId, issue, tagScope);
      if (!visible) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }
    }

    const result = await svc.forIssue(id);
    res.json(result);
  });

  router.get("/issues/:id/runs", async (req, res) => {
    const id = req.params.id as string;
    const issue = await issueSvc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    // Tag isolation: verify user can see this issue
    const tagScope = requireTagScope(req);
    if (!tagScope.bypassTagFilter) {
      const visible = await tagFilter.isIssueVisible(issue.companyId, issue, tagScope);
      if (!visible) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }
    }

    const result = await svc.runsForIssue(issue.companyId, id);
    res.json(result);
  });

  router.get("/heartbeat-runs/:runId/issues", async (req, res) => {
    const runId = req.params.runId as string;
    const result = await svc.issuesForRun(runId);
    res.json(result);
  });

  return router;
}
