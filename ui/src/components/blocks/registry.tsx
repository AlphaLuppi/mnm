import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { mnmCatalog } from "./catalog";

import { MnmMetricCard } from "./MetricCardBlock";
import { MnmStatusBadge } from "./StatusBadgeBlock";
import { MnmDataTable } from "./DataTableBlock";
import { MnmCodeBlock } from "./CodeBlockComp";
import { MnmProgressBar } from "./ProgressBarBlock";
import { MnmMarkdown } from "./MarkdownBlock";
import { MnmChart } from "./ChartBlock";
import { MnmActionButton } from "./ActionButtonBlock";
import { MnmQuickForm } from "./QuickFormBlock";
import { MnmSection } from "./SectionBlock";

// Zod 3 (@mnm/shared) vs Zod 4 (@json-render) type mismatch — runtime is compatible
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { registry } = defineRegistry(mnmCatalog, {
  components: {
    // Built-in shadcn renderers
    Card: shadcnComponents.Card,
    Stack: shadcnComponents.Stack,
    Heading: shadcnComponents.Heading,
    Button: shadcnComponents.Button,
    Badge: shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,

    // Custom MnM renderers
    MetricCard: MnmMetricCard,
    StatusBadge: MnmStatusBadge,
    DataTable: MnmDataTable,
    CodeBlock: MnmCodeBlock,
    ProgressBar: MnmProgressBar,
    Markdown: MnmMarkdown,
    Chart: MnmChart,
    ActionButton: MnmActionButton,
    QuickForm: MnmQuickForm,
    Section: MnmSection,
  },
} as any);
