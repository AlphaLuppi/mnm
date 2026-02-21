"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ClaudeTerminalPanel } from "./claude-terminal-panel";

interface ClaudeContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  // Trigger refresh signals for other parts of the app
  refreshSpecs: () => void;
  refreshWorkflows: () => void;
  refreshDrift: () => void;
  refreshAll: () => void;
  // Listeners for refresh events
  specsVersion: number;
  workflowsVersion: number;
  driftVersion: number;
}

const ClaudeContext = createContext<ClaudeContextType | null>(null);

export function ClaudeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Version numbers that increment when data should be refreshed
  // Components can use these as dependencies to trigger refetches
  const [specsVersion, setSpecsVersion] = useState(0);
  const [workflowsVersion, setWorkflowsVersion] = useState(0);
  const [driftVersion, setDriftVersion] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const refreshSpecs = useCallback(() => {
    setSpecsVersion((v) => v + 1);
  }, []);

  const refreshWorkflows = useCallback(() => {
    setWorkflowsVersion((v) => v + 1);
  }, []);

  const refreshDrift = useCallback(() => {
    setDriftVersion((v) => v + 1);
  }, []);

  const refreshAll = useCallback(() => {
    setSpecsVersion((v) => v + 1);
    setWorkflowsVersion((v) => v + 1);
    setDriftVersion((v) => v + 1);
  }, []);

  return (
    <ClaudeContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        refreshSpecs,
        refreshWorkflows,
        refreshDrift,
        refreshAll,
        specsVersion,
        workflowsVersion,
        driftVersion,
      }}
    >
      {children}
      <ClaudeTerminalPanel isOpen={isOpen} onClose={close} />
    </ClaudeContext.Provider>
  );
}

export function useClaudeContext() {
  const context = useContext(ClaudeContext);
  if (!context) {
    throw new Error("useClaudeContext must be used within a ClaudeProvider");
  }
  return context;
}
