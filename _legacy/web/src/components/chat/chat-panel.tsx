"use client";

import { useEffect, useRef } from "react";
import {
  MessageSquare,
  Bot,
  ChevronRight,
  Send,
  Loader2,
  Scan,
  RefreshCw,
  FolderSearch,
  GitCommitHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "./chat-context";
import { ChatMessageBubble } from "./chat-message";
import { launchTask } from "@/hooks/use-tasks";
import type { TaskType } from "@/lib/tasks/types";

interface QuickAction {
  label: string;
  icon: typeof Scan;
  taskType: TaskType;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Scan for drift", icon: Scan, taskType: "scan-cross-doc-drift" },
  { label: "Re-scan workflows", icon: RefreshCw, taskType: "rescan-workflows" },
  { label: "Discover project", icon: FolderSearch, taskType: "discover-project" },
  { label: "Git changes", icon: GitCommitHorizontal, taskType: "git-scan-commits" },
];

export function ChatPanel() {
  const { messages, isStreaming, isOpen, setIsOpen, sendMessage } =
    useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const value = inputRef.current?.value.trim();
    if (!value || isStreaming) return;
    sendMessage(value);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const target = e.currentTarget;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
  }

  // Collapsed state
  if (!isOpen) {
    return (
      <div className="w-12 border-l bg-background flex flex-col items-center py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsOpen(true)}
          title="Open assistant"
        >
          <MessageSquare className="size-4" />
        </Button>
      </div>
    );
  }

  // Open state
  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4" />
          MnM Assistant
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsOpen(false)}
          title="Collapse"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Messages area — plain div for reliable scrollTop control */}
      <div className="flex-1 overflow-y-auto px-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 py-6">
            <p className="text-xs text-muted-foreground text-center mb-3">
              How can I help you?
            </p>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => launchTask(action.taskType)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs text-left hover:bg-accent transition-colors"
              >
                <action.icon className="size-3.5 shrink-0 text-muted-foreground" />
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-3">
            {messages.map((msg, i) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isStreaming={
                  isStreaming &&
                  msg.role === "assistant" &&
                  i === messages.length - 1
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2 p-3 border-t">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Ask MnM..."
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={isStreaming}
        />
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={isStreaming}
          title="Send"
        >
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
