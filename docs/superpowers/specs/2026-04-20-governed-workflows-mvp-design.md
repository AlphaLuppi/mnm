# Governed Workflows — MVP Implementation Design

**Date** : 2026-04-20
**Statut** : Design validé section par section, prêt pour writing-plans
**Auteurs** : Tom (cofondateur), Claude
**Objectif** : spécification technique pour l'implémentation MVP des Governed Workflows, avec hello-world comme premier workflow test.

---

## Sources et contexte

- **Design consolidé** (vision) : `_bmad-output/governed-workflows-consolidated-2026-04-17.md`
- **Récap session 1 abandonnée** : `_bmad-output/brainstorming/implementation-governed-workflows-session-2026-04-20.md`
- **Récap session 2 (brainstorm)** : `_bmad-output/brainstorming/implementation-governed-workflows-2026-04-20-session2.md`

Ce document **consolide** la session 2 de brainstorm après adversarial review, et présente une spec implémentable en 7 tranches testables.

---

## Décisions actées (fondations)

### Gates et exécution

1. **Gates = fichiers TS custom** dans le repo du workflow. Peuvent être de tout type (déterministe, LLM-as-judge, check contextuel des tool_calls de la session user, etc.).
2. **Exécution des gates = serveur-side, sandboxé** (isolated-vm). Jamais envoyées au client.
3. **Composition via nested arrays** (outer=séquence, inner=parallèle). Chaque item de gate peut porter une `config` paramétrée passée au `GateContext`. Pas de `_shared/` cross-workflow en MVP.
4. **MVP = types `entry` + `exit` uniquement.** Archi extensible : `gate_results.kind` en text, gate runner agnostique au kind, JSON schema ouvert. Ajouter un type futur (`on-failure`, `on-success`, `mid`, `pre-skip`, `post-run`) = **un seul nouveau hook orchestrateur** — zéro migration DB, zéro changement runner.

### Format et structure

5. **Workflow = JSON déclaratif** (data pure, UI-editable future).
6. **Agent = format Anthropic standard** (`.md` + YAML frontmatter Claude Code natif).
7. **Config layers = entités DB attachées aux agents** (réutilise `config_layer_items` existant, migration 0054). Priority-merged.

### Versioning et repos

8. **Versioning git pour tout contenu** : workflows, gates TS, agents `.md`, config layers JSON. DB = metadata + pointers git. **Pas de cache parsé en DB** — fetch on-demand + cache in-memory keyed par `git_sha` (immutable).
9. **Structure MVP = 2 repos par company** : `mnm-<company>-workflows`, `mnm-<company>-agents`. Config layers **co-localisés avec l'agent** dans un sous-dossier `config/`. Skills reportés.
10. **Tags git protégés + semantic release** → `{git_tag, git_sha}` suffit comme ref immutable. Pas de snapshot DB redondant.

### Plugin Claude Code et écriture locale

11. **Plugin Claude Code ultra-minimaliste** : config MCP + hook SessionStart uniquement.
12. **Écriture user-level `~/.claude/` avec namespacing `mnm--*`**. Pas project-level.
13. **Cache staging `~/.mnm/cache/<company>/`** — sync depuis MnM, puis application atomique dans `~/.claude/`.

### Secrets

14. **User saisit lui-même pour MVP**. MnM ne pousse jamais de secrets. MCP détecte l'absence et guide.

### Périmètre MVP

15. **Hello-world = β (full pipe avec sub-agent)** : 2 steps, dont au moins 1 lance un sub-agent via Task tool. Gates TS sandboxé + cache client + sync SessionStart, tous testés.
16. **Multi-company dès l'archi** (path-scoped, RLS), mais MVP single-company (`companyId="default"`).

### Reporté post-MVP (acté)

- `governed_action_registry` (enforcement action → workflow requis)
- Composition cross-workflow (`uses: workflows/x@v2.1`) si besoin
- Tag-based visibility sur workflows
- Nightly Synthesis (`synthesis_snapshots`, `synthesis_proposals`)
- `artifacts` blob table (escape hatch >1MB)
- `agent_markdown_revisions` (git tags suffisent)
- Skills versionnés
- UI création/édition workflows
- HITL (`approveStep`), retry/cancel
- Webhooks externes
- A/B testing, emergency bypass, CAO méta-juge

