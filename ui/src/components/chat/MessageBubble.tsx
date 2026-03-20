import { Bot, User } from "lucide-react";
import type { ChatMessage } from "../../api/chat";
import { cn } from "../../lib/utils";

// chat-s04-message-bubble
export interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.senderType === "user";
  const isSystem = message.messageType === "system";

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
