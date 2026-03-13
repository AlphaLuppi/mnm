"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Workflow } from "@/hooks/use-workflows";
import { WorkflowDiagram } from "./workflow-diagram";
import type { WorkflowStep } from "@/hooks/use-workflows";
import { FileText, Clock } from "lucide-react";

interface Props {
  workflow: Workflow;
  steps: WorkflowStep[];
}

export function WorkflowNodeDetail({ workflow, steps }: Props) {
  let metadata: Record<string, unknown> = {};
  if (workflow.metadata) {
    try {
      metadata = JSON.parse(workflow.metadata);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{workflow.name}</h2>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {workflow.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {workflow.phase && (
          <Badge variant="outline">{workflow.phase}</Badge>
        )}
        <Badge variant="secondary">{steps.length} steps</Badge>
        {typeof metadata.module === "string" && (
          <Badge variant="outline">
            Module: {metadata.module}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-xs text-muted-foreground">
            {workflow.sourcePath}
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Discovered
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-muted-foreground">
            {new Date(workflow.discoveredAt).toLocaleString()}
          </span>
        </CardContent>
      </Card>

      <WorkflowDiagram steps={steps} workflowName={workflow.name} />
    </div>
  );
}
