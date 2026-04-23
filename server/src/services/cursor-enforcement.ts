/**
 * DUAL-S03: Cursor Enforcement Service
 *
 * Legacy stage-based enforcement has been removed with the nuke of legacy workflows (U1).
 * The service is kept as a no-op stub so existing callers continue to compile.
 * Governed Workflows will wire its own enforcement in a later tranche.
 */

import type { Db } from "@mnm/db";
import type {
  StageEvent,
  CursorEnforcementResult,
  EffectiveCursor,
} from "@mnm/shared";

// dual-s03-enforce-cursor-fn
export function cursorEnforcementService(_db: Db) {
  const defaultCursor: EffectiveCursor = {
    position: "auto",
    ceiling: "auto",
    resolvedFrom: "company",
    hierarchy: [],
  };

  async function enforceCursor(
    _stageId: string,
    _event: StageEvent,
    _actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
    },
  ): Promise<CursorEnforcementResult> {
    // Legacy stage-based enforcement removed. Always allow.
    return {
      allowed: true,
      position: "auto",
      effectiveCursor: defaultCursor,
    };
  }

  return {
    enforceCursor,
  };
}
