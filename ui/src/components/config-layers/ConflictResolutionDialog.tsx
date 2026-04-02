import { AlertTriangle, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ConflictCheckResult, type ConflictItem, type ConflictType } from "../../api/config-layers";
import { cn } from "../../lib/utils";

const CONFLICT_CONFIG: Record<
  ConflictType,
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

function ConflictRow({ conflict }: { conflict: ConflictItem }) {
  const config = CONFLICT_CONFIG[conflict.conflictType];
  const { Icon } = config;

  return (
    <div className={cn("rounded-md border p-3 space-y-1", config.bgClass, config.borderClass)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", config.textClass)} />
        <span className={cn("text-xs font-semibold", config.textClass)}>
          {config.label}
        </span>
        <span className="text-xs font-mono bg-background/60 px-1.5 py-0.5 rounded">
          {conflict.name}
        </span>
        <span className="text-xs text-muted-foreground">({conflict.itemType})</span>
      </div>
      <p className={cn("text-xs pl-5", config.textClass, "opacity-80")}>
        Existing: <strong>{conflict.existingLayerName}</strong> &rarr; New:{" "}
        <strong>{conflict.newLayerName}</strong>
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
  const hasEnforced = result.hasEnforcedConflicts;
  const title = hasEnforced ? "Cannot Attach Layer" : "Conflicts Detected";

  const grouped = result.conflicts.reduce<Record<ConflictType, ConflictItem[]>>(
    (acc, c) => {
      (acc[c.conflictType] ??= []).push(c);
      return acc;
    },
    {} as Record<ConflictType, ConflictItem[]>,
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasEnforced ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[360px] overflow-y-auto py-1">
          {hasEnforced && (
            <p className="text-sm text-muted-foreground">
              This layer cannot be attached because it conflicts with an enforced layer. Remove
              the enforced layer first, or contact an admin.
            </p>
          )}
          {!hasEnforced && (
            <p className="text-sm text-muted-foreground">
              Attaching this layer will cause the following conflicts. You can proceed, but some
              items may be overridden based on priority.
            </p>
          )}

          {(["enforced_conflict", "priority_conflict", "override_conflict"] as ConflictType[]).map(
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
          {!hasEnforced && (
            <Button variant="default" onClick={onProceed}>
              Attach Anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
