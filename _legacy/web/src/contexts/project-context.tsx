"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import useSWR, { mutate } from "swr";

interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastOpenedAt: number;
}

interface ProjectsResponse {
  projects: ProjectEntry[];
  activeProjectId: string;
}

interface ProjectContextValue {
  activeProject: ProjectEntry | null;
  projects: ProjectEntry[];
  isLoading: boolean;
  switchProject: (id: string) => Promise<void>;
  projectKey: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSWR<ProjectsResponse>(
    "/api/projects",
    fetcher
  );

  const projects = data?.projects ?? [];
  const activeProject =
    projects.find((p) => p.id === data?.activeProjectId) ?? null;
  const projectKey = activeProject?.id ?? "default";

  const switchProject = useCallback(
    async (id: string) => {
      if (id === data?.activeProjectId) return;

      const res = await fetch("/api/projects/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Clear all SWR caches so every component refetches for the new project
      await mutate(() => true);

      // Notify other contexts (e.g. ChatProvider) that the project changed
      window.dispatchEvent(new Event("mnm:project-switched"));
    },
    [data?.activeProjectId]
  );

  return (
    <ProjectContext.Provider
      value={{ activeProject, projects, isLoading, switchProject, projectKey }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
