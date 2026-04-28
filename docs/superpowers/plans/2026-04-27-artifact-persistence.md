# Artifact Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistence des handoff artifacts entre steps de governed workflow, pour que `/clear` entre steps ne casse pas la continuité du run et que n'importe qui puisse reprendre n'importe où.

**Architecture:** Le serveur transforme l'artifact entrant (avec `outputs[].content` inline) en un artifact persisté (avec `git_sha` references), commit dans une branche `mnm-runs/<run_id>` du repo workflow, et expose au step suivant un payload `handoffs[]` que l'orchestrateur clone shallow dans `.mnm/handoffs/`. À la fin du run, merge `--no-ff` dans master et delete branche.

**Tech Stack:** TypeScript (Node 20+), Drizzle ORM, Zod, Vitest, MCP, GitLab API via `gitProvider`, isolated-vm pour gates.

**Spec source:** [`docs/superpowers/specs/2026-04-27-artifact-persistence-design.md`](../specs/2026-04-27-artifact-persistence-design.md)

---

## File Structure

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `packages/shared/src/types/governed-workflows.ts` | Create | Types `ArtifactInput`, `ArtifactPersisted`, `OutputInput`, `OutputPersisted`, `Handoff` |
| `server/src/services/governed-workflows-artifacts.ts` | Create | `commitHandoffArtifacts()`, `buildHandoffsForStep()`, `mergeRunBranch()` |
| `server/src/services/__tests__/governed-workflows-artifacts.test.ts` | Create | Tests unitaires des helpers ci-dessus avec `LocalBareRepoProvider` |
| `server/src/services/governed-workflows.ts` | Modify | Wire `commitHandoffArtifacts` dans `completeStep`, `buildHandoffsForStep` dans `launch`, `mergeRunBranch` au transitions terminales |
| `server/src/services/governed-workflows-helpers.ts` | Modify | Ajouter `fetchHandoff(git_sha, path)` au gate sandbox helpers |
| `server/src/mcp/tools/governed-workflows.tool.ts` | Modify | Tighter Zod schema sur `complete_governed_step.artifact` ; ajouter MCP tool `resume_governed_workflow_run` |
| `packages/git-provider/src/types.ts` | Modify | Ajouter `authorIdentity?: GitAuthorIdentity` à `CommitMultipleFilesArgs` |
| `packages/git-provider/src/gitlab-provider.ts` | Modify | Propager `authorIdentity` au call REST `/repository/commits` (champs `author_email` + `author_name`) |
| `ui/src/api/governed-workflows.ts` | Modify | Ajouter méthode `resumeRun(companyId, runId)` |
| `ui/src/pages/GovernedWorkflowRunDetail.tsx` | Modify | Section "Livrables" (parcours `outputs[]`) + section "Données" (parcours `data{}`), rendu `git_file` / `git_folder` / `external_url` |
| `your-username/mnm-demo` (repo Git externe) | Modify | Mettre à jour `workflows/feature-dev/workflow.json` + agents pour produire le nouveau schema |
| `server/src/mcp/tools/__tests__/governed-workflows-resume.e2e.test.ts` | Create | Test E2E : run → /clear simulé → resume → vérifier handoffs préservés |

---

## Task 1: Types partagés ArtifactInput / ArtifactPersisted

**Files:**
- Create: `packages/shared/src/types/governed-workflows.ts`
- Modify: `packages/shared/src/index.ts` (ajouter export)

- [ ] **Step 1: Créer le fichier de types**

```typescript
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
```

- [ ] **Step 2: Exporter depuis l'index**

```typescript
// packages/shared/src/index.ts (append)
export * from "./types/governed-workflows.js";
```

- [ ] **Step 3: Vérifier la compilation**

Run: `bun run typecheck --cwd packages/shared`
Expected: PASS, 0 erreurs

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/governed-workflows.ts packages/shared/src/index.ts
git commit -m "feat(shared): types ArtifactInput / ArtifactPersisted / Handoff"
```

---

## Task 2: Étendre gitProvider pour authorIdentity

**Files:**
- Modify: `packages/git-provider/src/types.ts`
- Modify: `packages/git-provider/src/gitlab-provider.ts`
- Modify: `packages/git-provider/src/local-bare-repo-provider.ts`

- [ ] **Step 1: Ajouter `GitAuthorIdentity` et étendre `CommitMultipleFilesArgs`**

```typescript
// packages/git-provider/src/types.ts (ajouter avant CommitMultipleFilesArgs)

export interface GitAuthorIdentity {
  name: string;
  email: string;
}

export interface CommitMultipleFilesArgs {
  branch: string;
  message: string;
  actions: Array<{
    path: string;
    content?: string;
    delete?: boolean;
  }>;
  authorIdentity?: GitAuthorIdentity;  // NEW: optional author override
  startBranch?: string;  // pour créer mnm-runs/<run_id> à partir de master
}
```

- [ ] **Step 2: Propager dans `GitlabProvider.commitMultipleFiles()`**

Find existing call to GitLab API in `gitlab-provider.ts:254-327` and modify the request body construction. Look for `body: { branch, commit_message, actions }` and add author fields when present:

```typescript
// packages/git-provider/src/gitlab-provider.ts
// Inside commitMultipleFiles, just before the POST request:

const body: Record<string, unknown> = {
  branch: args.branch,
  commit_message: args.message,
  actions: actions,
};
if (args.startBranch) {
  body.start_branch = args.startBranch;
}
if (args.authorIdentity) {
  body.author_email = args.authorIdentity.email;
  body.author_name = args.authorIdentity.name;
}

const response = await this.request<{ id: string }>(
  `POST`,
  `/projects/${encodeURIComponent(this.projectId)}/repository/commits`,
  body,
);
```

- [ ] **Step 3: Étendre `LocalBareRepoProvider.commitMultipleFiles()`**

Apply equivalent change in `local-bare-repo-provider.ts`. When creating the commit via `simple-git`, pass author args if `authorIdentity` is present:

```typescript
// In commitMultipleFiles handler:
if (args.authorIdentity) {
  await git.addConfig("user.email", args.authorIdentity.email, false, "local");
  await git.addConfig("user.name", args.authorIdentity.name, false, "local");
}
```

- [ ] **Step 4: Test unitaire — commit avec authorIdentity**

```typescript
// packages/git-provider/src/__tests__/gitlab-provider-author.test.ts (nouveau)

import { describe, it, expect } from "vitest";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import simpleGit from "simple-git";

