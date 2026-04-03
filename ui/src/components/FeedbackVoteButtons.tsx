import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { feedbackApi } from "../api/feedback";
import { queryKeys } from "../lib/queryKeys";
import type { FeedbackVoteSummary, FeedbackVoteValue } from "@mnm/shared";
import { cn } from "../lib/utils";

interface FeedbackVoteButtonsProps {
  companyId: string;
  issueId: string;
  targetType: "issue_comment";
  targetId: string;
  authorAgentId: string | null | undefined;
}

export function FeedbackVoteButtons({
  companyId,
  issueId,
  targetType,
  targetId,
  authorAgentId,
}: FeedbackVoteButtonsProps) {
  const queryClient = useQueryClient();
  const [reasonInput, setReasonInput] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Only render for agent-authored comments
  if (!authorAgentId) return null;

  const { data: allVotes } = useQuery({
    queryKey: queryKeys.feedback.votes(companyId, issueId),
    queryFn: () => feedbackApi.getVotes(companyId, issueId),
    enabled: !!companyId && !!issueId,
  });

  const voteSummary = allVotes?.find((v) => v.targetId === targetId) ?? null;
  const currentVote = voteSummary?.userVote ?? null;
  const upCount = voteSummary?.upCount ?? 0;
  const downCount = voteSummary?.downCount ?? 0;

  const castVoteMutation = useMutation({
    mutationFn: (data: { vote: FeedbackVoteValue; reason?: string | null }) =>
      feedbackApi.castVote(companyId, issueId, {
        targetType,
        targetId,
        vote: data.vote,
        reason: data.reason ?? null,
      }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.feedback.votes(companyId, issueId),
      });

      const previousVotes = queryClient.getQueryData<FeedbackVoteSummary[]>(
        queryKeys.feedback.votes(companyId, issueId),
      );

      queryClient.setQueryData<FeedbackVoteSummary[]>(
        queryKeys.feedback.votes(companyId, issueId),
        (old) => {
          if (!old) {
            return [
              {
                targetId,
                targetType,
                upCount: data.vote === "up" ? 1 : 0,
                downCount: data.vote === "down" ? 1 : 0,
                userVote: data.vote,
              },
            ];
          }

          const existing = old.find((v) => v.targetId === targetId);
          if (existing) {
            return old.map((v) => {
              if (v.targetId !== targetId) return v;
              const wasUp = v.userVote === "up";
              const wasDown = v.userVote === "down";
              return {
                ...v,
                upCount: v.upCount + (data.vote === "up" ? 1 : 0) - (wasUp ? 1 : 0),
                downCount: v.downCount + (data.vote === "down" ? 1 : 0) - (wasDown ? 1 : 0),
                userVote: data.vote,
              };
            });
          }

          return [
            ...old,
            {
              targetId,
              targetType,
              upCount: data.vote === "up" ? 1 : 0,
              downCount: data.vote === "down" ? 1 : 0,
              userVote: data.vote,
            },
          ];
        },
      );

      return { previousVotes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousVotes) {
        queryClient.setQueryData(
          queryKeys.feedback.votes(companyId, issueId),
          context.previousVotes,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedback.votes(companyId, issueId),
      });
    },
  });

  const deleteVoteMutation = useMutation({
    mutationFn: () => feedbackApi.deleteVote(companyId, issueId, targetId),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.feedback.votes(companyId, issueId),
      });

      const previousVotes = queryClient.getQueryData<FeedbackVoteSummary[]>(
        queryKeys.feedback.votes(companyId, issueId),
      );

      queryClient.setQueryData<FeedbackVoteSummary[]>(
        queryKeys.feedback.votes(companyId, issueId),
        (old) => {
          if (!old) return old;
          return old.map((v) => {
            if (v.targetId !== targetId) return v;
            return {
              ...v,
              upCount: v.upCount - (v.userVote === "up" ? 1 : 0),
              downCount: v.downCount - (v.userVote === "down" ? 1 : 0),
              userVote: null,
            };
          });
        },
      );

      return { previousVotes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousVotes) {
        queryClient.setQueryData(
          queryKeys.feedback.votes(companyId, issueId),
          context.previousVotes,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedback.votes(companyId, issueId),
      });
    },
  });

  function handleVote(vote: FeedbackVoteValue) {
    if (currentVote === vote) {
      // Retract the vote
      deleteVoteMutation.mutate();
      setShowReasonInput(false);
      setReasonInput("");
      return;
    }

    if (vote === "down" && !showReasonInput && currentVote !== "down") {
      // Show reason input for downvote
      setShowReasonInput(true);
      return;
    }

    castVoteMutation.mutate({ vote, reason: vote === "down" ? reasonInput || null : null });
    setShowReasonInput(false);
    setReasonInput("");
  }

  function handleReasonSubmit() {
    castVoteMutation.mutate({ vote: "down", reason: reasonInput || null });
    setShowReasonInput(false);
    setReasonInput("");
  }

  function handleReasonCancel() {
    setShowReasonInput(false);
    setReasonInput("");
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleVote("up")}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
            currentVote === "up"
              ? "text-green-600 bg-green-500/10 hover:bg-green-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          title="Thumbs up"
        >
          <ThumbsUp className={cn("h-3 w-3", currentVote === "up" && "fill-current")} />
          {upCount > 0 && <span>{upCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => handleVote("down")}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
            currentVote === "down"
              ? "text-orange-600 bg-orange-500/10 hover:bg-orange-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          title="Thumbs down"
        >
          <ThumbsDown className={cn("h-3 w-3", currentVote === "down" && "fill-current")} />
          {downCount > 0 && <span>{downCount}</span>}
        </button>
      </div>
      {showReasonInput && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <input
            type="text"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 h-6 rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleReasonSubmit();
              if (e.key === "Escape") handleReasonCancel();
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleReasonSubmit}
            className="text-xs text-primary hover:underline"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={handleReasonCancel}
            className="text-xs text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
