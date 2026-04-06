import { DashboardBreakdownPanel } from "../DashboardBreakdownPanel";
import type { WidgetProps } from "./types";

export default function BreakdownWidget({ companyId }: WidgetProps) {
  return <DashboardBreakdownPanel companyId={companyId} />;
}
