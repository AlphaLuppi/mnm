/**
 * WORKFLOW-ASSIGNMENTS T3.5 — Inbox card for a pending workflow step
 * assigned to the current principal.
 *
 * Sits next to `InboxItemCard` in the Inbox page. Both surfaces share the
 * same visual rhythm (border + padding + group-hover dismiss) but the
 * data shape is fundamentally different (snake_case payload from
 * `GET /inbox/pending-workflow-steps`, no editorial body, no agent
 * notification metadata). A discriminated-union card would have made
 * `InboxItemCard` carry two unrelated render paths — cleaner to keep
 * them as siblings.
 *
 * Click navigates to the run detail page so the user can act on the step
 * (review artifacts, complete, reassign, ...).
 */
import { Link } from "@/lib/router";
import { Workflow, ArrowUpRight } from "lucide-react";
import { Identity } from "./Identity";
import { StatusBadge } from "./StatusBadge";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import type { PendingWorkflowStep } from "../api/workflow-assignments";

interface PendingWorkflowStepCardProps {
  step: PendingWorkflowStep;
}

/**
 * Map the assignment_reason trace produced by the backend resolver into
 * a short, human-readable label. The full trace stays available as a
 * tooltip via `title` for power users / auditors (§1.7).
 */
function shortAssignmentReason(reason: string): string {
  const head = reason.split(" + ")[0] ?? reason;
  if (head.startsWith("tag-intersection:")) return "Tag match";
  if (head.startsWith("role-expansion:")) return "Role";
  if (head.startsWith("delta-launchStep:")) return "Re-launched";
  if (head === "explicit") return "Explicit";
  return head;
}

export function PendingWorkflowStepCard({ step }: PendingWorkflowStepCardProps) {
  const href = `/workflows/${encodeURIComponent(step.workflow_name)}/runs/${step.run_id}`;
  const reasonLabel = shortAssignmentReason(step.assignment_reason);

  return (
    <div className="group relative">
      <div
        className={cn(
          "border border-border rounded-lg p-4 bg-card transition-all duration-200 min-w-0 overflow-hidden",
          "border-l-2 border-l-primary bg-primary/[0.02]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="rounded-md bg-primary/10 p-1.5">
                <Workflow className="h-3.5 w-3.5 text-primary" />
              </span>
              <Identity name={step.workflow_name} size="sm" />
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-sm font-medium truncate">{step.step_name}</span>
              <StatusBadge status={step.run_status} />
              <span
                title={step.assignment_reason}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {reasonLabel}
              </span>
              {step.has_artifacts && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Artifacts ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {step.workflow_git_tag && (
                <>
                  <span className="font-mono">{step.workflow_git_tag}</span>
                  <span>·</span>
                </>
              )}
              <span>assigned {timeAgo(step.assigned_at)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              to={href}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent hover:text-foreground no-underline text-inherit"
            >
              Open run
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
