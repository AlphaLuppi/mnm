# Sprint Planning B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : Bob (SM Lead), Winston (Architecte), John (PM), Amelia (Dev), Quinn (QA), Murat (TEA)
> **Deadline critique** : Démo CBA — Juin 2026

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Sprint 0 — Setup & Fondations](#2-sprint-0)
3. [Sprint 1 — Multi-User & RBAC Base](#3-sprint-1)
4. [Sprint 2 — RBAC Avancé & Orchestrateur v1](#4-sprint-2)
5. [Sprint 3 — Orchestrateur Complet & Observabilité](#5-sprint-3)
6. [Sprint 4 — Containerisation & Chat](#6-sprint-4)
7. [Sprint 5 — A2A, Dual-Speed & Onboarding](#7-sprint-5)
8. [Sprint 6 — Enterprise & Polish](#8-sprint-6)
9. [Velocity & Métriques](#9-velocity--métriques)
10. [Go/No-Go par Phase](#10-gono-go-par-phase)
11. [Risk Management](#11-risk-management)
12. [Definition of Done](#12-definition-of-done)
13. [Test Strategy Transverse](#13-test-strategy-transverse)
14. [Critères de Succès Démo CBA](#14-critères-de-succès-démo-cba)

---

## 1. Vue d'ensemble

### 1.1 Structure Temporelle

| Sprint | Durée | Semaines | Focus | Phase PRD | SP cible |
|--------|-------|----------|-------|-----------|---------|
| **Sprint 0** | 1 sem | S1 | Infrastructure, PostgreSQL, Docker, CI/CD, Design System | Setup | 28 |
| **Sprint 1** | 2 sem | S2-S3 | Multi-User MVP + RBAC fondations | Phase 1-2 | 30 |
| **Sprint 2** | 2 sem | S4-S5 | RBAC enforcement + Orchestrateur v1 + Scoping | Phase 2-3 | 28 |
| **Sprint 3** | 2 sem | S6-S7 | Orchestrateur complet + Drift + Audit Enterprise | Phase 3 | 30 |
| **Sprint 4** | 2 sem | S8-S9 | Containerisation + Chat WebSocket | Transverse | 26 |
| **Sprint 5** | 2 sem | S10-S11 | A2A + Dual-Speed + Onboarding + Compaction | Transverse | 30 |
| **Sprint 6** | 2 sem | S12-S13 | Enterprise (SSO, Dashboards) + Stabilisation + Démo | Phase 4 | 25 |

**Total : 13 semaines calendaires | 197 SP planifiés (scénario MVP CBA)**

### 1.2 Parallélisme Tom / Cofondateur

```
        S0        S1 ────── S2 ────── S3 ────── S4 ────── S5 ────── S6
TOM   : [INFRA]   [MU+RBAC] [RBAC    ] [OBS    ] [CHAT   ] [DASH   ] [SSO+DEMO]
         PG+Redis  backend    routes     audit     WebSocket  dashbd    polish
         Schema    hasPerms   enforce    export    pipe stdin  temps    stab.
         RLS       keys       scope      résumé    RBAC       réel

COFON.: [INFRA]   [MU+RBAC] [ORCH    ] [ORCH   ] [CONT   ] [A2A+   ] [ENT+DEMO]
         Docker    frontend   state      drift     Docker     DUAL     SSO UI
         CI/CD     badges     machine    compact.  Cred.proxy COMP     import
                   rôle UI    enforcer   HITL      mount sec  curseur  stab.
```

### 1.3 Jalons Critiques

| Semaine | Jalon | Décision |
|---------|-------|----------|
| **S1** | Sprint 0 Done — Infra opérationnelle | Go Phase 1 |
| **S3** | Multi-User + RBAC base fonctionnels | Go Phase 2 |
| **S5** | RBAC enforcement 100% + Orchestrateur v1 | Go Phase 3 |
| **S7** | Drift detection + Audit enterprise | Go Phase 4 / Pivot container |
| **S9** | Containerisation + Chat bidirectionnel | **Milestone MVP CBA rugueux** |
| **S11** | A2A + Dual-Speed + Compaction | Feature complete |
| **S13** | Enterprise + Polish + Démo CBA | **🎯 DÉMO CBA** |

---

## 2. Sprint 0 — Setup & Fondations

**Durée** : 1 semaine | **SP cible** : 28
**Objectif** : Environnement prêt, CI/CD, PostgreSQL, Docker, Design System

### Répartition

| Tom (Backend + Infra) | SP | Cofondateur (Docker + CI) | SP |
|----------------------|-----|--------------------------|-----|
| TECH-01: PostgreSQL externe | 5 | TECH-02: Docker Compose | 5 |
| TECH-04: Redis setup | 3 | TECH-08: CI/CD pipeline | 8 |
| TECH-06: 10 nouvelles tables | 5 | Design System tokens | 2 |
| **Total Tom** | **13** | **Total Cofondateur** | **15** |

### Spike Compaction (Cofondateur, en parallèle)
- Jours 3-5 : observer comportement compaction sur Claude, GPT-4
- Objectif : valider la faisabilité de la détection via heartbeats
- Décision si échec : reporter compaction à post-MVP

### Quality Gate de Sortie Sprint 0
- [ ] PostgreSQL 16 externe connecté et fonctionnel
- [ ] Docker Compose lance l'environnement complet
- [ ] CI/CD pipeline QG-0 + QG-1 actifs
- [ ] Redis opérationnel (sessions, cache)
- [ ] 10 nouvelles tables créées + 5 tables modifiées
- [ ] Factories de test opérationnelles
- [ ] Aucune régression sur les 38 tables existantes

---

## 3. Sprint 1 — Multi-User & RBAC Base

**Durée** : 2 semaines | **SP cible** : 30
**Phase PRD** : Phase 1 + début Phase 2
**Objectif** : Multi-User fonctionnel, 4 rôles, hasPermission() corrigé

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| RBAC-S01: Fix hasPermission() ⚠️ | 3 | MU-S02: Page Membres UI | 3 |
| MU-S01: API invitations email | 2 | MU-S04: Sélecteur Company | 2 |
| MU-S03: Invitation bulk CSV | 2 | RBAC-S03: businessRole migration | 2 |
| MU-S05: Désactivation signup | 1 | RBAC-S05: Navigation masquée | 3 |
| MU-S06: Sign-out + invalidation | 1 | RBAC-S07: Badges rôle | 1 |
| RBAC-S02: 9 permission keys | 2 | TECH-03: Infrastructure test | 5 |
| TECH-07: Modifications 5 tables | 2 | | |
| **Total Tom** | **13** | **Total Cofondateur** | **16** |

### Point de Sync Fin Sprint 1
- Schema DB complet + RLS actif + hasPermission corrigé
- Validation conjointe de l'isolation tenant

### Quality Gate de Sortie Sprint 1
- [ ] Invitation par email fonctionne end-to-end
- [ ] Sign-out invalide la session côté serveur
- [ ] hasPermission() lit et applique scope JSONB
- [ ] 15 permission keys opérationnelles
- [ ] 4 rôles assignables et fonctionnels
- [ ] Tests d'isolation cross-company passent
- [ ] Couverture >= 80% nouveau code

---

## 4. Sprint 2 — RBAC Avancé & Orchestrateur v1

**Durée** : 2 semaines | **SP cible** : 28
**Phase PRD** : Phase 2 (fin) + début Phase 3
**Objectif** : Enforcement RBAC 100% routes, state machine v1, scoping base

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| RBAC-S04: Enforcement 22 routes (critiques) | 4 | ORCH-S01: State machine | 8 |
| TECH-05: RLS PostgreSQL 14 tables | 8 | ORCH-S02: WorkflowEnforcer | 8 |
| PROJ-S01: Table project_memberships | 2 | RBAC-S04: Enforcement (reste) | 4 |
| **Total Tom** | **14** | **Total Cofondateur** | **20** |

**⚠ Sprint chargé pour Cofondateur** — Orchestrateur state machine = le chantier le plus important

### Quality Gate de Sortie Sprint 2
- [ ] 100% des routes API protégées par requirePermission()
- [ ] RLS actif sur 14 tables
- [ ] State machine workflow fonctionnelle (12 transitions)
- [ ] WorkflowEnforcer impose les étapes + fichiers obligatoires
- [ ] Aucune route ne permet d'accès sans vérification

---

## 5. Sprint 3 — Orchestrateur Complet & Observabilité

**Durée** : 2 semaines | **SP cible** : 30
**Objectif** : Drift detection, HITL, audit enterprise, pré-prompts

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| DRIFT-S01: Drift persistance DB | 3 | ORCH-S03: Validation HITL | 5 |
| DRIFT-S02: Drift monitor service | 5 | DRIFT-S03: UI diff drift | 5 |
| OBS-S01: Table audit_events partitionnée | 5 | ORCH-S04: API routes orchestrateur | 3 |
| OBS-S02: Service audit émission | 5 | RBAC-S06: UI admin matrice permissions | 3 |
| **Total Tom** | **18** | **Total Cofondateur** | **16** |

**⚠ Sprint chargé pour Tom** — Audit + Drift simultanément

### Jalon Sprint 3
**Démo interne possible** — Multi-user + RBAC + Orchestrateur + Drift + Audit basique. Pas de containerisation ni de chat.

### Quality Gate de Sortie Sprint 3
- [ ] Drift detection fonctionne en <15 minutes
- [ ] HITL validation workflow fonctionne E2E
- [ ] Audit log immutable (TRIGGER deny UPDATE/DELETE)
- [ ] Émission audit sur toutes les mutations

---

## 6. Sprint 4 — Containerisation & Chat

**Durée** : 2 semaines | **SP cible** : 26
**Objectif** : Containers Docker éphémères, credential proxy, WebSocket bidirectionnel

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| CHAT-S01: WebSocket bidirectionnel | 8 | CONT-S01: ContainerManager (début) | 13 |
| CHAT-S02: Tables chat | 2 | | |
| CONT-S05: Tables container | 2 | | |
| **Total Tom** | **12** | **Total Cofondateur** | **13** |

**⚠ CONT-S01 = XL** — ContainerManager est le plus gros chantier technique. S'étale sur Sprint 4 et 5.

### Quality Gate de Sortie Sprint 4
- [ ] Container Docker éphémère --rm --read-only lancé et stoppé
- [ ] WebSocket bidirectionnel fonctionne (envoi + réception)
- [ ] Container startup <10s

---

## 7. Sprint 5 — A2A, Dual-Speed & Compaction

**Durée** : 2 semaines | **SP cible** : 30
**Objectif** : Credential proxy, chat complet, A2A bus, curseur automatisation, compaction basique

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| CHAT-S03: ChatService + pipe stdin | 5 | CONT-S02: Credential proxy | 8 |
| OBS-S03: Résumé LLM Haiku | 3 | CONT-S03: Mount allowlist | 5 |
| PROJ-S02: Service project-memberships | 3 | DUAL-S01: Table automation_cursors | 5 |
| PROJ-S03: Filtrage par scope | 5 | DUAL-S02: UI curseur | 3 |
| **Total Tom** | **16** | **Total Cofondateur** | **21** |

### **🎯 Milestone MVP CBA Rugueux (Fin Sprint 5, ~S11)**
À ce stade, le MVP est vendable avec :
- ✅ Multi-user + invitations
- ✅ RBAC 4 rôles + enforcement
- ✅ Orchestrateur déterministe (state machine + drift + HITL)
- ✅ Containerisation Docker avec credential proxy
- ✅ Chat temps réel bidirectionnel
- ✅ Audit log immutable
- ✅ Scoping par projet

### Quality Gate de Sortie Sprint 5
- [ ] Credential proxy résout les secrets sans exposition
- [ ] Mount allowlist bloque path traversal
- [ ] Chat en temps réel fonctionne avec agent containerisé
- [ ] Curseur d'automatisation 3 positions + plafond hiérarchique

---

## 8. Sprint 6 — Enterprise & Polish

**Durée** : 2 semaines | **SP cible** : 25
**Objectif** : SSO, dashboards, import Jira, stabilisation, préparation démo CBA

### Répartition

| Tom | SP | Cofondateur | SP |
|-----|-----|-------------|-----|
| SSO-S01: Table SSO config | 2 | CONT-S04: Isolation réseau | 3 |
| SSO-S02: Better Auth SAML/OIDC | 3 | CONT-S06: UI container status | 3 |
| DASH-S01: API dashboards agrégés | 5 | SSO-S03: UI config SSO | 3 |
| OBS-S04: UI AuditLog + filtres | 5 | CHAT-S04: AgentChatPanel | 3 |
| **Total Tom** | **15** | **Total Cofondateur** | **12** |

### Activités Transverses Sprint 6
- Bug fixing et stabilisation
- Données de démo CBA (agents, workflows, projets)
- Script de démo et répétition
- Tests E2E smoke complets (7 tests)
- Performance testing (k6 baseline)

### **🎯 DÉMO CBA (Fin Sprint 6, ~S13 = Juin 2026)**

---

## 9. Velocity & Métriques

### 9.1 Hypothèses de Velocity (Amelia)

| Paramètre | Valeur |
|-----------|--------|
| Durée sprint | 2 semaines |
| SP par dev par sprint | 15-20 (conservateur) |
| SP équipe par sprint | 30-40 |
| Buffer imprévus | 20% |
| SP utiles par sprint | 24-32 |

### 9.2 Total Story Points

| Catégorie | SP Min | SP Max |
|-----------|--------|--------|
| Infrastructure (Epic 0) | 41 | 45 |
| Fondations (MU, RBAC, PROJ) | 45 | 57 |
| Noyau A (ORCH, DRIFT, COMP) | 63 | 78 |
| Noyau B (OBS, DASH) | 28 | 35 |
| Noyau C (ONB) | 13 | 16 |
| Noyau D (A2A) | 16 | 21 |
| Noyau E (DUAL) | 10 | 13 |
| Transverses (CHAT, CONT, SSO) | 60 | 75 |
| **TOTAL** | **252** | **307** |

### 9.3 Scénarios de Durée

| Scénario | SP/sprint | Sprints | Durée |
|----------|-----------|---------|-------|
| **MVP CBA strict** | 28 SP/sprint | 7 (S0+S6) | **13 semaines** |
| Réaliste complet | 26 SP/sprint | 10-11 | 20-22 semaines |
| Pessimiste | 20 SP/sprint | 13-15 | 26-30 semaines |

### 9.4 Ce qui est reporté au Post-MVP pour le Scénario CBA

| Story reportée | SP économisés |
|---------------|--------------|
| ORCH-S05: UI drag-and-drop workflow | 5 |
| COMP-S03: Réinjection post-compaction | 5 |
| A2A-S01 à S04: Agent-to-Agent complet | 16-21 |
| ONB-S01 à S04: Onboarding cascade | 13-16 |
| OBS-S03: Résumé LLM | 3 |
| DASH-S02/S03: Dashboards temps réel | 5 |
| **Total économisé** | **~47-55 SP** |

**Résultat** : MVP CBA = ~200-250 SP → 7 sprints à 28-32 SP → **13-14 semaines faisable**.

---

## 10. Go/No-Go par Phase (John)

```
Phase 1 [GO] -----> Phase 2 [GO] -----> Phase 3 [GO] -----> Phase 4 [GO] -----> DEMO CBA
  |                   |                   |                   |
  | NO-GO:            | NO-GO:            | NO-GO:            | NO-GO:
  | PG externe KO     | hasPermission     | Scope fuite       | Audit non-immutable
  | Invite échoue     | non corrigé       | sur 1 route       | Dashboard vide
  |                   | Enforcement <100% |                   |
  v                   v                   v                   v
  FIX puis retry     BLOQUANT : ne pas    ROLLBACK + FIX     Phase 4 partielle
                     avancer sans                            acceptable
```

### Conditions Go/No-Go Détaillées

| Phase | Condition Bloquante | Seuil |
|-------|--------------------|-------|
| **Phase 1 → 2** | PostgreSQL externe | 100% fonctionnel |
| | Invitation email E2E | Fonctionne |
| | Sign-out invalidation | Token → 401 |
| | Régression 38 tables | 0 bug |
| **Phase 2 → 3** | hasPermission() scope | 100% |
| | Enforcement 22 routes | 100% |
| | Isolation cross-company | 0 leak |
| **Phase 3 → 4** | Drift detection | <15 min |
| | Audit immutable | TRIGGER bloque UPDATE/DELETE |
| | State machine | 12 transitions validées |
| **Phase 4 → Démo** | Container startup | <10s |
| | Credential proxy | 0 exposure |
| | Smoke tests | 7/7 pass |

---

## 11. Risk Management (John + Winston)

### 11.1 Risques par Criticité

| # | Risque | Prob. | Impact | Mitigation | Sprint |
|---|--------|-------|--------|-----------|--------|
| **R1** | Compaction techniquement plus dure que prévu | Élevée | CRITIQUE | Spike S0 J3-5. Kill+relance comme fallback. | S0, S5 |
| **R2** | Recrutement cofondateur retardé (>4 sem) | Moyenne | ÉLEVÉ | Freelance senior pour Piste B (container) | S0 |
| **R3** | hasPermission() + scope plus complexe que prévu | Faible | CRITIQUE | DT1 estimé 1-2j. Si >5j: scope "global-only" pour démo | S1 |
| **R4** | Performance WebSocket en charge | Faible | MOYEN | Démo avec 5-10 users, pas 100 | S4 |
| **R5** | Docker indisponible chez CBA | Faible | ÉLEVÉ | Vérifier infra S0. Plan B: processus isolés | S0 |
| **R6** | Drift detection faux positifs | Moyenne | MOYEN | Heuristiques simples + seuil configurable | S3 |
| **R7** | Scope MVP trop ambitieux | Moyenne | ÉLEVÉ | Discipline MUST-HAVE only | Tout |

### 11.2 Impact d'un Retard par Epic

| Epic en Retard +2 sem | Impact Démo | Dégradation Gracieuse |
|----------------------|-------------|----------------------|
| Multi-User | FATAL | Non — Epic de 1 sem, pas de marge |
| RBAC | FATAL | Partiel : 2 rôles (Admin+Contributor) au lieu de 4 |
| Orchestrateur | SÉVÈRE | Oui : step-by-step sans drift detection |
| Containerisation | GRAVE | Oui : processus directs, "Container prévu pour la prod" |
| Observabilité | MODÉRÉ | Oui : logs bruts + promesse dashboards |
| Chat | MODÉRÉ | Oui : exécution batch, moins impressionnant |

---

## 12. Definition of Done (Quinn)

### 12.1 Story DoD (13 critères)

| # | Critère |
|---|---------|
| S-01 | Code compile sans erreur TypeScript |
| S-02 | Linter passe sans warning |
| S-03 | Tests unitaires >= 80% nouveau code |
| S-04 | Tous les tests existants passent (0 régression) |
| S-05 | Tests d'intégration sur routes API touchées |
| S-06 | Audit log émis pour toute mutation (INV-03) |
| S-07 | Isolation tenant respectée (companyId, RLS) |
| S-08 | Code review par au moins 1 pair |
| S-09 | Documentation API à jour (si nouvel endpoint) |
| S-10 | Pas de secret dans le code |
| S-11 | ACs de la story vérifiés |
| S-12 | UI responsive >= 768px |
| S-13 | WCAG 2.1 AA (labels, contraste, clavier) |

### 12.2 Couverture Critique (>= 95%)

- `access.ts` — hasPermission() avec scope JSONB
- `credential-proxy.ts` — résolution secrets
- Middleware `requirePermission()`
- RLS policies PostgreSQL

---

## 13. Test Strategy Transverse (Murat)

### 13.1 Test Pyramid

| Type | Volume estimé | % | Outils |
|------|--------------|---|--------|
| **Unit** | ~300 tests | 57% | Vitest |
| **Intégration** | ~205 tests | 39% | Supertest + embedded-postgres |
| **E2E** | ~20 tests | 4% | Cypress |
| **Total** | **~525 tests** | 100% | |

### 13.2 Infrastructure de Test (Sprint 0)

| Story | Effort |
|-------|--------|
| TEST-001: Vitest Workspace B2B | 1j |
| TEST-002: Cypress E2E setup | 2j |
| TEST-003: Test DB PostgreSQL | 1.5j |
| TEST-004: Factories & Fixtures | 2j |
| TEST-005: E2E Seed Data | 1.5j |
| TEST-006: Mock Strategy | 1j |
| TEST-007: CI Pipeline Quality Gates | 2j |
| TEST-008: k6 Benchmarks | 2j |
| **Total Sprint 0 test** | **13 jours** |

### 13.3 Effort Testing par Epic (~35% du dev)

| Epic | Dev (SP) | Test estimé (jours) |
|------|----------|-------------------|
| FR-MU | 16-19 | 5-6 |
| FR-RBAC | 21-26 | 7-9 |
| FR-ORCH | 29-36 | 8-10 |
| FR-OBS | 18-22 | 5-7 |
| FR-CHAT | 18-23 | 5-7 |
| FR-CONT | 34-42 | 10-14 |
| FR-DUAL | 10-13 | 2-3 |
| **Total** | **252-307** | **~42-56 jours** |

### 13.4 Quality Gates CI/CD

| Gate | Contenu | Bloquant | Trigger |
|------|---------|----------|---------|
| QG-0 | lint + TypeScript | ✅ | Push PR |
| QG-1 | Tests unitaires | ✅ | Push PR |
| QG-2 | Tests intégration | ✅ | Merge develop |
| QG-3 | Security scan (secrets, deps) | ✅ | Nightly |
| QG-4 | Performance (k6 basique) | ❌ informatif | Nightly |
| QG-5 | E2E Cypress | ✅ | Merge develop |
| QG-6 | Review humaine | ✅ | PR |

### 13.5 Suites de Régression Cumulatives

| Phase | Tests | Durée |
|-------|-------|-------|
| REG-P1 (Multi-User) | 50-80 | ~5 min |
| REG-P2 (RBAC) | 80-120 | ~8 min |
| REG-P3 (Orchestration) | 120-180 | ~12 min |
| REG-P4 (Enterprise) | 180-250 | ~15 min |

---

## 14. Critères de Succès Démo CBA (John)

### 14.1 Les 8 Points de la Démo

Pour que la démo CBA soit un succès menant à un POC signé :

- [ ] **Le CTO CBA peut inviter 3-5 membres** avec des rôles différents
- [ ] **Un workflow déterministe de 4+ étapes** s'exécute correctement
- [ ] **Un drift est détecté** et affiché en <15 minutes
- [ ] **Un agent est arrêté et relancé** proprement (kill+relance compaction)
- [ ] **Le dev CBA dialogue en temps réel** avec son agent
- [ ] **Le CEO voit un dashboard** de supervision avec KPIs agrégés
- [ ] **Les agents sont containerisés** et les credentials isolées
- [ ] **L'audit log trace** chaque action de manière vérifiable

### 14.2 Success Criteria PRD Mappés

| Critère | Cible Démo CBA | Epic |
|---------|---------------|------|
| SC-A1: Taux respect workflows | >90% | ORCH |
| SC-A2: Temps détection drift | <15 min | DRIFT |
| SC-A5: Sessions survivant compaction | >80% | COMP |
| SC-B1: Couverture audit | 100% runs | OBS |
| SC-B2: Latence observabilité | <5s | OBS |
| SC-B5: Agents containerisés | >90% | CONT |
| SC-BIZ-1: Premier client pilote | POC signé | TOUS |
| SC-BIZ-5: Time-to-value | <2h | MU |

### 14.3 Timeline Finale

```
Mars 2026          Avril 2026          Mai 2026            Juin 2026
S0  S1  S2    S3  S4  S5    S6  S7  S8    S9  S10 S11   S12 S13
[INFRA][MU+RBAC ][RBAC+ORCH][ORCH+OBS][CONT+CHAT][A2A+DUAL ][ENT+DEMO]
                                                    ↑              ↑
                                              MVP RUGUEUX    🎯 DÉMO CBA
```

**Si les 8 points sont couverts, le POC CBA est gagné.**

---

*Sprint Planning B2B v1.0 — ~4500 mots — 7 sprints, 197 SP planifiés (MVP CBA), timeline 13 semaines.*
*Synthèse : Bob (structure), Winston (séquençage), John (priorisation), Amelia (estimations), Quinn (DoD), Sally (UX), Murat (tests).*
