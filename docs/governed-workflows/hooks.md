# Workflow Hooks — guide utilisateur

Les **hooks** sont des morceaux de code qui s'exécutent automatiquement autour d'un workflow ou d'un step pour produire des **side-effects** : créer un ticket Jira, importer une tâche ClickUp, poster un message Slack, déclencher un appel LLM, etc.

Ils n'altèrent jamais l'artifact d'un step. Ils notifient des systèmes externes ou enrichissent le contexte d'un run, sous l'identité du **user humain** qui a triggered le run (jamais d'un service account — voir invariant traçabilité humaine §1.7).

> Ce doc cible les utilisateurs (admin company, auteurs de workflow). Les patterns d'implémentation runtime / sandbox sont dans [`.claude/rules/governed-workflows.md`](../../.claude/rules/governed-workflows.md) et le plan [`enterprise-pilot-foundation`](../superpowers/plans/2026-05-01-enterprise-pilot-foundation.md).

---

## Concepts fondamentaux

### Les 4 phases d'exécution

Un hook se branche sur l'une des 4 phases du cycle de vie d'un governed run :

| Phase | Quand | Usage typique |
|---|---|---|
| `before_run` | À `launchWorkflow`, avant le premier step | Vérif pré-vol (quotas, freeze period), notification "run started" |
| `after_run` | À la complétion du dernier step (terminal) | Envoyer un récap Slack, poster le résumé sur Jira, archiver |
| `before_step` | À `launchStep`, avant que l'agent / le runner ne touche au step | Hydrater le context (lire un ticket Jira lié), check quota |
| `after_step` | À `completeStep` quand la step a `state="succeeded"` | Commenter Jira, créer une tâche ClickUp avec le résultat, déclencher un build |

**Note importante :** un hook `after_run` est exécuté en **fire-and-forget** (le run est déjà terminé du point de vue du user). Si le hook timeout ou crash, le run reste `succeeded`. Voir « Troubleshooting » plus bas pour l'audit.

### 3-tier visibility (canonical / shared / local)

Tout comme les gates, les hooks suivent les 3 tiers de résolution :

| Tier | Référence | Source | Qui peut l'écrire ? |
|---|---|---|---|
| **Canonical** | `canonical:<name>` | `packages/workflow-hooks/canonical/` (shippé MnM) | Équipe MnM (PR upstream) |
| **Shared** | `shared:<name>` | Repo gitlab `<company>/workflows/_shared/hooks/` | Admins company (mutualisé entre tous les workflows) |
| **Local** | `local:<name>` | `<workflow-repo>/hooks/<name>.hook.ts` | Auteur du workflow concerné |

Le **resolver** lit dans cet ordre : `local` (workflow courant) → `shared` (repo `_shared` company) → `canonical` (MnM). Le premier match gagne. Une référence `canonical:foo` ne tombera **jamais** vers un hook local du même nom — la résolution est explicite par le préfixe.

### Tier 3 enforced (DSI / sécurité)

Une `workflow_hooks_config` peut avoir `enforced=true` (permission `hooks:enforce` requise pour la créer). Un hook **enforced** s'exécute sur **tous les runs de la company** sans devoir être listé dans le `workflow.json`. Cas typiques :

- Audit log centralisé : « tout run qui touche le repo prod doit notifier le SOC »
- Conformité : « tout run avec un artifact contenant `pii=true` doit poster sur le canal compliance »

Un user qui écrit un workflow ne peut pas désactiver un hook enforced. C'est l'inflexion enterprise du système.

---

## Pattern : déclarer un hook dans `workflow.json`