---

## Section 1 — Architecture globale

### 3 plans

```
┌─────────────────────────────────────────────────────────────┐
│ POSTE USER                                                  │
│                                                             │
│  Claude Code (harness) ──► MCP MnM (stdio)                  │
│       │                         │                           │
│       ▼                         │                           │
│  ~/.claude/ (agents, mcp,       │                           │
│    settings, hooks) avec        │                           │
│    namespacing mnm--*           │                           │
│                                 │                           │
│  ~/.mnm/cache/<company>/...     │                           │
│    (staging avant copie)        │                           │
└─────────────────────────────────┼───────────────────────────┘
                                  │ HTTPS + auth
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVEUR MnM                                                 │
│                                                             │
│  MCP tools ─► Gate Runner (isolated-vm) ─► DB (PG + RLS)    │
│                     │                             │         │
│                     └──────► Git Provider ───────┤          │
│                              (GitlabProvider)     │         │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ GitLab CBA       │
                                          │ - workflows repo │
                                          │ - agents repo    │
                                          └──────────────────┘
```

### Rôles

- **Poste user** : Claude Code exécute les sub-agents (compute client-side). Cache staging MnM + copie finale dans `~/.claude/`. Hook SessionStart sync.
- **Serveur MnM** : control plane. Gate Runner eval les gates TS dans isolated-vm. Git Provider pull workflow.json / gates / agents depuis GitLab, cache in-memory par sha.
- **GitLab CBA** : source de vérité. 2 repos par company. MnM commit au nom de l'user (author) avec son token bot.

### Flow d'un step typique

1. Harness → `launchStep(runId, step-1)` → MCP
2. Serveur eval entry gate (isolated-vm) → OK → retourne `{agent, prompt_context, subagent_type}`
3. Harness → `Task(subagent_type: "mnm--greeter")` (le `.md` est déjà dans `~/.claude/agents/`)
4. Sub-agent produit artifact
5. Harness → `completeStep(runId, step-1, artifact)` → MCP
6. Serveur eval exit gate → OK → run passe au step suivant

---

## Section 2 — Data model

### 4 nouvelles tables (avec `company_id` + RLS + actor model)

#### `governed_workflow_definitions` (metadata only, pas de parsed_json)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid NOT NULL | RLS via `app.current_company_id` |
| `name` | text NOT NULL | `hello-world` |
| `description` | text | |
| `latest_git_tag` | text | mis à jour via webhook post-commit |
| `enabled` | boolean default true | |
| `created_at`, `updated_at` | timestamptz | |
| UNIQUE | `(company_id, name)` | |

#### `governed_workflow_runs`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid NOT NULL | RLS |
| `workflow_def_id` | uuid FK | |
| `workflow_git_tag` | text NOT NULL | ref immutable au moment du trigger |
| `workflow_git_sha` | text NOT NULL | |
| `initiated_by_actor_type` | text | `AuditActorType` : user/agent/system/system-nightly |
| `initiated_by_actor_id` | text | |
| `status` | `governed_run_status` pg enum | `draft/active/completed/failed` |
| `started_at`, `completed_at` | timestamptz | |
| `params_json` | jsonb | variables du run |

#### `governed_step_executions`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid NOT NULL | RLS |
| `run_id` | uuid FK | |
| `step_id_in_json` | text | identifiant du step dans workflow.json |
| `state` | `governed_step_state` pg enum | `pending/running/gate_eval/succeeded/failed` |
| `started_at`, `completed_at` | timestamptz | |
| `artifacts_json` | jsonb | artifact produit par le step |
| `launched_by_actor_type` | text | |
| `launched_by_actor_id` | text | |

#### `gate_results`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid NOT NULL | RLS |
| `run_id` | uuid FK | |
| `step_exec_id` | uuid FK | |
| `gate_id_in_json` | text | |
| `kind` | text | `entry/exit` en MVP (text, pas pg enum, pour extensibilité sans migration — cf. Contraintes) |
| `pass` | boolean | |
| `report` | text | explication lisible |
| `error_code` | text | si fail |
| `hints` | text[] | guidance pour le harness |
| `gate_git_sha` | text NOT NULL | ref exact du fichier TS qui a évalué |
| `evaluated_at` | timestamptz | |

