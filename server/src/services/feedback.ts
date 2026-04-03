import { and, eq, sql, desc, gte, lte, isNotNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { feedbackVotes, issueComments, agents } from "@mnm/db";
import type {
  FeedbackVoteSummary,
  FeedbackAgentStats,
  FeedbackSummary,
  FeedbackSummaryFilters,
  CastFeedbackVote,
} from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";

export function feedbackService(db: Db) {
  /**
   * Upsert a vote on an agent comment.
   * Uses ON CONFLICT DO UPDATE on the unique index (companyId, targetType, targetId, authorUserId).
   */
  async function castVote(
    companyId: string,
    issueId: string,
    data: CastFeedbackVote,
    authorUserId: string,
  ) {
    const [row] = await db
      .insert(feedbackVotes)
      .values({
        companyId,
        issueId,
        targetType: data.targetType,
        targetId: data.targetId,
        authorUserId,
        vote: data.vote,
        reason: data.reason ?? null,
      })
      .onConflictDoUpdate({
        target: [
          feedbackVotes.companyId,
          feedbackVotes.targetType,
          feedbackVotes.targetId,
          feedbackVotes.authorUserId,
        ],
        set: {
          vote: data.vote,
          reason: data.reason ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    publishLiveEvent({
      companyId,
      type: "feedback.updated",
      payload: { issueId, targetId: data.targetId, targetType: data.targetType },
    });

    return row;
  }

  /**
   * Get all votes for an issue's comments, with the current user's vote highlighted.
   * Returns one FeedbackVoteSummary per (targetType, targetId) that has at least one vote.
   */
  async function getVotesForIssue(
    companyId: string,
    issueId: string,
    userId: string,
  ): Promise<FeedbackVoteSummary[]> {
    const rows = await db
      .select({
        targetId: feedbackVotes.targetId,
        targetType: feedbackVotes.targetType,
        upCount: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'up')`.as("up_count"),
        downCount: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'down')`.as("down_count"),
        userVote: sql<string | null>`max(case when ${feedbackVotes.authorUserId} = ${userId} then ${feedbackVotes.vote} else null end)`.as("user_vote"),
      })
      .from(feedbackVotes)
      .where(
        and(
          eq(feedbackVotes.companyId, companyId),
          eq(feedbackVotes.issueId, issueId),
        ),
      )
      .groupBy(feedbackVotes.targetId, feedbackVotes.targetType);

    return rows.map((r) => ({
      targetId: r.targetId,
      targetType: r.targetType as FeedbackVoteSummary["targetType"],
      upCount: Number(r.upCount),
      downCount: Number(r.downCount),
      userVote: (r.userVote as FeedbackVoteSummary["userVote"]) ?? null,
    }));
  }

  /**
   * Retract a vote.
   */
  async function deleteVote(
    companyId: string,
    targetType: string,
    targetId: string,
    authorUserId: string,
  ) {
    const [deleted] = await db
      .delete(feedbackVotes)
      .where(
        and(
          eq(feedbackVotes.companyId, companyId),
          eq(feedbackVotes.targetType, targetType),
          eq(feedbackVotes.targetId, targetId),
          eq(feedbackVotes.authorUserId, authorUserId),
        ),
      )
      .returning();

    if (deleted) {
      publishLiveEvent({
        companyId,
        type: "feedback.updated",
        payload: { issueId: deleted.issueId, targetId, targetType },
      });
    }

    return deleted ?? null;
  }

  /**
   * Get aggregate feedback stats: total up/down, by agent, recent downvote reasons.
   */
  async function getSummary(
    companyId: string,
    filters?: FeedbackSummaryFilters,
  ): Promise<FeedbackSummary> {
    // Build WHERE conditions
    const conditions = [eq(feedbackVotes.companyId, companyId)];
    if (filters?.from) {
      conditions.push(gte(feedbackVotes.createdAt, new Date(filters.from)));
    }
    if (filters?.to) {
      conditions.push(lte(feedbackVotes.createdAt, new Date(filters.to)));
    }

    // For agent/project filtering, we need to join through issueComments (and issues for project).
    // We'll build a base query that joins feedbackVotes -> issueComments to get authorAgentId.
    const baseConditions = [...conditions];

    if (filters?.agentId) {
      baseConditions.push(eq(issueComments.authorAgentId, filters.agentId));
    }
    if (filters?.projectId) {
      // Filter via the issueId -> issues table projectId. We use a subquery approach.
      baseConditions.push(
        sql`${feedbackVotes.issueId} in (select id from issues where project_id = ${filters.projectId})`,
      );
    }

    const needsJoin = !!filters?.agentId;

    // --- Totals ---
    let totalsQuery;
    if (needsJoin) {
      totalsQuery = db
        .select({
          total: sql<number>`count(*)`.as("total"),
          up: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'up')`.as("up"),
          down: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'down')`.as("down"),
        })
        .from(feedbackVotes)
        .innerJoin(issueComments, eq(feedbackVotes.targetId, issueComments.id))
        .where(and(...baseConditions));
    } else {
      totalsQuery = db
        .select({
          total: sql<number>`count(*)`.as("total"),
          up: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'up')`.as("up"),
          down: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'down')`.as("down"),
        })
        .from(feedbackVotes)
        .where(and(...baseConditions));
    }

    const [totals] = await totalsQuery;

    // --- By agent ---
    // Join feedbackVotes -> issueComments (to get authorAgentId) -> agents (to get name)
    const byAgentConditions = [
      ...conditions,
      isNotNull(issueComments.authorAgentId),
    ];
    if (filters?.projectId) {
      byAgentConditions.push(
        sql`${feedbackVotes.issueId} in (select id from issues where project_id = ${filters.projectId})`,
      );
    }
    if (filters?.agentId) {
      byAgentConditions.push(eq(issueComments.authorAgentId, filters.agentId));
    }

    const byAgentRows = await db
      .select({
        agentId: issueComments.authorAgentId,
        agentName: agents.name,
        totalVotes: sql<number>`count(*)`.as("total_votes"),
        upVotes: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'up')`.as("up_votes"),
        downVotes: sql<number>`count(*) filter (where ${feedbackVotes.vote} = 'down')`.as("down_votes"),
      })
      .from(feedbackVotes)
      .innerJoin(issueComments, eq(feedbackVotes.targetId, issueComments.id))
      .innerJoin(agents, eq(issueComments.authorAgentId, agents.id))
      .where(and(...byAgentConditions))
      .groupBy(issueComments.authorAgentId, agents.name)
      .orderBy(desc(sql`count(*)`));

    const byAgent: FeedbackAgentStats[] = byAgentRows.map((r) => {
      const total = Number(r.totalVotes);
      const up = Number(r.upVotes);
      const down = Number(r.downVotes);
      return {
        agentId: r.agentId!,
        agentName: r.agentName,
        totalVotes: total,
        upVotes: up,
        downVotes: down,
        approvalRate: total > 0 ? Math.round((up / total) * 100) / 100 : 0,
      };
    });

    // --- Recent downvote reasons ---
    const reasonConditions = [
      ...conditions,
      eq(feedbackVotes.vote, "down"),
      isNotNull(feedbackVotes.reason),
    ];
    if (filters?.agentId) {
      reasonConditions.push(
        sql`${feedbackVotes.targetId} in (select id from issue_comments where author_agent_id = ${filters.agentId})`,
      );
    }
    if (filters?.projectId) {
      reasonConditions.push(
        sql`${feedbackVotes.issueId} in (select id from issues where project_id = ${filters.projectId})`,
      );
    }

    const reasonRows = await db
      .select({ reason: feedbackVotes.reason })
      .from(feedbackVotes)
      .where(and(...reasonConditions))
      .orderBy(desc(feedbackVotes.createdAt))
      .limit(20);

    const recentDownvoteReasons = reasonRows
      .map((r) => r.reason)
      .filter((r): r is string => r !== null);

    return {
      totalVotes: Number(totals.total),
      upVotes: Number(totals.up),
      downVotes: Number(totals.down),
      byAgent,
      recentDownvoteReasons,
    };
  }

  return { castVote, getVotesForIssue, deleteVote, getSummary };
}
