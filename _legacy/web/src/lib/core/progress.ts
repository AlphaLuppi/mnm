import type { Agent, Spec, DriftDetection } from "@/lib/core/types";

export type StoryStatus = "not_started" | "in_progress" | "completed" | "drifted";

export interface StoryProgress {
  spec: Spec;
  status: StoryStatus;
  percentage: number;
  agents: Agent[];
  drifts: DriftDetection[];
  hasCriticalDrift: boolean;
}

export function computeProgress(
  spec: Spec,
  agents: Agent[],
  drifts: DriftDetection[]
): StoryProgress {
  const specAgents = agents.filter((a) => a.specId === spec.id);
  const specDrifts = drifts.filter((d) => d.specId === spec.id);
  const hasCriticalDrift = specDrifts.some(
    (d) => d.severity === "critical" && d.userDecision === "pending"
  );
  const hasPendingDrift = specDrifts.some(
    (d) => d.userDecision === "pending"
  );

  if (specAgents.length === 0) {
    return {
      spec,
      status: "not_started",
      percentage: 0,
      agents: specAgents,
      drifts: specDrifts,
      hasCriticalDrift,
    };
  }

  const hasRunning = specAgents.some((a) => a.status === "running");
  const hasCompleted = specAgents.some((a) => a.status === "completed");

  let status: StoryStatus;
  let percentage: number;

  if (hasRunning) {
    status = "in_progress";
    percentage = 25;
  } else if (hasCompleted) {
    if (hasCriticalDrift) {
      status = "drifted";
      percentage = 75;
    } else if (hasPendingDrift) {
      status = "in_progress";
      percentage = 75;
    } else {
      status = "completed";
      percentage = 100;
    }
  } else {
    status = "in_progress";
    percentage = 50;
  }

  return {
    spec,
    status,
    percentage,
    agents: specAgents,
    drifts: specDrifts,
    hasCriticalDrift,
  };
}

export const WORKFLOW_STAGES = [
  { id: "backlog", label: "Backlog", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { id: "prd", label: "PRD", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { id: "stories", label: "Stories", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  { id: "architecture", label: "Architecture", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { id: "dev", label: "Development", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { id: "test", label: "Testing", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  { id: "deploy", label: "Deployed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
] as const;
