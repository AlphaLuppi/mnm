# Governed Workflows Studio — Multi-file editor + AI Assistant + Canonical gates

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Governed Workflow editor from a mono-file JSON editor into a proper studio: file tree on the left, Monaco on the center, AI chat assistant on the right. Ship 4 canonical reusable gate.ts examples. Fix the current silent-fail on GET /:name that makes users see the default template instead of the real workflow.

**Architecture:** New `WorkflowStudio` page replaces the old editor for edit mode (create mode stays on the simpler `GovernedWorkflowEditor`). Backend gets three new capabilities: `fetchTree` on GitProvider, `workflow-files` service + REST routes, AI chat proxy endpoint (SSE stream). Client uses `react-arborist` for the tree, Monaco multi-model for the editor, and a custom SSE-consuming chat panel. The AI uses the existing Claude integration path (same as Gold enrichment).

**Tech Stack:** React 18 + Monaco (multi-model) + react-arborist + Anthropic SDK (server-side SSE proxy) + Vitest + Drizzle + bun workspaces.

**Spec reference:** inline in this plan.

---

## File structure

### Created (frontend)
- `ui/src/pages/workflows/WorkflowStudio.tsx` — new 3-panel page for edit mode.
- `ui/src/components/workflow-studio/FileTree.tsx`
- `ui/src/components/workflow-studio/MonacoMultiEditor.tsx`
- `ui/src/components/workflow-studio/ValidationBadge.tsx`
- `ui/src/components/workflow-studio/AiAssistantPanel.tsx`
- `ui/src/hooks/useWorkflowFiles.ts`
- `ui/src/hooks/useAiAssistant.ts`
- Test file siblings for each above in `__tests__/`.

### Created (backend)
- `server/src/routes/governed-workflows-files.ts` — REST routes for tree + file + batch-commit.
- `server/src/services/governed-workflow-files.ts` — service functions on top of GitProvider.
- `server/src/routes/governed-workflows-ai.ts` — SSE chat endpoint.
- `server/src/services/workflow-ai-assistant.ts` — prompt building + Claude streaming.
- `packages/gate-runner/canonical/artifact-exists.gate.ts`
- `packages/gate-runner/canonical/artifacts-bundle.gate.ts`
- `packages/gate-runner/canonical/step-succeeded.gate.ts`
- `packages/gate-runner/canonical/review-pass.gate.ts`

### Modified
- `packages/git-provider/src/types.ts` — add `fetchTree`, `TreeEntry`.
- `packages/git-provider/src/local-bare-repo-provider.ts` — implement.
- `packages/git-provider/src/gitlab-provider.ts` — implement.
- `server/src/app.ts` — mount the 2 new route groups.
- `server/src/routes/governed-workflows-ui.ts` — fix silent try/catch on GET /:name so `parseError` reaches the UI.
- `server/src/mcp/tools/governed-workflows.tool.ts` — add `read_gate_source`, `list_workflow_files` for AI chain-of-thought.
- `ui/src/api/governed-workflows.ts` — `listFiles`, `getFile`, `batchCommit`, `streamAiChat`.
- `ui/src/lib/queryKeys.ts` — `governedWorkflows.files`, `.file` namespaces.
- `ui/src/App.tsx` — route `/workflows/:name` → `WorkflowStudio`.
- `ui/src/pages/GovernedWorkflowEditor.tsx` — keep for create mode only.
- `scripts/parity/data.ts` — add U13+U14 features.

### Deleted
None.

---

# Tranche U12.1 — Surface git-fetch errors on GET /:name

Goal: stop silently falling back to the default template when git fetch fails. The UI needs to know.

### Task U12.1.1: Return `parseError` instead of `parsed: null`

**Files:**
- Modify: `server/src/routes/governed-workflows-ui.ts`
- Modify: `ui/src/api/governed-workflows.ts` (type only)

- [ ] **Step 1: Replace silent try/catch**

