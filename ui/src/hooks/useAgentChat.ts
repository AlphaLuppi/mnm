import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatServerPayload } from "@mnm/shared";
import { chatApi, type ChatMessage } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";

// chat-s04-connection-state
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface UseAgentChatOptions {
  companyId: string | null;
  channelId: string | null;
  enabled?: boolean;
}

export interface UseAgentChatResult {
  messages: ChatMessage[];
  connectionState: ConnectionState;
  isTyping: boolean;
  typingSenderName: string | null;
  sendMessage: (content: string) => void;
  loadMoreMessages: () => void;
  hasMore: boolean;
  isLoadingHistory: boolean;
}

// chat-s04-hook
export function useAgentChat(opts: UseAgentChatOptions): UseAgentChatResult {
  const { companyId, channelId, enabled = true } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isTyping, setIsTyping] = useState(false);
  const [typingSenderName, setTypingSenderName] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientMsgIdRef = useRef(0);

  // chat-s04-load-history — initial message history via REST
  const historyQuery = useQuery({
    queryKey: queryKeys.chat.messages(companyId!, channelId!),
    queryFn: () => chatApi.getMessages(companyId!, channelId!, { limit: 50 }),
    enabled: !!companyId && !!channelId && enabled,
  });

  // Load history into messages state
  useEffect(() => {
    if (historyQuery.data) {
      // Messages from API come newest-first, reverse for display
      const reversed = [...historyQuery.data.messages].reverse();
      setMessages(reversed);
      setHasMore(historyQuery.data.hasMore);
    }
  }, [historyQuery.data]);

  // chat-s04-ws-connect
  useEffect(() => {
    if (!companyId || !channelId || !enabled) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectAttempt += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 4));
      setConnectionState("reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/chat/${channelId}`;

      setConnectionState("connecting");
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionState("connected");
        reconnectAttempt = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload: ChatServerPayload = JSON.parse(event.data);

          switch (payload.type) {
            case "chat_message": {
              const newMsg: ChatMessage = {
                id: payload.id,
                channelId: payload.channelId,
                companyId: companyId,
                senderId: payload.senderId,
                senderType: payload.senderType,
                content: payload.content,
                metadata: payload.metadata ?? null,
                messageType: "text",
                replyToId: null,
                editedAt: null,
                deletedAt: null,
                createdAt: payload.createdAt,
              };
              // Replace streaming placeholder from this sender, or append
              const streamingId = `streaming-${payload.senderId}`;
              setMessages((prev) => {
                const hasStreaming = prev.some((m) => m.id === streamingId);
                if (hasStreaming) {
                  return prev.map((m) => (m.id === streamingId ? newMsg : m));
                }
                return [...prev, newMsg];
              });
              break;
            }

            case "chat_message_delta": {
              const delta = payload as {
                type: "chat_message_delta";
                channelId: string;
                senderId: string;
                senderType: "user" | "agent";
                content: string;
                isStreaming: boolean;
              };
              const streamingId = `streaming-${delta.senderId}`;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === streamingId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === streamingId ? { ...m, content: delta.content } : m,
                  );
                }
                return [
                  ...prev,
                  {
                    id: streamingId,
                    channelId: delta.channelId,
                    companyId: companyId!,
                    senderId: delta.senderId,
                    senderType: delta.senderType,
                    content: delta.content,
                    metadata: { isStreaming: true },
                    messageType: "text" as const,
                    replyToId: null,
                    editedAt: null,
                    deletedAt: null,
                    createdAt: new Date().toISOString(),
                  },
                ];
              });
              // Hide typing indicator while streaming
              setIsTyping(false);
              break;
            }

            case "typing_indicator": {
              setIsTyping(payload.isTyping);
              setTypingSenderName(payload.senderName ?? null);
              break;
            }

            case "message_ack": {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === payload.clientMessageId
                    ? { ...m, id: payload.messageId, createdAt: payload.createdAt }
                    : m,
                ),
              );
              break;
            }

            case "channel_closed":
              break;

            case "error":
              console.warn("[chat-ws] Server error:", payload.code, payload.message);
              break;

            case "pong":
            case "sync_response":
              break;
          }
        } catch {
          // Ignore unparseable messages
        }
      };

      socket.onclose = () => {
        if (closed) return;
        scheduleReconnect();
      };

      socket.onerror = () => {
        // onclose will fire after onerror
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnect();
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "chat_unmount");
      }
      wsRef.current = null;
      setConnectionState("disconnected");
    };
  }, [companyId, channelId, enabled]);

  // chat-s04-send-message
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !channelId || !companyId) return;

      const clientMessageId = `client-${Date.now()}-${++clientMsgIdRef.current}`;

      // Send via WebSocket — only add optimistic message if socket is open
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const optimistic: ChatMessage = {
        id: clientMessageId,
        channelId,
        companyId,
        senderId: "me",
        senderType: "user",
        content: content.trim(),
        metadata: null,
        messageType: "text",
        replyToId: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        wsRef.current.send(JSON.stringify({
          type: "chat_message" as const,
          content: content.trim(),
          clientMessageId,
        }));
      } catch {
        // Remove optimistic message on send failure
        setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
      }
    },
    [channelId, companyId],
  );

  // chat-s04-load-more
  const loadMoreMessages = useCallback(() => {
    // This would need cursor-based pagination
    // For now, initial load of 50 is sufficient
  }, []);

  return {
    messages,
    connectionState,
    isTyping,
    typingSenderName,
    sendMessage,
    loadMoreMessages,
    hasMore,
    isLoadingHistory: historyQuery.isLoading,
  };
}
