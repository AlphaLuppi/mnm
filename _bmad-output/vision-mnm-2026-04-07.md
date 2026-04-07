# Vision MnM — Le Cockpit de Supervision IA

**Date de consolidation :** 2026-04-07
**Sources :** 5 brainstorms fusionnés (voir footer)
**Statut :** Document de référence — remplace les sources individuelles

---

## Partie 1 : Philosophie

### Le positionnement

**MnM est le management plane de l'IA coding. Pas un IDE, pas un outil de dev, pas un concurrent de Claude Code.**

Analogie fondatrice : **Kubernetes n'a pas remplacé Docker — il l'orchestre.** MnM n'a pas à remplacer Claude Code — il l'orchestre.

Citation CEO CBA : *"Tu m'enlèves Claude Code pour me mettre un outil où j'ai pas la dernière feature de Claude Code, je suis deg et je veux pas ton outil."*

### Les 3 non-négociables

1. **Légèreté** — Le moins de tables, de types hardcodés et de contraintes possibles. Les entités sont génériques (nodes, entity_links). La sémantique vient de l'usage, pas du schema.

2. **Agnosticisme** — MnM marche pour une startup de 3 (AlphaLuppi) comme pour une boîte réglementée de 500 (CBA). Pas d'entités CBA-spécifiques. La flexibilité vient des Blocks + agents configurables.

3. **Flexibilité** — Pas de rôles figés PM/PD/Archi. Les rôles seront de plus en plus flous. N'importe qui peut contribuer. La structure vient de l'usage, pas de l'outil.

### Les 3 piliers

| Pilier | Ce que ça veut dire | Comment MnM le fait |
|--------|-------------------|-------------------|
| **Confiance** | L'agent PROUVE qu'il mérite l'autonomie. Le dev est le JUGE. | Quality Profiles + Agent Review Panel → scoring objectif |
| **Contrôle** | L'user choisit son niveau d'autonomie, jamais forcé. C'est un dial, pas un switch. | Autonomy Continuum (6 niveaux) + KPI-driven progression |
| **Transparence** | Chaque stakeholder voit ce qui le concerne, dans le format qui lui convient. | Improvement Cockpit + Review Lenses + Blocks composables |

### Résultat > Méthode

Le scoring se fait sur **l'artifact final**, pas sur le process. Peu importe comment le dev a codé — ce qui compte c'est le résultat, et les agents reviewers le scorent objectivement.

Quand l'user travaille via MCP (depuis Claude Code), on perd les traces — et c'est OK. On ne flique pas les gens, on mesure ce qu'ils produisent.

### Double interface

```
┌──────────────────────────────────────────────┐
│                MnM Platform                    │
│                                                │
│  ┌─────────────┐     ┌──────────────────┐     │
│  │  MnM Web UI  │     │  MnM MCP Server  │     │
│  │  (navigateur) │     │  (API/MCP)       │     │
│  └──────┬───────┘     └────────┬─────────┘     │
│         │                      │                │
│         │    Même backend      │                │
│         │    Même data         │                │
│         │    Même auth         │                │
│         └──────────┬───────────┘                │
│                    │                            │
│         ┌──────────┴───────────┐                │
│         │   MnM Core Engine    │                │
│         └──────────────────────┘                │
└──────────────────────────────────────────────┘
         ▲                    ▲
    ┌────┴────┐         ┌────┴──────────┐
    │ Browser  │         │ Claude Code    │
    │ (PM, CEO,│         │ Cursor         │
    │  QA, DSI)│         │ Any AI tool    │
    └──────────┘         └───────────────┘
```

**Web UI** = pour ceux qui supervisent (PM, CEO, QA, DSI, Lead IA) — dashboards, Feature Map, Improvement Cockpit, Review Lenses, configuration.

**MCP Server** = pour ceux qui exécutent (devs, agents) — get tasks, submit artifacts, launch agents, get context.

