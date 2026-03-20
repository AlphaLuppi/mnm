import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { stageInstances, workflowInstances } from "@mnm/db";
import { conflict, notFound } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { orchestratorService } from "./orchestrator.js";
import type { StageEvent } from "@mnm/shared";

const ALL_STAGE_STATUSES = ["pending", "running", "review", "done", "failed", "skipped"] as const;
type StageStatus = (typeof ALL_STAGE_STATUSES)[number];

// Legacy status -> machine event mapping
const STATUS_TO_EVENT: Record<string, StageEvent> = {
  running: "start",
  review: "request_validation",
  done: "complete",
  failed: "fail",
  skipped: "skip",
  pending: "initialize",
};

type StageRow = typeof stageInstances.$inferSelect;

export function stageService(db: Db) {
  const orchestrator = orchestratorService(db);

  async function getStage(id: string): Promise<StageRow> {
    const [row] = await db.select().from(stageInstances).where(eq(stageInstances.id, id));
    if (!row) throw notFound("Stage not found");
    return row;
  }

  async function listStages(workflowInstanceId: string): Promise<StageRow[]> {
    return db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.workflowInstanceId, workflowInstanceId))
      .orderBy(asc(stageInstances.stageOrder));
  }

  /**
   * Transition a stage using the XState orchestrator.
   * This method maintains backward compatibility by mapping legacy statuses
   * to state machine events.
   */
  async function transitionStage(
    id: string,
    toStatus: StageStatus,
    input?: { agentId?: string | null; outputArtifacts?: string[] },
  ): Promise<StageRow> {
    const stage = await getStage(id);

    const event = STATUS_TO_EVENT[toStatus];
    if (!event) {
      throw conflict(`Cannot map status '${toStatus}' to a machine event`);
    }

    // Handle special case: if stage is in 'created' and we want to go to 'running',
    // we need to first initialize, then start
    const currentMachineState = stage.machineState ?? "created";
    if (toStatus === "running" && currentMachineState === "created") {
      // First initialize, then start
      await orchestrator.transitionStage(id, "initialize", {
        actorId: null,
        actorType: "system",
        companyId: stage.companyId,
      });

      const result = await orchestrator.transitionStage(id, "start", {
        actorId: null,
        actorType: "system",
        companyId: stage.companyId,
      }, {
        outputArtifacts: input?.outputArtifacts,
      });

      // Update agentId if provided (not handled by state machine)
      if (input?.agentId !== undefined) {
        const [updated] = await db
          .update(stageInstances)
          .set({ agentId: input.agentId, updatedAt: new Date() })
          .where(eq(stageInstances.id, id))
          .returning();
        return updated!;
      }

      return result.stage;
    }

    const result = await orchestrator.transitionStage(id, event, {
      actorId: null,
      actorType: "system",
      companyId: stage.companyId,
    }, {
      outputArtifacts: input?.outputArtifacts,
    });

    // Update agentId if provided (not handled by state machine)
    if (input?.agentId !== undefined) {
      const [updated] = await db
        .update(stageInstances)
        .set({ agentId: input.agentId, updatedAt: new Date() })
        .where(eq(stageInstances.id, id))
        .returning();
      return updated!;
    }

    return result.stage;
  }

  async function updateStage(
    id: string,
    input: { agentId?: string | null; activeRunId?: string | null; inputArtifacts?: string[]; outputArtifacts?: string[] },
  ): Promise<StageRow> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.agentId !== undefined) patch.agentId = input.agentId;
    if (input.activeRunId !== undefined) patch.activeRunId = input.activeRunId;
    if (input.inputArtifacts) patch.inputArtifacts = input.inputArtifacts;
    if (input.outputArtifacts) patch.outputArtifacts = input.outputArtifacts;

    const [row] = await db
      .update(stageInstances)
      .set(patch)
      .where(eq(stageInstances.id, id))
      .returning();
    if (!row) throw notFound("Stage not found");
    return row;
  }

  return {
    getStage,
    listStages,
    transitionStage,
    updateStage,
  };
}
