import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Server,
  RotateCcw,
  Trash2,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import type { UserSandbox } from "@mnm/shared";
import { sandboxesApi } from "../api/sandboxes";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../lib/timeAgo";

function podStatusVariant(status: UserSandbox["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
      return "default";
    case "idle":
    case "provisioning":
      return "secondary";
    case "hibernated":
      return "outline";
    case "failed":
    case "destroyed":
      return "destructive";
    default:
      return "secondary";
  }
}

function claudeAuthVariant(status: UserSandbox["claudeAuthStatus"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "authenticated":
      return "default";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

export function Containers() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Sandboxes" }]);
  }, [setBreadcrumbs]);

  // POD-08: User pods list (admin)
  const podsQuery = useQuery({
    queryKey: queryKeys.sandboxes.list(selectedCompanyId!),
    queryFn: () => sandboxesApi.listAll(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  async function handleDestroy() {
    if (!selectedCompanyId) return;
    if (!confirm("Destroy your sandbox? It will be re-created on next agent run.")) return;
    setActionLoading("destroy");
    try {
      await sandboxesApi.destroy(selectedCompanyId);
      queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.list(selectedCompanyId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to destroy sandbox");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReprovision() {
    if (!selectedCompanyId) return;
    setActionLoading("reprovision");
    try {
      // Destroy first, then provision
      try { await sandboxesApi.destroy(selectedCompanyId); } catch { /* may not exist */ }
      await sandboxesApi.provision(selectedCompanyId);
      queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.list(selectedCompanyId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reprovision sandbox");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleWake() {
    if (!selectedCompanyId) return;
    setActionLoading("wake");
    try {
      await sandboxesApi.wake(selectedCompanyId);
      queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.list(selectedCompanyId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to wake sandbox");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleHibernate() {
    if (!selectedCompanyId) return;
    setActionLoading("hibernate");
    try {
      await sandboxesApi.hibernate(selectedCompanyId);
      queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.list(selectedCompanyId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to hibernate sandbox");
    } finally {
      setActionLoading(null);
    }
  }

  const pods = useMemo(
    () => podsQuery.data?.pods ?? [],
    [podsQuery.data],
  );

  // Loading state
  if (podsQuery.isLoading && !podsQuery.data) {
    return (
      <div data-testid="cont-s06-loading">
        <PageSkeleton />
      </div>
    );
  }

  // Error state
  if (podsQuery.error && !podsQuery.data) {
    return (
      <div
        data-testid="cont-s06-error"
        className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6 text-sm text-red-700 dark:text-red-300"
      >
        Failed to load sandboxes. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cont-s06-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Box className="h-5 w-5 text-muted-foreground" />
        <h1 data-testid="cont-s06-title" className="text-lg font-semibold">
          Sandboxes
        </h1>
        {pods.length > 0 && (
          <Badge
            data-testid="pod-s08-count"
            variant="secondary"
            className="text-xs"
          >
            {pods.length}
          </Badge>
        )}
      </div>

      {/* Empty state */}
      {pods.length === 0 && (
        <div
          data-testid="cont-s06-empty-state"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <Server className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3
            data-testid="cont-s06-empty-title"
            className="text-sm font-medium mb-1"
          >
            No sandboxes found
          </h3>
          <p
            data-testid="cont-s06-empty-description"
            className="text-xs text-muted-foreground max-w-sm"
          >
            User pods will appear here when provisioned. Use the Workspace page to provision your sandbox.
          </p>
        </div>
      )}

      {/* User Pods table */}
      {pods.length > 0 && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table
            data-testid="pod-s08-table"
            className="w-full text-sm"
          >
            <thead>
              <tr
                data-testid="pod-s08-table-header"
                className="border-b text-left text-xs text-muted-foreground"
              >
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">CPU / RAM</th>
                <th className="px-4 py-3 font-medium">Claude Auth</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pods.map((pod) => (
                <tr
                  key={pod.id}
                  data-testid="pod-s08-table-row"
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* User */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="pod-s08-user-name"
                      className="font-medium text-foreground"
                    >
                      {pod.userName ?? pod.userId.slice(0, 8)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge
                      data-testid="pod-s08-status"
                      variant={podStatusVariant(pod.status)}
                      className="text-xs"
                    >
                      {pod.status}
                    </Badge>
                  </td>

                  {/* Image */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="pod-s08-image"
                      className="text-xs text-muted-foreground font-mono"
                    >
                      {pod.dockerImage}
                    </span>
                  </td>

                  {/* CPU / RAM */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="pod-s08-resources"
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {pod.cpuMillicores}m / {pod.memoryMb}MB
                    </span>
                  </td>

                  {/* Claude Auth */}
                  <td className="px-4 py-3">
                    <Badge
                      data-testid="pod-s08-claude-auth"
                      variant={claudeAuthVariant(pod.claudeAuthStatus)}
                      className="text-xs"
                    >
                      {pod.claudeAuthStatus}
                    </Badge>
                  </td>

                  {/* Last Active */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="pod-s08-last-active"
                      className="text-xs text-muted-foreground"
                      title={pod.lastActiveAt ?? undefined}
                    >
                      {pod.lastActiveAt ? timeAgo(pod.lastActiveAt) : "--"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {pod.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={!!actionLoading}
                          onClick={handleReprovision}
                        >
                          {actionLoading === "reprovision" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Reset
                        </Button>
                      )}
                      {pod.status === "hibernated" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={!!actionLoading}
                          onClick={handleWake}
                        >
                          {actionLoading === "wake" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Wake
                        </Button>
                      )}
                      {(pod.status === "running" || pod.status === "idle") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={!!actionLoading}
                          onClick={handleHibernate}
                        >
                          {actionLoading === "hibernate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                          Hibernate
                        </Button>
                      )}
                      {pod.status !== "destroyed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          disabled={!!actionLoading}
                          onClick={handleDestroy}
                        >
                          {actionLoading === "destroy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Destroy
                        </Button>
                      )}
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