Les deux sont des **projections du même système**. Pas de feature exclusive à l'un ou l'autre.

---

## Partie 2 : Infrastructure — Le Graphe Universel

### entity_links — le graph de toutes les relations

Une seule table pour TOUTES les relations entre entités MnM. Pas de tables de jointure ad-hoc.

```sql
entity_links (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  source_type   TEXT NOT NULL,     -- 'node', 'issue', 'chat_channel', 'artifact',
                                  -- 'heartbeat_run', 'config_layer', 'folder',
                                  -- 'quality_profile', 'agent', 'user', 'tag', ...
  source_id     UUID NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     UUID NOT NULL,
  link_type     TEXT NOT NULL,     -- LIBRE: chaque entreprise utilise les siens
  metadata      JSONB,             -- infos complémentaires libres
  created_by    TEXT,
  created_at    TIMESTAMPTZ
)
```

Les `link_types` sont **libres** — pas d'enum. Chaque entreprise utilise les siens.

#### Ce que ça connecte

**Traceability (specs → issues → code → tests)**
```
Node ←→ Issue            (implements, contains)
Node ←→ Document         (spec, references)
Node ←→ Heartbeat_run    (tests, validates)
Node ←→ Node             (depends-on, requires)
Node ←→ Artifact         (prototype, handoff, rapport)
Issue ←→ Issue           (parent, child, blocks, depends-on)
Issue ←→ Document        (implements, references)
Chat  ←→ Node            (originated-from, discusses)
Chat  ←→ Document        (produced, references)
```

**Scoring**
```
Quality_profile ←→ Entity  (assignment)       metadata: {dimensions: [...]}
Heartbeat_run   ←→ Artifact (scored)          metadata: {score: 8.5, dimensions: {...}}
User            ←→ Score    (review/override)  metadata: {original: 5, override: 8, reason: "..."}
```

**Partage universel (NOUVEAU)**
```
Entity ←→ User  (shared_with)  metadata: {permission: "viewer"|"editor"}
Entity ←→ Tag   (shared_with)  metadata: {permission: "viewer"|"editor"}
```

Le modèle de partage :
- **Private** par défaut (créateur seul voit)
- **Partagé** via entity_links `shared_with` → users directs ET/OU tags
- **Company** = promu par admin, visible par tous

Remplace : `folder_shares`, `chat_context_links`, `config_layers.scope/visibility`, `agent_config_layers`, `workflow_stage_config_layers`.

**Attachement**
```
Agent ←→ Config_layer  (attachment)  metadata: {priority: 100}
Stage ←→ Config_layer  (attachment)  metadata: {priority: 50}
```

Les agents maintiennent ces liens automatiquement :
- Agent crée une issue depuis un chat → lien auto
- Agent dev commit → lien issue ↔ fichiers modifiés
- Agent QA écrit un test → lien test ↔ issue/spec

### nodes — l'arbre du produit

```sql
nodes (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  project_id    UUID REFERENCES projects(id),  -- nullable: null = company-wide
  type          TEXT NOT NULL,     -- libre: 'feature', 'acceptance-criteria', 'requirement',
                                  --        'module', 'area', 'milestone', ...
  name          TEXT NOT NULL,
  description   TEXT,
  parent_id     UUID REFERENCES nodes(id),  -- arbre
  metadata      JSONB,             -- métriques cachées + libre
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)
```

Ultra léger — le `type` est libre, zéro opinion sur le contenu. Le metadata stocke les métriques agrégées (issues done/total, tests passing, coverage %).

**Scope :**
- `project_id` défini → noeud spécifique à un produit (feature, AC)
- `project_id` null → noeud company-wide (requirement ISO 27001, design system)

Un requirement company-wide peut être lié à des features de N projets via entity_links.

