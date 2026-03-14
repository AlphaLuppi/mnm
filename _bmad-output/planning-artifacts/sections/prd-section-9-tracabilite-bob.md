# PRD Section 9 — Traçabilité FR→Epics, Out-of-Scope, Assumptions & DoD

*Par Bob le Scrum Master 🏃* | Task #8 | 2026-03-13

---

## 1. Traçabilité FR → Epics Futures

### Epic "Multi-User MVP" (Phase 1 — ~1 semaine)
- REQ-ONB-01 → S1-S4 (inviter, membres, email, disable signup)
- REQ-ENT-01 partiel → S5-S6 (profil, sign-out)
- Prérequis infra → S7 (migration PostgreSQL externe)

### Epic "RBAC Métier" (Phase 2 — ~2 semaines)
- REQ-ENT-01 → S1-S3 (4 rôles métier, presets, UI)
- REQ-A2A-01 partiel → S4-S5 (9 nouvelles permission keys, brancher canUser())
- REQ-ONB-01 suite → S6-S7 (page admin, masquer navigation)
- REQ-OBS-03 partiel → S8 (filtrage vues par rôle)

### Epic "Scoping par Projet" (Phase 3 — ~2-3 semaines)
- REQ-ENT-02 → S1-S3 (project_memberships, hasPermission() scope, filtrer routes)
- REQ-A2A-01 → S4-S5 (scoping agents et workflows)
- REQ-OBS-02 partiel → S6 (audit changements scope)
- REQ-ONB-01 niveau projet → S7-S8 (page Accès, filtrage sidebar)

### Epic "Orchestrateur Déterministe" (Transverse — ~3-5 semaines)
- REQ-ORCH-01 → S1-S3 (state machine, enforcement, fichiers/prompts)
- REQ-ORCH-02/03 → S4-S7 (compaction : détection, kill+relance, réinjection, config)
- REQ-ORCH-04 → S8-S9 (UI config stages, validation fichiers)
- REQ-ORCH-05 → S10-S12 (drift détection, alertes, dashboard)

### Epic "Observabilité & Audit" (Transverse — ~2-3 semaines)
- REQ-OBS-01 → S1-S2 (résumé LLM, affichage temps réel)
- REQ-OBS-02 → S3-S4 (enrichir activity log, traçabilité)
- REQ-OBS-03 → S5-S6 (dashboards agrégés, jamais individuels)
- REQ-OBS-04 → S7-S8 (capture décisions, historique replayable)

### Epic "Enterprise-Grade" (Phase 4 — ~3-4 semaines)
- SSO, audit complet + export, dashboards par rôle, multi-tenant SaaS, rate limiting

### Epic "Onboarding & Import" (Post-MVP — ~2-3 semaines)
- Mode conversationnel + visuel, connecteurs Jira/Linear/ClickUp, synchronisation

### Epic "Dual-Speed & Chat" (Post-MVP — ~3-4 semaines)
- Curseur 3 positions, classification tâches, chat temps réel, mode brainstorm

### Epic "Containerisation & Sécurité Agent" (Prérequis B2B — ~3-5 semaines)
- ContainerManager, credential proxy, mount allowlist, shadow .env, sandbox auto-modification

---

## 2. Out-of-Scope Boundary

### Features Reportées (Post-MVP)
- SSO SAML/OIDC, Import Jira/Linear, Multi-tenant SaaS complet, Email transactionnel
- Dashboards avancés, Connecteurs auto-générés, Curseur complet, Mode ORAL, Mode TEST

