# Section 3 — Priorisation Business & Frontières MVP

> **Auteur** : John le Product Manager
> **Date** : 2026-03-14
> **Version** : 1.0
> **Sources** : PRD B2B v1.0 (26 Success Criteria, 9 FRs, Roadmap), UX Design B2B v1.0, Product Brief B2B v2.0
> **Contexte** : Sprint planning pour la transformation B2B de MnM — Deadline critique : **Démo CBA en juin 2026**

---

## 1. Matrice de Priorisation Impact Business x Effort

### 1.1 Synthèse par Epic

La matrice ci-dessous évalue chaque epic selon deux axes : l'**impact business** (valeur pour la démo CBA et pour la conversion en client payant) et l'**effort de développement** (en semaines-développeur).

| Epic | Impact Business | Effort | Quadrant | Phase PRD | Noyau |
|------|----------------|--------|----------|-----------|-------|
| **Multi-User MVP** | CRITIQUE (9/10) | FAIBLE (1 sem) | QUICK WIN | Phase 1 | C |
| **RBAC Metier** | CRITIQUE (9/10) | MOYEN (2 sem) | STRATEGIQUE | Phase 2 | A+D |
| **Scoping par Projet** | ELEVE (8/10) | MOYEN (2-3 sem) | STRATEGIQUE | Phase 3 | A+D |
| **Orchestrateur Deterministe** | CRITIQUE (10/10) | ELEVE (3-5 sem) | STRATEGIQUE | Transverse | A |
| **Observabilite & Audit** | ELEVE (8/10) | MOYEN (2-3 sem) | STRATEGIQUE | Transverse | B |
| **Enterprise-Grade (SSO, Multi-tenant)** | MOYEN (6/10) | ELEVE (3-4 sem) | STRATEGIQUE | Phase 4 | B+D |
| **Onboarding & Import** | MOYEN (5/10) | MOYEN (2-3 sem) | NICE-TO-HAVE | Post-MVP | C |
| **Dual-Speed & Chat** | ELEVE (7/10) | ELEVE (3-4 sem) | STRATEGIQUE | Post-MVP | E |
| **Containerisation & Securite** | CRITIQUE (9/10) | ELEVE (3-5 sem) | STRATEGIQUE | Prerequis B2B | B |

### 1.2 Visualisation Matricielle

```
                              IMPACT BUSINESS
                    Faible (1-4)    Moyen (5-7)    Critique (8-10)
                  +---------------+---------------+------------------+
                  |               |               |                  |
   Faible         |               |               | MULTI-USER MVP   |
   (< 1.5 sem)   |               |               |                  |
                  +---------------+---------------+------------------+
                  |               |               |                  |
   Moyen          |               | ONBOARDING    | RBAC METIER      |
   (2-3 sem)      |               | & IMPORT      | SCOPING PROJET   |
                  |               |               | OBSERVABILITE    |
                  +---------------+---------------+------------------+
                  |               |               |                  |
   Eleve          |               | ENTERPRISE-   | ORCHESTRATEUR    |
   (3-5 sem)      |               | GRADE         | CONTAINERISATION |
                  |               | DUAL-SPEED    |                  |
                  |               | & CHAT        |                  |
                  +---------------+---------------+------------------+
```

### 1.3 Recommandation de Sequencement

**Ordre de priorite recommande :**

1. **Multi-User MVP** (Quick Win, 1 sem) -- Debloque tout le reste
2. **RBAC Metier** (Strategique, 2 sem) -- Prerequis securite pour la demo
3. **Orchestrateur Deterministe v1** (Strategique, 3-5 sem) -- Coeur de la value prop
4. **Containerisation** (Strategique, 3-5 sem) -- Prerequis securite B2B, parallelisable avec Orchestrateur
5. **Scoping par Projet** (Strategique, 2-3 sem) -- Isolation fine, necessaire pour CBA multi-projets
6. **Observabilite & Audit** (Strategique, 2-3 sem) -- Dashboard pour la demo CBA
7. **Dual-Speed & Chat** (Strategique, 3-4 sem) -- Differenciant UX pour la demo
8. **Enterprise-Grade** (Strategique, 3-4 sem) -- SSO/Audit pour le contrat, post-demo OK
9. **Onboarding & Import** (Nice-to-have, 2-3 sem) -- Import Jira non critique pour la demo

---

## 2. Scope MVP Strict -- Demo CBA Juin 2026

