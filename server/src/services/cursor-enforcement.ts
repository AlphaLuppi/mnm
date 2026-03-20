/**
 * DUAL-S03: Cursor Enforcement Service
 *
 * Integrates automation cursors into the orchestrator transition flow.
 * Before each agent-initiated transition, resolves the effective cursor
 * and applies restrictions:
 *
 * - manual: agent transitions are BLOCKED — only human can advance
 * - assisted: agent transitions are redirected to HITL validation
 * - auto: agent is free — no additional restrictions
 *
 * Only actorType="agent" is subject to cursor enforcement.
 * Human (user) and system transitions are always allowed.
 */

import type { Db } from "@mnm/db";
import { stageInstances, workflowInstances } from "@mnm/db";
import { eq } from "drizzle-orm";
import { automationCursorService } from "./automation-cursors.js";
import { auditService } from "./audit.js";
import { publishLiveEvent } from "./live-events.js";
import type {
  StageEvent,
  CursorEnforcementResult,
  EffectiveCursor,
  LiveEventType,
} from "@mnm/shared";

// dual-s03-enforce-cursor-fn
export function cursorEnforcementService(db: Db) {
  const cursorSvc = automationCursorService(db);
  const audit = auditService(db);

  /**
   * Evaluate cursor enforcement for a stage transition.
   *
   * @param stageId - The stage being transitioned
   * @param event - The transition event
   * @param actor - The actor initiating the transition
   * @returns CursorEnforcementResult indicating whether the transition is allowed
   */
  // dual-s03-enforce-cursor-fn
  async function enforceCursor(
    stageId: string,
    event: StageEvent,
    actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
    },
  ): Promise<CursorEnforcementResult> {
    // dual-s03-agent-only-guard
    // Only enforce cursor restrictions for agent actors
    if (actor.actorType !== "agent") {
      // dual-s03-auto-allow (non-agent actors always allowed)
      const defaultCursor: EffectiveCursor = {
        position: "auto",
        ceiling: "auto",
        resolvedFrom: "company",
        hierarchy: [],
      };
      return {
        allowed: true,
        position: "auto",
        effectiveCursor: defaultCursor,
      };
    }

    // Load stage from DB
    // dual-s03-resolve-effective-call
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));

    if (!stage) {
      // Missing stage — allow to let downstream handle the error
      const defaultCursor: EffectiveCursor = {
        position: "auto",
        ceiling: "auto",
        resolvedFrom: "company",
        hierarchy: [],
      };
      return {
        allowed: true,
        position: "auto",
        effectiveCursor: defaultCursor,
      };
    }

    // Load workflow to get projectId
    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, stage.workflowInstanceId));

    const projectId = workflow?.projectId ?? undefined;
    const agentId = stage.agentId ?? undefined;

    // Resolve the effective cursor position using the hierarchy
    const effectiveCursor = await cursorSvc.resolveEffective(
      stage.companyId,
      {
        level: "agent",
        targetId: agentId,
        agentId,
        projectId,
      },
    );

    const position = effectiveCursor.position;

    // dual-s03-manual-block
    // Manual: agent cannot advance — blocked
    if (position === "manual") {
      // dual-s03-audit-emit
      await audit.emit({
        companyId: stage.companyId,
        actorId: actor.actorId ?? "system",
        actorType: "agent",
        action: "cursor_enforcement.blocked",
        targetType: "stage_instance",
        targetId: stageId,
        metadata: {
          event,
          position,
          agentId,
          projectId,
          hierarchy: effectiveCursor.hierarchy,
        },
        severity: "warning",
      });

      // dual-s03-live-event-blocked
      publishLiveEvent({
        companyId: stage.companyId,
        type: "cursor_enforcement.blocked" as LiveEventType,
        payload: {
          stageId,
          workflowInstanceId: stage.workflowInstanceId,
          event,
          position,
          agentId,
          projectId,
        },
      });

      return {
        allowed: false,
        position,
        reason: `Cursor position is "manual": agent transitions are blocked. Only a human user can advance this stage.`,
        redirectToHitl: false,
        effectiveCursor,
      };
    }

    // dual-s03-assisted-hitl-redirect
    // Assisted: agent can request transition, but it must go through HITL
    if (position === "assisted") {
      // dual-s03-audit-emit
      await audit.emit({
        companyId: stage.companyId,
        actorId: actor.actorId ?? "system",
        actorType: "agent",
        action: "cursor_enforcement.hitl_required",
        targetType: "stage_instance",
        targetId: stageId,
        metadata: {
          event,
          position,
          agentId,
          projectId,
          hierarchy: effectiveCursor.hierarchy,
        },
        severity: "info",
      });

      // dual-s03-live-event-hitl
      publishLiveEvent({
        companyId: stage.companyId,
        type: "cursor_enforcement.hitl_required" as LiveEventType,
        payload: {
          stageId,
          workflowInstanceId: stage.workflowInstanceId,
          event,
          position,
          agentId,
          projectId,
        },
      });

      return {
        allowed: true,
        position,
        reason: `Cursor position is "assisted": transition will be routed through HITL validation.`,
        redirectToHitl: true,
        effectiveCursor,
      };
    }

    // dual-s03-auto-allow
    // Auto: no restrictions — agent is free
    return {
      allowed: true,
      position,
      effectiveCursor,
    };
  }

  return {
    enforceCursor,
  };
}
