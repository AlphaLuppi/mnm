# Brainstorm: 3 Piliers Fondamentaux — Confiance, Contrôle, Transparence

**Date:** 2026-04-07
**Participants:** Tom (cofondateur), Claude
**Contexte:** Suite à discussion avec CEO enterprise customer + Gabriel (cofondateur)

---

## Pilier 1: CONFIANCE — Agent Review Panel (pas juste un scoring statique)

### Insight Tom
Chaque dimension de scoring sera à terme déléguée à un agent spécialisé avec ses propres MCP/skills. Quand une feature est terminée → 5 agents spawn en parallèle, chacun review UNE dimension.

### Concept: Scoring Workflow

Le scoring contract ne définit pas juste DES critères — il définit des **agents reviewers** par dimension.

```
Scoring Contract for "Dev Stage":
  dimensions:
    - name: "security"
      reviewer_agent_id: agent-security-reviewer    # a OWASP MCP, SonarQube MCP
      weight: 30
      threshold: 7   # score minimum pour auto-approve
    - name: "maintainability"
      reviewer_agent_id: agent-code-quality          # a GitNexus, complexity analysis
      weight: 25
      threshold: 6
    - name: "duplication"
      reviewer_agent_id: agent-dedup-checker          # a similarity detection skills
      weight: 15
      threshold: 8
    - name: "test_coverage"
      reviewer_agent_id: agent-test-reviewer          # lit les résultats de tests
      weight: 20
      threshold: 7
    - name: "spec_conformity"
      reviewer_agent_id: agent-spec-checker           # compare output vs ACs
      weight: 10
      threshold: 7
```

### Flow
1. Agent dev finit une étape → produit un artefact (PR, code, spec...)
2. Le scoring workflow démarre → spawn N agents reviewers EN PARALLÈLE
3. Chaque reviewer produit son score + rapport détaillé
4. Les scores sont agrégés (pondérés)
5. Si TOUS les scores > threshold → auto-approve possible
6. Si un score < threshold → gate review obligatoire pour l'humain

### Dans le modèle de données
- Chaque reviewer agent = un agent MnM réel (avec config, MCP, skills)
- Chaque review = un heartbeat_run tracé
- Les scores = entity_links (type: "scored") entre le run reviewer et l'artefact
- Les rapports = artifacts liés aux runs

### Ce que ça permet pour enterprise customer
Le CEO voit : "Feature Auth SSO — 5 agents ont review :
- Security: 9/10 ✅ (agent-security via SonarQube MCP)
- Maintenabilité: 7/10 ⚠️ (agent-quality: 3 fonctions > 50 lignes)
- Duplication: 9/10 ✅ (agent-dedup: 0.8% duplication)
- Tests: 8/10 ✅ (agent-test: 85% branch coverage)
- Conformité spec: 7/10 ⚠️ (agent-spec: 2 ACs non couverts)"

Trend sur 30 jours: la dette technique BAISSE objectivement.

---

## Pilier 2: CONTRÔLE — Chat Mode vs Auto Mode (Maturity Model)

### Insight Tom
Les étapes de workflow doivent pouvoir être exécutées soit en mode chat (interactif, comme Claude Code) soit en mode auto (autonome). L'user commence en chat, affine ses skills, et quand les KPI sont > 90% de manière consistante, il passe en auto.

### Concept: Dual Execution Mode + Maturity Progression

Chaque étape de workflow a un **execution mode** configurable par user :

| Mode | Comportement | Quand |
|------|-------------|-------|
| **Chat** (interactif) | L'user est dans une conversation live avec l'agent, peut steer en temps réel | Début, exploration, tâches sensibles |
| **Auto** (autonome) | L'agent exécute seul, produit l'output, va directement en gate review | Après maturation, tâches répétitives, skills peaufinés |

### Le Chat Mode = Claude Code DANS MnM

En mode chat, l'expérience est exactement comme Claude Code :
- L'agent a accès aux mêmes outils (MCP, file system, terminal...)
- L'user peut interagir librement, steer, corriger en live
- MAIS le contexte est enrichi par MnM (issue context, specs, ACs, scoring contract)
- ET la conversation est tracée (chaque échange est un bronze trace)
- ET l'output est capturé comme l'artefact de l'étape