### Tables existantes réutilisées (sans schema change majeur)

- **`agents`** — ajouter si absent : `latest_git_tag`, `enabled`. Pas de `markdown_content` (vit dans git).
- **`config_layer_items`** — ajouter nouveaux `item_type` values : `mcp_server`, `hook`, `setting`, `env_ref`. **Aucune modif structurelle** — on réutilise le pattern existant (migration 0054 — priority merge déjà impl).

### Contraintes systémiques

- RLS policies identiques pattern migration 0030 (`USING company_id = current_setting('app.current_company_id')::uuid`)
- `status` / `state` = pg enums, pas strings libres
- **`gate_results.kind` = text** (pas pg enum) + index + validation au runtime. Raison : extensibilité — ajouter un type de gate (`on-failure`, `on-success`, `mid`, ...) ne doit PAS nécessiter une migration `ALTER TYPE ADD VALUE`.
- Advisory locks (`pg_advisory_xact_lock`) sur `launchWorkflow` (pattern MnM existant)
- `hints` → `text[]` (matche le contract `hints?: string[]`)

### Fetch-on-demand (pas de sync DB↔git)

- Serveur : `loadWorkflowAtSha(name, git_sha)` → cache in-memory → si miss, fetch via GitProvider → parse → cache indefiniment (sha immutable)
- Idem `loadAgentAtSha(name, git_sha)`, `loadGateAtSha(workflow_name, gate_path, git_sha)`
- Webhook GitLab post-commit (optionnel) → update `latest_git_tag` async

---

## Section 3 — Repo structure git + hello-world files

### Arborescence complète MVP

```
mnm-acme-workflows/                       (repo git)
├── .gitlab-ci.yml                        (lint gates TS)
├── package.json                          (deps: @mnm/governed-workflows)
└── hello-world/
    ├── workflow.json
    └── gates/
        ├── greet-exit.gate.ts
        └── shout-exit.gate.ts

mnm-acme-agents/                          (repo git)
├── greeter/
│   ├── agent.md
│   └── config/
│       └── default.json
└── shouter/
    ├── agent.md
    └── config/
        └── default.json
```

### `hello-world/workflow.json`

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "hello-world",
  "description": "Demo MVP — 2 steps, sub-agents + gates TS",
  "variables": {
    "name": { "type": "string", "required": true }
  },
  "steps": [
    {
      "id": "greet",
      "deps": [],
      "agent": "greeter",
      "prompt_context": { "name": "{{variables.name}}" },
      "gates": {
        "exit": [
          { "id": "greeting-ok", "source": "./gates/greet-exit.gate.ts" }
        ]
      }
    },
    {
      "id": "shout",
      "deps": ["greet"],
      "agent": "shouter",
      "prompt_context": { "greeting": "{{steps.greet.artifact.greeting}}" },
      "gates": {
        "exit": [
          { "id": "uppercase-ok", "source": "./gates/shout-exit.gate.ts" }
        ]
      }
    }
  ]
}
```

### Composition de gates — nested arrays (syntaxe supportée dès MVP)

Chaque type de gate (`entry`, `exit`, ... extensibles) contient un array qui compose **séquentiel × parallèle** via imbrication :

- **Outer array** = exécuté en **séquence**
- **Inner array** = exécuté en **parallèle** (race, fail-fast)
- **Item objet seul** = un seul item, trivialement séquentiel

Exemple générique (un step avec gates exit composées) :

```json
"gates": {
  "exit": [
    [
      { "id": "format-check", "source": "./gates/format.gate.ts" },
      { "id": "schema-check", "source": "./gates/schema.gate.ts" }
    ],
    { "id": "semantic-check", "source": "./gates/semantic.gate.ts" },
    [
      { "id": "cost-audit",     "source": "./gates/cost.gate.ts" },
      { "id": "security-audit", "source": "./gates/sec.gate.ts" }
    ]
  ]
}
```

→ D'abord `format-check` ET `schema-check` en parallèle. Si pass, `semantic-check`. Si pass, `cost-audit` ET `security-audit` en parallèle.

**Config paramétrée** (composition réutilisable au sein d'un workflow) — chaque item de gate peut porter un `config` passé au `GateContext` :

```json
{ "id": "has-greeting", "source": "./gates/has-field.gate.ts", "config": { "field": "greeting", "type": "string" } }
```

### Types de gates — entry + exit en MVP, archi extensible

MVP implémente uniquement `entry` (avant `launchStep`) et `exit` (après `completeStep`). L'archi permet d'ajouter sans rework :
- `on-failure` (step failed)
- `on-success` (step succeeded, avant unlock deps)
- `mid` (heartbeat pendant exécution)
- `pre-skip` (avant de décider de skipper)
- `post-run` (niveau workflow entier, fin)

**Stratégie extensibilité** :
- `gate_results.kind` en **text** → ajouter un type = aucune migration DB
- Gate runner **générique** (ne connaît pas `entry` vs `exit`, prend un `GateBlock` et retourne un verdict) — ajouter un type = zéro changement runner
- Orchestrateur (couche MCP/serveur) **hardcode** les hooks lifecycle pour MVP (`launchStep` → entry, `completeStep` → exit) — ajouter un type = **nouveau hook dans l'orchestrateur uniquement**
- JSON schema workflow.json autorise `additionalProperties: true` sur `gates.*` — types inconnus ne cassent pas le parse, warning "gate kind 'xxx' unknown, ignored" si pas de hook

### `hello-world/gates/greet-exit.gate.ts`

```typescript
import { defineGate } from "@mnm/governed-workflows";

