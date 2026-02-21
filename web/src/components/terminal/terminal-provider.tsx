"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { TerminalPanel } from "./terminal-panel";
import { TerminalSidebar } from "./terminal-sidebar";
import { isTauri as checkIsTauri } from "@/lib/tauri";

interface TerminalContextType {
  isOpen: boolean;
  isTauri: boolean;
  open: (autoLaunchClaude?: boolean) => void;
  close: () => void;
  toggle: () => void;
  launchClaude: () => void;
}

const TerminalContext = createContext<TerminalContextType | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoLaunchClaude, setAutoLaunchClaude] = useState(true);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  // Detect Tauri environment
  useEffect(() => {
    const detected = checkIsTauri();
    console.log("[TerminalProvider] Tauri detected:", detected);
    setIsTauriEnv(detected);
  }, []);

  const open = useCallback((launchClaude = true) => {
    console.log("[Terminal] Opening terminal, launchClaude:", launchClaude);
    setAutoLaunchClaude(launchClaude);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    console.log("[Terminal] Closing terminal");
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    console.log("[Terminal] Toggling terminal");
    setIsOpen((prev) => !prev);
  }, []);

  const launchClaude = useCallback(() => {
    setAutoLaunchClaude(true);
    setIsOpen(true);
  }, []);

  return (
    <TerminalContext.Provider value={{ isOpen, isTauri: isTauriEnv, open, close, toggle, launchClaude }}>
      {children}
      {/* Use native terminal in Tauri, fallback to WebSocket terminal in browser */}
      {isTauriEnv ? (
        <TerminalSidebar
          isOpen={isOpen}
          onClose={close}
          autoLaunchClaude={autoLaunchClaude}
          position="bottom"
        />
      ) : (
        <TerminalPanel
          isOpen={isOpen}
          onClose={close}
          autoLaunchClaude={autoLaunchClaude}
        />
      )}
    </TerminalContext.Provider>
  );
}

export function useTerminalContext() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminalContext must be used within a TerminalProvider");
  }
  return context;
}
