import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { queryKeys } from "../lib/queryKeys";
import { DASHBOARD_BREAKDOWN_CATEGORIES } from "@mnm/shared";
import type { DashboardBreakdownCategory, DashboardBreakdown } from "@mnm/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardBreakdownPanelProps {
  companyId: string;
}

const CATEGORY_LABELS: Record<DashboardBreakdownCategory, string> = {
  agents: "Agents by Status",
  workflows: "Workflows by State",
  audit: "Audit by Action (Top 10)",
  costs: "Costs by Agent (Top 10)",
  containers: "Containers by Status",
};

function getBarColor(label: string): string {
  const lower = label.toLowerCase();
  if (["running", "active", "idle", "completed", "done", "in_progress"].includes(lower)) {
    return "bg-green-500";
  }
  if (["failed", "error", "terminated", "critical"].includes(lower)) {
    return "bg-red-500";
  }
  if (["paused", "warning", "draft", "other"].includes(lower)) {
    return "bg-amber-500";
  }
  if (["stopped", "exited", "destroyed", "created"].includes(lower)) {
    return "bg-gray-400";
  }
  // Default: primary blue
  return "bg-blue-500";
}

function BreakdownBars({ data }: { data: DashboardBreakdown }) {
  const { items, total } = data;

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No data available for this category.</p>
    );
  }

  return (
    <div data-testid="dash-s02-breakdown-list" className="space-y-2">
      {items.map((item) => {
        const pct = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.label} data-testid="dash-s02-breakdown-item" className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium truncate mr-2">{item.label}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {item.count} ({pct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(item.label)}`}
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardBreakdownPanel({ companyId }: DashboardBreakdownPanelProps) {
  const [category, setCategory] = useState<DashboardBreakdownCategory>("agents");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.breakdown(companyId, category),
    queryFn: () => dashboardApi.breakdown(companyId, category),
    enabled: !!companyId,
  });

  return (
    <div data-testid="dash-s02-breakdown" className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Breakdown
        </h3>
        <div data-testid="dash-s02-breakdown-select">
          <Select value={category} onValueChange={(v) => setCategory(v as DashboardBreakdownCategory)}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_BREAKDOWN_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div data-testid="dash-s02-breakdown-loading" className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        data && <BreakdownBars data={data} />
      )}
    </div>
  );
}
