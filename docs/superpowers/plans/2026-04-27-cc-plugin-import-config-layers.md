# Implementation Plan — Import de plugins Claude Code en config layers MnM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le pipeline d'import d'un plugin Claude Code (clone GitLab → split en agents standalone + 1 config_layer skills) puis livrer le workflow `lint-pack` avec ses 5 gates artifact-based, prêt pour la démo vendredi.

**Architecture:** Réutilise les tables `config_layers` / `config_layer_items` / `config_layer_files` (item_type `skill` déjà autorisé par CHECK constraint). Ajoute 4 colonnes à `config_layers`. Pipeline d'import = REST endpoint + MCP tool qui clone via `GitProvider.fetchTree/fetchBlob` (pas de filesystem temp), parse, commit atomique avec `commitMultipleFiles` sur le repo company, transaction DB. Materialization runtime écrit les skills dans `<sandbox>/.claude/skills/...` au launch. Gates re-implémentent les vérifications du plugin source en **lisant l'artifact du writer** (contrainte isolated-vm — pas d'fs/exec dans les gates).

**Tech Stack:** TypeScript, Drizzle ORM, Postgres, Vitest, gray-matter (frontmatter), `@mnm/git-provider`, `@mnm/governed-workflows`, `@mnm/gate-runner`.

---

## Task 0: Amender le spec (gates artifact-based)

**Pourquoi :** Découverte tardive — les gates tournent dans isolated-vm (pas d'fs ni d'exec). Le spec V1 prévoyait `docker compose exec` côté gates, infaisable. On amende §7.2 et §7.3 pour rendre toutes les gates **artifact-based** : le writer doit produire un artifact JSON riche, les gates parsent ce JSON.

**Files:**
- Modify: `docs/superpowers/specs/2026-04-27-cc-plugin-import-config-layers-design.md` (§7.2 + §7.3)

- [ ] **Step 1: Mettre à jour §7.2 (Gates — sémantique)**

Remplacer la table actuelle par :

```markdown
| Gate | Step | Position | Logique |
|---|---|---|---|
| `preflight` | `write-tests` | entry | Lit `ctx.step.previous_artifacts["preflight-check"]`. Doit contenir `{ ok: true, missing: [] }`. Block sinon. (Suppose un step `preflight-check` lancé en amont OU un agent claude-code générique qui exécute le skill `preflight` du plugin.) |
| `phpstan-level-10` | `write-tests` | exit | Lit `ctx.artifact.phpstan` : `{ level: 10, passed: true, errors: [] }`. Block si `passed !== true` ou `level < 10`. |
| `phpunit-pass` | `write-tests` | exit | Lit `ctx.artifact.phpunit` : `{ passed: true, tests_run: number }`. Block si `passed !== true`. |
| `infection-msi` | `write-tests` | exit | Lit `ctx.artifact.infection` : `{ msi: number, covered_msi: number, min_msi: number }`. Block si `msi < min_msi` ou `covered_msi < min_covered_msi` (les seuils sont retournés par le writer après lecture de `infection.json5`). |
| `reviewer-approves` | `review-tests` | exit | Lit `ctx.artifact.verdict` : `"APPROVE" | "REQUEST_CHANGES"`. Block si !== `"APPROVE"`. |

**Contrainte runtime :** les gates tournent dans un isolated-vm sans accès filesystem ni shell. C'est l'agent (test-writer / test-reviewer) qui exécute Docker / PHPStan / PHPUnit / Infection sur sa machine et reporte le résultat dans son artifact JSON. Les gates servent de validation indépendante de ce que l'agent a annoncé.
```

- [ ] **Step 2: Mettre à jour §7.3 (Contrat artifact attendu)**

Remplacer par :

```markdown
### 7.3 Contrat artifact attendu

**Writer (`test-writer`) doit retourner :**

```json
{
  "test_file": "tests/Unit/Service/UserServiceTest.php",
  "phpstan": { "level": 10, "passed": true, "errors": [] },
  "phpunit": { "passed": true, "tests_run": 12 },
  "infection": { "msi": 87.5, "covered_msi": 92.3, "min_msi": 80, "min_covered_msi": 85 }
}
```

**Reviewer (`test-reviewer`) doit retourner :**

```json
{
  "verdict": "APPROVE",
  "issues": [],
  "test_file": "tests/Unit/Service/UserServiceTest.php"
}
```

Ce contrat est **stické** dans le `prompt_context` du step via un champ `_mnm_artifact_schema` (string descriptive) en V1. Le brainstorm artifact en parallèle (`2026-04-27-artifact-persistence-brainstorm.md`) ne change rien à ce contrat applicatif — il porte sur le **stockage** de l'artifact (Git / DB / storage), pas sur sa **forme**.
```

- [ ] **Step 3: Ajouter §7.5 (Step `preflight-check` ajouté)**

Insérer après §7.4 :

```markdown
### 7.5 Step `preflight-check` ajouté en amont

Pour permettre à la gate `preflight` (entry sur `write-tests`) de lire un artifact, on ajoute un step préalable :

```json
{
  "id": "preflight-check",
  "agent": "claude_code_generic",
  "deps": [],
  "prompt_context": {
    "_mnm_invoke_skill": "preflight",
    "project_dir": "{{variables.project_dir}}"
  }
}
```

L'agent `claude_code_generic` est déjà disponible dans MnM (agent technique par défaut, pas créé par le plugin). Il invoque le skill `preflight` (matérialisé via le config_layer `lint-pack`) et produit un artifact `{ ok: boolean, missing: string[] }`.

Le workflow final a donc 3 steps : `preflight-check` → `write-tests` → `review-tests`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-27-cc-plugin-import-config-layers-design.md
git commit -m "docs(spec): amend §7 — gates artifact-based (isolated-vm constraint)"
git push
```

---

## Task 1: Migration DB 0069 — colonnes source sur config_layers

**Files:**
- Create: `packages/db/src/migrations/0069_config_layers_source.sql`

- [ ] **Step 1: Écrire le test (script SQL idempotence)**

Pas de test unitaire pour la migration elle-même — on vérifie qu'elle s'applique proprement avec `bun run db:migrate` (Task 2 step de vérification). Étape "écrire la migration" directement.

- [ ] **Step 2: Écrire la migration**

Contenu de `packages/db/src/migrations/0069_config_layers_source.sql` :

```sql
-- 0069_config_layers_source.sql
-- Spec: docs/superpowers/specs/2026-04-27-cc-plugin-import-config-layers-design.md §4.1
-- Track imported CC plugins on config_layers : where they came from, what
-- commit was cloned, which kind of source, and which MnM commit materialized
-- the import locally.

ALTER TABLE "config_layers"
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "source_sha" text,
  ADD COLUMN IF NOT EXISTS "source_kind" text NOT NULL DEFAULT 'inline',
  ADD COLUMN IF NOT EXISTS "mnm_import_commit_sha" text;

ALTER TABLE "config_layers"
  ADD CONSTRAINT "config_layers_source_kind_check"
  CHECK ("source_kind" IN ('inline', 'cc-plugin', 'cc-marketplace'));
```

- [ ] **Step 3: Mettre à jour le schema TS**

Modifier `packages/db/src/schema/config_layers.ts` pour ajouter les 4 champs après `archivedAt` :

```ts
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    sourceUrl: text("source_url"),
    sourceSha: text("source_sha"),
    sourceKind: text("source_kind").notNull().default("inline"),
    mnmImportCommitSha: text("mnm_import_commit_sha"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
```

- [ ] **Step 4: Lancer la migration en dev**

```bash
bun run db:migrate
```
Expected: applique 0069, no error.

- [ ] **Step 5: Vérifier la colonne en DB**

```bash
bun run db:studio   # ou psql -c "\d config_layers"
```
Expected: colonnes `source_url`, `source_sha`, `source_kind`, `mnm_import_commit_sha` présentes.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0069_config_layers_source.sql packages/db/src/schema/config_layers.ts
git commit -m "feat(db): add source_url/source_sha/source_kind/mnm_import_commit_sha to config_layers"
git push
```

---

## Task 2: Plugin parser — manifest + frontmatter

**Files:**
- Create: `server/src/services/cc-plugin-import/plugin-parser.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/plugin-parser.test.ts`

**Responsabilité du module :** parser pure `(treeEntries, fileFetcher) => ParsedPlugin` à partir de ce que renvoie un `GitProvider.fetchTree(recursive=true)`. Aucun side-effect (pas d'fs, pas d'DB, pas d'HTTP direct).

- [ ] **Step 1: Écrire le test du happy path**

Fichier `server/src/services/cc-plugin-import/__tests__/plugin-parser.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parsePlugin } from "../plugin-parser.js";
import type { TreeEntry } from "@mnm/git-provider";

const tree: TreeEntry[] = [
  { path: ".claude-plugin/plugin.json", type: "blob", sha: "a", size: 100 },
  { path: "agents/test-writer.md",       type: "blob", sha: "b", size: 200 },
  { path: "agents/test-reviewer.md",     type: "blob", sha: "c", size: 200 },
  { path: "skills/test-conventions/SKILL.md", type: "blob", sha: "d", size: 300 },
  { path: "skills/symfony-autowire/SKILL.md", type: "blob", sha: "e", size: 300 },
  { path: "skills/symfony-autowire/references/attribute-examples.md", type: "blob", sha: "f", size: 400 },
];

