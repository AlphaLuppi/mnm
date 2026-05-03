/**
 * server/src/services/governed-workflows-assignments.ts
 *
 * Workflow-assignments service (T3.2). Owns:
 *  - `resolveAssignment` : resolves a step's `assignment` declaration
 *    (tags ∩ AND, roles UNION-by-expansion, explicit principals UNION) into
 *    a deduplicated set of principal ids with per-principal "reason" trace.
 *  - `snapshotStepAssignments` : INSERTs the resolved set into
 *    `governed_step_assignments` (idempotent via UNIQUE constraint on
 *    (step_execution_id, principal_id) — re-runs ignore conflicts).
 *  - `listPendingWorkFor` : the inbox hot-path query (used by REST + MCP
 *    `list_my_pending_work` in T3.4). Joins step_executions filtered
 *    on state IN ('pending','running') using the partial index added in
 *    migration 0082.
 *
 * The service is multi-tenant : every method takes `companyId` and every
 * query carries an explicit `eq(company_id, …)` belt + RLS suspenders.
 *
 * Human traceability §1.7 : the `reason` text on every snapshot row tells
 * a future auditor WHY a principal got the work — "tag intersection [a,b]",
 * "role-expansion engineer", "explicit", or "delta-launchStep". No silent
 * assignments.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  companyMemberships,
  governedStepAssignments,
  governedStepExecutions,
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  roles as rolesTable,
  tagAssignments,
  tags as tagsTable,
  type GovernedStepAssignmentRow,
  type GovernedStepState,
} from "@mnm/db";
import type { StepAssignment } from "@mnm/governed-workflows";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolvedAssignmentEntry {
  principalId: string;
  /** Human-readable trace of WHY this principal was matched. */
  reason: string;
}

export interface ResolveAssignmentArgs {
  companyId: string;
  assignment: StepAssignment | undefined | null;
}

export interface SnapshotStepAssignmentsArgs {
  companyId: string;
  stepExecutionId: string;
  entries: ResolvedAssignmentEntry[];
}

export interface ListPendingWorkArgs {
  companyId: string;
  principalId: string;
  /** Optional state filter — defaults to ['pending','running']. */
  status?: ReadonlyArray<Extract<GovernedStepState, "pending" | "running">>;
  limit?: number;
  /**
   * SEC P4 (HIGH #6) — optional tag-scope filter applied at the service
   * layer. When provided AND non-empty, the result is restricted to rows
   * whose `principalId` (the assigned user/agent) has at least one tag in
   * `tagIds` (intersection > 0). When `undefined` the filter is skipped
   * (admin or `bypassTagFilter` callers). When `[]` (empty array) the
   * filter is restrictive: no row passes — caller has zero scope.
   */
  tagIds?: ReadonlyArray<string>;
}

