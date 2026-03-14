import type { AutomationCursor, AutomationCursorLevel, AutomationCursorPosition, EffectiveCursor } from "@mnm/shared";
import { api } from "./client";

export interface CursorListFilters {
  level?: AutomationCursorLevel;
  targetId?: string;
}

export interface SetCursorBody {
  level: AutomationCursorLevel;
  targetId?: string | null;
  position: AutomationCursorPosition;
  ceiling?: AutomationCursorPosition;
}

export interface ResolveCursorBody {
  level: AutomationCursorLevel;
  targetId?: string;
  agentId?: string;
  projectId?: string;
}

function buildQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const automationCursorsApi = {
  list: (companyId: string, filters: CursorListFilters = {}) =>
    api.get<AutomationCursor[]>(
      `/companies/${companyId}/automation-cursors${buildQuery(filters as Record<string, string | undefined>)}`,
    ),

  getById: (companyId: string, cursorId: string) =>
    api.get<AutomationCursor>(
      `/companies/${companyId}/automation-cursors/${cursorId}`,
    ),

  set: (companyId: string, body: SetCursorBody) =>
    api.put<AutomationCursor>(
      `/companies/${companyId}/automation-cursors`,
      body,
    ),

  delete: (companyId: string, cursorId: string) =>
    api.delete<{ deleted: boolean }>(
      `/companies/${companyId}/automation-cursors/${cursorId}`,
    ),

  resolve: (companyId: string, body: ResolveCursorBody) =>
    api.post<EffectiveCursor>(
      `/companies/${companyId}/automation-cursors/resolve`,
      body,
    ),
};
