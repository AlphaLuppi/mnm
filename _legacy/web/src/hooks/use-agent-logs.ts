"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface LogEntry {
  type: "stdout" | "stderr" | "exit";
  content: string;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 1000;

export function useAgentLogs(agentId: string, isRunning: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    const es = new EventSource(`/api/agents/${agentId}/logs`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
        });
      } catch {
        // Invalid JSON, ignore
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [agentId, isRunning]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, isConnected, clearLogs };
}
