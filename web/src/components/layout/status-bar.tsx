"use client";

import { Bot, GitCompare, Terminal } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";

export function StatusBar() {
  const { dashboard } = useDashboard();

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
          <Terminal className="h-3 w-3" />
          <span>
            {activeSessions} Claude session
            {activeSessions !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </footer>
  );
}
