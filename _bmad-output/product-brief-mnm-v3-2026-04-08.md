# Product Brief V3 — MnM (Make no Mistake)

**Version :** 3.0
**Date :** 2026-04-08
**Auteur :** Tom Andrieu (cofondateur), assisté par Claude
**Remplace :** `product-brief-b2b.md` (V2, 2026-03-13)
**Référence vision :** `vision-mnm-2026-04-07.md`

---

## 1. Résumé Exécutif

**MnM est le management plane de l'IA coding.** C'est un cockpit de supervision B2B self-hosted qui orchestre des équipes complètes d'agents IA — dev, QA, PM, infra, DSI, CEO — sans remplacer les outils des développeurs. MnM se branche derrière Claude Code, Cursor ou n'importe quel outil IA via MCP, comme Kubernetes orchestre Docker sans le remplacer.

**Pour qui :** Toute entreprise qui déploie des agents IA coding et a besoin de confiance (scoring objectif), de contrôle (autonomie progressive) et de transparence (visibilité pour chaque rôle).

**Pourquoi maintenant :** L'adoption massive de l'IA coding se fait SANS supervision. Aucun outil ne combine orchestration + scoring + continuum d'autonomie. MnM est le seul à occuper ce croisement.

---

## 2. Le Problème

### Le constat

Les entreprises adoptent massivement l'IA coding (Claude Code, Cursor, Copilot) mais **n'ont aucun moyen de superviser, mesurer et améliorer** ce que produisent ces agents. Résultat :

- **Le CEO ne sait pas** ce que font les agents, combien ça coûte, si c'est fiable
- **Le CTO n'a aucune traçabilité** — les agents exécutent sans audit, sans standards, sans gouvernance
- **Le dev utilise l'IA en solo** — pas de partage de pratiques, pas de feedback loop, pas de progression mesurable
- **Le QA découvre les problèmes en prod** — pas de gate review systématique
- **Le PM fait du shadow-AI** — brainstorme sur des outils non-gouvernés (ChatGPT, Vercel), l'info ne remonte pas

### L'analogie

C'est comme si des entreprises faisaient tourner 50 containers Docker sans Kubernetes : ça marche au début, mais sans orchestration, monitoring et gouvernance, c'est ingérable à l'échelle.

### Pourquoi maintenant

- Le marché de l'orchestration IA passe de **11 Mrd USD (2025) à 30 Mrd USD (2030)** — CAGR 22,3%
- Gartner projette que les agents IA commanderont **15 000 Mrd USD en achats B2B d'ici 2028**
- Cursor valorisé à 29,3 Mrd USD, Windsurf à 30M ARR — l'IA coding explose mais sans supervision
- **Aucun concurrent** ne combine orchestration + scoring + continuum d'autonomie

### Impact si non résolu

