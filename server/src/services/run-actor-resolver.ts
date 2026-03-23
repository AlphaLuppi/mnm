import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agentWakeupRequests, issues } from "@mnm/db";
import { isUuidLike } from "@mnm/shared";

/**
 * Resolves the "triggering user" for a heartbeat run.
 * This determines whose sandbox the agent executes in.
 *
 * Priority chain:
 * 1. Explicit: the user who clicked "Run" (wakeupRequest.requestedByActorId)
 * 2. Issue: the user assigned to the issue
 * 3. Issue fallback: the user who created the issue
 * 4. Agent creator: the user who created the agent (for timer/A2A runs)
 *
 * Returns null if no actor can be resolved (should never happen in practice).
 */
export async function resolveRunActor(
  db: Db,
  run: {
    wakeupRequestId: string | null;
    contextSnapshot: unknown;
  },
  agent: {
    createdByUserId: string | null;
  },
): Promise<string | null> {
  // 1. Explicit: the user who triggered the wakeup
  if (run.wakeupRequestId) {
    const [wakeup] = await db
      .select({ requestedByActorId: agentWakeupRequests.requestedByActorId })
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, run.wakeupRequestId));

    if (wakeup?.requestedByActorId) {
      return wakeup.requestedByActorId;
    }
  }

  // 2. Issue: the user assigned to or who created the issue
  const context = typeof run.contextSnapshot === "object" && run.contextSnapshot !== null
    ? (run.contextSnapshot as Record<string, unknown>)
    : {};

  const rawIssueId = typeof context.issueId === "string" ? context.issueId : null;
  const issueId = rawIssueId && isUuidLike(rawIssueId) ? rawIssueId : null;
  if (issueId) {
    const [issue] = await db
      .select({
        assigneeUserId: issues.assigneeUserId,
        createdByUserId: issues.createdByUserId,
      })
      .from(issues)
      .where(eq(issues.id, issueId));

    if (issue?.assigneeUserId) return issue.assigneeUserId;
    if (issue?.createdByUserId) return issue.createdByUserId;
  }

  // 3. Agent creator fallback (timer runs, A2A, etc.)
  if (agent.createdByUserId) {
    return agent.createdByUserId;
  }

  return null;
}
