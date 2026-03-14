# Section 5 — Component Strategy & Faisabilite Frontend

> **Par Amelia la Dev** | Date : 2026-03-14 | Version : 1.0
> Sources : PRD B2B v1.0 (section 6), UX Journeys & Requirements, code `ui/src/`

---

## Table des matieres

1. [Inventaire Composants shadcn/ui](#1-inventaire-composants-shadcnui)
2. [Component Strategy par FR](#2-component-strategy-par-fr)
3. [Patterns Frontend](#3-patterns-frontend)
4. [Performance UI](#4-performance-ui)

---

## 1. Inventaire Composants shadcn/ui

### 1.1 Composants deja presents dans le projet

Le projet dispose de **22 composants shadcn/ui** installes dans `ui/src/components/ui/` :

| Composant | Fichier | Usage actuel |
|-----------|---------|--------------|
| Avatar | `avatar.tsx` | Profils utilisateurs, membres |
| Badge | `badge.tsx` | Statuts, labels, tags |
| Breadcrumb | `breadcrumb.tsx` | Navigation fil d'Ariane (BreadcrumbBar) |
| Button | `button.tsx` | Actions principales partout |
| Card | `card.tsx` | MetricCard, DashboardCard, ApprovalCard |
| Checkbox | `checkbox.tsx` | Formulaires, filtres, selections |
| Collapsible | `collapsible.tsx` | Sections sidebar retractables |
| Command | `command.tsx` | CommandPalette (Ctrl+K) |
| Dialog | `dialog.tsx` | Modales (NewIssueDialog, NewAgentDialog, etc.) |
| Dropdown Menu | `dropdown-menu.tsx` | Menus contextuels, actions |
| Input | `input.tsx` | Champs de saisie |
| Label | `label.tsx` | Labels de formulaires |
| Popover | `popover.tsx` | InlineEntitySelector, filtres |
| Resizable | `resizable.tsx` | Panneaux redimensionnables (react-resizable-panels) |
| Scroll Area | `scroll-area.tsx` | Listes avec scroll personnalise |
| Select | `select.tsx` | Selecteurs (statut, priorite, assignation) |
| Separator | `separator.tsx` | Separateurs visuels |
| Sheet | `sheet.tsx` | Panneaux lateraux mobile |
| Skeleton | `skeleton.tsx` | PageSkeleton, chargement |
| Tabs | `tabs.tsx` | PageTabBar, onglets projet/agent |
| Textarea | `textarea.tsx` | Descriptions, commentaires |
| Tooltip | `tooltip.tsx` | Infobulles contextuelles |

### 1.2 Composants shadcn/ui a ajouter pour le B2B

| Composant | Justification | FR concerne |
|-----------|---------------|-------------|
| **DataTable** (Table) | Page Membres, Audit Trail, Permissions — besoin de tri, pagination, filtrage, selection en lot | FR-MU, FR-OBS, FR-RBAC |
| **Toggle / Toggle Group** | Curseur d'automatisation 3 positions (Manuel/Assiste/Auto) | FR-DUAL |
| **Switch** | Toggles on/off pour permissions, configs SSO, drift detection | FR-RBAC, FR-CONT |
| **Progress** | Barre de progression workflow, etapes agent, import Jira | FR-ORCH, FR-ONB |
| **Slider** | Sensibilite drift detection, curseur automatisation fin | FR-ORCH, FR-DUAL |
| **Alert / AlertDialog** | Alertes drift critiques, confirmations actions destructives | FR-ORCH, FR-MU |
| **Toast** (deja en custom) | Standardiser sur shadcn/ui Sonner pour coherence | Global |
| **Form** | Formulaires structures : invitation, SSO, workflow editor | FR-MU, FR-ORCH |
| **RadioGroup** | Selection exclusive (mode curseur, type d'import) | FR-DUAL, FR-ONB |
| **HoverCard** | Preview utilisateur/agent au survol dans les listes | FR-MU, FR-OBS |
| **NavigationMenu** | Navigation par role adaptee (masquage permissions) | FR-RBAC |
| **Accordion** | Detail etape workflow, FAQ onboarding, logs expandables | FR-ORCH, FR-ONB |

### 1.3 Composants CUSTOM necessaires (non disponibles dans shadcn/ui)

| Composant | Description | Complexite |
|-----------|-------------|------------|
| **WorkflowPipeline** | Pipeline horizontal interactif avec etapes connectees par fleches, zoom, statuts colores | L |
| **AutomationCursor** | Slider 3 positions avec semantique metier (Manuel/Assiste/Auto), plafond hierarchique | M |
| **OrgChartEditor** | Organigramme interactif drag-and-drop pour onboarding CEO | L |
| **DriftDiffViewer** | Diff visuel attendu vs observe (deja existe en base, a enrichir) | M |
| **ChatPanel** | Panel de chat temps reel avec bulles, typing indicator, actions rapides | L |
| **MessageBubble** | Bulle de message avec support Markdown, horodatage, avatar | S |
| **TypingIndicator** | Animation 3 points pour etat agent (reflexion/execution/attente) | S |
| **MetricWidget** | Widget configurable pour dashboard (graphe, compteur, jauge) | M |
| **TimelineView** | Vue chronologique inversee pour audit trail avec filtre/expand | M |
| **ConnectionStatus** | Indicateur WebSocket (connecte/reconnexion/deconnecte) | S |
| **PermissionMatrix** | Matrice roles x permissions avec 3 etats (autorise/refuse/herite) | L |
| **ImportProgress** | Wizard d'import multi-etapes avec progress bar et mapping | M |
| **ContainerStatus** | Indicateur sante container (CPU, RAM, uptime) avec sparkline | M |

---

## 2. Component Strategy par FR

### 2.1 FR-MU : Multi-User & Auth

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **InviteModal** | `onSubmit`, `defaultRole`, `projects[]` | Local (React state) — formulaire ephemere | M |
| **MembersTable** | `companyId`, `filters`, `onAction` | React Query (`queryKeys.members.list`) — server state avec pagination | L |
| **CompanySelector** | `companies[]`, `selectedId`, `onChange` | Zustand (`useCompany` context existant) — deja implemente partiellement | S |
| **ProfilePage** | `userId` | React Query (`queryKeys.auth.session`) — lecture profil | S |
| **BulkInviteInput** | `onParse`, `maxEmails` | Local — parsing CSV/liste en temps reel | M |
| **InviteStatusBadge** | `status: 'pending' \| 'accepted' \| 'expired'` | Aucun — purement presentationnel | S |
| **MemberActions** | `member`, `onChangeRole`, `onRemove`, `onResend` | Local + React Query mutations | S |

**Notes de faisabilite :**
- `CompanySelector` existe deja (`CompanySwitcher.tsx`, `CompanyRail.tsx`). Evolution mineure : ajouter indicateur visuel et raccourci Ctrl+K.
- `MembersTable` necessite l'ajout de shadcn DataTable (TanStack Table). Pattern deja utilise en interne pour les listes d'issues (`IssuesList.tsx`), adaptation directe.
- Le backend `invites` et `company_memberships` existent deja. Frontend principalement.

### 2.2 FR-RBAC : Roles & Permissions

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **RoleSelector** | `value`, `onChange`, `roles[]`, `showDescription` | Local — dropdown simple | S |
| **PermissionMatrix** | `rolePresets`, `customOverrides`, `onSave` | React Query (GET presets) + Local (edits en cours) + mutation (SAVE) | L |
| **RoleBadge** | `role: 'admin' \| 'manager' \| 'contributor' \| 'viewer'` | Aucun — presentationnel, couleur mappee | S |
| **NavigationGuard** | `requiredPermission`, `children`, `fallback?` | Zustand (store permissions chargees au login) | M |
| **PermissionPreview** | `roleId` | React Query — derivation des presets | S |
| **AccessDeniedPage** | `requiredPermission?`, `contactEmail?` | Aucun — page statique | S |

**Notes de faisabilite :**
- `NavigationGuard` est le composant le plus critique. Il wrappe chaque element de navigation sidebar et masque (pas grise) les items non autorises. Pattern : HOC ou composant wrapper avec `usePermissions()` hook.
- La `PermissionMatrix` est le composant le plus complexe de ce FR : matrice editable avec 15 permissions x 4 roles, 3 etats par case. Necessite une approche `useReducer` locale pour les edits + mutation batch au save.
- Les permissions seront chargees au login et stockees dans un store Zustand dedie `usePermissionStore` — evite un waterfall de requetes.

### 2.3 FR-ORCH : Orchestrateur Deterministe

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **WorkflowPipeline** | `stages[]`, `currentStageId`, `onStageClick`, `editable` | React Query (workflow detail) + Local (selection) | L |
| **StageCard** | `stage`, `status`, `progress`, `timer`, `onClick` | Aucun — presentationnel avec animation CSS | M |
| **DriftAlert** | `drift`, `onAction: (action) => void` | React Query (drift events) — affichage temps reel | M |
| **WorkflowEditor** | `template`, `onSave`, `mode: 'simple' \| 'advanced'` | Local (useReducer) — gros etat interne pour drag-and-drop | L |
| **StageConfigPanel** | `stage`, `onChange` | Local — formulaire lie au WorkflowEditor | M |
| **WorkflowStatusBar** | `workflow`, `currentStage` | React Query — barre en bas de page | S |
| **ConditionEditor** | `conditions[]`, `onChange` | Local — liste editable inline | M |

**Notes de faisabilite :**
- `WorkflowPipeline` est le composant signature de MnM. Pipeline horizontal avec fleches SVG entre etapes, animation de pulsation sur l'etape active, couleurs de statut. Sur mobile : bascule en liste verticale. Estimation : ~500 lignes.
- `WorkflowEditor` utilise `@dnd-kit/core` et `@dnd-kit/sortable` deja installes dans le projet. Le drag-and-drop des etapes est faisable sans nouvelle dependance.
- Le workflow existant (`WorkflowDetail.tsx`, `NewWorkflow.tsx`) fournit une base solide. Evolution progressive.

### 2.4 FR-OBS : Observabilite & Audit

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **AuditLogTable** | `companyId`, `filters`, `onExport` | React Query avec pagination curseur (log immutable) | L |
| **DashboardCard** | `title`, `value`, `trend`, `icon`, `onClick` | Aucun — presentationnel | S |
| **MetricWidget** | `type: 'gauge' \| 'sparkline' \| 'counter'`, `data`, `label` | React Query (polling 5s pour temps reel) | M |
| **TimelineView** | `events[]`, `filters`, `onEventClick` | React Query + Local (filtres, expansion) | M |
| **AgentSummaryPanel** | `agentId` | React Query (polling 5s) — resume LLM temps reel | M |
| **ExportButton** | `format: 'csv' \| 'json'`, `onExport` | Local — etat loading pendant export | S |

**Notes de faisabilite :**
- `AuditLogTable` : les composants `ActivityRow.tsx` et `Activity.tsx` existants fournissent une base. Evolution vers DataTable avec tri/pagination/filtrage.
- `MetricWidget` : les composants `MetricCard.tsx`, `ActivityCharts.tsx` et `DashboardCard` existants sont une base solide. Le projet n'a pas de librairie de graphiques — options : recharts (le plus populaire avec shadcn), ou lightweight avec SVG custom.
- Le WebSocket existant (`LiveUpdatesProvider.tsx`) gere deja les evenements temps reel avec invalidation de cache React Query — pattern a reutiliser pour le polling dashboard.

### 2.5 FR-ONB : Onboarding Cascade

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **OnboardingChat** | `persona`, `maxExchanges`, `onComplete` | Local (messages[]) + React Query mutation (save structure) | L |
| **OrgChartEditor** | `structure`, `onChange`, `editable` | Local (useReducer) — arbre drag-and-drop | L |
| **ImportProgress** | `importJobId`, `steps[]` | React Query (polling status job) | M |
| **SetupWizard** | `currentStep`, `steps[]`, `onComplete` | Local (step index, form data per step) | M |
| **ImportMappingTable** | `sourceItems[]`, `targetOptions[]`, `onMap` | Local — mapping interactif | M |

**Notes de faisabilite :**
- `OnboardingWizard.tsx` existe deja — c'est le point de depart. Evolution vers un wizard multi-personas avec branchement conditionnel selon le role (CEO = chat oral, CTO = formulaire technique, Dev = selection projets).
- `OrgChartEditor` : le composant `OrgChart.tsx` existe deja pour la visualisation. L'edition drag-and-drop est un ajout significatif — utiliser `@dnd-kit` pour la coherence.
- L'import Jira est P2. Le composant `ImportProgress` peut etre developpe en Phase 3-4.

### 2.6 FR-A2A : Agent-to-Agent + Permissions

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **A2ARequestCard** | `request`, `onApprove`, `onReject` | React Query + mutation | M |
| **PermissionDialog** | `sourceAgent`, `targetAgent`, `requestedScope` | Local + mutation | M |
| **ConnectorConfig** | `connectorType`, `config`, `onSave` | Local (formulaire) + React Query mutation | M |
| **A2AFlowDiagram** | `agents[]`, `communications[]` | React Query — visualisation read-only | L |

**Notes de faisabilite :**
- `ApprovalCard.tsx` et `ApprovalPayload.tsx` existent deja pour les validations humaines. Le pattern A2A s'inscrit dans cette logique existante. Evolution naturelle.
- `A2AFlowDiagram` est le composant le plus complexe — visualisation des flux inter-agents. Candidat pour une librairie de graphes (reactflow ou solution SVG custom).
- FR-A2A est Phase 3-4 (P1-P2). Les composants peuvent etre developpes incrementalement.

### 2.7 FR-DUAL : Dual-Speed Workflow

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **AutomationCursor** | `value: 0\|1\|2`, `onChange`, `maxAllowed`, `disabled` | Zustand (`useAutomationStore`) — synchro serveur | M |
| **TaskClassifier** | `task`, `classification: 'mechanical' \| 'judgment'` | React Query — derivation automatique | S |
| **CursorHierarchyView** | `levels[]`, `currentLevel`, `onOverride` | React Query (read) + mutation (override) | M |

**Notes de faisabilite :**
- `AutomationCursor` est un composant metier unique. 3 positions mappees semantiquement : Manuel (0) = tout est humain, Assiste (1) = agent propose/humain valide, Auto (2) = agent execute/humain notifie. Implementer comme un ToggleGroup shadcn/ui stylise avec labels.
- Le plafond hierarchique (CEO > CTO > Manager > Contributor) est une contrainte serveur — le composant affiche le max autorise et desactive les positions superieures.
- Accessibilite : clavier avec Arrow Left/Right, aria-valuenow, annonce vocale au changement.

### 2.8 FR-CHAT : Chat Temps Reel avec Agents

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **ChatPanel** | `channelId`, `agentId`, `readOnly` | Custom hook `useAgentChat` (WebSocket + local messages) | L |
| **MessageBubble** | `message`, `sender`, `timestamp`, `isOwn` | Aucun — presentationnel | S |
| **TypingIndicator** | `state: 'thinking' \| 'executing' \| 'idle'` | Aucun — animation CSS pure | S |
| **ConnectionStatus** | `status: 'connected' \| 'reconnecting' \| 'disconnected'` | Derive du hook `useAgentChat` | S |
| **ChatInput** | `onSend`, `onStop`, `onRollback`, `disabled` | Local (texte en cours de saisie) | M |
| **ChatHistory** | `messages[]`, `onLoadMore`, `hasMore` | React Query (pagination curseur historique) | M |

**Notes de faisabilite :**
- Le WebSocket existant (`LiveUpdatesProvider.tsx`) est unidirectionnel (serveur -> client). Le chat necessite un canal bidirectionnel. Deux options : (a) nouveau endpoint WebSocket dedie au chat, (b) extension du WS existant avec multiplexage par type de message. Option (b) recommandee pour la coherence.
- `ChatPanel` est redimensionnable via `react-resizable-panels` deja installe. Position laterale droite sur desktop, FAB sur mobile.
- Le support Markdown dans les bulles utilise `react-markdown` et `remark-gfm` deja installes.
- Rate limiting (10/min) est une contrainte serveur. Le composant affiche un compteur et desactive l'input en cas de limite.

### 2.9 FR-CONT : Containerisation

| Composant | Props principales | State Management | Complexite |
|-----------|------------------|-----------------|------------|
| **ContainerStatus** | `containerId`, `metrics: {cpu, ram, uptime}` | React Query (polling 10s) | M |
| **ResourceMonitor** | `containers[]`, `thresholds` | React Query — vue agregee | M |
| **CredentialProxyConfig** | `rules[]`, `onSave` | Local + React Query mutation | M |
| **ContainerProfileEditor** | `profile`, `onSave` | Local (formulaire) + mutation | M |

**Notes de faisabilite :**
- FR-CONT est majoritairement backend. Les composants frontend sont des vues de monitoring — pattern identique aux widgets d'observabilite.
- `ContainerStatus` affiche des sparklines de metriques. Option lightweight : SVG inline genere avec `<polyline>` (pas besoin de librairie graphique lourde).
- Composants Phase 3-4, developpement apres la base d'orchestration.

---

## 3. Patterns Frontend

### 3.1 State Management

**Principe directeur : separation server state / client state.**

| Type de state | Solution | Exemples |
|---------------|----------|----------|
| **Server state** (donnees API) | React Query (`@tanstack/react-query` v5) | Membres, agents, workflows, audit, issues |
| **Client state** (UI locale) | React Context existants + Zustand (a ajouter) | Permissions chargees, curseur automatisation, preferences UI |
| **Form state** (formulaires) | React Hook Form + Zod (a ajouter) | Invitation, workflow editor, config SSO |
| **Ephemeral state** (composant) | `useState` / `useReducer` | Filtres locaux, selection, expansion |

**Architecture des stores :**

```
React Query (server state)
  queryKeys.members.list(companyId)
  queryKeys.audit.list(companyId, filters)
  queryKeys.permissions.presets(companyId)
  queryKeys.chat.messages(channelId)
  queryKeys.containers.status(companyId)

Zustand (client state) — a creer
  usePermissionStore     -> permissions du user courant, charge au login
  useAutomationStore     -> curseur automatisation courant
  useChatStore           -> etat du panel chat (ouvert/ferme, channel actif)

React Context (existants)
  CompanyContext          -> company selectionnee (deja en place)
  SidebarContext          -> sidebar open/close (deja en place)
  DialogContext           -> modales globales (deja en place)
  PanelContext            -> panneau proprietes (deja en place)
  ThemeContext            -> dark/light mode (deja en place)
  ToastContext            -> notifications toast (deja en place)
  LiveUpdatesProvider     -> WebSocket events (deja en place)
```

**Pourquoi Zustand plutot qu'un Context supplementaire :**
- Les permissions sont lues tres frequemment (chaque `NavigationGuard`, chaque route) — Zustand evite les re-renders du Provider pattern.
- Le store Zustand persiste naturellement en memoire sans re-creation a chaque render tree.
- Zustand n'est pas encore dans les dependances. Poids : ~1.1 kB gzip. Alternative acceptable : un Context dedie si on veut eviter la dependance.

### 3.2 Routing & Protection

**Structure actuelle :**
- React Router v7 avec prefixe company (`:companyPrefix/dashboard`, etc.)
- `CloudAccessGate` : redirection vers `/auth` si non authentifie
- `CompanyRootRedirect` : redirection vers la company par defaut
- Layout wrappe toutes les routes board

**Evolutions B2B :**

```
Routes protegees par permission :
  /:companyPrefix/members          -> requiert 'members.invite' ou 'members.manage'
  /:companyPrefix/settings/roles   -> requiert 'company.manage'
  /:companyPrefix/audit            -> requiert 'audit.view'
  /:companyPrefix/settings/sso     -> requiert 'company.manage'
  /:companyPrefix/containers       -> requiert 'agents.configure'
```

**Pattern de protection :**

```tsx
// PermissionRoute — composant wrapper
<PermissionRoute permission="members.manage" fallback={<AccessDeniedPage />}>
  <MembersPage />
</PermissionRoute>
```

**Lazy loading par route :**
- Les pages B2B (Membres, Audit, Permissions, Containers) sont chargees en lazy loading via `React.lazy()` + `Suspense` avec `PageSkeleton` comme fallback.
- Le chunk principal contient uniquement : Dashboard, Issues, Agents, Projets (pages les plus frequentes).

### 3.3 Real-time : WebSocket hooks

**Pattern existant :**
- `LiveUpdatesProvider` ecoute un WebSocket par company
- Chaque evenement invalidate les queries React Query concernees
- Pattern : event-driven invalidation (pas de state local WebSocket)

**Nouveau pattern pour le chat bidirectionnel :**

```tsx
// useAgentChat — hook custom
function useAgentChat(channelId: string) {
  // 1. Connexion WebSocket dediee au channel
  // 2. Messages locaux (optimistic) + sync serveur
  // 3. Reconnexion automatique avec buffer 30s
  // 4. Etat agent (thinking/executing/idle)
  return { messages, sendMessage, agentState, connectionStatus }
}
```

**Strategie de reconnexion :**
- Backoff exponentiel deja implemente dans `LiveUpdatesProvider` (1s, 2s, 4s, 8s, max 15s)
- Buffer cote serveur de 30s pour les messages manques pendant la reconnexion (REQ-CHAT-03)
- Indicateur visuel `ConnectionStatus` pendant la reconnexion

### 3.4 Formulaires

**Pattern recommande :** React Hook Form + Zod validation

**Justification :** Les formulaires B2B sont significativement plus complexes que les formulaires actuels (modale d'invitation avec bulk CSV, workflow editor multi-etapes, config SSO avec validation live). React Hook Form offre :
- Validation Zod avec inference TypeScript
- Performance (pas de re-render a chaque keystroke)
- Support natif des formulaires multi-etapes (wizard)

**Formulaires concernes :**
- InviteModal (email validation, role selection, projet scoping)
- WorkflowEditor (prompts, fichiers, conditions par etape)
- SSOConfig (SAML/OIDC endpoints, certificats, test connexion)
- CredentialProxyConfig (regles, patterns, validation)
- ImportMapping (mapping source/destination)

**Dependances a ajouter :** `react-hook-form` (~8 kB gzip), `zod` (~13 kB gzip), `@hookform/resolvers` (~1 kB gzip)

### 3.5 Tables de donnees

**Pattern :** TanStack Table (via shadcn/ui DataTable pattern)

Le projet utilise deja `@tanstack/react-query`. TanStack Table s'integre naturellement et fournit :
- Tri multi-colonnes
- Pagination serveur
- Filtrage avance
- Selection en lot (bulk actions)
- Colonnes redimensionnables

**Tables concernees :**
- MembersTable : 8 colonnes, filtres role/statut/projet, bulk actions
- AuditLogTable : 7 colonnes, filtres acteur/action/workflow/periode, export
- PermissionMatrix : matrice editable 15x4

**Dependance a ajouter :** `@tanstack/react-table` (~14 kB gzip)

### 3.6 Responsive Design

**Breakpoints definis par l'UX :**

| Breakpoint | Taille | Adaptations |
|------------|--------|-------------|
| **Desktop** | >= 1280px | Experience complete, tous panneaux visibles |
| **Laptop** | 1024-1279px | ChatPanel en overlay, sidebar retractable |
| **Tablette** | 768-1023px | Sidebar hamburger, Kanban scroll horizontal |
| **Mobile** | < 768px | Vue simplifiee, un panneau a la fois, FAB pour chat |

**Patterns deja implementes :**
- Sidebar retractable avec swipe mobile (`Layout.tsx` lines 121-164)
- Bottom nav mobile (`MobileBottomNav.tsx`)
- Scroll-based nav hide/show (`handleMainScroll` dans Layout)
- Safe area insets pour les encoches (`env(safe-area-inset-top)`)

**Ajouts B2B :**
- Tables responsives : bascule vers vue "carte" sous 768px
- Pipeline workflow : bascule horizontal -> vertical sous 768px
- PermissionMatrix : scroll horizontal avec colonnes fixes sur mobile
- ChatPanel : FAB en bas a droite sur mobile, sheet full-width au clic

---

## 4. Performance UI

### 4.1 Code Splitting par Route

**Strategie :** Lazy loading des pages B2B non-critiques.

```
Bundle principal (~150 kB gzip estime) :
  Dashboard, Issues, Agents, Projects
  Layout, Sidebar, CommandPalette
  shadcn/ui primitives

Chunks lazy :
  Members + RBAC        ~25 kB (PermissionMatrix, MembersTable)
  Audit + Observability ~30 kB (AuditLogTable, MetricWidgets, charts)
  Workflow Editor       ~35 kB (dnd-kit, StageConfigPanel, ConditionEditor)
  Chat                  ~20 kB (ChatPanel, MessageBubble, WebSocket hook)
  Containers            ~15 kB (ContainerStatus, ResourceMonitor)
  Onboarding            ~20 kB (OrgChartEditor, ImportProgress)
  SSO Config            ~10 kB
```

**Implementation :** `React.lazy()` + `Suspense` avec `PageSkeleton` comme fallback, deja present dans le projet.

### 4.2 Virtualisation

**Listes longues necessitant virtualisation :**
- AuditLogTable : potentiellement des millions d'entrees (3+ ans de retention)
- MembersTable : jusqu'a 10 000 users en enterprise
- ChatHistory : historique long de conversations

**Solution recommandee :** TanStack Virtual (`@tanstack/react-virtual`, ~2.5 kB gzip)
- Deja dans l'ecosysteme TanStack utilise par le projet
- Support natif du scroll infini (pagination curseur)
- Integre avec TanStack Table pour les grandes tables

### 4.3 Optimistic Updates

**Actions frequentes necessitant des optimistic updates :**

| Action | Optimistic behavior |
|--------|-------------------|
| Envoyer un message chat | Bulle affichee immediatement, spinner si echec |
| Changer statut issue (Kanban drag) | Issue deplacee immediatement, rollback si erreur |
| Approuver/rejeter A2A request | Badge mis a jour immediatement |
| Modifier curseur automatisation | Slider bouge immediatement, sync serveur en arriere-plan |
| Toggle permission dans la matrice | Case mise a jour immediatement |

**Pattern React Query :**
```tsx
useMutation({
  mutationFn: updateIssueStatus,
  onMutate: async (newStatus) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.issues.list(companyId) })
    const previous = queryClient.getQueryData(queryKeys.issues.list(companyId))
    queryClient.setQueryData(queryKeys.issues.list(companyId), (old) => /* update */)
    return { previous }
  },
  onError: (err, newStatus, context) => {
    queryClient.setQueryData(queryKeys.issues.list(companyId), context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) })
  },
})
```

### 4.4 WebSocket Reconnection Strategy

**Deja implemente dans `LiveUpdatesProvider.tsx` :**
- Backoff exponentiel : 1s, 2s, 4s, 8s, 15s max
- Suppression des toasts pendant 2s apres reconnexion
- Cooldown par categorie : max 3 toasts par 10s par type

**A ajouter pour le chat :**
- Buffer serveur 30s pour les messages manques
- Sync automatique des messages manques a la reconnexion
- Indicateur visuel "X messages manques" avec bouton "Charger"

### 4.5 Optimisation Assets

**Pratiques recommandees :**
- Icones : Lucide React (deja installe) — tree-shaking automatique
- Images : preload des assets critiques, lazy loading des images non-visibles
- Fonts : preload de la font principale, `font-display: swap`
- Mermaid : deja installe pour les diagrammes, charger en lazy (bundle lourd ~200 kB)

---

## Annexe — Synthese des Dependances a Ajouter

| Dependance | Poids gzip | Justification |
|------------|-----------|---------------|
| `@tanstack/react-table` | ~14 kB | DataTable pour Membres, Audit, Permissions |
| `@tanstack/react-virtual` | ~2.5 kB | Virtualisation grandes listes |
| `react-hook-form` | ~8 kB | Formulaires complexes B2B |
| `zod` | ~13 kB | Validation schemas |
| `@hookform/resolvers` | ~1 kB | Bridge RHF + Zod |
| `zustand` | ~1.1 kB | Client state (permissions, curseur) |
| `recharts` | ~45 kB | Graphiques dashboard (optionnel — SVG custom possible) |
| **Total** | **~85 kB** | Budget additionnel raisonnable |

**Note :** Le bundle total estime en production rest sous 500 kB gzip avec code splitting, ce qui respecte le NFR de chargement dashboard < 2s meme sur connexion 3G.

---

## Annexe — Matrice Composants x Phases

| Composant | Phase 1 (1 sem) | Phase 2 (2 sem) | Phase 3 (3 sem) | Phase 4 (4 sem) |
|-----------|:-:|:-:|:-:|:-:|
| InviteModal | X | | | |
| MembersTable | X | | | |
| CompanySelector | X | | | |
| RoleSelector | | X | | |
| PermissionMatrix | | X | | |
| RoleBadge | | X | | |
| NavigationGuard | | X | | |
| WorkflowPipeline | | | X | |
| WorkflowEditor | | | X | |
| DriftAlert | | | X | |
| AuditLogTable | | | X | |
| MetricWidget | | | X | |
| AutomationCursor | | | X | |
| ChatPanel | | | X | |
| MessageBubble | | | X | |
| OnboardingChat | | | | X |
| OrgChartEditor | | | | X |
| ContainerStatus | | | | X |
| A2ARequestCard | | | | X |
| SSOConfig | | | | X |

---

> **Conclusion de faisabilite :** L'architecture frontend existante est solide et bien structuree. Les patterns en place (React Query, Context, WebSocket, dnd-kit, shadcn/ui) couvrent ~70% des besoins B2B. Les ajouts necessaires sont incrementaux et compatibles avec la stack existante. Le budget de dependances additionnelles (~85 kB gzip) est raisonnable. La principale complexite reside dans les composants metier custom (WorkflowPipeline, ChatPanel, PermissionMatrix, OrgChartEditor) qui representent environ 60% de l'effort frontend total. Le planning en 4 phases est realiste avec un developpeur frontend dedie.