### 2.1 MUST-HAVE : Stories Obligatoires pour la Demo

Ce sont les stories **sans lesquelles la demo CBA echoue**. Elles constituent le produit minimum demontrable a un CTO enterprise.

#### Epic 1 : Multi-User MVP (Phase 1)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| Invitation par email avec lien signe | Impossible de demontrer le multi-user sans inviter quelqu'un | CTO, Admin | P0 |
| Page Membres avec tableau et filtres | Le CTO CBA doit voir qui a acces | CTO | P0 |
| Sign-out avec invalidation session | Signal de maturite enterprise basique | Tous | P0 |
| Desactivation signup libre (invitation-only) | Securite enterprise non-negociable | CTO, DPO | P0 |
| Migration PostgreSQL externe | Prerequis technique pour deploiement reel | DevOps | P0 |

**Effort total : ~5 jours. Ratio valeur/effort exceptionnel.**

#### Epic 2 : RBAC Metier (Phase 2)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| 4 roles metier (Admin, Manager, Contributor, Viewer) | Le CTO CBA doit assigner des droits differencies | CTO | P0 |
| `hasPermission()` lit et applique scope JSONB | **Trou de securite critique** -- bloquant pour tout deploiement B2B | Tous | P0 |
| 9 nouvelles permission keys (15 total) | Granularite necessaire pour la separation des roles | CTO, Admin | P0 |
| Enforcement dans chaque route API (22 fichiers) | Sans ca, le RBAC est cosmetique -- inacceptable en enterprise | Tous | P0 |
| Presets de permissions par role | UX d'administration simplifiee pour la demo | CTO | P0 |

**Effort total : ~10 jours. Debloque la promesse multi-role.**

#### Epic 3 : Orchestrateur Deterministe v1 (Transverse)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| Execution step-by-step imposee | **Coeur de la value proposition MnM** -- sans ca, pas de differenciation | CTO, Dev | P0 |
| Fichiers obligatoires par etape | Garantie de qualite workflow | CTO, Lead Tech | P0 |
| Pre-prompts injectes par etape | Contexte deterministe pour les agents | CTO, Dev | P0 |
| Validation transitions entre etapes | Garde-fou contre les sauts d'etapes | CTO | P0 |
| Drift detection basique (<15 min) | **Moment "wow" de la demo** -- montrer qu'un agent devie et qu'on le detecte | CTO, Lead Tech | P0 |
| Gestion compaction : kill+relance | Le probleme #1 des agents LLM -- prouver qu'on le gere | CTO, Dev | P0 |
| Validation humaine configurable (HITL) | Human-in-the-loop = promesse de controle | CTO, PM | P0 |
| Persistance resultats intermediaires | Prerequis pour kill+relance et audit | Dev, QA | P0 |

**Effort total : ~15-25 jours. C'est le coeur de MnM -- la ou tout se joue.**

#### Epic 4 : Containerisation & Securite (Prerequis B2B)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| Container Docker ephemere avec profil | Isolation B2B obligatoire -- aucune entreprise ne deploie des agents non-isoles | CTO, Dev | P0 |
| Credential proxy HTTP | **Zero tolerance** : agents ne voient JAMAIS les cles API | CTO, DPO | P0 |
| Mount allowlist tamper-proof | Prevention path traversal -- securite fondamentale | CTO | P0 |
| Shadow .env vers /dev/null | Protection secrets | CTO | P0 |
| Isolation reseau entre containers | Multi-tenant impose l'isolation | CTO | P0 |

**Effort total : ~15-25 jours. Parallelisable avec l'orchestrateur (Piste B).**

#### Epic 5 : Observabilite Basique (Transverse)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| Audit log complet (qui/quoi/quand/workflow) | **Compliance** -- le CTO demandera "c'est auditable ?" | CTO, DPO | P0 |
| Dashboard CEO simplifie | Montrer la vue executif lors de la demo | CEO | P1-MUST |
| Dashboard CTO technique | Monitoring drift + agents = le quotidien du CTO | CTO | P1-MUST |

**Effort total : ~10-15 jours. Indispensable pour raconter l'histoire complete.**

#### Epic 6 : Chat Temps Reel (FR-CHAT)

| Story | Justification Business | Persona | Priorite |
|-------|----------------------|---------|----------|
| WebSocket bidirectionnel humain-agent | **Moment "fascination"** de la demo : le dev parle a son agent en temps reel | Dev | P0 |
| Dialogue pendant l'execution du workflow | Pilotage actif = differenciant vs Cursor/CrewAI | Dev, Lead Tech | P0 |

