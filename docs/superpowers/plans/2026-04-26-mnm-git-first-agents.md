# MnM Git-first agents — plan d'implémentation

*Plan TDD — 2026-04-26 — author: mnm-plan-arch*

Spec source : `docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md`.
Deadline démo : lundi 2026-04-28. Code-complete + reviewed dimanche midi.

---

## 1. Contexte (5 lignes)

MnM résout aujourd'hui les agents en fetchant `<name>/agent.md` au root du repo et retourne `null` silencieux si la row DB est absente. Ce plan refactore vers le pattern Git-first symétrique (workflows + agents passent par `paths` du `git_provider` config_layer_item), ajoute une erreur dure `AGENT_NOT_REGISTERED`, étend `create_agent` MCP avec `latestGitTag`, et migre le repo `mnm-workflows-demo` → `mnm-demo` avec layout `agents/<name>/agent.md` + `workflows/<name>/workflow.json`. Stop à M4 ; M5 (smoke test démo) reste manuel côté Tom dimanche.

---

## 2. Pre-checks results (avec preuves)

### 2.1 `agents.archived_at` — **ABSENT**
`packages/db/src/schema/agents.ts:15-47` n'a aucune colonne `archived_at`. Champs présents : `id, companyId, name, title, createdByUserId, icon, status, reportsTo, capabilities, adapterType, adapterConfig, runtimeConfig, budgetMonthlyCents, spentMonthlyCents, permissions, lastHeartbeatAt, metadata, scopedToWorkspaceId, baseLayerId, latestGitTag, enabled, createdAt, updatedAt`.

→ **Élargit le scope** par rapport à la spec §6.1 qui assume "Aucune modification". On ajoute une migration Drizzle (P3 ci-dessous). La spec §M2 SQL `UPDATE agents SET archived_at = NOW(), enabled = false` ne s'exécutera qu'après cette migration.

### 2.2 Gates — **workflow-relative confirmé**
`server/src/services/governed-workflows-source-resolver.ts:39-56` extrait `workflowDir` de `workflowRepoPath` puis joint le `gateItemSource` relatif. Donc si `getWorkflowParsed` change `workflowRepoPath` de `<name>/workflow.json` à `workflows/<name>/workflow.json`, `workflowDir` devient `workflows/<name>` et les gates seront bien fetchées à `workflows/<name>/gates/<x>.gate.ts` — **automatiquement, sans modif** dans `makeResolveSource`. Le `..` rejection (ligne 52-54) garantit que le path ne s'évade pas.

→ Pas d'élargissement du périmètre côté gates.

### 2.3 Audit complet des callsites de `resolveGitProvider`

Tous les sites qui devront recevoir `resourceType` :

| # | Fichier:ligne | resourceType à passer | Notes |
|---|---|---|---|
| 1 | `server/src/services/governed-workflows.ts:332` | `"workflow"` | `getWorkflowParsed` |
| 2 | `server/src/services/governed-workflows.ts:674` | `"workflow"` | `launchStep` entry-gate (resolveSource fetch les gates dans le repo workflows) |
| 3 | `server/src/services/governed-workflows.ts:829` | `"agent"` | `loadCanonicalAgent` |
| 4 | `server/src/services/governed-workflows.ts:1014` | `"workflow"` | `completeStep` exit-gate |
| 5 | `server/src/services/governed-workflows.ts:1197` | `"agent"` | `syncEnvironment` (fetch agent.md) |
| 6 | `server/src/services/governed-workflows.ts:1238` | `"agent"` | `setupWorkspace` |
| 7 | `server/src/services/governed-workflows-extensions.ts:106` | `"workflow"` | `saveDefinition` (commit workflow.json + tag) |
| 8 | `server/src/services/governed-workflow-files.ts:177,212,277` | `"workflow"` | Studio multi-file editor (list/get/batch commit) |
| 9 | `server/src/services/workflow-ai-assistant.ts:283` | `"workflow"` | AI assistant resolveGitProvider closure passée à `governedWorkflowService` (la closure interne re-route vers `getWorkflowParsed`) |
| 10 | `server/src/routes/governed-workflows-ui.ts:437` | `"workflow"` | GET `/governed-workflows/:name/tags` |
| 11 | `server/src/routes/governed-workflows-ui.ts:528` | `"workflow"` | POST `/.../runs` HEAD resolution |

**11 callsites** au total.

Sites N°7-9 : ces services prennent `resolveGitProvider` comme dépendance et la passent ensuite à des sous-fonctions. Ils ont leur propre interface `resolveGitProvider` à mettre à jour (P2 ci-dessous).

### 2.4 UUID `66b458ea-9879-4256-a802-45da08589a0a` — **non trouvé en seed/migration**
Grep sur tout le repo retourne uniquement la spec elle-même. Cet UUID est issu d'une instance live (postgres dev de Tom). 

→ **Le dev team DOIT découvrir l'ID via une query live DB** avant d'exécuter M2 :
```sql
SELECT cli.id, cl.name, cli.config_json
FROM config_layer_items cli
JOIN config_layers cl ON cli.layer_id = cl.id
WHERE cli.item_type = 'git_provider'
  AND cli.company_id = '00000000-0000-4000-8000-000000000001'
  AND cl.enforced = true
  AND cl.archived_at IS NULL;
```
Le SQL de M2 utilisera l'ID retourné par cette query (paramétré côté script).

### 2.5 Path conventions write-side — **non symétriques avec spec**
`saveDefinition` (`extensions.ts:115`) commit en hard-coded `${args.name}/workflow.json`. `batchCommitWorkflowFiles` (`files.ts:285`), `getWorkflowFile` (`files.ts:217`), `listWorkflowFiles` (`files.ts:187` via `subtree: args.workflowName`) idem. Si le read-path passe à `workflows/<name>/workflow.json` et le write-path reste root-relatif, **ils diverger**ont au prochain commit Studio (création de fichiers fantôme à `<name>/workflow.json` en parallèle de la version live à `workflows/<name>/workflow.json`).

→ **Tous les write-sites doivent passer par `resolveResourcePath` aussi**, sinon l'éditeur Studio cassera dès la première sauvegarde post-déploiement.

### 2.6 Pas de UNIQUE constraint sur `agents(company_id, name)`
Migrations 0007, 0049, 0052, 0065 ont des UNIQUE INDEX, mais aucun sur `agents(company_id, name)`. La déduplication est applicative (`server/src/services/agents.ts:151-179` `deduplicateAgentName` suffixe en " 2", " 3"...). 

→ Race possible sur deux `create_agent` concurrents. Acceptable pour la démo (single-user), mais à flagger pour post-démo.

---

## 3. Architecture concerns surfacés en planning

### 3.1 Multi-tenant safety de `paths` — **OK avec note**
`provider.paths.agents = "../../../etc"` produit un path `../../../etc/<name>/agent.md` qui sera passé à `gitProvider.fetchBlob({ path, ref })`. Le `GitlabProvider` HTTP-encode et POST vers l'API REST GitLab `/projects/:id/repository/files/:path` — **GitLab REST normalise et rejette les `../`** côté serveur. Pas d'évasion possible.

Cependant `LocalBareRepoProvider` (dev) lit en FS local. À auditer dans P0 (test unitaire `resolveResourcePath` rejette les paths qui contiennent `..`). Recommandation : ajouter une assertion `if (base.includes("..")) throw` dans le helper, fail-closed.