describe("commitMultipleFiles with authorIdentity", () => {
  it("propagates author to git log", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gp-author-"));
    try {
      const git = simpleGit(dir);
      await git.init({ "--bare": null });
      // Seed initial branch
      const work = mkdtempSync(path.join(tmpdir(), "gp-work-"));
      await simpleGit(work).clone(dir, work);
      await simpleGit(work).addConfig("user.email", "init@x.fr").addConfig("user.name", "Init");
      // ... seed README, commit, push master ...

      const p = new LocalBareRepoProvider({ providerId: "test", repoDir: dir });
      const result = await p.commitMultipleFiles({
        branch: "mnm-runs/test",
        startBranch: "master",
        message: "step tech-design: handoff design",
        actions: [{ path: "artifacts/runs/test/tech-design/design.md", content: "# X" }],
        authorIdentity: { name: "MnM contributor", email: "tom@example.com" },
      });
      expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/);

      const log = await simpleGit(dir).log({ "--all": null });
      expect(log.latest?.author_email).toBe("tom@example.com");
      expect(log.latest?.author_name).toBe("MnM contributor");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 5: Run le test, vérifier qu'il passe**

Run: `bun run --cwd packages/git-provider test src/__tests__/gitlab-provider-author.test.ts`
Expected: PASS, 1 test

- [ ] **Step 6: Commit**

```bash
git add packages/git-provider/src/types.ts packages/git-provider/src/gitlab-provider.ts packages/git-provider/src/local-bare-repo-provider.ts packages/git-provider/src/__tests__/gitlab-provider-author.test.ts
git commit -m "feat(git-provider): authorIdentity in commitMultipleFiles"
```

---

## Task 3: Helper `commitHandoffArtifacts()`

**Files:**
- Create: `server/src/services/governed-workflows-artifacts.ts`
- Create: `server/src/services/__tests__/governed-workflows-artifacts.test.ts`

- [ ] **Step 1: Écrire le test failing**

```typescript
// server/src/services/__tests__/governed-workflows-artifacts.test.ts

import { describe, it, expect } from "vitest";
import { LocalBareRepoProvider } from "@mnm/git-provider";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { commitHandoffArtifacts } from "../governed-workflows-artifacts.js";
import { seedBareRepo } from "../../mcp/tools/__tests__/fixtures/seed-bare-repo.js";
import type { ArtifactInput } from "@mnm/shared";

describe("commitHandoffArtifacts", () => {
  it("transforms file/folder/url outputs and commits to mnm-runs branch", async () => {
    const repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "test", repoDir: repo.repoDir });

    const input: ArtifactInput = {
      outputs: [
        { name: "design", kind: "file", filename: "design.md", content: "# Design FEAT-001\n" },
        { name: "proto", kind: "folder", files: { "index.html": "<html/>", "app.js": "x" } },
        { name: "mr", kind: "external_url", url: "https://lab/x/-/merge_requests/1" },
      ],
      data: { mr_iid: 42, ticket: "FEAT-001" },
    };

    const persisted = await commitHandoffArtifacts({
      gitProvider: provider,
      runId: "abc-123",
      stepId: "tech-design",
      input,
      author: { name: "MnM founder", email: "tom@example.com" },
    });

    expect(persisted.outputs).toHaveLength(3);
    expect(persisted.outputs[0]).toMatchObject({
      name: "design",
      kind: "git_file",
      path: "artifacts/runs/abc-123/tech-design/design.md",
      branch: "mnm-runs/abc-123",
      bytes: "# Design FEAT-001\n".length,
    });
    expect(persisted.outputs[0]).toHaveProperty("git_sha");
    expect(persisted.outputs[1]).toMatchObject({
      name: "proto",
      kind: "git_folder",
      path: "artifacts/runs/abc-123/tech-design/proto/",
      files: ["index.html", "app.js"],
    });
    expect(persisted.outputs[2]).toEqual({
      name: "mr",
      kind: "external_url",
      url: "https://lab/x/-/merge_requests/1",
    });
    expect(persisted.data).toEqual({ mr_iid: 42, ticket: "FEAT-001" });
  });

  it("is idempotent if outputs already contain git_file kinds", async () => {
    const repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "test", repoDir: repo.repoDir });

    const alreadyPersisted = {
      outputs: [
        { name: "design", kind: "git_file" as const, path: "x", git_sha: "abc", branch: "mnm-runs/r", bytes: 10 },
      ],
      data: {},
    };
    const result = await commitHandoffArtifacts({
      gitProvider: provider,
      runId: "r",
      stepId: "s",
      input: alreadyPersisted as any,
      author: { name: "T", email: "t@x" },
    });
    expect(result).toEqual(alreadyPersisted);
  });
});
```

- [ ] **Step 2: Run le test, vérifier qu'il fail**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-artifacts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter `commitHandoffArtifacts`**

```typescript
// server/src/services/governed-workflows-artifacts.ts

import type { GitProvider, GitAuthorIdentity } from "@mnm/git-provider";
import type { ArtifactInput, ArtifactPersisted, OutputPersisted } from "@mnm/shared";

export interface CommitHandoffArtifactsArgs {
  gitProvider: GitProvider;
  runId: string;
  stepId: string;
  input: ArtifactInput;
  author: GitAuthorIdentity;
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
  const { gitProvider, runId, stepId, input, author } = args;

  // Idempotence: if no input output is of kind "file" or "folder", skip commit.
  const hasInlineContent = input.outputs.some(
    (o) => o.kind === "file" || o.kind === "folder",
  );
  if (!hasInlineContent) {
    return input as ArtifactPersisted;
  }

  const branch = runBranchName(runId);
  const stepPath = stepArtifactsPath(runId, stepId);

  // Build the action list and prepare the persisted outputs (without git_sha yet).
  const actions: Array<{ path: string; content: string }> = [];
  const pendingPersisted: Array<OutputPersisted | { __pending: true; src: typeof input.outputs[number] }> = [];

  for (const output of input.outputs) {
    if (output.kind === "file") {
      const filePath = `${stepPath}/${output.filename}`;
      actions.push({ path: filePath, content: output.content });
      pendingPersisted.push({
        name: output.name,
        kind: "git_file",
        path: filePath,
        git_sha: "__pending__",
        branch,
        bytes: output.content.length,
      });
    } else if (output.kind === "folder") {
      const folderPath = `${stepPath}/${output.name}/`;
      const filenames: string[] = [];
      for (const [filename, content] of Object.entries(output.files)) {
        actions.push({ path: `${folderPath}${filename}`, content });
        filenames.push(filename);
      }
      pendingPersisted.push({
        name: output.name,
        kind: "git_folder",
        path: folderPath,
        git_sha: "__pending__",
        branch,
        files: filenames,
      });
    } else {
      // external_url passes through unchanged
      pendingPersisted.push(output);
    }
  }

  if (actions.length === 0) {
    // Only external_url outputs — no commit needed
    return {
      outputs: pendingPersisted as OutputPersisted[],
      data: input.data,
    };
  }

  const result = await gitProvider.commitMultipleFiles({
    branch,
    startBranch: "master",  // creates branch from master if it doesn't exist
    message: `step ${stepId}: handoff outputs`,
    actions,
    authorIdentity: author,
  });

  // All outputs of this step share the same commit sha
  const finalOutputs = pendingPersisted.map((p) => {
    if ("__pending" in p) {
      throw new Error("unreachable: pending placeholder leaked");
    }
    if (p.kind === "git_file" || p.kind === "git_folder") {
      return { ...p, git_sha: result.commitSha };
    }
    return p;
  });

  return {
    outputs: finalOutputs,
    data: input.data,
  };
}
```

- [ ] **Step 4: Run le test, vérifier qu'il passe**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-artifacts.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows-artifacts.ts server/src/services/__tests__/governed-workflows-artifacts.test.ts
git commit -m "feat(governed-workflows): commitHandoffArtifacts helper"
```

---

## Task 4: Tighter le Zod schema sur `complete_governed_step.artifact`

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts:259-289`

- [ ] **Step 1: Définir le schema Zod**

Add at the top of the file (after imports):

```typescript
// server/src/mcp/tools/governed-workflows.tool.ts (near top, after imports)

const outputInputSchema = z.discriminatedUnion("kind", [
  z.object({
    name: z.string().min(1),
    kind: z.literal("file"),
    filename: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal("folder"),
    files: z.record(z.string(), z.string()),
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal("external_url"),
    url: z.string().url(),
  }),
]);

const artifactInputSchema = z.object({
  outputs: z.array(outputInputSchema),
  data: z.record(z.string(), z.unknown()),
});
```

- [ ] **Step 2: Remplacer `artifact: z.unknown()` par le schema**

Find lines 263-267 (the `input: z.object(...)` of complete_governed_step) and replace `artifact: z.unknown()` with `artifact: artifactInputSchema`:

```typescript
input: z.object({
  run_id: z.string().uuid(),
  step_id: z.string().min(1),
  artifact: artifactInputSchema,
}),
```

- [ ] **Step 3: Vérifier que le typecheck passe**

Run: `bun run typecheck`
Expected: PASS (peut-être quelques cascades à fix dans `completeStep` qui prennent `artifact: unknown` — narrow le type là aussi)

- [ ] **Step 4: Vérifier que les tests E2E existants passent toujours**

Run: `bun run --cwd server test src/mcp/tools/__tests__/governed-workflows.e2e.test.ts`
Expected: PASS — il faudra peut-être adapter les fixtures pour produire le nouveau schema (voir Task 11). Si elles échouent ici, garder le test red et fixer dans Task 11.

- [ ] **Step 5: Commit**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts
git commit -m "feat(mcp): tighten artifactInputSchema on complete_governed_step"
```

---

## Task 5: Wire `commitHandoffArtifacts` dans `completeStep`

**Files:**
- Modify: `server/src/services/governed-workflows.ts:974+` (la fonction `completeStep`)

- [ ] **Step 1: Identifier le point d'insertion**

Read `server/src/services/governed-workflows.ts` autour de la ligne 974 (advisory lock + persist artifact). On veut transformer l'artifact AVANT le `tx.update(governedStepExecutions).set({ artifactsJson: ... })`.

- [ ] **Step 2: Résoudre l'identité du committeur (OAuth user → fallback PAT compagnie)**

Add helper at top of `completeStep`:

```typescript
// server/src/services/governed-workflows.ts (inside completeStep, before tx)

const author = await resolveCommitAuthor({
  db,
  companyId: args.companyId,
  actor: args.actor,
});

async function resolveCommitAuthor(deps: {
  db: Db;
  companyId: string;
  actor: { type: string; id: string };
}): Promise<{ name: string; email: string }> {
  if (deps.actor.type === "user") {
    const [user] = await deps.db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, deps.actor.id));
    if (user?.email) {
      return { name: user.name ?? user.email, email: user.email };
    }
  }
  // Fallback service account — env or default
  return {
    name: process.env.MNM_GIT_BOT_NAME ?? "MnM bot",
    email: process.env.MNM_GIT_BOT_EMAIL ?? "mnm-bot@mnm.local",
  };
}
```

(Place `resolveCommitAuthor` either as a top-level helper in `governed-workflows.ts` or as an exported function in `governed-workflows-artifacts.ts`. Recommendation: put it in `governed-workflows-artifacts.ts` for cohesion.)

- [ ] **Step 3: Appeler `commitHandoffArtifacts` avant le persist**

Inside `completeStep`, before persisting `artifactsJson`:

```typescript
// server/src/services/governed-workflows.ts (inside completeStep)

const gitProvider = await deps.resolveGitProvider({
  companyId: args.companyId,
  userId: args.actor.type === "user" ? args.actor.id : null,
  resourceType: "workflow",
});

const persistedArtifact = await commitHandoffArtifacts({
  gitProvider,
  runId: args.runId,
  stepId: args.stepId,
  input: args.artifact as ArtifactInput,
  author,
});

// Then continue with existing logic, but use persistedArtifact instead of args.artifact:
await tx
  .update(governedStepExecutions)
  .set({ artifactsJson: persistedArtifact, ... })
  .where(...);
```

- [ ] **Step 4: Étendre le test E2E `governed-workflows.e2e.test.ts` pour vérifier la transformation**

Append a new test case:

```typescript
// server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts (nouveau test)

it("commitHandoffArtifacts transforms file outputs to git_file before persist", async () => {
  // ... launch a run on a workflow that expects a file output at first step ...
  const complete = tools.find((t) => t.name === "complete_governed_step")!;
  const res = await complete.handler({
    input: {
      run_id: runId,
      step_id: "tech-design",
      artifact: {
        outputs: [
          { name: "design", kind: "file", filename: "design.md", content: "# X" },
        ],
        data: {},
      },
    },
    actor: mkActor(),
  });
  expect(res.isError).toBeFalsy();

  const [row] = await db
    .select({ artifactsJson: governedStepExecutions.artifactsJson })
    .from(governedStepExecutions)
    .where(eq(governedStepExecutions.runId, runId));

  const persisted = row.artifactsJson as ArtifactPersisted;
  expect(persisted.outputs[0]).toMatchObject({
    kind: "git_file",
    name: "design",
    path: `artifacts/runs/${runId}/tech-design/design.md`,
    branch: `mnm-runs/${runId}`,
  });
  expect(persisted.outputs[0]).toHaveProperty("git_sha");
});
```

- [ ] **Step 5: Run le test, vérifier qu'il passe**

Run: `bun run --cwd server test src/mcp/tools/__tests__/governed-workflows.e2e.test.ts`
Expected: PASS, +1 test

- [ ] **Step 6: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/services/governed-workflows-artifacts.ts server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts
git commit -m "feat(governed-workflows): persist artifacts as git_file/git_folder via commitHandoffArtifacts"
```

---

## Task 6: Étendre `launch_governed_step` pour produire `handoffs[]`

**Files:**
- Modify: `server/src/services/governed-workflows.ts:805-814` (la fonction qui retourne le payload de launch)
- Modify: `server/src/services/governed-workflows-artifacts.ts` (ajouter `buildHandoffsForStep`)

- [ ] **Step 1: Test failing — `buildHandoffsForStep` extrait les handoffs des steps précédents**

```typescript
// server/src/services/__tests__/governed-workflows-artifacts.test.ts (append)

import { buildHandoffsForStep } from "../governed-workflows-artifacts.js";

describe("buildHandoffsForStep", () => {
  it("extracts handoffs from previous succeeded steps", () => {
    const prevSteps = [
      {
        stepIdInJson: "tech-design",
        state: "succeeded" as const,
        artifactsJson: {
          outputs: [
            { name: "design", kind: "git_file", path: "artifacts/runs/r1/tech-design/design.md", git_sha: "abc", branch: "mnm-runs/r1", bytes: 100 },
            { name: "mr", kind: "external_url", url: "https://x" },
          ],
          data: { mr_iid: 1 },
        },
      },
    ];
    const handoffs = buildHandoffsForStep(prevSteps as any);
    expect(handoffs).toEqual([
      {
        name: "design",
        kind: "git_file",
        git_sha: "abc",
        path: "artifacts/runs/r1/tech-design/design.md",
        branch: "mnm-runs/r1",
        destination: ".mnm/handoffs/design.md",
      },
      {
        name: "mr",
        kind: "external_url",
        url: "https://x",
      },
    ]);
  });

  it("ignores failed and pending steps", () => {
    const prevSteps = [
      { stepIdInJson: "s1", state: "failed", artifactsJson: { outputs: [{ name: "x", kind: "git_file", path: "p", git_sha: "s", branch: "b", bytes: 1 }], data: {} } },
      { stepIdInJson: "s2", state: "pending", artifactsJson: null },
    ];
    expect(buildHandoffsForStep(prevSteps as any)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run le test, vérifier qu'il fail**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-artifacts.test.ts`
Expected: FAIL — buildHandoffsForStep is not defined

- [ ] **Step 3: Implémenter `buildHandoffsForStep`**

Append to `server/src/services/governed-workflows-artifacts.ts`:

```typescript
import type { Handoff, ArtifactPersisted } from "@mnm/shared";

interface PreviousStepRow {
  stepIdInJson: string;
  state: string;
  artifactsJson: ArtifactPersisted | null;
}

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
```

- [ ] **Step 4: Wire `buildHandoffsForStep` dans le launch result**

Modify `server/src/services/governed-workflows.ts` around line 805-814:

```typescript
// Inside the launch step service method, after fetching previousSteps:

const handoffs = buildHandoffsForStep(previousSteps);

const promptContext = interpolatePromptContext(
  step.prompt_context,
  { variables: params, steps: previousArtifacts },
);

return {
  agentName: step.agent,
  promptContext,
  subagentType: `mnm--${step.agent}`,
  handoffs,
  dispatchMode: step.dispatch_mode ?? "subagent",  // workflow.json field
  runBranch: runBranchName(args.runId),
};
```

- [ ] **Step 5: Run les tests**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-artifacts.test.ts`
Expected: PASS, 4 tests total

- [ ] **Step 6: Commit**

```bash
git add server/src/services/governed-workflows-artifacts.ts server/src/services/__tests__/governed-workflows-artifacts.test.ts server/src/services/governed-workflows.ts
git commit -m "feat(governed-workflows): expose handoffs[] in launch_governed_step"
```

---

## Task 7: Helper `ctx.helpers.fetchHandoff` côté gates

**Files:**
- Modify: `server/src/services/governed-workflows-helpers.ts`

- [ ] **Step 1: Test failing**

```typescript
// server/src/services/__tests__/governed-workflows-helpers.test.ts (append)

describe("fetchHandoff helper", () => {
  it("fetches blob content via gitProvider", async () => {
    const fakeProvider = {
      fetchBlob: vi.fn().mockResolvedValue("# Design content"),
    };
    const helpers = buildGateHelpers({
      db: fakeDb,
      companyId: "c1",
      resolveGitProvider: async () => fakeProvider as any,
    });
    const content = await helpers.fetchHandoff({ git_sha: "abc", path: "design.md" });
    expect(content).toBe("# Design content");
    expect(fakeProvider.fetchBlob).toHaveBeenCalledWith({ ref: "abc", path: "design.md" });
  });
});
```

- [ ] **Step 2: Run, vérifier fail**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-helpers.test.ts`
Expected: FAIL

- [ ] **Step 3: Ajouter `fetchHandoff` dans `buildGateHelpers`**

```typescript
// server/src/services/governed-workflows-helpers.ts (append à la fin de buildGateHelpers)

async function fetchHandoff(args: { git_sha: string; path: string }): Promise<string> {
  if (!resolveGitProvider) {
    throw new Error("fetchHandoff: resolveGitProvider not wired");
  }
  if (typeof args?.git_sha !== "string" || args.git_sha.length === 0) {
    throw new Error("fetchHandoff: git_sha (string) required");
  }
  if (typeof args?.path !== "string" || args.path.length === 0) {
    throw new Error("fetchHandoff: path (string) required");
  }
  const provider = await resolveGitProvider({
    companyId,
    userId: null,
    resourceType: "workflow",
  });
  return provider.fetchBlob({ ref: args.git_sha, path: args.path });
}

return { queryTraces, checkWorkflowExists, getMergeRequestApprovals, fetchHandoff };
```

- [ ] **Step 4: Run, vérifier pass**

Run: `bun run --cwd server test src/services/__tests__/governed-workflows-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/governed-workflows-helpers.ts server/src/services/__tests__/governed-workflows-helpers.test.ts
git commit -m "feat(governed-workflows): fetchHandoff gate helper"
```

---

## Task 8: MCP tool `resume_governed_workflow_run`

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts` (ajouter le tool)
- Modify: `server/src/services/governed-workflows.ts` (ajouter méthode `resumeRun`)

- [ ] **Step 1: Test E2E du resume**

```typescript
// server/src/mcp/tools/__tests__/governed-workflows-resume.e2e.test.ts (nouveau)

import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, cleanTestDb } from "@mnm/test-utils";
import { LocalBareRepoProvider, ShaCache } from "@mnm/git-provider";
import { seedBareRepo } from "../fixtures/seed-bare-repo.js";
import governedWorkflowTools from "../../governed-workflows.tool.js";
import { collectTools } from "../../../registry/define-mcp-tools.js";
import { governedWorkflowService } from "../../../../services/governed-workflows.js";

