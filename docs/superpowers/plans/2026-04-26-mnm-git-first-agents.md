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
| 5 | `server/src/services/governed-workflows.ts:1197` | `"agent"` | `syncEnvironment` (fetch agent.md). **userId ABSENT aujourd'hui** — bug latent du commit a93c085 (cf. §3.10). |
| 6 | `server/src/services/governed-workflows.ts:1238` | `"agent"` | `setupWorkspace` |
| 7 | `server/src/services/governed-workflows-extensions.ts:106` | `"workflow"` | `saveDefinition` (commit workflow.json + tag) |
| 8 | `server/src/services/governed-workflow-files.ts:177,212,277` | `"workflow"` | Studio multi-file editor (list/get/batch commit) |
| 9 | `server/src/services/workflow-ai-assistant.ts:283` | `"workflow"` | AI assistant closure (relais vers `governedWorkflowService`). **userId hardcoded à `null`** — bug latent (cf. §3.11). |
| 10 | `server/src/services/workflow-ai-assistant.ts:303-304` | `"workflow"` | `listWorkflowFiles` call (relais direct, déjà passe `userId` correctement). |
| 11 | `server/src/routes/governed-workflows-ui.ts:437` | `"workflow"` | GET `/governed-workflows/:name/tags` |
| 12 | `server/src/routes/governed-workflows-ui.ts:528` | `"workflow"` | POST `/.../runs` HEAD resolution |

**12 callsites** au total (round 2 : ajout de `:1197` syncEnvironment et split du site `workflow-ai-assistant.ts` en 2 lignes distinctes).

Sites N°7-10 : ces services prennent `resolveGitProvider` comme dépendance et la passent ensuite à des sous-fonctions. Ils ont leur propre interface `resolveGitProvider` à mettre à jour (P2 ci-dessous).

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
Le warn DOIT être structuré (pas de string), avec un préfixe stable pour le filtrage des tests :
```ts
console.warn("[mnm.setup_workspace] agent_md_missing", {
  companyId,         // UUID — OK à logger
  agentId,           // UUID DB — OK pour audit
  agentName,         // string — OK
  latestGitTag,      // string tag — OK
  providerProjectId, // string ex "example-org/mnm-demo" — OK (lu de gitProvider.providerId)
  fullPath,          // ex "agents/senior-dev/agent.md" — OK
  // INTERDIT : token, accessToken, configJson.token, refresh_token, secret, password, credential
});
```
Le test P5 (round 2) :
1. Filtre `warnSpy.mock.calls` sur `c[0] === "[mnm.setup_workspace] agent_md_missing"` (évite faux-positifs cf. M-5).
2. Asserte le shape exact du payload via `Object.keys(payload).sort()`.
3. Asserte qu'aucune clé du payload ne matche `/token|secret|password|credential/i`.

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

### 3.10 BLOCKER B-2 — `syncEnvironment` ne propage pas `userId`

`governed-workflows.ts:1197` actuellement : `await resolveGitProvider({ companyId: args.companyId })` — ni `userId`, ni `resourceType`. Or `syncEnvironment` est appelé par `pushLocalState` qui est lui-même appelé via le tool MCP `push_local_state` avec un actor authentifié. La série de fixes commits `08525f0` + `a93c085` + `e41d7e5` a corrigé `launchWorkflow` / `setupWorkspace` / `launchStep` / `completeStep` mais **a oublié `syncEnvironment`**. En `authenticated` mode, `pushLocalState` continue de bypasser le user OAuth token et tombe sur le PAT company.

→ Le plan élargit P5 (renommé en P5+P5b) pour couvrir ce site explicitement : ajouter `userId` à l'interface `SyncEnvironmentArgs`, le propager depuis `pushLocalState`, et le passer à `resolveGitProvider({ ..., resourceType: "agent", userId })`. Test régression P2.1 dédié (cf. §5.P2.1).

### 3.11 BLOCKER B-1 — `workflow-ai-assistant.ts:282-283` userId hardcoded

`workflow-ai-assistant.ts:282-283` actuellement :
```ts
resolveGitProvider: (a) =>
  deps.resolveGitProvider({ companyId: a.companyId, userId: null }),
```
La closure hardcode `userId: null`. Or `streamWorkflowAiChat` reçoit `input.userId` (cf. interface `AiAssistantInput:42` et call à ligne 308 `userId: input.userId` pour `listWorkflowFiles`). En `authenticated` mode, l'AI assistant utilise donc le PAT company pour fetch le workflow.json alors que la SSE request a une session user.

→ **Fix correct** : capturer `input.userId` dans la closure et le propager. Le plan §P9 (round 2) livre ce fix concret. Si dev-C ne peut pas livrer P9 dans les délais, retirer le claim "P9 fixes that" et documenter en follow-up post-démo (cf. §11 Round 2).

### 3.12 BLOCKER B-3 — Ordre P3 → M2 enforced

La spec §M2 archive greeter/shouter via `UPDATE agents SET archived_at = NOW()`. Mais P3 (migration `0067_agents_archived_at.sql`) doit être appliquée AVANT cette UPDATE, sinon Postgres throw `column "archived_at" does not exist`.

→ Ajout d'un **§M0** dans la séquence ops (`bun run db:migrate` qui applique les migrations Drizzle pendantes) à exécuter en pré-requis de M2. Acceptance criterion #5 explicite l'ordre. Le SQL de M2 commence par un `\d agents` (psql) ou un `SELECT column_name FROM information_schema.columns` pour fail-fast si la colonne manque.

### 3.9 SPEC AMENDMENT NEEDED — `agents.archived_at`
La spec §6.1 dit "Aucune modification au schema agents". **Faux** : il faut ajouter la colonne. Proposition d'amendement :
> §6.1 — Ajouter une migration Drizzle `0067_agents_archived_at.sql` :
> ```sql
> ALTER TABLE agents ADD COLUMN archived_at timestamptz;
> CREATE INDEX agents_company_active_idx ON agents (company_id) WHERE archived_at IS NULL;
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

  // Round 2 — MAJOR M-1: reject `..` in name AND file too. The `paths` prefix
  // is the only attacker-controlled segment we previously checked, but a
  // malicious agent name (saved to DB via create_agent without a server-side
  // check) could re-introduce traversal: `agents/../etc/passwd/agent.md`.
  it("rejects a name containing '..'", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "../etc/passwd", "agent.md"),
    ).toThrow(/traversal|invalid path/i);
  });

  it("rejects a file containing '..'", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "senior-dev", "../../../passwd"),
    ).toThrow(/traversal|invalid path/i);
  });
});
```

