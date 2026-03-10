import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface SelectedItem {
  type: "artifact" | "epic" | "story";
  id: string;
  path?: string;
}

interface ProjectNavigationContextValue {
  selectedItem: SelectedItem | null;
  activeView: string | null;
  selectArtifact: (path: string) => void;
  selectEpic: (epicId: string) => void;
  selectStory: (epicId: string, storyId: string, path?: string) => void;
  clearSelection: () => void;
}

const ProjectNavigationContext = createContext<ProjectNavigationContextValue | null>(null);

interface ProjectNavigationProviderProps {
  children: ReactNode;
  initialSelect?: string;
  initialView?: string;
}

/**
 * Parse a `select` query param like "epic:3" or "story:1-1" into a SelectedItem.
 */
function parseSelectParam(select: string): SelectedItem | null {
  const [type, id] = select.split(":");
  if (!type || !id) return null;
  if (type === "epic") return { type: "epic", id };
  if (type === "story") {
    const parts = id.split("-");
    if (parts.length >= 2) return { type: "story", id: `${parts[0]}/${id}` };
    return { type: "story", id };
  }
  if (type === "artifact") return { type: "artifact", id, path: id };
  return null;
}

export function ProjectNavigationProvider({
  children,
  initialSelect,
  initialView,
}: ProjectNavigationProviderProps) {
  const appliedRef = useRef(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [activeView, setActiveView] = useState<string | null>(initialView ?? null);

  // Apply initial selection from URL params (once)
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    if (initialSelect) {
      const parsed = parseSelectParam(initialSelect);
      if (parsed) setSelectedItem(parsed);
    }
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialSelect, initialView]);

  const selectArtifact = useCallback((path: string) => {
    setSelectedItem({ type: "artifact", id: path, path });
  }, []);

  const selectEpic = useCallback((epicId: string) => {
    setSelectedItem({ type: "epic", id: epicId });
  }, []);

  const selectStory = useCallback((epicId: string, storyId: string, path?: string) => {
    setSelectedItem({ type: "story", id: `${epicId}/${storyId}`, path });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <ProjectNavigationContext.Provider
      value={{ selectedItem, activeView, selectArtifact, selectEpic, selectStory, clearSelection }}
    >
      {children}
    </ProjectNavigationContext.Provider>
  );
}

export function useProjectNavigation() {
  const ctx = useContext(ProjectNavigationContext);
  if (!ctx) throw new Error("useProjectNavigation must be used within ProjectNavigationProvider");
  return ctx;
}
