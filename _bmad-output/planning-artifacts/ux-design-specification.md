---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
status: 'complete'
completedAt: '2026-02-23'
inputDocuments:
  - planning-artifacts/product-brief-mnm-2026-02-22.md
  - planning-artifacts/prd.md
  - planning-artifacts/architecture.md
  - planning-artifacts/technical-research-mnm-2026-02-22.md
workflowType: 'ux-design'
project_name: mnm
user_name: Gabri
date: 2026-02-22
---

# UX Design Specification — MnM

**Auteur :** Gabri
**Date :** 2026-02-22

---

## Executive Summary

### Project Vision

MnM est un IDE desktop qui remplace le paradigme "Write → Run → Debug" par "Describe → Review → Approve". L'interface n'est pas un éditeur de code mais un cockpit de supervision à trois volets (Contexte / Agents / Tests) avec une timeline d'activité temps réel remplaçant le terminal. Construit sur Electron 40 + React 19 + Tailwind CSS 4 avec une architecture événementielle.

### Target Users

3 développeurs expérimentés utilisant Claude Code + BMAD au quotidien :

- **Tom** — Besoin de visibilité immédiate sur l'activité et les blocages des agents
- **Gabri** — Besoin de détection de drift entre documents et de vue opérationnelle du projet
- **Nikou** — Besoin de compréhension et d'édition visuelle des workflows

Profil commun : développeurs senior en paradigme agentique, habitués aux IDEs classiques (Cursor, IntelliJ, Warp) mais frustrés par leur inadaptation à la supervision d'agents.

### Key Design Challenges

1. **Densité d'information** — Afficher l'état de multiples agents, contextes, alertes et tests sans surcharge cognitive. Prioriser le "coup d'oeil" avant le détail.
2. **Transition paradigmatique** — Rendre le paradigme cockpit naturel pour des utilisateurs formés aux IDEs code-first.
3. **Navigation hiérarchique** — Garder l'utilisateur orienté dans la hiérarchie Projet → Epic → Story → Tâche synchronisée entre 3 volets.
4. **Temps réel non-intrusif** — Refléter les événements live des agents sans interrompre le flow de travail.

### Design Opportunities

1. **Métaphore aéronautique** — S'inspirer des cockpits réels : indicateurs hiérarchisés, alertes par gravité, vue d'ensemble avant détail.
2. **Progressive disclosure** — Badge couleur → timeline → chat → code. Chaque niveau de profondeur est optionnel.
3. **Drag & drop** — Contexte vers agent, réorganisation de noeuds workflow, redimensionnement de volets. Interaction directe.
4. **Dark mode par défaut** — App desktop dev-first, le dark mode est la norme.

## Core User Experience

### Defining Experience

La boucle fondamentale de MnM est : **Regarder → Comprendre → Décider → Agir (optionnel)**. L'action la plus fréquente est un regard sur le cockpit, pas un clic. L'expérience est réussie quand l'utilisateur comprend l'état du projet en moins de 5 secondes sans aucune action.

### Platform Strategy

- **Desktop Electron 40** — Souris + clavier, écrans >= 1440px
- **Accès OS** — Filesystem, process spawn, Git, file watching
- **Online requis** — LLM pour drift detection
- **Cross-platform** — macOS (principal), Linux, Windows

### Effortless Interactions

| Interaction | Mécanisme |
|---|---|
| Voir l'état d'un agent | Badge couleur visible sans clic |
| Réagir à un drift | Alerte push avec 3 boutons d'action directe |
| Comprendre un workflow | Diagramme visuel auto depuis le fichier source |
| Ajouter du contexte | Drag & drop depuis le volet contexte |
| Naviguer la hiérarchie | Breadcrumb + sidebar avec sync auto des 3 volets |

Automatisations silencieuses : attribution des modifications aux agents, drift detection sur changement de fichier, mise à jour timeline, sync navigation inter-volets.

### Critical Success Moments

1. **"5 secondes"** — Ouverture de MnM → compréhension immédiate de l'état du projet
2. **"Sauvé à temps"** — Alerte drift avant propagation du contexte pollué
3. **"Je comprends"** — Diagramme clair remplaçant 400 lignes de YAML
4. **"Zéro terminal"** — Fin de journée sans avoir ouvert un terminal

### Experience Principles

1. **Glance-first** — Information compréhensible d'un coup d'oeil (badge, couleur, icône) avant le détail
2. **Alert, don't interrupt** — Événements live informent sans prendre le focus
3. **Direct manipulation** — Drag & drop, clic direct, pas de menus profonds
4. **Zero-config defaults** — Tout fonctionne out-of-the-box, configuration accessible mais jamais requise
5. **Show the chain** — Toujours montrer la relation specs → tests → code

## Desired Emotional Response

