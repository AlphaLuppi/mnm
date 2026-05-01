---
name: governed-workflows
description: Patterns Governed Workflows MnM — gates canoniques + DSL custom, parité REST/MCP, Studio Monaco, AI Assistant SSE. Auto-loaded quand tu touches au gate-runner, aux routes workflows, au Studio UI ou au plugin.
paths:
  - "packages/gate-runner/**"
  - "packages/governed-workflows/**"
  - "server/src/routes/governed-workflows*.ts"
  - "server/src/services/governed-workflow*.ts"
  - "server/src/services/workflow-ai-assistant.ts"
  - "server/src/mcp/tools/governed-workflows*.ts"
  - "ui/src/pages/workflows/WorkflowStudio*.tsx"
  - "ui/src/hooks/useWorkflow*.ts"
  - "ui/src/hooks/useAiAssistant*.ts"
  - "ui/src/components/workflow-studio/**"
  - "ui/src/components/workflows/**"
  - "plugins/mnm/**"
  - "**/workflow.json"
  - "**/*.gate.ts"
---

# Governed Workflows — Patterns à suivre

Feature phare entreprise MnM : DAG de steps + gates versionnés en git, exécutés par le gate-runner (isolated-vm), supervisés via Workflow Studio + AI Assistant + MCP. Cette rule cible les patterns d'implémentation. Pour la conception (artifacts, OAuth, scénarios) → `docs/governed-workflows/*`.

## Architecture rapide

Un workflow vit dans un repo git séparé (GitLab / GitHub / `LocalBareRepoProvider` en dev), structuré ainsi :

```
<workflow-name>/
├── workflow.json       # DAG : steps, deps, gates entry/exit, prompt_context
├── gates/              # Code TS des gates locales au workflow
│   └── *.gate.ts       # Conformes à `defineGate<Artifact, Config>(...)`
└── agents/             # Markdown frontmatter (subagent_type: mnm--<id>)
    └── <id>/agent.md
```

Le serveur ne lit jamais le filesystem direct : il passe par `GitProvider` (`packages/git-provider/`) → `ShaCache` → `gate-runner`. Toute édition côté UI = commit atomique multi-fichiers via `batchCommitWorkflowFiles`.

## Gates — canoniques vs locales

**4 gates canoniques shippées** dans `packages/gate-runner/canonical/` (pas dans le repo workflow, fournies par la plateforme) :

| Gate | Usage | Config |
|---|---|---|
| `artifact-exists` | Une path précise présente dans l'artifact | `{ path, min_bytes? }` |
| `artifacts-bundle` | Liste de paths obligatoires (entry gate typique) | `{ required_paths[], hint? }` |
| `step-succeeded` | Un step antérieur a complété avec succès | `{ step }` |
| `review-pass` | Review report présent + score >= seuil | `{ report_path, min_score }` |

Toute gate canonique référencée dans `workflow.json` est résolue par le runner sans I/O git. Avant d'ajouter une 5e canonique : **vérifie qu'aucune gate locale du repo ne fait déjà le job** (la prolifération canonique = tax sur tous les clients).

**Écrire une gate custom** (locale au workflow, dans `<workflow>/gates/*.gate.ts`) :

```ts
import { defineGate } from "@mnm/governed-workflows";

export default defineGate<MyArtifact, { threshold?: unknown }>(async (ctx) => {
  if (typeof ctx.config.threshold !== "number") {
    return { pass: false, error_code: "GATE_INVALID_CONFIG", report: "..." };
  }
  // ctx.artifact          → step courant (kind:"exit")
  // ctx.step.previous_artifacts → steps précédents (kind:"entry")
  // ctx.helpers.fetchHandoff({git_sha, path}) → lecture mediée par l'host
  return { pass: true, report: "..." };
});
```

Contraintes du sandbox (isolated-vm) : **pas de fs, pas de réseau, pas de `require`**. Toute I/O passe par `ctx.helpers.*`. Tests obligatoires dans `__tests__/` à côté de la gate (vitest, voir `packages/gate-runner/canonical/__tests__/`).

## Parité REST + MCP — règle absolue

Tout endpoint qui touche à un governed workflow DOIT être exposé sur les **deux surfaces** : REST (`server/src/routes/governed-workflows*.ts`) ET MCP (`server/src/mcp/tools/governed-workflows.tool.ts`). Le Studio UI consomme REST ; les agents Claude Code via plugin consomment MCP. Casser la parité = casser l'un des deux clients.

Pattern uniforme :
- **Schémas Zod partagés** : importer depuis `@mnm/governed-workflows` (`workflowDefinitionSchema`, `WORKFLOW_ERROR_CODES`).
- **Service central** : `server/src/services/governed-workflows*.ts` — REST et MCP appellent le même service, jamais de duplication de logique métier.
- **Erreur uniforme** : `GovernedWorkflowError` côté service → `apiError(res, status, code, msg, hints[])` côté REST, `governedError(err)` côté MCP. Status mapping vit dans chaque route (cf. `sendRunLifecycleError`, `sendWorkflowError`).
- **Tenant context** : REST le pose via `tenantContextMiddleware` (mounted on `/companies/:companyId`), MCP le pose explicitement dans `wrap()` au début de chaque tool. Ne JAMAIS appeler `setTenantContext` dans un handler — c'est le wrapper qui s'en charge avec `try/finally`.

