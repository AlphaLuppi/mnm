import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export interface BreadcrumbEntry {
  id: string;
  title: string;
  filePath?: string;
}

export interface SelectedItem {
  type: "artifact" | "node";
  /** For artifacts: the file path. For nodes: the node id. */
  id: string;
  /** Present on artifact and leaf nodes */
  filePath?: string;
  /**
   * Full breadcrumb path from root to the selected item (inclusive).
   * Artifacts use a single-entry breadcrumb with their display title.
   */
  breadcrumb: BreadcrumbEntry[];
}

interface ProjectNavigationContextValue {
  selectedItem: SelectedItem | null;
  selectArtifact: (path: string, title: string) => void;
  /**
   * Select a tree node.
   * @param ancestors - breadcrumb entries from root up to (but not including) this node
   */
  selectNode: (id: string, title: string, filePath: string | undefined, ancestors: BreadcrumbEntry[]) => void;
  clearSelection: () => void;
}

const ProjectNavigationContext = createContext<ProjectNavigationContextValue | null>(null);

export function ProjectNavigationProvider({ children }: { children: ReactNode }) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const selectArtifact = useCallback((path: string, title: string) => {
    setSelectedItem({
      type: "artifact",
      id: path,
      filePath: path,
      breadcrumb: [{ id: path, title, filePath: path }],
    });
  }, []);

  const selectNode = useCallback(
    (id: string, title: string, filePath: string | undefined, ancestors: BreadcrumbEntry[]) => {
      setSelectedItem({
        type: "node",
        id,
        filePath,
        breadcrumb: [...ancestors, { id, title, filePath }],
      });
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <ProjectNavigationContext.Provider value={{ selectedItem, selectArtifact, selectNode, clearSelection }}>
      {children}
    </ProjectNavigationContext.Provider>
  );
}

export function useProjectNavigation() {
  const ctx = useContext(ProjectNavigationContext);
  if (!ctx) throw new Error("useProjectNavigation must be used within ProjectNavigationProvider");
  return ctx;
}
