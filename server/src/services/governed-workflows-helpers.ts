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
 *  - `getCodeReviewState(reference)` — live API call routed through the
 *    company's GitProvider (token + baseUrl) to fetch current code review
 *    state of a GitLab MR (`{kind:"gitlab", projectId, mrIid}`) or GitHub
 *    PR (`{kind:"github", owner, repo, pullNumber}`). Returns a
 *    provider-agnostic `CodeReviewState` shape. Lets gates verify
 *    approvals at evaluation time instead of trusting
 *    `artifact.approvals_count`. The provider is resolved with
 *    `resourceType: "workflow"` so it picks up the company-scoped
 *    config; userId stays null because gates run after the run is
 *    underway, with no per-call user context.
 *  - `fetchHandoff({git_sha, path})` — fetch a Git blob by sha+path via
 *    the company's workflow GitProvider. Used by gates that need to
 *    inspect the actual content of a previous step's persisted artifact
 *    (e.g. lint a design.md, parse a JSON spec, etc.).
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

  async function getCodeReviewState(args: unknown) {
    if (!resolveGitProvider) {
      throw new Error(
        "getCodeReviewState helper unavailable: resolveGitProvider not wired",
      );
    }
    const ref = args as Record<string, unknown> | null | undefined;
    if (!ref || typeof ref !== "object") {
      throw new Error(
        'getCodeReviewState: reference object required ({kind:"gitlab",projectId,mrIid} or {kind:"github",owner,repo,pullNumber})',
      );
    }
    if (ref.kind === "gitlab") {
      if (typeof ref.projectId !== "string" || ref.projectId.length === 0) {
        throw new Error("getCodeReviewState: gitlab.projectId (string) required");
      }
      if (typeof ref.mrIid !== "number" || !Number.isFinite(ref.mrIid)) {
        throw new Error("getCodeReviewState: gitlab.mrIid (number) required");
      }
    } else if (ref.kind === "github") {
      if (typeof ref.owner !== "string" || ref.owner.length === 0) {
        throw new Error("getCodeReviewState: github.owner (string) required");
      }
      if (typeof ref.repo !== "string" || ref.repo.length === 0) {
        throw new Error("getCodeReviewState: github.repo (string) required");
      }
      if (typeof ref.pullNumber !== "number" || !Number.isFinite(ref.pullNumber)) {
        throw new Error("getCodeReviewState: github.pullNumber (number) required");
      }
    } else {
      throw new Error(
        `getCodeReviewState: unsupported kind="${String(ref.kind)}" — expected "gitlab" or "github"`,
      );
    }
    const provider = await resolveGitProvider({
      companyId,
      userId: null,
      resourceType: "workflow",
    });
    if (typeof provider.getCodeReviewState !== "function") {
      throw new Error(
        "getCodeReviewState: current GitProvider does not implement live code review state",
      );
    }
    return provider.getCodeReviewState(ref as Parameters<NonNullable<typeof provider.getCodeReviewState>>[0]);
  }

  async function fetchHandoff(args: { git_sha: string; path: string }) {
    if (!resolveGitProvider) {
      throw new Error(
        "fetchHandoff helper unavailable: resolveGitProvider not wired",
      );
    }
    if (typeof args?.git_sha !== "string" || args.git_sha.length === 0) {
      throw new Error("fetchHandoff: git_sha (string) required");
    }
    if (typeof args?.path !== "string" || args.path.length === 0) {
      throw new Error("fetchHandoff: path (string) required");
    }
    const provider = await resolveGitProvider({
      companyId,
      userId: null,
      resourceType: "workflow",
    });
    return provider.fetchBlob({ ref: args.git_sha, path: args.path });
  }

  return { queryTraces, checkWorkflowExists, getCodeReviewState, fetchHandoff };
}