export interface PendingWorkRow {
  stepExecutionId: string;
  stepName: string;
  runId: string;
  runStatus: string;
  workflowName: string;
  workflowGitTag: string | null;
  /** Composite/sub-run support — null for non-composite steps in V0. */
  parentStepExecutionId: string | null;
  assignedAt: Date;
  assignmentReason: string;
  hasArtifacts: boolean;
  /** True when ALL deps of the step are succeeded. Stub `true` in V0. */
  depsCompleted: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

export function governedWorkflowsAssignmentsService(db: Db) {
  /**
   * Resolve a step assignment declaration into a deduplicated set of
   * principal ids. Empty / undefined declaration returns [].
   *
   * Tag-intersection : a principal is matched IFF they carry ALL the
   * declared tag slugs (or ids). Tags missing from the company are
   * skipped silently — declaring a non-existent tag yields zero match
   * rather than an error (cheap auditing via the empty snapshot).
   *
   * Role-expansion : every principal whose `company_memberships.role_id`
   * (joined via roles slug-or-id) matches ANY of the declared roles is
   * included.
   *
   * Explicit principals are added unconditionally.
   *
   * Dedup : if a principal matches by tags AND role AND was listed
   * explicitly, the snapshot still has exactly one row. The `reason`
   * is a comma-joined trace of every matching path.
   */
  async function resolveAssignment(
    args: ResolveAssignmentArgs,
  ): Promise<ResolvedAssignmentEntry[]> {
    const { companyId, assignment } = args;
    if (!assignment) return [];

    const tagList = (assignment.tags ?? []).filter((t) => t.length > 0);
    const roleList = (assignment.roles ?? []).filter((r) => r.length > 0);
    const explicitList = (assignment.principals ?? []).filter(
      (p) => p.length > 0,
    );

    // Aggregate principalId -> reasons[].
    const byPrincipal = new Map<string, string[]>();

    // ─── 1. Tag intersection ─────────────────────────────────────────────
    if (tagList.length > 0) {
      // Resolve tag slugs/ids -> tag uuid set.
      const tagRows = await db
        .select({ id: tagsTable.id, slug: tagsTable.slug })
        .from(tagsTable)
        .where(
          and(
            eq(tagsTable.companyId, companyId),
            // Match either slug or stringified id.
            sql`(${tagsTable.slug} = ANY(${sql.raw(`ARRAY[${tagList.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")}]::text[]`)}) OR ${tagsTable.id}::text = ANY(${sql.raw(`ARRAY[${tagList.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")}]::text[]`)}))`,
          ),
        );

      const matchedTagIds = tagRows.map((r) => r.id);

      // If not every declared tag resolved, the intersection cardinality is
      // the user's request — declaring a bogus tag means zero principals.
      if (matchedTagIds.length === tagList.length && matchedTagIds.length > 0) {
        // Find principals whose set of tag_assignments contains ALL matched
        // tag ids. Implemented via GROUP BY HAVING COUNT(DISTINCT) =
        // declared cardinality (the textbook intersection pattern).
        const intersected = await db
          .select({
            targetId: tagAssignments.targetId,
          })
          .from(tagAssignments)
          .where(
            and(
              eq(tagAssignments.companyId, companyId),
              inArray(tagAssignments.tagId, matchedTagIds),
            ),
          )
          .groupBy(tagAssignments.targetId)
          .having(
            sql`COUNT(DISTINCT ${tagAssignments.tagId}) = ${matchedTagIds.length}`,
          );

        const tagReason = `tag-intersection:${tagList.join(",")}`;
        for (const row of intersected) {
          const existing = byPrincipal.get(row.targetId) ?? [];
          existing.push(tagReason);
          byPrincipal.set(row.targetId, existing);
        }
      }
    }

    // ─── 2. Role expansion ───────────────────────────────────────────────
    if (roleList.length > 0) {
      const roleRows = await db
        .select({ id: rolesTable.id, slug: rolesTable.slug })
        .from(rolesTable)
        .where(
          and(
            eq(rolesTable.companyId, companyId),
            sql`(${rolesTable.slug} = ANY(${sql.raw(`ARRAY[${roleList.map((r) => `'${r.replace(/'/g, "''")}'`).join(",")}]::text[]`)}) OR ${rolesTable.id}::text = ANY(${sql.raw(`ARRAY[${roleList.map((r) => `'${r.replace(/'/g, "''")}'`).join(",")}]::text[]`)}))`,
          ),
        );

      const matchedRoleIds = roleRows.map((r) => r.id);
      if (matchedRoleIds.length > 0) {
        const expanded = await db
          .select({
            principalId: companyMemberships.principalId,
          })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, companyId),
              eq(companyMemberships.status, "active"),
              inArray(companyMemberships.roleId, matchedRoleIds),
            ),
          );

