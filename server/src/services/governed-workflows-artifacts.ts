// server/src/services/governed-workflows-artifacts.ts

import { eq } from "drizzle-orm";
import type { GitProvider } from "@mnm/git-provider";
import type { ArtifactInput, ArtifactPersisted, Handoff, OutputPersisted } from "@mnm/shared";
import { authUsers, type Db } from "@mnm/db";

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

export interface ResolveCommitAuthorArgs {
  db: Db;
  companyId: string; // reserved for future per-tenant fallback config
  actor: { type: string; id: string };
}

/**
 * Resolves the commit author for handoff artifacts.
 * - User actor → look up the OAuth user's name/email
 * - Otherwise → fall back to a service account from env, default "MnM bot"
 *   <mnm-bot@mnm.local>.
 */
export async function resolveCommitAuthor(
  args: ResolveCommitAuthorArgs,
): Promise<{ name: string; email: string }> {
  if (args.actor.type === "user") {
    const [user] = await args.db
      .select({ email: authUsers.email, name: authUsers.name })
      .from(authUsers)
      .where(eq(authUsers.id, args.actor.id));
    if (user) {
      return { name: user.name, email: user.email };
    }
  }
  return {
    name: process.env.MNM_GIT_BOT_NAME ?? "MnM bot",
    email: process.env.MNM_GIT_BOT_EMAIL ?? "mnm-bot@mnm.local",
  };
}

interface PreviousStepRow {
  stepIdInJson: string;
  state: string;
  artifactsJson: ArtifactPersisted | null;
}

/**
 * Builds the handoffs[] array for a step launch from all previous step rows.
 * Only succeeded steps with non-null artifacts contribute. Each output is
 * projected to a Handoff — git_file/git_folder get a destination path under
 * .mnm/handoffs/, external_url passes through unchanged.
 */
export function buildHandoffsForStep(prevSteps: PreviousStepRow[]): Handoff[] {
  const handoffs: Handoff[] = [];
  for (const step of prevSteps) {
    if (step.state !== "succeeded" || !step.artifactsJson) continue;
    for (const output of step.artifactsJson.outputs) {
      if (output.kind === "git_file") {
        handoffs.push({
          name: output.name,
          kind: "git_file",
          git_sha: output.git_sha,
          path: output.path,
          branch: output.branch,
          destination: `.mnm/handoffs/${output.name}${getFileExtension(output.path)}`,
        });
      } else if (output.kind === "git_folder") {
        handoffs.push({
          name: output.name,
          kind: "git_folder",
          git_sha: output.git_sha,
          path: output.path,
          branch: output.branch,
          destination: `.mnm/handoffs/${output.name}/`,
        });
      } else if (output.kind === "external_url") {
        handoffs.push({
          name: output.name,
          kind: "external_url",
          url: output.url,
        });
      }
    }
  }
  return handoffs;
}

function getFileExtension(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i) : "";
}

export interface MergeRunBranchArgs {
  gitProvider: GitProvider;
  runId: string;
  workflowName: string;
  ticket: string | null;
  status: "completed" | "cancelled";
  stepsSummary: Array<{ stepId: string; state: string }>;
  startedAt: Date | null;
  completedAt: Date;
  triggeredBy: string;
  author: { name: string; email: string };
}

/**
 * Finalises a run's branch:
 * 1. Commits `_run.json` summarizing the run on `mnm-runs/<runId>`.
 * 2. Merges `mnm-runs/<runId>` into master with --no-ff.
 * 3. Deletes `mnm-runs/<runId>`.
 *
 * Caller is responsible for ensuring this runs OUTSIDE the DB transaction
 * (Git operations may take seconds; we don't want to hold an XACT lock).
 */
export async function mergeRunBranch(args: MergeRunBranchArgs): Promise<void> {
  const branch = runBranchName(args.runId);

  // Step 1: commit _run.json summarising the run
  const runJson = JSON.stringify(
    {
      run_id: args.runId,
      workflow_name: args.workflowName,
      ticket: args.ticket,
      status: args.status,
      steps: args.stepsSummary,
      started_at: args.startedAt?.toISOString() ?? null,
      completed_at: args.completedAt.toISOString(),
      triggered_by: args.triggeredBy,
    },
    null,
    2,
  );

  await args.gitProvider.commitMultipleFiles({
    branch,
    startBranch: "master",
    commitMessage: `run ${args.runId}: finalize (${args.status})`,
    authorName: args.author.name,
    authorEmail: args.author.email,
    actions: [{ path: `artifacts/runs/${args.runId}/_run.json`, content: runJson }],
  });

  // Step 2: merge --no-ff into master
  const stepsLine = args.stepsSummary
    .map((s) => `${s.stepId} ${s.state === "succeeded" ? "✓" : "✗"}`)
    .join(", ");
  const mergeMessage = `Run ${args.runId}: ${args.workflowName}${args.ticket ? ` (${args.ticket})` : ""} — ${args.status}\n\nSteps: ${stepsLine}\nTriggered by: ${args.triggeredBy}`;

  await args.gitProvider.mergeBranch({
    sourceBranch: branch,
    targetBranch: "master",
    commitMessage: mergeMessage,
    noFf: true,
    authorName: args.author.name,
    authorEmail: args.author.email,
  });

  // Step 3: delete the run branch (idempotent)
  await args.gitProvider.deleteBranch({ branch });
}
