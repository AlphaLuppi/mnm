# Workflow Step Assignments — guide utilisateur

Une **assignment** déclare *à qui* un step d'un governed workflow est destiné. Quand un run atteint un step assigné, les principals concernés voient une carte « Step en attente » dans leur **Inbox**, et le sidebar badge `pendingWorkflowSteps` s'incrémente. Le run reste en `running` jusqu'à ce qu'un agent (humain ou IA) lance puis complète le step.

Les assignments sont calculées au launch (workflow ou step) et **snapshotées** dans `governed_step_assignments` avec un `reason` audit. Pas de polling — la liste se met à jour en SSE via l'event `step.assignment.created`.

> Ce doc cible les utilisateurs (admin company, auteurs de workflow). L'implémentation et les query patterns sont dans [`server/src/services/governed-workflows-assignments.ts`](../../server/src/services/governed-workflows-assignments.ts).

---

## Le bloc `assignment` dans le DSL d'un step

Un step peut contenir un bloc `assignment` qui décrit **qui doit s'occuper** de ce step :

```json
{
  "id": "design-functional",
  "agent": "mnm--architect",
  "assignment": {
    "tags": ["produit", "design"],
    "principals": ["user_42"],
    "roles": ["product-manager"]
  }
}
```

Les 3 champs sont **optionnels** et **cumulatifs** (union — un user qui matche un seul des champs est assigné). Si aucun n'est présent, le step n'est pas assigné (le run le pickup quand même via le DAG ; il n'apparaît juste pas dans une Inbox).

### `tags`

Une liste de tags partagés. Les tags sont déclarés dans la page admin `/admin/tags` (ex. `produit`, `engineer`, `tech-lead`). Le **resolver** matche tous les principals (users, teams, roles) qui partagent au moins un tag avec la liste.

Cas typique : un step de design doit aller à n'importe quel membre de l'équipe produit, sans nommer une personne. La rotation de l'équipe (arrivée / départ) est automatique parce que les tags suivent les principals.

### `principals`

Une liste explicite d'IDs de principals (user, team, agent). Override absolu : "ce step doit aller à ces personnes précises". Utiliser avec parcimonie — préférer les tags pour l'évolution naturelle de l'équipe.

### `roles`

Une liste de noms de rôles dynamiques (RBAC §1.3 — pas de constante hardcodée). Le resolver expand chaque rôle en la liste de users qui l'ont au sein de la company. Cas typique : `roles: ["instance-admin"]` pour un step qui doit être traité par un admin.

---

## Comment ça résout — intersection avec la visibility tags

Le resolver applique l'algorithme suivant à `launchWorkflow` (initial) puis à chaque `launchStep` (delta — un step ajouté après-coup) :

1. **Expand** chaque champ en une liste de `principal_id` :
   - `tags` → tous les principals avec **intersection non-vide** sur les tags du run
   - `roles` → tous les users avec un de ces rôles dans la company
   - `principals` → tels quels
2. **Union** des 3 listes, déduplication par `principal_id`.
3. Pour chaque principal, INSERT `governed_step_assignments` avec un `reason` audit :
   - `tag-intersection` — match via tags
   - `role-expansion` — match via rôle
   - `explicit` — listé en `principals`
   - `delta-launchStep` — ajouté à launchStep, pas au launchWorkflow initial

Le **reason** est consultable dans la console (`GET /workflow-runs/:runId/assignments`) pour debugger « pourquoi cette personne a vu ce step ? ».

### Intersection avec la visibility company

Un step assigné à un user qui **n'a pas accès au workflow** (visibility `tags` sans intersection sur les tags du workflow lui-même) ne sera **pas** assigné. La visibility du workflow est le filtre primaire ; l'assignment est un raffinement à l'intérieur de cette visibility.

Le runner appelle `assertVisibility(workflowId, userId)` avant d'INSERT l'assignment. Si la visibility refuse, le user est silencieusement skippé (audit row avec `reason="visibility-blocked"`).

---

## Côté Inbox — la carte « Step en attente »

L'Inbox d'un user agrège plusieurs catégories : approvals, failed runs, alerts, stale work, agent notifications, **pending workflow steps**, my recent issues. La section "pending workflow steps" affiche la liste des `governed_step_assignments` du user en `state="pending"`.

Chaque carte montre :

- Nom du workflow + step ID
- Run ID + git tag
- Reason badge (« Assigné via tag `produit` »)
- Bouton "Ouvrir le step" → navigue vers `/workflows/<name>/runs/<runId>?step=<stepId>` (mode review 2-col directement)

Le sidebar badge **rolls up** dans le compteur Inbox global. Pas de polling — un nouveau step assigné déclenche `step.assignment.created` (visibility actor-only) qui invalide la query Inbox. Le badge s'incrémente en temps réel.

---

## Filtrer l'Inbox par catégorie

L'URL `/inbox/all?filter=pending_workflow_steps` filtre directement sur cette section, utile pour un user qui veut voir uniquement ses steps governed-workflows à traiter. Les autres catégories disparaissent.

---

## MCP : `list_my_pending_work`

L'agent Claude Code (via plugin MnM) peut consulter ses pending steps via le tool MCP `list_my_pending_work` :

```
{
  "principalId": "user_42",
  "items": [
    {
      "workflow_name": "feature-dev",
      "run_id": "run_abc123",
      "step_id": "design-functional",
      "reason": "tag-intersection",
      "git_tag": "v0.4.2",
      "assigned_at": "2026-05-03T08:42:13Z"
    }
  ]
}
```

Snake_case par parité avec les autres tools MCP (le REST utilise camelCase côté HTTP, voir `governed-workflows-extensions.ts`).

Cas d'usage : un agent CAO qui scan toutes les 30 minutes les pending steps de son user et prépare une checklist pour le standup.

---

## Pattern : assigner par tag pour l'évolution de l'équipe

L'anti-pattern courant est de hard-coder un `principals: ["user_42"]` dans le `workflow.json`. Quand le user_42 part, le workflow est cassé silencieusement — le step est assigné à un fantôme.

**Bon pattern** : déclarer un tag (`produit`, `engineer`, `tech-lead`) dans `/admin/tags` et l'attacher aux users / teams concernés. Le `workflow.json` référence le tag :

```json
{
  "id": "design",
  "assignment": { "tags": ["produit"] }
}
```

Quand un nouveau membre rejoint l'équipe produit, l'admin lui attache le tag `produit` via `/admin/tags`. Le membre voit immédiatement les steps "produit" dans son Inbox sans toucher à un seul `workflow.json`.

C'est la même logique que pour la visibility 3-tier (§1.6) — la délégation à des tags partagés découple le workflow de la composition de l'équipe.

---

## Cas spécial : delta-launchStep

Si un workflow ajoute un step au runtime (cas rare, généralement via un composite ou un re-trigger), les assignments sont calculées à `launchStep` plutôt qu'à `launchWorkflow`. Le `reason` dans l'audit row sera `delta-launchStep` plutôt que `tag-intersection` / `role-expansion` / `explicit`. Utile pour distinguer les assignments "initiales" des "ajoutées en cours de route" en debug.

---

## Liens utiles

- 3-tier visibility (toile de fond du resolver) : [`docs/decision-log.md` §1.6](../decision-log.md)
- RBAC dynamique (rôles en DB) : [`docs/conventions/rbac-tags.md`](../conventions/rbac-tags.md)
- Inbox général : [`docs/conventions/inbox-categories.md`](../conventions/inbox-categories.md)
- Plan de livraison T3 : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](../superpowers/plans/2026-05-01-enterprise-pilot-foundation.md)
