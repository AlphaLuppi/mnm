import type { ContentDocument } from "@mnm/shared";
import { BlockRenderer, type BlockContext } from "./BlockRenderer";
import { MarkdownBody } from "../MarkdownBody";

interface ContentRendererProps {
  /** The markdown body (always present as fallback) */
  body: string;
  /** Optional structured blocks */
  contentBlocks?: ContentDocument | null;
  /** Block action context */
  context: BlockContext;
  /** Additional className for the markdown fallback */
  className?: string;
}

export function ContentRenderer({
  body,
  contentBlocks,
  context,
  className,
}: ContentRendererProps) {
  if (contentBlocks?.schemaVersion === 1 && contentBlocks.blocks.length > 0) {
    return (
      <div className="space-y-2">
        {contentBlocks.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} context={context} />
        ))}
      </div>
    );
  }

  return <MarkdownBody className={className}>{body}</MarkdownBody>;
}
