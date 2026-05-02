import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Check, User as UserIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { accessApi, type EnrichedMember } from "../../api/access";
import { queryKeys } from "../../lib/queryKeys";

import { toggleSelection } from "./TagSelector";

export type PrincipalKind = "human" | "agent";

export type PrincipalSelectorProps = {
  value: string[];
  onChange: (next: string[]) => void;
  companyId: string;
  multiple?: boolean;
  /** Filter on principal types. Default: both `human` and `agent`. */
  principalTypes?: PrincipalKind[];
  /** Exclude these principalIds from the list (e.g. self). */
  exclude?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  className?: string;
  triggerClassName?: string;
  contentAlign?: "start" | "center" | "end";
};

const ALL_KINDS: PrincipalKind[] = ["human", "agent"];

export function principalDisplayName(member: EnrichedMember): string {
  return member.userName ?? member.userEmail ?? member.principalId;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isPrincipalKind(value: string): value is PrincipalKind {
  return value === "human" || value === "agent";
}

export function filterPrincipalsByQuery(
  members: EnrichedMember[],
  query: string,
): EnrichedMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter((m) => {
    const name = (m.userName ?? "").toLowerCase();
    const email = (m.userEmail ?? "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });
}

export function applyPrincipalFilters(
  members: EnrichedMember[],
  opts: { types: readonly PrincipalKind[]; exclude: readonly string[] },
): EnrichedMember[] {
  const typeSet = new Set(opts.types);
  const excludeSet = new Set(opts.exclude);
  return members.filter((m) => {
    if (excludeSet.has(m.principalId)) return false;
    if (!isPrincipalKind(m.principalType)) return false;
    return typeSet.has(m.principalType);
  });
}

export function PrincipalSelector({
  value,
  onChange,
  companyId,
  multiple = true,
  principalTypes = ALL_KINDS,
  exclude = [],
  placeholder = "Members...",
  disabled = false,
  testId,
  className,
  triggerClassName,
  contentAlign = "start",
}: PrincipalSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: members } = useQuery({
    queryKey: queryKeys.access.members(companyId),
    queryFn: () => accessApi.listMembers(companyId),
    enabled: !!companyId,
  });

  const eligible = useMemo(
    () =>
      applyPrincipalFilters(members ?? [], {
        types: principalTypes,
        exclude,
      }),
    [members, principalTypes, exclude],
  );

  const filtered = useMemo(
    () => filterPrincipalsByQuery(eligible, query),
    [eligible, query],
  );

  const selected = useMemo(() => new Set(value), [value]);

  const triggerLabel =
    selected.size > 0
      ? `${selected.size} member${selected.size > 1 ? "s" : ""}`
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
            <UserIcon className="h-3 w-3 text-muted-foreground" />
            {triggerLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align={contentAlign}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or email..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>
                  {eligible.length === 0
                    ? "No members available"
                    : "No member matches"}
                </CommandEmpty>
              ) : (
                filtered.map((member) => {
                  const isSelected = selected.has(member.principalId);
                  const name = principalDisplayName(member);
                  const isAgent = member.principalType === "agent";
                  return (
                    <CommandItem
                      key={member.principalId}
                      value={member.principalId}
                      onSelect={() => {
                        onChange(
                          toggleSelection(value, member.principalId, multiple),
                        );
                        if (!multiple) setOpen(false);
                      }}
                    >
                      <Avatar size="sm">
                        {member.userImage && (
                          <AvatarImage src={member.userImage} alt={name} />
                        )}
                        <AvatarFallback>
                          {isAgent ? (
                            <Bot className="h-3 w-3" />
                          ) : (
                            getInitials(member.userName)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{name}</div>
                        {member.userName && member.userEmail && (
                          <div className="truncate text-xs text-muted-foreground">
                            {member.userEmail}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-3 w-3 ml-2 text-foreground shrink-0" />
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
