import { CheckCircle2, XCircle } from "lucide-react";
import type { HitlDecision } from "@mnm/shared";

export interface ValidationHistoryProps {
  decisions: HitlDecision[];
}

/**
 * Displays the chronological history of HITL decisions for a stage.
 */
export function ValidationHistory({ decisions }: ValidationHistoryProps) {
  if (decisions.length === 0) return null;

  return (
    <div data-testid="orch-s03-validation-history" className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">
        Historique des validations ({decisions.length})
      </span>
      <div className="space-y-1.5">
        {decisions.map((d, index) => (
          <div
            key={`${d.decidedAt}-${index}`}
            data-testid="orch-s03-validation-history-item"
            className="flex items-start gap-2 text-xs border-l-2 pl-2 py-1"
            style={{
              borderColor: d.decision === "approved"
                ? "rgb(34 197 94)" // green-500
                : "rgb(239 68 68)", // red-500
            }}
          >
            {d.decision === "approved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  data-testid="orch-s03-validation-history-decision"
                  className={
                    d.decision === "approved"
                      ? "font-medium text-green-700 dark:text-green-400"
                      : "font-medium text-red-700 dark:text-red-400"
                  }
                >
                  {d.decision === "approved" ? "Approuve" : "Rejete"}
                </span>
                <span
                  data-testid="orch-s03-validation-history-actor"
                  className="text-muted-foreground"
                >
                  par {d.actorId} ({d.actorType})
                </span>
              </div>
              <span
                data-testid="orch-s03-validation-history-date"
                className="text-muted-foreground"
              >
                {new Date(d.decidedAt).toLocaleString()}
              </span>
              {d.feedback && (
                <p
                  data-testid="orch-s03-validation-history-feedback"
                  className="text-muted-foreground italic mt-0.5"
                >
                  {d.feedback}
                </p>
              )}
              {d.comment && (
                <p className="text-muted-foreground italic mt-0.5">
                  {d.comment}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
