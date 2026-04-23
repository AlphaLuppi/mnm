/**
 * HITL Validation Service — stub after legacy workflow nuke (U1).
 *
 * The HITL validation system was tightly coupled to legacy stage instances.
 * All methods now return empty/no-op results. Governed Workflows will
 * implement its own approval mechanism in a later tranche.
 */

import type { Db } from "@mnm/db";
import type {
  HitlDecision,
  HitlValidationRequest,
  PendingValidation,
} from "@mnm/shared";

export function hitlValidationService(_db: Db) {
  async function shouldRequestValidation(_stageId: string): Promise<boolean> {
    return false;
  }

  async function requestValidation(
    _stageId: string,
    _actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
    },
  ): Promise<HitlValidationRequest> {
    throw new Error("HITL validation is not available (legacy workflows removed)");
  }

  async function approveStage(
    _stageId: string,
    _actorId: string,
    _actorType: "user" | "agent" | "system",
    _comment?: string,
  ): Promise<HitlDecision> {
    throw new Error("HITL validation is not available (legacy workflows removed)");
  }

  async function rejectStage(
    _stageId: string,
    _actorId: string,
    _actorType: "user" | "agent" | "system",
    _feedback: string,
  ): Promise<HitlDecision> {
    throw new Error("HITL validation is not available (legacy workflows removed)");
  }

  async function listPendingValidations(_companyId: string): Promise<PendingValidation[]> {
    return [];
  }

  async function getValidationHistory(_stageId: string): Promise<HitlDecision[]> {
    return [];
  }

  async function getHitlRoles(_stageId: string): Promise<string[]> {
    return [];
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
