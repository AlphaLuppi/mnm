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

export interface WorkspaceEpic {
  number: number;
  title: string | null;
  status: string | null;
  stories: WorkspaceStory[];
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
  epics: WorkspaceEpic[];
  sprintStatus: SprintStatus | null;
}
