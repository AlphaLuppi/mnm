"use client";

import { Sparkles } from "lucide-react";
import { useClaudeContext } from "./claude-provider";
import { cn } from "@/lib/utils";

export function ClaudeFab() {
  const { isOpen, toggle } = useClaudeContext();

  return (
    <button
      onClick={toggle}
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "w-14 h-14 rounded-full",
        "bg-gradient-to-br from-orange-500 to-amber-600",
        "hover:from-orange-600 hover:to-amber-700",
        "shadow-lg hover:shadow-xl",
        "flex items-center justify-center",
        "transition-all duration-200",
        "group",
        isOpen && "scale-0 opacity-0"
      )}
      title="Open Claude Assistant (Ctrl+Shift+C)"
    >
      <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />

      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-20" />

      {/* Tooltip */}
      <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-popover text-popover-foreground text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border">
        Ask Claude
      </span>
    </button>
  );
}