En mode auto :
- L'agent reçoit le même contexte enrichi
- Il exécute autonomement
- L'output va directement en gate review
- Si gate review échoue → l'user peut repasser en chat mode pour corriger

### Maturity Tracking

MnM track la maturité par user × step :

```
User: Tom
Step: "Backend Development"
Mode actuel: Chat
Stats (30 derniers jours):
  Issues complétées: 15
  First-pass rate: 87%
  Corrections moyennes: 0.3 par issue
  5 dernières: ✅ ✅ ✅ 🔄 ✅
  
💡 Suggestion: "Ton taux d'approbation est > 85% depuis 10 issues consécutives.
   Passer en mode auto pour cette étape ?"
   [Passer en auto] [Rester en chat]
```

### Le Flow de Transition

```
CHAT MODE (début)
  └── User itère sur 10-20 issues
       └── Skills se peaufinent via feedback
            └── KPIs montent (60% → 75% → 88% → 93%)
                 └── MnM suggère : "Switch to auto?"
                      └── AUTO MODE (mature)
                           └── Si KPI baisse → alert + option retour chat
```

### Granularité
- Le mode est configurable **par étape de workflow** (pas global)
- Un dev peut être en auto sur "unit tests" mais en chat sur "architecture decisions"
- Le lead peut définir des **minimums** : "L'étape security review est TOUJOURS en chat pour les features critiques"

---

## Pilier 3: TRANSPARENCE — Improvement Cockpit + External Routing

### Insight Tom (partie amélioration)
Les leads/DSI/Lead IA qui managent les workflows ont besoin de TOUT le contexte : feedback positif ET négatif, KPIs, anomalies, corrections, interventions, pour améliorer les agents/skills.

### Concept: Agent Performance Cockpit

Vue dédiée pour les leads/responsables d'agents :

```
┌─ Agent: Backend Dev v3.2 ──────────────────────────────┐
│                                                         │
│  First-pass rate: 73% ↑ (was 58% il y a 30j)          │
│  ████████████░░░░░                                      │
│                                                         │
│  KPI Breakdown          30d Trend                       │
│  Security:     8.2/10  ↑ +1.3                          │
│  Maintainability: 6.5/10  ↓ -0.2                       │
│  Tests:        7.8/10  ↑ +0.5                          │
│  Conformité:   7.1/10  → stable                        │
│                                                         │
│  Interventions (30 derniers jours):                     │
│  ✅ Approved first pass:  22 (73%)                      │
│  🔄 Steered mid-execution: 3 (10%)                     │
│  💬 Corrections at gate:   4 (13%)                      │
│  🔁 Switched to chat:     1 (3%)                        │
│  ❌ Abandoned/redone:      0 (0%)                       │
│                                                         │
│  Top correction themes (LLM-extracted):                 │
│  1. "Gestion des erreurs réseau insuffisante" (4x)     │
│  2. "Nommage des variables pas cohérent" (2x)          │
│  3. "Tests edge cases manquants" (2x)                  │
│                                                         │
│  Feedback récent:                                       │
│  👤 Tom — 🔄 "timeout SAML trop agressif" — Issue #142 │
│  👤 Gab — ✅ approved — Issue #143                      │
│  👤 Tom — 💬 "ajouter retry logic" — steered — Issue #144│
│                                                         │
│  [📝 Améliorer le skill]  [📊 Détail par user]         │
│  [🔍 Voir tous les feedbacks]  [📈 Export rapport]     │
└─────────────────────────────────────────────────────────┘
```

### Le Flow d'Amélioration

1. Lead voit : "L'agent a 73% first-pass. Theme #1: gestion erreurs réseau (4 corrections)"
2. Lead clique "Améliorer le skill"
3. → Ouvre un **chat MnM** avec contexte pré-injecté :
   - Le skill actuel de l'agent
   - TOUS les feedbacks liés au thème "gestion erreurs réseau" 
   - Les 4 corrections spécifiques (input → output initial → feedback → output corrigé)
   - Les scores KPI par dimension
4. Le lead itère avec l'IA sur le prompt/skill de l'agent
5. Sauvegarde → nouvelle version du skill
6. Les prochaines runs utilisent le skill amélioré
7. Le lead monitore : est-ce que le first-pass rate monte ?

