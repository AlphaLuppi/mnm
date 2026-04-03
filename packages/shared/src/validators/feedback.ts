import { z } from "zod";

export const castFeedbackVoteSchema = z.object({
  targetType: z.enum(["issue_comment"]),
  targetId: z.string().uuid(),
  vote: z.enum(["up", "down"]),
  reason: z.string().max(1000).nullable().optional(),
});
export type CastFeedbackVote = z.infer<typeof castFeedbackVoteSchema>;

export const feedbackSummaryFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});
export type FeedbackSummaryFilters = z.infer<typeof feedbackSummaryFiltersSchema>;