### 3.2 OAuth token cache key collision — **OK**
La cache key actuelle `${companyId}:${userId}` (`build-mcp-services.ts:181`) ne mixe pas les users. Ajouter `:${resourceType}` est inoffensif tant que le helper produit la même clé pour le même tuple. Aucun chemin ne peut servir le token du user A à une requête du user B. Recommandation côté implémentation : documenter que `resourceType` sert à choisir l'item DB (cas multi-items futur), pas à scope les tokens.

### 3.3 Surface d'erreur `AGENT_NOT_REGISTERED` — **safe**
`wrap()` dans `governed-workflows.tool.ts:42-76` mappe vers `{ isError: true, error_code, message, hints, retryable: false, ...err.data }`. Le `error_code` est une string fermée (membre de `WORKFLOW_ERROR_CODES`), aucun ID interne ne fuite par défaut. Le message d'erreur doit suivre le format actuel : `"Agent 'X' is not registered in MnM. Hint: Run create_agent..."`. Pas de leak.

Le `data.sub_cause: "AGENT_TAG_MISSING"` proposé en spec §5.6 est une string littérale, sans risque.

### 3.4 Log structure du skip-on-404 dans `setupWorkspace` — **standardiser**
Le warn DOIT être structuré (pas de string) :
```ts
console.warn("[mnm.setup_workspace] agent_md_missing", {
  companyId,        // UUID — OK à logger
  agentName,        // string — OK
  agentId,          // UUID DB — OK pour audit
  latestGitTag,     // string tag — OK
  providerProjectId,// string — OK
  fullPath,         // ex "agents/senior-dev/agent.md" — OK
  // INTERDIT : token, accessToken, configJson.token
});
```
Un test dédié (P5.b) doit vérifier que `console.warn` est appelé avec un objet contenant ces clés et **AUCUNE** clé `token`/`accessToken`.

### 3.5 Race `create_agent` — **acceptable pour démo, à flagger**
Pas de UNIQUE constraint (cf. 2.6). Deux MCP `create_agent` simultanés avec `name="senior-dev"` peuvent insérer 2 rows. Pour la démo, le risque est nul (un seul user, séquentiel). Post-démo : ajouter `CREATE UNIQUE INDEX agents_company_name_uq ON agents (company_id, name) WHERE archived_at IS NULL` (compatible avec les renames + archivages). **Hors scope de ce plan**.

### 3.6 Filtre `enabled = true` actuellement — **comportement à préserver**
`setupWorkspace`, `syncEnvironment` et `loadCanonicalAgent` filtrent déjà `enabled = true` (`governed-workflows.ts:820, 1182, 1234`). Ajouter `archived_at IS NULL` ne fait que rajouter une condition AND. **Aucune régression** sur les agents enabled non archivés.

### 3.7 Migration M2 — **wrap dans une transaction**
La spec §M2 enchaîne 3 UPDATEs. Si le serveur observe l'état entre l'UPDATE 1 (config_layer_items.paths) et l'UPDATE 2 (greeter/shouter archivés), un `setupWorkspace` concurrent verrait les nouveaux paths mais des agents legacy sans `agent.md` au nouveau path → 404 → skip-on-404 silent → instructions incomplètes.

→ **Recommandation** : exécuter M2 en single-transaction :
```sql
BEGIN;
  UPDATE config_layer_items SET ... WHERE id = '<discovered>';
  UPDATE agents SET archived_at = NOW(), enabled = false WHERE name IN ('greeter','shouter') AND company_id = '<demo>';
  UPDATE governed_workflow_definitions SET latest_git_tag = 'feature-dev/v1.0.2' WHERE name = 'feature-dev' AND company_id = '<demo>';
COMMIT;
```
Mais comme `resolveGitProvider` cache les providers process-lifetime (`build-mcp-services.ts:168`), il faut **redémarrer le serveur après M2** quand même. Le restart est plus efficace que le wrap-TX comme atomicité, mais TX recommandée par défense en profondeur.

### 3.8 Tests userId — **3 à protéger**
Tests existants à NON-régresser dans `server/src/services/__tests__/governed-workflows.test.ts` :
- `:202` — "propagates actor.id (when type=user) to resolveGitProvider..." (launchWorkflow)
- `:354` — "propagates actor.id through launchStep's getWorkflowParsed call..."
- `:803` — "propagates userId to resolveGitProvider so the per-user OAuth token is selected" (setupWorkspace)

Ces tests vérifient `expect(resolveSpy).toHaveBeenCalledWith({ companyId, userId: ... })`. Après refactor, ils devront accepter `{ companyId, userId, resourceType: "..." }`. 

→ **Stratégie** : ne PAS supprimer ces tests. Les ADAPTER en P2 pour matcher la nouvelle signature avec `expect.objectContaining({ userId: ... })` afin de découpler de l'évolution de la signature complète. Documenter cela dans la note de la PR.

### 3.9 SPEC AMENDMENT NEEDED — `agents.archived_at`
La spec §6.1 dit "Aucune modification au schema agents". **Faux** : il faut ajouter la colonne. Proposition d'amendement :
> §6.1 — Ajouter une migration Drizzle `0067_agents_archived_at.sql` :
> ```sql
> ALTER TABLE agents ADD COLUMN archived_at timestamptz;
> CREATE INDEX agents_company_archived_idx ON agents (company_id) WHERE archived_at IS NULL;
> ```
> et mise à jour de `packages/db/src/schema/agents.ts` pour ajouter `archivedAt: timestamp("archived_at", { withTimezone: true })`.

L'orchestrator est invité à acter cet amendement ; le plan ci-dessous l'inclut comme tâche **P3**.

---

## 4. TDD discipline rules (lecture obligatoire pour les devs)

### 4.1 Pas de test tautologique
- ❌ `expect(resolveResourcePath(p, "agent", "x", "y")).toBe(`${p.paths.agents}/x/y`)` — réimplémentation 1:1.
- ✅ `expect(resolveResourcePath({ paths: { agents: "agents" } }, "agent", "senior-dev", "agent.md")).toBe("agents/senior-dev/agent.md")` — encode la convention SPEC §5.5 attendue.

### 4.2 Une seule behavior par test
Chaque `it("...")` assert UNE conséquence d'UN behavior. `it("AGENT_NOT_REGISTERED quand row absente")` ne checke pas en plus le `archived_at` skip — ces deux behaviors sont des `it()` séparés.

### 4.3 Tester le contrat, pas le wiring
- ❌ `expect(db.select).toHaveBeenCalledTimes(1)` — couplage à l'impl.
- ✅ `expect(loadCanonicalAgent(...)).rejects.toMatchObject({ code: "AGENT_NOT_REGISTERED" })` — encode la spec.

### 4.4 Spies tolérés aux frontières I/O — avec assertion encodant le POURQUOI
Pour `resolveGitProvider` :
- ❌ `expect(spy).toHaveBeenCalled()` — pourquoi ?
- ✅ `expect(spy).toHaveBeenCalledWith(expect.objectContaining({ resourceType: "agent", userId: "u-42" }))` — encode "le path agent du provider du user u-42 est utilisé".

### 4.5 Ne JAMAIS mocker l'unit testée
Pour tester `loadCanonicalAgent`, on stub `resolveGitProvider`/`fetchBlob`/`shaCache`/`db`. On NE stub PAS `loadCanonicalAgent` lui-même.

### 4.6 Red → Green → Refactor strict
1. Écrire le test, voir l'échec avec le **message attendu** (souvent l'absence de la fonction, ou l'erreur fonctionnelle qu'on encode).
2. Implémenter le minimum pour passer en vert.
3. Refactorer si nécessaire, sans changer les tests verts.

