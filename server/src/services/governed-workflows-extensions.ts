/**
 * Service helpers for the Governed Workflows UI REST layer (Tranche U2).
 *
 * Deliberately separate from governed-workflows.ts so the MCP service file
 * stays focused on MCP tool semantics. governed-workflows.ts re-exports the
 * helpers it needs from here.
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  gateResults,
  type Db,
} from "@mnm/db";

// ── U2.2: computeNextTag ────────────────────────────────────────────────────

/**
 * Given the current list of git tag names and a workflow name, compute the
 * next semantic-version tag in the format `<name>/vMAJOR.MINOR.PATCH`.
 *
 * Only tags matching the prefix `<name>/v` are considered. Among those, the
 * highest semver wins (major, then minor, then patch). If no tag exists for
 * the workflow yet, returns `<name>/v1.0.0`.
 */
export function computeNextTag(workflowName: string, allTagNames: string[]): string {
  const prefix = `${workflowName}/v`;
  const matching = allTagNames.filter((t) => t.startsWith(prefix));

  if (matching.length === 0) {
    return `${prefix}1.0.0`;
  }

  let bestMajor = 0;
  let bestMinor = 0;
  let bestPatch = 0;

  for (const tag of matching) {
    const versionPart = tag.slice(prefix.length);
    const parts = versionPart.split(".");
    if (parts.length !== 3) continue;
    const major = parseInt(parts[0]!, 10);
    const minor = parseInt(parts[1]!, 10);
    const patch = parseInt(parts[2]!, 10);
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) continue;

    if (
      major > bestMajor ||
      (major === bestMajor && minor > bestMinor) ||
      (major === bestMajor && minor === bestMinor && patch > bestPatch)
    ) {
      bestMajor = major;
      bestMinor = minor;
      bestPatch = patch;
    }
  }

  return `${prefix}${bestMajor}.${bestMinor}.${bestPatch + 1}`;
}

// ── U2.3: saveDefinition ────────────────────────────────────────────────────

export interface SaveDefinitionArgs {
  companyId: string;
  name: string;
  description: string | null;
  /** Stringified JSON content to commit as `<name>/workflow.json`. */
  definitionContent: string;
  commitMessage: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  resolveGitProvider: (companyId: string) => Promise<import("@mnm/git-provider").GitProvider>;
}

export interface SaveDefinitionResult {
  /** Git sha of the commit that saved the file. */
  commitSha: string;
  /** New semver tag pushed, e.g. `hello-world/v1.2.0`. */
  newGitTag: string;
  /** Whether the definition row was newly inserted (true) or updated (false). */
  created: boolean;
}

/**
 * Commit `<name>/workflow.json` to the workflows git repo, compute the next
 * semver tag, push the tag, and upsert the `governed_workflow_definitions`
 * row with the new `latest_git_tag`.
 *
 * Note: the DB row has NO `definition_json` column — the canonical source of
 * truth is git. The row only stores discovery metadata (name, description,
 * latestGitTag, enabled, archivedAt).
 */
export async function saveDefinition(
  db: Db,
  args: SaveDefinitionArgs,
): Promise<SaveDefinitionResult> {
  const gitProvider = await args.resolveGitProvider(args.companyId);

  // List existing tags for this workflow to compute the next version.
  const allTags = await gitProvider.listTags({ prefix: `${args.name}/v` });
  const allTagNames = allTags.map((t) => t.name);
  const newGitTag = computeNextTag(args.name, allTagNames);

  // Commit the workflow.json file.
  const commitResult = await gitProvider.commitFile({
    path: `${args.name}/workflow.json`,
    content: args.definitionContent,
    message: args.commitMessage,
    branch: args.branch,
    authorName: args.authorName,
    authorEmail: args.authorEmail,
  });

  // Push the semver tag pointing at the commit sha.
  await gitProvider.createTag({
    name: newGitTag,
    ref: commitResult.sha,
    message: args.commitMessage,
  });

  // Upsert the DB row.
  const existing = await db
    .select({ id: governedWorkflowDefinitions.id })
    .from(governedWorkflowDefinitions)
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.name),
      ),
    );

  const created = existing.length === 0;

  if (created) {
    await db.insert(governedWorkflowDefinitions).values({
      companyId: args.companyId,
      name: args.name,
      description: args.description,
      latestGitTag: newGitTag,
      enabled: true,
    });
  } else {
    await db
      .update(governedWorkflowDefinitions)
      .set({
        description: args.description,
        latestGitTag: newGitTag,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, args.companyId),
          eq(governedWorkflowDefinitions.name, args.name),
        ),
      );
  }

  return { commitSha: commitResult.sha, newGitTag, created };
}

// ── U2.5: archiveDefinition ─────────────────────────────────────────────────

/**
 * Soft-delete a workflow definition by setting `archived_at`. Returns true
 * if the row existed and was archived, false if not found (or already
 * archived).
 */
