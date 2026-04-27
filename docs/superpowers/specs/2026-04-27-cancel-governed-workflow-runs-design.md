# Design — Cancel / Reactivate Governed Workflow Runs

**Date** : 2026-04-27
**Auteur** : Tom (brainstormé avec Claude)
**Status** : approved
**Périmètre** : backend (DB + service + MCP + REST), UI (liste + détail), live events, audit

## Contexte & motivation

Aujourd'hui, un run de workflow gouverné lancé par erreur ou bloqué reste indéfiniment en `status='active'`. Aucun moyen de l'annuler depuis MnM sans manipulation DB. Les runs orphelins polluent le dashboard et `list_governed_workflow_runs`.

Constaté en live sur le run AY-0075 : 2 doublons (`fc82307b`, `0b8cf583`) toujours actifs après le run principal complété.

Besoin : pouvoir **annuler** un run et le **réactiver** si annulé par erreur. Toggle réversible, pas de delete.

## Décisions clés

1. **DB-only state** — pas d'interruption côté agent. L'agent local du user qui a annulé le run continuera son exécution naturelle ; le serveur bloque les appels MCP/HTTP suivants.
2. **Modèle "flag orthogonal"** — colonne `cancelled_at` nullable, `status` reste source de vérité de la progression. `cancelled_at IS NOT NULL` = state cancel surimposé.
3. **Réversibilité totale** — reactivate restaure les step_executions cancelled à leur état déduit (pending si jamais started, running sinon).
4. **Auth dual-track** — initiateur du run ⊕ permission `workflows:cancel_run`. Agents héritent de la permission de leur créateur (déjà en place via `actorMiddleware`).
5. **Erreurs strictes** — pas d'idempotence silencieuse. Annuler un run déjà annulé renvoie `WORKFLOW_RUN_ALREADY_CANCELLED` ; le client UI le traduit en toast "déjà annulé".
6. **Cancel ⇒ active uniquement** — un run `completed` ne peut pas être annulé.

## 1. Schéma DB

Migration : `packages/db/src/migrations/0066_workflow_run_cancellation.sql`.

```sql
ALTER TABLE governed_workflow_runs
  ADD COLUMN cancelled_at            TIMESTAMPTZ,
  ADD COLUMN cancelled_by_actor_id   TEXT,
  ADD COLUMN cancelled_by_actor_type TEXT,
  ADD COLUMN cancellation_reason     TEXT;

CREATE INDEX governed_workflow_runs_cancelled_at_idx
  ON governed_workflow_runs(company_id, cancelled_at)
  WHERE cancelled_at IS NOT NULL;

ALTER TYPE governed_step_state ADD VALUE 'cancelled';
```

**Drizzle** :
- `packages/db/src/schema/governed_workflow_runs.ts` : ajouter les 4 colonnes (toutes nullables).
- `packages/db/src/schema/governed_step_executions.ts` : ajouter `"cancelled"` à `GOVERNED_STEP_STATES`.

**Invariants** :
- `cancelled_at IS NOT NULL` ⇒ les autres colonnes `cancelled_by_*` et `cancellation_reason` non-NULL (enforcé par le service, pas par CHECK constraint pour permettre rollback de migration).
- Un step en `cancelled` n'a pas de `completed_at` (il a été interrompu).

## 2. Permissions

Dans `packages/shared/src/contracts/permissions.ts` :

```ts
WORKFLOWS_CANCEL_RUN: "workflows:cancel_run"
```

Métadonnée :
```ts
[PERMISSIONS.WORKFLOWS_CANCEL_RUN]: {
  category: "workflows",
  description: "Annuler ou réactiver les runs de workflow",
  destructive: false,
}
```

**Seed** : `packages/db/src/seed.ts` — ajouter `PERMISSIONS.WORKFLOWS_CANCEL_RUN` dans la liste des permissions attribuées aux rôles bootstrap "Admin" et "Owner".

**Vérification d'auth** (helper `assertCanCancelRun`) :

```ts
function assertCanCancelRun(actor, run, userPermissions) {
  if (actor.id === run.initiated_by_actor_id) return; // ownership track
  if (userPermissions.has(PERMISSIONS.WORKFLOWS_CANCEL_RUN)) return; // perm track
  throw new GovernedWorkflowError(WORKFLOW_FORBIDDEN, ...);
}
```

## 3. Service (`server/src/services/governed-workflows.ts`)

Deux nouvelles méthodes publiques sur `governedWorkflowService`.

### 3.1 cancelRun