### 4.7 Tests d'intégration vs unitaires
- **Unitaires** : `resolveResourcePath`, `createResolveGitProvider` cache key, parsing.
- **Intégrés DB** (vrai postgres via `setupTestDb()`) : `loadCanonicalAgent`, `setupWorkspace`, `getWorkflowParsed` — comme les tests existants `governed-workflows.test.ts`.
- **E2E** : un seul (P11), `feature-dev` step `tech-design` jusqu'au triplet `(agent_name, subagent_type, prompt_context)`.

---

## 5. Tasks (TDD strict, dependency-ordered)

### P0 — Helper `resolveResourcePath` (unit, isolé)

**Goal** : helper pur testable en isolation, qui encode la convention de path SPEC §5.5.

**Test first** — fichier `server/src/services/__tests__/git-resource-path.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { resolveResourcePath } from "../git-resource-path.js";

describe("resolveResourcePath", () => {
  it("returns <name>/<file> when paths is undefined (legacy root-layout)", () => {
    expect(
      resolveResourcePath({}, "agent", "senior-dev", "agent.md"),
    ).toBe("senior-dev/agent.md");
  });

  it("returns <name>/<file> when paths.<type> is empty string (split-repo, type at repo root)", () => {
    expect(
      resolveResourcePath({ paths: { agents: "" } }, "agent", "senior-dev", "agent.md"),
    ).toBe("senior-dev/agent.md");
  });

  it("returns <prefix>/<name>/<file> when paths.<type> is set", () => {
    expect(
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "senior-dev", "agent.md"),
    ).toBe("agents/senior-dev/agent.md");
  });

  it("uses workflows prefix when resourceType is workflow", () => {
    expect(
      resolveResourcePath(
        { paths: { agents: "agents", workflows: "workflows" } },
        "workflow",
        "feature-dev",
        "workflow.json",
      ),
    ).toBe("workflows/feature-dev/workflow.json");
  });

  it("rejects a paths prefix containing '..' to prevent traversal in LocalBareRepoProvider", () => {
    expect(() =>
      resolveResourcePath(
        { paths: { agents: "../../etc" } },
        "agent",
        "x",
        "y",
      ),
    ).toThrow(/traversal|invalid path/i);
  });

  it("rejects an absolute paths prefix", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "/etc" } }, "agent", "x", "y"),
    ).toThrow(/absolute|invalid path/i);
  });
});
```

**Implementation** — nouveau fichier `server/src/services/git-resource-path.ts` :
```ts
export type ResourceType = "agent" | "workflow";

export interface ProviderWithPaths {
  paths?: Partial<Record<ResourceType, string>>;
}

export function resolveResourcePath(
  provider: ProviderWithPaths,
  resourceType: ResourceType,
  name: string,
  file: string,
): string {
  const base = provider.paths?.[resourceType] ?? "";
  if (base.startsWith("/")) {
    throw new Error(`resolveResourcePath: invalid path '${base}' (absolute paths are not allowed)`);
  }
  if (base.split("/").includes("..")) {
    throw new Error(`resolveResourcePath: invalid path '${base}' (traversal segment '..' is not allowed)`);
  }
  return base === "" ? `${name}/${file}` : `${base}/${name}/${file}`;
}
```

**Files touched** : `server/src/services/git-resource-path.ts` (NEW), `server/src/services/__tests__/git-resource-path.test.ts` (NEW).

**Definition of done** : `bun test server/src/services/__tests__/git-resource-path.test.ts` → 6 verts. `bun run typecheck` passe.

---

### P1 — Étendre `WORKFLOW_ERROR_CODES` (unit)

**Goal** : ajouter `AGENT_NOT_REGISTERED` et `AGENT_GIT_FILE_MISSING`.

**Test first** — étendre `packages/governed-workflows/src/errors.test.ts:21` (test snapshot frozen) en ajoutant les deux clés à l'objet attendu :
```ts
expect(WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED).toBe("AGENT_NOT_REGISTERED");
expect(WORKFLOW_ERROR_CODES.AGENT_GIT_FILE_MISSING).toBe("AGENT_GIT_FILE_MISSING");
```
Et étendre le `expect(WORKFLOW_ERROR_CODES).toEqual({...})` block pour inclure les nouvelles clés.

**Implementation** : ajouter les deux clés dans `packages/governed-workflows/src/errors.ts:59-100` avec JSDoc concise expliquant le moment d'émission.

**Files touched** : `packages/governed-workflows/src/errors.ts`, `packages/governed-workflows/src/errors.test.ts`.

**Definition of done** : `bun test packages/governed-workflows` → vert. `bun run typecheck` passe.

---

### P2 — Étendre `ResolveGitProviderArgs` avec `resourceType` (unit + intégration)

**Goal** : la signature de `resolveGitProvider` accepte un `resourceType` optionnel (rétro-compat). Le cache key inclut ce `resourceType`. Le helper expose `paths` lu depuis `configJson`.

**Test first** — créer `server/src/mcp/__tests__/build-mcp-services.test.ts` (DB-intégré) :

```ts
describe("createResolveGitProvider — paths exposure", () => {
  it("exposes provider.paths read from config_json on the GitProvider", async () => {
    // Seed: config_layer_item with config_json including paths
    await db.execute(sql`
      INSERT INTO config_layers (id, company_id, name, scope, enforced, ...)
        VALUES (...);
      INSERT INTO config_layer_items (id, company_id, layer_id, item_type, name, config_json, enabled)
        VALUES (..., 'git_provider', 'default', '{"kind":"local","providerId":"x","repoDir":"/tmp/x","paths":{"agents":"agents","workflows":"workflows"}}', true);
    `);

    const resolve = createResolveGitProvider(db);
    const provider = await resolve({ companyId, resourceType: "agent" });
    expect((provider as any).paths).toEqual({ agents: "agents", workflows: "workflows" });
  });

  it("caches per resourceType so two calls with different resourceType return providers reflecting the same paths", async () => {
    // Encode the SPEC §5.4 (multi-items selection) at MVP single-item granularity:
    // single item covers both types; both calls receive a provider whose .paths
    // includes both agents and workflows keys (the item's full config_json).
    const resolve = createResolveGitProvider(db);
    const a = await resolve({ companyId, resourceType: "agent" });
    const w = await resolve({ companyId, resourceType: "workflow" });
    expect((a as any).paths.agents).toBe("agents");
    expect((w as any).paths.workflows).toBe("workflows");
  });
});
```

Et adapter les 3 tests de userId existants dans `server/src/services/__tests__/governed-workflows.test.ts:202, :354, :803` :
```ts
expect(resolveSpy).toHaveBeenCalledWith(
  expect.objectContaining({ companyId, userId: "u-42" }),
);
// Add new assertion: resourceType propagates
expect(resolveSpy).toHaveBeenCalledWith(
  expect.objectContaining({ resourceType: expect.stringMatching(/^(agent|workflow)$/) }),
);
```

