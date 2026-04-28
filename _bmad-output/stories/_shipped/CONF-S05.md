# CONF-S05 — Frontend Config Layers

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONF-S05 |
| **Titre** | Frontend — ConfigLayersPage, LayerEditor, AgentLayersTab, MergePreviewPanel |
| **Epic** | Epic CONF — Config Layers |
| **Effort** | XL (13 SP, 7-9j) |
| **Priorite** | P1 — UI permettant la gestion des layers par les admins et managers |
| **Assignation** | Tom |
| **Bloque par** | CONF-S02 (API CRUD + conflict), CONF-S03 (merge preview API), CONF-S04 (OAuth flow) |
| **Debloque** | Rien (story terminale) |
| **Statut** | DONE |
| **Type** | Frontend (10+ composants React, 1 page admin, 1 onglet agent) |

---

## Contexte

Les stories CONF-S01 a CONF-S04 ont pose la fondation backend. Cette story construit l'interface utilisateur qui rend le systeme utilisable.

Trois surfaces UI :

1. **Page admin `/config-layers`** : vue globale de toutes les layers de la company, avec filtres par scope, createur, et type. Chaque layer affiche des badges de contenu (nombre de MCP, Skills, Hooks, Settings) et le nombre d'agents qui l'utilisent.

2. **LayerEditor** : editeur modal/panel avec 4 onglets (MCP Servers, Skills, Hooks, Settings). Chaque onglet a un editeur specifique adapte au type d'item.

3. **AgentLayersTab** : onglet "Layers" dans la page de detail d'un agent. Montre les layers attachees par ordre de priorite, permet d'attacher de nouvelles layers, de les detacher, de voir les conflits et de previsualiser le merge final.

Un principe fort : les mises a jour UI sont optimistes — l'attach/detach se reflete immediatement dans l'UI sans attendre la confirmation du serveur, avec rollback si l'API retourne une erreur.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| CONF-S02 | DONE | Routes CRUD layers, attach/detach, conflicts, merge-preview |
| CONF-S03 | DONE | resolveConfigForRun() — merge preview disponible via API |
| CONF-S04 | DONE | Routes OAuth authorize/callback, liste credentials |
| MU-S03 | DONE | Pattern hooks API (useQuery, useMutation) — react-query |
| RBAC-S04 | DONE | usePermission() hook cote frontend |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — ConfigLayersPage : liste enrichie

**Given** un Admin ou Manager
**When** il navigue vers `/config-layers`
**Then** la liste des layers visibles (selon son scope) s'affiche avec pour chaque layer :
- Nom et description
- Scope badge (private / team / public / company)
- Priorite
- Createur (nom affiche)
- Badges de contenu : `MCP: 2 | Skills: 1 | Hooks: 0 | Settings: 3`
- Nombre d'agents utilisant la layer (`3 agents`)
- Actions : Edit, Duplicate, Delete (visibles selon permissions)

### AC2 — ConfigLayersPage : filtres

**Given** la page ConfigLayersPage
**When** l'utilisateur selectionne un filtre de scope ("public" par exemple)
**Then** seules les layers de ce scope sont affichees

**When** il cherche par nom dans le champ de recherche
**Then** la liste est filtree en temps reel (client-side sur les donnees chargees)

### AC3 — LayerEditor : onglets et compteurs

**Given** l'utilisateur ouvre un LayerEditor (creation ou edition)
**When** il voit les onglets
**Then** 4 onglets sont affiches : "MCP Servers (2)", "Skills (1)", "Hooks (0)", "Settings (3)" avec le compteur d'items de chaque type

**When** il ajoute un item dans l'onglet MCP Servers
**Then** le compteur de l'onglet passe a 3 immediatement

### AC4 — McpItemEditor

**Given** l'onglet MCP Servers ouvert
**When** l'utilisateur ajoute un MCP server
**Then** le formulaire demande : Nom (itemKey), Commande (`command`), Arguments (`args` — liste), Variables d'env (`env` — map cle/valeur)