### Features Exclues du Périmètre MnM
- MnM comme data lake, Remplacement complet Jira, IDE intégré, Training modèles IA
- Marketplace plugins, Application mobile, Billing intégré, Analytics BI avancée
- Gestion RH / évaluation performance (invariant éthique — vérité #20), i18n

### Frontière MVP vs Post-MVP
```
MVP (8-10 sem)                     POST-MVP
├ Multi-user (invitations)         ├ SSO SAML/OIDC
├ RBAC 4 rôles                     ├ Import Jira/Linear
├ Scoping par projet               ├ Multi-tenant SaaS
├ PostgreSQL externe               ├ Curseur complet
├ Orchestrateur v1                 ├ Chat temps réel
├ Drift detection basique          ├ Containerisation
├ Compaction kill+relance          ├ Connecteurs auto
├ Activity log enrichi             ├ Mode ORAL
├ Permissions par route            ├ Dashboards avancés
├ UI admin basique                 ├ Email transactionnel
= VENDABLE à CBA                  = SCALABLE en SaaS
```

---

## 3. Assumptions & Constraints

### Techniques (7 hypothèses)
- HT-01 : PostgreSQL suffisant pour multi-tenant (confiance élevée)
- HT-02 : Better Auth extensible pour SSO (confiance moyenne)
- HT-03 : Docker disponible et performant (confiance élevée)
- HT-04 : Compaction gérable au niveau plateforme (confiance moyenne — R1)
- HT-05 : Schema DB existant suffisamment complet (confiance élevée)
- HT-06 : WebSocket extensible en bidirectionnel (confiance élevée)
- HT-07 : Adapters supportent pattern containerisé (confiance élevée)

### Business (5 hypothèses)
- HB-01 : CBA premier client viable (confiance élevée)
- HB-02 : Cofondateur technique recruté bientôt (confiance moyenne)
- HB-03 : Pricing ~50€/user/mois acceptable (confiance moyenne)
- HB-04 : Open source flywheel viable (confiance moyenne)
- HB-05 : Marché orchestration agents existe et croît (confiance élevée — $47.1B 2030)

### Utilisateurs (5 hypothèses)
- HU-01 : Adoption progressive via curseur (confiance moyenne — R2)
- HU-02 : Rôles non-dev adopteront MnM (confiance faible — risque le plus élevé)
- HU-03 : Résistance au changement Jira gérable (confiance moyenne)
- HU-04 : CEO acceptera outil supervision IA (confiance moyenne)
- HU-05 : Agents IA suffisamment fiables en 2026 (confiance élevée)

### Timeline (5 hypothèses)
- Phase 1 : ~1 semaine (confiance élevée)
- Phase 2 : ~2 semaines (confiance moyenne — branching routes laborieux)
- Phase 3 : ~2-3 semaines (confiance moyenne)
- MVP total : 8-10 semaines (confiance moyenne — optimiste si 1 dev)

---

## 4. Definitions of Done

### DoD Feature
- Fonctionnel : ACs implémentés, cas d'erreur gérés, permissions respectées
- Qualité : Tests ≥80% nouveau code, intégration pour flux critiques, pas de régression
- Sécurité : Pas de secrets en dur, input sanitisé, canUser() branché, isolation tenant
- Technique : Mergé, migrations réversibles, TypeScript strict
- Documentation : Commentaires logique non-évidente, API documentée si nouvelle

### DoD Sprint
- Toutes stories committed Done ou raison documentée
- Incrément déployable et démontrable
- Tests verts, pas de bug P0/P1 ouvert
- Review + rétro effectuées, vélocité mesurée

### DoD Release
- E2E Cypress passants, perf API <500ms P95, charge N users
- Sécurité : OWASP vérifié, isolation multi-tenant, RBAC exhaustif
- Opérationnel : doc déploiement, runbook, monitoring, backup testé, rollback plan

### DoD PRD
- 5 noyaux définis, 9 personas, 23 requirements formels
- Modèle domaine (12 entités, 5 invariants), scope MVP découpé
- Risques réels vs imaginés identifiés, business model 4 tiers
- Traçabilité complète requirement → feature → epic

---

*~2800 mots — Traçabilité complète, out-of-scope, assumptions, DoD 4 niveaux.*