**Implementation** :
1. `server/src/mcp/build-mcp-services.ts:45-48` — `ResolveGitProviderArgs` gagne `resourceType?: ResourceType`.
2. Ligne 168-170 — caches keyés par `${companyId}:${resourceType ?? "default"}` (company) et `${companyId}:${userId}:${resourceType ?? "default"}` (user).
3. Ligne 280-294 — la query `config_layer_items` renvoie tous les items `git_provider` actifs (non `.limit(1)`). La sélection prend le premier item dont `configJson.paths?.[resourceType]` est défini, ou sinon le premier item tout court (single-item legacy fallback).
4. Ligne 304-336 — après construction du `GitlabProvider`/`LocalBareRepoProvider`, attacher `provider.paths = (cfg.paths ?? {}) as Partial<Record<ResourceType,string>>` côté résolveur (extension non-fonctionnelle de l'instance).

**Files touched** :
- `server/src/mcp/build-mcp-services.ts`
- `server/src/services/governed-workflows.ts:69` (interface deps)
- `server/src/services/governed-workflows-extensions.ts:81` (interface saveDefinition)
- `server/src/services/governed-workflow-files.ts:42` (interface deps)
- `server/src/services/workflow-ai-assistant.ts:72,283` (interface + closure)
- Tous les 3 tests userId existants (adapter les `expect`)

**Definition of done** :
- `bun test server/src/mcp/__tests__/build-mcp-services.test.ts` — 2 verts.
- `bun test server/src/services/__tests__/governed-workflows.test.ts` — tous les tests existants verts (3 userId tests adaptés mais non régressés).
- `bun run typecheck` passe.

**Risque** : la closure dans `workflow-ai-assistant.ts:282-283` aplatit le `resourceType`. Solution : passer le `resourceType` à travers la closure plutôt que de hardcoder (à voir en P9).

---

### P3 — Migration Drizzle `agents.archived_at` (DB)

**Goal** : ajouter la colonne + index partial. **AMENDEMENT SPEC** (§3.9 ci-dessus).

**Test first** — créer `packages/db/src/migrations/0067_agents_archived_at.test.ts` (mirror de `0065_governed_workflows.test.ts` qui regex-match le SQL) :
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0067_agents_archived_at", () => {
  const sql = readFileSync(join(__dirname, "0067_agents_archived_at.sql"), "utf-8");

  it("adds archived_at timestamptz column on agents", () => {
    expect(sql).toMatch(/ALTER TABLE\s+"?agents"?\s+ADD COLUMN\s+"?archived_at"?\s+timestamptz/i);
  });

  it("creates a partial index on (company_id) WHERE archived_at IS NULL", () => {
    expect(sql).toMatch(/CREATE INDEX[\s\S]*agents[\s\S]*company_id[\s\S]*archived_at IS NULL/i);
  });
});
```

**Implementation** :
1. Fichier `packages/db/src/migrations/0067_agents_archived_at.sql` :
   ```sql
   ALTER TABLE "agents" ADD COLUMN "archived_at" timestamptz;
   --> statement-breakpoint
   CREATE INDEX "agents_company_active_idx" ON "agents" ("company_id") WHERE "archived_at" IS NULL;
   ```
2. Mise à jour `packages/db/src/schema/agents.ts:38` (juste après `enabled`):
   ```ts
   archivedAt: timestamp("archived_at", { withTimezone: true }),
   ```
3. Mise à jour `packages/db/src/migrations/meta/_journal.json` (entrée pour 0067).

**Files touched** :
- `packages/db/src/migrations/0067_agents_archived_at.sql` (NEW)
- `packages/db/src/migrations/0067_agents_archived_at.test.ts` (NEW)
- `packages/db/src/schema/agents.ts`
- `packages/db/src/migrations/meta/_journal.json`

**Definition of done** :
- `bun test packages/db/src/migrations/0067_agents_archived_at.test.ts` — 2 verts.
- `bun run --cwd packages/db migrate` (ou le script équivalent du repo) applique la migration sans erreur sur l'embedded postgres.
- `bun run typecheck` passe (le champ `archivedAt` est utilisable dans Drizzle queries).

---

### P4 — Refactor `loadCanonicalAgent` : throw `AGENT_NOT_REGISTERED` (DB-intégré)

**Goal** : passer du `null` silencieux à l'erreur dure SPEC §5.6.

**Test first** — étendre `server/src/services/__tests__/governed-workflows.test.ts` (nouvelle suite "loadCanonicalAgent") :

```ts
describe("governedWorkflowService — loadCanonicalAgent (T6 git-first)", () => {
  // (the function is private, so we exercise it via launchStep with currentAgents)

  it("throws AGENT_NOT_REGISTERED when no agents row exists for the referenced step.agent", async () => {
    // Seed: a workflow that references agent "ghost" but no agents row for "ghost"
    const companyId = await seedCompanyWithWorkflow({
      workflowName: "hello-world",
      stepAgent: "ghost",
      // intentionally NOT inserting any agents row
    });
    const svc = mkSvcWithProvider(stubProvider);
    const { runId, firstStep } = await svc.launchWorkflow({...});
    await expect(
      svc.launchStep({
        companyId, runId, stepId: firstStep, actor: { type: "user", id: "u-1" },
        currentAgents: { "mnm--ghost": "any-sha" },
        sessionTools: ["Task","Write","Read"],
      }),
    ).rejects.toMatchObject({
      code: "AGENT_NOT_REGISTERED",
      // Hint must guide the user toward the fix:
      hints: expect.arrayContaining([expect.stringMatching(/create_agent.*ghost/i)]),
    });
  });

  it("throws AGENT_NOT_REGISTERED with sub_cause AGENT_TAG_MISSING when row exists but latest_git_tag is null", async () => {
    const companyId = await seedCompanyWithWorkflow({ workflowName: "hello-world", stepAgent: "blank" });
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyId}, 'blank', 'claude_local', NULL, true)
    `);
    // ... launchStep
    await expect(svc.launchStep({...})).rejects.toMatchObject({
      code: "AGENT_NOT_REGISTERED",
      data: expect.objectContaining({ sub_cause: "AGENT_TAG_MISSING" }),
    });
  });

  it("skips archived agents (treats them as not-registered)", async () => {
    const companyId = await seedCompanyWithWorkflow({ workflowName: "hello-world", stepAgent: "old" });
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled, archived_at)
      VALUES (${companyId}, 'old', 'claude_local', 'v1.0.0', true, NOW())
    `);
    await expect(svc.launchStep({...})).rejects.toMatchObject({
      code: "AGENT_NOT_REGISTERED",
    });
  });

  it("succeeds when row exists, enabled, archived_at IS NULL, with a tag, and the .md is reachable", async () => {
    // happy path — return the triplet without throwing
    // (this also implicitly tests the path resolution via paths.agents)
  });
});
```

**Implementation** — `server/src/services/governed-workflows.ts:808-842` :
```ts
async function loadCanonicalAgent(
  companyId: string,
  agentName: string,
  userId?: string | null,
): Promise<{ content: string; sha: string }> {
  const [row] = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.companyId, companyId),
        eq(agents.name, agentName),
        eq(agents.enabled, true),
        isNull(agents.archivedAt),
      ),
    );
  if (!row) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
      `Agent '${agentName}' is not registered in MnM for this company.`,
      [
        `Run create_agent with name='${agentName}' and latestGitTag=<tag> to register it`,
      ],
      { agent_name: agentName, sub_cause: "AGENT_ROW_MISSING" },
    );
  }
  if (!row.latestGitTag) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
      `Agent '${agentName}' has no latest_git_tag — cannot resolve its agent.md.`,
      [
        `Run create_agent again with latestGitTag=<tag>, or update the agents row directly`,
      ],
      { agent_name: agentName, sub_cause: "AGENT_TAG_MISSING" },
    );
  }
  const gitProvider = await resolveGitProvider({ companyId, userId: userId ?? null, resourceType: "agent" });
  const mdPath = resolveResourcePath(gitProvider as ProviderWithPaths, "agent", row.name, "agent.md");
  const cached = shaCache.get(PROVIDER_ID, mdPath, row.latestGitTag);
  const content = cached !== undefined
    ? cached
    : await (async () => {
        const blob = await gitProvider.fetchBlob({ path: mdPath, ref: row.latestGitTag! });
        shaCache.set(PROVIDER_ID, mdPath, row.latestGitTag!, blob);
        return blob;
      })();
  const sha = createHash("sha256").update(content).digest("hex");
  return { content, sha };
}
```

Et le callsite dans `launchStep:583-589` qui faisait `if (canonical !== null && ...)` doit devenir un appel sans le null-check (l'erreur remonte directement) :
```ts
const canonical = await loadCanonicalAgent(args.companyId, required, args.actor.type === "user" ? args.actor.id : null);
const provided = args.currentAgents[namespacedName];
if (provided !== canonical.sha) {
  throw new GovernedWorkflowError(WORKFLOW_ERROR_CODES.AGENTS_STALE, ...);
}
```

**Files touched** :
- `server/src/services/governed-workflows.ts:808-842` + `:583-614`
- `server/src/services/__tests__/governed-workflows.test.ts` (nouvelles suites)

**Definition of done** :
- 4 nouveaux tests verts.
- Test existant `:1107` ("returns agents_stale...") toujours vert (même contrat, l'agent existe et a un tag dans le seed).
- `bun run typecheck` passe.

---

### P5 — Refactor `setupWorkspace` : skip-on-404 + filter `archived_at IS NULL` (DB-intégré)

**Goal** : SPEC §5.7. Si `fetchBlob` 404, log warn structuré et continue. Filtre archived.

**Test first** — étendre la suite `setupWorkspace` existante :

```ts
it("skips agents whose agent.md is missing in the repo at the pinned tag and logs a structured warn", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const companyId = await seedCompanyWithAgents({
    issuePrefix: "T6SK",
    agents: [
      { name: "alpha", enabled: true },     // .md present in stub
      { name: "ghost", enabled: true },     // .md missing — provider 404s
    ],
  });
  const provider = mk404Provider({ missingFor: "ghost" }); // throws GitProviderError code:"not_found" for ghost
  const svc = mkSvcWith(provider);
  const result = await svc.setupWorkspace({ companyId });

  expect(result.agents.map((a) => a.name)).toEqual(["mnm--alpha"]);
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining("agent_md_missing"),
    expect.objectContaining({
      companyId,
      agentName: "ghost",
      latestGitTag: expect.any(String),
      fullPath: expect.stringContaining("/ghost/agent.md"),
    }),
  );
  // CRITICAL: no token in the log
  const callArgs = warnSpy.mock.calls.flat();
  for (const arg of callArgs) {
    if (typeof arg === "object" && arg !== null) {
      expect(arg).not.toHaveProperty("token");
      expect(arg).not.toHaveProperty("accessToken");
    }
  }
  warnSpy.mockRestore();
});

