# Story 6.6: Suppression de Workflow Template

Status: ready-for-dev

## Story

As a **company admin ou manager**,
I want **supprimer un workflow template depuis la page Workflows ou l'éditeur**,
so that **je puisse nettoyer les templates obsolètes ou erronés sans intervention technique**.

## Acceptance Criteria

1. **Given** la page Workflows avec une liste de templates **When** l'utilisateur clique sur le bouton supprimer d'un template **Then** une modale de confirmation s'affiche avec le nom du template
2. **Given** la modale de confirmation **When** l'utilisateur confirme **Then** le template est supprimé via `DELETE /workflow-templates/:id` et la liste se rafraîchit
3. **Given** la modale de confirmation **When** l'utilisateur annule **Then** rien ne se passe et la modale se ferme
4. **Given** un template référencé par des workflow instances actives **When** l'utilisateur tente de le supprimer **Then** un message d'erreur clair s'affiche expliquant que le template est utilisé par X workflow(s) et ne peut pas être supprimé
5. **Given** la page Workflow Editor (`/workflow-editor/:templateId`) **When** l'utilisateur édite un template **Then** un bouton "Supprimer" est disponible avec le même flow de confirmation
6. **Given** la suppression réussie **When** depuis le Workflow Editor **Then** l'utilisateur est redirigé vers `/workflows`

## Tasks / Subtasks

- [ ] Task 1 — Composant ConfirmDeleteDialog (AC: #1, #3)
  - [ ] 1.1 Créer un dialog de confirmation réutilisable (ou réutiliser un AlertDialog existant de shadcn)
  - [ ] 1.2 Afficher le nom du template dans le message de confirmation
  - [ ] 1.3 Boutons "Annuler" et "Supprimer" avec état loading

- [ ] Task 2 — Bouton supprimer sur la page Workflows (AC: #1, #2, #4)
  - [ ] 2.1 Ajouter une icône Trash2 à côté des boutons edit/launch dans `Workflows.tsx`
  - [ ] 2.2 Brancher `useMutation` sur `workflowTemplatesApi.remove(id)`
  - [ ] 2.3 Invalider `queryKeys.workflows.templates` on success
  - [ ] 2.4 Gérer l'erreur FK constraint (status 409 ou 500) avec message user-friendly

- [ ] Task 3 — Bouton supprimer sur WorkflowEditor (AC: #5, #6)
  - [ ] 3.1 Ajouter un bouton "Supprimer ce template" dans la barre d'actions du WorkflowEditor
  - [ ] 3.2 Même flow de confirmation + mutation
  - [ ] 3.3 Redirect vers `/workflows` on success

- [ ] Task 4 — Gestion d'erreur backend (AC: #4)
  - [ ] 4.1 Vérifier que le backend retourne une erreur claire quand FK constraint viole (pas juste un 500 générique)
  - [ ] 4.2 Si nécessaire, ajouter un check dans `deleteTemplate` service pour compter les instances liées et retourner un 409 Conflict avec message explicite

## Dev Notes

### Ce qui existe déjà (NE PAS recréer)

- **Backend route** : `DELETE /workflow-templates/:id` — `server/src/routes/workflows.ts:88`
  - Vérifie company access + permission `workflows:create`
  - Appelle `svc.deleteTemplate(existing.id)`
  - Émet audit event `workflow.template_deleted`
- **Frontend API** : `workflowTemplatesApi.remove(id)` — `ui/src/api/workflows.ts:65`
  - Appelle `api.delete<void>(/workflow-templates/${id})`
- **Schema DB** : `workflow_instances.templateId` → FK vers `workflowTemplates.id` (NOT NULL, pas de CASCADE)
  - PostgreSQL rejettera le DELETE si des instances référencent le template

### Ce qui manque

- **UI** : Aucun bouton de suppression n'existe nulle part dans le frontend
- **Erreur FK** : Le backend ne gère pas proprement l'erreur FK — il va retourner un 500 avec l'erreur Postgres brute. Il faut soit :
  - Catch l'erreur Postgres `23503` (foreign_key_violation) et retourner un 409
  - Ou faire un COUNT des instances avant le DELETE

### Architecture & Patterns à suivre

- **Dialog** : Utiliser le composant `AlertDialog` de shadcn/ui (déjà dans le projet)
- **Mutations** : Pattern `useMutation` + `queryClient.invalidateQueries` (cf. `NewWorkflow.tsx` pour exemple)
- **Icons** : Lucide React — utiliser `Trash2` pour le delete
- **Erreurs** : Le client API (`api/client.ts`) throw un `ApiError` avec `.status` et `.body` — s'en servir pour différencier 409 vs 500

### Project Structure Notes

- `ui/src/pages/Workflows.tsx` — Page modifiée récemment, contient la liste des templates avec boutons edit/launch. Ajouter le bouton delete ici.
- `ui/src/pages/WorkflowEditor.tsx` — Éditeur de template. Ajouter un bouton delete dans la barre d'actions.
- `server/src/routes/workflows.ts` — Route DELETE existante. Améliorer la gestion d'erreur FK.
- `server/src/services/workflows.ts` — Service `deleteTemplate`. Ajouter le check des instances liées.

### Contrainte FK — Stratégie recommandée

```typescript
// Dans le service, AVANT le delete:
const instanceCount = await db.select({ count: count() })
  .from(workflowInstances)
  .where(eq(workflowInstances.templateId, templateId));

if (instanceCount[0].count > 0) {
  throw new ApiError(`Ce template est utilisé par ${instanceCount[0].count} workflow(s) actif(s)`, 409);
}
```

### References

- [Source: server/src/routes/workflows.ts#L88-L101] — Route DELETE existante
- [Source: ui/src/api/workflows.ts#L65] — API client remove()
- [Source: ui/src/pages/Workflows.tsx] — Page Workflows (modifiée dans ce PR)
- [Source: ui/src/pages/WorkflowEditor.tsx] — Éditeur de templates
- [Source: packages/db/src/schema/workflow_instances.ts#L11] — FK templateId
- [Source: epics-b2b.md#Epic-ORCH] — Epic Orchestrateur Déterministe

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Backend DELETE + API client déjà implémentés, seule l'UI manque
- FK constraint non-cascade = guard naturel, mais besoin d'un message d'erreur propre (409 au lieu de 500)
- Story simple, scope limité — pas de migration DB nécessaire

### File List

- `ui/src/pages/Workflows.tsx` (modify)
- `ui/src/pages/WorkflowEditor.tsx` (modify)
- `server/src/services/workflows.ts` (modify — check FK avant delete)
- `server/src/routes/workflows.ts` (modify — catch erreur FK → 409)