```ts
async cancelRun(args: {
  runId: string;
  companyId: string;
  actor: Actor;
  reason: string;
}): Promise<{
  runId: string;
  cancelledAt: Date;
  cancelledStepIds: string[];
}>
```

**Algorithme** (transaction unique) :
1. Validation Zod : `reason.length >= 5`.
2. `SELECT ... FOR UPDATE` sur le run + jointure RLS sur company.
3. Si run absent → `WORKFLOW_RUN_NOT_FOUND`.
4. Si `run.status !== 'active'` → `WORKFLOW_RUN_NOT_ACTIVE`.
5. Si `run.cancelled_at IS NOT NULL` → `WORKFLOW_RUN_ALREADY_CANCELLED`.
6. `assertCanCancelRun(actor, run, perms)`.
7. UPDATE run : `cancelled_at = now(), cancelled_by_actor_id = actor.id, cancelled_by_actor_type = actor.type, cancellation_reason = reason`.
8. UPDATE step_executions : `state = 'cancelled'` WHERE `run_id = X AND state IN ('pending','running','gate_eval')`. RETURNING `id` → `cancelledStepIds`.
9. INSERT audit_log : `event_type = 'governed_run.cancelled'`, `metadata = { runId, reason, cancelledStepIds }`.
10. `publishLiveEvent({ type: "run_cancelled", runId, cancelledAt, cancelledByActorId: actor.id, reason, cancelledStepIds })`.

### 3.2 reactivateRun

```ts
async reactivateRun(args: {
  runId: string;
  companyId: string;
  actor: Actor;
}): Promise<{
  runId: string;
  reactivatedStepIds: string[];
}>
```

**Algorithme** (transaction unique) :
1. `SELECT ... FOR UPDATE` sur run.
2. Si run absent → `WORKFLOW_RUN_NOT_FOUND`.
3. Si `run.cancelled_at IS NULL` → `WORKFLOW_RUN_NOT_CANCELLED`.
4. `assertCanCancelRun` (mêmes droits).
5. UPDATE run : `cancelled_at = NULL, cancelled_by_* = NULL, cancellation_reason = NULL`.
6. Pour chaque step_execution `state='cancelled'` du run :
   - `started_at IS NULL` ⇒ UPDATE `state = 'pending'`.
   - `started_at IS NOT NULL` ⇒ UPDATE `state = 'running'`.
   RETURNING `id` → `reactivatedStepIds`.
7. INSERT audit_log : `event_type = 'governed_run.reactivated'`, `metadata = { runId, reactivatedStepIds }`.
8. `publishLiveEvent({ type: "run_reactivated", runId, reactivatedByActorId: actor.id, reactivatedStepIds })`.

### 3.3 Garde sur les autres méthodes

`launchStep` et `completeStep` ajoutent en début, **après** la résolution du run :

```ts
if (run.cancelledAt !== null) {
  throw new GovernedWorkflowError(
    WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED,
    `Run ${runId} is cancelled (since ${run.cancelledAt.toISOString()}).`,
    [
      `Reason: ${run.cancellationReason}`,
      `Use mcp__plugin_mnm_mnm__reactivate_governed_workflow_run to resume.`,
    ],
  );
}
```

## 4. Codes d'erreur

`packages/governed-workflows/src/errors.ts` ajoute :

```ts
WORKFLOW_RUN_CANCELLED: "WORKFLOW_RUN_CANCELLED",
WORKFLOW_RUN_ALREADY_CANCELLED: "WORKFLOW_RUN_ALREADY_CANCELLED",
WORKFLOW_RUN_NOT_CANCELLED: "WORKFLOW_RUN_NOT_CANCELLED",
WORKFLOW_RUN_NOT_ACTIVE: "WORKFLOW_RUN_NOT_ACTIVE",
WORKFLOW_FORBIDDEN: "WORKFLOW_FORBIDDEN", // nouveau — n'existe pas aujourd'hui
```

Mapping HTTP : 409 (Conflict) pour `ALREADY_CANCELLED` / `NOT_CANCELLED` / `NOT_ACTIVE`, 423 (Locked) pour `CANCELLED` sur launch/complete, 403 pour `FORBIDDEN`.

## 5. MCP tools (`server/src/mcp/tools/governed-workflows.tool.ts`)

```ts
mcp__plugin_mnm_mnm__cancel_governed_workflow_run
  Input: { run_id: uuid, reason: string (min 5 chars) }
  Output: { run_id, cancelled_at, cancelled_step_ids: string[] }

mcp__plugin_mnm_mnm__reactivate_governed_workflow_run
  Input: { run_id: uuid }
  Output: { run_id, reactivated_step_ids: string[] }
```

