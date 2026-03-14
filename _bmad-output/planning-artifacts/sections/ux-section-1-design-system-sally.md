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