**Given** un MCP server qui supporte OAuth
**When** l'item est sauvegarde
**Then** un badge "Connexion requise" apparait avec le bouton `McpOAuthConnectButton`

### AC5 — McpOAuthConnectButton : popup OAuth

**Given** un item MCP server avec OAuth configure
**When** l'utilisateur clique "Connecter via OAuth"
**Then** un popup s'ouvre avec l'URL d'autorisation du provider

**Given** l'utilisateur autorise l'acces dans le popup
**When** le popup se ferme (postMessage success)
**Then** le badge passe a "Connecte" avec la date de connexion, sans rechargement de page

**Given** l'utilisateur ferme le popup sans autoriser
**When** le parent recoit `status: 'cancelled'` ou timeout
**Then** le badge reste "Connexion requise" sans message d'erreur

### AC6 — AgentLayersTab : affichage par priorite

**Given** un agent detail avec des layers attachees
**When** l'onglet "Layers" est ouvert
**Then** les layers sont affichees par ordre decroissant de priorite (layer priorite 999 en premier)

**And** chaque layer affiche : nom, scope, priorite, badges de contenu, bouton "Detacher"

### AC7 — AgentLayersTab : attach optimiste

**Given** l'onglet AgentLayersTab ouvert
**When** l'utilisateur selectionne une layer dans le selector et clique "Attacher"
**Then** la layer apparait immediatement dans la liste (optimistic update) avant confirmation API

**Given** l'API retourne une erreur (conflit, permission refusee)
**When** la reponse est recue
**Then** la layer disparait de la liste (rollback optimiste) et un toast d'erreur s'affiche

### AC8 — AgentLayersTab : detach optimiste

**Given** l'utilisateur clique "Detacher" sur une layer
**When** le bouton est clique
**Then** la layer disparait immediatement de la liste (optimistic update)

**Given** l'API retourne une erreur
**Then** la layer reapparait (rollback) et un toast d'erreur s'affiche

### AC9 — ConflictResolutionDialog

**Given** un agent dont les layers attachees ont des conflits
**When** l'indicateur de conflit est clique (badge rouge "2 conflits")
**Then** ConflictResolutionDialog s'ouvre et liste les conflits avec pour chaque : le nom de la cle, la valeur de la layer haute priorite (highlighted), la valeur de la layer basse priorite, et une indication "La priorite 999 gagne"

**And** un bouton "Voir le merge final" ouvre MergePreviewPanel

### AC10 — MergePreviewPanel

**Given** MergePreviewPanel ouvert pour un agent
**When** les donnees sont chargees
**Then** les 3 onglets sont affiches : "MCP Servers", "Settings", "Skills" avec le resultat final merge

**And** chaque item affiche son origine (layer source avec son nom et sa priorite)

### AC11 — HookItemEditor

**Given** l'onglet Hooks du LayerEditor
**When** l'utilisateur ajoute un hook
**Then** le formulaire propose : Type de hook (`pre_run` / `post_run` / `on_error`), Commande a executer, Timeout optionnel

### AC12 — SkillItemEditor

**Given** l'onglet Skills du LayerEditor
**When** l'utilisateur ajoute un skill
**Then** le formulaire propose : Nom du skill, Description, Contenu (textarea markdown pour la definition du skill)

### AC13 — SettingItemEditor

**Given** l'onglet Settings du LayerEditor
**When** l'utilisateur ajoute un setting
**Then** le formulaire propose : Cle, Valeur (input text), Type de valeur (string / number / boolean / json)

### AC14 — Versioning visible

**Given** un user qui ouvre l'historique d'une layer (bouton "Historique")
**When** le panel s'ouvre
**Then** la liste des revisions est affichee avec : version, date, auteur, note de changement, et bouton "Voir ce snapshot"

---