Quand tu ajoutes un endpoint : pose-toi la question "ça doit aussi tourner depuis Claude Code via MCP ?". Réponse quasi-toujours oui pour les actions sur un run/workflow.

## Workflow Studio (Monaco multi-fichiers)

Page `ui/src/pages/workflows/WorkflowStudio.tsx`. Layout 3 colonnes resizables : `FileTree` ← `MonacoMultiEditor` ← `AiAssistantPanel`.

State management = `useWorkflowFiles` (et lui seul). Pattern :
- `tree` chargé via `listFiles` (queryKey workflow-scoped).
- Contenu des fichiers fetché **lazy** quand l'utilisateur ouvre un onglet (`queryClient.fetchQuery`).
- Buffer per-fichier : `{ content, originalContent, dirty, deleted? }`. Tombstone = dirty.
- Save = **un seul `batchCommitFiles`** atomique côté serveur (un commit git = N fichiers). Jamais de boucle `saveFile`.
- `computeChangesFromFiles()` est exporté pour test unitaire sans React.

Création d'un nouveau workflow (`/workflows/new`) reste sur l'ancien éditeur single-file ; ne pas migrer sans plan dédié.

## AI Assistant (SSE Claude Sonnet)

Backend : `server/src/services/workflow-ai-assistant.ts` + route `governed-workflows-ai.ts` (`POST /chat`). System prompt **français**, contient : `workflow.json` courant + JSON schema (`workflowJsonSchema`) + liste des gates canoniques + gates locales du repo. Streaming via Anthropic Messages API → événements typés :

```
{type:"token", value}                          → chunk texte
{type:"file-proposal", path, content?, delete?} → bloc <file> parsé post-stream
{type:"error", error_code, message, hints?}
{type:"done"}
```

Frontend : `useAiAssistant` (state in-memory, pas de persistence — `/clear` au navigation = reset volontaire). `AiAssistantPanel` rend des cards "Appliquer / Rejeter" qui appellent `useWorkflowFiles.editFile` ou `addFile`. Le service **ne commit jamais directement** — l'utilisateur garde la main.

Rate limit : 3 requêtes concurrentes max par `{companyId, userId}` (in-memory, best-effort, voir `createConcurrencyCounter`).

## ValidationBadge + Sheet drawer

Le badge de validation overlay s'affiche au-dessus du Studio quand `workflow.json` ne respecte pas le schéma. Click → `Sheet` drawer qui liste les erreurs Zod path-par-path. Composant : `ui/src/components/workflow-studio/ValidationBadge.tsx`. Toujours utiliser le `Sheet` de `ui/src/components/ui/`, ne pas réimplémenter.

## HITL pattern

Un step "human-in-the-loop" = un step normal avec :
- `gates.exit: [{ name: "review-pass", config: { report_path, min_score } }]`
- Un agent humain (subagent désigné côté plugin, ou pause runner attendant un `complete_governed_step` manuel via UI/MCP).

Pas d'API HITL séparée. Le pattern review-pass + reactivate run couvre 99% des cas.

## OAuth 2.1 GitLab

Commits attribués à l'utilisateur réel (vs bot service) via OIDC GitLab fédéré Azure AD. `resolveGitProvider({ companyId, userId })` dans `createResolveGitProvider` pioche le token user dans la table `account` (BetterAuth). Setup complet : `docs/governed-workflows/oauth-setup.md`.

Toujours passer `userId` quand tu construis un GitProvider depuis une route où l'actor est board-user (`req.actor.userId`) — sinon fallback bot. JAMAIS hardcoder le token.

## Anti-patterns à éviter

- **Ne pas créer de gate sans test** dans `__tests__/` — chaque gate canonique a son fichier `.test.ts`. Pas de PR sans.
- **Ne pas bypass la parité MCP** ("je rajoute juste l'endpoint REST, je ferai le MCP plus tard"). Plus tard = jamais. Les deux dans le même PR.
- **Ne pas lire le filesystem dans une gate** — l'isolate n'a pas accès. Utilise `ctx.helpers.fetchHandoff`.
- **Ne pas dupliquer la logique service entre REST et MCP** — appel direct au service `governedWorkflowService` ou aux helpers `governed-workflows-extensions.ts`.
- **Ne pas commit git en dehors de `completeStep`** — la persistence des artifacts (commit sur `mnm-runs/<run_id>` puis merge `--no-ff` dans master) est centralisée. Ne pas court-circuiter.
- **Ne pas appeler `setTenantContext` dans un handler MCP** — c'est `wrap()` qui le fait, avec cleanup `finally`.
- **Ne pas mettre des deliverables dans `data{}`** — `outputs[]` pour les fichiers/folders/URLs, `data{}` pour les scalaires (ids, counts, approvals). Voir `handoff-artifacts.md`.
- **Ne pas créer un nouveau type de gate canonique** sans valider qu'aucune des 4 existantes ne couvre le besoin.

## Liens utiles (ne pas dupliquer ici)

- Schéma artifacts v2c + run branch lifecycle → `docs/governed-workflows/handoff-artifacts.md`
- Test local hello-world (embedded PG, LocalBareRepoProvider) → `docs/governed-workflows/local-testing.md`
- OAuth + GitLab OIDC + PAT → `docs/governed-workflows/oauth-setup.md`
- Scénarios DAG (branching, parallel gates, LLM-as-judge) → `docs/governed-workflows/scenarios.md`
- Plugin Claude Code (bootstrap, AGENTS_STALE, session-bundle) → `plugins/mnm/README.md`
