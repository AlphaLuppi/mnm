/**
 * COMP-S03: Compaction Reinjection Service
 *
 * After a kill+relaunch (COMP-S02) or when using the "reinjection" strategy,
 * this service rebuilds and reinjects the compacted context (snapshots,
 * artifacts from previous stages, pre-prompts, acceptance criteria) into the
 * agent so it can resume exactly where the previous one left off.
 *
 * Flow:
 * 1. Load snapshot from DB (via compaction-kill-relaunch)
 * 2. Rebuild recovery context (previous artifacts + pre-prompts + workflow position + AC)
 * 3. Generate a structured Markdown recovery prompt
 * 4. Send it via ChatService (pipe stdin) to the agent
 * 5. Transition stage from `compacting` → `in_progress` via the `reinjected` event
 * 6. Emit audit events and LiveEvents
 *
 * Dependencies: COMP-S01 (CompactionWatcher), COMP-S02 (KillRelaunch), CHAT-S01 (ChatService)
 */

import type { Db } from "@mnm/db";
import { compactionSnapshots } from "@mnm/db";
import { eq, and, desc } from "drizzle-orm";
import type {
  CompactionSnapshot,
  CompactionSnapshotStatus,
  ReinjectionResult,
  ReinjectionHistoryEntry,
  ReinjectionHistoryFilters,
  RecoveryPrompt,
  LiveEventType,
} from "@mnm/shared";
import { compactionKillRelaunchService } from "./compaction-kill-relaunch.js";
import { workflowEnforcerService } from "./workflow-enforcer.js";
import { orchestratorService } from "./orchestrator.js";
import { chatService } from "./chat.js";
import { auditService } from "./audit.js";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

