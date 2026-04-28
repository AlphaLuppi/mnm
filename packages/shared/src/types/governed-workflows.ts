// packages/shared/src/types/governed-workflows.ts

/**
 * Artifact envoyé par l'orchestrateur via complete_governed_step.
 * Le serveur transforme outputs[].kind: file|folder en git_file|git_folder
 * après commit dans la branche mnm-runs/<run_id>.
 */
export interface ArtifactInput {
  outputs: OutputInput[];
  data: Record<string, unknown>;
}

export type OutputInput =
  | { name: string; kind: "file"; filename: string; content: string }
  | { name: string; kind: "folder"; files: Record<string, string> }
  | { name: string; kind: "external_url"; url: string };

/**
 * Artifact tel que persisté en governed_step_executions.artifacts_json
 * après transformation côté serveur. C'est aussi la forme vue par les gates
 * via ctx.artifact et par les steps suivants via {{steps.X.artifact}}.
 */
export interface ArtifactPersisted {
  outputs: OutputPersisted[];
  data: Record<string, unknown>;
}

export type OutputPersisted =
  | {
      name: string;
      kind: "git_file";
      path: string;
      git_sha: string;
      branch: string;
      bytes: number;
    }
  | {
      name: string;
      kind: "git_folder";
      path: string;
      git_sha: string;
      branch: string;
      files: string[];
    }
  | { name: string; kind: "external_url"; url: string };

/**
 * Bloc retourné par launch_governed_step / resume_governed_workflow_run
 * pour que l'orchestrateur clone shallow dans .mnm/handoffs/<name>.
 */
export interface Handoff {
  name: string;
  kind: "git_file" | "git_folder" | "external_url";
  // For git_file/git_folder:
  git_sha?: string;
  path?: string;
  branch?: string;
  destination?: string;
  // For external_url:
  url?: string;
}
