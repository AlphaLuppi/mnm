"use client";

import { Bot, GitCompare, Sparkles } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";
import { useChat } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StatusBar() {
  const { dashboard } = useDashboard();
  const { isOpen, toggleChat: toggle } = useChat();

  const runningAgents = dashboard?.agents?.running ?? 0;
  const pendingDrifts = dashboard?.drift?.pending ?? 0;
  const claudeProvider = dashboard?.providers?.find(
    (p) => p.provider === "claude"
  );
  const activeSessions =
    claudeProvider?.sessions.filter((s) => s.isActive).length ?? 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-muted/30 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Bot className="h-3 w-3" />
        <span>
          {runningAgents} agent{runningAgents !== 1 ? "s" : ""} running
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <GitCompare className="h-3 w-3" />
        <span>
          {pendingDrifts} drift{pendingDrifts !== 1 ? "s" : ""} pending
        </span>
      </div>
      {activeSessions > 0 && (
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          <span>
            {activeSessions} Claude session
            {activeSessions !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Claude Assistant toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={`h-5 px-2 text-xs gap-1.5 ${
              isOpen ? "bg-orange-500/20 text-orange-400" : ""
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Ask Claude</span>
            <kbd className="hidden md:inline-flex h-4 items-center gap-0.5 rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              Ctrl+Shift+C
            </kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Toggle Claude Assistant (Ctrl+Shift+C)</p>
        </TooltipContent>
      </Tooltip>
    </footer>
  );
}
