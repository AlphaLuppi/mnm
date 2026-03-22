// DEPLOY-08: Deployment links panel for IssueDetail page
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  ExternalLink,
  Pin,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
} from "lucide-react";
import type { DeploymentStatus } from "@mnm/shared";
import { deploymentsApi } from "../../api/deployments";
import { useCompany } from "../../context/CompanyContext";
import { queryKeys } from "../../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../../lib/timeAgo";

function statusIcon(status: DeploymentStatus) {
  switch (status) {
    case "running":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "building":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-400" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
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

export function IssueDeploymentLinks({ issueId }: { issueId: string }) {
  const { selectedCompanyId } = useCompany();

  const deploymentsQuery = useQuery({
    queryKey: queryKeys.deployments.byIssue(selectedCompanyId!, issueId),
    queryFn: () => deploymentsApi.list(selectedCompanyId!, { issueId }),
    enabled: !!selectedCompanyId && !!issueId,
    // No polling — updates come via SSE/WebSocket events
  });

  const deployments = deploymentsQuery.data?.deployments ?? [];

  // Don't render anything if no deployments
  if (deploymentsQuery.isLoading) {
    return null; // Silent loading, don't show skeleton for this small panel
  }

  if (deployments.length === 0) {
    return null; // No deployments for this issue — hide panel entirely
  }

  const copyUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
  };

  return (
    <div data-testid="deploy-08-issue-links" className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Deployments ({deployments.length})
        </span>
      </div>

      <div className="space-y-2">
        {deployments.map((deployment) => (
          <div
            key={deployment.id}
            data-testid="deploy-08-link-card"
            className="rounded-md border bg-card/50 p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${statusColor(deployment.status)}`}
                >
                  {statusIcon(deployment.status)}
                  <span className="ml-1">{deployment.status}</span>
                </Badge>
                <span className="text-xs font-medium truncate max-w-[200px]">
                  {deployment.name}
                </span>
                {deployment.pinned && (
                  <Pin className="h-2.5 w-2.5 text-amber-500" />
                )}
              </div>

              {deployment.status === "running" && deployment.url && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() => copyUrl(deployment.url!)}
                    title="Copy URL"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-400 font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {deployment.userName && <span>by {deployment.userName}</span>}
              <span>{timeAgo(deployment.createdAt)}</span>
              {deployment.expiresAt && !deployment.pinned && (
                <span className="text-amber-500">expires {timeAgo(deployment.expiresAt)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
