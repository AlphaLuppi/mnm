import { Router } from "express";
import type { Db } from "@mnm/db";
import { and, eq, sql } from "drizzle-orm";
import { joinRequests, inboxDismissals } from "@mnm/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { issueService } from "../services/issues.js";
import { accessService } from "../services/access.js";
import { dashboardService } from "../services/dashboard.js";
import type { GovernedWorkflowsAssignmentsService } from "../services/governed-workflows-assignments.js";
import { assertCompanyAccess } from "./authz.js";

export function sidebarBadgeRoutes(
  db: Db,
  assignments: GovernedWorkflowsAssignmentsService,
) {
  const router = Router();
  const svc = sidebarBadgeService(db);
  const issueSvc = issueService(db);
  const access = accessService(db);
  const dashboard = dashboardService(db);

  router.get("/companies/:companyId/sidebar-badges", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;

    let canApproveJoins = false;
    if (req.actor.type === "board") {
      canApproveJoins =
        req.actor.source === "local_implicit" ||
        Boolean(req.actor.isInstanceAdmin) ||
        (await access.canUser(companyId, req.actor.userId!, "joins:approve"));
    } else if (req.actor.type === "agent" && req.actor.agentId) {
      canApproveJoins = await access.hasPermission(companyId, "agent", req.actor.agentId, "joins:approve");
    }

    // T3.5 — pending workflow-step assignments for the current principal
    // (board user or agent JWT). The aggregate `inbox` total below already
    // factors this in via sidebarBadgeService.get(). When no principal id
    // can be resolved (rare — instance-admin without a userId), fall back
    // to 0 so the badge degrades gracefully instead of leaking another
    // user's count.
    const principalId = req.actor.userId ?? req.actor.agentId ?? null;
    const pendingWorkflowStepsPromise = principalId
      ? assignments.countPendingWorkFor({ companyId, principalId })
      : Promise.resolve(0);

    const [joinRequestCount, dismissedRows, pendingWorkflowSteps] = await Promise.all([
      canApproveJoins
        ? db
          .select({ count: sql<number>`count(*)` })
          .from(joinRequests)
          .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
          .then((rows) => Number(rows[0]?.count ?? 0))
        : Promise.resolve(0),
      userId
        ? db
          .select({ itemKey: inboxDismissals.itemKey })
          .from(inboxDismissals)
          .where(and(eq(inboxDismissals.companyId, companyId), eq(inboxDismissals.userId, userId)))
        : Promise.resolve([]),
      pendingWorkflowStepsPromise,
    ]);

    const dismissed = new Set(dismissedRows.map((r) => r.itemKey));

    const badges = await svc.get(companyId, {
      joinRequests: joinRequestCount,
      dismissed,
      pendingWorkflowSteps,
    });
    const [summary, staleIds] = await Promise.all([
      dashboard.summary(companyId),
      issueSvc.staleIds(companyId, 24 * 60),
    ]);

    const hasFailedRuns = badges.failedRuns > 0;
    const staleIssueCount = staleIds.filter((id) => !dismissed.has(`stale:${id}`)).length;
    const alertsCount =
      (summary.agents.error > 0 && !hasFailedRuns && !dismissed.has("alert:agent-errors") ? 1 : 0) +
      (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 && !dismissed.has("alert:budget") ? 1 : 0);

    badges.inbox =
      badges.failedRuns +
      alertsCount +
      staleIssueCount +
      joinRequestCount +
      badges.approvals +
      badges.pendingWorkflowSteps;

    res.json(badges);
  });

  router.post("/companies/:companyId/inbox/dismiss", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId;
    if (!userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { key } = req.body as { key?: unknown };
    if (!key || typeof key !== "string") {
      res.status(400).json({ error: "key is required" });
      return;
    }

    await db
      .insert(inboxDismissals)
      .values({ companyId, userId, itemKey: key })
      .onConflictDoNothing();

    res.status(204).end();
  });

  return router;
}
