"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface ChatContextValue {
  messages: ChatMessage[];
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;
  sendMessage: (content: string, pageContext?: string) => void;
  sendCommand: (command: string, pageContext?: string) => void;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Mirror messages in a ref to avoid stale closures in fetch callbacks
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback((content: string, pageContext?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    // Build API payload from current messages (ref = latest state) + new user message
    const apiMessages = [
      ...messagesRef.current.filter((m) => m.role !== "system"),
      { role: "user" as const, content },
    ].map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages, pageContext }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          setMessages((p) =>
            p.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      err.error === "AUTH_REQUIRED"
                        ? "Please configure your Anthropic API key in Settings to use the chat assistant."
                        : `Error: ${err.error || "Failed to get response"}`,
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((p) =>
                  p.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.text }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        setIsStreaming(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setMessages((p) =>
            p.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Error: Failed to connect to the assistant.",
                  }
                : m
            )
          );
        }
        setIsStreaming(false);
      });
  }, []);

  const sendCommand = useCallback(
    (command: string, pageContext?: string) => {
      setIsOpen(true);
      sendMessage(command, pageContext);
    },
    [sendMessage]
  );

  const toggleChat = useCallback(() => setIsOpen((v) => !v), []);

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  }, []);

  // Clear chat when the active project changes
  useEffect(() => {
    const handler = () => clearMessages();
    window.addEventListener("mnm:project-switched", handler);
    return () => window.removeEventListener("mnm:project-switched", handler);
  }, [clearMessages]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isStreaming,
        isOpen,
        setIsOpen,
        toggleChat,
        sendMessage,
        sendCommand,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
