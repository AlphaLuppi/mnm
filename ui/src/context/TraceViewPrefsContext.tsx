/**
 * OBS-03b: ViewPreferencesProvider
 *
 * Manages trace view mode (tree/timeline/graph) and display toggles
 * (show duration, show cost).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TraceView = "tree" | "timeline" | "graph";

export interface ViewPreferencesContextValue {
  activeView: TraceView;
  setActiveView: (view: TraceView) => void;
  showDuration: boolean;
  showCost: boolean;
  toggleShowDuration: () => void;
  toggleShowCost: () => void;
}

const TraceViewPrefsContext = createContext<ViewPreferencesContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface TraceViewPrefsProviderProps {
  children: ReactNode;
}

export function TraceViewPrefsProvider({ children }: TraceViewPrefsProviderProps) {
  const [activeView, setActiveView] = useState<TraceView>("timeline");
  const [showDuration, setShowDuration] = useState(true);
  const [showCost, setShowCost] = useState(true);

  const toggleShowDuration = useCallback(() => {
    setShowDuration((prev) => !prev);
  }, []);

  const toggleShowCost = useCallback(() => {
    setShowCost((prev) => !prev);
  }, []);

  const value = useMemo<ViewPreferencesContextValue>(
    () => ({
      activeView,
      setActiveView,
      showDuration,
      showCost,
      toggleShowDuration,
      toggleShowCost,
    }),
    [activeView, showDuration, showCost, toggleShowDuration, toggleShowCost],
  );

  return (
    <TraceViewPrefsContext.Provider value={value}>
      {children}
    </TraceViewPrefsContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTraceViewPrefs(): ViewPreferencesContextValue {
  const ctx = useContext(TraceViewPrefsContext);
  if (!ctx) {
    throw new Error("useTraceViewPrefs must be used within TraceViewPrefsProvider");
  }
  return ctx;
}
