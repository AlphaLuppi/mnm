import type { Db } from "@mnm/db";
import { stageInstances, workflowInstances } from "@mnm/db";
import { eq, and, asc } from "drizzle-orm";
import { transition as xstateTransition } from "xstate";
import {
  stageMachine,
  buildMachineEvent,
  eventToEmitType,
  type StageGuardInput,
} from "./workflow-state-machine.js";
import { publishLiveEvent } from "./live-events.js";
import { accessService } from "./access.js";
import { conflict, forbidden, notFound } from "../errors.js";
import type {
  StageState,
  StageEvent,
  StageContext,
  TransitionRecord,
  OrchestratorEvent,
  WorkflowState,
  LiveEventType,
  PermissionKey,
} from "@mnm/shared";

// Mapping machine_state -> legacy status (backward compat)
const STATE_TO_LEGACY_STATUS: Record<StageState, string> = {
  created: "pending",
  ready: "pending",
  in_progress: "running",
  validating: "review",
  paused: "pending",
  failed: "failed",
  compacting: "running",
  completed: "done",
  terminated: "failed",
  skipped: "skipped",
};

// Permission keys used by guards
const PERM_WORKFLOWS_ENFORCE: PermissionKey = "workflows:enforce";
const PERM_AGENTS_LAUNCH: PermissionKey = "agents:launch";

