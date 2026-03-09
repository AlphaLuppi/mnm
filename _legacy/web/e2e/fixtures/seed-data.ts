/**
 * Seed data for E2E tests.
 * Used by db-helpers to populate the database before test runs.
 */

export const seedSpecs = [
  {
    filePath: "_bmad-output/planning-artifacts/prd.md",
    title: "Product Requirements Document",
    category: "planning",
    contentHash: "abc123",
  },
  {
    filePath: "_bmad-output/planning-artifacts/architecture.md",
    title: "Architecture Document",
    category: "planning",
    contentHash: "def456",
  },
  {
    filePath: "_bmad-output/stories/story-1.md",
    title: "Story 1: User Login",
    category: "story",
    contentHash: "ghi789",
  },
  {
    filePath: "_bmad-output/stories/story-2.md",
    title: "Story 2: Dashboard View",
    category: "story",
    contentHash: "jkl012",
  },
];

export const seedAgents = [
  {
    type: "developer",
    status: "running" as const,
    storyId: "story-1",
    startedAt: Date.now() - 300000,
  },
  {
    type: "reviewer",
    status: "completed" as const,
    storyId: "story-2",
    startedAt: Date.now() - 600000,
  },
];

export const seedDriftDetections = [
  {
    specPath: "_bmad-output/stories/story-1.md",
    codePath: "src/features/login.ts",
    severity: "high" as const,
    summary: "Login implementation diverges from spec",
    userDecision: "pending" as const,
    createdAt: Date.now() - 120000,
  },
];
