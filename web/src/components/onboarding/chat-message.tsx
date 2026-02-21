"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/onboarding/types";
import { ApiKeyInput } from "./api-key-input";

interface ChatMessageProps {
  message: ChatMessageType;
  onApiKeySuccess?: () => void;
}

export function ChatMessage({ message, onApiKeySuccess }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isAssistant ? "bg-muted/50" : "bg-background"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isAssistant
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isAssistant ? (
          <Bot className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-hidden">
        <p className="text-xs font-medium text-muted-foreground">
          {isAssistant ? "MnM" : "You"}
        </p>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary" />
          )}
        </div>

        {/* Render action components */}
        {message.action?.type === "api_key_input" && onApiKeySuccess && (
          <ApiKeyInput onSuccess={onApiKeySuccess} />
        )}
      </div>
    </div>
  );
}