**Usages :**
| Type | Exemple | Qui l'utilise |
|------|---------|---------------|
| `feature` | "Authentification" | PM, Dev, QA, CEO |
| `acceptance-criteria` | "Given SSO, user can login" | PM, QA |
| `requirement` | "REQ-04: MFA obligatoire" | Compliance, QA |
| `module` | "auth-service" | Dev, Archi |
| `area` | "Backend", "Mobile", "Web" | Routing d'agents |

### MnM MCP Server — les tools

```
# Task Management
mnm_get_my_tasks()            → Plan du jour
mnm_get_step_context(step_id) → Contexte enrichi (issue, specs, ACs, scoring)
mnm_complete_step(step_id, artifact) → Soumettre l'artifact
mnm_submit_review(step_id, verdict, feedback) → Gate review

# Agent Control  
mnm_launch_auto_agents(step_ids) → Lancer les agents en auto
mnm_get_agent_status()        → Statut des agents en cours
mnm_pause_agent(run_id)       → Pause
mnm_steer_agent(run_id, msg)  → Injecter un message

# Project Intelligence
mnm_get_feature_map(project_id) → Feature Map avec métriques
mnm_get_scoring(entity_id)    → Scores et KPI
mnm_search_issues(query)      → Chercher des issues
mnm_get_project_context(id)   → Contexte projet

# Workflow
mnm_list_workflows()          → Workflows disponibles
mnm_start_workflow(id, params) → Démarrer un workflow
mnm_get_workflow_status(id)   → Statut en cours

# Creation
mnm_create_issue(...)         → Créer une issue
mnm_handoff(content)          → Handoff brainstorm → projet
mnm_link_entities(...)        → Créer des entity_links
```

---

## Partie 3 : Projet & Traceability

### Les deux espaces

**Espace Créatif (Chat)** — où les PM brainstorment avec l'IA. Deux modes de contexte :
- **Sans codebase** — brainstorm green field, pas pollué par le legacy
- **Avec codebase** (via GitNexus MCP) — impact analysis, comprendre les conséquences

Le chat accumule des **context links** vers des artefacts (documents, prototypes, autres chats, références).

**Espace Production (Projet)** — le terrain commun entre personnes et agents.
- **Projet = Produit** — un projet MnM représente un produit complet (ex: "Agathe" chez CBA : mobile + web Angular + legacy Struts)
- **Multi-codebase** — N workspaces, chaque codebase a son MCP GitNexus
- **Nodes = structure permanente** (features, ACs, requirements)
- **Issues = travail temporaire** — tâches, bugs, stories. Liées aux nodes via entity_links

### Le Handoff

La transition chat → projet est un **agent/skill**, pas une entité.

```
Chat (brainstorm)
  → Context links (artefacts accumulés)
    → Skill "/handoff" (agent extracteur)
      → Document structuré (artifact)
        → PM review & valide
          → Lié au projet
            → Agent propose découpage en issues
```

L'agent extracteur adapte le format selon la taille :
- Petit truc → juste une issue rattachée à la bonne feature
- Évolution → issues sous feature existante + maj spec
- Gros truc → nouveau noeud feature (en draft)

Le contenu dicte la forme. L'agent propose, l'humain dispose.

### La Feature Map

La vue principale quand on ouvre un projet. C'est la **documentation centrale vivante**, maintenue automatiquement par les agents.

**Ce que ça montre :**
- Liste hiérarchique de toutes les features
- Chaque feature : statut, couverture, ACs, issues, Confidence Badge
- Drill-down : feature → ACs → issues → tests → code

**Exemples concrets :**

"Où en est ma feature ?" → Node feature avec ses entity_links vers issues, tests, specs. TLDR dans metadata : 14/22 issues done, 20/26 tests passing.

"Ce cahier des charges est-il couvert ?" → Node requirement (company-wide) lié à des features via entity_links. REQ-01 → 3/4 ACs testés. Couverture : 50%.

"Si je change cette feature, quel impact ?" → L'agent query les liens : spec → issues → statut → tests + GitNexus pour l'impact code. Réponse contextualisée selon l'état du lifecycle.

