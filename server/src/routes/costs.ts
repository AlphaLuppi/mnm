import { Router } from "express";
import type { Db } from "@mnm/db";
import { createCostEventSchema, updateBudgetSchema } from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requireTagScope } from "../middleware/tag-scope.js";
import { costService, companyService, agentService, emitAudit, logActivity } from "../services/index.js";
import { tagFilterService } from "../services/tag-filter.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function costRoutes(db: Db) {
  const router = Router();
  const costs = costService(db);
  const companies = companyService(db);
  const agents = agentService(db);
  const tagFilter = tagFilterService(db);

  router.post("/companies/:companyId/cost-events", requirePermission(db, "traces:write"), validate(createCostEventSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== req.body.agentId) {
      res.status(403).json({ error: "Agent can only report its own costs" });
      return;
    }

    const event = await costs.createEvent(companyId, {
      ...req.body,
      occurredAt: new Date(req.body.occurredAt),
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "cost.reported",
      entityType: "cost_event",
      entityId: event.id,
      details: { costCents: event.costCents, model: event.model },
    });

    res.status(201).json(event);
  });

  function parseDateRange(query: Record<string, unknown>) {
    const from = query.from ? new Date(query.from as string) : undefined;
    const to = query.to ? new Date(query.to as string) : undefined;
    return (from || to) ? { from, to } : undefined;
  }

  router.get("/companies/:companyId/costs/summary", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const tagScope = requireTagScope(req);
    const range = parseDateRange(req.query);

    // For non-admin users, compute summary only for visible agents
    if (!tagScope.bypassTagFilter) {
      const visibleAgents = await tagFilter.listAgentsFiltered(companyId, tagScope);
      const byAgentRows = await costs.byAgent(companyId, range);
      const visibleIds = new Set(visibleAgents.map((a) => a.id));
      const filtered = byAgentRows.filter((r: any) => r.agentId && visibleIds.has(r.agentId));
      const spendCents = filtered.reduce((sum: number, r: any) => sum + (r.costCents || 0), 0);
      res.json({ companyId, spendCents, budgetCents: 0, utilizationPercent: 0 });
      return;
    }

    const summary = await costs.summary(companyId, range);
    res.json(summary);
  });

  router.get("/companies/:companyId/costs/by-agent", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const tagScope = requireTagScope(req);
    const range = parseDateRange(req.query);
    let rows = await costs.byAgent(companyId, range);

    // Tag isolation: filter costs to only visible agents
    if (!tagScope.bypassTagFilter) {
      const visibleAgents = await tagFilter.listAgentsFiltered(companyId, tagScope);
      const visibleIds = new Set(visibleAgents.map((a) => a.id));
      rows = rows.filter((r: any) => r.agentId && visibleIds.has(r.agentId));
    }

    res.json(rows);
  });

  router.get("/companies/:companyId/costs/by-project", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const rows = await costs.byProject(companyId, range);
    res.json(rows);
  });

  router.patch("/companies/:companyId/budgets", validate(updateBudgetSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const company = await companies.update(companyId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.budget_updated",
      entityType: "company",
      entityId: companyId,
      details: { budgetMonthlyCents: req.body.budgetMonthlyCents },
    });

    await emitAudit({
      req, db, companyId,
      action: "cost.budget_updated",
      targetType: "company",
      targetId: companyId,
      metadata: { budgetField: "budgetMonthlyCents", newValue: req.body.budgetMonthlyCents },
    });

    res.json(company);
  });

  router.patch("/agents/:agentId/budgets", validate(updateBudgetSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    if (req.actor.type === "agent") {
      if (req.actor.agentId !== agentId) {
        res.status(403).json({ error: "Agent can only change its own budget" });
        return;
      }
    }

    const updated = await agents.update(agentId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent.budget_updated",
      entityType: "agent",
      entityId: updated.id,
      details: { budgetMonthlyCents: updated.budgetMonthlyCents },
    });

    await emitAudit({
      req, db, companyId: updated.companyId,
      action: "cost.agent_budget_updated",
      targetType: "agent",
      targetId: updated.id,
      metadata: { budgetField: "budgetMonthlyCents", newValue: updated.budgetMonthlyCents },
    });

    res.json(updated);
  });

  return router;
}
