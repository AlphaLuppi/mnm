import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { ArrowDown, ArrowLeft, Bot, MessageSquare, Paperclip, Send } from "lucide-react";
// Resizable split uses simple CSS resize instead of react-resizable-panels
import type { ChatChannel } from "../api/chat";
import { documentsApi } from "../api/documents";
import { useAgentChat } from "../hooks/useAgentChat";
import { useCompany } from "../context/CompanyContext";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingIndicator } from "./chat/TypingIndicator";
import { ConnectionStatus } from "./chat/ConnectionStatus";
import { ArtifactPanel } from "./chat/ArtifactPanel";
import { DocumentDropZone } from "./chat/DocumentDropZone";
import { ContextLinkBar } from "./chat/ContextLinkBar";
import { ForkBanner } from "./chat/ForkBanner";
import { SlashCommandAutocomplete } from "./chat/SlashCommandAutocomplete";
import { AgentMentionAutocomplete } from "./chat/AgentMentionAutocomplete";
import { Button } from "@/components/ui/button";

// chat-s04-panel
export interface AgentChatPanelProps {
  channel: ChatChannel & {
    forkedFromChannelId?: string | null;
    forkedFromName?: string | null;
  };
  agentName?: string;
  onBack?: () => void;
}

export function AgentChatPanel({ channel, agentName, onBack }: AgentChatPanelProps) {
  const { selectedCompanyId } = useCompany();
  const [inputValue, setInputValue] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMention, setShowMention] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [artifactWidth, setArtifactWidth] = useState(500);
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const threshold = 100;
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
    setShowSlash(false);
    setShowMention(false);
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSlash || showMention) {
        if (["ArrowUp", "ArrowDown", "Tab", "Escape"].includes(e.key)) {
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, showSlash, showMention],
  );

  // Detect "/" and "@" triggers for autocomplete
  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.startsWith("/")) {
      const query = val.slice(1);
      setSlashQuery(query);
      setShowSlash(true);
      setShowMention(false);
    } else {
      setShowSlash(false);
    }

    const lastAtIdx = val.lastIndexOf("@");
    if (lastAtIdx >= 0 && !val.startsWith("/")) {
      const beforeAt = val.charAt(lastAtIdx - 1);
      if (lastAtIdx === 0 || beforeAt === " ") {
        const afterAt = val.slice(lastAtIdx + 1);
        if (!afterAt.includes(" ")) {
          setMentionQuery(afterAt);
          setShowMention(true);
          setShowSlash(false);
          return;
        }
      }
    }
    if (!val.startsWith("/")) {
      setShowMention(false);
    }
  }, []);

  const handleSlashSelect = useCallback((command: string) => {
    setInputValue(command + " ");
    setShowSlash(false);
  }, []);

  const handleMentionSelect = useCallback((mentionedAgentName: string) => {
    setInputValue((prev) => {
      const lastAtIdx = prev.lastIndexOf("@");
      if (lastAtIdx >= 0) {
        return prev.slice(0, lastAtIdx) + `@${mentionedAgentName} `;
      }
      return prev + `@${mentionedAgentName} `;
    });
    setShowMention(false);
  }, []);

  const handleArtifactClick = useCallback((artifactId: string) => {
    setSelectedArtifactId(artifactId);
  }, []);

  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;
    try {
      await documentsApi.upload(selectedCompanyId, file, { channelId: channel.id });
      sendMessage(`[Uploaded: ${file.name}]`);
    } catch (err) {
      console.error("File upload failed:", err);
    }
    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedCompanyId, channel.id, sendMessage]);

  // Drag handle for artifact panel resize
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = artifactWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX - ev.clientX;
      setArtifactWidth(Math.max(250, Math.min(900, startWidth + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [artifactWidth]);

  const isChannelOpen = channel.status === "open";
  const displayName = channel.name || agentName || "Chat";

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0">
      {/* Main chat area */}
      <div
        data-testid="chat-s04-panel"
        className="flex h-full flex-col bg-background"
      >
        {/* Header */}
        <div
          data-testid="chat-s04-panel-header"
          className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <Button variant="ghost" size="icon-sm" onClick={onBack} className="shrink-0 -ml-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold truncate">
              {displayName}
            </span>
            <ConnectionStatus state={connectionState} />
          </div>
        </div>

        {/* Fork banner */}
        {channel.forkedFromChannelId && (
          <ForkBanner
            forkedFromName={channel.forkedFromName ?? undefined}
            forkedFromChannelId={channel.forkedFromChannelId}
          />
        )}

        {/* Context link bar */}
        {selectedCompanyId && (
          <ContextLinkBar
            companyId={selectedCompanyId}
            channelId={channel.id}
            onArtifactClick={handleArtifactClick}
          />
        )}

        {/* Messages area wrapped in DocumentDropZone */}
        <DocumentDropZone
          companyId={selectedCompanyId!}
          channelId={channel.id}
        >
          <div
            data-testid="chat-s04-messages"
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto py-4"
            onScroll={handleScroll}
          >
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div
                data-testid="chat-s04-empty-messages"
                className="flex flex-col items-center justify-center py-20 text-center px-4"
              >
                <div className="bg-muted/50 rounded-full p-5 mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onArtifactClick={handleArtifactClick}
                  />
                ))}
              </div>
            )}

            <TypingIndicator
              isTyping={isTyping}
              senderName={typingSenderName}
            />

            <div ref={messagesEndRef} />
          </div>
        </DocumentDropZone>

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
          className="border-t border-border p-4 shrink-0 relative"
        >
          {/* Slash command autocomplete */}
          <SlashCommandAutocomplete
            query={slashQuery}
            visible={showSlash}
            onSelect={handleSlashSelect}
            onDismiss={() => setShowSlash(false)}
          />

          {/* Agent mention autocomplete */}
          {selectedCompanyId && (
            <AgentMentionAutocomplete
              query={mentionQuery}
              companyId={selectedCompanyId}
              visible={showMention}
              onSelect={handleMentionSelect}
              onDismiss={() => setShowMention(false)}
            />
          )}

          {isChannelOpen ? (
            <div className="max-w-3xl mx-auto flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file"
                disabled={connectionState === "disconnected"}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="*/*"
              />
              <textarea
                data-testid="chat-s04-input"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (/ for commands, @ to mention)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background transition-colors"
                disabled={connectionState === "disconnected"}
              />
              <Button
                data-testid="chat-s04-send-btn"
                variant="default"
                size="icon"
                className="rounded-xl h-10 w-10 shrink-0"
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
      </div>

      {/* Artifact side panel with drag handle */}
      {selectedArtifactId && selectedCompanyId && (
        <>
          <div
            className="w-1 shrink-0 bg-border hover:bg-primary/30 cursor-col-resize transition-colors"
            onMouseDown={handleDragStart}
          />
          <div className="shrink-0 h-full overflow-hidden" style={{ width: artifactWidth }}>
            <ArtifactPanel
              companyId={selectedCompanyId}
              artifactId={selectedArtifactId}
              onClose={() => setSelectedArtifactId(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}
