/**
 * useAiAssistant (U14.3) — session-only chat state for the Workflow Studio's
 * AI assistant panel.
 *
 * Glues the SSE wrapper from `governedWorkflowsApi.streamAiChat` to a tiny
 * in-memory message/proposal model. Messages live ONLY in hook state — there's
 * no persistence, so navigating away clears the conversation (by design for
 * MVP).
 *
 * Pure state-transition helpers (`applyTokenDelta`, `addProposal`,
 * `markProposalApplied`, `markProposalDismissed`) are exported for
 * @testing-library-free unit tests — React hook testing infra isn't installed
 * in this workspace, so we test the reducer shape directly.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { governedWorkflowsApi } from "@/api/governed-workflows";

export interface FileProposal {
  id: string;
  path: string;
  content?: string;
  delete?: boolean;
  applied: boolean;
  dismissed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: { error_code: string; message: string; hints: string[] };
  proposals?: FileProposal[];
}

export interface UseAiAssistantResult {
  messages: ChatMessage[];
  streaming: boolean;
  pendingProposals: FileProposal[];
  sendPrompt: (text: string) => Promise<void>;
  applyProposal: (id: string) => void;
  dismissProposal: (id: string) => void;
  stop: () => void;
  clear: () => void;
}

export interface UseAiAssistantArgs {
  companyId: string;
  workflowName: string;
  /** Called when the user accepts a file proposal — wires to useWorkflowFiles. */
  onApplyFile: (proposal: {
    path: string;
    content?: string;
    delete?: boolean;
  }) => void;
}

// ── Pure helpers (tested in isolation) ──────────────────────────────────────

/** Append a token delta to the streaming assistant message with the given id. */
export function applyTokenDelta(
  messages: ChatMessage[],
  messageId: string,
  delta: string,
): ChatMessage[] {
  return messages.map((m) =>
    m.id === messageId ? { ...m, content: m.content + delta } : m,
  );
}

/** Attach a new FileProposal to the assistant message's proposals array. */
export function addProposal(
  messages: ChatMessage[],
  messageId: string,
  proposal: FileProposal,
): ChatMessage[] {
  return messages.map((m) =>
    m.id === messageId
      ? { ...m, proposals: [...(m.proposals ?? []), proposal] }
      : m,
  );
}

/** Mark proposal with the given id as applied (across every message). */
export function markProposalApplied(
  messages: ChatMessage[],
  proposalId: string,
): ChatMessage[] {
  return messages.map((m) => {
    if (!m.proposals?.some((p) => p.id === proposalId)) return m;
    return {
      ...m,
      proposals: m.proposals.map((p) =>
        p.id === proposalId ? { ...p, applied: true } : p,
      ),
    };
  });
}

/** Mark proposal with the given id as dismissed. */
export function markProposalDismissed(
  messages: ChatMessage[],
  proposalId: string,
): ChatMessage[] {
  return messages.map((m) => {
    if (!m.proposals?.some((p) => p.id === proposalId)) return m;
    return {
      ...m,
      proposals: m.proposals.map((p) =>
        p.id === proposalId ? { ...p, dismissed: true } : p,
      ),
    };
  });
}

/** Stamp the streaming assistant message with an error + clear streaming flag. */
export function stampError(
  messages: ChatMessage[],
  messageId: string,
  error: { error_code: string; message: string; hints: string[] },
): ChatMessage[] {
  return messages.map((m) =>
    m.id === messageId ? { ...m, error, streaming: false } : m,
  );
}

/** Clear the streaming flag on the given message. */
export function endStream(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  return messages.map((m) =>
    m.id === messageId ? { ...m, streaming: false } : m,
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAiAssistant(args: UseAiAssistantArgs): UseAiAssistantResult {
  const { companyId, workflowName, onApplyFile } = args;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep a live ref of messages so callbacks don't go stale across renders.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (abortRef.current) {
        // Already streaming — reject new prompt. Caller is expected to disable
        // the Send button while `streaming` is true, but be defensive.
        return;
      }

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = genId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        proposals: [],
      };

      // Build the payload from the CURRENT ref'd conversation + the new user
      // message so we don't depend on React state having flushed.
      const nextConversation = [...messagesRef.current, userMsg];
      setMessages([...nextConversation, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await governedWorkflowsApi.streamAiChat(
          companyId,
          workflowName,
          {
            messages: nextConversation.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
          {
            signal: controller.signal,
            onToken: (delta) => {
              setMessages((prev) => applyTokenDelta(prev, assistantId, delta));
            },
            onFileProposal: (p) => {
              const proposal: FileProposal = {
                id: genId(),
                path: p.path,
                content: p.content,
                delete: p.delete,
                applied: false,
                dismissed: false,
              };
              setMessages((prev) => addProposal(prev, assistantId, proposal));
            },
            onError: (err) => {
              setMessages((prev) => stampError(prev, assistantId, err));
            },
            onDone: () => {
              setMessages((prev) => endStream(prev, assistantId));
            },
          },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code =
          (err as { code?: string } | null)?.code === "RATE_LIMITED"
            ? "RATE_LIMITED"
            : "NETWORK_ERROR";
        setMessages((prev) =>
          stampError(prev, assistantId, {
            error_code: code,
            message,
            hints:
              code === "RATE_LIMITED"
                ? ["Attendez la fin des requêtes en cours puis réessayez."]
                : [],
          }),
        );
      } finally {
        setStreaming(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [companyId, workflowName],
  );

  const applyProposal = useCallback(
    (id: string) => {
      let proposal: FileProposal | null = null;
      for (const m of messagesRef.current) {
        const found = m.proposals?.find((p) => p.id === id);
        if (found) {
          proposal = found;
          break;
        }
      }
      if (!proposal || proposal.applied || proposal.dismissed) return;
      onApplyFile({
        path: proposal.path,
        content: proposal.content,
        delete: proposal.delete,
      });
      setMessages((prev) => markProposalApplied(prev, id));
    },
    [onApplyFile],
  );

  const dismissProposal = useCallback((id: string) => {
    setMessages((prev) => markProposalDismissed(prev, id));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  // Flatten pending (not applied + not dismissed) proposals across every
  // assistant message — handy for callers that want a count chip.
  const pendingProposals: FileProposal[] = [];
  for (const m of messages) {
    for (const p of m.proposals ?? []) {
      if (!p.applied && !p.dismissed) pendingProposals.push(p);
    }
  }

  return {
    messages,
    streaming,
    pendingProposals,
    sendPrompt,
    applyProposal,
    dismissProposal,
    stop,
    clear,
  };
}