it("excludes archived agents from setupWorkspace output", async () => {
  const companyId = await seedCompanyWithAgents({
    issuePrefix: "T6AR",
    agents: [
      { name: "live", enabled: true },                                     // included
      { name: "old",  enabled: true, archivedAt: new Date() },             // excluded
    ],
  });
  const result = await mkSvc().setupWorkspace({ companyId });
  expect(result.agents.map((a) => a.name)).toEqual(["mnm--live"]);
});

it("re-throws non-404 GitProviderErrors (auth, network) instead of skipping", async () => {
  const companyId = await seedCompanyWithAgents({
    issuePrefix: "T6AU",
    agents: [{ name: "alpha", enabled: true }],
  });
  const provider = mkAuthErrorProvider(); // throws GitProviderError code:"auth_failed"
  const svc = mkSvcWith(provider);
  await expect(svc.setupWorkspace({ companyId })).rejects.toThrow(/auth_failed|GitProviderError/);
});
```

**Implementation** — `governed-workflows.ts:1227-1272` :
```ts
async function setupWorkspace(args: SetupWorkspaceArgs): Promise<SetupWorkspaceResult> {
  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.companyId, args.companyId),
        eq(agents.enabled, true),
        isNull(agents.archivedAt),
      ),
    );

  const gitProvider = await resolveGitProvider({
    companyId: args.companyId,
    userId: args.userId ?? null,
    resourceType: "agent",
  });
  const out: SetupWorkspaceAgent[] = [];
  for (const a of rows) {
    if (!a.latestGitTag) continue;
    const mdPath = resolveResourcePath(gitProvider as ProviderWithPaths, "agent", a.name, "agent.md");
    try {
      const cached = shaCache.get(PROVIDER_ID, mdPath, a.latestGitTag);
      const content = cached !== undefined
        ? cached
        : await (async () => {
            const blob = await gitProvider.fetchBlob({ path: mdPath, ref: a.latestGitTag! });
            shaCache.set(PROVIDER_ID, mdPath, a.latestGitTag!, blob);
            return blob;
          })();
      const sha = createHash("sha256").update(content).digest("hex");
      out.push({
        name: `mnm--${a.name}`,
        content,
        sha,
        targetPath: `~/.claude/agents/mnm--${a.name}.md`,
      });
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") {
        console.warn("[mnm.setup_workspace] agent_md_missing", {
          companyId: args.companyId,
          agentId: a.id,
          agentName: a.name,
          latestGitTag: a.latestGitTag,
          fullPath: mdPath,
        });
        continue;
      }
      throw err;
    }
  }

  return { agents: out, instructions: ... };
}
```

(Import `GitProviderError` depuis `@mnm/git-provider`.)

**Files touched** :
- `server/src/services/governed-workflows.ts:1227-1272`
- `server/src/services/__tests__/governed-workflows.test.ts` (3 nouveaux tests)

**Definition of done** : 3 verts + tous les tests `setupWorkspace` existants verts.

---

### P6 — Refactor `getWorkflowParsed` : path via helper (DB-intégré)

**Goal** : path = `resolveResourcePath(provider, "workflow", name, "workflow.json")`.

**Test first** — nouveau test dans la suite "discovery" :

```ts
it("fetches workflow.json under the workflows/ prefix when paths.workflows is set", async () => {
  const seenPaths: string[] = [];
  const provider = {
    ...stubProvider,
    paths: { workflows: "workflows" }, // simulate the resolveGitProvider attachment
    fetchBlob: async ({ path }: { path: string }) => {
      seenPaths.push(path);
      return JSON.stringify({...});
    },
  };
  const svc = governedWorkflowService(db, {
    resolveGitProvider: (async () => provider) as any,
    shaCache: new ShaCache(),
  });
  await svc.getWorkflowParsed({ companyId: companyA, name: "hello-world" });
  expect(seenPaths).toContain("workflows/hello-world/workflow.json");
});