### Primary Emotional Goals

| Émotion primaire | Description | Moment clé |
|---|---|---|
| **Contrôle** | "Je sais exactement ce qui se passe" | Dashboard à l'ouverture — tout l'état projet en un regard |
| **Confiance** | "Je peux déléguer, MnM surveille pour moi" | Alerte drift qui arrive avant qu'on ait besoin de vérifier |
| **Clarté** | "C'est limpide, je comprends immédiatement" | Workflow visuel qui remplace 400 lignes de YAML |

L'émotion dominante de MnM est le **contrôle serein** — l'utilisateur se sent comme un pilote dans un cockpit bien conçu : tout est visible, rien n'est alarmant sans raison, et il a les commandes sous la main.

### Emotional Journey Mapping

| Phase | Émotion souhaitée | Émotion à éviter |
|---|---|---|
| **Ouverture** | Sérénité — "tout va bien" ou alerte ciblée — "voilà ce qui demande mon attention" | Anxiété — trop d'infos, tout clignote |
| **Supervision active** | Confiance — "mes agents avancent, je vois" | Ennui — pas assez de feedback, impression que rien ne se passe |
| **Alerte drift/blocage** | Urgence maîtrisée — "ok, j'agis" | Panique — alerte trop agressive, faux positifs fréquents |
| **Résolution** | Satisfaction — "résolu en 30 secondes" | Frustration — résolution complexe, multi-étapes |
| **Retour le lendemain** | Habitude plaisante — "j'ouvre MnM en premier" | Réticence — "est-ce que ça va encore bugger" |

### Micro-Emotions

| Axe | Cible | Menace |
|---|---|---|
| **Confiance vs Scepticisme** | L'utilisateur fait confiance à la drift detection | Trop de faux positifs → scepticisme → ignore les alertes |
| **Accomplissement vs Frustration** | Résoudre un drift = 1 clic, lancer un agent = 2 clics | Flow cassés par des confirmations inutiles ou des erreurs cryptiques |
| **Calme vs Surcharge** | L'interface respire, les infos sont hiérarchisées | Trop d'animations, trop de notifications, trop de panneaux ouverts |

### Design Implications

| Émotion | Implication UX |
|---|---|
| **Contrôle → Hiérarchie visuelle forte** | Les éléments les plus importants (santé agents, alertes critiques) sont visuellement dominants. Le secondaire est atténué. |
| **Confiance → Fiabilité perceptible** | Les indicateurs de santé changent d'état de manière smooth (transition, pas de jump). Les données sont toujours fraîches (timestamps visibles). |
| **Clarté → Minimalisme informationnel** | Chaque élément UI communique exactement une chose. Pas de surcharge décorative. La couleur est fonctionnelle (vert/orange/rouge = statut). |
| **Urgence maîtrisée → Alertes calibrées** | Les alertes critiques sont visuellement distinctes (rouge, badge pulse subtil) mais jamais intrusives (pas de popup bloquante, pas de son). |
| **Satisfaction → Feedback d'action immédiat** | Chaque action a un feedback visuel en < 200ms (bouton qui change d'état, toast de confirmation, transition animée). |

### Emotional Design Principles

1. **Calm technology** — MnM informe sans exiger d'attention. Les informations vivent en périphérie et ne passent au premier plan que quand c'est nécessaire.
2. **Earned trust** — La confiance se construit par la fiabilité : zéro crash, zéro donnée stale, zéro faux positif chronique.
3. **Effortless competence** — L'utilisateur se sent compétent et efficace. Les actions sont simples, les résultats immédiats, les erreurs rares et récupérables.
4. **Professional warmth** — L'interface est professionnelle et fonctionnelle, mais pas froide. Les micro-animations ajoutent de la vie sans distraire.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

#### Grafana — Dashboard de monitoring
- Panneaux redimensionnables et réarrangeables, indicateurs de santé hiérarchisés avec seuils couleur, alertes par gravité, information dense mais structurée
- **Pertinence MnM :** Le cockpit est fondamentalement un Grafana pour agents IA — panneaux indépendants, chacun raconte une histoire

#### Linear — Gestion de projet dev
- Navigation clavier rapide (Cmd+K), hiérarchie claire Workspace → Project → Issue, transitions ultra-smooth, minimalisme radical, dark mode impeccable
- **Pertinence MnM :** Navigation hiérarchique fluide (Projet → Epic → Story → Tâche), calm technology, professional warmth

#### Figma — Canvas collaboratif
- Canvas infini avec zoom fluide, panneau latéral contextuel, toolbar minimaliste, drag & drop naturel
- **Pertinence MnM :** Workflow Editor — zoom smooth, sélection intuitive, panneau propriétés latéral pour configurer un noeud