Les entreprises qui n'outillent pas la supervision IA subiront :
- Dette technique invisible (agents non-scorés, pas de feedback loop)
- Risques de sécurité et compliance (agents sans gouvernance)
- Perte de compétitivité (pas d'amélioration continue des pratiques IA)
- Shadow-AI généralisée (chaque employé avec ses outils non-tracés)

---

## 3. Audience Cible

### Utilisateurs primaires

| Persona | Profil | Pain principal | Ce que MnM résout |
|---------|--------|----------------|-------------------|
| **CTO / DSI** | Responsable tech, 35-55 ans, tech-savvy | Aucune visibilité ni gouvernance sur les agents | Dashboard de supervision, audit trail, policies |
| **Lead Dev / Lead IA** | Senior dev, gère une équipe + des agents | Pas de feedback loop, amélioration des agents manuelle | Improvement Cockpit, Quality Profiles, Flywheel |
| **Développeur** | Utilise Claude Code/Cursor quotidiennement | IA en solo, pas de contexte partagé, pas de scoring | MnM MCP Server dans son outil, scoring automatique |
| **PM / PO** | Product owner, brainstorme et spécifie | Shadow-AI, handoff lossy vers les devs | Chat-first avec handoff structuré vers les projets |

### Utilisateurs secondaires

| Persona | Interaction avec MnM |
|---------|---------------------|
| **CEO** | Confidence Badge, Project Health Score, Autonomy Leaderboard |
| **QA** | Gate review, tests/coverage via Feature Map, AC lifecycle |
| **DPO / Compliance** | Audit trail, Quality Profiles réglementaires, Feature Map conformité |
| **Designer** | Notifié dans le workflow, Review Lenses avec preview Figma/prototype |

### Les 3 besoins fondamentaux

1. **Confiance** — "Je veux des preuves objectives que mes agents produisent du travail de qualité"
2. **Contrôle** — "Je veux choisir le niveau d'autonomie de chaque agent, sans être forcé"
3. **Transparence** — "Je veux voir l'état de mes projets, agents et équipes en un coup d'oeil, adapté à mon rôle"

---

## 4. La Solution

### Le positionnement

**MnM = le Kubernetes de l'IA coding.**

MnM est le management plane. Claude Code / Cursor / Copilot est le data plane. MnM n'a pas à remplacer l'outil du dev — il l'orchestre.

Citation CEO CBA : *"Tu m'enlèves Claude Code pour me mettre un outil où j'ai pas la dernière feature de Claude Code, je suis deg et je veux pas ton outil."*

### Les 3 piliers

**Pilier 1 : CONFIANCE — Scoring objectif**
- **Quality Profiles** : critères de qualité réutilisables qui s'attachent à n'importe quelle entité (comme les tags)
- **Agent Review Panel** : N agents reviewers spécialisés scorent en parallèle (sécurité, maintenabilité, tests, conformité)
- **Gate review** : humain valide/rejette avec feedback structuré → feedback loop automatique

**Pilier 2 : CONTRÔLE — Autonomie progressive**
- **Autonomy Continuum** : 6 niveaux de Manual à Autonomous, KPI-driven
- Chaque step/workflow/agent peut être à un niveau différent
- L'user choisit toujours — MnM suggère mais ne force pas
- Niveau 5 verrouillé par défaut — déblocable uniquement par preuve KPI

**Pilier 3 : TRANSPARENCE — Visibilité par rôle**
- **Improvement Cockpit** : KPIs, trends, thèmes de correction, flow d'amélioration des skills
- **Feature Map** : vue centrale du produit (specs → issues → code → tests → ACs)
- **Review Lenses** : Blocks composables par rôle, intégration outils externes (GitHub, Figma, Jira...)
- **Confidence Badge** : score unique hero metric visible partout

### Le Flywheel

Le mécanisme central qui rend MnM impossible à copier :

```
Agent exécute → Quality Profile score → Gate review humaine
→ Feedback → Improvement Cockpit → Skill amélioré
→ Agent exécute (mieux) → Score monte → Autonomie augmente
```

Chaque cycle rend MnM plus intelligent pour CE client. Moat d'usage propriétaire.

### Double interface

| Interface | Pour qui | Ce qu'on y fait |
|-----------|---------|----------------|
| **Web UI** | PM, CEO, QA, DSI, Lead | Dashboards, Feature Map, Cockpit, Review Lenses, configuration |
| **MCP Server** | Devs, agents | Get tasks, submit artifacts, launch agents, create issues — depuis Claude Code |

Même backend, même data, même auth. Projections du même système.

### Features clés

**Infrastructure (construit)**
- entity_links : graphe universel de relations (traceability, scoring, partage, attachement)
- nodes : arbre générique de structure produit (Feature Map)
- Config Layers : MCP Servers, Skills, Hooks, Settings — merge par priorité
- Sandbox Docker per-user : isolation, credential proxy, token OAuth par run
- RBAC dynamique + isolation par tags + RLS PostgreSQL
- Chat collaboratif + artifacts + RAG + dossiers
- Pipeline traces Bronze/Silver/Gold
- Audit immutable + A2A

**Plateforme (en cours)**
- Blocks Platform : View Presets + Dashboard intelligent + Agent Forms + Inbox interactive
- MnM MCP Server : 26+ tools exposés
- Partage universel via entity_links (tags + users directs)
- Git Provider universel + Credential Store générique

**Vision (planifié)**
- Quality Profiles + Agent Review Panel
- Autonomy Continuum (6 niveaux)
- Improvement Cockpit
- Feature Map + Traceability chain
- Handoff (chat → projet)
- Shadow Mode, Pair Scoring
- Agent Recipes, Quality Profile templates

---

## 5. Objectifs Business

### Objectifs SMART

| Objectif | Mesure | Échéance |
|----------|--------|----------|
| **Premier client en production** | CBA (50 devs) utilise MnM quotidiennement | T3 2026 |
| **Time to First Value < 30 min** | Nouvel utilisateur productif en 30 min (Connected, defaults intelligents) | T2 2026 |
| **ARR 200k EUR** | 3-5 clients enterprise payants | T4 2026 |
| **Rôles non-dev actifs > 30%** | PM, QA, CEO utilisent la Web UI régulièrement | T4 2026 |
| **Taux respect workflows > 90%** | Agents suivent les workflows déterministes | T3 2026 |
| **Drift detection < 5 min** | Détection automatique de dérive specs/code | T3 2026 |

### Métriques de succès

- **Adoption** : % d'agents supervisés (vs en solo) par entreprise
- **Qualité** : First-pass rate moyen des agents (cible > 80%)
- **Autonomie** : Niveau moyen du continuum par entreprise (cible > 2.5)
- **Engagement** : Sessions hebdomadaires par rôle (dev via MCP, PM via Web UI)
- **Rétention** : Churn < 5% mensuel
- **Flywheel** : Nombre de cycles scoring → amélioration → re-score par mois

### Valeur business

- **Pour le client** : -40% MTTR, 80% réflexion / 20% exécution (inversé vs aujourd'hui), capture du savoir tacite
- **Pour MnM** : Moat d'usage (données du flywheel propriétaires au client), network effects intra-entreprise (50 devs → scoring calibré sur la vraie codebase)

---

## 6. Périmètre

### In scope (V3)

**Infrastructure**
- entity_links (graphe universel) — remplace toutes les tables de jointure ad-hoc
- nodes (arbre produit) — Feature Map, ACs, requirements
- Partage universel (private → shared via tags/users → company)
- MnM MCP Server (26+ tools)

**Scoring & Autonomie**
- Quality Profiles (configuration, attachement via entity_links)
- Agent Review Panel (scoring parallèle multi-dimensions)
- Autonomy Continuum (6 niveaux, UI de configuration)
- Improvement Cockpit (KPIs, trends, flow d'amélioration)

**Projet & Traceability**
- Feature Map (vue centrale)
- Traceability chain (specs → issues → code → tests)
- Handoff (chat → document structuré → projet)
- Smart Change Impact

**Plateforme**
- Blocks Platform complète (F2 Dashboard + F3 Agent Forms + F4 Inbox)
- WebSocket tag-filtering (isolation visibilité)
- Config Layers améliorés (scope simplifié private/company)

### Out of scope (V3)

- Import Jira/Linear automatique (V4)
- MnM CLI tool-agnostic (V4)
- Marketplace de Quality Profiles cross-clients (V5)
- Multi-tenant SaaS (V5 — actuellement self-hosted single-tenant)
- Agent Recipes marketplace (V5)
- GitOps pour config MnM (V4)
- Billing/pricing automatisé (V4)
- Internationalisation (V4)

### Considérations futures

- **MnM pour le non-code** : rédaction marketing, support client, data analysis — même flywheel, élargissement TAM
- **MnM comme outil de formation** : le continuum IS un programme de formation
- **Canary scoring** : nouveau Quality Profile sur 20% des issues pendant 1 semaine avant rollout
- **Block SDK** : clients créent leurs propres Blocks

---

## 7. Parties Prenantes

| Partie prenante | Rôle | Influence | Intérêt |
|----------------|------|-----------|---------|
| **Tom Andrieu** | Cofondateur, lead technique | Haute | Architecture, vision technique, dev full-stack |
| **Gabriel** | Cofondateur, dev | Haute | Implémentation, features B2B, UX |
| **Niko** | CEO | Haute | Vision business, relations client, stratégie |
| **CEO CBA** | Client pilote | Haute | Validation terrain, feedback sur les 3 piliers, 50 devs potentiels |
| **Équipe SRE CBA** | Partenaire technique | Moyenne | Sécurité sandbox, anti-shadow-AI, infrastructure |
| **Studio Manifeste** | Structure porteuse | Moyenne | Ressources, positionnement marché |

---

## 8. Contraintes et Hypothèses

### Contraintes

- **Self-hosted** : 1 instance = 1 entreprise. Single-tenant. `company_id` auto-injecté, jamais exposé
- **Pas de polling** : toutes les mises à jour temps réel via SSE/WebSocket
- **RBAC dynamique** : rôles et permissions en DB, jamais hardcodés
- **Tag-based isolation** : les tags contrôlent la visibilité de tout
- **Stack figée** : React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo Bun
- **Équipe réduite** : 2 cofondateurs dev + 1 CEO. Pas de levée de fonds prévue à court terme
- **Dépendance Claude Code** : si Anthropic change l'API MCP/hooks, adaptation nécessaire (mitigé par abstraction adapter)
- **GPG signing** : souvent timeout, contournable avec `-c commit.gpgsign=false`

### Hypothèses

- Les entreprises adopteront un outil de supervision IA SI la valeur est prouvée rapidement (< 30 min)
- Le MCP (Model Context Protocol) devient le standard d'interopérabilité des outils IA
- CBA est représentatif du marché enterprise (50 devs, multi-rôles, compliance)
- Le pricing enterprise (10-30k EUR/an) est acceptable pour la valeur fournie
- L'adoption se fait en cercles concentriques (1 équipe → département → entreprise)
- Le scoring agent bootstrappé par les humains convergera vers une qualité suffisante pour l'auto-approve

---

## 9. Critères de Succès

### Succès produit

- Un CTO peut configurer MnM pour son équipe en < 1 jour
- Un dev est productif via MnM MCP en < 30 minutes
- Un CEO voit la santé de ses projets en 3 secondes (Confidence Badge)
- Le first-pass rate des agents augmente de > 20% après 3 mois d'utilisation du flywheel
- Au moins 3 rôles différents (dev, PM, lead) utilisent MnM hebdomadairement

### Succès business

- CBA en production avec > 10 agents supervisés (T3 2026)
- 3 clients payants à 10-30k EUR/an (T4 2026)
- Rétention > 95% mensuelle
- Le flywheel est mesurable : cycles scoring → amélioration comptabilisés

### Succès technique

- 0 downtime sur les migrations entity_links / nodes
- Performance : < 200ms sur les queries entity_links (avec index composites)
- Toutes les tables ad-hoc migrées vers entity_links sans perte de fonctionnalité
- MnM MCP Server fonctionnel dans Claude Code ET Cursor

---

## 10. Timeline

### Phase 0 : Foundation (en cours → T2 2026)

- entity_links + nodes (schema, migration, service, routes)
- Partage universel (remplacement folder_shares, scope/visibility)
- Config Layers simplifiés (private/company)
- Blocks Platform complète (F2, F3, F4)
- WebSocket tag-filtering
- MnM MCP Server v1

### Phase 1 : Scoring (T2-T3 2026)

- Quality Profiles (configuration, templates par métier)
- Gate review humaine (approve/reject/comment avec feedback structuré)
- Confidence Badge
- Amélioration feedback loop basique

### Phase 2 : Cockpit (T3 2026)

- Improvement Cockpit (KPIs, trends, thèmes LLM-extracted)
- Feature Map v1 (nodes + traceability)
- Agent Review Panel (1-2 dimensions automatisées)
- **CBA en production**

### Phase 3 : Continuum (T3-T4 2026)

- Autonomy Continuum (6 niveaux, UI configuration)
- Shadow Mode (validation empirique)
- Pair Scoring (humains calibrent les agents scorers)
- Agent Review Panel complet (N dimensions)
- **Premiers clients payants**

### Phase 4 : Scale (T4 2026+)

- Import Jira/Linear
- MnM CLI tool-agnostic
- GitOps for config
- Internationalisation
- Billing automatisé

---

## 11. Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|-----------|
| **Microsoft lance un concurrent intégré** | Haute | Critique | Agilité + moat du flywheel + positionnement unique (multi-tool, pas IDE-bound) |
| **CBA ne convertit pas en production** | Moyenne | Haute | Time to First Value < 30 min, adoption cercles concentriques, pas de big-bang |
| **Scoring gaming** | Moyenne | Moyenne | Varier les dimensions + Pair Scoring humain + recalibration suggérée |
| **Dépendance API MCP Anthropic** | Basse | Haute | Abstraction adapter déjà en place, support multi-tool (Cursor, Copilot) |
| **Équipe trop petite** | Haute | Haute | Focus agressif (phases séquentielles), tooling IA pour multiplier la productivité |
| **Resistance des devs ("surveillance")** | Moyenne | Haute | Narratif "amplificateur, pas contrôleur", résultat > méthode, MnM = coach pas flic |
| **Feature creep (chaque client veut son Block)** | Moyenne | Moyenne | Block SDK futur, focus produit > framework |
| **Complexity budget dépassé** | Moyenne | Moyenne | entity_links comme abstraction universelle, pas de tables ad-hoc |
| **Offline/déconnecté (dev en avion)** | Basse | Basse | CLI avec queue pour sync ultérieur (V4) |

---

## 12. Paysage Concurrentiel

### Positionnement unique

```
                    Supervision ↑
                                │
            MnM ★               │
         (orchestration +       │
          scoring +             │
          continuum)            │
                                │
    ────────────────────────────┼──────────────── Orchestration →
                                │
         Langfuse               │         CrewAI / AutoGen
         Patronus               │         (frameworks,
         Braintrust             │          pas de produit)
         (observabilité,        │
          pas d'orchestration)  │
                                │
                                │    Cursor / Windsurf
                                │    (IDE, pas supervision)
                                │
                                │    Jira
                                │    (pas agent-native)
```

**White space :** MnM est le seul à combiner orchestration déterministe + scoring objectif + continuum d'autonomie + multi-rôle.

### Analyse concurrentielle

| Concurrent | Ce qu'ils font | Ce qu'ils NE font PAS | Probabilité de copier MnM |
|-----------|---------------|---------------------|--------------------------|
| **Langfuse** | Observabilité LLM, tracing | Orchestration, workflows, scoring, continuum | Faible (focus obs) |
| **Braintrust** | Évaluation, scoring | Workflows, agents, continuum, multi-rôle | Faible (focus eval) |
| **CrewAI** | Framework multi-agent | Produit fini, UI, scoring, governance | Moyenne (framework → produit = réécriture) |
| **Cursor** | IDE IA premium | Supervision, multi-rôle, scoring, governance | Faible (ADN code, pas management) |
| **Jira** | Project management | Agent-native, IA orchestration, scoring | Moyenne (dette massive, pivot lent) |
| **Microsoft** | Agent Framework + Azure | Produit fini autonome spécialisé | **Haute** (mais lent, generic, pas coding-focused) |

### Avantage défensif (moat)

1. **Flywheel propriétaire** — les données du cycle scoring → amélioration sont uniques à chaque client
2. **Network effects intra-entreprise** — 50 devs = scoring calibré sur la vraie codebase, impossible à répliquer
3. **Switching cost** — Quality Profiles + entity_links + workflows configurés = investissement client
4. **First mover** — aucun concurrent direct dans le croisement orchestration + scoring + continuum

---

## 13. Modèle Économique

### Pricing envisagé

| Tier | Cible | Prix estimé | Inclus |
|------|-------|-------------|--------|
| **Connected** (gratuit) | Dev solo | 0 EUR | MnM MCP Server, scoring basique, 1 agent |
| **Team** | Équipe 5-20 | 10-15k EUR/an | Multi-agents, Quality Profiles, Improvement Cockpit |
| **Enterprise** | 20-200+ | 20-50k EUR/an | Continuum complet, Shadow Mode, SSO, audit, SLA |

### Flywheel d'acquisition

```
Dev solo (gratuit, Connected)
  → Équipe (payant, Team)
    → Département (Enterprise)
      → Entreprise entière
```

Le niveau Connected est une **killer feature standalone** : un dev connecte MnM MCP → scoring de ses PRs, tracking de progression, suggestions d'amélioration. Hook d'acquisition naturel.

---

## 14. Synthèse : Pourquoi MnM Gagne

1. **Timing parfait** — Adoption massive de l'IA coding SANS supervision. MnM arrive au bon moment.
2. **Positionnement inattaquable** — Pas un IDE, pas un framework. Le management plane. Niche vide.
3. **Flywheel défensif** — Chaque cycle rend MnM plus intelligent pour CE client. Moat d'usage.
4. **Architecture prête** — 70% de l'infra est construite (51+ tables, 41 RLS, agents, sandbox, traces, config layers).
5. **Validation terrain** — CEO CBA a validé les 3 piliers. 50 devs potentiels pour le POC.
6. **Narrative puissante** — "L'agent PROUVE qu'il mérite l'autonomie. Le dev est le JUGE." Élimine la résistance au changement.

---

## Annexe A : Évolution V2 → V3

| Concept V2 (mars 2026) | Évolution V3 (avril 2026) |
|------------------------|--------------------------|
| 5 noyaux de valeur | 3 piliers (Confiance, Contrôle, Transparence) |
| Scoring Contracts | Quality Profiles (renommage business-friendly) |
| Dual-speed (chat/auto) | Autonomy Continuum (6 niveaux nommés) |
| Tables ad-hoc (folder_shares, etc.) | entity_links (graphe universel) |
| Pas de Feature Map | nodes + Feature Map (vue centrale produit) |
| MnM Web UI uniquement | Dual interface Web UI + MnM MCP Server |
| Scope/visibility confus | Partage universel (private → shared → company) |
| Pas de flywheel formalisé | Flywheel MnM = concept unificateur |
| Blocks non définis | Blocks Platform (4 features, architecture complète) |
| Config JSONB opaque | Config Layers structurés (priorité, merge, OAuth) |

## Annexe B : Documents de Référence

| Document | Rôle |
|----------|------|
| `vision-mnm-2026-04-07.md` | Vision consolidée (5 parties, référence stratégique) |
| `blocks-platform-architecture.md` | Architecture Blocks Platform |
| `dashboard-v2-architecture.md` | Architecture Dashboard V2 |
| `README.md` | Documentation technique et features |
| `CLAUDE.md` | Décisions d'architecture et conventions |

---

*Product Brief V3 — MnM — 2026-04-08*
*Studio Manifeste / AlphaLuppi*
