import { and, eq } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  type Db,
} from "@mnm/db";

const PROVIDER_ID = "mnm-workflows";
import {
  workflowDefinitionSchema,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
} from "@mnm/governed-workflows";
import type { GitProvider, ShaCache } from "@mnm/git-provider";

/**
 * Domain error raised by the governed workflow service. Mapped to the MCP
 * uniform error contract by the tool layer. `code` is always a member of
 * `WORKFLOW_ERROR_CODES`.
 */
export class GovernedWorkflowError extends Error {
  constructor(
    public readonly code: (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES],
    message: string,
    public readonly hints: string[] = [],
  ) {
    super(message);
    this.name = "GovernedWorkflowError";
  }
}

export interface GovernedWorkflowServiceDeps {
  gitProvider: GitProvider;
  shaCache: ShaCache;
}

export interface GetWorkflowParsedResult {
  workflow: WorkflowDefinition;
  gitTag: string;
  gitSha: string;
  /** Repo-relative path to the workflow.json in the workflows repo. */
  workflowRepoPath: string;
}

/**
 * Domain service for Governed Workflows. All reads are RLS-scoped — the
 * caller must have set `app.current_company_id` via `setTenantContext`
 * before invoking. Writes take `companyId` explicitly and include it in
 * INSERT / WHERE clauses for defense-in-depth.
 */
export function governedWorkflowService(db: Db, deps: GovernedWorkflowServiceDeps) {
  const { gitProvider, shaCache } = deps;

  // ─── Discovery ──────────────────────────────────────────────────

  async function listDefinitions(args: { companyId: string; enabled?: boolean }) {
    const conds = [eq(governedWorkflowDefinitions.companyId, args.companyId)];
    if (args.enabled !== undefined) {
      conds.push(eq(governedWorkflowDefinitions.enabled, args.enabled));
    }
    return db
      .select()
      .from(governedWorkflowDefinitions)
      .where(and(...conds))
      .orderBy(governedWorkflowDefinitions.name);
  }

  async function getDefinition(args: { companyId: string; name: string }) {
    const [row] = await db
      .select()
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, args.companyId),
          eq(governedWorkflowDefinitions.name, args.name),
        ),
      );
    return row ?? null;
  }

  /**
   * Fetch + parse a workflow at a specific tag (or the definition's
   * `latest_git_tag` if unspecified). Validates against the zod schema in
   * `@mnm/governed-workflows`. Caches by (sha, path).
   *
   * Path convention: the MVP assumes each workflow lives under `<name>/`
   * in its repo, with its entry point at `<name>/workflow.json` — see
   * spec §3 "Repo structure". Until we have explicit config, we derive
   * the path from `definition.name`.
   */
  async function getWorkflowParsed(args: {
    companyId: string;
    name: string;
    gitTag?: string;
  }): Promise<GetWorkflowParsedResult> {
    const def = await getDefinition({ companyId: args.companyId, name: args.name });
    if (!def) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `No governed workflow named '${args.name}'`,
        [`Call list_governed_workflows to see available workflows`],
      );
    }

    const ref = args.gitTag ?? def.latestGitTag;
    if (!ref) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}' has no latest_git_tag and no git_tag supplied`,
        [`Pass git_tag explicitly or set the definition's latest_git_tag`],
      );
    }

    const gitSha = await gitProvider.resolveRef({ ref });
    const workflowRepoPath = `${args.name}/workflow.json`;

    // ShaCache exposes get/set rather than getOrFetch — use them directly.
    const cached = shaCache.get(PROVIDER_ID, workflowRepoPath, gitSha);
    const rawJson = cached !== undefined
      ? cached
      : await (async () => {
          const blob = await gitProvider.fetchBlob({ path: workflowRepoPath, ref: gitSha });
          shaCache.set(PROVIDER_ID, workflowRepoPath, gitSha, blob);
          return blob;
        })();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} has invalid JSON: ${(err as Error).message}`,
      );
    }

    const result = workflowDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} failed schema validation: ${result.error.message}`,
      );
    }

    return {
      workflow: result.data,
      gitTag: ref,
      gitSha,
      workflowRepoPath,
    };
  }

  // Further methods land in Task 5/6/7/8/9 (launchWorkflow, getRun,
  // launchStep, completeStep, syncEnvironment).

  return {
    listDefinitions,
    getDefinition,
    getWorkflowParsed,
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