#### Datadog — APM & monitoring temps réel
- Timeline d'événements horizontale avec corrélation, alertes contextuelles avec actions directes, vue service map (noeuds et connexions)
- **Pertinence MnM :** Timeline d'activité agents, corrélation événements/agents, service map ≈ Workflow Editor

### Transferable UX Patterns

**Navigation :**
- Cmd+K command palette (Linear) → accès rapide à n'importe quel agent, story, workflow
- Breadcrumb hiérarchique (Linear) → Projet > Epic > Story > Tâche, cliquable à chaque niveau
- Panel switching contextuel (Grafana) → volets qui changent selon la sélection

**Interaction :**
- Canvas + panneau propriétés (Figma) → Workflow Editor : graphe au centre, propriétés du noeud sélectionné en side panel
- Drag & drop (Figma) → context files vers agents, noeuds dans le workflow
- Timeline scrubbing (Datadog) → glisser sur la timeline pour naviguer dans le temps

**Visual :**
- Minimalisme fonctionnel (Linear) → couleur = statut, pas décoration
- Seuils de couleur (Grafana) → vert/orange/rouge pour agents et alertes drift
- Densité maîtrisée (Datadog) → beaucoup d'info mais toujours de l'espace pour respirer

### Anti-Patterns to Avoid

| Anti-pattern | Pourquoi | Exemple à ne pas suivre |
|---|---|---|
| **Modal hell** | Interrompt le flow | VSCode : 3 modales pour configurer un paramètre |
| **Notification fatigue** | L'utilisateur ignore tout | Slack : 50 notifications non lues |
| **Configuration-first** | Bloque l'usage | Jenkins : 20 min de setup avant le premier run |
| **Feature dump sidebar** | Surcharge visuelle | Jetbrains : toolbar avec 40 icônes |
| **Infinite scroll sans repère** | L'utilisateur se perd | Logs terminal défilant sans fin |

### Design Inspiration Strategy

**Adopter :** Navigation clavier Cmd+K (Linear), transitions smooth (Linear), dark mode (Linear), panneaux santé avec seuils couleur (Grafana), timeline horizontale avec scrubbing (Datadog)

**Adapter :** Canvas Figma → simplifier pour le Workflow Editor (noeuds + connexions uniquement). Panneaux Grafana → 3 volets fixes mais contenu contextuel. Flame graphs Datadog → timeline linéaire avec checkpoints cliquables.

**Éviter :** Settings page VSCode, plugin marketplace Jetbrains, tabs infinis Chrome.

## Design System Foundation

### Design System Choice

**shadcn/ui + Tailwind CSS 4** — Composants copiables (pas de dépendance npm), basés sur Radix UI (accessibilité + keyboard), natifs Tailwind, esthétique minimaliste compatible avec l'identité cockpit de MnM.

### Rationale for Selection

1. **Pas une dépendance** — shadcn/ui génère les composants dans le projet. Contrôle total, pas de node_module opaque.
2. **Tailwind natif** — S'intègre avec Tailwind CSS 4 déjà choisi dans l'architecture.
3. **Radix UI sous le capot** — Accessibilité et focus management gratis (ARIA, keyboard navigation). Critique pour un IDE.
4. **Minimalisme par défaut** — Esthétique Linear-like : dark mode, fonctionnel, propre.
5. **Composable** — Primitives (Dialog, Popover, Tooltip, Command) couvrent 80% des besoins. Le reste est custom.

### Implementation Approach

**Composants shadcn/ui :**
Button, Badge, Tooltip, Dialog, DropdownMenu, Popover, Command (Cmd+K), Tabs, Resizable (3 volets), Toast, ScrollArea

**Composants custom MnM :**
AgentCard, AgentChatViewer, TimelineBar, WorkflowCanvas (React Flow wrapper), ContextFileCard, DriftAlert, HealthIndicator

### Customization Strategy

**Design tokens (Tailwind CSS 4 variables) :**

