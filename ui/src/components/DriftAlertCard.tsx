import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { DriftItem, DriftType, DriftRecommendation } from "@mnm/shared";

const driftTypeLabels: Record<DriftType, string> = {
  scope_expansion: "Scope Expansion",
  approach_change: "Approach Change",
  design_deviation: "Design Deviation",
};

const recommendationLabels: Record<DriftRecommendation, string> = {
  update_spec: "Update Spec",
  recenter_code: "Recenter Code",
};

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  moderate: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  minor: {
    icon: Info,
    color: "text-green-500",
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
};

interface DriftAlertCardProps {
  drift: DriftItem;
  onFixSource?: (drift: DriftItem) => void;
  onFixTarget?: (drift: DriftItem) => void;
  onIgnore?: (drift: DriftItem) => void;
}

export function DriftAlertCard({ drift, onFixSource, onFixTarget, onIgnore }: DriftAlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[drift.severity];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", config.bg)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left cursor-pointer"
      >
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", config.badge)}>
              {drift.severity}
            </span>
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              {driftTypeLabels[drift.driftType]}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(drift.confidence * 100)}%
            </span>
          </div>
          <p className="text-xs mt-1 leading-relaxed">{drift.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Side-by-side excerpts */}
          {(drift.sourceExcerpt || drift.targetExcerpt) && (
            <div className="grid grid-cols-2 gap-2">
              {drift.sourceExcerpt && (
                <div className="rounded-md bg-background/60 p-2 text-[11px] space-y-1">
                  <p className="font-semibold text-muted-foreground truncate">
                    Source: {drift.sourceDoc.split("/").pop()}
                  </p>
                  <p className="italic leading-relaxed">{drift.sourceExcerpt}</p>
                </div>
              )}
              {drift.targetExcerpt && (
                <div className="rounded-md bg-background/60 p-2 text-[11px] space-y-1">
                  <p className="font-semibold text-muted-foreground truncate">
                    Cible: {drift.targetDoc.split("/").pop()}
                  </p>
                  <p className="italic leading-relaxed">{drift.targetExcerpt}</p>
                </div>
              )}
            </div>
          )}

          {/* Recommendation + Resolution buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground mr-auto">
              {recommendationLabels[drift.recommendation]}
            </span>
            {onFixSource && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); onFixSource(drift); }}
              >
                Corriger source
              </Button>
            )}
            {onFixTarget && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); onFixTarget(drift); }}
              >
                Corriger cible
              </Button>
            )}
            {onIgnore && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onIgnore(drift); }}
              >
                <EyeOff className="h-3 w-3 mr-1" />
                Ignorer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
