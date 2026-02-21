"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  FileSearch,
  GitBranch,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ClaudePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: "Scan project", prompt: "Scan this project and tell me what specs and workflows you find", icon: FileSearch },
  { label: "Check drift", prompt: "Check for any drift between specs and code", icon: RefreshCw },
  { label: "Show workflows", prompt: "List all the workflows in this project", icon: GitBranch },
  { label: "Project overview", prompt: "Give me an overview of this project's architecture", icon: Settings2 },
];

export function ClaudePanel({ isOpen, onClose }: ClaudePanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "Connecting to Claude Code...",
      timestamp: Date.now(),
    },
  ]);
  const [isReady, setIsReady] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle terminal output - defined before being used in useEffect
  const handleTerminalOutput = useCallback((data: string) => {
    // Filter out terminal control sequences and format nicely
    const cleanData = data
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // Remove ANSI codes
      .replace(/\x1b\][^\x07]*\x07/g, "") // Remove OSC sequences
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    if (!cleanData) return;

    // Detect Claude startup / ready state
    // Claude Code typically shows a greeting or prompt when ready
    const isClaudeReady = cleanData.includes("Claude") ||
                          cleanData.includes("How can I help") ||
                          cleanData.includes("What would you like");

    if (isClaudeReady && !isReady) {
      setIsReady(true);
      // Replace the "Connecting..." message with a ready message
      setMessages([{
        id: "ready",
        role: "assistant",
        content: "Connected to Claude Code! I'm using your existing session.\n\nTry asking me to scan the project, check for drift, or update a workflow.",
        timestamp: Date.now(),
      }]);
      return;
    }

    // Skip command echoes and prompts
    if (cleanData.startsWith(">") || cleanData.startsWith("$") || cleanData === "claude") {
      return;
    }

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];

      // If last message is streaming assistant response, append to it
      if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
        return prev.map((m) =>
          m.id === lastMessage.id
            ? { ...m, content: m.content + "\n" + cleanData }
            : m
        );
      }

      // Otherwise create new assistant message
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: cleanData,
          timestamp: Date.now(),
          isStreaming: true,
        },
      ];
    });
  }, [isReady]);

  // Initialize terminal session when panel opens
  useEffect(() => {
    if (!isOpen || sessionId) return;

    const initSession = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        // Create terminal session
        const id = await invoke<string>("terminal_create", {
          cols: 120,
          rows: 30,
          launchClaude: false,
        });
        setSessionId(id);

        // Listen for terminal output
        listen<{ session_id: string; data: string }>("terminal:output", (event) => {
          if (event.payload.session_id === id) {
            // Parse and display output
            handleTerminalOutput(event.payload.data);
          }
        });

        // Start interactive Claude session (uses existing OAuth)
        // Small delay to let terminal initialize
        setTimeout(async () => {
          await invoke("terminal_write", { sessionId: id, data: "claude\r\n" });
        }, 500);
      } catch (err) {
        console.error("Failed to initialize Claude session:", err);
      }
    };

    initSession();
  }, [isOpen, sessionId, handleTerminalOutput]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !sessionId || isLoading || !isReady) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { invoke } = await import("@tauri-apps/api/core");

      // Send message directly to the running interactive Claude session
      // Just send the text + Enter, Claude is already running
      await invoke("terminal_write", { sessionId, data: `${content.trim()}\r\n` });

      // Add placeholder for assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        },
      ]);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Failed to send message. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      // Mark streaming as complete after a delay
      setTimeout(() => {
        setIsLoading(false);
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
        );
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Claude Assistant</h2>
            <p className="text-xs text-muted-foreground">Powered by Claude Code</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-4 py-2.5 max-w-[85%] text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.role === "system"
                    ? "bg-muted/50 text-muted-foreground italic"
                    : "bg-muted"
                )}
              >
                {message.role === "system" && message.content.includes("Connecting") && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{message.content}</span>
                  </div>
                )}
                {!(message.role === "system" && message.content.includes("Connecting")) && (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                {message.isStreaming && (
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {isReady && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-left"
              >
                <action.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!isReady ? "Connecting to Claude..." : "Ask Claude anything..."}
              disabled={!isReady}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-muted/50 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              rows={1}
              style={{ minHeight: "48px", maxHeight: "120px" }}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading || !isReady}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Hook to control the Claude panel
export function useClaudePanel() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}
