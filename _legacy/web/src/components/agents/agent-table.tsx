"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { AgentControls } from "./agent-controls";
import { AgentLogViewer } from "./agent-log-viewer";
import type { Agent } from "@/lib/core/types";

interface AgentTableProps {
  agents: Agent[];
  onAction: (agentId: string, action: "pause" | "resume" | "terminate") => Promise<void>;
}

export function AgentTable({ agents, onAction }: AgentTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No agents running. Launch one from the Available Agents section above.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Spec</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent) => {
          const isExpanded = expandedId === agent.id;
          const scope = parseScopeJson(agent.scope);
          const isActive = agent.status === "running" || agent.status === "paused";

          return (
            <AgentRow
              key={agent.id}
              agent={agent}
              scope={scope}
              isExpanded={isExpanded}
              isActive={isActive}
              onToggleExpand={() =>
                setExpandedId(isExpanded ? null : agent.id)
              }
              onAction={(action) => onAction(agent.id, action)}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

interface AgentRowProps {
  agent: Agent;
  scope: string[];
  isExpanded: boolean;
  isActive: boolean;
  onToggleExpand: () => void;
  onAction: (action: "pause" | "resume" | "terminate") => Promise<void>;
}

function AgentRow({
  agent,
  scope,
  isExpanded,
  isActive,
  onToggleExpand,
  onAction,
}: AgentRowProps) {
  const scopeDisplay =
    scope.length <= 2
      ? scope.join(", ")
      : `${scope.slice(0, 2).join(", ")} +${scope.length - 2} more`;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggleExpand}>
        <TableCell>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{agent.name}</TableCell>
        <TableCell>
          <StatusBadge status={agent.status} />
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {agent.specId ? agent.specId.slice(0, 8) + "..." : "--"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
          {scopeDisplay || "--"}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <AgentControls agent={agent} onAction={onAction} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="p-0 border-b">
            <div className="border rounded-md m-2">
              {agent.errorMessage && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs border-b">
                  Error: {agent.errorMessage}
                </div>
              )}
              <AgentLogViewer agentId={agent.id} isRunning={isActive} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function parseScopeJson(scope: string | null): string[] {
  if (!scope) return [];
  try {
    return JSON.parse(scope) as string[];
  } catch {
    return [];
  }
}
