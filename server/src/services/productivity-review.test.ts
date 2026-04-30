import { describe, it, expect } from "vitest";
import {
  detectStalledIssuePure,
  activityEventTypes,
  PRODUCTIVITY_REVIEW_DEFAULTS,
  type DetectStalledIssueInput,
} from "./productivity-review.js";

const NOW = new Date("2026-04-30T12:00:00Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

function baseInput(overrides: Partial<DetectStalledIssueInput["issue"]> = {}): DetectStalledIssueInput {
  return {
    issue: {
      id: "issue-1",
      status: "in_progress",
      startedAt: hoursAgo(48),
      updatedAt: hoursAgo(48),
      executionRunId: null,
      ...overrides,
    },
    comments: [],
    run: null,
  };
}

describe("detectStalledIssuePure — terminal states", () => {
  it("never triggers for status=done", () => {
    const v = detectStalledIssuePure(
      baseInput({ status: "done" }),
      { now: NOW },
    );
    expect(v.recommendedEvent).toBeNull();
    expect(v.signals.noCommentStreak.triggered).toBe(false);
    expect(v.signals.highChurnLoop.triggered).toBe(false);
    expect(v.signals.runStalled.triggered).toBe(false);
  });

  it("never triggers for status=cancelled", () => {
    const v = detectStalledIssuePure(
      baseInput({ status: "cancelled" }),
      { now: NOW },
    );
    expect(v.recommendedEvent).toBeNull();
  });
});

describe("detectStalledIssuePure — no-comment streak", () => {
  it("triggers when in_progress + last comment older than threshold", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        comments: [{ createdAt: hoursAgo(30) }],
      },
      { now: NOW, noCommentStreakHours: 24 },
    );
    expect(v.signals.noCommentStreak.triggered).toBe(true);
    expect(v.signals.noCommentStreak.streakHours).toBeCloseTo(30, 1);
    expect(v.recommendedEvent).toBe(activityEventTypes.issueNoCommentStreak);
  });

  it("does NOT trigger when there's a recent comment", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        comments: [{ createdAt: hoursAgo(1) }],
      },
      { now: NOW, noCommentStreakHours: 24 },
    );
    expect(v.signals.noCommentStreak.triggered).toBe(false);
    expect(v.recommendedEvent).toBeNull();
  });

  it("falls back to startedAt when there are no comments", () => {
    const v = detectStalledIssuePure(
      baseInput({ startedAt: hoursAgo(50) }),
      { now: NOW, noCommentStreakHours: 24 },
    );
    expect(v.signals.noCommentStreak.triggered).toBe(true);
  });

  it("only evaluates streak for in_progress issues", () => {
    const v = detectStalledIssuePure(
      baseInput({ status: "todo" }),
      { now: NOW, noCommentStreakHours: 24 },
    );
    expect(v.signals.noCommentStreak.triggered).toBe(false);
  });
});

describe("detectStalledIssuePure — high churn loop", () => {
  it("triggers when many recent comments AND no recent status change", () => {
    const comments = Array.from({ length: 12 }, (_, i) => ({
      createdAt: hoursAgo(i * 0.1),
    }));
    const v = detectStalledIssuePure(
      {
        ...baseInput({ updatedAt: hoursAgo(48) }),
        comments,
      },
      {
        now: NOW,
        churnCommentsThreshold: 8,
        churnWindowHours: 4,
      },
    );
    expect(v.signals.highChurnLoop.triggered).toBe(true);
    expect(v.signals.highChurnLoop.commentCount).toBe(12);
    expect(v.recommendedEvent).toBe(activityEventTypes.issueHighChurnLoop);
  });

  it("does NOT trigger when status changed during the window", () => {
    const comments = Array.from({ length: 12 }, (_, i) => ({
      createdAt: hoursAgo(i * 0.1),
    }));
    const v = detectStalledIssuePure(
      {
        ...baseInput({ updatedAt: hoursAgo(0.5) }),
        comments,
      },
      {
        now: NOW,
        churnCommentsThreshold: 8,
        churnWindowHours: 4,
      },
    );
    expect(v.signals.highChurnLoop.triggered).toBe(false);
  });

  it("does NOT trigger when comments fall below threshold", () => {
    const comments = Array.from({ length: 3 }, (_, i) => ({
      createdAt: hoursAgo(i * 0.1),
    }));
    const v = detectStalledIssuePure(
      {
        ...baseInput({ updatedAt: hoursAgo(48) }),
        comments,
      },
      {
        now: NOW,
        churnCommentsThreshold: 8,
        churnWindowHours: 4,
      },
    );
    expect(v.signals.highChurnLoop.triggered).toBe(false);
  });
});

