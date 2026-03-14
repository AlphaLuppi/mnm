# BMAD Party Mode via Agent Teams — Plan d'Orchestration B2B

> **COMPACT INSTRUCTIONS**: Lis ce fichier EN ENTIER après compaction.
> Regarde "Progression" pour savoir où tu en es.
> `/compact focus on B2B orchestration plan at _bmad-output/planning-artifacts/ORCHESTRATION-PLAN.md — step [N] in progress`

---

## Comment ça marche

Ce plan utilise la feature **Claude Code Agent Teams** (expérimentale).

Pour CHAQUE étape du pipeline :
1. **Le lead (toi)** crée un Agent Team avec des **teammates** — chacun est une persona BMAD
2. Les teammates travaillent EN PARALLÈLE, chacun dans sa propre session Claude Code
3. Ils communiquent entre eux via le **shared task list** et la **mailbox**
4. Le lead synthétise les contributions en UN document final
5. On passe à l'étape suivante

### Prérequis (DÉJÀ FAIT)
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` = `1` dans `~/.claude/settings.json`
- Claude Code >= 2.1.32 (installé: 2.1.71)

---

## Sources de vérité (chaque teammate les lit via CLAUDE.md du projet)

| Fichier | Contenu |
|---------|---------|
| `_bmad-output/brainstorming/brainstorming-session-tom-2026-03-12.md` | 57 vérités, 5 noyaux, CBA, hackathon, cofondateur |
| `docs/B2B-enterprise-roadmap.md` | État actuel, gaps, phases |
| `_research/nanoclaw-analysis-realtime-chat-and-containerization.md` | Patterns techniques |
| `_bmad/_config/agent-manifest.csv` | Roster agents BMAD |

---

## ÉTAPE 1 — Product Brief B2B

**Status**: PENDING
**Output final**: `_bmad-output/planning-artifacts/product-brief-b2b.md`

### Prompt à donner au lead pour créer le team :

```
Lis le plan d'orchestration dans _bmad-output/planning-artifacts/ORCHESTRATION-PLAN.md.

On exécute l'ÉTAPE 1 : Product Brief B2B.

Crée un agent team pour produire le Product Brief B2B de MnM. MnM se transforme d'un cockpit mono-user de supervision d'agents IA en une plateforme B2B enterprise d'orchestration d'agents déterministique.

Spawne ces teammates, chacun est une persona BMAD du fichier _bmad/_config/agent-manifest.csv. Chaque teammate doit lire les 3 sources de vérité listées dans le plan d'orchestration :
- _bmad-output/brainstorming/brainstorming-session-tom-2026-03-12.md (57 vérités fondamentales)
- docs/B2B-enterprise-roadmap.md (état actuel + gaps)
- _research/nanoclaw-analysis-realtime-chat-and-containerization.md (patterns techniques)

TEAMMATES À SPAWNER :

1. "Mary l'Analyste" — 📊 Business Analyst. Focus : analyse marché B2B de l'orchestration d'agents IA, paysage concurrentiel (vs Jira/Linear/ClickUp/Cursor/Windsurf/CrewAI), requirements business extraits des 57 vérités, modèle de domaine conceptuel (Company, User, Agent, Workflow, Task, Permission).

2. "John le PM" — 📋 Product Manager. Focus : vision produit & problem statement (pourquoi MnM, pourquoi maintenant), 9 personas détaillés (CEO, CTO/DSI, DPO, PM, PO, Designer, Dev, QA, Lead Tech) avec pain points extraits du brainstorming, métriques de succès par noyau de valeur, scope MVP vs Future.

3. "Victor le Stratège" — ⚡ Innovation Strategist. Focus : positionnement stratégique Blue Ocean (MnM n'est ni Jira ni un IDE ni un framework d'agents), business model (Open Source / Team / Enterprise / On-premise), go-to-market (CBA comme design partner → early adopters → scale), moat défensif (compaction, drift detection, flywheel données, switching cost).

4. "Carson le Coach" — 🧠 Brainstorming Coach. Focus : synthèse créative des 57 vérités en 5 noyaux de valeur (Orchestrateur Déterministique, Observabilité & Audit, Onboarding Cascade, Agent-to-Agent + Permissions, Dual-Speed Workflow), les idées WhatIf et CrossPol du brainstorming, ce qui rend MnM unique et excitant.

