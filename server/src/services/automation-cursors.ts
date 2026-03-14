/**
 * DUAL-S01: Automation Cursor Service
 *
 * Manages automation cursors for the dual-speed workflow system.
 * 3 positions (manual/assisted/auto) x 4 levels (action/agent/project/company)
 * with hierarchical ceiling enforcement.
 *
 * Hierarchy ceiling: company > project > agent > action
 * Effective position = min(all applicable levels)
 * Position order: manual(0) < assisted(1) < auto(2)
 */

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { automationCursors } from "@mnm/db";
import type {
  AutomationCursorPosition,
  AutomationCursorLevel,
  EffectiveCursor,
} from "@mnm/shared";
import { auditService } from "./audit.js";

// --- Position value mapping ---

const POSITION_VALUES: Record<AutomationCursorPosition, number> = {
  manual: 0,
  assisted: 1,
  auto: 2,
};

const VALUE_POSITIONS: AutomationCursorPosition[] = ["manual", "assisted", "auto"];

// dual-s01-get-position-value
function getPositionValue(position: AutomationCursorPosition): number {
  return POSITION_VALUES[position];
}

// dual-s01-min-position
function minPosition(a: AutomationCursorPosition, b: AutomationCursorPosition): AutomationCursorPosition {
  const va = getPositionValue(a);
  const vb = getPositionValue(b);
  return VALUE_POSITIONS[Math.min(va, vb)]!;
}

// --- Service factory ---