**Flexibilité par l'usage :**
- **Startup** : features avec quelques issues, pas de cahier des charges
- **Enterprise réglementé** : requirements numérotés, liens cahiers des charges, matrice de conformité
- **Agence** : features par client/contrat

Même mécanisme, même UI, usage différent.

### Traceability chain

Tout passe par nodes + entity_links. Pas de nouvelles tables.

**Acceptance Criteria = nodes enfants d'une feature** (type: "acceptance-criteria"). Lifecycle :

| Phase | Ce qui se passe |
|-------|----------------|
| 1. Spec rédigée | Node AC créé sous la feature |
| 2. Issue créée | entity_link AC → Issue |
| 3. Dev en cours | Issue in_progress |
| 4. Test écrit | entity_link AC → heartbeat_run |
| 5. Test passe | AC = couvert |

**Tests = heartbeat_runs existants** — `result_json` contient les résultats (framework-agnostic). MnM ne sait pas si c'est du Playwright, Jest ou pytest. C'est du JSONB avec des nombres.

### Code Intelligence

**1 MCP server GitNexus par repo.** Chaque workspace du projet a son index. Les agents l'utilisent pour :
- Comprendre la structure du code
- Mesurer l'impact d'un changement
- Naviguer dans les dépendances

Le dev n'utilise PAS GitNexus dans MnM — il l'a déjà dans son IDE. C'est un outil pour les agents.

### Smart Change Impact

L'impact d'un changement dépend de l'état du lifecycle :

| État | Comportement |
|------|-------------|
| **Handoff non commencé** | Modification libre |
| **Handoff en cours** | Pondérer : temps perdu, issues à modifier, synchro devs |
| **Feature terminée (en prod)** | Corréler specs, tests E2E, codebase, impact full |

L'objectif : qu'un PM mesure tout ça **sans reverse-engineer le code et faire 10 réunions**.

### Projet comme cockpit vivant

- **Project Pulse** — widget animé (agents actifs, commits récents, tests)
- **Live presence** — qui (humain ou agent) est actif
- **Project Health Score** — score composite 0-100 visible sur la liste projets
- **Work View unifiée** — fusion Agents + Issues, chaque issue montre son agent + run live
- **Git Event Stream** — events git comme live events, pas de UI git
- **Project Templates** — "Web App", "API", "Data Pipeline" avec agents/blocks pré-configurés
- **Agent-first setup** — le CAO explore le repo et PROPOSE le setup
- **Conflict Radar** — détection de collisions entre agents sur les mêmes fichiers

---

## Partie 4 : Scoring & Autonomie

### Quality Profiles (ex "Scoring Contracts")

Renommage business-friendly. Un Quality Profile = définition réutilisable de critères de qualité.

**S'attache à N'IMPORTE QUOI via entity_links** — comme les tags. Pas d'héritage, pas de hiérarchie.

```
Quality Profile = {
  dimensions: [
    { name, reviewer_agent_id, weight, threshold, method }
  ]
}

Peut s'attacher à : Node, Issue, Workflow, Step, Agent, Sprint, Projet, Équipe...
Plusieurs Quality Profiles peuvent s'attacher à la même entité.
Méthodes : déterministe (formule), LLM-as-a-judge, agent reviewer, human review, hybride
```

**Exemples :**
- "Code Quality" attaché à toutes les issues dev → agent reviewer avec SonarQube MCP
- "Sprint Health" attaché aux sprints → formule (velocity + issues done/planned)
- "Agent Reliability" attaché aux agents → déterministe (first-pass rate + error rate)
- "Compliance HAS" attaché aux features réglementées → LLM-as-a-judge contre cahier des charges

### Agent Review Panel

Le scoring n'est pas un calcul statique — c'est un **workflow d'agents reviewers** par dimension.

