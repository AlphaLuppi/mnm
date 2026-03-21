import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  XCircle,
  Square,
  Trash2,
  Cpu,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import type { ContainerInfoFull, ContainerStatus, UserPod } from "@mnm/shared";
import { CONTAINER_STATUSES } from "@mnm/shared";
import { containersApi } from "../api/containers";
import { podsApi } from "../api/pods";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { StopContainerDialog } from "../components/StopContainerDialog";
import { DestroyContainerDialog } from "../components/DestroyContainerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { timeAgo } from "../lib/timeAgo";

function formatPercent(value: number | undefined | null): string {
  if (value == null) return "--";
  return `${value.toFixed(1)}%`;
}

function podStatusVariant(status: UserPod["status"]): "default" | "secondary" | "destructive" | "outline" {
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

function claudeAuthVariant(status: UserPod["claudeAuthStatus"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "authenticated":
      return "default";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function ResourceBar({
  value,
  testId,
}: {
  value: number | undefined | null;
  testId: string;
}) {
  const pct = value ?? 0;
  const color =
    pct > 80
      ? "bg-red-500"
      : pct > 60
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div
      data-testid={testId}
      className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export function Containers() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [stopTarget, setStopTarget] = useState<ContainerInfoFull | null>(null);
  const [destroyTarget, setDestroyTarget] = useState<ContainerInfoFull | null>(
    null,
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Containers" }]);
  }, [setBreadcrumbs]);

  // Docker health
  const healthQuery = useQuery({
    queryKey: queryKeys.containers.health(selectedCompanyId!),
    queryFn: () => containersApi.dockerHealth(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Container list
  const containersQuery = useQuery({
    queryKey: queryKeys.containers.list(selectedCompanyId!, {
      status: statusFilter || undefined,
    }),
    queryFn: () =>
      containersApi.list(selectedCompanyId!, {
        status: (statusFilter || undefined) as ContainerStatus | undefined,
      }),
    enabled: !!selectedCompanyId,
  });

  // POD-08: User pods list (admin)
  const podsQuery = useQuery({
    queryKey: queryKeys.pods.list(selectedCompanyId!),
    queryFn: () => podsApi.listAll(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const pods = useMemo(
    () => podsQuery.data?.pods ?? [],
    [podsQuery.data],
  );

  const containers = useMemo(
    () => containersQuery.data?.containers ?? [],
    [containersQuery.data],
  );

  const activeCount = useMemo(
    () =>
      containers.filter((c) =>
        ["running", "creating", "pending"].includes(c.status),
      ).length,
    [containers],
  );

  const dockerAvailable = healthQuery.data?.available ?? false;

  const canStop = (c: ContainerInfoFull) =>
    c.status === "running" || c.status === "creating";
  const canDestroy = (c: ContainerInfoFull) =>
    ["running", "stopped", "failed", "exited"].includes(c.status);

  // Loading state
  if (containersQuery.isLoading && !containersQuery.data) {
    return (
      <div data-testid="cont-s06-loading">
        <PageSkeleton />
      </div>
    );
  }

  // Error state
  if (containersQuery.error && !containersQuery.data) {
    return (
      <div
        data-testid="cont-s06-error"
        className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6 text-sm text-red-700 dark:text-red-300"
      >
        Failed to load containers. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cont-s06-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-muted-foreground" />
          <h1 data-testid="cont-s06-title" className="text-lg font-semibold">
            Containers
          </h1>
          {activeCount > 0 && (
            <Badge
              data-testid="cont-s06-container-count"
              variant="secondary"
              className="text-xs"
            >
              {activeCount} active
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Docker health indicator */}
          <div
            data-testid="cont-s06-health-indicator"
            className="flex items-center gap-1.5 text-xs"
          >
            {healthQuery.isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : dockerAvailable ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span
                  data-testid="cont-s06-health-available"
                  className="text-green-700 dark:text-green-400"
                >
                  Docker available
                  {healthQuery.data?.version
                    ? ` (v${healthQuery.data.version})`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-red-500" />
                <span
                  data-testid="cont-s06-health-unavailable"
                  className="text-red-700 dark:text-red-400"
                >
                  Docker unavailable
                </span>
              </>
            )}
          </div>

          {/* Auto-refresh indicator */}
          <div
            data-testid="cont-s06-refresh-indicator"
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <RefreshCw
              className={`h-3 w-3 ${containersQuery.isFetching ? "animate-spin" : ""}`}
            />
            <span>Auto-refresh</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger
            data-testid="cont-s06-filter-status"
            className="w-[160px] h-8 text-xs"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CONTAINER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {statusFilter && statusFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setStatusFilter("")}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Empty state */}
      {containers.length === 0 && (
        <div
          data-testid="cont-s06-empty-state"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <Box className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3
            data-testid="cont-s06-empty-title"
            className="text-sm font-medium mb-1"
          >
            No containers found
          </h3>
          <p
            data-testid="cont-s06-empty-description"
            className="text-xs text-muted-foreground max-w-sm"
          >
            {statusFilter && statusFilter !== "all"
              ? `No containers with status "${statusFilter}". Try clearing the filter.`
              : "Containers will appear here when agents are launched. Use the Agents page to start an agent in a container."}
          </p>
        </div>
      )}

      {/* Container table */}
      {containers.length > 0 && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table
            data-testid="cont-s06-table"
            className="w-full text-sm"
          >
            <thead>
              <tr
                data-testid="cont-s06-table-header"
                className="border-b text-left text-xs text-muted-foreground"
              >
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Profile</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">CPU</th>
                <th className="px-4 py-3 font-medium">Memory</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr
                  key={container.id}
                  data-testid="cont-s06-table-row"
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Agent */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="cont-s06-agent-name"
                      className="font-medium text-foreground"
                    >
                      {container.agentName}
                    </span>
                  </td>

                  {/* Profile */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="cont-s06-profile-name"
                      className="text-muted-foreground"
                    >
                      {container.profileName}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <ContainerStatusBadge status={container.status} />
                  </td>

                  {/* CPU */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ResourceBar
                        value={container.resourceUsage?.cpuPercent}
                        testId="cont-s06-cpu-bar"
                      />
                      <span
                        data-testid="cont-s06-cpu-value"
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatPercent(container.resourceUsage?.cpuPercent)}
                      </span>
                    </div>
                  </td>

                  {/* Memory */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ResourceBar
                        value={container.resourceUsage?.memoryPercent}
                        testId="cont-s06-memory-bar"
                      />
                      <span
                        data-testid="cont-s06-memory-value"
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatPercent(
                          container.resourceUsage?.memoryPercent,
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="cont-s06-created-at"
                      className="text-xs text-muted-foreground"
                      title={container.createdAt}
                    >
                      {timeAgo(container.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canStop(container) && (
                        <Button
                          data-testid="cont-s06-btn-stop"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setStopTarget(container)}
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      )}
                      {canDestroy(container) && (
                        <Button
                          data-testid="cont-s06-btn-destroy"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={() => setDestroyTarget(container)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
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

      {/* POD-08: User Pods section */}
      {pods.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-4">
            <Server className="h-5 w-5 text-muted-foreground" />
            <h2 data-testid="pod-s08-title" className="text-lg font-semibold">
              User Pods
            </h2>
            <Badge
              data-testid="pod-s08-count"
              variant="secondary"
              className="text-xs"
            >
              {pods.length}
            </Badge>
          </div>

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dialogs */}
      {stopTarget && (
        <StopContainerDialog
          open={!!stopTarget}
          onOpenChange={(open) => {
            if (!open) setStopTarget(null);
          }}
          containerId={stopTarget.id}
          agentName={stopTarget.agentName}
        />
      )}

      {destroyTarget && (
        <DestroyContainerDialog
          open={!!destroyTarget}
          onOpenChange={(open) => {
            if (!open) setDestroyTarget(null);
          }}
          containerId={destroyTarget.id}
          agentName={destroyTarget.agentName}
        />
      )}
    </div>
  );
}