export async function archiveDefinition(
  db: Db,
  args: { companyId: string; name: string },
): Promise<boolean> {
  const [row] = await db
    .select({ id: governedWorkflowDefinitions.id, archivedAt: governedWorkflowDefinitions.archivedAt })
    .from(governedWorkflowDefinitions)
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.name),
      ),
    );

  if (!row || row.archivedAt !== null) return false;

  await db
    .update(governedWorkflowDefinitions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(governedWorkflowDefinitions.id, row.id));

  return true;
}

// ── U2.5: listRuns ──────────────────────────────────────────────────────────

export interface ListRunsArgs {
  companyId: string;
  workflowName: string;
  status?: string;
  initiatedByActorId?: string;
  startedAfter?: string;
  startedBefore?: string;
  limit?: number;
  offset?: number;
}

export interface ListRunsResult {
  items: typeof governedWorkflowRuns.$inferSelect[];
  total: number;
}

/**
 * Paginated list of runs for a workflow. Filters by status, actor, and date
 * range. Total count is returned alongside the page items for pagination UIs.
 */
export async function listRuns(db: Db, args: ListRunsArgs): Promise<ListRunsResult> {
  // Resolve the definition id for the given name.
  const [def] = await db
    .select({ id: governedWorkflowDefinitions.id })
    .from(governedWorkflowDefinitions)
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.workflowName),
      ),
    );

  if (!def) return { items: [], total: 0 };

  const limit = args.limit ?? 20;
  const offset = args.offset ?? 0;

  const conds = [
    eq(governedWorkflowRuns.companyId, args.companyId),
    eq(governedWorkflowRuns.workflowDefId, def.id),
  ];

  if (args.status) {
    conds.push(
      eq(
        governedWorkflowRuns.status,
        args.status as typeof governedWorkflowRuns.$inferSelect["status"],
      ),
    );
  }
  if (args.initiatedByActorId) {
    conds.push(eq(governedWorkflowRuns.initiatedByActorId, args.initiatedByActorId));
  }
  if (args.startedAfter) {
    conds.push(gte(governedWorkflowRuns.startedAt, new Date(args.startedAfter)));
  }
  if (args.startedBefore) {
    conds.push(lte(governedWorkflowRuns.startedAt, new Date(args.startedBefore)));
  }

  const [countRow, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(governedWorkflowRuns)
      .where(and(...conds)),
    db
      .select()
      .from(governedWorkflowRuns)
      .where(and(...conds))
      .orderBy(desc(governedWorkflowRuns.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return { items, total: Number(countRow[0]?.count ?? 0) };
}

// ── U2.5: getRunWithSteps ────────────────────────────────────────────────────

type StepExecRow = typeof governedStepExecutions.$inferSelect;
type GateResultRow = typeof gateResults.$inferSelect;
type RunRow = typeof governedWorkflowRuns.$inferSelect;

export type StepWithGates = StepExecRow & {
  gateResults: GateResultRow[];
};

export interface RunWithSteps {
  run: RunRow;
  steps: StepWithGates[];
}

/**
 * Fetch a single run with all its step executions and gate results.
 * Returns null if the run is not found for the given companyId.
 */
export async function getRunWithSteps(
  db: Db,
  args: { companyId: string; runId: string },
): Promise<RunWithSteps | null> {
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    );

  if (!run) return null;

  const steps = await db
    .select()
    .from(governedStepExecutions)
    .where(eq(governedStepExecutions.runId, args.runId))
    .orderBy(governedStepExecutions.createdAt);

  const gates = await db
    .select()
    .from(gateResults)
    .where(eq(gateResults.runId, args.runId))
    .orderBy(gateResults.evaluatedAt);

  const stepsWithGates: StepWithGates[] = steps.map((step) => ({
    ...step,
    gateResults: gates.filter((g) => g.stepExecId === step.id),
  }));

  return { run, steps: stepsWithGates };
}

// ── Thin wrappers for routes (upsertDefinition / setEnabled) ─────────────────

/**
 * Upsert a workflow definition from a parsed WorkflowDefinition object.
 * Serialises to JSON then delegates to saveDefinition.
 */
export async function upsertDefinition(
  db: Db,
  args: Omit<SaveDefinitionArgs, "definitionContent"> & {
    definition: Record<string, unknown>;
  },
): Promise<SaveDefinitionResult> {
  return saveDefinition(db, {
    ...args,
    definitionContent: JSON.stringify(args.definition, null, 2),
  });
}

/**
 * Enable or disable a workflow definition row.
 * Returns false if the row doesn't exist.
 */
export async function setEnabled(
  db: Db,
  args: { companyId: string; name: string; enabled: boolean },
): Promise<boolean> {
  const [row] = await db
    .select({ id: governedWorkflowDefinitions.id })
    .from(governedWorkflowDefinitions)
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.name),
      ),
    );

  if (!row) return false;

  await db
    .update(governedWorkflowDefinitions)
    .set({ enabled: args.enabled, updatedAt: new Date() })
    .where(eq(governedWorkflowDefinitions.id, row.id));

  return true;
}