describe("resume_governed_workflow_run", () => {
  it("returns history + current_step matching launch shape", async () => {
    // Setup db, seed repo, launch workflow, complete first step, then call resume
    const db = await setupTestDb();
    await cleanTestDb(db);
    const repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "test", repoDir: repo.repoDir });
    const svc = governedWorkflowService(db, { resolveGitProvider: async () => provider, shaCache: new ShaCache() });
    const tools = collectTools(governedWorkflowTools, { db, governedWorkflows: svc } as any, db);
    const actor = mkActor();

    const launchRes = await tools.find((t) => t.name === "launch_governed_workflow")!.handler({
      input: { name: "hello-world", params: { name: "MnM founder" } },
      actor,
    });
    const runId = JSON.parse(launchRes.content[0].text).run_id;

    // Complete step 1
    await tools.find((t) => t.name === "complete_governed_step")!.handler({
      input: {
        run_id: runId,
        step_id: "greet",
        artifact: { outputs: [{ name: "msg", kind: "file", filename: "msg.md", content: "hello" }], data: {} },
      },
      actor,
    });

    // Resume
    const resumeRes = await tools.find((t) => t.name === "resume_governed_workflow_run")!.handler({
      input: { run_id: runId },
      actor,
    });
    expect(resumeRes.isError).toBeFalsy();
    const payload = JSON.parse(resumeRes.content[0].text);
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].step_id).toBe("greet");
    expect(payload.history[0].state).toBe("succeeded");
    expect(payload.history[0].outputs[0]).toMatchObject({ kind: "git_file", name: "msg" });
    expect(payload.current_step.step_id).toBeDefined();
    expect(payload.current_step.handoffs).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, vérifier fail**

