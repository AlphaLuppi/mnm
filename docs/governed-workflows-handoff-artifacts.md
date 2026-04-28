# Governed Workflows — Handoff Artifacts

This document describes the artifact persistence system that lets users do `/clear` between steps of a governed workflow run and resume any run at any point given just the previous handoffs.

**Audience:** workflow authors, agent prompt writers, gate authors, and anyone debugging a governed run.

## Motivation

Before this system, an artifact produced by a step was a JSON blob persisted as-is in `governed_step_executions.artifacts_json`. If the orchestrator session was cleared between steps, the next step could not see the previous step's deliverables — the workflow was forced to be a single uninterrupted session.

The handoff artifact system solves this by:

1. **Committing inline file content to Git** at step completion, into a per-run branch `mnm-runs/<run_id>` of the workflow repo.
2. **Storing only Git references** (`git_sha`, `path`) in the DB, not the file content.
3. **Returning structured handoffs** to the orchestrator at launch, so it can shallow-clone exactly what the next step needs into `.mnm/handoffs/`.
4. **Merging the run branch into master** at run completion, with `--no-ff` for a clean audit trail.

After `/clear`, calling `resume_governed_workflow_run` returns the full history plus the current step's launch payload — the run can resume on a different machine with no shared state beyond Git.

## Schema (v2c)

Every artifact has two parts:

- **`outputs[]`** — deliverables: files, folders, or external URLs. The shape the **agent** sends differs from the shape **gates and prompt_context refs** see.
- **`data{}`** — arbitrary signal: ids, counts, approvals, anything that isn't a deliverable.

### Input shape (what the agent sends to `complete_governed_step`)

```jsonc
{
  "outputs": [
    {
      "name": "design",
      "kind": "file",
      "filename": "design.md",
      "content": "# Conception ...\n## Objectif\n..."
    },
    {
      "name": "proto",
      "kind": "folder",
      "files": {
        "index.html": "<!doctype html>...",
        "app.js": "console.log('hi')"
      }
    },
    {
      "name": "mr",
      "kind": "external_url",
      "url": "https://lab.enterprise.example/team/proj/-/merge_requests/42"
    }
  ],
  "data": {
    "ticket": "ISSUE-NN",
    "mr_iid": 42,
    "approvals_count": 1
  }
}
```

The Zod schema enforcing this lives in `server/src/mcp/tools/governed-workflows.tool.ts`.

### Persisted shape (what the DB and gates see)

After server-side commit, `kind: "file"` becomes `kind: "git_file"` and `kind: "folder"` becomes `kind: "git_folder"`. The `content` / `files` payload disappears, replaced by Git refs.

```jsonc
{
  "outputs": [
    {
      "name": "design",
      "kind": "git_file",
      "path": "artifacts/runs/<run_id>/<step_id>/design.md",
      "git_sha": "8d23e8a...",
      "branch": "mnm-runs/<run_id>",
      "bytes": 1247
    },
    {
      "name": "proto",
      "kind": "git_folder",
      "path": "artifacts/runs/<run_id>/<step_id>/proto/",
      "git_sha": "8d23e8a...",
      "branch": "mnm-runs/<run_id>",
      "files": ["index.html", "app.js"]
    },
    {
      "name": "mr",
      "kind": "external_url",
      "url": "https://lab.enterprise.example/team/proj/-/merge_requests/42"
    }
  ],
  "data": {
    "ticket": "ISSUE-NN",
    "mr_iid": 42,
    "approvals_count": 1
  }
}
```

`external_url` outputs pass through unchanged — they reference a remote resource that lives outside the workflow repo (typical case: the application MR or a wiki page).

## Authoring an agent prompt

The agent must produce schema 2c. Two anti-patterns to avoid:

- **Don't ask the agent to write files to the local FS** as a deliverable. Put the content directly in `outputs[i].content`. The server commits it.
- **Don't put deliverables in `data{}`**. `data{}` is for structured signal (ids, counts, approvals), not content.

A minimal example for an agent that produces a design document:

