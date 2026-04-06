# Brainstorming: Projects v2 — Le Projet comme Cockpit Vivant

**Date:** 2026-04-06
**Objectif:** Repenser toute la vue et les features des projets dans MnM
**Contexte:** MnM = cockpit de supervision B2B pour agents AI de dev. Projets = entités entreprise, multi-user via tags, RBAC par rôle. Les devs gardent leurs IDEs. Git intelligence = pour les agents, pas pour les users.

## Techniques utilisées
1. **Reverse Brainstorming** — "Comment garantir l'échec de Projects v2 ?"
2. **SCAMPER** — Transformer chaque feature existante
3. **Six Thinking Hats** — Perspectives multiples (facts, feelings, risks, benefits, creativity, process)

---

## Idées générées

### Catégorie 1 : Projet comme entité vivante

1. **Project Pulse** — widget animé montrant l'activité temps réel (agents actifs, commits, tests)
2. **Live presence** — voir qui (humain ou agent) est actif sur le projet
3. **Project Health Score** — score composite 0-100 (tests, drift, budget, success rate) visible sur la liste projets
4. **Activity feed push-based** — événements importants poussés vers inbox/notifications, pas polling
5. **Continuous workspace sync** — le context se met à jour quand le code change, pas juste au setup
6. **Git Event Stream** — commits, push, PR remontent comme live events sans UI git

### Catégorie 2 : Vues composables par rôle

7. **Blocks dashboard par projet** — remplace les 6 onglets figés
8. **Role-based landing** — PM → budget/avancement, Dev → agents/issues/branches, QA → tests/drift
9. **Project Templates** — "Web App", "API", "Data Pipeline" avec agents/blocks pré-configurés
10. **Default blocks par rôle** — l'user n'a pas à composer from scratch, defaults intelligents
11. **Vue "Work"** — fusion Agents + Issues, chaque issue montre son agent + run live + branche
12. **Health Dashboard** — fusion Drift + Tests + Build + Lint en un seul espace

### Catégorie 3 : Setup agent-first

13. **Smart Project Brief** — le CAO analyse le repo et génère un résumé : stack, structure, risques
14. **Agent-first setup** — l'agent explore le repo et PROPOSE le setup (agents à créer, structure)
15. **Auto-clone** — quand un repo est lié, le sandbox clone automatiquement
16. **Codebase indexation pour agents** — knowledge graph (GitNexus-style) consommé par les agents via MCP
17. **Template matching** — le discovery détecte la stack et propose un template de projet

### Catégorie 4 : Coordination multi-agents

18. **Conflict Radar** — visualisation : quels agents sur quels fichiers, indicateurs de collision
19. **Agent Handoff** — agent finit → route auto vers le prochain (dev → QA → reviewer)
20. **CAO scopé par projet** — supervision autonome avec contexte projet dans les prompts
21. **Quality gates visibles** — tests auto, lint, build affichés dans le projet
22. **Sequential merge orchestration** — merge un par un, re-run tests, re-dispatch si conflit

### Catégorie 5 : Architecture projet

23. **Projet = entité entreprise** — vit au-dessus des sandboxes individuelles
24. **Tags sur le projet** — visibilité contrôlée au niveau projet (pas juste sur les agents)
25. **Multi-workspace natif** — monorepo = N workspaces, chacun avec ses agents
26. **Sous-projets / liens** — hiérarchie pour monorepo, microservices
27. **Project Admin** — fusion Settings + Access en un seul espace

### Catégorie 6 : Cleanup / Suppressions

28. **Supprimer Workflows tab** — les workflows sont dans le contexte des issues
29. **Supprimer Drift tab** — c'est un indicateur de santé dans le dashboard, pas une page
30. **Supprimer description markdown manuelle** — brief auto-généré depuis le repo/README
31. **Supprimer bouton "Launch" isolé sur agent list** — le lancement se fait depuis l'issue ou le CAO

---

## Key Insights

### Insight 1 : Le projet est un cockpit vivant, pas un conteneur passif
**Description:** Aujourd'hui le projet est un conteneur statique qui liste des trucs. Il doit devenir un cockpit qui "respire" — agents actifs visibles, progression temps réel, santé en un coup d'oeil.
**Source:** Reverse Brainstorming (live presence), Red Hat (manque de pouls), Green Hat (Project Pulse)
**Impact:** HIGH | **Effort:** MEDIUM
**Why it matters:** C'est la différence entre un outil admin et un vrai cockpit de supervision. Le PM veut ouvrir le projet et comprendre l'état en 3 secondes.

### Insight 2 : Blocks remplacent les onglets — vues composables par rôle
**Description:** Au lieu de 6 onglets figés identiques pour tout le monde, un dashboard Blocks que chaque user/rôle compose. PM ≠ Dev ≠ QA ≠ CEO.
**Source:** SCAMPER-S (dashboard composable), SCAMPER-A (inspiré Notion), Green Hat (role-based landing)
**Impact:** HIGH | **Effort:** MEDIUM
**Why it matters:** On a déjà le Blocks Platform (BF-03 à BF-07). L'utiliser pour les projets est la conséquence naturelle. Les onglets figés sont un anti-pattern pour un outil multi-rôle.

