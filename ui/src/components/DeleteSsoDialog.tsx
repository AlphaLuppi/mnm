import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SsoConfiguration } from "@mnm/shared";
import { ssoApi } from "../api/sso";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DeleteSsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  config: SsoConfiguration;
}

export function DeleteSsoDialog({
  open,
  onOpenChange,
  companyId,
  config,
}: DeleteSsoDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => ssoApi.delete(companyId, config.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(companyId) });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sso-s03-delete-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="sso-s03-delete-title">
            Delete SSO Provider
          </DialogTitle>
        </DialogHeader>

        <p
          data-testid="sso-s03-delete-message"
          className="text-sm text-muted-foreground"
        >
          {config.enabled
            ? "This provider is currently enabled. You must disable it before deleting."
            : `Are you sure you want to delete the ${config.provider.toUpperCase()} provider "${config.displayName ?? config.provider}"? This action cannot be undone.`}
        </p>

        {/* Error display */}
        {deleteMutation.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : "Failed to delete SSO provider"}
          </p>
        )}

        <DialogFooter>
          <Button
            data-testid="sso-s03-delete-btn-cancel"
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="sso-s03-delete-btn-confirm"
            variant="destructive"
            disabled={config.enabled || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Delete Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