```markdown
## Output attendu (schema 2c)

```json
{
  "outputs": [
    {
      "name": "design",
      "kind": "file",
      "filename": "design.md",
      "content": "<contenu intégral en string JSON-escaped>"
    }
  ],
  "data": {
    "ticket": "<echo de la variable d'entrée>",
    "summary": "<une phrase résumant la conception>"
  }
}
```

For folders (e.g., a generated prototype of HTML/JS files), use `kind: "folder"` with a `files: { "<relative path>": "<content>" }` map. Subdirectories are flattened into the keys (`"src/index.js": "..."`).

For external resources (a GitLab MR, a Confluence page, a GitHub issue), use `kind: "external_url"` with the absolute URL.

## Authoring a gate

Gates run in an isolated-vm sandbox and receive the **persisted** form via `ctx.artifact`. To check whether a deliverable exists or read its metadata, scan `ctx.artifact.outputs[]`:

```typescript
const a = ctx.artifact;
if (!Array.isArray(a?.outputs)) return { pass: false, error_code: "ARTIFACT_INVALID", report: "..." };

const design = a.outputs.find(
  (o) => o.kind === "git_file" && o.path?.endsWith("design.md"),
);
if (!design) {
  return { pass: false, error_code: "DESIGN_MISSING", report: "design.md not produced" };
}
if (typeof design.bytes === "number" && design.bytes < 200) {
  return { pass: false, error_code: "DESIGN_TOO_SHORT", report: `design.md is ${design.bytes}b, want >= 200` };
}
return { pass: true, report: `design.md present (${design.bytes}b)` };
```

For checks that need the actual content (lint a markdown file, parse a JSON spec), use the `ctx.helpers.fetchHandoff` helper:

```typescript
const content = await ctx.helpers.fetchHandoff({ git_sha: design.git_sha, path: design.path });
if (!content.includes("## Tests prévus")) {
  return { pass: false, error_code: "DESIGN_INCOMPLETE", report: "missing test plan section" };
}
```

`fetchHandoff` is mediated by the host (gates have no network or filesystem access from the isolate).

For data fields, just read `ctx.artifact.data.<field>`:

```typescript
const data = ctx.artifact?.data ?? {};
const mrIid = data.mr_iid;
if (typeof mrIid !== "number" || mrIid <= 0) {
  return { pass: false, error_code: "MR_IID_MISSING", report: "data.mr_iid required" };
}
```

## prompt_context references

In `workflow.json`, a step's `prompt_context` can reference a previous step's outputs and data via `{{...}}` placeholders. The interpolation happens server-side before the prompt is handed to the orchestrator.

```jsonc
{
  "id": "review",
  "deps": ["dev"],
  "prompt_context": {
    "design_content": "{{steps.tech-design.artifact.outputs.design}}",
    "mr_iid":         "{{steps.dev.artifact.data.mr_iid}}",
    "ticket":         "{{variables.ticket_id}}"
  }
}
```

Resolution semantics for `{{steps.<id>.artifact.outputs.<name>}}`:

| Output kind | Substituted value |
|---|---|
| `git_file` | The **content** of the file, fetched eagerly from Git via `gitProvider.fetchBlob` |
| `external_url` | The `url` string |
| `git_folder` | A placeholder `<folder: <path>, <N> files>` (folder content is not inlined) |

`{{steps.<id>.artifact.data.<field>}}` resolves to the literal value in `data{}` (`String(v)` for scalars, `JSON.stringify(v)` for objects).

`{{variables.<name>}}` resolves to the run's launch param.

Path tokens may contain hyphens (workflow step IDs are kebab-case): `{{steps.tech-design.artifact.outputs.design}}` works.

## Run branch lifecycle

Every governed run gets its own branch in the workflow repo:

```
master ─────●────────────────────●─── ...
             \                    /
              `── mnm-runs/abc123 (all step commits)
```

1. **First step completion**: server commits the step's outputs onto `mnm-runs/<run_id>`, branched from `master`. If the branch doesn't exist yet, the GitLab `start_branch` parameter creates it.
2. **Subsequent steps**: each step adds a commit on top of the same branch. The branch accumulates: `tech-design/`, `dev/`, `review/`, `merge-tag/` directories under `artifacts/runs/<run_id>/`.
3. **Run terminal transition** (`completed` or `cancelled`):
   - A final commit adds `artifacts/runs/<run_id>/_run.json` summarizing the run (status, steps, timestamps, triggered_by).
   - The branch is merged into `master` with `--no-ff` (creates a merge commit).
   - The branch is deleted.

