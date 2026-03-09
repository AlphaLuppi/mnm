import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { stageInstances, workflowInstances } from "@mnm/db";
import { conflict, notFound } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";

const ALL_STAGE_STATUSES = ["pending", "running", "review", "done", "failed", "skipped"] as const;
type StageStatus = (typeof ALL_STAGE_STATUSES)[number];

const VALID_TRANSITIONS: Record<string, StageStatus[]> = {
  pending: ["running", "skipped"],
  running: ["review", "done", "failed"],
  review: ["done", "running", "failed"],
  done: [],
  failed: ["running", "pending"],
  skipped: ["pending", "running"],
};

type StageRow = typeof stageInstances.$inferSelect;

export function stageService(db: Db) {
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

  async function transitionStage(
    id: string,
    toStatus: StageStatus,
    input?: { agentId?: string | null; outputArtifacts?: string[] },
  ): Promise<StageRow> {
    const stage = await getStage(id);
    const fromStatus = stage.status as StageStatus;

    const allowed = VALID_TRANSITIONS[fromStatus];
    if (!allowed || !allowed.includes(toStatus)) {
      throw conflict(`Cannot transition stage from '${fromStatus}' to '${toStatus}'`);
    }

    const patch: Record<string, unknown> = {
      status: toStatus,
      updatedAt: new Date(),
    };

    if (toStatus === "running" && !stage.startedAt) {
      patch.startedAt = new Date();
    }
    if (toStatus === "done") {
      patch.completedAt = new Date();
    }
    if (input?.agentId !== undefined) {
      patch.agentId = input.agentId;
    }
    if (input?.outputArtifacts) {
      patch.outputArtifacts = input.outputArtifacts;
    }

    const [updated] = await db
      .update(stageInstances)
      .set(patch)
      .where(eq(stageInstances.id, id))
      .returning();

    publishLiveEvent({
      companyId: stage.companyId,
      type: "stage.transitioned",
      payload: { stageId: id, workflowId: stage.workflowInstanceId, from: fromStatus, to: toStatus },
    });

    // Auto-advance: if stage completed and next stage has autoTransition, start it
    if (toStatus === "done") {
      await maybeAdvanceNext(stage.workflowInstanceId, stage.stageOrder, stage.companyId);
    }

    return updated!;
  }

  async function maybeAdvanceNext(workflowInstanceId: string, currentOrder: number, companyId: string): Promise<void> {
    const stages = await listStages(workflowInstanceId);
    const nextStage = stages.find((s) => s.stageOrder === currentOrder + 1);

    if (!nextStage) {
      // All stages done — complete the workflow
      const allDone = stages.every((s) => s.status === "done" || s.status === "skipped");
      if (allDone) {
        await db
          .update(workflowInstances)
          .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
          .where(eq(workflowInstances.id, workflowInstanceId));

        publishLiveEvent({ companyId, type: "workflow.completed", payload: { workflowId: workflowInstanceId } });
      }
      return;
    }

    if (nextStage.status !== "pending") return;

    const isAuto = nextStage.autoTransition === "true";
    if (isAuto) {
      await transitionStage(nextStage.id, "running");
    } else {
      // Move to "review" state so the user can manually advance
      // Actually, keep it pending — user must explicitly start it
    }
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
