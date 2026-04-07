import { AlertTriangle, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConflictCheckResult, ConfigLayerConflict, ConflictSeverity } from "@mnm/shared";
import { cn } from "../../lib/utils";

const CONFLICT_CONFIG: Record<
  ConflictSeverity,
  { label: string; bgClass: string; textClass: string; borderClass: string; Icon: typeof AlertTriangle }
> = {
  enforced_conflict: {
    label: "Enforced Conflict",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-800 dark:text-red-200",
    borderClass: "border-red-200 dark:border-red-800",
    Icon: XCircle,
  },
  priority_conflict: {
    label: "Priority Conflict",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-800 dark:text-amber-200",
    borderClass: "border-amber-200 dark:border-amber-800",
    Icon: AlertTriangle,
  },
  override_conflict: {
    label: "Override Conflict",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-800 dark:text-blue-200",
    borderClass: "border-blue-200 dark:border-blue-800",
    Icon: Info,
  },
};

function ConflictRow({ conflict }: { conflict: ConfigLayerConflict }) {
  const config = CONFLICT_CONFIG[conflict.severity];
  const { Icon } = config;

  return (
    <div className={cn("rounded-md border p-3 space-y-1", config.bgClass, config.borderClass)}>
      <div className="flex items-center gap-2 flex-wrap">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", config.textClass)} />
        <span className={cn("text-xs font-semibold", config.textClass)}>
          {config.label}
        </span>
        <span className="text-xs font-mono bg-background/60 px-1.5 py-0.5 rounded truncate max-w-[150px] sm:max-w-none">
          {conflict.name}
        </span>
        <span className="text-xs text-muted-foreground">({conflict.itemType})</span>
      </div>
      <p className={cn("text-xs pl-5", config.textClass, "opacity-80")}>
        Existing: <strong>{conflict.existingLayerName}</strong> (P{conflict.existingPriority})
        &rarr; Candidate (P{conflict.candidatePriority})
      </p>
    </div>
  );
}

export function ConflictResolutionDialog({
  result,
  onProceed,
  onCancel,
}: {
  result: ConflictCheckResult;
  onProceed: () => void;
  onCancel: () => void;
}) {
  const canAttach = result.canAttach;
  const title = !canAttach ? "Cannot Attach Layer" : "Conflicts Detected";

  const grouped = result.conflicts.reduce<Record<ConflictSeverity, ConfigLayerConflict[]>>(
    (acc, c) => {
      (acc[c.severity] ??= []).push(c);
      return acc;
    },
    {} as Record<ConflictSeverity, ConfigLayerConflict[]>,
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="p-4 sm:p-6 gap-4 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!canAttach ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[360px] overflow-y-auto py-1">
          {!canAttach && (
            <p className="text-sm text-muted-foreground">
              This layer cannot be attached because it conflicts with an enforced layer. Remove
              the enforced layer first, or contact an admin.
            </p>
          )}
          {canAttach && (
            <p className="text-sm text-muted-foreground">
              Attaching this layer will cause the following conflicts. You can proceed, but some
              items may be overridden based on priority.
            </p>
          )}

          {(["enforced_conflict", "priority_conflict", "override_conflict"] as ConflictSeverity[]).map(
            (type) => {
              const conflicts = grouped[type];
              if (!conflicts || conflicts.length === 0) return null;
              return (
                <div key={type} className="space-y-1.5">
                  {conflicts.map((c, idx) => (
                    <ConflictRow key={`${c.name}-${idx}`} conflict={c} />
                  ))}
                </div>
              );
            },
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {canAttach && (
            <Button variant="default" onClick={onProceed}>
              Attach Anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