5. "Sally la Designer" — 🎨 UX Designer. Focus : experience strategy multi-rôle (CEO mode oral vs CTO mode visuel), user journeys par persona (onboarding CEO, config CTO, quotidien Dev, workflow PO), le curseur d'automatisation (manuel → assisté → auto) comme UX concept central.

6. "Winston l'Architecte" — 🏗️ System Architect. Focus : faisabilité technique (stack existante React+Express+PostgreSQL, ce qui existe déjà vs ce qui manque), contraintes architecturales pour le Product Brief, patterns Nanoclaw à adopter (containerisation, credential proxy, chat temps réel).

7. "Bob le Scrum Master" — 🏃 Scrum Master. Focus : scope MVP (Phase 1: multi-user, Phase 2: RBAC, Phase 3: scoping, Phase 4: enterprise-grade), risques et contraintes (les 9 du brainstorming — 6 réelles, 3 imaginées), priorisation, split cofondateurs (Tom=Onboarding+Observabilité, Cofondateur=Orchestrateur+Observabilité).

COORDINATION :
- Chaque teammate explore son domaine en lisant les sources
- Ils doivent se challenger entre eux et cross-talk
- Require plan approval avant que chaque teammate rédige sa section — je veux valider leurs approches
- Le Product Brief final doit être en FRANÇAIS, minimum 4000 mots, format markdown professionnel
- Quand tous ont terminé, je synthétise dans _bmad-output/planning-artifacts/product-brief-b2b.md

Utilise Sonnet pour les teammates pour optimiser les coûts. Le lead (moi) reste en Opus.
```

---

## ÉTAPE 2 — PRD B2B

**Status**: PENDING
**Output final**: `_bmad-output/planning-artifacts/prd-b2b.md`
**Bloqué par**: Étape 1

### Prompt pour le lead :

```
On exécute l'ÉTAPE 2 : PRD B2B.

Le Product Brief B2B est prêt : _bmad-output/planning-artifacts/product-brief-b2b.md
Lis-le d'abord, puis crée un agent team pour produire le PRD.

Spawne ces teammates :

1. "John le PM" — LEAD du PRD. Focus : executive summary, classification, success criteria mesurables, scoping (in/out), assumptions.

2. "Winston l'Architecte" — Focus : faisabilité de chaque FR, contraintes techniques, domain model (entités, relations, schéma DB), NFRs techniques (perf, sécurité, scalabilité).

3. "Mary l'Analyste" — Focus : domain analysis approfondie, competitive requirements (ce que chaque concurrent fait que MnM doit faire mieux), regulatory requirements (RGPD, audit).

4. "Murat le Test Architect" — 🧪 Focus : NFRs testables, quality gates, acceptance criteria patterns, test strategy par feature, performance benchmarks.

5. "Sally la Designer" — Focus : user journeys détaillés par persona (wireframes textuels), UX requirements fonctionnels, accessibility requirements.

6. "Amelia la Dev" — 💻 Focus : faisabilité technique détaillée par FR, estimation effort (S/M/L/XL), dépendances techniques, dette technique actuelle.

7. "Quinn le QA" — 🧪 Focus : scénarios de test par FR, edge cases, security testing requirements, regression testing strategy.

8. "Bob le Scrum Master" — Focus : traçabilité FR → epics futures, out-of-scope boundary, assumptions & constraints, definitions of done.

SECTIONS DU PRD (en FRANÇAIS) :
1. Executive Summary
2. Classification (type, plateforme, stack, licence)
3. Success Criteria
4. User Journeys détaillés
5. Domain Model
6. Functional Requirements (numérotés par feature block)
   - FR-MU: Multi-user & Auth
   - FR-RBAC: Roles & Permissions
   - FR-ORCH: Orchestrateur déterministique
   - FR-OBS: Observabilité & Audit
   - FR-ONB: Onboarding cascade
   - FR-A2A: Agent-to-Agent + Permissions
   - FR-DUAL: Dual-speed workflow
   - FR-CHAT: Chat temps réel avec agents
   - FR-CONT: Containerisation
7. Non-Functional Requirements
8. Out of Scope
9. Assumptions & Constraints

Minimum 6000 mots, format markdown, FRANÇAIS.
Output : _bmad-output/planning-artifacts/prd-b2b.md
```

---

## ÉTAPE 3 — UX Design B2B

**Status**: PENDING
**Output final**: `_bmad-output/planning-artifacts/ux-design-b2b.md`
**Bloqué par**: Étape 2

### Prompt pour le lead :

```
On exécute l'ÉTAPE 3 : UX Design B2B.