```
Quality Profile for "Dev Stage":
  dimensions:
    - name: "security"
      reviewer_agent_id: agent-security-reviewer    # OWASP MCP, SonarQube MCP
      weight: 30, threshold: 7
    - name: "maintainability"
      reviewer_agent_id: agent-code-quality          # GitNexus, complexity
      weight: 25, threshold: 6
    - name: "test_coverage"
      reviewer_agent_id: agent-test-reviewer
      weight: 20, threshold: 7
    - name: "spec_conformity"
      reviewer_agent_id: agent-spec-checker           # compare output vs ACs
      weight: 10, threshold: 7
```

**Flow :**
1. Agent dev finit → produit un artefact
2. Scoring workflow → spawn N agents reviewers EN PARALLÈLE
3. Chaque reviewer produit score + rapport
4. Scores agrégés (pondérés)
5. Tous > threshold → auto-approve possible
6. Un < threshold → gate review humaine obligatoire

**Dans le modèle de données :** chaque review = un heartbeat_run tracé. Les scores = entity_links (type: "scored") entre le run reviewer et l'artefact.

**Ce que le CEO voit :** "Feature Auth SSO — 5 agents ont review : Security 9/10 ✅, Maintenabilité 7/10 ⚠️, Tests 8/10 ✅. Trend 30j : dette technique BAISSE."

### Autonomy Continuum

6 niveaux, pas un switch binaire :

| Niveau | Nom | Description |
|--------|-----|-------------|
| 0 | **Manual** | Humain sans IA |
| 1 | **Assisted** | Humain + IA standalone (Claude Code / Cursor sans MnM) |
| 2 | **Connected** | Humain + IA + MnM MCP (context injecté, résultat soumis) |
| 3 | **Guided** | Humain dans le chat MnM (traces capturées, full visibility) |
| 4 | **Supervised** | Agent auto + humain review en gate |
| 5 | **Autonomous** | Full autopilot (auto-approve quand KPIs > threshold) |

**Chaque entité/step/workflow peut être à un niveau différent.** Un dev peut être en Connected pour "architecture" et en Supervised pour "unit tests".

**Progression KPI-driven :**
```
KPIs bas → MnM ne propose pas
KPIs > 70% → MnM suggère
KPIs > 90% pendant 10+ runs → MnM recommande fortement
L'user CHOISIT toujours. Jamais forcé.
Si KPIs baissent → alerte + option de redescendre
```

**Le niveau 5 est verrouillé par défaut.** Déblocable uniquement quand les KPIs le prouvent. Le système REFUSE de passer en auto si les KPIs ne le justifient pas (override explicite possible avec "je comprends les risques").

**Répond aux 3 piliers :**
- **Confiance** : les KPIs prouvent la compétence
- **Contrôle** : l'user choisit son niveau
- **Transparence** : chaque niveau a la visibilité appropriée

### Improvement Cockpit

Vue dédiée pour les leads/responsables d'agents :

```
┌─ Agent: Backend Dev v3.2 ──────────────────────────────┐
│  First-pass rate: 73% ↑ (was 58% il y a 30j)          │
│                                                         │
│  KPI Breakdown          30d Trend                       │
│  Security:     8.2/10  ↑ +1.3                          │
│  Maintainability: 6.5/10  ↓ -0.2                       │
│  Tests:        7.8/10  ↑ +0.5                          │
│                                                         │
│  Top correction themes (LLM-extracted):                 │
│  1. "Gestion des erreurs réseau insuffisante" (4x)     │
│  2. "Nommage des variables pas cohérent" (2x)          │
│                                                         │
│  [📝 Améliorer le skill]  [📊 Détail par user]         │
└─────────────────────────────────────────────────────────┘
```

**Flow d'amélioration :**
1. Lead voit le thème de correction #1
2. Clique "Améliorer le skill"
3. → Chat MnM avec contexte pré-injecté (skill actuel + TOUS les feedbacks + 4 corrections concrètes)
4. Itère sur le prompt/skill
5. Sauvegarde → nouvelle version
6. Les prochaines runs utilisent le skill amélioré

### Le Flywheel MnM

