import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agents, heartbeatRuns, issues, inboxItems } from "@mnm/db";
import { subscribeAllLiveEvents } from "./live-events.js";
import { issueService } from "./issues.js";
import { logger } from "../middleware/logger.js";
import type { LiveEvent, ContentDocument } from "@mnm/shared";

/**
 * CAO-03: Watchdog Mode
 *
 * The CAO monitors agent run events and auto-comments on issues when anomalies
 * are detected (failures, timeouts). Comments are posted as the CAO agent.
 *
 * Anomaly rules:
 * - Run failed → comment with error summary
 * - Run timed out → comment with timeout info
 * - Run cancelled → comment noting cancellation
 *
 * The watchdog is a global listener (receives events from all companies).
 * It resolves the CAO agent per-company to post comments as the correct agent.
 */

// Cache CAO agent IDs per company to avoid repeated JSONB scans
const caoCache = new Map<string, string | null>();

async function resolveCaoId(db: Db, companyId: string): Promise<string | null> {
  const cached = caoCache.get(companyId);
  if (cached !== undefined) return cached;

  const allAgents = await db
    .select({ id: agents.id, metadata: agents.metadata })
    .from(agents)
    .where(eq(agents.companyId, companyId));
  const cao = allAgents.find((a) => (a.metadata as Record<string, unknown>)?.isCAO === true);
  const caoId = cao?.id ?? null;
  caoCache.set(companyId, caoId);
  return caoId;
}

function formatWatchdogComment(
  agentName: string,
  status: string,
  error: string | null,
  errorCode: string | null,
  startedAt: string | null,
  finishedAt: string | null,
): string {
  const icon = status === "timed_out" ? "⏱" : status === "cancelled" ? "🚫" : "⚠️";
  const statusLabel = status.replace(/_/g, " ");

  let duration = "";
  if (startedAt && finishedAt) {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const sec = Math.round(ms / 1000);
    duration = sec > 60 ? ` (${Math.round(sec / 60)}m ${sec % 60}s)` : ` (${sec}s)`;
  }

  let body = `${icon} **CAO Watchdog** — Agent **${agentName}** run ${statusLabel}${duration}\n\n`;

  if (error) {
    // Truncate very long errors
    const truncatedError = error.length > 500 ? error.slice(0, 500) + "…" : error;
    body += `**Error:** ${truncatedError}\n\n`;
  }

  if (errorCode) {
    body += `**Code:** \`${errorCode}\`\n\n`;
  }

  if (status === "timed_out") {
    body += `> The agent exceeded the allowed execution time. Consider increasing the timeout or simplifying the task.\n`;
  } else if (status === "failed") {
    body += `> Review the error above. Common causes: missing permissions, invalid configuration, or environment issues.\n`;
  }

  return body;
}

/**
 * Build a rich ContentDocument for a failed run inbox notification.
 */
function buildFailedRunBlocks(
  agentName: string,
  status: string,
  error: string | null,
  errorCode: string | null,
  startedAt: string | null,
  finishedAt: string | null,
  runId: string,
): ContentDocument {
  const statusLabel = status.replace(/_/g, " ");

  let duration = "—";
  if (startedAt && finishedAt) {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const sec = Math.round(ms / 1000);
    duration = sec > 60 ? `${Math.round(sec / 60)}m ${sec % 60}s` : `${sec}s`;
  }

  // Truncate error for code block display (~20 lines)
  const errorText = error ?? "No error details available.";
  const errorLines = errorText.split("\n");
  const truncatedError = errorLines.length > 20
    ? errorLines.slice(0, 20).join("\n") + `\n… (${errorLines.length - 20} more lines)`
    : errorText;

  const blocks: ContentDocument["blocks"] = [
    // Status + agent info
    {
      type: "stack" as const,
      direction: "horizontal" as const,
      gap: "sm" as const,
      children: [
        { type: "status-badge" as const, variant: "error" as const, text: statusLabel },
        { type: "status-badge" as const, variant: "info" as const, text: agentName },
      ],
    },
    // Metrics row
    {
      type: "stack" as const,
      direction: "horizontal" as const,
      gap: "md" as const,
      children: [
        { type: "metric-card" as const, label: "Status", value: statusLabel },
        { type: "metric-card" as const, label: "Duration", value: duration },
        ...(errorCode ? [{ type: "metric-card" as const, label: "Error Code", value: errorCode }] : []),
      ],
    },
    // Error details
    { type: "code-block" as const, title: "Error Details", code: truncatedError },
    // Action buttons
    {
      type: "stack" as const,
      direction: "horizontal" as const,
      gap: "sm" as const,
      children: [
        {
          type: "action-button" as const,
          label: "Retry Run",
          action: "retry_run",
          variant: "outline" as const,
          payload: { runId },
        },
        {
          type: "action-button" as const,
          label: "Dismiss",
          action: "dismiss",
          variant: "ghost" as const,
        },
      ],
    },
  ];

  return { schemaVersion: 1, blocks };
}