Lis le PRD : _bmad-output/planning-artifacts/prd-b2b.md
Lis le Product Brief : _bmad-output/planning-artifacts/product-brief-b2b.md

Crée un agent team pour la spec UX.

Teammates :

1. "Sally la Designer" — LEAD UX. Focus : design philosophy multi-rôle, core experience (cockpit unifié), design system (basé shadcn/ui + Tailwind), component strategy, UX patterns.

2. "Maya la Design Thinker" — 🎨 Focus : empathy mapping par persona, emotional response design (confiance, contrôle, progression), defining experiences (premier onboarding, premier agent lancé, première alerte drift).

3. "Caravaggio le Visual" — 🎨 Focus : 2-3 directions visuelles, visual hierarchy, information architecture, layout grid, dark/light mode.

4. "John le PM" — Focus : priorisation UX par impact business, alignement user journeys ↔ PRD FRs.

5. "Amelia la Dev" — Focus : faisabilité des composants React, intégration shadcn/ui, responsive constraints, performance UI.

6. "Victor le Stratège" — Focus : innovation UX (dual-mode oral/visuel, curseur d'automatisation comme UX concept), différenciation visuelle vs concurrents.

7. "Paige la Tech Writer" — 📚 Focus : documentation UX claire, design tokens specification, naming conventions, guidelines pour les devs.

SECTIONS (en FRANÇAIS) :
1. Design Philosophy
2. Core Experience
3. Emotional Response
4. Inspiration & References
5. Design System (palette, typo, spacing, composants)
6. Defining Experiences
7. Visual Foundation
8. Design Directions (2-3 options)
9. User Journeys Détaillés (wireframes textuels par persona)
10. Component Strategy
11. UX Patterns (navigation, feedback, notifications, permissions)
12. Responsive & Accessibility
13. Design Tokens

Minimum 5000 mots, FRANÇAIS.
Output : _bmad-output/planning-artifacts/ux-design-b2b.md
```

---

## ÉTAPE 4 — Architecture B2B

**Status**: PENDING
**Output final**: `_bmad-output/planning-artifacts/architecture-b2b.md`
**Bloqué par**: Étape 3

### Prompt pour le lead :

```
On exécute l'ÉTAPE 4 : Architecture B2B.

Lis le PRD : _bmad-output/planning-artifacts/prd-b2b.md
Lis la spec UX : _bmad-output/planning-artifacts/ux-design-b2b.md
Lis aussi la research Nanoclaw : _research/nanoclaw-analysis-realtime-chat-and-containerization.md

Crée un agent team pour l'architecture.

IMPORTANT : les teammates doivent aussi explorer le CODE EXISTANT de MnM :
- packages/db/src/schema/ (DB)
- server/src/services/ (backend)
- server/src/routes/ (API)
- server/src/realtime/ (WebSocket)
- ui/src/ (frontend)

Teammates :

1. "Winston l'Architecte" — LEAD. Focus : architecture overview, ADRs (Architecture Decision Records), deployment architecture, migration strategy.

2. "Amelia la Dev" — Focus : analyse code existant, DX, database schema changes, API design détaillé, migration paths.

3. "Murat le Test Architect" — Focus : test architecture, CI/CD pipeline, quality gates, performance testing strategy.

4. "Dr. Quinn le Problem Solver" — 🔬 Focus : problèmes complexes (gestion de compaction, multi-tenant isolation, credential proxy, drift detection algorithm).

5. "John le PM" — Focus : alignement architecture ↔ PRD, validation que chaque FR a une solution technique.

6. "Quinn le QA" — Focus : security architecture (RBAC enforcement, audit log, container isolation, path traversal prevention).

7. "Mary l'Analyste" — Focus : contraintes business sur l'architecture (compliance, RGPD, audit trail, data residency).

SECTIONS (en FRANÇAIS) :
1. Architecture Overview (diagramme ASCII)
2. Monorepo Structure
3. ADRs :
   - ADR-001: Multi-tenant (row-level security vs DB par tenant)
   - ADR-002: Auth (Better Auth + RBAC + SSO)
   - ADR-003: Orchestrateur déterministique (state machine)
   - ADR-004: Containerisation (Docker + credential proxy)
   - ADR-005: Chat temps réel (WebSocket bidirectionnel)
   - ADR-006: Agent-to-Agent communication
   - ADR-007: Observabilité (Langfuse + audit log)
   - ADR-008: Gestion de compaction
4. Database Schema Changes
5. API Design (nouveaux endpoints)
6. Security Architecture
7. Deployment Architecture
8. Performance & Scalability
9. Migration Strategy

Minimum 6000 mots, FRANÇAIS.
Output : _bmad-output/planning-artifacts/architecture-b2b.md
```

---

## ÉTAPE 5 — Epics & Sprint Planning B2B

**Status**: PENDING
**Outputs finaux**: `_bmad-output/planning-artifacts/epics-b2b.md` + `sprint-planning-b2b.md`
**Bloqué par**: Étape 4

### Prompt pour le lead :

```
On exécute l'ÉTAPE 5 : Epics & Sprint Planning.

Lis l'architecture : _bmad-output/planning-artifacts/architecture-b2b.md
Lis le PRD : _bmad-output/planning-artifacts/prd-b2b.md
Lis la spec UX : _bmad-output/planning-artifacts/ux-design-b2b.md

Crée un agent team pour le sprint planning.

CONTEXTE CRITIQUE — Split cofondateurs :
- Tom (Gabri) → Noyaux B (Onboarding) + D (Observabilité)
- Cofondateur → Noyaux A (Orchestrateur) + D (Observabilité)
- Les epics doivent permettre le travail en parallèle

Teammates :

1. "Bob le Scrum Master" — LEAD. Focus : epic decomposition, story writing (ID, titre, description, ACs Given/When/Then), sprint structure.

2. "Winston l'Architecte" — Focus : séquençage technique, dépendances entre stories, validation que l'architecture supporte le découpage.

3. "John le PM" — Focus : priorisation business par user value, MVP boundaries, success criteria par epic.

4. "Amelia la Dev" — Focus : estimation effort (S/M/L/XL), faisabilité par story, identification des stories techniques.

5. "Quinn le QA" — Focus : ACs testables, test coverage par story, definition of done.

6. "Sally la Designer" — Focus : UX requirements par story, wireframes référencés.

7. "Murat le Test Architect" — Focus : test strategy par epic, testing infrastructure stories.

DOCUMENT 1 — epics-b2b.md :
Organiser par noyau de valeur, avec pour chaque epic :
- Numéro, titre, objectif, FRs couverts
- Stories avec : ID, titre, description, ACs (Given/When/Then), effort (S/M/L/XL)
- Dépendances entre stories
- Assignation (Tom ou Cofondateur)

DOCUMENT 2 — sprint-planning-b2b.md :
- Sprint 0 : Setup
- Sprint 1-N : Stories priorisées
- Timeline estimée
- Format YAML sprint-status.yaml compatible

FRANÇAIS, minimum 5000 mots total.
```

---

## ÉTAPE FINALE — Récapitulatif

**Status**: PENDING
**Output**: `_bmad-output/planning-artifacts/RECAP-B2B-TRANSFORMATION.md`
**Bloqué par**: Toutes les étapes

Le lead compile un récapitulatif avec :
- Direction stratégique de MnM
- Résultat clé de chaque étape
- Split cofondateurs
- Timeline
- Prochaines actions

---

## Progression

| # | Étape | Status | Notes |
|---|-------|--------|-------|
| 1 | Product Brief | **DONE** | 7 agents, ~12 000 mots, 2026-03-13 |
| 2 | PRD | **DONE** | 8 agents, ~7500 mots, 9 sections + synthèse, 2026-03-14 |
| 3 | UX Design | **DONE** | 7 agents, ~6500 mots, 15 sections + synthèse, 2026-03-14 |
| 4 | Architecture | **DONE** | 7 agents, ~6000 mots, 8 ADRs + synthèse, 2026-03-14 |
| 5 | Sprint Planning | **DONE** | 7 agents, ~9500 mots (2 docs), 16 epics, 69 stories, 2026-03-14 |
| 6 | Récap Final | **DONE** | Synthèse complète, ~2000 mots, 2026-03-14 |

---

## Reprise après compaction

1. Lis CE FICHIER en entier
2. Regarde **Progression**
3. Exécute la prochaine étape PENDING dont les dépendances sont DONE
4. Copie le prompt de l'étape et crée l'agent team
5. Quand le team finit, mets à jour la progression ici (change PENDING → DONE)
6. Passe à l'étape suivante