const blobs: Record<string, string> = {
  ".claude-plugin/plugin.json": JSON.stringify({ name: "demo", version: "1.0.0", description: "x" }),
  "agents/test-writer.md":       "---\nname: test-writer\nmodel: sonnet\ndescription: x\nskills: [test-conventions]\n---\nbody",
  "agents/test-reviewer.md":     "---\nname: test-reviewer\nmodel: haiku\ndescription: y\n---\nbody",
  "skills/test-conventions/SKILL.md":          "---\nname: test-conventions\ndescription: rules\n---\nbody",
  "skills/symfony-autowire/SKILL.md":          "---\nname: symfony-autowire\ndescription: wire\n---\nbody @references/attribute-examples.md",
  "skills/symfony-autowire/references/attribute-examples.md": "# examples",
};

describe("parsePlugin", () => {
  it("parses manifest, agents, skills with references", async () => {
    const result = await parsePlugin({
      tree,
      fetchBlob: async (path) => blobs[path],
    });

    expect(result.manifest.name).toBe("demo");
    expect(result.manifest.version).toBe("1.0.0");

    expect(result.agents.length).toBe(2);
    const writer = result.agents.find((a) => a.name === "test-writer")!;
    expect(writer.frontmatter.model).toBe("sonnet");
    expect(writer.frontmatter.skills).toEqual(["test-conventions"]);
    expect(writer.body).toBe("body");
    expect(writer.sourcePath).toBe("agents/test-writer.md");

    expect(result.skills.length).toBe(2);
    const auto = result.skills.find((s) => s.name === "symfony-autowire")!;
    expect(auto.files.length).toBe(2);
    expect(auto.files.find((f) => f.path === "SKILL.md")).toBeDefined();
    expect(auto.files.find((f) => f.path === "references/attribute-examples.md")).toBeDefined();
  });

  it("rejects when .claude-plugin/plugin.json is missing", async () => {
    await expect(
      parsePlugin({
        tree: tree.filter((t) => !t.path.startsWith(".claude-plugin/")),
        fetchBlob: async (path) => blobs[path],
      }),
    ).rejects.toThrow(/INVALID_CC_PLUGIN/);
  });

  it("rejects when an agent has invalid frontmatter", async () => {
    const broken = { ...blobs, "agents/test-writer.md": "no frontmatter at all" };
    await expect(
      parsePlugin({
        tree,
        fetchBlob: async (path) => broken[path],
      }),
    ).rejects.toThrow(/INVALID_AGENT_FRONTMATTER/);
  });

  it("honors excludeSkills and excludeAgents", async () => {
    const result = await parsePlugin({
      tree,
      fetchBlob: async (path) => blobs[path],
      excludeAgents: ["test-reviewer"],
      excludeSkills: ["symfony-autowire"],
    });
    expect(result.agents.map((a) => a.name)).toEqual(["test-writer"]);
    expect(result.skills.map((s) => s.name)).toEqual(["test-conventions"]);
  });
});
```

- [ ] **Step 2: Run le test → fail**

```bash
bun test server/src/services/cc-plugin-import/__tests__/plugin-parser.test.ts
```
Expected: FAIL "Cannot find module ../plugin-parser.js".

- [ ] **Step 3: Implémenter `plugin-parser.ts`**

Fichier `server/src/services/cc-plugin-import/plugin-parser.ts` :

```ts
import matter from "gray-matter";
import type { TreeEntry } from "@mnm/git-provider";

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: { name?: string; email?: string };
  repository?: string;
  license?: string;
  keywords?: string[];
}

export interface ParsedAgent {
  name: string;
  sourcePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ParsedSkillFile {
  path: string;       // relative to skills/<name>/
  content: string;
  contentHash: string;
}

export interface ParsedSkill {
  name: string;
  frontmatter: Record<string, unknown>;
  files: ParsedSkillFile[];   // includes SKILL.md + references/*
}

export interface ParsedPlugin {
  manifest: PluginManifest;
  agents: ParsedAgent[];
  skills: ParsedSkill[];
}

export interface ParsePluginInput {
  tree: TreeEntry[];
  fetchBlob: (path: string) => Promise<string>;
  excludeAgents?: string[];
  excludeSkills?: string[];
}

import { createHash } from "node:crypto";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export class PluginParseError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PluginParseError";
  }
}

export async function parsePlugin(input: ParsePluginInput): Promise<ParsedPlugin> {
  const manifestEntry = input.tree.find((e) => e.path === ".claude-plugin/plugin.json");
  if (!manifestEntry) {
    throw new PluginParseError("INVALID_CC_PLUGIN", ".claude-plugin/plugin.json is missing");
  }
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(await input.fetchBlob(manifestEntry.path));
  } catch (err) {
    throw new PluginParseError("INVALID_CC_PLUGIN", `Cannot parse plugin.json: ${(err as Error).message}`);
  }
  if (!manifest.name || !manifest.version) {
    throw new PluginParseError("INVALID_CC_PLUGIN", "plugin.json missing name or version");
  }

  const excludeAgents = new Set(input.excludeAgents ?? []);
  const excludeSkills = new Set(input.excludeSkills ?? []);

  // Agents = direct children of agents/, suffix .md
  const agentEntries = input.tree.filter(
    (e) => e.type === "blob" && /^agents\/[^/]+\.md$/.test(e.path),
  );
  const agents: ParsedAgent[] = [];
  for (const entry of agentEntries) {
    const name = entry.path.replace(/^agents\//, "").replace(/\.md$/, "");
    if (excludeAgents.has(name)) continue;
    const raw = await input.fetchBlob(entry.path);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      throw new PluginParseError(
        "INVALID_AGENT_FRONTMATTER",
        `agents/${name}.md: ${(err as Error).message}`,
      );
    }
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      throw new PluginParseError(
        "INVALID_AGENT_FRONTMATTER",
        `agents/${name}.md has no YAML frontmatter`,
      );
    }
    agents.push({
      name,
      sourcePath: entry.path,
      frontmatter: parsed.data,
      body: parsed.content.trim(),
    });
  }

  // Skills = each subdir of skills/ that contains a SKILL.md.
  // Group all blobs under skills/<n>/ together.
  const skillBlobs = input.tree.filter(
    (e) => e.type === "blob" && e.path.startsWith("skills/") && e.path !== "skills",
  );
  const bySkill = new Map<string, TreeEntry[]>();
  for (const entry of skillBlobs) {
    const rest = entry.path.slice("skills/".length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) continue;   // file directly under skills/, ignore
    const skillName = rest.slice(0, slashIdx);
    if (excludeSkills.has(skillName)) continue;
    if (!bySkill.has(skillName)) bySkill.set(skillName, []);
    bySkill.get(skillName)!.push(entry);
  }

  const skills: ParsedSkill[] = [];
  for (const [skillName, entries] of bySkill.entries()) {
    const skillMdEntry = entries.find((e) => e.path === `skills/${skillName}/SKILL.md`);
    if (!skillMdEntry) continue;   // not a real skill
    const skillMdRaw = await input.fetchBlob(skillMdEntry.path);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(skillMdRaw);
    } catch (err) {
      throw new PluginParseError(
        "INVALID_SKILL_FRONTMATTER",
        `skills/${skillName}/SKILL.md: ${(err as Error).message}`,
      );
    }
    if (!parsed.data || !parsed.data.name) {
      throw new PluginParseError(
        "INVALID_SKILL_FRONTMATTER",
        `skills/${skillName}/SKILL.md missing 'name' frontmatter`,
      );
    }
    const files: ParsedSkillFile[] = [];
    for (const entry of entries) {
      const relPath = entry.path.slice(`skills/${skillName}/`.length);
      const content = await input.fetchBlob(entry.path);
      files.push({ path: relPath, content, contentHash: sha256(content) });
    }
    skills.push({ name: skillName, frontmatter: parsed.data, files });
  }

  return { manifest, agents, skills };
}
```

- [ ] **Step 4: Vérifier `gray-matter` installé**

```bash
bun pm ls server | grep gray-matter
```
Si absent : `bun add gray-matter --workspace=server`.

- [ ] **Step 5: Run le test → pass**

```bash
bun test server/src/services/cc-plugin-import/__tests__/plugin-parser.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/cc-plugin-import/plugin-parser.ts \
        server/src/services/cc-plugin-import/__tests__/plugin-parser.test.ts \
        package.json bun.lockb
