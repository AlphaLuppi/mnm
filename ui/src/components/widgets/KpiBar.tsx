import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../../api/dashboard";
import { queryKeys } from "../../lib/queryKeys";
import { MetricCard } from "../MetricCard";
import { useDriftScanStatus, useDriftResults } from "../../hooks/useDriftResults";
import { projectsApi } from "../../api/projects";
import { formatCents } from "../../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, HeartPulse } from "lucide-react";
import type { WidgetProps } from "./types";

export default function KpiBar({ companyId }: WidgetProps) {
  const { data } = useQuery({
    queryKey: queryKeys.dashboard(companyId),
    queryFn: () => dashboardApi.summary(companyId),
    enabled: !!companyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const firstProjectId = projects?.[0]?.id;
  const { data: driftResults } = useDriftResults(firstProjectId, companyId);

  if (!data) return null;

  const pendingDrifts = (driftResults ?? []).reduce(
    (sum, r) => sum + r.drifts.filter((d: { decision: string }) => d.decision === "pending").length,
    0,
  );
  const hasFailedAgents = data.agents.error > 0;
  const hasDrift = pendingDrifts > 0;
  const healthLevel = hasDrift && hasFailedAgents ? "red" : hasDrift || hasFailedAgents ? "orange" : "green";
  const healthLabel = { green: "Healthy", orange: "Warning", red: "Critical" }[healthLevel];
  const healthColor = { green: "text-green-500", orange: "text-amber-500", red: "text-red-500" }[healthLevel];

  return (
    <div className="border border-border rounded-lg p-4 bg-card h-full">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-2 h-full">
      <MetricCard
        icon={Bot}
        value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
        label="Agents Enabled"
        to="/agents"
        description={<span>{data.agents.running} running, {data.agents.paused} paused, {data.agents.error} errors</span>}
      />
      <MetricCard
        icon={CircleDot}
        value={data.tasks.inProgress}
        label="Tasks In Progress"
        to="/issues"
        description={<span>{data.tasks.open} open, {data.tasks.blocked} blocked</span>}
      />
      <MetricCard
        icon={DollarSign}
        value={formatCents(data.costs.monthSpendCents)}
        label="Month Spend"
        to="/costs"
        description={
          <span>
            {data.costs.monthBudgetCents > 0
              ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
              : "Unlimited budget"}
          </span>
        }
      />
      <MetricCard
        icon={ShieldCheck}
        value={data.pendingApprovals}
        label="Pending Approvals"
        to="/approvals"
        description={<span>{data.staleTasks} stale tasks</span>}
      />
      <MetricCard
        icon={HeartPulse}
        value={healthLabel}
        label="Project Health"
        to={firstProjectId ? `/projects/${firstProjectId}/drift` : undefined}
        description={
          <span className={healthColor}>
            {pendingDrifts} drift{pendingDrifts !== 1 ? "s" : ""}, {data.agents.error} error{data.agents.error !== 1 ? "s" : ""}
          </span>
        }
      />
    </div>
    </div>
  );
}
