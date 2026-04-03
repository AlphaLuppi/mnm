import { Bot, User, Box, FileText, Terminal, ArrowRight } from "lucide-react";
import type { ChatMessage } from "../../api/chat";
import type { IngestionStatus } from "@mnm/shared";
import { cn } from "../../lib/utils";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

// chat-s04-message-bubble
export interface MessageBubbleProps {
  message: ChatMessage;
  onArtifactClick?: (artifactId: string) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message, onArtifactClick }: MessageBubbleProps) {
  const isUser = message.senderType === "user";
  const isSystem = message.messageType === "system";
  const meta = message.metadata as Record<string, unknown> | null;

  // System messages — centered, muted
  if (isSystem) {
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1"
      >
        <div
          data-testid="chat-s04-message-system"
          className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground italic max-w-[80%] text-center"
        >
          <span data-testid="chat-s04-message-content">{message.content}</span>
          <span
            data-testid="chat-s04-message-time"
            className="ml-2 text-[10px] opacity-60"
          >
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Artifact reference — clickable card
  if (meta?.type === "artifact_reference") {
    const artifactId = meta.artifactId as string | undefined;
    const artifactTitle = (meta.title as string) || "Artifact";
    const artifactType = (meta.artifactType as string) || "unknown";
    return (
      <div
        data-testid="chat-s04-message"
        className={cn(
          "flex gap-2 px-4 py-1",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
            isUser ? "bg-blue-600" : "bg-violet-600",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <button
          type="button"
          className="max-w-[75%] rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2 text-left transition-colors cursor-pointer"
          onClick={() => artifactId && onArtifactClick?.(artifactId)}
        >
          <div className="flex items-center gap-2 mb-1">
            <Box className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-sm font-medium truncate">{artifactTitle}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {artifactType}
            </Badge>
          </div>
          {message.content && (
            <p className="text-xs text-muted-foreground truncate">{message.content}</p>
          )}
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </button>
      </div>
    );
  }

  // Document upload — card with status badge
  if (meta?.type === "document_upload") {
    const docTitle = (meta.title as string) || "Document";
    const ingestionStatus = (meta.ingestionStatus as IngestionStatus) || "pending";
    return (
      <div
        data-testid="chat-s04-message"
        className={cn(
          "flex gap-2 px-4 py-1",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
            isUser ? "bg-blue-600" : "bg-violet-600",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <div className="max-w-[75%] rounded-lg border border-border bg-background px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-sm font-medium truncate">{docTitle}</span>
            <DocumentStatusBadge status={ingestionStatus} />
          </div>
          {message.content && (
            <p className="text-xs text-muted-foreground">{message.content}</p>
          )}
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Skill invocation — system-style with command
  if (meta?.type === "skill_invocation") {
    const commandName = (meta.commandName as string) || "command";
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1"
      >
        <div className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground max-w-[80%] flex items-center gap-1.5">
          <Terminal className="h-3 w-3" />
          <span>
            Invoked <strong>{commandName}</strong>
          </span>
          <span className="text-[10px] opacity-60 ml-1">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Agent delegation — subtle delegation indicator
  if (meta?.type === "agent_delegation") {
    const targetAgent = (meta.targetAgentName as string) || "agent";
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1"
      >
        <div className="rounded-md bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 px-3 py-1.5 text-xs text-violet-700 dark:text-violet-300 max-w-[80%] flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3" />
          <span>
            Delegated to <strong>@{targetAgent}</strong>
          </span>
          <span className="text-[10px] opacity-60 ml-1">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // User messages — right aligned, blue
  // Agent messages — left aligned, gray
  return (
    <div
      data-testid="chat-s04-message"
      className={cn(
        "flex gap-2 px-4 py-1",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
          isUser ? "bg-blue-600" : "bg-violet-600",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Bubble */}
      <div
        data-testid={isUser ? "chat-s04-message-user" : "chat-s04-message-agent"}
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        <div data-testid="chat-s04-message-sender" className="sr-only">
          {isUser ? "You" : "Agent"}
        </div>
        <p
          data-testid="chat-s04-message-content"
          className="whitespace-pre-wrap break-words"
        >
          {message.content}
        </p>
        <span
          data-testid="chat-s04-message-time"
          className={cn(
            "mt-0.5 block text-[10px]",
            isUser ? "text-blue-200" : "text-muted-foreground",
          )}
        >
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
