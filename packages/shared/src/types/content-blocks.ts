import { z } from "zod";

// ─── DISPLAY ─────────────────────────────────────────

export const MetricCardBlock = z.object({
  type: z.literal("metric-card"),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

export const StatusBadgeBlock = z.object({
  type: z.literal("status-badge"),
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

export const DataTableBlock = z.object({
  type: z.literal("data-table"),
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(["left", "center", "right"]).optional(),
  })),
  rows: z.array(z.record(z.unknown())),
  maxRows: z.number().optional(),
});

export const CodeBlockBlock = z.object({
  type: z.literal("code-block"),
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

export const ProgressBarBlock = z.object({
  type: z.literal("progress-bar"),
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

export const MarkdownBlockBlock = z.object({
  type: z.literal("markdown"),
  content: z.string(),
});

export const ChartBlock = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "pie", "donut"]),
  title: z.string().optional(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
});

export const DividerBlock = z.object({
  type: z.literal("divider"),
});

// ─── INTERACTIVE ─────────────────────────────────────

export const ActionButtonBlock = z.object({
  type: z.literal("action-button"),
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(),
  permission: z.string().optional(),
  icon: z.string().optional(),
});

export const QuickFormBlock = z.object({
  type: z.literal("quick-form"),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

// ─── LAYOUT ──────────────────────────────────────────

// Forward reference for recursive types
export const ContentBlock: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("type", [
    MetricCardBlock,
    StatusBadgeBlock,
    DataTableBlock,
    CodeBlockBlock,
    ProgressBarBlock,
    MarkdownBlockBlock,
    ChartBlock,
    DividerBlock,
    ActionButtonBlock,
    QuickFormBlock,
    StackBlock,
    SectionBlock,
  ]),
);

export const StackBlock = z.object({
  type: z.literal("stack"),
  direction: z.enum(["horizontal", "vertical"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  children: z.array(ContentBlock),
});

export const SectionBlock = z.object({
  type: z.literal("section"),
  title: z.string().optional(),
  collapsible: z.boolean().optional(),
  children: z.array(ContentBlock),
});

// ─── DOCUMENT ────────────────────────────────────────

export const ContentDocument = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(ContentBlock),
});

// ─── TYPE EXPORTS ────────────────────────────────────

export type ContentBlock = z.infer<typeof ContentBlock>;
export type ContentDocument = z.infer<typeof ContentDocument>;
export type MetricCardBlock = z.infer<typeof MetricCardBlock>;
export type StatusBadgeBlock = z.infer<typeof StatusBadgeBlock>;
export type DataTableBlock = z.infer<typeof DataTableBlock>;
export type CodeBlockBlock = z.infer<typeof CodeBlockBlock>;
export type ProgressBarBlock = z.infer<typeof ProgressBarBlock>;
export type MarkdownBlockBlock = z.infer<typeof MarkdownBlockBlock>;
export type ChartBlock = z.infer<typeof ChartBlock>;
export type DividerBlock = z.infer<typeof DividerBlock>;
export type ActionButtonBlock = z.infer<typeof ActionButtonBlock>;
export type QuickFormBlock = z.infer<typeof QuickFormBlock>;
export type StackBlock = z.infer<typeof StackBlock>;
export type SectionBlock = z.infer<typeof SectionBlock>;

// ─── BLOCK TYPE LIST (for catalogue endpoint) ────────

export const BLOCK_TYPES = [
  "metric-card", "status-badge", "data-table", "code-block",
  "progress-bar", "markdown", "chart", "divider",
  "action-button", "quick-form", "stack", "section",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// ─── PROPS-ONLY SCHEMAS (for json-render defineCatalog) ─

export const MetricCardProps = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

export const StatusBadgeProps = z.object({
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

export const DataTableProps = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({ key: z.string(), label: z.string(), align: z.enum(["left", "center", "right"]).optional() })),
  rows: z.array(z.record(z.unknown())),
  maxRows: z.number().optional(),
});

export const CodeBlockProps = z.object({
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

export const ProgressBarProps = z.object({
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

export const MarkdownProps = z.object({
  content: z.string(),
});

export const ChartProps = z.object({
  chartType: z.enum(["line", "bar", "pie", "donut"]),
  title: z.string().optional(),
  data: z.array(z.object({ label: z.string(), value: z.number(), color: z.string().optional() })),
});

export const ActionButtonProps = z.object({
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(),
  permission: z.string().optional(),
  icon: z.string().optional(),
});

export const QuickFormProps = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

export const SectionProps = z.object({
  title: z.string().optional(),
  collapsible: z.boolean().optional(),
});

export const StackProps = z.object({
  direction: z.enum(["horizontal", "vertical"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
});

export const DividerProps = z.object({});

export const blockPropsSchemas = {
  MetricCard: { props: MetricCardProps, description: "KPI metric with label, value, and optional trend indicator" },
  StatusBadge: { props: StatusBadgeProps, description: "Colored badge with semantic variant" },
  DataTable: { props: DataTableProps, description: "Structured table with columns and rows" },
  CodeBlock: { props: CodeBlockProps, description: "Syntax-highlighted code block" },
  ProgressBar: { props: ProgressBarProps, description: "Progress indicator with percentage" },
  Markdown: { props: MarkdownProps, description: "Markdown text content" },
  Chart: { props: ChartProps, description: "Chart visualization (line, bar, pie, donut)" },
  ActionButton: { props: ActionButtonProps, description: "Interactive button that triggers an action" },
  QuickForm: { props: QuickFormProps, description: "Dynamic form with fields and submit action" },
  Section: { props: SectionProps, description: "Collapsible section with title" },
  Stack: { props: StackProps, description: "Layout container (horizontal or vertical)" },
  Divider: { props: DividerProps, description: "Visual separator" },
} as const;