export default defineGate(async (ctx) => {
  const artifact = ctx.artifact as { greeting?: unknown } | undefined;
  if (!artifact || typeof artifact.greeting !== "string") {
    return {
      pass: false,
      report: "Expected artifact.greeting as string",
      error_code: "MISSING_GREETING",
      hints: ["Return {greeting: 'Hello <name>'} from the greeter sub-agent"]
    };
  }
  return { pass: true, report: `Greeting ok: "${artifact.greeting}"` };
});
```

### `agents/greeter/agent.md`

```markdown
---
name: mnm--greeter
description: Generate a warm greeting from a name
tools: [Write]
model: haiku
---

You receive `{name}` in your prompt context.
Produce a JSON artifact: `{"greeting": "Hello, <name>!"}` and return it as your result.
Nothing else — just the JSON.
```

### `agents/greeter/config/default.json`

```json
{
  "name": "default",
  "priority": 500,
  "items": []
}
```

→ `items: []` car hello-world n'a pas besoin de MCP/hooks/settings custom.

### Conventions

- **Source gate** = chemin relatif depuis `workflow.json`. Serveur résout contre le repo fetch.
- **Config gate** (optionnel) = objet passé au `GateContext.config` au runtime. Permet à une gate générique (ex: `has-field.gate.ts`) d'être paramétrée par le workflow. Pas de `_shared/` cross-workflow en MVP — chaque gate reste dans `./gates/` de son workflow.
- **Prompt context** avec interpolation `{{steps.greet.artifact.greeting}}` : serveur expose la valeur au harness dans `launchStep`, harness la passe au sub-agent.
- **Agent name = `mnm--greeter`** dans le frontmatter → fichier écrit en `~/.claude/agents/mnm--greeter.md`.

---

## Section 4 — MCP tools pour MVP (7 primitives)

### Discovery (compact, token-safe)

| Tool | Input | Output (~tokens) | Rôle |
|---|---|---|---|
| `listWorkflows` | `{ enabled?: boolean }` | `[{name, description, latest_git_tag}]` (~200) | Liste workflows dispo |
| `getWorkflow` | `{ name, git_tag? }` | parsed JSON + meta (~500) | Détail à un tag donné |
| `getWorkflowState` | `{ runId }` | `{status, steps:[{id,state,artifact_ok}], last_gate_result}` (~300) | État d'une run |

### Exécution

| Tool | Input | Comportement serveur |
|---|---|---|
| `launchWorkflow` | `{ name, git_tag?, params }` | Insert `runs` + N `step_executions` (pending). Retourne `{runId, firstStep}` |
| `launchStep` | `{ runId, stepId }` | (a) Vérifie deps OK (b) Eval entry gate si définie (c) Retourne `{agent_name, prompt_context, subagent_type}` |
| `completeStep` | `{ runId, stepId, artifact }` | (a) Eval exit gate sandboxé (b) Si pass → succeeded + unlock deps (c) Si fail → `error_code` + hints |

### Sync

| Tool | Input | Comportement |
|---|---|---|
| `syncEnvironment` | `{ lastSyncedSha? }` | Retourne `{agents:[{name, md_content, config_merged}], changelog, newSha}`. Hook écrit dans `~/.mnm/cache/<company>/` puis applique dans `~/.claude/` |

### Contrat d'erreur uniforme

```json
{
  "isError": true,
  "error_code": "WORKFLOW_DEPENDENCY_UNMET",
  "message": "Cannot launch 'shout': missing 'greet'. Call getWorkflow('hello-world') for DAG.",
  "hints": ["Start with the first step", "Check getWorkflowState"]
}
```

Tout le "quoi faire" vit dans `message` + `hints`. Le harness lit et agit.

### Non exposé au client

- Eval des gates TS (sandbox serveur-only)
- Git provider calls directs (tout passe par les tools ci-dessus)
- DB writes directs

### Post-MVP

`approveStep`, `cancelRun`, `retryStep`, `listRuns`, `createWorkflow`, webhooks.

---

## Section 5 — Sync côté user (hook SessionStart)

### Layout filesystem

```
~/.mnm/                              (owned par MnM)
├── config.json                      ({server_url, user_token, company_id})
├── cache/
│   └── acme/                        (= company_id)
│       ├── last-sync.json           ({sha, date, agents_count})
│       ├── agents-staging/
│       └── settings-staging/
└── logs/
    └── session-start-<ts>.log

