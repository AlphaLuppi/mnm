import { eq, or, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "recovery" });

export interface RecoverySummary {
  orphanedAgents: number;
  releasedLocks: number;
}

export function recoverFromCrash(): RecoverySummary {
  const db = getDb();
  const now = Date.now();

  // Find orphaned agents (still marked as running/paused but server restarted)
  const orphaned = db
    .select()
    .from(schema.agents)
    .where(
      or(
        eq(schema.agents.status, "running"),
        eq(schema.agents.status, "paused")
      )
    )
    .all();

  for (const agent of orphaned) {
    db.update(schema.agents)
      .set({
        status: "error",
        errorMessage: "Agent terminated due to server restart",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.agents.id, agent.id))
      .run();
  }

  // Release all orphaned locks
  const activeLocks = db
    .select()
    .from(schema.fileLocks)
    .where(isNull(schema.fileLocks.releasedAt))
    .all();

  if (activeLocks.length > 0) {
    db.update(schema.fileLocks)
      .set({ releasedAt: now })
      .where(isNull(schema.fileLocks.releasedAt))
      .run();
  }

  const summary: RecoverySummary = {
    orphanedAgents: orphaned.length,
    releasedLocks: activeLocks.length,
  };

  if (summary.orphanedAgents > 0 || summary.releasedLocks > 0) {
    log.info(summary, "Startup recovery complete");
  }

  return summary;
}
