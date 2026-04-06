import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../../api/dashboard";
import { queryKeys } from "../../lib/queryKeys";
import { DashboardKpiCards } from "../DashboardKpiCards";
import type { WidgetProps } from "./types";

export default function KpiEnterpriseWidget({ companyId }: WidgetProps) {
  const { data } = useQuery({
    queryKey: queryKeys.dashboard.kpis(companyId),
    queryFn: () => dashboardApi.kpis(companyId),
    enabled: !!companyId,
  });

  return <DashboardKpiCards data={data} />;
}