~/.claude/                           (owned par user, MnM écrit uniquement mnm--*)
├── agents/
│   ├── mnm--greeter.md              (managed)
│   ├── mnm--shouter.md              (managed)
│   └── my-personal-agent.md         (user, preserved)
├── mcp.json                         (MERGE : servers mnm-- ajoutés)
├── settings.json                    (MERGE : hooks/perms mnm/ ajoutés)
└── .mnm-managed.json                (tracking de ce que MnM possède)
```

### `.mnm-managed.json`

```json
{
  "managed_at": "2026-04-20T10:30:00Z",
  "last_synced_sha": "abc123...",
  "agents": ["mnm--greeter", "mnm--shouter"],
  "mcp_servers": ["mnm--gitnexus"],
  "hooks": ["mnm/on-step-complete"],
  "settings_keys": ["permissions.mnm--*"],
  "required_secrets": ["MNM_GITNEXUS_TOKEN"]
}
```

### Flow du hook SessionStart

1. Read `~/.mnm/config.json` + `last-sync.json`
2. Call MCP `syncEnvironment({ lastSyncedSha })`
3. Si même sha : exit silent
4. Si changes : affiche changelog à l'user
   ```
   MnM sync available (abc → def)
     + 1 new agent : mnm--reviewer
     ~ 1 agent updated : mnm--greeter
     + 1 MCP server : mnm--sentry (requiert MNM_SENTRY_DSN)
   Accept? [y/n/diff]
   ```
5. Si `y` : écrit staging → diff → apply atomique (write-temp → rename) → update managed.json + last-sync.json
6. Si `n` : exit, re-proposé prochain SessionStart

### Merge strategy non-destructif

- **Fichiers MnM-only** (`agents/mnm--*.md`) : overwrite
- **Fichiers merged** (`mcp.json`, `settings.json`) : ajoute/update uniquement clés préfixées `mnm--` ou `mnm/`. Clés user jamais touchées.
- **Conflit** (user a une clé `mnm--X` manuelle) : warn + ask arbitration

### Secrets

- MnM pousse jamais de secrets. `mcp.json` contient des refs : `"env": { "SENTRY_DSN": "${MNM_SENTRY_DSN}" }`
- Hook vérifie présence des `required_secrets` dans env. Si manquant : warn avec instruction

---

## Section 6 — Gate sandbox (trust model)

### Stack

| Layer | Choix | Raison |
|---|---|---|
| Sandbox | `isolated-vm` (npm) | Vraie isolation V8, memory limit, timeout natif |
| Compile TS | `esbuild` au runtime | Compile `.gate.ts` → JS standalone, bundle `@mnm/governed-workflows` |
| Cache compilé | keyed par `git_sha` | Immutable → cache éternel RAM + disk |

### Flow d'éval (une gate unique)

```
1. Serveur reçoit un lifecycle hook (ex: completeStep → exit block)
2. Lookup gate source : git fetch ./gates/xxx.gate.ts à git_sha pinné du run
3. Cache hit ? → load compiled JS
   Cache miss ? → esbuild compile + cache par sha
