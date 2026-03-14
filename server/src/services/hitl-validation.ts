import type { Db } from "@mnm/db";
import {
  stageInstances,
  workflowInstances,
  workflowTemplates,
  type WorkflowStageTemplateDef,
} from "@mnm/db";
import { eq, and, asc } from "drizzle-orm";
import { publishLiveEvent } from "./live-events.js";
import { conflict, notFound } from "../errors.js";
import type {
  HitlDecision,
  HitlValidationRequest,
  PendingValidation,
  LiveEventType,
} from "@mnm/shared";

/** Default roles allowed to approve/reject HITL validations */
const DEFAULT_HITL_ROLES = ["admin", "manager"];

export function hitlValidationService(db: Db) {
  /**
   * Check whether a stage requires HITL validation before completion.
   * Returns false if:
   * - Template not found or hitlRequired is not true
   * - The stage was just approved (hitlDecision.decision === "approved") — prevents infinite loop
   */
  async function shouldRequestValidation(stageId: string): Promise<boolean> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) return false;

    // Strategy A: If last HITL decision was "approved", do not re-trigger
    const lastDecision = stage.hitlDecision as HitlDecision | null;
    if (lastDecision?.decision === "approved") return false;

    // Load template to check hitlRequired
    const templateDef = await loadTemplateDefForStage(stage);
    if (!templateDef) return false;

    return templateDef.hitlRequired === true;
  }

  /**
   * Request validation for a stage — called by the orchestrator when
   * intercepting a "complete" event on a hitlRequired stage.
   * Emits the hitl.validation_requested WebSocket event.
   */
  async function requestValidation(
    stageId: string,
    actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
    },
  ): Promise<HitlValidationRequest> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");

    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, stage.workflowInstanceId));
    if (!workflow) throw notFound("Workflow instance not found");

    const templateDef = await loadTemplateDefForStage(stage);
    const hitlRoles = templateDef?.hitlRoles ?? DEFAULT_HITL_ROLES;
    const outputArtifacts = (stage.outputArtifacts as string[]) ?? [];

    const validationRequest: HitlValidationRequest = {
      stageId: stage.id,
      workflowInstanceId: stage.workflowInstanceId,
      stageName: stage.name,
      workflowName: workflow.name,
      hitlRoles,
      requestedAt: new Date().toISOString(),
      requestedBy: {
        actorId: actor.actorId,
        actorType: actor.actorType,
      },
      outputArtifacts,
    };

    // Emit WebSocket event
    publishLiveEvent({
      companyId: stage.companyId,
      type: "hitl.validation_requested" as LiveEventType,
      payload: validationRequest as unknown as Record<string, unknown>,
    });

    return validationRequest;
  }

  /**
   * Approve a stage that is currently in the "validating" state.
   * Persists the HitlDecision and appends to hitlHistory.
   */
  async function approveStage(
    stageId: string,
    actorId: string,
    actorType: "user" | "agent" | "system",
    comment?: string,
  ): Promise<HitlDecision> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");

    if ((stage.machineState ?? "created") !== "validating") {
      throw conflict("Stage is not in validating state");
    }

    const decision: HitlDecision = {
      decision: "approved",
      actorId,
      actorType,
      comment: comment || undefined,
      decidedAt: new Date().toISOString(),
    };

    // Append to history
    const currentHistory = (stage.hitlHistory as HitlDecision[]) ?? [];
    const updatedHistory = [...currentHistory, decision];

    await db
      .update(stageInstances)
      .set({
        hitlDecision: decision,
        hitlHistory: updatedHistory,
        updatedAt: new Date(),
      })
      .where(eq(stageInstances.id, stageId));

    // Emit WebSocket event
    publishLiveEvent({
      companyId: stage.companyId,
      type: "hitl.approved" as LiveEventType,
      payload: {
        stageId: stage.id,
        workflowInstanceId: stage.workflowInstanceId,
        actorId,
        actorType,
        comment,
        decidedAt: decision.decidedAt,
      },
    });

    return decision;
  }

  /**
   * Reject a stage that is currently in the "validating" state.
   * Feedback is mandatory — throws if empty.
   * Persists the HitlDecision and appends to hitlHistory.
   */
  async function rejectStage(
    stageId: string,
    actorId: string,
    actorType: "user" | "agent" | "system",
    feedback: string,
  ): Promise<HitlDecision> {
    if (!feedback || feedback.trim().length === 0) {
      throw conflict("Feedback is required when rejecting a stage");
    }

    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");

    if ((stage.machineState ?? "created") !== "validating") {
      throw conflict("Stage is not in validating state");
    }

    const decision: HitlDecision = {
      decision: "rejected",
      actorId,
      actorType,
      feedback,
      decidedAt: new Date().toISOString(),
    };

    // Append to history
    const currentHistory = (stage.hitlHistory as HitlDecision[]) ?? [];
    const updatedHistory = [...currentHistory, decision];

    await db
      .update(stageInstances)
      .set({
        hitlDecision: decision,
        hitlHistory: updatedHistory,
        updatedAt: new Date(),
      })
      .where(eq(stageInstances.id, stageId));

    // Emit WebSocket event
    publishLiveEvent({
      companyId: stage.companyId,
      type: "hitl.rejected" as LiveEventType,
      payload: {
        stageId: stage.id,
        workflowInstanceId: stage.workflowInstanceId,
        actorId,
        actorType,
        feedback,
        decidedAt: decision.decidedAt,
      },
    });

    return decision;
  }

  /**
   * List all stages in "validating" state for a given company.
   */
  async function listPendingValidations(companyId: string): Promise<PendingValidation[]> {
    const stages = await db
      .select()
      .from(stageInstances)
      .where(
        and(
          eq(stageInstances.companyId, companyId),
          eq(stageInstances.machineState, "validating"),
        ),
      )
      .orderBy(asc(stageInstances.updatedAt));

    // For each stage, load the workflow name and template info
    const results: PendingValidation[] = [];

    for (const stage of stages) {
      const [workflow] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, stage.workflowInstanceId));

      const templateDef = await loadTemplateDefForStage(stage);
      const hitlRoles = templateDef?.hitlRoles ?? DEFAULT_HITL_ROLES;
      const hitlHistory = (stage.hitlHistory as HitlDecision[]) ?? [];
      const rejectCount = hitlHistory.filter((d) => d.decision === "rejected").length;

      // Determine requestedAt from last "request_validation" transition
      const transitions = (stage.transitionHistory as Array<{ to: string; timestamp: string }>) ?? [];
      const lastValidationTransition = [...transitions]
        .reverse()
        .find((t) => t.to === "validating");
      const requestedAt = lastValidationTransition?.timestamp ?? stage.updatedAt.toISOString();

      results.push({
        stageId: stage.id,
        stageName: stage.name,
        workflowInstanceId: stage.workflowInstanceId,
        workflowName: workflow?.name ?? "Unknown",
        requestedAt,
        hitlRoles,
        outputArtifacts: (stage.outputArtifacts as string[]) ?? [],
        hitlHistory,
        rejectCount,
      });
    }

    return results;
  }

  /**
   * Get the HITL decision history for a specific stage.
   * Returns decisions in chronological order.
   */
  async function getValidationHistory(stageId: string): Promise<HitlDecision[]> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) throw notFound("Stage not found");

    return (stage.hitlHistory as HitlDecision[]) ?? [];
  }

  /**
   * Get the HITL roles configured for a stage's template.
   * Returns default roles if not configured.
   */
  async function getHitlRoles(stageId: string): Promise<string[]> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) return DEFAULT_HITL_ROLES;

    const templateDef = await loadTemplateDefForStage(stage);
    return templateDef?.hitlRoles ?? DEFAULT_HITL_ROLES;
  }

  // ---- Internal helpers ----

  /**
   * Load the WorkflowStageTemplateDef for a given stage instance.
   */
  async function loadTemplateDefForStage(
    stage: typeof stageInstances.$inferSelect,
  ): Promise<WorkflowStageTemplateDef | null> {
    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, stage.workflowInstanceId));
    if (!workflow) return null;

    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, workflow.templateId));
    if (!template) return null;

    const templateStages = template.stages as WorkflowStageTemplateDef[];
    return templateStages.find((s) => s.order === stage.stageOrder) ?? null;
  }

  return {
    shouldRequestValidation,
    requestValidation,
    approveStage,
    rejectStage,
    listPendingValidations,
    getValidationHistory,
    getHitlRoles,
  };
}