        const roleReason = `role-expansion:${roleList.join(",")}`;
        for (const row of expanded) {
          const existing = byPrincipal.get(row.principalId) ?? [];
          existing.push(roleReason);
          byPrincipal.set(row.principalId, existing);
        }
      }
    }

    // ─── 3. Explicit principals (UNION) ──────────────────────────────────
    for (const pid of explicitList) {
      const existing = byPrincipal.get(pid) ?? [];
      existing.push("explicit");
      byPrincipal.set(pid, existing);
    }

    return [...byPrincipal.entries()].map(([principalId, reasons]) => ({
      principalId,
      reason: reasons.join(" + "),
    }));
  }

  /**
   * Persist the resolved assignment set. Idempotent — the table's UNIQUE
   * (step_execution_id, principal_id) constraint catches re-snapshots
   * (e.g. relaunchStep with unchanged assignment), and `ON CONFLICT DO
   * NOTHING` makes the call safe to retry. Returns the rows that were
   * actually inserted (delta), so callers can compute how many fresh
   * principals were notified.
   */
  async function snapshotStepAssignments(
    args: SnapshotStepAssignmentsArgs,
  ): Promise<GovernedStepAssignmentRow[]> {
    const { companyId, stepExecutionId, entries } = args;
    if (entries.length === 0) return [];

    const inserted = await db
      .insert(governedStepAssignments)
      .values(
        entries.map((e) => ({
          companyId,
          stepExecutionId,
          principalId: e.principalId,
          reason: e.reason,
        })),
      )
      .onConflictDoNothing({
        target: [
          governedStepAssignments.stepExecutionId,
          governedStepAssignments.principalId,
        ],
      })
      .returning();

    return inserted;
  }

  /**
   * Inbox hot-path : "what work is currently waiting on this principal?".
   * Joins step_executions on the partial index added in migration 0082
   * (state IN ('pending','running')) for a tight bitmap scan in PG.
   *
   * Cancelled runs are excluded. When `tagIds` is provided (non-undefined),
   * the result is further restricted by tag-intersection on the assigned
   * principal — tag-scoped (non-bypass) callers see only assignments whose
   * principal carries at least one tag in their scope. Undefined skips
   * the filter (bypass callers).
   */
  async function listPendingWorkFor(
    args: ListPendingWorkArgs,
  ): Promise<PendingWorkRow[]> {
    const { companyId, principalId } = args;
    const status = args.status ?? (["pending", "running"] as const);
    const limit = args.limit ?? 100;

    // SEC P4 (HIGH #6) — tag-scope predicate. Defined as an optional
    // sub-query against tag_assignments(target_type='user'). An empty
    // tagIds set is restrictive (no row passes); undefined skips.
    let tagPredicate;
    if (args.tagIds !== undefined) {
      if (args.tagIds.length === 0) {
        tagPredicate = sql`FALSE`;
      } else {
        const tagIdsArr = sql.raw(
          `ARRAY[${args.tagIds
            .map((t) => `'${t.replace(/'/g, "''")}'`)
            .join(",")}]::uuid[]`,
        );
        tagPredicate = sql`EXISTS (
          SELECT 1 FROM tag_assignments ta
          WHERE ta.company_id = ${companyId}
            AND ta.target_type = 'user'
            AND ta.target_id = ${governedStepAssignments.principalId}
            AND ta.tag_id = ANY(${tagIdsArr})
        )`;
      }
    }

    const rows = await db
      .select({
        stepExecutionId: governedStepAssignments.id,
        stepExecId: governedStepExecutions.id,
        stepName: governedStepExecutions.stepIdInJson,
        runId: governedWorkflowRuns.id,
        runStatus: governedWorkflowRuns.status,
        workflowName: governedWorkflowDefinitions.name,
        workflowGitTag: governedWorkflowRuns.workflowGitTag,
        artifactsJson: governedStepExecutions.artifactsJson,
        snapshotAt: governedStepAssignments.snapshotAt,
        reason: governedStepAssignments.reason,
        runCancelledAt: governedWorkflowRuns.cancelledAt,
      })
      .from(governedStepAssignments)
      .innerJoin(
        governedStepExecutions,
        eq(governedStepAssignments.stepExecutionId, governedStepExecutions.id),
      )
      .innerJoin(
        governedWorkflowRuns,
        eq(governedStepExecutions.runId, governedWorkflowRuns.id),
      )
      .innerJoin(
        governedWorkflowDefinitions,
        eq(
          governedWorkflowRuns.workflowDefId,
          governedWorkflowDefinitions.id,
        ),
      )
      .where(
        and(
          eq(governedStepAssignments.companyId, companyId),
          eq(governedStepAssignments.principalId, principalId),
          inArray(
            governedStepExecutions.state,
            status as ReadonlyArray<GovernedStepState> as GovernedStepState[],
          ),
          // Cancelled runs are excluded (T3.4 spec).
          sql`${governedWorkflowRuns.cancelledAt} IS NULL`,
          ...(tagPredicate ? [tagPredicate] : []),
        ),
      )
      .orderBy(desc(governedStepAssignments.snapshotAt))
      .limit(limit);

    return rows.map((r) => ({
      stepExecutionId: r.stepExecId,
      stepName: r.stepName,
      runId: r.runId,
      runStatus: r.runStatus,
      workflowName: r.workflowName,
      workflowGitTag: r.workflowGitTag,
      // Sub-run composite (parentStepExecutionId) is reserved for V1;
      // V0 schema doesn't carry the column so we always return null
      // (T3.4 spec).
      parentStepExecutionId: null,
      assignedAt: r.snapshotAt,
      assignmentReason: r.reason,
      hasArtifacts:
        r.artifactsJson !== null &&
        r.artifactsJson !== undefined &&
        Object.keys(r.artifactsJson as Record<string, unknown>).length > 0,
      // V0 stub : a true deps-completed check would require fetching
      // the step's `deps[]` from workflow.json + verifying every
      // dep step is succeeded. Cheap stub for now — UI doesn't gate
      // on this in V0 (just a hint).
      depsCompleted: true,
    }));
  }

  /**
   * Cheap COUNT(*) variant of `listPendingWorkFor` for sidebar badges
   * (T3.5). Same predicates, same partial-index hot path, no hydration
   * of step/run/definition columns. Cancelled runs are excluded.
   */
  async function countPendingWorkFor(
    args: Omit<ListPendingWorkArgs, "limit">,
  ): Promise<number> {
    const { companyId, principalId } = args;
    const status = args.status ?? (["pending", "running"] as const);

    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(governedStepAssignments)
      .innerJoin(
        governedStepExecutions,
        eq(governedStepAssignments.stepExecutionId, governedStepExecutions.id),
      )
      .innerJoin(
        governedWorkflowRuns,
        eq(governedStepExecutions.runId, governedWorkflowRuns.id),
      )
      .where(
        and(
          eq(governedStepAssignments.companyId, companyId),
          eq(governedStepAssignments.principalId, principalId),
          inArray(
            governedStepExecutions.state,
            status as ReadonlyArray<GovernedStepState> as GovernedStepState[],
          ),
          sql`${governedWorkflowRuns.cancelledAt} IS NULL`,
        ),
      );

    return Number(rows[0]?.count ?? 0);
  }

  return {
    resolveAssignment,
    snapshotStepAssignments,
    listPendingWorkFor,
    countPendingWorkFor,
  };
}

export type GovernedWorkflowsAssignmentsService = ReturnType<
  typeof governedWorkflowsAssignmentsService
>;
