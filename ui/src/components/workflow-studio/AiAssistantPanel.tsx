/**
 * AiAssistantPanel (U14.4) — 3rd column of the Workflow Studio.
 *
 * Chat-style UI over `useAiAssistant`. Layout is a vertical flex with a
 * header (title + clear button), a scrollable message list that auto-scrolls
 * to bottom as tokens stream in, and a footer with the input Textarea +
 * Send button. Cmd/Ctrl+Enter sends.
 *
 * File proposals render inline inside the assistant message that produced
 * them as a Card with Appliquer / Rejeter buttons — callers wire
 * `onApplyFile` to useWorkflowFiles.editFile/addFile/deleteFile.
 *
 * Gated by `enabled` (resolved from `workflows:create` at the call site). When
 * disabled, the footer is swapped for a muted permission-missing banner.
 */
import { useEffect, useRef, useState } from "react";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileCode2,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiAssistantPanelProps {
  companyId: string;
  workflowName: string;
  /** Called when user clicks "Appliquer" on a file proposal. */
  onApplyFile: (proposal: {
    path: string;
    content?: string;
    delete?: boolean;
  }) => void;
  /** When false, the footer is replaced with an unauthenticated banner. */
  enabled?: boolean;
}

/**
 * Pure helper — decide if the message-list should auto-scroll to bottom. We
 * only auto-scroll when the user was already pinned to (or very near) the
 * bottom before the latest token arrived. A ~60px threshold is enough to
 * cover one line of content without feeling jumpy.
 */
export function shouldAutoScroll(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = 60,
): boolean {
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  return distanceFromBottom <= threshold;
}

const EXAMPLE_PROMPTS = [
  "Ajoute une étape 'preprod-checks' entre review et merge",
  "Explique le gate artifacts-bundle",
  "Crée une gate qui vérifie qu'un fichier JSON parse correctement",
];

export function AiAssistantPanel(props: AiAssistantPanelProps) {
  const { companyId, workflowName, onApplyFile, enabled = true } = props;

  const {
    messages,
    streaming,
    sendPrompt,
    applyProposal,
    dismissProposal,
    clear,
  } = useAiAssistant({ companyId, workflowName, onApplyFile });

  const [input, setInput] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // Remember whether user was at bottom BEFORE the latest message/token so we
  // don't fight manual scroll-up.
  const pinnedRef = useRef(true);

  // Auto-scroll after messages change — but only if the user was pinned to
  // the bottom already. The ScrollArea primitive renders its viewport as the
  // first [data-slot=scroll-area-viewport] child of the Root — we query it
  // once and cache.
  useEffect(() => {
    const viewport = viewportRef.current?.querySelector<HTMLDivElement>(
      "[data-slot=scroll-area-viewport]",
    );
    if (!viewport) return;
    if (pinnedRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const t = e.currentTarget;
    pinnedRef.current = shouldAutoScroll(
      t.scrollTop,
      t.scrollHeight,
      t.clientHeight,
    );
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    pinnedRef.current = true;
    await sendPrompt(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  }

  const canSend = enabled && !streaming && input.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Assistant IA</span>
          {streaming && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Réflexion…
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={messages.length === 0 || streaming}
          title="Effacer la conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Message list */}
      <div
        className="flex-1 min-h-0 relative"
        ref={viewportRef}
      >
        <ScrollArea
          className="h-full"
          onScrollCapture={handleScroll}
        >
          {messages.length === 0 ? (
            <EmptyState
              disabled={!enabled || streaming}
              onPick={(p) => setInput(p)}
            />
          ) : (
            <div className="flex flex-col gap-3 p-3">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  streaming={m.streaming}
                  error={m.error}
                  proposals={m.proposals}
                  onApply={applyProposal}
                  onDismiss={dismissProposal}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Separator />

      {/* Footer */}
      {enabled ? (
        <div className="p-2 flex-shrink-0 flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Demandez à l'IA de créer, modifier, ou expliquer un workflow…"
            rows={3}
            disabled={streaming}
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Ctrl/Cmd+Entrée pour envoyer
            </span>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!canSend}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Envoyer
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 flex-shrink-0">
          <div className="flex items-start gap-2 rounded border border-muted bg-muted/30 p-2 text-xs text-muted-foreground">
            <CircleAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>AI indisponible — permission manquante (workflows:create).</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Internal sub-components ─────────────────────────────────────────────────

function EmptyState(props: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Sparkles className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm text-muted-foreground max-w-[24rem]">
        Posez une question ou demandez à l'IA de modifier votre workflow.
        Les propositions de fichiers apparaîtront ici pour revue avant commit.
      </div>
      <div className="flex flex-col items-stretch gap-1.5 w-full max-w-[24rem] mt-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <Button
            key={p}
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal text-left text-xs py-2 px-3"
            onClick={() => props.onPick(p)}
            disabled={props.disabled}
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble(props: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: { error_code: string; message: string; hints: string[] };
  proposals?: Array<{
    id: string;
    path: string;
    content?: string;
    delete?: boolean;
    applied: boolean;
    dismissed: boolean;
  }>;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const isUser = props.role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-2 max-w-[85%]",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words",
          isUser ? "bg-muted/60" : "bg-muted/30",
        )}
      >
        {props.content}
        {props.streaming && (
          <span className="inline-block w-[1ch] animate-pulse">▍</span>
        )}
      </div>
      {props.error && (
        <Card className="border-destructive bg-destructive/10 p-2 text-xs w-full">
          <div className="font-medium text-destructive">
            {props.error.error_code}: {props.error.message}
          </div>
          {props.error.hints.length > 0 && (
            <ul className="list-disc pl-4 mt-1 text-muted-foreground">
              {props.error.hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {props.proposals?.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          onApply={props.onApply}
          onDismiss={props.onDismiss}
        />
      ))}
    </div>
  );
}

function ProposalCard(props: {
  proposal: {
    id: string;
    path: string;
    content?: string;
    delete?: boolean;
    applied: boolean;
    dismissed: boolean;
  };
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { proposal: p } = props;
  const resolved = p.applied || p.dismissed;
  return (
    <Card className="p-3 border-primary/40 w-full flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <FileCode2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <Badge variant="secondary" className="font-mono text-[11px]">
          {p.path}
        </Badge>
        {p.delete && <Badge variant="destructive">DELETE</Badge>}
      </div>
      {p.delete ? (
        <div className="text-xs text-muted-foreground italic">
          Suppression du fichier
        </div>
      ) : (
        <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-h-28 overflow-hidden whitespace-pre-wrap break-all">
          {(p.content ?? "").slice(0, 600)}
        </pre>
      )}
      <div className="flex items-center justify-end gap-2">
        {p.applied && (
          <span className="text-xs text-muted-foreground italic">Appliquée</span>
        )}
        {p.dismissed && (
          <span className="text-xs text-muted-foreground italic">Rejetée</span>
        )}
        {!resolved && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => props.onDismiss(p.id)}
            >
              Rejeter
            </Button>
            <Button size="sm" onClick={() => props.onApply(p.id)}>
              Appliquer
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
