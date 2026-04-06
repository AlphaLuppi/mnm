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
});