**Effort total : ~10 jours. Le chat est le moment emotionnel fort de la demo.**

### 2.2 NICE-TO-HAVE : Ajoutent de la Valeur mais Non-Critiques pour la Demo

Ces stories ameliorent l'experience mais ne bloquent pas la demo CBA. Elles peuvent etre reportees a post-demo sans risque commercial.

| Story | Epic | Justification Report | Effort |
|-------|------|---------------------|--------|
| Invitation bulk (CSV) | Multi-User | Demo avec 3-5 users suffit | 1j |
| Selecteur multi-company | Multi-User | CBA = 1 company pour la demo | 1j |
| Page profil utilisateur | Multi-User | Basique, pas bloquant | 1j |
| Badges couleur par role | RBAC | Cosmetique, le role fonctionne sans badge | 0.5j |
| Masquage navigation selon permissions | RBAC | Le 403 suffit pour la demo | 1j |
| UI admin matrice permissions | RBAC | Config en DB ou CLI suffit | 2j |
| Resume LLM temps reel des actions | Observabilite | Le log brut suffit pour la demo | 2-3j |
| Export audit log (CSV/JSON) | Observabilite | Pas demande a la demo | 1j |
| Tracabilite decisionnelle | Observabilite | Sophistication post-demo | 2j |
| UI editeur workflow drag-and-drop | Orchestrateur | Config fichier/CLI suffit pour la demo | 3-5j |
| Reinjection pre-prompts post-compaction | Orchestrateur | Kill+relance couvre 80% des cas | 2j |
| Reconnexion WebSocket + sync | Chat | Demo en local, pas de perte reseau | 1j |
| Chat read-only viewer | Chat | Pas de viewer dans la demo | 1j |
| Rate limit messages | Chat | Pas d'abus en demo | 0.5j |
| Resource limits par profil container | Container | Profil par defaut suffit | 1j |
| Timeout avec reset sur output | Container | Timeout fixe suffit pour la demo | 1j |
| SSO SAML/OIDC | Enterprise | Login classique pour la demo | 3-4j |
| Multi-tenant SaaS | Enterprise | Single-tenant pour CBA suffit | 3-5j |
| Onboarding CEO conversationnel | Onboarding | Setup manuel pour la demo | 3j |
| Cascade hierarchique | Onboarding | Invitations manuelles suffisent | 2j |
| Import Jira intelligent | Onboarding | Donnees de demo pre-chargees | 5j |
| Curseur d'automatisation complet | Dual-Speed | Les 3 positions sans UI avancee suffisent | 2-3j |
| Distinction taches mecaniques vs jugement | Dual-Speed | Classification manuelle pour la demo | 2j |
| Dashboards management agreges | Observabilite | Version simplifiee dans MUST-HAVE | 3-5j |
| Retention audit 3 ans immutable | Observabilite | Pas teste en demo | 1j |

**Total NICE-TO-HAVE : ~45-55 jours.** A planifier post-demo CBA.

### 2.3 Synthese MUST-HAVE vs NICE-TO-HAVE

```
MUST-HAVE (~65-80 jours-dev)              NICE-TO-HAVE (~45-55 jours-dev)
==========================================  ==========================================
Multi-User MVP          5j                  Invitations bulk, profil       3j
RBAC Metier            10j                  UI admin avancee               4j
Orchestrateur v1    15-25j                  Editeur workflow drag-drop   3-5j
Containerisation    15-25j                  Resume LLM, export audit     4-5j
Observabilite basique 10-15j                Enterprise (SSO, multi-t.)  6-9j
Chat temps reel       10j                   Onboarding conversationnel   5-10j
                                            Dual-Speed avance            4-5j
                                            UX polish (badges, nav)      3j
==========================================  ==========================================
= DEMO CBA REUSSIE                         = PRODUIT B2B COMPLET
```

**Avec 2 developpeurs en parallele (Tom + Cofondateur), les MUST-HAVE representent 8-10 semaines calendaires** -- ce qui correspond exactement a la timeline mars-juin 2026.

---

## 3. Success Criteria Mesurables par Epic

Les 26 Success Criteria du PRD (section 3) sont ici mappes aux epics concernes, avec les cibles a atteindre pour la demo CBA (3 mois).

