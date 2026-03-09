"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, Search, RefreshCw } from "lucide-react";
import { useWorkflows } from "@/hooks/use-workflows";
import { WorkflowDetailView } from "@/components/workflows/workflow-detail-view";
import type { Workflow } from "@/hooks/use-workflows";

const PHASE_COLORS: Record<string, string> = {
  analysis: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  planning:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  solutioning:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  implementation:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  documentation:
    "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "quick-flow":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  qa: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getStepCount(wf: Workflow): number {
  if (!wf.stepsJson) return 0;
  try {
    const parsed = JSON.parse(wf.stepsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function WorkflowsPage() {
  const { workflows, isLoading, mutate } = useWorkflows();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [rescanning, setRescanning] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return workflows;
    const q = search.toLowerCase();
    return workflows.filter(
      (wf) =>
        wf.name.toLowerCase().includes(q) ||
        (wf.phase ?? "").toLowerCase().includes(q) ||
        (wf.description ?? "").toLowerCase().includes(q)
    );
  }, [workflows, search]);

  const grouped = useMemo(() => {
    const byPhase = new Map<string, Workflow[]>();
    const unphased: Workflow[] = [];

    for (const wf of filtered) {
      const phase = wf.phase ?? "";
      if (!phase) {
        unphased.push(wf);
      } else {
        if (!byPhase.has(phase)) byPhase.set(phase, []);
        byPhase.get(phase)!.push(wf);
      }
    }

    const phases = [...byPhase.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return { phases, unphased };
  }, [filtered]);

  async function handleRescan() {
    setRescanning(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rescan-workflows" }),
      });
      await mutate();
    } finally {
      setRescanning(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Discovered workflow definitions from your repository
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Discovered workflow definitions from your repository
          </p>
        </div>
        <Button
          onClick={handleRescan}
          variant="outline"
          size="sm"
          disabled={rescanning}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${rescanning ? "animate-spin" : ""}`}
          />
          Re-scan
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            No workflows discovered yet. Click &quot;Re-scan&quot; to discover
            workflows from your repository.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-4 pr-2">
                {grouped.phases.map(([phase, wfs]) => (
                  <div key={phase}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {phase}
                    </h3>
                    <div className="space-y-1.5">
                      {wfs.map((wf) => (
                        <SidebarItem
                          key={wf.id}
                          workflow={wf}
                          isSelected={wf.id === selectedId}
                          onSelect={() => setSelectedId(wf.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {grouped.unphased.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Other
                    </h3>
                    <div className="space-y-1.5">
                      {grouped.unphased.map((wf) => (
                        <SidebarItem
                          key={wf.id}
                          workflow={wf}
                          isSelected={wf.id === selectedId}
                          onSelect={() => setSelectedId(wf.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filtered.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No workflows match your search.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div>
            {selectedId ? (
              <WorkflowDetailView workflowId={selectedId} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a workflow from the list to view its pipeline
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  workflow,
  isSelected,
  onSelect,
}: {
  workflow: Workflow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const phaseClass =
    PHASE_COLORS[workflow.phase ?? ""] ?? "bg-muted text-muted-foreground";
  const stepCount = getStepCount(workflow);

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-transparent hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{workflow.name}</span>
        {workflow.phase && (
          <Badge className={`text-[10px] px-1.5 shrink-0 ${phaseClass}`}>
            {workflow.phase}
          </Badge>
        )}
      </div>
      {stepCount > 0 && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {stepCount} step{stepCount !== 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}
