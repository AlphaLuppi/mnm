# Sprint Planning — Section 1 : Decomposition Epics & Stories

> **Auteur** : Bob (Scrum Master — LEAD Sprint Planning)
> **Version** : 1.0 | **Date** : 2026-03-14
> **Sources** : PRD B2B v1.0, Architecture B2B v1.0, UX Design B2B v1.0
> **Split Cofondateurs** : Tom (Gabri) = Noyaux B + C | Cofondateur = Noyaux A + D | Noyau E = Partagé

---

## Table des Matieres

1. [Vue d'ensemble Sprints](#1-vue-densemble-sprints)
2. [Sprint 0 — Setup & Fondations](#2-sprint-0--setup--fondations)
3. [Epic MU — Multi-User & Auth](#3-epic-mu--multi-user--auth)
4. [Epic RBAC — Roles & Permissions](#4-epic-rbac--roles--permissions)
5. [Noyau A — Orchestrateur Deterministe](#5-noyau-a--orchestrateur-deterministe)
6. [Noyau B — Observabilite & Audit](#6-noyau-b--observabilite--audit)
7. [Noyau C — Onboarding Cascade](#7-noyau-c--onboarding-cascade)
8. [Noyau D — Agent-to-Agent + Permissions](#8-noyau-d--agent-to-agent--permissions)
9. [Noyau E — Dual-Speed Workflow](#9-noyau-e--dual-speed-workflow)
10. [Epic CHAT — Chat Temps Reel](#10-epic-chat--chat-temps-reel)
11. [Epic CONT — Containerisation](#11-epic-cont--containerisation)
12. [Synthese Sprints & Timeline](#12-synthese-sprints--timeline)
13. [Graphe de Dependances Global](#13-graphe-de-dependances-global)
14. [Matrice Parallelisme Tom / Cofondateur](#14-matrice-parallelisme-tom--cofondateur)

---

## 1. Vue d'ensemble Sprints

### 1.1 Structure temporelle

| Sprint | Duree | Focus | Objectif de livraison |
|--------|-------|-------|-----------------------|
| **Sprint 0** | 1 semaine | Setup, infra, design system | Environnement pret, CI/CD, tokens UX, PostgreSQL externe |
| **Sprint 1** | 2 semaines | FR-MU + FR-RBAC (base) | Multi-user fonctionnel, invitations, 4 roles, sign-out |
| **Sprint 2** | 2 semaines | FR-RBAC (avance) + FR-ORCH (base) | Scope JSONB, enforcement routes, state machine v1 |
| **Sprint 3** | 2 semaines | FR-ORCH (complet) + FR-OBS (base) | Drift detection, compaction, audit log enterprise |
| **Sprint 4** | 2 semaines | FR-CONT + FR-CHAT | Containerisation Docker, chat WebSocket bidirectionnel |
| **Sprint 5** | 2 semaines | FR-A2A + FR-DUAL + FR-ONB | Bus A2A, curseur automatisation, onboarding cascade |
| **Sprint 6** | 2 semaines | Enterprise + Polish | SSO, dashboards, import Jira, stabilisation |

**Total** : ~13 semaines (Sprint 0 + 6 sprints de 2 semaines) = **Demo CBA juin 2026**.

### 1.2 Principes de planification

1. **Parallelisme maximal** : Tom et Cofondateur travaillent sur des noyaux distincts sauf Noyau E (partage explicite)
2. **Prerequis respectes** : Sprint 0 → Sprint 1 (MU) → Sprint 2 (RBAC) sont sequentiels et prealables a tout
3. **Increment livrable** : chaque sprint produit un increment deployable et testable
4. **Definition of Ready** : chaque story a des ACs Given/When/Then, des dependances claires, et une assignation
5. **Risque R1 (compaction)** : spike technique en Sprint 2, implementation en Sprint 3

---

## 2. Sprint 0 — Setup & Fondations

**Duree** : 1 semaine
**Objectif** : Poser les bases techniques et UX pour le developpement B2B
**Assignation** : Partage Tom + Cofondateur

### Story S0-S01
**Titre** : Migration PostgreSQL externe
**Description** : Migrer de SQLite/embedded vers PostgreSQL 16 externe. Prerequis technique pour RLS, multi-tenant, et toute la stack B2B.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : Aucun
**Debloque** : MU-S01, RBAC-S01, tous les sprints suivants

**Acceptance Criteria** :
- Given le serveur MnM When il demarre Then il se connecte a PostgreSQL 16 externe
- Given les 38 tables existantes When la migration s'execute Then toutes les donnees sont preservees sans perte
- Given un test d'integration When il s'execute Then il utilise embedded-postgres pour l'isolation

---

### Story S0-S02
**Titre** : Pipeline CI/CD GitHub Actions
**Description** : Mettre en place la pipeline CI avec les 7 quality gates definis dans l'architecture (QG-0 a QG-6).
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : Aucun
**Debloque** : Tous les sprints (QG obligatoires)

**Acceptance Criteria** :
- Given un push sur une branche When la pipeline CI s'execute Then QG-0 (lint+TypeScript) et QG-1 (tests unitaires) passent
- Given la pipeline CI When un test echoue Then le merge est bloque automatiquement
- Given le caching pnpm When la pipeline s'execute Then la duree totale est < 15 min

---

### Story S0-S03
**Titre** : Design System — Tokens & Composants de base
**Description** : Implementer les design tokens CSS (couleurs, spacing, typographie) et configurer les composants shadcn/ui supplementaires (12 composants a ajouter).
**Assignation** : Tom
**Effort** : M
**Bloque par** : Aucun
**Debloque** : Toutes les stories UI des sprints suivants

**Acceptance Criteria** :
- Given le fichier CSS principal When les tokens sont charges Then les couleurs semantiques (success, warning, error, agent) et les couleurs par role RBAC sont disponibles
- Given les 12 composants shadcn/ui supplementaires When ils sont installes Then DataTable, Toggle, Switch, Progress, Slider, Alert, Form, RadioGroup, HoverCard, NavigationMenu, Accordion, Sheet sont utilisables
- Given le mode dark et light When l'utilisateur bascule Then tous les tokens s'adaptent correctement

---

### Story S0-S04
**Titre** : Schema DB — Nouvelles tables B2B (migration 001)
**Description** : Creer les 10 nouvelles tables B2B et modifier les 5 tables existantes. Migration Drizzle reversible.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : S0-S01 (PostgreSQL externe)
**Debloque** : MU-S01, RBAC-S01, OBS-S01, CHAT-S01

**Acceptance Criteria** :
- Given la migration 001 When elle s'execute Then les 10 tables (project_memberships, automation_cursors, chat_channels, chat_messages, container_profiles, container_instances, credential_proxy_rules, audit_events, sso_configurations, import_jobs) sont creees
- Given les 5 tables existantes When la migration s'execute Then les colonnes ajoutees (companies.tier, company_memberships.businessRole, agents.containerProfileId, etc.) sont presentes
- Given la migration 001 When on execute le rollback Then toutes les modifications sont annulees proprement

---

### Story S0-S05
**Titre** : Test infrastructure — Factories & Seed
**Description** : Creer les factories TypeScript pour les tests (users, companies, agents, workflows) et le seed E2E pour Cypress.
**Assignation** : Tom
**Effort** : S
**Bloque par** : S0-S04 (schema DB)
**Debloque** : Tous les tests d'integration et E2E

**Acceptance Criteria** :
- Given une factory `createUser()` When elle est appelee Then elle genere un utilisateur valide avec tous les champs requis
- Given une factory `createCompany()` When elle est appelee Then elle genere une company avec memberships et permissions
- Given le seed E2E When Cypress demarre Then les donnees de test sont coherentes et reproductibles

---

## 3. Epic MU — Multi-User & Auth

**Noyau** : Transverse (prerequis pour tout)
**FRs couverts** : FR-MU (REQ-MU-01 a REQ-MU-07)
**Sprint** : Sprint 1
**Assignation principale** : Tom (frontend) + Cofondateur (backend)
**Effort total** : ~1 semaine

### Story MU-S01
**Titre** : API invitations par email
**Description** : Endpoint POST /api/invites pour envoyer des invitations par email avec lien signe (expire 7 jours). Utilise le systeme d'invites existant.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : S0-S04 (schema DB)
**Debloque** : MU-S02, MU-S03

**Acceptance Criteria** :
- Given un admin ou manager When il POST /api/invites avec un email valide Then une invitation est creee avec un token signe et une date d'expiration a J+7
- Given un utilisateur non-admin/manager When il POST /api/invites Then il recoit un 403 Forbidden
- Given une invitation existante pour le meme email When on reenvoie Then l'ancienne est invalidee et une nouvelle est creee
- Given un email invalide When il POST /api/invites Then il recoit un 400 avec message d'erreur Zod

---

### Story MU-S02
**Titre** : UI Invitation Modal
**Description** : Composant InviteModal pour inviter des membres par email (un ou plusieurs). Champ email, selection du role, bouton envoyer.
**Assignation** : Tom
**Effort** : S
**Bloque par** : MU-S01 (API invitations), S0-S03 (design system)
**Debloque** : MU-S05

**Acceptance Criteria** :
- Given un admin sur la page Membres When il clique "Inviter" Then la modale s'ouvre avec champ email et selecteur de role
- Given l'admin remplit le formulaire When il clique "Envoyer" Then l'invitation est envoyee et un toast success s'affiche
- Given un email deja membre When l'admin tente d'inviter Then un message d'erreur inline apparait
- Given la modale When elle est affichee Then elle est accessible (clavier, ARIA labels, focus trap)

---

### Story MU-S03
**Titre** : Acceptation d'invitation & creation de compte
**Description** : Flow complet : clic lien invite → creation compte → rattachement a la company avec le role predefini.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : MU-S01 (API invitations)
**Debloque** : MU-S05

**Acceptance Criteria** :
- Given un lien d'invitation valide When l'utilisateur clique Then il arrive sur une page de creation de compte avec la company pre-selectionnee
- Given un lien expire (>7 jours) When l'utilisateur clique Then il voit un message "Invitation expiree, contactez votre administrateur"
- Given un utilisateur qui cree son compte via invitation When il se connecte Then il est automatiquement membre de la company avec le role defini dans l'invitation

---

### Story MU-S04
**Titre** : Page Membres avec tableau et actions
**Description** : Composant MembersTable avec la liste des membres, leurs roles, statut, et actions (changer role, desactiver). Filtres par role et recherche.
**Assignation** : Tom
**Effort** : M
**Bloque par** : S0-S03 (design system), MU-S01 (API)
**Debloque** : RBAC-S04

**Acceptance Criteria** :
- Given un admin When il accede a /members Then il voit un tableau avec nom, email, role, date d'ajout, statut pour chaque membre
- Given le tableau When il y a plus de 20 membres Then la pagination est activee
- Given un admin When il clique sur "Changer role" Then un dropdown apparait avec les 4 roles disponibles
- Given un viewer When il accede a /members Then la page n'est pas accessible (redirect ou 403)

---

### Story MU-S05
**Titre** : Desactivation signup libre & sign-out
**Description** : Flag company pour desactiver le signup libre (invitation-only). Bouton sign-out avec invalidation de session cote serveur.
**Assignation** : Cofondateur
**Effort** : S
**Bloque par** : MU-S01 (API invitations)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given une company avec signup libre desactive When un utilisateur tente de s'inscrire sans invitation Then il recoit un message "Inscription sur invitation uniquement"
- Given un utilisateur connecte When il clique "Deconnexion" Then sa session est invalidee cote serveur et il est redirige vers la page de login
- Given une session invalidee When un appel API est fait avec l'ancien token Then il recoit un 401 Unauthorized

---

### Story MU-S06
**Titre** : Selecteur de Company (multi-company)
**Description** : Composant CompanySelector dans le header pour basculer entre companies (si l'utilisateur est membre de plusieurs).
**Assignation** : Tom
**Effort** : S
**Bloque par** : MU-S04 (page membres)
**Debloque** : RBAC-S04

**Acceptance Criteria** :
- Given un utilisateur membre de 2+ companies When il clique sur le selecteur Then il voit la liste de ses companies
- Given l'utilisateur selectionne une autre company When il clique Then le contexte bascule (sidebar, donnees, permissions) sans rechargement complet
- Given un utilisateur membre d'une seule company When il regarde le header Then le selecteur n'est pas affiche

---

## 4. Epic RBAC — Roles & Permissions

**Noyau** : Transverse (prerequis pour tous les noyaux)
**FRs couverts** : FR-RBAC (REQ-RBAC-01 a REQ-RBAC-08)
**Sprint** : Sprint 1 (base) + Sprint 2 (avance)
**Assignation principale** : Cofondateur (backend critique) + Tom (UI)
**Effort total** : ~2 semaines

### Story RBAC-S01
**Titre** : Correction critique hasPermission() — lecture scope JSONB
**Description** : Corriger access.ts:45-66 pour lire et appliquer le champ scope JSONB sur principal_permission_grants. C'est le trou de securite le plus critique du projet (INV-04).
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : S0-S04 (schema DB)
**Debloque** : RBAC-S02, RBAC-S03, tout le systeme de permissions

**Acceptance Criteria** :
- Given un grant avec scope `{ projectIds: ["p1", "p2"] }` When hasPermission est appele avec projectId "p1" Then il retourne true
- Given un grant avec scope `{ projectIds: ["p1", "p2"] }` When hasPermission est appele avec projectId "p3" Then il retourne false
- Given un grant avec scope null When hasPermission est appele Then il retourne true (acces global company)
- Given un scope JSONB malforme When il est parse Then Zod lance une erreur et l'acces est refuse
- Given le middleware requirePermission When il est applique sur une route Then il extrait automatiquement le projectId du contexte de requete

---

### Story RBAC-S02
**Titre** : 4 roles metier avec presets de permissions
**Description** : Definir les 4 roles metier (Admin, Manager, Contributor, Viewer) avec leurs presets de 15 permission keys. Creer role-presets.ts et les 9 nouvelles permission keys.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : RBAC-S01 (hasPermission corrige)
**Debloque** : RBAC-S03, RBAC-S04

**Acceptance Criteria** :
- Given le role Admin When on consulte ses permissions Then il a les 15 permission keys
- Given le role Manager When on consulte ses permissions Then il a : members.invite, projects.*, workflows.*, agents.launch, stories.*, audit.view, chat.agent
- Given le role Contributor When on consulte ses permissions Then il a : agents.launch, stories.*, chat.agent
- Given le role Viewer When on consulte ses permissions Then il a : audit.view, dashboard.view
- Given un nouveau membre When il est ajoute avec un role Then les permissions du preset sont automatiquement attribuees

---

### Story RBAC-S03
**Titre** : Enforcement RBAC sur les 22 fichiers de routes
**Description** : Appliquer le middleware requirePermission() sur chaque route API. Audit systematique des 22 fichiers de routes, priorite sur les 3 fichiers critiques sans aucun check (approvals, assets, secrets).
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : RBAC-S01 (hasPermission), RBAC-S02 (roles)
**Debloque** : RBAC-S05

**Acceptance Criteria** :
- Given un Viewer When il appelle POST /api/agents Then il recoit un 403 Forbidden
- Given un Contributor When il appelle PUT /api/members/:id/role Then il recoit un 403 Forbidden
- Given un Admin When il appelle n'importe quelle route Then il a acces
- Given les 3 fichiers critiques (approvals, assets, secrets) When ils sont audites Then chaque route a un middleware requirePermission
- Given chaque mutation API When elle est executee Then un audit log est emis

---

### Story RBAC-S04
**Titre** : UI Admin — Page Roles & Matrice Permissions
**Description** : Composants RoleSelector, PermissionMatrix, et RoleBadge. Page admin pour visualiser et modifier les permissions par role.
**Assignation** : Tom
**Effort** : M
**Bloque par** : RBAC-S02 (roles definis), MU-S04 (page membres), S0-S03 (design system)
**Debloque** : RBAC-S06

**Acceptance Criteria** :
- Given un admin When il accede a /settings/roles Then il voit une matrice avec les 4 roles en colonnes et les 15 permissions en lignes
- Given un admin When il modifie une permission pour un role Then la modification est sauvegardee et prise en compte immediatement
- Given un badge de role When il s'affiche Then il utilise la couleur correcte (Admin=rouge, Manager=bleu, Contributor=vert, Viewer=gris)
- Given un non-admin When il tente d'acceder a /settings/roles Then il est redirige vers la page d'accueil

---

### Story RBAC-S05
**Titre** : Masquage navigation selon permissions
**Description** : Implementer NavigationGuard : les items de la sidebar et du menu sont absents du DOM (pas grises) si l'utilisateur n'a pas la permission. Utilise canUser() cote client.
**Assignation** : Tom
**Effort** : M
**Bloque par** : RBAC-S03 (enforcement backend), RBAC-S04 (UI admin)
**Debloque** : Toutes les pages UI des sprints suivants

**Acceptance Criteria** :
- Given un Viewer When il voit la sidebar Then les items "Membres", "Workflows", "Agents" sont absents du DOM
- Given un Contributor When il voit la sidebar Then l'item "Parametres" est absent du DOM
- Given un Admin When il voit la sidebar Then tous les items sont presents
- Given un utilisateur When sa permission change en temps reel Then la sidebar se met a jour sans rechargement de page

---

### Story RBAC-S06
**Titre** : Project Memberships & Scoping par projet
**Description** : Implementer la table project_memberships et le filtrage par scope JSONB. Un utilisateur avec scope restreint ne voit que les projets auxquels il est assigne.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : RBAC-S01 (scope JSONB), S0-S04 (schema DB)
**Debloque** : A-S01, D-S01

**Acceptance Criteria** :
- Given un admin When il assigne un membre a un projet Then une entree project_membership est creee
- Given un Contributor avec scope `{ projectIds: ["p1"] }` When il appelle GET /api/projects Then il ne voit que le projet "p1"
- Given un Contributor avec scope `{ projectIds: ["p1"] }` When il appelle GET /api/agents?projectId=p2 Then il recoit un 403
- Given un Admin (scope null) When il appelle GET /api/projects Then il voit tous les projets de la company

---

## 5. Noyau A — Orchestrateur Deterministe

**FRs couverts** : FR-ORCH (REQ-ORCH-01 a REQ-ORCH-10)
**Sprint** : Sprint 2 (base) + Sprint 3 (complet)
**Assignation** : **Cofondateur** (noyau principal)
**Effort total** : ~3-4 semaines

### Epic A1 — State Machine & Enforcement

### Story A1-S01
**Titre** : WorkflowEnforcer — State machine avec transitions gardees
**Description** : Creer workflow-enforcer.ts et workflow-state-machine.ts. Implementer les 12 transitions (CREATED → READY → IN_PROGRESS → VALIDATING → COMPLETED + PAUSED, FAILED, COMPACTING, SKIPPED) avec gardes de transition.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : RBAC-S06 (scoping projets)
**Debloque** : A1-S02, A1-S03, A2-S01

**Acceptance Criteria** :
- Given un workflow avec 5 etapes When un agent est en etape 2 Then il ne peut PAS passer a l'etape 4 (transition invalide)
- Given une transition READY → IN_PROGRESS When les fichiers obligatoires sont manquants Then la transition est refusee avec message explicite
- Given une transition valide When elle s'execute Then l'etat est persiste en base et un audit log est emis
- Given l'etape "VALIDATING" When elle est atteinte et human-in-the-loop est configure Then l'agent est mis en pause en attente de validation humaine

---

### Story A1-S02
**Titre** : Pre-prompts et fichiers obligatoires par etape
**Description** : Chaque etape de workflow peut definir des pre-prompts (contexte injecte a l'agent) et des fichiers obligatoires (refuses si absents). Le WorkflowEnforcer les verifie avant chaque transition.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : A1-S01 (state machine)
**Debloque** : A1-S03

**Acceptance Criteria** :
- Given une etape avec pre-prompts definis When l'agent demarre cette etape Then les pre-prompts sont injectes dans le contexte de l'agent
- Given une etape avec fichiers obligatoires When les fichiers existent Then la transition est acceptee
- Given une etape avec fichiers obligatoires When un fichier manque Then la transition est refusee et le fichier manquant est specifie dans l'erreur
- Given les resultats intermediaires d'une etape When l'etape se termine Then ils sont persistes en base (stage_instances)

---

### Story A1-S03
**Titre** : Validation humaine configurable (human-in-the-loop)
**Description** : Points de validation humaine configurables par etape. Quand l'agent atteint un point de validation, il se met en pause et notifie l'utilisateur. L'utilisateur approuve ou rejette.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : A1-S01 (state machine), A1-S02 (pre-prompts)
**Debloque** : A2-S01

**Acceptance Criteria** :
- Given une etape avec human-in-the-loop=true When l'agent atteint l'etat VALIDATING Then il est mis en pause et une notification est envoyee via WebSocket
- Given une validation en attente When l'utilisateur approuve Then l'agent reprend a l'etape suivante
- Given une validation en attente When l'utilisateur rejette Then l'agent retourne a l'etat IN_PROGRESS avec le feedback du rejet
- Given un timeout de validation (configurable) When il est depasse Then une alerte est emise mais l'agent reste en pause

---

### Epic A2 — Drift Detection & Compaction

### Story A2-S01
**Titre** : Drift Detection basique (<15 min)
**Description** : DriftDetector qui compare l'etat attendu (workflow template) vs l'etat observe (actions de l'agent). Detection des deviations avec severite (Info/Warning/Critical). Alerte via WebSocket.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : A1-S01 (state machine)
**Debloque** : A2-S02, A2-S04

**Acceptance Criteria** :
- Given un agent en etape 3 When il produit des fichiers non attendus par l'etape Then un DriftAlert de severite "Warning" est emis
- Given un DriftAlert When il est detecte Then une notification WebSocket est envoyee en <15 minutes
- Given un DriftAlert When l'utilisateur le consulte Then il voit un diff visuel entre l'attendu et l'observe
- Given le drift-monitor When le serveur redemarre Then les alertes drift sont restaurees depuis la base (pas en memoire seulement)

---

### Story A2-S02
**Titre** : Gestion Compaction — Kill+Relance
**Description** : CompactionWatcher detecte la compaction (reduction soudaine du contexte via heartbeats). Strategie kill+relance : tuer l'agent, relancer avec contexte frais + resultats intermediaires deja produits. Circuit breaker max 3 relances.
**Assignation** : Cofondateur
**Effort** : XL
**Bloque par** : A2-S01 (drift detection), A1-S01 (state machine)
**Debloque** : A2-S03

**Acceptance Criteria** :
- Given un agent en execution When une compaction est detectee (reduction soudaine heartbeat context) Then le CompactionWatcher declenche la strategie configuree
- Given la strategie "kill+relance" When elle s'execute Then l'agent est tue, un nouveau container est lance, les resultats intermediaires sont reinjectes
- Given 3 relances successives When la compaction persiste Then le circuit breaker s'active et une alerte humaine est emise
- Given une table compaction_snapshots When une compaction est detectee Then l'etat pre-compaction est sauvegarde (resultats, fichiers, position workflow)

---

### Story A2-S03
**Titre** : Gestion Compaction — Reinjection pre-prompts
**Description** : Strategie alternative de compaction : reinjecter les pre-prompts et la definition du workflow post-compaction sans tuer l'agent.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : A2-S02 (kill+relance)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given la strategie "reinjection" When elle s'execute Then les pre-prompts de l'etape courante sont reinjectes dans le contexte de l'agent
- Given la reinjection When elle s'execute Then la definition du workflow et la position courante sont reintroduites
- Given un choix de strategie par etape When l'admin configure le workflow Then il peut choisir "kill+relance" ou "reinjection" par etape

---

### Story A2-S04
**Titre** : UI Drift — Pipeline visuel et alertes
**Description** : Composants WorkflowPipeline (barre de progression etapes), StageCard (detail etape), DriftAlert (diff attendu vs observe + actions). Integration dans la page de supervision agent.
**Assignation** : Tom
**Effort** : L
**Bloque par** : A2-S01 (drift detection backend), S0-S03 (design system)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un workflow en cours When l'utilisateur consulte la supervision Then il voit un pipeline visuel avec etapes colorees (gris=a venir, bleu+pulsation=en cours, vert=termine, rouge=erreur, orange=drift)
- Given un DriftAlert actif When l'utilisateur clique dessus Then il voit le diff entre attendu et observe avec les actions proposees (Ignorer/Recharger/Kill+relance/Alerter)
- Given une StageCard When elle affiche une etape completee Then elle montre les resultats intermediaires, la duree, et le statut

---

### Story A2-S05
**Titre** : UI Editeur de Workflow drag-and-drop
**Description** : WorkflowEditor pour creer et modifier des templates de workflow. Drag-and-drop des etapes, configuration des prompts, fichiers obligatoires, et points de validation humaine.
**Assignation** : Tom
**Effort** : XL
**Bloque par** : A2-S04 (pipeline visuel), RBAC-S05 (navigation)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un admin/manager When il accede a l'editeur workflow Then il peut drag-and-drop des etapes pour construire un pipeline
- Given une etape When elle est selectionnee Then l'utilisateur peut configurer : nom, pre-prompt, fichiers obligatoires, human-in-the-loop, strategie compaction
- Given un workflow edite When l'utilisateur sauvegarde Then le template est persiste et disponible pour les nouvelles instances
- Given un workflow en cours d'execution When le template est modifie Then les instances existantes ne sont PAS affectees (version isolee)

---

## 6. Noyau B — Observabilite & Audit

**FRs couverts** : FR-OBS (REQ-OBS-01 a REQ-OBS-06)
**Sprint** : Sprint 3 (base) + Sprint 6 (avance)
**Assignation** : **Tom** (noyau principal)
**Effort total** : ~2-3 semaines

### Epic B1 — Audit Log Enterprise

### Story B1-S01
**Titre** : Table audit_events partitionnee et immutable
**Description** : Creer la table audit_events partitionnee par mois avec TRIGGER deny UPDATE/DELETE. Separation des roles PostgreSQL (mnm_app vs mnm_audit_admin). Retention 3 ans.
**Assignation** : Tom
**Effort** : M
**Bloque par** : S0-S04 (schema DB)
**Debloque** : B1-S02, B1-S03

**Acceptance Criteria** :
- Given la table audit_events When une ligne est inseree Then elle est routee vers la partition du mois courant
- Given un role mnm_app When il tente un UPDATE sur audit_events Then le TRIGGER refuse l'operation
- Given un role mnm_app When il tente un DELETE sur audit_events Then le TRIGGER refuse l'operation
- Given un audit event When il est insere Then il contient : actorId, actorType, action, targetType, targetId, metadata, ipAddress, companyId, prevHash, createdAt

---

### Story B1-S02
**Titre** : Service d'audit — Emission automatique sur mutations
**Description** : Service audit.ts qui emet un audit event pour chaque mutation API. Integration avec le middleware Express pour capturer automatiquement acteur, IP, user-agent.
**Assignation** : Tom
**Effort** : M
**Bloque par** : B1-S01 (table audit_events)
**Debloque** : B1-S03, B2-S01

**Acceptance Criteria** :
- Given une mutation API (POST, PUT, DELETE) When elle s'execute Then un audit event est emis avec les details complets
- Given le middleware d'audit When il capture une requete Then il enregistre actorId, ipAddress, userAgent, action, cible
- Given un audit event When il est emis Then il est persiste de maniere asynchrone (non-bloquant pour la requete)

---

### Story B1-S03
**Titre** : UI Audit Log — Consultation et export
**Description** : Composant AuditLogTable avec tableau paginee, 12 filtres (acteur, action, cible, date, etc.), et export CSV/JSON. Read-only.
**Assignation** : Tom
**Effort** : M
**Bloque par** : B1-S02 (service audit), S0-S03 (design system)
**Debloque** : B2-S02

**Acceptance Criteria** :
- Given un utilisateur avec audit.view When il accede a /audit Then il voit un tableau pagine avec les evenements d'audit
- Given le tableau d'audit When l'utilisateur filtre par "action=create" et "targetType=agent" Then seuls les evenements correspondants sont affiches
- Given un utilisateur avec audit.export When il clique "Exporter CSV" Then un fichier CSV est telecharge avec les donnees filtrees
- Given un utilisateur sans audit.view When il tente d'acceder a /audit Then l'item est absent de la navigation

---

### Epic B2 — Dashboards & Observabilite

### Story B2-S01
**Titre** : Resume LLM temps reel des actions agent
**Description** : Service audit-summarizer.ts qui utilise Claude Haiku pour traduire les logs techniques en langage naturel. Latence < 5 secondes. Les resumes sont affiches dans le flux d'activite.
**Assignation** : Tom
**Effort** : M
**Bloque par** : B1-S02 (service audit)
**Debloque** : B2-S02

**Acceptance Criteria** :
- Given un heartbeat event technique When il est traite par l'audit-summarizer Then un resume en langage naturel est genere en <5 secondes
- Given le resume When il est genere Then il est stocke en cache et diffuse via WebSocket
- Given le provider LLM When il est indisponible Then le systeme affiche le log technique brut en fallback

---

### Story B2-S02
**Titre** : Dashboards management agreges — CEO et CTO
**Description** : Composants DashboardCard et MetricWidget. Dashboard CEO (KPIs headline, avancement par BU, alertes) et Dashboard CTO (agents actifs, drift, containers, metriques compaction). JAMAIS de donnees individuelles (k-anonymity k=5).
**Assignation** : Tom
**Effort** : L
**Bloque par** : B1-S03 (audit UI), B2-S01 (resume LLM), RBAC-S05 (navigation)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un CEO When il ouvre le dashboard Then il voit : agents actifs (nombre), taux workflow complete, drifts en cours, avancement par equipe/BU
- Given un CTO When il ouvre le dashboard Then il voit : graphe drift temps reel, sante containers, metriques compaction, agents actifs par statut
- Given les dashboards When ils affichent des metriques Then elles sont TOUJOURS agregees au niveau equipe minimum (jamais individuel)
- Given une equipe de moins de 5 personnes When ses metriques sont demandees Then elles sont fusionnees avec une autre equipe (k-anonymity k=5)

---

## 7. Noyau C — Onboarding Cascade

**FRs couverts** : FR-ONB (REQ-ONB-01 a REQ-ONB-04)
**Sprint** : Sprint 5 + Sprint 6
**Assignation** : **Tom** (noyau principal)
**Effort total** : ~3-4 semaines

### Epic C1 — Onboarding Hierarchique

### Story C1-S01
**Titre** : Cascade hierarchique — CEO configure le cadre CTO
**Description** : Chaque niveau hierarchique configure le perimetre du niveau inferieur. Le CEO definit la structure organisationnelle, le CTO configure les workflows techniques, le Manager configure les equipes.
**Assignation** : Tom
**Effort** : L
**Bloque par** : RBAC-S06 (scoping projets), MU-S01 (invitations)
**Debloque** : C1-S02, C1-S03

**Acceptance Criteria** :
- Given un CEO When il complete l'onboarding Then il peut definir la structure organisationnelle (BU, equipes)
- Given un CEO When il invite un CTO Then l'invitation contient le perimetre technique pre-configure
- Given un CTO When il accepte l'invitation Then son environnement est pre-configure avec le perimetre defini par le CEO
- Given un Manager When il est invite par le CTO Then il herite du perimetre du CTO restreint a son equipe

---

### Story C1-S02
**Titre** : Agent d'onboarding conversationnel
**Description** : Agent conversationnel qui guide le CEO a travers 5-7 echanges structures pour configurer sa company : nom, secteur, structure, equipes, objectifs.
**Assignation** : Tom
**Effort** : L
**Bloque par** : C1-S01 (cascade), CHAT-S01 (WebSocket bidirectionnel)
**Debloque** : C1-S03

**Acceptance Criteria** :
- Given un nouveau CEO When il se connecte pour la premiere fois Then l'agent d'onboarding demarre automatiquement
- Given l'agent d'onboarding When il pose des questions Then les reponses sont structurees en output exploitable (organigramme, equipes, roles)
- Given 5-7 echanges When ils sont completes Then la structure organisationnelle est generee et presentee visuellement
- Given l'onboarding When il est complete Then le temps total est < 15 minutes

---

### Story C1-S03
**Titre** : Organigramme interactif & invitations cascade
**Description** : Composant OrgChart interactif (drag-and-drop) genere automatiquement depuis les reponses de l'onboarding. Bouton pour envoyer les invitations cascade a tous les niveaux.
**Assignation** : Tom
**Effort** : M
**Bloque par** : C1-S02 (agent onboarding)
**Debloque** : C2-S01

**Acceptance Criteria** :
- Given l'organigramme genere When le CEO le consulte Then il peut drag-and-drop les noeuds pour reorganiser la structure
- Given l'organigramme valide When le CEO clique "Envoyer invitations" Then les invitations sont envoyees a chaque niveau avec le perimetre pre-configure
- Given l'organigramme When il est affiche Then chaque noeud montre : nom, role, statut invitation (en attente/accepte/expire)

---

### Epic C2 — Import Intelligent

### Story C2-S01
**Titre** : Import Jira — Scan et mapping
**Description** : Service import-service.ts qui scanne un projet Jira via API et propose un mapping automatique (projets → projets, epics → epics, stories → issues, users → membres). Table import_jobs pour le suivi.
**Assignation** : Tom
**Effort** : L
**Bloque par** : C1-S01 (cascade hierarchique)
**Debloque** : C2-S02

**Acceptance Criteria** :
- Given un admin When il configure un import Jira Then il fournit l'URL, le token API, et les projets a importer
- Given le scan Jira When il s'execute Then un mapping est propose : projets Jira → projets MnM, statuts Jira → statuts MnM
- Given le mapping When il est affiche Then l'utilisateur peut ajuster les correspondances avant de lancer l'import
- Given un import_job When il est cree Then il a un statut (pending/running/completed/failed) et une progression en pourcentage

---

### Story C2-S02
**Titre** : UI Import — Progression et validation
**Description** : Composant ImportProgress avec barre de progression, log en temps reel, et validation post-import. Supporte Jira, Linear, ClickUp (extensible).
**Assignation** : Tom
**Effort** : M
**Bloque par** : C2-S01 (service import)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un import en cours When l'utilisateur consulte la page Then il voit une barre de progression avec le nombre d'items importes
- Given l'import termine When l'utilisateur valide Then les donnees importees deviennent la source de verite dans MnM
- Given une erreur d'import When elle se produit Then le log affiche l'erreur et l'import peut etre relance partiellement

---

## 8. Noyau D — Agent-to-Agent + Permissions

**FRs couverts** : FR-A2A (REQ-A2A-01 a REQ-A2A-04)
**Sprint** : Sprint 5
**Assignation** : **Cofondateur** (noyau principal)
**Effort total** : ~4-5 semaines

### Epic D1 — Bus A2A

### Story D1-S01
**Titre** : A2ABus — Communication inter-agents avec validation humaine
**Description** : Service a2a-bus.ts qui gere les requetes de contexte entre agents. Chaque requete A2A est soumise a validation humaine obligatoire (human-in-the-loop). Protection anti-boucle (max 5 requetes par chaine).
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : RBAC-S06 (scoping), A1-S01 (state machine)
**Debloque** : D1-S02, D1-S03

**Acceptance Criteria** :
- Given un Agent A When il emet une requete de contexte vers Agent B Then la requete est routee via l'A2ABus
- Given la requete A2A When elle arrive Then le proprietaire humain de l'Agent B recoit une notification pour approbation
- Given le proprietaire When il approuve Then le contexte demande est transmis a l'Agent A
- Given une chaine A2A When elle depasse 5 requetes Then elle est bloquee avec un message "Limite de chaine A2A atteinte"
- Given une requete A2A When elle cree un cycle (A→B→A) Then elle est detectee et bloquee

---

### Story D1-S02
**Titre** : Permissions granulaires inter-agents
**Description** : Les requetes A2A sont filtrees par permissions : scope (meme projet), role (Contributor ne peut pas requeter un agent Admin), et project membership.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : D1-S01 (A2A bus), RBAC-S06 (scoping)
**Debloque** : D1-S03

**Acceptance Criteria** :
- Given un Agent A du projet "Alpha" When il requete un Agent B du projet "Beta" Then la requete est refusee (scope different)
- Given un agent du role Contributor When il requete un agent configure par un Admin Then la requete est autorisee si les projets matchent
- Given chaque transaction A2A When elle s'execute Then un audit log detaille est emis (qui, quoi, vers qui, contexte, resultat)

---

### Story D1-S03
**Titre** : UI A2A — Requetes et approbations
**Description** : Composant A2ARequestCard pour visualiser les requetes A2A en attente avec approbation 1-clic. Historique des transactions A2A. Notification temps reel.
**Assignation** : Tom
**Effort** : M
**Bloque par** : D1-S01 (A2A bus), D1-S02 (permissions), RBAC-S05 (navigation)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given une requete A2A en attente When le proprietaire ouvre sa page de notifications Then il voit une carte avec : agent source, agent cible, contexte demande, boutons Approuver/Rejeter
- Given le proprietaire When il clique "Approuver" Then la requete est traitee et l'Agent A recoit le contexte
- Given l'historique A2A When il est consulte Then il montre toutes les transactions avec statut, date, et audit

---

## 9. Noyau E — Dual-Speed Workflow

**FRs couverts** : FR-DUAL (REQ-DUAL-01 a REQ-DUAL-04)
**Sprint** : Sprint 5
**Assignation** : **Partage** Tom + Cofondateur
**Effort total** : ~2-3 semaines

### Epic E1 — Curseur d'Automatisation

### Story E1-S01
**Titre** : Backend — Table automation_cursors et logique hierarchique
**Description** : Implementer la table automation_cursors avec les 4 niveaux de granularite (action, agent, projet, entreprise) et la hierarchie d'override (le plafond superieur l'emporte).
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : RBAC-S06 (scoping), S0-S04 (schema DB)
**Debloque** : E1-S02

**Acceptance Criteria** :
- Given un curseur au niveau "entreprise" fixe a "assiste" When un utilisateur tente de mettre son curseur agent a "auto" Then c'est refuse — le plafond entreprise l'emporte
- Given un curseur au niveau "projet" fixe a "auto" When un Contributor change son curseur action Then c'est autorise dans la limite du curseur projet
- Given les 4 niveaux When ils sont configures Then la resolution du curseur effectif suit la hierarchie : entreprise > projet > agent > action

---

### Story E1-S02
**Titre** : UI — Composant AutomationCursor (slider 3 positions)
**Description** : Slider segmente 3 positions (Manuel/Assiste/Auto) avec zone verte (accessible) et zone grisee (bloquee par hierarchie). Affiche le plafond actuel et la recommandation basee sur l'historique.
**Assignation** : Tom
**Effort** : M
**Bloque par** : E1-S01 (backend curseur), S0-S03 (design system)
**Debloque** : E1-S03

**Acceptance Criteria** :
- Given un utilisateur When il voit le curseur Then il a 3 positions clairement labellees : Manuel, Assiste, Auto
- Given un plafond hierarchique a "Assiste" When l'utilisateur voit le curseur Then la position "Auto" est grisee avec un tooltip "Limite par votre organisation"
- Given un utilisateur When il deplace le curseur Then le changement est persiste et prend effet immediatement
- Given l'historique d'usage When il est disponible Then une recommandation est affichee ("Basee sur votre usage, nous recommandons...")

---

### Story E1-S03
**Titre** : Integration curseur dans le WorkflowEnforcer
**Description** : Le WorkflowEnforcer consulte le curseur effectif pour determiner si une etape est executee en mode Manuel (humain fait), Assiste (agent propose, humain valide), ou Auto (agent execute, humain supervise).
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : E1-S01 (backend curseur), A1-S01 (state machine)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given le curseur en "Manuel" When une etape demarre Then l'agent observe et l'humain fait — l'agent n'execute pas de code
- Given le curseur en "Assiste" When une etape demarre Then l'agent propose une solution, l'humain valide avant execution
- Given le curseur en "Auto" When une etape demarre Then l'agent execute et l'humain supervise via le dashboard

---

## 10. Epic CHAT — Chat Temps Reel

**FRs couverts** : FR-CHAT (REQ-CHAT-01 a REQ-CHAT-05)
**Sprint** : Sprint 4
**Assignation** : Partage Tom (UI) + Cofondateur (backend)
**Effort total** : ~3 semaines

### Story CHAT-S01
**Titre** : WebSocket bidirectionnel — Extension du protocole existant
**Description** : Etendre live-events-ws.ts de unidirectionnel (serveur → client) a bidirectionnel. Protocole de messages type : le client envoie `{ type: "chat_message", channelId, content }`, le serveur route vers l'agent.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : S0-S04 (schema DB — tables chat_channels, chat_messages)
**Debloque** : CHAT-S02, CHAT-S03

**Acceptance Criteria** :
- Given un client WebSocket connecte When il envoie un message type "chat_message" Then le serveur route le message vers le ChatService
- Given le ChatService When il recoit un message Then il le persiste dans chat_messages et le pipe vers stdin de l'agent
- Given l'agent When il repond Then la reponse est emise via WebSocket au client
- Given la reconnexion When elle se produit Then les messages des 30 dernieres secondes sont synchronises

---

### Story CHAT-S02
**Titre** : ChatService — Canaux et historique
**Description** : Service chat-service.ts qui gere les canaux de chat (1 canal par agent run), l'historique des messages, le rate limiting (10 messages/min), et le pipe vers stdin de l'agent.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : CHAT-S01 (WebSocket bidirectionnel)
**Debloque** : CHAT-S03

**Acceptance Criteria** :
- Given un agent run When il demarre Then un chat_channel est cree automatiquement
- Given un utilisateur When il envoie plus de 10 messages en 1 minute Then les messages supplementaires sont rejetes avec un message "Rate limit atteint"
- Given un agent run termine When l'utilisateur envoie un message Then le message est rejete avec "Session terminee"
- Given un canal de chat When l'historique est demande Then les messages sont retournes paginés par ordre chronologique

---

### Story CHAT-S03
**Titre** : UI ChatPanel — Dialogue temps reel avec agent
**Description** : Composant ChatPanel avec MessageBubble (humain vs agent differencies), TypingIndicator, ConnectionStatus (vert/orange/rouge), et input avec envoi. Panneau fixe 320px a droite.
**Assignation** : Tom
**Effort** : M
**Bloque par** : CHAT-S01 (WebSocket), CHAT-S02 (ChatService), S0-S03 (design system)
**Debloque** : CHAT-S04

**Acceptance Criteria** :
- Given un agent en execution When l'utilisateur ouvre le ChatPanel Then il voit l'historique des messages et peut envoyer de nouveaux messages
- Given un message humain When il est affiche Then il apparait a droite (bulle bleue) et un message agent a gauche (bulle violette)
- Given l'agent qui tape When il genere une reponse Then un TypingIndicator (animation dots) est affiche
- Given la connexion WebSocket When elle est active Then l'indicateur est vert, en reconnexion orange, deconnecte rouge
- Given un Viewer When il ouvre le chat Then il peut lire mais pas envoyer de messages (read-only)

---

### Story CHAT-S04
**Titre** : Chat — Pilotage agent en temps reel
**Description** : L'utilisateur peut envoyer des instructions a l'agent pendant l'execution du workflow. L'agent ajuste son comportement en consequence. Split view : code a gauche, chat a droite.
**Assignation** : Tom
**Effort** : M
**Bloque par** : CHAT-S03 (UI ChatPanel), A1-S01 (state machine)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un agent en execution When l'utilisateur ecrit "Utilise le pattern Repository" Then l'agent integre l'instruction dans son contexte
- Given le split view When il est actif Then le code de l'agent est a gauche avec diff en surbrillance et le chat a droite
- Given un utilisateur When il clique "Stop" Then l'agent s'arrete en <1 seconde et un rollback est propose

---

## 11. Epic CONT — Containerisation

**FRs couverts** : FR-CONT (REQ-CONT-01 a REQ-CONT-07)
**Sprint** : Sprint 4
**Assignation** : **Cofondateur** (backend) + Tom (UI monitoring)
**Effort total** : ~4-5 semaines

### Story CONT-S01
**Titre** : ContainerManager — Lifecycle container Docker
**Description** : Service container-manager.ts qui gere le cycle de vie des containers Docker : creation, demarrage, arret, destruction. Utilise dockerode. Containers ephemeres `--rm --read-only --no-new-privileges`.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : S0-S04 (schema DB — container_profiles, container_instances)
**Debloque** : CONT-S02, CONT-S03

**Acceptance Criteria** :
- Given un profil de container (light/standard/heavy/gpu) When un agent est lance Then un container Docker est cree avec les limites de ressources du profil
- Given le container When il est cree Then il est ephemere (`--rm`), read-only, et sans nouveaux privileges
- Given un container When il doit etre arrete Then il recoit SIGTERM, puis SIGKILL apres 10 secondes si pas de reponse
- Given le demarrage d'un container When il demarre Then le temps est < 10 secondes

---

### Story CONT-S02
**Titre** : Credential Proxy HTTP
**Description** : Service credential-proxy.ts qui intercepte les requetes d'acces aux secrets. Les agents appellent `http://credential-proxy:8090/api/secret/{name}`, le proxy resout via le provider configure (local/AWS/GCP/Vault) sans exposer les cles.
**Assignation** : Cofondateur
**Effort** : L
**Bloque par** : CONT-S01 (ContainerManager)
**Debloque** : CONT-S04

**Acceptance Criteria** :
- Given un agent dans un container When il requete `http://credential-proxy:8090/api/secret/OPENAI_KEY` Then il recoit la cle resolue via le provider
- Given un agent When il tente d'acceder directement au filesystem host Then l'acces est refuse
- Given le fichier `.env` dans le container When il est monte Then il pointe vers `/dev/null` (shadow mount)
- Given une requete de secret invalide When elle est faite Then le proxy retourne un 403 et log un audit event

---

### Story CONT-S03
**Titre** : Mount Allowlist & Isolation reseau
**Description** : Securite des mounts Docker : allowlist avec `realpath()`, symlinks interdits, null bytes bloques. Reseau bridge isole par company — pas de communication inter-company.
**Assignation** : Cofondateur
**Effort** : M
**Bloque par** : CONT-S01 (ContainerManager)
**Debloque** : CONT-S04

**Acceptance Criteria** :
- Given un mount demande When il passe par l'allowlist Then seuls les chemins autorises sont montes
- Given un path avec symlink When il est resolu par `realpath()` Then les symlinks sont detectes et refuses
- Given un path avec null byte When il est soumis Then il est detecte et refuse
- Given deux containers de companies differentes When ils sont sur le reseau Then ils ne peuvent PAS communiquer entre eux (bridges separes)

---

### Story CONT-S04
**Titre** : UI Container — Monitoring et statut
**Description** : Composants ContainerStatus et ResourceMonitor. Affichage du statut des containers actifs, consommation CPU/RAM, et logs en temps reel.
**Assignation** : Tom
**Effort** : S
**Bloque par** : CONT-S01 (ContainerManager), S0-S03 (design system)
**Debloque** : Aucun

**Acceptance Criteria** :
- Given un container actif When l'admin consulte le monitoring Then il voit : nom, profil, CPU%, RAM%, duree, statut
- Given un container When il depasse 80% de RAM Then un indicateur d'alerte (jaune) s'affiche
- Given un container When il est stoppe Then le statut passe a "arrete" avec l'heure et la raison

---

## 12. Synthese Sprints & Timeline

### 12.1 Recapitulatif par Sprint

| Sprint | Tom (Gabri) | Cofondateur | Livrable |
|--------|-------------|-------------|----------|
| **S0** (1 sem) | S0-S03 (Design System), S0-S05 (Factories) | S0-S01 (PostgreSQL), S0-S02 (CI/CD), S0-S04 (Schema DB) | Infra prete |
| **S1** (2 sem) | MU-S02, MU-S04, MU-S06 (UI multi-user) | MU-S01, MU-S03, MU-S05 (API multi-user), RBAC-S01, RBAC-S02 | Multi-user + RBAC base |
| **S2** (2 sem) | RBAC-S04, RBAC-S05 (UI admin RBAC) | RBAC-S03, RBAC-S06 (enforcement routes + scoping), A1-S01 (state machine) | RBAC complet + Orchestrateur v0 |
| **S3** (2 sem) | A2-S04 (UI drift), B1-S01, B1-S02, B1-S03 (audit) | A1-S02, A1-S03, A2-S01, A2-S02 (orchestrateur + drift + compaction) | Orchestrateur v1 + Audit |
| **S4** (2 sem) | CHAT-S03, CHAT-S04, CONT-S04 (UI chat + container) | CHAT-S01, CHAT-S02, CONT-S01, CONT-S02, CONT-S03 (backend chat + container) | Chat + Containerisation |
| **S5** (2 sem) | C1-S01, C1-S02, C1-S03, D1-S03, E1-S02 (onboarding + UI A2A + curseur) | D1-S01, D1-S02, E1-S01, E1-S03, A2-S03 (A2A + curseur + reinjection) | A2A + Onboarding + Dual-Speed |
| **S6** (2 sem) | C2-S01, C2-S02, B2-S01, B2-S02 (import + dashboards) | A2-S05 (editeur workflow), stabilisation, SSO | Enterprise polish |

### 12.2 Timeline visuelle

```
Mars 2026                              Juin 2026
|--- S0 ---|---- S1 ----|---- S2 ----|---- S3 ----|---- S4 ----|---- S5 ----|---- S6 ----|
   1 sem       2 sem        2 sem        2 sem        2 sem        2 sem        2 sem
  SETUP      MULTI-USER    RBAC+ORCH   ORCH+AUDIT  CHAT+CONT    A2A+ONB+DUAL  ENTERPRISE
                                                                               DEMO CBA
```

### 12.3 Jalons critiques

| Jalon | Date estimee | Critere de validation |
|-------|-------------|----------------------|
| **M1 — Infra Ready** | Fin S0 (semaine 1) | PostgreSQL, CI/CD, schema DB, design tokens |
| **M2 — Multi-user MVP** | Fin S1 (semaine 3) | Invitations, page membres, 4 roles, sign-out |
| **M3 — RBAC Complet** | Fin S2 (semaine 5) | Scoping projet, enforcement routes, state machine v0 |
| **M4 — Orchestrateur v1** | Fin S3 (semaine 7) | Drift detection, compaction, audit enterprise |
| **M5 — Chat + Containers** | Fin S4 (semaine 9) | WebSocket bidirectionnel, Docker, credential proxy |
| **M6 — Produit Complet** | Fin S5 (semaine 11) | A2A, curseur, onboarding cascade |
| **M7 — Demo CBA** | Fin S6 (semaine 13) | Import Jira, dashboards, SSO, stabilisation |

---

## 13. Graphe de Dependances Global

```
S0-S01 (PostgreSQL) ─────┬──→ S0-S04 (Schema DB) ──┬──→ MU-S01 (API invites)
                          │                          ├──→ RBAC-S01 (hasPermission)
S0-S02 (CI/CD) ──────────┤                          ├──→ B1-S01 (audit table)
                          │                          ├──→ CHAT-S01 (WebSocket)
S0-S03 (Design System) ──┼──→ Toutes stories UI     └──→ CONT-S01 (ContainerManager)
                          │
S0-S05 (Factories) ──────┘

MU-S01 ──→ MU-S02 (UI invites)
       ──→ MU-S03 (acceptation)
       ──→ MU-S05 (signup/signout)

RBAC-S01 ──→ RBAC-S02 (roles) ──→ RBAC-S03 (enforcement) ──→ RBAC-S05 (masquage nav)
                                                             ──→ RBAC-S06 (scoping)

RBAC-S06 ──→ A1-S01 (state machine) ──→ A1-S02 (pre-prompts)
                                       ──→ A1-S03 (human-in-the-loop)
                                       ──→ A2-S01 (drift) ──→ A2-S02 (compaction)
                                                           ──→ A2-S04 (UI drift)

RBAC-S06 ──→ D1-S01 (A2A bus) ──→ D1-S02 (permissions A2A) ──→ D1-S03 (UI A2A)
RBAC-S06 ──→ E1-S01 (curseur backend) ──→ E1-S02 (UI curseur) + E1-S03 (integration)

CHAT-S01 ──→ CHAT-S02 ──→ CHAT-S03 (UI) ──→ CHAT-S04 (pilotage)
CONT-S01 ──→ CONT-S02 (credential proxy) + CONT-S03 (mount/reseau) ──→ CONT-S04 (UI)

B1-S01 ──→ B1-S02 ──→ B1-S03 (UI audit) ──→ B2-S01 (resume LLM) ──→ B2-S02 (dashboards)

C1-S01 ──→ C1-S02 (agent onboarding) ──→ C1-S03 (organigramme) ──→ C2-S01 (import Jira)
```

---

## 14. Matrice Parallelisme Tom / Cofondateur

### 14.1 Repartition par noyau

| Noyau | Tom (Gabri) | Cofondateur | Points de synchronisation |
|-------|-------------|-------------|--------------------------|
| **Transverse (MU)** | UI : InviteModal, MembersTable, CompanySelector | API : invitations, acceptation, signup/signout | API spec avant UI (S1 jour 1) |
| **Transverse (RBAC)** | UI : RoleSelector, PermissionMatrix, NavigationGuard | Backend : hasPermission, roles, enforcement, scoping | Contrat API RBAC (S1 jour 3) |
| **Noyau A (Orch)** | UI : WorkflowPipeline, DriftAlert, WorkflowEditor | Backend : state machine, drift, compaction | WebSocket events spec (S2 jour 1) |
| **Noyau B (Obs)** | Backend + UI : audit table, service, AuditLogTable, dashboards, resume LLM | -- | Autonome |
| **Noyau C (Onb)** | Backend + UI : cascade, agent onboarding, organigramme, import | -- | Autonome |
| **Noyau D (A2A)** | UI : A2ARequestCard | Backend : A2ABus, permissions A2A | API spec A2A (S5 jour 1) |
| **Noyau E (Dual)** | UI : AutomationCursor | Backend : automation_cursors, integration enforcer | Schema table curseur (S5 jour 1) |
| **Chat** | UI : ChatPanel, MessageBubble | Backend : WebSocket bidirectionnel, ChatService | Protocole WS (S4 jour 1) |
| **Container** | UI : ContainerStatus, ResourceMonitor | Backend : ContainerManager, CredentialProxy, Mount | API monitoring container (S4 jour 3) |

### 14.2 Regles de synchronisation

1. **Daily standup 15 min** : Tom et Cofondateur synchronisent chaque matin sur les blocages et les interfaces
2. **Spec API first** : le Cofondateur definit l'API (endpoints, types, responses) AVANT que Tom commence la UI
3. **Contrats TypeScript** : les types partages dans `packages/shared/` sont la source de verite pour les interfaces
4. **Feature branches** : chaque story a sa branche `feature/[EPIC]-S[NN]`, merge via PR avec review croisee
5. **Integration continue** : merge quotidien vers develop, pas de branches longues (>3 jours)

### 14.3 Risques de parallelisme

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| API pas prete quand Tom commence la UI | Moyenne | Elevee | Tom commence par les composants purs (design system, composants sans API) puis branche l'API |
| Conflits de merge sur les types partages | Faible | Moyenne | Un seul mainteneur pour `packages/shared/` (Cofondateur), Tom propose des PRs |
| Compaction (R1) bloque l'Orchestrateur | Moyenne | Elevee | Spike en Sprint 2 (1 semaine), si echec → Cofondateur priorise kill+relance simple |
| WebSocket protocole incompatible | Faible | Moyenne | Spec commune le jour 1 du Sprint 4, tests d'integration immediats |

---

## Annexe — Resume Quantitatif

| Metrique | Valeur |
|----------|--------|
| **Epics** | 11 (MU, RBAC, A1, A2, B1, B2, C1, C2, D1, E1, CHAT, CONT) |
| **Stories** | 47 |
| **Sprint 0** | 5 stories |
| **Sprint 1** | 8 stories (MU=6, RBAC=2) |
| **Sprint 2** | 5 stories (RBAC=3, A1=1 debut) |
| **Sprint 3** | 8 stories (A1=2, A2=3, B1=3) |
| **Sprint 4** | 8 stories (CHAT=4, CONT=4) |
| **Sprint 5** | 8 stories (C1=3, D1=2, E1=3) |
| **Sprint 6** | 5 stories (C2=2, B2=2, A2=1) |
| **Stories Tom** | ~24 stories |
| **Stories Cofondateur** | ~23 stories |
| **Duration totale** | 13 semaines (1 + 6x2) |
| **Demo CBA** | Juin 2026 |

---

*Sprint Planning Section 1 — Bob SM — v1.0 — ~5500 mots — 47 stories, 11 epics, 7 sprints, 2 pistes paralleles.*
*Prochaine etape : Winston (sequencage technique), John (priorisation business), Amelia (estimation effort).*