In the `GET /:name` handler, change:
```ts
let parsed = null;
if (gitTag) {
  try { parsed = await svc.getWorkflowParsed({companyId, name, gitTag}); } catch {}
}
res.json({ definition: def, parsed: parsed ?? null });
```
to:
```ts
let parsed = null;
let parseError: { error_code: string; message: string; hints: string[] } | null = null;
if (gitTag) {
  try {
    parsed = await svc.getWorkflowParsed({companyId, name, gitTag});
  } catch (err) {
    parseError = {
      error_code: err instanceof GovernedWorkflowError ? err.code : "WORKFLOW_PARSE_FAILED",
      message: err instanceof Error ? err.message : String(err),
      hints: err instanceof GovernedWorkflowError ? err.hints : [],
    };
  }
}
res.json({ definition: def, parsed, parseError });
```

Import `GovernedWorkflowError` from `../services/governed-workflows.js`.

- [ ] **Step 2: Update API client type**

```ts
get: (companyId, name, opts?: {gitTag?: string}) => api.get<{
  definition: GovernedWorkflowDefinitionRow;
  parsed: {workflow: WorkflowDefinition; gitTag: string; gitSha: string} | null;
  parseError: {error_code: string; message: string; hints: string[]} | null;
}>(...)
```

- [ ] **Step 3: Unit test for the new shape**
- [ ] **Step 4: Commit**

```
fix(workflows): surface git-fetch errors on GET /:name instead of silent template fallback
```

---

# Tranche U13 — Multi-file workflow editor

Goal: the editor shows every file in the workflow's git directory (workflow.json + gates/*.ts + any other). User can click in the tree, edit any file, and save all dirty files in a single atomic commit.

### Task U13.1: Extend GitProvider with fetchTree

**Files:**
- Modify: `packages/git-provider/src/types.ts`
- Modify: `packages/git-provider/src/local-bare-repo-provider.ts`
- Modify: `packages/git-provider/src/gitlab-provider.ts`
- Modify: `packages/git-provider/src/__tests__/*`

- [ ] **Step 1: Add types**

```ts
export interface FetchTreeArgs {
  ref: string;
  subtree?: string; // repo-relative path prefix, no leading slash
  recursive?: boolean;
}
export interface TreeEntry {
  path: string;         // repo-relative, POSIX
  type: "blob" | "tree";
  sha: string;
  size: number | null;  // bytes, null for tree entries
}
// In GitProvider interface:
fetchTree(args: FetchTreeArgs): Promise<TreeEntry[]>;
```

- [ ] **Step 2: LocalBareRepoProvider implementation**

Shell out:
```ts
const flags = args.recursive ? ["-r", "-l"] : [];
const cmd = ["git", "--git-dir", this.repoDir, "ls-tree", ...flags, args.ref, `${args.subtree ?? ""}`];
```
Parse `mode type sha size\tpath\n`. Filter out entries whose path falls outside `subtree`.

- [ ] **Step 3: GitlabProvider implementation**

Call `GET /projects/:id/repository/tree?ref=<ref>&path=<subtree>&recursive=<true|false>&per_page=100`, paginate until done, map to `TreeEntry`.

- [ ] **Step 4: Unit tests — LocalBareRepoProvider**

Seed a bare repo with 2 files (workflow.json + gates/lint.ts), ref=tag, call fetchTree, assert 2 entries with correct shas and sizes.

- [ ] **Step 5: Unit tests — GitlabProvider**

Mock fetch. Assert URL + pagination behaviour + response mapping.

- [ ] **Step 6: Run all git-provider tests, commit**

```
feat(git-provider): fetchTree for listing files at a ref
```

### Task U13.2: workflowFilesService

**Files:**
- Create: `server/src/services/governed-workflow-files.ts`
- Create: `server/src/services/__tests__/governed-workflow-files.test.ts`

- [ ] **Step 1: Define the 3 helpers**

