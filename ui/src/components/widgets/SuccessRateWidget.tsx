import { useQuery } from "@tanstack/react-query";
import { heartbeatsApi } from "../../api/heartbeats";
import { queryKeys } from "../../lib/queryKeys";
import { ChartCard, SuccessRateChart } from "../ActivityCharts";
import type { WidgetProps } from "./types";

export default function SuccessRateWidget({ companyId }: WidgetProps) {
  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(companyId),
    queryFn: () => heartbeatsApi.list(companyId),
    enabled: !!companyId,
  });

  return (
    <ChartCard title="Success Rate" subtitle="Last 14 days">
      <SuccessRateChart runs={runs ?? []} />
    </ChartCard>
  );
}
