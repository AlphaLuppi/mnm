# Plan — Workflow Autonomous Triggers (modèle unifié)

Date : 2026-05-04
Auteur : Tom (request) + Claude (drafting)
Statut : draft, à valider avant Phase 0

## Contexte

L'audit du 2026-05-04 (`docs/superpowers/plans/` — pas de plan existant sur ce sujet) a révélé que MnM a **deux moteurs de triggers découplés** :

1. **Routines** — table `routines` + `routine_triggers` (kind `schedule|webhook|api`). Crée une *issue* à chaque fire, qui est dispatchée à un agent. **Le cron tick est codé mais jamais appelé** (`tickScheduledTriggers` non wiré dans `server/src/index.ts`). `syncRunStatusForIssue` non câblé non plus.
2. **Governed Workflows** — `services/governed-workflows.ts` + MCP tools. Lancement uniquement via UI, REST authentifié, ou MCP par un agent connecté. **Aucun webhook entrant, aucun scheduling, aucun trigger sur événement issue.**

Le besoin Tom : **les workflows et leurs steps doivent devenir des unités de travail actionnables depuis n'importe quel canal**, avec trois actions de base :
- **A.** lancer un nouveau workflow run (avec inputs)
- **B.** lancer/avancer une step dans un run existant
- **C.** valider/compléter une step en attente (HITL approval)

Trois canaux d'entrée :
1. **Routine** (cron + manual + chained)
2. **Issue** — soit via un champ explicite dans l'issue, soit par décision d'un agent qui juge pertinent de lancer un workflow
3. **Webhook externe** — pipeline GitLab CI, GitHub Action, automation N8N, ou tout autre système qui peut faire un POST signé

Le compute reste **côté client** (Claude Code + plugin MnM) — le serveur orchestre, le PC user exécute. Tous les triggers convergent donc vers `governedWorkflows.launchWorkflow()` / `launchStep()` / `completeStep()` (déjà existants), pas vers une nouvelle exec engine.

## Invariants à respecter

- **Traçabilité humaine universelle** (`docs/decision-log.md §1.7`) : tout trigger fire sous l'identité du user qui a créé le trigger. Pas de service account. Pour les webhooks externes, `initiated_by_user_id = trigger.created_by_user_id` (auditable). Pour la décision agent, l'agent porte le `created_by_user_id` de son créateur (déjà le cas).
- **Multi-tenant strict** : `company_id` non-null + RLS PERMISSIVE+RESTRICTIVE+FORCE (`.claude/rules/database.md §2`). Toutes les routes via `/companies/:companyId/`.
- **Compute côté client** : pas d'execution serveur, juste orchestration + dispatch SSE/MCP.
- **Zero polling** côté UI : tout via SSE existant.
- **Aucun nom client / personne externe** dans le code, doc ou commit (CLAUDE.md règle absolue).

---

## Phase 0 — Fix bugs critiques (small, ~0.5j)

Avant de construire dessus, on règle les deux bugs qui rendent les routines à moitié mortes.

### 0.1 Wirer le cron tick

- Dans `server/src/index.ts`, après le démarrage du serveur, lancer une boucle :
  ```ts
  const TICK_MS = Number(process.env.MNM_ROUTINE_TICK_MS ?? 30_000);
  if (process.env.MNM_DISABLE_AUTO_TRIGGERS !== "1") {
    setInterval(() => routineService.tickScheduledTriggers().catch(logError), TICK_MS);
  }
  ```
- Dans `tickScheduledTriggers` (`services/routines.ts:960`), envelopper le scan dans un `pg_advisory_xact_lock(hashtext('mnm:routine-tick'))` pour serializer les ticks en multi-instance (cf. `.claude/rules/database.md §4`).
- Logguer chaque tick avec count fired pour observabilité.

**Acceptance** :
- Routine schedulée `*/1 * * * *` fire 60s après création.
- Deux instances serveur lancées en parallèle ne double-fire pas (vérifié par count des `routine_runs`).
- `MNM_DISABLE_AUTO_TRIGGERS=1` désactive le tick proprement (rollback rapide).

### 0.2 Câbler `syncRunStatusForIssue`

- Dans la route PATCH/PUT de `server/src/routes/issues.ts` (handler de transition de status), après l'update, appeler `routineService.syncRunStatusForIssue(issueId, newStatus)`.
- Si l'issue est liée à un `routine_runs.linked_issue_id`, mettre à jour le `status` du run (ex: `done` → `completed`).

**Acceptance** :
- Issue créée par routine, marquée `done` → `routine_runs.status = 'completed'`, `completed_at` posé.
- Issue non liée à une routine → no-op silencieux.

