import { Clock, ExternalLink, AlertTriangle } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";
import type { PendingValidation } from "@mnm/shared";

export interface PendingValidationsPanelProps {
  validations: PendingValidation[];
  onNavigate?: (workflowInstanceId: string, stageId: string) => void;
}

/**
 * Badge showing the number of pending HITL validations.
 * Can be placed in navigation sidebar.
 */
export function PendingValidationsBadge({
  count,
}: {
  count: number;
}) {
  if (count === 0) return null;

  return (
    <span
      data-testid="orch-s03-pending-validations-badge"
      className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium text-white bg-amber-500 rounded-full"
    >
      <span data-testid="orch-s03-pending-validations-count">{count}</span>
    </span>
  );
}

/**
 * Panel listing all pending HITL validations for a company.
 */
export function PendingValidationsPanel({
  validations,
  onNavigate,
}: PendingValidationsPanelProps) {
  if (validations.length === 0) {
    return (
      <div
        data-testid="orch-s03-pending-validations-panel"
        className="p-4 text-sm text-muted-foreground text-center"
      >
        Aucune validation en attente
      </div>
    );
  }

  return (
    <div
      data-testid="orch-s03-pending-validations-panel"
      className="space-y-2"
    >
      <div className="flex items-center gap-2 px-1 pb-1">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">
          Validations en attente ({validations.length})
        </span>
      </div>

      {validations.map((v) => (
        <div
          key={v.stageId}
          data-testid="orch-s03-pending-validation-item"
          className="border border-border rounded-lg p-3 space-y-1 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span
              data-testid="orch-s03-pending-validation-stage-name"
              className="text-sm font-medium"
            >
              {v.stageName}
            </span>
            {v.rejectCount > 0 && (
              <span className="text-xs text-red-500">
                {v.rejectCount} rejet(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span data-testid="orch-s03-pending-validation-workflow-name">
              {v.workflowName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span data-testid="orch-s03-pending-validation-requested-at">
                {timeAgo(v.requestedAt)}
              </span>
            </div>
            {onNavigate && (
              <button
                data-testid="orch-s03-pending-validation-link"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => onNavigate(v.workflowInstanceId, v.stageId)}
              >
                Voir
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
