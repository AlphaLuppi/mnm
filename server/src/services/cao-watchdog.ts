import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agents, heartbeatRuns, issues } from "@mnm/db";
import { subscribeAllLiveEvents } from "./live-events.js";
import { issueService } from "./issues.js";
import { logger } from "../middleware/logger.js";
import type { LiveEvent } from "@mnm/shared";

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

    // No issue linked → nothing to comment on
    if (!issueId) return;

    // Verify issue exists
    const [issue] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (!issue) return;

    // Load agent name
    const [agent] = await db
      .select({ name: agents.name })
      .from(agents)
      .where(eq(agents.id, agentId));
    const agentName = agent?.name ?? "Unknown";

    // Compose and post the watchdog comment
    const svc = issueService(db);
    const body = formatWatchdogComment(
      agentName,
      status,
      (payload.error as string) ?? null,
      (payload.errorCode as string) ?? null,
      (payload.startedAt as string) ?? null,
      (payload.finishedAt as string) ?? null,
    );

    await svc.addComment(issueId, body, { agentId: caoId });

    logger.info(
      { companyId, caoId, runId, agentId, issueId, status },
      "CAO watchdog posted anomaly comment",
    );
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
