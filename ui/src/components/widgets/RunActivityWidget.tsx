import { useQuery } from "@tanstack/react-query";
import { heartbeatsApi } from "../../api/heartbeats";
import { queryKeys } from "../../lib/queryKeys";
import { ChartCard, RunActivityChart } from "../ActivityCharts";
import type { WidgetProps } from "./types";

export default function RunActivityWidget({ companyId }: WidgetProps) {
  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(companyId),
    queryFn: () => heartbeatsApi.list(companyId),
    enabled: !!companyId,
  });

  return (
    <ChartCard title="Run Activity" subtitle="Last 14 days">
      <RunActivityChart runs={runs ?? []} />
    </ChartCard>
  );
}
