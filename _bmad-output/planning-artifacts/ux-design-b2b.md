# UX Design B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : Sally (Lead UX), Maya (Design Thinker), Caravaggio (Visual), John (PM), Amelia (Dev), Victor (Stratège), Paige (Tech Writer)
> **Sources** : PRD B2B v1.0, Product Brief B2B v2.0, 57 Vérités Fondamentales

---

## Table des Matières

1. [Design Philosophy](#1-design-philosophy)
2. [Core Experience](#2-core-experience)
3. [Emotional Response Design](#3-emotional-response-design)
4. [Inspiration & References](#4-inspiration--references)
5. [Design System](#5-design-system)
6. [Defining Experiences](#6-defining-experiences)
7. [Visual Foundation](#7-visual-foundation)
8. [Design Directions](#8-design-directions)
9. [User Journeys Détaillés](#9-user-journeys-détaillés)
10. [Component Strategy](#10-component-strategy)
11. [UX Patterns](#11-ux-patterns)
12. [Innovation UX & Différenciation](#12-innovation-ux--différenciation)
13. [Responsive & Accessibility](#13-responsive--accessibility)
14. [Design Tokens](#14-design-tokens)
15. [Priorisation UX & Roadmap](#15-priorisation-ux--roadmap)

---

## 1. Design Philosophy

### 1.1 Principe Fondateur : Un Cockpit Unifié, Neuf Réalités

MnM n'est pas un outil. C'est un **cockpit de supervision** qui s'adapte à celui qui le pilote.

La philosophie UX repose sur une conviction : 9 personas différents (CEO, CTO, DPO, PM, PO, Designer, Dev, QA, Lead Tech) ont besoin d'accéder à la **même réalité partagée** — projets, agents, workflows, avancement — mais à travers des **lentilles radicalement différentes**. Le CEO ne voit jamais une ligne de code. Le développeur ne voit jamais un PowerPoint. Pourtant, ils travaillent sur le même produit.

Cela se traduit par un principe architectural UX : **une seule application, cinq modes coexistants, adaptation contextuelle au rôle**.

| Mode | Persona Primaire | Expérience | Principe |
|------|-----------------|------------|----------|
| **ORAL** | CEO, DSI, DPO | Conversation naturelle, dictée stratégique, synthèses | "Je parle, MnM structure" |
| **VISUEL** | CTO, Lead Tech | Dashboards temps réel, graphes, monitoring drift | "Je vois tout d'un coup d'œil" |
| **CODE** | Dev, Lead Tech | Terminal intégré, agent pilotable temps réel | "Mon workflow de dev, augmenté" |
| **BOARD** | PM, PO, DPO | Kanban, roadmap, priorisation drag-and-drop | "Mon backlog, orchestré" |
| **TEST** | QA, Lead Tech | Suites de tests, couverture, rapports de régression | "Mes tests, capitalisés" |

Ces modes **ne sont pas des pages séparées**. Ils coexistent dans le même cockpit. Un Lead Tech active CODE + BOARD + VISUEL simultanément. Le mode est un **filtre sur la même réalité**, pas un silo.

### 1.2 Le Curseur d'Automatisation — Concept UX Central

L'innovation UX qui distingue MnM de tout ce qui existe. Il matérialise la Vérité #30 : *"L'adoption de l'automatisation est un curseur individuel, pas un switch global."*

```
[MANUEL] ============== [ASSISTÉ] ============== [AUTOMATIQUE]
    |                       |                          |
    L'humain fait           L'agent propose            L'agent exécute
    L'agent observe         L'humain valide            L'humain supervise
```

Le curseur s'applique à **quatre niveaux simultanément** :

| Niveau | Exemple | Qui le règle |
|--------|---------|-------------|
| Par action | "Tests = auto, code review = assisté" | L'utilisateur |
| Par agent | "Agent reporting = auto, brainstorm = manuel" | L'utilisateur |
| Par projet | "Projet legacy = assisté, nouveau = auto" | Le manager/CTO |
| Par entreprise | "Plafond : aucun merge sans validation" | Le CEO/CTO |

**La hiérarchie l'emporte** : le CEO impose un plafond que les niveaux inférieurs ne peuvent pas dépasser. C'est du RBAC appliqué à l'autonomie IA.

**Évolution naturelle** : Semaine 1-2 tout en MANUEL (découverte) → Mois 1 les tâches répétitives passent en ASSISTÉ → Mois 3+ les tâches maîtrisées passent en AUTO, les tâches créatives restent en MANUEL par choix. **Savoir faire devient savoir juger** (Vérité #20 : élévation, pas remplacement).

### 1.3 Confiance et Contrôle

La confiance est le prérequis absolu. Sans elle, aucun curseur ne sera déplacé vers la droite.

**Pilier 1 — Transparence radicale** : Chaque action d'un agent est visible, traçable, compréhensible. Pas des logs bruts — des résumés LLM en langage naturel.

**Pilier 2 — Contrôle immédiat** : À tout moment, l'utilisateur peut arrêter un agent (bouton Stop), annuler ses modifications (Rollback), ou reprendre le contrôle manuellement. Latence d'interruption < 1 seconde.

**Pilier 3 — Métriques agrégées, jamais individuelles** (Vérité #20) : Les dashboards management ne montrent JAMAIS de données individuelles. L'outil élève les rôles, il ne surveille pas les personnes.

### 1.4 Orchestration Déterministe

Les workflows sont des **contrats algorithmiques**, pas des suggestions. L'agent ne décide pas de l'ordre des étapes — MnM l'impose. Le pipeline visuel rend cette contrainte tangible et rassurante.

---

## 2. Core Experience

### 2.1 Structure de Navigation

```
+============================================================================+
|  [MnM logo]  [Company v]  |  Navigation principale  |  [?] [Notif] [Avatar] |
+============================================================================+
|  Sidebar        |                                                           |
|  adaptée au     |              Zone de contenu                              |
|  rôle           |              dynamique                                    |
|                 |                                                           |
|  [Dashboard]    |              (s'adapte au mode et au contexte)            |
|  [Projets]      |                                                           |
|  [Workflows]    |                                                           |
|  [Agents]       |                                                           |
|  [Membres]      |                                                           |
|  [Paramètres]   |                                                           |
+============================================================================+
|  Barre de statut : workflow actif, étape courante, santé agent              |
+============================================================================+
```

- **Header fixe** : Logo, sélecteur Company, navigation principale, Command Palette (Ctrl+K), notifications, profil
- **Sidebar adaptée** : Items masqués (pas grisés) selon les permissions. Collapsible sur mobile.
- **Zone de contenu** : S'adapte au mode (ORAL/VISUEL/CODE/BOARD/TEST) et au contexte
- **Barre de statut** : Workflow actif, étape courante, santé de l'agent, timer

### 2.2 Flux Principaux par Persona

| Persona | Flux Principal | Flux Secondaire |
|---------|---------------|----------------|
| **CEO** | Dashboard → Chat stratégique → Rapports | Invitation cascade → Organigramme |
| **CTO** | Workflows → Monitoring drift → Config SSO | Dashboard technique → Alertes |
| **Dev** | Board → Sélection story → Agent → Code → Chat → Merge | Reviews pré-analysées |
| **PO** | Board → Épic → Brainstorm agent → Stories → Validation DoR | Sprint suivi |
| **PM** | Brainstorm → Synthèse → Épic → Roadmap | Conflits inter-équipes |
| **Lead Tech** | Dashboard technique → Reviews augmentées → Dette | Workflow refactoring |

### 2.3 Command Palette (Ctrl+K)

Navigation universelle filtrée par rôle. L'utilisateur tape et obtient des résultats contextuels :
- "Projet Alpha" → ouvre le projet
- "Agent Alice" → ouvre la supervision de l'agent
- "Inviter" → ouvre la modale d'invitation (si admin/manager)
- "Drift" → affiche les alertes drift en cours

---

## 3. Emotional Response Design

### 3.1 Empathy Maps par Persona

#### CEO — Le Pilote Stratégique

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que cet outil va me donner la visibilité que je n'ai jamais eue ?" |
| **Ressent** | Impatience chronique. Frustration de compiler des infos de 5 outils. Solitude décisionnelle. |
| **Douleurs** | Information fragmentée (Vérité #15). Pas de vue temps réel. Coordination synchrone coûteuse. |
| **Gains** | "J'ouvre un dashboard et je pose une question." Visibilité temps réel sans intermédiaires. |

**Arc émotionnel** : Scepticisme → Curiosité (onboarding conversationnel) → Surprise (structure générée) → Confiance (dashboard J+2) → Satisfaction profonde (usage quotidien)

#### CTO — Le Garant Technique

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que c'est techniquement solide ou du marketing ?" |
| **Ressent** | Méfiance technique initiale. Besoin viscéral de contrôle et de preuve. |
| **Douleurs** | Agents sans orchestration (Vérité #45). Logs illisibles. Standards non-automatisés. |
| **Gains** | Workflows déterministes. Drift detection avec diff visuel. Audit centralisé prouvable. |

**Arc émotionnel** : Méfiance → Vérification (config SSO OK) → Flow (éditeur workflow) → Maîtrise (drift detection) → Sérénité (monitoring quotidien)

#### Développeur — L'Artisan du Code

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que ça va m'aider ou me ralentir ?" |
| **Ressent** | Curiosité + scepticisme. Ne veut pas d'un outil "en plus". |
| **Douleurs** | Contexte incomplet. Interruptions. Code review manuelles longues. |
| **Gains** | Agent personnel pilotable. Contexte complet préchargé. Livraison en 2h au lieu de 6h. |

**Arc émotionnel** : Scepticisme → Focus (board personnel) → Fascination (voir le code se construire) → Contrôle (stop/rollback) → Accomplissement (merge rapide)

#### PO, PM, Lead Tech

Arcs similaires détaillés ci-dessous. Points clés :
- **PO** : "En 5 min au lieu de 2h" (brainstorm → stories structurées)
- **PM** : "Zéro perte d'info entre ma pensée et l'exécution"
- **Lead Tech** : "Review en 10 min au lieu de 45 min"

### 3.2 Anti-patterns Émotionnels à Éviter

- **Complexité technique visible** : si le CEO voit un prompt, un JSON, un terminal → échec
- **Latence > 15 secondes** : tue la confiance immédiatement
- **Dashboard vide** : provoque le désengagement → afficher "en attente de données" avec progression
- **Sentiment de surveillance** : JAMAIS de métriques individuelles (Vérité #20)
- **Perte de contrôle** : l'utilisateur doit TOUJOURS pouvoir arrêter un agent en < 1 seconde

---

## 4. Inspiration & References

### 4.1 Références Produit

| Produit | Ce qu'on emprunte | Ce qu'on adapte |
|---------|-------------------|----------------|
| **Notion** | Simplicité, blocs modulables, Command Palette | MnM est plus structuré (workflows imposés vs liberté totale) |
| **Linear** | Vitesse, élégance, raccourcis clavier | MnM ajoute la profondeur orchestration IA |
| **Figma** | Collaboration temps réel, multiplayer | MnM applique ce pattern aux agents IA |
| **Datadog** | Dashboards techniques, monitoring temps réel | MnM ajoute la couche non-technique (CEO, PM, PO) |

### 4.2 Anti-références

- **Jira** : Complexité excessive, 1000 clics pour une action simple
- **Salesforce** : Surcharge informationnelle, interface intimidante
- **Slack** : Bruit informationnel → MnM structure les communications

---

## 5. Design System

### 5.1 Stack

Basé sur **shadcn/ui + Tailwind CSS + Radix UI** — la stack existante du projet.

### 5.2 Palette de Couleurs

**Primaires & Sémantiques**

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `--primary` | Actions principales, liens, focus | Bleu MnM #2563EB | #3B82F6 |
| `--secondary` | Actions secondaires | Gris ardoise | Gris moyen |
| `--success` | Validé, terminé, actif | #16A34A | #22C55E |
| `--warning` | Drift, attention, compaction | #D97706 | #F59E0B |
| `--error` | Erreur, critique, refusé | #DC2626 | #EF4444 |
| `--info` | Information, neutre | #2563EB | #60A5FA |
| `--agent` | Actions IA (distinctes des humaines) | #7C3AED | #8B5CF6 |

**Par Rôle RBAC**

| Rôle | Couleur | Usage |
|------|---------|-------|
| Admin | Rouge `#DC2626` | Badge, indicateur danger/pouvoir |
| Manager | Bleu `#2563EB` | Badge, actions managériales |
| Contributor | Vert `#16A34A` | Badge, actions d'exécution |
| Viewer | Gris `#6B7280` | Badge, lecture seule |

**Par Statut Workflow**

| Statut | Couleur | Icône |
|--------|---------|-------|
| À venir | Gris | Circle |
| En cours | Bleu + animation pulsation | Loader |
| Terminé | Vert | CheckCircle |
| Erreur | Rouge | XCircle |
| Drift | Orange | AlertTriangle |

### 5.3 Typographie

- **Corps** : Inter (variable) — disponible sur Google Fonts, optimisé pour les interfaces
- **Code** : JetBrains Mono — pour les terminaux, diffs, snippets
- **Échelle** : xs(12px), sm(14px), base(16px), lg(18px), xl(20px), 2xl(24px), 3xl(30px), 4xl(36px)
- **Graisses** : normal(400), medium(500), semibold(600), bold(700)

### 5.4 Spacing & Grid

- **Base** : 4px (tout est multiple de 4)
- **Grid** : 12 colonnes, gap 16px (4 unités)
- **Sidebar** : 256px collapsed à 64px (icônes seules)

### 5.5 Composants Clés (10)

| Composant | Variantes | États |
|-----------|-----------|-------|
| **Button** | primary, secondary, outline, ghost, destructive | default, hover, active, disabled, loading |
| **Card** | default, elevated, interactive, agent | default, hover, selected, loading |
| **Dialog** | default, confirmation, destructive | open, closing |
| **Table** | default, sortable, selectable, paginated | loading, empty, error |
| **Badge** | role, status, count, agent | — |
| **Toast** | success, error, warning, info | entering, visible, exiting |
| **Dropdown** | menu, select, command | open, closed |
| **Form** | input, textarea, select, checkbox, radio, slider | default, focus, error, disabled |
| **Sidebar** | expanded, collapsed, mobile | — |
| **CommandPalette** | search, navigation, actions | open, loading, empty |

### 5.6 Animations

Subtiles et fonctionnelles, jamais décoratives :
- Transitions : `150ms ease-in-out` (rapide), `200ms` (normal), `300ms` (lente)
- Pulsation légère sur l'étape active du workflow
- Skeleton loading pour le chargement de contenu
- Respect de `prefers-reduced-motion`

---

## 6. Defining Experiences

Les 5 moments qui définissent l'identité de MnM :

### 6.1 Premier Onboarding CEO

**Émotion visée** : Confiance immédiate — "C'est différent d'un formulaire"

**Déroulement** : Le CEO clique sur le lien d'invitation → chat conversationnel avec agent d'onboarding → 5-7 échanges structurés → organigramme visuel généré automatiquement → drag-and-drop pour ajuster → validation → invitations cascade envoyées.

**Métriques** : Time-to-structure < 15 min, taux complétion > 70%, satisfaction > 4/5.

### 6.2 Premier Agent Lancé

**Émotion visée** : Fascination + Contrôle — "Je vois le code se construire"

**Déroulement** : Le dev sélectionne une story → lance l'agent → split view s'ouvre (code à gauche, chat à droite) → le code se modifie en temps réel avec diff coloré → le dev intervient via chat ("utilise le pattern Repository") → l'agent s'adapte → tests générés automatiquement → merge en 1 clic.

**Métriques** : Time-to-first-agent < 30 min, interruption réussie 100%, satisfaction > 4.5/5.

### 6.3 Première Alerte Drift

**Émotion visée** : Urgence maîtrisée — "Je sais quoi faire"

**Déroulement** : Badge rouge sur l'étape du pipeline → notification toast → panneau drift : attendu vs observé en diff visuel → sévérité (Info/Warning/Critical) → actions proposées (Ignorer/Recharger/Kill+relance/Alerter CTO).

**Métriques** : Temps détection < 15 min, temps résolution < 5 min, 0 drift non-détecté.

### 6.4 Première Communication A2A

**Émotion visée** : Puissance organisationnelle — "Mes agents collaborent"

**Déroulement** : Agent A (du dev) émet une requête de contexte à Agent B (du PO) → notification au PO → validation en 1 clic → Agent A reçoit le contexte → audit log enregistré.

### 6.5 Premier Dashboard Management

**Émotion visée** : Satisfaction profonde — "Je vois TOUT sans rien demander"

**Déroulement** : Le CEO ouvre MnM J+2 → KPIs headline (agents actifs, taux workflow, drifts) → avancement par BU → alertes en cours → chat stratégique en bas → question "Où en est Alpha ?" → synthèse contextuelle.

---

## 7. Visual Foundation

### 7.1 Hiérarchie Visuelle — 4 Niveaux

```
  NIVEAU 1 (Focal)        ████████████████  ← Saturée, large, ombre
  NIVEAU 2 (Actif)       ░░░░░░░░░░░░░░░░  ← Surface élevée, bordure
  NIVEAU 3 (Secondaire)  .................. ← Neutre, discret
  NIVEAU 4 (Ambiant)     · · · · · · · · · ← Réduit, hover-only
```

- **Niveau 1 (Focal)** : Actions principales, alertes critiques. Un seul par écran. `font-bold`, couleur saturée.
- **Niveau 2 (Actif)** : Étape courante, chat actif, panneau sélectionné. `font-medium`, fond contrasté.
- **Niveau 3 (Secondaire)** : Widgets non-focusés, listes, historique. `font-normal`, bordures légères.
- **Niveau 4 (Ambiant)** : Metadata, timestamps, IDs techniques. Opacité 60%, hover-only.

### 7.2 Architecture de l'Information

4 écrans principaux adaptés par persona :
- **Dashboard Exécutif** (CEO) : KPIs headline + avancement BU + alertes + chat stratégique
- **Monitoring Technique** (CTO) : Graphe drift + agents actifs + containers + métriques compaction
- **Board Dev/PO** : Kanban stories + progression agent + chat + statut DoR
- **Éditeur Workflow** (CTO) : Pipeline drag-and-drop + détail étape + prompts + fichiers obligatoires

### 7.3 Layout Grid

- **12 colonnes**, gap 16px
- **Breakpoints** : sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
- **Sidebar** : 256px desktop, 64px collapsed, hamburger mobile
- **ChatPanel** : 320px fixe à droite quand actif

### 7.4 Iconographie

Lucide React (déjà dans shadcn/ui) — 5 tailles standardisées : xs(14), sm(16), md(20), lg(24), xl(32).

14 icônes sémantiques MnM : Play (lancer agent), Square (stop), RotateCcw (rollback), AlertTriangle (drift), Shield (permissions), Container (docker), MessageSquare (chat), Zap (auto), Hand (manuel), Eye (observer), CheckCircle (validé), XCircle (erreur), Clock (timer), Users (équipe).

Règle : **triple encodage** — couleur + icône + texte pour chaque statut. Jamais la couleur seule.

---

## 8. Design Directions

### 8.1 Direction A — "Control Tower"

Inspiration aéronautique/spatial. Dark mode dominant. Données techniques en avant-plan.
- **Pour** : CTO, Dev, Lead Tech
- **Contre** : Trop technique pour CEO, PM, PO
- **Palette** : Bleu nuit, accents néon, haute densité de données

### 8.2 Direction B — "Clarity Studio"

Inspiration Notion/Linear. Light mode dominant. Minimalisme, whitespace, focus contenu.
- **Pour** : CEO, PM, PO
- **Contre** : Trop simple pour les données complexes (monitoring, drift, containers)
- **Palette** : Blanc, gris doux, accents subtils

### 8.3 Direction C — "Adaptive Cockpit" (RECOMMANDÉE)

Hybride qui **s'adapte au persona**. C'est la seule direction qui honore la promesse multi-rôle.

- **Technique** (CTO, Dev, Lead Tech) : Dark mode, haute densité, code en premier plan
- **Management** (CEO, PM, PO) : Light mode, cards aérées, synthèses textuelles
- **Transitions** : Le cockpit change visuellement selon le mode actif

```
Mode CEO (Light, aéré):              Mode CTO (Dark, dense):
+============================+       +============================+
| MnM  [Dashboard]      [AV]|       | MnM  [Monitoring]     [AV]|
|                            |       |                            |
|  +--------+  +--------+   |       |  Drift ████░░ 3 actifs     |
|  | BU FR  |  | BU USA |   |       |  +--- Agents ----+  +---+  |
|  | 78%    |  | 64%    |   |       |  | alice ■ Code   |  |CPU|  |
|  +--------+  +--------+   |       |  | bob   ■ Test   |  |48%|  |
|                            |       |  | carol ● Idle   |  +---+  |
|  Chat: "Où en est Alpha?"|       |  +----------------+         |
+============================+       +============================+
```

**Recommandation** : Direction C "Adaptive Cockpit" avec choix utilisateur dark/light en override.

### 8.4 Dark/Light Mode Strategy

| Persona | Mode par défaut | Raison |
|---------|----------------|--------|
| CEO, DSI, DPO, PM, PO | Light | Contexte bureau, présentations |
| CTO, Dev, Lead Tech, QA | Dark | Contexte code, longues sessions |

L'utilisateur peut toujours override. Token mapping complet entre les deux modes.

---

## 9. User Journeys Détaillés

> Document complet avec wireframes textuels ASCII : `_bmad-output/planning-artifacts/ux-journeys-requirements.md`

6 journeys détaillés couverts dans le PRD (section 4) : CEO, CTO, Dev, PO, PM, Lead Tech. Chaque journey inclut 4-8 étapes avec action utilisateur, réponse système, émotion visée et frictions potentielles.

---

## 10. Component Strategy

### 10.1 Inventaire

- **22 composants shadcn/ui existants** dans le projet
- **12 composants shadcn/ui à ajouter** : DataTable, Toggle, Switch, Progress, Slider, Alert, Form, RadioGroup, HoverCard, NavigationMenu, Accordion, Sheet
- **13 composants CUSTOM** nécessaires pour le B2B

### 10.2 Composants par FR

| FR | Composants | Complexité |
|----|-----------|-----------|
| FR-MU | InviteModal, MembersTable, CompanySelector, ProfilePage | M |
| FR-RBAC | RoleSelector, PermissionMatrix, RoleBadge, NavigationGuard | M |
| FR-ORCH | WorkflowPipeline, StageCard, DriftAlert, WorkflowEditor | L |
| FR-OBS | AuditLogTable, DashboardCard, MetricWidget, TimelineView | M |
| FR-ONB | OnboardingChat, OrgChart, ImportProgress, SetupWizard | L |
| FR-A2A | A2ARequestCard, PermissionDialog, ConnectorConfig | M |
| FR-DUAL | AutomationCursor (slider 3 positions), TaskClassifier | M |
| FR-CHAT | ChatPanel, MessageBubble, TypingIndicator, ConnectionStatus | M |
| FR-CONT | ContainerStatus, ResourceMonitor, CredentialProxyConfig | S |

### 10.3 Patterns Frontend

- **State management** : React Query (server state) + Zustand (client state) + Context (theme/auth)
- **Routing** : Protection par permissions, lazy loading par route
- **Real-time** : WebSocket hooks (useWebSocket, useAgentChat) avec reconnexion automatique
- **Forms** : React Hook Form + Zod validation
- **Tables** : TanStack Table (DataTable shadcn/ui)
- **Performance** : Code splitting, TanStack Virtual (grandes listes), optimistic updates

### 10.4 Budget Dépendances

L'architecture existante couvre ~70% des besoins B2B. Dépendances additionnelles : ~85 kB gzip total. 41 composants UI, 13 pages, ~42 jours de design UX estimés.

---

## 11. UX Patterns

### 11.1 Navigation

- **Sidebar collapsible** : 256px → 64px, hamburger mobile
- **Breadcrumbs** : fil d'Ariane contextuel sur toutes les pages
- **Command Palette** (Ctrl+K) : navigation universelle filtrée par rôle et permissions

### 11.2 Feedback

- **Toast notifications** : 4 variantes (success/error/warning/info), auto-dismiss 5s, empilables
- **Loading states** : Skeleton (contenu structuré), Spinner (actions ponctuelles), Progress bar (longues opérations)
- **Optimistic updates** : les actions fréquentes (validation, assignation) apparaissent immédiatement

### 11.3 Notifications

- **Centre de notifications** : cloche avec badge count, groupement par type
- **Alertes prioritaires** : drift critical → toast rouge persistant + son optionnel
- **Actions inline** : résoudre, ignorer, voir détails directement depuis la notification

### 11.4 Permissions

- **Masquage > Grisage** : les items non-autorisés sont absents du DOM, pas grisés (pas de frustration)
- **Page 403** : "Vous n'avez pas accès. Contactez votre administrateur." avec lien retour
- **Redirect intelligent** : si un lien partagé mène à une page non-autorisée, redirect vers la page autorisée la plus proche

### 11.5 Erreurs

- **Error boundary** : composant React qui capture les erreurs et affiche un message clair avec option "Réessayer"
- **Page 404** : navigation contextuelle vers les sections existantes
- **Formulaires** : erreurs inline sous chaque champ avec `aria-describedby`, validation Zod temps réel
- **Retry pattern** : backoff exponentiel pour les erreurs réseau, max 3 tentatives

### 11.6 Temps Réel

- **Indicateur connexion WebSocket** : vert (connecté), orange (reconnexion), rouge (déconnecté)
- **Reconnexion automatique** : backoff exponentiel, sync messages manqués (buffer 30s)
- **Optimistic updates** : action affichée immédiatement, rollback si échec serveur

---

## 12. Innovation UX & Différenciation

### 12.1 Cinq Innovations UX Uniques

1. **Le Curseur d'Automatisation** — Slider 3 positions × 4 granularités × hiérarchie. Design : slider segmenté avec zone verte (accessible) et zone grisée (bloquée par hiérarchie). Recommandation basée sur l'historique.

2. **Le Dual-Mode** — 5 modes coexistants, navigation adaptative au rôle et au contexte. La réponse est multi-modale : le CEO pose une question orale, la réponse inclut un dashboard visuel.

3. **Le Cockpit Temps Réel** — Split view code + chat synchronisés. Le dev voit son agent coder en direct. Pattern "Observe & Intervene" — supervision active, pas fire-and-forget.

4. **L'Onboarding Cascade** — Chaque niveau configure le cadre du niveau inférieur. Organigramme interactif. Import Jira comme "moment de vérité".

5. **Les Dashboards Éthiques** — Agrégation obligatoire au niveau architectural. Drill-down s'arrête au niveau équipe. Dashboard personnel = privé. Alertes factuelles, non-attributives.

### 12.2 Différenciation vs Concurrents

| Axe | MnM | Jira | Cursor | Linear | CrewAI |
|-----|-----|------|--------|--------|--------|
| Multi-rôle | 9 personas | 3 (PM, Dev, Admin) | 1 (Dev) | 3 (PM, Dev, Design) | 0 (code only) |
| Mode d'interaction | 5 modes | Board uniquement | Code uniquement | Board + Issue | CLI/Code |
| Orchestration IA | Déterministe | Suggestions | Assisté | Aucune | Probabiliste |
| Drift detection | Temps réel | Non | Non | Non | Non |
| Curseur autonomie | 3 positions × 4 niveaux | Non | Non | Non | Non |
| Observabilité | Agrégée + éthique | Basique | Aucune org | Basique | Logs bruts |

### 12.3 UX Patterns Uniques à MnM

- **Observe & Intervene** : supervision active, métaphore du copilote
- **Cascade Down** : délégation hiérarchique structurelle
- **Trust Gradient** : progression naturelle du curseur avec la confiance
- **Aggregate, Never Individual** : drill-down management s'arrête au niveau équipe
- **Dual-Speed Display** : zones humain (asynchrone, réfléchi) vs zones machine (temps réel, animé)

---

## 13. Responsive & Accessibility

### 13.1 Responsive (Desktop-first)

| Breakpoint | Largeur | Adaptation |
|-----------|---------|-----------|
| sm | 640px | Sidebar hamburger, tables scroll horizontal |
| md | 768px | Sidebar visible, layout simplifié |
| lg | 1024px | Layout complet, ChatPanel à droite |
| xl | 1280px | Dashboard multi-colonnes |
| 2xl | 1536px | Densité maximale, tous les panneaux visibles |

Modales plein écran sur mobile. Cibles tactiles minimum 44px.

### 13.2 Accessibility (WCAG 2.1 AA)

- **Contraste** : 4.5:1 texte normal, 3:1 grands textes et icônes
- **Focus visible** : outline 2px sur tous les éléments interactifs
- **Navigation clavier** : Tab, Shift+Tab, Enter, Escape. Tout est navigable sans souris.
- **ARIA** : landmarks sur chaque zone, labels sur éléments non-textuels, `aria-live` pour les updates async
- **Skip to content** : lien caché visible au focus
- **Screen reader** : annonces pour toasts, notifications, changements de statut workflow
- **Reduced motion** : respect de `prefers-reduced-motion` — animations désactivées
- **Formulaires** : labels associés, messages d'erreur liés (`aria-describedby`)

### 13.3 Tests Accessibilité

- axe-core automatisé dans le CI
- Lighthouse Accessibility score ≥ 90
- Test NVDA/VoiceOver sur les 7 smoke tests

---

## 14. Design Tokens

### 14.1 Tokens CSS (extrait)

```css
:root {
  /* Surface */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --muted: oklch(0.965 0 0);
  --muted-foreground: oklch(0.556 0 0);

  /* Primary */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);

  /* Semantic */
  --success: oklch(0.55 0.15 145);
  --warning: oklch(0.65 0.15 75);
  --error: oklch(0.55 0.2 25);
  --info: oklch(0.55 0.15 255);
  --agent: oklch(0.55 0.15 290);

  /* Rôles RBAC */
  --role-admin: oklch(0.55 0.2 25);
  --role-manager: oklch(0.55 0.15 255);
  --role-contributor: oklch(0.55 0.15 145);
  --role-viewer: oklch(0.55 0 0);

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 200ms ease-in-out;
  --transition-slow: 300ms ease-in-out;

  /* Z-index */
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-modal: 200;
  --z-toast: 300;
  --z-tooltip: 400;
}
```

### 14.2 Naming Conventions

| Type | Convention | Exemple |
|------|-----------|---------|
| Composants | PascalCase | `WorkflowPipeline`, `DriftAlert` |
| Fichiers | kebab-case | `workflow-pipeline.tsx`, `drift-alert.tsx` |
| Variables | camelCase | `isLoading`, `hasPermission`, `driftSeverity` |
| Types | PascalCase + suffixe | `WorkflowPipelineProps`, `DriftAlertState` |
| CSS | Tailwind utility-first | Pas de classes custom sauf tokens |

---

## 15. Priorisation UX & Roadmap

### 15.1 Matrice Impact × Effort

| Quadrant | Expériences |
|----------|-----------|
| **Quick Wins** (High Impact, Low Effort) | Page Membres, Invitation, Badges rôles, Sign-out, Navigation adaptée |
| **Strategic** (High Impact, High Effort) | WorkflowPipeline, DriftAlert, ChatPanel, WorkflowEditor, AutomationCursor |
| **Nice-to-have** (Low Impact, Low Effort) | Command Palette, Profil utilisateur |
| **Defer** (Low Impact, High Effort) | OnboardingChat oral, Import Jira UI |

### 15.2 Roadmap UX par Phase

| Phase | Écrans/Composants | Effort UX |
|-------|------------------|-----------|
| **Sprint 0** | Design System (tokens, composants de base, storybook) | 2-3j |
| **Phase 1** | InviteModal, MembersTable, CompanySelector, ProfilePage, SignOut | 5j |
| **Phase 2** | RoleSelector, PermissionMatrix, RoleBadge, NavigationGuard, BadgeCouleur | 8j |
| **Phase 3** | ProjectAccess, SidebarFiltre, ScopeSelector | 6j |
| **Phase 4** | SSOConfig, AuditViewer, DashboardCEO, DashboardCTO | 10j |
| **Transverse** | WorkflowPipeline, StageCard, DriftAlert, ChatPanel, AutomationCursor | 11j |

**Total** : ~42 jours de design UX, 41 composants, 13 pages.

### 15.3 Dépendances Critiques

1. **Design System avant Phase 1** — Sprint 0 obligatoire pour les tokens et composants de base
2. **WorkflowPipeline avant DriftAlert** — le pipeline est le conteneur visuel du drift
3. **NavigationGuard avant tout écran Phase 2+** — le masquage par permissions doit être en place
4. **ChatPanel prototype dès Phase 2** — c'est le composant le plus ambitieux (WebSocket bidirectionnel)

---

## Annexes


---

*UX Design B2B MnM v1.0 — ~6500 mots — 7 contributeurs — Spec UX complète de la transformation B2B enterprise.*
*Prochaine étape : Architecture B2B (Étape 4 du plan d'orchestration)*


---

# UX Design B2B — Design Philosophy, Core Experience & Design System

> **Par Sally la Designer** | Date : 2026-03-14 | Version : 1.0
> Sources : PRD B2B v1.0, Product Brief B2B v2.0, User Journeys & UX Requirements v1.0
> Contexte : MnM Tour de Controle IA Enterprise — Transformation B2B

---

## Table des matieres

1. [Design Philosophy](#1-design-philosophy)
2. [Core Experience](#2-core-experience)
3. [Design System](#3-design-system)

---

## 1. Design Philosophy

### 1.1 Principe fondateur : Un cockpit unifie, neuf realites

MnM n'est pas un outil. C'est un **cockpit de supervision** qui s'adapte a celui qui le pilote.

La philosophie UX repose sur une conviction profonde : dans une entreprise, 9 personas differents (CEO, CTO, DPO, PM, PO, Designer, Dev, QA, Lead Tech) ont besoin d'acceder a la **meme realite partagee** — les projets, les agents, les workflows, l'avancement — mais a travers des **lentilles radicalement differentes**. Le CEO ne voit jamais une ligne de code. Le developpeur ne voit jamais un PowerPoint. Pourtant, ils travaillent sur le meme produit.

Cette conviction se traduit par un principe architectural UX : **une seule application, cinq modes coexistants, adaptation contextuelle au role**.

| Mode | Persona primaire | Experience | Principe directeur |
|------|-----------------|------------|-------------------|
| **ORAL** | CEO, DSI, DPO | Conversation naturelle avec un agent d'interface. Dicte sa strategie, pose des questions, recoit des syntheses structurees. | "Je parle, MnM structure" |
| **VISUEL** | CTO, Lead Tech, DSI | Dashboards temps reel, graphes de dependances, monitoring de drift, metriques d'avancement. | "Je vois tout d'un coup d'oeil" |
| **CODE** | Dev, Lead Tech | Integration IDE native, terminal integre, git embarque, agent pilotable en temps reel. | "Mon workflow de dev, augmente" |
| **BOARD** | PM, PO, DPO | Kanban, roadmap, priorisation drag-and-drop, epics, stories, suivi sprint. | "Mon backlog, orchestre" |
| **TEST** | QA, Lead Tech | Suites de tests, couverture, rapports de regression, historique de bugs. | "Mes tests, capitalises" |

Ces modes ne sont pas des pages separees. Ils coexistent dans le meme cockpit. Un Lead Tech active les modes CODE + BOARD + VISUEL simultanement. Le mode est un **filtre sur la meme realite partagee**, pas un silo.

### 1.2 Le curseur d'automatisation — Concept UX central

Le curseur d'automatisation est l'innovation UX qui distingue MnM de tout ce qui existe sur le marche. Il materialise la Verite #30 du brainstorming cofondateurs : *"L'adoption de l'automatisation est un curseur individuel, pas un switch global."*

```
[MANUEL] ============== [ASSISTE] ============== [AUTOMATIQUE]
    |                       |                          |
    L'humain fait           L'agent propose            L'agent execute
    L'agent observe         L'humain valide            L'humain supervise
    Suggestions discretes   Validation en 1 clic       Intervention sur anomalie
```

**MANUEL** : L'utilisateur execute, l'agent observe et propose des suggestions non-intrusives. Position ideale pour la decouverte et les taches creatives ou strategiques.

**ASSISTE** : L'agent propose des actions, l'utilisateur valide en 1 clic. L'humain reste le "gate" de qualite. C'est le mode par defaut pour la plupart des utilisateurs apres la phase de decouverte.

**AUTOMATIQUE** : L'agent execute, l'humain supervise les exceptions. Intervention uniquement sur anomalies detectees par le systeme de drift.

#### Application multi-dimensionnelle

Le curseur n'est pas un reglage global. Il s'applique a quatre niveaux simultanement :

| Niveau | Exemple | Qui le regle |
|--------|---------|-------------|
| **Par action** | "Generation de tests = auto, code review = assiste" | L'utilisateur |
| **Par agent** | "Agent reporting = auto, agent brainstorm = manuel" | L'utilisateur |
| **Par projet** | "Projet legacy = assiste, nouveau projet = auto" | Le manager/CTO |
| **Par entreprise** | "Plafond global : aucun merge sans validation humaine" | Le CEO/CTO |

**La hierarchie l'emporte** : le CEO peut imposer un plafond que les niveaux inferieurs ne peuvent pas depasser. Ce mecanisme garantit la gouvernance tout en respectant l'autonomie individuelle.

#### L'evolution naturelle de l'adoption

```
Semaine 1-2          Mois 1              Mois 3+
+-----------+     +-----------+       +-----------+
|  MANUEL   |     |  ASSISTE  |       |   AUTO    |  <-- taches maitrises
|  Tout est | --> |  Taches   | -->   |           |
|  nouveau  |     |  repetitiv|       +-----------+
+-----------+     +-----------+       |  ASSISTE  |  <-- taches courantes
                                      +-----------+
                                      |  MANUEL   |  <-- taches creatives
                                      +-----------+
                                           (par choix)
```

C'est le mecanisme de transformation ethique des roles : on ne supprime pas le role, on l'eleve progressivement. Le PO ne redige plus de stories — il evalue si celles generees sont bonnes. Le QA ne teste plus manuellement — il architecure la qualite. **Savoir faire devient savoir juger** (Verite #20 : elevation, pas remplacement).

### 1.3 Confiance et controle : l'utilisateur garde toujours le pouvoir

La confiance est le prerequis absolu de l'adoption. Sans confiance, aucun curseur ne sera deplace vers la droite. MnM construit cette confiance sur trois piliers :

#### Pilier 1 — Transparence radicale : voir tout, comprendre tout, tracer tout

Chaque action d'un agent est visible, tracable, et comprehensible. Pas des logs bruts illisibles, mais des resumes LLM en langage naturel : "L'agent a 5 fichiers en contexte", "Il est a l'etape 3 du workflow", "Il a devie du workflow defini — voici le diff."

```
+--- Panneau Transparence Agent ---+
|                                  |
|  Agent : Alice-dev               |
|  Story : US-142                  |
|  Workflow : Dev Story            |
|  Etape : 2/5 — Code             |
|  Fichiers en contexte : 5       |
|  Derniere action : Modification  |
|    de src/services/search.ts     |
|  Sante : NORMAL                  |
|  Temps dans l'etape : 12:34     |
|                                  |
|  [Voir logs bruts] [Historique]  |
+----------------------------------+
```

#### Pilier 2 — Controle immediat : le bouton "Stop" est toujours visible

L'utilisateur peut a tout moment :
- **Arreter** un agent instantanement
- **Rollback** les derniers changements
- **Ajuster** le curseur d'automatisation en cours d'execution
- **Rediriger** l'agent avec une instruction dans le chat

Ce n'est pas un "frein d'urgence" cache. C'est un element central de l'interface, toujours visible, toujours accessible.

#### Pilier 3 — Metriques agreges, jamais individuelles

Principe issu directement de la Verite #20 : les managers voient des metriques d'equipe, des tendances par projet, des indicateurs de sante. Jamais "Alice a pris 3h sur cette story" vs "Bob a pris 45 min." L'objectif est l'elevation collective, pas le flicage individuel.

**Pour les operationnels :** Transparence totale sur ses propres agents, controle personnel du curseur.
**Pour le management :** Audit centralise, drift detection, plafond d'automatisation.
**Pour l'entreprise :** Tracabilite compliance, import progressif, chaque equipe avance a son rythme.

### 1.4 Orchestration deterministe, pas suggestion probabiliste

La philosophie UX de MnM reflecte une decision architecturale fondamentale : les workflows ne sont pas des "suggestions" que l'agent interprete. Ce sont des **contrats algorithmiques** que la plateforme impose etape par etape.

Pour l'utilisateur, cela se traduit par une UX de **certitude** : quand je definis un workflow "Brief > Code > Review > Test > Merge", l'agent **ne peut pas** sauter l'etape Review. Quand je definis des fichiers obligatoires pour l'etape Brief, l'agent **ne peut pas** commencer sans eux.

Cette certitude se manifeste visuellement :
- Pipeline horizontal avec statuts clairs (gris=a venir, bleu=en cours, vert=termine, rouge=erreur, orange=drift)
- Conditions de passage visibles et verifiables
- Alertes de drift quand un agent devie du chemin defini
- Diff visuel entre "attendu" et "observe"

### 1.5 Elevation, pas remplacement

La Verite #20 est le fil rouge de toute la philosophie UX : MnM n'est pas un outil qui remplace les gens. C'est un outil qui **eleve** chaque role vers sa version la plus strategique.

| Role | Avant MnM | Avec MnM |
|------|-----------|----------|
| CEO | Reunions de reporting sans fin | "Ou en est le projet Alpha ?" — reponse instantanee |
| CTO | Debug les agents des autres | Definit les workflows et monitore la conformite |
| PO | 80% ecriture de stories | 80% reflexion sur le besoin metier |
| Dev | Copier-coller de contexte | Agent avec contexte complet, pilorable en temps reel |
| QA | Tests manuels repetitifs | Architecte de qualite, savoir tacite capitalise |
| Lead Tech | 60% code reviews et scrum | Focus sur l'architecture et la dette technique |

L'interface incarne cette philosophie : chaque ecran met en avant les actions de **supervision, validation et decision** — pas les actions de production mecanique.

---

## 2. Core Experience

### 2.1 Structure de navigation

L'interface MnM est structuree en trois zones permanentes :

```
+============================================================================+
|  HEADER : Logo + Company Selector + Recherche + Notifications + Avatar     |
+============+===============================================================+
|            |                                                               |
|  SIDEBAR   |                    ZONE DE CONTENU                            |
|            |                                                               |
|  Navigation|  Adapte au mode actif et au role de l'utilisateur             |
|  principale|                                                               |
|  par role  |  Peut contenir : dashboard, board, editeur, chat, etc.       |
|            |                                                               |
|  Projets   |  Split views possibles (code + chat, board + chat)            |
|            |                                                               |
|  Raccourcis|                                                               |
|            |                                                               |
+============+===============================================================+
|  BARRE DE STATUT : Workflow actif + Etape courante + Sante agent           |
+============================================================================+
```

#### Header (fixe, toujours visible)

- **Logo MnM** — retour a l'accueil
- **Company Selector** — dropdown pour changer de company (pour les utilisateurs multi-company). Position immediatement apres le logo. Raccourci : Ctrl+K puis "company:"
- **Barre de recherche** — recherche globale (projets, stories, membres, agents, workflows). Raccourci : Ctrl+K
- **Notifications** — badge avec compteur. Centre de notifications en panneau lateral
- **Avatar** — menu utilisateur (profil, preferences, curseur personnel, deconnexion)

#### Sidebar (collapsible, adaptee au role)

La sidebar est le mecanisme principal d'adaptation contextuelle. **Les items non-autorises sont masques, pas grises.** Un Viewer ne voit pas l'item "Workflows" — il ne sait pas qu'il existe. Pas de frustration, pas de confusion.

```
+------ Sidebar Admin -------+    +------ Sidebar Dev ---------+
|                            |    |                            |
|  Dashboard                 |    |  Mon Board                 |
|  Projets                   |    |  Projets                   |
|    > Projet Alpha          |    |    > Projet Alpha          |
|    > Projet Beta           |    |  Mes Agents                |
|  Workflows                 |    |  Chat                      |
|  Agents                    |    |                            |
|  Membres                   |    |  ---                       |
|  Audit                     |    |  Preferences               |
|  Parametres                |    |                            |
|                            |    |                            |
|  ---                       |    |                            |
|  Aide                      |    |                            |
|  Preferences               |    |                            |
+----------------------------+    +----------------------------+
```

#### Zone de contenu (dynamique)

La zone principale s'adapte au contexte :
- **Dashboard** : cartes de KPIs, graphiques, alertes
- **Board** : colonnes Kanban drag-and-drop
- **Editeur** : split view code + chat
- **Workflow** : pipeline visuel horizontal
- **Chat** : conversation pleine page ou panneau lateral

Les split views sont possibles et encouragees : code a gauche + chat a droite, board en haut + detail de story en bas.

#### Barre de statut (fixe, bas de page)

Visible quand un agent est actif. Affiche :
- Workflow actif et etape courante
- Progress bar de l'etape
- Timer de l'etape
- Indicateur de sante de l'agent (vert/orange/rouge)
- Boutons d'action rapide : Pause, Stop, Rollback

### 2.2 Flux principaux par persona

#### CEO : Dashboard > Chat

Le CEO ouvre MnM et voit immediatement son dashboard executif. C'est sa vue par defaut. Il n'a jamais besoin de naviguer ailleurs sauf pour poser une question dans le chat integre.

```
CEO ouvre MnM
    |
    v
+-- Dashboard Executif --+
|  KPIs par BU           |
|  Alertes drift         |
|  Avancement global     |
+------------------------+
    |
    | "Ou en est le projet Alpha ?"
    v
+-- Chat Executif -------+
|  Synthese contextuelle |
|  Liens vers details    |
+------------------------+
```

Le flux est intentionnellement **minimaliste** : deux ecrans, zero configuration, zero navigation complexe. Le CEO ne doit jamais se sentir perdu.

#### CTO : Workflows > Monitoring > Intervention

Le CTO a un flux plus technique, centre sur la configuration et la surveillance.

```
CTO ouvre MnM
    |
    v
+-- Dashboard Technique -----+
|  Drift detection temps reel |
|  Agents actifs / sante      |
|  Reviews en attente          |
|  Metriques couverture        |
+-----------------------------+
    |                    |
    v                    v
+-- Editeur Workflow --+ +-- Monitoring Drift --+
|  Pipeline visuel     | |  Alerte : Agent X    |
|  Drag-and-drop etapes| |  devie etape 3       |
|  Edition prompts     | |  Diff : attendu vs   |
|  Fichiers requis     | |  observe              |
+----------------------+ |  Actions : recharger, |
                         |  kill, ignorer         |
                         +------------------------+
```

#### Dev : Board > Code > Chat

Le developpeur a le flux le plus riche, alternant entre la vue board (quoi faire) et la vue code (comment le faire).

```
Dev ouvre MnM
    |
    v
+-- Board Personnel ------+
|  Stories assignees       |
|  Reviews en attente      |
|  Bugs urgents            |
+--------------------------+
    |
    | Selectionne US-142
    v
+-- Detail Story ----------+     +-- Chat Agent -------+
|  Contexte complet        | <-> |  Plan propose        |
|  Maquettes liees         |     |  Pilotage temps reel |
|  Specs techniques        |     |  "Utilise pattern X" |
+--------------------------+     +----------------------+
    |
    | "Lancer l'agent"
    v
+-- Vue Code Split ---------+---+-- Chat Agent ----------+
|  Editeur avec diff live    |   |  Progression etapes    |
|  Fichiers modifies         |   |  Instructions live     |
|  Terminal integre          |   |  [Stop] [Rollback]     |
+----------------------------+---+------------------------+
```

#### PO : Board > Chat > Validation

Le PO travaille principalement sur le board, avec le chat comme outil de decomposition.

```
PO ouvre MnM
    |
    v
+-- Board Sprint ----------+
|  Stories par colonne      |
|  DoR indicators           |
|  Burndown agent-augmente  |
+--------------------------+
    |
    | "Decompose cette epic"
    v
+-- Chat PO ----------------+
|  Agent propose 5 stories   |
|  [Accepter] [Modifier]     |
+--------------------------+
    |
    v
+-- Validation DoR ---------+
|  Checklist automatique     |
|  Criteres vert/rouge       |
|  [Forcer avec justif.]     |
+----------------------------+
```

#### PM : Brainstorm > Epic > Roadmap

Le PM entre par le brainstorm, transforme le resultat en epics, et planifie sur la roadmap.

```
PM ouvre MnM
    |
    v
+-- Chat Brainstorm -------+
|  Agent sparring partner   |
|  Challenge les hypotheses |
+--------------------------+
    |
    | "Transforme en epic"
    v
+-- Epic structuree --------+
|  Problem statement         |
|  Personas impactes         |
|  Stories candidates        |
|  KPIs proposes             |
+----------------------------+
    |
    v
+-- Roadmap Timeline ------+
|  Gantt-like               |
|  Dependances auto         |
|  Conflits signales        |
+---------------------------+
```

### 2.3 Le cockpit unifie : adaptation contextuelle

Le cockpit MnM est une **seule application** qui se reconfigure selon trois axes :

**Axe 1 — Role** : la sidebar, les items de navigation, et les permissions changent selon le role RBAC. Un Viewer voit moins d'items. Un Admin voit tout.

**Axe 2 — Mode** : les modes (ORAL, VISUEL, CODE, BOARD, TEST) sont des filtres qui reconfigurent la zone de contenu. Plusieurs modes peuvent etre actifs simultanement.

**Axe 3 — Contexte** : le contenu s'adapte au projet selectionne, a la story en cours, a l'agent actif. Le contexte se propage : selectionner une story dans le board ajuste le chat, l'editeur, et la barre de workflow.

```
+-- Axes d'adaptation du cockpit --+
|                                  |
|  ROLE x MODE x CONTEXTE         |
|    |       |        |           |
|    |       |        +-> Projet, story, agent actif
|    |       +----------> ORAL, VISUEL, CODE, BOARD, TEST
|    +-----------------> Admin, Manager, Contributor, Viewer
|                                  |
|  = Interface unique et coherente |
+----------------------------------+
```

### 2.4 Navigation adaptee aux permissions

Principe cle : **les items non-autorises sont masques, pas grises**. Ce choix est delibere :

- **Masquer** : l'utilisateur ne voit que ce qui lui est accessible. Zero frustration, zero confusion. L'interface est propre et focalisee.
- **Griser** (rejete) : cree de la frustration ("je vois mais je ne peux pas"), de la confusion ("pourquoi c'est grise ?"), et du bruit visuel.

Si un lien partage mene a une page non-autorisee, un message clair s'affiche : *"Vous n'avez pas acces a cette page. Contactez votre administrateur."* Pas d'erreur technique, pas de page 404.

### 2.5 La Command Palette — Navigation universelle

Accessible partout via **Ctrl+K** (ou Cmd+K sur Mac), la Command Palette est le hub de navigation rapide :

```
+----------------------------------------------+
|  > recherche...                              |
|----------------------------------------------|
|  Projets                                     |
|    Projet Alpha                              |
|    Projet Beta                               |
|  Stories                                     |
|    US-142 : Filtre recherche                 |
|    US-145 : Filtre date                      |
|  Actions                                     |
|    Lancer un agent                           |
|    Creer une story                           |
|    Changer de company                        |
|  Membres                                     |
|    Alice Torres                              |
+----------------------------------------------+
```

La Command Palette est filtree par les permissions : un Viewer ne voit pas "Lancer un agent" dans les actions. Elle supporte des prefixes pour affiner : `company:`, `project:`, `member:`, `workflow:`.

---

## 3. Design System

### 3.1 Fondation technique

Le design system MnM est construit sur **shadcn/ui + Tailwind CSS**, coherent avec le stack technique existant (React 18 + Vite). Ce choix offre :

- **Composants accessibles** : shadcn/ui est base sur Radix UI, qui garantit l'accessibilite WCAG 2.1 AA par defaut
- **Personnalisation totale** : les composants sont copies dans le projet, pas importes — modification libre sans dette technique
- **Coherence avec Tailwind** : classes utilitaires, pas de CSS custom a maintenir
- **Themes natifs** : support du mode sombre integre via CSS variables

### 3.2 Palette de couleurs

#### Couleurs primaires

| Token | Valeur | Usage |
|-------|--------|-------|
| `--primary` | `hsl(222, 47%, 31%)` — Bleu marine profond | Boutons principaux, liens, accents |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | Texte sur fond primaire |
| `--secondary` | `hsl(215, 20%, 65%)` — Bleu gris | Elements secondaires, bordures actives |
| `--secondary-foreground` | `hsl(222, 47%, 11%)` | Texte sur fond secondaire |

#### Couleurs semantiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `--destructive` | `hsl(0, 84%, 60%)` — Rouge | Erreurs, suppressions, drift critique |
| `--warning` | `hsl(38, 92%, 50%)` — Orange | Alertes, drift warning, compaction |
| `--success` | `hsl(142, 71%, 45%)` — Vert | Succes, etape terminee, sante OK |
| `--info` | `hsl(217, 91%, 60%)` — Bleu | Information, drift info, notifications |

#### Couleurs de role RBAC

Chaque role possede une couleur d'accent identifiable instantanement dans toute l'interface — badges, avatars, indicateurs.

| Role | Couleur | Token | Usage |
|------|---------|-------|-------|
| **Admin** | Rouge `hsl(0, 72%, 51%)` | `--role-admin` | Badge Admin, bordures admin |
| **Manager** | Bleu `hsl(217, 91%, 60%)` | `--role-manager` | Badge Manager |
| **Contributor** | Vert `hsl(142, 71%, 45%)` | `--role-contributor` | Badge Contributor |
| **Viewer** | Gris `hsl(220, 9%, 46%)` | `--role-viewer` | Badge Viewer |

#### Couleurs de statut workflow

| Statut | Couleur | Usage |
|--------|---------|-------|
| A venir | `--muted` — Gris clair | Etape non-commencee |
| En cours | `--info` — Bleu | Etape active, animation pulsation |
| Termine | `--success` — Vert | Etape completee |
| Erreur | `--destructive` — Rouge | Etape en erreur |
| Drift | `--warning` — Orange | Deviation detectee |

#### Couleurs de curseur d'automatisation

| Position | Couleur | Semantique |
|----------|---------|------------|
| Manuel | `hsl(220, 9%, 46%)` — Gris | Neutre, controle total humain |
| Assiste | `hsl(217, 91%, 60%)` — Bleu | Collaboration active |
| Automatique | `hsl(142, 71%, 45%)` — Vert | Execution autonome, confiance |

#### Mode sombre

Toutes les couleurs sont definies en CSS variables avec deux sets : `light` et `dark`. Le mode sombre utilise des luminosites inversees tout en conservant les teintes.

```css
:root {
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(222, 47%, 11%);
  --card: hsl(0, 0%, 100%);
  --muted: hsl(210, 40%, 96%);
  --border: hsl(214, 32%, 91%);
}

.dark {
  --background: hsl(222, 47%, 11%);
  --foreground: hsl(210, 40%, 98%);
  --card: hsl(222, 47%, 15%);
  --muted: hsl(217, 33%, 17%);
  --border: hsl(217, 33%, 25%);
}
```

### 3.3 Typographie

La hierarchie typographique est concue pour la lisibilite et la densite d'information — un cockpit de supervision necessite des niveaux clairs pour scanner rapidement.

| Niveau | Taille | Poids | Line-height | Usage |
|--------|--------|-------|-------------|-------|
| **h1** | 2rem (32px) | 700 (Bold) | 1.2 | Titres de pages (Dashboard, Projets) |
| **h2** | 1.5rem (24px) | 600 (Semi-bold) | 1.3 | Titres de sections (KPIs, Board) |
| **h3** | 1.25rem (20px) | 600 (Semi-bold) | 1.4 | Sous-sections, noms de cartes |
| **h4** | 1.125rem (18px) | 500 (Medium) | 1.4 | Labels de groupes |
| **body** | 0.875rem (14px) | 400 (Regular) | 1.5 | Texte courant, descriptions |
| **body-sm** | 0.8125rem (13px) | 400 (Regular) | 1.5 | Texte secondaire, metadata |
| **caption** | 0.75rem (12px) | 400 (Regular) | 1.4 | Labels, timestamps, badges |
| **code** | 0.875rem (14px) | 400 (Regular) | 1.6 | Code inline, noms de fichiers |

**Police principale :** `Inter` — lisibilite optimale sur ecran, support complet des caracteres francais.
**Police code :** `JetBrains Mono` — ligatures, distinction claire des caracteres similaires (0/O, l/1/I).

### 3.4 Spacing et grille

#### Grille de base : 4px

Tout le spacing est base sur des multiples de 4px. Les valeurs standard :

| Token | Valeur | Usage |
|-------|--------|-------|
| `space-1` | 4px | Espacement minimal (entre icone et texte) |
| `space-2` | 8px | Padding interne elements compacts |
| `space-3` | 12px | Gap entre elements de liste |
| `space-4` | 16px | Padding standard des cartes |
| `space-5` | 20px | Gap entre sections |
| `space-6` | 24px | Padding de sections |
| `space-8` | 32px | Separation de blocs majeurs |
| `space-10` | 40px | Marges de page |
| `space-12` | 48px | Separation de sections de page |

#### Layout grid

```
+-- Page Layout ----------------------------------+
|  Sidebar: 240px (collapsible a 48px, icones)    |
|  Content: fluid, min 768px                      |
|  Max-width contenu: 1280px (centre)             |
|  Gutters: 24px                                  |
+-------------------------------------------------+
```

Le contenu utilise une grille CSS de 12 colonnes pour les layouts complexes (dashboards) et un layout flex pour les layouts simples (listes, formulaires).

#### Breakpoints

| Breakpoint | Largeur | Comportement |
|------------|---------|-------------|
| `sm` | 640px | Mobile — sidebar masquee, navigation hamburger |
| `md` | 768px | Tablette — sidebar collapsible, layout simplifie |
| `lg` | 1024px | Desktop — layout complet, split views disponibles |
| `xl` | 1280px | Grand ecran — max-width applique, contenu centre |
| `2xl` | 1536px | Ultra-large — dashboards multi-colonnes |

### 3.5 Composants cles

#### Button

Quatre variantes principales :

```
+-- Variantes Button ---------+

  [  Action principale  ]      <- primary: fond --primary, texte blanc
  [  Action secondaire  ]      <- secondary: fond --secondary, bordure
  [  Supprimer          ]      <- destructive: fond --destructive, texte blanc
  [  Annuler            ]      <- ghost: transparent, texte --foreground

+-- Tailles ------------------+

  [sm]  H: 32px, text: 13px, px: 12px
  [default]  H: 36px, text: 14px, px: 16px
  [lg]  H: 40px, text: 14px, px: 24px

+-- Etats --------------------+

  [Default]  ->  [Hover: opacity 90%]  ->  [Active: scale 0.98]
  [Disabled: opacity 50%, cursor not-allowed]
  [Loading: spinner inline + texte "Chargement..."]
```

#### Card

Conteneur principal pour les informations. Utilise partout : KPIs, stories, agents, workflows.

```
+----------------------------------+
|  [Header]                  [...] |  <- header optionnel, actions menu
|  --------------------------------|
|                                  |
|  [Contenu]                       |  <- padding: space-4 (16px)
|                                  |
|  --------------------------------|
|  [Footer]                        |  <- footer optionnel (actions, metadata)
+----------------------------------+

Ombre: shadow-sm (defaut), shadow-md (hover/active)
Bordure: 1px --border
Border-radius: 8px (rounded-lg)
```

#### Dialog (Modale)

Pour les actions critiques (invitation, suppression, configuration).

```
+-- Overlay sombre (50% opacity) --------+
|                                        |
|   +-- Dialog ----------------------+   |
|   |  Titre                    [X]  |   |
|   |  --------------------------    |   |
|   |                                |   |
|   |  Contenu du dialogue           |   |
|   |                                |   |
|   |  --------------------------    |   |
|   |       [Annuler]  [Confirmer]   |   |
|   +--------------------------------+   |
|                                        |
+----------------------------------------+

Largeur: sm=400px, default=500px, lg=640px, xl=800px
Animation: fade-in + scale de 95% a 100% (150ms)
Fermeture: clic overlay, touche Escape, bouton X
Focus trap: le focus reste dans la modale
```

#### Table

Pour les donnees tabulaires (membres, audit, permissions).

```
+============================================================+
|  [ ] | Nom           | Role         | Statut | Actions     |
|------|---------------|--------------|--------|-------------|
|  [ ] | Marc Dupont   | [Admin]      | Actif  | [...] |
|  [ ] | Sophie Lemaire| [Manager]    | Actif  | [...] |
|  [ ] | Alice Torres  | [Contributor]| Actif  | [...] |
+============================================================+
|  3 resultats                          [< 1 / 1 >]         |
+============================================================+

Header: fond --muted, texte --muted-foreground, sticky
Lignes: alternance subtile de fond (zebra striping optionnel)
Hover: fond legerement plus fonce
Selection: checkbox + fond --accent
Tri: clic sur header, indicateur fleche
```

#### Badge

Indicateur compact pour les statuts, roles, tags.

```
Types :
  [Admin]       <- fond role-admin/10%, texte role-admin, border role-admin/20%
  [Manager]     <- fond role-manager/10%, texte role-manager
  [Contributor] <- fond role-contributor/10%, texte role-contributor
  [Viewer]      <- fond role-viewer/10%, texte role-viewer

  [En cours]    <- fond info/10%, texte info
  [Termine]     <- fond success/10%, texte success
  [Erreur]      <- fond destructive/10%, texte destructive
  [Drift]       <- fond warning/10%, texte warning

Tailles :
  sm: H 20px, text 11px, px 6px
  default: H 24px, text 12px, px 8px
```

#### Toast (Notifications)

Notifications temporaires en haut a droite de l'ecran.

```
+-- Toast ---------------------------+
|  [icone] Titre du toast      [X]  |
|  Description optionnelle           |
|  [Action optionnelle]              |
+------------------------------------+

Types :
  info: bordure gauche bleue, icone info
  success: bordure gauche verte, icone check
  warning: bordure gauche orange, icone alerte
  error: bordure gauche rouge, icone erreur

Duree: 5s par defaut, persistant pour les erreurs
Position: top-right, stack vertical (max 3 visibles)
Animation: slide-in depuis la droite (200ms)
```

#### Dropdown Menu

Pour les menus contextuels et les selecteurs.

```
+-- Trigger: bouton ou icone --+
|  v                           |
+------------------------------+
   |
   +------------------------------+
   |  Item 1              Ctrl+A  |
   |  Item 2              Ctrl+B  |
   |  ---                         |
   |  Item dangereux (rouge)      |
   +------------------------------+

Animation: fade-in + slide-down (100ms)
Max-height: 300px avec scroll
Raccourcis clavier affiches a droite
Separateurs pour grouper les actions
Items destructifs en rouge, toujours en dernier
```

#### Form

Formulaires structures avec validation.

```
+-- Champ de formulaire --------------+
|  Label *                            |
|  +-------------------------------+  |
|  | Placeholder...                |  |
|  +-------------------------------+  |
|  Description ou aide contextuelle   |
+-------------------------------------+

Etats :
  Default: bordure --border
  Focus: bordure --ring (bleu), shadow focus
  Error: bordure --destructive, message rouge en dessous
  Disabled: fond --muted, opacity 70%
  Success: bordure --success (validation inline)

Types de champs :
  Input (text, email, password, number)
  Textarea (auto-resize)
  Select (dropdown natif shadcn)
  Checkbox / Switch
  Radio group
  Date picker
  File upload (drag-and-drop)
```

#### Sidebar

Navigation principale collapsible.

```
+-- Sidebar Ouverte (240px) --+    +-- Sidebar Fermee (48px) --+
|                             |    |                           |
|  [Logo] MnM                |    |  [M]                      |
|  [Alpha Corp  v]           |    |  [v]                      |
|                             |    |                           |
|  [ico] Dashboard            |    |  [ico]                    |
|  [ico] Projets          >  |    |  [ico]                    |
|  [ico] Workflows            |    |  [ico]                    |
|  [ico] Agents               |    |  [ico]                    |
|  [ico] Membres              |    |  [ico]                    |
|                             |    |                           |
|  ---                        |    |  ---                      |
|  [ico] Preferences          |    |  [ico]                    |
|  [ico] Aide                 |    |  [ico]                    |
+-----------------------------+    +---------------------------+

Toggle: bouton fleche en bas de la sidebar, ou raccourci Ctrl+B
Hover en mode ferme: tooltip avec le nom de l'item
Sous-menus: expandable dans la sidebar ouverte, popover en mode ferme
Item actif: fond --accent, bordure gauche --primary
```

#### CommandPalette

Hub de navigation rapide (Ctrl+K).

```
+----------------------------------------------+
|  > _                                         |
|----------------------------------------------|
|  Recents                                     |
|    [ico] Dashboard                           |
|    [ico] US-142 : Filtre recherche           |
|  Actions                                     |
|    [ico] Creer une story           Ctrl+N    |
|    [ico] Lancer un agent           Ctrl+L    |
|  Navigation                                  |
|    [ico] Projet Alpha                        |
|    [ico] Membres                             |
+----------------------------------------------+

Ouverture: Ctrl+K, animation fade-in (100ms)
Recherche fuzzy en temps reel
Sections dynamiques filtrees par role
Resultats groupes par type
Raccourcis clavier affiches
Navigation clavier : fleches haut/bas + Enter
Max 10 resultats affiches, scroll pour plus
```

### 3.6 Etats des composants

Chaque composant interactif supporte 7 etats standards :

| Etat | Apparence | Transition |
|------|-----------|-----------|
| **Default** | Style de base | — |
| **Hover** | Fond legerement assombri, ombre accrue | 150ms ease |
| **Active / Pressed** | Scale 0.98, ombre reduite | 50ms ease |
| **Disabled** | Opacity 50%, cursor not-allowed | — |
| **Loading** | Spinner inline, texte "Chargement...", pointer-events none | 200ms ease |
| **Error** | Bordure rouge, icone erreur, message d'aide | 200ms ease |
| **Success** | Bordure verte, icone check (disparait apres 2s) | 200ms ease |

### 3.7 Animations et transitions

Les animations MnM sont **subtiles et fonctionnelles** — jamais decoratives. Elles servent trois objectifs :

1. **Feedback** : confirmer qu'une action a ete prise (bouton press, toast appear)
2. **Orientation** : indiquer d'ou vient un element et ou il va (sidebar collapse, modal open)
3. **Continuite** : maintenir le contexte spatial lors des transitions (page change, panel resize)

| Animation | Duree | Easing | Usage |
|-----------|-------|--------|-------|
| Fade-in/out | 150ms | ease-out | Modales, toasts, tooltips |
| Slide-in | 200ms | ease-out | Sidebar, panneaux lateraux |
| Scale | 100ms | ease-in-out | Boutons (press), modales (open) |
| Pulsation | 2000ms | ease-in-out (loop) | Etape workflow en cours |
| Progress | linear | linear | Barres de progression |
| Collapse | 200ms | ease-out | Accordeons, sous-menus |

**Regles strictes :**
- Aucune animation de plus de 300ms (sauf pulsation)
- `prefers-reduced-motion: reduce` : toutes les animations sont desactivees
- Pas de bounce, pas de spring, pas d'effets decoratifs
- Les animations ne bloquent jamais l'interaction

### 3.8 Iconographie

**Librairie :** Lucide Icons (integre avec shadcn/ui).

| Categorie | Exemples d'icones | Usage |
|-----------|------------------|-------|
| Navigation | Home, Settings, Users, FolderOpen | Sidebar, breadcrumbs |
| Actions | Plus, Trash, Edit, Download, Upload | Boutons, menus |
| Statut | CheckCircle, XCircle, AlertTriangle, Info | Badges, toasts |
| Workflow | Play, Pause, Square (stop), RotateCcw (rollback) | Controles agent |
| Roles | Shield (admin), Users (manager), User (contributor), Eye (viewer) | Badges, avatars |

Taille standard : 16px (inline), 20px (boutons), 24px (navigation).
Couleur : herite du texte parent par defaut, couleur semantique pour les statuts.

### 3.9 Responsive et adaptabilite

| Breakpoint | Layout | Sidebar | Navigation |
|------------|--------|---------|-----------|
| Mobile (<640px) | Single column | Masquee, hamburger | Bottom tab bar |
| Tablette (640-1024px) | Fluid | Collapsed (48px) | Sidebar icones |
| Desktop (1024-1280px) | Full layout | Ouverte (240px) | Sidebar complete |
| Grand ecran (>1280px) | Max-width centre | Ouverte (240px) | Sidebar + shortcuts |

Le cockpit est concu **desktop-first** — c'est un outil professionnel de supervision. Le mobile est supporte pour la consultation (dashboards, notifications, chat) mais pas pour l'edition complete (workflows, code).

### 3.10 Accessibilite

Le design system garantit la conformite WCAG 2.1 AA :

- **Contraste** : ratio minimum 4.5:1 pour le texte, 3:1 pour les elements interactifs
- **Focus visible** : outline 2px --ring sur tous les elements focusables
- **Navigation clavier** : tab order logique, raccourcis documentes
- **Screen readers** : aria-labels sur tous les elements interactifs, live regions pour les notifications
- **Reduction de mouvement** : `prefers-reduced-motion` respecte
- **Taille de texte** : base 14px, jamais moins de 12px, supporte le zoom navigateur jusqu'a 200%

---

> **Note** : Ce document couvre les sections 1 (Design Philosophy), 2 (Core Experience) et 3 (Design System) du document UX Design B2B. Les sections suivantes (Emotional Response, Visual Foundation, Priorisation, Component Strategy, Innovation UX, Documentation) seront couvertes par les taches suivantes du pipeline.

---

# Section 2 — Emotional Response Design & Defining Experiences

> **Par Maya la Design Thinker** | Date : 2026-03-14 | Version : 1.0
> Sources : PRD B2B v1.0, Product Brief B2B v2.0, UX Journeys & Requirements v1.0, 57 verites fondamentales

---

## Table des matieres

1. [Emotional Response Design par Persona](#1-emotional-response-design-par-persona)
2. [Defining Experiences — Les 5 Moments Fondateurs](#2-defining-experiences--les-5-moments-fondateurs)
3. [Inspiration & References](#3-inspiration--references)

---

## 1. Emotional Response Design par Persona

### 1.1 CEO — Le Pilote Strategique

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que cet outil va me donner la visibilite que je n'ai jamais eue ? Est-ce que c'est encore un gadget tech de plus ? Je veux une reponse en 10 secondes, pas un tutoriel." |
| **Ressent** | Impatience chronique. Frustration de compiler manuellement des infos de 5 outils. Solitude decisionnelle — il prend des decisions sans donnees unifiees. Envie de reprendre le controle sans micro-manager. |
| **Voit** | Des dashboards Jira qu'il ne comprend pas. Des PowerPoints de reporting hebdomadaire deja obsoletes. Des equipes qui bricolent chacune dans leur coin avec des IA differentes. |
| **Fait** | Demande des syntheses par email. Organise des reunions de reporting chronophages. Change de priorite strategique mais met des semaines a voir l'impact terrain. Pose des questions et attend des jours pour la reponse. |
| **Douleurs** | Information fragmentee et non-unifiee (Verite #15). Aucun moyen de savoir en temps reel ou en est un projet sans intermediaires. Le cout de la coordination synchrone est colossal. Peur d'investir dans un outil que personne n'utilisera. |
| **Gains** | "J'ouvre un dashboard et je pose une question." Propagation structuree des decisions strategiques. Visibilite temps reel sans intermediaires. Deploiement rapide grace a l'onboarding conversationnel. |

#### Arc emotionnel

```
Scepticisme      Curiosite       Surprise       Confiance       Satisfaction
("Encore un      ("C'est         ("Il a         ("Ca se         ("Je vois TOUT
 outil ?")        different")     compris du     deploie         sans rien
                                  premier        vite")          demander")
     |               |            coup")            |               |
     v               v               v              v               v
[Invitation]  [Onboarding     [Structure     [Dashboard     [Usage
              conversationnel]  generee]       J+2]           quotidien]
```

**Semaine 1** : Le scepticisme initial se transforme en curiosite des le premier echange avec l'agent d'onboarding — "C'est different d'un formulaire." La surprise arrive quand l'organigramme est genere a partir d'une simple conversation orale.

**Semaine 2** : La confiance s'installe quand le dashboard executif affiche des donnees reelles apres 48h. Le CEO pose sa premiere question strategique et recoit une synthese contextualisee en moins de 10 secondes.

**Mois 1+** : La satisfaction profonde s'ancre — "Je vois TOUT sans rien demander." Le CEO utilise MnM comme point d'entree unique pour piloter l'organisation. Les reunions de reporting disparaissent progressivement.

#### Emotions cibles

- **Confiance immediate** : l'onboarding conversationnel montre que l'outil comprend sa realite, pas un questionnaire generique
- **Controle sans effort** : le CEO ne touche jamais un prompt, ne configure jamais un agent, ne voit jamais de code
- **Satisfaction strategique** : les decisions se propagent structurellement, pas via des chaines d'emails

#### Anti-patterns emotionnels a eviter

- **Complexite technique visible** : si le CEO voit un prompt, un JSON, ou un terminal, c'est un echec
- **Latence de reponse** : une question posee qui met plus de 15 secondes a produire une synthese tue la confiance
- **Dashboard vide** : un ecran sans donnees les premiers jours provoque le desengagement. Solution : etats "en attente de donnees" avec estimations claires et indicateurs de progression du deploiement

---

### 1.2 CTO / DSI — Le Garant Technique

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que c'est techniquement solide ou c'est du marketing ? Comment je m'assure que les agents ne font pas n'importe quoi ? Est-ce que je peux integrer ca avec notre stack SSO ?" |
| **Ressent** | Mefiance technique initiale. Besoin visceral de controle et de preuve. Frustration du hackathon CBA — "les agents sautaient des etapes, ne chargeaient pas les bons fichiers" (Verite #45). Pression de gouvernance. |
| **Voit** | Des agents IA deployes sans orchestration dans son entreprise. Des logs bruts illisibles. Des developpeurs qui utilisent Cursor/Claude Code individuellement sans coordination. |
| **Fait** | Definit des standards que personne ne respecte automatiquement. Revoit du code manuellement. Fait du firefighting quand un agent devie. Compile des metriques manuellement. |
| **Douleurs** | Aucune tracabilite centralisee (Verite #39). Pas de moyen d'imposer des standards automatiquement. Les contrats inter-roles sont aspirationnels, jamais appliques (Verite #2). Compaction non-geree — l'agent perd son contexte. |
| **Gains** | Workflows deterministes — "je definis le workflow une fois et si l'agent devie, je le sais en 5 minutes." Drift detection avec diff visuel. Audit centralise prouvable. Gestion de compaction au niveau plateforme. |

#### Arc emotionnel

```
Mefiance        Verification     Flow            Maitrise        Serenite
("C'est solide  ("Config SSO     ("L'editeur     ("Je controle   ("Tout est
 sous le        OK, logs         de workflow      la severite     sous controle,
 capot ?")      detailles")      est intuitif")   du drift")     je dors bien")
     |               |               |               |               |
     v               v               v               v               v
[Invite CEO]  [Config SSO +     [Editeur        [Drift          [Monitoring
               test integre]     workflow]        detection]      quotidien]
```

**Jour 1** : La mefiance technique est naturelle. Le perimetre pre-configure par le CEO reduit le "cold start." Le formulaire SSO avec guide pas-a-pas et test integre transforme la mefiance en verification positive — "c'est pro."

**Semaine 1** : L'editeur de workflow visuel provoque le flow — drag-and-drop des etapes, edition des prompts, selection des fichiers obligatoires. Le CTO retrouve le plaisir de l'ingenierie sans le bruit operationnel.

**Mois 1+** : La serenite s'installe via le monitoring quotidien. Le dashboard technique devient le premier ecran du matin. Les drifts sont detectes, traces, et resolus methodiquement.

#### Le curseur d'automatisation comme vecteur de confiance progressive

Le CTO est le persona cle pour le curseur d'automatisation. Il definit les plafonds par projet et par entreprise. Sa confiance dans MnM evolue en 3 phases :

1. **Phase prudente (Semaines 1-2)** : Tout en mode ASSISTE. Le CTO veut voir chaque decision avant approbation.
2. **Phase de delegation (Mois 1)** : Les taches repetitives (generation de tests, brief reception) passent en AUTO. Le CTO garde le mode ASSISTE pour les etapes critiques (review, merge).
3. **Phase de confiance (Mois 3+)** : Le CTO ajuste finement les seuils de drift detection. Il connait les faux positifs, calibre la sensibilite. MnM est devenu un instrument de precision qu'il maitrise.

---

### 1.3 Developpeur — L'Artisan du Code

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que cet agent comprend vraiment mon contexte ? Est-ce que ca va remplacer mon job ? Est-ce que je garde le controle sur mon code ?" |
| **Ressent** | Ambivalence : excitation face a la puissance de l'IA, peur du remplacement. Fierete artisanale — il veut que le code soit propre, pas juste fonctionnel. Frustration des outils sans contexte. |
| **Voit** | Un agent qui comprend la story, les specs, les maquettes, et les fichiers concernes. Du code qui se construit en temps reel devant ses yeux. Un curseur d'automatisation qu'il controle personnellement. |
| **Fait** | Lance son agent sur une story. Guide en temps reel : "Utilise le pattern Repository." Observe le code se construire en split view. Interrompt quand necessaire — "Stop, ne modifie pas ce fichier." Valide le diff et merge. |
| **Douleurs** | IA utilisee individuellement sans orchestration. Contexte perdu entre les outils. Peur du remplacement (Verite #22 — evolution des roles). Reviews chronophages. Code reviews sans contexte suffisant. |
| **Gains** | "C'est un junior ultra-rapide que je supervise." Contexte complet injecte automatiquement. Dialogue temps reel pendant l'execution. Vision d'evolution du role — de producteur a superviseur de qualite. Livraison en 2h au lieu de 6h. |

#### Arc emotionnel

```
Apprehension    Anticipation    Fascination     Collaboration   Accomplissement
("Ca va pas     ("C'est         ("Je vois le    ("C'est un      ("Livre en 2h
 casser mon     parti !")        code se         junior que      au lieu de 6h,
 workflow ?")                    construire")    je guide")      et c'est propre")
     |               |               |               |               |
     v               v               v               v               v
[Board         [Lancement       [Observation    [Pilotage       [Review +
 personnel]     agent]           live]           temps reel]     Merge]
```

**Premier contact** : L'apprehension est reelle. Le board personnel dissipe l'anxiete — "Je sais quoi faire." Les stories sont la, avec tout le contexte. C'est familier, augmente.

**Premier lancement** : L'anticipation monte quand l'agent demarre avec le workflow deterministe. La barre de progression et le terminal ouvert donnent de la visibilite.

**Observation live** : C'est LE moment de fascination. La split view — code a gauche, chat agent a droite, diff en surbrillance — provoque l'emerveilllement. Le developpeur voit le code se construire et peut intervenir a tout moment.

**Pilotage** : La collaboration s'installe. "Utilise le pattern Repository" — l'agent ajuste. "Stop" — l'agent s'arrete immediatement. Le developpeur n'est pas un spectateur passif, c'est un chef d'orchestre.

**Accomplissement** : Le diff est propre, les tests sont generes, la MR est creee automatiquement. "Livre en 2h au lieu de 6h." La peur du remplacement se transforme en vision d'evolution : mon role change, il s'eleve.

#### Anti-patterns emotionnels critiques

- **Sentiment de remplacement** : Si le dev a l'impression que l'agent fait tout et qu'il est inutile, c'est un echec fondamental. Le curseur d'automatisation personnel EST la reponse — le dev choisit son degre d'implication.
- **Perte de controle** : Le bouton "Stop" doit etre TOUJOURS visible et TOUJOURS fonctionner. L'arret doit etre immediat, pas "dans quelques secondes." Proposition de rollback automatique.
- **Code de mauvaise qualite** : Si l'agent produit du code que le dev n'aurait pas ecrit, la confiance se brise. Les patterns doivent etre respectes, les conventions suivies.

---

### 1.4 PO — Le Traducteur de Besoins

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "80% de mon temps c'est de la mise en forme. Si l'agent ecrit les stories, qu'est-ce qu'il me reste ? Est-ce que les stories generees vont etre assez precises ?" |
| **Ressent** | Epuisement operationnel — noyade dans l'execution mecanique. Frustration que la Definition of Ready ne soit jamais respectee. Peur de l'obsolescence. Envie secrete de se concentrer sur le metier. |
| **Voit** | Un agent qui decompose une epic en 5-8 stories structurees en 5 minutes au lieu de 2h. Un board Kanban ou il valide, reordonne, affine — il juge au lieu de produire. Une checklist DoR automatique. |
| **Fait** | Recoit des epics du PM. Decompose avec l'agent via chat. Affine les stories par drag-and-drop. Verifie la DoR en 1 clic. Assigne les agents et supervise la progression. |
| **Douleurs** | Execution mecanique ecrasante. Savoir tribal non-documente (Verite #5). Definition of Ready jamais respectee. Information qui se degrade a chaque handoff (Verite #1). |
| **Gains** | "Je me concentre sur comprendre le metier." De PO-redacteur a PO-validateur. Savoir tribal progressivement capture et queryable par les agents. Communication inter-agents qui elimine le telephone arabe. |

#### Arc emotionnel

```
Surcharge       Gain de temps   Maitrise        Delegation      Vue d'ensemble
("Encore une    ("En 5 min      ("C'est MON     ("Je supervise, ("Je vois tout,
 epic a         au lieu de       backlog")        je ne fais      les blocages
 decomposer")   2h")                              plus")          sont clairs")
     |               |               |               |               |
     v               v               v               v               v
[Reception     [Brainstorm      [Affinage       [Assignation    [Suivi
 epic]          decomposition]   stories]        agents]         sprint]
```

**L'emotion pivot** : Le moment ou le PO realise que "savoir juger" est plus precieux que "savoir faire." Ce basculement psychologique est le coeur de l'adoption. MnM ne remplace pas le PO — il libere le PO pour qu'il fasse ce que personne d'autre ne peut faire : comprendre le metier et juger la pertinence.

---

### 1.5 PM — Le Stratege Produit

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Mes PowerPoints sont re-interpretes a chaque handoff. 80% de mon temps c'est de l'execution, pas de la reflexion. Comment je garde le lien entre ma pensee strategique et l'execution terrain ?" |
| **Ressent** | Frustration du telephone arabe — la vision se deforme a chaque passage de relais. Envie de brainstormer librement et que l'output soit directement exploitable. Isolement strategique. |
| **Voit** | Un agent de brainstorm qui structure, challenge, organise. Un output structure qui devient directement une epic liee au brainstorm source. Une roadmap avec dependances auto-detectees. |
| **Fait** | Brainstorme avec l'agent. Valide la synthese structuree. Transforme en epic en 1 clic. Planifie sur la timeline avec dependances automatiques. |
| **Douleurs** | PPT re-interprete au handoff (Verite #1). Ratio 80% execution / 20% reflexion. Pas de lien direct entre recherche et execution. Decisions non-documentees (Verite #3). |
| **Gains** | "Zero perte d'info entre ma pensee et l'execution." Ratio inverse : 20% supervision / 80% reflexion. Le brainstorm EST le point d'entree du workflow (CrossPol #2). |

#### Arc emotionnel

```
Stimulation     Productivite    Satisfaction    Vision
creative        ("2h de         ("Zero perte    ("Je vois
("L'agent est   brainstorm =     d'info")        l'ensemble")
 un bon          un brief
 sparring        exploitable")
 partner")
     |               |               |               |
     v               v               v               v
[Brainstorm]   [Synthese        [Creation       [Roadmap
                structuree]      epic]           planning]
```

**Emotion cle** : La stimulation creative. L'agent de brainstorm n'est pas un outil passif — il challenge, il questionne, il reorganise. Le PM retrouve le plaisir de la reflexion strategique.

---

### 1.6 Lead Tech — Le Gardien de l'Architecture

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "60% de mon temps sur du scrum et des code reviews. La dette technique negocie toujours sa place dans les sprints. Si seulement je pouvais me concentrer sur l'architecture..." |
| **Ressent** | Frustration du travail mecanique repetitif. Culpabilite de ne pas pouvoir consacrer assez de temps a l'architecture. Fatigue des code reviews chronophages. Responsabilite lourde — gardien invisible. |
| **Voit** | Un dashboard matin avec dette technique trackee, reviews pre-analysees, alertes drift, couverture tests. Des MR annotees automatiquement : patterns respectes/violes, risques securite, suggestions. |
| **Fait** | Ouvre le dashboard technique chaque matin. Traite les reviews pre-analysees en 10 min au lieu de 45 min. Lance des workflows dedies pour la dette technique. Calibre les regles de review. |
| **Douleurs** | Code reviews chronophages. Scrum + versioning = "le pire." Dette technique invisible. Travail en background qui ne rentre jamais dans les sprints. |
| **Gains** | "MnM automatise le mecanique et me donne du temps pour ce qui compte." Reviews en 10 min au lieu de 45. Monitoring automatique dette/dependances. Workflows dedies pour la dette technique. |

#### Arc emotionnel

```
Focus           Efficacite      Methode         Liberation
("Priorites     ("Review en     ("La dette est  ("Du temps
 claires des     10 min au       geree comme     pour ce qui
 le matin")      lieu de 45")    un projet")     compte")
     |               |               |               |
     v               v               v               v
[Dashboard     [Code review     [Workflow       [Architecture
 matin]         assistee]        dette]          strategique]
```

**Emotion cle** : La liberation. Le Lead Tech est le persona qui souffre le plus du mecanisme repetitif. MnM ne lui donne pas plus de travail — il lui rend son temps. L'emotion finale n'est pas "je fais plus" mais "je fais mieux."

---

## 2. Defining Experiences — Les 5 Moments Fondateurs

Ces 5 moments sont les instants ou MnM cesse d'etre un outil et devient une experience transformante. Chaque moment est concu pour provoquer une emotion specifique qui ancre l'adoption a long terme.

---

### 2.1 Premier Onboarding CEO — "C'est different d'un formulaire"

#### Contexte et declencheur

Le CEO clique sur son lien d'invitation. Il s'attend a un formulaire classique : nom, prenom, taille d'entreprise, secteur, nombre d'employes — le parcours banal de tout SaaS B2B. Au lieu de cela, un agent conversationnel le salue : "Bonjour ! Decrivez votre entreprise..."

#### Deroulement detaille (micro-interactions)

1. **Premiere seconde** : L'ecran de connexion est epure. Pas de formulaire a 15 champs. Juste un champ de creation de compte simplifie (nom, email, mot de passe). Temps de creation : <30 secondes.

2. **Apparition de l'agent** (T+30s) : Transition fluide vers un chat. L'agent salue avec le prenom du CEO. Pas de jargon technique. Premiere question : "Decrivez votre entreprise en quelques mots — sa taille, ses equipes, ses produits."

3. **Conversation structuree** (T+1min a T+5min) : L'agent pose 5-7 questions maximum (jamais plus — au-dela, l'impatience du CEO detruit l'experience). Chaque question est contextualisee par la reponse precedente. L'agent reformule pour confirmer : "Donc vous avez 3 BU — France, USA, Transverse. C'est bien ca ?"

4. **Generation de l'organigramme** (T+5min) : Micro-moment de surprise. L'agent genere un organigramme visuel interactif a partir de la conversation. Transition animee du chat vers un mode visuel. L'organigramme apparait progressivement — pas un chargement brutal, une revelation.

5. **Validation tactile** (T+6min) : Le CEO peut deplacer des blocs en drag-and-drop, renommer des roles, ajouter des equipes. Chaque modification est instantanee. Aucun bouton "Sauvegarder" — tout est auto-sauve. Le CEO sent : "C'est MOI qui decide."

6. **Cascade d'invitations** (T+8min) : "Inviter les responsables" — les emails sont pre-remplis avec le contexte specifique a chaque perimetre. Le CEO voit son organisation se deployer dans MnM en temps reel.

#### Emotion visee et comment la provoquer

**Emotion principale : Confiance immediate**

La confiance nait du contraste avec l'attendu. Le CEO s'attend a un formulaire rigide — il decouvre une conversation intelligente. Le mecanisme est psychologique : quand une premiere interaction depasse les attentes, l'utilisateur projette cette qualite sur l'ensemble du produit.

**Micro-emotions a orchestrer :**
- T+0s : Curiosite neutre (epuration de l'ecran d'accueil)
- T+30s : Interet ("C'est different d'un formulaire")
- T+5min : Surprise ("Il a compris du premier coup")
- T+6min : Controle ("C'est MOI qui decide" via le drag-and-drop)
- T+8min : Confiance ("Ca se deploie vite")

**Comment provoquer :** Le rythme est essentiel. La conversation doit etre fluide, jamais hesitante. L'agent ne dit jamais "Je ne comprends pas" — il reformule. La generation de l'organigramme doit etre quasi-instantanee (<3 secondes) pour maintenir le flow.

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Agent qui pose trop de questions | Impatience, abandon | Limiter a 5-7 echanges. Progress bar subtile "Etape 2/4." |
| Mauvaise interpretation de la structure | Frustration, perte de confiance | Bouton "Corriger" toujours visible. Reformulation systematique avant de generer. |
| Lien d'invitation expire | Echec avant meme le debut | Message d'erreur clair + renvoi automatique. Validite de 7 jours. |
| Organigramme inexact | Doute sur la fiabilite de l'IA | Drag-and-drop permissif + suggestions correctives de l'agent. |
| Invitations en spam | Deploiement bloque | Verification du domaine d'envoi. Notification in-app si invitation non-ouverte apres 24h. |

#### Metriques de succes UX

- Taux de completion de l'onboarding : >85%
- Temps moyen de l'onboarding CEO : <10 minutes
- Nombre moyen d'echanges avec l'agent : 5-7
- Taux de modification de l'organigramme genere : <40% (indicateur de qualite de comprehension)
- Score CSAT post-onboarding : >4.2/5
- Taux d'invitation cascade lancee : >70% dans les 24h

---

### 2.2 Premier Agent Lance — "Je vois le code se construire"

#### Contexte et declencheur

Un developpeur ouvre MnM pour la premiere fois apres onboarding. Son board personnel affiche ses stories assignees. Il selectionne une story, voit le contexte complet (specs, maquettes, fichiers concernes), et appuie sur "Lancer l'agent." C'est le moment ou MnM passe de "outil de gestion" a "outil de creation."

#### Deroulement detaille (micro-interactions)

1. **Selection de la story** (T+0) : Le contexte complet s'affiche. Pas de navigation entre 5 onglets — tout est la : specs techniques, maquettes liees, fichiers concernes, criteres d'acceptance. Le developpeur sent : "Tout le contexte est la."

2. **Bouton "Lancer l'agent"** (T+1min) : Animation subtile de lancement. Spinner avec estimation "~15s." Le workflow deterministe demarre — la barre de progression affiche les etapes : Brief > Code > Review > Test > Merge.

3. **Premiere etape — Brief** (T+15s) : L'agent analyse la story, identifie les fichiers, propose un plan d'implementation. Le developpeur voit le plan AVANT que le code ne soit ecrit. Il peut modifier, approuver, ou demander des ajustements.

4. **Transition vers le Code — le moment magique** (T+2min) : La split view apparait. Code a gauche, chat agent a droite. Le code commence a s'ecrire en temps reel. Diff en surbrillance — les lignes ajoutees sont visibles instantanement. Le terminal en bas affiche les logs.

5. **Premier echange de pilotage** (T+3min) : Le developpeur tape : "Utilise le pattern Repository pour le data access." L'agent repond : "Compris. J'ajuste le plan pour utiliser le pattern Repo existant dans core/repo.ts." Le code s'adapte en temps reel. Le developpeur n'a pas touche a un fichier — mais il a dirige l'execution.

6. **Premier "Stop"** (T+5min, si necessaire) : Le dev tape "Stop." L'agent s'arrete immediatement. Pas dans 5 secondes — immediatement. Proposition de rollback. Le dev sent qu'il a le pouvoir absolu.

#### Emotion visee et comment la provoquer

**Emotion principale : Fascination + Controle**

La fascination vient du spectacle visuel — voir du code s'ecrire en temps reel, guide par une intelligence qui comprend le contexte. Le controle vient de la capacite d'intervenir a tout moment. La combinaison des deux est unique : fascinant ET maitrise.

**Comment provoquer :**
- La split view doit etre immersive — pas de distractions, pas de notifications parasites pendant l'execution
- Le diff en surbrillance doit etre elegamment colore (vert pour ajouts, pas de rouge agressif)
- La barre de progression du workflow doit etre visible en permanence pour ancrer le sentiment de progression deterministe
- Le chat agent doit repondre en <2 secondes pour maintenir le flow conversationnel
- Le bouton "Stop" doit etre rouge, toujours visible, et la reaction doit etre instantanee

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Agent lent a demarrer | Perte d'anticipation | Spinner avec estimation. Pre-chargement du contexte pendant la lecture de la story. |
| Code de mauvaise qualite | Perte de confiance definitive | Templates de patterns par projet. Le CTO definit les standards en amont. |
| Agent ignore une directive | Frustration, sentiment d'impuissance | Alerte explicite : "L'agent n'a pas integre votre directive. Reformuler ?" Escalade possible. |
| Trop de bruit dans les logs | Surcharge cognitive | Filtre "Actions principales uniquement" active par defaut. Mode verbose optionnel. |
| Rollback incomplet apres "Stop" | Anxiete sur l'integrite du code | Confirmation avant chaque rollback. Snapshot automatique avant lancement. |

#### Metriques de succes UX

- Taux de completion du premier lancement agent : >90%
- Temps moyen jusqu'au premier pilotage (chat) : <5 minutes
- Taux d'utilisation du bouton "Stop" au premier lancement : <15% (indique que l'agent est bien calibre)
- Score de fascination (enquete post-session) : >4/5
- Taux de relancement d'un agent dans les 24h : >80%

---

### 2.3 Premiere Alerte Drift — "Je sais quoi faire"

#### Contexte et declencheur

Le CTO recoit une notification : "Drift detecte sur US-142 a l'etape Code." Un agent a modifie des fichiers hors du scope prevu par la story. C'est le premier test de confiance enterprise — la plateforme detecte un probleme ET propose une resolution.

#### Deroulement detaille (micro-interactions)

1. **Notification** (T+0) : Toast rouge en haut a droite. Texte concis : "Drift detecte — US-142 — Etape Code." Son subtil (configurable). Badge rouge sur l'etape concernee dans le pipeline de workflow.

2. **Clic sur la notification** (T+2s) : Le panneau de drift s'ouvre. Comparaison immediate : "Attendu" vs "Observe." Pas de jargon — un diff visuel clair. Les fichiers non-prevus sont marques [!!]. Les fichiers prevus et modifies sont marques [OK].

3. **Evaluation de la severite** (T+10s) : Indicateur de severite : Info / Warning / Critical. Explication en langage naturel : "L'agent modifie des fichiers hors du scope prevu par la story." Le CTO comprend immediatement la situation sans lire des logs.

4. **Actions proposees** (T+15s) : Trois boutons clairs — Ignorer (avec justification obligatoire), Recharger le contexte, Kill+Relance. Pas de doute sur quoi faire. Chaque action a une description tooltip de son effet.

5. **Resolution** (T+30s) : Le CTO choisit "Recharger le contexte." L'agent reprend avec les fichiers corrects. Le drift est archive dans l'audit trail. Le CTO recoit une confirmation : "Contexte recharge. L'agent a repris l'etape Code."

6. **Feedback loop** (T+1min) : Si le CTO choisit "Ignorer," il doit justifier. Cette justification enrichit le modele de drift detection — le systeme apprend des faux positifs.

#### Emotion visee et comment la provoquer

**Emotion principale : Urgence maitrisee**

Le drift provoque naturellement de l'anxiete — un agent a devie. MnM transforme cette anxiete en maitrise en 3 etapes :
1. **Detection rapide** — "Le probleme est identifie, pas cache"
2. **Comprehension immediate** — "Je comprends ce qui s'est passe"
3. **Resolution claire** — "Je sais quoi faire, et ca prend 30 secondes"

**Comment provoquer :** Le panneau de drift doit etre structure comme un rapport d'incident militaire — situation, analyse, actions. Pas de longues explications. Le diff visuel remplace les mots. Les boutons d'action sont gros, clairs, et colores par niveau de risque.

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Trop de faux positifs | Fatigue d'alerte, on ignore les vrais drifts | Recommandation automatique du seuil. Calibration progressive. |
| Pas assez de contexte pour decider | Paralysie decisionnelle | Toujours montrer le diff complet + explication en langage naturel. |
| Resolution qui casse quelque chose | Perte de confiance dans la plateforme | Snapshot avant chaque action de resolution. Rollback toujours possible. |
| Notification manquee | Drift non-traite qui s'aggrave | Escalade automatique apres 15 minutes sans action. Email + notification in-app. |

#### Metriques de succes UX

- Temps entre notification et ouverture du panneau drift : <30 secondes
- Temps moyen de resolution : <2 minutes
- Taux de resolution au premier clic (sans escalade) : >80%
- Taux de faux positifs signales : <15%
- Score de confiance post-drift (enquete) : >3.8/5

---

### 2.4 Premiere Communication Agent-to-Agent — "Mes agents collaborent"

#### Contexte et declencheur

L'agent du developpeur a besoin du contexte exact d'une story pour implementer correctement un composant. Au lieu de demander au PO par Slack (delai : heures), l'agent du dev query directement l'agent du PO. Le PO recoit une demande de permission. C'est le moment ou l'entreprise decouvre la collaboration machine-to-machine supervisee par l'humain.

#### Deroulement detaille (micro-interactions)

1. **Besoin identifie** (T+0) : L'agent du dev detecte une ambiguite dans la story US-142. Il identifie que l'agent du PO possede le contexte detaille de l'epic source.

2. **Demande de permission** (T+1s) : Le PO recoit une notification : "L'agent d'Alice (dev) demande acces au contexte de l'epic EP-045." La demande est claire : quel agent demande, quel artefact, pourquoi. Le PO voit un apercu de ce qui sera partage.

3. **Validation du PO** (T+10s) : Le PO approuve en 1 clic. Ou refuse avec raison. Ou approuve avec restriction ("partage les criteres, pas les maquettes confidentielles"). Le controle humain est explicite et granulaire.

4. **Transfert de contexte** (T+11s) : L'agent du dev recoit le contexte instantanement. Le developpeur voit dans son chat : "Contexte recu de l'agent PO — criteres d'acceptance detailles pour EP-045." L'ambiguite est levee sans qu'aucun humain n'ait eu a reformuler quoi que ce soit.

5. **Trace dans l'audit** (T+12s) : L'echange est trace : qui a demande, qui a approuve, quoi a ete partage, quand. Compliance assuree. Le CTO peut voir tous les echanges inter-agents dans son dashboard.

6. **Apprentissage** (T+ongoing) : Si le meme type de query se repete 3 fois avec approbation, MnM propose d'automatiser : "Autoriser automatiquement les queries de criteres d'acceptance entre agents dev et PO ?" Le curseur d'automatisation inter-agents evolue avec la confiance.

#### Emotion visee et comment la provoquer

**Emotion principale : Puissance organisationnelle**

C'est le moment ou l'utilisateur realise que MnM n'est pas un outil individuel — c'est un systeme nerveux organisationnel. Les agents collaborent, les humains supervisent, l'information circule sans degradation (resolution directe de la Verite #1).

**Comment provoquer :**
- La notification au PO doit etre concise et non-intrusive — pas un popup modal qui interrompt
- L'apercu du contenu partage doit etre visible AVANT approbation pour inspirer confiance
- Le transfert doit etre quasi-instantane apres approbation — zero latence perceptible
- La trace dans l'audit doit etre visible sans effort pour rassurer sur la gouvernance

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Trop de demandes de permission | Fatigue de validation, le PO refuse tout | Regroupement intelligent des demandes. Suggestion d'automatisation apres patterns repetes. |
| Sentiment de flicage (Verite #20) | Rejet du systeme par les operationnels | Metriques TOUJOURS agregees, jamais individuelles. Pas de "nombre de refus par utilisateur." |
| Partage involontaire de donnees sensibles | Risque compliance | Apercu obligatoire avant partage. Classification des artefacts (public, restreint, confidentiel). |
| L'agent partage un contexte obsolete | Decision basee sur de mauvaises infos | Horodatage visible. Alerte si le contexte date de plus de 48h. |

#### Metriques de succes UX

- Temps moyen de resolution d'une query inter-agents : <2 minutes
- Taux d'approbation des demandes : >75%
- Reduction du temps de handoff inter-roles : -30% (cible a 3 mois)
- Nombre de queries inter-agents par semaine : 50+ (cible a 3 mois)
- Taux de suggestion d'automatisation acceptee : >40%

---

### 2.5 Premier Dashboard Management — "Je vois TOUT sans rien demander"

#### Contexte et declencheur

Le CEO ouvre MnM 48 heures apres le deploiement initial. L'organisation a commence a travailler — quelques agents ont ete lances, des stories avancent, un drift a ete detecte et resolu. Le dashboard executif s'affiche avec des donnees reelles pour la premiere fois.

#### Deroulement detaille (micro-interactions)

1. **Chargement du dashboard** (T+0) : Pas de skeleton screen generique. Les widgets apparaissent progressivement avec une animation subtile de materialisation. Les donnees sont la — pas un ecran vide.

2. **Vue d'ensemble par BU** (T+1s) : Chaque BU est representee par une carte avec indicateurs agreges : nombre d'agents actifs, pourcentage d'avancement, nombre d'alertes drift. Les couleurs sont intuitives : vert = tout va bien, orange = attention, rouge = action requise.

3. **KPIs globaux** (T+3s) : Un panneau synthetique : workflows actifs, taux de respect, drifts detectes, MTTR moyen. Chaque chiffre est cliquable — drill-down en 1 clic vers le detail.

4. **Chat executif** (T+5s) : Le CEO voit la zone de chat et pose naturellement sa premiere question : "Ou en est le projet Alpha ?" La reponse arrive en <10 secondes : avancement, blocages, risques, avec liens vers les details.

5. **Moment de revelation** (T+15s) : Le CEO realise qu'il n'a demande aucune information a personne. Aucune reunion de reporting. Aucun email de suivi. L'information est venue a lui, structuree, temps reel, fiable.

6. **Exploration** (T+1min) : Le CEO clique sur l'alerte drift de la BU USA. Il voit le detail sans jargon technique : "Un agent a modifie des fichiers non-prevus. Resolu par le CTO en 2 minutes." Confiance renforcee — les problemes sont detectes ET resolus.

#### Emotion visee et comment la provoquer

**Emotion principale : Satisfaction profonde**

C'est l'emotion la plus rare en B2B — la satisfaction de ne rien avoir eu a demander. Le dashboard n'est pas un outil que le CEO utilise — c'est une fenetre qui s'ouvre sur son organisation augmentee.

**Comment provoquer :**
- Les donnees doivent etre REELLES, jamais simulees. Meme si elles sont partielles a J+2, elles doivent refleter la realite.
- L'animation de materialisation des widgets cree un micro-moment de decouverte a chaque visite
- Les couleurs sont emotionnelles : vert apaise, orange alerte sans alarmer, rouge appelle a l'action
- Le chat executif doit repondre comme un assistant personnel — pas comme un moteur de recherche
- Les liens "Voir details" doivent mener a une information comprehensible par un non-technique

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Dashboard vide a J+2 | Deception massive, abandon | Etats "en attente de donnees" avec progress bar de deploiement. Gamification subtile : "3/5 equipes connectees." |
| Donnees incorrectes ou incompletes | Perte de confiance irreversible | Badge de fiabilite par widget : "Donnees completes" vs "Partielles (2 equipes sur 5)." |
| Surcharge d'informations | Confusion, le CEO ne sait pas ou regarder | Mode "Executive Summary" par defaut — 4 chiffres cles + 1 alerte prioritaire. Details sur demande. |
| Reponse chat trop vague | Frustration, retour a l'email | Ajustement automatique du niveau de synthese. Option "Plus de details" / "Plus concis." |
| Dashboard identique chaque jour | Desinteret progressif | Insights proactifs : "Nouveau cette semaine : le projet Beta a demarre." Tendances visibles. |

#### Metriques de succes UX

- Frequence d'ouverture du dashboard CEO : >1 fois/jour
- Temps moyen passe sur le dashboard : 2-5 minutes (suffisant, pas excessif)
- Nombre de questions posees via le chat executif : >3/semaine
- Score de satisfaction dashboard (CSAT) : >4.5/5
- Taux de disparition des reunions de reporting : >50% a 3 mois
- Drill-down utilise : >60% des sessions

---

## 3. Inspiration & References

### 3.1 References produit — Ce que MnM emprunte

#### Notion — La simplicite radicale

**Ce qu'on emprunte :** La capacite a rendre un outil puissant visuellement simple. Le minimalisme qui cache la complexite. Les espaces blancs genereux. La typographie claire.

**Application MnM :** L'onboarding conversationnel du CEO doit avoir la meme limpidite qu'une page Notion vide — pas d'options visibles, juste un espace de conversation. Le dashboard executif doit etre aussi lisible qu'un document Notion bien structure.

**Emotion cible partagee :** "C'est propre, c'est clair, je comprends immediatement."

#### Linear — La vitesse comme experience

**Ce qu'on emprunte :** La reactivite instantanee. Chaque action se fait en <100ms. Les raccourcis clavier partout. Le feeling "natif" qui fait oublier qu'on est dans un navigateur.

**Application MnM :** Le board PO doit etre aussi rapide que Linear. Le drag-and-drop des stories doit etre instantane. Le chat avec l'agent doit repondre en <2s. Le curseur d'automatisation doit reagir sans latence.

**Emotion cible partagee :** "C'est rapide, ca ne me freine jamais."

#### Figma — La collaboration temps reel

**Ce qu'on emprunte :** Le multiplayer visible — voir qui est ou, qui fait quoi, en temps reel. Les curseurs des collegues. La conscience partagee de l'activite.

**Application MnM :** Le dashboard CTO doit montrer les agents actifs comme Figma montre les collaborateurs. Les drifts apparaissent en temps reel. Les modifications de workflow par un collegue sont visibles instantanement. L'agent-to-agent est le "multiplayer" de MnM.

**Emotion cible partagee :** "On travaille ensemble, en temps reel, sans se parler."

#### Datadog — L'observabilite accessible

**Ce qu'on emprunte :** La capacite a rendre des metriques techniques comprehensibles visuellement. Les graphes temporels. Les alertes graduees. Les dashboards personnalisables.

**Application MnM :** Le dashboard d'observabilite CTO s'inspire directement de Datadog — mais pour des agents IA au lieu de serveurs. Les graphes de drift, les metriques de compaction, la sante des containers.

**Emotion cible partagee :** "Je surveille tout, je comprends tout, je controle tout."

### 3.2 Anti-references — Ce que MnM refuse d'etre

#### Jira — La complexite accidentelle

**Ce qu'on refuse :** L'accumulation de fonctionnalites qui rend l'outil incomprehensible. Les menus a 4 niveaux. Les configurations qui necessitent un consultant certifie. Le onboarding qui prend des semaines.

**Le piege a eviter :** MnM gere 9 personas avec des modes differents. Le risque est d'accumuler des fonctionnalites par persona jusqu'a reconstruire la complexite de Jira. La regle : chaque persona voit UNIQUEMENT ce qui le concerne. Les items non-autorises sont masques, pas grises.

**Anti-emotion :** "Je me perds, je ne sais pas ou cliquer, j'ai besoin d'un tutoriel."

#### Salesforce — La surcharge informationnelle

**Ce qu'on refuse :** Les ecrans avec 50 champs editables. Les tableaux de bord avec 20 widgets. L'information partout, la comprehension nulle part.

**Le piege a eviter :** Le dashboard CEO pourrait afficher toutes les metriques disponibles. La regle : mode "Executive Summary" par defaut — 4 chiffres cles + 1 alerte prioritaire. Le detail est a 1 clic, jamais sur l'ecran principal.

**Anti-emotion :** "Il y a trop d'infos, je ne sais pas quoi regarder."

#### Slack — La surcharge de notifications

**Ce qu'on refuse :** Le flux continu de messages non-priorises. La peur de manquer quelque chose (FOMO). Les notifications qui interrompent le flow.

**Le piege a eviter :** Les communications agent-to-agent et les alertes drift pourraient generer un flux continu de notifications. La regle : regroupement intelligent, priorisation par severite, mode "Ne pas deranger" natif. Les drifts Critical interrompent. Les Info attendent.

**Anti-emotion :** "J'ai 50 notifications, la moitie ne me concerne pas, je les ignore toutes."

### 3.3 Patterns UX empruntes et adaptes

| Pattern | Source | Adaptation MnM |
|---------|--------|----------------|
| **Conversational onboarding** | Typeform, Intercom | Agent d'onboarding CEO — conversation structuree qui genere de la configuration |
| **Progressive disclosure** | Apple, Notion | Modes Simple/Avance dans l'editeur de workflow. Dashboard avec drill-down. |
| **Split view** | VS Code, Cursor | Code a gauche, chat agent a droite. Adaptation : barre de workflow en bas. |
| **Real-time collaboration** | Figma, Google Docs | Agents visibles en temps reel. Modifications de workflow partagees. |
| **Graduated alerts** | PagerDuty, Datadog | Drift detection : Info/Warning/Critical avec actions adaptees. |
| **Automation slider** | Aucun equivalent direct | **Innovation MnM** : curseur d'automatisation a 3 positions, multi-dimensionnel, hierarchique. |
| **Kanban augmente** | Trello, Linear | Board PO avec agents assignes, progression temps reel, DoR automatique. |
| **Command palette** | Linear, VS Code, Raycast | Ctrl+K pour recherche universelle, changement de company, lancement rapide. |
| **Diff visualization** | GitHub, GitLab | Drift detection : "Attendu vs Observe" en diff visuel colore. |
| **Dashboard widgets** | Datadog, Grafana | Grille personnalisable, drag-and-drop, widgets par role. |

### 3.4 Principes directeurs de design emotionnel

1. **Principe de contraste positif** : Chaque premiere interaction doit depasser les attentes. L'onboarding depasse le formulaire. Le lancement agent depasse le bouton "Run." Le drift depasse le log d'erreur.

2. **Principe de controle permanent** : A tout moment, l'utilisateur peut arreter, modifier, annuler. Le bouton "Stop" est toujours visible. Le curseur d'automatisation est toujours accessible. Le rollback est toujours possible.

3. **Principe de transparence sans bruit** : Montrer tout, expliquer simplement, ne pas submerger. Le resume LLM remplace les logs bruts. Le diff visuel remplace les descriptions textuelles. Les metriques agregees remplacent les donnees individuelles.

4. **Principe de progression naturelle** : L'outil grandit avec l'utilisateur. Manuel → Assiste → Automatique. Jamais de pression pour accelerer. La confiance se construit, elle ne s'impose pas.

5. **Principe anti-flicage (Verite #20)** : JAMAIS de metriques individuelles visibles par le management. Les dashboards sont agreges par equipe, par projet, par BU. Le curseur d'automatisation est personnel. L'objectif est l'empowerment, pas la surveillance.

---

> **Note de Maya** : Ce document est concu pour guider les decisions de design a chaque etape du developpement de MnM. Chaque micro-interaction, chaque animation, chaque choix de couleur doit etre evalue contre les emotions cibles definies ici. MnM n'est pas un outil — c'est une experience de transformation organisationnelle. Et la transformation commence par ce que les gens ressentent.

---

# Section 3 — Visual Foundation & Design Directions

> **Par Caravaggio le Visual** | Date : 2026-03-14 | Version : 1.0
> Sources : PRD B2B v1.0, Product Brief B2B v2.0, UX Journeys & Requirements v1.0

---

## Table des matieres

1. [Visual Foundation](#1-visual-foundation)
2. [Design Directions — 3 Options](#2-design-directions--3-options)
3. [Strategie Dark/Light Mode](#3-strategie-darklight-mode)

---

## 1. Visual Foundation

### 1.1 Hierarchie Visuelle — 4 Niveaux

MnM est une tour de controle. Comme dans un cockpit aeronautique, chaque element a un niveau d'importance visuel clairement defini. L'oeil doit savoir instantanement ou regarder.

**Niveau 1 — Action Primaire (Focal Point)**
- Boutons d'action principale : "Lancer l'agent", "Envoyer", "Valider", "Merger"
- Alertes critiques : drift detecte, agent en erreur, compaction echouee
- Style : couleur pleine saturee, taille large, ombre portee subtile, contraste maximum
- Un seul element de Niveau 1 visible par ecran a la fois
- Poids typographique : `font-semibold` ou `font-bold`, taille 16-18px

**Niveau 2 — Information Active (Contexte Immediat)**
- Etape courante du workflow, statut de l'agent, contenu du chat en cours
- Panneaux actifs : ChatPanel ouvert, detail de story selectionnee, diff en cours
- Style : fond legèrement contraste (surface elevee), bordure subtile, icones colorees
- Indicateurs de progression : barres, pourcentages, timers
- Poids typographique : `font-medium`, taille 14-16px

**Niveau 3 — Information Secondaire (Contexte Elargi)**
- Widgets de dashboard non-focuces, colonnes du board autres que celle en interaction
- Listes de membres, historique d'audit, metriques de tendance
- Style : fond neutre, bordures legeres, icones monochromes
- Navigation : sidebar, onglets, breadcrumbs
- Poids typographique : `font-normal`, taille 13-14px

**Niveau 4 — Information Ambiante (Peripherie)**
- Metadata : horodatages, identifiants techniques, numeros de version
- Tooltips, descriptions secondaires, compteurs discrets
- Style : opacite reduite (60-70%), taille reduite, positionnement marginal
- Apparait au hover/focus, n'encombre jamais l'espace au repos
- Poids typographique : `font-normal`, taille 12px, couleur `muted-foreground`

**Schema de hierarchie visuelle :**
```
  NIVEAU 1 (Focal)          ████████████████  ← Saturee, large, ombre
  NIVEAU 2 (Actif)        ░░░░░░░░░░░░░░░░░░  ← Surface elevee, bordure
  NIVEAU 3 (Secondaire)  ........................  ← Neutre, discret
  NIVEAU 4 (Ambiant)    · · · · · · · · · · · · ·  ← Reduit, hover-only
```

### 1.2 Architecture de l'Information — Ecrans Principaux

MnM s'organise autour de 4 vues principales, chacune adaptee a un persona et un mode d'interaction.

#### Ecran A — Dashboard Executif (CEO / DSI / DPO)

```
+============================================================================+
|  [MnM]  [AlphaCorp v]  |  Dashboard  Equipes  Rapports  |  [?] [N] [AV]  |
+============================================================================+
|                                                                            |
|  +--- KPI Headline (Niveau 1) ----------------------------------------+  |
|  |  Agents actifs: 12    Taux workflow: 94%    Drifts 7j: 3    ARR: +8%|  |
|  +--------------------------------------------------------------------+  |
|                                                                            |
|  +--- Avancement par BU ------+  +--- Alertes & Drift ----------------+  |
|  |  France     ████████░░ 78% |  |  [!] Drift US-142 — 14:32          |  |
|  |  USA        ██████░░░░ 62% |  |  [i] Compaction agent QA — 14:20   |  |
|  |  Transverse ████░░░░░░ 42% |  |  [!] Story bloquee US-143 — 13:50  |  |
|  +----------------------------+  +------------------------------------+  |
|                                                                            |
|  +--- Tendances 30 jours -----+  +--- Equipe -------------------------+  |
|  |      ^                      |  |  12 membres actifs                 |  |
|  |  50 |    *                  |  |  8 agents en cours                 |  |
|  |  40 |  *  *     *          |  |  94% respect workflow               |  |
|  |  30 | *    * * * *         |  |  [Voir les equipes]                 |  |
|  |  20 +--+--+--+--+--> sem  |  +------------------------------------+  |
|  +----------------------------+                                           |
|                                                                            |
|  +--- Chat Strategique (Niveau 2) ------------------------------------+  |
|  | > "Ou en est le projet Alpha ?"                                     |  |
|  | Agent: Le projet Alpha est a 68% d'avancement. 3 stories bloquees. |  |
|  | [Voir details]  [Poser une question]                                |  |
|  +--------------------------------------------------------------------+  |
+============================================================================+
```

**Logique visuelle :** Le CEO ne scroll pas. Tout tient sur un ecran. Les KPIs headline en Niveau 1 sont le premier contact visuel. Le chat strategique en bas permet l'interaction orale sans quitter le dashboard.

#### Ecran B — Monitoring Technique (CTO / Lead Tech)

```
+============================================================================+
| [MnM] [AlphaCorp v] | Monitoring  Workflows  Drift  Containers | [?][N][A]|
+============================================================================+
| SIDEBAR              | CONTENU PRINCIPAL                                   |
| +------------------+ |                                                     |
| | Workflows        | | +--- Workflow Actif: Dev Story -----------Niveau 1-+|
| |  > Dev Story [3] | | | [1.Brief OK] [2.Code >>>] [3.Review] [4.Test]     |
| |    QA Flow   [1] | | |              ^^^^^^^^^^^^                          |
| |    Brief Flow[0] | | | Etape 2/4 — Code — 45% — Timer: 12:34 — [SAIN]   |
| | +--            --+| | +--------------------------------------------------+|
| | Agents           | |                                                     |
| |  Alice-dev [RUN] | | +--- Split: Agents (N2) ---+--- Drift Log (N2) ---+|
| |  Bob-dev   [RUN] | | | Alice  [Running]  45min  | 14:32 Drift US-142   ||
| |  Carlos    [IDLE]| | | Bob    [Running]  12min  | 14:20 Compaction QA  ||
| |  QA-agent  [RUN] | | | Carlos [Idle]     --     | 13:50 Drift US-143   ||
| |  Brief-agt [CMP] | | | QA-agt [Running]  78min  | 13:15 Etape skip     ||
| | +--            --+| | | Brief  [Compact]  --     |                      ||
| | Containers       | | +-------------------------+------------------------+|
| |  [Sante: 98%]   | |                                                     |
| |  CPU: 34%        | | +--- Metriques Compaction (N3) --------------------+|
| |  RAM: 62%        | | | Compactions/jour: 12  Reinjection OK: 89%        ||
| |  Agents: 5/10    | | | Kill+relance: 3       Contexte moyen: 45k tokens ||
| +------------------+ | +--------------------------------------------------+|
+============================================================================+
```

**Logique visuelle :** Sidebar persistante pour la navigation technique. Le workflow actif en Niveau 1 domine le haut. La vue splitee agents/drift permet le monitoring simultane. Les metriques de compaction en Niveau 3 sont presentes mais non-intrusives.

#### Ecran C — Board Developpeur (Dev / PO)

```
+============================================================================+
| [MnM] [AlphaCorp v] | Board  Timeline  Metriques      Sprint 14 — Alpha  |
+============================================================================+
|                                                                            |
| TODO (3)          | EN COURS (2)        | REVIEW (1)     | DONE (4)       |
| +--------------+  | +--------------+    | +--------------+| +-----------+ |
| | US-145       |  | | US-142  [>>>]|    | | US-139       || | US-135 OK | |
| | Filtre date  |  | | Filtre rech. |    | | Pagination   || | US-136 OK | |
| | DoR: [VERT]  |  | | Dev: Alice   |    | | Dev: Bob     || | US-137 OK | |
| | Est: 3pts    |  | | Agent: 64%   |    | | Agent: DONE  || | US-138 OK | |
| +--------------+  | | [Chat] [Obs] |    | | [Review]     || +-----------+ |
| +--------------+  | +--------------+    | +--------------+|               |
| | US-146       |  | +--------------+    |                 |               |
| | Export CSV   |  | | US-143 [!]   |    |                 |               |
| | DoR: [ROUGE] |  | | Auth SSO     |    |                 |               |
| | Manque specs |  | | BLOQUE       |    |                 |               |
| +--------------+  | | [Drift alert]|    |                 |               |
| +--------------+  | +--------------+    |                 |               |
| | US-147       |  |                     |                 |               |
| | Notif push   |  |                     |                 |               |
| | DoR: [VERT]  |  |                     |                 |               |
| +--------------+  |                     |                 |               |
|                                                                            |
| +--- ChatPanel (retractable) ----------------------Niveau 2-[Agrandir]-+ |
| | > Utilise le pattern Repository pour le data access.                   | |
| | Agent: Compris. J'adapte le plan. J'utilise core/repo.ts.             | |
| | [Envoyer]  [Stop]  [Rollback]                                         | |
| +-----------------------------------------------------------------------+ |
+============================================================================+
```

**Logique visuelle :** Le board est l'espace de travail quotidien. Les cartes utilisent la couleur pour communiquer le statut (vert=pret, orange=bloque, rouge=erreur). Le ChatPanel est retractable en bas pour ne pas envahir l'espace board.

#### Ecran D — Editeur de Workflow (CTO / Lead Tech)

```
+============================================================================+
| [MnM] [AlphaCorp v] | Workflows > Dev Story (edition)   [Tester] [Sauver]|
+============================================================================+
| PALETTE ETAPES      | CANVAS WORKFLOW                                      |
| +------------------+|                                                      |
| | + Brief          || [Start] --> [Brief] --> [Code] --> [Review]          |
| | + Code           ||              |           |          |                |
| | + Review         ||         prompt.md    files.ts    rules.md            |
| | + Test           ||         context:5    auto:true   auto:false          |
| | + Merge          ||                                                      |
| | + Custom...      ||                 --> [Test] --> [Merge] --> [End]      |
| +------------------+|                      |          |                    |
|                      |                 coverage>80%  auto:true             |
| PROPRIETES ETAPE    |                                                      |
| +------------------+| +--- Proprietes "Code" (selectionnee) -----Niveau 2-+|
| | Etape: Code      || | Nom: Code                                          |
| | +--            --+| | Prompt: "Implemente selon les specs..."             |
| | Prompt:          || | Fichiers obligatoires: [src/**, tests/**]           |
| |  [Editer...]     || | Curseur auto: [Manuel|Assiste|Auto]  --> [Assiste] |
| | Fichiers:        || | Condition de sortie: Tests verts + coverage > 80%  |
| |  src/**          || | Timeout: 30 min                                     |
| |  tests/**        || | Drift detection: [Laxiste|Normal|Strict] --> Normal |
| | Auto: Assiste    || +----------------------------------------------------+|
| | Timeout: 30min   ||                                                      |
| +------------------+|                                                      |
+============================================================================+
```

**Logique visuelle :** Le canvas central est le point focal (Niveau 1). La palette a gauche et les proprietes a droite sont du Niveau 3 — elles servent le canvas. Le workflow est represente comme un graphe directionnel, pas une simple liste.

### 1.3 Systeme de Grille (Layout Grid)

**Grille de base : 12 colonnes**

```
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |10 |11 |12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
```

**Gouttiere (gutter)** : 16px (compact), 24px (standard), 32px (spacieux)
**Marges laterales** : 16px mobile, 24px tablette, 32px desktop
**Espacement vertical** : Multiples de 4px (4, 8, 12, 16, 24, 32, 48, 64)

**Breakpoints :**

| Breakpoint | Largeur | Colonnes | Sidebar | ChatPanel | Comportement |
|------------|---------|----------|---------|-----------|-------------|
| Mobile | < 768px | 4 | Masquee (hamburger) | FAB overlay | Vue unique, scroll vertical |
| Tablette | 768-1023px | 8 | Retractable (icones) | Overlay bottom | Board scroll horizontal |
| Laptop | 1024-1279px | 12 | Retractable (icones+text) | Overlay right | Panneaux empiles |
| Desktop | 1280-1535px | 12 | Fixe (240px) | Panneau fixe (320px) | Layout complet |
| Wide | >= 1536px | 12 | Fixe (280px) | Panneau fixe (400px) | Espace supplementaire pour widgets |

**Repartition type — Desktop (1280px+) :**
```
|  Sidebar  |          Contenu Principal          | ChatPanel |
| 3 col     |          6-7 col                    | 2-3 col   |
| 240px     |          flex-grow                  | 320px     |
```

**Comportement Sidebar :**
- Desktop : fixe, toujours visible, 240px
- Laptop : retractable, icones seules (64px) ou icones+texte (240px), toggle par bouton ou hover
- Tablette : masquee par defaut, apparait en overlay au clic hamburger
- Mobile : masquee, navigation par bottom tabs

**Comportement ChatPanel :**
- Desktop : panneau fixe a droite (320px), retractable
- Laptop : overlay a droite, apparait au clic
- Tablette : panneau bottom-sheet (50% hauteur)
- Mobile : plein ecran via FAB (floating action button)

### 1.4 Iconographie

**Famille d'icones : Lucide React**
- Coherent avec shadcn/ui (deja integre)
- Style : outline (stroke-width: 2px), coins arrondis, geometrique
- Pas de remplissage sauf pour les etats actifs (icones remplies pour "selectionne")

**Tailles standardisees :**

| Taille | Pixels | Usage |
|--------|--------|-------|
| `xs` | 12px | Indicateurs inline, badges, metadata |
| `sm` | 16px | Elements de liste, boutons compacts, navigation |
| `md` | 20px | Boutons standard, sidebar, menus |
| `lg` | 24px | Headers de section, etats vides, onboarding |
| `xl` | 32px | Illustrations de statut, ecrans vides, modales |

**Icones semantiques MnM :**

| Concept | Icone Lucide | Couleur |
|---------|-------------|---------|
| Agent actif | `Bot` | `text-violet-500` |
| Agent idle | `BotOff` | `text-muted-foreground` |
| Workflow | `GitBranch` | `text-blue-500` |
| Drift detecte | `AlertTriangle` | `text-orange-500` |
| Erreur | `XCircle` | `text-red-500` |
| Succes | `CheckCircle` | `text-green-500` |
| Compaction | `Minimize2` | `text-amber-500` |
| Chat | `MessageSquare` | `text-blue-400` |
| Audit | `FileSearch` | `text-slate-500` |
| Container | `Container` | `text-cyan-500` |
| Curseur auto | `SlidersHorizontal` | `text-purple-500` |
| Board/Kanban | `LayoutDashboard` | `text-indigo-500` |
| CEO/Oral | `Mic` | `text-emerald-500` |
| Permissions | `Shield` | `text-yellow-500` |

**Regle d'or :** Toute icone sans texte visible doit avoir un `aria-label`. Toute icone decorative a cote d'un texte a `aria-hidden="true"`.

### 1.5 Couleur et Lumiere — Palette Semantique

La couleur dans MnM n'est jamais decorative. Elle communique un etat, un statut, ou un niveau d'urgence. C'est le principe de la "couleur fonctionnelle".

**Couleurs de Statut :**

| Statut | Couleur | Token | Usage | Icone associee |
|--------|---------|-------|-------|---------------|
| OK / Succes | Vert | `--status-success` | Workflow respecte, story done, DoR valide, tests verts | `CheckCircle` |
| Warning / Drift | Orange | `--status-warning` | Drift detecte (non-critique), compaction recente, DoR partiel | `AlertTriangle` |
| Erreur / Critique | Rouge | `--status-error` | Agent en erreur, drift critique, bloqueur, test echoue | `XCircle` |
| Info / Neutre | Bleu | `--status-info` | Notification informative, etape en cours, lien contextuel | `Info` |
| Agent / IA | Violet | `--status-agent` | Tout ce qui est genere/execute par un agent IA | `Bot` |
| En cours | Bleu anime | `--status-running` | Progression, agent en execution, barre de chargement | `Loader2` (spin) |

**Couleurs de Role :**

| Role | Couleur badge | Token |
|------|-------------|-------|
| Admin | Rouge | `--role-admin` |
| Manager | Bleu | `--role-manager` |
| Contributor | Vert | `--role-contributor` |
| Viewer | Gris | `--role-viewer` |

**Couleurs des Modes :**

| Mode | Couleur d'accentuation | Persona |
|------|----------------------|---------|
| ORAL | Emeraude | CEO, DSI, PM |
| VISUEL | Bleu cyan | CTO, Lead Tech |
| CODE | Violet | Dev, Lead Tech |
| BOARD | Indigo | PM, PO, DPO |
| TEST | Ambre | QA, Lead Tech |

**Regle de triple encodage :** Chaque information transmise par la couleur est TOUJOURS accompagnee de :
1. Une icone distinctive
2. Un texte lisible

Jamais de couleur seule. Un utilisateur daltonien doit comprendre l'interface aussi bien qu'un autre.

**Courbe de lumiere :**
```
Fond principal   ████████████████████████  100% opacite
Surface elevee   ░░░░░░░░░░░░░░░░░░░░░░  fond + 3-5% luminosite
Bordure subtile  ─────────────────────────  fond + 8-12% luminosite
Texte primaire   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  contraste 7:1+
Texte secondaire ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  contraste 4.5:1+
Texte muted      ░░░░░░░░░░░░░░░░░░░░░░  contraste 3:1 (grands textes)
```

---

## 2. Design Directions — 3 Options

### Direction A — "Control Tower"

> *Inspiration : Mission Control NASA, cockpits aeronautiques, Grafana, Datadog*

**Moodboard Textuel :**
- **Couleurs dominantes :** Noir profond (#0A0A0F), bleu electrique (#3B82F6), cyan neon (#06B6D4), violet signal (#8B5CF6)
- **Couleurs secondaires :** Gris ardoise (#1E293B pour surfaces), vert matrix (#22C55E pour succes), rouge alarme (#EF4444)
- **Texture :** Surfaces mat sombres avec des accents lumineux. Effet de profondeur par superposition de calques semi-transparents. Grille subtile en fond rappelant les ecrans radar
- **Typographie :** `JetBrains Mono` pour les donnees et metriques, `Inter` pour le texte UI. Les chiffres sont grands et prominents. Style "instrumentation"
- **Ambiance :** Nuit. Precision. Chaque pixel a une fonction. L'interface brille dans l'obscurite comme un tableau de bord

**Persona cible principal :** CTO, Lead Tech, Developpeur — ceux qui veulent des donnees techniques en avant-plan et une densite d'information maximale

**Wireframe ASCII — Dashboard Control Tower :**
```
+============================================================================+
| [MnM] ▪ AlphaCorp                               14:32:15 UTC  [N][?][AV] |
| ═══════════════════════════════════════════════════════════════════════════ |
| SYSTEMES          | ■ SITUATION ROOM                                       |
| +-----------+     |                                                        |
| | ● Agents  |     |  AGENTS ACTIFS: 8/12    WORKFLOWS: 94%   DRIFTS: 3    |
| |   8 actifs|     |  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  |
| | ● Flows   |     |                                                        |
| |   3 actifs|     |  +--- RADAR DRIFT ---+  +--- AGENTS MATRIX ---------+ |
| | ● Drift   |     |  |     ·  ·  ·       |  | Alice    ████████░░  78%  | |
| |   3 alert |     |  |   ·  [US-142] ·   |  | Bob      ██████░░░░  62%  | |
| | ● Audit   |     |  |  ·  [US-143]  ·   |  | Carlos   ░░░░░░░░░░  IDLE | |
| |   247 evts|     |  |   ·    ·    ·      |  | QA-1     ████████████ 100%| |
| | ● Contain.|     |  |     ·  ·  ·       |  | Brief    ▓▓▓▓░░░░░░  CMP  | |
| |   CPU 34% |     |  +-------------------+  +---------------------------+ |
| +-----------+     |                                                        |
|                   |  +--- TIMELINE LIVE --------------------------------+  |
|                   |  | 14:32 [!] Drift US-142 — agent hors scope        |  |
|                   |  | 14:30 [●] Alice modifie search.ts                |  |
|                   |  | 14:28 [>] Bob complete etape Review              |  |
|                   |  | 14:20 [~] Compaction agent QA — reinjection OK   |  |
|                   |  +------------------------------------------------+  |
+============================================================================+
```

**Forces :**
- Densite d'information maximale — ideal pour le monitoring temps reel
- Ambiance professionnelle qui inspire confiance aupres des CTO
- Les donnees "brillent" sur le fond sombre — lisibilite des metriques excellente
- Coherent avec l'ecosysteme devops (Grafana, Datadog, terminal)
- Compatible avec des sessions longues (moins de fatigue oculaire en dark mode)

**Faiblesses :**
- Intimidant pour les personas non-techniques (CEO, PO, PM)
- Le mode oral/conversationnel parait decale dans une esthetique aussi technique
- Risque de surcharge cognitive si trop de widgets actifs
- Le CEO qui ouvre MnM pour la premiere fois peut penser "ce n'est pas pour moi"
- L'onboarding cascade (persona non-technique) entre en friction avec cette esthetique

**Compatibilite shadcn/ui + Tailwind :**
- Excellente. shadcn/ui supporte nativement le dark mode. Les couleurs neon s'obtiennent via des CSS custom properties. Les composants Card, Badge, Alert de shadcn s'integrent parfaitement. Tailwind `dark:` prefix couvre 95% des besoins.

---

### Direction B — "Clarity Studio"

> *Inspiration : Notion, Linear, Vercel Dashboard, Apple Human Interface Guidelines*

**Moodboard Textuel :**
- **Couleurs dominantes :** Blanc pur (#FFFFFF fond), noir doux (#0F172A texte), gris perle (#F8FAFC surfaces)
- **Couleurs secondaires :** Bleu doux (#3B82F6 accents), violet subtil (#8B5CF6 agents), touches pastels pour les statuts
- **Texture :** Surfaces planes et propres. Pas d'ombres portees — separation par bordures fines (1px, gris clair). Abondance de whitespace. Les elements respirent
- **Typographie :** `Inter` partout, poids variable. Grands titres legers (font-light, 32px), corps de texte confortable (15px, line-height 1.6). Style "editorial"
- **Ambiance :** Jour. Clarte. Serenite. Comme un carnet Moleskine numerique. Chaque ecran est un document lisible

**Persona cible principal :** PM, PO, DPO, CEO — ceux qui veulent la clarte, le focus sur le contenu, et une courbe d'apprentissage minimale

**Wireframe ASCII — Dashboard Clarity Studio :**
```
+============================================================================+
|  MnM     AlphaCorp                                         [?]  [N]  [AV] |
|                                                                            |
+============================================================================+
|                                                                            |
|   Bonjour Marc. Voici votre situation.                                     |
|                                                                            |
|   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     |
|   │ 12          │  │ 94%         │  │ 3           │  │ +8%         │     |
|   │ agents      │  │ workflows   │  │ alertes     │  │ productivite│     |
|   │ actifs      │  │ respectes   │  │ cette sem.  │  │ ce mois     │     |
|   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     |
|                                                                            |
|   Projets                                                    [Voir tous]  |
|   ──────                                                                  |
|                                                                            |
|   Projet Alpha                                          78% ████████░░   |
|   3 stories en cours · 1 alerte drift · Sprint 14                         |
|                                                                            |
|   Projet Beta                                           62% ██████░░░░   |
|   2 stories en cours · 0 alerte · Sprint 8                                |
|                                                                            |
|   Equipe Transverse                                     42% ████░░░░░░   |
|   1 story en cours · 2 alertes · Sprint 3                                 |
|                                                                            |
|   ┌─────────────────────────────────────────────────────────────────────┐ |
|   │  Posez une question...                                       [↵]   │ |
|   └─────────────────────────────────────────────────────────────────────┘ |
|                                                                            |
+============================================================================+
```

**Forces :**
- Courbe d'apprentissage quasi-nulle — familier pour tout utilisateur de Notion/Linear
- Le CEO ouvre MnM et comprend immediatement ou il en est
- L'abondance de whitespace reduit la surcharge cognitive
- L'onboarding conversationnel se fond naturellement dans l'esthetique
- Excellent pour le mode ORAL et BOARD
- La barre de question en bas est intuitive et non-technique

**Faiblesses :**
- Manque de densite pour les CTO/devs habitues a Grafana/terminal
- Les donnees techniques complexes (drift diff, compaction metrics) perdent en lisibilite
- Le mode CODE parait sous-equipe dans cette esthetique legere
- La surveillance temps reel multi-agents est difficile a representer dans un style si minimal
- Risque de paraitre "jouet" aupres des decideurs techniques ("ca fait Notion, pas une tour de controle")

**Compatibilite shadcn/ui + Tailwind :**
- Excellente. C'est l'esthetique native de shadcn/ui. Quasiment zero customisation necessaire. Les composants Card, Table, Dialog s'integrent tel quel. Tailwind utilities couvrent 100% des besoins. Temps de developpement minimal.

---

### Direction C — "Adaptive Cockpit" (RECOMMANDEE)

> *Inspiration : Hybride intelligent. Tesla Dashboard (adaptatif), Figma (multi-mode), VS Code (configurable), Linear (clarte). Le cockpit change visuellement selon qui le regarde et ce qu'il fait.*

**Moodboard Textuel :**
- **Couleurs dominantes :** Palette neutre adaptative — gris ardoise (#1E293B dark) / blanc chaud (#FAFAF9 light). Violet MnM (#7C3AED) comme couleur de marque unique
- **Couleurs secondaires :** Les couleurs de statut (vert/orange/rouge/bleu) restent constantes entre les modes. Les couleurs d'accentuation changent selon le mode actif (emeraude pour ORAL, cyan pour VISUEL, violet pour CODE, indigo pour BOARD, ambre pour TEST)
- **Texture :** Surfaces adaptatives. En mode technique : surfaces plus denses, bordures plus marquees, typographie monospace. En mode manager : surfaces plus aeres, bordures arrondies, typographie proportionnelle. La transition est fluide
- **Typographie :** `Inter` pour l'interface generale. `JetBrains Mono` pour le mode CODE et les donnees techniques. Le systeme bascule intelligemment selon le contexte
- **Ambiance :** Le cockpit MnM est un instrument qui s'adapte au pilote. Le CEO voit un dashboard epure et conversationnel. Le CTO voit une tour de controle dense. Le dev voit un IDE augmente. Meme donnees, presentation differente

**Principe fondateur :** "Meme realite partagee, interface adaptee au regard"

**Persona cible principal :** Tous — c'est la force de cette direction. Chaque persona retrouve son confort

**Wireframe ASCII — Mode CEO (Light, Epure) :**
```
+============================================================================+
|  MnM ◆  AlphaCorp                                    [Mode: Strategique]  |
|                                                                            |
+============================================================================+
|                                                                            |
|   Bonjour Marc.                              Aujourd'hui, 14 mars 2026    |
|                                                                            |
|   ┌─ Agents ────┐  ┌─ Workflows ─┐  ┌─ Alertes ────┐  ┌─ Tendance ──┐  |
|   │     12      │  │    94%      │  │      3       │  │    +8%      │  |
|   │   actifs    │  │  respectes  │  │  a traiter   │  │  ce mois    │  |
|   └─────────────┘  └─────────────┘  └──────────────┘  └─────────────┘  |
|                                                                            |
|   VOS PROJETS                                                              |
|   Alpha ·········································· 78%  ████████░░        |
|   Beta ··········································· 62%  ██████░░░░        |
|   Transverse ····································· 42%  ████░░░░░░        |
|                                                                            |
|   ┌─ Assistant strategique ──────────────────────────────────────────┐    |
|   │  > Ou en est le projet Alpha ?                                    │    |
|   │  Agent: Alpha est a 78%. 3 stories actives, 1 drift non-critique. │    |
|   │  Risque principal : US-143 bloquee depuis 2h (auth SSO).          │    |
|   │  [Details]  [Alerter le CTO]  [Ignorer]                           │    |
|   └──────────────────────────────────────────────────────────────────┘    |
+============================================================================+
```

**Wireframe ASCII — Mode CTO (Dark, Dense) :**
```
+============================================================================+
| MnM ◆ AlphaCorp          [VISUEL]  [CODE]  [BOARD]       14:32 UTC  [N]  |
+═══════════════════════════════════════════════════════════════════════════+|
| NAV                | MONITORING CENTER                                    |
| ┌────────────┐     |                                                      |
| │ ▸ Workflows│     | [1.Brief ✓] [2.Code ▶▶▶] [3.Review] [4.Test]        |
| │   Dev   [3]│     | ───────────────────────────────────────────────      |
| │   QA    [1]│     | Etape 2 · 45% · 12:34 · Sante: OK                   |
| │   Brief [0]│     |                                                      |
| │ ▸ Agents   │     | ┌─ Agents ──────────┐  ┌─ Drift Feed ────────────┐ |
| │   5 actifs │     | │ Alice  ▶ 45min 78% │  │ 14:32 [!] US-142 scope │ |
| │ ▸ Drift    │     | │ Bob    ▶ 12min 62% │  │ 14:20 [~] QA compact   │ |
| │   3 alertes│     | │ Carlos ○ idle      │  │ 13:50 [!] US-143 block │ |
| │ ▸ Containers│    | │ QA-1   ▶ 78min 100%│  │ 13:15 [i] Etape skip  │ |
| │   CPU: 34% │     | │ Brief  ◐ compact   │  │                        │ |
| └────────────┘     | └────────────────────┘  └────────────────────────┘ |
|                     |                                                      |
|                     | ┌─ Compaction ──────┐  ┌─ Containers ─────────────┐ |
|                     | │ 12/jour  89% OK   │  │ CPU 34%  RAM 62%  5/10  │ |
|                     | │ Kill: 3  Ctx: 45k │  │ Sante globale: 98%      │ |
|                     | └──────────────────┘  └──────────────────────────┘ |
+============================================================================+
```

**Wireframe ASCII — Mode Dev (Dark, Split Code+Chat) :**
```
+============================================================================+
| MnM ◆ AlphaCorp  US-142: Filtre recherche       [CODE]  [BOARD]    [N]   |
+═══════════════════════════════════════════════════════════════════════════+|
| [1.Brief ✓] [2.Code ▶▶▶ 45%] [3.Review] [4.Test] [5.Merge]    12:34    |
+═══════════════════════════════════════════════════════════════════════════+|
| CODE VIEW (60%)                        | CHAT AGENT (40%)                 |
| ┌────────────────────────────────────┐ | ┌──────────────────────────────┐ |
| │ search.ts                     [M] │ | │ [Agent] 14:26                │ |
| │────────────────────────────────────│ | │ Plan adapte. J'utilise       │ |
| │  1  import { Repository }         │ | │ core/repo.ts comme base.     │ |
| │  2  from '../core/repo'           │ | │                              │ |
| │  3                                │ | │ [Vous] 14:28                 │ |
| │  4  export class SearchService {  │ | │ Ajoute aussi les tests       │ |
| │  5+   private repo: Repository    │ | │ unitaires.                   │ |
| │  6+                               │ | │                              │ |
| │  7+   async search(query: string) │ | │ [Agent] 14:28 (execution)    │ |
| │  8+     return this.repo.find({   │ | │ Modification search.ts...    │ |
| │  9+       where: { name: query }  │ | │ ████████████░░░░ 64%        │ |
| │ 10+     })                        │ | │                              │ |
| │ 11    }                           │ | │ Fichiers: 3  Confiance: 87% │ |
| │ 12  }                             │ | ├──────────────────────────────┤ |
| └────────────────────────────────────┘ | │ [Message...]  [Stop][Rollback│ |
|                                        | └──────────────────────────────┘ |
+============================================================================+
```

**Forces :**
- Resout le paradoxe fondamental de MnM : etre a la fois pour le CEO et le dev
- Chaque persona retrouve une interface familiere (le CEO voit Notion, le CTO voit Grafana, le dev voit VS Code)
- La couleur d'accentuation par mode cree une coherence visuelle tout en differenciant les contextes
- L'adaptation est transparente — pas de "changement de page", juste un ajustement de densité et de ton
- Le dark mode pour les techniques et le light mode pour les managers suit les conventions naturelles
- La transition fluide entre modes permet au Lead Tech d'etre en dark/dense quand il monitore et light/aere quand il fait du board

**Faiblesses :**
- Complexite de developpement : maintenir 2 modes visuels (dense/aere) x 2 themes (dark/light) = 4 combinaisons
- Risque de fragmentation de l'identite visuelle si les modes sont trop differents
- Tests d'accessibilite a multiplier par le nombre de combinaisons
- La coherence entre les modes demande une discipline de design tokens rigoureuse

**Attenuation des faiblesses :**
- Les design tokens CSS variables resolvent la complexite technique — une seule source de verite
- shadcn/ui + Tailwind facilitent la bascule dark/light nativement
- Le systeme de composants est le meme — seuls les tokens de densite et de theme changent
- Commencer avec 2 combinaisons MVP (light-aere pour managers, dark-dense pour tech) et ajouter les autres progressivement

**Compatibilite shadcn/ui + Tailwind :**
- Tres bonne. shadcn/ui supporte dark/light nativement. Les tokens de densite (padding, gap, font-size) peuvent etre controles par une classe CSS racine (`.density-compact` vs `.density-comfortable`). Tailwind arbitrary values et CSS custom properties gerent le reste. Complexite supplementaire estimee : +20-30% par rapport a un theme unique, mais le ROI est massif en termes d'adoption multi-persona.

---

### Tableau Comparatif des 3 Directions

| Critere | A — Control Tower | B — Clarity Studio | C — Adaptive Cockpit |
|---------|------------------|-------------------|---------------------|
| Persona primaire | CTO, Dev | CEO, PM, PO | Tous |
| Theme par defaut | Dark | Light | Adaptatif |
| Densite | Haute | Basse | Variable |
| Courbe apprentissage | Moyenne | Faible | Faible (par persona) |
| Adoption CEO | Faible | Excellente | Excellente |
| Adoption Dev | Excellente | Moyenne | Excellente |
| Complexite dev | Moyenne | Faible | Moyenne-Haute |
| Identite visuelle | Forte (technique) | Forte (minimaliste) | A construire |
| Compatibilite shadcn | Excellente | Native | Tres bonne |
| Risque principal | Exclut non-techs | Trop simple pour data | Fragmentation |
| **Recommandation** | Plan B si mono-CTO | Plan B si mono-PM | **RECOMMANDEE** |

**Recommandation finale :** La Direction C "Adaptive Cockpit" est la seule qui honore la promesse produit de MnM — "une plateforme unique qui s'adapte a chaque role." Choisir A ou B reviendrait a privilegier un persona au detriment des autres, ce qui est contraire au positionnement B2B multi-role de MnM.

---

## 3. Strategie Dark/Light Mode

### 3.1 Quand utiliser Dark vs Light

MnM ne force pas un mode. Le systeme propose un defaut intelligent par persona, que l'utilisateur peut toujours surcharger.

**Defauts par persona :**

| Persona | Mode par defaut | Raison |
|---------|----------------|--------|
| CEO / DSI | Light | Convention des outils de management. Lisibilite optimale pour la lecture rapide de KPIs |
| CTO / Lead Tech | Dark | Convention des outils de monitoring (Grafana, Datadog). Confort pour les sessions longues |
| DPO | Light | Coherence avec les outils de gestion produit (Linear, Jira) |
| PM | Light | Mode ORAL et BOARD, contenus textuels longs — light est plus lisible |
| PO | Light | Board Kanban, validation de stories — luminosite aide au focus |
| Designer | Light | Convention design (Figma est light par defaut) |
| Developpeur | Dark | Convention IDE (VS Code dark est le defaut le plus populaire) |
| QA / Testeur | Dark | Rapports techniques, logs, execution — proximite du terminal |

**Defauts par contexte (override le persona si l'utilisateur est en multi-mode) :**

| Contexte | Mode suggere | Raison |
|----------|-------------|--------|
| Mode ORAL (chat strategique) | Light | Conversation naturelle, lisibilite du texte |
| Mode VISUEL (monitoring) | Dark | Donnees qui "brillent", moins de fatigue |
| Mode CODE (IDE integre) | Dark | Convention dev, syntaxe coloree sur fond sombre |
| Mode BOARD (Kanban) | Choix utilisateur | Les deux fonctionnent bien |
| Mode TEST (rapports) | Dark | Logs, couverture, donnees techniques |
| Onboarding | Light | Accueil chaleureux, premiere impression non-intimidante |
| Presentation / demo | Light | Lisibilite sur projecteur/ecran partage |

**Preferences utilisateur :**
1. Choix explicite de l'utilisateur (priorite maximale)
2. Preference systeme (`prefers-color-scheme`)
3. Defaut par persona/mode (fallback)

### 3.2 Token Mapping entre les Modes

Le systeme de tokens CSS garantit la coherence entre dark et light. Un seul ensemble de tokens semantiques, deux (ou plus) ensembles de valeurs.

**Tokens Semantiques (identiques dans les deux modes) :**

```css
/* Surfaces */
--background           /* Fond principal */
--foreground           /* Texte principal */
--card                 /* Fond des cartes */
--card-foreground      /* Texte des cartes */
--popover              /* Fond des popovers */
--popover-foreground   /* Texte des popovers */

/* Elements interactifs */
--primary              /* Boutons/actions primaires */
--primary-foreground   /* Texte sur primaire */
--secondary            /* Boutons secondaires */
--secondary-foreground /* Texte sur secondaire */
--accent               /* Fond au hover/focus */
--accent-foreground    /* Texte sur accent */
--muted                /* Fond des zones inactives */
--muted-foreground     /* Texte secondaire/placeholder */

/* Bordures */
--border               /* Bordure par defaut */
--input                /* Bordure des inputs */
--ring                 /* Focus ring */

/* Statut (CONSTANTS entre les modes) */
--status-success       /* Vert: meme valeur dark et light */
--status-warning       /* Orange: meme valeur dark et light */
--status-error         /* Rouge: meme valeur dark et light */
--status-info          /* Bleu: meme valeur dark et light */
--status-agent         /* Violet: meme valeur dark et light */

/* Densite */
--spacing-tight        /* 4px — mode compact */
--spacing-normal       /* 8px — mode standard */
--spacing-relaxed      /* 12px — mode comfortable */
--font-size-data       /* 13px compact, 14px standard */
--font-size-body       /* 14px compact, 15px standard */
--border-radius        /* 6px compact, 8px standard */
```

**Valeurs Light Mode :**

```css
:root, .light {
  --background: 0 0% 100%;          /* #FFFFFF */
  --foreground: 222 47% 11%;        /* #0F172A */
  --card: 210 40% 98%;              /* #F8FAFC */
  --card-foreground: 222 47% 11%;   /* #0F172A */
  --muted: 210 40% 96%;             /* #F1F5F9 */
  --muted-foreground: 215 16% 47%;  /* #64748B */
  --border: 214 32% 91%;            /* #E2E8F0 */
  --primary: 263 70% 50%;           /* #7C3AED — violet MnM */
  --primary-foreground: 0 0% 100%;  /* #FFFFFF */
  --ring: 263 70% 50%;              /* #7C3AED */
}
```

**Valeurs Dark Mode :**

```css
.dark {
  --background: 224 71% 4%;         /* #0A0A0F */
  --foreground: 210 40% 98%;        /* #F8FAFC */
  --card: 217 33% 17%;              /* #1E293B */
  --card-foreground: 210 40% 98%;   /* #F8FAFC */
  --muted: 217 33% 17%;             /* #1E293B */
  --muted-foreground: 215 20% 65%;  /* #94A3B8 */
  --border: 217 33% 25%;            /* #334155 */
  --primary: 263 70% 58%;           /* #8B5CF6 — violet MnM legerement plus clair */
  --primary-foreground: 0 0% 100%;  /* #FFFFFF */
  --ring: 263 70% 58%;              /* #8B5CF6 */
}
```

**Tokens de Statut (INVARIANTS) :**

```css
:root {
  --status-success: 142 71% 45%;    /* #22C55E */
  --status-warning: 38 92% 50%;     /* #F59E0B */
  --status-error: 0 84% 60%;        /* #EF4444 */
  --status-info: 217 91% 60%;       /* #3B82F6 */
  --status-agent: 263 70% 50%;      /* #7C3AED */
}
```

**Important :** Les couleurs de statut sont les memes en dark et light. Cela garantit que le vert signifie toujours "OK" et le rouge toujours "erreur" quel que soit le theme. Les valeurs exactes peuvent etre legerement ajustees pour le contraste (ex: vert un peu plus clair en dark mode) mais la teinte reste identique.

### 3.3 Accessibilite — Contraste WCAG AA

**Ratios minimaux obligatoires :**

| Element | Ratio minimum | Verification |
|---------|--------------|-------------|
| Texte normal (< 18pt / < 14pt bold) | 4.5:1 | `--foreground` sur `--background` |
| Texte large (>= 18pt ou >= 14pt bold) | 3:1 | Titres, boutons grands |
| Elements interactifs (bordures, icones) | 3:1 | `--border` sur `--background` |
| Texte sur couleur primaire | 4.5:1 | `--primary-foreground` sur `--primary` |
| Texte sur couleur de statut | 4.5:1 | Blanc ou noir sur les badges de statut |
| Focus ring | 3:1 | `--ring` doit etre visible sur `--background` |

**Verification des contrastes — Light Mode :**

| Combinaison | Ratio | Conforme AA |
|-------------|-------|-------------|
| Foreground (#0F172A) sur Background (#FFFFFF) | 15.4:1 | OUI |
| Muted-foreground (#64748B) sur Background (#FFFFFF) | 4.6:1 | OUI (juste) |
| Primary (#7C3AED) sur Background (#FFFFFF) | 4.6:1 | OUI |
| Status-success (#22C55E) sur Background (#FFFFFF) | 3.1:1 | NON pour petit texte — utiliser texte sombre sur badge vert |
| Status-error (#EF4444) sur Background (#FFFFFF) | 4.0:1 | LIMITE — utiliser texte sombre sur badge rouge ou forcer le bold |

**Verification des contrastes — Dark Mode :**

| Combinaison | Ratio | Conforme AA |
|-------------|-------|-------------|
| Foreground (#F8FAFC) sur Background (#0A0A0F) | 18.2:1 | OUI |
| Muted-foreground (#94A3B8) sur Background (#0A0A0F) | 7.5:1 | OUI |
| Primary (#8B5CF6) sur Background (#0A0A0F) | 5.9:1 | OUI |
| Status-success (#22C55E) sur Card (#1E293B) | 4.8:1 | OUI |
| Status-error (#EF4444) sur Card (#1E293B) | 5.2:1 | OUI |

**Strategies de compensation pour les ratios limites :**

1. **Badge de statut :** Toujours utiliser le texte en `--foreground` (sombre ou clair selon le mode) sur un fond de couleur de statut, jamais l'inverse. Le fond colore est assez grand pour etre vu, le texte sombre dessus est toujours lisible
2. **Icones de statut :** Taille minimum 20px quand la couleur est le seul indicateur. Toujours ajouter une forme distinctive (cercle pour OK, triangle pour warning, X pour erreur)
3. **Graphes et charts :** Utiliser des patterns (hachures, points) en plus de la couleur pour differencier les series. Tooltip au hover avec valeurs textuelles
4. **Tests automatises :** Integrer `axe-core` dans le pipeline CI pour detecter toute regression de contraste

**Transition entre modes :**
- Transition CSS `transition: background-color 200ms ease, color 200ms ease` pour eviter le flash
- Pas d'animation des couleurs de statut (elles restent stables)
- Sauvegarde de la preference en `localStorage` + sync avec le profil utilisateur

---

*Document Visual Foundation & Design Directions v1.0 — Hierarchie visuelle a 4 niveaux, architecture 4 ecrans principaux, grille 12 colonnes responsive, iconographie Lucide, palette semantique, 3 directions visuelles avec wireframes, strategie dark/light avec tokens et accessibilite WCAG AA. ~3500 mots.*

---

# Section 4 — Priorisation UX & Alignement PRD

> **Auteur :** John le PM | **Date :** 2026-03-14 | **Sources :** PRD B2B v1.0, Product Brief B2B v2.0
> **Rôle :** Priorisation UX par impact business, alignement User Journeys/FRs, Success Criteria par persona

---

## 1. Priorisation UX par Impact Business

### 1.1 Méthodologie

Chaque expérience UX est évaluée selon deux axes :
- **Impact Business** (1-5) : lien direct avec les 26 Success Criteria du PRD et les KPIs business (ARR, rétention, time-to-value)
- **Effort UX** (1-5) : nombre de composants, pages, interactions complexes, états à designer

Le croisement produit 4 quadrants :
- **Quick Wins** (Impact fort, Effort faible) : livrer en premier
- **Strategic** (Impact fort, Effort fort) : planifier avec soin
- **Nice-to-have** (Impact faible, Effort faible) : intégrer si capacité
- **Defer** (Impact faible, Effort fort) : reporter post-MVP

### 1.2 Phase 1 — Multi-User Livrable (~1 semaine)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Page Membres (tableau, filtres, actions) | 5 | 2 | SC-BIZ-1, SC-BIZ-5, SC-C1 | **Quick Win** |
| Invitation par email (formulaire + lien signé) | 5 | 1 | SC-BIZ-1, SC-C2, SC-BIZ-7 | **Quick Win** |
| Invitation bulk (CSV/liste) | 3 | 2 | SC-C1, SC-C4 | Nice-to-have |
| Sélecteur de Company (multi-company) | 3 | 2 | SC-BIZ-7 | Nice-to-have |
| Sign-out avec feedback visuel | 4 | 1 | SC-BIZ-6 | **Quick Win** |
| Désactivation signup libre (toggle admin) | 4 | 1 | SC-BIZ-1 | **Quick Win** |

**Composants UI requis :** MembersTable, InviteModal, InviteBulkUploader, CompanySelector, SignOutButton
**Pages :** /members, /settings/company

**Verdict Phase 1 :** 4 Quick Wins sur 6 experiences. C'est la phase la plus rentable en ratio impact/effort. Le time-to-value pour CBA (SC-BIZ-5 : <2h) dépend directement de la fluidité de ces écrans.

### 1.3 Phase 2 — RBAC Métier (~2 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Attribution de rôle (Admin/Manager/Contributor/Viewer) | 5 | 2 | SC-BIZ-1, SC-D4, SC-BIZ-4 | **Quick Win** |
| Matrice de permissions visuelle (lecture/écriture) | 5 | 4 | SC-D4, SC-BIZ-6 | **Strategic** |
| Masquage navigation selon permissions | 4 | 3 | SC-BIZ-6, SC-BIZ-4 | **Strategic** |
| Badges couleur par rôle dans l'UI | 2 | 1 | SC-BIZ-6 | Nice-to-have |
| Page admin rôles (presets configurables) | 4 | 3 | SC-D4, SC-BIZ-1 | **Strategic** |
| Feedback visuel "accès refusé" (403 UX) | 3 | 1 | SC-BIZ-6 | **Quick Win** |

**Composants UI requis :** RoleSelector, PermissionMatrix, PermissionEditor, RoleBadge, AccessDeniedPage, NavGuard
**Pages :** /admin/roles, /admin/permissions

**Verdict Phase 2 :** La matrice de permissions est l'experience la plus stratégique. C'est le moment "wow" pour le CTO de CBA — il voit en un coup d'oeil qui peut faire quoi. Impact direct sur SC-D4 (100% validation humaine) et SC-BIZ-1 (POC signé).

### 1.4 Phase 3 — Scoping par Projet (~2-3 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Page d'accès par projet (membres, agents) | 5 | 3 | SC-BIZ-4, SC-C4, SC-A4 | **Strategic** |
| Filtrage sidebar par scope projet | 4 | 3 | SC-BIZ-5, SC-E1 | **Strategic** |
| Assignation agents à un projet | 4 | 2 | SC-A4, SC-D1 | **Quick Win** |
| Vue "mes projets" personnalisée | 3 | 2 | SC-BIZ-5, SC-BIZ-4 | Nice-to-have |
| Indicateur visuel scope actif (breadcrumb) | 3 | 1 | SC-BIZ-6 | Nice-to-have |

**Composants UI requis :** ProjectMembersPanel, ScopeFilter, AgentProjectAssigner, ProjectSwitcher, ScopeBreadcrumb
**Pages :** /project/:id/members, /project/:id/settings

**Verdict Phase 3 :** Le scoping par projet est le pivot vers le vrai multi-tenant. C'est ce qui rend MnM vendable au-delà de CBA. L'experience "page d'accès par projet" est stratégique car elle active SC-C4 (companies avec 3+ niveaux hiérarchiques).

### 1.5 Phase 4 — Enterprise-Grade (~3-4 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Configuration SSO (formulaire SAML/OIDC) | 5 | 4 | SC-BIZ-2, SC-BIZ-7 | **Strategic** |
| Audit viewer (log immutable, filtres, export) | 5 | 4 | SC-B1, SC-B2, SC-BIZ-1 | **Strategic** |
| Dashboard exécutif CEO (KPIs agrégés) | 5 | 5 | SC-BIZ-3, SC-E1, SC-B3 | **Strategic** |
| Dashboard CTO (drift, santé agents, containers) | 5 | 5 | SC-A2, SC-B5, SC-A1 | **Strategic** |
| Dashboard Dev (board personnel, agent status) | 4 | 3 | SC-E2, SC-E4, SC-BIZ-5 | **Strategic** |
| Dashboard PO/PM (stories, burndown, brainstorm) | 3 | 4 | SC-E3, SC-D2 | Defer |
| Multi-tenant admin (companies, quotas) | 3 | 3 | SC-BIZ-7 | Nice-to-have |

**Composants UI requis :** SSOConfigForm, AuditLogViewer, AuditExportButton, CEODashboard, CTODashboard, DevDashboard, DriftAlertPanel, AgentHealthMonitor, ContainerStatusWidget, TenantAdminPanel
**Pages :** /admin/sso, /audit, /dashboard/ceo, /dashboard/cto, /dashboard/dev, /admin/tenants

**Verdict Phase 4 :** Phase la plus lourde en effort UX mais aussi la plus impactante sur l'ARR (SC-BIZ-2). Les dashboards par rôle sont le "moment de vérité" enterprise — c'est ce qui convertit un POC en contrat annuel.

### 1.6 Matrice de Synthèse — Vue Globale

| Quadrant | Nombre d'experiences | Phases | Action |
|---|---|---|---|
| **Quick Wins** | 8 | Phases 1-2 principalement | Livrer immédiatement, itérer rapidement |
| **Strategic** | 11 | Phases 2-4 | Planifier avec wireframes detaillés, valider avec CBA |
| **Nice-to-have** | 5 | Toutes phases | Intégrer si sprint le permet |
| **Defer** | 1 | Phase 4 | Reporter post-MVP (dashboards PO/PM) |

**Conclusion priorisation :** Les Quick Wins des Phases 1-2 représentent le socle minimum pour le POC CBA (SC-BIZ-1). Les 11 experiences Strategic sont le coeur du produit vendable. Le ratio Quick Wins/Strategic (8/11) confirme que le scope est ambitieux mais réaliste sur 8-10 semaines.

---

## 2. Alignement User Journeys <-> PRD FRs — Matrice de Traçabilité

### 2.1 Matrice FR -> Écrans -> Personas -> Composants UI

| FR | Écrans / Pages | Personas concernés | Composants UI clés |
|---|---|---|---|
| **FR-MU** (Multi-User) | /members, /settings/company, /invite, /auth/signup, /auth/login | CEO, CTO, Admin | MembersTable, InviteModal, InviteBulkUploader, CompanySelector, AuthForms |
| **FR-RBAC** (Roles & Permissions) | /admin/roles, /admin/permissions, toutes pages (NavGuard) | CTO, Admin, Manager | RoleSelector, PermissionMatrix, PermissionEditor, RoleBadge, AccessDeniedPage |
| **FR-ORCH** (Orchestrateur) | /workflow/editor, /workflow/:id/run, /workflow/:id/monitor | CTO, Dev, Lead Tech, PO | WorkflowEditor (drag-and-drop), StepProgressBar, DriftDiffViewer, WorkflowSimulator |
| **FR-OBS** (Observabilité) | /audit, /dashboard/ceo, /dashboard/cto, /dashboard/dev | CEO, CTO, Lead Tech | AuditLogViewer, AuditExportButton, LLMSummaryPanel, DashboardWidgets, MetricsCards |
| **FR-ONB** (Onboarding) | /onboarding/company, /onboarding/team, /import | CEO, CTO, Manager | OnboardingChat, OrgChartBuilder, ImportWizard, CascadeProgressTracker |
| **FR-A2A** (Agent-to-Agent) | /agents/:id/connections, /approvals | Dev, PO, Lead Tech | A2APermissionPanel, ApprovalQueue, AgentConnectionGraph, QueryLogViewer |
| **FR-DUAL** (Dual-Speed) | /settings/automation, /project/:id/settings | CEO, CTO, Dev, Manager | AutomationCursorSlider, HierarchyOverridePanel, TaskClassificationBadge |
| **FR-CHAT** (Chat Temps Réel) | /agent/:id/chat, panel intégré dans /workflow/:id/run | Dev, PO, QA | AgentChatPanel, MessageBubble, ChatInput, ReconnectionIndicator, ReadOnlyBadge |
| **FR-CONT** (Containerisation) | /admin/containers, /agent/:id/container | CTO, Lead Tech, Admin | ContainerProfileEditor, ContainerStatusWidget, CredentialProxyConfig, ResourceLimitsForm |

### 2.2 Couverture des Personas par FR

| Persona | FRs primaires | FRs secondaires | Nombre d'écrans dédiés |
|---|---|---|---|
| **CEO** | FR-ONB, FR-OBS | FR-MU, FR-DUAL | 3 (onboarding, dashboard CEO, import) |
| **CTO / DSI** | FR-ORCH, FR-RBAC, FR-CONT, FR-OBS | FR-MU, FR-DUAL, FR-A2A | 6 (workflow editor, dashboard CTO, admin roles, SSO, containers, drift monitor) |
| **DPO** | FR-OBS, FR-ORCH | FR-A2A | 2 (dashboard inter-équipes, roadmap) |
| **PM** | FR-ONB, FR-DUAL | FR-A2A, FR-CHAT | 2 (brainstorm, roadmap) |
| **PO** | FR-ORCH, FR-CHAT, FR-A2A | FR-DUAL | 3 (stories board, agent chat, approbations) |
| **Designer** | FR-ORCH | FR-CHAT, FR-A2A | 1 (notifications workflow) |
| **Développeur** | FR-CHAT, FR-ORCH, FR-DUAL | FR-A2A, FR-OBS | 4 (board perso, agent chat, workflow run, dashboard dev) |
| **QA / Testeur** | FR-ORCH, FR-CHAT | FR-OBS | 2 (test workflow, capture savoir) |
| **Lead Tech** | FR-ORCH, FR-OBS, FR-CONT | FR-RBAC, FR-A2A | 4 (dashboard matin, code review, dette technique, containers) |

### 2.3 Gaps de Traçabilité Identifiés

| Gap | FR concerné | Impact | Recommandation |
|---|---|---|---|
| FR-ONB n'a pas d'écran dédié pour la cascade hiérarchique visualisée | FR-ONB | Moyen — le CEO ne voit pas la progression d'onboarding de son org | Ajouter un OrgOnboardingTracker dans le dashboard CEO |
| FR-DUAL n'a pas de feedback visuel sur le plafond hiérarchique actif | FR-DUAL | Moyen — l'utilisateur ne comprend pas pourquoi il ne peut pas monter le curseur | Ajouter un tooltip "Plafond défini par [Rôle]" sur le curseur |
| FR-A2A manque une vue "graph de connexions" entre agents | FR-A2A | Faible — Phase post-MVP | Prévoir le composant AgentConnectionGraph pour Phase 4+ |
| Le Designer n'a qu'un seul écran dédié | Transverse | Faible — le Designer utilise principalement des outils externes | Notifications push + intégration Figma en post-MVP |

---

## 3. UX Success Criteria par Persona

### 3.1 CEO — Le Pilote Stratégique

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier dashboard fonctionnel avec données | <48h après signup |
| **Fréquence d'usage** | Consultation dashboard | 2-3x par semaine |
| **Actions principales** | Consulter KPIs, poser une question stratégique, valider cascade | |
| **Actions secondaires** | Inviter managers, ajuster priorités, consulter audit | |
| **Task completion rate** | Onboarding complet (structure + invitations) | >85% |
| **Error rate** | Erreurs pendant l'onboarding conversationnel | <5% |
| **Satisfaction (CSAT)** | Satisfaction dashboard exécutif | >4.0/5 |
| **Wow moment** | "J'ouvre le dashboard et je vois toute mon organisation en un coup d'oeil — agents actifs, projets en cours, alertes. Comme un cockpit d'avion." |

### 3.2 CTO / DSI — Le Garant Technique

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier workflow déterministe fonctionnel | <4h après onboarding |
| **Fréquence d'usage** | Monitoring + config | Quotidien (5-10 min/jour) |
| **Actions principales** | Créer/éditer workflows, monitorer drift, configurer SSO, reviewer containers | |
| **Actions secondaires** | Définir permissions, consulter audit, ajuster sensibilité drift | |
| **Task completion rate** | Création workflow complet (étapes + prompts + fichiers) | >90% |
| **Error rate** | Erreurs de configuration workflow | <3% |
| **Satisfaction (CSAT)** | Satisfaction drift detection et monitoring | >4.2/5 |
| **Wow moment** | "Un agent a dévié de son workflow. J'ai reçu l'alerte en 5 minutes, j'ai vu le diff attendu vs observé, et j'ai relancé en un clic. Avant, on ne l'aurait jamais su." |

### 3.3 Développeur — L'Artisan du Code

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier agent lancé sur une story | <30 min après premier login |
| **Fréquence d'usage** | Travail quotidien avec agent | Quotidien (continu pendant les heures de dev) |
| **Actions principales** | Lancer agent, piloter en temps réel via chat, reviewer code, merger | |
| **Actions secondaires** | Ajuster curseur automatisation, consulter contexte inter-agents | |
| **Task completion rate** | Story livrée avec agent (de sélection à merge) | >80% |
| **Error rate** | Interventions manuelles nécessaires pendant exécution agent | <15% |
| **Satisfaction (CSAT)** | Satisfaction dialogue temps réel avec agent | >4.0/5 |
| **Wow moment** | "Je lance mon agent sur la story, je vois le code s'écrire en live, je lui dis 'Utilise le pattern Repository' en chat, et il ajuste immédiatement. C'est comme un pair programmer ultra-rapide." |

### 3.4 PO — Le Traducteur de Besoins

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Première story générée et validée par agent | <1h après onboarding |
| **Fréquence d'usage** | Validation stories, enrichissement savoir | Quotidien (30-60 min/jour) |
| **Actions principales** | Valider stories générées, enrichir le savoir tacite, approuver A2A | |
| **Actions secondaires** | Décomposer epics via brainstorm, consulter burndown | |
| **Task completion rate** | Stories validées sans retour à l'agent | >70% |
| **Error rate** | Stories rejetées nécessitant re-generation | <20% |
| **Satisfaction (CSAT)** | Gain de temps perçu sur la mise en forme | >4.0/5 |
| **Wow moment** | "L'agent a écrit 5 stories à partir de l'epic. J'ai juste validé et ajusté les acceptance criteria. En 15 minutes au lieu de 2 heures." |

### 3.5 PM — Le Stratège Produit

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier brainstorm structuré avec output exploitable | <2h après premier login |
| **Fréquence d'usage** | Sessions de brainstorm, suivi roadmap | 3-4x par semaine |
| **Actions principales** | Brainstormer avec agent, transformer en epics, consulter roadmap | |
| **Actions secondaires** | Analyser conflits roadmap, ajuster priorités | |
| **Task completion rate** | Brainstorm → epic structurée en une session | >75% |
| **Error rate** | Output brainstorm inutilisable | <10% |
| **Satisfaction (CSAT)** | Inversion du ratio exécution/réflexion | >4.2/5 |
| **Wow moment** | "J'ai brainstormé 30 minutes avec l'agent. Il a challengé mes hypothèses, structuré mes idées, et proposé 3 epics avec KPIs. Mon ancien process prenait une semaine." |

### 3.6 Lead Tech — Le Gardien de l'Architecture

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier dashboard matin avec dette technique + reviews | <1h après config |
| **Fréquence d'usage** | Dashboard quotidien, reviews augmentées | Quotidien (15-30 min/jour) |
| **Actions principales** | Consulter dashboard matin (dette, reviews, drift, couverture), reviewer MR augmentées | |
| **Actions secondaires** | Définir workflows dette technique, monitorer patterns | |
| **Task completion rate** | Code reviews completées avec annotations agent | >90% |
| **Error rate** | Faux positifs dans les alertes drift/patterns | <10% |
| **Satisfaction (CSAT)** | Réduction temps passé sur le mécanique (scrum, reviews basiques) | >4.0/5 |
| **Wow moment** | "Mon dashboard matin me montre : 3 reviews pré-analysées, 1 alerte drift, dette technique en baisse de 12%. En 10 minutes, j'ai la vision complète. Avant, ça me prenait 2 heures de scrum." |

### 3.7 Synthèse Time-to-Value par Persona

| Persona | Time-to-Value cible | Première action à valeur | Fréquence |
|---|---|---|---|
| CEO | <48h | Dashboard exécutif avec données réelles | 2-3x/semaine |
| CTO | <4h | Premier workflow déterministe actif | Quotidien |
| Dev | <30 min | Agent lancé sur une story | Continu |
| PO | <1h | Story validée générée par agent | Quotidien |
| PM | <2h | Brainstorm structuré exploitable | 3-4x/semaine |
| Lead Tech | <1h | Dashboard matin opérationnel | Quotidien |

---

## 4. Roadmap UX

### 4.1 Phase 1 — Écrans Multi-User (Semaine 1)

**Objectif :** Permettre au CEO CBA d'inviter son équipe et de voir les membres.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Membres** (/members) | MembersTable, StatusBadge, SearchFilter, BulkActionBar | P0 | 2j |
| **Modal Invitation** | InviteModal (email, rôle, message personnalisé), InviteBulkUploader | P0 | 1j |
| **Page Auth refactorée** | LoginForm, SignupForm (désactivable), SignOutButton | P0 | 1j |
| **Sélecteur Company** | CompanySelector (dropdown header) | P1 | 0.5j |
| **Settings Company** | CompanySettingsForm (toggle signup, nom, logo) | P0 | 0.5j |

**Total Phase 1 :** ~5 composants majeurs, 3 pages, 5 jours de design UX.

**Critère de succès Phase 1 :** Le CEO CBA peut inviter 5 personnes par email, voir la liste des membres, et les invités peuvent se connecter et accéder à l'app.

### 4.2 Phase 2 — Écrans RBAC (Semaines 2-3)

**Objectif :** Le CTO CBA peut attribuer des rôles et voir la matrice de permissions.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Admin Rôles** (/admin/roles) | RoleList, RolePresetSelector, RoleDetailPanel | P0 | 2j |
| **Matrice Permissions** (/admin/permissions) | PermissionMatrix (grille FR x Rôle), PermissionToggle, ScopeSelector | P1 | 3j |
| **RoleSelector intégré** | RoleSelector (dropdown dans MembersTable et InviteModal) | P0 | 0.5j |
| **NavGuard** | Composant invisible : masque les liens/boutons selon permissions | P1 | 1j |
| **Page 403** | AccessDeniedPage (message clair, bouton retour, lien contact admin) | P0 | 0.5j |
| **Badges rôle** | RoleBadge (couleur par rôle : rouge/bleu/vert/gris) | P2 | 0.5j |

**Total Phase 2 :** ~8 composants majeurs, 2 pages + intégrations, 7.5 jours de design UX.

**Critère de succès Phase 2 :** Un Viewer ne peut accéder qu'aux pages autorisées. Le CTO voit la matrice complète. Les routes API retournent 403 pour les accès non-autorisés.

### 4.3 Phase 3 — Écrans Scoping Projet (Semaines 4-6)

**Objectif :** Isolation par projet avec membres et agents assignés.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Membres Projet** (/project/:id/members) | ProjectMembersPanel, MemberRoleInProject, AddMemberToProject | P0 | 2j |
| **Filtrage Sidebar** | ScopeFilter (projets accessibles uniquement), ProjectSwitcher | P0 | 2j |
| **Assignation Agents** | AgentProjectAssigner (drag-and-drop ou select), AgentScopeIndicator | P0 | 1.5j |
| **Breadcrumb Scope** | ScopeBreadcrumb (Company > Projet > Écran actuel) | P1 | 0.5j |
| **Vue Mes Projets** (/projects/mine) | ProjectGrid, ProjectCard (métriques résumées), EmptyState | P1 | 1.5j |

**Total Phase 3 :** ~8 composants majeurs, 2 pages + intégrations sidebar, 7.5 jours de design UX.

**Critère de succès Phase 3 :** Un Contributor sur le Projet A ne voit pas les données du Projet B. La sidebar ne montre que les projets accessibles. Les agents sont assignés à des projets spécifiques.

### 4.4 Phase 4 — Écrans Enterprise (Semaines 7-10)

**Objectif :** SSO, audit complet, dashboards par rôle — le "vendable enterprise".

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Config SSO** (/admin/sso) | SSOConfigForm (SAML/OIDC), TestConnectionButton, SSOStatusBadge | P1 | 2j |
| **Audit Viewer** (/audit) | AuditLogViewer (timeline + filtres), AuditDetailPanel, AuditExportButton (CSV/JSON) | P0 | 3j |
| **Dashboard CEO** (/dashboard/ceo) | KPICards (avancement BU, agents actifs, alertes), OrgOverviewChart, QuestionInput (query stratégique) | P1 | 4j |
| **Dashboard CTO** (/dashboard/cto) | DriftAlertPanel, AgentHealthMonitor, ContainerStatusWidget, CompactionMetrics, WorkflowComplianceChart | P1 | 4j |
| **Dashboard Dev** (/dashboard/dev) | PersonalBoard (stories assignées), AgentStatusWidget, QuickLaunchButton, RecentActivity | P1 | 2j |
| **Workflow Editor** (/workflow/editor) | WorkflowCanvas (drag-and-drop), StepConfigPanel, PromptEditor, FileRequirementsList, WorkflowSimulator | P1 | 5j |
| **Drift Monitor** (/workflow/:id/drift) | DriftDiffViewer (attendu vs observé), DriftTimeline, ActionButtons (recharger/kill/ignorer) | P1 | 2j |

**Total Phase 4 :** ~20 composants majeurs, 6 pages, 22 jours de design UX.

**Critère de succès Phase 4 :** Le CEO CBA ouvre son dashboard et comprend l'état de son organisation en <30 secondes. Le CTO configure SSO en <15 minutes. L'audit log montre toutes les actions des 3 derniers mois.

### 4.5 Vue d'Ensemble Roadmap UX

```
Semaine   1    2    3    4    5    6    7    8    9    10
          ├────┤
          Phase 1 : Multi-User
          [5 composants, 3 pages]
               ├─────────┤
               Phase 2 : RBAC
               [8 composants, 2 pages]
                         ├──────────────┤
                         Phase 3 : Scoping
                         [8 composants, 2 pages]
                                        ├────────────────────┤
                                        Phase 4 : Enterprise
                                        [20 composants, 6 pages]

Total : ~41 composants UI, 13 pages, ~42 jours de design UX
```

### 4.6 Composants Transverses (Design System)

Ces composants sont utilisés dans plusieurs phases et doivent etre designés en amont :

| Composant | Utilisé dans | Priorité |
|---|---|---|
| DataTable (tri, filtres, pagination, actions bulk) | MembersTable, AuditLogViewer, ProjectList | P0 — Phase 1 |
| Modal (confirmation, formulaire, détail) | InviteModal, RoleDetail, AuditDetail | P0 — Phase 1 |
| Badge (statut, rôle, scope) | RoleBadge, StatusBadge, ScopeBadge | P0 — Phase 1 |
| Sidebar (navigation scopée) | ScopeFilter, NavGuard | P0 — Phase 1 |
| DashboardCard (KPI, métrique, alerte) | Tous dashboards Phase 4 | P1 — Phase 3 |
| DragAndDrop (réordonner, assigner) | WorkflowEditor, AgentAssigner | P1 — Phase 3 |
| ChatPanel (messages, input, reconnexion) | AgentChatPanel | P1 — Phase 3 |
| DiffViewer (attendu vs observé) | DriftDiffViewer, CodeReviewPanel | P1 — Phase 4 |

### 4.7 Dépendances UX Critiques

| Dépendance | Impact | Mitigation |
|---|---|---|
| Design System (tokens, composants de base) doit etre pret avant Phase 1 | Bloquant | Sprint 0 de 2-3 jours pour tokens + composants de base |
| La matrice de permissions Phase 2 dépend du modèle RBAC backend | Bloquant | Designer et backend en parallèle, contrat API défini en amont |
| Les dashboards Phase 4 dépendent des données d'observabilité | Partiellement bloquant | Dashboards avec données mockées d'abord, real data ensuite |
| Le WorkflowEditor est le composant le plus complexe (5j) | Risque planning | Prototyper l'interaction dès Phase 2, implémenter en Phase 4 |

---

## Conclusion — Recommandations PM

### Priorité absolue (POC CBA, Semaines 1-3)
1. **Quick Wins Phase 1** — Page Membres + Invitations + Auth = le minimum pour que CBA puisse utiliser MnM avec 5+ personnes
2. **RBAC Phase 2** — Attribution de rôles + matrice permissions = la preuve que MnM gère les accès enterprise

### Priorité haute (MVP vendable, Semaines 4-6)
3. **Scoping Phase 3** — Isolation par projet = le prérequis pour le multi-projet enterprise
4. **Design System Sprint 0** — Les composants transverses (DataTable, Modal, Badge, Sidebar) conditionnent la vélocité de toutes les phases

### Priorité stratégique (Contrat annuel, Semaines 7-10)
5. **Audit Viewer** — L'argument compliance #1 pour les entreprises
6. **Dashboard CTO** — Le "daily driver" qui rend MnM indispensable
7. **Dashboard CEO** — Le "wow moment" qui convainc le budget

### KPI de suivi pour cette roadmap UX
- **Couverture persona** : Chaque persona a au moins 1 écran dédié à la fin de Phase 2, 2+ à la fin de Phase 4
- **Ratio Quick Wins livrés** : 100% des Quick Wins Phase 1-2 livrés en semaine 3
- **Time-to-first-value CBA** : CEO fonctionnel en <48h, CTO en <4h, Dev en <30 min
- **Nombre de composants réutilisables** : >60% des composants utilisés dans 2+ contextes

---

*Section 4 — ~2200 mots — John le PM — Priorisation UX, Traçabilité FR, Success Criteria par Persona, Roadmap UX*
*Sources : PRD B2B v1.0 (26 Success Criteria, 9 FR groupes, 4 phases), Product Brief B2B v2.0 (9 Personas, 5 Noyaux de Valeur)*

---

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

---

# Section 6 — Innovation UX & Differenciation Visuelle

> **Auteur :** Victor le Stratege | **Date :** 2026-03-14 | **Statut :** Final
> **Sources :** PRD B2B v1.0, Product Brief B2B v2.0, 57 verites fondamentales (brainstorming cofondateurs)

---

## 1. Innovation UX : Ce qui rend MnM Unique

MnM ne se contente pas d'ameliorer l'existant. Il invente cinq paradigmes d'interaction qui n'existent dans aucun produit concurrent. Ces cinq innovations ne sont pas des features — ce sont des choix de design fondamentaux qui definissent l'identite de MnM comme categorie nouvelle.

### 1.1 Le Curseur d'Automatisation — Le Coeur de l'Interaction MnM

**Pourquoi c'est revolutionnaire :** Tous les outils du marche imposent un mode unique. Jira = tout manuel. Devin = tout automatique. Cursor = assiste pour le code uniquement. Aucun ne permet a l'utilisateur de **choisir son propre degre d'autonomie**, et encore moins de le faire varier par contexte.

Le curseur d'automatisation de MnM est un slider a 3 positions (Manuel / Assiste / Automatique) qui fonctionne a 4 niveaux de granularite simultanement :

```
NIVEAUX DE GRANULARITE              QUI LE REGLE
------------------------------------------------------------
Par action   "Generation tests = auto, code review = assiste"    L'utilisateur
Par agent    "Agent reporting = auto, agent brainstorm = manuel"  L'utilisateur
Par projet   "Projet legacy = assiste, nouveau projet = auto"     Le manager/CTO
Par entreprise "Plafond global : aucun merge sans validation"     Le CEO/CTO
```

**La hierarchie l'emporte :** c'est la regle fondamentale. Le CEO peut imposer un plafond que les niveaux inferieurs ne peuvent pas depasser. Un dev ne peut pas passer en mode "automatique" sur une action que le CTO a plafonnee en "assiste". C'est du RBAC applique a l'autonomie IA — un concept qui n'existe nulle part ailleurs.

**Design UX du curseur :**

Le curseur ne doit pas etre un simple toggle ni un slider technique. Il doit communiquer visuellement trois choses :
1. **La position actuelle** — ou en est l'utilisateur sur le spectre
2. **Le plafond hierarchique** — jusqu'ou il *peut* aller (impose par le niveau superieur)
3. **La progression naturelle** — ou il *devrait* aller selon son historique d'utilisation

L'implementation visuelle ideale est un **slider segmente avec zone coloree** :
- Zone verte = positions accessibles
- Zone grisee = positions bloquees par la hierarchie
- Indicateur de recommandation = suggestion basee sur l'historique ("Vous validez 98% des propositions de tests — passer en auto ?")

Le curseur doit etre **omnipresent** dans l'interface sans etre intrusif. Il apparait en contexte : quand l'utilisateur lance un agent, quand il valide une action, quand il configure un workflow. Pas dans un menu de parametres enfoui — dans le flux de travail, la ou la decision d'autonomie se prend reellement.

**L'evolution naturelle du curseur :**

```
Semaine 1-2    Tout en MANUEL         Decouverte, confiance zero
Mois 1         Repetitif en ASSISTE   Le testeur automatise les tests de regression
Mois 3+        Maitrise en AUTO       Les tasks strategiques/creatives restent en MANUEL par choix
```

C'est le mecanisme de transformation ethique des roles (Verite #19 : "MnM doit montrer l'evolution du role, pas la disparition"). On ne supprime pas le role — on l'eleve progressivement. Le curseur est la preuve tangible de cette promesse.

---

### 1.2 Le Dual-Mode Oral/Visuel — Une Plateforme, Neuf Experiences

**Pourquoi c'est revolutionnaire :** Aucun outil B2B ne propose deux modes d'interaction fondamentalement differents sur les memes donnees. Le CEO parle a MnM. Le CTO configure des graphes. Le Dev tape du code. Le PO manipule des boards. Le QA pilote des suites de tests. Et toutes ces experiences coexistent dans le meme cockpit, sur la meme realite partagee.

Les 5 modes definis par le Product Brief :

| Mode | Persona primaire | Experience | Principe directeur |
|------|-----------------|------------|-------------------|
| **ORAL** | CEO, DSI, DPO | Conversation naturelle. Dicte sa strategie, pose des questions, recoit des syntheses. | "Je parle, MnM structure" |
| **VISUEL** | CTO, Lead Tech | Dashboards temps reel, graphes de dependances, monitoring de drift. | "Je vois tout d'un coup d'oeil" |
| **CODE** | Dev, Lead Tech | Integration IDE native, terminal integre, agent pilotable en direct. | "Mon workflow de dev, augmente" |
| **BOARD** | PM, PO, DPO | Kanban, roadmap, priorisation drag-and-drop, epics/stories. | "Mon backlog, orchestre" |
| **TEST** | QA, Lead Tech | Suites de tests, couverture, rapports de regression. | "Mes tests, capitalises" |

**Le point de design crucial :** ces modes ne sont PAS des "pages" separees. Ils coexistent dans le meme cockpit. Un Lead Dev active les modes CODE + BOARD + VISUEL simultanement. Le mode est un **filtre sur la meme realite partagee**, pas un silo.

**Comment la navigation s'adapte au mode :**

L'interface doit se comporter comme un cockpit adaptable :

1. **Navigation primaire = le role detecte ou choisi.** A la connexion, MnM connait le role de l'utilisateur et pre-configure l'interface avec les modes les plus pertinents. Le CEO arrive sur une interface ORAL + VISUEL. Le dev arrive sur CODE + BOARD.

2. **Navigation secondaire = le contexte de la tache.** Quand le dev ouvre une story, le mode BOARD est au premier plan. Quand il lance l'agent, le mode CODE prend le dessus. La navigation suit l'intention, pas une arborescence de menus.

3. **Transitions fluides entre modes.** Le CEO dicte une question en mode ORAL ("Ou en est le projet Alpha ?"), MnM genere une reponse qui inclut un dashboard en mode VISUEL. Le CEO ne "change pas de page" — la reponse EST multi-modale. Le CEO peut dire "Montre-moi les details" et le dashboard s'ouvre sans friction.

4. **Le CTO et le CEO voient la meme realite differemment.** Le CTO voit le projet Alpha comme un graphe de dependances techniques avec drift detection. Le CEO voit le meme projet comme un avancement par BU avec KPIs agreges. Memes donnees, representations radicalement differentes.

L'innovation UX ici est que MnM ne force personne a "apprendre" un nouveau paradigme. Le CEO n'a pas besoin de comprendre les boards Kanban. Le Dev n'a pas besoin de parler a un chatbot. Chacun interagit avec MnM selon son mode naturel (Verite #41).

---

### 1.3 Le Cockpit Temps Reel — La Tour de Controle Fascinante

**Pourquoi c'est revolutionnaire :** Aucun outil concurrent ne permet de **voir son agent coder en direct** avec une experience qui soit a la fois informative et engageante. L'observabilite des agents IA aujourd'hui se resume a des logs bruts (illisibles) ou a un spinner ("votre agent travaille..."). MnM transforme cette attente en experience de supervision active.

**Les composants du cockpit temps reel :**

**A. Le Split View Code + Chat**

L'ecran du developpeur est divise en deux panneaux synchronises :
- **Panneau gauche :** le code que l'agent ecrit/modifie en temps reel, avec diff visuel (lignes ajoutees en vert, supprimees en rouge, modifiees en jaune). L'utilisateur voit le curseur de l'agent se deplacer dans le code.
- **Panneau droit :** le chat temps reel avec l'agent. L'utilisateur peut intervenir a tout moment ("Utilise plutot le pattern X", "Arrete, tu te plantes"). L'agent s'adapte sans perdre le contexte.

Ce n'est pas du "fire-and-forget" (Verite #38 : "L'agent doit etre conduisible, pas juste lancable"). Le dev **pilote** son agent en direct, comme un instructeur de conduite.

**B. La Drift Detection avec Diff Visuel**

Quand MnM detecte que l'agent devie de son workflow defini :
- Un indicateur visuel s'allume (barre laterale qui passe du vert au orange, puis au rouge selon la severite)
- Un diff contextuel montre : "Etape attendue : Tests unitaires" vs "Ce que l'agent fait : Refactoring du module X"
- L'utilisateur a 3 options : Corriger (rediriger l'agent), Approuver (la deviation est legitime), Reporter (notifier le manager)

L'experience n'est pas une alarme stressante — c'est une **notification intelligente** qui respecte le flow de travail. Le design doit s'inspirer des systemes d'alerte des controleurs aeriens : informatif, hierarchise par gravite, actionnable en un geste.

**C. Le Workflow Pipeline Anime**

Chaque workflow actif est represente comme un pipeline visuel anime :
```
[Brief] ──> [Stories] ──> [Dev] ──> [Review] ──> [Tests] ──> [Merge]
   OK         OK        EN COURS     attente     attente     attente
                          ████░░
```

Les etapes completees sont vertes, l'etape en cours pulse avec une animation subtile, les etapes en attente sont grisees. Quand une etape se termine, la transition est animee — l'element glisse vers l'etape suivante.

**L'experience "tour de controle" doit etre FASCINANTE, pas juste fonctionnelle.** Le CTO qui ouvre son dashboard doit ressentir la meme satisfaction qu'un operateur de salle de controle qui voit tous ses systemes au vert. C'est un design emotionnel delibere : la confiance vient de la transparence visuelle, et la transparence doit etre belle.

**D. Le Resume LLM Temps Reel**

Au lieu de logs bruts illisibles, MnM emploie un LLM qui analyse les traces en temps reel et resume simplement ce que l'agent fait (Verite #39) :
- Au lieu de "file_read: /src/components/Button.tsx" : **"L'agent analyse le composant Button"**
- Au lieu de 15 lignes de tool calls : **"5 fichiers en contexte, etape 3/7 du workflow"**
- Au lieu de stack traces : **"L'agent a rencontre une erreur de typage et la corrige"**

C'est l'observabilite pour humains, pas pour machines.

---

### 1.4 L'Onboarding Cascade — Rendre la Complexite Hierarchique Simple

**Pourquoi c'est revolutionnaire :** Les outils B2B font du RBAC classique (admin, manager, user). Un admin configure tout, invite tout le monde, assigne les permissions. C'est plat, generique, et ne reflete pas la realite d'une organisation.

MnM fait de la **delegation structurelle en cascade** (Verite #35) : chaque niveau hierarchique configure le niveau inferieur. C'est une innovation d'experience, pas juste de permissions.

```
CEO     -> Definit la structure (BU, equipes, produits)
         -> Invite les CTO/directeurs
CTO     -> Definit les standards techniques, les workflows de dev
         -> Invite les Leads, PO
Lead    -> Raffine les workflows pour son equipe
         -> Invite les devs, QA
Dev     -> Configure ses propres agents et preferences
         -> Dans le cadre defini par le Lead
```

**Comment rendre cette complexite hierarchique SIMPLE visuellement :**

**A. L'Organigramme Interactif**

L'onboarding genere automatiquement un organigramme visuel interactif a partir de la description orale du CEO. C'est la premiere chose que le CEO voit apres avoir decrit sa structure.

L'organigramme n'est pas une image statique — c'est un composant interactif :
- **Drag-and-drop** pour reorganiser la hierarchie
- **Clic sur un noeud** pour voir/editer les details (role, permissions, curseur d'automatisation)
- **Indicateurs visuels** : noeuds verts (configures et actifs), bleus (invites mais pas encore connectes), gris (en attente de configuration)

Chaque noeud montre son "etat de sante" : onboarding complete ? Agents actifs ? Workflows definis ? Le CEO voit d'un coup d'oeil qui est operationnel et qui a besoin d'aide.

**B. L'Invitation Contextualisee**

Quand le CEO invite un CTO, l'email d'invitation n'est pas un lien generique. Il contient :
- Le perimetre pre-configure ("Vous etes CTO de la BU France, 3 equipes, 12 devs")
- Les premieres actions suggerees ("Definir le workflow de dev story, configurer le SSO")
- Le contexte deja defini par le niveau superieur ("Le CEO a configure : projets Alpha, Beta, Gamma")

L'invite ne part pas de zero — il reprend la ou le niveau superieur s'est arrete.

**C. L'Import Jira comme "Moment de Verite"**

L'import depuis Jira/Linear/ClickUp est le moment critique de l'adoption B2B (Verite #43). C'est la ou l'entreprise decide si elle bascule.

Le design de l'import doit etre :
1. **Transparence totale** — chaque element importe montre : element source (Jira) -> mapping propose (MnM) -> action de l'utilisateur (valider/modifier/ignorer)
2. **Progression visible** — barre de progression avec statistiques temps reel ("234/567 elements importes, 12 conflits a resoudre")
3. **Resolution de conflits intuitive** — quand le mapping n'est pas evident, l'interface propose 2-3 options avec explication ("Cette epic Jira correspond-elle a un Goal ou un Project dans MnM ?")

L'experience d'import doit donner confiance : "MnM comprend mon existant et le valorise, il ne le rejette pas."

---

### 1.5 Les Dashboards Ethiques — Transparence Sans Flicage

**Pourquoi c'est revolutionnaire :** C'est le defi de design le plus delicat de MnM. La Verite #20 est un deal-breaker : "Si les devs pensent que les dashboards servent au management pour les comparer/noter, l'adoption est morte."

MnM doit montrer la performance d'une equipe **sans jamais montrer la performance d'un individu au management**. C'est une contrainte de design ethique qui definit l'ADN du produit.

**Les principes de design des dashboards ethiques :**

**Principe 1 : Agregation obligatoire, pas optionnelle**

Le management voit :
- "L'equipe Backend a traite 47 stories ce sprint" — JAMAIS "Pierre a traite 12 stories et Paul en a traite 8"
- "Le taux de drift moyen est de 3.2%" — JAMAIS "L'agent de Marie devie 2x plus que les autres"
- "87% des workflows sont en mode Assiste" — JAMAIS "Jean est encore en mode Manuel"

Ce n'est pas un parametrage desactivable — c'est architecturalement impossible de descendre au niveau individuel dans les dashboards management. La base de donnees ne le permet pas au niveau de la couche de presentation management. Les donnees individuelles existent (pour l'audit), mais elles ne sont accessibles qu'au proprietaire lui-meme et, en cas d'incident specifique, a l'auditeur designe.

**Principe 2 : Le dashboard personnel appartient a l'individu**

Chaque utilisateur a un dashboard personnel riche :
- Ses metriques personnelles (nombre de tasks, temps, curseur d'automatisation)
- L'evolution de son propre curseur au fil du temps
- Les suggestions d'amelioration de MnM ("Vous pourriez passer la generation de tests en mode auto")

Ce dashboard n'est visible que par l'utilisateur lui-meme. Pas par son manager. Pas par le CEO. Le principe est simple : "Tes donnees t'appartiennent. Tu decides quoi partager."

**Principe 3 : Les alertes sont factuelles, pas attributives**

Quand une alerte remonte au management :
- "Drift detecte dans le workflow de dev story du projet Alpha" — OUI
- "L'agent de Pierre a devie du workflow" — NON
- "3 stories sont bloquees en review depuis >48h" — OUI
- "Pierre bloque les reviews depuis 48h" — NON

L'alerte pointe vers le **processus**, pas vers la **personne**. C'est une subtilite de wording crucial qui demande une attention constante dans le design de chaque ecran.

**Principe 4 : L'historique d'audit est un dernier recours, pas un outil de monitoring**

L'audit trail complet existe (Verite #40 : argument B2B enterprise). Mais il est sous cle :
- Acces restreint au role "auditeur"
- Log d'acces a l'audit lui-meme (qui a regarde quoi)
- Justification obligatoire pour consulter un audit individuel ("incident de production", "compliance review")

L'audit n'est pas un espion — c'est une boite noire d'avion. On ne l'ouvre qu'en cas de besoin.

---

## 2. Differenciation Visuelle vs Concurrents

### 2.1 MnM vs Jira — L'Intelligence Active contre le Tracking Passif

| Dimension | Jira | MnM |
|-----------|------|-----|
| **Philosophie** | Base de donnees de tickets | Tour de controle IA |
| **Densite visuelle** | Surcharge informationnelle. Filtres, colonnes, champs custom empiles | Cockpit epure. L'information pertinente au role emerge |
| **Agents IA** | "Agents in Jira" (fev. 2026) : assigner un ticket a un agent, c'est tout | Agents integres avec workflows deterministes, drift detection, observabilite |
| **Multi-role** | Tout le monde voit la meme interface (board/backlog/sprints) | Chaque role a son mode (ORAL/VISUEL/CODE/BOARD/TEST) |
| **Navigation** | Menu lateral > Projet > Board > Sprint > Issue > Detail | Cockpit adaptatif : le contexte determine l'interface |
| **Automatisation** | Rules si/alors basiques | Curseur d'automatisation 3 positions x 4 niveaux |
| **Esthetique** | Fonctionnelle mais datee. Dense, peu inspirante | Tour de controle moderne. Informative ET belle |

**L'avantage MnM en une phrase :** Jira enregistre ce que les humains font. MnM orchestre ce que les agents font, avec les humains en supervision.

La differenciation visuelle est immediate : la ou Jira presente un backlog plat de tickets que l'humain doit traiter un par un, MnM presente un **cockpit vivant** ou les agents travaillent en temps reel, les workflows avancent visuellement, et l'humain intervient quand necessaire. C'est la difference entre un tableur et une salle de controle.

### 2.2 MnM vs Cursor — Du Developpeur Individuel a l'Organisation Entiere

| Dimension | Cursor | MnM |
|-----------|--------|-----|
| **Cible** | Developpeur individuel | 9 personas (CEO a QA) |
| **Portee** | Un fichier, un projet | Toute l'organisation |
| **Collaboration** | Aucune (chaque dev dans son IDE) | Multi-agent, inter-role, temps reel |
| **Observabilite** | Terminal local | Dashboard centralise avec resume LLM |
| **Workflows** | Implicites (le dev decide) | Deterministes, imposes par la plateforme |
| **Non-dev** | Inaccessible | Mode ORAL, mode BOARD, mode VISUEL |
| **Audit** | Aucun | Trace complete, centralisee, replayable |
| **Prix** | $20-40/mois/dev | ~50EUR/utilisateur/mois (tous roles inclus) |

**L'avantage MnM en une phrase :** Cursor augmente un developpeur. MnM orchestre une organisation.

Visuellement, la difference est frappante : Cursor est un editeur de texte ameliore (sombre, technique, terminal-centric). MnM est un cockpit multi-modal (lumineux ou sombre au choix, adaptatif au role, visuellement riche). Le CEO de l'entreprise ne pourra jamais utiliser Cursor. Il pourra utiliser MnM des le premier jour, en parlant naturellement.

### 2.3 MnM vs Linear — L'Ambition d'Orchestration contre l'Elegance du Tracking

| Dimension | Linear | MnM |
|-----------|--------|-----|
| **Vitesse** | Ultra-rapide (reference en performance UI) | Doit etre aussi rapide |
| **Design** | Minimaliste, elegant, inspire | Doit etre au minimum au meme niveau |
| **IA** | Triage auto, sous-issues generees | Orchestration d'agents complete |
| **Roles** | Dev-centric (dev + PM) | 9 personas |
| **Ambition** | Meilleur tracker d'issues | Meilleur orchestrateur d'agents IA enterprise |
| **Agents** | Pas d'agents d'execution | Agents deterministes avec observabilite |

**L'avantage MnM en une phrase :** Linear fait le meilleur tracking possible. MnM rend le tracking inutile parce que les agents executent et reportent automatiquement.

**Le defi design critique vis-a-vis de Linear :** Linear a pose le standard de qualite UI/UX pour les outils B2B tech. MnM ne peut pas se permettre d'etre visuellement ou ergonomiquement inferieur. Chaque interaction doit etre aussi fluide, chaque animation aussi soignee, chaque micro-interaction aussi satisfaisante. La difference doit se faire sur la profondeur fonctionnelle (orchestration, multi-role, agents), pas au detriment de l'elegance.

Les points specifiques a egaliser ou depasser :
- **Raccourcis clavier :** Linear est pilotable entierement au clavier. MnM doit l'etre aussi.
- **Transitions animees :** Fluides, rapides, significatives. Pas de page reload.
- **Dark/Light mode :** Les deux, avec le meme soin.
- **Performance percue :** Reponse immediate (<100ms percus) sur toute interaction.

### 2.4 MnM vs CrewAI — Le Produit Fini contre le Building Block

| Dimension | CrewAI | MnM |
|-----------|--------|-----|
| **Nature** | Framework Python open source | Plateforme B2B avec UI complete |
| **UI** | Aucune | 5 modes (ORAL/VISUEL/CODE/BOARD/TEST) |
| **Utilisateur** | Developpeurs Python | CEO, CTO, PM, PO, Dev, QA, Designer, Lead Tech, DSI |
| **Onboarding** | Lire la doc, ecrire du code | Conversation orale ou config visuelle |
| **Determinisme** | Workflows interpretes par l'IA | Workflows imposes algorithmiquement |
| **Observabilite** | Logs a integrer soi-meme | Resume LLM temps reel, dashboard, audit |
| **Enterprise** | Pas de RBAC, pas de SSO, pas d'audit | RBAC complet, SSO SAML/OIDC, audit trace |
| **Drift detection** | Non | Oui, avec diff visuel et alertes |

**L'avantage MnM en une phrase :** CrewAI est le moteur. MnM est la voiture complete — avec volant, tableau de bord, GPS, et ceintures de securite.

C'est la differenciation la plus visuelle de toutes : CrewAI n'a **aucune interface**. MnM est TOUTE l'interface. Pour un decideur enterprise qui evalue les deux, la demonstration est limpide : CrewAI necessite des developpeurs pour tout, MnM permet au CEO de piloter ses agents en parlant.

---

## 3. UX Patterns Uniques a MnM

Cinq patterns d'interaction emergent des 57 verites fondamentales et des 5 noyaux de valeur. Ils sont propres a MnM et n'existent dans aucun outil concurrent.

### 3.1 Pattern "Observe & Intervene" — Voir l'agent travailler, intervenir quand necessaire

**Origine :** Verite #38 ("L'agent doit etre conduisible, pas juste lancable") + Verite #32 ("Le role humain se transforme de producteur a juge")

**Description :**
L'utilisateur ne lance pas un agent et attend le resultat. Il **observe en temps reel** ce que l'agent fait, et **intervient quand il le juge necessaire**. C'est le pattern fondamental de la supervision humaine dans MnM.

**Comment ca se materialise dans l'UI :**
- Le split view code+chat pour le dev : il voit le code ecrit en direct ET peut dialoguer
- Le workflow pipeline anime pour le CTO : il voit les etapes progresser ET peut stopper/rediriger
- La drift detection avec options d'intervention : Corriger / Approuver / Reporter
- Le resume LLM en temps reel : comprendre ce que fait l'agent sans lire les logs

**Metaphore UX :** C'est le copilote dans un avion. L'agent pilote, l'humain surveille les instruments et prend les commandes si necessaire. Le curseur d'automatisation determine a quel point le copilote intervient : en mode Manuel, il pilote lui-meme ; en mode Assiste, il corrige le cap ; en mode Auto, il ne reagit qu'aux alarmes.

**Regles de design :**
- L'observation ne doit jamais bloquer l'agent. L'utilisateur qui regarde ne ralentit pas l'execution.
- L'intervention doit etre immediate. Quand l'humain dit "arrete", l'agent arrete dans la seconde.
- Le retour en arriere doit etre possible. Si l'humain intervient et que c'etait une erreur, l'agent peut revenir a son etat precedent.
- L'interface doit distinguer visuellement les zones "humain" (editables) et les zones "agent" (en cours de modification).

### 3.2 Pattern "Cascade Down" — Configuration Hierarchique CEO -> CTO -> Dev

**Origine :** Verite #35 ("L'onboarding est une cascade hierarchique") + Verite #16 ("Il y a 3 niveaux de workflow, pas 1")

**Description :**
Chaque niveau hierarchique definit le cadre du niveau inferieur. Le CEO ne configure pas le workflow du dev — il definit la structure que le CTO raffine, que le Lead raffine, etc. L'information "cascade" vers le bas, et chaque etage a un degre d'autonomie dans son perimetre.

**Comment ca se materialise dans l'UI :**
- L'organigramme interactif genere a l'onboarding, avec des noeuds emboites
- L'invitation contextualisee qui transmet le cadre pre-configure
- Les limites visuelles dans l'interface : le dev voit son perimetre (son equipe, ses projets) avec une indication de l'existence d'un cadre superieur ("Workflow de dev story defini par le CTO")
- Le curseur d'automatisation avec plafond hierarchique visible (zone grisee)

**Metaphore UX :** C'est la delegation dans une armee. Le general definit l'objectif strategique, le colonel organise ses bataillons, le capitaine mene sa compagnie. Chacun a son autonomie dans le cadre defini par le niveau superieur.

**Regles de design :**
- Chaque modification a un niveau superieur propage visuellement vers le bas. Si le CTO change un workflow, les equipes concernees voient la notification avec le diff.
- La provenance est toujours visible. Le dev sait que "ce workflow vient du CTO" et peut voir qui l'a defini et pourquoi.
- La remontee d'information est aussi fluide que la descente. Si un dev identifie un probleme dans un workflow, il peut proposer une modification qui remonte au CTO pour validation.
- Les conflits entre niveaux sont detectes et surfacent. Si deux directeurs definissent des workflows contradictoires pour des equipes qui interagissent, MnM le signale.

### 3.3 Pattern "Trust Gradient" — Le Curseur Progresse Naturellement avec la Confiance

**Origine :** Verite #30 ("L'adoption de l'automatisation est un curseur individuel, pas un switch global") + les 3 phases d'adoption (Manuel -> Assiste -> Auto)

**Description :**
L'automatisation n'est pas un choix binaire. C'est un gradient de confiance qui evolue naturellement avec l'usage. MnM accompagne cette evolution en proposant des progressions basees sur les donnees reelles d'utilisation.

**Comment ca se materialise dans l'UI :**
- Le curseur d'automatisation avec son indicateur de recommandation
- Des suggestions non-intrusives : "Vous validez 95% des tests generes. Passer en mode auto ?"
- Un historique visuel de la progression : graphe montrant l'evolution du curseur au fil du temps
- Des "milestones" de confiance : "Premier mois en mode assiste, 200 actions validees, 3 interventions seulement"

**Metaphore UX :** C'est le regime de confiance dans la relation parent/adolescent. Au debut, supervision rapprochee. Progressivement, on lache la bride. Pas a pas, pas d'un coup. Et on peut resserrer si necessaire.

**Regles de design :**
- MnM ne force jamais la progression. La suggestion est toujours proposee, jamais imposee.
- La regression est sans friction. Si un utilisateur veut revenir en mode Manuel apres une mauvaise experience en Auto, c'est un clic, pas un parcours de parametrage.
- Les statistiques qui fondent la recommandation sont transparentes. L'utilisateur voit exactement POURQUOI MnM lui propose de monter en autonomie.
- Le management ne voit que la distribution agregee des curseurs, jamais la position d'un individu specifique (Principe Ethique).

### 3.4 Pattern "Aggregate, Never Individual" — Metriques Agregees Sans Drill-Down Individuel

**Origine :** Verite #20 ("La transparence manageriale est un deal-breaker si mal geree")

**Description :**
C'est le pattern le plus contre-intuitif pour les outils B2B analytics. Habituellement, la valeur d'un dashboard est de pouvoir "drill down" jusqu'au detail. Chez MnM, le drill-down management s'arrete au niveau equipe. **Architecturalement**, pas par parametrage.

**Comment ca se materialise dans l'UI :**
- Les dashboards management montrent des bulles d'equipe, pas des lignes individuelles
- Les graphes de performance sont toujours "Equipe Backend" pas "Pierre, Marie, Jean"
- Les alertes de drift pointent vers des workflows et des projets, pas vers des personnes
- L'interface de reporting genere des syntheses par equipe, pas des evaluations individuelles

**Metaphore UX :** C'est la notation collective dans une classe inversee. Le professeur evalue la performance du groupe de travail, pas chaque eleve individuellement. Cela encourage la collaboration plutot que la competition.

**Regles de design :**
- Pas de "people view" dans les dashboards management. Jamais.
- Les metriques individuelles sont dans le dashboard personnel du collaborateur, visible uniquement par lui.
- Si un manager a besoin d'informations individuelles (incident, audit), il passe par un processus formel d'audit avec justification logguee.
- Les rapports generes par MnM pour le management n'incluent jamais de noms. "3 stories bloquees en review" pas "Pierre, Marie et Jean ont des stories en attente."

### 3.5 Pattern "Dual-Speed Display" — Zones Humain vs Zones Machine

**Origine :** Verite #30 (curseur d'automatisation) + WhatIf #4 (dual-speed workflow) + la distinction fondamentale vitesse humaine / vitesse machine

**Description :**
L'interface de MnM coexiste en deux temporalites : les zones "humain" (asynchrones, reflexives) et les zones "machine" (temps reel, animees). Le design visuel doit communiquer cette dualite pour que l'utilisateur sache instinctivement ou il doit penser et ou il doit observer.

**Comment ca se materialise dans l'UI :**

**Zones "humain" (asynchrone, reflechi) :**
- Fond clair ou neutre
- Typographie lisible, espace genereux
- Pas d'animation distractrice
- Interactions deliberees : boutons, formulaires, editeurs de texte
- Tempo : l'utilisateur prend le temps qu'il veut
- Exemples : redaction d'un brief, definition d'un workflow, brainstorm avec agent, review de code

**Zones "machine" (temps reel, anime) :**
- Fond sombre ou contraste (like a control room)
- Elements animes : barres de progression, indicateurs de statut, flux de donnees
- Micro-animations significatives (pas decoratives)
- Tempo : l'information se met a jour en continu, l'utilisateur observe
- Exemples : pipeline workflow anime, split view code en direct, dashboard de drift, logs resumes

**Metaphore UX :** C'est la distinction entre le bureau du commandant (calme, organise, delibere) et la salle de controle (ecrans, flux, temps reel). Les deux existent dans le meme batiment, mais l'ambiance est differente. On sait instinctivement dans quelle zone on est.

**Regles de design :**
- La transition entre zones est fluide et perceptible. L'utilisateur sent qu'il passe d'un mode "reflexion" a un mode "observation" sans rupture brutale.
- Les zones machine ne distraient pas quand l'utilisateur est dans une zone humaine. Les animations sont discretes dans la peripherie, pas au centre de l'attention.
- L'utilisateur peut "muter" une zone machine (masquer les animations, voir un snapshot statique) sans perdre l'information.
- Les deux zones partagent le meme langage visuel (couleurs, icones, typographie) pour maintenir la coherence de l'experience globale.

---

## Synthese : L'ADN UX de MnM

MnM n'est pas un outil de gestion de projet ameliore, ni un IDE IA multi-role, ni un dashboard de monitoring. C'est un **cockpit d'orchestration IA enterprise** qui invente ses propres paradigmes d'interaction.

Les 5 innovations UX (curseur d'automatisation, dual-mode oral/visuel, cockpit temps reel, onboarding cascade, dashboards ethiques) et les 5 patterns uniques (Observe & Intervene, Cascade Down, Trust Gradient, Aggregate Never Individual, Dual-Speed Display) forment un tout coherent. Ils sont lies par un fil directeur : **l'humain reste au centre du systeme, mais son role evolue de producteur a superviseur, de faiseur a decideur**.

La promesse UX de MnM en une phrase :

> **Chaque role interagit avec MnM selon son mode naturel, observe les agents travailler en temps reel, et decide de son propre rythme de transformation — dans un cadre ethique ou la transparence sert la confiance, jamais la surveillance.**

C'est cette promesse qui fait de MnM une categorie a part dans le paysage des outils enterprise. Pas un meilleur Jira. Pas un meilleur Cursor. Pas un meilleur CrewAI. Un produit fondamentalement nouveau : la Tour de Controle IA Enterprise.

---

# Section 7 — Design Tokens, UX Patterns & Accessibility

> **Par Paige la Tech Writer** | Date : 2026-03-14 | Version : 1.0
> Source : PRD B2B v1.0, UX Journeys & Requirements v1.0, index.css existant (Tailwind CSS v4 + shadcn/ui)

---

## Table des matieres

1. [Design Tokens Specification](#1-design-tokens-specification)
2. [Conventions de Nommage](#2-conventions-de-nommage)
3. [UX Patterns Documentation](#3-ux-patterns-documentation)
4. [Responsive & Accessibility (WCAG 2.1 AA)](#4-responsive--accessibility-wcag-21-aa)

---

## 1. Design Tokens Specification

Cette section definit l'ensemble des tokens de design pour MnM B2B. Les tokens sont implementes via CSS custom properties (variables) et consommes par Tailwind CSS v4 via la directive `@theme inline`. L'architecture actuelle utilise le format oklch pour les couleurs, permettant une manipulation perceptuellement uniforme.

### 1.1 Couleurs — Systeme de Couleurs

#### 1.1.1 Couleurs de Surface (Core)

Les tokens de surface definissent les fonds, textes et bordures de base. Ils existent en mode clair et sombre.

```css
/* === MODE CLAIR (defaut) === */
:root {
  color-scheme: light;

  /* Surfaces principales */
  --background: oklch(1 0 0);                /* #ffffff — fond de page */
  --foreground: oklch(0.145 0 0);            /* #1a1a1a — texte principal */

  /* Cartes */
  --card: oklch(1 0 0);                      /* #ffffff — fond de carte */
  --card-foreground: oklch(0.145 0 0);       /* texte sur carte */

  /* Popovers / Dropdowns */
  --popover: oklch(1 0 0);                   /* fond popover */
  --popover-foreground: oklch(0.145 0 0);    /* texte popover */

  /* Zones secondaires / mutees */
  --muted: oklch(0.97 0 0);                  /* #f5f5f5 — fond attenue */
  --muted-foreground: oklch(0.556 0 0);      /* #737373 — texte secondaire */

  /* Accents */
  --accent: oklch(0.97 0 0);                 /* fond accent */
  --accent-foreground: oklch(0.205 0 0);     /* texte accent */

  /* Bordures et inputs */
  --border: oklch(0.922 0 0);               /* #e5e5e5 — bordures */
  --input: oklch(0.922 0 0);                /* bordure inputs */
  --ring: oklch(0.708 0 0);                 /* focus ring */
}

/* === MODE SOMBRE === */
.dark {
  color-scheme: dark;

  --background: oklch(0.145 0 0);            /* #1a1a1a */
  --foreground: oklch(0.985 0 0);            /* #fafafa */

  --card: oklch(0.205 0 0);                  /* #2a2a2a */
  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);                /* #3a3a3a */
  --muted-foreground: oklch(0.708 0 0);     /* #999999 */

  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}
```

**Utilisation Tailwind** :
```html
<div class="bg-background text-foreground">Page</div>
<div class="bg-card text-card-foreground border border-border">Carte</div>
<span class="text-muted-foreground">Texte secondaire</span>
```

#### 1.1.2 Couleurs Primaires et Secondaires

```css
:root {
  /* Primaire — Bleu MnM (brand) */
  --primary: oklch(0.205 0 0);              /* Noir profond en v1 — a evoluer vers Bleu MnM */
  --primary-foreground: oklch(0.985 0 0);   /* Blanc sur primaire */

  /* Secondaire — Gris ardoise */
  --secondary: oklch(0.97 0 0);             /* Gris tres clair */
  --secondary-foreground: oklch(0.205 0 0); /* Texte sombre sur secondaire */

  /* Destructif — Actions dangereuses */
  --destructive: oklch(0.577 0.245 27.325); /* Rouge — suppression, erreurs */
  --destructive-foreground: oklch(0.577 0.245 27.325);
}

.dark {
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.637 0.237 25.331);
  --destructive-foreground: oklch(0.985 0 0);
}
```

#### 1.1.3 Couleurs par Role (B2B RBAC)

Les badges de role utilisent des couleurs distinctes pour differencier visuellement les quatre roles RBAC de MnM. **Rappel WCAG** : ne jamais utiliser la couleur seule — toujours accompagner d'un texte visible.

```css
:root {
  /* Roles RBAC */
  --role-admin: oklch(0.637 0.237 25);      /* Rouge — Admin */
  --role-manager: oklch(0.488 0.243 264);   /* Bleu — Manager */
  --role-contributor: oklch(0.6 0.178 155);  /* Vert — Contributor */
  --role-viewer: oklch(0.556 0 0);           /* Gris — Viewer (lecture seule) */

  /* Agent IA — visuellement distinct des actions humaines */
  --agent: oklch(0.627 0.265 303.9);        /* Violet — Actions IA */
  --agent-foreground: oklch(0.985 0 0);
}
```

**Utilisation en composant** :
```tsx
// RoleBadge.tsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
  style={{ backgroundColor: `oklch(from var(--role-admin) l c h / 0.15)`, color: 'var(--role-admin)' }}>
  <ShieldIcon className="w-3 h-3" />
  Admin
</span>
```

#### 1.1.4 Couleurs Semantiques

```css
:root {
  /* Feedback semantique */
  --success: oklch(0.6 0.178 155);           /* Vert — operation reussie */
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.75 0.183 65);           /* Orange — attention requise */
  --warning-foreground: oklch(0.205 0 0);
  --error: oklch(0.577 0.245 27.325);        /* Rouge — erreur (= destructive) */
  --error-foreground: oklch(0.985 0 0);
  --info: oklch(0.488 0.243 264);            /* Bleu — information */
  --info-foreground: oklch(0.985 0 0);
}
```

#### 1.1.5 Couleurs de Graphiques

Cinq couleurs pre-definies pour les graphiques du dashboard, avec des hues bien reparties pour la lisibilite daltonien.

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);   /* Orange chaud */
  --chart-2: oklch(0.6 0.118 184.704);    /* Teal */
  --chart-3: oklch(0.398 0.07 227.392);   /* Bleu sombre */
  --chart-4: oklch(0.828 0.189 84.429);   /* Jaune dore */
  --chart-5: oklch(0.769 0.188 70.08);    /* Ambre */
}

.dark {
  --chart-1: oklch(0.488 0.243 264.376);  /* Bleu vif */
  --chart-2: oklch(0.696 0.17 162.48);    /* Vert menthe */
  --chart-3: oklch(0.769 0.188 70.08);    /* Ambre */
  --chart-4: oklch(0.627 0.265 303.9);    /* Violet */
  --chart-5: oklch(0.645 0.246 16.439);   /* Rose corail */
}
```

#### 1.1.6 Couleurs Sidebar

La sidebar possede son propre jeu de tokens pour permettre un traitement visuel distinct (fond legerement different, highlights specifiques).

```css
:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --sidebar: oklch(0.145 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}
```

### 1.2 Typographie

#### 1.2.1 Familles de polices

| Token | Police | Usage |
|-------|--------|-------|
| `--font-sans` | `Inter, system-ui, sans-serif` | Corps de texte, titres, UI |
| `--font-mono` | `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Code, logs, identifiants techniques |

```css
@theme inline {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

#### 1.2.2 Echelle typographique

| Token | Taille | Utilisation |
|-------|--------|-------------|
| `text-xs` | 12px (0.75rem) | Labels, badges, metadata |
| `text-sm` | 14px (0.875rem) | Corps secondaire, tableaux, sidebar |
| `text-base` | 16px (1rem) | Corps principal |
| `text-lg` | 18px (1.125rem) | Sous-titres de section |
| `text-xl` | 20px (1.25rem) | Titres de page secondaires |
| `text-2xl` | 24px (1.5rem) | Titres de page |
| `text-3xl` | 30px (1.875rem) | Titres principaux dashboard |
| `text-4xl` | 36px (2.25rem) | Titre d'accueil / onboarding |

#### 1.2.3 Graisses

| Token | Poids | Usage |
|-------|-------|-------|
| `font-normal` | 400 | Corps de texte |
| `font-medium` | 500 | Labels, navigation active |
| `font-semibold` | 600 | Titres de carte, noms d'entite |
| `font-bold` | 700 | Titres de page, metriques cles |

#### 1.2.4 Hauteurs de ligne

| Token | Ratio | Usage |
|-------|-------|-------|
| `leading-tight` | 1.25 | Titres, metriques compactes |
| `leading-normal` | 1.5 | Corps de texte (defaut) |
| `leading-relaxed` | 1.75 | Texte de description longue, onboarding |

### 1.3 Espacement

Systeme base sur une unite de 4px. Tous les espacements sont des multiples de cette base.

| Token | Valeur | Pixels | Usage typique |
|-------|--------|--------|---------------|
| `spacing-0` | 0 | 0px | Pas d'espacement |
| `spacing-1` | 0.25rem | 4px | Ecart minimal (icone-texte inline) |
| `spacing-2` | 0.5rem | 8px | Padding interne compact |
| `spacing-3` | 0.75rem | 12px | Gap entre elements lies |
| `spacing-4` | 1rem | 16px | Padding standard de carte |
| `spacing-5` | 1.25rem | 20px | Gap entre sections liees |
| `spacing-6` | 1.5rem | 24px | Padding de section |
| `spacing-8` | 2rem | 32px | Separation entre blocs |
| `spacing-10` | 2.5rem | 40px | Grande separation |
| `spacing-12` | 3rem | 48px | Marge de page |
| `spacing-16` | 4rem | 64px | Marge verticale majeure |

**Principes d'espacement** :
- **Padding de carte** : `p-4` (16px) standard, `p-3` (12px) compact
- **Gap entre elements** : `gap-2` (8px) pour les listes denses, `gap-4` (16px) pour les grilles
- **Marge de page** : `px-6` (24px) desktop, `px-4` (16px) mobile
- **Separation de sections** : `space-y-8` (32px) entre sections majeures

### 1.4 Border Radius

Le projet utilise actuellement des rayons a zero pour une esthetique angulaire. Les tokens definissent neanmoins l'echelle complete pour l'evolution du design system.

```css
@theme inline {
  --radius-sm: 0.375rem;  /* 6px — petits elements : badges, chips */
  --radius-md: 0.5rem;    /* 8px — boutons, inputs, cartes */
  --radius-lg: 0px;       /* 0px — actuellement desactive */
  --radius-xl: 0px;       /* 0px — actuellement desactive */
}

:root {
  --radius: 0;             /* Rayon global de base */
}
```

| Token | Valeur | Usage |
|-------|--------|-------|
| `rounded-none` | 0px | Valeur actuelle par defaut du design |
| `rounded-sm` | 6px | Badges, chips, mentions |
| `rounded-md` | 8px | Boutons, inputs, cartes |
| `rounded-lg` | 12px | Modales, panels (futur) |
| `rounded-xl` | 16px | Sections hero, onboarding (futur) |
| `rounded-full` | 9999px | Avatars, indicateurs de statut |

### 1.5 Ombres (Elevation)

Trois niveaux d'elevation pour la hierarchie visuelle des elements.

```css
/* Tailwind defaults utilises */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  /* Usage : cartes au repos, boutons subtils */

--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  /* Usage : cartes survolees, dropdowns ouverts */

--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  /* Usage : modales, command palette, panels flottants */
```

| Niveau | Token | Contexte |
|--------|-------|----------|
| Bas | `shadow-sm` | Carte au repos, separateurs subtils |
| Moyen | `shadow-md` | Carte survolee, dropdown, popover |
| Haut | `shadow-lg` | Modale, command palette (Ctrl+K), toast |

### 1.6 Z-index

Echelle structuree pour eviter les conflits d'empilement.

| Token | Valeur | Element |
|-------|--------|---------|
| `z-base` | 0 | Contenu de la page |
| `z-dropdown` | 50 | Dropdowns, popovers, menus contextuels |
| `z-sticky` | 100 | Header, breadcrumbs, barre de filtre sticky |
| `z-modal` | 200 | Modales, dialogs, command palette |
| `z-toast` | 300 | Toast notifications, snackbars |
| `z-tooltip` | 400 | Tooltips au survol |

**Note** : L'editeur MDXEditor utilise `z-index: 80-81` pour ses popups internes (cf. `index.css` lignes 480-500), place entre dropdown et sticky.

```css
/* Implementation Tailwind via @theme ou classes utilitaires */
.z-dropdown { z-index: 50; }
.z-sticky   { z-index: 100; }
.z-modal    { z-index: 200; }
.z-toast    { z-index: 300; }
.z-tooltip  { z-index: 400; }
```

### 1.7 Transitions et Animations

#### 1.7.1 Durees

| Token | Duree | Easing | Usage |
|-------|-------|--------|-------|
| `transition-fast` | 150ms | `ease-in-out` | Survol boutons, changement de couleur |
| `transition-normal` | 200ms | `ease-in-out` | Ouverture dropdown, expansion sidebar |
| `transition-slow` | 300ms | `ease-in-out` | Ouverture modale, transitions de page |

#### 1.7.2 Animations specifiques existantes

```css
/* Entree de ligne d'activite dans le dashboard */
@keyframes dashboard-activity-enter {
  0%   { opacity: 0; transform: translateY(-14px) scale(0.985); filter: blur(4px); }
  62%  { opacity: 1; transform: translateY(2px) scale(1.002); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

/* Highlight temporaire apres insertion */
@keyframes dashboard-activity-highlight {
  0%   { box-shadow: inset 2px 0 0 var(--primary); background-color: color-mix(in oklab, var(--accent) 55%, transparent); }
  100% { box-shadow: inset 0 0 0 transparent; background-color: transparent; }
}

/* Combinaison — classe a appliquer sur la ligne */
.activity-row-enter {
  animation:
    dashboard-activity-enter 520ms cubic-bezier(0.16, 1, 0.3, 1),
    dashboard-activity-highlight 920ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

#### 1.7.3 Respect de `prefers-reduced-motion`

**Obligatoire** : desactiver toutes les animations pour les utilisateurs ayant active la preference de reduction de mouvement.

```css
@media (prefers-reduced-motion: reduce) {
  .activity-row-enter {
    animation: none;
  }

  /* Appliquer globalement pour toutes les animations futures */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 2. Conventions de Nommage

### 2.1 Composants React

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Composants | PascalCase | `WorkflowPipeline`, `DriftAlert`, `AutomationCursor`, `RoleBadge` |
| Pages | PascalCase + suffixe Page | `DashboardPage`, `WorkflowDetailPage`, `SettingsPage` |
| Layouts | PascalCase + suffixe Layout | `AppLayout`, `AuthLayout`, `OnboardingLayout` |

### 2.2 Fichiers

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Composants | kebab-case.tsx | `workflow-pipeline.tsx`, `drift-alert.tsx`, `automation-cursor.tsx` |
| API / hooks | kebab-case.ts | `use-workflow.ts`, `use-drift-alerts.ts` |
| Types | kebab-case.ts | `workflow-types.ts`, `drift-types.ts` |
| Tests | kebab-case.test.ts(x) | `workflow-pipeline.test.tsx` |

### 2.3 CSS / Styles

| Categorie | Convention | Notes |
|-----------|-----------|-------|
| Classes Tailwind | Utility-first | Priorite aux classes utilitaires Tailwind |
| Tokens CSS | kebab-case avec prefixe semantique | `--role-admin`, `--agent`, `--chart-1` |
| Classes custom | kebab-case, prefix projet | `paperclip-mdxeditor`, `activity-row-enter` |
| **Regle** | Eviter les classes custom | Sauf pour les tokens, animations complexes et integrations tierces |

### 2.4 Variables et Types TypeScript

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Variables | camelCase | `isLoading`, `hasPermission`, `driftSeverity`, `agentStatus` |
| Constantes | UPPER_SNAKE_CASE | `MAX_AGENTS`, `ROLE_ADMIN`, `WEBSOCKET_RECONNECT_DELAY` |
| Types / Interfaces | PascalCase | `WorkflowStep`, `DriftAlert`, `AgentConfig` |
| Props | PascalCase + Props | `WorkflowPipelineProps`, `DriftAlertProps`, `AutomationCursorProps` |
| State types | PascalCase + State | `DriftAlertState`, `WorkflowEditorState` |
| Enums | PascalCase | `AgentStatus`, `DriftSeverity`, `AutomationLevel` |
| Hooks | camelCase prefixe use | `useWorkflow`, `useDriftAlerts`, `usePermissions` |

---

## 3. UX Patterns Documentation

### 3.1 Navigation

#### 3.1.1 Sidebar collapsible

La sidebar est le point d'entree principal de la navigation. Elle affiche les sections par contexte de l'utilisateur (projets, agents, workflows, parametres).

**Comportement** :
- Desktop (>= 1024px) : sidebar visible, collapsible via bouton chevron
- Tablette (768px-1023px) : masquee par defaut, accessible via hamburger
- Mode collapse : seules les icones sont visibles, labels masques
- Tooltip au survol en mode collapse pour indiquer le label
- Le Company Rail (multi-tenant) est affiche a gauche de la sidebar principale

**Implementation** :
```tsx
// Structure attendue
<aside role="navigation" aria-label="Navigation principale"
  className="flex flex-col w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border
             transition-all transition-normal data-[collapsed]:w-14">
  <CompanyRail />       {/* Selecteur de tenant */}
  <SidebarProjects />   {/* Liste des projets */}
  <SidebarAgents />     {/* Agents actifs */}
  <SidebarSection />    {/* Sections additionnelles */}
</aside>
```

**Raccourci clavier** : `Ctrl+B` pour toggle collapse.

#### 3.1.2 Breadcrumbs

Fil d'Ariane contextuel affiché sous le header pour orienter l'utilisateur dans la hierarchie.

**Format** : `Company > Projet > Section > Element`

**Regles** :
- Maximum 4 niveaux affiches
- Le dernier element n'est pas cliquable (page courante)
- Chaque segment est un lien vers le niveau parent
- Sur mobile, seuls les 2 derniers niveaux sont visibles avec un bouton "..." pour les precedents

#### 3.1.3 Command Palette (Ctrl+K)

Palette de commandes globale accessible depuis n'importe quelle page.

**Fonctionnalites** :
- Recherche fuzzy sur projets, issues, agents, workflows, parametres
- Actions rapides : "Creer un agent", "Lancer workflow", "Ouvrir parametres"
- Navigation rapide : "Aller au projet X", "Ouvrir le dashboard"
- Filtrage par prefixe : `>` pour les commandes, `#` pour les projets, `@` pour les agents

**Implementation** :
```tsx
<dialog role="dialog" aria-label="Palette de commandes"
  className="z-modal shadow-lg bg-popover text-popover-foreground rounded-md w-[640px] max-h-[400px]">
  <input type="text" placeholder="Rechercher une commande, un projet, un agent..."
    aria-label="Recherche dans la palette de commandes"
    className="w-full px-4 py-3 text-lg bg-transparent border-b border-border" />
  <ul role="listbox" className="overflow-y-auto max-h-[320px]">
    {/* Resultats groupes par categorie */}
  </ul>
</dialog>
```

**Raccourci** : `Ctrl+K` (global), `Escape` pour fermer.

### 3.2 Feedback Utilisateur

#### 3.2.1 Toast Notifications

Les toasts sont des notifications temporaires non-bloquantes affichees en haut a droite de l'ecran.

| Variante | Couleur | Icone | Duree | Usage |
|----------|---------|-------|-------|-------|
| Success | `--success` | CheckCircle | 4s | Action reussie (agent lance, workflow sauvegarde) |
| Error | `--error` | XCircle | 8s (ou persistant) | Erreur (echec API, timeout) |
| Warning | `--warning` | AlertTriangle | 6s | Attention (quota proche, drift detecte) |
| Info | `--info` | Info | 4s | Information (mise a jour disponible) |

**Regles** :
- Maximum 3 toasts simultanement, les plus anciens sont depiles (FIFO)
- Toasts empilables en haut a droite, `z-toast` (300)
- Bouton de fermeture (X) toujours present
- `aria-live="polite"` pour les toasts non-critiques
- `aria-live="assertive"` pour les erreurs et les alertes drift
- Pause de l'auto-dismiss au survol

```tsx
// Structure de toast
<div role="status" aria-live="polite"
  className="z-toast flex items-start gap-3 p-4 bg-card border border-border shadow-lg rounded-md
             transition-fast">
  <CheckCircleIcon className="w-5 h-5 text-success shrink-0" />
  <div className="flex-1">
    <p className="font-medium text-sm">Agent lance avec succes</p>
    <p className="text-xs text-muted-foreground">L'agent "Code Review" est en cours d'execution.</p>
  </div>
  <button aria-label="Fermer la notification" className="shrink-0">
    <XIcon className="w-4 h-4 text-muted-foreground" />
  </button>
</div>
```

#### 3.2.2 Etats de chargement

Trois patterns de chargement selon le contexte :

| Pattern | Usage | Implementation |
|---------|-------|----------------|
| **Skeleton** | Chargement initial de page | Formes grises animees epousant la forme du contenu (cf. `PageSkeleton.tsx`) |
| **Spinner** | Action en cours (bouton, soumission) | Spinner circulaire 16-20px dans le bouton, texte change ("Lancement..." au lieu de "Lancer") |
| **Progress bar** | Operations longues (import, deploiement) | Barre horizontale avec pourcentage, `aria-valuenow` / `aria-valuemax` |

**Regles** :
- Skeleton pour tout chargement > 200ms (eviter le flash)
- Bouton desactive (`disabled`) pendant le loading, spinner inline
- Progress bar pour les operations > 5s avec estimation de temps
- `aria-busy="true"` sur le conteneur en chargement

### 3.3 Centre de Notifications

#### 3.3.1 Architecture

Le centre de notifications est accessible via une icone cloche dans le header avec badge de compteur.

**Types de notifications** :
- **Actions requises** : approbations en attente, validations humaines (human-in-the-loop)
- **Alertes** : drift detecte, agent en erreur, seuil de cout depasse
- **Informatives** : agent termine, workflow complete, nouveau membre invite

**Comportement** :
- Badge numerique sur l'icone cloche (rouge pour les actions requises)
- Panel slide-in depuis la droite au clic
- Notifications groupees par jour
- Actions inline ("Approuver", "Voir le detail", "Ignorer")
- Marquer comme lu / tout marquer comme lu

#### 3.3.2 Notifications prioritaires

Les alertes critiques (drift `severity: high`, agent crash, violation de securite) declenchent en plus :
- Un toast `aria-live="assertive"` immediat
- Un badge rouge clignotant sur l'icone cloche
- Un son optionnel (configurable dans les parametres)

### 3.4 Gestion des Permissions (RBAC)

**Principe** : masquer les elements non-autorises plutot que les griser.

| Situation | Comportement |
|-----------|-------------|
| Bouton non-autorise | Masque completement (`hidden`), pas `disabled` |
| Page non-autorisee | Redirect vers la page autorisee la plus proche |
| Action non-autorisee (API) | Message 403 clair : "Vous n'avez pas la permission de [action]. Contactez un administrateur." |
| Menu item non-autorise | Non affiche dans la navigation |
| Route directe non-autorisee | Page 403 avec lien de retour et explication |

**Implementation** :
```tsx
// Pattern canUser() — masquage conditionnel
{canUser('agent:create') && (
  <Button onClick={handleCreateAgent}>Nouvel agent</Button>
)}

// Page de permission refusee
<div className="flex flex-col items-center justify-center h-full gap-4">
  <ShieldOffIcon className="w-12 h-12 text-muted-foreground" />
  <h2 className="text-xl font-semibold">Acces refuse</h2>
  <p className="text-muted-foreground">Vous n'avez pas la permission d'acceder a cette page.</p>
  <Button variant="secondary" asChild>
    <Link to="/dashboard">Retour au dashboard</Link>
  </Button>
</div>
```

### 3.5 Gestion des Erreurs

#### 3.5.1 Error Boundary

Chaque section majeure de l'application est encapsulee dans un Error Boundary React pour eviter les crashes globaux.

**Affichage** : message convivial avec option de recharger la section, sans perdre le reste de l'interface.

#### 3.5.2 Page 404

```
+------------------------------------------+
|  Illustration                            |
|                                          |
|  Page introuvable                        |
|  L'URL que vous avez suivie ne          |
|  correspond a aucune page.               |
|                                          |
|  [Retour au dashboard]                   |
+------------------------------------------+
```

#### 3.5.3 Erreurs de formulaire (inline)

- Les erreurs s'affichent sous le champ concerne, en rouge (`--error`) avec icone
- Le champ en erreur a une bordure rouge
- `aria-describedby` lie le champ a son message d'erreur
- `aria-invalid="true"` sur le champ invalide
- Focus automatique sur le premier champ en erreur apres soumission

```tsx
<div className="space-y-1">
  <label htmlFor="email" className="text-sm font-medium">Email</label>
  <input id="email" type="email"
    aria-invalid={!!errors.email} aria-describedby="email-error"
    className="border border-input rounded-md px-3 py-2
               aria-[invalid=true]:border-error aria-[invalid=true]:ring-error" />
  {errors.email && (
    <p id="email-error" role="alert" className="text-xs text-error flex items-center gap-1">
      <AlertCircleIcon className="w-3 h-3" />
      {errors.email}
    </p>
  )}
</div>
```

#### 3.5.4 Pattern de retry

Pour les erreurs reseau ou timeout :
- Afficher le message d'erreur avec un bouton "Reessayer"
- Retry automatique avec backoff exponentiel (1s, 2s, 4s) pour les requetes en arriere-plan
- Maximum 3 tentatives automatiques avant de demander une action manuelle
- Indicateur visuel de reconnexion ("Reconnexion en cours...")

### 3.6 Temps Reel (WebSocket)

#### 3.6.1 Indicateur de connexion

Un indicateur discret dans le footer ou le header montre l'etat de la connexion WebSocket.

| Etat | Visuel | Aria |
|------|--------|------|
| Connecte | Pastille verte (5px) | `aria-label="Connexion temps reel active"` |
| Reconnexion | Pastille orange pulsante | `aria-label="Reconnexion en cours"` + `aria-live="polite"` annonce |
| Deconnecte | Pastille rouge + banniere | `aria-label="Connexion perdue"` + `aria-live="assertive"` |

#### 3.6.2 Reconnexion automatique

- Tentative de reconnexion immediate, puis backoff exponentiel (1s, 2s, 4s, 8s, max 30s)
- Banniere d'avertissement apres 10s de deconnexion : "Connexion perdue. Les donnees peuvent ne pas etre a jour."
- Bouton "Reconnecter maintenant" dans la banniere
- Resynchronisation automatique des donnees a la reconnexion

#### 3.6.3 Mises a jour optimistes (Optimistic Updates)

Pour les actions utilisateur rapides (deplacer une story, changer un statut) :
- Mise a jour immediate de l'UI avant confirmation serveur
- Revert automatique si le serveur rejette l'action
- Toast d'erreur en cas de revert : "L'action n'a pas pu etre sauvegardee. La modification a ete annulee."

---

## 4. Responsive & Accessibility (WCAG 2.1 AA)

### 4.1 Responsive Design

#### 4.1.1 Breakpoints

MnM est desktop-first (cible B2B = usage principalement desktop). L'interface est responsive down to tablet.

| Breakpoint | Taille | Description |
|------------|--------|-------------|
| `sm` | >= 640px | Petit ecran, telephone paysage |
| `md` | >= 768px | Tablette portrait |
| `lg` | >= 1024px | Tablette paysage / petit laptop |
| `xl` | >= 1280px | Desktop (experience optimale) |
| `2xl` | >= 1536px | Grand ecran / moniteur externe |

```css
/* Implementation Tailwind — desktop-first avec min-width */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

#### 4.1.2 Comportement adaptatif par composant

| Composant | Desktop (>= 1280px) | Laptop (1024-1279px) | Tablette (768-1023px) | Mobile (< 768px) |
|-----------|---------------------|---------------------|----------------------|-------------------|
| **Sidebar** | Fixe, visible | Fixe, collapsible | Overlay hamburger | Overlay hamburger |
| **ChatPanel** | Panel fixe a droite | Overlay glissant | Overlay plein ecran | Plein ecran |
| **Board Kanban** | Toutes colonnes | Scroll horizontal | Scroll horizontal | Scroll horizontal |
| **Pipeline workflow** | Horizontal complet | Horizontal scroll | Liste verticale | Liste verticale |
| **Dashboard widgets** | Grille 3-4 colonnes | Grille 2-3 colonnes | Grille 1-2 colonnes | Pile verticale |
| **Tableaux** | Affichage complet | Scroll horizontal | Scroll horizontal | Vue carte |
| **Modales** | Centrees (max 640px) | Centrees | Centrees | Plein ecran |
| **Notifications** | Panel lateral | Panel lateral | Plein ecran | Plein ecran |

#### 4.1.3 Cible tactile (mobile)

Le projet integre deja la regle des 44px pour les cibles tactiles sur ecrans tactiles :

```css
@media (pointer: coarse) {
  button, [role="button"], input, select, textarea,
  [data-slot="select-trigger"] {
    min-height: 44px;
  }
}
```

### 4.2 Accessibility (WCAG 2.1 AA)

#### 4.2.1 Contraste

**Ratios minimaux obligatoires** :

| Element | Ratio minimum | Norme |
|---------|--------------|-------|
| Texte normal (< 18pt / < 14pt bold) | 4.5:1 | WCAG 2.1 AA 1.4.3 |
| Texte large (>= 18pt ou >= 14pt bold) | 3:1 | WCAG 2.1 AA 1.4.3 |
| Composants UI et icones | 3:1 | WCAG 2.1 AA 1.4.11 |
| Focus indicator | 3:1 | WCAG 2.1 AA 2.4.7 |

**Verification** : les tokens oklch actuels dans les modes clair et sombre doivent etre valides avec un outil de verification de contraste oklch. Chaque nouveau token de couleur doit etre verifie avant integration.

**Regle critique** : ne jamais utiliser la couleur seule pour communiquer une information. Toujours combiner couleur + icone + texte.

- Statut agent : couleur + icone + texte ("Running" en vert avec icone play)
- Drift : couleur orange + icone warning + texte "Drift detecte"
- Roles : couleur badge + texte du role toujours visible
- Priorite : couleur + icone + label

#### 4.2.2 Focus visible

Tous les elements interactifs doivent avoir un indicateur de focus visible.

```css
/* Pattern de focus recommande */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Suppression du focus pour clic souris uniquement */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Exigences** :
- Outline 2px minimum avec contraste suffisant (3:1 contre le fond)
- Ordre de tabulation logique : gauche a droite, haut en bas
- Aucun piege clavier : `Escape` ou `Tab` permet toujours de sortir
- Focus restaure a l'element declencheur a la fermeture d'une modale

#### 4.2.3 Navigation clavier complete

| Contexte | Raccourci | Action |
|----------|-----------|--------|
| Global | `Tab` / `Shift+Tab` | Navigation sequentielle |
| Global | `Ctrl+K` | Palette de commandes |
| Global | `Escape` | Fermer modale / panneau / dropdown |
| Board | `Arrow keys` | Naviguer entre stories |
| Board | `Enter` | Ouvrir le detail |
| Board | `D` | Activer le mode deplacement |
| Chat | `Enter` | Envoyer message |
| Chat | `Shift+Enter` | Nouvelle ligne |
| Chat | `Ctrl+Shift+S` | Stopper l'agent |
| Workflow | `Arrow Left/Right` | Naviguer entre etapes |
| Dashboard | `Tab` | Naviguer entre widgets |

**Skip links** : liens "Aller au contenu principal" et "Aller a la navigation" en haut de page, visibles uniquement au focus clavier.

```tsx
<a href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2
             focus:z-tooltip focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground
             focus:rounded-md focus:shadow-lg">
  Aller au contenu principal
</a>
```

#### 4.2.4 ARIA Landmarks et Labels

**Landmarks obligatoires** :

```html
<header role="banner">...</header>
<nav role="navigation" aria-label="Navigation principale">Sidebar</nav>
<main role="main" id="main-content">Contenu</main>
<aside role="complementary" aria-label="Chat avec l'agent">ChatPanel</aside>
<div role="status" aria-live="polite">Notifications</div>
```

**Labels obligatoires** :
- Boutons d'icone (sans texte visible) : `aria-label` descriptif
- Indicateurs de statut : `aria-live="polite"` pour mises a jour automatiques
- Alertes drift : `aria-live="assertive"` pour alertes critiques
- Progress bars : `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Tableaux : `aria-sort` sur colonnes triables
- Onglets : pattern `role="tablist"` / `role="tab"` / `role="tabpanel"` avec `aria-selected`

#### 4.2.5 Annonces dynamiques pour lecteurs d'ecran

| Evenement | Live region | Message annonce |
|-----------|-------------|-----------------|
| Changement d'etape workflow | `aria-live="polite"` | "Etape 3 : Review - En cours" |
| Message agent recu | `aria-live="polite"` | "Nouveau message de l'agent : [debut]" |
| Drift detecte | `aria-live="assertive"` | "Alerte : drift detecte sur [story]" |
| Action completee | `aria-live="polite"` | "Story US-142 passee en Done" |
| Toast notification | `role="status"` | Contenu du toast lu automatiquement |
| Mode automatisation change | `aria-live="polite"` | "Mode automatisation change en : Assiste" |
| Connexion perdue | `aria-live="assertive"` | "Connexion temps reel perdue" |

#### 4.2.6 Composants MnM — Exigences specifiques

**Curseur d'automatisation** :
- Accessible au clavier : `Arrow Left/Right` pour changer de position
- `aria-label="Curseur d'automatisation"`
- `aria-valuenow="assiste"` + `aria-valuetext="Mode assiste : l'agent propose, vous validez"`
- Les 3 positions (Manuel, Assiste, Auto) sont cliquables ET atteignables au clavier

**Pipeline Workflow** :
- Chaque etape est focusable
- `aria-current="step"` sur l'etape en cours
- `aria-label` incluant le statut : "Etape 2, Code, en cours, 45 pourcent"
- Navigation fleches gauche/droite, `Enter` pour ouvrir le detail

**Drag-and-drop (Board, Workflow editor)** :
- Alternative clavier obligatoire pour toutes les operations
- Mode "deplacer" active par touche `D` ou `Espace`
- Annonce vocale : "Story US-142 selectionnee. Fleches pour deplacer. Enter pour deposer."
- Menu contextuel "Deplacer vers..." comme alternative sans drag

**ChatPanel** :
- Messages navigables avec fleches haut/bas
- Chaque message a un `aria-label` avec emetteur et horodatage
- Boutons Stop/Rollback accessibles au clavier meme pendant le scroll
- Zone de saisie : `aria-label="Envoyer un message a l'agent"`

#### 4.2.7 Themes et preferences systeme

```css
/* Detection automatique du theme systeme */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    /* Appliquer les tokens sombres si pas de surcharge manuelle */
  }
}

/* Respect de la preference de mouvement reduit */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Les deux themes (clair et sombre) doivent respecter les ratios de contraste WCAG 2.1 AA.

#### 4.2.8 Tests d'accessibilite requis

**Automatises (CI/CD)** :
- axe-core integre sur chaque composant (regles WCAG 2.1 AA)
- Lighthouse accessibility score >= 90
- Pa11y sur les pages principales

**Manuels (avant chaque release)** :
- Navigation complete au clavier (aucun element inaccessible)
- Test avec NVDA (Windows) et VoiceOver (macOS)
- Test avec zoom navigateur a 200% (pas de perte de fonctionnalite)
- Test daltonisme via simulateur Chrome DevTools
- Verification des annonces `aria-live` avec un lecteur d'ecran reel

---

*Section 7 — Design Tokens, UX Patterns & Accessibility v1.0 — ~2800 mots. Basee sur les tokens CSS existants (index.css, Tailwind CSS v4 + shadcn/ui), le PRD B2B v1.0, et les UX Requirements v1.0.*
