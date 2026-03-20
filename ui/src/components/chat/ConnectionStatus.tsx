import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { ConnectionState } from "../../hooks/useAgentChat";
import { cn } from "../../lib/utils";

// chat-s04-connection-status
export interface ConnectionStatusProps {
  state: ConnectionState;
}

const CONFIG: Record<ConnectionState, { label: string; color: string; testId: string }> = {
  connected: {
    label: "Connected",
    color: "text-green-600 dark:text-green-400",
    testId: "chat-s04-connection-connected",
  },
  connecting: {
    label: "Connecting...",
    color: "text-amber-600 dark:text-amber-400",
    testId: "chat-s04-connection-reconnecting",
  },
  reconnecting: {
    label: "Reconnecting...",
    color: "text-amber-600 dark:text-amber-400",
    testId: "chat-s04-connection-reconnecting",
  },
  disconnected: {
    label: "Disconnected",
    color: "text-red-600 dark:text-red-400",
    testId: "chat-s04-connection-disconnected",
  },
};

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const cfg = CONFIG[state];

  return (
    <div
      data-testid="chat-s04-connection"
      className={cn("flex items-center gap-1 text-[10px]", cfg.color)}
    >
      {state === "connected" ? (
        <Wifi data-testid={cfg.testId} className="h-3 w-3" />
      ) : state === "disconnected" ? (
        <WifiOff data-testid={cfg.testId} className="h-3 w-3" />
      ) : (
        <Loader2 data-testid={cfg.testId} className="h-3 w-3 animate-spin" />
      )}
      <span>{cfg.label}</span>
    </div>
  );
}
