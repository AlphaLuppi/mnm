import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { governedWorkflowDefinitions, traces } from "@mnm/db";

/**
 * Build the gate sandbox helpers bound to a specific company. All
 * queries are RLS-scoped (the calling tool sets `app.current_company_id`
 * before invoking a gate) and additionally include companyId in the
 * WHERE clause for defense-in-depth.
 *
 * The returned functions are async and serialisable — each is wrapped
 * in an `ivm.Reference` by the gate-runner bridge (Task 2) and called
 * from inside the isolate with a 3 s inner timeout.
 *
 * MVP shape (see spec §6 + plan deviations):
 *  - `queryTraces(filter)` — narrow filter (`agentId`, `sinceIso`,
 *    `limit` capped at 50). Returns trace envelopes. Note: the traces
 *    table uses `agent_id` (UUID FK) — filter by `agentId`, not
 *    `agentName`. `stepId` is not a column on traces; omitted.
 *  - `checkWorkflowExists(name)` — trivial existence check against
 *    `governed_workflow_definitions`.
 *
 * Future helpers land additively — the `helpers` record is extensible.
 */
export function buildGateHelpers(deps: {
  db: Db;
  companyId: string;
}): Record<string, (...args: any[]) => Promise<any>> {
  const { db, companyId } = deps;

  async function queryTraces(filter: {
    agentId?: string;
    sinceIso?: string;
    limit?: number;
  } = {}) {
    const cap = Math.min(filter.limit ?? 50, 50);

    const conditions = [eq(traces.companyId, companyId)];
    if (filter.agentId) {
      conditions.push(eq(traces.agentId, filter.agentId));
    }
    if (filter.sinceIso) {
      conditions.push(gte(traces.startedAt, new Date(filter.sinceIso)));
    }

    const rows = await db
      .select({
        id: traces.id,
        agentId: traces.agentId,
        name: traces.name,
        status: traces.status,
        startedAt: traces.startedAt,
        completedAt: traces.completedAt,
        companyId: traces.companyId,
      })
      .from(traces)
      .where(and(...conditions))
      .orderBy(sql`${traces.startedAt} DESC`)
      .limit(cap);

    return rows;
  }

  async function checkWorkflowExists(name: string): Promise<boolean> {
    const [row] = await db
      .select({ id: governedWorkflowDefinitions.id })
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, companyId),
          eq(governedWorkflowDefinitions.name, name),
        ),
      );
    return !!row;
  }

  return { queryTraces, checkWorkflowExists };
}
