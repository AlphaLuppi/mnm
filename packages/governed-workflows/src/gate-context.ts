/**
 * Runtime context passed to a gate function by the server-side runner
 * (isolated-vm). Read-only — gates MUST NOT mutate it.
 *
 * Generic parameters:
 *   - Artifact: shape of the step artifact. Undefined for entry gates.
 *   - Config: shape of the `config` object declared on the gate item in
 *     workflow.json (defaults to a plain record).
 */
export interface GateContext<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Artifact produced by completeStep. Undefined for entry gates. */
  artifact: Artifact | undefined;

  /** Metadata about the current workflow run. */
  run: {
    id: string;
    workflow_name: string;
    /** Git tag pinned at launchWorkflow time (immutable for the run). */
    git_tag: string;
    /** Variables provided when the run was initiated. */
    params: Record<string, unknown>;
  };

  /** Metadata about the current step. */
  step: {
    id: string;
    /** Artifacts produced by previously-completed steps, keyed by step id. */
    previous_artifacts: Record<string, unknown>;
  };

  /** Config object declared on the gate item in workflow.json. */
  config: Config;

  /** Lifecycle kind of this evaluation: "entry" | "exit" | future extension. */
  kind: string;

  /**
   * Read-only helpers exposed by the server sandbox. Populated in T4
   * (queryTraces, checkWorkflowExists, ...). Declared as an open record so
   * later tranches can extend without breaking gate authors in T1.
   */
  helpers: Record<string, unknown>;
}
