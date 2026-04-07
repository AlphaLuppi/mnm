// VIEW-PRESETS: Types for persona-based dashboard & navigation

/** Identifiers for navigation items in the sidebar */
export type NavItemId =
  | "dashboard" | "inbox" | "issues" | "workflows" | "workflow-editor"
  | "routines" | "goals" | "chat" | "folders" | "cursors" | "projects"
  | "agents" | "members" | "roles" | "tags" | "config-layers" | "feedback"
  | "org" | "costs" | "activity" | "audit" | "traces" | "containers"
  | "deployments" | "settings" | "sso" | "import-jira" | "view-presets"
  | "__projects__" | "__agents__";

/** A sidebar section grouping multiple nav items */
export interface SidebarSection {
  label: string;
  items: NavItemId[];
  collapsed?: boolean;
}

/** A dashboard widget definition */
export interface DashboardWidget {
  type: string;
  span?: 1 | 2 | 3 | 4;
  props?: Record<string, unknown>;
}

/** Full layout document stored in a view preset */
export interface ViewPresetLayout {
  landingPage: string;
  sidebar: {
    sections: SidebarSection[];
    showProjects?: boolean;
    showAgents?: boolean;
  };
  dashboard: {
    widgets: DashboardWidget[];
  };
}

/** Grid placement for a single widget in the unified dashboard grid */
export interface WidgetPlacement {
  /** Unique widget identifier:
   *  - "preset:{type}" for predefined registry widgets (e.g. "preset:kpi-bar")
   *  - UUID for user_widgets (e.g. "d4e5f6a7-...")
   */
  widgetId: string;
  /** Grid column (0-based, cols=12 for finer granularity) */
  x: number;
  /** Grid row (0-based, auto-compacted) */
  y: number;
  /** Width in grid units (1-12) */
  w: number;
  /** Height in grid units (1 unit = ~40px with rowHeight=40) */
  h: number;
  /** Hidden from view but preserved in layout */
  hidden?: boolean;
  /** Optional override props for preset widgets */
  props?: Record<string, unknown>;
}

/** Default height by widget type (in grid row units, rowHeight=40px) */
export const WIDGET_DEFAULT_HEIGHTS: Record<string, number> = {
  "kpi-bar": 3,
  "kpi-enterprise": 3,
  "run-activity": 7,
  "priority-chart": 7,
  "status-chart": 7,
  "success-rate": 7,
  "active-agents": 8,
  "recent-issues": 8,
  "recent-activity": 8,
  "timeline": 8,
  "breakdown": 7,
  "chat-activity": 7,
  "my-folders": 7,
  "my-issues": 7,
  "team-activity": 7,
  "cost-overview": 7,
  "health-summary": 7,
};

/** Sparse user overrides — only what differs from the preset */
export interface LayoutOverrides {
  landingPage?: string;
  sidebar?: {
    pinnedItems?: NavItemId[];
    hiddenItems?: NavItemId[];
    sectionOrder?: string[];
  };
  dashboard?: {
    /** V1 (deprecated, still supported for migration): */
    hiddenWidgets?: string[];
    extraWidgets?: DashboardWidget[];
    /** V2: Full grid layout — if present, takes precedence over V1 fields */
    layout?: WidgetPlacement[];
  };
}

/** Resolved layout after merging preset + overrides + permission filter */
export interface ResolvedLayout {
  landingPage: string;
  sidebar: {
    sections: SidebarSection[];
    showProjects: boolean;
    showAgents: boolean;
  };
  dashboard: {
    widgets: DashboardWidget[];
  };
}

/** API response shape for GET /my-view */
export interface MyViewResponse {
  preset: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    color: string | null;
    layout: ViewPresetLayout;
  } | null;
  overrides: LayoutOverrides | null;
  /** V2: Materialized grid layout for the frontend (never null client-side) */
  grid: WidgetPlacement[] | null;
}

/** Full view preset as stored in DB */
export interface ViewPreset {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  layout: ViewPresetLayout;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Default layout constant — encodes the current sidebar as TypeScript fallback */
export const DEFAULT_LAYOUT: ViewPresetLayout = {
  landingPage: "/dashboard",
  sidebar: {
    sections: [
      { label: "", items: ["dashboard", "inbox"] },
      {
        label: "Work",
        items: [
          "issues", "workflows", "workflow-editor", "routines",
          "goals", "chat", "folders", "cursors",
        ],
      },
      { label: "Projects", items: ["__projects__"] },
      { label: "Agents", items: ["__agents__"] },
      {
        label: "Company",
        items: [
          "members", "roles", "tags", "config-layers", "view-presets", "feedback",
          "org", "costs", "activity", "audit", "traces",
          "containers", "deployments", "settings", "sso", "import-jira",
        ],
      },
    ],
  },
  dashboard: {
    widgets: [
      { type: "kpi-bar", span: 4 },
      { type: "run-activity", span: 1 },
      { type: "priority-chart", span: 1 },
      { type: "status-chart", span: 1 },
      { type: "success-rate", span: 1 },
      { type: "kpi-enterprise", span: 4 },
      { type: "timeline", span: 2 },
      { type: "breakdown", span: 2 },
      { type: "recent-activity", span: 2 },
      { type: "recent-issues", span: 2 },
    ],
  },
};

/** Preset layout definitions for seeding */
export const PRESET_LAYOUTS = {
  pm: {
    landingPage: "/chat",
    sidebar: {
      sections: [
        { label: "Mon espace", items: ["chat", "folders", "inbox"] },
        { label: "Suivi", items: ["issues", "goals", "projects", "dashboard"] },
        { label: "Equipe", items: ["members", "agents", "org"] },
      ],
    },
    dashboard: {
      widgets: [
        { type: "chat-activity", span: 2 },
        { type: "my-folders", span: 2 },
        { type: "recent-issues", span: 2 },
        { type: "team-activity", span: 2 },
      ],
    },
  } satisfies ViewPresetLayout,

  dev: {
    landingPage: "/issues",
    sidebar: {
      sections: [
        { label: "Mon travail", items: ["issues", "inbox", "chat"] },
        { label: "Execution", items: ["agents", "workflows", "traces", "containers"] },
        { label: "Projets", items: ["projects", "goals", "dashboard"] },
      ],
    },
    dashboard: {
      widgets: [
        { type: "kpi-bar", span: 4 },
        { type: "active-agents", span: 2 },
        { type: "my-issues", span: 2 },
        { type: "run-activity", span: 2 },
        { type: "success-rate", span: 2 },
      ],
    },
  } satisfies ViewPresetLayout,

  exec: {
    landingPage: "/dashboard",
    sidebar: {
      sections: [
        { label: "Vue d'ensemble", items: ["dashboard", "costs", "org"] },
        { label: "Suivi", items: ["goals", "projects", "feedback"] },
        { label: "Audit", items: ["audit", "traces", "activity"] },
      ],
    },
    dashboard: {
      widgets: [
        { type: "kpi-bar", span: 4 },
        { type: "cost-overview", span: 2 },
        { type: "health-summary", span: 2 },
        { type: "team-activity", span: 4 },
      ],
    },
  } satisfies ViewPresetLayout,
} as const;
