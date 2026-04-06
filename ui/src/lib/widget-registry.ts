import { lazy, type ComponentType } from "react";
import type { WidgetProps } from "../components/widgets/types";

export interface WidgetDef {
  component: React.LazyExoticComponent<ComponentType<WidgetProps>>;
  defaultSpan: 1 | 2 | 3 | 4;
  label: string;
}

// Lazy import for each widget — only the widgets in the active preset are loaded
const placeholder = (label: string) =>
  lazy(() => import("../components/widgets/PlaceholderWidget").then((m) => ({
    default: (props: WidgetProps) => m.default({ ...props, props: { ...props.props, label } }),
  }))) as React.LazyExoticComponent<ComponentType<WidgetProps>>;

export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  // KPIs
  "kpi-bar":          { component: lazy(() => import("../components/widgets/KpiBar")),               defaultSpan: 4, label: "KPI Bar" },

  // Charts
  "run-activity":     { component: lazy(() => import("../components/widgets/RunActivityWidget")),     defaultSpan: 1, label: "Run Activity" },
  "priority-chart":   { component: lazy(() => import("../components/widgets/PriorityWidget")),        defaultSpan: 1, label: "Issues by Priority" },
  "status-chart":     { component: lazy(() => import("../components/widgets/StatusWidget")),          defaultSpan: 1, label: "Issues by Status" },
  "success-rate":     { component: lazy(() => import("../components/widgets/SuccessRateWidget")),     defaultSpan: 1, label: "Success Rate" },

  // Panels
  "active-agents":    { component: lazy(() => import("../components/widgets/ActiveAgentsWidget")),    defaultSpan: 2, label: "Active Agents" },
  "recent-issues":    { component: lazy(() => import("../components/widgets/RecentIssuesWidget")),    defaultSpan: 2, label: "Recent Issues" },
  "recent-activity":  { component: lazy(() => import("../components/widgets/RecentActivityWidget")),  defaultSpan: 2, label: "Recent Activity" },

  // Enterprise
  "kpi-enterprise":   { component: lazy(() => import("../components/widgets/KpiEnterpriseWidget")),   defaultSpan: 4, label: "Enterprise KPIs" },
  "timeline":         { component: lazy(() => import("../components/widgets/TimelineWidget")),        defaultSpan: 2, label: "Timeline" },
  "breakdown":        { component: lazy(() => import("../components/widgets/BreakdownWidget")),       defaultSpan: 2, label: "Breakdown" },

  // Persona-specific (placeholders for now)
  "chat-activity":    { component: placeholder("Chat Activity"),       defaultSpan: 2, label: "Chat Activity" },
  "my-folders":       { component: placeholder("My Folders"),          defaultSpan: 2, label: "My Folders" },
  "my-issues":        { component: placeholder("My Issues"),           defaultSpan: 2, label: "My Issues" },
  "team-activity":    { component: placeholder("Team Activity"),       defaultSpan: 2, label: "Team Activity" },
  "cost-overview":    { component: placeholder("Cost Overview"),       defaultSpan: 2, label: "Cost Overview" },
  "health-summary":   { component: placeholder("Health Summary"),      defaultSpan: 2, label: "Health Summary" },
};
