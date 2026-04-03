export const FEEDBACK_VOTE_VALUES = ["up", "down"] as const;
export type FeedbackVoteValue = (typeof FEEDBACK_VOTE_VALUES)[number];

export const FEEDBACK_TARGET_TYPES = ["issue_comment"] as const;
export type FeedbackTargetType = (typeof FEEDBACK_TARGET_TYPES)[number];

export interface FeedbackVote {
  id: string;
  companyId: string;
  issueId: string;
  targetType: FeedbackTargetType;
  targetId: string;
  authorUserId: string;
  vote: FeedbackVoteValue;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackVoteSummary {
  targetId: string;
  targetType: FeedbackTargetType;
  upCount: number;
  downCount: number;
  userVote: FeedbackVoteValue | null;
}

export interface FeedbackAgentStats {
  agentId: string;
  agentName: string;
  totalVotes: number;
  upVotes: number;
  downVotes: number;
  approvalRate: number;
}

export interface FeedbackSummary {
  totalVotes: number;
  upVotes: number;
  downVotes: number;
  byAgent: FeedbackAgentStats[];
  recentDownvoteReasons: string[];
}
