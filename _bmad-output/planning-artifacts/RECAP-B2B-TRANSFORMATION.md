# RÉCAP — Transformation B2B de MnM

> **Date** : 2026-03-14 | **Statut** : Pipeline complet — 5 étapes livrées
> **Méthode** : BMAD Party Mode via Agent Teams (Claude Code Agent Teams)
> **Orchestration** : 6 sessions d'agent teams, 35+ agents au total, ~40 000 mots produits

---

## 1. Direction Stratégique

### MnM : Tour de Contrôle IA Enterprise

MnM se transforme d'un **cockpit mono-user de supervision d'agents IA** en une **plateforme B2B enterprise d'orchestration d'agents déterministe**.

**Positionnement** : À l'intersection de trois océans rouges (gestion de projet, IDE IA, frameworks agentiques), MnM occupe un white space unique — **orchestration déterministe + supervision multi-rôle pour l'ensemble de l'organisation**.

> MnM est à l'orchestration d'agents IA ce que Kubernetes est à l'orchestration de containers.

### Le Problème

L'information se dégrade à chaque passage de relais entre rôles (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles sont aspirationnels, jamais appliqués. Les agents IA sont puissants mais dérivent sans contrôle — comme l'a constaté le CTO de CBA au hackathon de mars 2026.

### La Solution : 5 Noyaux de Valeur

| Noyau | Nom | Proposition |
|-------|-----|-------------|
| **A** | Orchestrateur Déterministe | L'agent fait EXACTEMENT ce qu'on lui dit. Workflows imposés, pas suggérés. |
| **B** | Observabilité & Audit | Voir tout, tracer tout, prouver tout. Audit immutable, résumé LLM. |
| **C** | Onboarding Cascade | Du CEO au dev, chaque niveau configure son périmètre. |
| **D** | Agent-to-Agent + Permissions | Communication inter-agents avec human-in-the-loop. |
| **E** | Dual-Speed Workflow | Vitesse humaine + vitesse machine en parallèle. Curseur d'automatisation. |

---

## 2. Résultat Clé de Chaque Étape

### Étape 1 — Product Brief (7 agents, ~12 000 mots)

**Livré** : `product-brief-b2b.md`
**Contenu** : Analyse marché (13,5 Mrd USD, CAGR 22,3%), paysage concurrentiel (Jira/Linear/Cursor/CrewAI), vision produit, 9 personas détaillés (CEO→QA), 5 noyaux de valeur, positionnement Blue Ocean, business model (Open Source / Team / Enterprise / On-premise), go-to-market via CBA comme design partner, modèle de domaine conceptuel.

**Décision clé** : MnM n'est ni Jira, ni un IDE, ni un framework d'agents — c'est une catégorie nouvelle.

### Étape 2 — PRD (8 agents, ~7 500 mots)

**Livré** : `prd-b2b.md` + 6 fichiers de sections
**Contenu** : Executive summary, classification, 26 success criteria, user journeys détaillés, domain model (48 tables = 38 existantes + 10 nouvelles), 9 blocs de functional requirements (~70 requirements numérotés), NFRs (performance, sécurité, accessibility), out of scope, test strategy, roadmap.

**Décision clé** : Timeline 8-10 semaines en 4 phases (Multi-user → RBAC → Scoping → Enterprise). Faille critique identifiée : `hasPermission()` (access.ts:45-66) ne lit jamais le scope JSONB — trou de sécurité #1.

### Étape 3 — UX Design (7 agents, ~6 500 mots)

**Livré** : `ux-design-b2b.md` + 7 fichiers de sections
**Contenu** : Design philosophy (1 cockpit, 5 modes coexistants, 9 personas), curseur d'automatisation (concept UX central), emotional response design, 3 design directions (recommandation : Direction C "Adaptive Cockpit" — dark/light adaptatif), design system (shadcn/ui + Tailwind), 41 composants, 13 pages, design tokens CSS, WCAG 2.1 AA.

**Décision clé** : Le curseur d'automatisation (Manuel → Assisté → Auto) avec plafond hiérarchique est l'innovation UX distinctive de MnM.

