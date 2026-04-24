import { useState } from "react";
import { useNavigate, Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useEffect } from "react";
import { governedWorkflowsApi } from "../api/governed-workflows";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import type { GovernedWorkflowDefinitionRow } from "@mnm/shared";

export function GovernedWorkflowsList() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Workflows gouvernés" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!),
    queryFn: () => governedWorkflowsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const setEnabledMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      governedWorkflowsApi.setEnabled(selectedCompanyId!, name, enabled),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      governedWorkflowsApi.delete(selectedCompanyId!, name),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!),
      });
    },
  });

  function handleDelete(row: GovernedWorkflowDefinitionRow) {
    if (!confirm(`Archiver "${row.name}" ?`)) return;
    deleteMutation.mutate(row.name);
  }

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="py-8 text-sm text-destructive">
        Erreur lors du chargement des workflows.
      </div>
    );
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workflows gouvernés</h1>
        <Button asChild>
          <Link to="/workflows/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau workflow
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          message="Aucun workflow gouverné. Créez-en un pour commencer."
          action="Nouveau workflow"
          onAction={() => navigate("/workflows/new")}
        />
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nom</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-left font-medium">Tag</th>
                <th className="px-4 py-2 text-left font-medium">Activé</th>
                <th className="px-4 py-2 text-left font-medium">Dernière modif</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      to={`/workflows/${encodeURIComponent(row.name)}`}
                      className="text-foreground hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.description ?? <span className="italic text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {row.latestGitTag ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.latestGitTag}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        setEnabledMutation.mutate({ name: row.name, enabled: checked })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {relativeTime(row.updatedAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/workflows/${encodeURIComponent(row.name)}/runs`}>
                          Runs
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(row)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