### RBAC pour l'amélioration
- Tout user peut donner du feedback (gate review)
- Team lead voit les feedbacks agrégés de son équipe
- DSI/Lead IA peut modifier les configs d'agents/skills/workflows
- Tag-based visibility s'applique (tu vois que les agents auxquels tu as accès)

### Insight Tom (partie routing externe)
Les Review Lenses doivent router vers les outils externes (Clickup, Gitlab MR, Figma, prototypes déployés).

### Concept: External Artifact Blocks

Les Review Lenses incluent des Blocks qui savent render des références externes :

| Block type | Source | Ce qu'il affiche |
|-----------|--------|-----------------|
| `GitlabMRBlock` | Gitlab MCP | Diff summary, status, comments, pipeline status |
| `ClickupBlock` | Clickup MCP | Ticket details, assignee, status, subtasks |
| `FigmaBlock` | Figma API/MCP | Preview embarqué de la maquette |
| `PrototypeBlock` | MnM deployment | iframe du prototype déployé |
| `ExternalLinkBlock` | N'importe quoi | Preview + metadata + deep link |
| `JiraBlock` | Jira MCP | Ticket, sprint, story points |
| `GithubPRBlock` | GitHub MCP | PR diff, checks, reviews |

Chaque MCP connecté à MnM peut avoir un Block associé pour rendre ses artefacts dans les Review Lenses. Pluggable, extensible — nouveau MCP = nouveau Block type.

### Navigation bidirectionnelle
- Depuis MnM → clic ouvre l'outil externe (deep link)
- Depuis l'outil externe → webhook/API → met à jour le statut dans MnM
- Le Review Lens montre l'état LIVE de l'artefact externe (via MCP poll ou webhook)

---

## Réponses Tom (itération 2)

### Auto-approve
Configurable par criticité/step/workflow. Doit pouvoir basculer ET le proposer. Pas de position dogmatique — c'est un dial, pas un switch binaire.

### Scoring Contract — Scope hiérarchique
Le scoring contract peut être défini à N'IMPORTE QUEL niveau :
- Projet → s'applique à tout par défaut
- Workflow → override pour ce workflow
- Step de workflow → override pour cette étape
- Feature → override pour cette feature
- Issue → override pour cette issue spécifique

Héritage avec override : issue hérite de feature qui hérite de workflow qui hérite de projet. Le plus spécifique gagne.

### Chat Mode = le chat MnM existant branché au workflow
Pas un nouveau composant — on réutilise le chat existant, connecté au contexte du workflow step.

---

## BREAKTHROUGH: MnM comme MCP Server — L'outil DERRIÈRE les outils

### Le problème fondamental
Citation CEO enterprise customer : **"Tu m'enlèves Claude Code pour me mettre un outil où j'ai pas la dernière feature de Claude Code, je suis deg et je veux pas ton outil."**

Claude Code ne va cesser d'évoluer. Si MnM essaie de REMPLACER l'expérience Claude Code dans un navigateur web, MnM perdra TOUJOURS — Anthropic aura toujours un train d'avance sur les features.

### La solution : MnM = le cerveau, Claude Code = les mains

MnM est le **management plane**. Claude Code (ou Cursor, Copilot, etc.) est le **data plane**.

Analogie : **Kubernetes n'a pas remplacé Docker — il l'orchestre.** MnM n'a pas à remplacer Claude Code — il l'orchestre.

### MnM MCP Server — les tools exposés

MnM expose un MCP server auquel Claude Code se connecte. L'user authentifié a accès à :