it("falls back to <name>/workflow.json when paths.workflows is undefined (legacy)", async () => {
  // No paths attribute on provider
  expect(seenPaths).toContain("hello-world/workflow.json");
});
```

**Implementation** — `governed-workflows.ts:332-337` :
```ts
const gitProvider = await resolveGitProvider({
  companyId: args.companyId,
  userId: args.userId ?? null,
  resourceType: "workflow",
});
const gitSha = await gitProvider.resolveRef({ ref });
const workflowRepoPath = resolveResourcePath(
  gitProvider as ProviderWithPaths,
  "workflow",
  args.name,
  "workflow.json",
);
```

`workflowRepoPath` est ensuite passé à `makeResolveSource` (`:702`), qui dérivera correctement `workflowDir = "workflows/<name>"` ou `"<name>"` selon le cas — gates auto-suivent.

**Files touched** : `server/src/services/governed-workflows.ts:332-337` + tests.

**Definition of done** : 2 verts + tests existants `getWorkflowParsed`/`launchWorkflow`/`launchStep`/`completeStep` toujours verts.

---

### P7 — Étendre `create_agent` MCP avec `latestGitTag` (DB-intégré)

**Goal** : SPEC §6.6. Input zod gagne `latestGitTag?: string`. Si fourni, validate le `.md` côté serveur via `resolveGitProvider({ resourceType: "agent" })` + `fetchBlob`. 404 → `AGENT_GIT_FILE_MISSING`.

**Test first** — créer/étendre `server/src/mcp/tools/__tests__/agents.tool.test.ts` :

```ts
describe("create_agent — latestGitTag validation", () => {
  it("inserts the agent row with latest_git_tag populated when the .md exists in the repo", async () => {
    const provider = mkProviderWith({ paths: { agents: "agents" }, blobs: { "agents/senior-dev/agent.md@v1": "# senior dev" } });
    const result = await callCreateAgent({
      name: "senior-dev",
      latestGitTag: "v1",
      adapterType: "claude_local",
    });
    const row = await db.select().from(agents).where(eq(agents.name, "senior-dev"));
    expect(row[0].latestGitTag).toBe("v1");
  });

  it("throws AGENT_GIT_FILE_MISSING when latestGitTag is supplied but the .md is not in the repo", async () => {
    const provider = mkProviderWith({ paths: { agents: "agents" }, blobs: {} }); // empty repo
    await expect(callCreateAgent({
      name: "ghost",
      latestGitTag: "v1",
    })).rejects.toMatchObject({
      code: "AGENT_GIT_FILE_MISSING",
      hints: expect.arrayContaining([expect.stringMatching(/agents\/ghost\/agent\.md/)]),
    });
  });

  it("preserves legacy behavior (no Git check) when latestGitTag is omitted", async () => {
    // Should NOT call gitProvider.fetchBlob at all
    const fetchSpy = vi.fn();
    const result = await callCreateAgent({ name: "legacy", adapterType: "claude_local" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.id).toBeDefined();
  });
});
```

**Implementation** — `server/src/mcp/tools/agents.tool.ts:87-127` :
```ts
input: z.object({
  name: z.string().min(1).describe("Agent name"),
  title: z.string().optional(),
  adapterType: z.string().optional(),
  reportsTo: z.string().uuid().optional(),
  capabilities: z.string().optional(),
  budgetMonthlyCents: z.number().int().min(0).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  latestGitTag: z.string().min(1).optional()
    .describe("If supplied, server validates that agents/<name>/agent.md exists at this tag in the company's git provider."),
}),
handler: async ({ input, actor }) => {
  if (input.latestGitTag) {
    const gitProvider = await services.resolveGitProvider({
      companyId: actor.companyId,
      userId: actor.userId ?? null,
      resourceType: "agent",
    });
    const mdPath = resolveResourcePath(gitProvider as ProviderWithPaths, "agent", input.name, "agent.md");
    try {
      await gitProvider.fetchBlob({ path: mdPath, ref: input.latestGitTag });
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.AGENT_GIT_FILE_MISSING,
          `Agent file '${mdPath}' not found at tag '${input.latestGitTag}'.`,
          [`Commit ${mdPath} to the company's git repo at tag '${input.latestGitTag}' first`],
        );
      }
      throw err;
    }
  }
  const agent = await services.agents.create(actor.companyId, {
    ...,
    latestGitTag: input.latestGitTag ?? null, // NEW: pass through
    createdByUserId: actor.userId ?? null,
  });
  ...
}
```

Et étendre `server/src/services/agents.ts` `create()` pour accepter `latestGitTag`. (Une lecture du fichier complet sera nécessaire en P7 pour ne pas casser le contract existant.)

**Files touched** :
- `server/src/mcp/tools/agents.tool.ts:87-127`
- `server/src/services/agents.ts` `create()` signature + insert
- `server/src/mcp/tools/__tests__/agents.tool.test.ts` (NEW)

**Definition of done** : 3 verts + zero régression sur les tools `agents.tool.ts` existants.

---

### P8 — Refactor write-side path symétrique (DB-intégré)

**Goal** : `saveDefinition`, `batchCommitWorkflowFiles`, `getWorkflowFile`, `listWorkflowFiles` doivent utiliser `resolveResourcePath` pour rester en symétrie avec `getWorkflowParsed`. Sinon les sauvegardes Studio écriront à `<name>/workflow.json` alors que les lectures iront chercher à `workflows/<name>/workflow.json`.

**Test first** — adapter `server/src/services/__tests__/governed-workflow-files.test.ts` (DB-intégré) :

```ts
it("listWorkflowFiles uses workflows/<name>/ subtree when paths.workflows is set", async () => {
  const seenSubtrees: (string|undefined)[] = [];
  const provider = mkProviderRecording({
    paths: { workflows: "workflows" },
    onFetchTree: (args) => seenSubtrees.push(args.subtree),
  });
  await listWorkflowFiles({ resolveGitProvider: async () => provider, shaCache: new ShaCache() }, {
    companyId, userId: null, workflowName: "hello-world", ref: "v1.0.0",
  });
  expect(seenSubtrees).toContain("workflows/hello-world");
});

it("batchCommitWorkflowFiles prefixes each path with workflows/<name>/ when paths.workflows is set", async () => {
  let actions: any[] = [];
  const provider = mkProviderRecording({
    paths: { workflows: "workflows" },
    onCommitMultipleFiles: (args) => { actions = args.actions; return { sha: "x" }; },
  });
  await batchCommitWorkflowFiles(db, deps, { workflowName: "hello-world", changes: [{ path: "workflow.json", content: "{}" }], ... });
  expect(actions[0].path).toBe("workflows/hello-world/workflow.json");
});
```

Idem tests pour `saveDefinition` et `getWorkflowFile`.

**Implementation** :
- `governed-workflows-extensions.ts:115-121` : remplacer `path: \`${args.name}/workflow.json\`` par `resolveResourcePath(gitProvider, "workflow", args.name, "workflow.json")`.
- `governed-workflow-files.ts:182-189` : `subtree: resolveResourcePath(gitProvider, "workflow", args.workflowName, "").replace(/\/$/, "")` (helper pour le subtree-only). Ou un helper `resolveResourceDir(provider, "workflow", name)` plus propre.
- `governed-workflow-files.ts:217` : `fullPath = resolveResourcePath(gitProvider, "workflow", args.workflowName, args.path)`.
- `governed-workflow-files.ts:285` : pareil.
- `stripPrefix` dans le même fichier doit utiliser le nouveau prefix.

**Files touched** :
- `server/src/services/governed-workflows-extensions.ts:115-121`
- `server/src/services/governed-workflow-files.ts:182-289`
- tests adaptés

**Definition of done** : tests existants Studio (U13) + nouveaux verts. **Important** : utiliser un seed dont `configJson.paths.workflows = "workflows"` pour les tests (sinon legacy fallback masque le bug).

---

### P9 — `workflow-ai-assistant.ts` : propager `resourceType` (DB-intégré)

**Goal** : `:283` actuellement aplatit `resolveGitProvider` en perdant le `resourceType`. Le service AI lit `workflow.json` puis `gates/*.ts` (les deux sont `resourceType: "workflow"`).

