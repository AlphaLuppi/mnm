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

Arcs similaires détaillés dans `sections/ux-section-2-emotional-maya.md`. Points clés :
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

### Sections Détaillées des Contributeurs

| Section | Auteur | Fichier |
|---------|--------|---------|
| Design Philosophy, Core Experience, Design System | Sally | `sections/ux-section-1-design-system-sally.md` |
| Emotional Response, Defining Experiences, Inspiration | Maya | `sections/ux-section-2-emotional-maya.md` |
| Visual Foundation, Design Directions, Dark/Light | Caravaggio | `sections/ux-section-3-visual-caravaggio.md` |
| Priorisation UX, Alignement PRD, Roadmap | John | `sections/ux-section-4-priorisation-john.md` |
| Component Strategy, Faisabilité React, Performance | Amelia | `sections/ux-section-5-composants-amelia.md` |
| Innovation UX, Différenciation, Patterns Uniques | Victor | `sections/ux-section-6-innovation-victor.md` |
| Design Tokens, Naming Conventions, Accessibility | Paige | `sections/ux-section-7-tokens-paige.md` |

---

*UX Design B2B MnM v1.0 — ~6500 mots — 7 contributeurs — Spec UX complète de la transformation B2B enterprise.*
*Prochaine étape : Architecture B2B (Étape 4 du plan d'orchestration)*