async function handleRunStatus(db: Db, event: LiveEvent): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const status = payload.status as string;

  // Only react to terminal failure states
  if (status !== "failed" && status !== "timed_out" && status !== "cancelled") return;

  const runId = payload.runId as string;
  const agentId = payload.agentId as string;
  const companyId = event.companyId;

  // Resolve the CAO agent for this company
  const caoId = await resolveCaoId(db, companyId);
  if (!caoId) return; // No CAO → skip

  // Don't comment on the CAO's own failures (avoid feedback loop)
  if (agentId === caoId) return;

  try {
    // Load the run to get the issue context
    const [run] = await db
      .select({ contextSnapshot: heartbeatRuns.contextSnapshot })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId));

    if (!run) return;

    const context = typeof run.contextSnapshot === "object" && run.contextSnapshot !== null
      ? (run.contextSnapshot as Record<string, unknown>)
      : {};
    const issueId = typeof context.issueId === "string" ? context.issueId : null;

    // Load agent data (name + creator for inbox notification)
    const [agent] = await db
      .select({ name: agents.name, createdByUserId: agents.createdByUserId })
      .from(agents)
      .where(eq(agents.id, agentId));
    const agentName = agent?.name ?? "Unknown";

    const errorStr = (payload.error as string) ?? null;
    const errorCode = (payload.errorCode as string) ?? null;
    const startedAt = (payload.startedAt as string) ?? null;
    const finishedAt = (payload.finishedAt as string) ?? null;

    // --- II-06: Create rich inbox item for the agent's creator ---
    if (agent?.createdByUserId) {
      try {
        const contentBlocks = buildFailedRunBlocks(
          agentName, status, errorStr, errorCode, startedAt, finishedAt, runId,
        );
        const plainBody = formatWatchdogComment(agentName, status, errorStr, errorCode, startedAt, finishedAt);

        await db.insert(inboxItems).values({
          companyId,
          recipientId: agent.createdByUserId,
          senderAgentId: caoId,
          title: `Run failed — ${agentName}`,
          body: plainBody,
          contentBlocks,
          category: "failed_run",
          priority: "high",
          relatedAgentId: agentId,
          relatedIssueId: issueId,
        });

        logger.info(
          { companyId, agentId, runId, recipientId: agent.createdByUserId },
          "Rich inbox notification created for failed run",
        );
      } catch (inboxErr) {
        // Non-fatal — don't block the watchdog comment
        logger.error({ err: inboxErr, runId, agentId }, "Failed to create inbox notification for failed run");
      }
    }

    // --- AF-04: Enriched watchdog comment on issue with content blocks ---
    if (issueId) {
      // Verify issue exists
      const [issue] = await db
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.id, issueId));

      if (issue) {
        const svc = issueService(db);
        const body = formatWatchdogComment(agentName, status, errorStr, errorCode, startedAt, finishedAt);
        let commentBlocks: ContentDocument | undefined;
        try {
          commentBlocks = buildFailedRunBlocks(agentName, status, errorStr, errorCode, startedAt, finishedAt, runId);
        } catch {
          // If block construction fails, fall back to body-only
        }
        await svc.addComment(issueId, body, { agentId: caoId }, commentBlocks);

        logger.info(
          { companyId, caoId, runId, agentId, issueId, status },
          "CAO watchdog posted enriched anomaly comment",
        );
      }
    }
  } catch (err) {
    // Watchdog should never crash the server
    logger.error({ err, runId, agentId, companyId }, "CAO watchdog error");
  }
}

/**
 * Start the CAO watchdog. Call once at server startup.
 * Returns an unsubscribe function for graceful shutdown.
 */
export function startCaoWatchdog(db: Db): () => void {
  logger.info("CAO watchdog started — monitoring agent run anomalies");

  const unsubscribe = subscribeAllLiveEvents((event) => {
    if (event.type === "heartbeat.run.status") {
      // Fire-and-forget — don't block the event bus
      handleRunStatus(db, event).catch((err) => {
        logger.error({ err }, "CAO watchdog unhandled error");
      });
    }
  });

  return unsubscribe;
}

/** Clear the CAO ID cache (useful after bootstrap or tests). */
export function clearCaoCache(): void {
  caoCache.clear();
}
