import type { DashboardKpis } from "@mnm/shared";
import { MetricCard } from "./MetricCard";
import { GitBranch, Shield, Container, AlertTriangle } from "lucide-react";

interface DashboardKpiCardsProps {
  data: DashboardKpis | undefined;
}

export function DashboardKpiCards({ data }: DashboardKpiCardsProps) {
  if (!data) return null;

  return (
    <div className="border border-border rounded-lg p-4 bg-card h-full">
    <div data-testid="dash-s02-kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-2 h-full">
      <div data-testid="dash-s02-kpi-workflows">
        <MetricCard
          icon={GitBranch}
          value={data.workflows.active}
          label="Active Workflows"
          description={
            <span>
              {data.workflows.completed} completed{", "}
              {data.workflows.failed} failed{", "}
              {data.workflows.total} total
            </span>
          }
        />
      </div>
      <div data-testid="dash-s02-kpi-audit">
        <MetricCard
          icon={Shield}
          value={data.audit.eventsToday}
          label="Audit Events Today"
          description={
            <span>
              {data.audit.eventsWeek} this week{", "}
              {data.audit.eventsMonth} this month
            </span>
          }
        />
      </div>
      <div data-testid="dash-s02-kpi-containers">
        <MetricCard
          icon={Container}
          value={data.containers.running}
          label="Running Containers"
          description={
            <span>
              {data.containers.stopped} stopped{", "}
              {data.containers.total} total
            </span>
          }
        />
      </div>
      <div data-testid="dash-s02-kpi-drift">
        <MetricCard
          icon={AlertTriangle}
          value={data.drift.openAlerts}
          label="Open Drift Alerts"
          description={
            <span>
              {data.drift.openAlerts === 0 ? "No active alerts" : `${data.drift.openAlerts} alert${data.drift.openAlerts !== 1 ? "s" : ""} require attention`}
            </span>
          }
        />
      </div>
    </div>
    </div>
  );
}
