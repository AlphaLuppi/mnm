# MnM Git-first agents — refactor du modèle de résolution

*Spec — 2026-04-26 — founder × Claude*

## 1. Contexte et motivation

MnM se positionne comme **un harness léger autour de fichiers plats Git + MCP**. Workflows, gates et config_layers sont déjà résolus depuis Git via le `git_provider` config_layer_item de la company ; la DB sert d'index.

Les **agents** dérogent à ce modèle aujourd'hui :

- La résolution dans `loadCanonicalAgent` (`server/src/services/governed-workflows.ts:808-842`) fetch `<name>/agent.md` au root du repo, mais retourne `null` silencieux si l'agent n'est pas inscrit en DB.
- Conséquence : un workflow qui référence un agent absent (ex. `feature-dev` qui pointe sur `senior-dev`) passe les checks de `launchStep` sans déclencher `AGENTS_STALE`, mais n'a aucun moyen d'être matérialisé côté harness.
- Le repo perso `mnm-workflows-demo` héberge actuellement les .md d'agents *à l'intérieur* du dossier workflow (`feature-dev/agents/*.md`), incohérent avec la convention "un agent = une ressource cross-workflow".

Ce refactor aligne les agents sur le modèle Git-first, refuse explicitement la désynchro DB↔workflow, et introduit une abstraction de path préparant la suite (split du contenu en sous-repos GitLab `mnm/agents`, `mnm/workflows`, etc.).

**Deadline opérationnelle** : démo your organization lundi 2026-04-28. Le refactor doit être livrable et testé avant lundi midi pour permettre M5 (polish démo) en fin de dimanche.

## 2. Décisions actées (brainstorming 2026-04-26)

| # | Décision | Notes |
|---|---|---|
| 1 | **Scope minimal A** : `agent.md` = prompt système. Tout le reste (`title`, `capabilities`, `adapterType`, `permissions`, `budget`) reste en DB. | Refacto B (frontmatter YAML) reporté post-démo. |
| 2 | **Layout single-repo** aujourd'hui : `agents/<name>/agent.md` et `workflows/<name>/workflow.json` (+ ses gates). | Split en sous-repos `mnm/agents`, `mnm/workflows` plus tard, sans nouveau dev. |
| 3 | **Périmètre symétrique + abstraction `paths`** (option γ) : agents *et* workflows passent par le helper de path, le `git_provider` configJson porte un objet `paths`. | Permet le split sous-repos en jouant juste sur la config (paths vides + plusieurs items). |
| 4 | **Forme `paths`** (option i) : champ `paths: { agents, workflows, config_layers, ... }` dans le `configJson` du `git_provider` config_layer_item. Defaults `""` (rétro-compatible). | Quand split : plusieurs items, chacun pour un resourceType, `paths.<type> = ""`. |
| 5 | **Inscription agent** (a-1) : extension de `create_agent` MCP avec un `latestGitTag?: string` optionnel. Si fourni, le serveur valide la présence du `.md` avant insert. | Tool dédié `register_agent_from_git` reporté post-démo. |
| 6 | **Greeter/shouter** (option δ) : archivés (`archived_at = now()`, `enabled = false`). | Préserve l'historique des runs `hello-world`. |
| 7 | **Erreur `AGENT_NOT_REGISTERED`** : `loadCanonicalAgent` throw si la row est absente, au lieu du `null` silencieux ligne 823. `launchStep` propage l'erreur. | Hint actionnable : `Run create_agent with name=X and latestGitTag=Y first`. |
| 8 | **Repo cible** : `gitlab.example.com/your-username/mnm-demo` (renommé depuis `mnm-workflows-demo`). | Update `projectId` dans la config_layer git_provider. |
| 9 | **Stop à M4** dans la livraison de cette spec. M5 (polish prompts agents, smoke test ouverture MR, storyboard démo) sera fait par the maintainer dimanche matin. | M5 hors-scope de l'implémentation Claude. |

## 3. Périmètre fonctionnel (in-scope)

