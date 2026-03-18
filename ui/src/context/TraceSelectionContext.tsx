/**
 * OBS-03a: SelectionProvider
 *
 * Manages which tree node is selected and which nodes are collapsed.
 * Provides expand/collapse all for convenience.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTraceData } from "./TraceDataContext";

// ─── Context Value ───────────────────────────────────────────────────────────

export interface SelectionContextValue {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  collapsedNodes: Set<string>;
  toggleCollapsed: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

const TraceSelectionContext = createContext<SelectionContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface TraceSelectionProviderProps {
  children: ReactNode;
}

export function TraceSelectionProvider({ children }: TraceSelectionProviderProps) {
  const { flatList } = useTraceData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    const allIds = new Set<string>();
    for (const node of flatList) {
      if (node.children.length > 0) {
        allIds.add(node.id);
      }
    }
    setCollapsedNodes(allIds);
  }, [flatList]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedNodeId,
      setSelectedNodeId,
      collapsedNodes,
      toggleCollapsed,
      expandAll,
      collapseAll,
    }),
    [selectedNodeId, collapsedNodes, toggleCollapsed, expandAll, collapseAll],
  );

  return (
    <TraceSelectionContext.Provider value={value}>
      {children}
    </TraceSelectionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTraceSelection(): SelectionContextValue {
  const ctx = useContext(TraceSelectionContext);
  if (!ctx) {
    throw new Error("useTraceSelection must be used within TraceSelectionProvider");
  }
  return ctx;
}
