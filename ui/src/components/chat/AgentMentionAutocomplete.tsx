import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { api } from "../../api/client";
import type { Agent } from "@mnm/shared";

interface AgentMentionAutocompleteProps {
  query: string;
  companyId: string;
  onSelect: (agentName: string) => void;
  onDismiss: () => void;
  visible: boolean;
}

export function AgentMentionAutocomplete({
  query,
  companyId,
  onSelect,
  onDismiss,
  visible,
}: AgentMentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: queryKeys.agents.listAll(companyId),
    queryFn: () =>
      api.get<{ agents: Agent[] }>(`/companies/${companyId}/agents?limit=100`),
    enabled: !!companyId && visible,
  });

  const agents = data?.agents ?? [];

  const filtered = agents.filter((agent) =>
    (agent.name ?? "")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i >= filtered.length - 1 ? 0 : i + 1));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex].name ?? filtered[selectedIndex].id);
          }
          break;
        case "Escape":
          e.preventDefault();
          onDismiss();
          break;
      }
    },
    [visible, filtered, selectedIndex, onSelect, onDismiss],
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"
    >
      {filtered.map((agent, index) => (
        <button
          key={agent.id}
          type="button"
          className={cn(
            "w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted/50 transition-colors",
            index === selectedIndex && "bg-muted/50",
          )}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => onSelect(agent.name ?? agent.id)}
        >
          <Bot className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span className="font-medium truncate">
            {agent.name ?? agent.id.slice(0, 8)}
          </span>
        </button>
      ))}
    </div>
  );
}
