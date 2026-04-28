/**
 * CancelRunDialog — confirmation modal for cancelling an active governed
 * workflow run.
 *
 * Wraps `useCancelRun` (see ui/src/hooks/useWorkflowRunActions.ts) — that hook
 * already handles success/error toasts, so this dialog only drives:
 *   - the reason textarea (server requires >= 5 trimmed chars; mirrored here)
 *   - the open/close lifecycle
 *   - an optional onSuccess callback for the caller (e.g. close a parent menu)
 *
 * UI primitives are imported from `@/components/ui/*` per the repo rule
 * "Always use UI library components — never create custom/inline impls".
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCancelRun } from "@/hooks/useWorkflowRunActions";

/** Min trimmed length the server enforces for the cancel reason. */
export const MIN_CANCEL_REASON_LENGTH = 5;

/**
 * Pure validator — exported so tests can exercise it without rendering the
 * dialog (this workspace doesn't ship React Testing Library; see existing
 * tests under ui/src/components/workflow-studio/__tests__).
 */
export function isCancelReasonValid(reason: string): boolean {
  return reason.trim().length >= MIN_CANCEL_REASON_LENGTH;
}

interface CancelRunDialogProps {
  runId: string;
  workflowName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelRunDialog({
  runId,
  workflowName,
  open,
  onOpenChange,
  onSuccess,
}: CancelRunDialogProps) {
  const [reason, setReason] = useState("");
  const cancel = useCancelRun(runId);

  const isValid = isCancelReasonValid(reason);

  const handleConfirm = async () => {
    if (!isValid) return;
    try {
      await cancel.mutateAsync({ reason: reason.trim() });
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error toast already surfaced by useCancelRun; keep the dialog open so
      // the user can retry or amend the reason.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent expandable={false}>
        <DialogHeader>
          <DialogTitle>Annuler le run {workflowName}</DialogTitle>
          <DialogDescription>
            Les étapes en cours seront annulées. Le run pourra être réactivé plus tard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">
            Raison de l'annulation (min {MIN_CANCEL_REASON_LENGTH} caractères)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : run lancé par erreur"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Garder actif
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || cancel.isPending}
          >
            {cancel.isPending ? "Annulation..." : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
