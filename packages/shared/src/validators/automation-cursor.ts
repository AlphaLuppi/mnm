/**
 * DUAL-S01: Automation Cursor Validators (Zod schemas)
 */

import { z } from "zod";
import { AUTOMATION_CURSOR_POSITIONS, AUTOMATION_CURSOR_LEVELS } from "../types/automation-cursor.js";

// --- Set (upsert) cursor ---
export const setCursorSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS),
  targetId: z.string().uuid().nullable().optional(),
  position: z.enum(AUTOMATION_CURSOR_POSITIONS),
  ceiling: z.enum(AUTOMATION_CURSOR_POSITIONS).optional(),
});
export type SetCursor = z.infer<typeof setCursorSchema>;

// --- Filter cursors query params ---
export const cursorFiltersSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS).optional(),
  targetId: z.string().uuid().optional(),
});
export type CursorFilters = z.infer<typeof cursorFiltersSchema>;

// --- Resolve effective cursor ---
export const resolveCursorSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS),
  targetId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});
export type ResolveCursor = z.infer<typeof resolveCursorSchema>;
