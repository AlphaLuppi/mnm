"use client";

import { Badge } from "@/components/ui/badge";
import { WORKFLOW_STAGES } from "@/lib/core/progress";

export function WorkflowStageBadge({ stage }: { stage: string | null }) {
  const stageInfo = WORKFLOW_STAGES.find((s) => s.id === stage);
  if (!stageInfo) {
    return (
      <Badge variant="outline" className="text-xs">
        Backlog
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-xs ${stageInfo.color}`}>
      {stageInfo.label}
    </Badge>
  );
}

export function WorkflowPipeline({ currentStage }: { currentStage: string | null }) {
  const currentIdx = WORKFLOW_STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.id} className="flex items-center gap-1">
            <div
              className={`h-2 w-2 rounded-full ${
                isCurrent
                  ? "bg-primary ring-2 ring-primary/30"
                  : isCompleted
                    ? "bg-primary/60"
                    : "bg-muted"
              }`}
              title={stage.label}
            />
            {idx < WORKFLOW_STAGES.length - 1 && (
              <div
                className={`h-px w-3 ${
                  isCompleted ? "bg-primary/60" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
