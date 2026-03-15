import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { queryKeys } from "../lib/queryKeys";
import { DASHBOARD_PERIODS } from "@mnm/shared";
import type { DashboardPeriod, DashboardTimeline as DashboardTimelineType } from "@mnm/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardTimelineProps {
  companyId: string;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

function TimelineChart({ data }: { data: DashboardTimelineType }) {
  const { points } = data;
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No data for this period.</p>
    );
  }

  // Find max values for scaling
  const maxTasks = Math.max(1, ...points.map((p) => p.tasksCompleted));
  const maxAudit = Math.max(1, ...points.map((p) => p.auditEvents));

  // Show bar charts for tasks completed and audit events
  const visiblePoints = points.length > 30 ? points.filter((_, i) => i % 3 === 0) : points;

  return (
    <div className="space-y-3">
      {/* Tasks Completed */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Tasks Completed</p>
        <div className="flex items-end gap-[2px] h-16">
          {visiblePoints.map((point) => {
            const height = (point.tasksCompleted / maxTasks) * 100;
            return (
              <div
                key={`task-${point.date}`}
                className="flex-1 bg-primary/70 rounded-t-sm transition-all hover:bg-primary"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${point.date}: ${point.tasksCompleted} tasks`}
              />
            );
          })}
        </div>
      </div>

      {/* Audit Events */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Audit Events</p>
        <div className="flex items-end gap-[2px] h-16">
          {visiblePoints.map((point) => {
            const height = (point.auditEvents / maxAudit) * 100;
            return (
              <div
                key={`audit-${point.date}`}
                className="flex-1 bg-blue-500/70 rounded-t-sm transition-all hover:bg-blue-500"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${point.date}: ${point.auditEvents} events`}
              />
            );
          })}
        </div>
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>{points[0]?.date?.slice(5)}</span>
        <span>{points[Math.floor(points.length / 2)]?.date?.slice(5)}</span>
        <span>{points[points.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function DashboardTimeline({ companyId }: DashboardTimelineProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("7d");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.timeline(companyId, period),
    queryFn: () => dashboardApi.timeline(companyId, period),
    enabled: !!companyId,
  });

  return (
    <div data-testid="dash-s02-timeline" className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Activity Timeline
        </h3>
        <div data-testid="dash-s02-timeline-select">
          <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div data-testid="dash-s02-timeline-loading" className="space-y-3 animate-pulse">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-full" />
        </div>
      ) : (
        <div data-testid="dash-s02-timeline-chart">
          {data && <TimelineChart data={data} />}
        </div>
      )}
    </div>
  );
}