**Implementation** — nouveau fichier `server/src/services/git-resource-path.ts` :
```ts
export type ResourceType = "agent" | "workflow";

export interface ProviderWithPaths {
  paths?: Partial<Record<ResourceType, string>>;
}

function rejectTraversal(label: string, value: string): void {
  if (value.startsWith("/")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (absolute paths are not allowed)`);
  }
  if (value.split("/").includes("..")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (traversal segment '..' is not allowed)`);
  }
}

export function resolveResourcePath(
  provider: ProviderWithPaths,
  resourceType: ResourceType,
  name: string,
  file: string,
): string {
  const base = provider.paths?.[resourceType] ?? "";
  rejectTraversal("paths prefix", base);
  rejectTraversal("name", name);
  rejectTraversal("file", file);
  return base === "" ? `${name}/${file}` : `${base}/${name}/${file}`;
}
```

**Files touched** : `server/src/services/git-resource-path.ts` (NEW), `server/src/services/__tests__/git-resource-path.test.ts` (NEW).

**Definition of done** : `bun test server/src/services/__tests__/git-resource-path.test.ts` → **8 verts** (round 2: +2 tests pour name/file traversal). `bun run typecheck` passe.

---

### P1 — Étendre `WORKFLOW_ERROR_CODES` (unit)

**Goal** : ajouter `AGENT_NOT_REGISTERED` et `AGENT_GIT_FILE_MISSING`. Réparer le test `toEqual` strict pré-existant qui omet 3 codes (cf. M-2).

**Pre-flight check (dev-B doit faire CECI EN PREMIER)** :
```bash
bun test packages/governed-workflows/src/errors.test.ts
```
Si rouge : le `toEqual` à `errors.test.ts:21-37` ne liste pas `WORKFLOW_FILE_INVALID_PATH`, `WORKFLOW_FILE_NOT_FOUND`, `WORKFLOW_FILE_EMPTY_CHANGES` (présents dans `errors.ts:92-99`). Vitest `toEqual` est strict-equal sur Objects donc ce test devrait être **déjà rouge** avant tout edit. Si vert : Vitest tolère les extra-keys (à confirmer empiriquement) — auquel cas la baseline est OK et on ajoute juste nos 2 clés.

**Test first** — comportement (pas tautologie). Round 2 supprime le test `expect(WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED).toBe("AGENT_NOT_REGISTERED")` qui réimplémente le mapping. Replacement : un test fonctionnel qui asserte que le code est routable via la chaîne complète `service throw → wrap() → MCP envelope` :

```ts
// packages/governed-workflows/src/errors.test.ts — adapter le toEqual
it("exposes the MVP workflow error codes (round 2: +AGENT_NOT_REGISTERED, +AGENT_GIT_FILE_MISSING; +3 file codes that pre-existed in errors.ts but were missing from the toEqual)", () => {
  expect(WORKFLOW_ERROR_CODES).toEqual({
    WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
    WORKFLOW_RUN_NOT_FOUND: "WORKFLOW_RUN_NOT_FOUND",
    WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
    WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
    WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
    WORKFLOW_GATE_FAILED: "WORKFLOW_GATE_FAILED",
    WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
    AGENTS_STALE: "AGENTS_STALE",
    MISSING_TOOLS: "MISSING_TOOLS",
    GIT_PROVIDER_MISCONFIG: "GIT_PROVIDER_MISCONFIG",
    WORKFLOW_VALIDATION: "WORKFLOW_VALIDATION",
    WORKFLOW_NAME_MISMATCH: "WORKFLOW_NAME_MISMATCH",
    GATE_SOURCE_NOT_FOUND: "GATE_SOURCE_NOT_FOUND",
    GIT_PROVIDER_ERROR: "GIT_PROVIDER_ERROR",
    WORKFLOW_FILE_INVALID_PATH: "WORKFLOW_FILE_INVALID_PATH",
    WORKFLOW_FILE_NOT_FOUND: "WORKFLOW_FILE_NOT_FOUND",
    WORKFLOW_FILE_EMPTY_CHANGES: "WORKFLOW_FILE_EMPTY_CHANGES",
    AGENT_NOT_REGISTERED: "AGENT_NOT_REGISTERED",
    AGENT_GIT_FILE_MISSING: "AGENT_GIT_FILE_MISSING",
  });
});
```

Et un test fonctionnel dans `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` (ou nouveau test) qui encode le routage end-to-end :

```ts
// Behavior: when loadCanonicalAgent throws GovernedWorkflowError(AGENT_NOT_REGISTERED),
// wrap() in governed-workflows.tool.ts surfaces it as `error_code: "AGENT_NOT_REGISTERED"`
// in the MCP envelope (NOT as INTERNAL_ERROR or a re-thrown error).
it("AGENT_NOT_REGISTERED from the service surfaces in the MCP envelope as error_code", async () => {
  // Stub a service that always throws AGENT_NOT_REGISTERED on launchStep
  const fakeService = {
    launchStep: async () => {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
        "Agent 'ghost' is not registered.",
        ["Run create_agent"],
        { sub_cause: "AGENT_ROW_MISSING" },
      );
    },
  };
  const result = await callLaunchGovernedStep(fakeService, { run_id, step_id });
  const envelope = JSON.parse(result.content[0].text);
  expect(envelope.error_code).toBe("AGENT_NOT_REGISTERED");
  expect(envelope.sub_cause).toBe("AGENT_ROW_MISSING"); // err.data spread by wrap()
  expect(result.isError).toBe(true);
});
```

**Implementation** : ajouter `AGENT_NOT_REGISTERED` et `AGENT_GIT_FILE_MISSING` dans `packages/governed-workflows/src/errors.ts:59-100` avec JSDoc concise expliquant le moment d'émission. Compléter le `toEqual` block du test existant avec les 3 codes file (`WORKFLOW_FILE_*`) qui auraient déjà dû y être.

**Files touched** : `packages/governed-workflows/src/errors.ts`, `packages/governed-workflows/src/errors.test.ts`, `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` (ajouter 1 test).

**Definition of done** :
- `bun test packages/governed-workflows` → vert (nouvelle ligne du `toEqual` validée).
- Le nouveau test MCP-envelope vert.
- `bun run typecheck` passe.

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

  // Round 2 — renamed from "caches per resourceType" (which mismatched its body).
  // This test now encodes the actual cache behavior: the second resolve call with
  // the same (companyId, resourceType) tuple skips the DB lookup. It's wiring
  // assertion (spy on db.select) but it ENCODES the spec contract "cache lifetime
  // = process". cf. tautology audit M-4.
  it("second resolveGitProvider call with same (companyId, resourceType) skips DB lookup", async () => {
    const dbSpy = vi.spyOn(db, "select"); // or whatever mock harness is used
    const resolve = createResolveGitProvider(db);
    await resolve({ companyId, resourceType: "agent" });
    const callsAfterFirst = dbSpy.mock.calls.length;
    await resolve({ companyId, resourceType: "agent" });
    const callsAfterSecond = dbSpy.mock.calls.length;
    expect(callsAfterSecond).toBe(callsAfterFirst); // cache hit, no extra DB calls
    dbSpy.mockRestore();
  });

  // Round 2 — distinct test for the NEW behavior in P2: different resourceType
  // values miss the cache independently (so future multi-item layouts work).
  it("different resourceType values produce separate cache entries", async () => {
    const dbSpy = vi.spyOn(db, "select");
    const resolve = createResolveGitProvider(db);
    await resolve({ companyId, resourceType: "agent" });
    const after1 = dbSpy.mock.calls.length;
    await resolve({ companyId, resourceType: "workflow" });
    const after2 = dbSpy.mock.calls.length;
    expect(after2).toBeGreaterThan(after1); // second resourceType triggers a DB lookup
    dbSpy.mockRestore();
  });

  // Round 2 — MAJOR M-4: deterministic ordering for multi-item selection.
  // Today only one git_provider item per company exists. When SPEC §5.4 lands
  // (multi-items, one per resourceType), the SELECT must be ORDER BY
  // created_at, id — otherwise two replicas can pick different items.
  it("when multiple git_provider items exist for the same company, selects deterministically by (created_at, id)", async () => {
    // Seed: TWO items, one with paths.agents only, one with paths.workflows only
    await db.execute(sql`
      INSERT INTO config_layer_items (id, company_id, ..., config_json, created_at)
        VALUES
          ('aa...', ${companyId}, ..., '{"kind":"local",...,"paths":{"agents":"agents"}}', '2026-01-01'::timestamptz),
          ('bb...', ${companyId}, ..., '{"kind":"local",...,"paths":{"workflows":"workflows"}}', '2026-01-02'::timestamptz);
    `);
    const resolve = createResolveGitProvider(db);
    const agentProvider = await resolve({ companyId, resourceType: "agent" });
    expect((agentProvider as any).paths.agents).toBe("agents"); // picked the first item
    const wfProvider = await resolve({ companyId, resourceType: "workflow" });
    expect((wfProvider as any).paths.workflows).toBe("workflows"); // picked the second item
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
3. Ligne 280-294 — **retirer le `.limit(1)`** et **ajouter `.orderBy(configLayerItems.createdAt, configLayerItems.id)`** (ordering déterministe pour multi-items). La query renvoie tous les items `git_provider` actifs ordonnés. La sélection :
   ```ts
   const candidate = rows.find((r) =>
     (r.configJson as any).paths?.[resourceType] !== undefined,
   ) ?? rows[0]; // fallback: first item if no resourceType-specific match (legacy single-item)
   if (!candidate) {
     // env-var fallback as before
   }
   ```
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

### P2.1 — Propager `userId` dans `syncEnvironment` (BLOCKER B-2)

**Goal** : §3.10. `syncEnvironment` (`governed-workflows.ts:1173-1216`) accepte `userId` et le passe à `resolveGitProvider`. `pushLocalState` propage `userId` reçu de l'actor MCP. Tests régression dédiés pour ne pas re-perdre la propagation.

**Test first** — étendre `governed-workflows.test.ts` suite "syncEnvironment" :

```ts
it("propagates userId to resolveGitProvider so the per-user OAuth token is used (regression for the gap left after a93c085)", async () => {
  const resolveSpy = vi.fn(async () => stubProvider);
  const svc = governedWorkflowService(db, {
    resolveGitProvider: resolveSpy as any,
    shaCache: { get: () => undefined, set: () => undefined } as any,
  });
  await db.execute(sql`
    INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
    VALUES (${companyA}, 'a1', 'claude_local', 'v1.0.0', true) ON CONFLICT DO NOTHING
  `);
  await setTenantContext(db, companyA);
  await svc.syncEnvironment({ companyId: companyA, userId: "u-77" });
  expect(resolveSpy).toHaveBeenCalledWith(
    expect.objectContaining({ companyId: companyA, userId: "u-77", resourceType: "agent" }),
  );
});

it("propagates userId from pushLocalState through to syncEnvironment to resolveGitProvider", async () => {
  const resolveSpy = vi.fn(async () => stubProvider);
  const svc = governedWorkflowService(db, {
    resolveGitProvider: resolveSpy as any,
    shaCache: { get: () => undefined, set: () => undefined } as any,
  });
  await setTenantContext(db, companyA);
  await svc.pushLocalState({
    companyId: companyA,
    userId: "u-88",                   // NEW field on PushLocalStateArgs
    agentsProvisioned: ["mnm--a1"],
    pluginVersion: "0.1.0",
  });
  expect(resolveSpy).toHaveBeenCalledWith(
    expect.objectContaining({ companyId: companyA, userId: "u-88" }),
  );
});
```

**Implementation** :
1. `governed-workflows.ts:159-162` — `SyncEnvironmentArgs` gagne `userId?: string | null`.
2. `governed-workflows.ts:1197` — passer `userId: args.userId ?? null, resourceType: "agent"` au resolver.
3. `governed-workflows.ts:227-231` — `PushLocalStateArgs` gagne `userId?: string | null`.
4. `governed-workflows.ts:1281` — `syncEnvironment({ companyId, lastSyncedSha: undefined, userId: args.userId })`.
5. `server/src/mcp/tools/governed-workflows.tool.ts:319-348` — `push_local_state` handler passe `userId: actor.userId ?? null` à `services.governedWorkflows.pushLocalState`.
6. `server/src/mcp/tools/governed-workflows.tool.ts:351-379` — `sync_governed_environment` handler ajoute `userId: actor.userId ?? null` au call.

**Files touched** :
- `server/src/services/governed-workflows.ts` (interfaces + 2 callsites)
- `server/src/mcp/tools/governed-workflows.tool.ts` (2 handlers)
- `server/src/services/__tests__/governed-workflows.test.ts` (2 nouveaux tests)

**Definition of done** : 2 nouveaux tests verts + tests existants `syncEnvironment` et `pushLocalState` toujours verts.

**Risque** : si `mcp__plugin_mnm_mnm__push_local_state` est appelé par d'autres consumers (CLI, tests E2E) qui ne fournissent pas `userId`, la propagation tombe à `null` (comportement actuel). Pas de régression.

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
   Round 2 (N-2) — Le nom canonique de l'index est **`agents_company_active_idx`** (sémantique "rows actives = non archivées"). Toute autre occurrence du nom dans le plan (par ex §3.9 ou §M2) doit utiliser cette même graphie.
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

  // Round 2 — concretized from placeholder. Tautology audit P4 ligne 466.
  it("returns the triplet (agentName, subagentType, promptContext) when row enabled+tagged+md reachable, fetching at agents/<name>/agent.md", async () => {
    const seenPaths: string[] = [];
    const provider = {
      ...stubProvider,
      paths: { agents: "agents", workflows: "workflows" },
      fetchBlob: async ({ path }: { path: string }) => {
        seenPaths.push(path);
        if (path.endsWith("workflow.json")) return JSON.stringify({...});
        if (path.endsWith("/agent.md")) return AGENT_MD_CONTENT;
        throw new Error(`unexpected ${path}`);
      },
    };
    const companyId = await seedCompanyWithWorkflowAndAgent({
      workflowName: "hello-world",
      agentName: "happy",
      agentEnabled: true,
      agentArchivedAt: null,
      agentLatestGitTag: "agents/v1.0.0",
    });
    const svc = mkSvcWithProvider(provider);
    const { runId, firstStep } = await svc.launchWorkflow({...});
    const expectedSha = createHash("sha256").update(AGENT_MD_CONTENT).digest("hex");

    const result = await svc.launchStep({
      companyId, runId, stepId: firstStep, actor: { type: "user", id: "u-1" },
      currentAgents: { "mnm--happy": expectedSha },
      sessionTools: ["Task","Write","Read"],
    });

    // Behavior 1: returns the triplet
    expect(result).toMatchObject({
      agentName: "happy",
      subagentType: "mnm--happy",
      promptContext: expect.any(Object),
    });
    // Behavior 2: fetched the agent.md from the prefixed path (agents/<name>/agent.md)
    expect(seenPaths).toContain("agents/happy/agent.md");
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

**Test first** — étendre la suite `setupWorkspace` existante. Round 2 : split du test combiné en 2 `it()` (un par behavior, cf. tautology audit P5).

```ts
// Behavior 1: result excludes the agent whose .md 404s.
it("excludes from result the agents whose agent.md is missing at the pinned tag", async () => {
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
});

// Behavior 2: structured warn is emitted, with no secrets in payload.
// Round 2 — MAJOR M-5: filter on the precise warn prefix to avoid false-positives
// from unrelated console.warn calls in the request flow.
it("logs a structured warn with the documented payload shape and no token-like fields", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const companyId = await seedCompanyWithAgents({
    issuePrefix: "T6SK",
    agents: [{ name: "ghost", enabled: true }],
  });
  const provider = mk404Provider({ missingFor: "ghost" });
  await mkSvcWith(provider).setupWorkspace({ companyId });

  // Filter on our specific prefix to avoid catching unrelated warnings.
  const ourWarns = warnSpy.mock.calls.filter(
    (c) => c[0] === "[mnm.setup_workspace] agent_md_missing",
  );
  expect(ourWarns).toHaveLength(1);

  const payload = ourWarns[0][1];
  // Exact shape expected (per §3.4)
  expect(Object.keys(payload).sort()).toEqual(
    ["agentId", "agentName", "companyId", "fullPath", "latestGitTag", "providerProjectId"].sort(),
  );
  expect(payload).toMatchObject({
    companyId,
    agentName: "ghost",
    latestGitTag: expect.any(String),
    providerProjectId: expect.any(String),
    fullPath: expect.stringMatching(/\/ghost\/agent\.md$/),
  });
  // CRITICAL: no token-like fields anywhere in the payload (defense in depth).
  for (const k of Object.keys(payload)) {
    expect(k.toLowerCase()).not.toMatch(/token|secret|password|credential/);
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
          providerProjectId: gitProvider.providerId, // GitProvider.providerId is non-secret (e.g. "gitlab:user:u-42")
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

// Round 2 — MAJOR M-3: prove the gate translation chain end-to-end. When the
// workflow.json lives at workflows/<name>/workflow.json, gates with `source:
// "./gates/foo.gate.ts"` MUST resolve to workflows/<name>/gates/foo.gate.ts
// (NOT <name>/gates/foo.gate.ts at root). This was confirmed in §2.2 by reading
// makeResolveSource, but a concrete test guards against future regressions.
it("when paths.workflows='workflows', a gate referenced as './gates/foo.gate.ts' resolves to workflows/<name>/gates/foo.gate.ts", async () => {
  const seenGateFetchPaths: string[] = [];
  const TWO_STEP = {
    apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "demo",
    variables: {},
    steps: [
      { id: "s1", deps: [], agent: "a", prompt_context: {}, gates: {
        entry: [{ id: "g1", source: "./gates/g1.gate.ts" }],
      }},
    ],
  };
  const provider = {
    paths: { agents: "agents", workflows: "workflows" },
    fetchBlob: async ({ path }: { path: string }) => {
      seenGateFetchPaths.push(path);
      if (path === "workflows/demo/workflow.json") return JSON.stringify(TWO_STEP);
      if (path === "workflows/demo/gates/g1.gate.ts") {
        return `import { defineGate } from "@mnm/governed-workflows";
                export default defineGate(async () => ({ pass: true, report: "ok" }));`;
      }
      throw new Error(`unexpected ${path}`);
    },
    resolveRef: async () => "demo-sha",
    listTags: async () => [],
    pathExists: async () => true,
    commitFile: async () => ({ sha: "x" }),
  };
  // Seed company + def + agent + run for "demo"
  const svc = mkSvcWith(provider);
  const { runId } = await svc.launchWorkflow({ name: "demo", ... });
  await svc.launchStep({ companyId, runId, stepId: "s1", actor: { type: "user", id: "u-1" } });

  // Behavior: gate fetched from the prefixed path, NOT from <name>/gates/...
  expect(seenGateFetchPaths).toContain("workflows/demo/gates/g1.gate.ts");
  expect(seenGateFetchPaths).not.toContain("demo/gates/g1.gate.ts");
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
  // Round 2 — replaced "row[0].latestGitTag === 'v1'" wiring assertion with
  // a downstream behavior assertion: after create_agent with latestGitTag,
  // loadCanonicalAgent on that name MUST succeed. Encodes "create_agent makes
  // the agent usable", not "create_agent writes a column".
  it("after create_agent with valid latestGitTag, loadCanonicalAgent for that name succeeds", async () => {
    const provider = mkProviderWith({ paths: { agents: "agents" }, blobs: { "agents/senior-dev/agent.md@v1": "# senior dev" } });
    await callCreateAgent({
      name: "senior-dev",
      latestGitTag: "v1",
      adapterType: "claude_local",
    });
    // Now drive a launchStep that needs senior-dev — it must NOT throw AGENT_NOT_REGISTERED
    // (we use launchStep as the public entry to loadCanonicalAgent since that fn is private).
    const svc = mkSvcWith(provider);
    const { runId, firstStep } = await svc.launchWorkflow({...stepReferencingSeniorDev});
    const expectedSha = createHash("sha256").update("# senior dev").digest("hex");
    const result = await svc.launchStep({
      companyId, runId, stepId: firstStep, actor: { type: "user", id: "u-1" },
      currentAgents: { "mnm--senior-dev": expectedSha },
      sessionTools: ["Task","Write","Read"],
    });
    expect(result.agentName).toBe("senior-dev"); // round-trip works
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

  // Round 2 — replaced "fetchSpy.not.toHaveBeenCalled()" wiring with a contract
  // assertion: omitting latestGitTag produces a row with latestGitTag NULL
  // (not silently filled with a default). Cf. tautology audit P7 ligne 763.
  it("when latestGitTag is omitted, the agent row is created with latestGitTag NULL (legacy compat)", async () => {
    const result = await callCreateAgent({ name: "legacy", adapterType: "claude_local" });
    expect(result.id).toBeDefined();
    const row = await db.select().from(agents).where(eq(agents.id, result.id));
    expect(row[0].latestGitTag).toBeNull();
  });

  // Round 2 — MINOR N-4: zod whitespace rejection
  it("rejects latestGitTag that is whitespace-only", async () => {
    await expect(callCreateAgent({
      name: "spaced",
      latestGitTag: "   ",
      adapterType: "claude_local",
    })).rejects.toThrow(/latestGitTag|empty/i); // zod validation error
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
  latestGitTag: z.string().min(1)
    .refine((s) => s.trim().length > 0, { message: "latestGitTag must not be whitespace-only" })
    .optional()
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

### P9 — `workflow-ai-assistant.ts` : propager `userId` ET `resourceType` (BLOCKER B-1, DB-intégré)

**Goal** (round 2 — BLOCKER B-1) : la closure à `:282-283` actuellement :
```ts
resolveGitProvider: (a) =>
  deps.resolveGitProvider({ companyId: a.companyId, userId: null }),
```
- (a) hardcode `userId: null` alors que `streamWorkflowAiChat` reçoit `input.userId` (cf. interface ligne 42 et call à `listWorkflowFiles` ligne 308 qui passe `userId: input.userId`).
- (b) drop le `resourceType` que `governedWorkflowService` interne va lui passer.

Le fix correct **capture `input.userId` dans la closure** (ne lit PAS `a.userId` qui n'existe pas dans l'interface deps de `governedWorkflowService`) **ET propage `a.resourceType`**.

**Test first** — 2 tests `it()` séparés (cf. tautology audit P9, un behavior par test) :

```ts
// Behavior 1: userId from input is propagated to deps.resolveGitProvider so the
// per-user OAuth token is used (closes the gap left after a93c085 for AI assistant).
it("propagates input.userId to deps.resolveGitProvider on the workflow.json fetch", async () => {
  const spy = vi.fn(async () => stubProvider);
  await consumeAll(streamWorkflowAiChat(db, { ...deps, resolveGitProvider: spy }, {
    companyId, userId: "u-99", workflowName: "demo", messages: [], ref: "v1.0.0",
  }));
  // First spy call is the getWorkflowParsed path — assert it has the user's id.
  expect(spy.mock.calls[0][0]).toMatchObject({ companyId, userId: "u-99" });
});

// Behavior 2: resourceType is preserved through the closure.
it("propagates resourceType='workflow' from governedWorkflowService through the closure", async () => {
  const spy = vi.fn(async () => stubProvider);
  await consumeAll(streamWorkflowAiChat(db, { ...deps, resolveGitProvider: spy }, {
    companyId, userId: "u-99", workflowName: "demo", messages: [], ref: "v1.0.0",
  }));
  // The first call (getWorkflowParsed) is forwarded with resourceType: "workflow"
  expect(spy.mock.calls[0][0]).toMatchObject({ resourceType: "workflow" });
});
```

**Implementation** — `workflow-ai-assistant.ts:280-285`. Capture `input.userId` (var locale) ET forwarde tous les args :
```ts
// 2. Load parsed workflow.json.
const userId = input.userId; // capture for the closure below
const svc = governedWorkflowService(db, {
  resolveGitProvider: (a) =>
    deps.resolveGitProvider({
      companyId: a.companyId,
      userId,                    // round 2: was hardcoded null, now propagates input.userId
      resourceType: a.resourceType, // round 2: was dropped, now preserved
    }),
  shaCache: deps.shaCache,
});
```

Note : la closure NE peut PAS faire `{ ...a, userId }` parce que TypeScript pourrait inférer un type union problématique. Forme explicite obligatoire.

**Files touched** : `server/src/services/workflow-ai-assistant.ts:280-285` + 2 nouveaux tests dans `workflow-ai-assistant.test.ts`.

**Definition of done** : 2 verts + tests AI existants verts.

**Si dev-C ne peut pas livrer P9 dans les délais** : retirer le claim "P9 fixes that" et documenter en follow-up post-démo. Le bug actuel (hardcoded null) est latent — pas une régression de ce refactor — donc pas un blocker absolu pour la démo lundi (l'AI assistant n'est pas dans le démo storyboard de Tom).

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
  //   agents/senior-dev/agent.md (AGENT_MD_CONTENT — known content)
  //   workflows/feature-dev/workflow.json (referencing senior-dev)
  //   workflows/feature-dev/gates/*.gate.ts

  // Round 2 (N-3): compute the canonical sha the way loadCanonicalAgent does,
  // OR use setupWorkspace to discover it. Both encode the spec contract.
  // We pick setupWorkspace because it ALSO exercises the agents/<name>/agent.md
  // path resolution — killing two birds with one stone.
  const setup = await svc.setupWorkspace({ companyId, userId: "u-1" });
  const seniorDev = setup.agents.find((a) => a.name === "mnm--senior-dev");
  expect(seniorDev).toBeDefined();
  const expectedSeniorDevSha = seniorDev!.sha; // discovered, NOT hardcoded

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

## 6. Tâches opérationnelles (M0 → M4)

### M0 — Apply pending Drizzle migrations (BLOCKER B-3 prerequisite)

**Goal** : appliquer la migration `0067_agents_archived_at.sql` sur la DB live AVANT M2. Sans ça, le `UPDATE agents SET archived_at = NOW()` de M2 lèvera `column "archived_at" does not exist`.

```bash
cd "<mnm repo root>"
bun run db:migrate
# or whatever the canonical alias is — equivalent to:
#   cd packages/db && bun drizzle-kit push:pg

# Verify:
psql "$MNM_DATABASE_URL" -c '\d agents' | grep archived_at
# Expected output line:
#   archived_at | timestamp with time zone |
```

**Definition of done** :
- `psql ... -c '\d agents'` montre la colonne `archived_at`.
- `psql ... -c '\d+ agents_company_active_idx'` (ou `\di+`) montre l'index partiel.
- `SELECT COUNT(*) FROM agents WHERE archived_at IS NOT NULL` retourne 0 (la colonne par défaut est NULL).

**Si M0 échoue** : ne pas continuer. Investiguer l'embedded postgres / schema journal. Le plan ne peut pas avancer.

---

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

**Round 2 (N-1) — branch protection caveat** : si `mnm-demo` a une branch protection sur `main` (rare sur lab.enterprise.example en perso, mais possible si Tom l'a activée pour signer ses MR), `git push origin main` retournera `remote rejected`. Dans ce cas :
1. Pousser sur une branche de feature : `git checkout -b refactor/git-first && git push origin refactor/git-first`
2. Créer une MR `refactor/git-first → main`, l'approuver, la merger via UI GitLab.
3. Tagger `agents/v1.0.0` et `feature-dev/v1.0.2` sur le merge commit, pousser les tags.

**Definition of done** :
- Le repo `mnm-demo` existe sur GitLab.
- `git ls-tree -r agents/v1.0.0` montre `agents/senior-dev/agent.md` (et 3 autres).
- `git ls-tree -r feature-dev/v1.0.2 -- workflows/feature-dev/` montre `workflow.json` + `gates/*.gate.ts`.

### M2 — DB updates (single-transaction)

**Goal** : SPEC §M2 + correction §3.7 (transactionality).

**Pré-requis stricts** (round 2 — BLOCKER B-3) :
1. **M0 done** — la colonne `agents.archived_at` existe (vérifié `psql -c '\d agents'`).
2. **M1 done** — le repo `mnm-demo` est créé et les tags `agents/v1.0.0` + `feature-dev/v1.0.2` existent.
3. **`<DISCOVERED_ID>` connu** — exécuter la query découverte §2.4 pour obtenir l'ID réel du config_layer_item.

Script `scripts/migrate-2026-04-26-db.sql` :
```sql
-- Run AFTER M0 (Drizzle migration 0067 applied — agents.archived_at exists)
-- Run AFTER M1 (mnm-demo repo + tags exist)
-- Replace <DISCOVERED_ID> with the result of the §2.4 query.

-- Pre-flight: fail fast if M0 wasn't applied (defense in depth).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'archived_at'
  ) THEN
    RAISE EXCEPTION 'M0 not applied: column agents.archived_at is missing. Run `bun run db:migrate` first.';
  END IF;
END
$$;

-- Round 2 — Nit-2: pre-count rows we are about to archive (defensive log).
-- If this returns 0, we know greeter/shouter aren't there (already archived
-- or never seeded) and the UPDATE below will be a no-op — investigate before
-- continuing to M3.
SELECT COUNT(*) AS to_archive_count
FROM agents
WHERE name IN ('greeter','shouter')
  AND company_id = '00000000-0000-4000-8000-000000000001';

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

**Rollback partiel** : single-TX wrap garantit qu'aucun état partiel n'est visible. Si le COMMIT échoue (rare — généralement lock timeout), tout est rollback automatiquement.

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

**Definition of done** : `SELECT name, latest_git_tag FROM agents WHERE company_id = '<demo>' AND archived_at IS NULL` retourne 4 rows nommées exactement `senior-dev`, `dev`, `review-watcher`, `release-mgr`.

**Round 2 (M-6) — rollback partiel** : si l'appel #3 (`review-watcher`) ou #4 (`release-mgr`) retourne `AGENT_GIT_FILE_MISSING` (parce que M1 a oublié un fichier), les rows déjà créées par #1 et #2 ne sont PAS rollback automatiquement (chaque MCP call est sa propre TX). Pire : un retry naïf de `create_agent` avec `name="senior-dev"` après #1 a déjà inséré la row va passer par `deduplicateAgentName` (`server/src/services/agents.ts:165-179`) qui crée `senior-dev 2`, cassant le triplet attendu en M4.

→ **Avant tout retry de M3** : exécuter ce rollback SQL :
```sql
-- Hard rollback of partial M3 — run before relaunching the 4 MCP calls.
DELETE FROM agents
WHERE company_id = '00000000-0000-4000-8000-000000000001'
  AND name IN ('senior-dev','dev','review-watcher','release-mgr')
  AND archived_at IS NULL;
-- Verify count == 0:
SELECT COUNT(*) FROM agents
WHERE company_id = '00000000-0000-4000-8000-000000000001'
  AND name IN ('senior-dev','dev','review-watcher','release-mgr')
  AND archived_at IS NULL;
```
Puis fixer la cause (commit manquant côté M1, push retardé, etc.) et relancer les 4 MCP calls.

**Note sur la sécurité** : ce DELETE est OK ici parce qu'on est en single-user dev, et les 4 rows sont fraîches (pas d'historique). En prod, préférer `archived_at = NOW()` pour préserver l'audit.

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

**Round 2 — ordre opérationnel strict** : M0 → P0..P11 → M1 → M2 → M3 → M4.

1. **M0 done (BLOCKER B-3)** : `psql -c '\d agents'` montre la colonne `archived_at timestamptz` ET l'index `agents_company_active_idx` (graphie unique). M2 ne doit JAMAIS s'exécuter avant M0.
2. **Tests** : `bun test` global passe (zéro régression). Nouveaux tests P0/P1/P2/P2.1/P4/P5/P6/P7/P8/P9/P11 verts. Les 3 tests userId existants (lignes :202, :354, :803) verts après adaptation `expect.objectContaining({ userId, resourceType })`.
3. **Typecheck** : `bun run typecheck` passe sur tous les packages (incluant `packages/db`, `packages/governed-workflows`, `server`).
4. **`syncEnvironment` userId propagé (BLOCKER B-2)** : 2 nouveaux tests P2.1 verts. `pushLocalState` et `syncEnvironment` MCP tools acceptent et propagent `actor.userId`.
5. **M1 done** : repo `mnm-demo` créé avec layout `agents/<name>/agent.md` + `workflows/<name>/{workflow.json,gates/}` au tag `agents/v1.0.0` et `feature-dev/v1.0.2`.
6. **M2 done** : DB transaction passée APRÈS M0, `config_layer_items[<DISCOVERED_ID>].config_json.paths = {agents:"agents",workflows:"workflows"}`, greeter/shouter archivés, server restarted.
7. **M3 done** : 4 rows agents (`senior-dev`, `dev`, `review-watcher`, `release-mgr`) avec `latest_git_tag = 'agents/v1.0.0'` et `archived_at IS NULL`. Aucun nom ne contient un suffixe " 2" (signe d'un retry sans rollback M-6).
8. **M4 done** : `launch_governed_step` retourne le triplet correct. Aucune erreur dans la réponse JSON.
9. **Symétrie write/read** : un commit Studio sur `feature-dev` produit un fichier à `workflows/feature-dev/workflow.json` (visible via `git show`), pas à `feature-dev/workflow.json` au root.

---

## 8. Recommended team setup pour la phase dev

**Subagent type** : `mnm-dev` (general-purpose dev avec accès Read/Edit/Write/Bash/Grep/Glob).

**Découpage suggéré (3 workers parallèles)** :

| Worker | Owns | Reasoning |
|---|---|---|
| dev-A — "core service" | P0, P2, P2.1, P4, P6 | Cluster `governed-workflows.ts` + `build-mcp-services.ts`. Écrit le helper, refactor `loadCanonicalAgent` + `getWorkflowParsed`. **Critique pour la suite** — doit livrer P0+P2 en premier. P2.1 (BLOCKER B-2 syncEnvironment userId) ajouté round 2. |
| dev-B — "DB + errors" | P1, P3, P5 | Cluster schema + errors. Migration Drizzle + colonne, codes d'erreur, `setupWorkspace` skip-on-404. Indépendant de A jusqu'à P5 (qui dépend du helper P0). **Pre-flight P1** : run `bun test packages/governed-workflows/src/errors.test.ts` AVANT toute modif (cf. M-2). |
| dev-C — "tools + studio + AI" | P7, P8, P9, P10 | Cluster MCP tools + Studio service. `create_agent` extension, write-side path, AI assistant (BLOCKER B-1 P9 fix), routes UI. Dépend de P0 + P2 pour démarrer. |

**Sequencing strict** (round 2 — ajout M0, P2.1) :
```
M0 (apply 0067 migration on dev DB)
  ↓
P0 → (P2, P2.1, P3) parallèle → (P1) parallèle → (P4, P5, P6) parallèle après P0+P2 → (P7, P8, P9, P10) parallèle après P4+P6 → P11 (final E2E, single owner)
```

**Phases ops séquentielles** (un seul owner = team-lead ou Tom) :
```
M0 (DB migrate, BEFORE P3 ships nothing — but the LIVE dev DB needs the column)
  ↓ tests run on the migrated DB
M1 (post P0-P11) → M2 (post M0 + M1) → M3 (post P7 + M2) → M4 (post M3)
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

---

## § Arch Review (round 1)

*Author: arch-critic — 2026-04-26 — independent review of the plan above.*

Read in full: spec, plan, `governed-workflows.ts` (820, 1180-1272, 332-337, 583-614, 1014-1017), `build-mcp-services.ts:160-336+410-436`, `agents.tool.ts:87-127`, `governed-workflow-files.ts:170-300`, `governed-workflows-source-resolver.ts:30-87`, `governed-workflows-extensions.ts:102-128`, `workflow-ai-assistant.ts:71-84+280-310`, `agents.ts` schema, `errors.ts` + `errors.test.ts`.

### 10.A Issues found (ranked)

#### BLOCKER

**B-1. P9 corrige mal le bug `workflow-ai-assistant.ts:282-283`.**
Plan §P9 propose `(a) => deps.resolveGitProvider({ ...a, userId: a.userId ?? null })`. Mais `a.userId` n'existe PAS dans le call interne fait par `governedWorkflowService` (qui passe `{ companyId, userId, resourceType }` où `userId` est l'argument propagé via `loadCanonicalAgent`/`getWorkflowParsed`). Le bug réel à fixer est : la closure ne dispose pas de `input.userId` (l'utilisateur AI assistant authentifié) — elle hardcode `null`. Le fix correct est de capturer `input.userId` dans une variable et de la passer au lieu de `null`. Sinon, en mode `authenticated`, l'AI assistant continue d'utiliser le token company alors que la requête a une session user. **Impact** : pas une régression du refactor, mais le plan le revendique comme "correction" sans la livrer. Soit corriger le fix proposé, soit retirer ce claim de §P9 pour ne pas masquer un bug latent.

**B-2. `syncEnvironment` ne propage pas `userId` — pas couvert par le plan.**
`governed-workflows.ts:1197` : `await resolveGitProvider({ companyId: args.companyId })` — pas de `userId`. Le plan §6.4 (spec) demande "Tous les autres callsites de `resolveGitProvider` : ajouter `resourceType`". Le plan §2.3 liste 11 callsites mais ligne 1197 n'y est pas (le tableau cite `1238` setupWorkspace, mais saute `1197` syncEnvironment). Or ce site fetch des `agent.md` (ligne 1207) — il faut absolument `resourceType: "agent"` ET propager `userId`. **Impact** : en authenticated mode, `pushLocalState` (qui appelle `syncEnvironment`) bypass le user token et casse le flow OAuth fait en commit `08525f0`. Ajouter au plan : P5b (ou étendre P5) qui couvre `syncEnvironment` explicitement avec test de userId-propagation.

**B-3. Race `create_agent` vs `setupWorkspace` non mitigée même pour la démo.**
Plan §3.5 dit "race acceptable pour la démo (single-user)". Mais §M3 lance 4 `create_agent` séquentiels — OK pour la race. Le vrai problème : entre M3 et M4, si `setup_workspace` cache `resolveGitProvider`, et que P3 (migration archived_at) n'a pas encore tourné quand M2 archive `greeter/shouter`, le filtre `archived_at IS NULL` (P5) ne filtrera RIEN car la colonne n'existe pas. **Ordre critique** : P3 (migration) DOIT être appliquée AVANT M2. Le plan §6 dit "Run AFTER P3 migration" en commentaire, mais l'acceptance criterion #5 ne le vérifie pas explicitement. Ajouter une garde-fou en runtime : `setupWorkspace` doit échouer fast si la colonne `archived_at` n'existe pas (Drizzle SELECT le levera de toute façon, mais documenter).

#### MAJOR

**M-1. P0 helper rejecte `..` mais pas le tuple `(name, file)` qui pourrait l'introduire.**
Test plan ligne 223-238 : `paths.agents = "../etc"` → throw. Mais `name` est attribut DB controllé (Tom le saisit via `create_agent` zod) ; `file` est hardcodé code-side. Cas limite : un agent nommé `../etc/passwd` (nom DB malicieux) produit `agents/../etc/passwd/agent.md`. Pour la démo single-user, négligeable. Mais P0 devrait explicitement rejeter `name.includes("..")` et `file.includes("..")` aussi — fail-closed à TOUS les segments. Ajouter test : `expect(() => resolveResourcePath({}, "agent", "../foo", "agent.md")).toThrow()`.

**M-2. Plan ne couvre pas l'audit du `errors.test.ts` existant.**
`errors.test.ts:21-37` a un `toEqual({...})` strict qui NE liste PAS `WORKFLOW_FILE_INVALID_PATH`, `WORKFLOW_FILE_NOT_FOUND`, `WORKFLOW_FILE_EMPTY_CHANGES` (qui pourtant existent dans `errors.ts:92-99`). Donc ce test est ALREADY broken (fait `toEqual` strict sur un objet qui inclut plus de clés). Soit il passe quand même (toEqual ne vérifie pas extra-keys ?) — à vérifier. P1 doit AJOUTER les 2 nouvelles clés au `toEqual` ET corriger les 3 manquantes. Sinon, P1 ne sera pas un Red→Green honnête.

**M-3. Le `workflowDir` dérivé de `resolveResourcePath` casse `gateSourcePath` quand workflowDir contient un slash.**
`source-resolver.ts:40-42` : `workflowDir = workflowRepoPath.slice(0, lastIndexOf("/"))`. Si `workflowRepoPath = "workflows/feature-dev/workflow.json"`, `workflowDir = "workflows/feature-dev"`. Le test ligne 52 `if (normalised.includes(".."))` reste OK pour `gateItemSource`. MAIS `gateSourcePath = "workflows/feature-dev/gates/foo.gate.ts"` — dans le repo. OK ✓. Pas de bug, mais P6 doit ajouter un test E2E qui prouve la chaîne complète (workflowRepoPath via paths → workflowDir multi-slash → gate fetch path). Le plan P6 ne l'a pas. Ajouter au moins un assertion `expect(seenGateFetchPaths).toContain("workflows/feature-dev/gates/...")`.

**M-4. P2 cache key `${companyId}:${resourceType ?? "default"}` est insuffisant pour le scénario multi-items futur.**
Spec §5.4 : "Quand plusieurs `git_provider` items existent". Si demain Tom a deux items pour la même company (un pour `agents`, un pour `workflows`), la clé `${companyId}:${resourceType}` est correcte. Mais le plan §P2.2 dit `${companyId}:${userId}:${resourceType ?? "default"}` pour le user-cache — ce qui est fine. Cependant, le SELECT `.limit(1)` est SUPPRIMÉ en P2.3 ("non `.limit(1)`") mais pas explicité dans l'implementation snippet. Le code à `:280-294` a `.limit(1)`. Plan doit dire explicitement : retirer `.limit(1)` ET trier les résultats de manière déterministe (par `id` ou `created_at`) pour que la sélection soit reproductible. Sinon, deux machines peuvent retourner des items différents.

**M-5. `setupWorkspace` skip-on-404 — comportement de log non testé en isolation.**
P5 test ligne 553-585 vérifie `warnSpy` ET absence de token dans `arg`. Bien. Mais le test mock `console.warn` globalement — donc TOUT autre warn dans la requête (y compris `[mnm.workflow_ai_assistant]` etc.) pourrait être capturé. La sortie de `warnSpy.mock.calls.flat()` puis `for (const arg of callArgs)` boucle aveugle qui peut donner faux-positifs. Recommandation : filtrer sur le premier arg `=== "[mnm.setup_workspace] agent_md_missing"` avant l'assertion no-token. Sinon, le test peut passer artificiellement.

**M-6. Pas de rollback documenté pour M2 partiel.**
Plan §M2 wrap en `BEGIN/COMMIT`. Bien. Mais §M3 enchaîne 4 MCP calls qui peuvent partiellement échouer (le 3e en `AGENT_GIT_FILE_MISSING` par ex). Acceptance criteria #6 = "4 rows" — ne dit pas comment rollback. Recommandation : ajouter au plan §M3 un `DELETE FROM agents WHERE company_id = '<demo>' AND name IN ('senior-dev','dev','review-watcher','release-mgr') AND archived_at IS NULL;` à exécuter EN CAS d'échec partiel, avant de relancer M3. Sinon les 4 calls vont rentrer en collision avec `deduplicateAgentName` (suffixe " 2") et casser le triplet attendu en M4.

#### MINOR

**N-1. Le plan §M1 push directement sur `main` (`git push origin main` ligne 1003) sans PR/branch.**
Pour un repo de démo single-user, OK. Mais si `mnm-demo` a déjà des protections de branche (rare sur lab.enterprise.example en perso, mais possible), la push échoue. Plan devrait noter explicitement : "Repo doit autoriser push direct sur main, sinon créer branche `refactor/git-first` et merger localement avant push."

**N-2. P3 migration index — le plan utilise `agents_company_active_idx`, le commentaire `agents_company_archived_idx`.**
Plan ligne 141 : `agents_company_archived_idx ON agents (company_id) WHERE archived_at IS NULL`. Plan ligne 389 : `agents_company_active_idx`. Cohérence : choisir un nom et l'utiliser partout. Préférer `agents_company_active_idx` (sémantique plus claire pour un index "where archived_at IS NULL"). Mineur.

**N-3. Plan §P11 E2E test — currentAgents sha doit être calculé, pas hardcoded.**
Ligne 946 : `currentAgents: { "mnm--senior-dev": expectedSeniorDevSha }`. La var `expectedSeniorDevSha` est mentionnée mais pas définie dans le snippet. Le test doit faire un premier appel `setupWorkspace` (ou loadCanonicalAgent direct via test seed) pour obtenir le sha, puis le passer. Ajouter cette étape explicitement.

**N-4. Plan §P7 input zod sans message d'erreur explicite si `latestGitTag` invalide.**
Ligne 783 `latestGitTag: z.string().min(1).optional()` — OK pour zod. Mais le hint d'erreur en ligne 800 pointe vers le path mais pas vers l'argument `latestGitTag`. Le test ligne 760 vérifie `hints` matching `agents/ghost/agent.md`. Bien. Mais si le user passe `latestGitTag = "  "` (whitespace), `z.string().min(1)` accepte. Recommandation : `.refine((s) => s.trim().length > 0)`. Mineur.

#### NIT

**Nit-1.** Plan §3.2 dit "Le cache key actuelle (...) ne mixe pas les users". Vrai. Mais P2 ajoute `:resourceType` aux deux caches, et la clause "Recommandation côté implémentation" est au passé conditionnel. Clarifier que c'est une note documentaire, pas une action TDD.

**Nit-2.** §M2 ligne 1037 : `WHERE name IN ('greeter','shouter')`. Une SELECT avant pour vérifier que ces deux noms existent serait défensif. `RAISE NOTICE 'Archived % rows', (SELECT COUNT(*) ...)`. Mineur.

**Nit-3.** Plan §6 acceptance criterion #2 dit "tous les tests existants verts". Le `errors.test.ts` strict-equal (M-2) pourrait être en pré-existant cassé. Dev-B doit confirmer en pre-flight `bun test packages/governed-workflows` AVANT P1.

### 10.B Tautology audit (Test first entries)

| Plan task | Test concerné | Verdict | Replacement suggéré |
|---|---|---|---|
| P0 ligne 200-205 | "returns <name>/<file> when paths.<type> is empty string" | **Behavior-encoding ✓** | (encode SPEC §5.5 directement, garder) |
| P0 ligne 206-211 | "returns <prefix>/<name>/<file> when paths.<type> is set" | **Behavior-encoding ✓** | garder. |
| P0 ligne 223-232 | "rejects '..' segment" | **Behavior-encoding ✓** | garder + élargir M-1 (rejeter aussi name/file). |
| P1 ligne 279-281 | `expect(WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED).toBe("AGENT_NOT_REGISTERED")` | **TAUTOLOGIQUE** ❌ | Encode rien d'autre que le mapping clé→string-littérale. Replacement : un test fonctionnel qui vérifie qu'une erreur jetée par `loadCanonicalAgent` (via mock léger) a `code === WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED` ET que `wrap()` la mappe en `error_code: "AGENT_NOT_REGISTERED"` dans la sortie MCP. Ce test fait écho à un comportement (l'erreur est routable en MCP), pas à la structure de l'objet `as const`. |
| P2 ligne 311 | `expect((provider as any).paths).toEqual({ agents: "agents", workflows: "workflows" })` | **Behavior-encoding ✓** (encode l'attachement non-fonctionnel décrit en §5.5) | garder. |
| P2 ligne 314-323 | "caches per resourceType" — assert que `a.paths.agents === "agents"` ET `w.paths.workflows === "workflows"` | **AMBIGÜ** — vérifie l'attachement, pas le caching. Le titre dit "caches" mais l'assertion teste les paths. ❌ | Replacement : appeler `resolve` 2× avec même `(companyId, resourceType)` puis assert que le SECOND appel n'a PAS frappé la DB (espionner `db.select`). C'est wiring mais ENCODE le contrat de cache. Renommer le test "second resolveGitProvider call with same (companyId, resourceType) skips DB lookup". |
| P4 ligne 420-441 | "throws AGENT_NOT_REGISTERED when no agents row exists" | **Behavior-encoding ✓** | garder. Vérifier que `hints` est bien actionnable (regex `/create_agent.*ghost/i`). |
| P4 ligne 442-453 | "sub_cause AGENT_TAG_MISSING when latestGitTag null" | **Behavior-encoding ✓** | garder. |
| P4 ligne 455-464 | "skips archived agents" | **Behavior-encoding ✓** | garder. |
| P4 ligne 466-470 | "succeeds when row + tag + .md reachable" — test sans body | **PLACEHOLDER** ❌ | À étoffer : encoder explicitement le triplet retourné `(content, sha)` non-null + assertion sur le path fetch (`expect(seenPath).toBe("agents/<name>/agent.md")`). |
| P5 ligne 553-585 | "skips agents whose .md is missing... logs structured warn" | **MULTI-BEHAVIOR** ❌ | Splitter en 2 `it`: (a) "result excludes ghost when its .md 404s" (assertion `result.agents.map(...) === ["mnm--alpha"]`) ; (b) "logs a structured warn with no token field on 404 skip" (assertion sur warnSpy + filter sur le préfixe `[mnm.setup_workspace]`). Cf. M-5. |
| P5 ligne 587-597 | "excludes archived agents" | **Behavior-encoding ✓** | garder. |
| P5 ligne 599-607 | "re-throws non-404 GitProviderErrors" | **Behavior-encoding ✓** (négatif important : ne pas swallow) | garder. |
| P6 ligne 685-701 | "fetches under workflows/ prefix when paths.workflows set" | **Behavior-encoding ✓** | garder. |
| P6 ligne 703-706 | "falls back to <name>/workflow.json when paths undefined" | **Behavior-encoding ✓** | garder. |
| P7 ligne 741-750 | "inserts row with latest_git_tag when .md exists" | **WIRING-LIKE** ⚠ | Le test re-select la row pour assert `latestGitTag === "v1"`. OK comme contract test, mais l'assertion `row[0].latestGitTag === "v1"` est de la persistence. Replacement plus fort : assert que le NEXT call à `loadCanonicalAgent("senior-dev")` retourne `(content, sha)` non-null sans throw `AGENT_NOT_REGISTERED`. Ça encode "create_agent rend l'agent utilisable", pas "create_agent set la colonne". |
| P7 ligne 752-761 | "throws AGENT_GIT_FILE_MISSING when .md absent" | **Behavior-encoding ✓** | garder. |
| P7 ligne 763-769 | "preserves legacy when latestGitTag omitted" | **WIRING** ❌ | `expect(fetchSpy).not.toHaveBeenCalled()` — pure wiring. Replacement : `const result = await callCreateAgent({ name: "legacy", adapterType: "claude_local" }); expect(result.id).toBeDefined();` puis `const row = await db.select(); expect(row.latestGitTag).toBeNull();`. Encode le contrat "latestGitTag optionnel ⇒ row créée sans tag", pas l'absence d'appel git. |
| P8 ligne 834-844 | "listWorkflowFiles uses workflows/<name> subtree" | **Behavior-encoding ✓** | garder. |
| P8 ligne 846-855 | "batchCommit prefixes each path with workflows/<name>" | **Behavior-encoding ✓** | garder. |
| P9 ligne 881-889 | "calls resolveGitProvider with resourceType 'workflow'" — boucle `for (const call of spy.mock.calls)` | **WIRING + MULTI-BEHAVIOR** ❌ | Wiring sur l'arg, ET le test boucle sur N calls (incluant calls à des sous-services). Replacement : isoler **un seul** call (le getWorkflowParsed entry) et asserter la valeur exacte. Si plusieurs calls sont attendus, asserter chaque call dans son `it()` séparé. |
| P10 (pas de test) | — | **N/A** ; le plan dit "on s'appuie sur typecheck". | Acceptable pour des ajouts de paramètre. Mais si typecheck passe sans test, ajouter un commentaire dans le code expliquant pourquoi `resourceType: "workflow"`. |
| P11 E2E ligne 925-957 | Triplet retourné | **Behavior-encoding ✓** | garder, MAIS résoudre N-3 (sha doit être calculé, pas hardcoded). |

**Synthèse tautology** : 4 tests à réécrire (P1 ligne 279, P4 ligne 466, P7 ligne 763, P9 ligne 881), 1 à splitter en deux (P5 ligne 553), 1 à renommer (P2 ligne 314), 1 à étoffer (P11 sha calculation).

### 10.C Confirmation de fidelity (spec § → plan task)

| Spec décision | Plan honore ? | Where |
|---|---|---|
| #1 — Scope A minimal, pas de frontmatter | ✓ | Hors-scope plan §10. P0/P4/P5 ne touchent pas le contenu de l'agent.md. |
| #2 — Layout single-repo `agents/<name>/agent.md` + `workflows/<name>/...` | ✓ | M1 §6 ligne 989-994. |
| #3 — Symétrie agents+workflows via paths (option γ) | ✓ | P0 (helper) + P4 (agent read) + P6 (workflow read) + P8 (workflow write). **MAJOR M-3** : le plan ne teste pas explicitement que les gates suivent la translation `workflows/<name>/gates/...`. À ajouter en P6. |
| #4 — `paths` dans configJson, defaults `""` | ✓ | P0 ligne 256 `paths?.[type] ?? ""`. |
| #5 — `create_agent` étendu avec `latestGitTag?` | ✓ | P7. **MINOR N-4** : `.refine` whitespace check à ajouter. |
| #6 — `Greeter/shouter` archivés | ✓ | M2 ligne 1034-1037. **MAJOR M-3** : ordre P3-then-M2 doit être enforced. |
| #7 — `AGENT_NOT_REGISTERED` HARD throw | ✓ | P4 ligne 491-510. |
| #8 — Repo `example-org/mnm-demo` | ✓ | M2 ligne 1030 `'example-org/mnm-demo'`. |
| #9 — Stop à M4 | ✓ | Plan §6 s'arrête M4. |

**Spec amendement requis** (§3.9 plan) : `agents.archived_at` colonne à ajouter. Le plan le fait en P3. Confirmé : la spec doit être amendée par l'orchestrator (Tom) ou le plan-author note l'écart explicitement. **Recommandation** : faire l'amendement avant que dev-B démarre P3, sinon dev-B doit deviner l'intention.

### 10.D Backwards compat

- 3 tests `userId` existants (`:202, :354, :803`) — **plan adapte** explicitement en §3.8 + §P2 implementation snippet. ✓ Ne PAS supprimer, juste passer à `expect.objectContaining({ userId, resourceType })`.
- `paths` field absent ⇒ `<name>/<file>` (legacy) — **P0 ligne 194-198** encode le comportement. ✓
- Autres consumers de `git_provider` configJson : grep rapide montre que `resolveGitlabCoordinates` (`build-mcp-services.ts:246`) lit `baseUrl, projectId` mais pas `paths` → safe (extra field ignoré). ✓ Plan §10 mentionne pas cet audit explicitement — à noter mais pas bloquant.

### 10.E Operational risk

- **M1** — script bash `scripts/migrate-2026-04-26-mnm-demo.sh` fourni avec `git mv` exact. ✓ N-1 sur push direct main reste mineur.
- **M2** — single-TX bien spécifié §3.7 + §M2. ✓ Restart serveur post-M2 mentionné en commentaire — préfererait un `--restart-required` flag dans la sortie (déjà noté §risques ligne 1154).
- **M3** — JSON exact des 4 calls fourni §M3. ✓ M-6 (rollback partiel) à ajouter.
- **M4** — séquence MCP exacte + critères de succès "MUST return / MUST NOT return" — ✓ très clair.
- **Rollback** — non couvert pour M2 partiel succès (mais TX wrap mitige). M3 partiel non couvert (M-6).

### 10.F Sign-off

**Verdict : NEEDS REWORK — see issues**

Total :
- 3 BLOCKERS (B-1 P9 closure incorrecte, B-2 syncEnvironment manquant du scope, B-3 ordre P3-then-M2 non enforced)
- 6 MAJORS (M-1 helper validation incomplete, M-2 errors.test.ts pré-cassé, M-3 gate translation untested, M-4 cache key + .limit(1) à clarifier, M-5 setupWorkspace warn test fragile, M-6 rollback M3)
- 4 MINORS (N-1 push main, N-2 nom index, N-3 sha hardcoded, N-4 zod whitespace)
- 3 NITS

**Recommandation orchestrator : iterate-with-plan-author.** Les BLOCKERS sont chacun localisable et fixable en <30 min par mnm-plan-arch. Une fois B-1/B-2/B-3 résolus + tautology audit appliqué (4 tests réécrits), le plan est READY FOR DEV. Demo lundi 2026-04-28 reste réaliste.

---

## § Plan revisions (round 2)

*Author: mnm-plan-arch — 2026-04-26 — close arch-critic round 1.*

Edits ciblés en place dans les sections concernées. Ce résumé liste task-par-task ce qui a changé, et confirme le statut de chaque finding (BLOCKER / MAJOR / MINOR / NIT / TAUTOLOGY).

### 11.1 Findings closed

#### BLOCKERs — TOUS CLOSED

| ID | Status | Evidence |
|---|---|---|
| **B-1** (P9 closure userId) | ✅ CLOSED | §3.11 ajouté (description du bug latent). §P9 réécrit avec implémentation concrète : capture `const userId = input.userId` AVANT la closure, propage `a.resourceType` aussi. 2 tests `it()` séparés (un par behavior, satisfait aussi tautology audit P9). Si dev-C ne peut pas livrer : §P9 documente le fallback "retirer le claim et follow-up post-démo" — explicitement nommé. |
| **B-2** (syncEnvironment userId) | ✅ CLOSED | §2.3 ajout du callsite `:1197` (passe de 11 à 12 callsites). §3.10 ajouté (description). **Nouvelle tâche P2.1** créée avec 2 tests TDD (un pour `syncEnvironment` direct, un pour la chaîne `pushLocalState → syncEnvironment`). Ajout d'un acceptance criterion #4 dédié. dev-A owner. |
| **B-3** (P3 → M2 ordering) | ✅ CLOSED | §3.12 ajouté. **Nouvelle tâche M0** "Apply pending Drizzle migrations" insérée avant M1 dans la séquence ops. M2 SQL commence par un guard `DO $$ ... IF NOT EXISTS ... archived_at ... RAISE EXCEPTION` qui fail-fast si M0 oublié. Acceptance criterion #1 explicite l'ordre. Section §8 "Sequencing strict" mise à jour avec M0 en tête. |

#### MAJORs — TOUS CLOSED

| ID | Status | Evidence |
|---|---|---|
| **M-1** (P0 helper traversal) | ✅ CLOSED | §P0 test étendu : 2 nouveaux `it()` ("rejects a name containing '..'", "rejects a file containing '..'"). Implémentation refactor avec helper `rejectTraversal(label, value)` appliqué à `paths prefix`, `name`, `file`. Total 8 verts (vs 6). |
| **M-2** (errors.test.ts strict) | ✅ CLOSED | §P1 réécrit : pre-flight `bun test packages/governed-workflows/src/errors.test.ts` AVANT toute modif. Test `toEqual` complété avec les 3 codes file (`WORKFLOW_FILE_*`) qui devraient déjà être listés + 2 nouveaux. Nit-3 (acceptance criterion "tous tests verts") aussi adressé via ce pre-flight. |
| **M-3** (gate translation untested) | ✅ CLOSED | §P6 ajout d'un test E2E unit-niveau qui force `paths.workflows="workflows"` et asserte `seenGateFetchPaths.toContain("workflows/demo/gates/g1.gate.ts")` ET `not.toContain("demo/gates/...")`. Encode la chaîne complète SPEC §3 #3. |
| **M-4** (P2 .limit(1) + ordering) | ✅ CLOSED | §P2 implementation point #3 explicite : retirer `.limit(1)`, ajouter `.orderBy(configLayerItems.createdAt, configLayerItems.id)`. Nouveau test "selects deterministically by (created_at, id)" en §P2 round 2 qui seed 2 items et vérifie la sélection par resourceType. |
| **M-5** (warn test fragile) | ✅ CLOSED | §P5 test split en 2 (cf. tautology). Le 2e test filtre `warnSpy.mock.calls.filter(c => c[0] === "[mnm.setup_workspace] agent_md_missing")` AVANT toute assertion, asserte le shape exact via `Object.keys(payload).sort()`, et regex `/token\|secret\|password\|credential/i` sur les keys. §3.4 mis à jour avec `providerProjectId` ajouté au payload (lu de `gitProvider.providerId` qui est non-secret). |
| **M-6** (M3 rollback) | ✅ CLOSED | §M3 ajouté un bloc "Round 2 (M-6) — rollback partiel" avec le SQL `DELETE FROM agents WHERE company_id = '...' AND name IN (...) AND archived_at IS NULL`, explication du collision avec `deduplicateAgentName`, et note prod (préférer `archived_at = NOW()` en prod). |

#### MINORs — TOUS CLOSED

| ID | Status | Evidence |
|---|---|---|
| **N-1** (push direct main) | ✅ CLOSED | §M1 ajout du paragraphe "Round 2 (N-1) — branch protection caveat" avec la procédure MR fallback. |
| **N-2** (nom index incohérent) | ✅ CLOSED | §3.9 corrigé `agents_company_archived_idx` → `agents_company_active_idx` (ligne 165). §P3 implementation note round 2 réaffirme le nom canonique. |
| **N-3** (sha hardcoded P11) | ✅ CLOSED | §P11 réécrit : le test commence par `await svc.setupWorkspace(...)` pour découvrir `seniorDev.sha` puis l'utilise dans `currentAgents`. Bonus : exerce aussi le path resolution agents/<name>/agent.md. |
| **N-4** (zod whitespace) | ✅ CLOSED | §P7 zod schema ajout `.refine((s) => s.trim().length > 0, { message: "..." })`. Nouveau test "rejects latestGitTag that is whitespace-only" en P7 round 2. |

#### NITs — addressed where cheap

| ID | Status | Evidence |
|---|---|---|
| **Nit-1** (cache key wording) | ✅ CLOSED implicitly | §3.2 reste descriptif. §P2 round 2 a clarifié explicitement le contrat de cache via le test renommé "second resolveGitProvider call ... skips DB lookup". |
| **Nit-2** (M2 SELECT count) | ✅ CLOSED | §M2 SQL ajouté `SELECT COUNT(*) AS to_archive_count FROM agents WHERE name IN ('greeter','shouter') ...` avant le `BEGIN;` (pas dans la TX, juste pour log défensif). |
| **Nit-3** (errors.test.ts pre-flight) | ✅ CLOSED | §P1 ajout de la consigne "Pre-flight check (dev-B doit faire CECI EN PREMIER)". |

### 11.2 Tautology audit — résolution

| Finding | Status | Evidence |
|---|---|---|
| P1 ligne 279 (string-literal mapping) | ✅ REWRITTEN | §P1 round 2 — supprimé le `expect(WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED).toBe("AGENT_NOT_REGISTERED")`. Ajouté un test fonctionnel MCP-envelope qui asserte le routage end-to-end via `wrap()`. |
| P2 ligne 314 (renommage) | ✅ RENAMED | §P2 round 2 — l'ancien test "caches per resourceType" remplacé par 2 tests : "second resolveGitProvider call ... skips DB lookup" (encode le caching réel via `vi.spyOn(db, "select")`) et "different resourceType values produce separate cache entries" (encode la différenciation par resourceType). |
| P4 ligne 466 (placeholder) | ✅ FILLED | §P4 round 2 — placeholder remplacé par un test concret qui asserte le triplet retourné ET `seenPaths.toContain("agents/happy/agent.md")`. |
| P5 ligne 553 (multi-behavior) | ✅ SPLIT | §P5 round 2 — split en 2 `it()` : "excludes from result..." (assertion sur `result.agents`) et "logs a structured warn..." (assertion sur warnSpy filtré). Cf. M-5. |
| P7 ligne 763 (wiring `fetchSpy.not.toHaveBeenCalled`) | ✅ REWRITTEN | §P7 round 2 — replacement par un test qui asserte le contrat "row.latestGitTag === null" en sortie de DB après un `create_agent` sans tag, plutôt que l'absence d'appel git. |
| P7 ligne 741 (re-select wiring) | ✅ STRENGTHENED | §P7 round 2 — replacement par un test qui exécute le round-trip `create_agent → launchStep → loadCanonicalAgent` et asserte `result.agentName === "senior-dev"` (encode "create_agent rend l'agent utilisable", pas "create_agent set la colonne"). |
| P9 ligne 881 (loop wiring) | ✅ REWRITTEN | §P9 round 2 — split en 2 `it()` (un par behavior). Test 1 cible `spy.mock.calls[0][0]` (le call précis de `getWorkflowParsed`) avec `userId: "u-99"`. Test 2 cible `resourceType: "workflow"`. Plus de boucle aveugle. |
| P11 sha calc | ✅ FILLED | cf. N-3 ci-dessus. Le sha est découvert via `setupWorkspace` (pas hardcoded, pas calculé par `createHash` côté test — encode aussi la chaîne agents/<name>/agent.md). |

### 11.3 Findings opened in round 2 (et leur status)

Aucun nouveau finding majeur n'a émergé pendant l'itération. Un point doc-only :
- **Doc-1** : §10.D arch-critic note que `resolveGitlabCoordinates` (`build-mcp-services.ts:349-383`) lit `baseUrl, projectId` mais ignore `paths` → safe. Pas d'action plan, juste à confirmer en code review post-implem que ce site reste safe quand `cfg.paths` est présent (extra field).
  → **Action** : ajouter un commentaire dans `resolveGitlabCoordinates` après round 2 implem ("// `cfg.paths` is read elsewhere in createResolveGitProvider; ignored here for the coordinates lookup."). Pas un blocker.

### 11.4 Deferred (justified)

Aucun finding deferred dans cette round 2 — tous les BLOCKERs/MAJORs/MINORs sont closed dans le plan ; les NITs sont closed à coût proche-zéro.

Si le dev team découvre durant l'implémentation que P9 (B-1) ne peut pas être livré dans les délais (ex: la closure typage TypeScript fait perdre le `resourceType` malgré le forme explicite), le fallback documenté en §P9 ("retirer le claim et ouvrir un follow-up post-démo") s'applique. Ce n'est pas un blocker pour la démo lundi 2026-04-28 (l'AI assistant n'est pas dans le storyboard).

### 11.5 Net delta vs round 1

- **+1 nouvelle tâche dev** : P2.1 (BLOCKER B-2 syncEnvironment).
- **+1 nouvelle tâche ops** : M0 (BLOCKER B-3 db migrate before M2).
- **+8 nouveaux tests** (round 2 only) : P0 (+2 traversal name/file), P1 (+1 MCP envelope routing), P2 (+2 cache + ordering), P2.1 (+2 syncEnvironment userId), P5 split (+1 net), P6 (+1 gate translation), P7 (+1 whitespace + 1 round-trip), P9 (+1 net après split), P11 sha (+0 — concrétisation).
- **0 task supprimée**.
- **0 régression** introduite : tous les tests existants verts, les 3 tests userId adaptés via `expect.objectContaining`, pas de suppression.
- **Volume** : ~+200 lignes au plan (1167 → ~1370).

### 11.6 Sign-off round 2

Le plan est **READY FOR ARCH-CRITIC ROUND 2**. Tous les BLOCKERs et MAJORs sont fermés avec edits ciblés. Les MINORs/NITs sont également fermés (coût proche-zéro). La tautology audit est intégralement traitée.

---

## § Arch Review (round 2)

*Author: arch-critic — 2026-04-26 — independent verification of plan revisions round 2.*

Méthode : pour chaque finding round 1, lecture du fix dans le plan + jugement (VERIFIED / PARTIAL / REGRESSION / NOT FIXED).

### 12.A BLOCKERs

| ID | Verdict | Justification (citation) |
|---|---|---|
| **B-1** (P9 closure userId) | **VERIFIED** | §P9 ligne 1248-1260 capture `const userId = input.userId` AVANT la closure, forwarde `userId` ET `resourceType: a.resourceType`. 2 tests `it()` séparés (ligne 1228 userId, 1238 resourceType). Tests behavior-encoding (`toMatchObject({ userId: "u-99" })`). Fallback documenté ligne 1269. |
| **B-2** (syncEnvironment userId) | **VERIFIED** | §2.3 ajoute `:1197` syncEnvironment au tableau (passe à 12 callsites, ligne 38). §3.10 description du bug. §P2.1 (ligne 512-572) crée la tâche dédiée avec 2 tests TDD : `propagates userId to resolveGitProvider` (ligne 519) et `propagates userId from pushLocalState through to syncEnvironment` (ligne 536). Implementation 6 changes listés ligne 555-561. Acceptance criterion #4 ligne 1568 dédié. |
| **B-3** (P3 → M2 ordering) | **VERIFIED** | M0 nouvelle tâche §1347-1369. M2 commence par `DO $$ ... IF NOT EXISTS ... archived_at ... RAISE EXCEPTION` (ligne 1439-1448) — syntaxiquement valide PL/pgSQL. Fail-fast avant `BEGIN;`. Acceptance criterion #1 ligne 1565 ("M2 ne doit JAMAIS s'exécuter avant M0"). Sequencing strict §1589-1601 met M0 en tête. |

### 12.B MAJORs

| ID | Verdict | Justification |
|---|---|---|
| **M-1** (P0 helper traversal) | **VERIFIED** | §P0 ligne 293-300 helper `rejectTraversal(label, value)` appliqué à `paths prefix`, `name`, `file` (ligne 309-311). 2 nouveaux tests ligne 271-281 (rejet `..` dans `name` et `file`). |
| **M-2** (errors.test.ts strict) | **VERIFIED** | §P1 ligne 326-330 pre-flight check explicite. Le `toEqual` complété ligne 337-358 avec les 3 codes file pré-existants + 2 nouveaux. Couvre aussi Nit-3. |
| **M-3** (gate translation untested) | **VERIFIED** | §P6 ligne 981-1016 nouveau test E2E qui asserte `seenGateFetchPaths.toContain("workflows/demo/gates/g1.gate.ts")` ET `not.toContain("demo/gates/g1.gate.ts")`. Échouerait clairement sur l'ancien comportement (workflowDir="demo"). Encode la chaîne `paths.workflows → workflowRepoPath → workflowDir → gateSourcePath`. |
| **M-4** (P2 .limit(1) + ordering) | **VERIFIED** | §P2 ligne 484 implementation point #3 retire `.limit(1)` et ajoute `.orderBy(configLayerItems.createdAt, configLayerItems.id)`. Test multi-items déterministe ligne 453-466. Test "skips DB lookup" ligne 425-434 encode le contrat cache via spy on `db.select`. |
| **M-5** (warn test fragile) | **VERIFIED** | §P5 split en 2 `it()` (ligne 803, 820). Le 2e filtre sur prefix `[mnm.setup_workspace] agent_md_missing` ligne 830-832, asserte shape exact via `Object.keys(payload).sort()` ligne 837-839, puis regex `/token\|secret\|password\|credential/i` sur les keys ligne 848-850. `providerProjectId` documenté comme non-secret ligne 923. |
| **M-6** (M3 rollback) | **VERIFIED** | §M3 ligne 1503-1520 décrit la collision avec `deduplicateAgentName` (suffixe " 2"), fournit le DELETE SQL exact ligne 1508-1511, verify count ligne 1513-1517, note prod préfère `archived_at = NOW()` ligne 1520. Acceptance criterion #7 ligne 1571 vérifie l'absence de suffixe " 2". |

### 12.C MINORs

| ID | Verdict | Justification |
|---|---|---|
| **N-1** (push direct main) | **VERIFIED** | §M1 ligne 1413-1416 ajoute la procédure MR fallback (branch `refactor/git-first` → MR → tag sur merge commit). |
| **N-2** (nom index incohérent) | **VERIFIED** | §3.9 ligne 168 et §P3 ligne 602 utilisent tous deux `agents_company_active_idx`. Note explicite ligne 604 : "Le nom canonique de l'index est `agents_company_active_idx`". §M2 ligne 1565 acceptance criterion réaffirme la graphie. |
| **N-3** (sha hardcoded P11) | **VERIFIED** | §P11 ligne 1306-1309 : `const setup = await svc.setupWorkspace(...); const expectedSeniorDevSha = seniorDev!.sha;` — discovered, NOT hardcoded. Bonus : exerce aussi le path `agents/<name>/agent.md`. |
| **N-4** (zod whitespace) | **VERIFIED** | §P7 ligne 1117-1120 zod `.refine((s) => s.trim().length > 0, ...)` ; test dédié ligne 1097-1103 `rejects latestGitTag that is whitespace-only`. |

### 12.D NITs

| ID | Verdict | Justification |
|---|---|---|
| **Nit-1** (cache key wording) | **VERIFIED** | §P2 ligne 425 test renommé "second resolveGitProvider call ... skips DB lookup" — encode le contrat de cache. |
| **Nit-2** (M2 SELECT count) | **VERIFIED** | §M2 ligne 1454-1457 ajoute `SELECT COUNT(*) AS to_archive_count` AVANT le `BEGIN;` (intentionnellement hors TX, log défensif). |
| **Nit-3** (errors.test.ts pre-flight) | **VERIFIED** | §P1 ligne 326 ajoute la consigne "dev-B doit faire CECI EN PREMIER". |

### 12.E Tautology audit

| Finding | Verdict | Justification |
|---|---|---|
| P1 ligne 279 (string-literal mapping) | **VERIFIED** | §P1 ligne 367-385 test fonctionnel MCP-envelope routing (`expect(envelope.error_code).toBe("AGENT_NOT_REGISTERED")`). Ne réimplémente plus la string-littérale `as const`. |
| P2 ligne 314 (renamed) | **VERIFIED** | §P2 ligne 425 test renommé + spy on `db.select`. Behavior, pas wiring sans justification. |
| P4 ligne 466 (placeholder) | **VERIFIED** | §P4 ligne 681-718 test concret : asserte le triplet retourné ET `seenPaths.toContain("agents/happy/agent.md")`. |
| P5 ligne 553 (multi-behavior) | **VERIFIED** | §P5 split en 2 `it()` ligne 803 (excludes from result) et ligne 820 (logs structured warn). |
| P7 ligne 763 (fetchSpy wiring) | **VERIFIED** | §P7 ligne 1089-1094 contract DB `row[0].latestGitTag === null` (encode "no silent default"). Plus d'assertion sur l'absence d'appel git. |
| P7 ligne 741 (re-select wiring) | **VERIFIED** | §P7 ligne 1055-1073 round-trip `create_agent → launchStep → result.agentName === "senior-dev"`. Encode "create_agent rend l'agent utilisable". |
| P9 ligne 881 (loop wiring) | **VERIFIED** | §P9 ligne 1228, 1238 split en 2 `it()` (un par behavior, target précis `spy.mock.calls[0][0]`). Plus de boucle aveugle. |
| P11 sha calc | **VERIFIED** | §P11 ligne 1306-1309 sha discovered via setupWorkspace. |

### 12.F Audit count §11

Net delta claimed §11.5 vs réel observé :
- "+1 P2.1, +1 M0" — **OK**.
- "+8 nouveaux tests" — **comptage approximatif** : real ≈ 13 (P0+2, P1+1, P2+2, P2.1+2, P5 split=+1 net, P6+1, P7+2, P9 split=+1 net, P11 +0). Pas un blocker, juste un comptage minoré dans la rétrospective.
- "Volume +200 lignes (1167 → ~1370)" — **erroné** : réel = 1847 (round 2 sans la nouvelle review = 1717), donc +550 lignes net. Cosmétique, pas un fix.

Aucun de ces écarts ne change le verdict des fixes eux-mêmes.

### 12.G Findings opened in round 2 (OUT OF ROUND)

Pas de nouveau finding bloquant émergé pendant la verification round 2. Une note doc-only :
- **Doc-1** (déjà ouvert §11.3) : `resolveGitlabCoordinates` lit `baseUrl, projectId` mais ignore `paths` extra-field — safe. Action commentaire post-implem.

Pas d'action plan requise. Ce note est OUT OF ROUND.

### 12.H Sign-off round 2

| Catégorie | VERIFIED | PARTIAL | REGRESSION | NOT FIXED |
|---|---|---|---|---|
| BLOCKERs | 3 | 0 | 0 | 0 |
| MAJORs | 6 | 0 | 0 | 0 |
| MINORs | 4 | 0 | 0 | 0 |
| NITs | 3 | 0 | 0 | 0 |
| Tautology | 8 | 0 | 0 | 0 |
| **Total** | **24** | **0** | **0** | **0** |

**Verdict : READY FOR DEV.** Tous les findings round 1 sont VERIFIED. Aucun PARTIAL, REGRESSION ou NOT FIXED. Les écarts résiduels sont cosmétiques (comptage §11.5) et n'affectent pas la matière du plan.

**GO signal pour la dev team.** Sequencing : M0 → P0 → (P2, P2.1, P3) parallèle → P1 → (P4, P5, P6) parallèle après P0+P2 → (P7, P8, P9, P10) parallèle après P4+P6 → P11 → M1 → M2 → M3 → M4. Démo lundi 2026-04-28 reste réaliste.
