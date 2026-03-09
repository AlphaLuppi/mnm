"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  Blocks,
  BookOpen,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface SpecResult {
  id: string;
  title: string | null;
  filePath: string;
  specType: string;
}

const specTypeIcons: Record<string, React.ElementType> = {
  product_brief: FileText,
  prd: FileSpreadsheet,
  architecture: Blocks,
  story: BookOpen,
  config: Settings,
};

const specTypeLabels: Record<string, string> = {
  product_brief: "Product Brief",
  prd: "PRD",
  architecture: "Architecture",
  story: "Story",
  config: "Config",
};

export function SpecSearch() {
  const [open, setOpen] = useState(false);
  const [specs, setSpecs] = useState<SpecResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && specs.length === 0) {
      fetch("/api/specs")
        .then((r) => r.json())
        .then((data) => setSpecs(data.specs ?? []))
        .catch(() => {});
    }
  }, [open, specs.length]);

  const grouped = specs.reduce<Record<string, SpecResult[]>>((acc, spec) => {
    const type = spec.specType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(spec);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search specs... (Cmd+K)" />
      <CommandList>
        <CommandEmpty>No specs found.</CommandEmpty>
        {Object.entries(grouped).map(([type, items]) => {
          const Icon = specTypeIcons[type] ?? FileText;
          return (
            <CommandGroup key={type} heading={specTypeLabels[type] ?? type}>
              {items.map((spec) => (
                <CommandItem
                  key={spec.id}
                  value={`${spec.title ?? ""} ${spec.filePath}`}
                  onSelect={() => {
                    router.push(`/specs/${spec.id}`);
                    setOpen(false);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {spec.title ?? spec.filePath}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {spec.filePath}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {specTypeLabels[spec.specType] ?? spec.specType}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
