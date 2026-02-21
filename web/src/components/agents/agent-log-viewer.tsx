"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useAgentLogs, type LogEntry } from "@/hooks/use-agent-logs";

interface AgentLogViewerProps {
  agentId: string;
  isRunning: boolean;
  className?: string;
}

export function AgentLogViewer({ agentId, isRunning, className }: AgentLogViewerProps) {
  const { logs, isConnected } = useAgentLogs(agentId, isRunning);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }

  const heightClass = className ?? "h-64";

  return (
    <div className={`relative flex flex-col ${heightClass}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50 text-xs text-muted-foreground shrink-0">
        <span>
          {isRunning
            ? isConnected
              ? "Connected -- streaming logs"
              : "Connecting..."
            : "Agent stopped"}
        </span>
        <span>{logs.length} lines</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
        onScroll={handleScroll}
      >
        {logs.length === 0 && (
          <div className="text-muted-foreground">No log output yet.</div>
        )}
        {logs.map((entry, i) => (
          <LogLine key={i} entry={entry} />
        ))}
      </div>
      {!autoScroll && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-2 right-4"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3 w-3 mr-1" />
          Latest
        </Button>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  if (entry.type === "exit") {
    return (
      <div className="text-muted-foreground">
        --- Process exited ({entry.content}) ---
      </div>
    );
  }
  return (
    <div
      className={
        entry.type === "stderr"
          ? "text-red-500 dark:text-red-400"
          : "text-foreground"
      }
    >
      {entry.content}
    </div>
  );
}
