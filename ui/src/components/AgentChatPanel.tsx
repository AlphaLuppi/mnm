import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, MessageSquare, Send, X } from "lucide-react";
import type { ChatPipeStatus } from "@mnm/shared";
import { chatApi, type ChatChannel } from "../api/chat";
import { useAgentChat } from "../hooks/useAgentChat";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingIndicator } from "./chat/TypingIndicator";
import { ConnectionStatus } from "./chat/ConnectionStatus";
import { PipeStatusIndicator } from "./chat/PipeStatusIndicator";
import { Button } from "@/components/ui/button";

// chat-s04-panel
export interface AgentChatPanelProps {
  channel: ChatChannel;
  onClose: () => void;
}

export function AgentChatPanel({ channel, onClose }: AgentChatPanelProps) {
  const { selectedCompanyId } = useCompany();
  const [inputValue, setInputValue] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    connectionState,
    isTyping,
    typingSenderName,
    sendMessage,
    isLoadingHistory,
  } = useAgentChat({
    companyId: selectedCompanyId,
    channelId: channel.id,
    enabled: channel.status === "open",
  });

  // Pipe status query
  const pipeQuery = useQuery({
    queryKey: queryKeys.chat.pipeStatus(selectedCompanyId!, channel.id),
    queryFn: () => chatApi.getPipeStatus(selectedCompanyId!, channel.id),
    enabled: !!selectedCompanyId && channel.status === "open",
  });

  const pipeStatus: ChatPipeStatus | null = pipeQuery.data ?? null;

  // chat-s04-auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages.length, isAtBottom, scrollToBottom]);

  // Detect if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const threshold = 100; // pixels from bottom
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    setIsAtBottom(atBottom);
  }, []);

  // chat-s04-handle-send
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue("");
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isChannelOpen = channel.status === "open";

  return (
    <div
      data-testid="chat-s04-panel"
      className="flex h-full w-80 flex-col border-l border-border bg-background"
    >
      {/* Header */}
      <div
        data-testid="chat-s04-panel-header"
        className="flex items-center justify-between border-b border-border px-3 py-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {channel.name ?? "Chat"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConnectionStatus state={connectionState} />
          <Button
            data-testid="chat-s04-panel-close"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close chat panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pipe status bar */}
      <div className="border-b border-border px-3 py-1">
        <PipeStatusIndicator pipeStatus={pipeStatus} />
      </div>

      {/* Messages area */}
      <div
        data-testid="chat-s04-messages"
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-2"
        onScroll={handleScroll}
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div
            data-testid="chat-s04-empty-messages"
            className="flex flex-col items-center justify-center py-12 text-center px-4"
          >
            <div className="bg-muted/50 rounded-full p-4 mb-3">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </>
        )}

        <TypingIndicator
          isTyping={isTyping}
          senderName={typingSenderName}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <div className="flex justify-center -mt-10 relative z-10">
          <Button
            data-testid="chat-s04-scroll-bottom"
            variant="secondary"
            size="sm"
            className="rounded-full shadow-md h-7 px-3 text-xs"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-3 w-3 mr-1" />
            New messages
          </Button>
        </div>
      )}

      {/* Input area */}
      <div
        data-testid="chat-s04-input-area"
        className="border-t border-border p-3"
      >
        {isChannelOpen ? (
          <div className="flex gap-2">
            <textarea
              data-testid="chat-s04-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={connectionState === "disconnected"}
            />
            <Button
              data-testid="chat-s04-send-btn"
              variant="default"
              size="icon"
              onClick={handleSend}
              disabled={
                !inputValue.trim() ||
                connectionState === "disconnected"
              }
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-2">
            This channel is closed.
          </div>
        )}
      </div>
    </div>
  );
}