**Test first** — étendre `workflow-ai-assistant.test.ts` :
```ts
it("calls resolveGitProvider with resourceType 'workflow' when loading the parsed workflow + gate tree", async () => {
  const spy = vi.fn(async () => stubProvider);
  await streamWorkflowAiChat(db, { ...deps, resolveGitProvider: spy }, { ... });
  // The function may call resolveGitProvider multiple times (parsed workflow,
  // listWorkflowFiles); ALL of them should be resourceType: "workflow"
  for (const call of spy.mock.calls) {
    expect(call[0]).toMatchObject({ resourceType: "workflow" });
  }
});
```

**Implementation** — `workflow-ai-assistant.ts:282-285`. Plus simple : la closure transforme l'arg en gardant tout :
```ts
resolveGitProvider: (a) =>
  deps.resolveGitProvider({ ...a, userId: a.userId ?? null }),
```
(actuellement la closure hardcode `userId: null` et drop tout le reste — réécrire pour préserver `resourceType`).

**Files touched** : `server/src/services/workflow-ai-assistant.ts:282-285` + tests.

**Definition of done** : 1 vert + tests AI existants verts.

---

### P10 — Routes UI : passer `resourceType` (intégration HTTP)

**Goal** : SPEC §6.7. `governed-workflows-ui.ts:437` (tags listing) et `:528` (HEAD resolution) appellent `resolveGitProvider` directement — ajouter `resourceType: "workflow"` à chaque.

**Test first** : pas de nouveau test si le test U2 existant `governed-workflows-ui.test.ts` couvre déjà le tag-listing. Ajouter une assertion sur le spy resolveGitProvider si présent. Sinon : c'est un ajout de paramètre passable, on s'appuie sur typecheck.

**Implementation** — modifier les 2 callsites pour passer `resourceType: "workflow"`.

**Files touched** : `server/src/routes/governed-workflows-ui.ts:437,528`.

**Definition of done** : `bun run typecheck` passe + tests routes verts.

---

### P11 — Test E2E : `feature-dev` step `tech-design` (E2E)

**Goal** : SPEC §M4 step 5-6 — lance jusqu'au triplet retourné par `launch_governed_step` sans erreur.

**Test first** — créer `server/src/__tests__/feature-dev-techdesign.e2e.test.ts` (mirroir de `t6-bootstrap-and-launch.e2e.test.ts`) :

```ts
it("launches feature-dev tech-design step end-to-end", async () => {
  // Seed: company, agents (senior-dev with latestGitTag), workflow def feature-dev,
  // git_provider config_layer_item with paths.{agents,workflows}
  // Use a LocalBareRepoProvider seeded with:
  //   agents/senior-dev/agent.md
  //   workflows/feature-dev/workflow.json (referencing senior-dev)
  //   workflows/feature-dev/gates/*.gate.ts

  const launchResult = await svc.launchWorkflow({
    companyId,
    name: "feature-dev",
    params: { ticket_id: "ISSUE-NN", gitlab_project: "example-org/repo" },
    actor: { type: "user", id: "u-1" },
  });

  const stepResult = await svc.launchStep({
    companyId,
    runId: launchResult.runId,
    stepId: "tech-design",
    actor: { type: "user", id: "u-1" },
    currentAgents: { "mnm--senior-dev": expectedSeniorDevSha },
    sessionTools: ["Task", "Write", "Read", "Grep", "Glob"],
  });

  expect(stepResult).toMatchObject({
    agentName: "senior-dev",
    subagentType: "mnm--senior-dev",
    promptContext: expect.objectContaining({
      ticket_id: "ISSUE-NN",
    }),
  });
});
```

**Implementation** : aucune — c'est un test d'acceptance. Les seeds gates `.gate.ts` doivent être minimal (gate `pass: true`) pour ne pas dépendre des canonical gates.

**Files touched** : `server/src/__tests__/feature-dev-techdesign.e2e.test.ts` (NEW).

**Definition of done** : test vert.

---

## 6. Tâches opérationnelles (M1 → M4)

### M1 — Repo `example-org/mnm-demo` (script bash, dev exécute manuellement)

**Goal** : SPEC §M1. Renommer `mnm-workflows-demo` → `mnm-demo`, restructurer, retag.

Script `scripts/migrate-2026-04-26-mnm-demo.sh` (à committer dans le repo MnM) :
```bash
#!/bin/bash
set -euo pipefail

# Run from a fresh clone of mnm-workflows-demo
cd "$(mktemp -d)"
git clone https://lab.enterprise.example/example-org/mnm-workflows.git mnm-demo
cd mnm-demo
git remote rename origin old
# Rename in GitLab UI first, then:
git remote add origin https://lab.enterprise.example/example-org/mnm-demo.git

# Restructure
mkdir -p agents workflows
git mv feature-dev/agents/senior-dev.md     agents/senior-dev/agent.md
git mv feature-dev/agents/dev.md            agents/dev/agent.md
git mv feature-dev/agents/review-watcher.md agents/review-watcher/agent.md
git mv feature-dev/agents/release-mgr.md    agents/release-mgr/agent.md
git mv feature-dev workflows/feature-dev
git mv product-feature-delivery workflows/product-feature-delivery 2>/dev/null || true

git commit -m "refactor: restructure repo per Git-first agents convention

agents/<name>/agent.md (was: feature-dev/agents/<name>.md)
workflows/<name>/{workflow.json,gates/*.gate.ts} (was: <name>/...)

Aligns with MnM 2026-04-26 spec (docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md)."

git push origin main

# Tags — global agents tag + new workflow tag
git tag agents/v1.0.0
git tag feature-dev/v1.0.2
git push origin agents/v1.0.0 feature-dev/v1.0.2
```

**Definition of done** :
- Le repo `mnm-demo` existe sur GitLab.
- `git ls-tree -r agents/v1.0.0` montre `agents/senior-dev/agent.md` (et 3 autres).
- `git ls-tree -r feature-dev/v1.0.2 -- workflows/feature-dev/` montre `workflow.json` + `gates/*.gate.ts`.

### M2 — DB updates (single-transaction)

**Goal** : SPEC §M2 + correction §3.7 (transactionality).

Pré-requis : exécuter d'abord la query découverte §2.4 pour obtenir l'ID réel du config_layer_item. Soit `<DISCOVERED_ID>`.

Script `scripts/migrate-2026-04-26-db.sql` :
```sql
-- Run AFTER P3 migration is applied (agents.archived_at column exists)
-- Run AFTER M1 (mnm-demo repo + tags exist)
BEGIN;

UPDATE config_layer_items
SET config_json = config_json
  || jsonb_build_object('projectId', 'example-org/mnm-demo')
  || jsonb_build_object('paths', jsonb_build_object('agents','agents','workflows','workflows'))
WHERE id = '<DISCOVERED_ID>';

UPDATE agents
SET archived_at = NOW(), enabled = false
WHERE name IN ('greeter','shouter')
  AND company_id = '00000000-0000-4000-8000-000000000001';

UPDATE governed_workflow_definitions
SET latest_git_tag = 'feature-dev/v1.0.2'
WHERE name = 'feature-dev'
  AND company_id = '00000000-0000-4000-8000-000000000001';

COMMIT;

-- After commit: REQUIRED restart of the MnM dev server
-- (resolveGitProvider cache is process-lifetime).
```

**Definition of done** : single SQL transaction execute sans erreur, puis serveur redémarré (`bun run dev`).

### M3 — Inscrire les 4 agents en DB via MCP

**Goal** : SPEC §M3. Après deploy de P7 (`create_agent` étendu).

