import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../../api/issues";
import { queryKeys } from "../../lib/queryKeys";
import { ChartCard, PriorityChart } from "../ActivityCharts";
import type { WidgetProps } from "./types";

export default function PriorityWidget({ companyId }: WidgetProps) {
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });

  return (
    <ChartCard title="Issues by Priority" subtitle="Last 14 days">
      <PriorityChart issues={issues ?? []} />
    </ChartCard>
  );
}