export function orchestratorService(db: Db) {
  const access = accessService(db);

  // ---- Stage Transitions ----

  async function transitionStage(
    stageId: string,
    event: StageEvent,
    actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
      userId?: string | null;
    },
    payload?: {
      error?: string;
      feedback?: string;
      outputArtifacts?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<{
    stage: typeof stageInstances.$inferSelect;
    fromState: StageState;
    toState: StageState;
  }> {
    // 1. Load stage from DB
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");

    const fromState = (stage.machineState ?? "created") as StageState;

    // 2. Pre-evaluate RBAC guards for non-system actors
    const needsGuard = [
      "initialize", "start", "pause", "approve", "reject_with_feedback",
      "resume", "retry", "terminate", "skip",
    ].includes(event);

    if (needsGuard && actor.actorType !== "system") {
      const requiredPermission = getRequiredPermission(event);
      if (requiredPermission) {
        let hasPermission = false;
        if (actor.actorType === "user" && (actor.userId || actor.actorId)) {
          hasPermission = await access.canUser(
            stage.companyId,
            actor.userId ?? actor.actorId!,
            requiredPermission,
          );
        } else if (actor.actorType === "agent" && actor.actorId) {
          hasPermission = await access.hasPermission(
            stage.companyId,
            "agent",
            actor.actorId,
            requiredPermission,
          );
        }
        if (!hasPermission) {
          throw forbidden(
            `Permission '${requiredPermission}' required for '${event}' transition`,
          );
        }
      }

      // Check retry count for canRetry guard
      if (event === "retry") {
        const retryCount = stage.retryCount ?? 0;
        const maxRetries = stage.maxRetries ?? 3;
        if (retryCount >= maxRetries) {
          throw conflict(
            `Cannot retry: retry count (${retryCount}) has reached maximum (${maxRetries})`,
          );
        }
      }
    }

    // Also check retry count for system actors
    if (event === "retry" && actor.actorType === "system") {
      const retryCount = stage.retryCount ?? 0;
      const maxRetries = stage.maxRetries ?? 3;
      if (retryCount >= maxRetries) {
        throw conflict(
          `Cannot retry: retry count (${retryCount}) has reached maximum (${maxRetries})`,
        );
      }
    }

    // 3. Build context from DB state
    const context: StageContext = {
      stageId: stage.id,
      workflowInstanceId: stage.workflowInstanceId,
      companyId: stage.companyId,
      stageOrder: stage.stageOrder,
      retryCount: stage.retryCount ?? 0,
      maxRetries: stage.maxRetries ?? 3,
      lastError: stage.lastError ?? null,
      lastActorId: stage.lastActorId ?? null,
      lastActorType: (stage.lastActorType as "user" | "agent" | "system" | null) ?? null,
      feedback: stage.feedback ?? null,
      outputArtifacts: (stage.outputArtifacts as string[]) ?? [],
      transitionHistory: (stage.transitionHistory as TransitionRecord[]) ?? [],
    };

    // 4. Build guard input (permission already validated above)
    const guardInput: StageGuardInput = {
      actorId: actor.actorId,
      actorType: actor.actorType,
      companyId: actor.companyId || stage.companyId,
      hasPermission: async () => true, // pre-validated above
      metadata: payload?.metadata,
    };

    // 5. Build the event object
    const machineEvent = buildMachineEvent(event, guardInput, payload);

    // 6. Use XState to evaluate the transition (stateless, pure function)
    // Resolve the current state from DB values
    const currentSnapshot = stageMachine.resolveState({
      value: fromState,
      context,
    });

    // Compute the next state using XState's pure transition function
    const [nextSnapshot] = xstateTransition(stageMachine, currentSnapshot, machineEvent);

    const toState = typeof nextSnapshot.value === "string"
      ? nextSnapshot.value as StageState
      : fromState;

    // If state didn't change, the transition was refused by the machine
    if (toState === fromState) {
      throw conflict(
        `Cannot transition stage from '${fromState}' via '${event}': transition not allowed`,
      );
    }

    // 7. Build transition record
    const transitionRecord: TransitionRecord = {
      from: fromState,
      to: toState,
      event,
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: new Date().toISOString(),
      metadata: payload?.metadata,
    };

    // 8. Persist to DB
    const patch: Record<string, unknown> = {
      machineState: toState,
      status: STATE_TO_LEGACY_STATUS[toState] ?? "pending",
      lastActorId: actor.actorId,
      lastActorType: actor.actorType,
      transitionHistory: [...context.transitionHistory, transitionRecord],
      updatedAt: new Date(),
    };

    // State-specific fields
    if (toState === "in_progress" && !stage.startedAt) {
      patch.startedAt = new Date();
    }
    if (toState === "completed") {
      patch.completedAt = new Date();
    }
    if (toState === "failed" && payload?.error) {
      patch.lastError = payload.error;
    }
    if (event === "retry") {
      patch.retryCount = (stage.retryCount ?? 0) + 1;
      patch.lastError = null;
    }
    if (event === "approve") {
      patch.feedback = null;
    }
    if (event === "reject_with_feedback" && payload?.feedback !== undefined) {
      patch.feedback = payload.feedback;
    }
    if (payload?.outputArtifacts) {
      patch.outputArtifacts = payload.outputArtifacts;
    }

    const [updated] = await db
      .update(stageInstances)
      .set(patch)
      .where(eq(stageInstances.id, stageId))
      .returning();

    // 9. Emit orchestrator event
    const emitType = eventToEmitType(event, toState);
    const orchestratorEvent: OrchestratorEvent = {
      type: `stage.${emitType}`,
      companyId: stage.companyId,
      workflowInstanceId: stage.workflowInstanceId,
      stageId: stage.id,
      fromState,
      toState,
      event,
      actorId: actor.actorId,
      actorType: actor.actorType,
      metadata: payload?.metadata,
      timestamp: new Date().toISOString(),
    };

    publishLiveEvent({
      companyId: stage.companyId,
      type: orchestratorEvent.type as LiveEventType,
      payload: orchestratorEvent as unknown as Record<string, unknown>,
    });

    // 10. Handle workflow-level state changes
    await updateWorkflowStateAfterTransition(stage.workflowInstanceId, toState, actor);

    // 11. Auto-advance next stage if completed
    if (toState === "completed") {
      await maybeAdvanceNextStage(stage.workflowInstanceId, stage.stageOrder, stage.companyId);
    }

    return { stage: updated!, fromState, toState };
  }

  // ---- Workflow-level State ----

  async function updateWorkflowStateAfterTransition(
    workflowInstanceId: string,
    stageState: StageState,
    actor: { actorId: string | null; actorType: string },
  ): Promise<void> {
    const stages = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.workflowInstanceId, workflowInstanceId))
      .orderBy(asc(stageInstances.stageOrder));

    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowInstanceId));
    if (!workflow) return;

    let newWorkflowState: WorkflowState | null = null;
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    // Check stage states
    const allFinal = stages.every((s) =>
      ["completed", "terminated", "skipped"].includes(s.machineState ?? s.status),
    );
    const anyFailed = stages.some((s) =>
      ["failed", "terminated"].includes(s.machineState ?? s.status),
    );
    const anyPaused = stages.some((s) =>
      (s.machineState ?? s.status) === "paused",
    );

    if (allFinal && !anyFailed) {
      newWorkflowState = "completed";
      patch.completedAt = new Date();
    } else if (allFinal && anyFailed) {
      newWorkflowState = "failed";
      patch.failedAt = new Date();
    } else if (stageState === "terminated" && anyFailed) {
      newWorkflowState = "failed";
      patch.failedAt = new Date();
    } else if (anyPaused && workflow.workflowState !== "paused") {
      newWorkflowState = "paused";
      patch.pausedAt = new Date();
    }

    if (newWorkflowState && newWorkflowState !== workflow.workflowState) {
      patch.workflowState = newWorkflowState;
      patch.status = newWorkflowState; // legacy sync
      patch.lastActorId = actor.actorId;
      patch.lastActorType = actor.actorType;

      await db
        .update(workflowInstances)
        .set(patch)
        .where(eq(workflowInstances.id, workflowInstanceId));

      publishLiveEvent({
        companyId: workflow.companyId,
        type: `workflow.${newWorkflowState}` as LiveEventType,
        payload: { workflowId: workflowInstanceId, state: newWorkflowState },
      });
    }
  }

  async function maybeAdvanceNextStage(
    workflowInstanceId: string,
    currentOrder: number,
    companyId: string,
  ): Promise<void> {
    const stages = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.workflowInstanceId, workflowInstanceId))
      .orderBy(asc(stageInstances.stageOrder));

    const nextStage = stages.find((s) => s.stageOrder === currentOrder + 1);
    if (!nextStage) return;

    const nextState = (nextStage.machineState ?? "created") as StageState;
    if (nextState !== "created") return;

    // Auto-initialize the next stage
    await transitionStage(nextStage.id, "initialize", {
      actorId: null,
      actorType: "system",
      companyId,
    });

    // If autoTransition, also start it
    const isAuto = nextStage.autoTransition === "true";
    if (isAuto) {
      await transitionStage(nextStage.id, "start", {
        actorId: null,
        actorType: "system",
        companyId,
      });
    }
  }

  // ---- Query helpers ----

  async function getStageWithState(stageId: string) {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");
    return {
      ...stage,
      machineState: (stage.machineState ?? "created") as StageState,
      transitionHistory: (stage.transitionHistory as TransitionRecord[]) ?? [],
    };
  }

  async function getWorkflowWithState(workflowInstanceId: string) {
    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowInstanceId));
    if (!workflow) throw notFound("Workflow instance not found");

    const stages = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.workflowInstanceId, workflowInstanceId))
      .orderBy(asc(stageInstances.stageOrder));

    return {
      ...workflow,
      workflowState: (workflow.workflowState ?? "draft") as WorkflowState,
      stages: stages.map((s) => ({
        ...s,
        machineState: (s.machineState ?? "created") as StageState,
        transitionHistory: (s.transitionHistory as TransitionRecord[]) ?? [],
      })),
    };
  }

  async function listWorkflowsByState(
    companyId: string,
    state?: WorkflowState,
  ) {
    const conditions = [eq(workflowInstances.companyId, companyId)];
    if (state) {
      conditions.push(eq(workflowInstances.workflowState, state));
    }
    return db
      .select()
      .from(workflowInstances)
      .where(and(...conditions));
  }

  async function listStagesByState(
    workflowInstanceId: string,
    state?: StageState,
  ) {
    const conditions = [eq(stageInstances.workflowInstanceId, workflowInstanceId)];
    if (state) {
      conditions.push(eq(stageInstances.machineState, state));
    }
    return db
      .select()
      .from(stageInstances)
      .where(and(...conditions))
      .orderBy(asc(stageInstances.stageOrder));
  }

  return {
    transitionStage,
    getStageWithState,
    getWorkflowWithState,
    listWorkflowsByState,
    listStagesByState,
    updateWorkflowStateAfterTransition,
  };
}

// ---- Helpers ----

/**
 * Determine which permission key is required for a given event.
 */
function getRequiredPermission(event: StageEvent): PermissionKey | null {
  switch (event) {
    case "initialize":
    case "pause":
    case "approve":
    case "reject_with_feedback":
    case "resume":
    case "retry":
    case "terminate":
    case "skip":
      return PERM_WORKFLOWS_ENFORCE;
    case "start":
      return PERM_AGENTS_LAUNCH;
    default:
      return null;
  }
}
