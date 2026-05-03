import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Webhook, Lock } from "lucide-react";

import { hooksApi, type HookConfig } from "../api/hooks";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { usePermissions } from "../hooks/usePermissions";
import { queryKeys } from "../lib/queryKeys";
import { formatApiError } from "../lib/api-errors";

import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { VisibilityBadge } from "../components/visibility/VisibilityBadge";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { HookConfigDetail } from "./HookConfigDetail";
import { HookCatalog } from "./HookCatalog";

type HooksTab = "configs" | "catalog";

/**
 * Workflow Hooks page (T2.9 plan).
 *
 * Two tabs:
 *   • "Mes configs" — the company's own hook_configs with VisibilityBadge,
 *     enabled toggle, enforced flag, click-to-edit Sheet.
 *   • "Catalog" — read-only browser of canonical/shared/local hook entries.
 *
 * Decision 12: route is `/hooks` (and `/hooks/:configId`). companyId is read
 * from useCompany() context, never from the URL.
 */
export function Hooks() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState<HooksTab>("configs");
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Workflows" }, { label: "Hooks" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const canManage = hasPermission("hooks:manage");
  const canEnforce = hasPermission("hooks:enforce");

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.hooks.list(selectedCompanyId!),
    queryFn: () => hooksApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && canManage,
  });

  const configs = useMemo<HookConfig[]>(() => data?.configs ?? [], [data]);

  if (!selectedCompanyId) return <PageSkeleton />;

  if (!canManage) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <Lock className="h-8 w-8 text-muted-foreground/60" />
            <h2 className="text-lg font-semibold">Accès restreint</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              La gestion des hooks de workflow nécessite la permission{" "}
              <code className="text-xs">hooks:manage</code>. Demandez-la à un
              administrateur de la company.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            Hooks de workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure les hooks (HTTP, audit, gardes-fous LLM…) qui s'exécutent
            automatiquement avant ou après un step de workflow.
          </p>
        </div>

        {activeTab === "configs" && (
          <Button
            onClick={() => setCreating(true)}
            data-testid="hooks-new-config"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle config
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as HooksTab)}
      >
        <TabsList>
          <TabsTrigger value="configs" data-testid="hooks-tab-configs">
            Mes configs ({configs.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" data-testid="hooks-tab-catalog">
            Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="mt-6">
          {isLoading ? (
            <PageSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Impossible de charger les configs."}
            </p>
          ) : configs.length === 0 ? (
            <EmptyState
              icon={Webhook}
              message="Aucune config de hook. Crée-en une pour exécuter une action automatique sur un step de workflow."
              action="Nouvelle config"
              onAction={() => setCreating(true)}
            />
          ) : (
            <div className="grid gap-4">
              {configs.map((c) => (
                <HookConfigRow
                  key={c.id}
                  config={c}
                  companyId={selectedCompanyId}
                  canManage={canManage}
                  canEnforce={canEnforce}
                  onClick={() => setEditingConfigId(c.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-6">
          <HookCatalog companyId={selectedCompanyId} />
        </TabsContent>
      </Tabs>

      {/* Create config */}
      {creating && (
        <HookConfigDetail
          companyId={selectedCompanyId}
          mode="create"
          canEnforce={canEnforce}
          open
          onClose={() => setCreating(false)}
        />
      )}

      {/* Edit config */}
      {editingConfigId && (
        <HookConfigDetail
          companyId={selectedCompanyId}
          configId={editingConfigId}
          mode="edit"
          canEnforce={canEnforce}
          open
          onClose={() => setEditingConfigId(null)}
        />
      )}
    </div>
  );
}

function HookConfigRow({
  config,
  companyId,
  canManage,
  canEnforce,
  onClick,
}: {
  config: HookConfig;
  companyId: string;
  canManage: boolean;
  canEnforce: boolean;
  onClick: () => void;
}) {
  const queryClient = useQueryClient();
  const [rowError, setRowError] = useState<string | null>(null);

  const visibilityCount =
    config.visibility === "tags"
      ? config.tagIds.length
      : config.visibility === "principals"
        ? config.principalIds.length
        : undefined;

  // Optimistic toggle for `enabled` / `enforced`. Rolls back on error.
  const toggleMutation = useMutation({
    mutationFn: (patch: { enabled?: boolean; enforced?: boolean }) =>
      hooksApi.update(companyId, config.id, patch),
    onMutate: async (patch) => {
      setRowError(null);
      const listKey = queryKeys.hooks.list(companyId);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous =
        queryClient.getQueryData<{ configs: HookConfig[] }>(listKey);
      if (previous) {
        queryClient.setQueryData<{ configs: HookConfig[] }>(listKey, {
          configs: previous.configs.map((c) =>
            c.id === config.id ? { ...c, ...patch } : c,
          ),
        });
      }
      return { previous };
    },
    onError: (err, _patch, ctx) => {
      const listKey = queryKeys.hooks.list(companyId);
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      setRowError(formatApiError(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hooks.list(companyId),
      });
    },
  });

  const enabledSwitch = (
    <Switch
      checked={config.enabled}
      disabled={!canManage || toggleMutation.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(v) => {
        if (!canManage) return;
        toggleMutation.mutate({ enabled: v });
      }}
      data-testid={`hook-config-row-enabled-${config.id}`}
    />
  );

  const enforcedSwitch = (
    <Switch
      checked={config.enforced}
      disabled={!canEnforce || toggleMutation.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(v) => {
        if (!canEnforce) return;
        toggleMutation.mutate({ enforced: v });
      }}
      data-testid={`hook-config-row-enforced-${config.id}`}
    />
  );

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
      data-testid={`hooks-row-${config.id}`}
    >
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Webhook className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-medium truncate">{config.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              <code>{config.hookRef}</code>
            </p>
            {rowError && (
              <p
                className="text-xs text-destructive truncate"
                role="alert"
                data-testid={`hook-config-row-error-${config.id}`}
              >
                {rowError}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <VisibilityBadge
            visibility={config.visibility}
            count={visibilityCount}
            testId={`hooks-visibility-${config.id}`}
          />

          {/* Enforced toggle (gated by hooks:enforce). */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
              {canEnforce ? (
                enforcedSwitch
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {enforcedSwitch}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Requires hooks:enforce permission
                  </TooltipContent>
                </Tooltip>
              )}
              <Label
                className="text-xs text-muted-foreground"
                data-testid={`hook-config-row-enforced-label-${config.id}`}
              >
                {config.enforced ? "Enforced" : "Standard"}
              </Label>
            </div>
          </TooltipProvider>

          {/* Enabled toggle (gated by hooks:manage). */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
              {canManage ? (
                enabledSwitch
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {enabledSwitch}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Permission manquante</TooltipContent>
                </Tooltip>
              )}
              <Label className="text-xs text-muted-foreground">
                {config.enabled ? "Actif" : "Inactif"}
              </Label>
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
