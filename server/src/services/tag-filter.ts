import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { tagAssignments, agents, issues, traces, configLayers } from "@mnm/db";
import type { TagScope } from "../middleware/tag-scope.js";

/**
 * Tag-based filtering helpers for data isolation.
 *
 * RULE: Tag A user must NEVER see Tag B data.
 * All list queries for tag-filterable resources MUST use these helpers.
 *
 * Architecture: Double isolation layer
 * - Layer 1: RLS (company_id) — automatic, infaillible
 * - Layer 2: Tag filtering (this module) — application-level, enforced via TagScope
 */

export function tagFilterService(db: Db) {

  /**
   * List agents visible to the given TagScope.
   * - bypass_tag_filter → all agents
   * - otherwise → agents that share at least 1 tag with the user
   */
  async function listAgentsFiltered(companyId: string, scope: TagScope) {
    if (scope.bypassTagFilter) {
      return db.select().from(agents).where(eq(agents.companyId, companyId));
    }

    if (scope.tagIds.size === 0) return [];

    // INNER JOIN tag_assignments to filter by tag intersection
    const rows = await db
      .selectDistinctOn([agents.id])
      .from(agents)
      .innerJoin(
        tagAssignments,
        and(
          eq(tagAssignments.targetType, "agent"),
          sql`${tagAssignments.targetId} = ${agents.id}::text`,
          eq(tagAssignments.companyId, companyId),
          inArray(tagAssignments.tagId, [...scope.tagIds]),
        ),
      )
      .where(eq(agents.companyId, companyId));

    // CAO has ALL tags so it appears for any user with >=1 tag.
    // Hide it from non-admin users (bypassTagFilter is false here).
    // Require BOTH metadata.isCAO AND adapter_type="claude_local" to prevent
    // metadata spoofing — a user-created agent with just metadata.isCAO=true
    // should NOT be hidden from view.
    return rows
      .map((r) => r.agents)
      .filter((a) => {
        const meta = a.metadata as Record<string, unknown> | null;
        const isCao = meta?.isCAO === true && a.adapterType === "claude_local";
        return !isCao;
      });
  }

  /**
   * Check if a single agent is visible to the given TagScope.
   */
  async function isAgentVisible(companyId: string, agentId: string, scope: TagScope): Promise<boolean> {
    if (scope.bypassTagFilter) return true;
    if (scope.tagIds.size === 0) return false;

    const [match] = await db
      .select({ id: tagAssignments.id })
      .from(tagAssignments)
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "agent"),
        eq(tagAssignments.targetId, agentId),
        inArray(tagAssignments.tagId, [...scope.tagIds]),
      ))
      .limit(1);

    return !!match;
  }

  /**
   * List issues visible to the given TagScope.
   * Visible if:
   * - assignee_tag_id is in user's tags
   * - assignee_user_id = user
   * - bypass_tag_filter (admin)
   * Pool global (all assignees null) → only visible with bypass_tag_filter
   */
  async function listIssuesFiltered(companyId: string, scope: TagScope, opts?: {
    pool?: boolean;      // only pool issues (no direct assignee)
    tagId?: string;      // filter by specific tag
  }) {
    if (scope.bypassTagFilter) {
      const conditions: SQL[] = [eq(issues.companyId, companyId)];
      if (opts?.pool) {
        conditions.push(sql`${issues.assigneeAgentId} IS NULL AND ${issues.assigneeUserId} IS NULL`);
      }
      if (opts?.tagId) {
        conditions.push(eq(issues.assigneeTagId, opts.tagId));
      }
      return db.select().from(issues).where(and(...conditions));
    }

    if (scope.tagIds.size === 0) {
      // No tags → only see direct assignments OR issues created by user
      return db.select().from(issues).where(
        and(
          eq(issues.companyId, companyId),
          sql`(${issues.assigneeUserId} = ${scope.userId} OR ${issues.createdByUserId} = ${scope.userId})`,
        ),
      );
    }

    // Visible: assignee_tag_id in user tags OR assignee_user_id = user OR createdByUserId = user
    const conditions: SQL[] = [
      eq(issues.companyId, companyId),
      sql`(
        ${issues.assigneeTagId} IN (${sql.join([...scope.tagIds].map(id => sql`${id}::uuid`), sql`, `)})
        OR ${issues.assigneeUserId} = ${scope.userId}
        OR ${issues.createdByUserId} = ${scope.userId}
      )`,
    ];

    if (opts?.pool) {
      conditions.push(sql`${issues.assigneeAgentId} IS NULL AND ${issues.assigneeUserId} IS NULL`);
    }
    if (opts?.tagId) {
      conditions.push(eq(issues.assigneeTagId, opts.tagId));
    }

    return db.select().from(issues).where(and(...conditions));
  }

  /**
   * Check if a single issue is visible to the given TagScope.
   * Visible if:
   * - bypass_tag_filter (admin)
   * - assigneeUserId = user (directly assigned)
   * - createdByUserId = user (user created it)
   * - assigneeTagId is in user's tags
   * - the assigned agent shares at least 1 tag with the user
   */
  async function isIssueVisible(
    companyId: string,
    issue: { assigneeUserId: string | null; createdByUserId: string | null; assigneeAgentId: string | null; assigneeTagId: string | null },
    scope: TagScope,
  ): Promise<boolean> {
    if (scope.bypassTagFilter) return true;

    // Ownership: user created or is directly assigned
    if (issue.assigneeUserId === scope.userId) return true;
    if (issue.createdByUserId === scope.userId) return true;

    if (scope.tagIds.size === 0) return false;

    // Tag-based: assigneeTagId is in user's tags
    if (issue.assigneeTagId && scope.tagIds.has(issue.assigneeTagId)) return true;

    // Agent-based: assigned agent shares a tag with the user
    if (issue.assigneeAgentId) {
      return isAgentVisible(companyId, issue.assigneeAgentId, scope);
    }

    return false;
  }

  /**
   * List traces visible to the given TagScope.
   * Visibility is inherited from the parent agent:
   * - if user can see the agent → user can see its traces
   */
  async function listTracesFiltered(companyId: string, scope: TagScope) {
    if (scope.bypassTagFilter) {
      return db.select().from(traces).where(eq(traces.companyId, companyId));
    }

    if (scope.tagIds.size === 0) return [];

    // Get visible agent IDs first, then filter traces
    const visibleAgentRows = await db
      .selectDistinct({ agentId: tagAssignments.targetId })
      .from(tagAssignments)
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "agent"),
        inArray(tagAssignments.tagId, [...scope.tagIds]),
      ));

    const visibleAgentIds = visibleAgentRows.map((r) => r.agentId);
    if (visibleAgentIds.length === 0) return [];

    return db
      .select()
      .from(traces)
      .where(and(
        eq(traces.companyId, companyId),
        inArray(traces.agentId, visibleAgentIds),
      ));
  }

  /**
   * Check if a single trace is visible to the given TagScope.
   */
  async function isTraceVisible(companyId: string, agentId: string, scope: TagScope): Promise<boolean> {
    return isAgentVisible(companyId, agentId, scope);
  }

  /**
   * List config layers visible to the given TagScope.
   * Visibility rules:
   * - bypass_tag_filter → all non-archived layers for the company
   * - company scope OR public visibility → visible to all
   * - private visibility → only visible to creator
   * - team visibility → visible if creator shares at least 1 tag with requesting user
   */
  async function listConfigLayersFiltered(companyId: string, scope: TagScope) {
    if (scope.bypassTagFilter) {
      return db.select().from(configLayers).where(
        and(eq(configLayers.companyId, companyId), isNull(configLayers.archivedAt)),
      );
    }

    const allLayers = await db.select().from(configLayers).where(
      and(eq(configLayers.companyId, companyId), isNull(configLayers.archivedAt)),
    );

    // For team visibility, check tag intersection between requesting user and layer creator.
    // Batch-fetch creator tags to avoid N+1 queries.
    const teamLayers = allLayers.filter(
      (l) => l.visibility === "team" && l.createdByUserId !== scope.userId,
    );
    const creatorIds = [...new Set(teamLayers.map((l) => l.createdByUserId).filter(Boolean))] as string[];

    const creatorTagMap = new Map<string, Set<string>>();
    if (creatorIds.length > 0 && scope.tagIds.size > 0) {
      const creatorTagRows = await db
        .select({ targetId: tagAssignments.targetId, tagId: tagAssignments.tagId })
        .from(tagAssignments)
        .where(and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, "user"),
          inArray(tagAssignments.targetId, creatorIds),
        ));
      for (const row of creatorTagRows) {
        let s = creatorTagMap.get(row.targetId);
        if (!s) { s = new Set(); creatorTagMap.set(row.targetId, s); }
        s.add(row.tagId);
      }
    }

    return allLayers.filter((layer) => {
      if (layer.scope === "company") return true;
      if (layer.visibility === "public") return true;
      if (layer.visibility === "private") return layer.createdByUserId === scope.userId;
      if (layer.visibility === "team") {
        if (layer.createdByUserId === scope.userId) return true;
        const creatorTags = creatorTagMap.get(layer.createdByUserId ?? "");
        if (!creatorTags) return false;
        for (const tagId of creatorTags) {
          if (scope.tagIds.has(tagId)) return true;
        }
        return false;
      }
      return false;
    });
  }

  return {
    listAgentsFiltered,
    isAgentVisible,
    isIssueVisible,
    listIssuesFiltered,
    listTracesFiltered,
    isTraceVisible,
    listConfigLayersFiltered,
  };
}
