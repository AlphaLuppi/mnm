/**
 * II-07: Inbox notification helpers for dual-write migration.
 *
 * Phase 1 (current): dual-write — existing systems continue to work AND
 * inbox_items are also created for the "Agent Notifications" section.
 *
 * Phase 2 (future): deprecate old category-specific queries in Inbox.tsx
 * and use inbox_items as the single source of truth for all notification types.
 *
 * Migration plan:
 * 1. [DONE] Failed runs → cao-watchdog creates inbox_items (II-06)
 * 2. [DONE] Approvals → approval route creates inbox_items (II-07)
 * 3. [FUTURE] Remove failed_runs section from Inbox.tsx, use only inbox_items
 * 4. [FUTURE] Remove approvals section from Inbox.tsx, use only inbox_items
 * 5. [FUTURE] Join requests, stale work, alerts → migrate to inbox_items
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { companyMemberships, inboxItems } from "@mnm/db";
import type { ContentDocument } from "@mnm/shared";
import { logger } from "../middleware/logger.js";

/**
 * Find all active human users in a company.
 */
async function findActiveUsers(db: Db, companyId: string): Promise<string[]> {
  const members = await db
    .select({ principalId: companyMemberships.principalId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.status, "active"),
      ),
    );
  return members.map((m) => m.principalId);
}

interface ApprovalNotificationInput {
  companyId: string;
  approvalId: string;
  approvalType: string;
  requestedByAgentId: string | null;
  agentName: string | null;
  payload: Record<string, unknown>;
}

/**
 * Create inbox_items for all active users when an approval request is created.
 * Non-fatal: errors are logged but don't block the approval flow.
 */
export async function notifyApprovalCreated(
  db: Db,
  input: ApprovalNotificationInput,
): Promise<void> {
  try {
    const users = await findActiveUsers(db, input.companyId);
    if (users.length === 0) return;

    const typeLabel = input.approvalType.replace(/_/g, " ");
    const agentLabel = input.agentName ?? "An agent";
    const payloadName = typeof input.payload.name === "string" ? input.payload.name : null;

    const contentBlocks: ContentDocument = {
      schemaVersion: 1,
      blocks: [
        {
          type: "status-badge" as const,
          variant: "warning" as const,
          text: `Pending approval: ${typeLabel}`,
        },
        {
          type: "markdown" as const,
          content: payloadName
            ? `**${agentLabel}** requests approval to ${typeLabel}: **${payloadName}**`
            : `**${agentLabel}** requests approval: ${typeLabel}`,
        },
        {
          type: "stack" as const,
          direction: "horizontal" as const,
          gap: "sm" as const,
          children: [
            {
              type: "action-button" as const,
              label: "Review & Approve",
              action: "navigate",
              variant: "default" as const,
              payload: { href: `/approvals/${input.approvalId}` },
            },
            {
              type: "action-button" as const,
              label: "Dismiss",
              action: "dismiss",
              variant: "ghost" as const,
            },
          ],
        },
      ],
    };

    const title = payloadName
      ? `Approval needed — ${typeLabel}: ${payloadName}`
      : `Approval needed — ${typeLabel}`;

    const body = payloadName
      ? `${agentLabel} requests approval to ${typeLabel}: ${payloadName}`
      : `${agentLabel} requests approval: ${typeLabel}`;

    const values = users.map((userId) => ({
      companyId: input.companyId,
      recipientId: userId,
      senderAgentId: input.requestedByAgentId,
      title: title.slice(0, 300),
      body,
      contentBlocks,
      category: "approval" as const,
      priority: "normal" as const,
      relatedAgentId: input.requestedByAgentId,
    }));

    await db.insert(inboxItems).values(values);

    logger.info(
      { companyId: input.companyId, approvalId: input.approvalId, recipientCount: users.length },
      "Inbox notifications created for approval",
    );
  } catch (err) {
    logger.error({ err, approvalId: input.approvalId }, "Failed to create inbox notifications for approval");
  }
}
