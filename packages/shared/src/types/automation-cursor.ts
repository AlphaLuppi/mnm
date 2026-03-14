/**
 * DUAL-S01: Automation Cursor Types
 *
 * Dual-speed workflow: 3 positions (manual/assisted/auto) x 4 levels
 * (action/agent/project/company) with hierarchical ceiling enforcement.
 */

// --- Constants ---

export const AUTOMATION_CURSOR_POSITIONS = ["manual", "assisted", "auto"] as const;
export const AUTOMATION_CURSOR_LEVELS = ["action", "agent", "project", "company"] as const;

// --- Types ---

export type AutomationCursorPosition = (typeof AUTOMATION_CURSOR_POSITIONS)[number];
export type AutomationCursorLevel = (typeof AUTOMATION_CURSOR_LEVELS)[number];

// --- Interfaces ---

/**
 * A single automation cursor record.
 * Represents a cursor set at a particular level + targetId within a company.
 */
export interface AutomationCursor {
  id: string;
  companyId: string;
  level: AutomationCursorLevel;
  targetId: string | null;
  position: AutomationCursorPosition;
  ceiling: AutomationCursorPosition;
  setByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of resolving the effective cursor position for a given context.
 * Applies hierarchical ceiling enforcement: company > project > agent > action.
 */
export interface EffectiveCursor {
  position: AutomationCursorPosition;
  ceiling: AutomationCursorPosition;
  resolvedFrom: AutomationCursorLevel;
  hierarchy: Array<{
    level: AutomationCursorLevel;
    position: AutomationCursorPosition;
    ceiling: AutomationCursorPosition;
  }>;
}
