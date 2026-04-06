import type { ContentBlock } from "@mnm/shared";
import { MetricCardBlock } from "./MetricCardBlock";
import { StatusBadgeBlock } from "./StatusBadgeBlock";
import { DataTableBlock } from "./DataTableBlock";
import { CodeBlockComp } from "./CodeBlockComp";
import { ProgressBarBlock } from "./ProgressBarBlock";
import { MarkdownBlock } from "./MarkdownBlock";
import { ChartBlock } from "./ChartBlock";
import { DividerBlock } from "./DividerBlock";
import { ActionButtonBlock } from "./ActionButtonBlock";
import { QuickFormBlock } from "./QuickFormBlock";
import { StackBlock } from "./StackBlock";
import { SectionBlock } from "./SectionBlock";

export interface BlockContext {
  /** Context for action handling: "issue", "inbox", "dashboard" */
  surface: "issue" | "inbox" | "dashboard";
  /** IDs relevant to the surface -- issueId, inboxItemId, etc. */
  surfaceId?: string;
  companyId: string;
  /** Callback when an action is triggered */
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  /** Check if user has permission */
  hasPermission?: (key: string) => boolean;
}

interface BlockRendererProps {
  block: ContentBlock;
  context: BlockContext;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<string, React.ComponentType<{ block: any; context: BlockContext }>> = {
  "metric-card": MetricCardBlock,
  "status-badge": StatusBadgeBlock,
  "data-table": DataTableBlock,
  "code-block": CodeBlockComp,
  "progress-bar": ProgressBarBlock,
  "markdown": MarkdownBlock,
  "chart": ChartBlock,
  "divider": DividerBlock,
  "action-button": ActionButtonBlock,
  "quick-form": QuickFormBlock,
  "stack": StackBlock,
  "section": SectionBlock,
};

export function BlockRenderer({ block, context }: BlockRendererProps) {
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Unknown block type: {block.type}
      </div>
    );
  }
  return <Component block={block} context={context} />;
}
