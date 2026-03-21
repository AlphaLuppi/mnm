// DEPLOY-06: Deployments list page
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  ExternalLink,
  Pin,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import type { DeploymentStatus } from "@mnm/shared";
import { deploymentsApi } from "../api/deployments";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../lib/timeAgo";

function statusIcon(status: DeploymentStatus) {
  switch (status) {
    case "running":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "building":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "expired":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusColor(status: DeploymentStatus): string {
  switch (status) {
    case "running":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "building":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "failed":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function Deployments() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Deployments" }]);
  }, [setBreadcrumbs]);

  const deploymentsQuery = useQuery({
    queryKey: queryKeys.deployments.list(selectedCompanyId!),
    queryFn: () => deploymentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10000,
  });

  const deployments = useMemo(
    () => deploymentsQuery.data?.deployments ?? [],
    [deploymentsQuery.data],
  );

  const activeCount = deployments.filter((d) =>
    ["running", "building"].includes(d.status),
  ).length;

  if (deploymentsQuery.isLoading && !deploymentsQuery.data) {
    return <div data-testid="deploy-loading"><PageSkeleton /></div>;
  }

  return (
    <div className="space-y-6" data-testid="deploy-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Deployments</h1>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${deploymentsQuery.isFetching ? "animate-spin" : ""}`} />
          <span>Auto-refresh</span>
        </div>
      </div>

      {/* Empty state */}
      {deployments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <Globe className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium mb-1">No deployments</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Deployments will appear here when agents produce artifacts. Deploy from a run detail page or via the API.
          </p>
        </div>
      )}

      {/* Deployment cards */}
      {deployments.length > 0 && (
        <div className="space-y-3">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
              data-testid="deploy-card"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{deployment.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(deployment.status)}`}>
                      {statusIcon(deployment.status)}
                      <span className="ml-1">{deployment.status}</span>
                    </Badge>
                    {deployment.pinned && (
                      <Pin className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {deployment.issueTitle && (
                      <span>Issue: {deployment.issueTitle}</span>
                    )}
                    {deployment.agentName && (
                      <span>Agent: {deployment.agentName}</span>
                    )}
                    <span>{timeAgo(deployment.createdAt)}</span>
                    {deployment.expiresAt && !deployment.pinned && (
                      <span>Expires {timeAgo(deployment.expiresAt)}</span>
                    )}
                  </div>
                </div>

                {deployment.status === "running" && deployment.url && (
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Preview
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