```ts
export async function listWorkflowFiles(
  deps: {resolveGitProvider, shaCache},
  args: {companyId, userId?: string, workflowName, ref},
): Promise<{tree: TreeEntry[]}>

export async function getWorkflowFile(
  deps,
  args: {companyId, userId?, workflowName, ref, path},
): Promise<{content: string, sha: string}>

export async function batchCommitWorkflowFiles(
  deps,
  args: {
    companyId, userId?, workflowName, branch,
    commitMessage, authorName, authorEmail,
    changes: Array<{path, content?: string, delete?: boolean}>,
  },
): Promise<{commitSha: string, newGitTag: string}>
```

For `batchCommitWorkflowFiles`: use GitLab's `POST /projects/:id/repository/commits` with an `actions` array (each action = create/update/delete). For LocalBareRepoProvider, do sequential `commitFile` calls on a temp branch then merge — or extend the local provider with an `actionsCommit` method. Simpler: add `commitMultipleFiles(changes)` to GitProvider interface.

- [ ] **Step 2: Extend GitProvider with commitMultipleFiles**

```ts
export interface CommitMultipleFilesArgs {
  branch: string;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
  actions: Array<{path: string, content?: string, delete?: boolean}>;
}
commitMultipleFiles(args: CommitMultipleFilesArgs): Promise<{sha: string}>;
```

Implement in both providers. GitLab maps to the commits API. Local builds a single commit touching all files via `git update-index` + `git write-tree` + `git commit-tree`.

- [ ] **Step 3: Implement the three service helpers**
- [ ] **Step 4: Unit tests with stub GitProvider**
- [ ] **Step 5: Commit**

```
feat(workflows): workflow-files service with tree + file + batch-commit
```

### Task U13.3: REST routes for workflow files

**Files:**
- Create: `server/src/routes/governed-workflows-files.ts`
- Create: `server/src/routes/__tests__/governed-workflows-files.test.ts`

Mount at `/api/companies/:cid/governed-workflows/:name/files`.

- [ ] **Step 1: Write failing integration tests**

Three tests:
- `GET /` with permission `workflows:read` → returns `{tree: [...]}`.
- `GET /:path` returns `{content, sha}` or 404.
- `PUT /` with permission `workflows:create` + body `{commitMessage, changes: [...]}` → 200 with `{commitSha, newGitTag}`.

- [ ] **Step 2: Implement handlers**

Each handler passes `{companyId, userId: req.actor.userId ?? null, ...}` to the service.

- [ ] **Step 3: Mount in app.ts**

Before the existing governedWorkflowUiRoutes mount to keep the order consistent:
```ts
api.use(
  "/companies/:companyId/governed-workflows/:name/files",
  governedWorkflowFilesRoutes(db),
);
```

- [ ] **Step 4: Full typecheck + route tests, commit**

```
feat(workflows): REST routes for workflow files + batch commit
```

### Task U13.4: UI API client + query keys

**Files:**
- Modify: `ui/src/api/governed-workflows.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Add methods**

```ts
listFiles: (companyId, name, opts?: {ref?: string}) =>
  api.get<{tree: TreeEntry[]}>(`${base(companyId)}/${encodeURIComponent(name)}/files${qs}`),
getFile: (companyId, name, path, opts?) =>
  api.get<{content: string, sha: string}>(`${base(companyId)}/${encodeURIComponent(name)}/files/${encodeURIComponent(path)}${qs}`),
batchCommit: (companyId, name, body: {commitMessage, changes}) =>
  api.put<{commitSha, newGitTag}>(`${base(companyId)}/${encodeURIComponent(name)}/files`, body),