Schéma Zod déclaré inline, descriptions FR pour cohérence avec les autres tools MnM.

`list_governed_workflow_runs` : enrichir le retour avec `cancelled_at` et `cancellation_reason` (déjà disponibles, juste ajouter au SELECT).

`get_governed_workflow_run` : enrichir le retour avec `cancelled_at`, `cancelled_by_actor_id`, `cancelled_by_actor_type`, `cancellation_reason`.

## 6. REST routes

Mountage : `/api/companies/:companyId/governed-workflows/runs/:runId/...`

Dans `server/src/routes/governed-workflows-ui.ts` :

```ts
POST /:runId/cancel
  Body: { reason: string (min 5) }
  Response 200: { runId, cancelledAt, cancelledStepIds }
  Response 4xx: { code, message, hints }

POST /:runId/reactivate
  Body: {}
  Response 200: { runId, reactivatedStepIds }
  Response 4xx: { code, message, hints }
```

Middleware : `assertCompanyMembership` + `tenantContextMiddleware` + `tagScopeMiddleware` (déjà en place sur le router parent). **Pas** de `requirePermission(WORKFLOWS_CANCEL_RUN)` au niveau route — l'auth dual-track est faite dans le service car il faut connaître l'initiator.

Validation Zod du body, mapping `GovernedWorkflowError` → status code par switch sur `error.code`.

## 7. UI

### 7.1 Liste — `ui/src/pages/GovernedWorkflowRuns.tsx`

Modifications :
- Ajouter colonne "Actions" (avant "Status" ou après "Started at", à finaliser visuellement).
- Bouton conditionnel :
  - Run actif (`!cancelled_at && status === 'active'`) → bouton icône `X` avec tooltip "Annuler" → ouvre `CancelRunDialog`.
  - Run cancelled (`cancelled_at !== null`) → bouton icône `RotateCcw` avec tooltip "Réactiver" → mutation directe.
  - Run completed → cellule vide.
- Ajouter badge "Annulé" gris à côté du status si `cancelled_at`. Tooltip = `cancellation_reason`.

### 7.2 Détail — `ui/src/pages/GovernedWorkflowRunDetail.tsx`

Modifications :
- **Si cancelled** : bandeau d'avertissement (Alert variant=destructive) en haut :
  ```
  ⊘ Run annulé le {format(cancelledAt)} par {resolveActorDisplayName(cancelledByActorId)}
  Raison : {cancellationReason}
  [Réactiver]
  ```
- **Sinon** : bouton "Annuler le run" dans la barre d'actions du header.
- **Steps annulés** dans la timeline :
  - Icône `Ban` (lucide).
  - Background gris, opacité 70%.
  - Label "Annulé".
  - Tooltip : "Annulé en cascade lors de l'annulation du run".

### 7.3 Composant `CancelRunDialog.tsx`

Nouveau composant à créer dans `ui/src/components/workflows/CancelRunDialog.tsx`.

Stack : `Dialog` (existing UI primitive), `Textarea`, `Button`, `Label` — tous depuis `ui/src/components/ui/`.