Un workflow déclare ses hooks au niveau **workflow** (s'applique à tous les steps) ou **step** (scoped à ce step uniquement).

```json
{
  "name": "feature-dev",
  "version": "1.0.0",
  "hooks": [
    {
      "ref": "canonical:jira-comment-on-complete",
      "phase": "after_step",
      "config": {
        "issueKey": "PROJ-123",
        "commentTemplate": "Step `{{step.id}}` ✅ — run {{run.id}}"
      }
    }
  ],
  "steps": [
    {
      "id": "design",
      "agent": "mnm--architect",
      "hooks": [
        {
          "ref": "shared:notify-design-channel",
          "phase": "after_step",
          "config": { "slackChannel": "#design-review" }
        }
      ]
    }
  ]
}
```

### Le bloc `config` — variables passées au hook

Chaque hook canonical déclare un `configSchema` (visible via le **Hook Catalog** dans la page `/hooks`). Les champs sont validés avant l'exécution. Exemple pour `canonical:jira-comment-on-complete` :

| Champ | Type | Description |
|---|---|---|
| `issueKey` | string | Issue key Jira (ex. `PROJ-123`). Requis sauf si `issueKeyFromArtifactPath` set. |
| `issueKeyFromArtifactPath` | string | Dot-path dans `artifact.data` (ex. `metadata.jira_key`) |
| `providerSlug` | string | Connector slug (default `"jira"`) |
| `commentTemplate` | string | Template Mustache-light. Tokens : `{{step.id}}`, `{{run.id}}`, `{{run.git_tag}}`, `{{artifact.<path>}}` |

**Important :** la **config** ne contient JAMAIS de credentials (token, password, API key). L'authentification est résolue côté serveur via le **Connectors hub** (`providerSlug`) sous l'identité du user humain qui a triggered le run. Voir « Sécurité » plus bas.

---

## Exemple complet : `jira-comment-on-complete`

Workflow `feature-dev` qui commente automatiquement le ticket Jira lié quand le step `implementation` complète :

```json
{
  "name": "feature-dev",
  "version": "1.0.0",
  "steps": [
    {
      "id": "design",
      "agent": "mnm--architect"
    },
    {
      "id": "implementation",
      "agent": "mnm--developer",
      "depends_on": ["design"],
      "hooks": [
        {
          "ref": "canonical:jira-comment-on-complete",
          "phase": "after_step",
          "config": {
            "issueKeyFromArtifactPath": "linked_jira_issue",
            "commentTemplate": "Implementation step shipped — run [{{run.id}}]({{run.url}}) ({{run.git_tag}})"
          }
        }
      ]
    }
  ]
}
```

L'agent du step `implementation` retourne un artifact dont `data.linked_jira_issue = "PROJ-456"`. Au `completeStep`, le hook lit la valeur, render le template, fetch le connecteur Jira (token OAuth user-level) et POST le comment via Atlassian REST API v3.

L'audit row est créée AVANT l'appel HTTP (status `pending`) puis UPDATE après (`succeeded` ou `failed`). Visible dans `/hooks/executions` (REST `GET /workflow-hooks/executions`).

---

## Sécurité — ce que tu dois savoir

### Kill-switch global

L'admin instance peut couper **tous** les hooks via la variable d'env `MNM_HOOKS_ENABLED=false`. Aucun hook ne s'exécutera, y compris les enforced. Utile en cas d'incident (provider externe down qui timeout en boucle, hook compromis, etc.).

### Sandbox isolated-vm (utilisateur ↔ host)

Un hook tourne dans une **isolate V8** sans accès direct à `fs`, `net`, `require`. Tout I/O passe par les helpers fournis par le host :

- `ctx.helpers.http({ provider, method, path, body })` — fetch authentifié via le Connectors hub
- `ctx.helpers.llm({ prompt, model })` — call LLM via le Config Layer
- `ctx.helpers.fetchHandoff({ git_sha, path })` — lire un artifact via le runner

**Aucun helper ne retourne un credential en clair à l'isolate.** L'authentification est injectée côté host avant le fetch. Un hook qui essaie d'accéder à un token via `ctx.helpers.credential` retournera `undefined` — l'API a été supprimée pour cette raison.

### OAuth user-level (pas de service account)

Quand `helpers.http` envoie une requête, le token OAuth utilisé est celui du **user humain** qui a triggered le run, pas un compte technique partagé. Un user qui n'a pas connecté son compte Jira via `/settings/accounts` verra le hook fail avec `HOOK_NO_USER_TOKEN` — il devra connecter son compte.

C'est l'invariant traçabilité humaine §1.7 : tout call externe est attribuable à un user identifiable, jamais à un service account anonyme.

### Limites runtime

| Limite | Valeur | Pourquoi |
|---|---|---|
| Timeout d'un hook | 30s | Évite les hooks bloquants (gates : 3s, plus strict) |
| Body HTTP max | 1 MB | Cap mémoire isolate |
| Retries (429 / 5xx) | 3 max, backoff exponentiel | Robustesse vs flaky providers |
| Concurrent hooks par company | 5 | Évite l'épuisement du pool worker |
| Body request max | 256 KB | Cap upload depuis le hook |

---

## Troubleshooting

### Mon hook ne s'exécute pas

1. **Vérifier `enabled`** : la `workflow_hooks_config` peut être désactivée. Page `/hooks` → toggle inline.
2. **Vérifier la phase** : un hook `after_step` ne sera jamais déclenché par un step qui fail (state `failed` ou `errored`).
3. **Vérifier le kill-switch** : env `MNM_HOOKS_ENABLED` doit être `true` (default) sur l'instance.
4. **Visibility** : un hook avec visibility `private` ne s'exécute que pour son owner. Visibility `tags` exige une intersection non-vide entre les tags du hook et les tags du run. Voir [3-tier visibility](../decision-log.md#1.6).

### Audit row reste en `pending`

Cela indique que **l'appel HTTP n'a jamais retourné** (process tué, OOM kill, host crash entre le INSERT et l'UPDATE). C'est un signal d'incident :

```
GET /workflow-hooks/executions?status=pending&age_gt=5m
```

ou via MCP :

```
list_workflow_hook_executions({status: "pending", age_minutes: 5})
```

Si la liste contient des rows, investigate les logs serveur (le runner a probablement timeout ou crashed pendant l'appel).

### `HOOK_NO_USER_TOKEN`

Le user qui a triggered le run n'a pas connecté le provider référencé (`providerSlug`). Direction : `/settings/accounts` → connecter Jira / ClickUp / etc. Le hook re-tentera au prochain run (pas de retry automatique sur le run courant).

### `HOOK_INVALID_CONFIG`

Le `configSchema` du hook a refusé la config fournie. Le `report` dans l'audit row contient le détail. Corriger dans le `workflow.json` ou dans la `workflow_hooks_config` (UI page `/hooks` → Sheet detail).

### `HOOK_PROVIDER_ERROR`

Le provider externe a retourné un status >= 400. Le `data.status` et `data.body` dans l'audit row contiennent la réponse. Causes fréquentes :

- Token OAuth expiré → re-connect dans `/settings/accounts`
- Rate limit (429) → le runner retry 3x ; si persistance, attendre la fenêtre
- Permission insuffisante (403) → vérifier les scopes OAuth (ex. `write:jira-work`)

---

## Liens utiles

- Architecture & runtime sandbox : [`.claude/rules/governed-workflows.md`](../../.claude/rules/governed-workflows.md)
- 3-tier visibility (private / tags / public) : [`docs/decision-log.md` §1.6](../decision-log.md)
- Connectors hub OAuth : [`docs/governed-workflows/oauth-setup.md`](./oauth-setup.md)
- Plan de livraison : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](../superpowers/plans/2026-05-01-enterprise-pilot-foundation.md)