```

- [ ] **Step 2: Add query keys**

```ts
governedWorkflows: {
  ...,
  files: (companyId, name, ref?) => ["governed-workflows", "files", companyId, name, ref ?? "latest"] as const,
  file: (companyId, name, path, ref?) => ["governed-workflows", "file", companyId, name, path, ref ?? "latest"] as const,
},
```

- [ ] **Step 3: Typecheck + commit**

```
feat(workflows): UI API client for workflow files
```

### Task U13.5: FileTree component

**Files:**
- Create: `ui/src/components/workflow-studio/FileTree.tsx`
- Create: `ui/src/components/workflow-studio/__tests__/FileTree.test.tsx`

- [ ] **Step 1: Install dep**

```bash
cd ui && bun add react-arborist
```

- [ ] **Step 2: Component contract**

Props:
```ts
interface FileTreeProps {
  tree: TreeEntry[];
  activePath: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onCreateFile?: (parentDir: string) => void;  // open a "new file" dialog
  onDelete?: (path: string) => void;
}
```

Group entries by their `/` segments into a nested structure. Leaf nodes display filename + optional "•" dirty dot. Directories are expandable.

- [ ] **Step 3: Implement**
- [ ] **Step 4: Unit tests (render tree, click triggers onSelect, dirty dot shows)**
- [ ] **Step 5: Commit**

```
feat(workflows): FileTree component for workflow studio
```

### Task U13.6: MonacoMultiEditor component

**Files:**
- Create: `ui/src/components/workflow-studio/MonacoMultiEditor.tsx`

Props:
```ts
interface MonacoMultiEditorProps {
  files: Record<string, {content: string, dirty: boolean}>;
  activePath: string | null;
  onChange: (path: string, content: string) => void;
  onBeforeMount?: (monaco: Monaco) => void; // for schema registration (U8 pattern)
}
```

- [ ] **Step 1: Implement model caching**

Keep a `Map<path, ITextModel>`. When activePath changes, `editor.setModel(map.get(activePath))`. Create models lazily on first view.

- [ ] **Step 2: Language detection**

`.json` → json, `.ts` → typescript, `.md` → markdown. For `.gate.ts`, register extraLibs with @mnm/gate-runner type definitions (preloaded at mount time via `monaco.languages.typescript.typescriptDefaults.addExtraLib`). The type definitions are shipped in the package as `.d.ts` — fetch them from `@mnm/gate-runner/types-bundle.d.ts` at build time.

- [ ] **Step 3: Commit**

```
feat(workflows): MonacoMultiEditor with model caching + TS extraLibs for gates
```

### Task U13.7: useWorkflowFiles hook

**Files:**
- Create: `ui/src/hooks/useWorkflowFiles.ts`
- Create: `ui/src/hooks/__tests__/useWorkflowFiles.test.ts`

- [ ] **Step 1: Hook contract**

```ts
export function useWorkflowFiles({companyId, name, ref}): {
  tree: TreeEntry[] | undefined;
  files: Record<string, {content: string, dirty: boolean}>;
  activePath: string | null;
  setActivePath: (p: string) => void;
  editFile: (path: string, newContent: string) => void;
  addFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  dirtyCount: number;
  save: (commitMessage: string) => Promise<{newGitTag: string}>;
  isLoading: boolean;
  error: Error | null;
}
```

- [ ] **Step 2: Implementation**

- `useQuery` for tree via `listFiles`.
- Lazy load file contents on first `setActivePath(path)` via `getFile`.
- Maintain `files` state in a reducer. Dirty = content !== original.
- `save`: collect dirty files into `changes`, call `batchCommit`, on success invalidate files + list + detail queries.

- [ ] **Step 3: Tests** — mock API, simulate edit flow.

- [ ] **Step 4: Commit**

```
feat(workflows): useWorkflowFiles hook — lazy file loading + batch save
```

### Task U13.8: WorkflowStudio page

**Files:**
- Create: `ui/src/pages/workflows/WorkflowStudio.tsx`
- Create: `ui/src/pages/workflows/__tests__/WorkflowStudio.test.tsx`

- [ ] **Step 1: Page skeleton**

Layout (CSS grid):
```
┌──────────┬────────────────┬────────────┐
│ FileTree │ MonacoMulti    │ (AI, U14)  │  
│ (240px)  │ (flex)         │ (340px)    │
├──────────┴────────────────┤            │
│ ValidationBadge           │            │
└───────────────────────────┴────────────┘
```

Header: workflow name + tag badge + Save button.

- [ ] **Step 2: Wire**

```tsx
const {tree, files, activePath, setActivePath, editFile, save, dirtyCount} = useWorkflowFiles({companyId, name});
const {data: workflow, parseError} = useQuery(queryKeys.governedWorkflows.detail(...));