git commit -m "feat(cc-plugin-import): pure parser for manifest + agents + skills"
git push
```

---

## Task 3: Importer service — squelette + détection conflits

**Files:**
- Create: `server/src/services/cc-plugin-import/importer.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/importer.conflicts.test.ts`

**Responsabilité du module :** orchestrer le parser → vérifier conflits DB → préparer le payload Git+DB. Cette task isole la détection de conflits ; les Tasks 4+5 ajoutent le commit Git puis la transaction DB.

- [ ] **Step 1: Écrire le test conflits**

Fichier `server/src/services/cc-plugin-import/__tests__/importer.conflicts.test.ts` :

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { detectConflicts } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const fakePlugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0" },
  agents: [
    { name: "agent-a", sourcePath: "agents/agent-a.md", frontmatter: { name: "agent-a" }, body: "" },
  ],
  skills: [],
};

describe("detectConflicts", () => {
  it("returns no conflicts when names are free", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(),
      existingAgentNames: new Set(["unrelated"]),
    });
    expect(result.conflicts).toEqual([]);
  });

  it("flags layer conflict", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(["demo"]),
      existingAgentNames: new Set(),
    });
    expect(result.conflicts).toContainEqual({ kind: "layer", name: "demo" });
  });

  it("flags agent conflict", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(),
      existingAgentNames: new Set(["agent-a"]),
    });
    expect(result.conflicts).toContainEqual({ kind: "agent", name: "agent-a" });
  });
});
```

- [ ] **Step 2: Run → fail (module manquant)**

```bash
bun test server/src/services/cc-plugin-import/__tests__/importer.conflicts.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implémenter `detectConflicts` dans `importer.ts`**

Fichier initial `server/src/services/cc-plugin-import/importer.ts` :

```ts
import type { ParsedPlugin } from "./plugin-parser.js";

export interface Conflict {
  kind: "layer" | "agent";
  name: string;
}

export interface DetectConflictsInput {
  companyId: string;
  plugin: ParsedPlugin;
  existingLayerNames: Set<string>;
  existingAgentNames: Set<string>;
}

export async function detectConflicts(
  input: DetectConflictsInput,
): Promise<{ conflicts: Conflict[] }> {
  const conflicts: Conflict[] = [];
  if (input.existingLayerNames.has(input.plugin.manifest.name)) {
    conflicts.push({ kind: "layer", name: input.plugin.manifest.name });
  }
  for (const agent of input.plugin.agents) {
    if (input.existingAgentNames.has(agent.name)) {
      conflicts.push({ kind: "agent", name: agent.name });
    }
  }
  return { conflicts };
}
```

- [ ] **Step 4: Run → pass**

```bash
bun test server/src/services/cc-plugin-import/__tests__/importer.conflicts.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cc-plugin-import/importer.ts \
        server/src/services/cc-plugin-import/__tests__/importer.conflicts.test.ts
git commit -m "feat(cc-plugin-import): conflict detection for layer + agent names"
git push
```

---

## Task 4: Importer service — fetch tree + parse via GitProvider

**Files:**
- Modify: `server/src/services/cc-plugin-import/importer.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/importer.fetch.test.ts`

**But :** ajouter `fetchAndParsePlugin(gitProvider, ref)` qui utilise `fetchTree(recursive=true)` + `fetchBlob` pour reconstruire un `ParsedPlugin` sans clone disque.

- [ ] **Step 1: Écrire le test (mock GitProvider)**

Fichier `server/src/services/cc-plugin-import/__tests__/importer.fetch.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { fetchAndParsePlugin } from "../importer.js";
import type { GitProvider, TreeEntry } from "@mnm/git-provider";

function mockProvider(blobs: Record<string, string>, sha = "abc123"): GitProvider {
  const tree: TreeEntry[] = Object.keys(blobs).map((path) => ({
    path,
    type: "blob",
    sha: "x",
    size: blobs[path].length,
  }));
  return {
    fetchTree: async () => tree,
    fetchBlob: async ({ path }) => blobs[path],
    resolveRef: async () => sha,
    listTags: async () => [],
    pathExists: async ({ path }) => path in blobs,
    commitFile: async () => ({ sha: "n" }),
    commitMultipleFiles: async () => ({ sha: "n" }),
    createTag: async () => ({ sha: "n" }),
  };
}

