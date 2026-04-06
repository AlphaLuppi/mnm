import type { MarkdownBlockBlock as MarkdownBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { MarkdownBody } from "../MarkdownBody";

export function MarkdownBlock({ block }: { block: MarkdownBlockType; context: BlockContext }) {
  return <MarkdownBody>{block.content}</MarkdownBody>;
}
