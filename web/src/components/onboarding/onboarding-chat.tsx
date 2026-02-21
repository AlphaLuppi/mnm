"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { buildWelcomeMessage } from "@/lib/onboarding/system-prompt";
import { useChat } from "@/components/chat";
import type { ChatMessage as ChatMessageType, ProjectContext } from "@/lib/onboarding/types";
import { ArrowRight, Sparkles } from "lucide-react";

interface OnboardingChatProps {
  initialContext: ProjectContext;
}

export function OnboardingChat({ initialContext }: OnboardingChatProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setIsOpen } = useChat();
  const openClaude = () => setIsOpen(true);
  const [context, setContext] = useState<ProjectContext>(initialContext);
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    const welcomeMessages: ChatMessageType[] = [
      {
        id: "welcome",
        role: "assistant",
        content: buildWelcomeMessage(initialContext),
        timestamp: Date.now(),
      },
    ];

    // If CLI is installed, offer the embedded terminal (recommended)
    if (initialContext.claudeCodeInstalled && !initialContext.hasApiKey) {
      welcomeMessages.push({
        id: "terminal-option",
        role: "assistant",
        content:
          "I detected **Claude Code** is installed! You can use the embedded terminal to interact with Claude using your subscription.\n\n**Click the button below** to open Claude Code directly - no API key needed!",
        timestamp: Date.now() + 1,
        action: { type: "terminal_or_api_key" },
      });
    }
    // If no CLI and no API key, prompt for API key
    else if (!initialContext.claudeCodeInstalled && !initialContext.hasApiKey) {
      welcomeMessages.push({
        id: "api-key-prompt",
        role: "assistant",
        content:
          "To use MnM's AI features, I'll need access to Claude. Enter an **API key** from console.anthropic.com, or paste a **Setup Token** from your Claude subscription (run `claude setup-token` in terminal).",
        timestamp: Date.now() + 1,
        action: { type: "api_key_input" },
      });
    } else if (initialContext.hasApiKey) {
      // API key configured
      welcomeMessages.push({
        id: "api-key-connected",
        role: "assistant",
        content: `Your API key is configured and ready to go!\n\nWhat would you like to do?\n- Say **"analyze"** to scan your project for specs and workflows\n- Say **"go to dashboard"** to start using MnM`,
        timestamp: Date.now() + 1,
      });
    }

    return welcomeMessages;
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTerminalOption, setShowTerminalOption] = useState(
    initialContext.claudeCodeInstalled && !initialContext.hasApiKey
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleApiKeySuccess() {
    setContext((prev) => ({ ...prev, hasApiKey: true, canChat: true }));

    // Add a success message
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Excellent! Your API key is set up and ready to go. Now I can help you with AI-powered features like drift detection and agent orchestration.\n\nWhat would you like to do next?\n- Say **\"analyze\"** to scan your project\n- Say **\"go to dashboard\"** to start using MnM",
        timestamp: Date.now(),
      },
    ]);
  }

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    // Create placeholder for assistant response
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      },
    ]);

    try {
      // Get conversation history (excluding the streaming placeholder)
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message ?? "Failed to send message");
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: accumulatedText }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (error) {
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  error instanceof Error
                    ? `Sorry, I encountered an error: ${error.message}`
                    : "Sorry, something went wrong.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [messages, context]);

  async function handleComplete() {
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/");
  }

  function handleOpenClaude() {
    openClaude();
    setShowTerminalOption(false);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I've opened the Claude Assistant panel on the right. Once you're authenticated, you can use Claude Code directly with your subscription!\n\nJust type your commands in the chat panel to interact with Claude.",
        timestamp: Date.now(),
      },
    ]);
  }

  return (
    <Card className="flex h-[600px] max-h-[80vh] w-full max-w-2xl flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Welcome to MnM</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={handleComplete}>
          Skip to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>

      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="divide-y">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onApiKeySuccess={handleApiKeySuccess}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Claude Assistant launch option */}
      {showTerminalOption && (
        <div className="border-t bg-muted/30 p-4">
          <Button
            onClick={handleOpenClaude}
            className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Sparkles className="h-4 w-4" />
            Open Claude Assistant
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Use your Claude subscription directly - no API key needed
          </p>
        </div>
      )}

      <CardContent className="p-0">
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder={isStreaming ? "Waiting for response..." : "Ask me anything..."}
        />
      </CardContent>
    </Card>
  );
}
