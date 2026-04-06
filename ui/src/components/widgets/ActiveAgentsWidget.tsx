import { ActiveAgentsPanel } from "../ActiveAgentsPanel";
import type { WidgetProps } from "./types";

export default function ActiveAgentsWidget({ companyId }: WidgetProps) {
  return <ActiveAgentsPanel companyId={companyId} />;
}