export function automationCursorService(db: Db) {
  const audit = auditService(db);

  // dual-s01-set-cursor
  async function setCursor(
    companyId: string,
    input: {
      level: AutomationCursorLevel;
      targetId?: string | null;
      position: AutomationCursorPosition;
      ceiling?: AutomationCursorPosition;
    },
    userId: string | null,
  ) {
    const { level, targetId = null, position, ceiling = "auto" } = input;

    // Upsert: use onConflictDoUpdate on the unique index (companyId, level, targetId)
    const [row] = await db
      .insert(automationCursors)
      .values({
        companyId,
        level,
        targetId,
        position,
        ceiling,
        setByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [automationCursors.companyId, automationCursors.level, automationCursors.targetId],
        set: {
          position,
          ceiling,
          setByUserId: userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Emit audit event
    await audit.emit({
      companyId,
      actorId: userId ?? "system",
      actorType: userId ? "user" : "system",
      action: "automation_cursor.updated",
      targetType: "automation_cursor",
      targetId: row!.id,
      metadata: { level, targetId, position, ceiling },
      severity: "info",
    });

    return row!;
  }

  // dual-s01-get-cursors
  async function getCursors(
    companyId: string,
    filters?: { level?: AutomationCursorLevel; targetId?: string },
  ) {
    const conditions = [eq(automationCursors.companyId, companyId)];

    if (filters?.level) {
      conditions.push(eq(automationCursors.level, filters.level));
    }
    if (filters?.targetId) {
      conditions.push(eq(automationCursors.targetId, filters.targetId));
    }

    return db
      .select()
      .from(automationCursors)
      .where(and(...conditions))
      .orderBy(sql`${automationCursors.createdAt} desc`);
  }

  // dual-s01-get-cursor-by-id
  async function getCursorById(companyId: string, cursorId: string) {
    return db
      .select()
      .from(automationCursors)
      .where(
        and(
          eq(automationCursors.companyId, companyId),
          eq(automationCursors.id, cursorId),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  // dual-s01-delete-cursor
  async function deleteCursor(companyId: string, cursorId: string) {
    const [row] = await db
      .delete(automationCursors)
      .where(
        and(
          eq(automationCursors.companyId, companyId),
          eq(automationCursors.id, cursorId),
        ),
      )
      .returning();

    if (row) {
      await audit.emit({
        companyId,
        actorId: "system",
        actorType: "system",
        action: "automation_cursor.deleted",
        targetType: "automation_cursor",
        targetId: cursorId,
        metadata: { level: row.level, targetId: row.targetId, position: row.position },
        severity: "info",
      });
    }

    return row ?? null;
  }

  // dual-s01-resolve-effective
  async function resolveEffective(
    companyId: string,
    opts: {
      level: AutomationCursorLevel;
      targetId?: string;
      agentId?: string;
      projectId?: string;
    },
  ): Promise<EffectiveCursor> {
    // Collect all applicable cursors from hierarchy: company > project > agent > action
    const hierarchy: EffectiveCursor["hierarchy"] = [];

    // 1. Company-level cursor (always applies)
    const companyCursor = await db
      .select()
      .from(automationCursors)
      .where(
        and(
          eq(automationCursors.companyId, companyId),
          eq(automationCursors.level, "company"),
          sql`${automationCursors.targetId} IS NULL`,
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (companyCursor) {
      hierarchy.push({
        level: "company",
        position: companyCursor.position as AutomationCursorPosition,
        ceiling: companyCursor.ceiling as AutomationCursorPosition,
      });
    }

    // 2. Project-level cursor (if projectId provided)
    if (opts.projectId) {
      const projectCursor = await db
        .select()
        .from(automationCursors)
        .where(
          and(
            eq(automationCursors.companyId, companyId),
            eq(automationCursors.level, "project"),
            eq(automationCursors.targetId, opts.projectId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (projectCursor) {
        hierarchy.push({
          level: "project",
          position: projectCursor.position as AutomationCursorPosition,
          ceiling: projectCursor.ceiling as AutomationCursorPosition,
        });
      }
    }

    // 3. Agent-level cursor (if agentId provided)
    if (opts.agentId) {
      const agentCursor = await db
        .select()
        .from(automationCursors)
        .where(
          and(
            eq(automationCursors.companyId, companyId),
            eq(automationCursors.level, "agent"),
            eq(automationCursors.targetId, opts.agentId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (agentCursor) {
        hierarchy.push({
          level: "agent",
          position: agentCursor.position as AutomationCursorPosition,
          ceiling: agentCursor.ceiling as AutomationCursorPosition,
        });
      }
    }

    // 4. Action-level cursor (if targetId at action level)
    if (opts.level === "action" && opts.targetId) {
      const actionCursor = await db
        .select()
        .from(automationCursors)
        .where(
          and(
            eq(automationCursors.companyId, companyId),
            eq(automationCursors.level, "action"),
            eq(automationCursors.targetId, opts.targetId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (actionCursor) {
        hierarchy.push({
          level: "action",
          position: actionCursor.position as AutomationCursorPosition,
          ceiling: actionCursor.ceiling as AutomationCursorPosition,
        });
      }
    }

    // Default if no cursors found
    if (hierarchy.length === 0) {
      return {
        position: "assisted",
        ceiling: "auto",
        resolvedFrom: "company",
        hierarchy: [],
      };
    }

    // Resolve effective position = min(all positions in hierarchy)
    // Also apply ceiling enforcement: position cannot exceed ceiling from above
    let effectivePosition: AutomationCursorPosition = "auto";
    let effectiveCeiling: AutomationCursorPosition = "auto";
    let resolvedFrom: AutomationCursorLevel = hierarchy[0]!.level;

    for (const entry of hierarchy) {
      // Apply ceiling from upper levels
      effectiveCeiling = minPosition(effectiveCeiling, entry.ceiling);
      // Take the most restrictive position
      effectivePosition = minPosition(effectivePosition, entry.position);
      // Position cannot exceed the effective ceiling
      effectivePosition = minPosition(effectivePosition, effectiveCeiling);
      resolvedFrom = entry.level;
    }

    return {
      position: effectivePosition,
      ceiling: effectiveCeiling,
      resolvedFrom,
      hierarchy,
    };
  }

  return {
    setCursor,
    getCursors,
    getCursorById,
    deleteCursor,
    resolveEffective,
    getPositionValue,
    minPosition,
  };
}
