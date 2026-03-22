// POD-06: My Workspace page — pod status + terminal
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Moon,
  AlertCircle,
} from "lucide-react";
import type { SandboxStatus } from "@mnm/shared";
import { PodConsole } from "../components/workspace/PodConsole";
import { sandboxesApi } from "../api/sandboxes";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../lib/timeAgo";

function podStatusIcon(status: SandboxStatus) {
  switch (status) {
    case "running":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "idle":
      return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
    case "provisioning":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "hibernated":
      return <Moon className="h-4 w-4 text-muted-foreground" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function podStatusColor(status: SandboxStatus): string {
  switch (status) {
    case "running":
    case "idle":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "provisioning":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "hibernated":
      return "bg-muted text-muted-foreground border-border";
    case "failed":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function Workspace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "My Workspace" }]);
  }, [setBreadcrumbs]);

  const podQuery = useQuery({
    queryKey: queryKeys.sandboxes.my(selectedCompanyId!),
    queryFn: () => sandboxesApi.getMySandbox(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000, // Poll every 5s for status updates
  });

  const provisionMutation = useMutation({
    mutationFn: () => sandboxesApi.provision(selectedCompanyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.my(selectedCompanyId!) }),
  });

  const wakeMutation = useMutation({
    mutationFn: () => sandboxesApi.wake(selectedCompanyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.my(selectedCompanyId!) }),
  });

  const hibernateMutation = useMutation({
    mutationFn: () => sandboxesApi.hibernate(selectedCompanyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sandboxes.my(selectedCompanyId!) }),
  });

  const pod = podQuery.data?.pod;

  if (podQuery.isLoading && !podQuery.data) {
    return <div data-testid="pod-loading"><PageSkeleton /></div>;
  }

  // No pod yet or failed — show provision button
  if (!pod || pod.status === "destroyed" || pod.status === "failed") {
    return (
      <div className="space-y-6" data-testid="pod-page">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">My Workspace</h1>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <Terminal className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium mb-1">No workspace configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            Set up your personal workspace to run agents with Claude. Your workspace persists your Claude login and project files.
          </p>
          <Button
            data-testid="pod-provision-btn"
            onClick={() => provisionMutation.mutate()}
            disabled={provisionMutation.isPending}
          >
            {provisionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Set Up Workspace
          </Button>
          {provisionMutation.isError && (
            <p className="text-xs text-red-500 mt-2">
              {(provisionMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pod-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">My Workspace</h1>
          <Badge variant="outline" className={`text-xs ${podStatusColor(pod.status)}`}>
            {podStatusIcon(pod.status)}
            <span className="ml-1.5">{pod.status}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {(pod.status === "running" || pod.status === "idle") && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => hibernateMutation.mutate()}
              disabled={hibernateMutation.isPending}
            >
              <Pause className="h-3 w-3 mr-1" />
              Hibernate
            </Button>
          )}
          {pod.status === "hibernated" && (
            <Button
              size="sm"
              className="text-xs"
              onClick={() => wakeMutation.mutate()}
              disabled={wakeMutation.isPending}
            >
              {wakeMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Wake Up
            </Button>
          )}
        </div>
      </div>

      {/* Pod Info Card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Image</span>
            <p className="font-mono mt-0.5">{pod.dockerImage}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Resources</span>
            <p className="mt-0.5">{pod.cpuMillicores}m CPU, {pod.memoryMb}MB RAM</p>
          </div>
          <div>
            <span className="text-muted-foreground">Claude Auth</span>
            <p className="mt-0.5">
              {pod.claudeAuthStatus === "authenticated" ? (
                <span className="text-green-500">Authenticated</span>
              ) : pod.claudeAuthStatus === "expired" ? (
                <span className="text-red-500">Expired</span>
              ) : (
                <span className="text-muted-foreground">Not configured</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Active</span>
            <p className="mt-0.5">{pod.lastActiveAt ? timeAgo(pod.lastActiveAt) : "Never"}</p>
          </div>
        </div>

        {pod.error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
            {pod.error}
          </div>
        )}
      </div>

      {/* Pod Console (chat-style command interface) */}
      {(pod.status === "running" || pod.status === "idle") && (
        <PodConsole />
      )}

      {pod.status === "provisioning" && (
        <div className="rounded-lg border bg-card p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-3" />
          <p className="text-sm font-medium">Setting up your workspace...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
        </div>
      )}
    </div>
  );
}
