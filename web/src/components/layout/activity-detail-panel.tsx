"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Bot,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Square,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AgentLogViewer } from "@/components/agents/agent-log-viewer";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { useChat } from "@/components/chat";
import type { TaskEntry } from "@/lib/tasks/types";
import type { Agent } from "@/lib/core/types";

interface ActivityDetailPanelProps {
  type: "task" | "agent";
  id: string;
  onBack: () => void;
}

function formatDuration(startMs: number, endMs?: number): string {
  const elapsed = (endMs ?? Date.now()) - startMs;
  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return (
        <Badge variant="default" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="secondary" className="gap-1 bg-green-500/15 text-green-400 border-green-500/30">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "failed":
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TaskDetail({ task, onCancel }: { task: TaskEntry; onCancel: () => void }) {
  const isActive = task.status === "running" || task.status === "pending";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [task.logs]);

  return (
    <div className="flex h-full flex-col">
      {/* Header metadata */}
      <div className="flex flex-col gap-3 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{task.label}</span>
          </div>
          {statusBadge(task.status)}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-muted-foreground">Type</div>
          <div>
            <Badge variant="outline" className="text-xs">
              {task.type}
            </Badge>
          </div>
          <div className="text-muted-foreground">Duration</div>
          <div>{formatDuration(task.startedAt, task.completedAt)}</div>
        </div>

        {task.error && (
          <div className="rounded bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {task.error}
          </div>
        )}

        {isActive && (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="xs"
              onClick={onCancel}
              className="gap-1"
            >
              <Square className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Live log output */}
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5 border-b bg-muted/50 text-xs text-muted-foreground">
        <span>
          {isActive ? "Running..." : task.status === "completed" ? "Completed" : "Stopped"}
        </span>
        <span>{task.logs.length} entries</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {task.logs.length === 0 && (
          <div className="text-muted-foreground">Waiting for output...</div>
        )}
        {task.logs.map((entry, i) => (
          <div
            key={i}
            className={
              entry.level === "error"
                ? "text-red-500 dark:text-red-400"
                : entry.level === "warn"
                  ? "text-yellow-500 dark:text-yellow-400"
                  : "text-foreground"
            }
          >
            <span className="text-muted-foreground mr-2">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            {entry.message}
          </div>
        ))}
      </div>

      {/* Result (if completed) */}
      {task.result != null && (
        <div className="shrink-0 border-t p-3">
          <div className="text-xs text-muted-foreground mb-1">Result</div>
          <div className="rounded bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap max-h-24 overflow-auto">
            {typeof task.result === "string"
              ? task.result
              : JSON.stringify(task.result, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentDetail({
  agent,
  onCancel,
  onChat,
}: {
  agent: Agent;
  onCancel: () => void;
  onChat: () => void;
}) {
  const isActive = agent.status === "running" || agent.status === "pending";
  const isRunning = agent.status === "running";
  const scopeFiles = agent.scope ? agent.scope.split(",").map((s) => s.trim()) : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header metadata */}
      <div className="flex flex-col gap-3 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{agent.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(agent.status)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {agent.specId && (
            <>
              <div className="text-muted-foreground">Spec</div>
              <div className="truncate">{agent.specId}</div>
            </>
          )}
          {agent.startedAt && (
            <>
              <div className="text-muted-foreground">Duration</div>
              <div>{formatDuration(agent.startedAt, agent.completedAt ?? undefined)}</div>
            </>
          )}
        </div>

        {scopeFiles.length > 0 && (
          <div className="text-xs">
            <div className="text-muted-foreground mb-1">
              Scope ({scopeFiles.length} file{scopeFiles.length !== 1 ? "s" : ""})
            </div>
            <div className="rounded bg-muted/50 p-1.5 font-mono text-[11px] space-y-0.5 max-h-16 overflow-auto">
              {scopeFiles.map((f) => (
                <div key={f} className="truncate">{f}</div>
              ))}
            </div>
          </div>
        )}

        {agent.errorMessage && (
          <div className="text-xs">
            <div className="text-destructive mb-1">Error</div>
            <div className="rounded bg-destructive/10 p-2 font-mono text-xs text-destructive">
              {agent.errorMessage}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={onChat}
            className="gap-1"
          >
            <MessageSquare className="h-3 w-3" />
            Chat about this
          </Button>
          {isActive && (
            <Button
              variant="destructive"
              size="xs"
              onClick={onCancel}
              className="gap-1"
            >
              <Square className="h-3 w-3" />
              Terminate
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Live log viewer — takes remaining space */}
      <div className="flex-1 min-h-0">
        <AgentLogViewer agentId={agent.id} isRunning={isRunning} className="h-full" />
      </div>
    </div>
  );
}

export function ActivityDetailPanel({ type, id, onBack }: ActivityDetailPanelProps) {
  const { tasks, mutate: mutateTasks } = useTasks();
  const { agents, mutate: mutateAgents } = useAgents();
  const { sendCommand } = useChat();

  const task = type === "task" ? tasks.find((t) => t.id === id) : null;
  const agent = type === "agent" ? agents.find((a) => a.id === id) : null;

  const handleCancelTask = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      mutateTasks();
    } catch {
      // silently handle
    }
  }, [id, mutateTasks]);

  const handleTerminateAgent = useCallback(async () => {
    try {
      await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate" }),
      });
      mutateAgents();
    } catch {
      // silently handle
    }
  }, [id, mutateAgents]);

  const handleChatAboutAgent = useCallback(() => {
    if (!agent) return;
    const context = [
      `Agent: ${agent.name} (${agent.status})`,
      agent.specId ? `Spec: ${agent.specId}` : null,
      agent.scope ? `Scope: ${agent.scope}` : null,
      agent.errorMessage ? `Error: ${agent.errorMessage}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    sendCommand(
      `Tell me about this agent and what it's doing:\n${context}`,
      "Agent Detail"
    );
  }, [agent, sendCommand]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          {type === "task" ? "Task Detail" : "Agent Detail"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {task && (
          <TaskDetail task={task} onCancel={handleCancelTask} />
        )}
        {agent && (
          <AgentDetail
            agent={agent}
            onCancel={handleTerminateAgent}
            onChat={handleChatAboutAgent}
          />
        )}
        {!task && !agent && (
          <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
            Item not found
          </div>
        )}
      </div>
    </div>
  );
}
