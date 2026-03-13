"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  Blocks,
  BookOpen,
  Settings,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SpecItem {
  id: string;
  title: string | null;
  filePath: string;
  specType: string;
}

interface SpecTreeProps {
  specs: SpecItem[];
}

const typeConfig: Record<
  string,
  { label: string; icon: React.ElementType; order: number }
> = {
  product_brief: { label: "Product Brief", icon: FileText, order: 0 },
  prd: { label: "PRD", icon: FileSpreadsheet, order: 1 },
  architecture: { label: "Architecture", icon: Blocks, order: 2 },
  story: { label: "Stories", icon: BookOpen, order: 3 },
  config: { label: "Config", icon: Settings, order: 4 },
};

export function SpecTree({ specs }: SpecTreeProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(Object.keys(typeConfig))
  );

  const grouped = specs.reduce<Record<string, SpecItem[]>>((acc, spec) => {
    const t = spec.specType;
    if (!acc[t]) acc[t] = [];
    acc[t].push(spec);
    return acc;
  }, {});

  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => (typeConfig[a]?.order ?? 99) - (typeConfig[b]?.order ?? 99)
  );

  const toggle = (type: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {sortedTypes.map((type) => {
          const cfg = typeConfig[type] ?? {
            label: type,
            icon: FileText,
            order: 99,
          };
          const Icon = cfg.icon;
          const items = grouped[type];
          const isOpen = openSections.has(type);

          return (
            <Collapsible
              key={type}
              open={isOpen}
              onOpenChange={() => toggle(type)}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isOpen && "rotate-90"
                  )}
                />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{cfg.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {items.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-4 space-y-0.5 border-l pl-2">
                  {items.map((spec) => {
                    const href = `/specs/${spec.id}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={spec.id}
                        href={href}
                        className={cn(
                          "block rounded-md px-2 py-1 text-sm hover:bg-accent",
                          isActive && "bg-accent font-medium"
                        )}
                      >
                        <p className="truncate">
                          {spec.title ?? spec.filePath}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {spec.filePath}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {sortedTypes.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No specs indexed yet. Click "Re-index" to scan the repository.
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
