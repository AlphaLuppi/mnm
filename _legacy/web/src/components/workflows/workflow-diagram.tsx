"use client";

import type { WorkflowStep } from "@/hooks/use-workflows";

interface Props {
  steps: WorkflowStep[];
  workflowName: string;
}

export function WorkflowDiagram({ steps, workflowName }: Props) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm text-muted-foreground">
          No steps discovered for this workflow
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Pipeline: {workflowName}
      </h3>
      <div className="flex flex-col items-start gap-0">
        {steps.map((step, index) => (
          <div key={step.name} className="flex items-stretch">
            {/* Connector line */}
            <div className="flex flex-col items-center w-8">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  index === 0
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50 bg-background"
                }`}
              />
              {index < steps.length - 1 && (
                <div className="w-0.5 flex-1 min-h-6 bg-muted-foreground/20" />
              )}
            </div>
            {/* Step content */}
            <div className="flex-1 pb-4 -mt-1">
              <div className="rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium">{step.name}</span>
                </div>
                {step.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 ml-7">
                    {step.description}
                  </p>
                )}
                {step.path && (
                  <p className="mt-1 text-xs font-mono text-muted-foreground/60 ml-7 truncate">
                    {step.path}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