### 0.3 Risques + rollback

- Risque : si `tickScheduledTriggers` panic, le `setInterval` devient inerte. → wrapper avec `.catch(logError)` et test que la boucle survit à une exception.
- Rollback : env var `MNM_DISABLE_AUTO_TRIGGERS=1` + revert.

---

## Phase 1 — Table `workflow_triggers` unifiée (medium, ~1j)

**Objectif** : étendre le modèle `routine_triggers` pour les Governed Workflows, sans dupliquer le code de signature/replay.

### 1.1 Migration `0084_workflow_triggers.sql`

```sql
CREATE TABLE IF NOT EXISTS "workflow_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "workflow_def_ref" text NOT NULL,        -- "workflows/release-engineering@v3" ou def id
  "kind" text NOT NULL,                    -- 'schedule' | 'webhook' | 'issue'
  "action" text NOT NULL,                  -- 'launch_run' | 'launch_step' | 'complete_step'
  "step_key" text,                         -- requis si action != 'launch_run'
  "allowed_step_keys" jsonb DEFAULT '[]',  -- whitelist pour 'complete_step' (sécurité)
  "label" text,
  "enabled" boolean NOT NULL DEFAULT true,
  -- Schedule
  "cron_expression" text,
  "timezone" text,
  "next_run_at" timestamptz,
  -- Webhook
  "public_id" text,
  "secret_hash" text,
  "signing_mode" text,                     -- 'bearer' | 'hmac_sha256'
  "replay_window_sec" integer DEFAULT 300,
  "last_rotated_at" timestamptz,
  -- Issue
  "issue_match" jsonb,                     -- { tags?: string[], project?: string, status?: string[] }
  -- Payload mapping (inputs)
  "payload_template" jsonb DEFAULT '{}',   -- JSONata-style ou simple {input: "$.body.field"}
  -- Common
  "last_fired_at" timestamptz,
  "last_result" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_triggers_kind_check"
    CHECK ("kind" IN ('schedule','webhook','issue')),
  CONSTRAINT "workflow_triggers_action_check"
    CHECK ("action" IN ('launch_run','launch_step','complete_step'))
);
-- Index company-first (database.md §1)
-- Unique partial sur public_id (cf routine_triggers)
-- RLS PERMISSIVE + RESTRICTIVE + FORCE (database.md §2)
```

Ajouter aussi `workflow_trigger_audit` (table append-only des fires : trigger_id, payload reçu, action prise, run_id résultant, success/failure, created_at). Idempotency via index unique `(company_id, trigger_id, idempotency_key)`.

### 1.2 Refactor commun

- Extraire `services/_webhook-signing.ts` depuis `services/routines.ts:1095-1130` : helpers `verifyHmacSignature`, `verifyBearerSecret`, `encryptSecretAtRest`, `rotateSecret`. Réutilisé par routines + workflow_triggers.
- Extraire `services/_cron.ts` depuis `services/routines.ts:215` : `nextCronTick`, parser 5-champs avec DST.

**Acceptance** :
- Migration applique cleanly + test `0084_workflow_triggers.test.ts` (regex sur SQL, pattern `0067_agents_archived_at.test.ts`).
- Routines passent toujours leurs tests (régression zéro après extraction).
- 17/17 typecheck.

### 1.3 Risques + rollback

- Risque refactor casse routines : pré-tests Vitest + parité de signature des helpers.
- Rollback migration : `DROP TABLE workflow_triggers, workflow_trigger_audit`.

---

## Phase 2 — Webhooks entrants pour Governed Workflows (medium, ~1.5j)

**Objectif** : un webhook externe (GitLab CI, GitHub Action, N8N) peut faire les 3 actions A/B/C.

### 2.1 Endpoint REST

`POST /companies/:companyId/workflow-triggers/public/:publicId/fire`

- Aucune session BetterAuth requise (path public). Auth purement par signature.
- Header obligatoire : `Idempotency-Key` (sinon 400). Dédup via `workflow_trigger_audit`.
- Body : `{ inputs?: object, runId?: uuid, stepExecutionId?: uuid, verdict?: "approved"|"rejected", note?: string }`.

Pipeline serveur :
1. Resolve trigger par `publicId`. Si `enabled = false` ou `companyId` mismatch → 404 (pas de leak).
2. Verify signature (`bearer` ou `hmac_sha256`) + replay window. → 401 si invalide.
3. Match action selon `trigger.action` :
   - `launch_run` : `governedWorkflows.launchWorkflow(workflowDefRef, mappedInputs, { initiatedByUserId: trigger.createdByUserId })`
   - `launch_step` : check `runId` valide, `stepKey` autorisé, lance `launchStep`
   - `complete_step` : check `stepExecutionId` ∈ `allowedStepKeys`, applique le verdict via le path HITL existant (`completeStep` avec `verdict`)