## Deliverables

### D1 — Page `ui/src/pages/ConfigLayersPage.tsx`

- Route `/config-layers` (admin only)
- Filters : scope selector, search input
- Liste enrichie avec badges
- Bouton "Nouvelle layer" qui ouvre LayerEditor en mode creation
- Gestion des permissions (affichage conditionnel des actions)

### D2 — Composant `ui/src/components/config-layers/LayerEditor.tsx`

- Modal ou drawer selon la taille d'ecran
- Header : nom, description, scope selector, priorite input
- 4 onglets avec compteurs dynamiques
- Boutons Save / Cancel
- Mode creation vs edition

### D3 — Editeurs d'items

- `ui/src/components/config-layers/McpItemEditor.tsx` — MCP server (commande, args, env, OAuth status)
- `ui/src/components/config-layers/HookItemEditor.tsx` — hooks (type, commande, timeout)
- `ui/src/components/config-layers/SkillItemEditor.tsx` — skills (nom, description, contenu markdown)
- `ui/src/components/config-layers/SettingItemEditor.tsx` — settings (cle, valeur, type)

### D4 — Onglet agent `ui/src/components/agents/AgentLayersTab.tsx`

- Liste des layers attachees (triees par priorite)
- Selector pour attacher une nouvelle layer (dropdown searchable des layers disponibles)
- Bouton detach par layer
- Indicateur de conflits (badge rouge si conflits)
- Bouton "Preview Merge"

### D5 — Composants avances

- `ui/src/components/config-layers/MergePreviewPanel.tsx` — drawer avec onglets merge preview
- `ui/src/components/config-layers/ConflictResolutionDialog.tsx` — dialog liste conflits
- `ui/src/components/config-layers/McpOAuthConnectButton.tsx` — bouton OAuth avec gestion popup
- `ui/src/components/config-layers/LayerRevisionHistory.tsx` — panel historique revisions

### D6 — Hooks API `ui/src/hooks/useConfigLayers.ts`

- `useConfigLayers(filters)` — liste avec react-query
- `useConfigLayer(id)` — detail
- `useCreateLayer()` — mutation
- `useUpdateLayer()` — mutation
- `useDeleteLayer()` — mutation
- `useAttachLayer(agentId)` — mutation avec optimistic update
- `useDetachLayer(agentId)` — mutation avec optimistic update
- `useLayerConflicts(agentId)` — query
- `useMergePreview(agentId)` — query
- `useLayerRevisions(layerId)` — query

### D7 — Routes

- Ajout de `/config-layers` dans le router principal
- Ajout de l'onglet "Layers" dans `AgentDetailPage` (conditionnel : si `hasPermission('config_layers:read')`)

---

## Notes techniques

- **Optimistic updates** : pattern identique a celui des autres mutations dans le projet. `onMutate` met a jour le cache react-query, `onError` fait le rollback, `onSettled` invalide la query pour resync.
- **Popup OAuth** : `window.open()` avec `noopener,noreferrer` evite les fuites de referrer. Event listener `message` sur `window` pour recevoir le postMessage du callback. Cleanup du listener au unmount.
- **Badge breakdown** : calcule cote client depuis `itemBreakdown: {mcp_server: number, skill: number, hook: number, setting: number}` retourne par l'API enrichie.
- **Merge preview lazy** : `useMergePreview()` n'est pas appele au montage. Il est declenche uniquement quand l'utilisateur ouvre MergePreviewPanel (enabled: false par defaut, passe a true au click).
- **Priorite input** : slider ou input number avec range 0-998 (999 reserve a la layer company). Afficher un avertissement si priorite >= 500 ("Ceci est la priorite reservee aux base layers").
- **LiveEvents** : ecoute les evenements `config_layer.attached`, `config_layer.detached` pour mettre a jour l'AgentLayersTab en temps reel si un autre admin modifie les layers pendant que l'utilisateur est sur la page.