```
# Task Management
mnm_get_my_tasks()           → "Qu'est-ce que j'ai à faire aujourd'hui?"
mnm_get_step_context(step_id) → Contexte enrichi (issue, specs, ACs, scoring contract)
mnm_complete_step(step_id, artifact) → Marquer un step comme fait, soumettre l'artifact
mnm_submit_review(step_id, verdict, feedback) → Gate review

# Agent Control  
mnm_launch_auto_agents(step_ids) → Lancer les agents en mode auto
mnm_get_agent_status()       → Statut des agents en cours
mnm_pause_agent(run_id)      → Pause un agent
mnm_steer_agent(run_id, msg) → Injecter un message dans un agent en cours

# Project Intelligence
mnm_get_feature_map(project_id) → Feature map avec métriques
mnm_get_scoring(entity_id)   → Scores et KPI d'une entité
mnm_search_issues(query)     → Chercher des issues
mnm_get_project_context(id)  → Contexte projet pour brainstorming

# Workflow
mnm_list_workflows()         → Workflows disponibles
mnm_start_workflow(workflow_id, params) → Démarrer un workflow
mnm_get_workflow_status(id)  → Statut d'un workflow en cours

# Creation
mnm_create_issue(...)        → Créer une issue depuis Claude Code
mnm_handoff(content)         → Handoff d'un brainstorm vers un projet
mnm_link_entities(...)       → Créer des entity_links
```

### La journée type d'un dev avec MnM MCP

```
Dev ouvre Claude Code le matin.
MnM MCP est configuré (.claude/settings.json → mcp_servers: mnm)

User: "Salut Claude, connecte-toi à MnM. C'est quoi mon plan aujourd'hui?"
Claude: *mnm_get_my_tasks()*

"Voilà ton plan:
 📋 Chat mode (tu gères):
   1. Issue #142 — Backend Auth SSO (étape Dev, scoring: security 30%, tests 20%)
   2. Issue #155 — API Payments (étape Architecture)
   
 🤖 Auto mode (agents autonomes):
   3-7. Unit tests issues #143-#147
   
 ⏳ En attente de review:
   8. Issue #138 — agent a fini, KPI: security 9/10, tests 7/10
   
 Qu'est-ce qu'on fait?"

User: "Lance les auto et commençons par l'auth SSO"
Claude: *mnm_launch_auto_agents([143,144,145,146,147])*
        *mnm_get_step_context(step_142)*

"5 agents lancés en auto. Tu peux suivre sur MnM.

Contexte Auth SSO injecté:
- Issue: Implémenter retry SAML timeout (3 retries avant fail)
- Specs: [contenu de la spec]
- ACs: 
  1. Given SAML timeout, should retry 3 times
  2. Given 3 failed retries, should return clear error
- Scoring contract: Security (30%, threshold 7), ...
- Fichiers concernés: auth-saml.ts, saml-client.ts (via GitNexus)

Go?"

User: "Go, commence par lire auth-saml.ts"
Claude: *lit le fichier, développe, itère avec le user...*

--- 2 heures plus tard ---

User: "C'est bon, j'ai fini l'auth SSO, soumet"
Claude: *mnm_complete_step(step_142, { files_changed: [...], tests_added: [...] })*

"Step soumise. Les 5 agents reviewers vont scorer:
- Security reviewer...
- Maintainability reviewer...
Résultats dans ~2 min sur MnM.

Pendant ce temps, on attaque l'API Payments?"
```

### Le problème du déterminisme des workflows

MnM workflows sont déterministes : étapes chainées, inputs/outputs définis.
Claude Code conversations sont free-form : pas de structure imposée.

**Comment réconcilier ?**

#### Option 1: Hooks Claude Code (Tom's idea)
Installer des hooks `.claude/hooks/` sur les postes des users :
- `PreToolUse` hook → vérifie si l'action est dans le scope du step
- `PostToolUse` hook → capture les artifacts pour MnM
- Custom hooks → injectent le contexte MnM au début de chaque step

Problème : fragile, dépendant de la config poste par poste.

#### Option 2: Session isolation via MCP
Le MnM MCP server gère l'isolation :
- `mnm_start_step()` → injecte le contexte (system prompt enrichi)
- L'user travaille librement dans Claude Code
- `mnm_complete_step()` → capture l'output, envoie au scoring
- Pas besoin de `/clear` — le contexte MnM est juste un enrichissement

L'isolation n'est PAS stricte (l'user peut faire ce qu'il veut), mais le **cadrage est fourni** par le contexte injecté et les tools MnM disponibles.

#### Option 3: Soft boundaries (recommandé)
Pas d'enforcement strict. Le MnM MCP server fournit le contexte et capture l'output. L'user est LIBRE dans Claude Code.

**Le scoring/review se fait sur l'artifact final, pas sur le process.** Peu importe comment le dev a codé (en suivant le workflow strictement ou en freestyle) — ce qui compte c'est le résultat, et les agents reviewers le scorent objectivement.

