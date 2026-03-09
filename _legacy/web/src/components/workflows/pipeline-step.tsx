"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";

export interface PipelineStepData {
  name: string;
  description?: string;
  command?: string;
  path?: string;
  order: number;
}

type StepStatus = "pending" | "running" | "completed" | "failed";

interface PipelineStepProps {
  step: PipelineStepData;
  index: number;
  total: number;
  status?: StepStatus;
  isActive?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

const statusStyles: Record<StepStatus, string> = {
  pending: "bg-muted border-muted-foreground/30",
  running: "bg-primary border-primary",
  completed: "bg-green-500 border-green-500",
  failed: "bg-destructive border-destructive",
};

export function PipelineStep({
  step,
  index,
  total,
  status = "pending",
  isActive,
  isOpen: controlledOpen,
  onToggle,
}: PipelineStepProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const isLast = index === total - 1;
  const hasDetail = !!(step.description || step.path || step.command);

  function handleToggle() {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((o) => !o);
    }
  }

  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      <div className="relative flex flex-col items-center">
        {/* Circle node */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "h-3 w-3 rounded-full border-2",
              statusStyles[status]
            )}
          />
          {isActive && status === "running" && (
            <div className="absolute -inset-1.5 animate-pulse rounded-full border-2 border-primary/50" />
          )}
        </div>
        {/* Connector line to next step */}
        {!isLast && (
          <div className="w-px flex-1 bg-muted-foreground/30" />
        )}
      </div>

      {/* Step content */}
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        <Collapsible open={isOpen} onOpenChange={handleToggle}>
          <CollapsibleTrigger
            className={cn(
              "flex w-full items-center gap-1.5 text-left",
              hasDetail && "cursor-pointer hover:text-foreground"
            )}
            disabled={!hasDetail}
          >
            <span className="text-xs font-medium text-muted-foreground w-5">
              {index + 1}.
            </span>
            <span className="text-sm font-medium">{step.name}</span>
            {hasDetail && (
              <span className="ml-auto text-muted-foreground">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            )}
          </CollapsibleTrigger>

          {hasDetail && (
            <CollapsibleContent>
              <div className="mt-2 ml-6 space-y-2 rounded-md border bg-muted/30 p-3">
                {step.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                )}
                {step.path && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderOpen className="h-3 w-3 flex-shrink-0" />
                    <code className="font-mono text-[11px]">{step.path}</code>
                  </div>
                )}
                {step.command && (
                  <div className="rounded bg-muted px-2 py-1">
                    <code className="font-mono text-[11px] text-muted-foreground">
                      $ {step.command}
                    </code>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    </div>
  );
}
