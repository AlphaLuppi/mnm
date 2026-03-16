# Epics Scale & Trace — MnM : Infrastructure Hardening + Trace Analysis Personnalisee

> **Version** : 2.0 | **Date** : 2026-03-16 | **Statut** : Draft
> **Sources** : Scalability Audit, 3 Brainstorming Sessions, User Feedback (trace simplification, no thinking reliance, prompt-driven lenses)
> **Prerequis** : 69/69 stories B2B completees sur `feature/b2b-enterprise-transformation`

---

## Table des Matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Epic SCALE — Infrastructure Hardening](#2-epic-scale--infrastructure-hardening)
3. [Epic TRACE — Prompt-Driven Trace Analysis](#3-epic-trace--prompt-driven-trace-analysis)
4. [Graphe de Dependances](#4-graphe-de-dependances)
5. [Sprint Planning](#5-sprint-planning)
6. [Data Model](#6-data-model)
7. [API Design](#7-api-design)
8. [Risques & Mitigations](#8-risques--mitigations)

---

## 1. Vue d'ensemble

### 1.1 Probleme

L'infrastructure MnM n'est pas prete pour la production multi-tenant (pool DB=10, single process, LiveEvents in-memory, zero job queue).

En parallele, les agents produisent 200+ tool calls par run, et PERSONNE ne veut lire ca. Le vrai besoin : chaque user veut comprendre ce que l'agent a fait **a travers ses propres questions/preoccupations**.

### 1.2 Vision Produit — Trace Analysis

**MnM ne montre pas des traces. MnM analyse les traces pour chaque user.**

L'user ecrit (en langage naturel) ce qu'il veut comprendre. Le systeme analyse les traces brutes a travers ce prompt et produit une vue personnalisee. Deux users, meme agent run, deux resultats differents.

- **Power user** : ecrit son propre prompt d'analyse
- **Non-power user** : choisit parmi des suggestions guidees
- Les prompts sont sauvegardes par agent/workflow et s'appliquent automatiquement aux nouvelles traces

C'est le differenciateur de MnM. Langfuse montre les donnees brutes. MnM donne a chaque user SA comprehension de ce qui s'est passe.

### 1.3 Structure

| Epic | Stories | Effort estime |
|------|---------|---------------|
| **SCALE** — Infrastructure Hardening | 7 | ~1.5 semaine |
| **TRACE** — Prompt-Driven Trace Analysis | 13 | ~4.5 semaines |
| **TOTAL** | **20** | **~6 semaines** |

### 1.4 Principes Directeurs

1. **Scale-first** — hardening AVANT tracing
2. **Actions = verite** — la source de verite c'est les tool calls et leurs resultats, pas le thinking
3. **L'user prompt, le systeme analyse** — pas de views preconcues, chaque user a son analyse
4. **Suggestions guidees** — les non-power users ne partent pas d'une page blanche
5. **Raw toujours accessible** — le detail brut est la en drill-down pour ceux qui en ont besoin

---

## 2. Epic SCALE — Infrastructure Hardening

*(Inchange par rapport a v1 — 7 stories)*

**Objectif** : Rendre MnM capable de supporter 50+ utilisateurs simultanes avec agents multiples.
**Effort total** : 7 stories | ~1.5 semaine

### Story SCALE-01 : PostgreSQL Connection Pool Tuning
**Description** : Configurer le pool de connexions PostgreSQL. `createDb()` utilise `postgres(url)` sans config — default 10 connexions.
**Effort** : XS (1 SP, 0.5j) | **Bloque par** : Aucun | **Debloque** : Tout

**Acceptance Criteria** :
- Given `createDb()` When il cree le pool Then `max` configurable via `MNM_DB_POOL_MAX` (default 50)
- Given le pool When `idle_timeout` expire Then connexions idle liberees (30s)
- Given le pool When sature Then `connect_timeout` rejette apres 10s avec erreur claire
- Given 50 requetes concurrentes Then aucune ne timeout par manque de connexion

**Fichiers** : `packages/db/src/client.ts` (ligne 44-46), `.env.example`

---

### Story SCALE-02 : Node.js Cluster Mode
**Description** : Support multi-process via `cluster` module. Actuellement single process = un seul CPU core.
**Effort** : S (2 SP, 1j) | **Bloque par** : Aucun | **Debloque** : SCALE-03

**Acceptance Criteria** :
- Given le serveur en mode cluster Then `MNM_CLUSTER_WORKERS` workers forked (default: CPU count)
- Given un worker crash Then restart auto avec backoff exponentiel
- Given `MNM_CLUSTER_WORKERS=1` Then single process (comportement actuel)
- Given Docker Then workers respectent CPU limits du container

**Fichiers** : `server/src/cluster.ts` (nouveau), `server/src/index.ts`, `Dockerfile`

---

### Story SCALE-03 : LiveEvents Redis Pub/Sub
**Description** : Migrer `live-events.ts` de `EventEmitter` in-memory vers Redis pub/sub. Pattern existe deja dans `chat-ws-manager.ts`.
**Effort** : M (3 SP, 1.5j) | **Bloque par** : SCALE-02 | **Debloque** : TRACE-06

**Acceptance Criteria** :
- Given Redis dispo When `publishLiveEvent()` Then event publie sur channel Redis `mnm:live:{companyId}`
- Given 2 workers When un publie Then l'autre recoit et forward aux WebSocket clients
- Given Redis indisponible Then fallback `EventEmitter` local
- Given 1000 events/sec Then aucune perte

**Fichiers** : `server/src/services/live-events.ts`, `server/src/redis.ts`

---

### Story SCALE-04 : BullMQ Job Queue Infrastructure
**Description** : Installer BullMQ comme job queue distribue. Retry, deduplication, monitoring.
**Effort** : M (5 SP, 2j) | **Bloque par** : Aucun | **Debloque** : SCALE-05, TRACE-05

**Acceptance Criteria** :
- Given BullMQ When serveur demarre Then queue `mnm:default` creee avec Redis
- Given un job fail Then retry avec backoff exponentiel (max 3)
- Given un job timeout (60s default) Then marque `failed`
- Given des jobs en doublon (meme jobId) Then deduplication auto
- Given `bull-board` When admin y accede Then il voit queues, pending, failed

**Fichiers** : `server/src/jobs/queue.ts`, `server/src/jobs/worker.ts`, `server/src/jobs/types.ts`

---

### Story SCALE-05 : Migration Background Jobs vers BullMQ
**Description** : Migrer les `setInterval` (heartbeat, backup, drift monitor, compaction watcher) vers BullMQ repeatables.
**Effort** : M (3 SP, 1.5j) | **Bloque par** : SCALE-04

**Acceptance Criteria** :
- Given heartbeat scheduler migre Then repeatable job avec interval configurable
- Given 2 workers et meme repeatable Then un seul l'execute (dedup native BullMQ)
- Given les anciens `setInterval` Then ils ne sont plus crees au demarrage

**Fichiers** : `server/src/index.ts`, `server/src/jobs/heartbeat-job.ts`, `server/src/jobs/backup-job.ts`

---

### Story SCALE-06 : Rate Limiting Per-Endpoint & Agent-Aware
**Description** : Affiner le rate limiting (actuellement 1000 req/min global). Distinguer agents vs users, per-endpoint.
**Effort** : S (2 SP, 1j) | **Bloque par** : Aucun

**Acceptance Criteria** :
- Given routes ingestion traces Then rate limit dedie (5000 req/min pour agents)
- Given routes UI Then 200 req/min par user
- Given agent identifie par API key Then rate limit per-agent, pas per-IP

**Fichiers** : `server/src/middleware/rate-limit.ts`, `server/src/app.ts`

---

### Story SCALE-07 : Connection Health & Graceful Shutdown
**Description** : Health check enrichi (pool stats, Redis, queue depth) et graceful shutdown.
**Effort** : S (2 SP, 1j) | **Bloque par** : SCALE-02, SCALE-04

**Acceptance Criteria** :
- Given `GET /api/health` Then retourne pool stats, Redis status, BullMQ depths
- Given SIGTERM Then finit requetes en cours (30s), drain jobs, ferme WebSocket, exit
- Given pool DB saturation (>80%) Then warning logge

**Fichiers** : `server/src/routes/health.ts`, `server/src/cluster.ts`

---

## 3. Epic TRACE — Prompt-Driven Trace Analysis

**Objectif** : Chaque user definit ce qu'il veut comprendre des traces d'agents. Le systeme analyse les traces brutes a travers le prompt de l'user et produit une vue personnalisee.
**Effort total** : 10 stories | ~3.5 semaines
**Bloque par** : SCALE-01, SCALE-03, SCALE-04

---

### Story TRACE-01 : Schema — Tables traces + observations

**Description** : Data model pour stocker les traces brutes. 2 tables : `traces` (un container par agent run) et `trace_observations` (chaque action : tool call, generation, event). C'est le stockage factuel — ce qui s'est REELLEMENT passe.

**Effort** : M (3 SP, 1.5j) | **Bloque par** : SCALE-01 | **Debloque** : Tout TRACE

**Acceptance Criteria** :
- Given la table `traces` Then colonnes : `id`, `companyId`, `heartbeatRunId` (FK nullable), `workflowInstanceId` (FK nullable), `stageInstanceId` (FK nullable), `agentId` (FK), `name`, `status` (running/completed/failed/cancelled), `startedAt`, `completedAt`, `totalDurationMs`, `totalTokensIn`, `totalTokensOut`, `totalCostUsd`, `metadata`, `tags`, `createdAt`, `updatedAt`
- Given la table `trace_observations` Then colonnes : `id`, `traceId` (FK CASCADE), `parentObservationId` (FK self-ref nullable), `companyId`, `type` (span/generation/event), `name`, `status`, `startedAt`, `completedAt`, `durationMs`, `level`, `statusMessage`, `input` (JSONB 10KB max), `output` (JSONB 10KB max), `inputTokens`, `outputTokens`, `totalTokens`, `costUsd`, `model`, `modelParameters`, `metadata`, `createdAt`
- Given les indexes Then optimises pour : list par company+date, filter par agent, filter par status, tree build par traceId, analytics par type
- Given RLS Then scope par `companyId` (meme pattern TECH-05)

---

### Story TRACE-02 : Trace Service — CRUD + Aggregation

**Description** : Service backend. Creer, lister, detailler, finaliser des traces et observations. Race conditions gerees via aggregation atomique SQL (pas de read-then-write).

**Effort** : M (5 SP, 2j) | **Bloque par** : TRACE-01 | **Debloque** : TRACE-03, TRACE-04

**Acceptance Criteria** :
- Given `traceService.create()` Then trace `running` creee
- Given `traceService.addObservation()` Then observation inseree, peut avoir un parent (arbre)
- Given `traceService.completeObservation()` Then durationMs calcule, tokens/cost mis a jour
- Given `traceService.completeTrace()` Then totaux recalcules atomiquement : `UPDATE traces SET totalTokensIn = (SELECT SUM(...) FROM trace_observations WHERE traceId = $1)`
- Given 10 `addObservation()` concurrents Then aucune race condition (INSERT independants, aggregation atomique)
- Given `traceService.list()` Then pagination cursor-based (keyset sur `startedAt DESC, id`)
- Given `traceService.getTree()` Then arbre complet via CTE recursive en une requete
- Given input/output > 10KB Then tronque avec `"...[truncated]"` suffix

---

### Story TRACE-03 : API Routes Trace

**Description** : REST endpoints pour ingestion (agents) et consultation (UI).

**Effort** : M (3 SP, 1.5j) | **Bloque par** : TRACE-02 | **Debloque** : TRACE-04, TRACE-07

**Acceptance Criteria** :
- `POST /api/companies/:companyId/traces` — creer trace (201)
- `POST /api/companies/:companyId/traces/:traceId/observations` — ajouter observation (201)
- `POST /api/companies/:companyId/traces/:traceId/observations/batch` — bulk add (201)
- `PATCH /api/companies/:companyId/traces/:traceId/observations/:obsId` — completer observation
- `PATCH /api/companies/:companyId/traces/:traceId/complete` — finaliser trace
- `GET /api/companies/:companyId/traces` — lister (cursor pagination, filtres)
- `GET /api/companies/:companyId/traces/:traceId` — detail + arbre observations
- RBAC : `traces:read` pour consulter, `traces:write` pour ingerer
- Validators Zod stricts

---

### Story TRACE-04 : Adapter Instrumentation — Claude Local

**Description** : Instrumenter l'adapter `claude-local` pour emettre des observations a partir du stream-json. Le stream-json Claude contient deja des events structures (tool_use, tool_result, text, result avec usage/cost). Le `TraceTransformer` mappe ces events vers des observations factuelles.

**Effort** : L (5 SP, 2.5j) | **Bloque par** : TRACE-03 | **Debloque** : TRACE-08

**Acceptance Criteria** :
- Given un heartbeat run claude-local When il demarre Then `POST /traces` cree une trace liee au `heartbeatRunId`
- Given un `tool_use` event dans le stream Then observation type=`span`, name=`tool:{toolName}`, input={tool args}
- Given un `tool_result` event Then l'observation correspondante est completee avec output et status (completed/failed selon is_error)
- Given un `result` event Then observation type=`event`, name=`run-result`, metadata={inputTokens, outputTokens, costUsd, stopReason}
- Given un `text` block Then observation type=`generation`, output={text truncated}
- Given le heartbeat run termine Then trace completee avec totaux recalcules
- Given MnM API down Then observations bufferisees (max 100), flush quand dispo
- Given le pattern Then extrait dans `TraceEmitter` reutilisable pour autres adapters
- Given le cout non fourni Then estimation via `model-pricing.json`

**Mapping stream-json → observations** :

| Stream event | → Observation | name | Ce qu'on capture |
|---|---|---|---|
| `tool_use` | span (start) | `tool:Read`, `tool:Edit`, `tool:Bash`... | args du tool |
| `tool_result` | span (complete) | — (match par tool_use_id) | output, is_error |
| `text` block | generation | `response` | texte tronque |
| `result` | event | `run-result` | tokens, cost, stop_reason |

**Fichiers** : `packages/adapters/src/trace-emitter.ts` (nouveau), `packages/adapters/claude-local/`, `packages/adapters/src/model-pricing.json` (nouveau)

---

### Story TRACE-05 : Trace Ingestion Worker (BullMQ)

**Description** : L'ingestion des observations est asynchrone via BullMQ pour ne pas bloquer les routes API. `POST /observations` valide et enqueue, le worker persiste.

**Effort** : M (3 SP, 1.5j) | **Bloque par** : SCALE-04, TRACE-02 | **Debloque** : Performance

**Acceptance Criteria** :
- Given `POST /observations` Then body valide, enqueue BullMQ, reponse 202 Accepted
- Given le worker Then persiste en DB + recalcule totaux trace atomiquement
- Given 1000 obs/min Then traitement temps reel (queue depth < 100)
- Given un job fail Then retry 3x avec backoff
- Given batch de 50 observations Then un seul job, bulk insert

**Fichiers** : `server/src/jobs/trace-ingest-job.ts` (nouveau), `server/src/routes/traces.ts`

---

### Story TRACE-06 : LiveEvents Trace Streaming

**Description** : Nouveaux types LiveEvent pour que le frontend recoive les updates de trace en temps reel.

**Effort** : S (2 SP, 1j) | **Bloque par** : SCALE-03, TRACE-02 | **Debloque** : TRACE-07

**Acceptance Criteria** :
- Given LiveEventTypes Then 4 nouveaux : `trace.created`, `trace.observation_created`, `trace.observation_completed`, `trace.completed`
- Given observation persistee (via worker) Then `publishLiveEvent` avec metadata legere (pas d'input/output)
- Given Redis pub/sub (SCALE-03) Then tous les workers recoivent
- Given latence Then < 100ms de persistance a WebSocket

**Fichiers** : `packages/shared/src/constants.ts`, `packages/shared/src/types/trace.ts` (nouveau)

---

### Story TRACE-07 : Schema — Analyses personnalisees (Lenses)

**Description** : Data model pour les "analyses" que chaque user cree. Un user definit un prompt d'analyse pour un agent ou workflow. Quand une trace est ouverte, le systeme utilise ce prompt pour analyser les observations brutes et produire un resultat personnalise.

**Effort** : M (3 SP, 1.5j) | **Bloque par** : TRACE-01 | **Debloque** : TRACE-08, TRACE-09

**Acceptance Criteria** :
- Given la table `trace_lenses` Then colonnes : `id`, `companyId`, `userId` (FK), `name` (ex: "Revue securite"), `prompt` (le texte libre de l'user), `scope` (jsonb: `{agentIds?: [], workflowIds?: [], global?: boolean}`), `isTemplate` (boolean — pour les suggestions pre-built), `isActive` (boolean), `createdAt`, `updatedAt`
- Given la table `trace_lens_results` Then colonnes : `id`, `lensId` (FK), `traceId` (FK), `companyId`, `userId`, `resultMarkdown` (la sortie analysee), `resultStructured` (jsonb: donnees structurees extraites), `generatedAt`, `modelUsed`, `inputTokens`, `outputTokens`, `costUsd`, `createdAt`
- Given un index unique Then `(lensId, traceId)` — un seul resultat par lens par trace
- Given les templates pre-built When le systeme est seed Then au moins 5 suggestions :
  - "Resume livraison" — Qu'est-ce qui a ete fait, qu'est-ce qui reste
  - "Revue securite" — Fichiers sensibles touches, patterns dangereux
  - "Suivi budget" — Cout, est-ce raisonnable, comparaison avec les runs precedents
  - "Qualite code" — Tests, lint, erreurs, couverture
  - "Fichiers modifies" — Liste detaillee de tout ce qui a change avec les diffs

---

### Story TRACE-08 : Lens Analysis Engine

**Description** : Le coeur du systeme. Service qui prend une trace brute + un prompt d'analyse (lens) et produit un resultat personnalise. Utilise un LLM pour analyser les observations a travers le prompt de l'user.

**Effort** : L (8 SP, 3j) | **Bloque par** : TRACE-02, TRACE-07 | **Debloque** : TRACE-09, TRACE-10

**Acceptance Criteria** :
- Given `lensAnalysisService.analyze(traceId, lensId)` When appele Then :
  1. Charge les observations de la trace (arbre complet)
  2. Construit un contexte factuels : liste des tool calls, fichiers touches, resultats, couts, durees
  3. Envoie au LLM avec le prompt de l'user comme instruction d'analyse
  4. Parse la reponse en markdown + donnees structurees
  5. Persiste dans `trace_lens_results`
- Given le prompt systeme Then il guide le LLM : "Tu es un analyste de traces d'agent IA. Voici les actions factuelles de l'agent. L'utilisateur veut comprendre : {user_prompt}. Analyse les actions et reponds de maniere specifique et actionable. Cite les fichiers, les chiffres, les resultats concrets."
- Given les observations When trop nombreuses (>200) Then pre-filtrage intelligent : regrouper les tool calls du meme type consecutifs, tronquer les inputs/outputs, garder les erreurs en entier
- Given un resultat existant pour (lensId, traceId) When la trace n'a pas change Then retourner le cache
- Given une trace en cours (status=running) When analysee Then le resultat est marque `partial` et re-genere a la completion
- Given le cout LLM Then estime et affiche a l'user AVANT de lancer l'analyse ("Cette analyse coutera ~$0.01, continuer ?")
- Given le endpoint LLM Then configurable via `MNM_LLM_SUMMARY_ENDPOINT` (meme config que OBS-S03 audit summarizer)
- Given un prompt custom de l'user When il est vague (ex: "montre moi tout") Then le systeme ajoute des guidelines de structure pour que la sortie soit lisible
- Given l'analyse When elle echoue (LLM timeout, erreur) Then message clair a l'user, le brut reste accessible

**Prompt Architecture** :
```
SYSTEM: Tu es un analyste de traces d'agent IA dans MnM.
Tu recois les actions factuelles d'un agent (tool calls, resultats, couts).
L'utilisateur a defini ce qu'il veut comprendre (ci-dessous).
Analyse les actions et reponds de maniere specifique : cite les fichiers,
les chiffres, les resultats. Sois concis et actionable.
Reponds en markdown structure.

USER LENS: {le prompt de l'user, ex: "Je veux comprendre les choix
d'architecture et quand l'agent hesite entre deux approches"}

TRACE DATA:
- Agent: {agentName}, Run: {traceName}
- Duree: {duration}, Cout: {cost}, Tokens: {tokens}
- Observations ({count}):
  1. [tool:Read] src/auth/login.ts → 245 lines (success)
  2. [tool:Read] src/middleware/rbac.ts → 89 lines (success)
  3. [tool:Grep] "validatePassword" → 3 matches in 2 files
  ...
  45. [tool:Bash] "npm test" → exit 0, "42 passed"
  46. [event] run-result → 18k tokens, $0.34
```

---

### Story TRACE-09 : UI — Trace Page + Lens Selector

**Description** : Page principale des traces. L'user voit ses traces, selectionne ou cree une lens, et voit le resultat d'analyse personnalise. Le brut est accessible en drill-down.

**Effort** : L (8 SP, 3j) | **Bloque par** : TRACE-08, TRACE-06 | **Debloque** : TRACE-10

**Acceptance Criteria** :
- Given `/traces` When chargee Then table de traces : Agent, Name, Status, Duration, Cost, Tokens, Date. Tri et filtres.
- Given une trace cliquee When ouverte Then :
  - **Header** : name, agent, status badge, duration, cost, tokens
  - **Lens selector** : dropdown des lenses de l'user + suggestions pre-built + "Ecrire une analyse..."
  - **Zone d'analyse** : le resultat markdown de la lens selectionnee
  - **Bouton "Voir le brut"** : expand/collapse pour voir les observations raw en arbre
- Given "Ecrire une analyse..." When clique Then un textarea s'ouvre, l'user ecrit son prompt, clique "Analyser"
- Given une lens selectionnee When le resultat n'existe pas encore Then spinner + estimation cout ("~$0.01") + bouton "Lancer l'analyse"
- Given une lens selectionnee When le resultat existe (cache) Then affichage immediat
- Given le resultat d'analyse When affiche Then markdown rendu avec syntax highlighting pour les blocs de code, fichiers cliquables
- Given "Voir le brut" When expand Then arbre d'observations : icone par type (tool=wrench, generation=brain, event=dot), name, duration, expandable input/output
- Given une trace `running` When ouverte Then indicateur live "En cours...", nouvelles observations apparaissent en temps reel, lens analysis desactivee jusqu'a completion
- Given la sidebar Then lien "Traces" avec icone, permission guard `traces:read`
- Given les suggestions pre-built When un user n'a aucune lens Then affichees en premier avec description courte : "Resume livraison — Qu'est-ce qui a ete fait, qu'est-ce qui reste"
- Given une lens When sauvegardee Then elle apparait dans le dropdown pour toutes les prochaines traces (selon son scope agent/workflow/global)

**Fichiers** : `ui/src/pages/Traces.tsx`, `ui/src/pages/TraceDetail.tsx`, `ui/src/components/traces/LensSelector.tsx`, `ui/src/components/traces/LensAnalysisResult.tsx`, `ui/src/components/traces/RawObservationTree.tsx`, `ui/src/api/traces.ts`, `ui/src/api/lenses.ts`

---

### Story TRACE-10 : UI — Lens Management + Context Pane

**Description** : Page de gestion des lenses (creer, editer, supprimer, rendre global). Integration au context pane : quand un agent est actif, le context pane affiche le resultat de la lens par defaut de l'user.

**Effort** : M (5 SP, 2j) | **Bloque par** : TRACE-09 | **Debloque** : Aucun (capstone)

**Acceptance Criteria** :
- Given `/settings/trace-lenses` (ou section dans settings) Then l'user voit ses lenses : name, prompt (tronque), scope, active/inactive
- Given une lens When editee Then le prompt est modifiable, le scope est changeable (agent specifique, workflow, ou global)
- Given une lens When supprimee Then les resultats caches sont supprimes
- Given une lens When marquee "par defaut" Then elle s'applique automatiquement quand l'user ouvre une trace (sans cliquer "Analyser")
- Given le context pane When un agent est actif dans le projet courant Then :
  - Affiche un mini-resume de la trace en cours (agent, duree, observations count)
  - Quand la trace se complete : lance auto la lens par defaut de l'user et affiche le resultat
  - Si pas de lens par defaut : affiche un resume factuel basique (fichiers modifies, tests, cout)
- Given le context pane When plusieurs agents actifs Then une section par agent, chacune avec son mini-resume
- Given le context pane When aucun agent actif Then affiche le dernier resultat d'analyse du projet

**Fichiers** : `ui/src/pages/TraceSettings.tsx` (ou section), `ui/src/components/context/ContextTraceSection.tsx`, `ui/src/components/context/ContextLensResult.tsx`

---

### Story TRACE-11 : Sub-Agent Trace Linking

**Description** : Quand un agent spawn un sub-agent (ex: Claude Code `Agent` tool, ou A2A Bus), la trace enfant est liee a la trace parent. Ca permet de voir l'arbre d'execution complet : quel agent a delegue quoi a qui.

**Effort** : S (2 SP, 1j) | **Bloque par** : TRACE-02 | **Debloque** : TRACE-12

**Acceptance Criteria** :
- Given la table `traces` When modifiee Then nouvelle colonne `parentTraceId` (uuid FK self-ref nullable)
- Given un agent When il spawn un sub-agent (via Agent tool ou A2A) Then la trace du sub-agent a `parentTraceId` = trace du parent
- Given `traceService.getTree(traceId)` When appele sur une trace parent Then retourne la trace + ses sous-traces (recursif)
- Given `traceService.getRootTrace(traceId)` When appele sur une sous-trace Then remonte jusqu'a la trace racine
- Given l'adapter claude-local When il detecte un `tool_use` avec name=`Agent` Then il cree un span observation avec metadata `{subAgentTraceId}` pour le lien
- Given le A2A Bus (A2A-S01) When un message est envoye Then metadata `{sourceTraceId}` est incluse pour le linking cross-agent
- Given une trace avec sous-traces When listee Then le count de sous-traces est affiche

**Fichiers** : `packages/db/src/schema/traces.ts`, `server/src/services/trace-service.ts`, `packages/adapters/src/trace-emitter.ts`

---

### Story TRACE-12 : Workflow Story View

**Description** : Vue aggregee au niveau workflow qui montre tous les agents et leurs traces sur une timeline. C'est LA vue pour un PM qui veut comprendre "ma story est ou ?". Montre les stages sequentiels et paralleles, les handoffs entre agents, et permet de lancer une lens sur l'ensemble du workflow.

**Effort** : L (8 SP, 3j) | **Bloque par** : TRACE-09, TRACE-11 | **Debloque** : Aucun (capstone multi-agent)

**Acceptance Criteria** :
- Given `/workflows/:workflowId/traces` When chargee Then affiche une **timeline horizontale** avec une bande par agent/stage :
  ```
  PM Agent   ████░░░░░░░░░░░░░░░░░  3min  $0.05
  Dev Agent  ░░░░████████████░░░░░░ 12min  $0.34
  QA Agent   ░░░░░░░░░░░░░░██████░  5min  $0.08
  Review     ░░░░░░░░░░░░░░░░░░███  2min  $0.03
             0    3    6    9   12   15   18  21min
  ```
- Given les barres When affichees Then couleur par status (vert=completed, bleu=running, rouge=failed, gris=pending)
- Given une barre When cliquee Then navigation vers le TraceDetail de cet agent
- Given le header workflow Then resume agrege : duree totale, cout total, agents impliques, status global
- Given les handoffs When un stage se termine et le suivant demarre Then une fleche visuelle montre la transition (outputArtifacts → inputArtifacts)
- Given des stages paralleles (meme stageOrder ou stages simultanes) When affiches Then les barres se superposent verticalement
- Given les sous-traces (TRACE-11) When un agent a des sub-agents Then les sous-barres sont indentees sous la barre parent
- Given le lens selector When present sur cette vue Then le scope est le workflow entier — l'analyse recoit TOUTES les traces du workflow
- Given un lens prompt workflow-level Then exemples :
  - "Combien a coute chaque agent et lequel a ete le plus efficace ?"
  - "Quels fichiers ont ete touches par plusieurs agents ? Y a-t-il des conflits ?"
  - "Resume le handoff entre le PM et le Dev : est-ce que le Dev a bien compris la spec ?"
- Given les lenses workflow When analysees Then `trace_lens_results` stocke le resultat avec `traceId=null` et un nouveau champ `workflowInstanceId`

**Fichiers** : `ui/src/pages/WorkflowTraces.tsx` (nouveau), `ui/src/components/traces/WorkflowTimeline.tsx` (nouveau), `ui/src/components/traces/AgentTimelineBar.tsx` (nouveau), route + navigation depuis page workflow existante

---

### Story TRACE-13 : Live Multi-Agent Dashboard

**Description** : Quand plusieurs agents tournent en parallele, le context pane et le dashboard montrent l'activite en temps reel de tous les agents. Pas juste "agent X tourne" mais "agent X est en train de modifier des fichiers pendant que agent Y execute les tests".

**Effort** : M (5 SP, 2j) | **Bloque par** : TRACE-06, TRACE-12 | **Debloque** : Aucun

**Acceptance Criteria** :
- Given le context pane When 3 agents tournent en parallele dans le projet Then chaque agent a sa section avec :
  - Nom de l'agent + stage
  - Observation en cours (ex: "tool:Edit routes/access.ts" ou "tool:Bash npm test")
  - Compteurs live : observations, duree, cout estime
- Given un agent When il termine Then sa section passe en "completed" avec un mini-resume factuel (fichiers modifies, tests, cout)
- Given le dashboard When il affiche les agents actifs Then une mini-timeline live montre les agents qui tournent en parallele
- Given les LiveEvents When `trace.observation_created` arrive Then le context pane de TOUS les users connectes au projet se met a jour
- Given une observation When elle concerne un fichier deja touche par un autre agent actif Then un indicateur "conflit potentiel" apparait (2 agents editent le meme fichier)
- Given le multi-agent When un agent attend un autre (dependency entre stages) Then affiche "En attente de [Agent PM] — stage Specification"

**Fichiers** : `ui/src/components/context/MultiAgentLivePanel.tsx` (nouveau), `ui/src/hooks/useProjectLiveTraces.ts` (nouveau)

---

## 4. Graphe de Dependances

```
SCALE-01 (DB Pool) ─────────────────────────┐
                                             ├──→ TRACE-01 (Schema) ──→ TRACE-02 (Service) ──→ TRACE-03 (API)
SCALE-02 (Cluster) ──→ SCALE-03 (Redis) ────┤                                │                     │
                                             │                                ↓                     ↓
SCALE-04 (BullMQ) ──→ SCALE-05 (Jobs) ──────┼───────────────→ TRACE-05 (Worker)               TRACE-04 (Adapter)
                                             │
SCALE-06 (Rate Limit)                        │
SCALE-07 (Health)                            │
                                             │
                                TRACE-01 ────┼──→ TRACE-07 (Schema Lenses)
                                             │           │
                                TRACE-02 ────┼──→ TRACE-08 (Lens Analysis Engine)
                                             │           │
                         TRACE-03 + SCALE-03 ┼──→ TRACE-06 (LiveEvents)
                                             │           │
                                TRACE-02 ────┼──→ TRACE-11 (Sub-Agent Linking)
                                             │           │
                                             │    TRACE-08 + TRACE-06 ──→ TRACE-09 (UI Trace + Lens)
                                             │                                    │
                                             │                              TRACE-10 (Lens Mgmt + Context Pane)
                                             │                                    │
                                             │    TRACE-09 + TRACE-11 ──→ TRACE-12 (Workflow Story View)
                                             │                                    │
                                             │    TRACE-06 + TRACE-12 ──→ TRACE-13 (Live Multi-Agent Dashboard)
```

**Chemin critique backend** : SCALE-01 → TRACE-01 → TRACE-02 → TRACE-03 → TRACE-04 (adapter data flowing)
**Chemin critique UI** : TRACE-07 → TRACE-08 (lens engine) → TRACE-09 (UI) → TRACE-12 (workflow view) → TRACE-13 (live multi-agent)
**Les deux chemins sont parallelisables** (backend + frontend)

---

## 5. Sprint Planning

### Sprint SCALE — 1.5 semaines

| Jour | Story | Notes |
|------|-------|-------|
| J1 | SCALE-01 + SCALE-06 | Quick wins, 0 deps |
| J2 | SCALE-02 | Cluster foundation |
| J3-J4 | SCALE-04 | BullMQ setup |
| J5 | SCALE-03 | Redis pub/sub (needs SCALE-02) |
| J6 | SCALE-05 | Migrate jobs (needs SCALE-04) |
| J7 | SCALE-07 | Health + shutdown |

### Sprint TRACE — 4.5 semaines

| Jour | Backend | Frontend | Notes |
|------|---------|----------|-------|
| J1-J2 | TRACE-01 (Schema traces+obs) | TRACE-07 (Schema lenses) | Parallele |
| J3-J4 | TRACE-02 (Service) + TRACE-11 (Sub-Agent Linking) | — | |
| J5-J6 | TRACE-03 (API) + TRACE-05 (Worker) | — | |
| J7 | TRACE-06 (LiveEvents) | — | |
| J8-J10 | TRACE-04 (Adapter instrumentation) | TRACE-08 (Lens Engine) | Parallele |
| J11-J13 | — | TRACE-09 (UI Trace + Lens) | |
| J14-J15 | — | TRACE-10 (Lens Mgmt + Context) | |
| J16-J18 | — | TRACE-12 (Workflow Story View) | Multi-agent |
| J19-J20 | — | TRACE-13 (Live Multi-Agent) | Capstone |

---

## 6. Data Model

### Tables existantes utilisees

```
heartbeat_runs ← traces.heartbeatRunId (lien vers agent run existant)
workflow_instances ← traces.workflowInstanceId
stage_instances ← traces.stageInstanceId
agents ← traces.agentId
users ← trace_lenses.userId
```

### Nouvelles tables

```
traces                          -- Un container par agent run
  + parentTraceId (FK self-ref) -- lien sub-agent → parent
trace_observations              -- Chaque action factuelle (tool call, generation, event)
trace_lenses                    -- Les prompts d'analyse de chaque user
trace_lens_results              -- Les resultats d'analyse caches (lens × trace OU lens × workflow)
  + workflowInstanceId (FK)     -- pour les analyses workflow-level (multi-agent)
```

### Relations multi-agent

```
workflow_instance (la mission/story)
  ├── stage_instance (stage PM)
  │     └── trace (agent PM) ──→ trace_observations
  │           └── trace (sub-agent) ← parentTraceId
  ├── stage_instance (stage Dev)      ← peut tourner en parallele
  │     └── trace (agent Dev) ──→ trace_observations
  ├── stage_instance (stage QA)
  │     └── trace (agent QA) ──→ trace_observations
  └── stage_instance (stage Review)
        └── trace (agent Review) ──→ trace_observations

trace_lens_results peut pointer vers :
  - (lensId + traceId) = analyse d'un seul agent run
  - (lensId + workflowInstanceId) = analyse cross-agent de toute la story
```

### Mapping Langfuse → MnM

| Langfuse | MnM | Difference |
|----------|-----|------------|
| Trace viewer (raw) | "Voir le brut" (drill-down) | Pas la vue par defaut |
| — | Lens Analysis (prompt-driven) | **N'existe pas dans Langfuse** |
| — | Workflow Story View (multi-agent timeline) | **N'existe pas** |
| — | Cross-agent lens ("compare PM vs Dev") | **N'existe pas** |
| — | Live multi-agent conflict detection | **N'existe pas** |
| Dashboard metrics | Header trace (cost, duration) | Similar |
| — | Suggestions guidees | **N'existe pas** |
| — | Context pane integration | **N'existe pas** |

---

## 7. API Design

### Traces (inchange)

```
POST   /api/companies/:companyId/traces
POST   /api/companies/:companyId/traces/:traceId/observations
POST   /api/companies/:companyId/traces/:traceId/observations/batch
PATCH  /api/companies/:companyId/traces/:traceId/observations/:obsId
PATCH  /api/companies/:companyId/traces/:traceId/complete
GET    /api/companies/:companyId/traces
GET    /api/companies/:companyId/traces/:traceId
```

### Lenses (NOUVEAU)

```
POST   /api/companies/:companyId/trace-lenses              — creer une lens
GET    /api/companies/:companyId/trace-lenses              — lister mes lenses + templates
PUT    /api/companies/:companyId/trace-lenses/:lensId      — editer
DELETE /api/companies/:companyId/trace-lenses/:lensId      — supprimer
POST   /api/companies/:companyId/trace-lenses/:lensId/analyze/:traceId  — lancer l'analyse
GET    /api/companies/:companyId/trace-lenses/:lensId/results/:traceId  — recuperer le resultat cache
```

---

## 8. Risques & Mitigations

| Risque | Prob. | Impact | Mitigation |
|--------|-------|--------|------------|
| **Cout LLM des analyses** — chaque lens × trace = un appel LLM | Haute | Cout | Caching agressif (lens+trace = 1 result). Estimation cout affichee avant lancement. Modele Haiku par defaut (pas cher). Rate limit analyses/user/jour. |
| **Qualite des analyses** — le LLM produit du generique | Moyenne | UX degradee | Prompt systeme strict avec guidelines de specificite. Feedback loop : l'user peut noter "utile/pas utile". Templates pre-build bien testes. |
| **Latence analyse** — attente 5-10s pour le LLM | Haute | UX | Streaming de la reponse (SSE). Afficher le brut factuel pendant que l'analyse charge. Cache pour les re-ouvertures. |
| **Traces trop longues pour le context LLM** — 200+ obs depassent le context window | Moyenne | Analyse tronquee | Pre-processing : grouper les tool calls consecutifs du meme type, tronquer I/O, prioriser erreurs. Pagination si necessaire. |
| **Adapter instrumentation limitee** — certains agents n'emettent pas de stream-json | Moyenne | Feature incomplete | Claude = priorite (stream-json riche). Cursor = fallback sur stdout parsing. Autres = observations basiques (start/end/cost). |

---

*Generated by BMAD Method v6 — Product Manager*
*Informed by 3 brainstorming sessions + 3 user feedback iterations*
