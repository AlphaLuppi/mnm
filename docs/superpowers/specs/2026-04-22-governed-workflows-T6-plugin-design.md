# T6 — MnM Claude Code Plugin (Bootstrap) + SessionStart Hook + Lazy Agent Materialization

**Date** : 2026-04-22
**Statut** : Design validé (Tom 2026-04-22), prêt pour writing-plans
**Auteurs** : Tom (cofondateur), Claude
**Context** : T6 du rollout Governed Workflows MVP. Remplace et précise la Section 5 de `2026-04-20-governed-workflows-mvp-design.md` qui date d'avant la découverte des plugins first-class de Claude Code.

---

## TL;DR

Le plugin MnM Claude Code est un **wrapper bootstrap minimal** (~100 lignes de config + un binaire). Il ne bundle **ni agents, ni skills, ni commandes**. Son seul rôle : enregistrer le MCP server MnM (avec OAuth 2.1) et exécuter un hook SessionStart local-only qui affiche un dashboard. Tous les artefacts dynamiques (agents, skills, MCPs tiers requis par les steps) sont matérialisés **à la demande** par le harness Claude Code via tool calls, sur instruction du MnM MCP server. Le point de sync est **`launchStep`** (self-correction via stale-agent detection), pas un preemptive sync.

---

## Contraintes dures découvertes côté Claude Code

1. **Plugin-shipped agents ne peuvent pas déclarer leurs propres MCP servers, hooks, ou permissionMode** (sécurité). Les MCPs se déclarent au niveau plugin dans `.mcp.json`.
2. **Plugin `settings.json` supporte uniquement les clés `agent` et `subagentStatusLine`** — impossible d'injecter des permissions/env/hooks globaux via le plugin.
3. **Files écrits dans `${CLAUDE_PLUGIN_ROOT}/` sont wipés à chaque update du plugin** (nouveau cache directory).
4. **`${CLAUDE_PLUGIN_DATA}/` persiste aux updates** mais `${CLAUDE_PLUGIN_DATA}` n'est pas substitué dans les path fields du manifest — uniquement dans hook commands / MCP configs / content.
5. **Paths in plugin manifest doivent être relatifs au plugin root et démarrer par `./`** ; pas de `..` traversal.
6. **Les hooks sont des subprocess lancés par Claude Code** ; ils n'ont **pas accès** aux tokens OAuth des MCP servers stockés par Claude Code (keychain OS scoped).
7. **Les agents plugins sont namespacés automatiquement** (`mnm:greeter`) ; les user-level agents (`~/.claude/agents/`) ne le sont pas (conflit de noms possible sans prefix manuel).
8. **`/reload-plugins` est une commande user-invoquée**, non déclenchable par un agent.
9. **Hot-reload empirique des `~/.claude/agents/*.md` écrits mid-session = INCONNU** — doit être validé par spike pendant T6.

---

## Architecture — Séparation des responsabilités

### Plugin MnM (statique, packagé, distribué)

Vit dans le monorepo MnM à `plugins/mnm/`. Publié vers un repo marketplace séparé (e.g. `mnm-platform/claude-plugins`) une fois stabilisé. Installé par les users via `/plugin install mnm@mnm-platform`.

```
plugins/mnm/
├── .claude-plugin/
│   └── plugin.json                  # metadata + userConfig (company_id, server_url)
├── .mcp.json                        # MnM HTTP MCP + oauth.authServerMetadataUrl
├── hooks/
│   └── hooks.json                   # SessionStart → bin/mnm-session-start
├── bin/
│   └── mnm-session-start            # binaire compilé (bun build) — hook handler
└── README.md                        # UX doc install + premier usage
```

**Contenu total** : ~100 lignes de config + ~150 lignes de code binary. C'est tout.

**Pas de `agents/`, pas de `skills/`, pas de `commands/`** dans le plugin. Ces artefacts sont matérialisés à la demande ailleurs (voir ci-dessous).

### MCP server MnM (déjà existant après T5, enrichi en T6)

Le serveur expose les 7 tools existants (`listWorkflows`, `getWorkflow`, `getWorkflowState`, `launchWorkflow`, `launchStep`, `completeStep`, `syncEnvironment`). T6 ajoute :

