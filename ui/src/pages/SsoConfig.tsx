import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import type { SsoConfiguration } from "@mnm/shared";
import { ssoApi } from "../api/sso";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { SsoProviderCard } from "../components/SsoProviderCard";
import { CreateSsoDialog } from "../components/CreateSsoDialog";
import { EditSsoDialog } from "../components/EditSsoDialog";
import { DeleteSsoDialog } from "../components/DeleteSsoDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SsoConfig() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SsoConfiguration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SsoConfiguration | null>(null);

  // Track loading states per-config for toggle/verify/sync
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [verifyLoadingId, setVerifyLoadingId] = useState<string | null>(null);
  const [syncLoadingId, setSyncLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Admin", href: "/admin/roles" },
      { label: "SSO Configuration" },
    ]);
  }, [setBreadcrumbs]);

  // SSO configurations list
  const ssoQuery = useQuery({
    queryKey: queryKeys.sso.list(selectedCompanyId!),
    queryFn: () => ssoApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const configurations = useMemo(
    () => ssoQuery.data?.configurations ?? [],
    [ssoQuery.data],
  );

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (configId: string) => {
      setToggleLoadingId(configId);
      return ssoApi.toggle(selectedCompanyId!, configId);
    },
    onSettled: () => {
      setToggleLoadingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(selectedCompanyId!) });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (configId: string) => {
      setVerifyLoadingId(configId);
      return ssoApi.verify(selectedCompanyId!, configId);
    },
    onSettled: () => {
      setVerifyLoadingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(selectedCompanyId!) });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (configId: string) => {
      setSyncLoadingId(configId);
      return ssoApi.sync(selectedCompanyId!, configId);
    },
    onSettled: () => {
      setSyncLoadingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sso.list(selectedCompanyId!) });
    },
  });

  // Loading state
  if (ssoQuery.isLoading && !ssoQuery.data) {
    return (
      <div data-testid="sso-s03-loading">
        <PageSkeleton />
      </div>
    );
  }

  // Error state
  if (ssoQuery.error && !ssoQuery.data) {
    return (
      <div
        data-testid="sso-s03-error"
        className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6 text-sm text-red-700 dark:text-red-300"
      >
        Failed to load SSO configurations. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sso-s03-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <h1 data-testid="sso-s03-title" className="text-lg font-semibold">
            SSO Configuration
          </h1>
          {configurations.length > 0 && (
            <Badge
              data-testid="sso-s03-provider-count"
              variant="secondary"
              className="text-xs"
            >
              {configurations.length} provider{configurations.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <Button
          data-testid="sso-s03-btn-add"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add SSO Provider
        </Button>
      </div>

      {/* Empty state */}
      {configurations.length === 0 && (
        <div
          data-testid="sso-s03-empty-state"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <KeyRound className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3
            data-testid="sso-s03-empty-title"
            className="text-sm font-medium mb-1"
          >
            No SSO providers configured
          </h3>
          <p
            data-testid="sso-s03-empty-description"
            className="text-xs text-muted-foreground max-w-sm"
          >
            Configure SAML 2.0 or OpenID Connect providers to enable single sign-on
            for your organization. Members will be able to log in using their
            corporate identity provider.
          </p>
        </div>
      )}

      {/* Provider list */}
      {configurations.length > 0 && (
        <div data-testid="sso-s03-provider-list" className="space-y-4">
          {configurations.map((config) => (
            <SsoProviderCard
              key={config.id}
              config={config}
              onEdit={(c) => setEditTarget(c)}
              onToggle={(c) => toggleMutation.mutate(c.id)}
              onVerify={(c) => verifyMutation.mutate(c.id)}
              onSync={(c) => syncMutation.mutate(c.id)}
              onDelete={(c) => setDeleteTarget(c)}
              toggleLoading={toggleLoadingId === config.id}
              verifyLoading={verifyLoadingId === config.id}
              syncLoading={syncLoadingId === config.id}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateSsoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={selectedCompanyId!}
      />

      {editTarget && (
        <EditSsoDialog
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          companyId={selectedCompanyId!}
          config={editTarget}
        />
      )}

      {deleteTarget && (
        <DeleteSsoDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          companyId={selectedCompanyId!}
          config={deleteTarget}
        />
      )}
    </div>
  );
}