| Token | Usage |
|---|---|
| `--color-bg-primary` | Fond principal (dark) |
| `--color-bg-secondary` | Fond volets/cartes |
| `--color-bg-elevated` | Popover, dialog, tooltip |
| `--color-text-primary` | Texte principal |
| `--color-text-muted` | Texte secondaire |
| `--color-status-healthy` | Vert (#22c55e) |
| `--color-status-warning` | Orange (#f59e0b) |
| `--color-status-critical` | Rouge (#ef4444) |
| `--color-status-inactive` | Gris (#6b7280) |
| `--color-accent` | Bleu accent (sélection/focus) |

**Règle de couleur :** La couleur n'est jamais décorative. Vert/orange/rouge = statut. Bleu = interactif/sélectionné. Tout le reste est des nuances de gris.

## Defining Core Experience

### Defining Experience

> **"J'ouvre MnM et je vois tout — mes agents, leurs blocages, les drifts, l'état du projet. Sans toucher à rien."**

La defining experience de MnM est le **"Cockpit Glance"** — le moment où l'utilisateur ouvre l'app et comprend l'état du monde sans cliquer, sans chercher, sans lire des logs. C'est l'inverse exact d'un terminal.

### User Mental Model

**Modèle terminal :** Ouvrir → Lire les logs → Chercher les erreurs → Comprendre → Agir (5-45 min de latence cognitive)

**Modèle cockpit MnM :** Ouvrir → Voir le dashboard → Comprendre → Agir optionnel (< 5 secondes)

Métaphores familières : tableau de bord voiture (voyants = badges), app Santé iPhone (vert/jaune/rouge), CI dashboards GitHub Actions (pass/fail). Pas de nouveau modèle mental à apprendre.

### Success Criteria

| Critère | Seuil |
|---|---|
| Compréhension immédiate de l'état projet | < 5 secondes |
| Zéro action si tout va bien | 0 clic |
| Accès au détail si problème | 1 clic |
| Localisation prévisible de l'information | Toujours au même endroit par volet |
| Perception de fraîcheur des données | Timestamps visibles, animations de refresh |

### Novel UX Patterns

| Pattern | Type | Application MnM |
|---|---|---|
| Dashboard badges couleur | Établi (Grafana, Datadog) | Appliqué aux agents IA |
| Timeline horizontale | Établi (Datadog, CI) | Checkpoints = entrées dans le chat agent |
| 3-pane layout | Établi (IDEs, email) | Contexte / Agents / Tests |
| Drift detection alerts | **Novel** | Alertes de cohérence sémantique inter-documents |
| Workflow visual editor | Établi (node editors) | Workflows BMAD avec sync bidirectionnelle |

Chaque pattern individuel est familier. La nouveauté est dans la combinaison et l'application au domaine agentique.

### Experience Mechanics

**1. Initiation** — L'app s'ouvre sur le Dashboard Cockpit. Dernier projet chargé automatiquement. Indicateurs de santé affichés en < 2 secondes.

**2. Interaction (Cockpit Glance)** — L'utilisateur regarde la zone haute (résumé santé), scanne les badges couleur (tout vert → rien à faire, orange/rouge → focus), clique sur un badge pour le détail. La timeline en bas montre l'activité récente.

**3. Feedback** — Transitions smooth sur changements de couleur (pas de jump). Toasts discrets pour les événements. Timestamps de fraîcheur ("il y a 3s"). Compteur d'alertes actives en live.

**4. Completion** — Si tout va bien → l'utilisateur retourne travailler. Si action requise → résolution en 1-2 clics → retour au cockpit. Le cockpit informe et libère, il ne retient pas.

## Visual Design Foundation

### Color System

Palette dark mode (défaut), construite sur les principes "couleur = fonction, jamais décoration".

**Backgrounds :**

| Token | Valeur | Usage |
|---|---|---|
| `--bg-base` | `#0a0a0b` | Fond principal |
| `--bg-surface` | `#141416` | Volets, cartes, panneaux |
| `--bg-elevated` | `#1e1e22` | Popovers, dialogs, hover |
| `--border-default` | `#27272a` | Séparateurs, contours |
| `--border-active` | `#3f3f46` | Focus, sélection |

**Texte :**

| Token | Valeur | Usage |
|---|---|---|
| `--text-primary` | `#fafafa` | Texte principal |
| `--text-secondary` | `#a1a1aa` | Texte secondaire |
| `--text-muted` | `#71717a` | Metadata, timestamps |

**Statut (fonctionnel) :**

| Token | Valeur | Usage |
|---|---|---|
| `--status-green` | `#22c55e` | Agent actif, test pass |
| `--status-orange` | `#f59e0b` | Agent en pause, drift mineur |
| `--status-red` | `#ef4444` | Agent bloqué, drift critique, test fail |
| `--status-gray` | `#6b7280` | Agent terminé, désactivé |

**Accent :** `--accent` `#3b82f6` (bleu), `--accent-hover` `#2563eb`, `--accent-muted` `#1d4ed8`

### Typography System

**Fonts :** Inter (UI/body) + JetBrains Mono (code, logs, timestamps)

**Type scale (base 14px) :**

| Token | Taille | Weight | Usage |
|---|---|---|---|
| `--text-xs` | 11px | 400 | Timestamps, badges |
| `--text-sm` | 12px | 400 | Labels, texte secondaire |
| `--text-base` | 14px | 400 | Body text, contenu principal |
| `--text-md` | 16px | 500 | Titres de cartes, noms d'agents |
| `--text-lg` | 18px | 600 | Headers de volets |
| `--text-xl` | 24px | 700 | Titre dashboard, nom du projet |

Line height : 1.5 body, 1.2 headings, 1.4 monospace. Base 14px = standard outils dev (sweet spot entre densité et lisibilité).

### Spacing & Layout Foundation

**Unité de base : 4px.** Échelle : 4 / 8 / 12 / 16 / 24 / 32px.

**Layout 3-pane :** Resizable splits — Contexte 25% / Agents 50% / Tests 25%. Min 200px par volet. Timeline : 100% largeur, 120px hauteur fixe en bas.

**Densité :** Interface dense mais aérée. Cartes avec 12px de padding interne, listes avec 8px de gap, sections séparées par 16-24px.

### Accessibility Considerations

| Critère | Implementation |
|---|---|
| Contraste texte WCAG AA (4.5:1) | Toutes combinaisons texte/fond vérifiées (ratio min 4.6:1) |
| Statut pas couleur seule | Badges couleur + texte/icône |
| Keyboard navigation | Radix UI (shadcn) — focus management natif |
| Focus visible | Ring `--accent` 2px sur focus clavier |
| Screen reader | ARIA labels via Radix UI |
| Motion reduced | `prefers-reduced-motion` respecté, animations conditionnelles |

## Design Direction Decision

### Design Directions Explored

3 directions explorées via mockups ASCII du cockpit principal :

- **A — Mission Control** (Grafana-like) : ultra-dense, tout visible, risque de surcharge
- **B — Zen Cockpit** (Linear-like) : ultra-minimal, une ligne par élément, tout au clic, manque d'info immédiate
- **C — Hybrid Cockpit** : équilibre densité/espace, résumé compact + détails contextuels

### Chosen Direction

**Direction C — Hybrid Cockpit**

Layout principal :
- **Header** : nom projet + breadcrumb hiérarchique + résumé global (agents, drifts) + Cmd+K
- **3 volets** : Contexte (fichiers + badges agents) / Agents (santé + progress bars + messages clés) / Validation (tests agrégés + drift alerts en cards)
- **Timeline** : barre horizontale en bas avec événements corrélés par agent + labels

### Design Rationale

- **Glance-first respecté** : assez d'info pour comprendre sans cliquer (progress bars, badges statut, messages d'erreur clés)
- **Pas de surcharge** : un niveau de détail intermédiaire, les détails profonds (chat, diff, logs) sont au clic
- **Scalable** : avec 5+ agents, scroll doux dans le volet agents — pas de collapse de layout
- **Actionnable** : les drift alerts sont inline avec boutons d'action directe, pas dans une page séparée
- **Métaphore cockpit** : c'est le tableau de bord d'un avion — pas le panneau de la NASA (A) ni le tableau de bord minimaliste Tesla (B)

### Implementation Approach

- Header : composant `AppHeader.tsx` avec breadcrumb (navigation store) + résumé badges + command palette (shadcn Command)
- 3 volets : `ThreePaneLayout.tsx` avec shadcn `Resizable` (25%/50%/25%, min 200px)
- Volet agents : cards `AgentCard.tsx` avec `HealthIndicator` + `AgentProgressBar` + message condensé
- Volet validation : `TestStatusBadge` agrégé + `DriftAlert` cards avec actions inline
- Timeline : `TimelineBar.tsx` en position fixed bottom, 120px, scrubbing horizontal

## User Journey Flows

### Journey 1 : Tom — Agent bloqué

**Objectif :** Détecter un agent bloqué et résoudre le problème.

**Flow :** Ouvrir MnM → Scan badges → Badge 🔴 → Clic carte agent → Message d'erreur visible → (optionnel) Clic timeline → ChatViewer au checkpoint → Résout en externe → Agent redémarre → Badge 🟢

**Étapes clés :**
1. Scan (0s) — Badge rouge visible dans le volet Agents
2. Diagnostic (1 clic) — Carte agent affiche le message d'erreur condensé
3. Contexte (optionnel, 1 clic) — Timeline → ChatViewer au moment du blocage
4. Résolution — Action externe puis relance
5. Confirmation — Badge repasse vert, toast "Agent relancé"

Temps total : < 30 secondes (vs 45 minutes avant MnM)

### Journey 2 : Gabri — Drift de contexte

**Objectif :** Détecter et résoudre un drift entre documents avant propagation.

**Flow :** Agent modifie fichier → File watcher → Drift engine compare → DriftAlert dans volet Validation + badge ⚠ header → Clic alert → DriftDiffView (diff exact) → Corriger source / Corriger dérivé / Ignorer → Toast + alerte disparaît

**Étapes clés :**
1. Détection (auto) — Drift engine déclenché par file watcher
2. Notification (passive) — Alert card + badge compteur header
3. Inspection (1 clic) — DriftAlert → DriftDiffView avec diff exact
4. Résolution (1 clic) — 3 boutons : Corriger source / Corriger dérivé / Ignorer
5. Confirmation — Toast "Drift résolu", compteur décrémente

Temps total : < 30 secondes (vs 2 jours avant MnM)

### Journey 3 : Nikou — Comprendre et éditer un workflow

**Objectif :** Visualiser un workflow BMAD et ajouter une étape.

**Flow :** Ouvrir Workflow Editor → Sélection workflow → Parser → Diagramme React Flow → Clic connexion entre noeuds → Bouton "+" → Noeud inséré → Side panel config (rôle, instructions) → Sauvegarde → Sérialiseur écrit YAML/XML → Toast

**Étapes clés :**
1. Chargement (auto) — Parser transforme le fichier en diagramme
2. Compréhension (0 clic) — Le diagramme se lit visuellement
3. Insertion (2 clics) — Clic connexion → clic "+" → noeud inséré
4. Configuration (side panel) — Rôle et instructions
5. Sauvegarde (1 clic) — Sérialiseur écrit le fichier source

Temps total : < 2 minutes (vs 1 heure de debug YAML avant MnM)

### Journey Patterns

| Pattern | Description | Utilisé dans |
|---|---|---|
| **Scan → Focus → Act** | Badges → clic problème → résoudre | Tom, Gabri |
| **Auto-detect → Alert → Resolve** | Système détecte, alerte passivement, 1-2 clics résolution | Gabri, Tom |
| **Visual → Edit → Save** | Voir → modifier → sauvegarder vers fichier source | Nikou |
| **Progressive detail** | Badge → carte → profondeur (chat/diff/propriétés) | Tous |

### Flow Optimization Principles

1. **Max 2 clics** du cockpit à la résolution
2. **Le système travaille, l'humain décide** — détection auto, résolution humaine
3. **Feedback immédiat** — toast, badge change, transition animée
4. **Retour naturel au cockpit** après résolution
5. **Pas de dead-ends** — chaque écran a une action claire ou un chemin retour

## Component Strategy

### Design System Components (shadcn/ui)

| Composant | Usage MnM |
|---|---|
| `Button` | Actions (lancer agent, résoudre drift, sauvegarder) |
| `Badge` | Compteurs (agents, alertes, tests) |
| `Tooltip` | Info contextuelle au hover |
| `Dialog` | Confirmations (arrêter agent, supprimer noeud) |
| `DropdownMenu` | Actions contextuelles |
| `Popover` | Détails au hover |
| `Command` (cmdk) | Command palette Cmd+K |
| `Tabs` | Switching vues dans un volet |
| `Resizable` | 3 volets redimensionnables |
| `Toast` | Feedback d'action |
| `ScrollArea` | Listes scrollables |

### Custom Components

**HealthIndicator** — Cercle statut agent (vert/orange/rouge/gris). States : healthy (pulse subtil), warning, critical (pulse), inactive. Tailles : 8/12/16px.

**AgentCard** — Carte résumé agent. Anatomy : HealthIndicator + nom + progress bar + message condensé. States : default, selected (border accent), expanded. Actions : clic → sélection (sync volets), double-clic → ChatViewer.

**AgentProgressBar** — Barre progression agent. Fill couleur statut + label %. States : active, complete (vert plein), stalled (striped).

**AgentChatViewer** — Chat segmenté d'un agent. Messages (rôle + contenu + timestamp) avec checkpoints séparateurs. States : loading, streaming, static. `role="log"`, `aria-live="polite"`.

**TimelineBar** — Frise chronologique en bas (120px fixe). Points colorés par agent + labels + curseur temps. Actions : clic événement → sync volets, drag → scrub temporel. `role="slider"`.

**DriftAlert** — Card alerte drift. Icône ⚠ + titre + résumé + 3 boutons (Voir/Corriger/Ignorer). States : new (badge), seen, resolved (disparaît). `role="alert"`.

**DriftDiffView** — Split view comparaison docs en drift. Highlighting des différences + boutons résolution.

**WorkflowCanvas** — Wrapper React Flow stylé. States : view (lecture), edit (édition), executing (noeuds avec statut live). Pan, zoom, sélection, ajout noeud sur connexion.

**ContextFileCard** — Carte fichier contexte. Icône + nom + badges agents + drag handle. States : default, dragging, modified. `draggable="true"`.

**StoriesProgress** — Widget avancement stories BMAD dans le dashboard. Mini progress bars + ratio tâches.

### Component Implementation Strategy

Tous les custom components utilisent les design tokens Tailwind. Pas de valeurs hardcodées. Composition depuis les primitives shadcn quand possible.

### Implementation Roadmap

**Phase 1 — Visibilité :** HealthIndicator, AgentCard, AgentProgressBar, TimelineBar, ContextFileCard, AppHeader, ThreePaneLayout, NavigationSidebar

**Phase 2 — Supervision :** DriftAlert, DriftDiffView, DriftResolutionPanel, CockpitDashboard, ProjectHealthSummary, StoriesProgress, AgentChatViewer

**Phase 3 — Puissance :** WorkflowCanvas, BmadStepNode, BmadDecisionNode, WorkflowToolbar, TestHierarchy, TestStatusBadge

## UX Consistency Patterns

### Button Hierarchy

| Niveau | Style | Usage |
|---|---|---|
| **Primary** | Fond accent, texte blanc | Action principale de la vue (1 max par zone) |
| **Secondary** | Transparent, border | Action secondaire |
| **Destructive** | Fond rouge + Dialog confirmation | Actions irréversibles |
| **Ghost** | Aucun fond, texte muted | Actions tertiaires, inline |
| **Icon-only** | Icône + tooltip | Actions dans cartes et toolbars |

### Feedback Patterns

| Type | Mécanisme | Durée |
|---|---|---|
| Action confirmée | Toast bas-droite | Auto-dismiss 3s |
| Erreur utilisateur | Toast rouge persistant | Dismiss manuel |
| Erreur système | Toast rouge + détails expandable | Dismiss manuel |
| Événement passif | Badge change + compteur header | Persistant |
| Progression | Progress bar + % | Pendant l'opération |

Règles : jamais de popup bloquante pour du feedback, toasts empilés max 3, erreurs système avec bouton "Détails".

### Navigation Patterns

| Pattern | Mécanisme | Shortcut |
|---|---|---|
| Hiérarchie | Sidebar : Projet → Epic → Story → Tâche | ↑/↓ + Enter |
| Breadcrumb | Header cliquable à chaque niveau | — |
| Command palette | Recherche globale | `Cmd+K` |
| Volet sync | Clic élément → autres volets se synchronisent | — |
| Retour | Remonter d'un niveau | `Esc` |
| Focus agent | Clic AgentCard → filtrage Contexte + Tests | — |

Règle : navigation toujours synchrone entre les 3 volets.

### Empty States & Loading

| Situation | Comportement |
|---|---|
| Premier lancement | Écran "Ouvrir un projet" + bouton sélection répertoire |
| Volet vide | Illustration + texte + bouton d'action |
| Chargement données | Skeleton placeholders animés |
| Chargement LLM | Progress bar + "Analyse en cours..." |
| Erreur chargement | Message inline + bouton "Réessayer" |
| Liste filtrée vide | Message + "Réinitialiser les filtres" |

Règle : jamais d'écran blanc.

### Real-Time Update Patterns

| Événement | Transition |
|---|---|
| Badge statut change | Fade 200ms |
| Nouvel élément liste | Slide-in + fade 150ms |
| Élément disparaît | Fade-out 200ms + collapse 150ms |
| Compteur change | Number animation 300ms |
| Toast apparaît | Slide-in droite 200ms |
| Progress bar | Width transition 300ms ease-out |

Toutes les animations remplacées par des changements instantanés si `prefers-reduced-motion` activé.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Command palette |
| `Esc` | Remonter / fermer panel |
| `1` / `2` / `3` | Focus volet Contexte / Agents / Tests |
| `Cmd+Enter` | Action principale de la vue |
| `↑` / `↓` | Naviguer listes |
| `Enter` | Sélectionner |
| `Cmd+Shift+D` | Toggle drift panel |

## Responsive Design & Accessibility

### Responsive Strategy

MnM est une application **desktop-only** (Electron). Pas de responsive mobile/tablette — l'IDE de supervision agentique nécessite un écran large pour le layout 3 volets + timeline.

**Stratégie desktop :**

- Exploitation maximale de l'espace écran avec le layout 3 volets redimensionnables
- Timeline bar en bas occupe toute la largeur
- Panels secondaires (drift details, chat agent) en overlay/drawer
- Densité d'information optimisée pour écrans >= 1440px

**4 breakpoints desktop :**

| Breakpoint | Largeur | Comportement |
|---|---|---|
| **Full** | >= 1440px | Layout 3 volets complet, toutes les fonctionnalités visibles |
| **Compact** | 1280 - 1439px | Volets légèrement compressés, labels raccourcis |
| **Narrow** | 1024 - 1279px | 2 volets visibles + toggle pour le 3ème, timeline simplifiée |
| **Minimum** | < 1024px | Message "Résolution insuffisante" — non supporté |

### Breakpoint Strategy

**Desktop-first** — le layout est conçu pour >= 1440px puis dégradé gracieusement.

**Volets redimensionnables :**

| Volet | Min | Default | Max |
|---|---|---|---|
| Contexte (gauche) | 200px | 25% | 40% |
| Agents (centre) | 400px | 50% | 70% |
| Tests (droite) | 200px | 25% | 40% |
| Timeline (bas) | 80px | 120px | 200px |

**Comportement par breakpoint :**

- **Full (>= 1440px)** : 3 volets + timeline. Tous les éléments visibles. Espace pour les détails inline.
- **Compact (1280-1439px)** : 3 volets compressés. Icons sans labels dans les headers de volets. Tooltips pour compenser.
- **Narrow (1024-1279px)** : 2 volets + tab pour switcher le 3ème. Timeline réduite à une barre de statut. Command palette `Cmd+K` pour navigation rapide.
- **Minimum (< 1024px)** : Overlay bloquant avec message de résolution insuffisante.

### Accessibility Strategy

**Niveau cible : WCAG 2.1 AA**

Justification : standard industrie pour les outils de développement. AAA serait excessif pour un outil utilisé par 3 développeurs expérimentés, mais AA garantit de bonnes pratiques qui bénéficient à tout le monde (contraste, keyboard nav, focus visible).

**Priorités accessibilité :**

1. **Keyboard-first** — Priorité absolue pour un outil dev. Navigation complète sans souris.
2. **Contraste suffisant** — Ratio 4.5:1 pour le texte normal, 3:1 pour le texte large et les éléments UI.
3. **Focus visible** — Ring de focus clair sur tous les éléments interactifs (2px solid `--accent`).
4. **ARIA correct** — Fourni nativement par Radix UI (base de shadcn/ui). Roles, states, properties sur tous les composants interactifs.
5. **Reduced motion** — `prefers-reduced-motion` respecté : toutes les animations remplacées par des transitions instantanées.

**Contraste vérifié :**

| Combinaison | Ratio | Conformité |
|---|---|---|
| `--text-primary` (#fafafa) sur `--bg-base` (#0a0a0b) | ~19:1 | AAA |
| `--text-secondary` (#a1a1aa) sur `--bg-base` (#0a0a0b) | ~7:1 | AA |
| `--text-muted` (#71717a) sur `--bg-surface` (#141416) | ~4.6:1 | AA |
| `--status-green` (#22c55e) sur `--bg-surface` (#141416) | ~5.2:1 | AA |
| `--status-red` (#ef4444) sur `--bg-surface` (#141416) | ~4.6:1 | AA |

### Testing Strategy

**Accessibilité automatisée :**

- `eslint-plugin-jsx-a11y` — Lint-time, détecte les erreurs ARIA et les attributs manquants dans le JSX
- `@axe-core/react` — Runtime dev mode, overlay d'erreurs accessibilité dans l'app
- Axe DevTools (extension navigateur) — Tests manuels ponctuels

**Accessibilité manuelle :**

- Test keyboard-only : navigation complète sans souris sur tous les parcours critiques (Tom, Gabri, Nikou)
- Test VoiceOver (macOS natif) : vérification que les composants custom sont annoncés correctement
- Test contraste : vérification avec l'inspecteur Chrome DevTools sur les combinaisons couleur

**Cross-platform :**

- macOS : cible principale (Electron + VoiceOver)
- Linux : test CI avec les mêmes assertions accessibilité
- Windows : post-MVP

**CI :**

- `eslint-plugin-jsx-a11y` dans le pipeline lint
- Tests unitaires Vitest avec `@testing-library/jest-dom` assertions accessibilité (`.toHaveAccessibleName()`, `.toBeVisible()`)

### Implementation Guidelines

**Responsive :**

- Utiliser des unités relatives (`rem`, `%`, `dvh`) plutôt que `px` pour les tailles de texte et espacement
- Classes Tailwind responsive : `xl:` (>= 1280px), `2xl:` (>= 1536px) pour les adaptations
- `ResizablePanel` de shadcn/ui pour les volets redimensionnables (basé sur `react-resizable-panels`)
- CSS Container Queries pour les composants qui doivent s'adapter à leur conteneur (ex: `AgentCard` dans un volet étroit)

**Accessibilité :**

- Toujours utiliser les composants Radix/shadcn qui gèrent ARIA nativement
- `FocusTrap` (Radix) pour les modals et drawers
- `aria-live="polite"` pour les mises à jour de statut agent et les notifications de drift
- `aria-live="assertive"` uniquement pour les alertes critiques (agent crashed)
- Skip links en haut de l'app : "Aller au volet Agents", "Aller aux Tests"
- `tabindex` logique : volet gauche → centre → droite → timeline

**Platform :**

- Détection `navigator.platform` pour afficher `Cmd` (macOS) vs `Ctrl` (Linux/Windows) dans les shortcuts
- Electron `globalShortcut` pour les raccourcis système