C'est cohérent avec la philosophie de contrôle : on ne contrôle pas COMMENT les gens travaillent, on mesure CE QU'ILS produisent.

### Double interface MnM

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
│         │   (workflows, agents,│                │
│         │    scoring, traces)  │                │
│         └──────────────────────┘                │
│                                                │
└──────────────────────────────────────────────┘
         ▲                    ▲
         │                    │
    ┌────┴────┐         ┌────┴──────────┐
    │ Browser  │         │ Claude Code    │
    │ (PM, CEO,│         │ Cursor         │
    │  QA, DSI)│         │ Copilot        │
    │          │         │ Any AI tool    │
    └──────────┘         └───────────────┘
```

### L'insight stratégique

**MnM web UI** = pour ceux qui supervisent (PM, CEO, QA, DSI, Lead IA)
- Dashboards, Feature Map, Agent Performance Cockpit
- Review Lenses, configuration des workflows
- Vue macro, configuration, monitoring

**MnM MCP Server** = pour ceux qui exécutent (devs, agents)
- Get tasks, execute steps, submit artifacts
- Launch agents, get context, create issues
- Travail quotidien dans l'outil préféré

Les deux sont des **projections du même système**. Pas de feature exclusive à l'un ou l'autre.

---

---

## Corrections Tom (itération 3) — FONDAMENTALES

### MCP Server : on perd le tracing, et c'est OK

Quand l'user travaille via MCP (depuis Claude Code), on perd les traces bronze/silver/gold que MnM capture quand les agents tournent dans les sandboxes. Options envisagées :
- MLflow gateway → pas sûr que 100% utile
- Upload du .json de session → overkill

**Décision philosophique : on mesure le RÉSULTAT, pas la MÉTHODE.** La méthode viendra de l'analyse des résultats. Si le scoring est bon, le process était bon — peu importe comment. Si le scoring est mauvais, le feedback ciblé permettra d'améliorer.

C'est cohérent avec le pilier Contrôle : on ne flique pas les gens, on mesure ce qu'ils produisent.

### Scoring : PAS hiérarchique — c'est un tag universel

**CORRECTION MAJEURE.** Mon modèle hiérarchique (projet → workflow → step → feature → issue) est FAUX car :
- Un workflow n'est PAS forcément dans 1 projet
- Une feature n'est PAS forcément dans 1 step de workflow
- Une issue n'est PAS forcément dans 1 feature

**Le scoring est comme les tags — ça s'attache à N'IMPORTE QUOI.**

```
Scoring Contract = définition réutilisable de critères de qualité
  Peut s'attacher à :
    - Node (feature, AC, requirement...)
    - Issue
    - Workflow
    - Step de workflow
    - Agent
    - Équipe (basé sur KPI sprint)
    - Sprint
    - Projet
    - N'importe quelle entité
    
  Plusieurs scoring contracts peuvent s'attacher à la même entité
  Méthodes de calcul : déterministe (formule), LLM-as-a-judge, agent reviewer, human review, hybride
```

Pas d'héritage, pas de hiérarchie. Juste des attachements via entity_links.

Exemples :
- Scoring "Code Quality" attaché à toutes les issues dev → agent reviewer avec SonarQube MCP
- Scoring "Sprint Health" attaché aux sprints → formule (velocity + issues done/planned)
- Scoring "Agent Reliability" attaché aux agents → déterministe (first-pass rate + error rate)
- Scoring "Compliance HAS" attaché aux features réglementées → LLM-as-a-judge contre cahier des charges
- Scoring "Team Performance" attaché à une équipe → agrégation des KPI de ses membres

### Autonomy Continuum — PAS un switch binaire chat/auto

**CORRECTION MAJEURE.** Ce n'est pas "chat mode vs auto mode". C'est un **continuum d'autonomie** en 6 niveaux :

```
Niveau 0: Human doing the job WITHOUT AI
          L'humain fait tout seul, pas d'IA
          
Niveau 1: Human doing the job WITH AI
          L'humain utilise Claude Code / Cursor en standalone
          Aucun lien avec MnM
          