return (
  <div className="grid grid-cols-[240px_1fr] gap-0 h-full">
    {parseError && <Alert>{parseError.message} — <Button onClick={...}>Retry</Button></Alert>}
    <FileTree tree={tree ?? []} activePath={activePath} dirtyPaths={new Set(...)} onSelect={setActivePath} />
    <MonacoMultiEditor files={files} activePath={activePath} onChange={editFile} />
    <ValidationBadge validation={...} onClick={...} />
    <Button disabled={!dirtyCount} onClick={openSaveDialog}>Save ({dirtyCount})</Button>
    <SaveDialog .../>
  </div>
);
```

- [ ] **Step 3: Commit message dialog**

Reuse existing AlertDialog pattern with commitMessage Textarea + displayed next-tag hint (from U7).

- [ ] **Step 4: Save handler** — calls `save(commitMessage)`, on success navigate to `/workflows/:name/runs`.

- [ ] **Step 5: Route in App.tsx** — replace `/workflows/:name` → `<WorkflowStudio />`.

- [ ] **Step 6: Tests** — mock hook, assert layout + save flow.

- [ ] **Step 7: Commit**

```
feat(workflows): WorkflowStudio — 3-panel multi-file editor page
```

### Task U13.9: Wire routes + tree flip for U14 slot

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/pages/GovernedWorkflowEditor.tsx`

- [ ] **Step 1: Keep `GovernedWorkflowEditor` for create mode only**

Route `/workflows/new` still points to the old `GovernedWorkflowEditor` (simpler single-file editor). Route `/workflows/:name` now points to `WorkflowStudio`.

- [ ] **Step 2: Reserve the right-third of WorkflowStudio for U14** — leave a blank `<aside>` with a comment "TODO U14: AI Assistant" so merging U14 only touches that aside.

- [ ] **Step 3: Commit**

```
feat(workflows): route edit mode to WorkflowStudio, create stays on old editor
```

---

# Tranche U14 — AI Assistant Panel

Goal: right panel is a Claude chat that proposes workflow.json modifications + gate.ts drafts + explanations. User applies each proposal explicitly.

### Task U14.1: AI assistant service + endpoint

**Files:**
- Create: `server/src/services/workflow-ai-assistant.ts`
- Create: `server/src/routes/governed-workflows-ai.ts`
- Create: `server/src/routes/__tests__/governed-workflows-ai.test.ts`

- [ ] **Step 1: System prompt template (French)**

```
Tu es l'assistant éditeur de Governed Workflows MnM.
Tu aides l'utilisateur à créer, modifier, ou comprendre des workflows JSON et leurs gates TypeScript.

Contrat de réponse:
- Pour une modification de fichier, utilise EXACTEMENT:
  <file path="<repo-relative-path>">
  <content here, NOT escaped>
  </file>
- Pour une suppression:
  <file path="<path>" delete="true" />
- Pour une explication ou question, réponds en français naturellement.
- Ne propose JAMAIS de modifier plusieurs fichiers sans avertir l'utilisateur.

Schema zod du workflow (workflowDefinitionSchema):
<!-- embed schema here -->

Gates canoniques disponibles dans @mnm/gate-runner/canonical/:
- artifact-exists.gate.ts — vérifie qu'un fichier existe (config: path, min_bytes?)
- artifacts-bundle.gate.ts — vérifie qu'un bundle existe (config: required_paths[])
- step-succeeded.gate.ts — vérifie qu'un step a succeeded (config: step)
- review-pass.gate.ts — vérifie qu'une review passe un seuil (config: min_score, report_path)

Contexte courant — workflow.json en cours d'édition:
<!-- embed current JSON -->

Les gates locales actuellement présentes dans ce workflow:
<!-- embed list of gates/*.ts found by listFiles -->

Tu NE COMMIT JAMAIS directement. Tes propositions sont revues par l'utilisateur.
```

