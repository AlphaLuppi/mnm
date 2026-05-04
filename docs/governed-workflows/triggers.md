# Workflow Autonomous Triggers

Statut : Phase 2 livrée (REST + MCP + schedule tick, 2026-05-04).
Phases ouvertes : Phase 3 (issue triggers), Phase 4 (UI Studio tab).

## Vue d'ensemble

Un *workflow trigger* est un handle stable qui permet à un Governed Workflow (ou à l'une de ses étapes) d'être actionné depuis n'importe quel canal externe sans qu'un humain ne soit présent au moment du déclenchement. Trois canaux, trois actions, une seule table : `workflow_triggers`.

| Canal      | Quand ça déclenche                                          | Auth au fire     |
| ---------- | ----------------------------------------------------------- | ---------------- |
| `schedule` | cron 5-champs avec timezone IANA, tick toutes les 30s       | aucune (server)  |
| `webhook`  | POST signé externe (GitLab CI / GitHub Actions / N8N / …)   | HMAC ou Bearer   |
| `issue`    | événement issue (Phase 3 — pas encore livré)                | server (matching) |

Les trois actions sont :

| Action          | Effet sur le workflow Governed                                |
| --------------- | ------------------------------------------------------------- |
| `launch_run`    | Démarre un nouveau run avec les `inputs` mappés (= `payloadTemplate` + `body.inputs`) |
| `launch_step`   | Avance la step `stepKey` dans un run existant (`body.runId`)  |
| `complete_step` | Approuve/rejette une step HITL — `body.verdict` = `"approved"` ou `"rejected"`, soumis à la whitelist `allowed_step_keys` |

L'invariant §1.7 (traçabilité humaine) est posé via `created_by_user_id NOT NULL` sur la table : chaque fire est attribuable à l'humain qui a créé le trigger, même quand l'appel arrive d'un script de CI sans session.

## Modèle de données

```
workflow_triggers
  id, company_id (FK cascade), workflow_def_ref (texte non-FK pour survivre aux retags),
  kind (schedule|webhook|issue), action (launch_run|launch_step|complete_step),
  step_key, allowed_step_keys (jsonb whitelist), label, enabled,
  -- Schedule
  cron_expression, timezone, next_run_at,
  -- Webhook
  public_id (UNIQUE partial), secret_hash (AES-256-GCM), signing_mode (bearer|hmac_sha256),
  replay_window_sec, last_rotated_at,
  -- Issue (Phase 3)
  issue_match (jsonb),
  -- Common
  payload_template, last_fired_at, last_result,
  created_by_user_id, created_at, updated_at

workflow_trigger_audit
  id, company_id, trigger_id (FK SET NULL — préserve l'historique),
  workflow_def_ref, action, outcome (ok | replayed | error:<msg>),
  run_id, step_execution_id, idempotency_key (UNIQUE partial sur (company_id, trigger_id)),
  payload (jsonb sanitized), actor_user_id, created_at
```

RLS PERMISSIVE+RESTRICTIVE+FORCE sur les deux tables (pattern post-0080). Permission `workflows:manage_triggers` requise pour la CRUD.

## Format `workflow_def_ref`

Trois formes acceptées par `parseWorkflowDefRef` :

- `workflows/release-engineering@v3` — canonical, mirror de `composite.uses`
- `workflows/qa-validation` — pas de pinning, le service résout HEAD
- `release-engineering` — convenience form, équivalent au précédent

Le ref reste typé `text` (pas de FK vers `governed_workflow_definitions`) — un trigger survit donc à un rename / retag sans rewrite.

## CRUD via REST

Préfixe : `/companies/:companyId/workflow-triggers`. Toutes les routes CRUD requièrent la permission `workflows:manage_triggers`.

```bash
# Créer un trigger schedule (cron toutes les 5 minutes en France)
curl -X POST /companies/$CID/workflow-triggers \
  -H "Authorization: Bearer $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowDefRef": "workflows/release-engineering@v3",
    "kind": "schedule",
    "action": "launch_run",
    "cronExpression": "*/5 * * * *",
    "timezone": "Europe/Paris",
    "label": "Release engineering — cron 5min",
    "payloadTemplate": { "channel": "scheduled" }
  }'

# Créer un trigger webhook HMAC (pour pipeline GitLab)
curl -X POST /companies/$CID/workflow-triggers \
  -H "Authorization: Bearer $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowDefRef": "workflows/qa-validation@v1",
    "kind": "webhook",
    "action": "launch_run",
    "signingMode": "hmac_sha256",
    "label": "QA — déclenchement par CI"
  }'
# → Réponse 201 inclut `secret` (one-shot, à copier dans la CI)
#   et `publicId` (à utiliser dans l'URL de fire)

# Lister les triggers d'un workflow
curl /companies/$CID/workflow-triggers?workflowDefRef=workflows/qa-validation@v1

# Rotater le secret (l'ancien est invalidé immédiatement)
curl -X POST /companies/$CID/workflow-triggers/$TID/rotate-secret \
  -H "Authorization: Bearer $SESSION"
```

Le champ `secret_hash` (chiffré at rest avec AES-256-GCM) n'est jamais retourné par l'API — la version plaintext n'est exposée qu'à la création et à la rotation, en one-shot.

## Fire d'un webhook trigger

`POST /companies/:companyId/workflow-triggers/public/:publicId/fire`

Pas de session BetterAuth — l'authentification est purement par la signature du payload + une `Idempotency-Key` obligatoire.

### Headers obligatoires

| Header                  | Mode      | Description                                          |
| ----------------------- | --------- | ---------------------------------------------------- |
| `Idempotency-Key`       | tous      | UUID ou identifiant côté caller (PIPELINE_ID, SHA, …) |
| `Authorization`         | bearer    | `Bearer <secret>` (constant-time compare)            |
| `X-Trigger-Signature`   | hmac_sha256 | HMAC-SHA256 hex de `${timestamp}.${rawBody}`       |
| `X-Trigger-Timestamp`   | hmac_sha256 | Unix-epoch en secondes                              |

La fenêtre de replay est `replay_window_sec` (défaut 300 secondes). Une dérive horaire > la fenêtre fait rejeter avec `400 Timestamp outside replay window`.

### Body

```json
{
  "inputs": { "version": "1.2.3" },
  "runId": "uuid (pour launch_step / complete_step)",
  "stepExecutionId": "uuid (pour complete_step)",
  "verdict": "approved | rejected (pour complete_step)",
  "note": "string (pour complete_step)"
}
```

Pour `launch_run`, les `inputs` du body sont mergés sur le `payloadTemplate` du trigger (le body gagne en cas de collision).

### Réponses

| Statut | Cas                                                                |
| ------ | ------------------------------------------------------------------ |
| 202    | Première fire valide — `runId` + `auditId` retournés               |
| 200    | Replay (Idempotency-Key déjà vu) — pas de nouveau fire downstream |
| 400    | Body invalide / timestamp hors fenêtre / signature manquante      |
| 401    | Signature invalide                                                 |
| 403    | `complete_step` non whitelisté dans `allowed_step_keys`            |
| 404    | Public id inconnu                                                  |
| 409    | Trigger désactivé / pas un kind=webhook                            |

## Snippets — intégrations courantes

### GitLab CI

Stockez deux variables CI : `MNM_TRIGGER_PUBLIC_ID` et `MNM_TRIGGER_SECRET`.

```yaml
# .gitlab-ci.yml
fire-mnm-workflow:
  stage: deploy
  image: alpine:3.19
  before_script: [apk add --no-cache curl]
  script:
    - |
      TS=$(date +%s)
      BODY="{\"inputs\":{\"commit\":\"$CI_COMMIT_SHA\",\"pipeline\":\"$CI_PIPELINE_ID\"}}"
      SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$MNM_TRIGGER_SECRET" -binary | xxd -p -c 256)
      curl -fsS -X POST "$MNM_API_URL/companies/$MNM_COMPANY_ID/workflow-triggers/public/$MNM_TRIGGER_PUBLIC_ID/fire" \
        -H "Idempotency-Key: $CI_PIPELINE_ID" \
        -H "X-Trigger-Signature: $SIG" \
        -H "X-Trigger-Timestamp: $TS" \
        -H "Content-Type: application/json" \
        -d "$BODY"
```

### GitHub Actions

```yaml
# .github/workflows/fire-mnm.yml
- name: Fire MnM workflow trigger
  env:
    MNM_TRIGGER_SECRET: ${{ secrets.MNM_TRIGGER_SECRET }}
    MNM_TRIGGER_PUBLIC_ID: ${{ vars.MNM_TRIGGER_PUBLIC_ID }}
  run: |
    TS=$(date +%s)
    BODY=$(jq -nc --arg sha "$GITHUB_SHA" --arg run "$GITHUB_RUN_ID" \
      '{inputs:{commit:$sha,run:$run}}')
    SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$MNM_TRIGGER_SECRET" -binary | xxd -p -c 256)
    curl -fsS -X POST "${{ vars.MNM_API_URL }}/companies/${{ vars.MNM_COMPANY_ID }}/workflow-triggers/public/${MNM_TRIGGER_PUBLIC_ID}/fire" \
      -H "Idempotency-Key: $GITHUB_RUN_ID" \
      -H "X-Trigger-Signature: $SIG" \
      -H "X-Trigger-Timestamp: $TS" \
      -H "Content-Type: application/json" \
      -d "$BODY"
```

### N8N

Configurez un node *HTTP Request* avec :

- Method : POST
- URL : `https://<mnm-host>/companies/{{ $env.MNM_COMPANY_ID }}/workflow-triggers/public/{{ $env.MNM_TRIGGER_PUBLIC_ID }}/fire`
- Headers :
  - `Idempotency-Key` : `{{ $execution.id }}`
  - `Content-Type` : `application/json`
- Authentication : "Header Auth" (mode bearer) → `Authorization: Bearer {{ $env.MNM_TRIGGER_SECRET }}`
- Body (JSON) : `{ "inputs": {{ $json.inputs }} }`

Le mode bearer est plus simple à câbler en N8N car il n'y a pas de calcul HMAC à faire — utilisez-le pour les workflows qui n'exigent pas la protection contre la rejouabilité (un secret leaké permet de rejouer indéfiniment).

## CRUD via MCP (parité)

Tous les tools requièrent la permission `workflows:manage_triggers`.

| Tool                              | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `list_workflow_triggers`          | List + filtre par `workflow_def_ref` / `kind`        |
| `get_workflow_trigger`            | Fetch par id                                         |
| `create_workflow_trigger`         | Création — retourne `secret` one-shot pour webhook   |
| `update_workflow_trigger`         | Update mutable fields                                |
| `delete_workflow_trigger`         | Suppression (audit history préservé via FK SET NULL) |
| `rotate_workflow_trigger_secret`  | Rotate webhook secret — retourne nouveau plaintext   |

Le public fire n'est PAS exposé en MCP — un agent qui veut démarrer un run appelle directement `launch_governed_workflow`.

## Sécurité — résumé

| Garde-fou                          | Où                                  | Note                                                                          |
| ---------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `pg_advisory_xact_lock` per-def    | `launchWorkflow`                    | Hérité du service Governed Workflows                                          |
| RLS `tenant_isolation` RESTRICTIVE | les 2 tables                        | `app.current_company_id` posé par middleware HTTP + `setTenantContext` MCP    |
| Idempotency dedup AVANT signature  | `verifyAndFire`                     | Une clé leakée seule ne peut que LOOKUP, pas refire                           |
| `allowed_step_keys` whitelist      | `assertCreateInput` + `dispatch`    | Une signature leakée ne peut compléter que les steps whitelistées             |
| AES-256-GCM at rest                | `secret_hash` + `_webhook-signing.ts` | Master key via `MNM_SECRETS_MASTER_KEY` env ou `data/secrets/master.key`     |
| Replay window                      | HMAC mode                           | Défaut 300s, configurable per-trigger via `replay_window_sec`                 |
| Constant-time compare              | bearer + HMAC                       | `crypto.timingSafeEqual` après check de longueur                              |
| Sanitize audit payload             | `verifyAndFire`                     | Strip `authorization`, `x-trigger-signature`, `secret`, `token`, `api_key`, … |

## Observabilité

- Chaque fire (succès, replay, ou erreur) écrit une ligne dans `workflow_trigger_audit`. Une ligne par trigger contient `payload`, `outcome`, `run_id` — c'est l'historique pour debug.
- Cinq events SSE émis : `workflow_trigger.{created, updated, deleted, secret_rotated, fired}`. Le Studio UI les consomme (Phase 4) pour afficher les fires en live.
- Le tick log (`logger.info({ fired: results.length, results }, "workflow trigger schedule tick fired")`) est écrit toutes les 30s seulement si la liste a au moins une ligne, donc le log reste propre quand rien ne se passe.

## Variables d'environnement

| Var                              | Défaut          | Effet                                                                |
| -------------------------------- | --------------- | -------------------------------------------------------------------- |
| `MNM_DISABLE_AUTO_TRIGGERS=1`    | absent          | Désactive le tick (aussi bien routine que workflow)                  |
| `MNM_WORKFLOW_TRIGGER_TICK_MS`   | 30000           | Période du tick (fallback `MNM_ROUTINE_TICK_MS` puis 30000)          |
| `MNM_SECRETS_MASTER_KEY`         | auto-bootstrap  | Master key AES-256-GCM, hex/base64/utf8 32 bytes                     |
| `MNM_SECRETS_MASTER_KEY_FILE`    | `data/secrets/master.key` | Path alternatif si l'env var est absente                       |

## Multi-instance — TODO V1

Le tick V0 est single-leader (mono-instance) avec un guard `tickInFlight` qui empêche la superposition. Pour multi-instance il faudra envelopper le scan dans un `pg_advisory_xact_lock(hashtext('mnm:workflow-trigger-tick'))` pris dans une transaction qui survit au dispatch loop. Tracé dans `docs/superpowers/plans/2026-05-04-workflow-autonomous-triggers.md` §0.1.
