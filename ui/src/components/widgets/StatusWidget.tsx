import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../../api/issues";
import { queryKeys } from "../../lib/queryKeys";
import { ChartCard, IssueStatusChart } from "../ActivityCharts";
import type { WidgetProps } from "./types";

export default function StatusWidget({ companyId }: WidgetProps) {
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });

  return (
    <ChartCard title="Issues by Status" subtitle="Last 14 days">
      <IssueStatusChart issues={issues ?? []} />
    </ChartCard>
  );
}