- [ ] **Step 2: Service signature**

```ts
export interface ChatInput {
  companyId: string;
  userId: string | null;
  workflowName: string;
  messages: Array<{role: "user" | "assistant", content: string}>;
}

export async function* streamWorkflowAiChat(
  db: Db,
  anthropicClient,
  deps: {resolveGitProvider, shaCache},
  input: ChatInput,
): AsyncGenerator<{type: "token" | "file-proposal" | "error", ...}>
```

Internally:
1. Load current workflow.json content from git via resolveGitProvider.
2. Load the tree to list gates.
3. Build the system prompt with embedded context.
4. Stream Claude via the Messages API with `stream: true`.
5. Parse the incoming text for `<file>` blocks; yield them as `file-proposal` events as they complete.

- [ ] **Step 3: REST route as SSE stream**

```
POST /api/companies/:cid/governed-workflows/:name/ai/chat
Body: {messages: [...]}
Response: text/event-stream
  data: {"type":"token","value":"..."}
  data: {"type":"file-proposal","path":"...","content":"...","delete?":true}
  data: {"type":"done"}
```

Permission: `workflows:create`.

- [ ] **Step 4: Anthropic client integration**

Reuse the existing client (grep `Anthropic\|anthropic` in `server/src/` — the Gold enrichment path uses it; share config via `ANTHROPIC_API_KEY` env var). Select model: `claude-sonnet-4-6` for quality.

- [ ] **Step 5: Tests**

Mock Anthropic client to emit a scripted stream. Assert SSE frames + file-proposal parsing.

- [ ] **Step 6: Commit**

```
feat(workflows): AI assistant SSE endpoint for workflow editing
```

