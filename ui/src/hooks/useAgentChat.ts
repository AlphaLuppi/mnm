import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatServerPayload, ChatClientPayload } from "@mnm/shared";
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
  const connectWebSocket = useCallback(() => {
    if (!companyId || !channelId || !enabled) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat/${channelId}`;

    setConnectionState("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
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
            setMessages((prev) => [...prev, newMsg]);
            break;
          }

          case "typing_indicator": {
            setIsTyping(payload.isTyping);
            setTypingSenderName(payload.senderName ?? null);
            break;
          }

          case "message_ack": {
            // Update optimistic message with server ID
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.clientMessageId
                  ? { ...m, id: payload.messageId, createdAt: payload.createdAt }
                  : m,
              ),
            );
            break;
          }

          case "channel_closed": {
            // Channel was closed remotely
            break;
          }

          case "error": {
            // Handle error from server
            console.warn("[chat-ws] Server error:", payload.code, payload.message);
            break;
          }

          case "pong":
          case "sync_response":
            // No-op
            break;
        }
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;

      if (!enabled) {
        setConnectionState("disconnected");
        return;
      }

      // chat-s04-reconnect — exponential backoff
      setConnectionState("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [companyId, channelId, enabled]);

  // Connect WebSocket on mount / when channelId changes
  useEffect(() => {
    if (companyId && channelId && enabled) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionState("disconnected");
    };
  }, [companyId, channelId, enabled, connectWebSocket]);

  // chat-s04-send-message
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !channelId || !companyId) return;

      const clientMessageId = `client-${Date.now()}-${++clientMsgIdRef.current}`;

      // Optimistic message
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

      // Send via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const payload: ChatClientPayload = {
          type: "chat_message",
          content: content.trim(),
          clientMessageId,
        };
        wsRef.current.send(JSON.stringify(payload));
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