### 3.1 Multi-User MVP

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-BIZ-1 | Premier client pilote (CBA) | POC signe | Multi-User |
| SC-BIZ-5 | Time-to-value | <2h (setup company + premiers agents) | Multi-User |
| SC-C1 | Temps onboarding company -> premier workflow | <1 semaine | Multi-User |
| SC-C2 | Taux completion onboarding | >70% | Multi-User |

### 3.2 RBAC Metier + Scoping

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-BIZ-3 | Roles non-dev actifs | >30% des users CBA | RBAC |
| SC-D4 | Taux validation humaine A2A | 100% (tout passe par HITL) | RBAC |
| SC-C4 | Companies avec >=3 niveaux hierarchiques | >50% (CBA = 1 company, 3+ niveaux) | Scoping |

### 3.3 Orchestrateur Deterministe

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-A1 | Taux de respect workflows | >90% | Orchestrateur |
| SC-A2 | Temps de detection drift | <15 min | Orchestrateur |
| SC-A3 | Reinjection contexte reussie apres compaction | >85% | Orchestrateur |
| SC-A4 | Workflows actifs utilises | 10+ (chez CBA) | Orchestrateur |
| SC-A5 | Sessions survivant une compaction | >80% | Orchestrateur |

### 3.4 Observabilite & Audit

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-B1 | Couverture d'audit (actions loggees) | 100% des runs | Observabilite |
| SC-B2 | Latence observabilite (action -> dashboard) | <5s | Observabilite |
| SC-B3 | Reduction MTTR | -40% vs baseline CBA | Observabilite |
| SC-B4 | NPS transparence agent | >25 | Observabilite |

### 3.5 Containerisation

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-B5 | Agents enterprise containerises | >90% | Containerisation |

### 3.6 Chat & Dual-Speed

| SC | Critere | Cible Demo CBA | Epic |
|----|---------|---------------|------|
| SC-E1 | Ratio execution/reflexion | 60/40 | Dual-Speed |
| SC-E2 | Position moyenne curseur automatisation | 1.5 (entre Manuel et Assiste) | Dual-Speed |
| SC-E3 | Savoir tacite capture (items formalises) | 100 items | Dual-Speed |
| SC-E4 | Adoption chat temps reel | >40% WAU | Chat |

### 3.7 KPIs Business Transverses

| SC | Critere | Cible Demo CBA | Responsable |
|----|---------|---------------|-------------|
| SC-BIZ-1 | Premier client pilote CBA | POC signe | Tom + CEO |
| SC-BIZ-2 | ARR | 10-30k EUR | Commercial |
| SC-BIZ-3 | Roles non-dev actifs | >30% | John PM |
| SC-BIZ-4 | Retention 90 jours | >70% | John PM |
| SC-BIZ-5 | Time-to-value | <2h | Sally UX |
| SC-BIZ-6 | Satisfaction globale (CSAT) | >3.5/5 | John PM |
| SC-BIZ-7 | Flywheel OSS -> Team -> Enterprise | 500 MAU OSS | Marketing |

### 3.8 Mapping SC -> Epics (Vue Inverse)

```
SC-A1..A5 (5 criteres)  --> Orchestrateur Deterministe
SC-B1..B5 (5 criteres)  --> Observabilite (B1-B4) + Containerisation (B5)
SC-C1..C4 (4 criteres)  --> Multi-User (C1-C2) + Onboarding (C3) + Scoping (C4)
SC-D1..D4 (4 criteres)  --> A2A/Permissions (D1-D3) + RBAC (D4)
SC-E1..E4 (4 criteres)  --> Dual-Speed (E1-E3) + Chat (E4)
SC-BIZ1..7 (7 criteres) --> Transverses (tous les epics contribuent)
```

**Analyse critique :** Les SC du Noyau A (Orchestrateur) sont les plus difficiles a atteindre en 3 mois. SC-A2 (drift <15 min) et SC-A5 (compaction >80%) demandent un spike technique d'une semaine minimum. Les SC Business (BIZ) sont des indicateurs retardes qui dependront de la qualite de la demo et du suivi CBA.

---

## 4. User Value par Story

### 4.1 Valeur par Persona et par Story

Chaque story est evaluee selon le persona qui en beneficie directement et la raison pour laquelle cette story cree de la valeur.

#### CEO -- Le Pilote Strategique