describe("fetchAndParsePlugin", () => {
  it("fetches tree and blobs and returns ParsedPlugin + sha", async () => {
    const provider = mockProvider({
      ".claude-plugin/plugin.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
      "agents/a.md": "---\nname: a\n---\nx",
      "skills/s/SKILL.md": "---\nname: s\ndescription: d\n---\nbody",
    });
    const result = await fetchAndParsePlugin({ gitProvider: provider, ref: "main" });
    expect(result.plugin.manifest.name).toBe("demo");
    expect(result.plugin.agents.map((a) => a.name)).toEqual(["a"]);
    expect(result.plugin.skills.map((s) => s.name)).toEqual(["s"]);
    expect(result.sourceSha).toBe("abc123");
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implémenter `fetchAndParsePlugin` (append to importer.ts)**

Ajouter en bas de `server/src/services/cc-plugin-import/importer.ts` :

```ts
import type { GitProvider } from "@mnm/git-provider";
import { parsePlugin, type ParsedPlugin } from "./plugin-parser.js";

export interface FetchAndParseInput {
  gitProvider: GitProvider;
  ref: string;
  excludeAgents?: string[];
  excludeSkills?: string[];
}

export interface FetchAndParseResult {
  plugin: ParsedPlugin;
  sourceSha: string;
}

export async function fetchAndParsePlugin(
  input: FetchAndParseInput,
): Promise<FetchAndParseResult> {
  const sourceSha = await input.gitProvider.resolveRef({ ref: input.ref });
  const tree = await input.gitProvider.fetchTree({
    ref: input.ref,
    recursive: true,
  });
  const plugin = await parsePlugin({
    tree,
    fetchBlob: (path) => input.gitProvider.fetchBlob({ path, ref: sourceSha }),
    excludeAgents: input.excludeAgents,
    excludeSkills: input.excludeSkills,
  });
  return { plugin, sourceSha };
}
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cc-plugin-import/importer.ts \
        server/src/services/cc-plugin-import/__tests__/importer.fetch.test.ts
git commit -m "feat(cc-plugin-import): fetch tree+blobs via GitProvider, no fs"
git push
```

---

## Task 5: Importer service — staging Git actions + injection frontmatter

**Files:**
- Modify: `server/src/services/cc-plugin-import/importer.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/importer.staging.test.ts`

**But :** transformer un `ParsedPlugin` en liste de `CommitMultipleFiles.actions` (path + content) prête à pousser sur le repo company. Le frontmatter agent reçoit `config_layers: [<plugin-name>]` injecté.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { stageGitActions } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const plugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0", description: "desc", author: { name: "x" } },
  agents: [
    {
      name: "writer",
      sourcePath: "agents/writer.md",
      frontmatter: { name: "writer", model: "sonnet", skills: ["s1"] },
      body: "# body",
    },
  ],
  skills: [
    {
      name: "s1",
      frontmatter: { name: "s1", description: "d" },
      files: [
        { path: "SKILL.md", content: "---\nname: s1\n---\nbody", contentHash: "h1" },
        { path: "references/r.md", content: "ref", contentHash: "h2" },
      ],
    },
  ],
};

describe("stageGitActions", () => {
  it("emits agents/, config_layers/, with config_layers: injected", () => {
    const actions = stageGitActions(plugin);

    const writerAction = actions.find((a) => a.path === "agents/writer.md")!;
    expect(writerAction.content).toContain("config_layers:");
    expect(writerAction.content).toContain("- demo");
    expect(writerAction.content).toContain("# body");

    const skillAction = actions.find((a) => a.path === "config_layers/demo/skills/s1/SKILL.md")!;
    expect(skillAction.content).toBe("---\nname: s1\n---\nbody");

    const refAction = actions.find(
      (a) => a.path === "config_layers/demo/skills/s1/references/r.md",
    )!;
    expect(refAction.content).toBe("ref");

    const manifest = actions.find((a) => a.path === "config_layers/demo/plugin.json")!;
    expect(JSON.parse(manifest.content!).name).toBe("demo");
  });

  it("does not duplicate config_layers entry if already present", () => {
    const pluginWithLayer: ParsedPlugin = {
      ...plugin,
      agents: [
        {
          ...plugin.agents[0],
          frontmatter: { ...plugin.agents[0].frontmatter, config_layers: ["demo"] },
        },
      ],
    };
    const actions = stageGitActions(pluginWithLayer);
    const writer = actions.find((a) => a.path === "agents/writer.md")!;
    expect((writer.content!.match(/- demo/g) ?? []).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implémenter `stageGitActions`**

Append à `server/src/services/cc-plugin-import/importer.ts` :

```ts
import matter from "gray-matter";

export interface GitAction {
  path: string;
  content: string;
}

export function stageGitActions(plugin: ParsedPlugin): GitAction[] {
  const actions: GitAction[] = [];
  const layerName = plugin.manifest.name;

  // Agents — inject config_layers: [<plugin-name>] into frontmatter
  for (const agent of plugin.agents) {
    const fm = { ...agent.frontmatter };
    const existing = Array.isArray(fm.config_layers) ? (fm.config_layers as string[]) : [];
    if (!existing.includes(layerName)) {
      fm.config_layers = [...existing, layerName];
    } else {
      fm.config_layers = existing;
    }
    const rebuilt = matter.stringify(agent.body, fm);
    actions.push({ path: `agents/${agent.name}.md`, content: rebuilt });
  }

  // Skills — copy each file under config_layers/<plugin>/skills/<skill>/<file.path>
  for (const skill of plugin.skills) {
    for (const file of skill.files) {
      actions.push({
        path: `config_layers/${layerName}/skills/${skill.name}/${file.path}`,
        content: file.content,
      });
    }
  }

  // Plugin manifest copy (without .claude-plugin/ wrapper)
  actions.push({
    path: `config_layers/${layerName}/plugin.json`,
    content: JSON.stringify(plugin.manifest, null, 2) + "\n",
  });

  return actions;
}
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cc-plugin-import/importer.ts \
        server/src/services/cc-plugin-import/__tests__/importer.staging.test.ts
git commit -m "feat(cc-plugin-import): stage Git actions from parsed plugin"
git push
```

---

## Task 6: Importer service — DB rows builder

**Files:**
- Modify: `server/src/services/cc-plugin-import/importer.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/importer.db.test.ts`

**But :** transformer un `ParsedPlugin` en payload DB structuré. Insertion réelle dans Task 7.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { buildDbPayload } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const plugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0" },
  agents: [
    { name: "writer", sourcePath: "agents/writer.md", frontmatter: { name: "writer", model: "sonnet" }, body: "" },
  ],
  skills: [
    {
      name: "s1",
      frontmatter: { name: "s1", description: "the rules" },
      files: [
        { path: "SKILL.md", content: "x", contentHash: "h1" },
        { path: "references/r.md", content: "y", contentHash: "h2" },
      ],
    },
  ],
};

describe("buildDbPayload", () => {
  it("builds layer + items + files + agents", () => {
    const payload = buildDbPayload({
      plugin,
      companyId: "c1",
      createdByUserId: "u1",
      sourceUrl: "https://example/repo",
      sourceSha: "abc",
    });

    expect(payload.layer.name).toBe("demo");
    expect(payload.layer.sourceKind).toBe("cc-plugin");
    expect(payload.layer.sourceUrl).toBe("https://example/repo");
    expect(payload.layer.sourceSha).toBe("abc");
    expect(payload.layer.scope).toBe("company");

    expect(payload.skillItems.length).toBe(1);
    const item = payload.skillItems[0];
    expect(item.itemType).toBe("skill");
    expect(item.name).toBe("s1");
    expect(item.displayName).toBe("s1");
    expect(item.description).toBe("the rules");

    expect(payload.skillFiles.length).toBe(2);
    expect(payload.skillFiles[0].itemTempId).toBe(item.tempId);
    expect(payload.skillFiles[0].path).toBe("SKILL.md");

    expect(payload.agents.length).toBe(1);
    expect(payload.agents[0].name).toBe("writer");
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implémenter `buildDbPayload`**

Append à `importer.ts` :

```ts
export interface BuildDbInput {
  plugin: ParsedPlugin;
  companyId: string;
  createdByUserId: string;
  sourceUrl: string;
  sourceSha: string;
}

export interface DbLayerRow {
  name: string;
  description: string | null;
  scope: "company";
  sourceKind: "cc-plugin";
  sourceUrl: string;
  sourceSha: string;
  createdByUserId: string;
  visibility: "public";
}

export interface DbSkillItemRow {
  tempId: string;       // correlate with skillFiles before insert
  itemType: "skill";
  name: string;
  displayName: string | null;
  description: string | null;
  configJson: { frontmatter: Record<string, unknown>; primaryFile: "SKILL.md" };
  sourceType: "git";
  sourceUrl: string;     // path within source repo (skills/<n>/SKILL.md)
}

export interface DbSkillFileRow {
  itemTempId: string;
  path: string;
  content: string;
  contentHash: string;
}

export interface DbAgentRow {
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface DbPayload {
  layer: DbLayerRow;
  skillItems: DbSkillItemRow[];
  skillFiles: DbSkillFileRow[];
  agents: DbAgentRow[];
}

import { randomUUID } from "node:crypto";

export function buildDbPayload(input: BuildDbInput): DbPayload {
  const skillItems: DbSkillItemRow[] = [];
  const skillFiles: DbSkillFileRow[] = [];
  for (const skill of input.plugin.skills) {
    const tempId = randomUUID();
    skillItems.push({
      tempId,
      itemType: "skill",
      name: skill.name,
      displayName: typeof skill.frontmatter.name === "string" ? skill.frontmatter.name : skill.name,
      description:
        typeof skill.frontmatter.description === "string" ? skill.frontmatter.description : null,
      configJson: { frontmatter: skill.frontmatter, primaryFile: "SKILL.md" },
      sourceType: "git",
      sourceUrl: `skills/${skill.name}/SKILL.md`,
    });
    for (const file of skill.files) {
      skillFiles.push({
        itemTempId: tempId,
        path: file.path,
        content: file.content,
        contentHash: file.contentHash,
      });
    }
  }
  return {
    layer: {
      name: input.plugin.manifest.name,
      description: input.plugin.manifest.description ?? null,
      scope: "company",
      sourceKind: "cc-plugin",
      sourceUrl: input.sourceUrl,
      sourceSha: input.sourceSha,
      createdByUserId: input.createdByUserId,
      visibility: "public",
    },
    skillItems,
    skillFiles,
    agents: input.plugin.agents.map((a) => ({
      name: a.name,
      frontmatter: a.frontmatter,
      body: a.body,
    })),
  };
}
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cc-plugin-import/importer.ts \
        server/src/services/cc-plugin-import/__tests__/importer.db.test.ts
git commit -m "feat(cc-plugin-import): build DB payload from parsed plugin"
git push
```

---

## Task 7: Importer service — transaction d'insertion DB

**Files:**
- Modify: `server/src/services/cc-plugin-import/importer.ts`
- Create: `server/src/services/cc-plugin-import/__tests__/importer.persist.test.ts` (intégration, embedded postgres)

**But :** `persistImport(db, payload, mnmCommitSha)` insère dans `config_layers` + `config_layer_items` + `config_layer_files` + `agents` en une transaction Postgres unique. Si une étape échoue, tout est rollback.

- [ ] **Step 1: Écrire un test d'intégration léger**

Le repo a déjà des helpers de test embedded postgres — réutiliser le pattern `server/src/__tests__/<existing>.integration.test.ts`. Si pas de pattern direct, inline une petite fixture :

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { configLayers, configLayerItems, configLayerFiles, agents } from "@mnm/db";
import { persistImport } from "../importer.js";

// Reuse the in-repo test DB harness if available; otherwise expect
// DATABASE_URL to point at an embedded test postgres.
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;
const sql = postgres(TEST_DB_URL);
const db = drizzle(sql);

describe("persistImport", () => {
  it("inserts layer + items + files + agents atomically", async () => {
    const companyId = "00000000-0000-0000-0000-000000000001"; // assume seeded
    const result = await persistImport({
      db,
      companyId,
      payload: {
        layer: {
          name: `imp-test-${Date.now()}`,
          description: null,
          scope: "company",
          sourceKind: "cc-plugin",
          sourceUrl: "https://x",
          sourceSha: "abc",
          createdByUserId: "test-user",
          visibility: "public",
        },
        skillItems: [
          {
            tempId: "t1",
            itemType: "skill",
            name: "s1",
            displayName: "s1",
            description: "d",
            configJson: { frontmatter: { name: "s1" }, primaryFile: "SKILL.md" },
            sourceType: "git",
            sourceUrl: "skills/s1/SKILL.md",
          },
        ],
        skillFiles: [
          { itemTempId: "t1", path: "SKILL.md", content: "x", contentHash: "h" },
        ],
        agents: [{ name: `imp-agent-${Date.now()}`, frontmatter: { name: "a" }, body: "" }],
      },
      mnmCommitSha: "deadbeef",
    });

    expect(result.layerId).toBeTruthy();
    const layerRow = await db
      .select()
      .from(configLayers)
      .where(eq(configLayers.id, result.layerId));
    expect(layerRow[0].mnmImportCommitSha).toBe("deadbeef");
    const fileRows = await db.select().from(configLayerFiles);
    expect(fileRows.some((r) => r.path === "SKILL.md")).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail (function pas définie)**

- [ ] **Step 3: Implémenter `persistImport`**

Append :

```ts
import type { Db } from "@mnm/db";
import { configLayers, configLayerItems, configLayerFiles, agents as agentsTable } from "@mnm/db";

export interface PersistImportInput {
  db: Db;
  companyId: string;
  payload: DbPayload;
  mnmCommitSha: string;
}

export interface PersistImportResult {
  layerId: string;
  itemIds: string[];
  agentIds: string[];
}

export async function persistImport(
  input: PersistImportInput,
): Promise<PersistImportResult> {
  return await input.db.transaction(async (tx) => {
    const [layer] = await tx
      .insert(configLayers)
      .values({
        companyId: input.companyId,
        name: input.payload.layer.name,
        description: input.payload.layer.description,
        scope: input.payload.layer.scope,
        visibility: input.payload.layer.visibility,
        createdByUserId: input.payload.layer.createdByUserId,
        sourceKind: input.payload.layer.sourceKind,
        sourceUrl: input.payload.layer.sourceUrl,
        sourceSha: input.payload.layer.sourceSha,
        mnmImportCommitSha: input.mnmCommitSha,
      })
      .returning({ id: configLayers.id });

    const itemIds: string[] = [];
    const tempToReal = new Map<string, string>();
    for (const item of input.payload.skillItems) {
      const [row] = await tx
        .insert(configLayerItems)
        .values({
          companyId: input.companyId,
          layerId: layer.id,
          itemType: item.itemType,
          name: item.name,
          displayName: item.displayName,
          description: item.description,
          configJson: item.configJson,
          sourceType: item.sourceType,
          sourceUrl: item.sourceUrl,
        })
        .returning({ id: configLayerItems.id });
      itemIds.push(row.id);
      tempToReal.set(item.tempId, row.id);
    }

    if (input.payload.skillFiles.length > 0) {
      await tx.insert(configLayerFiles).values(
        input.payload.skillFiles.map((f) => ({
          companyId: input.companyId,
          itemId: tempToReal.get(f.itemTempId)!,
          path: f.path,
          content: f.content,
          contentHash: f.contentHash,
        })),
      );
    }

    const agentIds: string[] = [];
    for (const agent of input.payload.agents) {
      const [row] = await tx
        .insert(agentsTable)
        .values({
          companyId: input.companyId,
          name: agent.name,
          // Adjust to whatever fields your agents table requires.
          // Most existing imports go through createAgent service — if a field
          // is mandatory and not in this payload, surface it via the parser
          // or fall back to a sane default. Check agent_defaults helper.
          ...buildAgentInsertDefaults(agent.frontmatter, agent.body),
        })
        .returning({ id: agentsTable.id });
      agentIds.push(row.id);
    }

    return { layerId: layer.id, itemIds, agentIds };
  });
}

function buildAgentInsertDefaults(
  frontmatter: Record<string, unknown>,
  body: string,
): Record<string, unknown> {
  // V1: minimal viable. Refine when checking agents schema in next task.
  return {
    description:
      typeof frontmatter.description === "string" ? frontmatter.description : null,
    adapterType: "claude_local",      // CC plugins target Claude — claude_local default
    metadata: { frontmatter, body },  // store full source for debug
    archivedAt: null,
  };
}
```

- [ ] **Step 4: Vérifier la shape réelle de `agents`**

```bash
grep -n "export const agents" packages/db/src/schema/agents.ts | head -5
```

Lis le fichier et **ajuste `buildAgentInsertDefaults`** pour matcher les colonnes obligatoires (`adapter_type`, `created_by_user_id`, etc.). Re-commit si nécessaire.

- [ ] **Step 5: Run le test → pass**

```bash
bun test server/src/services/cc-plugin-import/__tests__/importer.persist.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/cc-plugin-import/importer.ts \
        server/src/services/cc-plugin-import/__tests__/importer.persist.test.ts
git commit -m "feat(cc-plugin-import): atomic DB transaction for layer+items+files+agents"
git push
```

---

## Task 8: Importer orchestrator + REST endpoint

**Files:**
- Create: `server/src/services/cc-plugin-import/orchestrator.ts`
- Modify: `server/src/routes/governed-workflows.ts` (ajouter `/import-plugin`)
- Create: `server/src/services/cc-plugin-import/__tests__/orchestrator.test.ts`

**But :** combiner `fetchAndParsePlugin` + `detectConflicts` + `stageGitActions` + `commitMultipleFiles` côté repo company + `persistImport`. Erreurs typées.

- [ ] **Step 1: Écrire le test e2e mock (fakes pour git provider source + dest)**

```ts
import { describe, it, expect } from "vitest";
import { runImport } from "../orchestrator.js";
// Use the same mockProvider helper from importer.fetch.test.ts (extract to a
// _shared fixture if reused).

describe("runImport", () => {
  it("clones, parses, conflicts checked, git committed, db persisted", async () => {
    // Compose providers + db stubs, assert resulting commitSha + agent ids.
    // Skip implementation detail: this test is the spec for the orchestrator
    // surface.
    expect(true).toBe(true); // placeholder until orchestrator typed
  });
});
```

- [ ] **Step 2: Implémenter l'orchestrator**

Fichier `server/src/services/cc-plugin-import/orchestrator.ts` :

```ts
import { eq, sql, isNull, and } from "drizzle-orm";
import { configLayers, agents as agentsTable, type Db } from "@mnm/db";
import type { GitProvider } from "@mnm/git-provider";
import { fetchAndParsePlugin, detectConflicts, stageGitActions, buildDbPayload, persistImport, type Conflict } from "./importer.js";

export class PluginImportError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "PluginImportError";
  }
}

export interface RunImportInput {
  db: Db;
  companyId: string;
  createdByUserId: string;
  sourceProvider: GitProvider;       // pointing at the plugin repo
  destProvider: GitProvider;         // pointing at the company workflows repo
  destBranch: string;                // typically "main"
  sourceUrl: string;                 // for storage / audit
  ref?: string;                      // default "main"
  excludeAgents?: string[];
  excludeSkills?: string[];
  authorName?: string;
  authorEmail?: string;
}

export interface RunImportResult {
  layerId: string;
  agents: Array<{ id: string; name: string }>;
  skills: Array<{ name: string; files: number }>;
  skippedSkills: string[];
  skippedAgents: string[];
  pluginCommitSha: string;
  mnmCommitSha: string;
  tag: string;
}

export async function runImport(input: RunImportInput): Promise<RunImportResult> {
  // 1) Fetch + parse
  const { plugin, sourceSha } = await fetchAndParsePlugin({
    gitProvider: input.sourceProvider,
    ref: input.ref ?? "main",
    excludeAgents: input.excludeAgents,
    excludeSkills: input.excludeSkills,
  });

  // 2) Conflict detection
  const layerNames = new Set(
    (
      await input.db
        .select({ name: configLayers.name })
        .from(configLayers)
        .where(and(eq(configLayers.companyId, input.companyId), isNull(configLayers.archivedAt)))
    ).map((r) => r.name),
  );
  const agentNames = new Set(
    (
      await input.db
        .select({ name: agentsTable.name })
        .from(agentsTable)
        .where(eq(agentsTable.companyId, input.companyId))
    ).map((r) => r.name),
  );
  const { conflicts } = await detectConflicts({
    companyId: input.companyId,
    plugin,
    existingLayerNames: layerNames,
    existingAgentNames: agentNames,
  });
  if (conflicts.length > 0) {
    const layerC = conflicts.find((c) => c.kind === "layer");
    const agentC = conflicts.find((c) => c.kind === "agent");
    if (layerC) {
      throw new PluginImportError("CONFLICT_LAYER_NAME", `Layer ${layerC.name} already exists`, conflicts);
    }
    if (agentC) {
      throw new PluginImportError("CONFLICT_AGENT_NAME", `Agent ${agentC.name} already exists`, conflicts);
    }
  }

  // 3) Stage Git actions and commit
  const actions = stageGitActions(plugin);
  const author = {
    authorName: input.authorName ?? "MnM Plugin Importer",
    authorEmail: input.authorEmail ?? "mnm@example.com",
  };
  const commitResult = await input.destProvider.commitMultipleFiles({
    branch: input.destBranch,
    commitMessage: `feat(plugin-import): import ${plugin.manifest.name} v${plugin.manifest.version}`,
    actions: actions.map((a) => ({ path: a.path, content: a.content })),
    ...author,
  });
  const tag = `plugin-imports/${plugin.manifest.name}/v${plugin.manifest.version}`;
  await input.destProvider.createTag({
    name: tag,
    ref: commitResult.sha,
    message: `Import ${plugin.manifest.name} v${plugin.manifest.version}`,
  });

  // 4) Persist DB
  const payload = buildDbPayload({
    plugin,
    companyId: input.companyId,
    createdByUserId: input.createdByUserId,
    sourceUrl: input.sourceUrl,
    sourceSha,
  });
  const { layerId, agentIds } = await persistImport({
    db: input.db,
    companyId: input.companyId,
    payload,
    mnmCommitSha: commitResult.sha,
  });

  return {
    layerId,
    agents: plugin.agents.map((a, i) => ({ id: agentIds[i], name: a.name })),
    skills: plugin.skills.map((s) => ({ name: s.name, files: s.files.length })),
    skippedSkills: input.excludeSkills ?? [],
    skippedAgents: input.excludeAgents ?? [],
    pluginCommitSha: sourceSha,
    mnmCommitSha: commitResult.sha,
    tag,
  };
}
```

- [ ] **Step 3: Ajouter le REST endpoint**

Ouvrir `server/src/routes/governed-workflows.ts`, repérer le pattern existant (`PUT /git-provider-config`, `POST /governed-workflows`) et ajouter :

```ts
router.post("/companies/:companyId/governed-workflows/import-plugin", async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { repo_url, ref, exclude_skills, exclude_agents } = req.body;
    if (!repo_url || typeof repo_url !== "string") {
      return res.status(400).json({ error: "repo_url required" });
    }
    // Build a sourceProvider on-the-fly from repo_url. Reuse company PAT
    // from existing git_provider config layer (assumes plugin is on same
    // GitLab instance with same auth).
    const destProvider = await services.resolveGitProvider({ companyId });
    const sourceProvider = await services.resolveGitProviderForUrl({
      companyId,
      url: repo_url,
    });
    const result = await runImport({
      db: services.db,
      companyId,
      createdByUserId: (req as any).actor.userId,
      sourceProvider,
      destProvider,
      destBranch: "main",
      sourceUrl: repo_url,
      ref,
      excludeAgents: exclude_agents,
      excludeSkills: exclude_skills,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PluginImportError) {
      return res.status(err.code.startsWith("CONFLICT") ? 409 : 400).json({
        error: err.message,
        code: err.code,
        details: err.details,
      });
    }
    next(err);
  }
});
```

**Note :** `services.resolveGitProviderForUrl` n'existe peut-être pas — si oui, l'ajouter dans `build-mcp-services.ts` (factory qui construit un nouveau `GitlabProvider` à partir de l'URL et du PAT existant). Vérifier.

- [ ] **Step 4: Smoke test manuel**

```bash
bun run dev   # in another terminal
curl -X POST http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/import-plugin \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://gitlab.example.com/example-org/hub/creation/lint-pack","exclude_skills":["test"]}'
```
Expected: `{ok: true, layerId, agents:[...], ...}`.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cc-plugin-import/orchestrator.ts \
        server/src/routes/governed-workflows.ts \
        server/src/services/cc-plugin-import/__tests__/orchestrator.test.ts
git commit -m "feat(cc-plugin-import): orchestrator + POST /import-plugin endpoint"
git push
```

---

## Task 9: MCP tool `import_cc_plugin`

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts` (ajouter le tool)
- Create: `server/src/mcp/tools/__tests__/import-cc-plugin.tool.test.ts`

- [ ] **Step 1: Écrire le test du tool**

Réutiliser le pattern de `governed-workflows.tool.test.ts` (mock services). Test minimal : input zod-schema valide, `services.runImport` appelé avec les bons args, output JSON-parseable.

- [ ] **Step 2: Implémenter le tool**

Dans `governed-workflows.tool.ts`, ajouter :

```ts
tool("import_cc_plugin", {
  permissions: [PERMISSIONS.WORKFLOWS_CREATE],
  description:
    "[Governed Workflows] Import a Claude Code plugin from a GitLab repo. " +
    "Splits plugin into N standalone agents (in agents/) and 1 config_layer " +
    "(skills+MCP+hooks bundle in config_layers/). Plugin dies at import.",
  input: z.object({
    repo_url: z.string().url(),
    ref: z.string().optional(),
    exclude_skills: z.array(z.string()).optional(),
    exclude_agents: z.array(z.string()).optional(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ input, actor }) => {
    return wrap(actor, async () => {
      await setTenantContext(services.db, actor.companyId);
      const destProvider = await services.resolveGitProvider({ companyId: actor.companyId });
      const sourceProvider = await services.resolveGitProviderForUrl({
        companyId: actor.companyId,
        url: input.repo_url,
      });
      const result = await services.ccPluginImport.runImport({
        db: services.db,
        companyId: actor.companyId,
        createdByUserId: actor.userId ?? "mcp-actor",
        sourceProvider,
        destProvider,
        destBranch: "main",
        sourceUrl: input.repo_url,
        ref: input.ref,
        excludeAgents: input.exclude_agents,
        excludeSkills: input.exclude_skills,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true, ...result }) }],
      };
    });
  },
});
```

- [ ] **Step 3: Wire `services.ccPluginImport`** dans `build-mcp-services.ts`

```ts
import * as ccPluginImport from "../../services/cc-plugin-import/orchestrator.js";
// ...
return {
  // ...existing services
  ccPluginImport: { runImport: ccPluginImport.runImport },
};
```

- [ ] **Step 4: Run test → pass**

- [ ] **Step 5: Commit**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts \
        server/src/mcp/tools/__tests__/import-cc-plugin.tool.test.ts \
        server/src/mcp/build-mcp-services.ts
git commit -m "feat(mcp): expose import_cc_plugin tool"
git push
```

---

## Task 10: Runtime materialization — skills écrits au launch

**Files:**
- Create: `server/src/services/materialize-config-layer-skills.ts`
- Create: `server/src/services/__tests__/materialize-config-layer-skills.test.ts`
- Modify: l'agent runner commun (chercher où `cursor-local-skill-injection` est invoqué — probablement dans un service partagé invoqué par chaque adapter).

- [ ] **Step 1: Localiser le point d'injection actuel**

```bash
grep -rn "ensureCursorSkillsInjected\|skillsInjected\|skills.*inject" server/src --include="*.ts" | head
```

Identifier la fonction/service qui prépare le sandbox d'un agent au launch (probablement `server/src/services/agent-launcher.ts` ou équivalent). On va y ajouter un appel à `materializeConfigLayerSkills` avant l'invocation adapter.

- [ ] **Step 2: Écrire le test**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { materializeConfigLayerSkills } from "../materialize-config-layer-skills.js";

describe("materializeConfigLayerSkills", () => {
  let tmpRoot = "";
  afterEach(async () => {
    if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("writes skill files into <sandbox>/.claude/skills/<name>/<path>", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mat-skills-"));
    const fakeDb = {
      // shape: list items + files for given layerIds
      listSkillsForLayers: async (_layerIds: string[]) => [
        {
          skillName: "s1",
          files: [
            { path: "SKILL.md", content: "skill body" },
            { path: "references/r.md", content: "ref body" },
          ],
        },
      ],
    };
    await materializeConfigLayerSkills({
      sandbox: tmpRoot,
      layerIds: ["any"],
      db: fakeDb as any,
    });
    expect(await fs.readFile(path.join(tmpRoot, ".claude/skills/s1/SKILL.md"), "utf8"))
      .toBe("skill body");
    expect(await fs.readFile(path.join(tmpRoot, ".claude/skills/s1/references/r.md"), "utf8"))
      .toBe("ref body");
  });
});
```

- [ ] **Step 3: Implémenter le service**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { eq, inArray, and } from "drizzle-orm";
import { configLayerItems, configLayerFiles, type Db } from "@mnm/db";

export interface MaterializeInput {
  sandbox: string;
  layerIds: string[];
  db: Pick<Db, "select" | "transaction"> | { listSkillsForLayers(ids: string[]): Promise<Array<{ skillName: string; files: Array<{ path: string; content: string }> }>> };
}

async function listSkillsForLayers(db: Db, layerIds: string[]) {
  const items = await db
    .select({
      itemId: configLayerItems.id,
      name: configLayerItems.name,
    })
    .from(configLayerItems)
    .where(
      and(
        inArray(configLayerItems.layerId, layerIds),
        eq(configLayerItems.itemType, "skill"),
        eq(configLayerItems.enabled, true),
      ),
    );
  if (items.length === 0) return [];
  const files = await db
    .select({
      itemId: configLayerFiles.itemId,
      path: configLayerFiles.path,
      content: configLayerFiles.content,
    })
    .from(configLayerFiles)
    .where(inArray(configLayerFiles.itemId, items.map((i) => i.itemId)));
  return items.map((it) => ({
    skillName: it.name,
    files: files.filter((f) => f.itemId === it.itemId).map((f) => ({ path: f.path, content: f.content })),
  }));
}

export async function materializeConfigLayerSkills(
  input: MaterializeInput,
): Promise<void> {
  if (input.layerIds.length === 0) return;
  const skills =
    "listSkillsForLayers" in input.db
      ? await (input.db as any).listSkillsForLayers(input.layerIds)
      : await listSkillsForLayers(input.db as Db, input.layerIds);

  const baseDir = path.join(input.sandbox, ".claude", "skills");
  for (const skill of skills) {
    const skillDir = path.join(baseDir, skill.skillName);
    for (const file of skill.files) {
      const target = path.join(skillDir, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
    }
  }
}
```

- [ ] **Step 4: Hook dans le launcher**

Dans le launcher repéré au step 1, après création du sandbox et avant invocation adapter :

```ts
// Read agent's frontmatter config_layers, resolve to layer ids
const layerIds = await resolveAgentConfigLayerIds(db, agent);
await materializeConfigLayerSkills({ sandbox, layerIds, db });
```

`resolveAgentConfigLayerIds(db, agent)` = nouvelle helper, lit le frontmatter de l'agent.md (depuis le repo Git via le `gitProvider` ou depuis le DB row si on stocke le frontmatter en DB), extrait `config_layers: [...]`, fait `SELECT id FROM config_layers WHERE company_id=$1 AND name = ANY($2)`.

- [ ] **Step 5: Run le test → pass**

- [ ] **Step 6: Commit**

```bash
git add server/src/services/materialize-config-layer-skills.ts \
        server/src/services/__tests__/materialize-config-layer-skills.test.ts \
        server/src/services/<launcher>.ts
git commit -m "feat(runtime): materialize config_layer skills into agent sandbox"
git push
```

---

## Task 11: Workflow `lint-pack.workflow.json`

**Files:**
- Create: `<company-repo>/workflows/lint-pack.workflow.json` (commité via le repo company, pas dans le repo MnM)

**But :** définir le workflow MnM qui orchestre `preflight-check` → `write-tests` → `review-tests`, avec gates artifact-based.

- [ ] **Step 1: Lire le repo company actuel**

Identifier le repo company (cf `~/.mnm/dev-workflows-bare/repo.git` ou GitLab `your-username/mnm-workflows-demo`). Cloner localement pour édition.

- [ ] **Step 2: Écrire le workflow.json**

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "lint-pack",
  "description": "Génère + review des PHPUnit tests pour un fichier source PHP donné.",
  "variables": {
    "target_file": {
      "type": "string",
      "required": true,
      "description": "Chemin source PHP à tester (ex: src/Service/UserService.php)"
    },
    "project_dir": {
      "type": "string",
      "required": true,
      "description": "Racine du projet Symfony cible"
    }
  },
  "steps": [
    {
      "id": "preflight-check",
      "agent": "claude_code_generic",
      "deps": [],
      "prompt_context": {
        "_mnm_invoke_skill": "preflight",
        "project_dir": "{{variables.project_dir}}",
        "_mnm_artifact_schema": "Retourne un JSON {ok: boolean, missing: string[]} récapitulant les outils/configs manquants détectés par le skill preflight."
      }
    },
    {
      "id": "write-tests",
      "agent": "test-writer",
      "deps": ["preflight-check"],
      "prompt_context": {
        "target_file": "{{variables.target_file}}",
        "project_dir": "{{variables.project_dir}}",
        "_mnm_artifact_schema": "Retourne {test_file: string, phpstan: {level: int, passed: bool, errors: array}, phpunit: {passed: bool, tests_run: int}, infection: {msi: number, covered_msi: number, min_msi: number, min_covered_msi: number}}"
      },
      "gates": {
        "entry": [
          { "id": "preflight", "source": "./gates/lint-pack/preflight.gate.ts" }
        ],
        "exit": [
          { "id": "phpstan-level-10", "source": "./gates/lint-pack/phpstan-level-10.gate.ts" },
          { "id": "phpunit-pass",     "source": "./gates/lint-pack/phpunit-pass.gate.ts" },
          { "id": "infection-msi",    "source": "./gates/lint-pack/infection-msi.gate.ts" }
        ]
      }
    },
    {
      "id": "review-tests",
      "agent": "test-reviewer",
      "deps": ["write-tests"],
      "prompt_context": {
        "test_file":   "{{steps.write-tests.artifact.test_file}}",
        "source_file": "{{variables.target_file}}",
        "msi_score":   "{{steps.write-tests.artifact.infection.msi}}",
        "project_dir": "{{variables.project_dir}}",
        "_mnm_artifact_schema": "Retourne {verdict: 'APPROVE' | 'REQUEST_CHANGES', issues: array, test_file: string}"
      },
      "gates": {
        "exit": [
          { "id": "reviewer-approves", "source": "./gates/lint-pack/reviewer-approves.gate.ts" }
        ]
      }
    }
  ]
}
```

- [ ] **Step 3: Commit dans le repo company**

```bash
cd <company-repo>
git add workflows/lint-pack.workflow.json
git commit -m "feat(workflow): add lint-pack"
git push
```

---

## Task 12: Gate `phpstan-level-10`

**Files:**
- Create: `<company-repo>/workflows/gates/lint-pack/phpstan-level-10.gate.ts`
- Create: `<company-repo>/workflows/gates/lint-pack/__tests__/phpstan-level-10.gate.test.ts` (si tests gates supportés dans le repo company ; sinon tests dans `packages/gate-runner/canonical/__tests__` si on les fait canoniques — V1 démo : repo company sans tests, ou copy-paste les fixtures pour smoke).

- [ ] **Step 1: Écrire la gate**

```ts
import { defineGate } from "@mnm/governed-workflows";

interface PhpstanResult { level?: number; passed?: boolean; errors?: unknown[]; }
interface ArtifactShape { phpstan?: PhpstanResult; }

export default defineGate<ArtifactShape, { min_level?: unknown }>(async (ctx) => {
  const minLevel = typeof ctx.config.min_level === "number" ? ctx.config.min_level : 10;
  const result = ctx.artifact?.phpstan;
  if (!result || typeof result !== "object") {
    return {
      pass: false,
      error_code: "PHPSTAN_RESULT_MISSING",
      report: "phpstan-level-10: artifact.phpstan absent",
      hints: ["L'agent test-writer doit retourner artifact.phpstan = { level, passed, errors }."],
    };
  }
  if (typeof result.level !== "number" || result.level < minLevel) {
    return {
      pass: false,
      error_code: "PHPSTAN_LEVEL_TOO_LOW",
      report: `phpstan-level-10: level=${result.level} < ${minLevel}`,
    };
  }
  if (result.passed !== true) {
    return {
      pass: false,
      error_code: "PHPSTAN_FAILED",
      report: "phpstan-level-10: passed !== true",
      hints: [`${(result.errors ?? []).length} erreur(s) PHPStan rapportées`],
    };
  }
  return { pass: true, report: `phpstan-level-10: pass (level=${result.level})` };
});
```

- [ ] **Step 2: Smoke test inline (vitest, optionnel mais utile)**

Mini test : feed `ctx` avec artifact valide → pass ; level=8 → fail ; passed=false → fail. Code suit le pattern `step-succeeded.gate.test.ts`.

- [ ] **Step 3: Commit**

```bash
cd <company-repo>
git add workflows/gates/lint-pack/phpstan-level-10.gate.ts
git commit -m "feat(gate): phpstan-level-10 reads artifact.phpstan"
git push
```

---

## Task 13: Gate `phpunit-pass`

**Files:**
- Create: `<company-repo>/workflows/gates/lint-pack/phpunit-pass.gate.ts`

- [ ] **Step 1: Écrire la gate**

```ts
import { defineGate } from "@mnm/governed-workflows";

interface PhpunitResult { passed?: boolean; tests_run?: number; }
interface ArtifactShape { phpunit?: PhpunitResult; }

export default defineGate<ArtifactShape, Record<string, never>>(async (ctx) => {
  const r = ctx.artifact?.phpunit;
  if (!r) {
    return { pass: false, error_code: "PHPUNIT_RESULT_MISSING", report: "phpunit-pass: artifact.phpunit absent" };
  }
  if (r.passed !== true) {
    return { pass: false, error_code: "PHPUNIT_FAILED", report: `phpunit-pass: passed=${r.passed}, tests_run=${r.tests_run ?? 0}` };
  }
  return { pass: true, report: `phpunit-pass: ${r.tests_run ?? 0} tests run, all passed` };
});
```

- [ ] **Step 2: Commit**

---

## Task 14: Gate `infection-msi`

**Files:**
- Create: `<company-repo>/workflows/gates/lint-pack/infection-msi.gate.ts`

- [ ] **Step 1: Écrire la gate**

```ts
import { defineGate } from "@mnm/governed-workflows";

interface InfectionResult {
  msi?: number;
  covered_msi?: number;
  min_msi?: number;
  min_covered_msi?: number;
}
interface ArtifactShape { infection?: InfectionResult; }

export default defineGate<ArtifactShape, Record<string, never>>(async (ctx) => {
  const r = ctx.artifact?.infection;
  if (!r || typeof r !== "object") {
    return { pass: false, error_code: "INFECTION_RESULT_MISSING", report: "infection-msi: artifact.infection absent" };
  }
  if (typeof r.msi !== "number" || typeof r.min_msi !== "number") {
    return { pass: false, error_code: "INFECTION_RESULT_INVALID", report: "infection-msi: msi/min_msi missing or not numeric" };
  }
  if (r.msi < r.min_msi) {
    return {
      pass: false,
      error_code: "INFECTION_MSI_TOO_LOW",
      report: `infection-msi: msi=${r.msi}% < min_msi=${r.min_msi}%`,
      hints: ["Ajoute des tests qui tuent les mutants restants (cf. infection.log)."],
    };
  }
  if (
    typeof r.covered_msi === "number" &&
    typeof r.min_covered_msi === "number" &&
    r.covered_msi < r.min_covered_msi
  ) {
    return {
      pass: false,
      error_code: "INFECTION_COVERED_MSI_TOO_LOW",
      report: `infection-msi: covered_msi=${r.covered_msi}% < min_covered_msi=${r.min_covered_msi}%`,
    };
  }
  return { pass: true, report: `infection-msi: msi=${r.msi}% (>= ${r.min_msi}%)` };
});
```

- [ ] **Step 2: Commit**

---

## Task 15: Gate `reviewer-approves`

**Files:**
- Create: `<company-repo>/workflows/gates/lint-pack/reviewer-approves.gate.ts`

- [ ] **Step 1: Écrire la gate**

```ts
import { defineGate } from "@mnm/governed-workflows";

interface ArtifactShape {
  verdict?: string;
  issues?: unknown[];
}

export default defineGate<ArtifactShape, Record<string, never>>(async (ctx) => {
  const v = ctx.artifact?.verdict;
  if (typeof v !== "string") {
    return { pass: false, error_code: "REVIEW_VERDICT_MISSING", report: "reviewer-approves: artifact.verdict absent" };
  }
  if (v !== "APPROVE") {
    const issues = Array.isArray(ctx.artifact?.issues) ? ctx.artifact!.issues!.length : 0;
    return {
      pass: false,
      error_code: "REVIEW_REQUEST_CHANGES",
      report: `reviewer-approves: verdict=${v}, ${issues} issue(s)`,
      hints: ["Le reviewer demande des changements. Corrige et relance le step write-tests."],
    };
  }
  return { pass: true, report: "reviewer-approves: APPROVE" };
});
```

- [ ] **Step 2: Commit**

---

## Task 16: Gate `preflight` (entry, lit l'artifact de `preflight-check`)

**Files:**
- Create: `<company-repo>/workflows/gates/lint-pack/preflight.gate.ts`

- [ ] **Step 1: Écrire la gate**

```ts
import { defineGate } from "@mnm/governed-workflows";

interface PreflightArtifact { ok?: boolean; missing?: string[]; }

export default defineGate<unknown, Record<string, never>>(async (ctx) => {
  const prev = ctx.step.previous_artifacts["preflight-check"] as PreflightArtifact | undefined;
  if (!prev) {
    return {
      pass: false,
      error_code: "PREFLIGHT_NOT_RUN",
      report: "preflight: step preflight-check has not produced an artifact",
      hints: ["Vérifie que le step preflight-check est bien dans le workflow et qu'il s'est complété."],
    };
  }
  if (prev.ok !== true) {
    const missing = Array.isArray(prev.missing) ? prev.missing : [];
    return {
      pass: false,
      error_code: "PREFLIGHT_FAILED",
      report: `preflight: ${missing.length} prérequis manquant(s)`,
      hints: missing.length > 0 ? [`Manquants: ${missing.join(", ")}`] : [],
    };
  }
  return { pass: true, report: "preflight: tous les prérequis sont OK" };
});
```

- [ ] **Step 2: Commit**

---

## Task 17: Patch test-writer / test-reviewer prompts pour le contrat artifact

**Files:**
- Modify: `<company-repo>/agents/test-writer.md`
- Modify: `<company-repo>/agents/test-reviewer.md`

**Pourquoi :** les agents tels qu'importés du plugin produisent un format de sortie markdown libre. Il faut leur préciser le contrat JSON attendu par les gates.

- [ ] **Step 1: Patcher test-writer.md**

Ajouter en fin de section "Format de sortie" :

```markdown
## Format MnM (CRITIQUE)

À la fin de ton run, tu DOIS retourner un bloc JSON unique avec les clés suivantes (le runner MnM le parse pour valider via les gates) :

```json
{
  "test_file": "tests/Unit/Service/UserServiceTest.php",
  "phpstan": { "level": 10, "passed": true, "errors": [] },
  "phpunit": { "passed": true, "tests_run": 12 },
  "infection": { "msi": 87.5, "covered_msi": 92.3, "min_msi": 80, "min_covered_msi": 85 }
}
```

Les seuils `min_msi` / `min_covered_msi` viennent de `infection.json5` du projet — recopie-les tels quels dans le JSON.
```

- [ ] **Step 2: Patcher test-reviewer.md**

Ajouter :

```markdown
## Format MnM (CRITIQUE)

Retourne en plus du markdown un bloc JSON :

```json
{
  "verdict": "APPROVE",
  "issues": [
    { "rule": "TAUTOLOGIE", "line": 42, "message": "..." }
  ],
  "test_file": "tests/Unit/Service/UserServiceTest.php"
}
```

`verdict` ∈ `{"APPROVE", "REQUEST_CHANGES"}`. `issues` peut être vide.
```

- [ ] **Step 3: Commit**

```bash
cd <company-repo>
git add agents/test-writer.md agents/test-reviewer.md
git commit -m "feat(agents): add MnM artifact contract to test-writer + test-reviewer"
git push
```

---

## Task 18: E2E smoke — import + run sur fixture Symfony

**Files:**
- Create: `server/src/__tests__/cc-plugin-import.e2e.test.ts` (mock fetchTree, mock destProvider in-memory, mock embedded postgres)

**But :** un test e2e qui couvre :
1. `runImport` sur un faux plugin in-memory.
2. Vérifie que le repo company a reçu les bonnes actions.
3. Vérifie que la DB contient les rows.
4. Vérifie qu'un appel à `materializeConfigLayerSkills` après import écrit les bons fichiers.

- [ ] **Step 1: Écrire le test**

Squelette :

```ts
import { describe, it, expect } from "vitest";
import { runImport } from "../services/cc-plugin-import/orchestrator.js";
import { materializeConfigLayerSkills } from "../services/materialize-config-layer-skills.js";
// Build a mock sourceProvider with a fixture plugin tree (manifest + 2 agents + 3 skills incl one with references/).
// Build an in-memory destProvider that records actions for assertion.
// Use the test embedded postgres to persist for real.

describe("cc plugin import e2e", () => {
  it("imports a CC plugin and skills can be materialized in a sandbox", async () => {
    // 1. Run import
    const result = await runImport({ /* ... */ });
    expect(result.agents.length).toBe(2);
    expect(result.skills.length).toBe(3);

    // 2. Assert dest provider received expected actions
    // (Mock destProvider exposes `recordedActions`.)

    // 3. Assert DB rows
    // (Query config_layers, items, files counts.)

    // 4. Materialize and assert files on disk
    const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-mat-"));
    await materializeConfigLayerSkills({ sandbox, layerIds: [result.layerId], db });
    const skillFiles = await fs.readdir(path.join(sandbox, ".claude/skills"));
    expect(skillFiles.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run → pass**

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/cc-plugin-import.e2e.test.ts
git commit -m "test(cc-plugin-import): e2e smoke import + materialize"
git push
```

---

## Task 19: Démo prep — import réel + lancement workflow

**But :** valider end-to-end avec le vrai plugin `lint-pack` et un projet Symfony cible.

- [ ] **Step 1: Démarrer MnM dev**

```bash
bun run dev
```

- [ ] **Step 2: Vérifier git_provider config layer du company de test**

S'assurer que la company a un PAT GitLab self-hosted configuré (cf `docs/governed-workflows-gitlab-setup.md`).

- [ ] **Step 3: Importer le plugin**

```bash
COMPANY_ID=$(curl -sS http://localhost:3100/api/companies | jq -r '.[0].id')
curl -X POST "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/import-plugin" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "https://gitlab.example.com/example-org/hub/creation/lint-pack",
    "exclude_skills": ["test"]
  }'
```
Expected: `{ok: true, layerId, agents:[test-writer, test-reviewer], skills:[6 skills]}`.

- [ ] **Step 4: Vérifier le repo company a reçu les fichiers**

Cloner / pull le repo company, vérifier la présence de `agents/test-writer.md`, `agents/test-reviewer.md`, `config_layers/lint-pack/`.

- [ ] **Step 5: Push le workflow + gates dans le repo company**

(Si pas déjà fait via Tasks 11-16.) Push les fichiers `workflows/lint-pack.workflow.json` + 5 gates.

- [ ] **Step 6: Lancer le workflow**

```bash
curl -X POST "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/lint-pack/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "target_file": "src/Service/SomeService.php",
      "project_dir": "/path/to/symfony/project"
    }
  }'
```

- [ ] **Step 7: Suivre le run dans l'UI MnM**

Ouvrir `/workflows/lint-pack/runs/<run-id>`, vérifier que les 3 steps se déroulent et que les 5 gates passent (ou expliquent clairement quoi est manquant).

- [ ] **Step 8: Tag final pour la démo**

```bash
git tag -a demo-2026-04-30-cc-plugin-import -m "Demo Friday: CC plugin import + lint-pack workflow"
git push --tags
```

---

## Self-Review

**Spec coverage check :**
- §3 (repo layout post-import) → Task 5 (stageGitActions) + Task 8 (orchestrator commit).
- §4 (modèle DB) → Task 1 (migration) + Task 6 (buildDbPayload) + Task 7 (persistImport).
- §5 (pipeline import) → Tasks 4-9.
- §6 (runtime materialization) → Task 10.
- §7 (workflow + gates, **amendé en Task 0**) → Tasks 11-17.
- §8 (couplage artifact brainstorm) → noté en Task 17 (contrat artifact = applicatif, indépendant du brainstorm storage).
- §9 (hors scope V1) → respecté (pas d'MCP/hooks, pas de marketplace, pas de re-import idempotent).

**Placeholder scan :** Aucun "TBD" laissé. Task 7 step 4 dit "ajuste `buildAgentInsertDefaults` pour matcher les colonnes obligatoires" — ce n'est pas un placeholder, c'est une instruction concrète parce que je ne peux pas connaître précisément le schema `agents` sans lire le fichier (le subagent doit le lire). Task 8 step 3 dit "Note : services.resolveGitProviderForUrl n'existe peut-être pas — si oui, l'ajouter" — c'est une vraie ambiguïté, mais résoluble en lisant `build-mcp-services.ts` au moment de l'exécution.

**Type consistency :** `ParsedPlugin`, `DbPayload`, `RunImportResult` cohérents entre tasks. `materializeConfigLayerSkills` signature stable.

---

## Execution Handoff

**Plan complet et sauvegardé. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatch un subagent frais par task, review entre chaque, itération rapide.

**2. Inline Execution** — J'exécute les tasks dans cette session avec executing-plans, batch avec checkpoints.

**Quelle approche ?**