### Étape 4 — Architecture (7 agents, ~6 000 mots)

**Livré** : `architecture-b2b.md` + 7 fichiers de sections
**Contenu** : Architecture 7 couches (présentation → API → services → data → real-time → agent runtime → sécurité), 8 ADRs documentés, 10 nouvelles tables + 5 modifications, ~30 endpoints API, sécurité 5 couches Nanoclaw (containers éphémères, mount allowlist, credential proxy, shadow .env, réseau isolé), CI/CD 7 quality gates, 3 modes de déploiement, migration 4 phases zero-downtime, compliance RGPD + AI Act.

**Décision clé** : Multi-tenant par Row-Level Security PostgreSQL (pas DB par tenant). State machine XState pour l'orchestrateur. Credential proxy HTTP interne (port 8090).

### Étape 5 — Epics & Sprint Planning (7 agents, ~9 500 mots)

**Livrés** : `epics-b2b.md` + `sprint-planning-b2b.md` + 7 fichiers de sections
**Contenu** : 16 epics, ~69 stories, 252-307 SP total, 100% des 52 FRs couverts, 8 ADRs mappés, 42 critères DoD (4 niveaux), 31 ACs Given/When/Then, 42 edge cases, ~525 tests estimés, timeline 13 semaines (MVP CBA) à 20-22 semaines (complet).

**Décision clé** : Alerte timeline (Amelia) — le PRD annonce 8-10 semaines, l'estimation réaliste est 20-22 semaines. Pour respecter CBA juin 2026 : focus strict MUST-HAVE, reporter SSO/dashboards avancés/résumé LLM au post-MVP.

---

## 3. Split Cofondateurs

### Tom (Gabri) — Backend + Observabilité

| Responsabilité | Noyaux | Charge estimée |
|---------------|--------|---------------|
| Infrastructure (PostgreSQL, Redis, CI/CD, Schema) | Transverse | ~41 SP |
| RBAC backend (hasPermission fix, enforcement) | Transverse | ~20 SP |
| Observabilité & Audit (audit_events, résumé LLM) | B | ~18 SP |
| WebSocket & Chat backend | Transverse | ~15 SP |
| Onboarding & Import | C | ~13 SP |
| SSO backend | Enterprise | ~5 SP |
| **Total** | | **~115-140 SP** |

### Cofondateur Technique (à recruter)

| Responsabilité | Noyaux | Charge estimée |
|---------------|--------|---------------|
| Containerisation Docker (ContainerManager, credential proxy, mount security) | Transverse | ~34 SP |
| Orchestrateur Déterministe (state machine, WorkflowEnforcer, HITL) | A | ~29 SP |
| Compaction (CompactionWatcher, kill+relance, réinjection) | A | ~21 SP |
| Agent-to-Agent (A2A Bus, permissions, audit) | D | ~16 SP |
| Frontend React (pages, composants, UX) | Transverse | ~30 SP |
| Dual-Speed Workflow (curseur automatisation) | E | ~10 SP |
| **Total** | | **~110-135 SP** |

### Points de Synchronisation

| Semaine | Sync | Décision |
|---------|------|----------|
| Fin S2 | Phase 1 + Spike compaction | Go/No-Go stratégie compaction |
| Fin S4 | RBAC + Orchestrateur v1 | Go/No-Go Phase 3 |
| Fin S6 | Scoping + Observabilité | Phase 4 ou polish ? |
| Fin S8 | Containerisation + Chat | Go/No-Go Démo CBA |
| S9-10 | Préparation démo | Bug fixing, données, répétition |

---

## 4. Timeline

```
Mars 2026          Avril 2026          Mai 2026            Juin 2026
S0  S1  S2    S3  S4  S5    S6  S7  S8    S9  S10 S11   S12 S13
[INFRA][MU+RBAC ][RBAC+ORCH][ORCH+OBS][CONT+CHAT][A2A+DUAL ][ENT+DEMO]
  ↑                              ↑                   ↑            ↑
  PG+Docker                  Démo interne       MVP rugueux   🎯 DÉMO CBA
  CI/CD                      possible            vendable
```

