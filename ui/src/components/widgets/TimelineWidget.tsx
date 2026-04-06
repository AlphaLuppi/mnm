import { DashboardTimeline } from "../DashboardTimeline";
import type { WidgetProps } from "./types";

export default function TimelineWidget({ companyId }: WidgetProps) {
  return <DashboardTimeline companyId={companyId} />;
}