| Story | Valeur Directe | Emotion Visee |
|-------|---------------|---------------|
| Dashboard CEO simplifie | "J'ouvre MnM et je vois tout sans rien demander" | Satisfaction profonde |
| Dashboards agreges (jamais individuels) | "C'est un outil de visibilite, pas de surveillance" | Confiance ethique |
| Audit log complet | "Je peux prouver au board que l'IA est sous controle" | Securite decisionnelle |

**Pourquoi le CEO compte pour la demo CBA :** Le DPO/CEO de CBA est le sponsor du projet. S'il n'a pas de visibilite immmediate, il perdra confiance. Le dashboard executif est son "moment de verite".

#### CTO -- Le Garant Technique

| Story | Valeur Directe | Emotion Visee |
|-------|---------------|---------------|
| RBAC 4 roles + enforcement | "Mes equipes ont les bons droits, point final" | Controle total |
| Orchestrateur deterministe | "Les workflows sont des contrats, pas des suggestions" | Confiance technique |
| Drift detection | "Je vois en temps reel quand un agent devie" | Maitrise |
| Containerisation | "Agents isoles, credentials proteges, zero risk" | Serenite |
| hasPermission() corrige (scope JSONB) | "Le systeme de permissions n'a pas de trou" | Confiance securite |

**Pourquoi le CTO compte pour la demo CBA :** C'est le decision-maker technique. S'il detecte un trou de securite ou un manque de rigueur, c'est game over. Les stories RBAC et containerisation repondent directement a ses "questions pieges".

#### Developpeur -- L'Artisan du Code

| Story | Valeur Directe | Emotion Visee |
|-------|---------------|---------------|
| Chat temps reel avec agent | "Je pilote mon agent comme un copilote, pas un fire-and-forget" | Fascination + controle |
| Execution step-by-step imposee | "L'agent suit MON workflow, pas son idee du workflow" | Controle |
| Fichiers obligatoires par etape | "L'agent a TOUJOURS le bon contexte, pas besoin de re-expliquer" | Soulagement |
| Kill+relance compaction | "Quand l'agent perd le fil, il est relance proprement" | Confiance |

**Pourquoi le dev compte pour la demo CBA :** Les devs CBA sont les early adopters quotidiens. Si le chat est fluide et l'orchestrateur fiable, ils deviennent les evangelistes internes.

#### PO / PM -- Les Traducteurs de Besoins

| Story | Valeur Directe | Emotion Visee |
|-------|---------------|---------------|
| Human-in-the-loop configurable | "Je valide chaque etape critique, rien ne passe sans moi" | Controle qualite |
| Audit log complet | "Je peux tracer chaque decision, pour la retrospective" | Transparence |
| Dashboard de suivi | "Burndown augmente, je vois l'avancement en temps reel" | Efficacite |

#### Lead Tech -- Le Gardien Architecture

| Story | Valeur Directe | Emotion Visee |
|-------|---------------|---------------|
| Drift detection | "Je detecte les violations de patterns en temps reel" | Vigilance |
| Pre-prompts par etape | "Les standards architecturaux sont injectes automatiquement" | Coherence |
| Review augmentee (drift + diff) | "10 min au lieu de 45 min de review manuelle" | Accomplissement |

### 4.2 Matrice Persona x Epic

```
              Multi-User  RBAC  Orchestrateur  Container  Observ.  Chat  Dual-Speed
CEO            Moyen       -       -            -         FORT     -       -
CTO            FORT       FORT    FORT          FORT      FORT     -       Moyen
Dev            Moyen      Moyen   FORT          Moyen     Moyen   FORT    FORT
PO/PM          Moyen      Moyen   FORT          -         FORT    Moyen   Moyen
Lead Tech      Moyen      Moyen   FORT          Moyen     FORT    FORT    Moyen
QA             Moyen      Moyen   Moyen         Moyen     Moyen   -       Moyen
DPO            Moyen      FORT    -             FORT      FORT     -       -
```

**Insight :** L'Orchestrateur Deterministe est le seul epic qui a une valeur **FORTE** pour 4 personas sur 7. C'est objectivement l'epic le plus important du produit.

---

## 5. Go/No-Go Criteria par Phase

### 5.1 Phase 1 -- Multi-User Livrable

**Duree estimee :** 1 semaine | **Equipe :** Tom

| Critere Go/No-Go | Seuil | Methode de Verification |
|-------------------|-------|------------------------|
| Invitation par email fonctionne end-to-end | 100% | Test E2E : envoyer invite -> accepter -> voir page Membres |
| Sign-out invalide la session cote serveur | 100% | Test : token post-signout retourne 401 |
| Signup libre desactivable | Binaire | Config flag + test tentative signup bloquee |
| PostgreSQL externe connecte et fonctionnel | 100% | Smoke test : CRUD basique sur toutes les tables critiques |
| Zero regression sur les features existantes | 0 bug P0 | Suite de tests existante passe a 100% |