4. Spawn isolated-vm context (frais)
5. Inject ctx: { artifact, run, step, config, helpers }
6. Run compiled JS avec timeout 5s + memory 256MB
7. Valide output contre schema { pass, report, error_code?, hints?[] }
8. Écrit gate_result (kind="exit") + retourne verdict
```

### Runner générique — exécution d'un GateBlock (DAG interne)

Le `runGateBlock(block, ctx, kind)` est **agnostique au `kind`** ("entry", "exit", ou futur type). Il prend un bloc avec sa composition nested-arrays et l'exécute :

```typescript
type GateItem = { id: string; source: string; config?: Record<string, unknown> };
type GateBlock = Array<GateItem | GateItem[]>;
//                       ↑             ↑
//                  sequential      parallel (inner array)

async function runGateBlock(
  block: GateBlock,
  ctx: GateContextBase,
  kind: string              // juste pour le log + gate_result.kind
): Promise<GateBlockResult> {
  for (const entry of block) {
    if (Array.isArray(entry)) {
      // Inner array = parallel, fail-fast
      const results = await Promise.race([
        Promise.all(entry.map(g => evalSingleGate(g, ctx, kind))),
        firstFailOf(entry.map(g => evalSingleGate(g, ctx, kind)))
      ]);
      if (results.some(r => !r.pass)) return aggregatedFail(results);
    } else {
      // Single item = sequential
      const r = await evalSingleGate(entry, ctx, kind);
      if (!r.pass) return { pass: false, gate_results: [...collected, r] };
    }
  }
  return { pass: true, gate_results: collected };
}
```

Le runner est **unique pour tous les types de gates**. Ajouter `on-failure` plus tard = ajouter un hook dans l'orchestrateur qui appelle `runGateBlock(step.gates["on-failure"], ctx, "on-failure")`.

### Contexte exposé (read-only)

```typescript
interface GateContext {
  artifact: unknown;                    // du completeStep (undefined pour entry)
  run: {
    id: string;
    workflow_name: string;
    git_tag: string;
    params: Record<string, unknown>;
  };
  step: {
    id: string;
    previous_artifacts: Record<string, unknown>;
  };
  config: Record<string, unknown>;      // ← config passé depuis workflow.json gate item
  kind: string;                         // ← "entry" | "exit" | futur type
  helpers: {
    queryTraces: (filter) => Promise<Trace[]>;
    checkWorkflowExists: (name) => Promise<boolean>;
    // Aucun write. Aucun accès DB direct.
  };
}
```

### Limites sandbox

- Timeout : 5s/gate
- Memory : 256MB
- Réseau : 0 fetch. Helpers exposés si proxying nécessaire.
- FS : 0 accès
- Imports runtime : pas de `require`/`import` dynamique (bundle-at-compile)
- `process`/`child_process`/`eval` : bloqués

### Trust model

Gates = semi-trusted (écrites par leads, reviewed via MR GitLab). Sandbox prévient :
- Crash qui tue le serveur
- Infinite-loop qui bloque le runner
- Leaks cross-tenant (pas d'accès DB direct)

Garde-fous externes :
- Git commits signés (semantic release)
- Review MR obligatoire
- Audit log : chaque `gate_result` avec `gate_git_sha` → rollback ciblé
- CAO monitoring (post-MVP)

### Erreurs — fail-closed

| Cas | Comportement |
|---|---|
| Timeout | `pass:false, error_code:GATE_TIMEOUT` |
| Exception TS | `pass:false, error_code:GATE_EXCEPTION` |
| Output schema invalide | `pass:false, error_code:GATE_INVALID_OUTPUT` |
| Sandbox crash | retry 1× puis `pass:false, error_code:GATE_SANDBOX_CRASH` |

Le harness voit toujours un verdict structuré, jamais un 500.

---

## Section 7 — Hello-world E2E + découpage en tranches

### Flow E2E (19 étapes)

```
User : "lance hello-world avec name=Tom"
├─ (1)  Harness → launchWorkflow("hello-world", {name:"Tom"})
├─ (2)  Serveur : crée run + step_executions (greet pending, shout pending)
├─ (3)  Retourne {runId, firstStep:"greet"}
├─ (4)  Harness → launchStep(runId, "greet")
├─ (5)  Serveur : pas d'entry gate, retourne {agent:"greeter", ctx:{name:"Tom"}}
├─ (6)  Harness → Task(subagent_type:"mnm--greeter", ...)
├─ (7)  Sub-agent produit {greeting:"Hello, Tom!"}
├─ (8)  Harness → completeStep(runId, "greet", {greeting:"Hello, Tom!"})
├─ (9)  Serveur : eval exit gate → pass
├─ (10) step greet=succeeded, unlock shout
├─ (11) Harness → launchStep(runId, "shout")
├─ (12) Serveur : retourne {agent:"shouter", ctx:{greeting:"Hello, Tom!"}}
├─ (13) Harness → Task(subagent_type:"mnm--shouter", ...)
├─ (14) Sub-agent produit {shouted:"HELLO, TOM!"}
├─ (15) Harness → completeStep(runId, "shout", {shouted:"HELLO, TOM!"})
├─ (16) Serveur : eval exit gate → pass
├─ (17) step shout=succeeded, run=completed
└─ (18) Harness affiche "Done: HELLO, TOM!"
```

### Tranches d'implémentation (7 PRs indépendants)

| # | Statut | Tranche | Livre | Test de validation |
|---|---|---|---|---|
| **T1** | ✅ shipped 2026-04-21 (`fb028ae..1c483e1`) | Package `@mnm/governed-workflows` (types + zod + `defineGate<Config>`, `defineWorkflow`) — inclut **type `GateBlock` nested-array** + `GateContext.config` générique | Package importable | Unit tests zod (valide workflow.json avec gates nested-arrays), type-check helpers |
| **T2** | ✅ shipped 2026-04-21 (`dd8fc01..f438256`) | Migrations DB (4 tables + RLS + text+CHECK `status`/`state` — **deviation from spec**, no pgEnum in codebase + **`gate_results.kind` en text** + extension `config_layer_items` avec `env_ref` uniquement — **decision 2026-04-21**: pas de `mcp_server`, le `mcp` existant est réutilisé). Advisory lock reporté à T5. | Schema en place | 25 file-content vitest assertions (CREATE TABLE, indexes, RLS, policies, CHECKs) + negative assertions (no `'mcp_server'`, no CHECK on `kind`) + barrel export test. Tests verts localement, migration non appliquée contre PG réel en CI. |
| **T3** | ✅ shipped 2026-04-21 (`a0d9464..969dd6b`) | GitProvider (interface + GitlabProvider + LocalBareRepoProvider + ShaCache in-memory cache). 7 closed-set error codes. Retry/backoff/timeout in GitlabProvider. Zero runtime deps (native fetch + child_process). 60 vitest assertions, round-trip integration test end-to-end. 8 follow-ups deferred (GitlabProvider.pathExists ref-first, 400→conflict narrowing, RateLimit-Remaining pre-emptive backoff, `server_error` code, tsconfig.test.json, test gaps, author identity validation, webhook listener) — see plan completion report. | Serveur fetch blobs/tags + commit author=user | 60/60 vitest green (LocalBareRepo + mocked Gitlab + round-trip integration). 13/13 package typecheck green. |
| **T4** | ⏳ pending (inclut les 3 follow-ups Important de T1 — cf. plan T1 completion report) | Gate runner générique (isolated-vm + esbuild + `runGateBlock(block, ctx, kind)` agnostique au kind + cache par sha + fail-closed) | Eval un `GateBlock` nested-array | Fake gates : pass, fail, throw, infinite-loop, invalid output, **composition parallel/sequential**, DAG interne |
| **T5** | ⏳ pending | MCP tools (7 primitives) | MCP exposé | E2E scripted : lance workflow stub sans sub-agent réel |
| **T6** | ⏳ pending | Hook SessionStart + cache client | User peut brancher Claude Code | Test manuel : SessionStart sync, fichiers écrits |
| **T7** | ⏳ pending | Hello-world bootstrap + E2E | Démo fonctionnelle | Lance "hello-world name=Tom" → HELLO, TOM! |

### Ordre de merge

```
T1 (package) ─┐
              ├─► T4 (gate runner, dépend T1+T2+T3)