- **`setup_workspace({})`** — tool appelé par le harness lors de l'onboarding initial. Retourne la liste complète des agents à matérialiser côté user pour le company_id de l'actor, plus les instructions de placement (`~/.claude/agents/mnm--<name>.md`). Le harness écrit ces fichiers via son Write tool.
- **`launchStep` enrichi** — accepte un input additionnel `current_agents: Record<agent_name, sha>` + `session_tools: string[]`. Le gate entry évalue contre ces données ; si stale → retourne `{error_code: "agents_stale", stale_agents: [...]}` avec le contenu à jour à écrire localement.

### Artefacts dynamiques (user-scope)

Vivent sous `~/.claude/` (user home, survit aux updates plugin). Écrits par le harness via son Write/Bash tool, jamais par le plugin.

- **Agents** : `~/.claude/agents/mnm--<name>.md` (namespace manuel `mnm--` car pas de namespacing plugin-auto en user-scope).
- **Skills** (T7+) : `~/.claude/skills/mnm--<name>/SKILL.md`.
- **Commands** (T7+) : `~/.claude/commands/mnm--<name>.md`.
- **Third-party MCPs requis par un step** (gitnexus, sentry, etc.) : installés via `/plugin install <name>@<marketplace>` exécuté via Bash par le harness.

### Cache local persistent

Vit sous `${CLAUDE_PLUGIN_DATA}/` (résolu à `~/.claude/plugins/data/mnm-<marketplace>/`). Survit aux updates plugin.

- **`last-session.json`** : `{lastSyncedSha, syncedAt, agentNames: string[], pendingRuns: number, openIssues: number, lastPluginVersion: string}`. Écrit par le harness après chaque tool call significatif (via un petit helper MCP `push_local_state` qui retourne le payload à persister).

---

## Flow détaillé

### 1. Installation initiale du plugin

```
User: /plugin install mnm@mnm-platform
Claude Code:
  → télécharge le plugin dans ~/.claude/plugins/cache/<version>/mnm/
  → prompt userConfig: company_id (required, string), server_url (required, url)
  → les valeurs sont stockées dans ~/.claude/settings.json sous pluginConfigs[mnm-mnm-platform].options
  → enregistre le MCP server MnM (url = ${user_config.server_url}/mcp)
  → enregistre le hook SessionStart
User: restarte Claude Code (ou /reload-plugins)
```

### 2. Premier SessionStart post-install

```
Claude Code démarre la session
  → charge les MCP servers (MnM est listé mais pas encore authentifié)
  → exécute le hook SessionStart : bin/mnm-session-start
      Hook lit ${CLAUDE_PLUGIN_DATA}/last-session.json → ENOENT (premier run)
      Hook émet stdout JSON:
        {
          "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "MnM plugin v<version>. First run detected. To provision your workspace, ask: 'Set me up for MnM'."
          }
        }
      Exit 0
User (suit l'instruction): "Set me up for MnM"
Claude Code harness:
  → appelle mcp__mnm__setup_workspace()
      Premier appel → Claude Code déclenche le flow OAuth 2.1 (browser)
      User s'authentifie → token stocké dans le keychain OS
      Tool retourne: {agents: [{name: "mnm--greeter", content: "---\nname: mnm--greeter\n---\n...", sha: "abc"}, ...], instructions: "Write each agent to ~/.claude/agents/<name>.md"}
  → harness exécute Write pour chaque agent
  → harness appelle mcp__mnm__push_local_state({agentsProvisioned: [...], plugin_version: "<version>"})
      Tool retourne: {write_to: "${CLAUDE_PLUGIN_DATA}/last-session.json", content: {...}}
  → harness exécute Write sur le cache
  → harness affiche "MnM workspace provisioned. You may need to /reload-plugins to activate newly written agents."
```

### 3. Lancement d'un step (cas normal, agents à jour)

```
User: "Run the hello-world workflow"
Harness:
  → mcp__mnm__launchWorkflow({workflow_name: "hello-world"}) → {run_id}
  → mcp__mnm__launchStep({run_id, step_id: "greet", current_agents: {"mnm--greeter": "abc"}, session_tools: ["Write", "Read", "Task", ...]})
      Entry gate valide session_tools (OK), current_agents sha (OK)
      → {next_action: "dispatch", agent_name: "mnm--greeter", prompt: "Greet Tom warmly"}
  → Task(subagent_type: "mnm--greeter", prompt: "Greet Tom warmly") → response
  → mcp__mnm__completeStep({run_id, step_id: "greet", artifact: {greeting: "..."}})
      Exit gate évalue → pass
```