Le concept unificateur — tous les composants sont des rouages de ce cycle :

```
              ┌─────────────────┐
              │   AGENT EXÉCUTE  │
              └────────┬────────┘
                       │ artifact
                       ▼
              ┌─────────────────┐
              │  QUALITY PROFILE │
              │  scoring objectif│
    ┌────────▶│  (agents + humain)│
    │          └────────┬────────┘
    │                   │ scores + rapport
    │                   ▼
    │          ┌─────────────────┐
    │          │   GATE REVIEW    │
 calibration  │  (humain juge)   │
    │          └────────┬────────┘
    │                   │ feedback
    │                   ▼
    │          ┌─────────────────┐
    │          │  IMPROVEMENT     │
    └──────────│  COCKPIT         │
              └────────┬────────┘
                       │ skill amélioré
                       ▼
              ┌─────────────────┐
              │  AUTONOMY        │
              │  CONTINUUM       │
              │  (KPIs montent)  │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │   AGENT EXÉCUTE  │
              │   (mieux)        │
              └─────────────────┘
```

Le pitch n'est pas "on a 7 features" — c'est "on a UN cycle d'amélioration continue qui rend vos agents meilleurs chaque jour."

### Review Lenses = Blocks composables

L'action de validation est universelle (approve/reject/comment). La VUE est personnalisée par rôle via Blocks. Les Review Lenses incluent des Blocks qui savent render des références externes :

| Block | Source | Affichage |
|-------|--------|-----------|
| GitlabMRBlock | Gitlab MCP | Diff summary, pipeline, comments |
| GithubPRBlock | GitHub MCP | PR diff, checks, reviews |
| FigmaBlock | Figma API | Preview embarqué |
| PrototypeBlock | MnM deployment | iframe du prototype |
| ExternalLinkBlock | N'importe quoi | Preview + deep link |

Nouveau MCP = nouveau Block type. Pluggable, extensible.

### La journée type d'un dev avec MnM

```
Dev ouvre Claude Code le matin.
MnM MCP est configuré.

User: "C'est quoi mon plan aujourd'hui?"
Claude: *mnm_get_my_tasks()*

"Voilà ton plan:
 📋 Connected (tu gères):
   1. Issue #142 — Backend Auth SSO
   2. Issue #155 — API Payments
   
 🤖 Supervised (agents autonomes):
   3-7. Unit tests issues #143-#147
   
 ⏳ En attente de review:
   8. Issue #138 — security 9/10, tests 7/10"

User: "Lance les auto et commençons par l'auth SSO"
Claude: *mnm_launch_auto_agents([143..147])*
        *mnm_get_step_context(step_142)*

"Contexte Auth SSO injecté:
- Issue: Retry SAML timeout
- Specs, ACs, fichiers concernés (via GitNexus)
- Quality Profile: Security 30%, Tests 20%
Go?"

--- 2 heures plus tard ---

User: "Soumet"
Claude: *mnm_complete_step(step_142, {...})*

"Step soumise. 5 agents reviewers en cours...
Résultats dans ~2 min sur MnM."
```

---

## Partie 5 : Adoption & Insights

### Adoption en cercles concentriques

Chaque cercle est indépendant et apporte de la valeur :

| Phase | Quoi | Pourquoi d'abord |
|-------|------|-----------------|
| **0** | MnM MCP Server basique | Time to value immédiat pour les devs |
| **1** | Quality Profiles + gate review humaine | Confiance sans dépendance aux agents reviewers |
| **2** | Improvement Cockpit (KPIs, themes, feedback) | Ce qui vend au CEO |
| **3** | Agents reviewers (1-2 dimensions) | Automatisation progressive du scoring |
| **4** | Continuum d'autonomie (Connected → Supervised) | Quand la confiance est établie |
| **5** | Autonomous + Shadow Mode | Quand les KPIs le prouvent |