describe("detectStalledIssuePure — run stalled", () => {
  it("triggers when an active run has no recent event", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        run: {
          id: "run-1",
          agentId: "agent-1",
          startedAt: hoursAgo(2),
          updatedAt: hoursAgo(2),
          finishedAt: null,
          status: "running",
        },
      },
      { now: NOW, runStalledMs: 15 * 60 * 1000 },
    );
    expect(v.signals.runStalled.triggered).toBe(true);
    expect(v.signals.runStalled.runId).toBe("run-1");
    expect(v.recommendedEvent).toBe(activityEventTypes.runStalled);
  });

  it("does NOT trigger when run is finished", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        run: {
          id: "run-1",
          agentId: "agent-1",
          startedAt: hoursAgo(2),
          updatedAt: hoursAgo(2),
          finishedAt: hoursAgo(1),
          status: "completed",
        },
      },
      { now: NOW },
    );
    expect(v.signals.runStalled.triggered).toBe(false);
  });

  it("does NOT trigger when run was recently active", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        run: {
          id: "run-1",
          agentId: "agent-1",
          startedAt: hoursAgo(2),
          updatedAt: new Date(NOW.getTime() - 2 * 60 * 1000), // 2 min ago
          finishedAt: null,
          status: "running",
        },
      },
      { now: NOW, runStalledMs: 15 * 60 * 1000 },
    );
    expect(v.signals.runStalled.triggered).toBe(false);
  });

  it("does NOT trigger when run status is terminal even if last event is old", () => {
    const v = detectStalledIssuePure(
      {
        ...baseInput(),
        run: {
          id: "run-1",
          agentId: "agent-1",
          startedAt: hoursAgo(2),
          updatedAt: hoursAgo(2),
          finishedAt: null,
          status: "cancelled",
        },
      },
      { now: NOW, runStalledMs: 15 * 60 * 1000 },
    );
    expect(v.signals.runStalled.triggered).toBe(false);
  });
});

describe("detectStalledIssuePure — recommendedEvent priority", () => {
  it("prefers runStalled over churn", () => {
    const comments = Array.from({ length: 12 }, (_, i) => ({
      createdAt: hoursAgo(i * 0.1),
    }));
    const v = detectStalledIssuePure(
      {
        ...baseInput({ updatedAt: hoursAgo(48) }),
        comments,
        run: {
          id: "run-1",
          agentId: "agent-1",
          startedAt: hoursAgo(2),
          updatedAt: hoursAgo(2),
          finishedAt: null,
          status: "running",
        },
      },
      { now: NOW },
    );
    expect(v.signals.runStalled.triggered).toBe(true);
    expect(v.signals.highChurnLoop.triggered).toBe(true);
    expect(v.recommendedEvent).toBe(activityEventTypes.runStalled);
  });

  it("prefers churn over no-comment streak", () => {
    const comments = Array.from({ length: 12 }, (_, i) => ({
      createdAt: hoursAgo(i * 0.1),
    }));
    const v = detectStalledIssuePure(
      {
        ...baseInput({ startedAt: hoursAgo(72), updatedAt: hoursAgo(72) }),
        comments,
      },
      { now: NOW },
    );
    expect(v.signals.highChurnLoop.triggered).toBe(true);
    expect(v.recommendedEvent).toBe(activityEventTypes.issueHighChurnLoop);
  });
});

describe("activityEventTypes", () => {
  it("uses dot.case names", () => {
    expect(activityEventTypes.runStalled).toBe("run.stalled");
    expect(activityEventTypes.issueNoCommentStreak).toBe("issue.no_comment_streak");
    expect(activityEventTypes.issueHighChurnLoop).toBe("issue.high_churn_loop");
  });

  it("default thresholds are sensible", () => {
    expect(PRODUCTIVITY_REVIEW_DEFAULTS.noCommentStreakHours).toBeGreaterThanOrEqual(1);
    expect(PRODUCTIVITY_REVIEW_DEFAULTS.churnCommentsThreshold).toBeGreaterThanOrEqual(2);
    expect(PRODUCTIVITY_REVIEW_DEFAULTS.runStalledMs).toBeGreaterThan(60_000);
  });
});
