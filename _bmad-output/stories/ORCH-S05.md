# ORCH-S05 — UI Editeur Workflow (P1)

> **Epic** : ORCH — Orchestrateur Deterministe (Noyau A)
> **Sprint** : Batch 14
> **Assignation** : Cofondateur
> **Effort** : M (5 SP, 3-5j)
> **Bloque par** : ORCH-S01 (DONE), ORCH-S02 (DONE), ORCH-S03 (DONE), ORCH-S04 (DONE)
> **Debloque** : —
> **ADR** : ADR-003 (Orchestrateur Deterministe)

---

## Contexte

Le systeme d'orchestration est complet cote backend : state machine XState (ORCH-S01), WorkflowEnforcer avec fichiers obligatoires et pre-prompts (ORCH-S02), validation HITL (ORCH-S03), et 14 API routes (ORCH-S04). Les templates de workflow sont stockes comme JSONB dans `workflow_templates.stages` avec un schema `WorkflowStageTemplateDef` qui inclut : order, name, description, agentRole, autoTransition, acceptanceCriteria, requiredFiles, prePrompts, expectedOutputs, hitlRequired, hitlRoles.

Il existe deja des pages basiques : `Workflows.tsx` (liste des instances), `WorkflowDetail.tsx` (pipeline visuel d'une instance), `NewWorkflow.tsx` (creation depuis template). Mais il n'existe **aucun editeur de template** permettant de creer/modifier visuellement les stages d'un workflow template.

ORCH-S05 implemente une **page editeur de workflow template** accessible a `/workflow-editor/:templateId` (edition) et `/workflow-editor/new` (creation). La page permet de :
- Voir et reordonner les stages par drag-and-drop (dnd-kit ou gestion manuelle up/down)
- Ajouter / supprimer des stages
- Configurer chaque stage : nom, description, agentRole, autoTransition, requiredFiles, prePrompts, acceptanceCriteria, hitlRequired, hitlRoles
- Previsualiser le pipeline en mode lecture
- Sauvegarder le template via l'API existante (POST/PATCH workflow-templates)

L'API existante (workflows.ts routes, workflowTemplatesApi client) est suffisante. Aucune modification backend n'est requise.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| ORCH-S01 | DONE | State machine XState, WorkflowStageTemplateDef type |
| ORCH-S02 | DONE | requiredFiles, prePrompts, expectedOutputs dans le schema |
| ORCH-S03 | DONE | hitlRequired, hitlRoles dans le schema |
| ORCH-S04 | DONE | 14 API routes orchestrateur |
| RBAC-S05 | DONE | Navigation masquee selon permissions |

---

## Acceptance Criteria (Given/When/Then)

### AC-01: Workflow editor page accessible
- **Given** un utilisateur avec permission `workflows:create`
- **When** il navigue vers `/workflow-editor/new`
- **Then** il voit la page editeur avec un template vide et un bouton "Add Stage"

### AC-02: Editor loads existing template
- **Given** un template existant avec 5 stages
- **When** l'utilisateur navigue vers `/workflow-editor/:templateId`
- **Then** les 5 stages sont affichees comme cartes dans l'editeur avec leurs configurations

### AC-03: Add stage
- **Given** l'editeur de workflow ouvert
- **When** l'utilisateur clique "Add Stage"
- **Then** une nouvelle carte stage est ajoutee a la fin avec un nom par defaut "New Stage"
- **And** la carte est en mode edition

### AC-04: Remove stage
- **Given** un template avec 3 stages
- **When** l'utilisateur clique le bouton supprimer sur le stage 2
- **Then** le stage 2 est supprime et les stages restants sont reordonnes (1, 2)

### AC-05: Reorder stages via move up/down
- **Given** un template avec stages [A, B, C]
- **When** l'utilisateur clique "Move Down" sur le stage A
- **Then** l'ordre devient [B, A, C] et les numeros d'ordre sont mis a jour

### AC-06: Configure stage name and description
- **Given** une carte stage en mode edition
- **When** l'utilisateur modifie le nom et la description
- **Then** les valeurs sont mises a jour dans le template local

### AC-07: Configure stage agentRole
- **Given** une carte stage en mode edition
- **When** l'utilisateur selectionne un agentRole parmi les options (pm, architect, dev, qa, reviewer)
- **Then** le agentRole est enregistre dans la configuration du stage

### AC-08: Configure autoTransition toggle
- **Given** une carte stage en mode edition
- **When** l'utilisateur active le toggle "Auto Transition"
- **Then** autoTransition est mis a true pour ce stage

### AC-09: Configure required files
- **Given** une carte stage en mode edition
- **When** l'utilisateur ajoute un fichier requis (path + description)
- **Then** le fichier apparait dans la liste requiredFiles du stage

### AC-10: Configure pre-prompts
- **Given** une carte stage en mode edition
- **When** l'utilisateur ajoute un pre-prompt text
- **Then** le texte apparait dans la liste prePrompts du stage

### AC-11: Configure HITL settings
- **Given** une carte stage en mode edition
- **When** l'utilisateur active "Human Validation Required" et selectionne des roles
- **Then** hitlRequired est true et hitlRoles contient les roles selectionnes

### AC-12: Pipeline preview
- **Given** un template avec stages configurees
- **When** l'utilisateur clique "Preview"
- **Then** un apercu en lecture seule du pipeline est affiche avec les stages connectes par des fleches

### AC-13: Save new template
- **Given** un nouveau template avec nom et stages
- **When** l'utilisateur clique "Save"
- **Then** POST /companies/:companyId/workflow-templates est appele
- **And** l'utilisateur est redirige vers la liste des workflows

### AC-14: Update existing template
- **Given** un template existant modifie
- **When** l'utilisateur clique "Save"
- **Then** PATCH /workflow-templates/:id est appele avec les stages mises a jour

### AC-15: Sidebar navigation entry
- **Given** un utilisateur avec permission `workflows:create`
- **When** il regarde le sidebar section "Work"
- **Then** un lien "Workflow Editor" est visible avec l'icone Pencil

---

## Mapping data-testid

| data-testid | Element | Page/Composant |
|-------------|---------|----------------|
| `orch-s05-editor-page` | Container page editeur | WorkflowEditor.tsx |
| `orch-s05-template-name-input` | Input nom du template | WorkflowEditor.tsx |
| `orch-s05-template-description-input` | Input description du template | WorkflowEditor.tsx |
| `orch-s05-add-stage-btn` | Bouton "Add Stage" | WorkflowEditor.tsx |
| `orch-s05-save-btn` | Bouton "Save" | WorkflowEditor.tsx |
| `orch-s05-preview-btn` | Bouton "Preview" | WorkflowEditor.tsx |
| `orch-s05-cancel-btn` | Bouton "Cancel" | WorkflowEditor.tsx |
| `orch-s05-stage-card-{index}` | Carte stage a l'index N | StageEditorCard.tsx |
| `orch-s05-stage-name-{index}` | Input nom du stage | StageEditorCard.tsx |
| `orch-s05-stage-description-{index}` | Input description du stage | StageEditorCard.tsx |
| `orch-s05-stage-role-{index}` | Select agentRole | StageEditorCard.tsx |
| `orch-s05-stage-auto-transition-{index}` | Toggle autoTransition | StageEditorCard.tsx |
| `orch-s05-stage-move-up-{index}` | Bouton move up | StageEditorCard.tsx |
| `orch-s05-stage-move-down-{index}` | Bouton move down | StageEditorCard.tsx |
| `orch-s05-stage-delete-{index}` | Bouton supprimer stage | StageEditorCard.tsx |
| `orch-s05-stage-expand-{index}` | Bouton expand/collapse | StageEditorCard.tsx |
| `orch-s05-stage-hitl-toggle-{index}` | Toggle HITL | StageEditorCard.tsx |
| `orch-s05-stage-hitl-roles-{index}` | Container roles HITL | StageEditorCard.tsx |
| `orch-s05-stage-required-files-{index}` | Container fichiers requis | StageEditorCard.tsx |
| `orch-s05-stage-add-file-{index}` | Bouton ajouter fichier | StageEditorCard.tsx |
| `orch-s05-stage-preprompts-{index}` | Container pre-prompts | StageEditorCard.tsx |
| `orch-s05-stage-add-preprompt-{index}` | Bouton ajouter pre-prompt | StageEditorCard.tsx |
| `orch-s05-stage-acceptance-{index}` | Container acceptance criteria | StageEditorCard.tsx |
| `orch-s05-stage-add-acceptance-{index}` | Bouton ajouter AC | StageEditorCard.tsx |
| `orch-s05-preview-panel` | Panneau preview pipeline | WorkflowEditorPreview.tsx |
| `orch-s05-preview-stage-{index}` | Stage dans le preview | WorkflowEditorPreview.tsx |
| `orch-s05-preview-arrow-{index}` | Fleche entre stages preview | WorkflowEditorPreview.tsx |
| `orch-s05-nav-editor` | Lien sidebar "Workflow Editor" | Sidebar.tsx |
| `orch-s05-error-message` | Message d'erreur | WorkflowEditor.tsx |
| `orch-s05-stage-count` | Compteur de stages | WorkflowEditor.tsx |

---

## Fichiers a creer/modifier

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `ui/src/pages/WorkflowEditor.tsx` | Page editeur de workflow template |
| `ui/src/components/StageEditorCard.tsx` | Composant carte stage editable |
| `ui/src/components/WorkflowEditorPreview.tsx` | Composant preview pipeline |

### Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `ui/src/App.tsx` | Ajouter route `/workflow-editor/new` et `/workflow-editor/:templateId` |
| `ui/src/components/Sidebar.tsx` | Ajouter lien "Workflow Editor" dans section Work |
| `ui/src/lib/queryKeys.ts` | Ajouter queryKey `templateDetail` si necessaire |

---

## Test Cases (48)

### T01-T03: Page WorkflowEditor existence et structure
- T01: Fichier WorkflowEditor.tsx existe
- T02: Export function WorkflowEditor
- T03: data-testid orch-s05-editor-page present

### T04-T06: StageEditorCard existence et structure
- T04: Fichier StageEditorCard.tsx existe
- T05: Export function StageEditorCard
- T06: data-testid orch-s05-stage-card pattern present

### T07-T09: WorkflowEditorPreview existence et structure
- T07: Fichier WorkflowEditorPreview.tsx existe
- T08: Export function WorkflowEditorPreview
- T09: data-testid orch-s05-preview-panel present

### T10-T14: Template name/description inputs
- T10: Input orch-s05-template-name-input present
- T11: Input orch-s05-template-description-input present
- T12: onChange handler sur name input
- T13: onChange handler sur description input
- T14: Placeholder text sur name input

### T15-T18: Add stage functionality
- T15: Bouton orch-s05-add-stage-btn present
- T16: onClick handler pour ajouter un stage
- T17: Default stage name "New Stage" utilise
- T18: Stage count incremente apres ajout

### T19-T22: Delete stage functionality
- T19: Bouton orch-s05-stage-delete pattern present
- T20: Confirmation avant suppression (splice ou filter)
- T21: Stages reordonnees apres suppression
- T22: Bouton supprimer non present si un seul stage

### T23-T26: Move up/down functionality
- T23: Bouton orch-s05-stage-move-up pattern present
- T24: Bouton orch-s05-stage-move-down pattern present
- T25: Move up desactive sur premier stage (index === 0)
- T26: Move down desactive sur dernier stage

### T27-T30: Stage configuration — name, description, role
- T27: Input orch-s05-stage-name pattern present
- T28: Input orch-s05-stage-description pattern present
- T29: Select orch-s05-stage-role pattern present
- T30: Options de role incluent pm, architect, dev, qa, reviewer

### T31-T33: Auto-transition toggle
- T31: Toggle orch-s05-stage-auto-transition pattern present
- T32: Checked state bind a autoTransition
- T33: onChange toggle autoTransition

### T34-T37: HITL configuration
- T34: Toggle orch-s05-stage-hitl-toggle pattern present
- T35: hitlRoles container conditionnel (visible si hitlRequired=true)
- T36: Roles HITL options disponibles
- T37: hitlRequired state bind correct

### T38-T40: Required files section
- T38: Container orch-s05-stage-required-files pattern present
- T39: Bouton orch-s05-stage-add-file pattern present
- T40: Champs path et description pour chaque fichier

### T41-T42: Pre-prompts section
- T41: Container orch-s05-stage-preprompts pattern present
- T42: Bouton orch-s05-stage-add-preprompt pattern present

### T43-T44: Preview panel
- T43: Preview panel orch-s05-preview-panel present dans WorkflowEditorPreview
- T44: Preview stage pattern orch-s05-preview-stage present

### T45-T46: Save functionality
- T45: Bouton orch-s05-save-btn present
- T46: API call workflowTemplatesApi.create ou .update utilise

### T47-T48: App.tsx route + Sidebar integration
- T47: Route workflow-editor dans App.tsx
- T48: Sidebar nav item orch-s05-nav-editor present
