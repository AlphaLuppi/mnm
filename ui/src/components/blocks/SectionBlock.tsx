import { useState } from "react";
import type { SectionBlock as SectionBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { BlockRenderer } from "./BlockRenderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionBlock({ block, context }: { block: SectionBlockType; context: BlockContext }) {
  const [open, setOpen] = useState(true);

  if (!block.collapsible) {
    return (
      <div className="space-y-2">
        {block.title && <p className="text-sm font-semibold text-foreground">{block.title}</p>}
        {block.children.map((child, i) => (
          <BlockRenderer key={i} block={child} context={context} />
        ))}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold hover:text-foreground">
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {block.title}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1 ml-4">
        {block.children.map((child, i) => (
          <BlockRenderer key={i} block={child} context={context} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
