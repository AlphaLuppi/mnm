import { createContext, useContext, useMemo } from "react";
import { Renderer, StateProvider, ActionProvider, VisibilityProvider } from "@json-render/react";
import { registry } from "./registry";
import type { ContentDocument } from "@mnm/shared";

export interface BlockContext {
  surface: "issue" | "inbox" | "dashboard";
  surfaceId?: string;
  companyId: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  hasPermission: (slug: string) => boolean;
  /** When true, interactive blocks (ActionButton, QuickForm) should be disabled */
  isActioned?: boolean;
}

/** React context so block components can dispatch actions without DOM events */
const BlockActionCtx = createContext<BlockContext | null>(null);
export function useBlockContext() {
  return useContext(BlockActionCtx);
}

interface BlockRendererProps {
  blocks: ContentDocument;
  context?: BlockContext;
  className?: string;
}

/**
 * Convert our ContentDocument (flat array of blocks) to json-render Spec format
 * { root, elements } — flat element map with string ID references.
 */
function contentDocumentToSpec(doc: ContentDocument) {
  const elements: Record<string, { type: string; props: Record<string, unknown>; children: string[] }> = {};
  const rootChildren: string[] = [];

  function processBlock(block: Record<string, unknown>, prefix: string): string {
    const id = prefix;
    const { type, children: blockChildren, ...props } = block;

    const childIds: string[] = [];
    if (Array.isArray(blockChildren)) {
      for (let i = 0; i < blockChildren.length; i++) {
        childIds.push(processBlock(blockChildren[i] as Record<string, unknown>, `${id}-c${i}`));
      }
    }

    // Map our kebab-case types to PascalCase json-render component names
    const TYPE_MAP: Record<string, string> = {
      "metric-card": "MetricCard",
      "status-badge": "StatusBadge",
      "data-table": "DataTable",
      "code-block": "CodeBlock",
      "progress-bar": "ProgressBar",
      "markdown": "Markdown",
      "chart": "Chart",
      "divider": "Separator",
      "action-button": "ActionButton",
      "quick-form": "QuickForm",
      "stack": "Stack",
      "section": "Section",
    };

    elements[id] = {
      type: TYPE_MAP[type as string] ?? (type as string),
      props: props as Record<string, unknown>,
      children: childIds,
    };

    return id;
  }

  for (let i = 0; i < doc.blocks.length; i++) {
    rootChildren.push(processBlock(doc.blocks[i] as unknown as Record<string, unknown>, `b${i}`));
  }

  // Wrap in a Stack if multiple root blocks
  if (rootChildren.length === 1) {
    return { root: rootChildren[0], elements };
  }

  const rootId = "root-stack";
  elements[rootId] = {
    type: "Stack",
    props: { direction: "vertical", gap: "md" },
    children: rootChildren,
  };

  return { root: rootId, elements };
}

export function BlockRenderer({ blocks, context, className }: BlockRendererProps) {
  const spec = useMemo(() => contentDocumentToSpec(blocks), [blocks]);

  const actionHandlers = context
    ? { "mnm-action": async (params: Record<string, unknown>) => context.onAction(params.action as string, params.payload as Record<string, unknown>) }
    : undefined;

  return (
    <div className={className}>
      <BlockActionCtx.Provider value={context ?? null}>
        <StateProvider initialState={{}}>
          <VisibilityProvider>
            <ActionProvider handlers={actionHandlers}>
              <Renderer spec={spec} registry={registry} />
            </ActionProvider>
          </VisibilityProvider>
        </StateProvider>
      </BlockActionCtx.Provider>
    </div>
  );
}