### Insight 3 : Fusionner Agents + Issues → "Work View" unifiée
**Description:** Chaque issue montre son agent assigné, son run live, sa branche. Plus de tab switch entre "Agents" et "Cockpit".
**Source:** SCAMPER-C (fusion), Reverse Brainstorming (agents = workers), Red Hat (déconnexion agents/issues)
**Impact:** HIGH | **Effort:** LOW
**Why it matters:** C'est le changement le plus simple avec le plus gros impact. Aujourd'hui on doit naviguer entre 2 onglets pour comprendre "quel agent fait quelle issue".

### Insight 4 : Git comme event stream invisible, pas comme UI
**Description:** Les événements git (commit, push, PR, conflit) remontent comme des live events dans le projet. Pas de diff viewer, pas de branch manager. Les devs ont leurs IDEs pour ça.
**Source:** Reverse (MnM observe), SCAMPER-E (pas de git UI), Green Hat (Git Event Stream)
**Impact:** HIGH | **Effort:** MEDIUM
**Why it matters:** MnM n'est pas GitHub. Les events git sont du signal pour le cockpit (progression, conflits, qualité), pas une UI à parcourir.

### Insight 5 : Agent-first project setup via CAO
**Description:** Au lieu que l'user configure tout manuellement, le CAO explore le repo et PROPOSE le setup : agents à créer, stack détectée, structure identifiée, template suggéré.
**Source:** SCAMPER-R (inverser le flow), Green Hat (Smart Brief + Templates)
**Impact:** MEDIUM | **Effort:** MEDIUM
**Why it matters:** L'onboarding actuel est laborieux. Le CAO a déjà accès au sandbox — il peut analyser le repo et faire 80% du setup automatiquement.

### Insight 6 : Project Health Score composite
**Description:** Un score agrégé 0-100 basé sur : tests passing %, drift level, budget remaining %, agent success rate. Visible sur la liste projets et dans le dashboard.
**Source:** SCAMPER-C (Health Dashboard), SCAMPER-E (drift = indicateur), Green Hat (score)
**Impact:** MEDIUM | **Effort:** LOW
**Why it matters:** Un CEO veut voir "tous les projets avec leur santé" en un coup d'oeil. Un score simple est plus actionable que 6 métriques séparées.

### Insight 7 : Conflict Radar pour coordination multi-agents
**Description:** Visualisation des zones de collision entre agents — fichiers partagés, branches concurrentes. Le CAO alerte si 2 agents touchent les mêmes fichiers.
**Source:** Reverse (conflits invisibles), Green Hat (Conflict Radar), Research GitNexus/Clash
**Impact:** MEDIUM | **Effort:** HIGH
**Why it matters:** Avec 3+ agents en parallèle sur un même repo, les conflits sont inévitables. Mieux vaut les détecter pendant l'exécution que au merge.

---

## Statistiques
- **Total idées :** 31
- **Catégories :** 6
- **Key insights :** 7
- **Techniques appliquées :** 3

---

## Roadmap incrémentale recommandée

### Phase 1 : Work View unifiée (Insight 3) — ~3-5j
- Fusionner la vue Agents + Issues dans un seul composant
- Chaque issue affiche son agent assigné + statut du run live
- Supprimer l'onglet Agents séparé
- **Quick win, gros impact**

### Phase 2 : Project Pulse + Health Score (Insights 1 + 6) — ~3-5j
- Widget "Pulse" en haut de la page projet (agents actifs, commits récents, tests)
- Health Score composite calculé côté serveur
- Affiché sur la liste projets + en header du projet
- **Rend le projet "vivant"**

### Phase 3 : Blocks Dashboard projet (Insight 2) — ~5-8j
- Remplacer les onglets par un dashboard Blocks composable
- Default blocks par rôle (PM, Dev, QA)
- Intégrer Work View, Health, Activity Feed comme des blocks
- Supprimer Workflows tab, Drift tab (deviennent des blocks/indicateurs)
- **Dépend du Blocks Platform existant**

### Phase 4 : Git Event Stream (Insight 4) — ~3-5j
- Auto-clone dans le sandbox quand un repo est lié
- Events git (commit, push, PR) comme live events dans le projet
- Codebase indexation pour les agents (GitNexus ou custom Tree-sitter)
- **Pour les agents, pas pour les users**

### Phase 5 : Agent-first setup (Insight 5) — ~3-5j
- CAO explore le repo au setup et propose : stack, structure, agents à créer
- Templates de projet basés sur la stack détectée
- Brief auto-généré depuis le README + structure
- **Réduit l'onboarding de 15min à 2min**

### Phase 6 : Conflict Radar (Insight 7) — ~5-8j
- Détection de conflits entre agents (Clash ou custom)
- Visualisation dans le dashboard projet
- Alertes CAO sur les collisions
- **Pour les équipes avec 3+ agents en parallèle**

**Total estimé : 22-36 jours**

---

## Next Steps recommandé

→ **PRD** pour formaliser Projects v2 avec priorités business
→ `/bmad:prd` avec ce brainstorm en input

Les insights sont clairs, le séquençage est incrémental, chaque phase apporte de la valeur seule.

---

*Generated by BMAD Method v6 — Creative Intelligence*
*Session duration: ~40 minutes*