// comp-s03-reinjection-service
export function compactionReinjectionService(db: Db) {
  const killRelaunch = compactionKillRelaunchService(db);
  const enforcer = workflowEnforcerService(db);
  const orchestrator = orchestratorService(db);
  const chat = chatService(db);
  const audit = auditService(db);

  // ========================================================
  // comp-s03-execute-reinjection
  // Main reinjection orchestration
  // ========================================================
  async function executeReinjection(
    companyId: string,
    snapshotId: string,
    actorId: string,
    options?: { autoReinject?: boolean },
  ): Promise<ReinjectionResult> {
    // 1. Load snapshot from DB
    const snapshot = await killRelaunch.getSnapshotFromDb(companyId, snapshotId);
    if (!snapshot) {
      return { success: false, snapshotId, reason: "snapshot_not_found", promptLength: 0 };
    }

    // 2. Update snapshot to processing
    await killRelaunch.updateSnapshotStatus(snapshotId, "processing", {
      reinjectionPhase: "building_prompt",
    });

    // comp-s03-audit-reinjection-started
    audit.emit({
      companyId,
      actorId,
      actorType: "system",
      action: "compaction.reinjection_started",
      targetType: "stage",
      targetId: snapshot.stageId,
      metadata: { snapshotId, agentId: snapshot.agentId, stageOrder: snapshot.stageOrder },
      ipAddress: null,
      userAgent: null,
      severity: "info",
    }).catch((err) => {
      logger.warn({ err }, "CompactionReinjection: failed to emit reinjection_started audit");
    });

    // comp-s03-live-reinjection-started
    publishLiveEvent({
      companyId,
      type: "compaction.reinjection_started" as LiveEventType,
      payload: { snapshotId, stageId: snapshot.stageId, agentId: snapshot.agentId },
    });

    // 3. Build recovery prompt
    // comp-s03-build-recovery-prompt
    const recoveryPrompt = buildRecoveryPrompt(snapshot);
    const promptText = renderRecoveryPrompt(recoveryPrompt);

    // 4. Send prompt to agent via ChatService
    // comp-s03-send-to-agent
    try {
      // Find or create a chat channel for this agent
      const { channels } = await chat.listChannels(companyId, {
        agentId: snapshot.agentId,
        status: "open",
        limit: 1,
      });

      let channelId: string;
      if (channels.length > 0) {
        channelId = channels[0]!.id;
      } else {
        // Create a new channel for the recovery
        const newChannel = await chat.createChannel(companyId, snapshot.agentId, {
          name: `compaction-recovery-${snapshotId.slice(0, 8)}`,
        });
        channelId = newChannel.id;
      }

      // Send the recovery prompt as a system message
      await chat.createMessage(
        channelId,
        companyId,
        "compaction-reinjection",
        "agent",
        promptText,
        {
          type: "compaction_recovery",
          snapshotId,
          stageOrder: snapshot.stageOrder,
        },
        { messageType: "system" },
      );

      logger.info(
        { companyId, snapshotId, agentId: snapshot.agentId, promptLength: promptText.length },
        "CompactionReinjection: recovery prompt sent to agent",
      );
    } catch (err: any) {
      // comp-s03-snapshot-failed
      logger.error({ err, snapshotId }, "CompactionReinjection: failed to send recovery prompt");
      await killRelaunch.updateSnapshotStatus(snapshotId, "failed", {
        error: err.message,
        phase: "send_to_agent",
      });

      // comp-s03-audit-reinjection-failed
      audit.emit({
        companyId,
        actorId,
        actorType: "system",
        action: "compaction.reinjection_failed",
        targetType: "stage",
        targetId: snapshot.stageId,
        metadata: { snapshotId, error: err.message },
        ipAddress: null,
        userAgent: null,
        severity: "error",
      }).catch((auditErr) => {
        logger.warn({ err: auditErr }, "CompactionReinjection: failed to emit reinjection_failed audit");
      });

      return { success: false, snapshotId, reason: "send_failed", promptLength: promptText.length };
    }

    // 5. Transition stage via orchestrator `reinjected` event
    try {
      await orchestrator.transitionStage(
        snapshot.stageId,
        "reinjected",
        { actorId: "compaction-reinjection", actorType: "system", companyId },
        { metadata: { reason: "compaction_reinjection", snapshotId } },
      );
    } catch (err) {
      logger.warn({ err, snapshotId }, "CompactionReinjection: failed to transition stage via reinjected event");
    }

    // 6. Update snapshot to resolved
    // comp-s03-snapshot-resolved
    await killRelaunch.updateSnapshotStatus(snapshotId, "resolved", {
      reinjectionPromptLength: promptText.length,
      reinjectedAt: new Date().toISOString(),
    });

    // comp-s03-audit-reinjection-completed
    audit.emit({
      companyId,
      actorId,
      actorType: "system",
      action: "compaction.reinjection_completed",
      targetType: "stage",
      targetId: snapshot.stageId,
      metadata: {
        snapshotId,
        agentId: snapshot.agentId,
        promptLength: promptText.length,
        stageOrder: snapshot.stageOrder,
      },
      ipAddress: null,
      userAgent: null,
      severity: "info",
    }).catch((err) => {
      logger.warn({ err }, "CompactionReinjection: failed to emit reinjection_completed audit");
    });

    // comp-s03-live-reinjection-completed
    publishLiveEvent({
      companyId,
      type: "compaction.reinjection_completed" as LiveEventType,
      payload: {
        snapshotId,
        stageId: snapshot.stageId,
        agentId: snapshot.agentId,
        promptLength: promptText.length,
      },
    });

    logger.info(
      { companyId, snapshotId, agentId: snapshot.agentId, promptLength: promptText.length },
      "CompactionReinjection: reinjection completed successfully",
    );

    return {
      success: true,
      snapshotId,
      promptLength: promptText.length,
    };
  }

  // ========================================================
  // comp-s03-build-recovery-prompt
  // Build a structured RecoveryPrompt from a CompactionSnapshot
  // ========================================================
  function buildRecoveryPrompt(snapshot: CompactionSnapshot): RecoveryPrompt {
    const sections: RecoveryPrompt["sections"] = [];

    // comp-s03-recovery-workflow-position
    // Section: Recovery Context
    sections.push({
      title: "Recovery Context",
      content: [
        "You are resuming a workflow after a compaction event.",
        `- **Workflow Instance**: ${snapshot.workflowInstanceId}`,
        `- **Current Stage**: ${snapshot.stageOrder + 1} — Stage ID: ${snapshot.stageId}`,
        `- **Compaction detected at**: ${snapshot.detectedAt}`,
        `- **Detection pattern**: ${snapshot.detectionPattern}`,
      ].join("\n"),
    });

    // comp-s03-recovery-previous-artifacts
    // Section: Previous Stage Results
    if (snapshot.previousArtifacts && snapshot.previousArtifacts.length > 0) {
      const artifactLines: string[] = [];
      for (const artifact of snapshot.previousArtifacts) {
        artifactLines.push(`### Stage ${artifact.stageOrder + 1}: ${artifact.stageName}`);
        artifactLines.push(`- Completed at: ${artifact.completedAt ?? "unknown"}`);
        if (artifact.outputArtifacts.length > 0) {
          artifactLines.push(`- Output artifacts: ${artifact.outputArtifacts.join(", ")}`);
        } else {
          artifactLines.push("- Output artifacts: none");
        }
        artifactLines.push("");
      }
      sections.push({
        title: "Previous Stage Results",
        content: artifactLines.join("\n"),
      });
    }

    // comp-s03-recovery-pre-prompts
    // comp-s03-recovery-acceptance-criteria
    // Section: Current Stage
    const currentStageLines: string[] = [];

    if (
      snapshot.prePromptsInjected &&
      snapshot.prePromptsInjected.stagePrePrompts &&
      snapshot.prePromptsInjected.stagePrePrompts.length > 0
    ) {
      currentStageLines.push("### Pre-prompts");
      for (const pp of snapshot.prePromptsInjected.stagePrePrompts) {
        currentStageLines.push(pp);
      }
      currentStageLines.push("");
    }

    if (
      snapshot.prePromptsInjected &&
      snapshot.prePromptsInjected.acceptanceCriteria &&
      snapshot.prePromptsInjected.acceptanceCriteria.length > 0
    ) {
      currentStageLines.push("### Acceptance Criteria");
      for (const ac of snapshot.prePromptsInjected.acceptanceCriteria) {
        currentStageLines.push(`- ${ac}`);
      }
      currentStageLines.push("");
    }

    // comp-s03-recovery-output-so-far
    if (snapshot.outputArtifactsSoFar && snapshot.outputArtifactsSoFar.length > 0) {
      currentStageLines.push("### Output produced before compaction");
      for (const output of snapshot.outputArtifactsSoFar) {
        currentStageLines.push(`- ${output}`);
      }
      currentStageLines.push("");
    }

    if (currentStageLines.length > 0) {
      sections.push({
        title: "Current Stage",
        content: currentStageLines.join("\n"),
      });
    }

    // Section: Instructions
    sections.push({
      title: "Instructions",
      content: [
        "Resume your work on the current stage. The previous stages have been completed",
        "and their results are listed above. Continue from where you left off.",
        "Do NOT re-do work that has already been completed in previous stages.",
      ].join("\n"),
    });

    return {
      workflowInstanceId: snapshot.workflowInstanceId,
      stageId: snapshot.stageId,
      snapshotId: snapshot.id,
      stageOrder: snapshot.stageOrder,
      totalStages: snapshot.prePromptsInjected?.totalStages ?? 0,
      sections,
    };
  }

  // ========================================================
  // renderRecoveryPrompt — convert RecoveryPrompt to Markdown text
  // ========================================================
  // comp-s03-recovery-prompt-sections
  function renderRecoveryPrompt(prompt: RecoveryPrompt): string {
    const lines: string[] = [];
    lines.push("# Compaction Recovery");
    lines.push("");

    for (const section of prompt.sections) {
      lines.push(`## ${section.title}`);
      lines.push(section.content);
      lines.push("");
    }

    return lines.join("\n");
  }

  // ========================================================
  // comp-s03-reinjection-history
  // Get reinjection history (snapshots that used reinjection strategy)
  // ========================================================
  async function getReinjectionHistory(
    companyId: string,
    filters?: ReinjectionHistoryFilters,
  ): Promise<ReinjectionHistoryEntry[]> {
    const conditions = [eq(compactionSnapshots.companyId, companyId)];

    if (filters?.agentId) {
      conditions.push(eq(compactionSnapshots.agentId, filters.agentId));
    }
    if (filters?.workflowInstanceId) {
      conditions.push(eq(compactionSnapshots.workflowInstanceId, filters.workflowInstanceId));
    }
    if (filters?.status) {
      conditions.push(eq(compactionSnapshots.status, filters.status));
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;

    const rows = await db
      .select()
      .from(compactionSnapshots)
      .where(and(...conditions))
      .orderBy(desc(compactionSnapshots.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      snapshotId: row.id,
      companyId: row.companyId,
      workflowInstanceId: row.workflowInstanceId,
      stageId: row.stageId,
      agentId: row.agentId,
      stageOrder: row.stageOrder,
      strategy: row.strategy as CompactionSnapshot["strategy"],
      status: row.status as CompactionSnapshotStatus,
      reinjected: ((row.metadata ?? {}) as Record<string, unknown>).reinjectedAt != null,
      promptLength: ((row.metadata ?? {}) as Record<string, unknown>).reinjectionPromptLength as number | null ?? null,
      detectedAt: row.detectedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  }

  // --- Public API ---
  return {
    executeReinjection,
    buildRecoveryPrompt,
    getReinjectionHistory,
  };
}
