# Les trois piliers

MnM repose sur trois piliers fondamentaux : **Confiance**, **Contrôle**, **Transparence**. Ils ne sont pas des features, ce sont les principes qui structurent toutes les features. Chaque module de MnM répond à au moins un pilier ; les meilleurs en couvrent plusieurs.

> *Confiance × Contrôle × Transparence — pas l'un sans les autres. Un cockpit qui mesurerait sans transparence serait du flicage. Un cockpit transparent sans contrôle serait du reporting passif. Un cockpit contrôlable sans confiance objective serait de la bureaucratie.*

## Pilier 1 — Confiance

**Promesse** : *l'agent prouve qu'il mérite l'autonomie. L'humain reste juge.*

La confiance ne se décrète pas — elle se mesure, par dimension, sur des artefacts concrets. MnM élimine le *feeling* dans la gate review : chaque artefact produit par un agent passe par un scoring multi-dimensions porté par des agents reviewers spécialisés.

### Quality Profiles

Une *Quality Profile* est une définition réutilisable de critères de qualité. Elle s'attache à n'importe quelle entité du système (issue, feature, workflow, step, agent, sprint, projet, équipe) **comme un tag**, via le graphe `entity_links`. Pas d'héritage, pas de hiérarchie : juste des attachements.

Une Quality Profile contient N **dimensions**. Chaque dimension est définie par :

- Un nom (`security`, `maintainability`, `test-coverage`, `spec-conformity`, ...).
- Un poids dans le score agrégé.
- Un seuil minimal pour auto-approve.
- Une **méthode de calcul** : déterministe (formule), LLM-as-a-judge, agent reviewer dédié, human review, ou hybride.

Les Quality Profiles sont versionnées, partageables, et viennent par défaut avec des **templates par métier** (Backend Dev, Frontend, QA, Security, Compliance...). Aussi simple à customiser qu'un `.eslintrc`.

### Agent Review Panel

Le scoring n'est pas un calcul statique — c'est un **workflow d'agents reviewers**, un par dimension, qui tournent **en parallèle**.

```
Agent dev finit son artefact
    ↓
Spawn N agents reviewers en parallèle
    ↓
Chaque reviewer produit { score, rapport détaillé }
    ↓
Agrégation pondérée
    ↓
Tous au-dessus du seuil ?
    ├── oui → auto-approve possible (selon le niveau d'autonomie)
    └── non → gate review humaine obligatoire
```

Chaque agent reviewer a sa propre configuration : MCP servers, skills, prompts. L'agent `security-reviewer` peut utiliser un MCP SonarQube ou OWASP ; l'agent `test-reviewer` lit les résultats de tests via le pipeline d'observabilité ; l'agent `spec-checker` compare l'output aux acceptance criteria attachés à la feature.

### Pair Scoring et calibration humaine

Les agents reviewers ne sont pas parfaits dès le jour 1 — c'est un faux problème. Le scoring humain **bootstrappe** le scoring agent :

1. Phase 1 : les humains scorent manuellement.
2. Phase 2 : les agents reviewers proposent un score, l'humain valide.
3. Phase 3 : auto-approve sur les dimensions les plus calibrées.

Quand un humain *override* un score (approuve un 5/10, rejette un 9/10), MnM capture la divergence et alimente la calibration du reviewer. Le continuum d'autonomie s'applique aussi aux reviewers.

### Confidence Badge

Un score unique dérivé de toutes les Quality Profiles attachées à une entité, affiché partout comme un badge synthétique : `92%`, `74%`, `45%`. Le CEO voit la santé d'un projet en trois secondes ; le développeur voit la santé de sa PR avant de la soumettre.

### CAO — Chief Agent Officer

Un agent system-level avec tous les tags, mode *watchdog* et mode *interactive* (via @mentions). Le CAO surveille les runs, commente automatiquement les échecs, et explore le repo lors de l'onboarding pour proposer un setup d'agents adapté. C'est l'agent qui **garde la confiance** dans la durée — la première ligne de défense quand un workflow dérive.

## Pilier 2 — Contrôle

**Promesse** : *c'est un dial, pas un switch. L'utilisateur choisit son niveau d'autonomie, jamais forcé.*

Le contrôle n'est pas binaire (humain *vs* agent). C'est un continuum, et l'utilisateur reste aux commandes. La progression est piloté par les KPI : tant que le scoring n'atteint pas le seuil, l'autonomie reste bloquée.

### Autonomy Continuum

