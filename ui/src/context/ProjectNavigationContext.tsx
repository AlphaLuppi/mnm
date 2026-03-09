import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export interface SelectedItem {
  type: "artifact" | "epic" | "story";
  id: string;
  path?: string;
}

interface ProjectNavigationContextValue {
  selectedItem: SelectedItem | null;
  selectArtifact: (path: string) => void;
  selectEpic: (epicId: string) => void;
  selectStory: (epicId: string, storyId: string, path?: string) => void;
  clearSelection: () => void;
}

const ProjectNavigationContext = createContext<ProjectNavigationContextValue | null>(null);

export function ProjectNavigationProvider({ children }: { children: ReactNode }) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

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
      value={{ selectedItem, selectArtifact, selectEpic, selectStory, clearSelection }}
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
