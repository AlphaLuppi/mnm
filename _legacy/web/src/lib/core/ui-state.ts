"use client";

const UI_STATE_KEY = "mnm-ui-state";

export interface UIState {
  lastSpecId?: string;
  lastTab?: string;
  sidebarCollapsed?: boolean;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function saveUIState(state: Partial<UIState>): void {
  if (typeof window === "undefined") return;

  const current = loadUIState();
  const merged = { ...current, ...state };

  // Debounce saves (500ms)
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(merged));
    } catch {
      // localStorage may be full or unavailable
    }
  }, 500);
}

export function loadUIState(): UIState {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UIState;
  } catch {
    return {};
  }
}

export function clearUIState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UI_STATE_KEY);
}
