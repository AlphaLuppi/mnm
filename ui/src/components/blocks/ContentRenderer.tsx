import type { ContentDocument } from "@mnm/shared";
import { cn } from "../../lib/utils";
import { MarkdownBody } from "../MarkdownBody";
import { BlockRenderer, type BlockContext } from "./BlockRenderer";

interface ContentRendererProps {
  blocks?: ContentDocument | null;
  body?: string | null;
  context?: BlockContext;
  className?: string;
}

/**
 * Meta-component: renders content blocks via json-render BlockRenderer,
 * or falls back to MarkdownBody for plain text content.
 */
export function ContentRenderer({ blocks, body, context, className }: ContentRendererProps) {
  if (blocks && blocks.blocks.length > 0) {
    return (
      <div className={cn("min-w-0 overflow-hidden", className)}>
        <div className="rounded-md border border-border/50 bg-accent/10 p-3 overflow-hidden">
          <BlockRenderer blocks={blocks} context={context} />
        </div>
        {body && (
          <div className="mt-2 pt-2 border-t border-border/40 overflow-hidden">
            <MarkdownBody className="text-xs text-muted-foreground break-words">{body}</MarkdownBody>
          </div>
        )}
      </div>
    );
  }

  if (body) {
    return <MarkdownBody className={cn("break-words", className ?? "text-sm")}>{body}</MarkdownBody>;
  }

  return null;
}
