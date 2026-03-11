export interface WorkspaceTask {
  label: string;
  done: boolean;
}

export interface AcceptanceCriterion {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string[];
}

/* ── Generic infinite-depth tree ── */

/** Structured detail present on story leaf nodes */
export interface ContextNodeDetail {
  acceptanceCriteria: AcceptanceCriterion[];
  tasks: WorkspaceTask[];
  taskProgress: { done: number; total: number };
  /** Story-specific numbering (for display) */
  epicNumber?: number;
  storyNumber?: number;
}

/**
 * A node in the workspace context tree.
 * Internal nodes have children; leaf nodes have a `path` (and optionally `detail`).
 * The tree can be nested arbitrarily deep.
 */
export interface ContextNode {
  /** Unique id within the tree (e.g. "1", "1-2", "1-2/stories/login.md") */
  id: string;
  title: string;
  /** Present on leaf nodes that map to a markdown file */
  path?: string;
  status?: string | null;
  children: ContextNode[];
  progress: { done: number; total: number };
  /** Present on story leaves: structured AC + tasks parsed from the markdown */
  detail?: ContextNodeDetail;
}

/* ── Legacy types — kept for backward-compat aliases (BmadEpic, etc.) ── */

/** @deprecated use ContextNode */
export interface WorkspaceStory {
  id: string;
  epicNumber: number;
  storyNumber: number;
  title: string;
  status: string | null;
  filePath: string;
  acceptanceCriteria: AcceptanceCriterion[];
  tasks: WorkspaceTask[];
  taskProgress: { done: number; total: number };
}

/** @deprecated use ContextNode */
export interface WorkspaceEpic {
  number: number;
  title: string | null;
  status: string | null;
  stories: WorkspaceStory[];
  progress: { done: number; total: number };
}

/** @deprecated use ContextNode */
export interface WorkspaceStep {
  number: number;
  title: string | null;
  epics: WorkspaceEpic[];
  progress: { done: number; total: number };
}

export interface PlanningArtifact {
  title: string;
  type: string;
  filePath: string;
}

export interface SprintStatus {
  project: string | null;
  statuses: Record<string, string>;
}

export interface WorkspaceContext {
  detected: true;
  planningArtifacts: PlanningArtifact[];
  /** Generic infinite-depth hierarchy tree */
  tree: ContextNode[];
  sprintStatus: SprintStatus | null;
  /** @deprecated use tree */
  epics: WorkspaceEpic[];
  /** @deprecated use tree */
  steps: WorkspaceStep[];
}