### Jalons

| Date estimée | Jalon |
|-------------|-------|
| Mi-mars 2026 | Sprint 0 — Infra opérationnelle |
| Fin mars 2026 | Sprint 1 — Multi-user + RBAC base |
| Mi-avril 2026 | Sprint 2 — RBAC 100% + Orchestrateur v1 |
| Fin avril 2026 | Sprint 3 — Drift + Audit (démo interne) |
| Mi-mai 2026 | Sprint 4 — Containerisation + Chat |
| Fin mai 2026 | Sprint 5 — MVP rugueux vendable |
| Juin 2026 | Sprint 6 — **🎯 Démo CBA** |

---

## 5. Prochaines Actions

### Immédiat (cette semaine)

1. **Recruter le cofondateur technique** — profil senior fullstack, expertise Docker/containerisation, state machines, agents IA. C'est le bloquant #1 du projet.

2. **Fixer `hasPermission()`** — access.ts:45-66, le scope JSONB n'est jamais lu. DT1, P0 sécurité. Peut être fait en 2 jours par Tom dès maintenant.

3. **Setup PostgreSQL externe** — TECH-01, prérequis pour TOUT le reste. Docker Compose + migration SQLite → PostgreSQL 16.

### Semaine 1 (Sprint 0)

4. **Spike compaction** — 3-5 jours pour observer le comportement de compaction sur Claude, GPT-4. Valider ou invalider la détection via heartbeats.

5. **Vérifier l'infra CBA** — Docker est-il disponible chez CBA ? Si non, préparer le Plan B (processus isolés).

6. **CI/CD pipeline** — GitHub Actions avec les 7 quality gates de l'architecture.

### Court terme (mois 1)

7. **Démarrer Phase 1+2** — Multi-user + RBAC en parallèle avec l'orchestrateur.

8. **Contacter CBA** — Valider l'intérêt pour le POC, aligner les attentes sur le périmètre démo.

---

## 6. Métriques du Pipeline BMAD

| Métrique | Valeur |
|----------|--------|
| Étapes complétées | 5/5 (+ récap) |
| Sessions Agent Teams | 5 |
| Agents spawned au total | ~35 |
| Documents de synthèse produits | 5 + récap |
| Fichiers de sections individuelles | 27 |
| Mots produits (estimation) | ~40 000 |
| FRs identifiés et couverts | 52 |
| Stories planifiées | ~69 |
| Story Points estimés | 252-307 |
| Tests planifiés | ~525 |
| ADRs documentés | 8 |
| ACs Given/When/Then | 31 |
| Edge cases documentés | 42 |
| Quality Gates définis | 39 |

---

## 7. Inventaire des Livrables

### Documents de Synthèse

| # | Document | Fichier | Mots |
|---|----------|---------|------|
| 1 | Product Brief B2B | `product-brief-b2b.md` | ~12 000 |
| 2 | PRD B2B | `prd-b2b.md` | ~7 500 |
| 3 | UX Design B2B | `ux-design-b2b.md` | ~6 500 |
| 4 | Architecture B2B | `architecture-b2b.md` | ~6 000 |
| 5a | Epics B2B | `epics-b2b.md` | ~5 000 |
| 5b | Sprint Planning B2B | `sprint-planning-b2b.md` | ~4 500 |
| 6 | Récap Transformation | `RECAP-B2B-TRANSFORMATION.md` | ~2 000 |

### Fichiers de Sections (dans `sections/`)

**Étape 2 — PRD** : 6 fichiers (prd-section-1 à 9)
**Étape 3 — UX** : 7 fichiers (ux-section-1 à 7) + ux-journeys-requirements.md
**Étape 4 — Architecture** : 7 fichiers (archi-section-1 à 7)
**Étape 5 — Sprint** : 7 fichiers (sprint-section-1 à 7)

---

*À demain, Tom. Le pipeline B2B est complet. Toutes les décisions architecturales, techniques et business sont documentées. La prochaine étape est l'action : recruter, coder, livrer.*

*Bonne nuit. — L'équipe BMAD* 🏗️