Sequence d'appels MCP (via Claude Code session ou via une commande CLI test) :
```jsonc
mcp__plugin_mnm_mnm__create_agent({ name: "senior-dev",     latestGitTag: "agents/v1.0.0", title: "Senior Dev (EnterpriseCustomer demo)",     adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "dev",            latestGitTag: "agents/v1.0.0", title: "Dev (EnterpriseCustomer demo)",            adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "review-watcher", latestGitTag: "agents/v1.0.0", title: "Review Watcher (EnterpriseCustomer demo)", adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "release-mgr",    latestGitTag: "agents/v1.0.0", title: "Release Manager (EnterpriseCustomer demo)",adapterType: "claude_local" })
```

Chaque appel valide que `agents/<name>/agent.md@agents/v1.0.0` existe — si M1 mal exécuté, le call retourne `AGENT_GIT_FILE_MISSING` immédiatement.

**Definition of done** : `SELECT name, latest_git_tag FROM agents WHERE company_id = '<demo>' AND archived_at IS NULL` retourne 4 rows.

### M4 — Test run end-to-end manuel

**Goal** : SPEC §M4 step 1-6. Stop avant le step 7 (Tom prend le relais).

```jsonc
mcp__plugin_mnm_mnm__setup_workspace({})
// → returns 4 mnm--<name> agents to materialize
//   Write each .content to ~/.claude/agents/mnm--<name>.md

// Run /reload-plugins (manual, in Claude Code)

mcp__plugin_mnm_mnm__push_local_state({
  agents_provisioned: ["mnm--senior-dev","mnm--dev","mnm--review-watcher","mnm--release-mgr"],
  plugin_version: "0.x"
})

const launch = mcp__plugin_mnm_mnm__launch_governed_workflow({
  name: "feature-dev",
  params: { ticket_id: "ISSUE-NN", gitlab_project: "example-org/mnm-demo-app" }
})
// → returns { run_id, first_step: "tech-design", ... }

const step = mcp__plugin_mnm_mnm__launch_governed_step({
  run_id: launch.run_id,
  step_id: "tech-design",
  current_agents: { "mnm--senior-dev": <sha from setup_workspace>, ... },
  session_tools: ["Task","Write","Read","Grep","Glob","..."]
})
// MUST return:
//   { agent_name: "senior-dev",
//     subagent_type: "mnm--senior-dev",
//     prompt_context: { ticket_id: "ISSUE-NN" } }
// MUST NOT return: AGENTS_STALE, MISSING_TOOLS, AGENT_NOT_REGISTERED, 401, GIT_PROVIDER_ERROR
```

**Definition of done** : le triplet est retourné. Stop ici, M5 (Tom).

---

## 7. Acceptance criteria

1. **Migration P3 appliquée** : `\d agents` montre `archived_at timestamptz`, l'index `agents_company_active_idx` existe.
2. **Tests** : `bun test` global passe (zéro régression). Nouveaux tests P0/P1/P4/P5/P6/P7/P8/P9/P11 verts. Les 3 tests userId existants (lignes :202, :354, :803) verts après adaptation `expect.objectContaining`.
3. **Typecheck** : `bun run typecheck` passe sur tous les packages (incluant `packages/db`, `packages/governed-workflows`, `server`).
4. **M1 done** : repo `mnm-demo` créé avec layout `agents/<name>/agent.md` + `workflows/<name>/{workflow.json,gates/}` au tag `agents/v1.0.0` et `feature-dev/v1.0.2`.
5. **M2 done** : DB transaction passée, `config_layer_items[<DISCOVERED_ID>].config_json.paths = {agents:"agents",workflows:"workflows"}`, greeter/shouter archivés, server restarted.
6. **M3 done** : 4 rows agents (senior-dev, dev, review-watcher, release-mgr) avec `latest_git_tag = 'agents/v1.0.0'` et `archived_at IS NULL`.
7. **M4 done** : `launch_governed_step` retourne le triplet correct. Aucune erreur dans la réponse JSON.
8. **Symétrie write/read** : un commit Studio sur `feature-dev` produit un fichier à `workflows/feature-dev/workflow.json` (visible via `git show`), pas à `feature-dev/workflow.json` au root.

---

## 8. Recommended team setup pour la phase dev

**Subagent type** : `mnm-dev` (general-purpose dev avec accès Read/Edit/Write/Bash/Grep/Glob).

**Découpage suggéré (3 workers parallèles)** :

| Worker | Owns | Reasoning |
|---|---|---|
| dev-A — "core service" | P0, P2, P4, P6 | Cluster `governed-workflows.ts` + `build-mcp-services.ts`. Écrit le helper, refactor `loadCanonicalAgent` + `getWorkflowParsed`. **Critique pour la suite** — doit livrer P0+P2 en premier. |
| dev-B — "DB + errors" | P1, P3, P5 | Cluster schema + errors. Migration Drizzle + colonne, codes d'erreur, `setupWorkspace` skip-on-404. Indépendant de A jusqu'à P5 (qui dépend du helper P0). |
| dev-C — "tools + studio + AI" | P7, P8, P9, P10 | Cluster MCP tools + Studio service. `create_agent` extension, write-side path, AI assistant, routes UI. Dépend de P0 + P2 pour démarrer. |

**Sequencing strict** :
```
P0 → (P2, P3) parallèle → (P1) parallèle → (P4, P5, P6) parallèle après P0+P2 → (P7, P8, P9, P10) parallèle après P4+P6 → P11 (final E2E, single owner)
```

**Phases ops séquentielles** (un seul owner = team-lead ou Tom) :
```
M1 (post P0-P11) → M2 (post P3 + M1) → M3 (post P7 + M2) → M4 (post M3)
```

**Code review checkpoint** après P4 (`AGENT_NOT_REGISTERED` est le changement de comportement le plus visible). Reviewer = `mnm-code-review`. Si OK → green-light pour P7-P11.

---

## 9. Risks & open questions

| Risque | Mitigation |
|---|---|
| Le `<DISCOVERED_ID>` du config_layer_item change si la DB est resetée entre M2 et M4. | Le script M2 doit re-query l'ID dynamiquement plutôt que le hardcoder. |
| `LocalBareRepoProvider` (dev local) résout les paths côté FS — un `paths.agents = "../etc"` POURRAIT s'évader si `resolveResourcePath` ne reject pas. | P0 inclut le test "rejects '..' segment" et l'impl jette. Fail-closed dès le helper. |
| 3 tests userId existants vont casser car la signature change. | P2 les adapte explicitement. Documenté en §3.8. Ne PAS supprimer ces tests, juste les adapter. |
| `workflow-ai-assistant.ts:282-285` la closure aplatit `resourceType`. | P9 dédié à corriger. Worker dev-C. |
| Le restart serveur post-M2 oublié → `resolveGitProvider` cache process-lifetime sert l'ancien provider. | Ajouter au script M2 un `--restart-required` flag dans la sortie + doc explicite. |
| Race `create_agent` (pas de UNIQUE constraint). | Hors scope. Documenté §3.5 pour post-démo. |

---

## 10. Hors scope (rappel)

- Frontmatter YAML dans `agent.md` (refacto B post-démo).
- Tool MCP `register_agent_from_git`.
- Split sous-repos `mnm/agents`, `mnm/workflows`.
- Bouton UI "Promote to MnM agent" dans le Studio.
- UNIQUE constraint sur `agents(company_id, name)` (post-démo).
- Lifecycle complet d'archivage UI pour les agents (post-démo).
- M5 (smoke test démo) — Tom dimanche.
