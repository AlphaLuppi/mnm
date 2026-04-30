/**
 * PAPERCLIP-PHASE2 — Inbox Interactive — minimal interaction card.
 *
 * STUB: this is the entry point for rendering a `ThreadInteraction` in
 * the issue thread. It currently dispatches per-kind to inline minimal
 * renderings — production polish (rich markdown, multi-question forms,
 * task tree previews, expired-state collapsing à la upstream PR #4381)
 * will land in a follow-up UI commit.
 *
 * Style follows the existing InboxItemCard.tsx pattern (border-l-2,
 * rounded-md, status-driven background tints).
 */
import { Button } from "@/components/ui/button";
import type { ThreadInteraction } from "@mnm/shared";
import { cn } from "../../lib/utils";

interface Props {
  interaction: ThreadInteraction;
  onAccept?: (selectedClientKeys?: string[]) => void;
  onReject?: (reason?: string) => void;
  onRespond?: (answers: { questionId: string; optionIds: string[]; text?: string }[]) => void;
  disabled?: boolean;
}

const STATUS_CLASSES: Record<string, string> = {
  pending: "border-l-2 border-l-primary bg-primary/[0.02]",
  accepted: "border-l-2 border-l-success/50 bg-success/[0.02] opacity-80",
  rejected: "border-l-2 border-l-error/50 bg-error/[0.02] opacity-80",
  answered: "border-l-2 border-l-success/50 bg-success/[0.02] opacity-80",
  expired: "opacity-50",
  superseded: "opacity-50",
};

export function InteractionCard({ interaction, onAccept, onReject, onRespond, disabled }: Props) {
  const cardClass = STATUS_CLASSES[interaction.status] ?? "";

  return (
    <div className={cn("rounded-md border p-3 my-2 text-sm", cardClass)}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{interaction.title ?? renderDefaultTitle(interaction)}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {interaction.kind} · {interaction.status}
        </span>
      </div>
      {interaction.summary ? (
        <p className="text-muted-foreground mb-2">{interaction.summary}</p>
      ) : null}

      {interaction.kind === "suggest_tasks" ? (
        <SuggestedTasksBody
          interaction={interaction}
          onAccept={onAccept}
          onReject={onReject}
          disabled={disabled}
        />
      ) : null}

      {interaction.kind === "request_confirmation" ? (
        <RequestConfirmationBody
          interaction={interaction}
          onAccept={onAccept}
          onReject={onReject}
          disabled={disabled}
        />
      ) : null}

      {interaction.kind === "ask_questions" ? (
        <AskQuestionsBody
          interaction={interaction}
          onRespond={onRespond}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function renderDefaultTitle(interaction: ThreadInteraction): string {
  switch (interaction.kind) {
    case "suggest_tasks":
      return interaction.payload.tasks.length === 1
        ? "1 tâche suggérée"
        : `${interaction.payload.tasks.length} tâches suggérées`;
    case "ask_questions":
      return interaction.payload.questions.length === 1
        ? "1 question"
        : `${interaction.payload.questions.length} questions`;
    case "request_confirmation":
      return "Demande de confirmation";
  }
}

function SuggestedTasksBody({
  interaction,
  onAccept,
  onReject,
  disabled,
}: {
  interaction: Extract<ThreadInteraction, { kind: "suggest_tasks" }>;
  onAccept?: (selectedClientKeys?: string[]) => void;
  onReject?: (reason?: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <ul className="space-y-1 mb-3">
        {interaction.payload.tasks.map((t) => (
          <li key={t.clientKey} className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">·</span>
            <span>{t.title}</span>
            {t.priority ? (
              <span className="text-xs text-muted-foreground">[{t.priority}]</span>
            ) : null}
          </li>
        ))}
      </ul>
      {interaction.status === "pending" ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAccept?.()} disabled={disabled}>
            Tout accepter
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReject?.()} disabled={disabled}>
            Rejeter
          </Button>
        </div>
      ) : null}
    </>
  );
}

function RequestConfirmationBody({
  interaction,
  onAccept,
  onReject,
  disabled,
}: {
  interaction: Extract<ThreadInteraction, { kind: "request_confirmation" }>;
  onAccept?: (selectedClientKeys?: string[]) => void;
  onReject?: (reason?: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <p className="mb-3">{interaction.payload.prompt}</p>
      {interaction.status === "pending" ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAccept?.()} disabled={disabled}>
            {interaction.payload.acceptLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReject?.()} disabled={disabled}>
            {interaction.payload.rejectLabel}
          </Button>
        </div>
      ) : null}
      {interaction.status === "rejected" && interaction.result?.reason ? (
        <p className="text-xs text-muted-foreground mt-2">
          Raison : {interaction.result.reason}
        </p>
      ) : null}
    </>
  );
}

function AskQuestionsBody({
  interaction,
  onRespond,
  disabled,
}: {
  interaction: Extract<ThreadInteraction, { kind: "ask_questions" }>;
  onRespond?: (answers: { questionId: string; optionIds: string[]; text?: string }[]) => void;
  disabled?: boolean;
}) {
  // STUB — single-choice quick-reply UX. Multi-question forms / textarea answers
  // will land in the follow-up UI commit (see TODO in InteractionCard.tsx header).
  return (
    <>
      <ul className="space-y-2">
        {interaction.payload.questions.map((q) => (
          <li key={q.id}>
            <p className="font-medium text-xs mb-1">{q.prompt}</p>
            {q.kind === "single_choice" ? (
              <div className="flex flex-wrap gap-1">
                {q.options.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant="outline"
                    disabled={disabled || interaction.status !== "pending"}
                    onClick={() =>
                      onRespond?.([{ questionId: q.id, optionIds: [o.id] }])
                    }
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                ({q.kind} — UI complète à venir)
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