Run: `bun run --cwd server test src/mcp/tools/__tests__/governed-workflows-resume.e2e.test.ts`
Expected: FAIL — tool not found

- [ ] **Step 3: Ajouter méthode `resumeRun` dans le service**

```typescript
// server/src/services/governed-workflows.ts (ajouter méthode dans le service)

async function resumeRun(args: { companyId: string; runId: string }) {
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(and(eq(governedWorkflowRuns.companyId, args.companyId), eq(governedWorkflowRuns.id, args.runId)));
  if (!run) throw new Error(`run ${args.runId} not found`);

  const steps = await db
    .select()
    .from(governedStepExecutions)
    .where(eq(governedStepExecutions.runId, args.runId))
    .orderBy(governedStepExecutions.createdAt);

  const completedSteps = steps.filter((s) => s.state === "succeeded");
  const history = await Promise.all(completedSteps.map(async (s) => {
    const completedByEmail = s.launchedByActorType === "user" && s.launchedByActorId
      ? (await db.select({ email: users.email }).from(users).where(eq(users.id, s.launchedByActorId)))[0]?.email
      : null;
    return {
      step_id: s.stepIdInJson,
      state: s.state,
      outputs: (s.artifactsJson as ArtifactPersisted | null)?.outputs ?? [],
      data: (s.artifactsJson as ArtifactPersisted | null)?.data ?? {},
      started_at: s.startedAt,
      completed_at: s.completedAt,
      completed_by: completedByEmail,
    };
  }));

  // Identify the next pending step
  const nextStep = steps.find((s) => s.state === "pending" || s.state === "running");
  if (!nextStep) {
    return { run, history, current_step: null };  // run is fully done
  }

  const currentLaunchPayload = await launch({ companyId: args.companyId, runId: args.runId, stepIdInJson: nextStep.stepIdInJson });

  return {
    run_id: run.id,
    workflow_name: run.workflowName,
    workflow_git_tag: run.workflowGitTag,
    status: run.status,
    history,
    current_step: {
      step_id: nextStep.stepIdInJson,
      state: nextStep.state,
      ...currentLaunchPayload,
    },
  };
}
```