4. Audit log obligatoire (`workflow_trigger_audit` avec payload + result).
5. Retour 202 `{ runId, stepExecutionId? }`. Pas de bloquant (le client externe ne doit pas attendre la fin du workflow).

### 2.2 Sécurité

- **`allowed_step_keys`** : sur action `complete_step`, le trigger ne peut compléter QUE les steps listées. Sinon n'importe quel webhook valide pourrait approuver n'importe quoi.
- Rate limit per `public_id` (réutiliser `rateLimiter` middleware MnM).
- Secret AES-256-GCM at rest (helper extrait Phase 1.2).
- Permission création trigger : `workflows.manage_triggers` (nouvelle permission, INSERT en migration `0084`).

### 2.3 Doc usage

`docs/governed-workflows/triggers.md` avec snippets prêts à copier :
- GitLab CI : `curl -X POST -H "X-Routine-Signature: ..." -H "Idempotency-Key: $CI_PIPELINE_ID" ...`
- GitHub Actions : action `actions/run-step` + secret repo
- N8N : HTTP node config

### 2.4 Acceptance

- Curl avec HMAC valide → 202 + run lancé visible dans UI workflow runs.
- Curl avec signature invalide → 401, pas d'audit log de succès.
- Replay du même `Idempotency-Key` dans la fenêtre → 200 idempotent (renvoie le run précédent).
- Pipeline GitLab fictive (script bash de test) qui complete une step `qa-validation` → step status passe à `completed` dans l'UI live (SSE).

### 2.5 Risques + rollback

- Risque : signature mal vérifiée → faux positifs → toute pipeline externe peut spammer. → tests unit explicites HMAC + bearer + replay.
- Risque : un webhook approuve une step critique → `allowed_step_keys` strict + audit log + alerte CAO si verdict `rejected` sur step prod.
- Rollback : feature flag company `workflow_triggers.webhooks_enabled` (default off pendant dogfood).

---

## Phase 3 — Issue triggers : explicite + décision agent (medium, ~1.5j)

**Objectif** : une issue peut elle-même être le déclencheur d'un workflow, soit déclaré explicitement à la création, soit décidé par un agent qui lit l'issue.

### 3.1 Mode explicite (param dans l'issue)

- Nouveau champ JSON optionnel sur `issues` : `workflow_request: { workflowDefRef: string, action: 'launch_run', inputs?: object, autoLaunchOn?: 'created'|'ready'|'manual' }`.
- Listener serveur sur `issue.created` ou `issue.transition` (selon `autoLaunchOn`) qui appelle `governedWorkflows.launchWorkflow` avec `initiatedByUserId = issue.createdByUserId`.
- Le run est linké à l'issue (`workflow_runs.linked_issue_id` — nouveau champ, mirroir de `routine_runs.linked_issue_id`).

### 3.2 Mode décision agent

- Nouveau MCP tool `decide_workflow_for_issue(issueId)` : un agent (CAO, chef de projet, …) lit l'issue + son contexte, et retourne `{ shouldLaunch: bool, workflowDefRef?, inputs?, reason: string }`.
- Si `shouldLaunch = true`, le tool appelle directement `launchWorkflow` (l'agent porte les permissions du user qui l'a créé).
- Audit log obligatoire (qui a décidé, sur quelle issue, quel reason).

### 3.3 Garde-fous boucle infinie

- Un workflow lancé par issue → peut créer une issue → décision agent → relance workflow → boucle.
- Solution : `workflow_runs.triggered_by_chain_depth` (int, default 0). Cap à 5 (configurable). `chain_depth = parent.chain_depth + 1`. Au-delà, refuse avec error_code `WORKFLOW_TRIGGER_CHAIN_DEPTH_EXCEEDED` (cf. pattern composite §4.4.2).

### 3.4 Acceptance

- Issue créée avec `workflow_request: { workflowDefRef: "release-engineering@v3", autoLaunchOn: "ready" }` → quand l'issue passe en `ready`, run lancé visible dans UI.
- Agent CAO appelle `decide_workflow_for_issue(uuid)` → si `shouldLaunch=true`, run lancé + audit log.
- Boucle artificielle (workflow X crée issue Y crée workflow X …) coupée à depth 5.

### 3.5 Risques + rollback

- Risque : explicit mode ouvre un vecteur d'escalade (user low-perm crée issue avec workflow admin) → check permissions du `createdByUserId` au moment du launch (déjà fait par `launchWorkflow`).
- Risque : décision agent trop aggressive → CAO peut lancer 100 workflows. → rate limit per agent + cap `chain_depth`.
- Rollback : feature flag `workflow_triggers.issue_mode` per company.

