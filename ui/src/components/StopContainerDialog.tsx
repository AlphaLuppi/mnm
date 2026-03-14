import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { containersApi } from "../api/containers";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Square } from "lucide-react";

interface StopContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  agentName: string;
}

export function StopContainerDialog({
  open,
  onOpenChange,
  containerId,
  agentName,
}: StopContainerDialogProps) {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const stopMutation = useMutation({
    mutationFn: () =>
      containersApi.stop(selectedCompanyId!, containerId, {
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.containers.list(selectedCompanyId!),
      });
      onOpenChange(false);
      setReason("");
    },
  });

  function handleConfirm() {
    stopMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="cont-s06-stop-dialog">
        <DialogHeader>
          <DialogTitle>Stop Container</DialogTitle>
          <DialogDescription>
            This will gracefully stop the container for agent{" "}
            <strong>{agentName}</strong>. The agent process will receive SIGTERM
            and be given time to shut down cleanly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <label
            htmlFor="stop-reason"
            className="text-sm font-medium text-foreground"
          >
            Reason (optional)
          </label>
          <textarea
            id="stop-reason"
            data-testid="cont-s06-stop-reason"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={2}
            placeholder="Why is this container being stopped?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button
            data-testid="cont-s06-stop-cancel"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={stopMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            data-testid="cont-s06-stop-confirm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={stopMutation.isPending}
          >
            {stopMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Square className="h-4 w-4 mr-1.5" />
            )}
            Stop Container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