### Task U14.2: MCP tools for AI chain-of-thought (optional, stretch)

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`

Add:
- `list_workflow_files({name, git_tag?})` — wraps the new tree service.
- `read_workflow_file({name, path, git_tag?})` — wraps getWorkflowFile.
- (get_governed_workflow_run already exists)

These let the AI enrich its context by "tooling" when the initial prompt lacks detail.

- [ ] **Step 1: Register + tests + commit**

```
feat(workflows): MCP tools for workflow files (list + read) for AI chain-of-thought
```

### Task U14.3: Client SSE wrapper + hook

**Files:**
- Modify: `ui/src/api/governed-workflows.ts` — add `streamAiChat`.
- Create: `ui/src/hooks/useAiAssistant.ts`

- [ ] **Step 1: SSE wrapper**

```ts
streamAiChat: (companyId, name, messages, {onToken, onFileProposal, onDone, signal}) => {
  // Use fetch + ReadableStream (EventSource doesn't support POST body).
  // Cross-origin to :3100 in dev like linkSocial.
}
```

- [ ] **Step 2: Hook**

```ts
export function useAiAssistant({companyId, name}): {
  messages: Message[];
  streaming: boolean;
  pendingProposals: FileProposal[];
  sendPrompt: (text: string) => Promise<void>;
  applyProposal: (index: number) => void;  // forwarded to WorkflowStudio
  dismissProposal: (index: number) => void;
  clear: () => void;
}
```

- [ ] **Step 3: Tests + commit**

```
feat(workflows): useAiAssistant hook with SSE streaming + proposal queue
```

### Task U14.4: AiAssistantPanel component

**Files:**
- Create: `ui/src/components/workflow-studio/AiAssistantPanel.tsx`
- Create: `ui/src/components/workflow-studio/__tests__/AiAssistantPanel.test.tsx`

Layout:
- Header: "Assistant IA" + "Clear" button
- Scrollable messages list:
  - User: right-aligned, muted bg
  - Assistant: left-aligned, code blocks highlighted
  - Pending proposal: Card with filename, diff preview (~5 lines), "Appliquer" + "Rejeter"
- Footer: Textarea + Send button (Cmd+Enter shortcut)

- [ ] **Step 1: Implement**
- [ ] **Step 2: Integrate in WorkflowStudio** — wire `applyProposal` to `useWorkflowFiles.editFile` or `addFile`.
- [ ] **Step 3: Tests** — mock hook, simulate send + receive + apply proposal.
- [ ] **Step 4: Commit**

```
feat(workflows): AiAssistantPanel — chat + proposal apply in the editor
```

### Task U14.5: ValidationBadge replaces the validation panel

**Files:**
- Create: `ui/src/components/workflow-studio/ValidationBadge.tsx`

- [ ] **Step 1: Implementation**

Compact pill shown bottom-center of WorkflowStudio:
- Valid JSON: green `<Badge>JSON valide</Badge>`
- Invalid: red `<Badge>{N} erreurs</Badge>` — click opens a `<Sheet>` drawer with the full issue list (path + message).

- [ ] **Step 2: Integrate + tests + commit**

```
feat(workflows): ValidationBadge — compact validation UX, frees the right panel for AI
```

### Task U14.6: Parity tracker + progress log

**Files:**
- Modify: `scripts/parity/data.ts`
- Modify: `docs/superpowers/plans/progress-2026-04-24-governed-workflows-ui.md`

Add features `governed-workflows-studio-editor` and `governed-workflows-ai-assistant` (web: done, desktop: missing). Append a `### U13+U14 — Workflow Studio` section to the progress log with all commit SHAs.

- [ ] **Step 1: Update + commit**

```
chore(parity): track workflow studio + AI assistant features
```

---

# Tranche U15 — Canonical gate.ts library

Goal: 4 reusable gate implementations that match the declarations in `product-feature-delivery/workflow.json`, so MnM founder can:
1. Copy them via the new Studio into his workflow repo's `gates/` folder.
2. Launch a run end-to-end and have the gates actually evaluate.

### Task U15.1: artifact-exists.gate.ts

**Files:**
- Create: `packages/gate-runner/canonical/artifact-exists.gate.ts`
- Create: `packages/gate-runner/canonical/__tests__/artifact-exists.gate.test.ts`

- [ ] **Step 1: Implementation**

```ts
import type { GateContext, GateResult } from "../src/types.js";

export async function gate(ctx: GateContext): Promise<GateResult> {
  const path = String(ctx.config.path ?? "");
  const minBytes = Number(ctx.config.min_bytes ?? 0);
  if (!path) {
    return { pass: false, report: "Config 'path' is required", error_code: "GATE_INVALID_CONFIG", hints: ["Set gates.*.config.path"] };
  }
  const blob = await ctx.workspace.readFile(path).catch(() => null);
  if (!blob) {
    return { pass: false, report: `File '${path}' does not exist`, error_code: "ARTIFACT_MISSING", hints: [`Create ${path} before this gate runs`] };
  }
  if (blob.length < minBytes) {
    return { pass: false, report: `File '${path}' is ${blob.length} bytes, minimum ${minBytes}`, error_code: "ARTIFACT_TOO_SMALL", hints: [] };
  }
  return { pass: true, report: `File '${path}' present (${blob.length} bytes)` };
}
```

- [ ] **Step 2: Tests** with the sandbox harness.
- [ ] **Step 3: Commit**

```
feat(gate-runner): canonical artifact-exists gate
```

### Task U15.2: artifacts-bundle.gate.ts