**Condition No-Go :** Si `hasPermission()` ne peut pas etre corrige rapidement, basculer le fix en debut de Phase 2 (acceptable car Phase 1 est mono-role de facto).

### 5.2 Phase 2 -- RBAC Metier

**Duree estimee :** 2 semaines | **Equipe :** Tom (ou Cofondateur si recrute)

| Critere Go/No-Go | Seuil | Methode de Verification |
|-------------------|-------|------------------------|
| 4 roles assignables et fonctionnels | 100% | Test : creer user par role, verifier acces |
| `hasPermission()` lit le scope JSONB | 100% | Test unitaire + integration sur 3 routes critiques |
| 15 permission keys operationnelles | 100% | Test : chaque key bloque/autorise correctement |
| Enforcement sur les 22 routes API | 100% | Test automatise : viewer tente chaque route protegee -> 403 |
| Pas de fuite cross-company | 0 leak | Test isolation : user company A ne voit RIEN de company B |

**Condition No-Go :** Si l'enforcement sur les 22 routes n'est pas a 100%, la Phase 3 ne peut PAS demarrer. Le scoping sans enforcement = illusion de securite.

### 5.3 Phase 3 -- Scoping par Projet

**Duree estimee :** 2-3 semaines | **Equipe :** Tom

| Critere Go/No-Go | Seuil | Methode de Verification |
|-------------------|-------|------------------------|
| project_memberships fonctionnel | 100% | Test : assigner user a projet, verifier filtrage |
| Filtrage par scope sur toutes les routes list | 100% | Test : user avec scope = projet X ne voit que projet X |
| Agents et workflows scopables | 100% | Test : agent scope projet X ne s'execute pas sur projet Y |
| UI d'acces par projet operative | Fonctionnelle | Smoke test UX : ajouter/retirer un membre d'un projet |

**Condition No-Go :** Si le filtrage par scope fuit sur ne serait-ce qu'UNE route, rollback et correction avant de continuer.

### 5.4 Phase 4 -- Enterprise-Grade

**Duree estimee :** 3-4 semaines | **Equipe :** Tom + Cofondateur

