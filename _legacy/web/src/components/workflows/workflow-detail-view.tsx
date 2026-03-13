"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PipelineView } from "./pipeline-view";
import { FileText, Clock } from "lucide-react";
import type { Workflow, WorkflowStep } from "@/hooks/use-workflows";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WorkflowDetailViewProps {
  workflowId: number;
}

export function WorkflowDetailView({ workflowId }: WorkflowDetailViewProps) {
  const { data, isLoading } = useSWR<{ workflow: Workflow }>(
    `/api/workflows/${workflowId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    );
  }

  const workflow = data?.workflow;
  if (!workflow) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-sm text-muted-foreground">Workflow not found.</p>
      </div>
    );
  }

  let metadata: Record<string, unknown> = {};
  if (workflow.metadata) {
    try {
      metadata = JSON.parse(workflow.metadata);
    } catch {
      // ignore
    }
  }

  let stepCount = 0;
  if (workflow.stepsJson) {
    try {
      const parsed = JSON.parse(workflow.stepsJson);
      stepCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      // ignore
    }
  }

  const metaEntries = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{workflow.name}</h2>
        {workflow.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {workflow.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {workflow.phase && (
            <Badge variant="outline" className="capitalize">
              {workflow.phase}
            </Badge>
          )}
          <Badge variant="secondary">
            {stepCount} step{stepCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Pipeline */}
      <PipelineView workflow={workflow} />

      <Separator />

      {/* Source & metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs break-all">{workflow.sourcePath}</code>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Discovered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs">
              {new Date(workflow.discoveredAt).toLocaleString()}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {metaEntries.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Metadata
          </h3>
          <div className="rounded-md border bg-muted/30 p-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              {metaEntries.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-muted-foreground">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