### 4. Lancement d'un step avec agent stale (self-correction)

```
Harness:
  → mcp__mnm__launchStep({run_id, step_id: "greet", current_agents: {"mnm--greeter": "abc"}})
      Server fetch l'agent depuis git → sha actuel = "def", pas "abc"
      → {error_code: "agents_stale", stale_agents: [{name: "mnm--greeter", content: "...", sha: "def"}]}
  → harness lit l'erreur → Write ~/.claude/agents/mnm--greeter.md avec le nouveau contenu
  → harness mcp__mnm__launchStep({..., current_agents: {"mnm--greeter": "def"}})
      → pass → dispatch
  → si /reload-plugins nécessaire pour picker up l'agent modifié : message user
```

### 5. Step requiert un MCP tiers absent (ex: gitnexus)

```
Harness:
  → mcp__mnm__launchStep({run_id, step_id: "review", session_tools: ["Write", "Task"], ...})
      Entry gate évalue requirements du step → requires "mcp__gitnexus__query" non présent
      → {error_code: "missing_tools", required: ["mcp__gitnexus__query"], hints: ["Run: /plugin install gitnexus@claude-plugins-official"]}
  → harness exécute Bash("claude plugin install gitnexus@claude-plugins-official")
  → harness prompt user: "gitnexus installed. Run /reload-plugins and retry"
  → user /reload-plugins
  → retry launchStep → pass
```

### 6. SessionStart ultérieur (cas normal)

```
Hook lit ${CLAUDE_PLUGIN_DATA}/last-session.json
  → {lastSyncedSha: "def", syncedAt: "2026-04-22T09:00Z", agentNames: ["mnm--greeter"], pendingRuns: 2, openIssues: 1, lastPluginVersion: "1.2.0"}
Hook compare lastPluginVersion au version actuel (lu depuis ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json)
Hook émet additionalContext:
  "MnM: 2 workflows in progress, 1 issue needs attention. Last sync 3h ago. Plugin v1.2.0."
```

---

## Choix techniques détaillés

### plugin.json

```json
{
  "name": "mnm",
  "version": "0.1.0",
  "description": "MnM Governed Workflows — supervise AI agent orchestration",
  "author": {"name": "MnM Platform"},
  "homepage": "https://mnm.example",
  "userConfig": {
    "company_id": {
      "type": "string",
      "title": "Company ID",
      "description": "Your MnM company UUID. Get this from your MnM admin dashboard.",
      "required": true
    },
    "server_url": {
      "type": "string",
      "title": "MnM server URL",
      "description": "Base URL of your MnM deployment (e.g. https://mnm.acme.com)",
      "required": true
    }
  }
}
```

Pas de `auth_token` : l'auth est gérée entièrement par OAuth 2.1 via Claude Code natif.

### .mcp.json

```json
{
  "mcpServers": {
    "mnm": {
      "type": "http",
      "url": "${user_config.server_url}/mcp",
      "oauth": {
        "authServerMetadataUrl": "${user_config.server_url}/.well-known/oauth-authorization-server"
      }
    }
  }
}
```

Le serveur MnM expose déjà `/mcp` (Streamable HTTP) + OAuth router (T5). Claude Code gère la browser flow automatiquement.

### hooks/hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/mnm-session-start",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Matcher `startup` uniquement (pas `resume`/`compact`/`clear` — on ne veut pas re-afficher le dashboard à chaque compaction).

### bin/mnm-session-start

Bun-compiled executable. Source TS dans `packages/mnm-plugin/src/session-start.ts`. Build step copie le binaire dans `plugins/mnm/bin/` à la publication.

Comportement (pseudo-code) :