Same pattern but iterates over `ctx.config.required_paths: string[]`. Returns the first missing path as the primary failure, lists remaining in `report`. `hints` includes the `hint` field from config if present.

- [ ] Standard TDD + commit.

### Task U15.3: step-succeeded.gate.ts

Uses `ctx.run.steps.find(s => s.stepIdInJson === ctx.config.step)`. Pass iff `state === "succeeded"`. Report names the step + its current state.

- [ ] Standard TDD + commit.

### Task U15.4: review-pass.gate.ts

Parses `ctx.workspace.readFile(ctx.config.report_path)` as markdown or JSON. Looks for a score via a simple regex (`/score[^0-9]+([0-9])/i`) or a JSON field. Compares to `min_score`. Passes if score >= min_score, fails otherwise with the found score in report.

- [ ] Standard TDD + commit.

### Task U15.5: Push the canonical gates to MnM founder's workflow repo

**Via the new WorkflowStudio (from U13):**
- Open `/votre organisation/workflows/product-feature-delivery`
- File tree → right-click on `product-feature-delivery/gates/` → Add File
- Paste each canonical gate content (or: Copy from `@mnm/gate-runner/canonical/`)
- Save → batch commit → new tag `product-feature-delivery/v1.0.1`

- [ ] Run an E2E: `launch_governed_workflow` via MCP → verify each step traverses its gates without GATE_SOURCE_NOT_FOUND → runs to `completed`.

- [ ] Commit (no code): the commit is the one pushed to your-username/mnm-workflows-demo via the Studio.

---

# Post-merge verification

1. `bun run typecheck` — 15/15 packages pass.
2. `bun run test --filter='!e2e'` — no new failures beyond pre-existing Windows-embedded-postgres ones.
3. Manual E2E smoke (the important one):
   - Open WorkflowStudio on product-feature-delivery → file tree shows workflow.json + 4 gates/*.ts.
   - Click a gate → Monaco shows TS with type-aware autocomplete on `GateContext`.
   - Edit description of workflow.json + a hint in one gate → Save → commit lands on GitLab under your-username + new tag.
   - AI panel: prompt "ajoute une step de préprod entre review et merge, avec une entry gate qui vérifie que docs/preprod-checks.md existe" → AI proposes diff → Apply → review → Save.
   - Launch a run via MCP `launch_governed_workflow` → step 1 runs → gate evaluates → step 2 unblocked → ... → run ends `completed`.
4. Parity tracker shows both new features.
5. Progress log appended.

---

# Dispatch strategy (when executing)

Tranche-by-tranche, sequential subagents:
- **U12.1** — small, standalone, quick win (~15 min).
- **U13.1 → U13.9** — sequential, each task atomic with its commit; agent dispatch per task OR per 2 tasks grouped (e.g. U13.1 + U13.2 git-provider pair).
- **U14.1 → U14.6** — can start in parallel with U13.5+ if the file tree is ready; otherwise sequential.
- **U15.1 → U15.5** — can run in parallel with U14 (pure new files, no conflict).

Each subagent prompt must carry the driving constraints: conventional commits scope `workflows` (or `auth`, `git-provider` where applicable), no emojis, GPG fallback `-c commit.gpgsign=false`, no polling, use `ui/src/components/ui/` primitives only, SSE via existing live-events or our new AI endpoint.

---

## Driving constraints (every commit)

- Conventional commits, scope `workflows` / `auth` / `git-provider` / `gate-runner`. No emojis.
- GPG fallback `-c commit.gpgsign=false`.
- Atomic commit + push per task.
- Never polling; SSE for streaming.
- UI primitives from `ui/src/components/ui/` only — if missing, scaffold first.
- Dynamic RBAC (permissions `workflows:read`, `workflows:create`, `workflows:enforce`).
- Error contract `{isError, error_code, message, hints[]}` on 4xx paths.
- Update `scripts/parity/data.ts` + progress log per tranche.
- Run `npx gitnexus analyze` after each tranche.
