import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { governedWorkflowDefinitions, traces } from "@mnm/db";
import type { GitProvider } from "@mnm/git-provider";

type ResolveGitProviderFn = (args: {
  companyId: string;
  userId?: string | null;
  resourceType?: "agent" | "workflow";
}) => Promise<GitProvider>;

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
 * Helpers:
 *  - `queryTraces(filter)` — narrow filter (`agentId`, `sinceIso`,
 *    `limit` capped at 50). Returns trace envelopes. Note: the traces
 *    table uses `agent_id` (UUID FK) — filter by `agentId`, not
 *    `agentName`. `stepId` is not a column on traces; omitted.
 *  - `checkWorkflowExists(name)` — trivial existence check against
 *    `governed_workflow_definitions`.
 *  - `getMergeRequestApprovals({projectId, mrIid})` — live GitLab API
 *    call routed through the company's GitProvider (token + baseUrl).
 *    Lets gates verify approvals at evaluation time instead of trusting
 *    `artifact.approvals_count`. The provider is resolved with
 *    `resourceType: "workflow"` so it picks up the company-scoped
 *    config; userId stays null because gates run after the run is
 *    underway, with no per-call user context.
 *
 * Future helpers land additively — the `helpers` record is extensible.
 */
export function buildGateHelpers(deps: {
  db: Db;
  companyId: string;
  resolveGitProvider?: ResolveGitProviderFn;
}): Record<string, (...args: any[]) => Promise<any>> {
  const { db, companyId, resolveGitProvider } = deps;

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

  async function getMergeRequestApprovals(args: {
    projectId: string;
    mrIid: number;
  }) {
    if (!resolveGitProvider) {
      throw new Error(
        "getMergeRequestApprovals helper unavailable: resolveGitProvider not wired",
      );
    }
    if (typeof args?.projectId !== "string" || args.projectId.length === 0) {
      throw new Error("getMergeRequestApprovals: projectId (string) required");
    }
    if (typeof args?.mrIid !== "number" || !Number.isFinite(args.mrIid)) {
      throw new Error("getMergeRequestApprovals: mrIid (number) required");
    }
    const provider = await resolveGitProvider({
      companyId,
      userId: null,
      resourceType: "workflow",
    });
    if (typeof provider.getMergeRequestApprovals !== "function") {
      throw new Error(
        "getMergeRequestApprovals: current GitProvider does not implement live approvals (only GitlabProvider does today)",
      );
    }
    return provider.getMergeRequestApprovals({
      projectId: args.projectId,
      mrIid: args.mrIid,
    });
  }

  return { queryTraces, checkWorkflowExists, getMergeRequestApprovals };
}