After completion, the run is replayable from `master` history alone — `git log --first-parent master` shows one merge commit per run, and the branch's commit graph is preserved through `--no-ff`.

The merge happens **outside the DB transaction**. If Git is slow or transiently down, the run state in the DB is already coherent (`completed`/`cancelled`); a Git failure logs an error but does not roll back state. The merge can be retried via cron or manually.

## Resume after `/clear`

When a user clears their orchestrator session mid-run, the `resume_governed_workflow_run` MCP tool reconstructs everything the next step needs:

```jsonc
// resume_governed_workflow_run(input: { run_id })
{
  "run_id": "abc-123",
  "workflow_name": "feature-dev",
  "workflow_git_tag": "feature-dev/v2.0.0",
  "status": "active",
  "history": [
    {
      "step_id": "tech-design",
      "state": "succeeded",
      "outputs": [{"name": "design", "kind": "git_file", ...}],
      "data": {"ticket": "ISSUE-NN", "approval": {...}},
      "started_at": "2026-04-28T13:00:00Z",
      "completed_at": "2026-04-28T13:05:00Z",
      "completed_by": "tom@enterprise.example"
    }
  ],
  "current_step": {
    "step_id": "dev",
    "state": "pending",
    "agent_name": "dev",
    "subagent_type": "mnm--dev",
    "prompt_context": { "design_md": "<full design.md content inlined>", ... },
    "handoffs": [
      {
        "name": "design",
        "kind": "git_file",
        "git_sha": "8d23e8a...",
        "path": "artifacts/runs/abc-123/tech-design/design.md",
        "branch": "mnm-runs/abc-123",
        "destination": ".mnm/handoffs/design.md"
      }
    ],
    "run_branch": "mnm-runs/abc-123"
  }
}
```

The orchestrator should:

1. Shallow-clone `run_branch` (or a single blob via the destination's `git_sha`) into `.mnm/handoffs/` at the paths suggested by `destination`.
2. Hand the `prompt_context` (already inlined) to the agent.
3. Continue with `complete_governed_step` as if the session had never been cleared.

`resume_governed_workflow_run` is **read-only** in terms of DB state — it does not transition pending steps to running and does not re-evaluate entry gates. If the current step was already `running` when the user cleared, it stays `running`.

## Commit author identity

Commits made by the server use:

1. The OAuth user's name + email from `authUsers` if the action was triggered by a logged-in user.
2. Otherwise a service account from env: `MNM_GIT_BOT_NAME` / `MNM_GIT_BOT_EMAIL` (defaults: `MnM bot` / `mnm-bot@mnm.local`).

The GitLab token used to make the call is independent of the commit author identity. With user OAuth, the GitLab UI shows the merge as authored by the user; with the service-account fallback, the bot name appears.

## Known limitations

- **`startBranch` is hardcoded to `"master"`** in `completeStep` and `mergeRunBranch`. Repos using `main` as the default branch will need this parameterized via company config.
- **Folder content is not inlined** in `prompt_context` (only a placeholder). If a downstream step needs the folder's files, the orchestrator must clone via `handoffs[]` and read locally.
- **Idempotence on retry**: if `complete_governed_step` is called twice for the same step, the advisory lock serializes the calls, but the second call will try to re-commit the same content (creating a redundant Git commit with the same tree). The DB persist overwrites with the new sha. No data is lost; the branch just has an extra commit.
- **Git operations inside the DB transaction**: `commitHandoffArtifacts` runs inside the `completeStep` transaction so a Git failure rolls back the DB and the step stays in its prior state for a clean retry. Trade-off: the Postgres connection is held during Git I/O (typically a few seconds). Acceptable for low-concurrency demo / single-tenant; should be reconsidered for high-throughput multi-tenant deployments.

## Reference

- Spec: `docs/superpowers/specs/2026-04-27-artifact-persistence-design.md`
- Plan: `docs/superpowers/plans/2026-04-27-artifact-persistence.md`
- Helpers: `server/src/services/governed-workflows-artifacts.ts`
- MCP tools: `server/src/mcp/tools/governed-workflows.tool.ts` (`complete_governed_step`, `launch_governed_step`, `resume_governed_workflow_run`)
- Types: `packages/shared/src/types/governed-workflows.ts` (`ArtifactInput`, `OutputInput`, `ArtifactPersisted`, `OutputPersisted`, `Handoff`)
