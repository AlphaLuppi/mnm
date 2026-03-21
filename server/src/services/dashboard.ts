import { and, eq, gte, lte, sql, desc, count as drizzleCount } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  agents,
  approvals,
  companies,
  costEvents,
  issues,
  auditEvents,
  workflowInstances,
  driftReports,
} from "@mnm/db";
import { notFound, badRequest } from "../errors.js";
import type {
  DashboardKpis,
  DashboardTimeline,
  DashboardTimelinePoint,
  DashboardBreakdown,
  DashboardBreakdownItem,
  DashboardPeriod,
  DashboardBreakdownCategory,
} from "@mnm/shared";
import {
  DASHBOARD_BREAKDOWN_CATEGORIES,
  K_ANONYMITY_THRESHOLD,
} from "@mnm/shared";

// ---------- Helpers ----------

function periodToDays(period: DashboardPeriod): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
  }
}

/**
 * Apply k-anonymity: items with count < k are grouped into an "other" bucket.
 * This prevents drill-down to individual entities.
 */
function applyKAnonymity(items: DashboardBreakdownItem[], k: number = K_ANONYMITY_THRESHOLD): DashboardBreakdownItem[] {
  const result: DashboardBreakdownItem[] = [];
  let otherCount = 0;

  for (const item of items) {
    if (item.count >= k) {
      result.push(item);
    } else {
      otherCount += item.count;
    }
  }

  if (otherCount > 0) {
    result.push({ label: "other", count: otherCount });
  }

  return result;
}

// ---------- Service ----------

