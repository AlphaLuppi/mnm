import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── agents ──────────────────────────────────────────────────
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  specId: text("spec_id"),
  scope: text("scope"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── specs ───────────────────────────────────────────────────
export const specs = sqliteTable("specs", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull().unique(),
  specType: text("spec_type").notNull(),
  title: text("title"),
  lastModified: integer("last_modified").notNull(),
  gitCommitSha: text("git_commit_sha"),
  contentHash: text("content_hash").notNull(),
  workflowStage: text("workflow_stage"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── drift_detections ────────────────────────────────────────
export const driftDetections = sqliteTable("drift_detections", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  specId: text("spec_id").notNull(),
  severity: text("severity").notNull(),
  driftType: text("drift_type").notNull(),
  summary: text("summary").notNull(),
  recommendation: text("recommendation").notNull(),
  diffContent: text("diff_content"),
  userDecision: text("user_decision"),
  decidedAt: integer("decided_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── file_locks ──────────────────────────────────────────────
export const fileLocks = sqliteTable("file_locks", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull(),
  agentId: text("agent_id").notNull(),
  lockType: text("lock_type").notNull(),
  acquiredAt: integer("acquired_at").notNull(),
  releasedAt: integer("released_at"),
});

// ── important_files ─────────────────────────────────────────
export const importantFiles = sqliteTable("important_files", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull().unique(),
  fileType: text("file_type").notNull(),
  detectedAt: integer("detected_at").notNull(),
  userConfirmed: integer("user_confirmed").default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── commit_associations ────────────────────────────────────
export const commitAssociations = sqliteTable("commit_associations", {
  id: text("id").primaryKey(),
  commitSha: text("commit_sha").notNull(),
  specId: text("spec_id").notNull(),
  referenceType: text("reference_type").notNull(),
  commitMessage: text("commit_message").notNull(),
  commitAuthor: text("commit_author"),
  commitDate: text("commit_date"),
  createdAt: integer("created_at").notNull(),
});

// ── spec_changes ────────────────────────────────────────────
export const specChanges = sqliteTable("spec_changes", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull(),
  oldCommitSha: text("old_commit_sha"),
  newCommitSha: text("new_commit_sha").notNull(),
  changeSummary: text("change_summary").notNull(),
  detectedAt: integer("detected_at").notNull(),
  userViewed: integer("user_viewed").default(0),
  createdAt: integer("created_at").notNull(),
});

// ── workflows ──────────────────────────────────────────────
export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  phase: text("phase"),
  sourcePath: text("source_path").notNull(),
  stepsJson: text("steps_json"),
  metadata: text("metadata"),
  discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ── workflow_executions ────────────────────────────────────
export const workflowExecutions = sqliteTable("workflow_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id),
  status: text("status").notNull().default("pending"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ── discovery_results ──────────────────────────────────────
export const discoveryResults = sqliteTable("discovery_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  path: text("path").notNull(),
  classification: text("classification"),
  name: text("name"),
  metadata: text("metadata"),
  llmModel: text("llm_model"),
  discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
});

// ── cross_doc_drifts ───────────────────────────────────────
export const crossDocDrifts = sqliteTable("cross_doc_drifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceSpecId: text("source_spec_id").references(() => specs.id),
  targetSpecId: text("target_spec_id").references(() => specs.id),
  driftType: text("drift_type").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  sourceText: text("source_text"),
  targetText: text("target_text"),
  status: text("status").notNull().default("open"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  resolutionRationale: text("resolution_rationale"),
  detectedAt: integer("detected_at", { mode: "timestamp" }).notNull(),
});

// ── drift_scan_runs ───────────────────────────────────────
// Tracks manual drift scans for history and cold-start support
export const driftScanRuns = sqliteTable("drift_scan_runs", {
  id: text("id").primaryKey(),
  specId: text("spec_id").references(() => specs.id),
  scope: text("scope").notNull(), // JSON array of file paths
  triggerType: text("trigger_type").notNull(), // 'manual' | 'agent_complete' | 'discovery' | 'spec_save'
  status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'completed' | 'failed'
  driftDetectionId: text("drift_detection_id").references(() => driftDetections.id),
  errorMessage: text("error_message"),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
