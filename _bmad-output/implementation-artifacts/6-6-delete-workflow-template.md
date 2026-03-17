# Story 6.6: Suppression de Workflow Template

Status: review

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

- [x] Task 1 — Composant ConfirmDeleteDialog (AC: #1, #3)
  - [x] 1.1 Réutiliser le Dialog shadcn/ui existant (`ui/src/components/ui/dialog.tsx`)
  - [x] 1.2 Afficher le nom du template dans le message de confirmation
  - [x] 1.3 Boutons "Cancel" et "Delete" (destructive) avec état loading

- [x] Task 2 — Bouton supprimer sur la page Workflows (AC: #1, #2, #4)
  - [x] 2.1 Ajouté icône Trash2 à côté des boutons edit/launch dans `Workflows.tsx`
  - [x] 2.2 Branché `useMutation` sur `workflowTemplatesApi.remove(id)`
  - [x] 2.3 Invalidation `queryKeys.workflows.templates` on success
  - [x] 2.4 Gestion de l'erreur FK (message affiché dans la modale via `deleteMutation.error`)

- [x] Task 3 — Bouton supprimer sur WorkflowEditor (AC: #5, #6)
  - [x] 3.1 Ajouté bouton "Delete" avec Trash2 dans la barre d'actions (visible seulement en mode edit, pas new)
  - [x] 3.2 Même flow de confirmation Dialog + mutation
  - [x] 3.3 Redirect vers `/workflows` on success via `navigate("/workflows")`

- [x] Task 4 — Gestion d'erreur backend (AC: #4)
  - [x] 4.1 Ajouté COUNT des instances liées avant le DELETE dans `deleteTemplate` service
  - [x] 4.2 Retourne 409 Conflict via `conflict()` helper avec message explicite incluant le nombre d'instances

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

- ~~**UI** : Aucun bouton de suppression n'existe nulle part dans le frontend~~ DONE
- ~~**Erreur FK** : Le backend ne gère pas proprement l'erreur FK~~ DONE — check COUNT avant DELETE, retourne 409

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

- Backend DELETE + API client existaient déjà, seule l'UI manquait
- Ajouté guard FK dans `deleteTemplate` service : COUNT instances avant DELETE, retourne 409 Conflict
- Ajouté bouton Trash2 + Dialog de confirmation sur Workflows.tsx (inline, pas de composant séparé)
- Ajouté bouton Delete + Dialog dans WorkflowEditor.tsx (visible seulement en mode edit)
- Dialog réutilise le composant Dialog shadcn/ui existant
- Mutation reset l'erreur quand le dialog se ferme
- Testé manuellement dans Chrome : suppression OK, modale OK, refresh de liste OK
- Build Docker réussi, server healthy

### File List

- `ui/src/pages/Workflows.tsx` (modify — ajout bouton delete + Dialog + mutation)
- `ui/src/pages/WorkflowEditor.tsx` (modify — ajout bouton delete + Dialog + mutation)
- `server/src/services/workflows.ts` (modify — guard FK COUNT + 409 Conflict avant delete)