T2 (DB) ──────┤
              ├─► T5 (MCP tools, dépend T2+T4)
T3 (git) ─────┘           │
                          ├─► T7 (E2E, dépend T5+T6)
                  T6 (hook) ────────┘
```

Parallélisable : T1, T2, T3 indépendants. T6 indépendant de T4/T5.

### Validation progressive

- T1 : écrire une gate TS type-safe en local
- T2 : insérer un run à la main (SQL), verify RLS
- T3 : fetch workflow.json depuis GitLab CBA
- T4 : eval gate TS contre artifact mock
- T5 : driver un run complet via MCP
- T6 : booter Claude Code avec MnM enabled
- T7 : démo complete, onboarder d'autres workflows

---

## Points ouverts pour phase d'implémentation

- **Exact agents table shape** : vérifier à T1/T2 les colonnes existantes (`latest_git_tag`, `enabled` présents ou à ajouter ?)
- **`config_layer_items.item_type`** : vérifier l'enum actuel et ajouter les 4 nouveaux values via migration
- **Helpers `ctx.helpers.queryTraces` signature** : définir à T4 (quelle partie de la DB traces est exposable sans leak ?)
- **Format exact du webhook GitLab** (si on l'active MVP ou pas) : à trancher T3/T5
- **Path resolution du cache in-memory** : stratégie LRU size ? invalidation ? → détails T4
- **Secret management MVP** : comment l'user renseigne `MNM_*` env vars proprement (shell profile ? .env lu par Claude Code ?) → T6
- **Bootstrap d'une nouvelle company** : comment provisionner les 2 repos GitLab (manuel ou via API) → T7
- **`initiated_by_actor_type` valeurs exactes** : aligner avec `AuditActorType` canonique (`packages/shared/src/types/audit.ts`)
- **Types de gates futurs** (`on-success`, `on-failure`, `mid`, `pre-skip`, `post-run`) : **pas de pre-design**, JIT quand un use case concret émerge. L'archi MVP (kind=text, runner générique, orchestrateur hardcodé pour entry/exit) permet l'ajout avec **un seul nouveau hook orchestrateur** et zéro migration.
- **Cycles dans les `GateBlock`** (si usage futur avec `after`) : pas applicable en MVP (nested arrays = pas de cycle possible par construction), mais si on migre vers DAG libre post-MVP, valider absence de cycle à la compilation (cf. design consolidé §3.5).

---

## Alignement avec l'existant MnM

**Respect des règles CLAUDE.md** :
- ✅ Multi-tenant : `company_id` + RLS sur toutes nouvelles tables
- ✅ Dynamic RBAC : pas de hardcoded roles
- ✅ Client-side compute : les sub-agents tournent sur Claude Code user
- ✅ Pas de polling : sync via SessionStart hook (pull) ou webhook (push, post-MVP)
- ✅ UI library components : N/A pour MVP (pas d'UI)
- ✅ Tag-based isolation : scope reporté post-MVP, mais data model compatible (colonne tags pourra être ajoutée sans migration brutale)

**Patterns MnM réutilisés** :
- `config_layer_items` existant (migration 0054) — on étend juste les `item_type` values
- `AuditActorType` canonique (`packages/shared/src/types/audit.ts`)
- `pg_advisory_xact_lock` pour concurrency
- RLS policies pattern migration 0030
- `detectGitProvider` / `parseRepoUrl` utility existant (`packages/shared/src/utils/git-provider.ts`)

**Tables abandonnées** (greenfield, pas de migration) :
- `workflow_templates`, `workflow_instances`, XState state machine, `WorkflowGold` type

---

## Next

1. Écrire l'**implementation plan** (via skill `superpowers:writing-plans`) — décomposer chaque tranche en tâches concrètes avec estimates + ordre + dépendances
2. Commencer par T1 (package) + T2 (DB) en parallèle
