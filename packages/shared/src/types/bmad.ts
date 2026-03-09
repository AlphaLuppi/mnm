export interface BmadTask {
  label: string;
  done: boolean;
}

export interface BmadAcceptanceCriterion {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string[];
}

export interface BmadStory {
  id: string;
  epicNumber: number;
  storyNumber: number;
  title: string;
  status: string | null;
  filePath: string;
  acceptanceCriteria: BmadAcceptanceCriterion[];
  tasks: BmadTask[];
  taskProgress: { done: number; total: number };
}

export interface BmadEpic {
  number: number;
  title: string | null;
  status: string | null;
  stories: BmadStory[];
  progress: { done: number; total: number };
}

export interface BmadPlanningArtifact {
  title: string;
  type: string;
  filePath: string;
}

export interface BmadSprintStatus {
  project: string | null;
  statuses: Record<string, string>;
}

export interface BmadProject {
  detected: true;
  planningArtifacts: BmadPlanningArtifact[];
  epics: BmadEpic[];
  sprintStatus: BmadSprintStatus | null;
}