**Time to First Value < 30 minutes.** Le continuum démarre invisible. Tout le monde commence en Connected avec des defaults intelligents. Scoring, reviewers, niveaux se découvrent progressivement.

### Shadow Mode

Avant passage en Supervised : l'agent exécute **en parallèle** de l'humain. On compare. Si l'agent fait aussi bien 10 fois → transition validée avec des preuves empiriques, pas de la confiance aveugle.

### Pair Scoring

Quand un humain override un score (approuve un 5/10, rejette un 9/10), MnM capture la divergence pour calibrer le reviewer. **Le continuum d'autonomie s'applique AUSSI aux reviewers.** Phase 1 : humains scorent. Phase 2 : agents proposent, humain valide. Phase 3 : auto-approve.

### Quality Profile Templates

Templates par métier : "Backend Dev", "Frontend", "QA". Clone un template, override ce qu'on veut. Aussi simple qu'un `.eslintrc`.

### Agent Recipes

Combos pré-packagées : "Backend Dev Stack" = agent-dev + agent-security-reviewer + agent-test-reviewer + quality profile "Backend Quality". One-click setup. Le `create-react-app` de MnM.

### Confidence Badge

Score UNIQUE dérivé de tous les Quality Profiles, affiché partout comme un badge. 🟢 92%, 🟡 74%, 🔴 45%. Le CEO voit la santé du projet en 3 secondes.

### Scoring Marketplace interne

Les équipes partagent leurs Quality Profiles. L'équipe Sécurité publie "Security Review v3" que toutes les équipes utilisent. Standard de qualité organique, bottom-up.

### GitOps for MnM Config

Quality profiles, workflows, agent configs versionnés en Git. Changement = PR + review. Les devs font confiance à Git → ils traitent la config MnM avec le même sérieux que le code.

### MnM Insights — Weekly Digest

Proactif, pas réactif. Chaque lundi : "La qualité des tests a baissé de 12%. 3 devs oublient les edge cases d'auth. Suggestion : ajouter un AC template 'auth edge cases'."

### MnM comme outil de formation

Le continuum IS un programme de formation. Junior commence en Guided, monte progressivement. Le coach personnel du dev.

### Angles morts identifiés

1. **Multi-tenancy** — Quality Profiles d'un client ne doivent jamais leak vers un autre
2. **Versioning scoring** — Quand on change un scoring, les scores historiques deviennent incomparables
3. **Agent reviewer sprawl** — 20 dimensions = 20 agents à maintenir. Prévoir consolidation
4. **Offline/déconnecté** — Le CLI doit pouvoir queue les submissions pour sync ultérieur
5. **Billing** — Plus d'autonomie = plus de compute. Le pricing doit aligner les incentives
6. **International** — Quality Profiles et insights LLM dans la langue de l'équipe

### Questions ouvertes

1. ~~Auth MCP~~ → Résolu : `claude setup-token` + token DB (`user_pods.claude_oauth_token`)
2. Scoring : entity_links confirmé comme véhicule universel (pas de table dédiée)
3. Continuum : paramètre explicite (l'user choisit) — MnM suggère mais ne force pas
4. Capture data au niveau 2 (MCP) : `mnm_complete_step()` suffit — résultat > méthode

---

## Sources fusionnées

Ce document consolide et remplace :

| Source | Date | Statut |
|--------|------|--------|
| `brainstorming/brainstorming-3-pillars-2026-04-07.md` | 2026-04-07 | Archivé |
| `brainstorming/brainstorming-vision-consolidation-2026-04-07.md` | 2026-04-07 | Archivé |
| `vision-projects-v2-2026-04-06.md` | 2026-04-06 | Archivé |
| `brainstorming-projects-v2-2026-04-06.md` | 2026-04-06 | Archivé |
| `brainstorming-projects-v2-session2-2026-04-06.md` | 2026-04-06 | Archivé |

---

*Consolidé le 2026-04-07 — Vision MnM unifiée — Prêt pour `/bmad:architecture` sur entity_links + partage universel*