| Critere Go/No-Go | Seuil | Methode de Verification |
|-------------------|-------|------------------------|
| Audit log immutable (pas d'UPDATE/DELETE) | 100% | Test : tenter un UPDATE sur audit_events -> echec |
| Dashboards CEO et CTO rendus avec donnees reelles | Fonctionnel | Smoke test avec donnees de demo CBA |
| SSO SAML/OIDC fonctionnel (si inclus dans le scope demo) | 1 provider | Test : login via SSO CBA -> session creee |
| Performance API <500ms P95 | Mesure | Load test basique (50 users simultanes) |

**Condition No-Go :** La Phase 4 est partiellement optionnelle pour la demo CBA. SSO et multi-tenant SaaS peuvent etre demontres "en plan" plutot qu'en production si le temps manque.

### 5.5 Vue d'Ensemble Go/No-Go

```
Phase 1 [GO] -----> Phase 2 [GO] -----> Phase 3 [GO] -----> Phase 4 [GO] -----> DEMO CBA
  |                   |                   |                   |
  | NO-GO:            | NO-GO:            | NO-GO:            | NO-GO:
  | PG externe KO     | hasPermission     | Scope fuite       | Audit non-immutable
  | Invite echoue     | non corrige       | sur 1 route       | Dashboard vide
  |                   | Enforcement <100% |                   |
  v                   v                   v                   v
  FIX puis retry     BLOQUANT : ne pas    ROLLBACK + FIX     Phase 4 partielle
                     avancer sans                            acceptable
```

---

## 6. Risk Assessment Business

### 6.1 Risques Classes par Impact sur la Demo CBA

| # | Risque | Probabilite | Impact Demo CBA | Epics Impactes | Mitigation |
|---|--------|------------|-----------------|----------------|------------|
| **R1** | Gestion compaction techniquement plus dure que prevu | Elevee | **CRITIQUE** -- sans compaction, l'orchestrateur est limite aux sessions courtes | Orchestrateur | Spike 1 semaine AVANT le dev principal. Kill+relance comme fallback. |
| **R2** | Recrutement cofondateur retarde (>4 semaines) | Moyenne | **ELEVE** -- reduit la capacite de parallelisation, timeline depassee | Tous | Freelance senior pour la Piste B (containerisation). Tom prend la Piste A. |
| **R3** | hasPermission() + scope JSONB plus complexe que prevu | Faible | **CRITIQUE** -- faille de securite = demo impossible en B2B | RBAC, Scoping | DT1 est estime a 1-2j. Si >5j, simplifier le scope a "global-only" pour la demo et ajouter le scope fin post-demo. |
| **R4** | Performance WebSocket en charge | Faible | **MOYEN** -- chat lent = mauvaise impression mais pas bloquant | Chat | Demo avec 5-10 users simultanes, pas 100. Load test en Phase 3. |
| **R5** | Docker indisponible sur l'infra CBA | Faible | **ELEVE** -- sans containerisation, pas d'isolation B2B | Containerisation | Verifier l'infra CBA des la semaine 1. Plan B : processus isoles avec UID separes. |
| **R6** | Drift detection produit trop de faux positifs | Moyenne | **MOYEN** -- erode la confiance mais ne bloque pas la demo | Orchestrateur | Commencer avec des heuristiques simples (output vs expected file list). Seuil configurable. |
| **R7** | Scope MVP trop ambitieux -- burnout equipe | Moyenne | **ELEVE** -- qualite degradee = mauvaise impression demo | Tous | Respecter strictement le MUST-HAVE. Tout NICE-TO-HAVE est coupable jusqu'a preuve du contraire. |

### 6.2 Risques Ordonnes par Criticite

```
CRITICITE MAXIMALE (bloquent la demo) :
  1. R1 -- Compaction        --> Spike semaine 1, pas de compromis
  2. R3 -- hasPermission()   --> DT1, fixer en Phase 2 debut
  3. R2 -- Recrutement       --> Freelance en backup

CRITICITE ELEVEE (degradent la demo) :
  4. R5 -- Docker @ CBA      --> Verifier infra semaine 1
  5. R7 -- Scope trop large  --> Discipline MUST-HAVE only

CRITICITE MOYENNE (gerees en runtime) :
  6. R6 -- Drift faux positifs --> Seuil configurable
  7. R4 -- Perf WebSocket      --> Demo petit volume
```

### 6.3 Impact d'un Retard par Epic

Quel est l'impact si un epic prend 2 semaines de plus que prevu ?

| Epic en Retard | Impact sur la Demo | Degradation Gracieuse Possible ? |
|---------------|-------------------|----------------------------------|
| **Multi-User** | FATAL -- impossible de demontrer le multi-user | Non. Epic de 1 semaine, pas de marge pour le retard. |
| **RBAC** | FATAL -- impossible de montrer la separation des roles | Partiellement : demo avec 2 roles (Admin + Contributor) au lieu de 4. |
| **Orchestrateur** | SEVERE -- demo sans coeur de value prop | Oui : demo avec orchestrateur "allege" (step-by-step sans drift detection). Drift = Phase post-demo. |
| **Containerisation** | GRAVE -- pas d'isolation B2B | Oui : demo en single-tenant sans container (processus directs). "Container prevu pour la mise en production." |
| **Observabilite** | MODERE -- pas de dashboard, mais demo des logs | Oui : montrer les logs bruts + promettre les dashboards pour la mise en production. |
| **Chat** | MODERE -- pas de pilotage temps reel | Oui : montrer l'execution batch avec resultats. Moins impressionnant mais fonctionnel. |

**Conclusion :** Les 3 epics dont le retard est le plus dangereux sont Multi-User, RBAC, et Orchestrateur. Ce sont aussi les 3 premiers dans le sequencement recommande -- c'est coherent.

---

## 7. Split Cofondateurs : Tom vs Cofondateur

### 7.1 Repartition par Noyau de Valeur

| Cofondateur | Noyaux | Profil Requis | Epics |
|------------|--------|---------------|-------|
| **Tom** | B (Observabilite) + C (Onboarding) | Product Engineer -- UI/UX, adoption, import | Multi-User, Observabilite, Onboarding, Dual-Speed (UI) |
| **Cofondateur** | A (Orchestrateur) + D (A2A/Permissions) | Ingenieur Systeme -- moteur, compaction, state machine, drift, container | Orchestrateur, Containerisation, RBAC (backend), Scoping, Chat (backend) |
| **Partage** | D (Observabilite & Audit) | Les deux contribuent | Audit log, dashboards |

### 7.2 Timeline Parallele Recommandee

```
             SEMAINE 1-2           SEMAINE 3-4           SEMAINE 5-6           SEMAINE 7-8          SEMAINE 9-10
TOM        : Multi-User MVP       Observabilite v1      Scoping UI            Dashboard CEO/CTO    Polish + Demo prep
             (Phase 1)             + Audit log           + Navigation          + Dual-Speed UI
COFONDATEUR: Spike Compaction      Orchestrateur v1      RBAC enforcement      Containerisation     Chat temps reel
             + RBAC backend        (state machine,       sur 22 routes         + Credential proxy   + Integration
             (roles, keys)         drift, HITL)          + Scoping backend                          tests
```

### 7.3 Points de Synchronisation Obligatoires

| Semaine | Point de Sync | Decision |
|---------|--------------|----------|
| Fin S2 | Phase 1 terminee + Spike compaction | Go/No-Go sur la strategie de compaction |
| Fin S4 | RBAC + Orchestrateur v1 fonctionnels | Go/No-Go Phase 3 (scoping) ou pivot sur containerisation |
| Fin S6 | Scoping + Observabilite fonctionnels | Evaluation : on attaque Phase 4 ou on polish le MVP ? |
| Fin S8 | Containerisation + Chat | Go/No-Go Demo CBA. Si retard, couper NICE-TO-HAVE restant. |
| S9-10 | Preparation demo | Bug fixing, donnees demo, script demo, repetition |

### 7.4 Dependances Inter-Cofondateurs

```
TOM --------- Multi-User ------+
                                |
COFONDATEUR -- RBAC backend ----+--> Integration Phase 2
                                |
TOM --------- Observabilite ----+
                                |
COFONDATEUR -- Orchestrateur ---+--> Integration Transverse
                                |
                          [Scoping = necessite RBAC + Multi-User]
                          [Container = independant, parallelisable]
                          [Chat = necessite Container en prod, mais peut demarrer sans]
```

**Risque principal du split :** Le scoping (Phase 3) depend de travaux des DEUX cofondateurs (Multi-User par Tom, RBAC backend par le Cofondateur). Si l'un est en retard, le scoping est bloque. **Mitigation :** RBAC backend doit etre termine avant la fin de la semaine 4, sans exception.

---

## 8. Synthese Executif

### 8.1 Les 5 Decisions Cles

1. **Le MVP strict se concentre sur 6 epics** : Multi-User, RBAC, Orchestrateur, Containerisation, Observabilite basique, Chat temps reel. Tout le reste est NICE-TO-HAVE.

2. **L'Orchestrateur Deterministe est le coeur du produit.** C'est l'epic avec l'impact business le plus eleve (10/10) sur le plus de personas (4 sur 7). Il doit etre priorise en consequence.

3. **Le scope JSONB dans hasPermission() est un fix de securite P0.** Ce n'est pas un "enhancement" -- c'est un trou de securite critique qui doit etre comble en Phase 2, premier jour.

4. **Le spike compaction doit se faire en semaine 1-2**, avant meme que le developpement de l'orchestrateur commence. C'est le risque technique #1 du projet.

5. **La demo CBA est faisable en 8-10 semaines** avec 2 developpeurs, a condition de respecter STRICTEMENT le perimetre MUST-HAVE. Chaque NICE-TO-HAVE ajoute est une dette sur la timeline.

### 8.2 Criteres de Succes de la Demo CBA

Pour que la demo CBA soit consideree comme un succes et mene a un POC signe :

- [ ] Le CTO CBA peut inviter 3-5 membres avec des roles differents
- [ ] Un workflow deterministe de 4+ etapes s'execute correctement
- [ ] Un drift est detecte et affiche en <15 minutes
- [ ] Un agent est arrete et relance proprement (kill+relance)
- [ ] Le dev CBA dialogue en temps reel avec son agent
- [ ] Le CEO voit un dashboard de supervision avec KPIs agreges
- [ ] Les agents sont containerises et les credentials isolees
- [ ] L'audit log trace chaque action de maniere verifiable

**Si ces 8 points sont couverts, le POC CBA est gagne.**

---

*Sprint Section 3 — Priorisation Business & Frontieres MVP — ~3200 mots*
*Prochaine etape : Integration avec les sections des co-equipiers pour le sprint plan consolide.*
