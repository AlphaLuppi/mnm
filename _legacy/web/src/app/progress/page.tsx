"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { ProgressList } from "@/components/progress/progress-list";
import { computeProgress } from "@/lib/core/progress";
import type { Agent, Spec, DriftDetection } from "@/lib/core/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProgressPage() {
  const { data: specsData, isLoading: specsLoading } = useSWR<{ specs: Spec[] }>(
    "/api/specs",
    fetcher
  );
  const { data: agentsData } = useSWR<Agent[]>("/api/agents", fetcher);
  const { data: driftsData } = useSWR<DriftDetection[]>("/api/drift", fetcher);

  const isLoading = specsLoading;

  const specs = Array.isArray(specsData) ? specsData : (specsData?.specs ?? []);
  const agents = Array.isArray(agentsData) ? agentsData : [];
  const drifts = Array.isArray(driftsData) ? driftsData : [];

  const items = specs.map((spec) =>
    computeProgress(spec, agents, drifts)
  );

  // Sort: drifted first, then in_progress, then not_started, then completed
  const statusOrder = { drifted: 0, in_progress: 1, not_started: 2, completed: 3 };
  items.sort(
    (a, b) =>
      (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track project progress and workflow stages
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            Progress tracking will be available once specs are indexed and
            agents have completed work.
          </p>
        </div>
      ) : (
        <ProgressList items={items} />
      )}
    </div>
  );
}