Six niveaux d'autonomie. Chaque entité — step, workflow, agent, équipe — peut être à un niveau différent. Détails complets dans [`autonomy-continuum.md`](./autonomy-continuum.md).

```
L0 Manual         → Humain sans IA
L1 Assisted       → Humain + IA standalone (Claude Code/Cursor solo)
L2 Connected      → Humain + IA + MnM MCP (contexte injecté)
L3 Guided         → Humain dans le chat MnM (full visibility)
L4 Supervised     → Agent auto + humain en gate review
L5 Autopilot      → Full autopilot (auto-approve quand KPI > seuil)
```

### Progression KPI-driven

```
KPI faibles            → MnM ne propose pas de progression
KPI moyens (> 70%)     → MnM suggère le niveau suivant
KPI hauts (> 90% sur 10+ runs)  → MnM recommande fortement
L'utilisateur CHOISIT toujours.
Si KPI baissent après progression → alerte + option de redescendre.
```

Le niveau Autopilot est **verrouillé par défaut**. Déblocable uniquement quand les KPI le prouvent, dimension par dimension. Le système refuse de basculer en autopilot si les KPI ne le justifient pas — un override explicite est possible (*je comprends les risques*) mais tracé.

### HITL — Human In The Loop first-class

L'humain n'est pas un *fallback* — il est un acteur de premier plan. Toutes les transitions de step critiques peuvent exiger une approbation humaine, avec validation badge live et drawer de détail. Les Governed Workflows incluent nativement les gates HITL ; pas besoin de hacker autour.

### Interrupt, Steer, Override

Trois actions universelles pendant un run d'agent :

- **Interrupt** — stopper un agent en cours, sans casser l'état.
- **Steer** — injecter un message dans un agent en cours (via le MCP `mnm_steer_agent`).
- **Override** — modifier un score ou une décision de gate, en laissant trace de la divergence.

Ces actions sont disponibles depuis la Web UI **et** depuis le MCP. Bidirectionnalité totale.

### Shadow Mode

Avant de basculer une étape de Guided à Supervised, l'agent peut tourner **en parallèle** de l'humain. On compare. Si l'agent fait aussi bien (ou mieux) sur 10 runs consécutifs, la transition est validée empiriquement — pas par confiance aveugle, par preuves.

## Pilier 3 — Transparence

**Promesse** : *chaque stakeholder voit ce qui le concerne, dans le format qui lui convient.*

La transparence n'est pas un dump brut — c'est de l'information curée, par rôle, à la bonne profondeur.

### Pipeline de traces Bronze / Silver / Gold

MnM capture chaque exécution d'agent à trois niveaux superposés :

| Niveau | Quoi | Pour qui |
|--------|------|----------|
| **Bronze** | Logs bruts, raw outputs, debug JSON | Dev qui debug un cas précis |
| **Silver** | Phases groupées, structure détectée, timeline | QA, dev qui revue la trace |
| **Gold** | Phases scorées, annotations LLM, verdicts hiérarchiques | PM, lead, CEO — la lecture par défaut |

Le Gold est **auto-généré** à la fin de chaque run, pas un clic manuel. L'enrichissement LLM est **hiérarchique** : prompt global → prompt workflow → prompt agent → contexte issue. L'analyse Gold est personnalisable par utilisateur (deux personnes regardant le même agent peuvent vouloir des focus différents — *"je veux suivre les décisions sécurité"* vs *"je veux suivre les choix d'architecture"*).

L'UI est inspirée de Langfuse : timeline horizontale, barres séquentielles et parallèles, drill-down direct vers Silver / Bronze.

### Improvement Cockpit

La vue dédiée aux leads et responsables d'agents. Pas un dashboard de 47 KPI — un écran **action-oriented** :

- First-pass rate de chaque agent, trend 30 jours.
- Breakdown par dimension (sécurité, maintenabilité, tests, conformité, ...).
- Interventions récentes : *approved first pass*, *steered mid-execution*, *corrections at gate*.
- **Top correction themes** extraits par LLM des feedbacks gate (*"Gestion des erreurs réseau insuffisante (4x)"*, *"Nommage des variables pas cohérent (2x)"*).
- Bouton **Améliorer le skill** → ouvre un chat MnM avec contexte pré-injecté (skill actuel + feedbacks ciblés + corrections concrètes).

Le lead itère sur le prompt / skill avec l'IA, sauvegarde une nouvelle version, et observe si le first-pass rate monte. **C'est le coeur du Flywheel.**

### Feature Map et traceability

