"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SHORTCUTS, matchesShortcut } from "@/lib/core/keyboard-shortcuts";
import { useSidebar } from "@/components/ui/sidebar";
import { ShortcutReference } from "./shortcut-reference";

interface ShortcutContextValue {
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
}

const ShortcutContext = createContext<ShortcutContextValue>({
  showShortcuts: false,
  setShowShortcuts: () => {},
});

export function useShortcutDialog() {
  return useContext(ShortcutContext);
}

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const def of SHORTCUTS) {
        if (matchesShortcut(e, def)) {
          e.preventDefault();
          switch (def.action) {
            case "nav-specs":
              router.push("/specs");
              break;
            case "nav-agents":
              router.push("/agents");
              break;
            case "nav-drift":
              router.push("/drift");
              break;
            case "nav-progress":
              router.push("/progress");
              break;
            case "nav-settings":
              router.push("/settings");
              break;
            case "toggle-sidebar":
              toggleSidebar();
              break;
            case "show-shortcuts":
              setShowShortcuts(true);
              break;
            // "open-search" is handled by spec-search.tsx already
          }
          return;
        }
      }
    },
    [router, toggleSidebar]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ShortcutContext.Provider value={{ showShortcuts, setShowShortcuts }}>
      {children}
      <ShortcutReference
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </ShortcutContext.Provider>
  );
}
