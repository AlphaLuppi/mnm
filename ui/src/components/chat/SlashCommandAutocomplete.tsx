import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal } from "lucide-react";
import { cn } from "../../lib/utils";

interface SlashCommand {
  name: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/summarize", description: "Summarize the conversation so far" },
  { name: "/status", description: "Show agent status and health" },
  { name: "/clear", description: "Clear the chat history view" },
  { name: "/export", description: "Export conversation as file" },
  { name: "/artifact", description: "Create a new artifact" },
  { name: "/doc", description: "Upload a document to the context" },
  { name: "/fork", description: "Fork this conversation" },
  { name: "/share", description: "Share this conversation" },
];

interface SlashCommandAutocompleteProps {
  query: string;
  onSelect: (command: string) => void;
  onDismiss: () => void;
  visible: boolean;
}

export function SlashCommandAutocomplete({
  query,
  onSelect,
  onDismiss,
  visible,
}: SlashCommandAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(`/${query.toLowerCase()}`),
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
            onSelect(filtered[selectedIndex].name);
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
      {filtered.map((cmd, index) => (
        <button
          key={cmd.name}
          type="button"
          className={cn(
            "w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted/50 transition-colors",
            index === selectedIndex && "bg-muted/50",
          )}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => onSelect(cmd.name)}
        >
          <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">{cmd.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {cmd.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