La vue centrale d'un projet n'est pas une liste d'issues — c'est une **Feature Map** vivante, maintenue automatiquement par les agents. Chaque feature est un node générique avec :

- Statut, coverage, ACs, issues, Confidence Badge.
- Drill-down : feature → ACs → issues → tests → code (via GitNexus MCP).

La traceability est portée par le graphe `entity_links` : pas de tables ad-hoc. Une seule mécanique pour tout connecter (specs → issues → code → tests → cahiers des charges → conformité).

### Review Lenses — Blocks composables

L'action de validation est universelle (*approve*, *reject*, *comment with feedback*). Mais la **vue** dépend du rôle : un dev veut un diff, un PM veut un résumé, un designer veut un preview Figma, un QA veut le résultat des tests. MnM expose ces vues via des **Blocks** composables :

| Block | Source | Affichage |
|-------|--------|-----------|
| `GitlabMRBlock` | GitLab MCP | Diff summary, pipeline, comments |
| `GithubPRBlock` | GitHub MCP | PR diff, checks, reviews |
| `FigmaBlock` | Figma API | Preview embarqué |
| `PrototypeBlock` | MnM artifact deployment | Iframe du prototype déployé |
| `ExternalLinkBlock` | N'importe quoi | Preview + deep link |

Nouveau MCP connecté = nouveau Block possible. Pluggable, extensible. Un Block SDK permettra aux clients de créer leurs propres Blocks pour leurs outils internes.

### Audit trail immutable

Tout changement de configuration MnM (Quality Profile, workflow, agent config) passe par un commit dans le repo git de l'équipe — *même rigueur qu'un commit de code, appliquée à l'orchestration d'agents*. Auteur réel, message, diff, rollback natif. Pas d'état flottant en DB sans trace.

Les Governed Workflows poussent cette logique au maximum : le `workflow.json` est versionné, l'AI Assistant propose des modifications via des cards *Appliquer/Rejeter* par fichier, et chaque save passe par un batch commit atomique signé.

### Confidence Badge, Project Health Score, Autonomy Leaderboard

Trois indicateurs synthétiques pour les rôles non-techniques :

- **Confidence Badge** : score 0–100 par entité, couleur trois niveaux (vert / orange / rouge).
- **Project Health Score** : score composite par projet, agrégé des Quality Profiles attachées.
- **Autonomy Leaderboard** : maturité IA par équipe (*"Backend au niveau 3.2, Frontend au 2.8"*). Pas compétitif — visualisation de la maturité globale.

## L'imbrication des piliers

Les trois piliers ne fonctionnent **qu'ensemble**. Voici quelques imbrications concrètes :

- **Confiance + Contrôle** → la progression d'autonomie est conditionnée par le scoring objectif. On monte de niveau seulement quand on a prouvé.
- **Confiance + Transparence** → le Confidence Badge n'est utile que parce qu'on peut zoomer dessus (Improvement Cockpit, traces Gold, Review Lenses).
- **Contrôle + Transparence** → l'humain ne peut pas *steer* utilement s'il ne voit pas ce qui se passe. La transparence rend le contrôle exerçable.
- **Les trois ensemble** → c'est le **Flywheel**.

```
Confiance (scoring)  →  Contrôle (gate humain + autonomie)  →  Transparence (cockpit)
       ↑                                                              ↓
       └─────────────────  feedback loop fermé  ───────────────────────┘
```

## Anti-patterns à éviter

- **Pas de feature sans pilier identifié.** Si elle ne sert ni Confiance, ni Contrôle, ni Transparence, elle peut attendre.
- **Pas de rôles hardcodés.** Roles, permissions, presets : tout en DB, dynamique.
- **Pas d'entités spécifiques par domaine.** `nodes.type` et `entity_links.link_type` sont libres ; la sémantique vient de l'usage.
- **Pas de tracing intrusif du process.** On mesure le résultat, pas la méthode. En L2, le tracing est perdu — et c'est OK.
- **Pas de workflow forcé.** Le système de liens est flexible ; chaque équipe structure comme elle veut.
- **Pas de remplacement de l'IDE.** Jamais. MnM s'intègre, ne reconstruit pas un éditeur de code.

## Pour aller plus loin

- Le détail du continuum d'autonomie : [`autonomy-continuum.md`](./autonomy-continuum.md).
- La vision globale : [`vision.md`](./vision.md).
- Architecture technique : `CLAUDE.md` à la racine du repo.

---

*Trois piliers MnM — Studio Manifeste — 2026.*
