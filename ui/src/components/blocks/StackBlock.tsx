import type { StackBlock as StackBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { BlockRenderer } from "./BlockRenderer";
import { cn } from "@/lib/utils";

const GAP_CLASSES = { sm: "gap-2", md: "gap-3", lg: "gap-4" } as const;

export function StackBlock({ block, context }: { block: StackBlockType; context: BlockContext }) {
  const direction = block.direction ?? "vertical";
  const gap = GAP_CLASSES[block.gap ?? "md"];

  return (
    <div className={cn(
      "flex",
      direction === "horizontal" ? "flex-row flex-wrap items-start" : "flex-col",
      gap,
    )}>
      {block.children.map((child, i) => (
        <BlockRenderer key={i} block={child} context={context} />
      ))}
    </div>
  );
}
