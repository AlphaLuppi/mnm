import { Link2, Unlink2 } from "lucide-react";
import type { ChatPipeStatus } from "@mnm/shared";

// chat-s04-pipe-status-indicator
export interface PipeStatusIndicatorProps {
  pipeStatus: ChatPipeStatus | null;
}

export function PipeStatusIndicator({ pipeStatus }: PipeStatusIndicatorProps) {
  const isAttached = pipeStatus?.status === "attached";

  return (
    <div
      data-testid="chat-s04-pipe-status"
      className="flex items-center gap-1 text-[10px]"
    >
      {isAttached ? (
        <span
          data-testid="chat-s04-pipe-attached"
          className="flex items-center gap-1 text-green-600 dark:text-green-400"
        >
          <Link2 className="h-3 w-3" />
          <span>Pipe attached</span>
          {pipeStatus && pipeStatus.messagesPiped > 0 && (
            <span className="text-muted-foreground">
              ({pipeStatus.messagesPiped} piped)
            </span>
          )}
        </span>
      ) : (
        <span
          data-testid="chat-s04-pipe-detached"
          className="flex items-center gap-1 text-muted-foreground"
        >
          <Unlink2 className="h-3 w-3" />
          <span>Pipe detached</span>
        </span>
      )}
    </div>
  );
}
