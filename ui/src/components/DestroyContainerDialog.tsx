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
import { Loader2, Trash2 } from "lucide-react";

interface DestroyContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  agentName: string;
}

export function DestroyContainerDialog({
  open,
  onOpenChange,
  containerId,
  agentName,
}: DestroyContainerDialogProps) {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();

  const destroyMutation = useMutation({
    mutationFn: () =>
      containersApi.destroy(selectedCompanyId!, containerId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.containers.list(selectedCompanyId!),
      });
      onOpenChange(false);
    },
  });

  function handleConfirm() {
    destroyMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="cont-s06-destroy-dialog">
        <DialogHeader>
          <DialogTitle>Destroy Container</DialogTitle>
          <DialogDescription>
            This will permanently destroy the container for agent{" "}
            <strong>{agentName}</strong>. This action cannot be undone. The
            container will be force-stopped and removed.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            data-testid="cont-s06-destroy-cancel"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={destroyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            data-testid="cont-s06-destroy-confirm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={destroyMutation.isPending}
          >
            {destroyMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1.5" />
            )}
            Destroy Container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