---

## Phase 4 — UI trigger management (small, ~1j)

**Objectif** : page CRUD pour les triggers d'un workflow, avec secret reveal one-time et test du webhook URL.

- Page `/companies/:companyId/governed-workflows/:wfRef/triggers` (route exposée dans `WorkflowStudio` via tab "Triggers").
- Components shadcn (table + dialog create + dialog rotate secret).
- "Tester le webhook" : bouton qui POST un payload de test à l'endpoint local et affiche la réponse.
- Tag-based visibility : seuls les users avec permission `workflows.manage_triggers` voient la page.

**Acceptance** :
- Créer un trigger → secret affiché une seule fois (modal) avec bouton "Copier", puis hashed côté DB.
- Rotate → ancien secret invalidé immédiatement.
- E2E Playwright : full flow create → fire externally → see run.

---

## Phase 5 — MCP parité + doc (small, ~0.5j)

- MCP tools nouveaux dans `server/src/mcp/tools/governed-workflows.tool.ts` :
  - `list_workflow_triggers(workflowDefRef)`
  - `create_workflow_trigger(workflowDefRef, kind, action, …)`
  - `delete_workflow_trigger(triggerId)`
  - `rotate_trigger_secret(triggerId)` → retourne le nouveau secret en clair (one-shot)
  - `decide_workflow_for_issue(issueId)` (Phase 3.2)
- Update `docs/governed-workflows/triggers.md` (nouveau fichier) avec section pour chaque canal + exemples GitLab/GitHub/N8N.
- Update `docs/decision-log.md` : nouvelle entrée §4.7 "Workflow triggers — modèle unifié".
- Update `docs/ARCHITECTURE.md §Governed Workflows` : ajouter mention des 3 canaux de trigger.
- Update parity tracker (`scripts/parity/data.ts`) si UI Triggers tab est web-only ou desktop-aussi.

**Acceptance** :
- Agent Claude Code peut créer un trigger via MCP, fire-le, voir le run.
- 17/17 typecheck.
- Tests E2E Playwright passent.

---

## Build sequence

```
Phase 0 (fix bugs critiques) ────────────────────┐
                                                 │
Phase 1 (table + helpers)                        │
   │                                             │
   ├──→ Phase 2 (webhooks)                       │
   ├──→ Phase 3 (issues)                         ├─→ Phase 5 (MCP + doc)
   │                                             │
   └──→ Phase 4 (UI) ─────────────────────────────┘
```

Phases 2/3/4 peuvent être parallélisées par 3 sub-agents si besoin.

## Estimation totale

~5j single-thread, ~3j si Phases 2/3/4 parallélisées par sprint pipeline (archi → PM → 3×dev → QA E2E ChromeMCP, pattern `feedback_sprint_pipeline_pattern.md` mémoire).

## Spec à écrire ?

Phase 3 (issue triggers + décision agent + boucle infinie) mérite probablement une spec d'archi avant l'impl — `docs/superpowers/specs/2026-05-04-issue-as-workflow-trigger-design.md`. Phases 2/4/5 sont assez triviales pour partir directement du plan.

## Plan d'attaque immédiat (proposition)

1. Valider ce plan avec Tom.
2. Lancer Phase 0 (fix bugs) → atomic commit + push.
3. Décider si on écrit la spec Phase 3 maintenant ou si on fait Phase 1+2 d'abord (le webhook entrant débloque déjà 80% du use case GitLab/N8N).

## Risques transverses

- **Sécurité multi-tenant** : si un webhook trigger company A pouvait fire un workflow company B → blast radius critique. → tous les paths via `/companies/:companyId/`, `assertCompanyMembership` middleware, RLS fail-closed (déjà en place pour le reste du codebase).
- **Loop infinies** : workflow → issue → workflow → … → cap `chain_depth` (Phase 3.3).
- **Cron tick missed** : si le serveur dort 5 min, des triggers peuvent être ratés. → policy `catch_up_policy = run_missed | skip_missed` (déjà en place dans routines, à porter sur workflow_triggers).
- **Webhook spam DDOS** : rate limit per `public_id` + alerting CAO si > N fires/min sur un trigger.

## Rollback global

- Feature flag company `workflow_triggers.enabled` (default off pendant rollout interne).
- Env var `MNM_DISABLE_AUTO_TRIGGERS=1` désactive cron tick + cron tick workflow_triggers.
- Migration revertable (DROP TABLE workflow_triggers, workflow_trigger_audit + revert ALTER TABLE issues si Phase 3 shippée).
