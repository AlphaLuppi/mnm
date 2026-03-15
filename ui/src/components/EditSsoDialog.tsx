import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface EditSsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  config: SsoConfiguration;
}

export function EditSsoDialog({
  open,
  onOpenChange,
  companyId,
  config,
}: EditSsoDialogProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(config.displayName ?? "");
  const [emailDomain, setEmailDomain] = useState(config.emailDomain ?? "");
  const [metadataUrl, setMetadataUrl] = useState(config.metadataUrl ?? "");
  const [entityId, setEntityId] = useState(config.entityId ?? "");
  const [certificate, setCertificate] = useState(config.certificate ?? "");

  // Re-populate when config changes
  useEffect(() => {
    setDisplayName(config.displayName ?? "");
    setEmailDomain(config.emailDomain ?? "");
    setMetadataUrl(config.metadataUrl ?? "");
    setEntityId(config.entityId ?? "");
    setCertificate(config.certificate ?? "");
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const input: Parameters<typeof ssoApi.update>[2] = {};
      if (displayName !== (config.displayName ?? "")) input.displayName = displayName || undefined;
      if (emailDomain !== (config.emailDomain ?? "")) input.emailDomain = emailDomain || undefined;
      if (metadataUrl !== (config.metadataUrl ?? "")) input.metadataUrl = metadataUrl || undefined;
      if (entityId !== (config.entityId ?? "")) input.entityId = entityId || undefined;
      if (certificate !== (config.certificate ?? "")) input.certificate = certificate || undefined;

      return ssoApi.update(companyId, config.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(companyId) });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sso-s03-edit-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="sso-s03-edit-title">
            Edit SSO Provider — {config.provider.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name">Display Name</Label>
            <Input
              data-testid="sso-s03-edit-display-name"
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Company Okta SSO"
            />
          </div>

          {/* Email Domain */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-email-domain">Email Domain</Label>
            <Input
              data-testid="sso-s03-edit-email-domain"
              id="edit-email-domain"
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              placeholder="e.g. acme.com"
            />
          </div>

          {/* Metadata URL */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-metadata-url">Metadata URL</Label>
            <Input
              data-testid="sso-s03-edit-metadata-url"
              id="edit-metadata-url"
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
              placeholder={
                config.provider === "saml"
                  ? "https://idp.example.com/metadata"
                  : "https://accounts.example.com/.well-known/openid-configuration"
              }
            />
          </div>

          {/* Entity ID */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-entity-id">
              {config.provider === "saml" ? "Entity ID" : "Client ID"}
            </Label>
            <Input
              data-testid="sso-s03-edit-entity-id"
              id="edit-entity-id"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={
                config.provider === "saml"
                  ? "https://idp.example.com"
                  : "your-client-id"
              }
            />
          </div>

          {/* Certificate (SAML only, but shown for both for edit flexibility) */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-certificate">X.509 Certificate</Label>
            <Textarea
              data-testid="sso-s03-edit-certificate"
              id="edit-certificate"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              placeholder="Paste the PEM-encoded certificate..."
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {/* Error display */}
          {updateMutation.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : "Failed to update SSO provider"}
            </p>
          )}

          <DialogFooter>
            <Button
              data-testid="sso-s03-edit-btn-cancel"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="sso-s03-edit-btn-submit"
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