Props :
```ts
interface CancelRunDialogProps {
  runId: string;
  workflowName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

Structure :
- Header : "Annuler le run {workflowName}"
- Body :
  - Description : "Les étapes en cours seront annulées. Le run pourra être réactivé plus tard."
  - Textarea avec label "Raison de l'annulation (min 5 caractères)" — required, controlled state.
  - Erreur de validation inline si < 5 chars et user a touché le champ.
- Footer :
  - Bouton "Garder actif" (variant=outline, ferme le dialog)
  - Bouton "Confirmer l'annulation" (variant=destructive, disabled si reason < 5 chars)
- Loading state pendant la mutation, désactive le bouton confirm.
- Toast de succès / erreur via `useToast()`.

### 7.4 Hooks

Nouveau fichier `ui/src/hooks/useWorkflowRunActions.ts` :

```ts
function useCancelRun(runId: string) {
  return useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      apiClient.post(`/companies/${companyId}/governed-workflows/runs/${runId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", "runs"] });
      queryClient.invalidateQueries({ queryKey: ["workflows", "run", runId] });
    },
  });
}

function useReactivateRun(runId: string) {
  return useMutation({
    mutationFn: () =>
      apiClient.post(`/companies/${companyId}/governed-workflows/runs/${runId}/reactivate`, {}),
    onSuccess: () => { /* idem */ },
  });
}
```

### 7.5 Mapping erreurs

Codes serveur traduits en messages français toast :
- `WORKFLOW_RUN_ALREADY_CANCELLED` → "Ce run est déjà annulé."
- `WORKFLOW_RUN_NOT_CANCELLED` → "Ce run n'est pas annulé."
- `WORKFLOW_RUN_NOT_ACTIVE` → "Seuls les runs actifs peuvent être annulés."
- `WORKFLOW_FORBIDDEN` → "Vous n'avez pas la permission d'annuler ce run."

## 8. Live events

`packages/live-events/src/types.ts` : étendre le discriminated union :

```ts
| {
    type: "run_cancelled";
    runId: string;
    cancelledAt: string; // ISO
    cancelledByActorId: string;
    reason: string;
    cancelledStepIds: string[];
  }
| {
    type: "run_reactivated";
    runId: string;
    reactivatedByActorId: string;
    reactivatedStepIds: string[];
  }
```

Le hook `useWorkflowRunsLive` (UI) écoute et fait `queryClient.invalidateQueries(['workflows', 'runs'])` sur réception.

## 9. Audit log

Réutilise la table `audit_log` existante. Deux nouveaux event types :

| event_type | metadata |
|---|---|
| `governed_run.cancelled` | `{ runId, reason, cancelledStepIds }` |
| `governed_run.reactivated` | `{ runId, reactivatedStepIds }` |

Inséré par le service dans la même transaction que la mise à jour du run.

## 10. Tests

### 10.1 Unitaires

`server/src/services/__tests__/governed-workflows.test.ts` ajoute :

- `cancelRun` — happy path : run actif → cancelled, steps en cascade, audit, live event publié.
- `cancelRun` — refus si `status='completed'` → `WORKFLOW_RUN_NOT_ACTIVE`.
- `cancelRun` — refus si déjà cancelled → `WORKFLOW_RUN_ALREADY_CANCELLED`.
- `cancelRun` — refus si actor non-initiator sans perm → `WORKFLOW_FORBIDDEN`.
- `cancelRun` — autorisé si initiator (sans perm).
- `cancelRun` — autorisé si non-initiator avec perm `WORKFLOWS_CANCEL_RUN`.
- `cancelRun` — reason < 5 chars rejetée par Zod.
- `reactivateRun` — happy path : steps cancelled restorent (pending/running selon `started_at`).
- `reactivateRun` — refus si non cancelled → `WORKFLOW_RUN_NOT_CANCELLED`.
- `launchStep` / `completeStep` — refus si run cancelled → `WORKFLOW_RUN_CANCELLED`.

### 10.2 MCP tools

`server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` ajoute des tests d'invocation pour les deux nouveaux tools (input validation, propagation auth, mapping erreurs).

### 10.3 E2E

`server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts` ajoute un scénario complet :

```
launch → complete step 1 → cancel run → tenter complete step 2 (REJECT) → reactivate
→ vérifier step 2 = pending (jamais started) → complete step 2 OK
```

### 10.4 UI (à confirmer si scope inclus)

Pas de tests Playwright dans le scope V1 (à valider avec Tom). Composant `CancelRunDialog` peut avoir un test Vitest unitaire.

## 11. Migration des runs existants

Pas de backfill nécessaire — les runs existants ont `cancelled_at = NULL` par défaut, ce qui est correct.

## Hors scope

- **Pas** de cancel automatique sur timeout / inactivité.
- **Pas** de "delete run" — les runs cancelled restent en DB pour audit (TTL futur si volumétrie pose problème).
- **Pas** de cancel d'un run `completed` (sémantique = revert d'un succès, pas notre besoin).
- **Pas** d'interruption agent côté client (l'agent finit naturellement, le serveur bloque les writes suivants).
- **Pas** de notification Slack/email — possibilités futures.

## Risques & alternatives écartées

| Risque | Mitigation |
|---|---|
| Race entre cancel et un complete_step en cours | `SELECT ... FOR UPDATE` dans la tx serialize les deux opérations. |
| User cancel un run, l'agent local continue puis appelle `complete_step` qui échoue → confusion | Message d'erreur explicite + hints `WORKFLOW_RUN_CANCELLED` + l'agent peut consulter `get_run` et voir l'état. |
| Reactivate restaure `running` mais l'agent est mort | Le user doit manuellement re-prompter. Acceptable pour V1 ; plus tard, signal au harness pour relauncher. |

**Alternatives écartées** :
- Status enum + `previous_status` colonne — plus complexe, pas nécessaire avec l'orthogonalité de `cancelled_at`.
- Soft-delete `archived_at` — sémantique fausse, on ne supprime pas.
- Bouton sans dialog (cancel direct) — refusé par Tom, reason obligatoire.
- Idempotence silencieuse — refusé par Tom, erreurs strictes pour clarté UX.
