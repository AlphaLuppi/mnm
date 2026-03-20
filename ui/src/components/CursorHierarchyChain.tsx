import { ChevronRight } from "lucide-react";
import type { AutomationCursorLevel, AutomationCursorPosition } from "@mnm/shared";
import { CursorPositionBadge } from "./CursorPositionBadge";

interface HierarchyStep {
  level: AutomationCursorLevel;
  position: AutomationCursorPosition;
  ceiling: AutomationCursorPosition;
}

const LEVEL_LABELS: Record<AutomationCursorLevel, string> = {
  company: "Company",
  project: "Project",
  agent: "Agent",
  action: "Action",
};

export function CursorHierarchyChain({
  hierarchy,
  resolvedFrom,
  "data-testid": testId,
}: {
  hierarchy: HierarchyStep[];
  resolvedFrom: AutomationCursorLevel;
  "data-testid"?: string;
}) {
  if (hierarchy.length === 0) {
    return (
      <div
        data-testid={testId ?? "dual-s02-hierarchy-chain"}
        className="text-xs text-muted-foreground"
      >
        No hierarchy levels found (using defaults).
      </div>
    );
  }

  return (
    <div
      data-testid={testId ?? "dual-s02-hierarchy-chain"}
      className="flex flex-wrap items-center gap-1"
    >
      {hierarchy.map((step, idx) => {
        const isActive = step.level === resolvedFrom;
        return (
          <div key={step.level} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <div
              data-testid="dual-s02-hierarchy-step"
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                isActive
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border bg-background"
              }`}
            >
              <span className="text-muted-foreground">
                {LEVEL_LABELS[step.level]}:
              </span>
              <CursorPositionBadge position={step.position} />
              <span className="text-muted-foreground text-[10px]">
                (cap: {step.ceiling})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