```ts
const dataDir = process.env.CLAUDE_PLUGIN_DATA;
const rootDir = process.env.CLAUDE_PLUGIN_ROOT;
const statePath = path.join(dataDir, "last-session.json");
const manifestPath = path.join(rootDir, ".claude-plugin", "plugin.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const currentVersion = manifest.version;

let state: LastSession | null = null;
try {
  state = JSON.parse(await fs.readFile(statePath, "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

const ctx = state === null
  ? `MnM plugin v${currentVersion}. First run detected. To provision your workspace, ask: "Set me up for MnM".`
  : formatDashboard(state, currentVersion);

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ctx,
  },
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
```

- Pas de réseau.
- Pas d'auth.
- Timeout implicite ≤ 5s (config ci-dessus).
- Graceful si le cache est corrompu ou manquant.

### Monorepo layout (sources)

```
mnm/                                # monorepo racine
├── plugins/
│   └── mnm/                        # plugin Claude Code prêt à distribuer (gitté)
│       ├── .claude-plugin/plugin.json
│       ├── .mcp.json
│       ├── hooks/hooks.json
│       ├── bin/
│       │   └── mnm-session-start   # binaire compilé, commité (petit)
│       └── README.md
└── packages/
    └── mnm-plugin/                 # source TS du binaire + tests
        ├── package.json
        ├── src/
        │   ├── session-start.ts    # le binaire
        │   └── types.ts
        ├── __tests__/
        │   └── session-start.test.ts
        ├── esbuild.config.mjs
        └── tsconfig.json
```

Le script build de `packages/mnm-plugin/` produit `plugins/mnm/bin/mnm-session-start` (bundle esbuild + shebang). Rebuild déclenché par `bun run build` à la racine.

### Écriture atomique cross-platform

Pour les writes de `last-session.json` et des agents `.md` par le harness :

- Pattern : write to `<target>.tmp` puis `fs.rename(<target>.tmp, <target>)`.
- Node's `fs.rename` utilise `MoveFileEx` sur Windows avec `REPLACE_EXISTING` flag → atomique si le dest n'est pas ouvert par un autre process.
- Pour nos fichiers (agents et cache JSON) : jamais ouverts concurrent → safe.
- Helper util dans `packages/mnm-plugin/src/atomic-write.ts` exposé (testé).

### Tests

Vitest dans `packages/mnm-plugin/__tests__/` :

1. **`session-start.test.ts`** :
   - First-run ENOENT → outputs "First run detected" message.
   - Valid state file → outputs dashboard with pending runs / issues / version.
   - Corrupted JSON → graceful fallback to first-run message.
   - Manifest unreadable → exit 0 with empty context (fail-open, never break session).
   - Writes valid JSON to stdout (no extra chars).

2. **`atomic-write.test.ts`** :
   - Write new file → content matches.
   - Overwrite existing → no intermediate state visible.
   - `.tmp` file cleaned up on success.

### Spike : hot-reload empirique

**Task dédiée en début de T6** (`T6-spike-hot-reload`) :

