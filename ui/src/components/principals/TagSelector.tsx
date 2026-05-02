import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Tag as TagIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import { tagsApi, type Tag } from "../../api/tags";
import { queryKeys } from "../../lib/queryKeys";

export type TagSelectorProps = {
  value: string[];
  onChange: (next: string[]) => void;
  companyId: string;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  className?: string;
  triggerClassName?: string;
  contentAlign?: "start" | "center" | "end";
};

export function filterTagsByQuery(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q),
  );
}

export function toggleSelection(
  ids: readonly string[],
  id: string,
  multiple: boolean,
): string[] {
  const has = ids.includes(id);
  if (!multiple) return has ? [] : [id];
  return has ? ids.filter((x) => x !== id) : [...ids, id];
}

export function TagSelector({
  value,
  onChange,
  companyId,
  multiple = true,
  placeholder = "Tags...",
  disabled = false,
  testId,
  className,
  triggerClassName,
  contentAlign = "start",
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: companyTags } = useQuery({
    queryKey: queryKeys.tags.list(companyId, false),
    queryFn: () => tagsApi.list(companyId),
    enabled: !!companyId,
  });

  const filtered = useMemo(
    () => filterTagsByQuery(companyTags ?? [], query),
    [companyTags, query],
  );
  const selected = useMemo(() => new Set(value), [value]);

  const triggerLabel =
    selected.size > 0
      ? `${selected.size} tag${selected.size > 1 ? "s" : ""}`
      : placeholder;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testId}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:pointer-events-none",
              triggerClassName,
            )}
          >
            <TagIcon className="h-3 w-3 text-muted-foreground" />
            {triggerLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align={contentAlign}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search tags..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>
                  {(companyTags?.length ?? 0) === 0
                    ? "No tags available"
                    : "No tags match"}
                </CommandEmpty>
              ) : (
                filtered.map((tag) => {
                  const isSelected = selected.has(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      onSelect={() => {
                        onChange(toggleSelection(value, tag.id, multiple));
                        if (!multiple) setOpen(false);
                      }}
                    >
                      {tag.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span className="truncate">{tag.name}</span>
                      {isSelected && (
                        <Check className="h-3 w-3 ml-auto text-foreground shrink-0" />
                      )}
                    </CommandItem>
                  );
                })
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