Niveau 2: Human + AI + MnM context (OUTSIDE MnM)
          L'humain utilise Claude Code avec le MnM MCP server
          MnM fournit le contexte (issues, specs, scoring) mais l'humain drive
          Résultat soumis à MnM pour scoring
          
Niveau 3: Human doing the job INSIDE MnM
          L'humain travaille dans le chat MnM (mode chat dans un workflow step)
          MnM capture tout (traces, feedback, iterations)
          Full visibility pour les leads
          
Niveau 4: MnM doing the job WITH human in the loop
          L'agent MnM exécute en auto, l'humain review en gate
          Le scoring des agents reviewers informe la décision
          L'humain peut steer/corriger si besoin
          
Niveau 5: MnM does EVERYTHING autonomously
          Auto-approve quand tous les KPIs > threshold
          L'humain est notifié mais n'intervient pas
          Full autopilot
```

**Chaque entité/step/workflow peut être à un niveau différent.** Un dev peut être au niveau 2 pour "architecture decisions" (il veut garder Claude Code) et au niveau 4 pour "unit tests" (il fait confiance aux agents).

**La progression est driven par les KPIs :**
```
KPIs bas → MnM ne propose pas d'augmenter l'autonomie
KPIs moyens (> 70%) → MnM suggère le niveau suivant
KPIs élevés (> 90% pendant 10+ runs) → MnM recommande fortement
L'user CHOISIT toujours. Jamais forcé.
Si KPIs baissent après progression → alerte + option de redescendre
```

**C'est le mécanisme unifié qui répond aux 3 piliers :**
- **CONFIANCE** : les KPIs prouvent la confiance, enabling progression d'autonomie
- **CONTRÔLE** : l'user choisit son niveau sur le spectre, jamais forcé
- **TRANSPARENCE** : chaque niveau a la visibilité appropriée

---

## Questions ouvertes (itération 3)

1. Auth MCP : comment le dev s'authentifie à MnM depuis Claude Code ? Token, OAuth, `claude setup-token` existant ?
2. Le scoring "comme les tags" : est-ce qu'on étend la table entity_links ou on fait un scoring_attachments dédié ? (Les entity_links sont déjà le graph universel)
3. Le continuum d'autonomie : est-ce un paramètre explicite (l'user choisit son niveau) ou implicite (MnM détecte comment l'user travaille et classe automatiquement) ?
4. Quand l'user est au niveau 2 (MCP depuis Claude Code), comment on capture assez de data pour calculer le scoring de l'artifact final ? Le `mnm_complete_step()` suffit-il ?

---

## Synthèse des concepts clés à creuser en session BMAD

### Concepts validés
1. **Scoring universel "comme les tags"** — s'attache à n'importe quelle entité via entity_links. Méthode de calcul configurable (agent reviewer, déterministe, LLM-as-a-judge). Pas de hiérarchie, juste des attachements.
2. **Autonomy Continuum (6 niveaux)** — de "human sans IA" à "full autopilot". Progression driven par KPIs. L'user choisit toujours. Chaque entité/step à un niveau différent.
3. **MnM = management plane** — MnM MCP Server pour Claude Code/Cursor. MnM Web UI pour supervision. Même backend, même data. Ne jamais concurrencer l'outil du dev.
4. **Résultat > Méthode** — le scoring se fait sur l'artifact, pas sur le process. Pas de tracing intrusif via MCP.
5. **Review Lenses = Blocks composables** — l'action de validation est universelle (approve/reject/comment), la vue est personnalisée par rôle via Blocks.
6. **Agent Review Panel** — scoring par agents spécialisés en parallèle, chacun avec ses MCP/skills.
7. **Improvement Cockpit** — les leads améliorent agents/skills via un chat MnM avec tout le contexte feedback injecté.

### À creuser en session BMAD
- Priorisation : quel pilier/concept construire en premier pour enterprise customer
- Architecture technique du MnM MCP Server
- Data model précis du scoring (extension d'entity_links vs table dédiée)
- UX des Review Lenses concrètes (wireframes/maquettes)
- Comment le continuum d'autonomie se traduit en UI/config
- Le flow d'amélioration des skills (versioning, rollback, A/B testing de prompts)

---

*Brainstorm terminé — 2026-04-07 — 3 itérations — Prêt pour session BMAD*