1. Écrire un agent test dans `~/.claude/agents/mnm-spike-<ts>.md` avec frontmatter valide.
2. Depuis une session Claude Code **déjà en cours**, tenter `Task(subagent_type: "mnm-spike-<ts>", prompt: "say hi")`.
3. Observer : succès ? échec "agent not found" ?
4. Si échec, essayer un `/reload-plugins` puis retry. Observer.
5. Documenter le résultat dans `docs/superpowers/specs/T6-hot-reload-spike-result.md`.
6. Déterminer la bonne UX :
   - Si hot-reload fonctionne silencieusement → agents matérialisables en live, aucune friction.
   - Si besoin de `/reload-plugins` → harness affiche "Run /reload-plugins then retry" après un Write d'agent.
   - Si besoin de restart complet → on adopte le pattern "dispatch inline" (Task avec `subagent_type: "general-purpose"` + prompt qui assume la persona de l'agent).

Le résultat du spike conditionne la stratégie de dispatch d'agents en T6. Si pessimiste, on ne bloque pas T6 — le hello-world peut toujours être testé avec des agents pré-matérialisés avant la session (via `setup_workspace` en bootstrap).

---

## Scope T6 (ce qui DOIT être livré)

1. **Package `packages/mnm-plugin/`** : source TS + tests vitest + build esbuild → binaire.
2. **Plugin `plugins/mnm/`** : manifest + .mcp.json + hooks.json + binaire compilé + README.
3. **Endpoints serveur additionnels** :
   - Tool MCP `setup_workspace` (dans `server/src/mcp/tools/governed-workflows.tool.ts`) qui retourne la liste complète des agents à matérialiser pour le company_id de l'actor.
   - Tool MCP `push_local_state` qui retourne le payload à persister dans `${CLAUDE_PLUGIN_DATA}/last-session.json`.
4. **Enrichissement `launchStep`** : accepte `current_agents` + `session_tools` en input ; gate entry retourne `agents_stale` / `missing_tools` avec hints si mismatch.
5. **Service layer** : `governed-workflows.ts` extended avec `setupWorkspace({companyId})` et `pushLocalState({companyId, ...})`.
6. **Tests unitaires** des 2 nouveaux tools + du binaire hook.
7. **Test E2E** : bootstrap workspace + run hello-world step avec agent matérialisé à la demande (mock harness via vitest).
8. **Spike hot-reload** (task dédiée, résultat documenté).
9. **OAuth discovery endpoint** : vérifier que `/​.well-known/oauth-authorization-server` est bien exposé par le serveur MnM (T5 avait `mcp-oauth-router.ts` mais discovery endpoint à confirmer).
10. **README plugin** : quickstart, userConfig setup, onboarding UX.
11. **Update spec §5** et `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` pour référencer cette spec T6.

## Out of scope (T7+)

- Installation automatique de MCPs tiers via `/plugin install` (harness le fait manuellement en T6 avec guidance).
- Skills et commands dynamiques (`~/.claude/skills/mnm--*`, `~/.claude/commands/mnm--*`).
- Hooks additionnels ajoutés dynamiquement à `~/.claude/settings.json` (pas besoin pour hello-world).
- Bearer token fallback (OAuth suffit pour le MVP).
- Enterprise managed-settings force-enable.
- Marketplace repo séparé : T6 reste dans le monorepo, on publie vers `mnm-platform/claude-plugins` post-MVP.

## Follow-ups T5 à adresser en T6

- **T5-DEF-1** : `mergeAgentConfig` actuellement stub → doit être wiré dans `setupWorkspace` pour retourner les vrais agents mergés par layers.
- **T5-DEF-2** : `syncEnvironment.changelog` non peuplé → utile pour le dashboard session start, mais pas critique en T6 (hook peut affichier juste le sha delta).
- **T5-DEF-7** : audit emit sur transitions governed-workflow — reportable T7 sauf si requis par un gate du hello-world.

---

## Leçons process T5 à appliquer

1. **Pre-flight schema DB** : valider les noms de colonnes via `packages/db/src/schema/` AVANT de coder des raw SQL. Spécifiquement : champs utilisés par `setup_workspace` et `push_local_state`.
2. **Plan comments are contract** : copier JSDoc/comments verbatim du plan dans l'implémentation.
3. **issue_prefix unique** : préfixe `T6HL` pour toute suite de tests qui insère des companies + `ON CONFLICT (id) DO NOTHING`.
4. **compiledCache shas distincts** par fixture.
5. **Stall silencieux tardif** : si exécution via team + un agent stalle 2x consécutif post-ship → `shutdown_request`.
6. **DB credentials tests** : `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test`.
7. **ivm timeout = wall-clock via Promise.race**, pas CPU-time isolated-vm (pour les gates si testés en T6).
8. **ShaCache API** : `get(sha, path)` / `set(sha, path, value)`, pas `getOrFetch`.

---

## Critères de succès T6

- [ ] `bun run typecheck` passe sur l'ensemble du monorepo (13+ packages).
- [ ] `packages/mnm-plugin/` tests vitest verts.
- [ ] E2E test bootstrap + hello-world step avec stale-correction passe.
- [ ] Plugin installable localement via `claude --plugin-dir ./plugins/mnm` et le hook SessionStart émet bien un `additionalContext` visible dans la session.
- [ ] Spike hot-reload exécuté et résultat documenté.
- [ ] Commits atomiques + push sur master (pas de commits en local non pushés).
- [ ] Spec §5 parent (2026-04-20-governed-workflows-mvp-design.md) mise à jour pour référencer cette spec.
- [ ] Completion report en bas du plan.
- [ ] Prompt next-session pour T7 rédigé.