export function dashboardService(db: Db) {
  return {
    // Legacy summary — backward compatible (AC10)
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const staleCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const staleTasks = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "in_progress"),
            sql`${issues.startedAt} < ${staleCutoff.toISOString()}`,
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        staleTasks,
      };
    },

    // DASH-S01: Enriched KPIs (AC1)
    kpis: async (companyId: string): Promise<DashboardKpis> => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      // Agents by status
      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const agentCounts = { active: 0, running: 0, paused: 0, error: 0, total: 0 };
      for (const row of agentRows) {
        const count = Number(row.count);
        agentCounts.total += count;
        const bucket = row.status === "idle" ? "active" : row.status;
        if (bucket in agentCounts) {
          (agentCounts as Record<string, number>)[bucket] += count;
        }
      }

      // Tasks by status
      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const taskCounts = { open: 0, inProgress: 0, blocked: 0, done: 0, total: 0 };
      for (const row of taskRows) {
        const count = Number(row.count);
        taskCounts.total += count;
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      // Monthly costs
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;

      // Workflow instances by state
      const workflowRows = await db
        .select({ state: workflowInstances.workflowState, count: sql<number>`count(*)` })
        .from(workflowInstances)
        .where(eq(workflowInstances.companyId, companyId))
        .groupBy(workflowInstances.workflowState);

      const workflowCounts = { active: 0, completed: 0, failed: 0, paused: 0, total: 0 };
      for (const row of workflowRows) {
        const count = Number(row.count);
        workflowCounts.total += count;
        if (row.state === "active" || row.state === "in_progress" || row.state === "draft") {
          workflowCounts.active += count;
        } else if (row.state === "completed") {
          workflowCounts.completed += count;
        } else if (row.state === "failed" || row.state === "terminated") {
          workflowCounts.failed += count;
        } else if (row.state === "paused") {
          workflowCounts.paused += count;
        }
      }

      // Audit event counts
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [auditToday, auditWeek, auditMonth] = await Promise.all([
        db
          .select({ count: drizzleCount() })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.companyId, companyId),
              gte(auditEvents.createdAt, todayStart),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
        db
          .select({ count: drizzleCount() })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.companyId, companyId),
              gte(auditEvents.createdAt, weekStart),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
        db
          .select({ count: drizzleCount() })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.companyId, companyId),
              gte(auditEvents.createdAt, monthStart),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
      ]);

      // Container counts (legacy container system removed, always zero)
      const containerCounts = { running: 0, stopped: 0, total: 0 };

      // Drift open alerts
      const openDriftAlerts = await db
        .select({ count: drizzleCount() })
        .from(driftReports)
        .where(
          and(
            eq(driftReports.companyId, companyId),
            eq(driftReports.status, "completed"),
            sql`${driftReports.driftCount} > 0`,
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      // Pending approvals
      const pendingApprovals = await db
        .select({ count: drizzleCount() })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            eq(approvals.status, "pending"),
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      // Stale tasks
      const staleCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const staleTasks = await db
        .select({ count: drizzleCount() })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "in_progress"),
            sql`${issues.startedAt} < ${staleCutoff.toISOString()}`,
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      return {
        companyId,
        agents: agentCounts,
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        workflows: workflowCounts,
        audit: {
          eventsToday: auditToday,
          eventsWeek: auditWeek,
          eventsMonth: auditMonth,
        },
        containers: containerCounts,
        drift: {
          openAlerts: openDriftAlerts,
        },
        pendingApprovals,
        staleTasks,
      };
    },

    // DASH-S01: Timeline (AC2, AC3)
    timeline: async (companyId: string, period: DashboardPeriod): Promise<DashboardTimeline> => {
      const days = periodToDays(period);
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Generate empty points for each day
      const points: DashboardTimelinePoint[] = [];
      const pointMap = new Map<string, DashboardTimelinePoint>();
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().slice(0, 10);
        const point: DashboardTimelinePoint = {
          date: dateStr,
          agentsActive: 0,
          tasksCompleted: 0,
          auditEvents: 0,
          costCents: 0,
        };
        points.push(point);
        pointMap.set(dateStr, point);
      }

      // Audit events by day
      const auditByDay = await db
        .select({
          day: sql<string>`date_trunc('day', ${auditEvents.createdAt})::date::text`,
          count: drizzleCount(),
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.companyId, companyId),
            gte(auditEvents.createdAt, startDate),
          ),
        )
        .groupBy(sql`date_trunc('day', ${auditEvents.createdAt})::date`);

      for (const row of auditByDay) {
        const dateStr = row.day.slice(0, 10);
        const point = pointMap.get(dateStr);
        if (point) point.auditEvents = Number(row.count);
      }

      // Cost events by day
      const costByDay = await db
        .select({
          day: sql<string>`date_trunc('day', ${costEvents.occurredAt})::date::text`,
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, startDate),
          ),
        )
        .groupBy(sql`date_trunc('day', ${costEvents.occurredAt})::date`);

      for (const row of costByDay) {
        const dateStr = row.day.slice(0, 10);
        const point = pointMap.get(dateStr);
        if (point) point.costCents = Number(row.total);
      }

      // Tasks completed by day (completedAt within range)
      const tasksCompletedByDay = await db
        .select({
          day: sql<string>`date_trunc('day', ${issues.completedAt})::date::text`,
          count: drizzleCount(),
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "done"),
            gte(issues.completedAt, startDate),
          ),
        )
        .groupBy(sql`date_trunc('day', ${issues.completedAt})::date`);

      for (const row of tasksCompletedByDay) {
        const dateStr = row.day.slice(0, 10);
        const point = pointMap.get(dateStr);
        if (point) point.tasksCompleted = Number(row.count);
      }

      // Agent activity: count of agents with any heartbeat_run activity per day
      // Simplified: use current agent count as static per day (real time-series
      // would require a dedicated analytics table, which is DASH-S03 scope)
      const totalAgents = await db
        .select({ count: drizzleCount() })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            sql`${agents.status} IN ('idle', 'running')`,
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      for (const point of points) {
        point.agentsActive = totalAgents;
      }

      return { period, points };
    },

    // DASH-S01: Breakdown (AC4, AC5, AC6, AC7, AC11, AC12)
    breakdown: async (companyId: string, category: DashboardBreakdownCategory): Promise<DashboardBreakdown> => {
      if (!DASHBOARD_BREAKDOWN_CATEGORIES.includes(category)) {
        throw badRequest(`Invalid breakdown category: ${category}. Valid categories: ${DASHBOARD_BREAKDOWN_CATEGORIES.join(", ")}`);
      }

      let items: DashboardBreakdownItem[] = [];
      let total = 0;

      switch (category) {
        case "agents": {
          const rows = await db
            .select({ status: agents.status, count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.companyId, companyId))
            .groupBy(agents.status);

          for (const row of rows) {
            const count = Number(row.count);
            total += count;
            items.push({ label: row.status, count });
          }
          break;
        }

        case "workflows": {
          const rows = await db
            .select({ state: workflowInstances.workflowState, count: sql<number>`count(*)` })
            .from(workflowInstances)
            .where(eq(workflowInstances.companyId, companyId))
            .groupBy(workflowInstances.workflowState);

          for (const row of rows) {
            const count = Number(row.count);
            total += count;
            items.push({ label: row.state, count });
          }
          break;
        }

        case "audit": {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const rows = await db
            .select({ action: auditEvents.action, count: sql<number>`count(*)` })
            .from(auditEvents)
            .where(
              and(
                eq(auditEvents.companyId, companyId),
                gte(auditEvents.createdAt, thirtyDaysAgo),
              ),
            )
            .groupBy(auditEvents.action)
            .orderBy(desc(sql`count(*)`))
            .limit(10);

          for (const row of rows) {
            const count = Number(row.count);
            total += count;
            items.push({ label: row.action, count });
          }
          break;
        }

        case "costs": {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);

          const rows = await db
            .select({
              agentId: costEvents.agentId,
              total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
            })
            .from(costEvents)
            .where(
              and(
                eq(costEvents.companyId, companyId),
                gte(costEvents.occurredAt, monthStart),
              ),
            )
            .groupBy(costEvents.agentId)
            .orderBy(desc(sql`sum(${costEvents.costCents})`))
            .limit(10);

          for (const row of rows) {
            const count = Number(row.total);
            total += count;
            items.push({ label: row.agentId ?? "unknown", count });
          }
          break;
        }

        case "containers": {
          // Legacy container system removed -- no data
          break;
        }
      }

      // Apply k-anonymity (AC7)
      items = applyKAnonymity(items);

      return { category, items, total };
    },
  };
}
