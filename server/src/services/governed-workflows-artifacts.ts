// server/src/services/governed-workflows-artifacts.ts

import type { GitProvider } from "@mnm/git-provider";
import type { ArtifactInput, ArtifactPersisted, OutputPersisted } from "@mnm/shared";

export interface CommitHandoffArtifactsArgs {
  gitProvider: GitProvider;
  runId: string;
  stepId: string;
  input: ArtifactInput;
  author: { name: string; email: string };
  /** Source branch when creating mnm-runs/<runId>. Caller must resolve the workflow repo's default branch. */
  startBranch: string;
}

const RUN_BRANCH_PREFIX = "mnm-runs";
const ARTIFACTS_PATH_PREFIX = "artifacts/runs";

export function runBranchName(runId: string): string {
  return `${RUN_BRANCH_PREFIX}/${runId}`;
}

export function stepArtifactsPath(runId: string, stepId: string): string {
  return `${ARTIFACTS_PATH_PREFIX}/${runId}/${stepId}`;
}

/**
 * Transforme un ArtifactInput (avec outputs[].content inline) en
 * ArtifactPersisted (avec git_sha references) en commitant tous les
 * fichiers dans la branche mnm-runs/<run_id> du repo workflow.
 *
 * Idempotent : si les outputs sont déjà sous forme git_file/git_folder
 * (resume après crash partiel), retourne tel quel sans commit.
 */
export async function commitHandoffArtifacts(
  args: CommitHandoffArtifactsArgs,
): Promise<ArtifactPersisted> {
  const { gitProvider, runId, stepId, input, author, startBranch } = args;

  // Idempotence: if no input output is of kind "file" or "folder", skip commit.
  const hasInlineContent = input.outputs.some(
    (o) => o.kind === "file" || o.kind === "folder",
  );
  if (!hasInlineContent) {
    return input as ArtifactPersisted;
  }

  const branch = runBranchName(runId);
  const stepPath = stepArtifactsPath(runId, stepId);

  // Build the action list and prepare the persisted outputs (git_sha filled after commit).
  const actions: Array<{ path: string; content: string }> = [];
  const pendingOutputs: OutputPersisted[] = [];

  for (const output of input.outputs) {
    if (output.kind === "file") {
      const filePath = `${stepPath}/${output.filename}`;
      actions.push({ path: filePath, content: output.content });
      pendingOutputs.push({
        name: output.name,
        kind: "git_file",
        path: filePath,
        git_sha: "__pending__", // git_sha is a placeholder; will be patched after commit
        branch,
        bytes: output.content.length,
      } as OutputPersisted);
    } else if (output.kind === "folder") {
      const folderPath = `${stepPath}/${output.name}/`;
      const filenames: string[] = [];
      for (const [filename, content] of Object.entries(output.files)) {
        actions.push({ path: `${folderPath}${filename}`, content });
        filenames.push(filename);
      }
      pendingOutputs.push({
        name: output.name,
        kind: "git_folder",
        path: folderPath,
        git_sha: "__pending__", // git_sha is a placeholder; will be patched after commit
        branch,
        files: filenames,
      } as OutputPersisted);
    } else {
      // external_url passes through unchanged
      pendingOutputs.push(output as OutputPersisted);
    }
  }

  if (actions.length === 0) {
    // Only external_url outputs — no commit needed
    return {
      outputs: pendingOutputs,
      data: input.data,
    };
  }

  const result = await gitProvider.commitMultipleFiles({
    branch,
    startBranch,
    commitMessage: `step ${stepId}: handoff outputs`,
    authorName: author.name,
    authorEmail: author.email,
    actions,
  });

  // All outputs of this step share the same commit sha
  const finalOutputs = pendingOutputs.map((p) => {
    if (p.kind === "git_file" || p.kind === "git_folder") {
      return { ...p, git_sha: result.sha };
    }
    return p;
  });

  return {
    outputs: finalOutputs,
    data: input.data,
  };
}
