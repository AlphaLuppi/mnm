"use client";

import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "./chat-context";

interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ message, isStreaming }: ChatMessageProps) {
  if (message.role === "system") {
    return (
      <div className="text-xs text-muted-foreground italic text-center py-1">
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[80%] ml-auto text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex gap-2 items-start">
      <div className="mt-1 shrink-0">
        <Bot className="size-4 text-muted-foreground" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2 max-w-[80%] text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          ) : null}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}