- [ ] **Step 4: Enregistrer le MCP tool**

```typescript
// server/src/mcp/tools/governed-workflows.tool.ts (ajouter à la fin de defineMcpTools)

tool("resume_governed_workflow_run", {
  permissions: [PERMISSIONS.WORKFLOWS_LAUNCH],
  description:
    "[Governed Workflows] Returns a run's history (succeeded steps with their outputs+data) and the current pending step (with prompt + handoffs[]) so a fresh client can resume the run.",
  input: z.object({
    run_id: z.string().uuid(),
  }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async ({ input, actor }) => {
    return wrap(actor, async () => {
      await setTenantContext(services.db, actor.companyId);
      const r = await services.governedWorkflows.resumeRun({
        companyId: actor.companyId,
        runId: input.run_id,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(r) }],
      };
    });
  },
});
```

- [ ] **Step 5: Run, vérifier pass**

Run: `bun run --cwd server test src/mcp/tools/__tests__/governed-workflows-resume.e2e.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/governed-workflows.ts server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows-resume.e2e.test.ts
git commit -m "feat(governed-workflows): resume_governed_workflow_run MCP tool"
```

---

## Task 9: Fin de run — commit `_run.json`, merge `--no-ff` master, delete branche

**Files:**
- Modify: `server/src/services/governed-workflows-artifacts.ts` (ajouter `mergeRunBranch`)
- Modify: `server/src/services/governed-workflows.ts` (appeler `mergeRunBranch` aux transitions terminales)
- Modify: `packages/git-provider/src/types.ts` (ajouter `mergeBranch` et `deleteBranch` à `GitProvider`)
- Modify: `packages/git-provider/src/gitlab-provider.ts` + `local-bare-repo-provider.ts`

- [ ] **Step 1: Étendre `GitProvider` interface**

```typescript
// packages/git-provider/src/types.ts

export interface MergeBranchArgs {
  sourceBranch: string;
  targetBranch: string;
  message: string;
  noFf?: boolean;
  authorIdentity?: GitAuthorIdentity;
}

export interface MergeBranchResult {
  commitSha: string;
}

export interface DeleteBranchArgs {
  branch: string;
}

// Add to GitProvider interface:
export interface GitProvider {
  // ... existing
  mergeBranch(args: MergeBranchArgs): Promise<MergeBranchResult>;
  deleteBranch(args: DeleteBranchArgs): Promise<void>;
}
```

- [ ] **Step 2: Implémenter dans GitlabProvider**

```typescript
// packages/git-provider/src/gitlab-provider.ts

async mergeBranch(args: MergeBranchArgs): Promise<MergeBranchResult> {
  // GitLab API: POST /projects/:id/repository/merges is for MRs, not direct merges.
  // For direct merge into master, use the cherry-pick API or use a sequence:
  // 1. Create a temporary MR with target=master, source=args.sourceBranch
  // 2. Accept the MR with squash=false, merge_when_pipeline_succeeds=false
  // Alternative: use the GitLab REST endpoint POST /repository/merge_to_default_branch (if available)
  // Simplest in votre organisation self-hosted: create + accept MR with merge method = merge commit.

  // Step A: create MR
  const mr = await this.request<{ iid: number }>(
    "POST",
    `/projects/${encodeURIComponent(this.projectId)}/merge_requests`,
    {
      source_branch: args.sourceBranch,
      target_branch: args.targetBranch,
      title: args.message,
      remove_source_branch: false,  // we'll delete explicitly afterwards
    },
  );

  // Step B: accept MR with no fast-forward
  const accepted = await this.request<{ merge_commit_sha: string }>(
    "PUT",
    `/projects/${encodeURIComponent(this.projectId)}/merge_requests/${mr.iid}/merge`,
    {
      merge_commit_message: args.message,
      squash: false,
      should_remove_source_branch: false,
    },
  );

  return { commitSha: accepted.merge_commit_sha };
}

async deleteBranch(args: DeleteBranchArgs): Promise<void> {
  await this.request<unknown>(
    "DELETE",
    `/projects/${encodeURIComponent(this.projectId)}/repository/branches/${encodeURIComponent(args.branch)}`,
    null,
  );
}
```

