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
