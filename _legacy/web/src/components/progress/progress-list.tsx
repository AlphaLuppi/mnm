"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DriftIndicator } from "@/components/shared/drift-indicator";
import { WorkflowStageBadge } from "./workflow-stage-badge";
import type { StoryProgress } from "@/lib/core/progress";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_started: { label: "Not Started", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  drifted: { label: "Drifted", variant: "destructive" },
};

interface ProgressListProps {
  items: StoryProgress[];
}

export function ProgressList({ items }: ProgressListProps) {
  // Group by spec type
  const groups = new Map<string, StoryProgress[]>();
  for (const item of items) {
    const key = item.spec.specType;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([type, groupItems]) => {
        const avgProgress =
          groupItems.reduce((sum, i) => sum + i.percentage, 0) /
          groupItems.length;

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium capitalize">
                  {type.replace("_", " ")}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {Math.round(avgProgress)}%
                </span>
              </div>
              <Progress value={avgProgress} className="h-1.5" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <ProgressRow key={item.spec.id} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ProgressRow({ item }: { item: StoryProgress }) {
  const statusInfo = STATUS_BADGE[item.status] ?? STATUS_BADGE.not_started;
  const criticalDrift = item.drifts.find(
    (d) => d.severity === "critical" && d.userDecision === "pending"
  );

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm truncate">
          {item.spec.title ?? item.spec.filePath}
        </span>
        {criticalDrift && (
          <DriftIndicator
            severity={criticalDrift.severity}
            summary={criticalDrift.summary}
          />
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <WorkflowStageBadge stage={item.spec.workflowStage} />
        <Badge variant={statusInfo.variant} className="text-xs">
          {statusInfo.label}
        </Badge>
        <span className="text-xs text-muted-foreground w-8 text-right">
          {item.percentage}%
        </span>
      </div>
    </div>
  );
}