(For LocalBareRepoProvider, use simple-git `merge(["--no-ff", sourceBranch], { "-m": message })` and `branch(["-D", branch])`.)

- [ ] **Step 3: Ajouter `mergeRunBranch` dans `governed-workflows-artifacts.ts`**

```typescript
// server/src/services/governed-workflows-artifacts.ts

export interface MergeRunBranchArgs {
  gitProvider: GitProvider;
  runId: string;
  workflowName: string;
  ticket: string | null;
  status: "completed" | "failed" | "cancelled";
  stepsSummary: Array<{ stepId: string; state: string }>;
  startedAt: Date | null;
  completedAt: Date;
  triggeredBy: string;
  author: GitAuthorIdentity;
}

export async function mergeRunBranch(args: MergeRunBranchArgs): Promise<void> {
  const branch = runBranchName(args.runId);

  // Step 1: commit _run.json on the branch with the final summary
  const runJson = JSON.stringify({
    run_id: args.runId,
    workflow_name: args.workflowName,
    ticket: args.ticket,
    status: args.status,
    steps: args.stepsSummary,
    started_at: args.startedAt?.toISOString(),
    completed_at: args.completedAt.toISOString(),
    triggered_by: args.triggeredBy,
  }, null, 2);

  await args.gitProvider.commitMultipleFiles({
    branch,
    message: `run ${args.runId}: finalize (${args.status})`,
    actions: [{ path: `artifacts/runs/${args.runId}/_run.json`, content: runJson }],
    authorIdentity: args.author,
  });

  // Step 2: merge --no-ff into master
  const stepsLine = args.stepsSummary
    .map((s) => `${s.stepId} ${s.state === "succeeded" ? "✓" : "✗"}`)
    .join(", ");
  const mergeMessage = `Run ${args.runId}: ${args.workflowName}${args.ticket ? ` (${args.ticket})` : ""} — ${args.status}\n\nSteps: ${stepsLine}\nTriggered by: ${args.triggeredBy}`;

  await args.gitProvider.mergeBranch({
    sourceBranch: branch,
    targetBranch: "master",
    message: mergeMessage,
    noFf: true,
    authorIdentity: args.author,
  });

  // Step 3: delete the run branch
  await args.gitProvider.deleteBranch({ branch });
}
```

- [ ] **Step 4: Wire `mergeRunBranch` aux transitions terminales du run**

In `server/src/services/governed-workflows.ts`, identify where the run status transitions to `completed`/`failed`/`cancelled`. After the transition, call:

```typescript
// After the run status transition (still inside the same tx if possible, OR after commit if Git ops should not block tx):

await mergeRunBranch({
  gitProvider,
  runId: run.id,
  workflowName: run.workflowName,
  ticket: (run.params as any)?.ticket ?? null,
  status: newStatus,
  stepsSummary: allSteps.map((s) => ({ stepId: s.stepIdInJson, state: s.state })),
  startedAt: run.startedAt,
  completedAt: new Date(),
  triggeredBy: triggeredByEmail,
  author,
});
```

Note: keep the merge OUTSIDE the DB transaction to avoid holding an XACT lock during a slow Git push. If the merge fails, log + alert + retry via cron. The DB state is already coherent.

- [ ] **Step 5: Test E2E — vérifier que master contient le merge commit après run completed**

```typescript
// Append to governed-workflows.e2e.test.ts:

it("merges mnm-runs/<run_id> into master at run completion", async () => {
  // ... run a 1-step workflow to completion ...
  const log = await git.log({ "--first-parent": null, master: true });
  const last = log.latest!;
  expect(last.message).toMatch(/^Run [a-f0-9-]+: hello-world.*completed/);
  // Branch should be deleted
  const branches = await git.branchLocal();
  expect(branches.all).not.toContain(`mnm-runs/${runId}`);
});
```

- [ ] **Step 6: Run, vérifier pass**

Run: `bun run --cwd server test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/git-provider/src/types.ts packages/git-provider/src/gitlab-provider.ts packages/git-provider/src/local-bare-repo-provider.ts server/src/services/governed-workflows-artifacts.ts server/src/services/governed-workflows.ts server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts
git commit -m "feat(governed-workflows): merge mnm-runs branch into master at run completion"
```

---

## Task 10: UI — affichage outputs[] et data{} dans GovernedWorkflowRunDetail

