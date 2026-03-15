import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SsoProvider } from "@mnm/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CreateSsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export function CreateSsoDialog({
  open,
  onOpenChange,
  companyId,
}: CreateSsoDialogProps) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<SsoProvider>("saml");
  const [displayName, setDisplayName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  // SAML fields
  const [metadataUrl, setMetadataUrl] = useState("");
  const [entityId, setEntityId] = useState("");
  const [certificate, setCertificate] = useState("");
  // OIDC fields
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: () => {
      const input: Parameters<typeof ssoApi.create>[1] = {
        provider,
        displayName: displayName || undefined,
        emailDomain: emailDomain || undefined,
      };

      if (provider === "saml") {
        if (metadataUrl) input.metadataUrl = metadataUrl;
        if (entityId) input.entityId = entityId;
        if (certificate) input.certificate = certificate;
      } else {
        // OIDC — store clientId/clientSecret/discoveryUrl in config
        const oidcConfig: Record<string, unknown> = {};
        if (clientId) {
          input.entityId = clientId; // entityId doubles as clientId
          oidcConfig.clientId = clientId;
        }
        if (clientSecret) oidcConfig.clientSecret = clientSecret;
        if (discoveryUrl) {
          input.metadataUrl = discoveryUrl;
          oidcConfig.discoveryUrl = discoveryUrl;
        }
        if (Object.keys(oidcConfig).length > 0) input.config = oidcConfig;
      }

      return ssoApi.create(companyId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(companyId) });
      resetForm();
      onOpenChange(false);
    },
  });

  function resetForm() {
    setProvider("saml");
    setDisplayName("");
    setEmailDomain("");
    setMetadataUrl("");
    setEntityId("");
    setCertificate("");
    setClientId("");
    setClientSecret("");
    setDiscoveryUrl("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sso-s03-create-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="sso-s03-create-title">
            Add SSO Provider
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider type */}
          <div className="space-y-1.5">
            <Label htmlFor="provider-type">Provider Type</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as SsoProvider)}
            >
              <SelectTrigger
                data-testid="sso-s03-create-provider-select"
                id="provider-type"
              >
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saml">SAML 2.0</SelectItem>
                <SelectItem value="oidc">OIDC (OpenID Connect)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              data-testid="sso-s03-create-display-name"
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Company Okta SSO"
            />
          </div>

          {/* Email Domain */}
          <div className="space-y-1.5">
            <Label htmlFor="email-domain">Email Domain</Label>
            <Input
              data-testid="sso-s03-create-email-domain"
              id="email-domain"
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              placeholder="e.g. acme.com"
            />
          </div>

          {/* SAML-specific fields */}
          {provider === "saml" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="metadata-url">Metadata URL</Label>
                <Input
                  data-testid="sso-s03-create-metadata-url"
                  id="metadata-url"
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                  placeholder="https://idp.example.com/metadata"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entity-id">Entity ID</Label>
                <Input
                  data-testid="sso-s03-create-entity-id"
                  id="entity-id"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="https://idp.example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="certificate">X.509 Certificate</Label>
                <Textarea
                  data-testid="sso-s03-create-certificate"
                  id="certificate"
                  value={certificate}
                  onChange={(e) => setCertificate(e.target.value)}
                  placeholder="Paste the PEM-encoded certificate..."
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}

          {/* OIDC-specific fields */}
          {provider === "oidc" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  data-testid="sso-s03-create-client-id"
                  id="client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="your-oidc-client-id"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  data-testid="sso-s03-create-client-secret"
                  id="client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="your-client-secret"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discovery-url">Discovery URL</Label>
                <Input
                  data-testid="sso-s03-create-discovery-url"
                  id="discovery-url"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  placeholder="https://accounts.example.com/.well-known/openid-configuration"
                />
              </div>
            </>
          )}

          {/* Error display */}
          {createMutation.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create SSO provider"}
            </p>
          )}

          <DialogFooter>
            <Button
              data-testid="sso-s03-create-btn-cancel"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="sso-s03-create-btn-submit"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
