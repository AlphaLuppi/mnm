/**
 * RunActionButton — per-row action button for the governed workflow runs list.
 *
 * Conditional rendering by run state:
 *   - cancelledAt !== null         → "Réactiver" (RotateCcw) → useReactivateRun
 *   - status === "active" (& not cancelled) → "Annuler" (X) → opens CancelRunDialog
 *   - otherwise (draft/completed/failed) → null
 *
 * Click events are stopped from propagating so the row's own onClick handler
 * (which navigates to the run detail page) does NOT fire when the user clicks
 * one of the action buttons.
 */
import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReactivateRun } from "@/hooks/useWorkflowRunActions";
import { CancelRunDialog } from "@/components/workflows/CancelRunDialog";

interface RunActionButtonProps {
  runId: string;
  status: string;
  cancelledAt: string | null;
  workflowName: string;
}

export function RunActionButton({
  runId,
  status,
  cancelledAt,
  workflowName,
}: RunActionButtonProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const reactivate = useReactivateRun(runId);

  if (cancelledAt !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              reactivate.mutate();
            }}
            disabled={reactivate.isPending}
            aria-label="Réactiver"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Réactiver</TooltipContent>
      </Tooltip>
    );
  }

  if (status === "active") {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setCancelOpen(true);
              }}
              aria-label="Annuler"
            >
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Annuler</TooltipContent>
        </Tooltip>
        <CancelRunDialog
          runId={runId}
          workflowName={workflowName}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
      </>
    );
  }

  return null;
}
