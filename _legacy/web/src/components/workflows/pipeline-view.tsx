"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PipelineStep } from "./pipeline-step";
import type { PipelineStepData } from "./pipeline-step";

type StepStatus = "pending" | "running" | "completed" | "failed";

interface PipelineViewProps {
  workflow: {
    id: number;
    name: string;
    description: string | null;
    phase: string | null;
    sourcePath: string;
    stepsJson: string | null;
    metadata: string | null;
  };
  stepStatuses?: Record<number, StepStatus>;
  activeStep?: number;
}

function parseSteps(stepsJson: string | null): PipelineStepData[] {
  if (!stepsJson) return [];
  try {
    const parsed = JSON.parse(stepsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: Record<string, unknown>, i: number) => ({
      name: (s.name as string) ?? `Step ${i + 1}`,
      description: s.description as string | undefined,
      command: s.command as string | undefined,
      path: (s.filePath as string | undefined) ?? (s.path as string | undefined),
      order: (s.order as number) ?? i,
    }));
  } catch {
    return [];
  }
}

export function PipelineView({
  workflow,
  stepStatuses,
  activeStep,
}: PipelineViewProps) {
  const steps = parseSteps(workflow.stepsJson);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());

  const allExpanded = steps.length > 0 && openSteps.size === steps.length;

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setOpenSteps(new Set());
    } else {
      setOpenSteps(new Set(steps.map((_, i) => i)));
    }
  }, [allExpanded, steps]);

  const toggleStep = useCallback((index: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No steps defined for this workflow.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Pipeline ({steps.length} step{steps.length !== 1 ? "s" : ""})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          className="h-7 text-xs"
        >
          {allExpanded ? (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronRight className="mr-1 h-3 w-3" />
              Expand All
            </>
          )}
        </Button>
      </div>

      <div className="ml-1">
        {steps.map((step, index) => (
          <PipelineStep
            key={index}
            step={step}
            index={index}
            total={steps.length}
            status={stepStatuses?.[index] ?? "pending"}
            isActive={activeStep === index}
            isOpen={openSteps.has(index)}
            onToggle={() => toggleStep(index)}
          />
        ))}
      </div>
    </div>
  );
}
