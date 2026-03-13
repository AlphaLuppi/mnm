"use client";

import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SpecFrontmatterProps {
  data: Record<string, unknown>;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(renderValue).join(", ");
  return JSON.stringify(value);
}

export function SpecFrontmatter({ data }: SpecFrontmatterProps) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data);

  if (entries.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted">
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">Frontmatter</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {entries.length} field{entries.length !== 1 ? "s" : ""}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="font-mono text-muted-foreground">{key}</dt>
                <dd className="truncate">{renderValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
