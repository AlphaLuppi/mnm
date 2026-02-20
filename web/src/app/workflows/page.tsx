"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GitBranch, RefreshCw, Loader2 } from "lucide-react";
import { useWorkflows, useWorkflow } from "@/hooks/use-workflows";
import { useDiscoveryScan } from "@/hooks/use-discovery";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { WorkflowNodeDetail } from "@/components/workflows/workflow-node-detail";

export default function WorkflowsPage() {
  const { workflows, isLoading, mutate } = useWorkflows();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { workflow, steps, isLoading: detailLoading } =
    useWorkflow(selectedId);
  const { scanning, triggerScan } = useDiscoveryScan();

  async function handleRescan() {
    await triggerScan();
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Discovered workflow definitions from your repository
          </p>
        </div>
        <Button
          onClick={handleRescan}
          disabled={scanning}
          variant="outline"
          size="sm"
        >
          {scanning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {scanning ? "Scanning..." : "Re-scan"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            No workflows discovered yet. Click &quot;Re-scan&quot; to discover
            workflows from your repository, or run auto-discovery from the
            dashboard.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <WorkflowList
            workflows={workflows}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div>
            {selectedId && workflow ? (
              detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <WorkflowNodeDetail workflow={workflow} steps={steps} />
              )
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a workflow from the list to view its details and steps
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
