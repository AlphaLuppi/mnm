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

  // System messages — centered pill
  if (isSystem) {
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1.5"
      >
        <div
          data-testid="chat-s04-message-system"
          className="text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1 text-center max-w-[80%]"
        >
          <span data-testid="chat-s04-message-content">{message.content}</span>
          <span
            data-testid="chat-s04-message-time"
            className="ml-2 text-[10px] text-muted-foreground/60"
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
          "flex gap-2.5 px-4 py-1.5",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium",
            isUser
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </div>
        <button
          type="button"
          className="max-w-[75%] rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2 text-left transition-colors cursor-pointer"
          onClick={() => artifactId && onArtifactClick?.(artifactId)}
        >
          <div className="flex items-center gap-2 mb-1">
            <Box className="h-3.5 w-3.5 text-muted-foreground" />
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
          "flex gap-2.5 px-4 py-1.5",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium",
            isUser
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </div>
        <div className="max-w-[75%] rounded-lg border border-border bg-background px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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

  // Skill invocation — centered system-style
  if (meta?.type === "skill_invocation") {
    const commandName = (meta.commandName as string) || "command";
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1.5"
      >
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1 flex items-center gap-1.5 max-w-[80%]">
          <Terminal className="h-3 w-3" />
          <span>
            Invoked <strong>{commandName}</strong>
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Agent delegation — centered indicator using theme colors
  if (meta?.type === "agent_delegation") {
    const targetAgent = (meta.targetAgentName as string) || "agent";
    return (
      <div
        data-testid="chat-s04-message"
        className="flex justify-center px-4 py-1.5"
      >
        <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-full px-3 py-1 flex items-center gap-1.5 max-w-[80%]">
          <ArrowRight className="h-3 w-3" />
          <span>
            Delegated to <strong>@{targetAgent}</strong>
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // ── Streaming message — blinking cursor ──
  const isStreamingMessage = !!(meta?.isStreaming);

  if (isStreamingMessage) {
    return (
      <div
        data-testid="chat-s04-message"
        className="flex gap-2.5 px-4 py-1.5 flex-row"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium bg-muted text-muted-foreground">
          <Bot className="h-3 w-3" />
        </div>
        <div className="max-w-[75%] flex flex-col items-start">
          <span className="text-xs text-muted-foreground mb-0.5 ml-1">Agent</span>
          <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
            <p className="whitespace-pre-wrap break-words inline">
              {message.content}
            </p>
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  // ── Regular messages ──
  // User messages — right aligned, primary color
  // Agent messages — left aligned, muted background
  return (
    <div
      data-testid="chat-s04-message"
      className={cn(
        "flex gap-2.5 px-4 py-1.5",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Small initials avatar */}
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? (
          <User className="h-3 w-3" />
        ) : (
          <Bot className="h-3 w-3" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn("max-w-[75%] flex flex-col", isUser ? "items-end" : "items-start")}>
        {/* Sender name (agent messages only) */}
        {!isUser && (
          <span className="text-xs text-muted-foreground mb-0.5 ml-1">
            Agent
          </span>
        )}
        <div
          data-testid={isUser ? "chat-s04-message-user" : "chat-s04-message-agent"}
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
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
        </div>
        <span
          data-testid="chat-s04-message-time"
          className="text-[10px] text-muted-foreground mt-0.5 mx-1"
        >
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
