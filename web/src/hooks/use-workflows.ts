"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface Workflow {
  id: number;
  name: string;
  description: string | null;
  phase: string | null;
  sourcePath: string;
  stepsJson: string | null;
  metadata: string | null;
  discoveredAt: number;
  updatedAt: number;
}

export interface WorkflowStep {
  name: string;
  description?: string;
  path?: string;
  order: number;
}

interface WorkflowsResponse {
  workflows: Workflow[];
}

export function useWorkflows() {
  const { data, error, isLoading, mutate } = useSWR<WorkflowsResponse>(
    "/api/workflows",
    fetcher
  );

  const workflows = Array.isArray(data?.workflows) ? data.workflows : [];

  return {
    workflows,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useWorkflow(id: number | null) {
  const { data, error, isLoading } = useSWR<{ workflow: Workflow }>(
    id ? `/api/workflows/${id}` : null,
    fetcher
  );

  const workflow = data?.workflow ?? null;
  const steps: WorkflowStep[] = [];
  if (workflow?.stepsJson) {
    try {
      const parsed = JSON.parse(workflow.stepsJson);
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          steps.push({
            name: s.name ?? "",
            order: s.order ?? 0,
            description: s.description,
            path: s.filePath ?? s.path,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    workflow,
    steps,
    isLoading,
    isError: !!error,
  };
}
