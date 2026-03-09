"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Workflow } from "@/hooks/use-workflows";
import { GitBranch } from "lucide-react";

const PHASE_COLORS: Record<string, string> = {
  analysis: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  planning: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  solutioning: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  implementation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  documentation: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "quick-flow": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  qa: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface Props {
  workflows: Workflow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function WorkflowList({ workflows, selectedId, onSelect }: Props) {
  // Group workflows by phase
  const byPhase = new Map<string, Workflow[]>();
  const unphased: Workflow[] = [];

  for (const wf of workflows) {
    const phase = wf.phase ?? "other";
    if (phase === "other") {
      unphased.push(wf);
    } else {
      if (!byPhase.has(phase)) byPhase.set(phase, []);
      byPhase.get(phase)!.push(wf);
    }
  }

  const phases = [...byPhase.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-4">
      {phases.map(([phase, wfs]) => (
        <div key={phase}>
          <h3 className="mb-2 text-sm font-medium capitalize text-muted-foreground">
            {phase}
          </h3>
          <div className="space-y-2">
            {wfs.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                isSelected={wf.id === selectedId}
                onSelect={() => onSelect(wf.id)}
              />
            ))}
          </div>
        </div>
      ))}
      {unphased.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Other
          </h3>
          <div className="space-y-2">
            {unphased.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                isSelected={wf.id === selectedId}
                onSelect={() => onSelect(wf.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
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

  let stepCount = 0;
  if (workflow.stepsJson) {
    try {
      const steps = JSON.parse(workflow.stepsJson);
      stepCount = Array.isArray(steps) ? steps.length : 0;
    } catch {
      // ignore
    }
  }

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{workflow.name}</span>
          </div>
          {workflow.phase && (
            <Badge className={`text-xs ${phaseClass}`}>{workflow.phase}</Badge>
          )}
        </div>
        {workflow.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {workflow.description}
          </p>
        )}
        {stepCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {stepCount} step{stepCount !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
