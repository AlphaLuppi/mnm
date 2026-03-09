"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DriftIndicatorProps {
  severity: string;
  summary: string;
  className?: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  minor: "text-green-600 dark:text-green-400",
  moderate: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

export function DriftIndicator({ severity, summary, className }: DriftIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0",
            SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.minor,
            className
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <p className="text-xs">{summary}</p>
      </TooltipContent>
    </Tooltip>
  );
}