- Convention path repo namespacée `agents/<name>/agent.md`, `workflows/<name>/workflow.json`, `workflows/<name>/gates/*.gate.ts`.
- Champ `paths` dans `configJson` du `git_provider` config_layer_item, optionnel, defaults `""`.
- Helper centralisé `resolveResourcePath(provider, resourceType, name, file)`.
- Argument `resourceType: "agent" | "workflow"` ajouté à `resolveGitProvider`. Les gates héritent du provider `"workflow"` (les `.gate.ts` vivent à l'intérieur de `workflows/<name>/gates/`). L'extension à un type `"gate"` (cas d'un sous-repo `mnm/gates` partagées) est hors-scope.
- Erreur dure `AGENT_NOT_REGISTERED` côté `loadCanonicalAgent`.
- Gestion gracieuse côté `setupWorkspace` quand un `agent.md` est introuvable au tag pinné (skip + log warn).
- Filter `archived_at IS NULL` dans `setupWorkspace` et tous les listings d'agents publics.
- Extension `create_agent` : `latestGitTag?: string` + validation Git.
- Migration ops : restructuration repo + retag + DB updates documentés.

## 4. Hors-scope (post-démo)

- Frontmatter YAML dans `agent.md` portant `title`, `capabilities`, `adapterType`, etc. (refacto B).
- Nouveau tool MCP dédié `register_agent_from_git`.
- Split du repo `mnm-demo` en sous-repos GitLab `mnm/agents`, `mnm/workflows`, `mnm/config-layers`.
- Promotion UI dans le Workflow Studio (bouton "Promote to MnM agent" sur un fichier `.md`).
- Stockage des `config_layer_items` directement en Git avec `sourceContentHash`.
- Lifecycle complet d'archivage UI pour les agents.

## 5. Architecture cible

### 5.1 Convention de layout repo (single-repo, aujourd'hui)

```
your-username/mnm-demo/
├── agents/
│   ├── senior-dev/agent.md
│   ├── dev/agent.md
│   ├── review-watcher/agent.md
│   └── release-mgr/agent.md
└── workflows/
    ├── feature-dev/
    │   ├── workflow.json
    │   └── gates/
    │       ├── approval-granted.gate.ts
    │       ├── artifact-exists.gate.ts
    │       ├── mr-approved.gate.ts
    │       └── mr-opened.gate.ts
    └── product-feature-delivery/
        └── workflow.json
```

Les workflows referencent leurs gates via des paths relatifs (`./gates/<name>.gate.ts`) — déjà le cas dans `feature-dev/workflow.json`. La résolution de gate est inchangée : elle s'appuie sur le path du dossier workflow.

### 5.2 Convention de layout repo (split sous-repos, futur)

```
your-username/mnm-agents/
├── senior-dev/agent.md
└── ...

your-username/mnm-workflows/
├── feature-dev/workflow.json
└── ...
```

Bascule via la config_layer "Git Provider" : passer d'un seul item couvrant tous les resource types à un item par resourceType, avec `paths.<type> = ""`. **Aucun changement de code** nécessaire à ce moment-là.

### 5.3 Forme `git_provider` configJson

Aujourd'hui :
```jsonc
{
  "kind": "gitlab",
  "providerId": "gitlab:primary",
  "baseUrl": "https://gitlab.example.com",
  "projectId": "your-username/mnm-demo",
  "token": "..."
}
```

Après refactor (rétro-compatible — `paths` optionnel) :
```jsonc
{
  "kind": "gitlab",
  "providerId": "gitlab:primary",
  "baseUrl": "https://gitlab.example.com",
  "projectId": "your-username/mnm-demo",
  "token": "...",
  "paths": {
    "agents": "agents",
    "workflows": "workflows"
  }
}
```

Quand `paths.<type>` est absent ou `""`, le helper retourne `<name>/<file>` (layout root, comportement actuel pour `loadCanonicalAgent`).

### 5.4 Sélection multi-items (futur split)

Quand plusieurs `git_provider` items existent dans la config_layer enforced de la company, `resolveGitProvider({ resourceType })` choisit le premier item dont `configJson.paths` couvre ce resourceType (`paths.<resourceType>` défini, même `""`). Aujourd'hui un seul item couvre tout via les 4 clés de `paths`. Demain plusieurs items, chacun avec une seule clé.

### 5.5 Helper de résolution de path

Nouveau helper privé dans `server/src/services/governed-workflows.ts` (ou dans un nouveau `server/src/services/git-resource-path.ts` si on veut tester en isolation) :

```ts
type ResourceType = "agent" | "workflow";

function resolveResourcePath(
  provider: { paths?: Partial<Record<ResourceType, string>> },
  resourceType: ResourceType,
  name: string,
  file: string,
): string {
  const base = provider.paths?.[resourceType] ?? "";
  return base === "" ? `${name}/${file}` : `${base}/${name}/${file}`;
}
```

Tous les sites de fetch passent par ce helper. Le `provider.paths` est attaché au `GitProvider` retourné par `resolveGitProvider` comme métadonnée non-fonctionnelle (ne change pas l'interface `GitProvider`, juste un champ supplémentaire lu localement quand on construit le path).

### 5.6 Comportement `loadCanonicalAgent` après refactor

```
loadCanonicalAgent(companyId, agentName, userId):
  row = SELECT * FROM agents
        WHERE company_id = X AND name = Y AND enabled = true AND archived_at IS NULL
  IF row IS NULL → throw AGENT_NOT_REGISTERED
  IF row.latest_git_tag IS NULL → throw AGENT_NOT_REGISTERED (sub-cause: AGENT_TAG_MISSING)
  provider = resolveGitProvider({ companyId, userId, resourceType: "agent" })
  path = resolveResourcePath(provider, "agent", agentName, "agent.md")
  blob = fetchBlob({ path, ref: row.latest_git_tag })
  return { content, sha }
```

Les deux sous-causes (`AGENT_NOT_REGISTERED` pour row absente, `AGENT_TAG_MISSING` pour tag vide) sont distinguées dans la `data` de l'erreur pour des hints précis.

### 5.7 Comportement `setupWorkspace` après refactor

```
setupWorkspace(companyId, userId):
  rows = SELECT * FROM agents
         WHERE company_id = X AND enabled = true AND archived_at IS NULL
  out = []
  FOR row IN rows:
    IF row.latest_git_tag IS NULL → continue
    TRY:
      content = fetch agents/<row.name>/agent.md@<row.latest_git_tag>
      out.push({ name: "mnm--<row.name>", content, sha, target_path })
    CATCH GIT_PROVIDER_ERROR (404):
      log.warn("agent <row.name> tag <tag>: agent.md missing in repo, skipping")
      continue
  return { agents: out, instructions }
```

Le skip-on-404 évite que la présence d'agents legacy en DB pointant vers des refs absentes du repo (cas `greeter`/`shouter` avant archivage) ne fasse crasher l'onboarding.

## 6. Modifications code (in-scope)

### 6.1 `packages/db/src/schema/agents.ts`

Aucune modification. Les colonnes `latestGitTag`, `enabled` et `archivedAt` (s'il manque, voir vérif § 7) existent déjà.

### 6.2 `packages/governed-workflows/src/errors.ts`

Ajout des codes d'erreur :
- `AGENT_NOT_REGISTERED` — agent référencé par un step n'a pas de row DB ou pas de `latestGitTag`.
- `AGENT_GIT_FILE_MISSING` — `create_agent` reçoit un `latestGitTag` mais le `.md` est absent du repo au tag.

### 6.3 `server/src/mcp/build-mcp-services.ts`

- `ResourceType` exporté.
- `ResolveGitProviderArgs` gagne `resourceType: ResourceType`.
- `createResolveGitProvider` :
  - Cache key ajusté à `${companyId}:${resourceType}` (et `${companyId}:${userId}:${resourceType}` pour le user-scope).
  - Lors de la sélection de l'item DB :
    - 1 item couvrant tous les types (`paths` avec ≥1 clé matching ou pas de `paths` du tout) → utilisé.
    - Plusieurs items → premier dont `paths.<resourceType>` est défini (incluant `""`).
  - Le `GitProvider` retourné expose `paths: Partial<Record<ResourceType, string>>` (lu depuis le configJson, défaut `{}`).

### 6.4 `server/src/services/governed-workflows.ts`

- Nouveau helper `resolveResourcePath(provider, resourceType, name, file)` (privé ou exporté pour les tests).
- `loadCanonicalAgent` :
  - Filtre `archived_at IS NULL`.
  - Throw `AGENT_NOT_REGISTERED` si row absente.
  - Throw `AGENT_NOT_REGISTERED` (sous-cause) si `latestGitTag` null.
  - `resolveGitProvider({ ..., resourceType: "agent" })`.
  - Path via `resolveResourcePath`.
- `getWorkflowParsed` :
  - `resolveGitProvider({ ..., resourceType: "workflow" })`.
  - Path `workflows/<name>/workflow.json` via `resolveResourcePath`.
- `setupWorkspace` :
  - Filtre `archived_at IS NULL`.
  - Try/catch autour de chaque `fetchBlob` pour skip-on-404 avec log.
- Tous les autres callsites de `resolveGitProvider` : ajouter `resourceType`.

### 6.5 `server/src/mcp/tools/governed-workflows.tool.ts`

- `launchStep` : aucune modif fonctionnelle (l'erreur `AGENT_NOT_REGISTERED` remonte via `wrap`).
- `setup_workspace` : aucune modif (skip-on-404 transparente côté tool).

### 6.6 `server/src/mcp/tools/agents.tool.ts`

- `create_agent` :
  - Input zod gagne `latestGitTag: z.string().min(1).optional()`.
  - Si fourni, fetch `agents/<name>/agent.md@<latestGitTag>` côté serveur. 404 → throw `AGENT_GIT_FILE_MISSING`.
  - Insert avec la colonne `latest_git_tag` populée.

### 6.7 Routes UI (`server/src/routes/governed-workflows-ui.ts`)

Audit des callsites de `resolveGitProvider` : ajouter `resourceType` selon le contexte (lecture workflow → `"workflow"`, lecture fichier d'agent → `"agent"`, etc.). Aucun changement fonctionnel attendu pour l'utilisateur de l'UI.

## 7. Vérifications préalables

Avant de coder, deux confirmations à passer :

1. La table `agents` a-t-elle bien une colonne `archived_at` ? (Spec assumée — confirmer via `\d agents` ou lecture du schema Drizzle.)
2. Les `gate.ts` sont-ils résolus depuis le folder du workflow (path relatif `./gates/...`) ou depuis le root du repo ? Confirmer en lisant `server/src/services/gate-execution.ts` ou équivalent. Si root-relative, le périmètre du refactor s'élargit.

## 8. Tests (TDD strict)

Ordre suggéré :

1. **Helper `resolveResourcePath`** — tests unitaires (`resolveResourcePath.test.ts`) :
   - `paths` absent → `<name>/<file>`.
   - `paths.<type> = ""` → `<name>/<file>`.
   - `paths.<type> = "agents"` → `agents/<name>/<file>`.
2. **`createResolveGitProvider`** — tests pour le routing multi-items et le cache key par resourceType.
3. **`loadCanonicalAgent`** :
   - Throw `AGENT_NOT_REGISTERED` si row absente.
   - Throw `AGENT_NOT_REGISTERED` (sous-cause `AGENT_TAG_MISSING`) si `latestGitTag` null.
   - Skip si `archived_at` set.
   - Fetch via `agents/<name>/agent.md` quand `paths.agents = "agents"`.
4. **`getWorkflowParsed`** — fetch via `workflows/<name>/workflow.json` quand `paths.workflows = "workflows"`.
5. **`setupWorkspace`** :
   - Skip avec log les agents dont le `.md` est introuvable au tag.
   - Filtre `archived_at IS NULL`.
6. **`create_agent`** :
   - Accepte `latestGitTag` et insert la colonne.
   - Throw `AGENT_GIT_FILE_MISSING` si `.md` absent du repo.
   - Sans `latestGitTag` → comportement actuel inchangé (rétro-compat).
7. **Tests d'intégration end-to-end** (au minimum un) : `feature-dev` `tech-design` step, depuis un état seedé, jusqu'à `launch_governed_step` qui retourne `{ subagent_type, prompt_context }` sans erreur.

## 9. Migrations & ops (M1 → M4 hors M5)

### M1 — Repo `your-username/mnm-demo`

- Créer ou renommer `mnm-workflows-demo` → `mnm-demo` sur `gitlab.example.com`.
- Restructurer le contenu :
  - `feature-dev/agents/senior-dev.md` → `agents/senior-dev/agent.md` (et 3 autres).
  - `feature-dev/workflow.json` → `workflows/feature-dev/workflow.json`.
  - `feature-dev/gates/*.gate.ts` → `workflows/feature-dev/gates/*.gate.ts`.
  - Idem pour `product-feature-delivery`.
- Retag : `agents/v1.0.0` (un tag global pour tous les agents au moment du déploiement) et `feature-dev/v1.0.2`.
- Push.

### M2 — DB updates

- **`config_layer_items`** (id `66b458ea-9879-4256-a802-45da08589a0a`) :
  ```sql
  UPDATE config_layer_items
  SET config_json = config_json
    || jsonb_build_object('projectId', 'your-username/mnm-demo')
    || jsonb_build_object('paths', jsonb_build_object('agents','agents','workflows','workflows'))
  WHERE id = '66b458ea-9879-4256-a802-45da08589a0a';
  ```
- **`agents`** : archivage greeter/shouter (et tout autre agent legacy avec `latest_git_tag` orphan) :
  ```sql
  UPDATE agents
  SET archived_at = NOW(), enabled = false
  WHERE name IN ('greeter','shouter') AND company_id = '00000000-0000-4000-8000-000000000001';
  ```
- **`governed_workflow_definitions`** : retag pour matcher le nouveau tag :
  ```sql
  UPDATE governed_workflow_definitions
  SET latest_git_tag = 'feature-dev/v1.0.2'
  WHERE name = 'feature-dev' AND company_id = '00000000-0000-4000-8000-000000000001';
  ```

### M3 — Inscrire les 4 agents en DB

Après déploiement du fix `create_agent` étendu, 4 appels MCP :

```jsonc
mcp.create_agent({ name: "senior-dev",      latestGitTag: "agents/v1.0.0", title: "Senior Dev (your organization demo)",    adapterType: "claude_local" })
mcp.create_agent({ name: "dev",             latestGitTag: "agents/v1.0.0", title: "Dev (your organization demo)",           adapterType: "claude_local" })
mcp.create_agent({ name: "review-watcher",  latestGitTag: "agents/v1.0.0", title: "Review Watcher (your organization demo)",adapterType: "claude_local" })
mcp.create_agent({ name: "release-mgr",     latestGitTag: "agents/v1.0.0", title: "Release Manager (your organization demo)",adapterType: "claude_local" })
```

### M4 — Test run end-to-end

1. `mnm.setup_workspace` → matérialise les 4 agents en `~/.claude/agents/mnm--*.md` + `mnm--PM-internal-product`, `mnm--CAO`, `mnm--Dev`, `mnm--QA` si encore actifs (ou les archiver aussi avant si non utilisés pour la démo).
2. `/reload-plugins`.
3. `mnm.push_local_state`.
4. `mnm.launch_governed_workflow({ name: "feature-dev", params: { ticket_id: "FEAT-001", gitlab_project: "your-username/mnm-demo-app" } })`.
5. `mnm.launch_governed_step({ run_id, step_id: "tech-design", current_agents: <map des sha matérialisés>, session_tools: [...] })`.
6. Vérifier que la réponse contient `agent_name: "senior-dev"`, `subagent_type: "mnm--senior-dev"`, `prompt_context: { ticket_id: "FEAT-001" }`.
7. Stop ici. Le user (the maintainer) prendra le relais en M5 dimanche pour : Task() vers `mnm--senior-dev`, dérouler le step, valider la production de `design.md`, l'approval flow, complete_step, et au moins le step suivant `dev` (jusqu'à ouverture MR).

## 10. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Une fois M1 (retag repo) fait, le run actuel `55366762-...` (pinné sur l'ancien sha `f62339e96b...`) devient orphelin. | Acceptable — c'est un run de test foireux, on relance après M3. |
| L'archivage de `Dev`/`CAO`/`PM-internal-product`/`QA` casse les workflows non-démo qui les utilisent. | Vérifier que ces workflows ne sont pas dans la company `c26214de-...`, ou les laisser actifs si présents. |
| Le path `workflows/feature-dev/gates/...` change → le run actuel `feature-dev/v1.0.1` ne fonctionne plus. | C'est le but : on re-tag en `feature-dev/v1.0.2` après le déplacement. |
| Le fix `setupWorkspace` skip-on-404 masque des erreurs réelles. | Le log warn doit être structuré (companyId, agentName, tag, path) pour audit. |
| Le `paths` field peut être lu par d'anciennes installations qui n'ont pas le code updaté. | Pas un risque ici (single-tenant dev). En multi-tenant prod, deploy backend avant config_layer update. |
| `create_agent` étendu avec validation Git ralentit le tool. | Acceptable (un fetch HEAD GitLab par création). Cache shaCache déjà en place. |

## 11. Critères d'acceptation pour cette spec

1. La table `agents` a une colonne `archived_at` (à vérifier au début de l'implém).
2. Le test `feature-dev` step `tech-design` retourne le triplet `(agent_name, subagent_type, prompt_context)` sans `MISSING_TOOLS`, sans `AGENT_NOT_REGISTERED`, sans 401.
3. Tous les nouveaux helpers et erreurs ont un test rouge → vert.
4. `bun run typecheck` passe.
5. Aucun test existant ne régresse.

## 12. Suite

- `superpowers:writing-plans` pour décomposer cette spec en plan d'implémentation task-by-task.
- Le plan ciblera explicitement M1→M4. M5 reste manuel côté the maintainer dimanche matin.