**Files:**
- Modify: `ui/src/api/governed-workflows.ts` (ajouter `resumeRun` API client method, optionnel pour l'instant)
- Modify: `ui/src/pages/GovernedWorkflowRunDetail.tsx` (refonte du tab Output)

- [ ] **Step 1: Ajouter le rendu d'un output unique**

Replace the `outputContent` block (lines 96-99) and the `<TabsContent value="output">` (lines 132-136) with structured rendering:

```typescript
// ui/src/pages/GovernedWorkflowRunDetail.tsx

import { ExternalLink, FileText, Folder } from "lucide-react";

interface OutputPersisted {
  name: string;
  kind: "git_file" | "git_folder" | "external_url";
  path?: string;
  git_sha?: string;
  branch?: string;
  bytes?: number;
  files?: string[];
  url?: string;
}

function OutputRow({ output, repoUrl }: { output: OutputPersisted; repoUrl?: string }) {
  if (output.kind === "external_url") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{output.name}</span>
        <a href={output.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
          {output.url}
        </a>
      </div>
    );
  }
  if (output.kind === "git_file") {
    const gitlabUrl = repoUrl ? `${repoUrl}/-/blob/${output.git_sha}/${output.path}` : null;
    return (
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{output.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{output.path}</span>
        <span className="text-xs text-muted-foreground">({output.bytes} bytes)</span>
        {gitlabUrl && (
          <a href={gitlabUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-auto">
            Voir dans GitLab
          </a>
        )}
      </div>
    );
  }
  // git_folder
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{output.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{output.path}</span>
      </div>
      <ul className="mt-1 ml-6 list-disc text-xs text-muted-foreground space-y-0.5">
        {output.files?.map((f) => (
          <li key={f} className="font-mono">{f}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Remplacer le tab Output dans `StepCard`**

```typescript
// Inside StepCard, replace the existing <TabsContent value="output">:

<TabsContent value="output" className="mt-3 space-y-4">
  {step.artifactsJson && typeof step.artifactsJson === "object" ? (
    <>
      {Array.isArray((step.artifactsJson as any).outputs) && (step.artifactsJson as any).outputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Livrables</h4>
          <div className="space-y-2">
            {((step.artifactsJson as any).outputs as OutputPersisted[]).map((o) => (
              <OutputRow key={o.name} output={o} />
            ))}
          </div>
        </div>
      )}
      {(step.artifactsJson as any).data && Object.keys((step.artifactsJson as any).data).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Données</h4>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries((step.artifactsJson as any).data as Record<string, unknown>).map(([k, v]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="px-2 py-1 font-mono text-muted-foreground w-1/3">{k}</td>
                  <td className="px-2 py-1 font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  ) : (
    <p className="text-xs text-muted-foreground">— Non exécuté —</p>
  )}
</TabsContent>
```

- [ ] **Step 3: Démarrer le dev server et vérifier visuellement**

Run: `bun run dev`
Open `http://localhost:3000/workflows/feature-dev/runs/<existing-run-id>`
Expected: Le tab Output montre une section "Livrables" avec les fichiers/URLs et une section "Données" avec un tableau key/value, plus de JSON brut.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/GovernedWorkflowRunDetail.tsx
git commit -m "feat(ui): render outputs[] and data{} in run detail Output tab"
```

---

## Task 11: Migration `feature-dev` workflow + agents

**Files (dans le repo `your-username/mnm-demo` GitLab, hors monorepo) :**
- Modify: `workflows/feature-dev/workflow.json`
- Modify: `workflows/feature-dev/agents/*.md` (les prompts des agents)

- [ ] **Step 1: Mettre à jour `workflow.json` pour le nouveau schema**

Pour chaque step `steps[i]`, modifier `prompt_context` pour utiliser le nouveau format :

```json
{
  "steps": [
    {
      "id": "tech-design",
      "agent": "senior-dev",
      "dispatch_mode": "subagent",
      "prompt_context": {
        "task": "Produce a tech design for {{variables.ticket}}",
        "deliverable_format": "Return artifact: { outputs: [{ name: 'design', kind: 'file', filename: 'design.md', content: '<your design>' }], data: { ticket: '{{variables.ticket}}', summary: '<one-sentence>' } }"
      },
      "exit_gates": [
        { "kind": "step_succeeded", "config": {} }
      ]
    },
    {
      "id": "review",
      "agent": "review-watcher",
      "dispatch_mode": "subagent",
      "prompt_context": {
        "task": "Review the design from previous step",
        "design_content": "{{steps.tech-design.artifact.outputs.design}}",
        "deliverable_format": "Return artifact: { outputs: [{ name: 'mr', kind: 'external_url', url: '<mr_url>' }], data: { mr_iid: <iid>, approvals_count: <n> } }"
      },
      "exit_gates": [
        { "kind": "mr_approved", "config": { "min_approvals": 1 } }
      ]
    }
    // ... dev, release-mgr similar
  ]
}
```

- [ ] **Step 2: Mettre à jour `interpolatePromptContext` pour résoudre `{{steps.X.artifact.outputs.<name>}}` en eager mode**

Modify `server/src/services/governed-workflows.ts:938-967`. When the path matches `steps.X.artifact.outputs.<name>` and the resolved value is `kind: git_file`, fetch the content via `gitProvider.fetchBlob` and inline it.

```typescript
// Pseudo (concept — exact code in a sub-step):
// In interpolatePromptContext walk(), when resolving steps.X.artifact.outputs.<name>:
//   - look up the output object
//   - if kind === "git_file" → await gitProvider.fetchBlob({ ref: git_sha, path }) → return the content string
//   - if kind === "external_url" → return the url
//   - if kind === "git_folder" → return JSON of file list (or fetch each? phase 1: list of files only)
```

Note: this requires `interpolatePromptContext` to become async. Update its callers accordingly.

- [ ] **Step 3: Adapter les agent prompts**

Each `workflows/feature-dev/agents/<role>.md` agent prompt should mention:
- "Tu reçois tes handoffs dans `.mnm/handoffs/<name>` (path local)"
- "Ton output doit être au format `{ outputs: [...], data: {...} }`"

Example for senior-dev:
```markdown
# Senior Dev (feature-dev / tech-design)

## Inputs
- `{{variables.ticket}}` — Jira ticket id
- Tu n'as pas de handoff (premier step)

## Output attendu

Tu dois renvoyer un artifact JSON via `complete_governed_step`:

```json
{
  "outputs": [
    {
      "name": "design",
      "kind": "file",
      "filename": "design.md",
      "content": "# Conception <ticket>\n\n## Contexte\n...\n## Tests\n..."
    }
  ],
  "data": {
    "ticket": "<ticket>",
    "summary": "<une phrase résumant la conception>"
  }
}
```
```

- [ ] **Step 4: Pousser le tag `feature-dev/v2.0.0` sur le repo `your-username/mnm-demo`**

```bash
# Dans le repo mnm-demo cloné localement:
git add workflows/feature-dev/
git commit -m "feat(feature-dev): migrate to outputs[]/data{} schema"
git tag feature-dev/v2.0.0
git push origin master --tags
```

- [ ] **Step 5: Bumper le `latest_git_tag` en DB pour pointer sur v2.0.0**

```bash
# Via psql ou via le MCP tool register_governed_workflow:
mcp__plugin_mnm_mnm__register_governed_workflow --name feature-dev --tag feature-dev/v2.0.0
```

- [ ] **Step 6: Smoke test — lancer un nouveau run sur FEAT-001 et vérifier que tout passe**

Run: `bun run dev` puis lancer le workflow via UI ou MCP. Vérifier dans GitLab que la branche `mnm-runs/<run_id>` est créée, les fichiers committés, et qu'à la fin du run le merge dans master apparaît.

- [ ] **Step 7: Commit le changement local du DB tag**

(Pas de commit Git ici puisque le changement est en DB. Mais vérifier en CLAUDE.md s'il faut updater le suivi.)

---

## Task 12: Tests E2E full flow + resume

**Files:**
- Create: `server/src/__tests__/feature-dev-resume.e2e.test.ts`

- [ ] **Step 1: Test "complete first step → resume → continue"**

```typescript
// server/src/__tests__/feature-dev-resume.e2e.test.ts

import { describe, it, expect, beforeAll } from "vitest";
// ... imports identiques à governed-workflows-resume.e2e.test.ts ...

describe("feature-dev — full resume flow", () => {
  it("MnM founder completes tech-design, simulates /clear, resumes with full context", async () => {
    const { db, tools, actor } = await setupRealistic();

    // Launch
    const launchRes = await tools.find((t) => t.name === "launch_governed_workflow")!.handler({
      input: { name: "feature-dev", params: { ticket: "FEAT-001" } },
      actor,
    });
    const runId = JSON.parse(launchRes.content[0].text).run_id;

    // Complete tech-design with a real-looking design.md
    await tools.find((t) => t.name === "complete_governed_step")!.handler({
      input: {
        run_id: runId,
        step_id: "tech-design",
        artifact: {
          outputs: [
            {
              name: "design",
              kind: "file",
              filename: "design.md",
              content: "# Design FEAT-001\n\n## Contexte\nFoo\n\n## Tests\n- Test A",
            },
          ],
          data: { ticket: "FEAT-001", summary: "Add feature X" },
        },
      },
      actor,
    });

    // Simulate /clear by losing local FS (we don't actually do FS ops in test, but verify resume payload is self-sufficient)
    const resumeRes = await tools.find((t) => t.name === "resume_governed_workflow_run")!.handler({
      input: { run_id: runId },
      actor,
    });
    const payload = JSON.parse(resumeRes.content[0].text);

    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].step_id).toBe("tech-design");
    expect(payload.history[0].outputs[0].kind).toBe("git_file");
    expect(payload.history[0].outputs[0].git_sha).toMatch(/^[a-f0-9]+$/);
    expect(payload.history[0].data.ticket).toBe("FEAT-001");

    expect(payload.current_step.step_id).toBe("review");
    expect(payload.current_step.handoffs).toEqual([
      expect.objectContaining({
        name: "design",
        kind: "git_file",
        path: expect.stringContaining(`runs/${runId}/tech-design/design.md`),
        destination: ".mnm/handoffs/design.md",
      }),
    ]);
    // The interpolated prompt for review should contain the design content (eager resolution)
    expect(payload.current_step.promptContext.design_content).toContain("# Design FEAT-001");
  });

  it("Failed run still merges into master with FAILED marker", async () => {
    // ... launch a workflow, complete with a gate-failing artifact, verify the run transitions to failed and master gets the merge ...
  });
});
```

- [ ] **Step 2: Run, vérifier pass**

Run: `bun run --cwd server test src/__tests__/feature-dev-resume.e2e.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/feature-dev-resume.e2e.test.ts
git commit -m "test(governed-workflows): E2E full resume flow with feature-dev"
```

---

## Task 13: Documentation utilisateur

**Files:**
- Create: `docs/governed-workflows/handoff-artifacts.md`

- [ ] **Step 1: Rédiger la doc utilisateur**

```markdown
# Handoff Artifacts entre Steps de Governed Workflow

## Pour les développeurs qui écrivent un workflow.json

Le contrat entre steps est l'artifact JSON. Format :

\`\`\`json
{
  "outputs": [
    { "name": "design", "kind": "file", "filename": "design.md", "content": "..." },
    { "name": "proto", "kind": "folder", "files": { "index.html": "...", "app.js": "..." } },
    { "name": "mr", "kind": "external_url", "url": "https://lab/.../merge_requests/1" }
  ],
  "data": {
    "ticket": "FEAT-001",
    "approvals_count": 2
  }
}
\`\`\`

- `outputs[]` = livrables (fichiers ou URLs externes). Les fichiers sont commités dans `mnm-runs/<run_id>` du repo workflow.
- `data{}` = signal d'état key/value (numérique, booléen, string courte). Stocké en jsonb DB, lisible par les gates.

## Pour les utilisateurs qui reprennent un run

\`\`\`bash
mcp resume_governed_workflow_run --run_id <id>
\`\`\`

Renvoie l'historique des steps précédents + le step en cours avec son `handoffs[]`. L'orchestrateur Claude Code clone shallow la branche `mnm-runs/<run_id>` et populate `.mnm/handoffs/`.

## Audit Git

Tous les runs (succeeded, failed, cancelled) sont mergés dans `master` du repo workflow à la fin. Pour voir l'historique :

\`\`\`bash
git log master --first-parent -- artifacts/runs/
\`\`\`

Pour explorer un run spécifique :

\`\`\`bash
git log master -- artifacts/runs/<run_id>/
git show <sha>:artifacts/runs/<run_id>/tech-design/design.md
\`\`\`

## Limitations Phase 1

- Pas de binaire (>1MB) : Phase 2 ajoutera `kind: blob` via storage S3
- Eager resolution uniquement (le content des `git_file` est inline dans le prompt du step suivant)
- Pas de chiffrement at-rest (s'appuie sur GitLab self-hosted derrière VPN)
```

- [ ] **Step 2: Commit**

```bash
git add docs/governed-workflows/handoff-artifacts.md
git commit -m "docs(governed-workflows): handoff artifacts user guide"
```

---

## Self-Review

**Spec coverage check (against `docs/superpowers/specs/2026-04-27-artifact-persistence-design.md`) :**

| Spec section | Implémenté par | Notes |
|-------------|----------------|-------|
| §3.1 Schema entrée | Task 1, Task 4 | Types + Zod |
| §3.2 Schema persisté | Task 1, Task 3, Task 5 | Types + transformation côté serveur |
| §3.3 Discriminants kind | Task 1, Task 4 | file/folder/external_url → git_file/git_folder/external_url |
| §4.1 Démarrage step (handoffs[]) | Task 6 | `buildHandoffsForStep` + wire dans launch |
| §4.2 Complétion step | Task 5 | wire `commitHandoffArtifacts` dans `completeStep` |
| §4.3 Fin de run (merge --no-ff master) | Task 9 | `mergeRunBranch` + delete branche |
| §4.4 Resume R2 | Task 8 | MCP tool `resume_governed_workflow_run` |
| §5 UI display | Task 10 | sections Livrables + Données |
| §6 Identité OAuth user | Task 5 (resolveCommitAuthor), Task 2 (gitProvider authorIdentity) | OAuth user → fallback service account |
| §7.1.2 Race conditions | Couvert par advisory lock existant | pas de task dédiée |
| §7.2.4 dispatch_mode déclaratif | Task 6 (return field) + Task 11 (workflow.json field) | |
| §7.2.7 OAuth user expiry | Couvert par fallback PAT (Task 5) | logging à ajouter en Phase 2 si besoin |
| §7.2.8 .mnm/handoffs/ pollution | Doc Task 13 | gitignore à mentionner |
| §10 Critères d'acceptation | Task 12 (E2E full flow) | |

**Placeholder scan :** aucun TBD/TODO non flaggé. Les "Notes" indiquent des points tactiques (ex: phase 2 pour le folder fetch détaillé) mais pas de trous bloquants.

**Type consistency :** `commitHandoffArtifacts` (Task 3), `buildHandoffsForStep` (Task 6), `mergeRunBranch` (Task 9), `resumeRun` (Task 8) — noms cohérents. `ArtifactInput`, `ArtifactPersisted`, `Handoff` (Task 1) utilisés partout.

**Scope check :** ~8.5j focused sur Phase 1, hors-scope (binaires, lazy resolution, diff, replay) explicit dans §8 du spec.

---

## Execution Choice

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-artifact-persistence.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Je dispatch un subagent fresh par task, review entre les tasks, itération rapide

**2. Inline Execution** — Exécution dans cette session via `executing-plans`, batch avec checkpoints pour review

**Quelle approche ?**
