// ContentRenderer — renders content blocks or falls back to MarkdownBody.
// This is a minimal stub; the render-core agent will replace it with the full implementation.

import type { ContentDocument } from "@mnm/shared";
import { MarkdownBody } from "../MarkdownBody";

interface ContentRendererProps {
  blocks?: ContentDocument | null;
  body?: string | null;
  className?: string;
}

export function ContentRenderer({ blocks, body, className }: ContentRendererProps) {
  // When full BlockRenderer is ready, this will render blocks via BlockRenderer.
  // For now, fall back to MarkdownBody for any text content.
  if (blocks && blocks.blocks.length > 0) {
    // Stub: render blocks as JSON-formatted markdown code block
    const fallbackMd = blocks.blocks
      .map((b) => {
        if (b.type === "markdown") return (b as { content: string }).content;
        if (b.type === "status-badge") return `**${(b as { text: string }).text}**`;
        if (b.type === "metric-card") {
          const mc = b as { label: string; value: string | number; description?: string };
          return `**${mc.label}:** ${mc.value}${mc.description ? ` — ${mc.description}` : ""}`;
        }
        return `\`[${b.type}]\``;
      })
      .join("\n\n");

    return (
      <div className={className}>
        <div className="rounded-md border border-border/50 bg-accent/10 p-3 space-y-3">
          <MarkdownBody className="text-sm">{fallbackMd}</MarkdownBody>
        </div>
        {body && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <MarkdownBody className="text-xs text-muted-foreground">{body}</MarkdownBody>
          </div>
        )}
      </div>
    );
  }

  if (body) {
    return <MarkdownBody className={className ?? "text-sm"}>{body}</MarkdownBody>;
  }

  return null;
}
