# Sprint Planning B2B — MnM : Tour de Controle IA Enterprise

> **Version** : 2.0 (document consolide) | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : Bob (SM Lead), Winston (Architecte), John (PM), Amelia (Dev), Quinn (QA), Sally (UX), Murat (TEA)
> **Deadline critique** : Demo CBA — Juin 2026

---

## Table des Matieres

### Partie 1 — Decomposition Epics & Stories (Bob)
- Vue d'ensemble Sprints
- Sprint 0 — Setup & Fondations
- Epic MU — Multi-User & Auth
- Epic RBAC — Roles & Permissions
- Noyau A — Orchestrateur Deterministe
- Noyau B — Observabilite & Audit
- Noyau C — Onboarding Cascade
- Noyau D — Agent-to-Agent + Permissions
- Noyau E — Dual-Speed Workflow
- Epic CHAT — Chat Temps Reel
- Epic CONT — Containerisation
- Synthese Sprints & Timeline
- Graphe de Dependances Global
- Matrice Parallelisme Tom / Cofondateur

### Partie 2 — Sequencage Technique & Dependances (Winston)
- Graphe de Dependances Techniques
- Critical Path
- Mapping FR vers Stories
- Stories a Risque Technique
- Infrastructure Stories Obligatoires
- Points de Parallelisation
- ADR Mapping par Epic

### Partie 3 — Priorisation Business & Frontieres MVP (John)
- Matrice de Priorisation Impact Business x Effort
- Scope MVP Strict — Demo CBA Juin 2026
- Success Criteria Mesurables par Epic
- User Value par Story
- Go/No-Go Criteria par Phase
- Risk Assessment Business
- Split Cofondateurs : Tom vs Cofondateur

### Partie 4 — Estimation d'Effort & Faisabilite Technique (Amelia)
- Methodologie d'Estimation
- Estimation Detaillee par Story
- Stories Techniques Manquantes (Infrastructure)
- Dette Technique a Resoudre AVANT le Sprint
- Dependances Techniques Inter-Stories
- Repartition Tom vs Cofondateur
- Velocity et Planification par Sprint
- Faisabilite — Ce qui est Simple vs Complexe

### Partie 5 — Acceptance Criteria, Definition of Done & Quality Gates (Quinn)
- Definition of Done — Templates par Niveau
- Acceptance Criteria Critiques par Epic (Given/When/Then)
- Test Coverage Requirements par Epic
- Acceptance Criteria pour les NFRs
- Regression Testing Strategy
- Quality Gates par Phase
- Edge Cases Critiques par Epic

### Partie 6 — Requirements UX par Story (Sally)
- Requirements UX par Epic
- Wireframes textuels des ecrans principaux
- Components shadcn/ui par story
- UX Flows critiques
- Curseur d'automatisation — Implementation progressive
- Design tokens et variantes par persona/mode
- Accessibility requirements par story
- Mapping stories vers pages/ecrans

### Partie 7 — Strategie de Test par Epic & Infrastructure de Test (Murat)
- Strategie de Test par Epic
- Test Pyramid par Epic
- Infrastructure de Test — Stories
- Performance Testing par Phase
- Security Testing
- CI/CD Quality Gates — Bloquants vs Informatifs
- Test Data Management
- Estimation Effort Testing par Epic

---


# PARTIE 1 — Decomposition Epics & Stories

> **Auteur** : Bob (Scrum Master — LEAD Sprint Planning)
> **Sources** : PRD B2B v1.0, Architecture B2B v1.0, UX Design B2B v1.0
> **Split Cofondateurs** : Tom (Gabri) = Noyaux B + C | Cofondateur = Noyaux A + D | Noyau E = Partage


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

---

# PARTIE 2 — Sequencage Technique & Dependances

> **Auteur** : Winston (Lead Architecte)
> **Sources** : Architecture B2B v1.0, PRD B2B v1.0, ADR-001 a ADR-008


## 1. Graphe de Dependances Techniques

### 1.1 Vue d'Ensemble des Couches de Dependances

L'analyse du PRD et de l'architecture revele une structure de dependances en 5 niveaux. Chaque niveau DOIT etre complete avant que le niveau suivant puisse demarrer de maniere fiable. Le non-respect de cet ordre entrainerait des refactorisations couteuses et des regressions en cascade.

```
NIVEAU 0 — INFRASTRUCTURE FONDATION (Semaine 0-1)
├── INFRA-01: PostgreSQL externe (migration SQLite → PostgreSQL)
├── INFRA-02: Docker Compose dev environment
├── INFRA-03: Redis setup (sessions, cache, pub/sub)
├── INFRA-04: CI/CD pipeline GitHub Actions (QG-0: lint+TS)
└── INFRA-05: Monorepo tooling (pnpm workspaces verification)

NIVEAU 1 — FONDATIONS MULTI-TENANT & AUTH (Semaine 1-3)
├── FOUND-01: Schema DB — nouvelles tables (10 tables)
├── FOUND-02: Schema DB — modifications tables existantes (5 tables)
├── FOUND-03: RLS PostgreSQL (14 tables)        ← depend INFRA-01
├── FOUND-04: Fix hasPermission() + scope JSONB  ← depend FOUND-01, FOUND-02
├── FOUND-05: 9 nouvelles permission keys        ← depend FOUND-04
├── FOUND-06: 4 roles metier (presets)           ← depend FOUND-05
├── FOUND-07: Middleware requirePermission()      ← depend FOUND-04
└── FOUND-08: Audit des 22 routes existantes     ← depend FOUND-07

NIVEAU 2 — CAPACITES CORE (Semaine 3-6)
├── CORE-01: Multi-User UI (invitations, membres) ← depend FOUND-06
├── CORE-02: RBAC UI (matrice permissions)         ← depend FOUND-06, FOUND-08
├── CORE-03: WorkflowEnforcer (state machine)      ← depend FOUND-04
├── CORE-04: ContainerManager + Docker             ← depend INFRA-02, FOUND-03
├── CORE-05: Credential Proxy HTTP                 ← depend CORE-04
├── CORE-06: Audit events table + triggers         ← depend FOUND-03
├── CORE-07: WebSocket bidirectionnel              ← depend INFRA-03
└── CORE-08: Project memberships + scoping         ← depend FOUND-06

NIVEAU 3 — FONCTIONNALITES AVANCEES (Semaine 6-9)
├── ADV-01: Drift Detection                       ← depend CORE-03
├── ADV-02: Compaction Manager (kill+relance)      ← depend CORE-03, CORE-04
├── ADV-03: Chat temps reel (channels + messages)  ← depend CORE-07, CORE-04
├── ADV-04: A2A Bus (agent-to-agent)               ← depend CORE-04, CORE-05
├── ADV-05: Audit Summarizer (resume LLM)          ← depend CORE-06
├── ADV-06: Dashboards agreges                     ← depend CORE-06, CORE-02
└── ADV-07: Curseur d'automatisation               ← depend FOUND-06, CORE-08

NIVEAU 4 — ENTERPRISE & POLISH (Semaine 9-12)
├── ENT-01: SSO SAML/OIDC                         ← depend FOUND-06
├── ENT-02: Import Jira/Linear/ClickUp            ← depend CORE-08
├── ENT-03: Onboarding conversationnel             ← depend CORE-01, CORE-02
├── ENT-04: CompactionWatcher (reinject)           ← depend ADV-02
├── ENT-05: Export audit (CSV/JSON)                ← depend ADV-05
└── ENT-06: Smoke tests complets (7)              ← depend TOUT
```

### 1.2 Dependances Critiques Inter-Stories

Le graphe ci-dessous montre les dependances les plus critiques, celles ou un retard propage un blocage en cascade :

```
hasPermission() fix ──→ permission keys ──→ role presets ──→ RBAC UI
       │                                         │
       │                                         └──→ Multi-User UI
       │                                         └──→ Project scoping
       │
       └──→ requirePermission() middleware ──→ audit 22 routes
       └──→ WorkflowEnforcer ──→ Drift Detection
                │                      │
                └──→ Compaction Manager ──→ CompactionWatcher
                              │
Docker Compose ──→ ContainerManager ──→ Credential Proxy
       │                  │                    │
       └──→ RLS setup     └──→ Chat temps reel │
                           └──→ A2A Bus ←──────┘

Redis ──→ WebSocket bidirectionnel ──→ Chat temps reel
                                   ──→ Dashboards live

PostgreSQL externe ──→ Schema migrations ──→ RLS ──→ TOUT le multi-tenant
```

### 1.3 Dependances Implicites (Non Evidentes)

Plusieurs dependances ne sont pas evidentes a premiere vue mais sont cruciales :

1. **RLS depend de PostgreSQL externe** : RLS ne fonctionne pas avec SQLite (REQ-MU-07 est un prerequis bloquant pour toute la strategie multi-tenant).

2. **ContainerManager depend de RLS** : Sans isolation RLS, les containers pourraient etre lances avec des credentials d'une autre company. L'isolation doit etre active AVANT la containerisation.

3. **Chat depend du ContainerManager** : Le chat bidirectionnel pipe vers `stdin` de l'agent. Si l'agent est dans un container, le pipe passe par Docker exec. Sans ContainerManager, le chat ne peut pas atteindre les agents containerises.

4. **Drift Detection depend du WorkflowEnforcer** : La drift se mesure par rapport a l'etat attendu du workflow. Sans state machine, il n'y a pas de reference pour mesurer la deviation.

5. **Audit Summarizer depend de la table audit_events** : Le resume LLM lit les evenements d'audit. La table avec ses triggers MUST exister avant le service de resume.

6. **Curseur d'automatisation depend du RBAC + scoping** : Le plafond hierarchique (CEO > CTO > Manager > Contributeur) repose sur les roles metier. Le scoping par projet determine les limites du curseur.

---

## 2. Critical Path

### 2.1 Identification du Critical Path

Le critical path est la chaine la plus longue de taches dependantes qui determine la duree minimale du projet. Toute tache sur ce chemin qui prend du retard retarde l'ensemble.

```
CRITICAL PATH (10 semaines) :
PostgreSQL externe (1s) → Schema migrations (1s) → RLS (1s) → hasPermission fix (0.5s)
→ Permission keys (0.5s) → Role presets (0.5s) → WorkflowEnforcer (2s)
→ Compaction Manager (1.5s) → CompactionWatcher (1s) → Smoke tests (1s)
                                                        ───────────
                                                        TOTAL: ~10 semaines
```

### 2.2 Analyse du Critical Path

Le critical path traverse deux axes principaux :

**Axe A — Multi-tenant + RBAC (4 semaines)** :
- PostgreSQL externe → Schema → RLS → hasPermission → permissions → roles
- Ce chemin bloque TOUT le reste. C'est la fondation sur laquelle tout repose.
- Risque : La migration PostgreSQL externe et l'activation RLS sont des operations a haut risque.

**Axe B — Orchestration deterministe (6 semaines)** :
- WorkflowEnforcer → Drift → Compaction → CompactionWatcher → Smoke tests
- Ce chemin est le coeur de la valeur produit (Noyau A).
- Risque : La compaction est identifiee comme R1 (risque le plus critique) dans l'architecture.

### 2.3 Opportunites de Raccourcissement

1. **Paralleliser Schema + RLS** : Les migrations de schema et les politiques RLS peuvent etre ecrites en parallele si on definit le schema d'abord sur papier (1 jour de conception collaborative).

2. **hasPermission fix en avance** : Ce fix est autonome (1 fichier, `access.ts:45-66`). Il peut etre fait des le premier jour en parallele avec l'infrastructure, a condition de ne pas merger avant que le schema soit pret.

3. **Spike compaction (1 semaine)** : L'hypothese H-T1 recommande un spike technique d'une semaine pour valider la faisabilite de la gestion de compaction AVANT de commencer le WorkflowEnforcer. Cela pourrait eliminer le risque R1 tot.

### 2.4 Chemin Secondaire (Near-Critical)

```
NEAR-CRITICAL PATH (9 semaines) :
Docker Compose (0.5s) → ContainerManager (2s) → Credential Proxy (1.5s)
→ A2A Bus (2s) → Integration testing (1s) → Smoke tests (1s)
                                               ─────────
                                               TOTAL: ~8 semaines
```

Ce chemin est presque aussi long que le critical path. Si le ContainerManager prend du retard, il devient le nouveau critical path.

---

## 3. Mapping FR vers Stories

### 3.1 Matrice de Couverture Complete

Cette matrice verifie que chaque Functional Requirement du PRD est couvert par au moins une story. Les identifiants sont ceux du PRD section 6.

| REQ ID | Description | Epic | Story Proposee | Couvert |
|--------|-------------|------|----------------|---------|
| **FR-MU** | | | | |
| REQ-MU-01 | Invitation par email avec lien signe | Multi-User | MU-S01: API invitations + UI | OUI |
| REQ-MU-02 | Page Membres avec tableau et filtres | Multi-User | MU-S02: Page Membres | OUI |
| REQ-MU-03 | Invitation en bulk (CSV ou liste) | Multi-User | MU-S03: Bulk invite | OUI |
| REQ-MU-04 | Selecteur de Company | Multi-User | MU-S04: Company switcher | OUI |
| REQ-MU-05 | Desactivation signup libre | Multi-User | MU-S05: Invitation-only mode | OUI |
| REQ-MU-06 | Sign-out avec invalidation session | Multi-User | MU-S06: Sign-out | OUI |
| REQ-MU-07 | Migration PostgreSQL externe | Infrastructure | INFRA-S01: PostgreSQL migration | OUI |
| **FR-RBAC** | | | | |
| REQ-RBAC-01 | 4 roles metier | RBAC | RBAC-S01: Role definitions | OUI |
| REQ-RBAC-02 | Presets permissions par role | RBAC | RBAC-S02: Role presets | OUI |
| REQ-RBAC-03 | hasPermission() lit scope JSONB | RBAC | RBAC-S03: Fix hasPermission | OUI |
| REQ-RBAC-04 | 9 nouvelles permission keys | RBAC | RBAC-S04: Permission keys | OUI |
| REQ-RBAC-05 | Enforcement dans chaque route API | RBAC | RBAC-S05: Route audit | OUI |
| REQ-RBAC-06 | Masquage navigation selon permissions | RBAC | RBAC-S06: UI permissions | OUI |
| REQ-RBAC-07 | UI admin matrice permissions | RBAC | RBAC-S07: Admin UI | OUI |
| REQ-RBAC-08 | Badges couleur par role | RBAC | RBAC-S08: Role badges | OUI |
| **FR-ORCH** | | | | |
| REQ-ORCH-01 | Execution step-by-step imposee | Orchestrateur | ORCH-S01: State machine | OUI |
| REQ-ORCH-02 | Fichiers obligatoires par etape | Orchestrateur | ORCH-S02: File validation | OUI |
| REQ-ORCH-03 | Pre-prompts injectes par etape | Orchestrateur | ORCH-S03: Pre-prompts | OUI |
| REQ-ORCH-04 | Validation transitions entre etapes | Orchestrateur | ORCH-S04: Transitions | OUI |
| REQ-ORCH-05 | Drift detection basique (<15 min) | Orchestrateur | ORCH-S05: Drift detection | OUI |
| REQ-ORCH-06 | Compaction kill+relance | Orchestrateur | ORCH-S06: Kill+relance | OUI |
| REQ-ORCH-07 | Compaction reinjection | Orchestrateur | ORCH-S07: Reinjection | OUI |
| REQ-ORCH-08 | UI editeur de workflow | Orchestrateur | ORCH-S08: Workflow editor | OUI |
| REQ-ORCH-09 | Validation humaine configurable | Orchestrateur | ORCH-S09: HITL validation | OUI |
| REQ-ORCH-10 | Persistance resultats intermediaires | Orchestrateur | ORCH-S10: Checkpoints | OUI |
| **FR-OBS** | | | | |
| REQ-OBS-01 | Resume LLM temps reel (<5s) | Observabilite | OBS-S01: Audit summarizer | OUI |
| REQ-OBS-02 | Audit log complet | Observabilite | OBS-S02: Audit events | OUI |
| REQ-OBS-03 | Dashboards agreges (jamais individuels) | Observabilite | OBS-S03: Dashboards | OUI |
| REQ-OBS-04 | Tracabilite decisionnelle | Observabilite | OBS-S04: Decision trace | OUI |
| REQ-OBS-05 | Export audit log | Observabilite | OBS-S05: Export | OUI |
| REQ-OBS-06 | Retention audit >= 3 ans, immutable | Observabilite | OBS-S06: Retention + triggers | OUI |
| **FR-ONB** | | | | |
| REQ-ONB-01 | Onboarding CEO conversationnel | Onboarding | ONB-S01: Chat onboarding | OUI |
| REQ-ONB-02 | Cascade hierarchique | Onboarding | ONB-S02: Cascade | OUI |
| REQ-ONB-03 | Import Jira | Onboarding | ONB-S03: Import Jira | OUI |
| REQ-ONB-04 | Dual-mode configuration | Onboarding | ONB-S04: Dual-mode | OUI |
| **FR-A2A** | | | | |
| REQ-A2A-01 | Query inter-agents avec validation humaine | A2A | A2A-S01: A2A Bus | OUI |
| REQ-A2A-02 | Permissions granulaires inter-agents | A2A | A2A-S02: A2A permissions | OUI |
| REQ-A2A-03 | Audit chaque transaction A2A | A2A | A2A-S03: A2A audit | OUI |
| REQ-A2A-04 | Connecteurs auto-generes MCP | A2A | A2A-S04: Connecteurs | OUI |
| **FR-DUAL** | | | | |
| REQ-DUAL-01 | Curseur 3 positions | Dual-Speed | DUAL-S01: Curseur | OUI |
| REQ-DUAL-02 | Granularite 4 niveaux | Dual-Speed | DUAL-S02: Granularite | OUI |
| REQ-DUAL-03 | Plafond hierarchique | Dual-Speed | DUAL-S03: Plafond | OUI |
| REQ-DUAL-04 | Distinction mecanique vs jugement | Dual-Speed | DUAL-S04: Classification | OUI |
| **FR-CHAT** | | | | |
| REQ-CHAT-01 | WebSocket bidirectionnel | Chat | CHAT-S01: WebSocket bidir | OUI |
| REQ-CHAT-02 | Dialogue pendant execution | Chat | CHAT-S02: Chat in-workflow | OUI |
| REQ-CHAT-03 | Reconnexion + sync | Chat | CHAT-S03: Reconnexion | OUI |
| REQ-CHAT-04 | Chat read-only viewer | Chat | CHAT-S04: Read-only | OUI |
| REQ-CHAT-05 | Rate limit 10/min | Chat | CHAT-S05: Rate limiting | OUI |
| **FR-CONT** | | | | |
| REQ-CONT-01 | Container Docker ephemere | Containerisation | CONT-S01: ContainerManager | OUI |
| REQ-CONT-02 | Credential proxy HTTP | Containerisation | CONT-S02: Credential proxy | OUI |
| REQ-CONT-03 | Mount allowlist tamper-proof | Containerisation | CONT-S03: Mount security | OUI |
| REQ-CONT-04 | Shadow .env | Containerisation | CONT-S04: Shadow env | OUI |
| REQ-CONT-05 | Isolation reseau | Containerisation | CONT-S05: Network isolation | OUI |
| REQ-CONT-06 | Resource limits par profil | Containerisation | CONT-S06: Profils | OUI |
| REQ-CONT-07 | Timeout avec reset | Containerisation | CONT-S07: Timeout | OUI |

### 3.2 Verification de Couverture

**Resultat : 100% des FRs sont couverts.** 52 REQs identifies dans le PRD, 52 stories proposees. Aucun FR orphelin.

### 3.3 FRs a Risque de Sur-Specification

Certains FRs combinent plusieurs preoccupations et devront etre decomposes en stories plus fines lors du sprint planning detaille :

- **REQ-ORCH-06/07** : La compaction combine detection (CompactionWatcher), strategie (kill+relance vs reinjection), et recovery (checkpoint restore). Minimum 3 stories.
- **REQ-CONT-01** : Le ContainerManager est un systeme complexe avec lifecycle management, health checks, cleanup. Minimum 4 stories.
- **REQ-A2A-01** : Le bus A2A combine routing, permissions, human validation, et anti-boucle. Minimum 3 stories.

---

## 4. Stories a Risque Technique

### 4.1 Risque CRITIQUE (R1) — Gestion de Compaction

**Stories concernees** : ORCH-S06, ORCH-S07, ADV-02, ENT-04

**Nature du risque** : C'est le risque numero 1 identifie dans l'architecture (ADR-008). La compaction est un comportement emergent des LLMs, pas un evenement previsible. Detecter le moment exact ou un agent a compacte son contexte, puis decider de la strategie (kill+relance vs reinjection), puis restaurer l'etat de maniere fiable — tout cela est techniquement non prouve a cette echelle.

**Mitigation** :
- Spike technique d'une semaine AVANT le debut de l'epic Orchestrateur
- Prototype minimal : lancer un agent, forcer la compaction, observer les heartbeats
- Definir les metriques de detection (reduction soudaine de contexte via les heartbeats)
- Circuit breaker des le jour 1 (max 3 relances par session)

**Impact si echec** : La valeur fondamentale de MnM (agents deterministes) est compromisee. Un agent qui perd son contexte sans recovery fiable est inutile.

### 4.2 Risque ELEVE — ContainerManager Docker

**Stories concernees** : CONT-S01 a CONT-S07, CORE-04, CORE-05

**Nature du risque** : L'integration `dockerode` avec mount allowlist tamper-proof, credential proxy HTTP, et isolation reseau est un pattern complexe (5 couches de securite Nanoclaw). Chaque couche interagit avec les autres. Un defaut dans le mount allowlist (ex: symlink escape) compromet TOUTE l'isolation.

**Mitigation** :
- Commencer par un ContainerManager minimal (lancer/arreter) avant d'ajouter les couches de securite
- Tests de penetration dedies pour chaque couche (path traversal, credential leaks, container escape)
- Code review securite obligatoire par un second developpeur

**Impact si echec** : Pas de multi-tenant securise, pas de containerisation enterprise. Le produit reste mono-utilisateur.

### 4.3 Risque ELEVE — RLS PostgreSQL

**Stories concernees** : FOUND-03, NFR-SEC-01

**Nature du risque** : RLS doit etre applique sur 14 tables avec `SET LOCAL app.current_company_id`. Si une seule requete oublie le `SET LOCAL`, la politique RLS est contournee. L'overhead de performance est theoriquement negligeable mais non mesure sur le schema specifique MnM (38+ tables).

**Mitigation** :
- Hook Drizzle pour injecter automatiquement `SET LOCAL` a chaque transaction
- Test d'integration : verifier que chaque route renvoie 0 resultat pour une company non-autorisee
- Benchmark performance avant/apres RLS sur les 5 queries les plus frequentes

### 4.4 Risque MOYEN — WebSocket Bidirectionnel

**Stories concernees** : CHAT-S01, CORE-07

**Nature du risque** : L'existant `live-events-ws.ts` est unidirectionnel (serveur → client). Le passage au bidirectionnel necessite un protocole de messages type, un systeme de reconnexion avec buffer 30s, et le pipe vers `stdin` de l'agent. Le scaling multi-instance via Redis pub/sub ajoute de la complexite.

**Mitigation** :
- Phase 1 : bidirectionnel basique (un serveur, pas de scaling)
- Phase 2 : ajout reconnexion et buffer
- Phase 3 : Redis pub/sub pour multi-instance (post-MVP)

### 4.5 Risque MOYEN — A2A Bus

**Stories concernees** : A2A-S01 a A2A-S04, ADV-04

**Nature du risque** : La communication agent-to-agent avec validation human-in-the-loop introduit des workflows asynchrones complexes. La detection de boucles (max 5 requetes A2A par chaine) est un probleme algorithmique non trivial quand les agents communiquent a travers des containers isoles.

**Mitigation** :
- Pattern Saga avec timeout : chaque requete A2A a un TTL
- Graph de communication en memoire avec detection de cycles
- MVP : communication A2A synchrone uniquement, pas de chaines

### 4.6 Risque FAIBLE mais BLOQUANT — Migration PostgreSQL Externe

**Stories concernees** : INFRA-S01

**Nature du risque** : Le risque technique est faible (PostgreSQL est bien supporte par Drizzle). Mais c'est un bloquant ABSOLU : sans cette migration, aucune feature multi-tenant ne peut etre implementee. Un retard ici retarde TOUT.

**Mitigation** :
- Faire cette migration en PREMIER, avant toute autre story
- Script de migration automatise et idempotent
- Tests avec donnees existantes pour verifier la non-regression

---

## 5. Infrastructure Stories Obligatoires

### 5.1 Stories qui DOIVENT etre completees avant tout developpement fonctionnel

Ces stories ne delivrent aucune valeur utilisateur directe mais sont des prerequis techniques sans lesquels les stories fonctionnelles ne peuvent pas etre implementees correctement.

#### INFRA-S01 : Migration PostgreSQL Externe (REQ-MU-07)
- **Pourquoi** : RLS, partitionnement audit_events, connection pooling — rien de cela ne fonctionne avec SQLite
- **Contenu** : docker-compose.dev.yml avec PostgreSQL 16, script de migration des donnees existantes, mise a jour du fichier de configuration Drizzle
- **Effort** : 2-3 jours
- **Bloque** : FOUND-03 (RLS), CORE-06 (audit partitionne), toute la strategie multi-tenant
- **ADR** : ADR-001

#### INFRA-S02 : Docker Compose Environment
- **Pourquoi** : Le ContainerManager a besoin d'un daemon Docker. L'environnement de dev doit inclure PostgreSQL, Redis, et Docker-in-Docker
- **Contenu** : docker-compose.dev.yml, docker-compose.test.yml, documentation setup
- **Effort** : 1-2 jours
- **Bloque** : CORE-04 (ContainerManager), tests d'integration
- **ADR** : ADR-004

#### INFRA-S03 : Redis Setup
- **Pourquoi** : Sessions (auth), cache (query), pub/sub (WebSocket scaling), rate limiting
- **Contenu** : docker-compose service Redis, client Redis dans le serveur, prefixe tenant
- **Effort** : 1 jour
- **Bloque** : CORE-07 (WebSocket), scaling multi-instance
- **ADR** : ADR-005

#### INFRA-S04 : CI/CD Pipeline Basique
- **Pourquoi** : Quality Gate QG-0 (lint + TypeScript) doit etre en place des le premier push pour eviter la dette technique
- **Contenu** : GitHub Actions workflow, lint, build TypeScript, tests unitaires
- **Effort** : 1 jour
- **Bloque** : Qualite du code, non-regression
- **ADR** : Aucun specifiquement, mais supporte tous

#### INFRA-S05 : Schema DB — Nouvelles Tables (10 tables)
- **Pourquoi** : Toutes les features B2B dependent de ces tables (project_memberships, automation_cursors, chat_channels, chat_messages, container_profiles, container_instances, credential_proxy_rules, audit_events, sso_configurations, import_jobs)
- **Contenu** : Fichiers Drizzle schema, migrations up/down, indexes, relations
- **Effort** : 2-3 jours
- **Bloque** : Tout le niveau CORE
- **ADR** : ADR-001 (companyId sur chaque table)

#### INFRA-S06 : Schema DB — Modifications Tables Existantes (5 tables)
- **Pourquoi** : Les colonnes ajoutees (tier, businessRole, containerProfileId, etc.) sont necessaires pour les roles metier et la containerisation
- **Contenu** : Migrations Drizzle, backward-compatible (colonnes nullable), seed data
- **Effort** : 1-2 jours
- **Bloque** : FOUND-04 (hasPermission), FOUND-06 (roles)
- **ADR** : ADR-001, ADR-002

#### INFRA-S07 : RLS PostgreSQL (14 tables)
- **Pourquoi** : Defense en profondeur — meme si le code applicatif oublie un filtre companyId, RLS bloque l'acces cross-tenant au niveau PostgreSQL
- **Contenu** : CREATE POLICY sur 14 tables, hook Drizzle pour SET LOCAL, tests d'isolation
- **Effort** : 3-5 jours
- **Bloque** : Tout le multi-tenant, containerisation securisee
- **ADR** : ADR-001

### 5.2 Ordre d'Execution des Infrastructure Stories

```
Semaine 0 (Jour 1-3) :
  Tom    : INFRA-S01 (PostgreSQL) + INFRA-S03 (Redis)
  Cofond.: INFRA-S02 (Docker Compose) + INFRA-S04 (CI/CD)

Semaine 0-1 (Jour 3-7) :
  Tom    : INFRA-S05 (10 nouvelles tables) + INFRA-S06 (5 tables modifiees)
  Cofond.: INFRA-S07 (RLS) — commence des que INFRA-S01 + INFRA-S05 sont prets
```

---

## 6. Points de Parallelisation

### 6.1 Split Equipe

Le PRD identifie deux pistes de travail paralleles (section 11.2) :

- **Tom** : Backend + Observabilite (Noyau B + C) — expertise infra, Docker, monitoring
- **Cofondateur technique** : Orchestration + Agents (Noyau A + D) — expertise IA, state machines, agents

### 6.2 Matrice de Parallelisation par Sprint

#### Sprint 1 — Infrastructure + Fondations (Semaine 1-2)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| INFRA-S01: PostgreSQL externe | INFRA-S02: Docker Compose | Independants |
| INFRA-S03: Redis setup | INFRA-S04: CI/CD pipeline | Independants |
| INFRA-S05: Schema 10 tables | INFRA-S07: RLS (apres S05) | S07 attend S05 de Tom |
| INFRA-S06: Schema modifs | RBAC-S03: Fix hasPermission | S03 attend S06 de Tom |

**Point de sync fin Sprint 1** : Schema DB complet, RLS actif, hasPermission corrige. Les deux doivent valider ensemble que l'isolation fonctionne.

#### Sprint 2 — RBAC + Multi-User + Container Base (Semaine 3-4)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| RBAC-S04: Permission keys | ORCH-S01: State machine (WorkflowEnforcer) | Independants |
| RBAC-S05: Audit 22 routes | ORCH-S02: File validation | Independants |
| OBS-S02: Audit events table | ORCH-S03: Pre-prompts injection | Independants |
| MU-S01: API invitations | CONT-S01: ContainerManager base | Independants |

**Point de sync fin Sprint 2** : Routes securisees, audit en place, state machine fonctionnelle. Tom livre les APIs, le Cofondateur livre le moteur d'orchestration.

#### Sprint 3 — Multi-User UI + Container Security + Orchestration avancee (Semaine 5-6)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| MU-S02: Page Membres UI | ORCH-S05: Drift detection | Independants |
| RBAC-S07: Admin UI | CONT-S02: Credential proxy | Independants |
| OBS-S06: Retention + triggers | ORCH-S06: Compaction kill+relance | Independants |
| CHAT-S01: WebSocket bidirectionnel | CONT-S03: Mount security | Chat depend WebSocket |

**Point de sync fin Sprint 3** : Interface multi-user fonctionnelle, drift detection active, containers securises. Demo interne possible.

#### Sprint 4 — Fonctionnalites Avancees (Semaine 7-8)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| CHAT-S02: Chat in-workflow | A2A-S01: A2A Bus | Chat → ContainerManager |
| OBS-S01: Audit summarizer (LLM) | A2A-S02: A2A permissions | Independants |
| OBS-S03: Dashboards agreges | ORCH-S07: Reinjection compaction | Independants |
| DUAL-S01: Curseur automatisation | ORCH-S09: HITL validation | Independants |

**Point de sync fin Sprint 4** : Chat temps reel, A2A basique, dashboards, curseur. Feature complete pour demo CBA.

#### Sprint 5 — Enterprise + Polish (Semaine 9-10)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| ENT-01: SSO SAML/OIDC | ORCH-S08: Workflow editor UI | Independants |
| OBS-S05: Export audit | ENT-04: CompactionWatcher | Independants |
| ENT-02: Import Jira | A2A-S03: A2A audit | Independants |
| ENT-06: Smoke tests | ENT-06: Smoke tests | Collaboration |

**Point de sync fin Sprint 5** : Produit B2B vendable. Demo CBA possible.

### 6.3 Dependances Bloquantes Inter-Developpeurs

Il y a 4 moments critiques ou un developpeur bloque l'autre :

1. **Sprint 1, Jour 3** : Le Cofondateur ne peut pas commencer RLS avant que Tom finisse les schemas
2. **Sprint 1, Jour 5** : Le Cofondateur ne peut pas commencer hasPermission fix avant que Tom finisse les modifications de tables
3. **Sprint 3** : Le Chat bidirectionnel (Tom) doit etre pret avant que le Chat in-workflow (Sprint 4) puisse etre fait
4. **Sprint 3** : Le ContainerManager (Cofondateur) doit etre pret avant que le Credential Proxy puisse etre complete

### 6.4 Strategies de Deblocage

Pour minimiser les temps d'attente :

1. **Buffer tasks** : Quand un developpeur attend l'autre, il travaille sur des stories independantes (ex: CI/CD, documentation, tests unitaires).
2. **Interfaces stables** : Definir les interfaces TypeScript (types, schemas Zod) en premier jour, avant l'implementation. Les deux peuvent coder contre les interfaces.
3. **Feature branches** : Chaque story sur sa propre branche, merge regulier vers la branche de dev.
4. **Daily sync** : 15 min chaque matin pour identifier les blocages et ajuster les priorites.

---

## 7. ADR Mapping par Epic

### 7.1 Matrice ADR → Epic

| ADR | Titre | Epics Impactees | Stories Cles |
|-----|-------|----------------|--------------|
| **ADR-001** | Multi-tenant (RLS) | Infrastructure, Multi-User, RBAC, **TOUTES** | INFRA-S01, INFRA-S05, INFRA-S07, MU-S01-S06 |
| **ADR-002** | Auth (Better Auth + RBAC + SSO) | RBAC, Multi-User, Enterprise | RBAC-S01-S08, MU-S01, MU-S06, ENT-01 |
| **ADR-003** | Orchestrateur (State Machine) | Orchestrateur, Dual-Speed | ORCH-S01-S10, DUAL-S01-S04 |
| **ADR-004** | Containerisation (Docker + Credential Proxy) | Containerisation, A2A, Chat | CONT-S01-S07, A2A-S01, CHAT-S02 |
| **ADR-005** | Chat Temps Reel (WebSocket bidirectionnel) | Chat, Observabilite | CHAT-S01-S05, OBS-S03 (dashboards live) |
| **ADR-006** | Agent-to-Agent Communication | A2A | A2A-S01-S04 |
| **ADR-007** | Observabilite (Audit + Resume LLM) | Observabilite, Orchestrateur | OBS-S01-S06, ORCH-S05 (drift) |
| **ADR-008** | Gestion de Compaction | Orchestrateur | ORCH-S06, ORCH-S07, ENT-04 |

### 7.2 ADRs Transversaux

Certains ADRs impactent presque toutes les stories :

- **ADR-001 (RLS)** : Toute story qui touche a la base de donnees doit respecter l'isolation multi-tenant. C'est une contrainte transversale — chaque query doit avoir un `companyId`, chaque transaction doit faire `SET LOCAL app.current_company_id`.

- **ADR-002 (Auth)** : Toute story qui expose un endpoint API doit utiliser le middleware `requirePermission()`. Les 22 routes existantes doivent etre auditees.

- **ADR-007 (Observabilite)** : Toute mutation doit emettre un evenement d'audit. C'est un invariant (INV-03). Chaque story doit inclure l'emission d'audit dans ses criteres d'acceptation.

### 7.3 ADRs Concentres

D'autres ADRs sont concentres sur un petit nombre de stories :

- **ADR-003 (State Machine)** : Uniquement l'epic Orchestrateur. La state machine est un composant autonome avec ses propres tests.
- **ADR-006 (A2A)** : Uniquement l'epic A2A. Le bus est isole du reste du systeme.
- **ADR-008 (Compaction)** : Uniquement les stories de compaction dans l'Orchestrateur. C'est le risque le plus critique mais aussi le plus isole.

### 7.4 Impact des ADRs sur l'Ordre d'Implementation

L'ordre d'implementation des ADRs est dicte par leurs dependances :

```
ADR-001 (RLS) ──────────────→ DOIT etre premier (tout depend du multi-tenant)
ADR-002 (Auth) ─────────────→ DOIT etre deuxieme (RBAC depend du schema)
    ↓ ces deux sont prerequis pour tout le reste
ADR-004 (Container) ────────→ Peut etre parallele a ADR-003
ADR-003 (State Machine) ───→ Peut etre parallele a ADR-004
    ↓ ces deux sont prerequis pour le niveau avance
ADR-005 (WebSocket) ────────→ Depend de Redis (INFRA-S03) mais pas des ADRs precedents
ADR-007 (Observabilite) ───→ Depend de ADR-001 (table audit partitionnee)
ADR-006 (A2A) ─────────────→ Depend de ADR-004 (containers) + ADR-002 (permissions)
ADR-008 (Compaction) ──────→ Depend de ADR-003 (state machine) + ADR-004 (containers)
```

---

## Synthese et Recommandations

### Recommandation 1 : Spike Compaction (Semaine 0)
Avant tout developpement, dedier 3-5 jours a un spike technique sur la compaction (ADR-008). C'est le risque R1. Si la detection de compaction via heartbeats ne fonctionne pas, il faut pivoter la strategie AVANT d'investir dans l'orchestrateur.

### Recommandation 2 : PostgreSQL + RLS en Premier
La migration PostgreSQL externe (INFRA-S01) et l'activation RLS (INFRA-S07) sont les deux stories les plus bloquantes du projet. Elles doivent etre terminees dans les 5 premiers jours. Tout retard ici retarde tout le projet.

### Recommandation 3 : Interfaces TypeScript Jour 1
Les types partages (`packages/shared/`) pour les nouvelles tables, les permissions, les etats de workflow, les messages WebSocket doivent etre definis des le premier jour. Cela permet aux deux developpeurs de coder en parallele sans blocage.

### Recommandation 4 : Fix hasPermission Immediat
Le fix de `hasPermission()` (ADR-002, `access.ts:45-66`) est un trou de securite critique qui prend moins d'une journee. Il doit etre la premiere story de code fonctionnel, idealement en Sprint 1, Jour 1.

### Recommandation 5 : Revue de Dependances Hebdomadaire
Avec deux developpeurs travaillant en parallele sur des niveaux de dependances differents, une revue hebdomadaire des blocages est essentielle. Le daily sync de 15 min est complement, mais la revue hebdomadaire permet de re-prioriser les sprints si un chemin prend du retard.

### Recommandation 6 : Tests d'Integration Multi-Tenant des Sprint 1
Ecrire les tests d'isolation cross-company des que RLS est actif, avant toute story fonctionnelle. Ces tests servent de filet de securite pour toutes les stories suivantes.

---

*Section 2 — Sequencage Technique v1.0 — ~2800 mots — Winston (Lead Architecte)*

---

# PARTIE 3 — Priorisation Business & Frontieres MVP

> **Auteur** : John (Product Manager)
> **Sources** : PRD B2B v1.0, UX Design B2B v1.0, Product Brief B2B v2.0
> **Contexte** : Deadline critique — Demo CBA en juin 2026


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

---

# PARTIE 4 — Estimation d'Effort & Faisabilite Technique

> **Auteur** : Amelia (Dev)


## 2. Estimation Détaillée par Story

### 2.1 Epic 1 — Multi-User & Auth (FR-MU)

**Total Epic : 16-19 SP | ~1.5 semaine (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| MU-01 | Invitation par email avec lien signé (expire 7j) | S | 2 | 1-2j | Tom | `invites` table existe déjà, route `/api/invites` partielle dans routes/access.ts (2604 lignes). Besoin : endpoint POST complet, email sending (nodemailer ou Resend), lien signé avec token. Complexité modérée car l'infra email n'existe pas encore. |
| MU-02 | Page Membres avec tableau, filtres, actions | M | 3 | 2-3j | Cofondateur | Frontend shadcn/ui + React Query. `company_memberships` existe. Besoin : GET /api/members enrichi (join user), composant DataTable avec filtres, actions bulk. Pattern existant dans issues list. |
| MU-03 | Invitation bulk (CSV ou liste emails) | S | 2 | 1-2j | Tom | Extension de MU-01 : parsing CSV côté client, boucle sur le endpoint d'invitation, feedback par ligne. |
| MU-04 | Sélecteur de Company (multi-company) | S | 2 | 1j | Cofondateur | UI dropdown dans header, stockage company active en Zustand, filtrage API par companyId. Pattern simple. |
| MU-05 | Désactivation signup libre (invitation-only) | S | 1 | 0.5j | Tom | Flag `invitationOnly` sur `companies`, check dans auth middleware. Trivial. |
| MU-06 | Sign-out avec invalidation session | S | 1 | 0.5j | Tom | Better Auth a déjà le mécanisme. Besoin : bouton UI + appel endpoint + cleanup local. |
| MU-07 | Migration PostgreSQL externe | M | 5 | 3-4j | Tom | **Story technique critique**. docker-compose.dev.yml avec PostgreSQL 16, config connexion .env, migration du SQLite embarqué, scripts de seed, documentation setup. Prérequis pour tout le reste. |

**Risques Epic 1** :
- MU-07 est un **bloquant** pour toutes les autres epics (RLS, multi-tenant, etc.)
- L'infra email (MU-01) doit être choisie tôt : Resend (SaaS) vs Nodemailer (self-hosted)

---

### 2.2 Epic 2 — RBAC Métier (FR-RBAC)

**Total Epic : 21-26 SP | ~2 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| RBAC-01 | Fix hasPermission() — lire scope JSONB | M | 3 | 2j | Tom | **DETTE TECHNIQUE CRITIQUE (DT1)**. access.ts:45-66 ignore complètement `scope`. Requiert : lecture scope, parsing Zod, validation projectId. Impact : chaque route qui appelle hasPermission() est potentiellement vulnérable. Code existant = 268 lignes dans services/access.ts. Risque modéré car le fix est bien défini dans l'architecture (ADR-002). |
| RBAC-02 | 9 nouvelles permission keys + presets par rôle | S | 2 | 1-2j | Tom | constants.ts : ajouter 9 keys (workflows.create/manage, agents.launch, stories.create/edit, audit.view/export, dashboard.view, chat.agent). role-presets.ts : matrice admin/manager/contributor/viewer. Modification simple, bien définie. |
| RBAC-03 | businessRole sur company_memberships | S | 2 | 1j | Cofondateur | Migration Drizzle : ajouter colonne `businessRole` enum (admin/manager/contributor/viewer) sur company_memberships. Migration data : tous les membres existants → admin. |
| RBAC-04 | Enforcement dans 22 fichiers routes | L | 8 | 5-7j | Tom + Cofondateur | **La plus grosse story de l'epic.** Audit des 22 fichiers dans server/src/routes/. 3 fichiers critiques sans aucun check (approvals.ts, assets.ts, secrets.ts). Besoin : middleware `requirePermission(key, scopeExtractor?)` appliqué systématiquement. Travail mécanique mais volumineux et critique pour la sécurité. Splitting recommandé : Tom fait les routes critiques (approvals, assets, secrets, agents, workflows), Cofondateur fait le reste. |
| RBAC-05 | Navigation UI masquée selon permissions | M | 3 | 2-3j | Cofondateur | Hook `usePermissions()` côté React, `canUser()` basé sur les permissions du token. Items masqués du DOM (pas grisés). Impacte sidebar, menus contextuels, boutons d'action. |
| RBAC-06 | UI admin matrice permissions + page rôles | M | 3 | 2-3j | Cofondateur | Composants shadcn/ui : PermissionMatrix (grille checkboxes), RoleSelector (dropdown), page /admin/roles. Pattern CRUD standard. |
| RBAC-07 | Badges couleur par rôle | S | 1 | 0.5j | Cofondateur | Composant Badge shadcn/ui avec variant par rôle. Trivial. |

**Risques Epic 2** :
- RBAC-01 est un **prérequis sécurité** — doit être fait AVANT toute autre story RBAC
- RBAC-04 est volumineuse et doit être splittée pour la review (par lots de 5-6 routes)
- Régression possible : chaque route modifiée nécessite un test d'intégration

**Dépendances** :
- RBAC-01 bloque toutes les autres stories RBAC
- Epic 1 (MU-07 PostgreSQL externe) doit être terminée avant les migrations RBAC

---

### 2.3 Epic 3 — Scoping par Projet (FR-PROJ)

**Total Epic : 13-16 SP | ~1-1.5 semaine (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| PROJ-01 | Table project_memberships + migration | S | 2 | 1j | Tom | Nouvelle table Drizzle : id, userId, projectId, companyId, role, grantedBy, createdAt. Relations → users, projects, companies. Migration straightforward. |
| PROJ-02 | Service project-memberships.ts | M | 3 | 2-3j | Tom | CRUD complet + validation scope JSONB dans hasPermission(). Intégration avec le fix RBAC-01. Filtrage des projets visibles par user. |
| PROJ-03 | Filtrage agents/issues par scope projet | M | 5 | 3-5j | Tom | Modification de agents.ts (22782 lignes service, 52248 lignes routes) et issues.ts (50807 lignes service). Ajout de WHERE projectId IN (user_project_ids) sur toutes les queries. **Attention** : ces fichiers sont massifs, risque de régression élevé. Tests d'intégration obligatoires. |
| PROJ-04 | Page ProjectAccess.tsx | M | 3 | 2-3j | Cofondateur | UI de gestion d'accès par projet : liste membres, ajout/retrait, sélection rôle. Composant shadcn/ui standard avec React Query. |

**Risques Epic 3** :
- PROJ-03 touche aux deux plus gros fichiers du projet (agents.ts, issues.ts) — splitting en sous-PRs recommandé
- Interaction complexe entre scope JSONB et project_memberships — bien tester les cas limites (scope null = accès global, scope avec projectIds, etc.)

---

### 2.4 Epic 4 — Orchestrateur Déterministe (FR-ORCH)

**Total Epic : 29-36 SP | ~3-3.5 semaines (2 devs, principalement Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| ORCH-01 | State machine workflow-state-machine.ts | L | 8 | 5-7j | Cofondateur | **Nouveau système complet.** 12 transitions (CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED + PAUSED/FAILED/COMPACTING/SKIPPED). Guards sur chaque transition. Persistance état dans stage_instances. Base existante : workflow_templates + instances + stage_instances (3 tables) et workflows.ts service (266 lignes). Le service existant est un CRUD simple — il faut ajouter toute la logique d'enforcement. |
| ORCH-02 | WorkflowEnforcer + fichiers obligatoires | L | 8 | 5-7j | Cofondateur | Vérification fichiers obligatoires avant transition. Injection pré-prompts par étape. Persistance résultats intermédiaires. Intégration avec la state machine ORCH-01. Nouveau fichier workflow-enforcer.ts ~300-500 lignes. |
| ORCH-03 | Validation humaine configurable (HITL) | M | 5 | 3-4j | Cofondateur | Extension du système approvals existant (approvals.ts, 7614 lignes service). Ajout d'un step de validation humaine configurable par étape de workflow. WebSocket notification pour demande d'approbation. |
| ORCH-04 | API routes orchestrateur | M | 3 | 2-3j | Tom | POST /workflows/:id/enforce, GET /drift/alerts, POST /drift/alerts/:id/resolve. Routes Express standard avec auth + RBAC. |
| ORCH-05 | UI éditeur de workflow drag-and-drop | M | 5 | 3-5j | Cofondateur | Composant React : drag-and-drop d'étapes, configuration prompts/fichiers par étape, preview. Librairie dnd-kit ou react-beautiful-dnd. **P1 — peut être reporté au Sprint 3.** |

**Risques Epic 4** :
- **Risque majeur** : la state machine est le coeur du produit MnM (ADR-003). Si elle est mal conçue, tout le flux workflow est compromis.
- Le Cofondateur technique doit avoir une solide expérience des state machines (XState ou équivalent).
- L'intégration avec le heartbeat existant (2396 lignes, monolithique) sera délicate.

---

### 2.5 Epic 5 — Drift Detection (FR-DRIFT)

**Total Epic : 13-16 SP | ~1.5-2 semaines (principalement Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DRIFT-01 | Fix drift en mémoire → persistance DB | M | 3 | 2-3j | Tom | **DETTE TECHNIQUE (DT2)**. drift.ts (405 lignes) utilise `reportCache = new Map()` — perdu au restart. Besoin : tables drift_reports + drift_items dans PostgreSQL. Migration des données in-memory vers DB. Tom connaît bien ce code. |
| DRIFT-02 | Drift monitor service | M | 5 | 3-5j | Tom | Nouveau service drift-monitor.ts : comparaison attendu (workflow template) vs observé (heartbeat events). Alertes temps réel via WebSocket (live-events.ts existant). Intégration avec la state machine ORCH-01. |
| DRIFT-03 | UI diff visuel drift | M | 5 | 3-5j | Cofondateur | Composant DriftAlert.tsx : vue comparée attendu/observé, diff visuel (similaire à un git diff), actions (recharger, kill+relance, ignorer). Notification badge dans sidebar. |

**Risques Epic 5** :
- Dépend de l'Epic 4 (state machine) pour la comparaison attendu/observé
- Le drift-analyzer.ts existant (6787 lignes) est déjà complexe — attention à ne pas le dupliquer

---

### 2.6 Epic 6 — Observabilité & Audit (FR-OBS)

**Total Epic : 18-22 SP | ~2-2.5 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| OBS-01 | Table audit_events + migration | M | 5 | 3-4j | Tom | **Table critique.** Partitionnée par mois (PARTITION BY RANGE createdAt). TRIGGER deny UPDATE/DELETE. Colonnes : companyId, actorId, actorType, action, targetType, targetId, metadata JSONB, ipAddress, prevHash, createdAt. Rôles PostgreSQL séparés (mnm_app vs mnm_audit_admin). Plus complexe qu'une migration standard à cause du partitionnement et des triggers. |
| OBS-02 | Service audit.ts + emission systématique | M | 5 | 3-5j | Tom | Service centralisé pour émettre des audit events depuis toutes les routes. Intégration avec les 22 fichiers de routes. Pattern : middleware ou helper `emitAudit(action, target, metadata)`. Volume de travail mécanique mais important. |
| OBS-03 | Résumé LLM actions agent (<5s) | M | 3 | 2-3j | Tom | audit-summarizer.ts : appel Haiku pour traduire les logs techniques en langage naturel. Intégration avec heartbeat_run_events. Cache Redis pour éviter les appels LLM redondants. Tom connaît bien le heartbeat. |
| OBS-04 | UI AuditLog.tsx + filtres + export | M | 5 | 3-5j | Cofondateur | Composant DataTable avec 12 filtres (acteur, action, target, date range, company, etc.). Export CSV/JSON. Virtualisation TanStack Virtual pour les grandes listes. Pattern similaire à la page issues existante. |

**Risques Epic 6** :
- Le partitionnement PostgreSQL (OBS-01) est une opération DB avancée — à tester en staging avant production
- L'émission systématique (OBS-02) impacte toutes les routes — risque de régression sur les performances

---

### 2.7 Epic 7 — Chat Temps Réel (FR-CHAT)

**Total Epic : 18-23 SP | ~2-2.5 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| CHAT-01 | WebSocket bidirectionnel | L | 8 | 5-7j | Tom | **DETTE TECHNIQUE (DT3)**. live-events.ts actuel = 40 lignes, unidirectionnel (serveur→client). Besoin : protocole de messages typé bidirectionnel, routing par channelId, authentification WebSocket. Extension majeure du système WebSocket existant. Tom connaît ce code. |
| CHAT-02 | Tables chat_channels + chat_messages | S | 2 | 1j | Tom | 2 tables Drizzle : chat_channels (id, agentId, heartbeatRunId, companyId, status), chat_messages (id, channelId, senderId, senderType, content, createdAt). Migration standard. |
| CHAT-03 | ChatService + pipe stdin agent | M | 5 | 3-5j | Tom | Service chat-service.ts : réception message WebSocket → persistance DB → pipe vers stdin de l'agent containerisé. Reconnexion avec buffer 30s. Rate limiting 10 msg/min. Dépend de la containerisation (Epic 8) pour le pipe stdin. |
| CHAT-04 | AgentChatPanel.tsx + useAgentChat hook | M | 3 | 2-3j | Cofondateur | Composant React : panel de chat dans la vue agent, messages en temps réel, indicateur de frappe, scroll auto. Hook useAgentChat avec WebSocket client. Pattern existant dans les composants issues. |

**Risques Epic 7** :
- CHAT-03 dépend de la containerisation (Epic 8) pour le pipe stdin → **dépendance forte**
- WebSocket bidirectionnel (CHAT-01) est une transformation architecturale, pas un simple ajout
- Reconnexion avec sync messages manqués est un problème classiquement sous-estimé

---

### 2.8 Epic 8 — Containerisation (FR-CONT)

**Total Epic : 34-42 SP | ~3.5-4.5 semaines (principalement Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| CONT-01 | ContainerManager + Docker API | XL | 13 | 2-3 sem | Cofondateur | **Le plus gros chantier technique du projet.** Nouveau dossier server/src/adapters/docker/. Intégration dockerode. Lifecycle complet : create → start → monitor → stop → cleanup. 4 profils de ressources (light/standard/heavy/gpu). Container éphémère `--rm --read-only --no-new-privileges`. Interaction avec l'adapter pattern existant (8 types dans packages/adapters/). |
| CONT-02 | Credential Proxy HTTP | L | 8 | 5-7j | Cofondateur | Nouveau service credential-proxy.ts. Serveur HTTP interne (port 8090). Résolution secrets via le provider existant (secrets.ts, 4 providers : local/AWS/GCP/Vault). Mount bind `/dev/null` sur `.env` dans le container. Pattern Nanoclaw. |
| CONT-03 | Mount allowlist tamper-proof | M | 5 | 3-4j | Cofondateur | Validation `realpath()` + interdiction symlinks + blocage null bytes + URL encoding. Configuration allowlist par company dans container_profiles. Tests de sécurité exhaustifs (path traversal). |
| CONT-04 | Isolation réseau Docker | M | 3 | 2-3j | Cofondateur | Bridge Docker par company. Pas de communication inter-company. Configuration réseau dans docker-compose. |
| CONT-05 | Tables container_profiles + container_instances | S | 2 | 1j | Tom | 2 tables Drizzle + migration. container_profiles (name, cpu, memory, disk, timeout, mountAllowlist, companyId), container_instances (profileId, agentId, containerId, status, startedAt, stoppedAt). |
| CONT-06 | UI ContainerStatus.tsx | M | 3 | 2-3j | Cofondateur | Composant : statut container en temps réel, métriques CPU/RAM, logs, boutons start/stop. Intégration WebSocket pour les updates live. |

**Risques Epic 8** :
- **Risque technique le plus élevé de tout le projet.** Docker en production avec isolation sécurisée est un domaine où les erreurs sont coûteuses.
- Le Cofondateur technique DOIT avoir de l'expérience Docker/containerisation en production.
- La credential proxy (CONT-02) est security-critical — revue de sécurité obligatoire.
- Interaction avec le système d'adapters existant (packages/adapters/) peut être complexe — les 8 types d'adapters doivent tous fonctionner en mode containerisé.
- **Spike technique recommandé** (2-3 jours) avant de commencer : POC container éphémère + credential proxy basique.

---

### 2.9 Epic 9 — Gestion Compaction (FR-COMP)

**Total Epic : 21-26 SP | ~2.5-3 semaines (Cofondateur, support Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| COMP-01 | CompactionWatcher — détection | L | 8 | 5-7j | Cofondateur | **RIEN N'EXISTE.** Monitoring des heartbeats pour détecter la compaction (réduction soudaine de contexte). Intégration avec heartbeat.ts (2396 lignes, monolithique — DT7). Heuristiques de détection à définir. |
| COMP-02 | Stratégie kill+relance | L | 8 | 5-7j | Cofondateur | Kill agent → relance avec contexte frais + résultats intermédiaires déjà produits. Table compaction_snapshots pour sauvegarder l'état pré-compaction. Circuit breaker : max 3 relances par session. |
| COMP-03 | Stratégie réinjection post-compaction | M | 5 | 3-5j | Cofondateur | Réinjection pré-prompts + définition workflow après détection compaction. Alternative au kill+relance pour les cas où la compaction est partielle. Configurable par étape de workflow. |

**Risques Epic 9** :
- **C'est le risque le plus critique du projet** (ADR-008, hypothèse H-T1).
- La détection de compaction est heuristique — pas de signal clair des LLM providers.
- **Spike technique obligatoire** (1 semaine) avant de commencer : observer le comportement de compaction sur Claude, GPT-4, etc.
- L'interaction avec heartbeat.ts monolithique (2396 lignes) est un risque en soi (DT7).

---

### 2.10 Epic 10 — Curseur d'Automatisation (FR-DUAL)

**Total Epic : 10-13 SP | ~1-1.5 semaine (Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DUAL-01 | Table automation_cursors + service | M | 5 | 3-4j | Cofondateur | Nouvelle table : id, level (action/agent/project/company), position (manual/assisted/auto), targetId, companyId, ceiling. Service avec logique de hiérarchie : plafond supérieur l'emporte (CEO > CTO > Manager > Contributeur). |
| DUAL-02 | UI curseur 3 positions | M | 3 | 2-3j | Cofondateur | Composant slider 3 positions avec label. Intégré dans les paramètres agent, projet, et company. Affichage du plafond imposé par la hiérarchie. |
| DUAL-03 | Enforcement curseur dans workflow | S | 2 | 1-2j | Cofondateur | Intégration avec la state machine (ORCH-01) : si curseur=manuel → validation humaine systématique. Si curseur=assisté → suggestion + validation. Si curseur=auto → exécution directe. |

---

### 2.11 Epic 11 — SSO (FR-SSO)

**Total Epic : 8-10 SP | ~1 semaine (Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| SSO-01 | Table sso_configurations + config | S | 2 | 1j | Tom | Table Drizzle : id, companyId, provider (saml/oidc), config JSONB, enabled. Migration standard. |
| SSO-02 | Better Auth plugins SAML/OIDC | M | 3 | 2-3j | Tom | Intégration plugins Better Auth. Config dynamique par company (chaque company peut avoir son propre IdP). Flux : user → login page → redirect IdP → callback → création/mapping user → session. |
| SSO-03 | UI configuration SSO | M | 3 | 2-3j | Cofondateur | Formulaire admin : choix provider (SAML/OIDC), champs de configuration (entity ID, SSO URL, certificate, etc.), bouton de test, statut connexion. Guide pas-à-pas intégré. |

**Risques Epic 11** :
- Dépend des plugins Better Auth disponibles — vérifier la maturité de l'écosystème plugins
- Test SSO nécessite un IdP de test (Keycloak ou similaire) dans docker-compose

---

### 2.12 Epic 12 — Dashboards par Rôle (FR-DASH)

**Total Epic : 10-13 SP | ~1-1.5 semaine (Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DASH-01 | API dashboards agrégés | M | 5 | 3-4j | Tom | Endpoints GET /dashboards/:type (executive, technical, operational). Queries agrégées avec k-anonymity (k=5). Vues matérialisées PostgreSQL avec GROUP BY obligatoire. Interdiction architecturale du drill-down individuel (Vérité #20). |
| DASH-02 | DashboardCards.tsx par rôle | M | 3 | 2-3j | Cofondateur | Composants : cards KPI, graphiques (recharts ou visx), filtres par période. Vue différente par rôle : CEO (vue stratégique), CTO (vue technique), Manager (vue opérationnelle). |
| DASH-03 | Dashboard temps réel via WebSocket | S | 2 | 1-2j | Tom | Push updates dashboard via WebSocket existant. Rafraîchissement automatique des métriques toutes les 30s. |

---

## 3. Stories Techniques Manquantes (Infrastructure)

Ces stories ne correspondent à aucun FR mais sont **indispensables** pour que le projet fonctionne.

| # | Story | Taille | SP | Effort | Assignation | Justification | Bloque |
|---|-------|--------|-----|--------|-------------|---------------|--------|
| TECH-01 | Docker Compose dev/test/prod | M | 5 | 3-4j | Tom | docker-compose.dev.yml (PostgreSQL 16, Redis 7, server, ui), docker-compose.test.yml (PostgreSQL de test), Dockerfile server + ui. **Prérequis pour toute containerisation.** | Epic 8 |
| TECH-02 | CI/CD Pipeline GitHub Actions | L | 8 | 5-7j | Tom | Pipeline complet : QG-0 (lint+TS) → QG-1 (unit) → QG-2 (integration) → QG-3 (security) → QG-4 (perf) → QG-5 (E2E) → QG-6 (review). Caching pnpm, Docker layers, Cypress binary. ~15-22 min. | Déploiement |
| TECH-03 | Infrastructure de test (factories + seed) | M | 5 | 3-4j | Tom | Factories TypeScript : createTestUser(), createTestCompany(), createTestAgent(), createTestWorkflow(). Seed E2E pour Cypress. Embedded-postgres pour tests d'intégration. Pattern mock : mocker LLM providers, JAMAIS la DB. | Tous les tests |
| TECH-04 | Redis setup + session/cache | M | 3 | 2-3j | Tom | Redis pour : sessions (au lieu de DB), query cache, WebSocket pub/sub (multi-instance), rate limiting. docker-compose + config Node. | Performance, scaling |
| TECH-05 | RLS PostgreSQL (14 tables) | L | 8 | 5-7j | Tom | **Story de sécurité critique.** CREATE POLICY sur 14 tables (toutes sauf user, session, account, verification, instance_user_roles, migrations, assets, inbox_dismissals). SET LOCAL app.current_company_id au début de chaque requête. Tests d'isolation cross-company. | Multi-tenant |
| TECH-06 | Migration DB : 10 nouvelles tables | M | 5 | 3-4j | Tom | Création des 10 tables listées dans le domain model (Section 5.3 PRD). Migration Drizzle avec rollback scripts. Seed de données de test. | Toutes les epics |
| TECH-07 | Migration DB : colonnes ajoutées sur 5 tables | S | 2 | 1j | Tom | companies (+tier, ssoEnabled, maxUsers, parentCompanyId), company_memberships (+businessRole), agents (+containerProfileId, isolationMode), principal_permission_grants (+9 keys), activity_log (+ipAddress, userAgent, severity). | Epic 2, 3 |
| TECH-08 | Refactoring heartbeat.ts (2396 → modules) | M | 5 | 3-5j | Tom | **DETTE TECHNIQUE (DT7)**. Splitting en modules : heartbeat-core.ts, heartbeat-events.ts, heartbeat-compaction.ts, heartbeat-metrics.ts. Nécessaire avant d'intégrer le CompactionWatcher (Epic 9). | Epic 9 |

**Total Stories Techniques : 41 SP | ~4-5 semaines**

---

## 4. Dette Technique à Résoudre AVANT le Sprint

| # | Dette | Sévérité | SP | Effort | Sprint | Justification |
|---|-------|----------|-----|--------|--------|---------------|
| DT1 | hasPermission() ignore scope JSONB | **CRITIQUE** | 3 | 2j | Sprint 1 | Trou de sécurité. Doit être fixé AVANT toute extension RBAC. Inclus dans RBAC-01. |
| DT2 | Drift en mémoire (Map) | Élevée | 3 | 2-3j | Sprint 1-2 | Données perdues au restart. Inclus dans DRIFT-01. |
| DT3 | WebSocket unidirectionnel | Moyenne | 8 | 5-7j | Sprint 2-3 | Bloque le chat temps réel. Inclus dans CHAT-01. |
| DT4 | 6 permission keys seulement | Moyenne | 2 | 1j | Sprint 1 | Insuffisant pour RBAC métier. Inclus dans RBAC-02. |
| DT5 | Activity log sans query/filtrage | Faible | 5 | 3-4j | Sprint 2 | Inclus dans OBS-01/02 (remplacement par audit_events). |
| DT6 | Pas de tests automatisés | Moyenne | 5 | 3-5j | Sprint 1 | Vitest configuré mais 0 tests. Inclus dans TECH-03. |
| DT7 | heartbeat.ts monolithique (2396 lignes) | Faible | 5 | 3-5j | Sprint 2-3 | Bloque intégration compaction. Inclus dans TECH-08. |

**Total dette : ~31 SP** — la plupart est absorbée dans les stories fonctionnelles.

---

## 5. Dépendances Techniques Inter-Stories

### 5.1 Graphe de Dépendances Critique

```
TECH-01 (Docker Compose) ─────────────────────────────────────┐
     │                                                         │
     ▼                                                         ▼
MU-07 (PostgreSQL externe) ──► TECH-06 (10 tables) ──► TECH-05 (RLS)
     │                              │
     ▼                              ▼
RBAC-01 (fix scope) ──► RBAC-04 (enforcement routes)
     │                       │
     ▼                       ▼
PROJ-01/02 (project scope)  OBS-02 (audit emission)
     │
     ▼
ORCH-01 (state machine) ──► ORCH-02 (enforcer) ──► DRIFT-02 (monitor)
     │                                                  │
     ▼                                                  ▼
COMP-01 (compaction watcher)                     DRIFT-03 (UI diff)

TECH-01 (Docker Compose) ──► CONT-01 (ContainerManager)
                                  │
                                  ├──► CONT-02 (Credential Proxy)
                                  │
                                  └──► CHAT-03 (pipe stdin agent)
```

### 5.2 Chemins Critiques

**Chemin A (Product/RBAC)** — Tom principalement :
```
MU-07 → TECH-06/07 → RBAC-01 → RBAC-02 → RBAC-04 → PROJ-01 → PROJ-03
Durée : ~5-6 semaines
```

**Chemin B (Orchestration/Agents)** — Cofondateur principalement :
```
TECH-01 → CONT-01 → CONT-02 → ORCH-01 → ORCH-02 → COMP-01 → COMP-02
Durée : ~8-10 semaines
```

**Le chemin B est le chemin critique du projet** — la containerisation + orchestration + compaction définissent la durée totale.

---

## 6. Répartition Tom vs Cofondateur

### 6.1 Tom (Cofondateur existant — Backend + Observabilité)

Tom connaît la codebase, donc il prend :
- **Infra & migrations** : TECH-01 à TECH-08, MU-07
- **RBAC backend** : RBAC-01, RBAC-02, RBAC-04 (routes critiques)
- **Observabilité** : OBS-01, OBS-02, OBS-03, DRIFT-01
- **WebSocket & Chat backend** : CHAT-01, CHAT-02, CHAT-03
- **SSO backend** : SSO-01, SSO-02
- **API routes** : ORCH-04, DASH-01, DASH-03, CONT-05

**Charge Tom : ~115-140 SP | ~12-14 semaines full-time**

### 6.2 Cofondateur Technique (À recruter — Orchestration + Agents + Frontend)

Le Cofondateur technique prend les systèmes nouveaux qui ne requièrent pas de connaissance historique de la codebase :
- **Containerisation** : CONT-01, CONT-02, CONT-03, CONT-04, CONT-06
- **Orchestration** : ORCH-01, ORCH-02, ORCH-03, ORCH-05
- **Compaction** : COMP-01, COMP-02, COMP-03
- **Frontend** : MU-02, MU-04, RBAC-03, RBAC-05, RBAC-06, RBAC-07, PROJ-04, DRIFT-03, OBS-04, CHAT-04, SSO-03, DASH-02, DUAL-01/02/03

**Charge Cofondateur : ~110-135 SP | ~11-14 semaines full-time**

### 6.3 Points de Sync Obligatoires

| Semaine | Sujet | Participants |
|---------|-------|-------------|
| S1 | Setup Docker + PostgreSQL + premiers tests | Tom + Cofondateur |
| S2 | Review RBAC-01 (fix sécurité scope) | Tom → Cofondateur review |
| S4 | Intégration state machine + heartbeat | Cofondateur → Tom review |
| S6 | Review credential proxy + container security | Cofondateur → Tom + externe |
| S8 | POC compaction : spike technique 1 semaine | Les deux devs ensemble |
| S10 | Intégration complète + smoke tests | Les deux devs ensemble |

---

## 7. Velocity et Planification par Sprint

### 7.1 Hypothèses de Velocity

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| Durée sprint | 2 semaines | Standard Scrum |
| SP par dev par sprint | 15-20 | Conservateur — nouveau cofondateur, codebase complexe, transformation majeure |
| SP équipe par sprint | 30-40 | 2 devs, pas de parallélisme parfait |
| Buffer imprévus | 20% | Bugs, debugging, montée en charge cofondateur |
| SP utiles par sprint | 24-32 | Après buffer |

### 7.2 Total Story Points

| Catégorie | SP Min | SP Max |
|-----------|--------|--------|
| Epic 1 — Multi-User | 16 | 19 |
| Epic 2 — RBAC | 21 | 26 |
| Epic 3 — Scoping Projet | 13 | 16 |
| Epic 4 — Orchestrateur | 29 | 36 |
| Epic 5 — Drift Detection | 13 | 16 |
| Epic 6 — Observabilité | 18 | 22 |
| Epic 7 — Chat | 18 | 23 |
| Epic 8 — Containerisation | 34 | 42 |
| Epic 9 — Compaction | 21 | 26 |
| Epic 10 — Curseur | 10 | 13 |
| Epic 11 — SSO | 8 | 10 |
| Epic 12 — Dashboards | 10 | 13 |
| Stories Techniques | 41 | 45 |
| **TOTAL** | **252** | **307** |

### 7.3 Durée Estimée

| Scénario | SP/sprint | Sprints nécessaires | Durée |
|----------|-----------|--------------------|----- |
| Optimiste | 32 SP/sprint | 8 sprints | **16 semaines** |
| Réaliste | 26 SP/sprint | 10-11 sprints | **20-22 semaines** |
| Pessimiste | 20 SP/sprint | 13-15 sprints | **26-30 semaines** |

### 7.4 Proposition de Sprint Plan (Scénario Réaliste)

| Sprint | Semaines | Focus | SP cible | Stories principales |
|--------|----------|-------|---------|---------------------|
| **Sprint 0** | S1-S2 | Infrastructure | 28 | TECH-01, TECH-03, TECH-06, TECH-07, MU-07, MU-05, MU-06 |
| **Sprint 1** | S3-S4 | RBAC + Multi-User | 30 | RBAC-01, RBAC-02, RBAC-03, RBAC-04, MU-01, MU-02, MU-03, MU-04 |
| **Sprint 2** | S5-S6 | Scoping + Orchestrateur v1 | 28 | PROJ-01/02/03/04, ORCH-01, ORCH-02 |
| **Sprint 3** | S7-S8 | Orchestrateur v2 + Drift | 30 | ORCH-03, ORCH-04, DRIFT-01, DRIFT-02, DRIFT-03, TECH-05 (RLS) |
| **Sprint 4** | S9-S10 | Containerisation P1 | 26 | CONT-01 (spike + impl), CONT-05, TECH-08 (heartbeat refactor) |
| **Sprint 5** | S11-S12 | Containerisation P2 + Chat | 30 | CONT-02, CONT-03, CONT-04, CHAT-01, CHAT-02 |
| **Sprint 6** | S13-S14 | Chat + Observabilité | 28 | CHAT-03, CHAT-04, OBS-01, OBS-02, OBS-03 |
| **Sprint 7** | S15-S16 | Observabilité + SSO | 26 | OBS-04, SSO-01, SSO-02, SSO-03, CONT-06 |
| **Sprint 8** | S17-S18 | Compaction (spike + impl) | 26 | COMP-01, COMP-02, COMP-03 |
| **Sprint 9** | S19-S20 | Curseur + Dashboards + Polish | 25 | DUAL-01/02/03, DASH-01/02/03, ORCH-05, TECH-02 (CI/CD) |
| **Sprint 10** | S21-S22 | Stabilisation + Tests E2E | 20 | TECH-04 (Redis), smoke tests, performance, bug fixes |

**Jalon CBA (juin 2026)** : Après Sprint 5 (~S12 = début juin), le MVP est **vendable** avec : multi-user, RBAC, scoping, orchestrateur v1, drift basique, containerisation P1. C'est le moment de la démo CBA.

---

## 8. Faisabilité — Ce qui est Simple vs Complexe

### 8.1 Simple (Pattern existant, modification incrémentale)

| Story | Pourquoi c'est simple |
|-------|----------------------|
| MU-05, MU-06 | Flag boolean + endpoint existant. <1j chacun. |
| RBAC-02, RBAC-07 | Constants + CRUD UI. Pattern existant dans la codebase. |
| RBAC-03 | Migration colonne simple. 1h de code, 2h de tests. |
| PROJ-01, CHAT-02, CONT-05, SSO-01 | Nouvelles tables Drizzle. Pattern identique aux 38 tables existantes. |
| DUAL-03 | If/else dans la state machine. Trivial si ORCH-01 est bien conçu. |

### 8.2 Modéré (Nouveau code mais pattern connu)

| Story | Pourquoi c'est modéré |
|-------|----------------------|
| MU-01 | Infra email à choisir (Resend vs Nodemailer), mais le flow est classique. |
| RBAC-01 | Fix bien défini (ADR-002), mais impacte toute la sécurité. |
| RBAC-04 | Volume de travail (22 fichiers) mais chaque modification est mécanique. |
| OBS-01 | Partitionnement PostgreSQL est avancé mais bien documenté. |
| SSO-02 | Dépend de la maturité des plugins Better Auth — risque si immature. |

### 8.3 Complexe (Nouveau système, R&D nécessaire)

| Story | Pourquoi c'est complexe |
|-------|------------------------|
| ORCH-01 | State machine de 12 transitions avec guards. Coeur du produit. Aucune erreur permise. |
| CONT-01 | Docker en production avec isolation sécurisée. Domaine spécialisé. |
| CONT-02 | Credential proxy HTTP security-critical. Erreur = fuite de secrets. |
| COMP-01/02 | **Le plus complexe du projet.** Détection compaction = heuristique, pas de signal clair. Spike obligatoire. |
| CHAT-01 | Transformation WebSocket unidirectionnel → bidirectionnel. Impact toute l'architecture real-time. |

### 8.4 Risque R&D (Spike recommandé)

| Sujet | Durée spike | Objectif | Décision si échec |
|-------|------------|---------|-------------------|
| Compaction detection | 1 semaine | Observer comportement compaction sur 3 LLMs | Report compaction à post-MVP, focus sur monitoring basique |
| Container + credential proxy POC | 2-3 jours | Prouver que le pattern Nanoclaw fonctionne avec dockerode | Évaluer alternative (processus isolés au lieu de containers) |
| SSO Better Auth | 1 jour | Vérifier maturité plugins SAML/OIDC | Si immature → implémentation custom ou librairie tierce (passport-saml) |

---

## 9. Recommandations

### 9.1 Priorités Sprint 0 et 1

1. **TECH-01 + MU-07** en premier — sans PostgreSQL externe et Docker, rien ne fonctionne
2. **RBAC-01** en deuxième — le trou de sécurité scope JSONB doit être corrigé immédiatement
3. **TECH-03** en parallèle — l'infrastructure de test conditionne la qualité de tout le reste

### 9.2 Décisions à Prendre Maintenant

| Décision | Options | Recommandation |
|----------|---------|----------------|
| Service email | Resend (SaaS) vs Nodemailer (self-hosted) | **Resend** pour le MVP (rapide à intégrer, transactional emails) |
| State machine lib | Custom vs XState vs Robot | **XState** — mature, typé, visualiseur intégré |
| Drag-and-drop UI | dnd-kit vs react-beautiful-dnd | **dnd-kit** — plus moderne, mieux maintenu |
| Redis provider | Upstash (serverless) vs Redis self-hosted | **Self-hosted** en dev (docker-compose), Upstash en production |
| LLM provider pour résumés | Haiku direct vs abstraction multi-provider | **Haiku direct** pour le MVP, abstraction en post-MVP |

### 9.3 Ce qui peut être Reporté au Post-MVP

| Story | Raison du report | Impact |
|-------|-----------------|--------|
| ORCH-05 (UI drag-and-drop workflow) | P1, éditeur YAML suffit pour le MVP CBA | Faible — CTO CBA peut configurer en YAML |
| COMP-03 (réinjection post-compaction) | P1, kill+relance suffit pour le MVP | Moyen — fonctionnel mais moins élégant |
| DASH-02/03 (dashboards temps réel) | P1, des dashboards statiques suffisent | Faible — refresh manuel acceptable |
| SSO-01/02/03 | P1 Enterprise, pas nécessaire pour le POC CBA | Nul pour le POC — CBA utilise email/password |
| OBS-03 (résumé LLM) | P1, les logs techniques bruts suffisent pour le MVP | Moyen — expérience dégradée mais fonctionnelle |

**En reportant ces stories (~25-30 SP), le MVP CBA tombe à ~220-275 SP soit 8-10 sprints (16-20 semaines).**

### 9.4 Alerte sur la Timeline PRD

Le PRD annonce **8-10 semaines**. Mon estimation réaliste est **20-22 semaines (2 devs)**. La divergence s'explique par :

1. Les **stories techniques** (41 SP) ne sont pas comptées dans le PRD
2. La **dette technique** (DT1-DT7) n'est pas comptée
3. Le **temps de montée en charge du cofondateur technique** (2-4 semaines pour être productif sur la codebase)
4. Les **spikes R&D** (compaction, container POC) ne sont pas comptés
5. Les **tests et CI/CD** ne sont pas comptés

**Pour respecter la deadline CBA (juin 2026)**, il faut :
- Reporter SSO, dashboards avancés, et résumé LLM au post-MVP
- Focus Sprint 0-5 (12 semaines) sur le core : multi-user, RBAC, orchestrateur, containerisation v1
- Accepter un MVP "rugueux" pour le POC CBA et polir en Sprint 6-10

---


---

# PARTIE 5 — Acceptance Criteria, Definition of Done & Quality Gates

> **Auteur** : Quinn (QA)


## 2. Acceptance Criteria Critiques par Epic (Given/When/Then)

### 2.1 Epic FR-MU : Multi-User & Auth

**AC-MU-01 : Invitation par email** [P0]
```gherkin
Given un Admin ou Manager connecté
When il saisit un email valide et clique "Inviter"
Then une invitation est créée avec un lien signé (expire 7j)
  And un email est envoyé au destinataire
  And un audit_event "members.invite" est émis avec actorId, targetEmail, companyId
  And l'invitation apparaît dans la liste des invitations en attente
```

**AC-MU-02 : Acceptation d'invitation** [P0]
```gherkin
Given un utilisateur avec un lien d'invitation valide (non expiré)
When il clique sur le lien et complète l'inscription
Then un company_membership est créé avec le rôle par défaut (Contributor)
  And l'invitation passe au statut "accepted"
  And un audit_event "members.join" est émis
  And l'utilisateur est redirigé vers le dashboard de la company
```

**AC-MU-03 : Invitation expirée** [P1]
```gherkin
Given un utilisateur avec un lien d'invitation expiré (>7j)
When il clique sur le lien
Then une page d'erreur claire s'affiche ("Invitation expirée")
  And un bouton "Demander une nouvelle invitation" est visible
  And aucun company_membership n'est créé
```

**AC-MU-04 : Désactivation signup libre** [P0]
```gherkin
Given un Admin de company
When il active l'option "Invitation uniquement" dans les paramètres
Then la route /signup retourne 403 pour cette company
  And seuls les liens d'invitation permettent de rejoindre
  And un audit_event "company.config_change" est émis
```

**AC-MU-05 : Sign-out avec invalidation** [P0]
```gherkin
Given un utilisateur connecté avec une session active
When il clique "Déconnexion"
Then la session est invalidée côté serveur (supprimée de la table sessions)
  And le token côté client est supprimé
  And toute requête API avec l'ancien token retourne 401
  And l'utilisateur est redirigé vers /login
```

### 2.2 Epic FR-RBAC : Roles & Permissions

**AC-RBAC-01 : Attribution de rôle** [P0]
```gherkin
Given un Admin connecté sur la page Membres
When il change le rôle d'un membre de "Contributor" à "Manager"
Then le businessRole est mis à jour dans company_memberships
  And les principal_permission_grants sont recalculés selon le preset Manager
  And un audit_event "members.role_change" est émis avec oldRole et newRole
  And le changement prend effet immédiatement (pas besoin de re-login)
```

**AC-RBAC-02 : Enforcement route API (403)** [P0]
```gherkin
Given un utilisateur avec le rôle "Viewer"
When il tente un POST /api/agents (nécessite agents.launch)
Then la route retourne HTTP 403 Forbidden
  And le body contient { error: "PERMISSION_DENIED", requiredPermission: "agents.launch" }
  And un audit_event "access.denied" est émis avec le détail
  And aucune mutation n'est effectuée en base
```

**AC-RBAC-03 : Scope JSONB enforcement** [P0 - sécurité critique]
```gherkin
Given un Contributor avec scope { projectIds: ["proj-A"] }
When il tente un GET /api/agents?projectId=proj-B
Then la route retourne HTTP 403 (scope violation)
  And un audit_event "access.scope_denied" est émis
When il tente un GET /api/agents?projectId=proj-A
Then les agents du projet A sont retournés normalement
```

**AC-RBAC-04 : Masquage navigation UI** [P1]
```gherkin
Given un Viewer connecté au dashboard
When la page se charge
Then les items de navigation nécessitant des permissions non-détenues sont absents du DOM
  And pas simplement grisés ou cachés en CSS (vérifiable par inspecteur DOM)
  And la console ne contient aucune erreur de permission
```

**AC-RBAC-05 : Protection dernier admin** [P0]
```gherkin
Given une company avec un seul Admin
When cet Admin tente de changer son propre rôle à Manager/Contributor/Viewer
Then l'opération est refusée avec message "Au moins un Admin requis"
  And aucune modification n'est effectuée
```

### 2.3 Epic FR-ORCH : Orchestrateur Déterministe

**AC-ORCH-01 : Exécution step-by-step imposée** [P0]
```gherkin
Given un workflow avec les étapes [Analyse, Design, Code, Test, Review]
When l'agent tente de passer à l'étape "Code" sans avoir complété "Design"
Then la transition est refusée par le WorkflowEnforcer
  And un audit_event "workflow.transition_denied" est émis
  And l'agent reste bloqué à l'étape "Design"
  And l'UI affiche clairement l'étape en cours et les étapes verrouillées
```

**AC-ORCH-02 : Fichiers obligatoires avant transition** [P0]
```gherkin
Given une étape "Design" avec fichiers obligatoires [design-spec.md, wireframes.md]
When l'agent tente de passer à l'étape suivante
  And design-spec.md existe mais wireframes.md est manquant
Then la transition est refusée
  And le message d'erreur liste les fichiers manquants
  And un audit_event "workflow.files_missing" est émis
```

**AC-ORCH-03 : Drift detection et alerte** [P0]
```gherkin
Given un agent en exécution sur un workflow
When le DriftDetector détecte une déviation (output hors scope, fichier non attendu)
  And la déviation dure plus de 15 minutes
Then une alerte drift est créée dans la table drift_alerts
  And une notification WebSocket est envoyée aux Manager/Admin
  And l'UI affiche un diff visuel (attendu vs observé)
  And les actions "Recharger / Kill+Relance / Ignorer" sont proposées
```

**AC-ORCH-04 : Compaction kill+relance** [P0]
```gherkin
Given un agent en exécution à l'étape 3/5 d'un workflow
When le CompactionWatcher détecte une compaction (réduction soudaine de contexte)
  And la stratégie configurée est "kill+relance"
Then l'agent est arrêté (SIGTERM, puis SIGKILL après 10s)
  And un snapshot des résultats intermédiaires est sauvegardé (compaction_snapshots)
  And un nouvel agent est lancé avec le contexte frais + résultats des étapes 1-2
  And l'étape 3 reprend depuis le début
  And un audit_event "workflow.compaction_recovery" est émis
  And le circuit breaker incrémente (max 3 relances par session)
```

**AC-ORCH-05 : Validation humaine (HITL)** [P0]
```gherkin
Given un workflow avec validation humaine activée sur l'étape "Review"
When l'agent complète l'étape "Review" et soumet pour validation
Then l'état passe à VALIDATING
  And une notification est envoyée au validateur humain désigné
  And le workflow est en pause tant que la validation n'est pas reçue
When le validateur approuve
Then le workflow passe à l'étape suivante
When le validateur rejette avec commentaire
Then l'agent revient à l'état précédent avec le feedback injecté
```

### 2.4 Epic FR-OBS : Observabilité & Audit

**AC-OBS-01 : Audit log complet** [P0]
```gherkin
Given toute action de mutation dans MnM (création, modification, suppression)
When l'action est exécutée
Then un audit_event est créé avec :
  - actorId (qui), actorType (user/agent/system)
  - action (verbe), targetType, targetId (quoi)
  - metadata JSONB (détails contextuels)
  - companyId (isolation tenant)
  - ipAddress, createdAt
  And l'event est immutable (TRIGGER deny UPDATE/DELETE)
  And l'event est partitionné par mois
```

**AC-OBS-02 : Résumé LLM temps réel** [P1]
```gherkin
Given un agent en exécution produisant des heartbeat events
When un nouvel event technique arrive
Then l'AuditSummarizer traduit en langage naturel via Haiku
  And le résumé est disponible dans <5 secondes
  And le résumé est poussé via WebSocket au dashboard
  And le résumé ne contient aucune donnée sensible (credentials, tokens)
```

**AC-OBS-03 : Dashboards agrégés** [P1]
```gherkin
Given un Manager accédant au dashboard
When les métriques sont affichées
Then toutes les données sont agrégées (jamais de données individuelles — Vérité #20)
  And le k-anonymity k=5 est respecté (pas de groupe < 5 individus)
  And aucun drill-down vers les données individuelles n'est possible
  And les vues utilisent des GROUP BY obligatoires côté SQL
```

### 2.5 Epic FR-CHAT : Chat Temps Réel

**AC-CHAT-01 : Chat bidirectionnel WebSocket** [P0]
```gherkin
Given un Contributor avec permission chat.agent sur un agent en exécution
When il ouvre le panneau chat et envoie un message
Then le message est transmis via WebSocket au serveur
  And le serveur pipe le message vers stdin de l'agent
  And la réponse de l'agent arrive via WebSocket en <50ms
  And le message est persisté dans chat_messages
  And un audit_event "chat.message_sent" est émis
```

**AC-CHAT-02 : Reconnexion WebSocket** [P1]
```gherkin
Given un utilisateur connecté au chat d'un agent
When la connexion WebSocket est interrompue (réseau, changement de page)
Then le client tente une reconnexion automatique
  And le serveur buffer les messages pendant 30s max
  And à la reconnexion, les messages manqués sont synchronisés
  And l'utilisateur voit l'indicateur "Reconnexion..." pendant la déconnexion
  And aucun message n'est perdu (sauf si déconnexion > 30s)
```

**AC-CHAT-03 : Rate limiting chat** [P1]
```gherkin
Given un utilisateur envoyant des messages au chat
When il dépasse 10 messages par minute
Then le 11e message est rejeté avec code 429 (Too Many Requests)
  And un message d'erreur clair est affiché côté UI
  And un audit_event "chat.rate_limited" est émis
  And le compteur se réinitialise après 60 secondes
```

### 2.6 Epic FR-CONT : Containerisation

**AC-CONT-01 : Container éphémère avec profil** [P0]
```gherkin
Given un agent configuré avec le profil "standard" (1 CPU, 512MB)
When l'agent est lancé
Then un container Docker est créé avec les flags --rm --read-only --no-new-privileges
  And les limites de ressources correspondent au profil (1 CPU, 512MB)
  And le container est détruit automatiquement à la fin de l'exécution
  And un audit_event "container.started" est émis avec le profileId et containerId
```

**AC-CONT-02 : Credential proxy** [P0]
```gherkin
Given un agent dans un container ayant besoin d'une clé API
When l'agent appelle http://credential-proxy:8090/api/secret/OPENAI_KEY
Then le proxy résout la clé via le provider configuré (local/AWS/GCP/Vault)
  And la clé est retournée uniquement si l'agent a les droits (credential_proxy_rules)
  And la clé n'apparaît jamais dans les logs du container
  And un audit_event "credential.accessed" est émis
  And l'accès depuis l'extérieur du réseau Docker est bloqué (port 8090 interne uniquement)
```

**AC-CONT-03 : Mount allowlist** [P0]
```gherkin
Given un container avec un allowlist de montage [/workspace/project-a]
When l'agent tente d'accéder à /workspace/project-b
Then l'accès est refusé
When l'agent tente un path traversal (../../etc/passwd, symlinks, null bytes, URL encoding)
Then l'accès est refusé
  And un audit_event "container.path_traversal_attempt" est émis avec severity=critical
  And le container est immédiatement arrêté
```

**AC-CONT-04 : Isolation réseau inter-company** [P0]
```gherkin
Given deux companies A et B avec des containers actifs
When un container de company A tente de communiquer avec un container de company B
Then la communication est bloquée (bridges Docker séparés par company)
  And aucune donnée cross-company ne peut transiter via le réseau Docker
```

### 2.7 Epic FR-DUAL : Dual-Speed Workflow

**AC-DUAL-01 : Curseur d'automatisation** [P1]
```gherkin
Given un Contributor sur sa page de paramètres
When il positionne son curseur d'automatisation sur "Assisté"
Then les actions mécaniques sont automatisées
  And les actions de jugement nécessitent une validation humaine
  And le curseur est sauvegardé dans automation_cursors avec level=action
  And le plafond hiérarchique est respecté (son curseur ne peut pas dépasser celui du Manager)
```

**AC-DUAL-02 : Plafond hiérarchique** [P1]
```gherkin
Given un Manager avec curseur en position "Assisté"
  And un Contributor sous sa hiérarchie avec curseur en "Auto"
When le système évalue les permissions d'automatisation du Contributor
Then le curseur effectif du Contributor est "Assisté" (plafonné par le Manager)
  And l'UI affiche clairement le plafond et sa raison
```

### 2.8 Epic FR-A2A : Agent-to-Agent

**AC-A2A-01 : Communication inter-agents avec HITL** [P1]
```gherkin
Given un Agent A qui a besoin de contexte d'Agent B
When Agent A émet une requête A2A via le bus
Then le A2ABus vérifie les permissions (scope, rôle, projet)
  And une notification est envoyée au propriétaire humain d'Agent B
  And le propriétaire approuve ou rejette la requête
  And un audit_event "a2a.request" est émis avec les deux agentIds
When le propriétaire approuve
Then Agent A reçoit le contexte demandé
  And la chaîne A2A est incrémentée (max 5 requêtes par chaîne)
```

### 2.9 Epic FR-ONB : Onboarding

**AC-ONB-01 : Onboarding CEO conversationnel** [P1]
```gherkin
Given un nouveau CEO/DSI qui accède à MnM pour la première fois
When l'agent d'onboarding démarre en mode conversationnel
Then l'agent pose les questions structurées (5-7 échanges max)
  And les réponses sont transformées en configuration company
  And la cascade hiérarchique est initialisée (CEO → CTO → Managers)
  And un audit_event "onboarding.completed" est émis
```

---

## 3. Test Coverage Requirements par Epic

### 3.1 Matrice de Couverture

| Epic | Unit Tests | Integration Tests | E2E (Cypress) | Security Tests | Perf Tests |
|------|-----------|-------------------|---------------|----------------|------------|
| **FR-MU** | >= 80% services invites, members | Routes /invites, /members (auth + validation) | Flux invitation complet, sign-out | ST-SEC-10 (session), ST-SEC-11 (brute force) | - |
| **FR-RBAC** | >= 95% hasPermission(), canUser(), presets | 100% des 22 routes protégées, scope JSONB | Flux admin change rôle, viewer bloqué | ST-SEC-01/02/03 (escalade, bypass, injection scope) | - |
| **FR-ORCH** | >= 80% WorkflowEnforcer, state machine | Transitions workflow, fichiers obligatoires | Workflow complet step-by-step avec drift | - | - |
| **FR-OBS** | >= 80% audit-summarizer, aggregation | Audit log creation, export CSV/JSON | Dashboard consulte, filtre, exporte | - | QG-4 audit query <500ms |
| **FR-CHAT** | >= 80% chat-service, message routing | WebSocket connect/send/receive, rate limit | Dialogue pendant exécution agent | ST-SEC-07 (XSS chat) | WebSocket <50ms |
| **FR-CONT** | >= 90% ContainerManager, credential-proxy | Container launch/stop, credential resolution | Container complet avec profil | ST-SEC-04/05/06 (escape, traversal, proxy) | Container startup <10s |
| **FR-DUAL** | >= 80% automation cursors, ceiling logic | Curseur save/load, plafond hiérarchique | Slider UI + plafond visible | - | - |
| **FR-A2A** | >= 80% a2a-bus, cycle detection | Requête A2A + validation HITL | - (E2E complexe, couvert par intégration) | - | - |
| **FR-ONB** | >= 80% import-service, cascade logic | Import Jira mapping, cascade creation | Onboarding wizard complet | - | - |

### 3.2 Objectifs de Couverture Spécifiques

**Couverture critique (>= 95%)** — composants où un bug = faille de sécurité :
- `access.ts` — hasPermission() avec scope JSONB
- `credential-proxy.ts` — résolution secrets, validation accès
- Middleware `requirePermission()` — enforcement sur chaque route
- RLS policies PostgreSQL — isolation tenant

**Couverture standard (>= 80%)** — reste du nouveau code :
- Services métier (workflow-enforcer, chat-service, audit-summarizer, etc.)
- Composants frontend (MembersTable, PermissionMatrix, DashboardCards, etc.)
- Utilitaires et helpers

**Couverture routes API (100%)** — chaque route DOIT avoir :
- Un test vérifiant que l'auth est requise (401 sans token)
- Un test vérifiant le RBAC (403 sans permission)
- Un test vérifiant l'isolation tenant (pas de données cross-company)
- Un test du happy path avec réponse correcte

---

## 4. Acceptance Criteria pour les NFRs

### 4.1 Performance

**NFR-PERF-01 : Latence API** [P0]
```gherkin
Given l'application déployée en environnement staging
When un test k6 exécute 100 requêtes simultanées pendant 5 minutes
Then le P50 de toutes les routes API est <100ms
  And le P95 est <500ms
  And le P99 est <1000ms
  And aucune requête ne timeout (>30s)
```

**NFR-PERF-02 : WebSocket latence** [P0]
```gherkin
Given un client WebSocket connecté au chat d'un agent
When un message est envoyé
Then la réponse (ack serveur) arrive en <50ms (P95)
  And le message de l'agent arrive en <200ms après traitement
```

**NFR-PERF-03 : Chargement dashboard** [P1]
```gherkin
Given un utilisateur accédant au dashboard pour la première fois
When la page se charge
Then le Time to First Contentful Paint est <1s
  And le Time to Interactive est <2s
  And les données initiales sont affichées en <2s
  And le chargement progressif (skeleton loaders) est visible pendant le chargement
```

**NFR-PERF-04 : Démarrage container** [P0]
```gherkin
Given un profil container "standard" (1 CPU, 512MB)
When un agent est lancé
Then le container est opérationnel (ready to accept commands) en <10s
  And l'image Docker est pré-pullée (pas de download au lancement)
```

**NFR-PERF-05 : Scalabilité** [P1]
```gherkin
Given l'application en charge Enterprise
When 50 utilisateurs sont connectés simultanément
  And 20 agents sont actifs
  And 100 WebSocket connexions sont ouvertes
Then les métriques de performance ci-dessus restent dans les limites MVP
  And la consommation mémoire serveur ne dépasse pas 4GB
  And la consommation CPU ne dépasse pas 80%
```

### 4.2 Sécurité

**NFR-SEC-01 : Isolation tenant RLS** [P0]
```gherkin
Given deux companies A et B avec des données dans les mêmes tables
When un utilisateur de company A exécute n'importe quelle requête
Then AUCUNE donnée de company B n'est visible, modifiable ou supprimable
  And ceci est vérifié sur les 14 tables sous RLS
  And un test d'intégration tente explicitement d'accéder aux données cross-company
  And le test échoue avec 0 résultats (pas d'erreur, pas de données)
```

**NFR-SEC-02 : RBAC enforcement complet** [P0]
```gherkin
Given les 22 fichiers de routes existants + les nouvelles routes B2B
When chaque route est testée avec un token d'un rôle non-autorisé
Then 100% des routes retournent 403
  And les 3 routes critiques identifiées (approvals, assets, secrets) sont sécurisées
  And aucune route ne permet un accès sans vérification canUser/hasPermission
```

**NFR-SEC-03 : Input sanitization** [P0]
```gherkin
Given les vecteurs d'attaque XSS, SQL injection, path traversal
When un payload malicieux est envoyé via chat (<script>alert('xss')</script>)
  Or via scope JSONB ({"$ne": null})
  Or via path mount (../../etc/passwd)
Then le payload est rejeté ou sanitisé avant traitement
  And aucun code JavaScript ne s'exécute côté client
  And aucune requête SQL non paramétrée n'est exécutée
  And aucun accès fichier hors allowlist n'est possible
```

**NFR-SEC-04 : Rate limiting** [P1]
```gherkin
Given les limites configurées (login 5/min, invitations 20/h, chat 10/min, API 100/min)
When un client dépasse la limite
Then la requête suivante retourne 429 Too Many Requests
  And un header Retry-After indique le délai restant
  And un audit_event "rate.limit_exceeded" est émis
```

**NFR-SEC-05 : Credential isolation** [P0]
```gherkin
Given un agent en container avec accès au credential proxy
When l'agent accède à une clé via le proxy
Then la clé n'apparaît dans aucun log (container, serveur, audit résumé)
  And la clé n'est pas dans les variables d'environnement du container
  And le fichier .env est monté sur /dev/null (shadow mount)
  And l'accès au port 8090 depuis l'extérieur du bridge Docker est impossible
```

### 4.3 Accessibilité

**NFR-A11Y-01 : WCAG 2.1 AA** [P1]
```gherkin
Given tout composant frontend MnM
When testé avec axe-core (plugin Cypress)
Then 0 violation de niveau A et AA
  And tous les éléments interactifs sont accessibles au clavier (Tab, Enter, Escape)
  And le contraste de texte respecte le ratio minimum (4.5:1 normal, 3:1 large)
  And les formulaires ont des labels explicites associés aux inputs
  And les images ont des alt texts descriptifs
  And les erreurs de formulaire sont annoncées aux lecteurs d'écran
```

**NFR-A11Y-02 : Navigation clavier** [P1]
```gherkin
Given l'interface MnM
When un utilisateur navigue uniquement au clavier
Then tous les éléments interactifs sont atteignables via Tab
  And l'ordre de focus est logique (gauche→droite, haut→bas)
  And le focus est visible (outline ou indicateur clair)
  And les modales piègent le focus correctement
  And Escape ferme les menus, modales et popovers
```

---

## 5. Regression Testing Strategy

### 5.1 Principes Fondamentaux

La stratégie de régression garantit que chaque sprint n'introduit pas de régressions sur les fonctionnalités livrées dans les sprints précédents. L'approche repose sur trois piliers :

1. **Automatisation maximale** : chaque AC validé = test automatisé ajouté à la suite de régression
2. **Exécution continue** : la suite complète est exécutée à chaque PR et nightly
3. **Isolation par phase** : chaque phase a sa propre suite, exécutée cumulativement

### 5.2 Suites de Régression par Phase

**Suite REG-P1 : Fondations Multi-User (Phase 1)**
- Workflows mono-user existants fonctionnent identiquement
- Agents existants démarrent et exécutent correctement
- WebSocket unidirectionnel (live events) fonctionne
- Secrets existants sont accessibles
- Les 38 tables existantes ne sont pas impactées par les migrations
- Exécution : ~5 minutes, 50-80 tests

**Suite REG-P2 : RBAC & Scoping (Phase 2)**
- Tout de REG-P1
- Admin a toutes les permissions (pas de régression d'accès)
- Les routes API existantes retournent les mêmes réponses
- Le frontend fonctionne pour tous les rôles
- Les permissions par défaut sont correctes
- Exécution : ~8 minutes, 80-120 tests

**Suite REG-P3 : Orchestration & Containers (Phase 3)**
- Tout de REG-P1 + REG-P2
- Les workflows existants ne sont pas cassés par le WorkflowEnforcer
- Sans scope = tout visible (backward compatibility)
- Les agents non-containerisés fonctionnent encore
- Le chat ne casse pas le WebSocket existant
- Exécution : ~12 minutes, 120-180 tests

**Suite REG-P4 : Enterprise Features (Phase 4)**
- Tout de REG-P1 + REG-P2 + REG-P3
- SSO n'empêche pas le login email+password
- L'audit partitionné n'impacte pas les performances de lecture
- Le rate limiting ne bloque pas l'usage normal
- Les imports ne polluent pas les données existantes
- Exécution : ~15 minutes, 180-250 tests

### 5.3 Stratégie d'Exécution

| Trigger | Suites exécutées | Durée max |
|---------|-----------------|-----------|
| **Push sur PR** | QG-0 (lint) + QG-1 (unit) + QG-2 (intégration phase courante) | ~10 min |
| **Merge sur develop** | QG-0 à QG-5 complet (toutes les suites de régression) | ~22 min |
| **Nightly (23h00)** | Suite complète + QG-3 (sécurité) + QG-4 (performance) | ~45 min |
| **Pre-release** | Tout + tests de charge k6 + OWASP ZAP | ~90 min |

### 5.4 Gestion des Régressions Détectées

1. **Régression détectée en CI** : le build est bloqué, notification Slack, la PR ne peut pas être mergée
2. **Régression détectée en nightly** : ticket P1 créé automatiquement, assigné au dernier commiteur
3. **Régression détectée en pre-release** : release bloquée jusqu'à résolution
4. **Seuil de tolérance** : 0 régression P0/P1 tolérée. Régressions P2 acceptées temporairement si ticket créé.

### 5.5 Métriques de Régression

| Métrique | Objectif | Alerte si |
|----------|----------|-----------|
| Tests de régression passants | 100% | <100% |
| Couverture de code globale | >=80% | Baisse >2% d'un sprint à l'autre |
| Temps d'exécution suite complète | <22 min | >30 min |
| Tests flaky (intermittents) | 0 | >0 (investigation immédiate) |
| Nouveaux tests par sprint | >=20 | <10 |

---

## 6. Quality Gates par Phase

### 6.1 Phase 1 — Fondations Multi-User

**Quality Gate d'entrée en Phase 1 :**
- Infrastructure de test configurée (Vitest, Supertest, Cypress, embedded-postgres)
- CI pipeline fonctionnel (QG-0 à QG-5)
- PostgreSQL externe migré et opérationnel
- Seed de données E2E prêt

**Quality Gate de sortie de Phase 1 :**

| Gate | Critère | Bloquant |
|------|---------|----------|
| QG-P1-01 | Invitation par email fonctionne E2E | Oui |
| QG-P1-02 | Page Membres affiche, filtre, et gère les membres | Oui |
| QG-P1-03 | Sign-out invalide la session (vérifiable côté serveur) | Oui |
| QG-P1-04 | Signup libre désactivable | Oui |
| QG-P1-05 | Migration DB réversible et testée | Oui |
| QG-P1-06 | Aucune régression sur les 38 tables existantes | Oui |
| QG-P1-07 | Couverture >= 80% sur le nouveau code | Oui |
| QG-P1-08 | 7 smoke tests passent | Oui |

### 6.2 Phase 2 — RBAC & Scoping

**Quality Gate d'entrée en Phase 2 :**
- Phase 1 QG passé
- Suite REG-P1 verte
- Audit des 22 fichiers de routes complété

**Quality Gate de sortie de Phase 2 :**

| Gate | Critère | Bloquant |
|------|---------|----------|
| QG-P2-01 | hasPermission() lit et applique le scope JSONB | Oui |
| QG-P2-02 | 100% des routes API protégées (y compris les 3 critiques) | Oui |
| QG-P2-03 | Les 4 rôles fonctionnent avec leurs presets | Oui |
| QG-P2-04 | UI masque les items non-autorisés (absent du DOM) | Oui |
| QG-P2-05 | Tests d'escalade horizontale et verticale passent | Oui |
| QG-P2-06 | Injection scope JSONB bloquée | Oui |
| QG-P2-07 | Suite REG-P1 + REG-P2 verte | Oui |
| QG-P2-08 | Couverture hasPermission/canUser >= 95% | Oui |

### 6.3 Phase 3 — Orchestration & Communication

**Quality Gate d'entrée en Phase 3 :**
- Phase 2 QG passé
- Suite REG-P1 + REG-P2 verte
- Docker installé et testé dans l'environnement CI

**Quality Gate de sortie de Phase 3 :**

| Gate | Critère | Bloquant |
|------|---------|----------|
| QG-P3-01 | WorkflowEnforcer impose les transitions (agent ne peut pas sauter) | Oui |
| QG-P3-02 | Drift detection fonctionne en <15 minutes | Oui |
| QG-P3-03 | Compaction kill+relance fonctionne avec circuit breaker | Oui |
| QG-P3-04 | Container éphémère --rm --read-only fonctionne | Oui |
| QG-P3-05 | Credential proxy résout les secrets sans exposition | Oui |
| QG-P3-06 | Mount allowlist bloque path traversal | Oui |
| QG-P3-07 | Chat WebSocket bidirectionnel fonctionne E2E | Oui |
| QG-P3-08 | Isolation réseau inter-company vérifiée | Oui |
| QG-P3-09 | Container startup <10s | Oui |
| QG-P3-10 | Suite REG-P1 + REG-P2 + REG-P3 verte | Oui |

### 6.4 Phase 4 — Enterprise Features

**Quality Gate d'entrée en Phase 4 :**
- Phase 3 QG passé
- Suite REG-P1 + REG-P2 + REG-P3 verte
- Tests de charge k6 baseline établis

**Quality Gate de sortie de Phase 4 :**

| Gate | Critère | Bloquant |
|------|---------|----------|
| QG-P4-01 | SSO SAML/OIDC fonctionne sans casser email+password | Oui |
| QG-P4-02 | Audit log partitionné avec rétention 3 ans | Oui |
| QG-P4-03 | Dashboards agrégés respectent k-anonymity k=5 | Oui |
| QG-P4-04 | Rate limiting actif sur toutes les routes configurées | Oui |
| QG-P4-05 | Import Jira mappe correctement projets/epics/stories | Non (P2) |
| QG-P4-06 | Curseur d'automatisation avec plafond hiérarchique | Non (P1) |
| QG-P4-07 | Communication A2A avec HITL et anti-boucle | Non (P1) |
| QG-P4-08 | Tests de charge : 50 users, 20 agents, 100 WS — métriques MVP tenues | Oui |
| QG-P4-09 | OWASP ZAP : 0 critical, 0 high | Oui |
| QG-P4-10 | Suite REG-P1 + P2 + P3 + P4 complète verte | Oui |
| QG-P4-11 | RGPD : droit effacement, consentement, export fonctionnels | Oui |

---

## 7. Edge Cases Critiques par Epic

### 7.1 FR-MU — Multi-User

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-MU-01 | Invitation expirée puis renvoi | L'ancienne invitation est invalidée, une nouvelle est créée avec nouveau token | Integration |
| EC-MU-02 | User déjà membre ré-invité | L'invitation est refusée avec message "Déjà membre" | Integration |
| EC-MU-03 | Email invalide à l'invitation | Validation Zod côté serveur, 400 Bad Request | Unit |
| EC-MU-04 | Invitation pendant maintenance | La requête est mise en queue, l'invitation est créée après reprise | Integration |
| EC-MU-05 | 2 admins invitent le même email simultanément | Une seule invitation est créée (contrainte unique sur email+companyId+status) | Integration (race condition) |
| EC-MU-06 | Suppression compte avec agents actifs | Les agents sont arrêtés proprement, les sessions terminées, les données anonymisées (RGPD) | Integration |

### 7.2 FR-RBAC — Roles & Permissions

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-RBAC-01 | Changement de rôle pendant session active | Les permissions sont réévaluées immédiatement (pas de cache stale) | Integration |
| EC-RBAC-02 | Dernier admin se rétrograde | Opération bloquée, message "Au moins un Admin requis" | Unit + Integration |
| EC-RBAC-03 | Permissions conflictuelles | Deny l'emporte toujours sur Allow (deny > allow) | Unit |
| EC-RBAC-04 | Rôle supprimé avec membres assignés | Migration automatique des membres vers rôle par défaut (Contributor) | Integration |
| EC-RBAC-05 | Scope JSONB malformée | Validation Zod .strict() rejette, 400 Bad Request | Unit |
| EC-RBAC-06 | Token expiré avec requête en vol | 401 Unauthorized, la requête n'est pas traitée | Integration |

### 7.3 FR-ORCH — Orchestrateur

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-ORCH-01 | Compaction pendant étape critique | Snapshot atomique sauvegardé avant kill | Integration |
| EC-ORCH-02 | Agent crash mid-workflow | Heartbeat manquant >30s → alerte → tentative de relance automatique | Integration |
| EC-ORCH-03 | Workflow modifié pendant exécution | L'agent continue avec la version isolée (snapshot au lancement) | Integration |
| EC-ORCH-04 | Étape sans fichiers obligatoires | Refus de transition, message listant les fichiers manquants | Unit |
| EC-ORCH-05 | Boucle infinie workflow | Détection de cycle (max transitions par étape) + watchdog timeout | Unit + Integration |
| EC-ORCH-06 | Circuit breaker atteint (3 relances) | Alerte humaine, workflow en pause, aucune relance automatique supplémentaire | Integration |

### 7.4 FR-CHAT — Chat Temps Réel

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-CHAT-01 | Message après fin d'exécution agent | Rejeté avec code erreur spécifique (AGENT_NOT_RUNNING) | Integration |
| EC-CHAT-02 | Reconnexion avec messages en vol | Buffer serveur 30s, sync des messages manqués à la reconnexion | E2E |
| EC-CHAT-03 | Flood de messages (>10/min) | Rate limit 429, messages suivants rejetés, compteur reset après 60s | Integration |
| EC-CHAT-04 | Message >100KB | Troncature à 100KB, avertissement à l'utilisateur | Unit |
| EC-CHAT-05 | Contenu XSS dans message | Sanitisé par DOMPurify côté client + UTF-8 strict côté serveur | Unit + E2E |
| EC-CHAT-06 | Déconnexion WebSocket >30s | Messages perdus, notification de perte à la reconnexion | E2E |

### 7.5 FR-CONT — Containerisation

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-CONT-01 | Container timeout | SIGTERM envoyé, si pas d'arrêt en 10s → SIGKILL, container supprimé | Integration |
| EC-CONT-02 | OOM kill (code 137) | Détecté via exit code, suggestion de reprofilage (profil supérieur), audit log | Integration |
| EC-CONT-03 | Path traversal via mount | realpath() résout, symlinks interdits, null bytes bloqués, URL encoding neutralisé | Unit (sécurité) |
| EC-CONT-04 | Credential proxy down | 503, retry (3x), si échec → agent suspendu, alerte admin | Integration |
| EC-CONT-05 | Docker daemon indisponible | Mode dégradé activé, agents en queue, alerte admin | Integration |
| EC-CONT-06 | Épuisement ressources Docker | Limite par company (configurable), file d'attente FIFO, notification utilisateur | Integration |
| EC-CONT-07 | Container escape attempt | Détecté par capabilities monitoring, container tué, audit severity=critical | Security test |

### 7.6 FR-OBS — Observabilité

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-OBS-01 | Tentative UPDATE/DELETE sur audit_events | TRIGGER PostgreSQL bloque, erreur retournée, aucune modification | Integration |
| EC-OBS-02 | Volume d'audit events élevé (>10K/jour) | Partitionnement mensuel maintient les performances de requête | Performance (k6) |
| EC-OBS-03 | Résumé LLM contient des données sensibles | Post-traitement de sanitisation avant stockage et affichage | Unit |
| EC-OBS-04 | Dashboard avec <5 utilisateurs dans un groupe | k-anonymity appliqué : le groupe est masqué ou fusionné | Integration |

### 7.7 FR-DUAL — Dual-Speed

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-DUAL-01 | Contributeur tente de dépasser le plafond Manager | Le curseur est plafonné silencieusement, l'UI affiche le plafond et sa raison | Unit + Integration |
| EC-DUAL-02 | Changement de plafond pendant exécution agent | L'agent en cours n'est pas affecté, le nouveau plafond s'applique au prochain lancement | Integration |

### 7.8 FR-A2A — Agent-to-Agent

| ID | Edge Case | Comportement attendu | Test type |
|----|-----------|---------------------|-----------|
| EC-A2A-01 | Boucle A2A détectée (A→B→A) | Détection de cycle, requête bloquée, audit_event "a2a.cycle_detected" | Unit |
| EC-A2A-02 | Chaîne A2A max (5 requêtes) | 6e requête rejetée, alerte envoyée, audit_event | Unit + Integration |
| EC-A2A-03 | Propriétaire humain ne répond pas (timeout HITL) | Timeout configurable (défaut 1h), requête annulée, notification à l'agent demandeur | Integration |

---

## 8. Récapitulatif Quantitatif

| Dimension | Quantité |
|-----------|----------|
| Templates DoD | 4 niveaux (Story, Epic, Sprint, Release) |
| Critères DoD totaux | 42 (13 Story + 9 Epic + 9 Sprint + 11 Release) |
| Acceptance Criteria (Given/When/Then) | 31 scénarios critiques |
| Epics couverts | 9 (FR-MU, FR-RBAC, FR-ORCH, FR-OBS, FR-CHAT, FR-CONT, FR-DUAL, FR-A2A, FR-ONB) |
| Edge cases documentés | 42 cas |
| NFRs avec ACs testables | 11 (5 perf, 5 sécurité, 2 accessibilité) |
| Quality Gates par phase | 4 phases, 39 critères de sortie |
| Suites de régression | 4 suites cumulatives (50→250 tests) |
| Smoke tests pré-deploy | 7 tests obligatoires |
| Tests sécurité (OWASP) | 12 catégories |

---

---

# PARTIE 6 — Requirements UX par Story

> **Auteur** : Sally (Designer)
> **Direction UX** : Direction C "Adaptive Cockpit" — dark/light adaptatif au persona
> **Sources** : UX Design B2B v1.0, PRD B2B v1.0, Design System Sally v1.0, Component Strategy Amelia v1.0


## 1. Requirements UX par Epic

### Epic FR-MU : Multi-User & Auth

**Ecrans concernes** : Page Membres, Modal Invitation, Company Selector, Page Profil, Header (sign-out)

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-MU-01 Invitation email | Modal invitation : champ email + role selector + message optionnel. Feedback toast apres envoi. Lien d'invitation expire en 7j avec indicateur visuel. | Dialog, Input, Select (RoleSelector), Button, Toast | P0 |
| REQ-MU-02 Page Membres | Table triable/filtrable avec colonnes : Avatar, Nom, Role (Badge couleur), Statut, Date ajout, Actions. Bulk actions via checkboxes. Barre de recherche en haut. Pagination. | DataTable, Badge (role), Checkbox, DropdownMenu, Input (search), Pagination | P0 |
| REQ-MU-03 Invitation bulk | Extension de la modal invitation : zone CSV drag-and-drop ou textarea multi-lignes. Preview du nombre d'invitations avant envoi. Progress bar pendant l'envoi. | Dialog, Textarea, FileUpload (drag-and-drop), Progress, Toast | P1 |
| REQ-MU-04 Company Selector | Dropdown dans le header, immediatement apres le logo. Affiche le nom de la company active + chevron. Liste des companies avec avatar + nom + role badge. Raccourci Ctrl+K "company:". | DropdownMenu, Avatar, Badge, CommandPalette integration | P1 |
| REQ-MU-05 Desactivation signup | Toggle dans Parametres > Company > Securite. Label clair : "Mode invitation uniquement". Confirmation dialog si activation. | Switch, Card (settings), Dialog (confirmation) | P0 |
| REQ-MU-06 Sign-out | Item dans le menu avatar du header. Confirmation optionnelle si agent actif. Redirection vers login. | DropdownMenu, Dialog (si agent actif), redirect | P0 |

**Regles UX transverses FR-MU :**
- Les badges de role utilisent les couleurs RBAC : Admin=rouge `--role-admin`, Manager=bleu `--role-manager`, Contributor=vert `--role-contributor`, Viewer=gris `--role-viewer`
- Le triple encodage est obligatoire pour les roles : couleur + icone + texte (Shield pour Admin, Users pour Manager, User pour Contributor, Eye pour Viewer)
- Les actions destructives (retrait d'un membre) passent par une Dialog de confirmation avec texte explicite

---

### Epic FR-RBAC : Roles & Permissions

**Ecrans concernes** : Matrice Permissions, Role Selector, Navigation Guard, Badges Couleur

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-RBAC-01 4 roles metier | Badge visuel par role dans toute l'interface (table membres, header avatar, sidebar). Icone + couleur + label. | Badge (4 variantes role), Avatar overlay | P0 |
| REQ-RBAC-02 Presets permissions | Matrice visuelle : lignes = permissions (15 cles), colonnes = roles. Checkboxes avec etat herite (grise) vs override (actif). Info tooltip par permission. | Table (matrice), Checkbox, Tooltip, Card | P0 |
| REQ-RBAC-03 Scope JSONB | Invisible en UX directement — impact sur le comportement : les contenus affiches changent selon le scope (filtrage automatique). Pas de message "acces refuse" pour le contenu filtre, simplement absent. | NavigationGuard (composant HOC) | P0 |
| REQ-RBAC-06 Masquage navigation | Items de sidebar absents du DOM (pas grises). Command Palette filtree. Redirect 403 avec message clair et bouton retour. | Sidebar conditionnel, CommandPalette filtree, Page 403 | P1 |
| REQ-RBAC-07 UI admin permissions | Page dediee dans Parametres > Roles & Permissions. Onglets par role. Previsualisation "voir comme ce role". | Tabs, Card, Button "Preview as", PermissionMatrix | P1 |
| REQ-RBAC-08 Badges couleur | 4 variantes visuelles : fond couleur/10%, texte couleur, bordure couleur/20%. Taille sm (20px H) dans les tables, default (24px H) dans les profils. | Badge (custom role variant) | P2 |

**Regles UX transverses FR-RBAC :**
- Principe absolu : **masquage > grisage**. Un Viewer ne voit pas l'item "Workflows" dans la sidebar.
- La page 403 affiche : "Vous n'avez pas acces a cette page. Contactez votre administrateur." avec un bouton "Retour au dashboard".
- Les redirections de liens partages vers pages non-autorisees sont silencieuses (redirect vers la page autorisee la plus proche).

---

### Epic FR-ORCH : Orchestrateur Deterministe

**Ecrans concernes** : Pipeline Workflow, Editeur Workflow, Panneau Drift, Stage Detail

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-ORCH-01 Execution step-by-step | Pipeline visuel horizontal : etapes liees par des connecteurs fleches. Couleurs de statut : gris (a venir), bleu+pulsation (en cours), vert (termine), rouge (erreur), orange (drift). Clic sur etape = panneau detail. | WorkflowPipeline (custom), StageCard (custom), Progress | P0 |
| REQ-ORCH-02 Fichiers obligatoires | Dans le detail d'etape : checklist fichiers requis avec statut vert/rouge. Blocage visuel si fichier manquant (etape non-demarrable, bouton desactive + tooltip explicatif). | Card, Checkbox (read-only), Tooltip, Alert | P0 |
| REQ-ORCH-05 Drift detection | Badge orange + icone AlertTriangle sur l'etape en drift. Toast persistant rouge si critique. Panneau drift : diff visuel "attendu vs observe", severite (Info/Warning/Critical), actions (Ignorer, Recharger, Kill+Relance, Alerter CTO). | DriftAlert (custom), Toast (persistent), Badge, Button (4 actions) | P0 |
| REQ-ORCH-08 Editeur workflow | Interface drag-and-drop : palette d'etapes a gauche, canvas central, panneau proprietes a droite. Chaque etape configurable : nom, prompt, fichiers obligatoires, conditions de transition. Preview du pipeline final en bas. | WorkflowEditor (custom), DnD (drag-and-drop), Input, Textarea, Select, Card | P1 |
| REQ-ORCH-09 Validation humaine | Bouton "Valider" visible dans la barre de statut quand une etape requiert validation. Notification push. Dialog de review avec resume de l'etape + diff des changements. | Dialog (review), Button, Toast (notification), Badge (attente validation) | P0 |

**Regles UX transverses FR-ORCH :**
- Le pipeline est toujours visible en barre de statut quand un workflow est actif
- Les animations de pulsation sur l'etape active durent 2000ms en boucle (ease-in-out)
- Respect de `prefers-reduced-motion` : pulsation remplacee par un indicateur statique "En cours"
- Le bouton Stop est TOUJOURS visible et accessible en < 1 seconde

---

### Epic FR-OBS : Observabilite & Audit

**Ecrans concernes** : Dashboard CEO, Dashboard CTO, Audit Log, Timeline Agent

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-OBS-01 Resume LLM | Panneau lateral droit "Activite Agent" : resume en langage naturel de la derniere action, mis a jour en temps reel (<5s). Texte court (2-3 phrases), lien "Voir details". | Card (agent-variant), Badge (sante), Timeline | P1 |
| REQ-OBS-02 Audit log | Page Audit : table filtrable par date, utilisateur, type d'action, workflow, severite. Export CSV/JSON. Pagination server-side. Tri par date descendant par defaut. | DataTable (sortable, filterable), DateRangePicker, Select (filtres), Button (export), Pagination | P0 |
| REQ-OBS-03 Dashboards agreges | Dashboard CEO : 4-6 cartes KPI (agents actifs, taux workflow, drifts, avancement BU). Graphiques bar/line pour tendances. Dashboard CTO : graphe drift temps reel, sante containers, metriques compaction. JAMAIS de donnees individuelles. | Card (KPI), Chart (bar, line), Badge, MetricWidget (custom) | P1 |
| REQ-OBS-05 Export audit | Boutons "Exporter CSV" et "Exporter JSON" dans la page Audit. Dialog de confirmation avec filtres appliques resumes. Progress bar pendant l'export. | Button, Dialog, Progress, Toast (succes) | P1 |

**Regles UX transverses FR-OBS :**
- Les dashboards management ne montrent JAMAIS de donnees individuelles (Verite #20). Le drill-down s'arrete au niveau equipe.
- Les metriques sont agregees : "3 agents actifs", "12 stories en cours", pas "Alice a 2 stories, Bob en a 1".
- Le dashboard personnel (mon activite) est prive et visible uniquement par l'utilisateur lui-meme.

---

### Epic FR-ONB : Onboarding Cascade

**Ecrans concernes** : Chat Onboarding, Organigramme, Import Progress, Setup Wizard

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-ONB-01 Onboarding CEO | Interface chat plein ecran, epuree. Agent pose des questions structurees (5-7 max). Chaque reponse genere un element visuel (BU, equipe, role). Barre de progression en haut. | ChatPanel (variant onboarding), Progress, Card | P1 |
| REQ-ONB-02 Cascade hierarchique | Organigramme interactif : arbre hierarchique avec drag-and-drop. Noeuds = roles avec avatar + nom + badge role. Bouton "Inviter" sur chaque noeud vide. Emails d'invitation pre-remplis avec contexte du perimetre. | OrgChart (custom), Avatar, Badge, Button, Dialog (invitation) | P1 |
| REQ-ONB-03 Import Jira | Wizard 4 etapes : 1) Connexion API, 2) Selection projets, 3) Mapping champs, 4) Confirmation + lancement. Progress bar avec estimation temps. Resume post-import avec compteurs (X projets, Y stories importes). | Stepper (custom), Form, Select, Progress, Card (resume) | P2 |
| REQ-ONB-04 Dual-mode config | Selecteur mode en haut du wizard : "Conversationnel" (chat) vs "Formulaire" (classique). Le CEO prefere le chat, le CTO prefere le formulaire. Contenu identique, format different. | Tabs (2 modes), ChatPanel ou Form selon le mode | P2 |

---

### Epic FR-DUAL : Dual-Speed Workflow

**Ecrans concernes** : Panneau Curseur, Preferences, Parametres Projet, Parametres Company

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-DUAL-01 Curseur 3 positions | Slider segmente 3 positions : Manuel (gris), Assiste (bleu), Automatique (vert). Label et description sous chaque position. Animation douce lors du changement. | Slider (3-segment custom), Label, Card | P1 |
| REQ-DUAL-02 Granularite 4 niveaux | Interface hierarchique : onglets Entreprise > Projet > Agent > Action. Chaque niveau affiche son curseur. Les niveaux superieurs imposent un plafond visible (zone grisee non-cliquable). | Tabs, Slider, Card, Alert (plafond actif) | P1 |
| REQ-DUAL-03 Plafond hierarchique | Zone grisee sur le slider au-dela du plafond impose. Tooltip : "Limite par [role] : maximum [position]". Icone cadenas sur la zone bloquee. | Slider (avec zone disabled), Tooltip, Lock icon | P1 |

---

### Epic FR-CHAT : Chat Temps Reel

**Ecrans concernes** : Chat Panel, Split View Code+Chat, Chat Onboarding

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-CHAT-01 WebSocket bidirectionnel | Panneau chat 320px a droite. Bulles : humain a droite (bleu), agent a gauche (violet `--agent`). Indicateur de frappe. Timestamps sur hover. | ChatPanel (custom), MessageBubble (custom), TypingIndicator (custom) | P0 |
| REQ-CHAT-02 Dialogue pendant execution | Chat integre dans la split view : code a gauche, chat a droite. Les messages de l'agent incluent des liens vers les fichiers modifies. Boutons d'action rapide : Stop, Rollback, Continuer. | SplitView layout, ChatPanel, Button (Stop/Rollback), FileLink | P0 |
| REQ-CHAT-03 Reconnexion WebSocket | Indicateur connexion dans le header du chat : vert (connecte), orange (reconnexion...), rouge (deconnecte). Message "Reconnexion en cours..." si deconnexion. Sync messages manques. | ConnectionStatus (custom), Badge, Toast (reconnexion) | P1 |
| REQ-CHAT-04 Chat read-only viewer | Meme interface mais sans champ de saisie. Badge "Lecture seule" en bas du panneau. | ChatPanel (variant readonly), Badge | P1 |

---

### Epic FR-CONT : Containerisation

**Ecrans concernes** : Container Status, Resource Monitor, Config Credential Proxy

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-CONT-01 Container Docker | Indicateur dans la barre de statut : icone Container + statut (Starting, Running, Stopped). Clic ouvre le panneau detail : ID, image, uptime, resources. | Badge (container status), Card (detail), MetricWidget | P0 |
| REQ-CONT-02 Credential proxy | Page Parametres > Securite > Credentials. Table des regles de proxy. Chaque regle : service + methode d'injection + statut. Actions : editer, desactiver, supprimer. | DataTable, Badge, DropdownMenu, Dialog (edition) | P0 |
| REQ-CONT-06 Resource limits | Graphiques temps reel dans le panneau container : CPU (jauge), RAM (jauge), Disk (barre). Seuils visuels : vert (<70%), orange (70-90%), rouge (>90%). | Progress (gauge variant), Card, Badge (seuil) | P1 |

---

## 2. Wireframes textuels des ecrans principaux

### 2.1 Dashboard CEO (Light mode, aere)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K Rechercher...]  |  [?] [3] [Avatar v]    |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  DASHBOARD EXECUTIF                                  |
|                     |                                                      |
|                     |  +----------+ +----------+ +----------+ +----------+ |
|                     |  | Agents   | | Workflows| | Drifts   | | Stories  | |
|                     |  | actifs   | | en cours | | actifs   | | livrees  | |
|                     |  |    12    | |     8    | |     2    | |    47    | |
|                     |  | +15% ^   | | stable   | | -1 v     | | +23% ^   | |
|                     |  +----------+ +----------+ +----------+ +----------+ |
|                     |                                                      |
|                     |  +--- Avancement par BU ----------------------------+|
|                     |  | BU France      ████████████░░░░  78%             ||
|                     |  | BU USA         ██████████░░░░░░  64%             ||
|                     |  | BU Allemagne   ████████░░░░░░░░  52%             ||
|                     |  +-----------------------------------------------------+|
|                     |                                                      |
|                     |  +--- Alertes recentes ---+  +--- Chat executif ---+|
|                     |  | [!] Drift Agent-12     |  | > Ou en est Alpha? ||
|                     |  |     Pipeline Review     |  |                    ||
|                     |  |     il y a 5 min        |  | Le projet Alpha est||
|                     |  | [i] Nouvel agent actif |  | a 78% avec 2 drifts||
|                     |  |     BU France           |  | mineurs resolus... ||
|  [ico] Preferences  |  +------------------------+  +--------------------+|
+============================================================================+
|  Workflow: --  |  Agents: 12 actifs  |  Sante: OK  |  Derniere MAJ: 14:32 |
+============================================================================+
```

### 2.2 Dashboard CTO (Dark mode, dense)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [5!] [Avatar v]             |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  MONITORING TECHNIQUE                                |
|  [ico] Workflows    |                                                      |
|  [ico] Agents       |  +--- Drift Detection ----+  +--- Sante Agents ---+|
|  [ico] Membres      |  | Drifts actifs: 2       |  | alice-dev   [OK]   ||
|  [ico] Audit        |  | ████░░ Agent-12 WARNING |  | bob-test    [OK]   ||
|  [ico] Parametres   |  | ██░░░░ Agent-07 INFO    |  | carol-rev   [WARN] ||
|                     |  | Resolution moy: 4min   |  | dave-onb    [IDLE] ||
|                     |  +------------------------+  +--------------------+|
|                     |                                                      |
|                     |  +--- Containers ----------+  +--- Compaction -----+|
|                     |  | Actifs: 8/12            |  | Sessions: 24       ||
|                     |  | CPU moy: 34%            |  | Compactions: 3     ||
|                     |  | RAM moy: 1.2GB          |  | Survie: 92%        ||
|                     |  | Disk: 45GB/100GB        |  | Reinjection: 88%   ||
|                     |  +------------------------+  +--------------------+|
|                     |                                                      |
|                     |  +--- Workflows actifs --------------------------------+|
|                     |  | Dev Story  [Brief]->[Code]->[Review]->[Test]->[Merge]||
|                     |  |            done    ACTIVE   pending   pend    pend   ||
|                     |  | Hotfix     [Triage]->[Fix]->[Test]->[Deploy]        ||
|                     |  |            done      done   ACTIVE   pending         ||
|                     |  +-----------------------------------------------------+|
|  [ico] Preferences  |                                                      |
+============================================================================+
|  Drifts: 2  |  Containers: 8/12  |  CPU: 34%  |  WebSocket: connecte       |
+============================================================================+
```

### 2.3 Board Dev (Dark mode, focus code)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [1] [Avatar v]              |
+============================================================================+
|  [ico] Mon Board    |                                                      |
|  [ico] Projets    > |  MON BOARD                    [Filtrer v] [+ Story]  |
|  [ico] Mes Agents   |                                                      |
|  [ico] Chat         |  +--- A Faire ---+  +--- En Cours ---+  +- Review -+|
|                     |  |               |  |                 |  |          ||
|                     |  | +-- US-156 --+|  | +-- US-142 ---+|  | US-138   ||
|                     |  | | Filtre date||  | | Filtre rech. ||  | [badge]  ||
|                     |  | | [P1] [Dev] ||  | | [P0] [Dev]   ||  | Lead rev.||
|                     |  | | Est: 3pts  ||  | | Agent: actif ||  |          ||
|                     |  | +------------+|  | | [Stop][Chat] ||  +----------+|
|                     |  |               |  | +--------------+|  |          ||
|                     |  | +-- BUG-23 --+|  |                 |  |          ||
|                     |  | | Login iOS  ||  |                 |  |          ||
|                     |  | | [URGENT]   ||  |                 |  |          ||
|                     |  | +------------+|  |                 |  |          ||
|                     |  +---------------+  +-----------------+  +----------+|
|                     |                                                      |
|  [ico] Preferences  |  Burndown: ████████░░░░ 67% sprint                   |
+============================================================================+
|  Story: US-142  |  Workflow: Dev Story 2/5  |  Agent: alice [OK]  | 12:34  |
+============================================================================+
```

### 2.4 Split View Dev : Code + Chat Agent

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [1] [Avatar v]              |
+============================================================================+
|  Pipeline: [Brief OK]->[Code ACTIVE]->[Review]->[Test]->[Merge]            |
+============================================================================+
|                                        |                                   |
|  src/services/search.ts               |  CHAT — Agent Alice                |
|  ====================================  |  ================================|
|  1  import { db } from '../db';       |  [alice] Plan propose:             |
|  2  import { SearchQuery }...         |  1. Ajout index PostgreSQL         |
|  3                                     |  2. Modification SearchService    |
|  4  export class SearchService {      |  3. Tests unitaires               |
|  5    async search(query: SearchQuery)|  4. Tests integration             |
|  6+     const results = await db      |                                   |
|  7+       .select()                   |  [vous] Utilise le pattern         |
|  8+       .from(issues)               |  Repository au lieu de l'acces    |
|  9+       .where(                     |  direct a db.                     |
| 10+         ilike(issues.title,       |                                   |
| 11+           `%${query.term}%`)      |  [alice] Compris. Je refactore    |
| 12+       )                           |  avec Repository pattern.         |
| 13+       .limit(query.limit ?? 20); |  Fichiers modifies:               |
| 14      return results;               |  - src/repos/search-repo.ts [NEW] |
| 15    }                               |  - src/services/search.ts [MOD]   |
| 16  }                                 |                                   |
|                                        |  > ______________________________ |
|  +3 fichiers modifies  [Voir diff]    |  [Envoyer]  [Stop] [Rollback]     |
+============================================================================+
|  Story: US-142  |  Etape: 2/5 Code  |  Agent: alice [OK]  |  Timer: 12:34 |
+============================================================================+
```

### 2.5 Page Membres (Admin)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [0] [Avatar v]              |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  MEMBRES                          [+ Inviter]       |
|  [ico] Workflows    |                                                      |
|  [ico] Agents       |  [Rechercher...]  [Role: Tous v]  [Statut: Tous v]  |
|  [ico] Membres  <<  |                                                      |
|  [ico] Audit        |  +======================================================+|
|  [ico] Parametres   |  | [ ] | Membre          | Role          | Statut   ||
|                     |  |-----|-----------------|---------------|----------||
|                     |  | [ ] | Marc Dupont     | [A] Admin     | Actif    ||
|                     |  | [ ] | Sophie Lemaire  | [M] Manager   | Actif    ||
|                     |  | [ ] | Alice Torres    | [C] Contributor| Actif   ||
|                     |  | [ ] | Bob Martin      | [C] Contributor| Actif   ||
|                     |  | [ ] | Claude Petit    | [V] Viewer    | Invite   ||
|                     |  +======================================================+|
|                     |  5 membres  |  2 invitations en attente  [< 1/1 >]  |
|                     |                                                      |
|  [ico] Preferences  |  Actions en lot: [Changer role v] [Retirer]          |
+============================================================================+
```

### 2.6 Editeur Workflow (CTO)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [0] [Avatar v]              |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Workflows << |  EDITEUR WORKFLOW : Dev Story Pipeline               |
|                     |                                                      |
|  +-- Palette --+    |  +--- Canvas (drag-and-drop) ----+  +-- Props ---+  |
|  |             |    |  |                                |  |            |  |
|  | [Brief]     |    |  | [Brief]--->[Code]--->[Review]  |  | Etape:    |  |
|  | [Code]      |    |  |                  |              |  | Code      |  |
|  | [Review]    |    |  |                  v              |  |           |  |
|  | [Test]      |    |  |              [Test]--->[Merge]  |  | Prompt:   |  |
|  | [Deploy]    |    |  |                                |  | [........]|  |
|  | [Custom...] |    |  |                                |  |           |  |
|  |             |    |  |                                |  | Fichiers: |  |
|  +-------------+    |  |                                |  | [x] spec  |  |
|                     |  |                                |  | [x] tests |  |
|                     |  +--------------------------------+  |           |  |
|                     |                                      | Transition|  |
|                     |  Preview: [Brief]->[Code]->[Review]  | [Auto v]  |  |
|                     |           ->[Test]->[Merge]           +----------+  |
+============================================================================+
|  Template: Dev Story  |  5 etapes  |  Modifie il y a 2 min  | [Sauvegarder]|
+============================================================================+
```

### 2.7 Curseur d'Automatisation (Preferences)

```
+============================================================================+
|  PREFERENCES > Curseur d'automatisation                                    |
+============================================================================+
|                                                                            |
|  +--- Niveau Entreprise (defini par Admin) ---+                            |
|  | Plafond global : ASSISTE maximum                                       |
|  | [MANUEL]=====[ASSISTE]xxxxx[AUTO]                                      |
|  |                       ^--- bloque par Admin                            |
|  +-----------------------------------------------------+                  |
|                                                                            |
|  +--- Niveau Projet : Alpha ---+  +--- Niveau Projet : Beta ---+          |
|  | [MANUEL]===[ASSISTE]xxx[AUTO]|  | [MANUEL]=======[ASSISTE]xxx|          |
|  | Limite: ASSISTE              |  | Limite: ASSISTE            |          |
|  +------------------------------+  +----------------------------+          |
|                                                                            |
|  +--- Niveau Agent : alice-dev ---+                                        |
|  | [MANUEL]=====[ASSISTE]                                                 |
|  | Position actuelle: ASSISTE                                             |
|  +-----------------------------------------------------+                  |
|                                                                            |
|  +--- Niveau Action ---------+                                             |
|  | Tests unitaires : [AUTO]  | <- en dessous du plafond                   |
|  | Code review : [ASSISTE]   |                                             |
|  | Architecture : [MANUEL]   | <- choix personnel                         |
|  +----------------------------+                                            |
|                                                                            |
|  Legende:  ===== accessible   xxxxx bloque par hierarchie                  |
|            [cadenas] limite imposee par un niveau superieur                |
+============================================================================+
```

---

## 3. Components shadcn/ui par story

### 3.1 Composants existants shadcn/ui utilises

| Composant | Stories qui l'utilisent |
|-----------|----------------------|
| **Button** | Toutes les stories (actions primaires, secondaires, destructives) |
| **Card** | FR-OBS dashboards, FR-ORCH stage detail, FR-ONB wizard, FR-DUAL curseur |
| **Dialog** | FR-MU invitation, FR-RBAC confirmation, FR-ORCH review, FR-CONT config |
| **Input** | FR-MU recherche, FR-CHAT saisie message, FR-ONB formulaires |
| **Select** | FR-MU role selector, FR-RBAC filtres, FR-ORCH transition config |
| **Badge** | FR-RBAC roles, FR-ORCH statuts workflow, FR-CONT container status |
| **Toast** | FR-MU feedback invitation, FR-ORCH drift alerte, FR-CHAT reconnexion |
| **DropdownMenu** | FR-MU company selector, FR-MU actions membre, FR-ORCH actions drift |
| **Tabs** | FR-RBAC onglets roles, FR-DUAL niveaux curseur, FR-ONB mode config |
| **Tooltip** | FR-RBAC info permission, FR-DUAL plafond hierarchique, FR-ORCH fichiers |

### 3.2 Composants shadcn/ui a ajouter

| Composant | Stories | Raison |
|-----------|---------|--------|
| **DataTable** | FR-MU-02 Page Membres, FR-OBS-02 Audit Log | Tables triables/filtrables avec pagination |
| **Switch** | FR-MU-05 Toggle invitation-only | On/off binaire |
| **Progress** | FR-ONB-03 Import, FR-CONT-06 Resources | Barres de progression |
| **Slider** | FR-DUAL-01 Curseur automatisation | Slider 3 positions segmente |
| **Alert** | FR-ORCH-02 Fichiers manquants, FR-DUAL-03 Plafond | Messages d'alerte contextuels |
| **Form** | FR-ONB config, FR-CONT-02 Credential proxy | Validation avec React Hook Form + Zod |
| **Accordion** | FR-OBS audit detail, FR-ORCH etape detail | Contenu expandable |
| **Sheet** | FR-CHAT panneau lateral, FR-OBS resume agent | Panneau lateral glissant |
| **HoverCard** | FR-MU profil membre hover, FR-ORCH agent info | Preview au survol |
| **NavigationMenu** | Sidebar evolution | Navigation structuree |

### 3.3 Composants custom a creer

| Composant | Epic | Description | Complexite |
|-----------|------|-------------|-----------|
| **WorkflowPipeline** | FR-ORCH | Pipeline horizontal, etapes connectees, statuts colores, pulsation | L |
| **StageCard** | FR-ORCH | Carte d'etape workflow avec statut, fichiers, timer | M |
| **DriftAlert** | FR-ORCH | Panneau drift : diff, severite, actions | L |
| **WorkflowEditor** | FR-ORCH | Editeur drag-and-drop de pipeline | XL |
| **ChatPanel** | FR-CHAT | Panneau chat avec bulles, typing, connexion | L |
| **MessageBubble** | FR-CHAT | Bulle de message humain/agent avec timestamp | S |
| **TypingIndicator** | FR-CHAT | Animation 3 points "en train d'ecrire" | S |
| **ConnectionStatus** | FR-CHAT | Indicateur WebSocket vert/orange/rouge | S |
| **AutomationCursor** | FR-DUAL | Slider 3 positions segmente avec zone bloquee | M |
| **OrgChart** | FR-ONB | Arbre hierarchique interactif drag-and-drop | L |
| **MetricWidget** | FR-OBS | Widget KPI : valeur, tendance, comparaison | M |
| **ContainerStatus** | FR-CONT | Badge + detail container avec resources | M |
| **NavigationGuard** | FR-RBAC | HOC de protection de route par permission | S |

---

## 4. UX Flows critiques

### 4.1 Flow Onboarding CEO

```
[1] Email invitation         [2] Clic lien             [3] Compte cree
    "Bienvenue sur MnM"          /onboarding               Redirect: /onboarding/chat
         |                           |                           |
         v                           v                           v
[4] Chat conversationnel     [5] Organigramme genere    [6] Validation drag-drop
    5-7 echanges max              Arbre visuel               Ajuster les noeuds
    "Decrivez votre                interactif
     entreprise"                      |                           |
                                      v                           v
                              [7] Invitations cascade    [8] Dashboard J+2
                                  Emails pre-remplis          KPIs agreges
                                  par perimetre               Chat strategique

    Emotion: Scepticisme -> Curiosite -> Surprise -> Confiance -> Satisfaction
    Metriques: Time-to-structure < 15 min, Completion > 70%
```

**Points UX critiques :**
- Ecran de chat epure : fond blanc, pas de sidebar, focus total sur la conversation
- Chaque reponse genere immediatement un element visuel (feedback instantane)
- Barre de progression discretement visible en haut (3/7 echanges)
- Bouton "Passer" toujours visible pour sauter les etapes optionnelles
- Animation douce lors de la generation de l'organigramme (200ms fade-in par noeud)

### 4.2 Flow Config CTO

```
[1] Acceptation invite       [2] Dashboard technique    [3] Config SSO
    Perimetre pre-configure       Vue monitoring              SAML/OIDC wizard
         |                           |                           |
         v                           v                           v
[4] Creation workflow        [5] Test simule            [6] Config drift
    Editeur drag-and-drop         Execution dry-run          Curseur sensibilite
         |                           |                           |
         v                           v                           v
[7] Monitoring quotidien     [8] Intervention drift
    Dashboard temps reel          Diff attendu vs observe
    Sante containers              Actions: recharger/kill/ignorer

    Emotion: Mefiance -> Verification -> Flow -> Maitrise -> Serenite
    Metriques: Config SSO < 30 min, Premier workflow < 1h
```

**Points UX critiques :**
- Le CTO arrive sur un dashboard pre-rempli avec des donnees de demo (pas un ecran vide)
- Le wizard SSO inclut un bouton "Tester la connexion" a chaque etape
- L'editeur de workflow supporte le clavier (Tab pour naviguer, Enter pour editer, Escape pour annuler)
- Le monitoring drift affiche des metriques en temps reel sans refresh (WebSocket)

### 4.3 Flow Quotidien Dev

```
[1] Ouverture MnM            [2] Board personnel        [3] Selection story
    Login ou session active       Stories triees par          Contexte complet:
    Redirect: /board              priorite                   specs, maquettes,
         |                           |                       fichiers concernes
         v                           v                           |
[4] Lancement agent          [5] Split view live         [6] Pilotage chat
    "Lancer l'agent"              Code gauche                "Utilise pattern X"
    Workflow demarre              Chat droite                 Agent s'adapte
         |                        Diff en surbrillance           |
         v                           |                           v
[7] Review code              [8] Merge 1 clic
    Diff avec annotations         MR automatique
    Tests generes                 Audit log
    Metriques couverture          Story -> Done

    Emotion: Scepticisme -> Focus -> Fascination -> Controle -> Accomplissement
    Metriques: Time-to-first-agent < 30 min, Interruption reussie 100%
```

**Points UX critiques :**
- Le board est la page par defaut du dev (pas le dashboard)
- La story affiche le contexte complet sans navigation supplementaire
- Le bouton "Lancer l'agent" est proEminent (Button primary, taille lg)
- Le split view se redimensionne avec un drag handle central
- Les boutons Stop et Rollback sont TOUJOURS visibles dans la barre de statut et le chat

### 4.4 Flow Workflow PO

```
[1] Board Sprint             [2] Reception epic         [3] Chat decomposition
    Vue Kanban                    Epic complete:              "Decompose cette epic"
    Stories par colonne           analyse, maquettes,         Agent propose 5-8
    DoR indicators                contraintes                 stories structurees
         |                           |                           |
         v                           v                           v
[4] Affinage stories         [5] Validation DoR         [6] Suivi sprint
    Kanban drag-and-drop          Checklist auto              Dashboard augmente
    Edition inline                vert/rouge par critere      Burndown agent
    Validation 1 clic             [Forcer avec justif.]       Stories en cours

    Emotion: Routine -> Efficacite -> Confiance -> Maitrise
    Metriques: Time-to-DoR < 5 min, Stories par epic > 5
```

**Points UX critiques :**
- La checklist DoR utilise des checkmarks vert/rouge avec labels explicites
- Le bouton "Forcer avec justification" est present mais secondaire (ghost variant)
- Le chat de decomposition affiche les stories generees sous forme de cartes draggables
- L'edition inline sur le board utilise le double-clic (pattern Notion/Linear)

---

## 5. Curseur d'automatisation — Implementation progressive

### 5.1 Sprint 0 : Fondation

- **Composant AutomationCursor** : Slider 3 positions statique (Manuel/Assiste/Auto)
- **Design** : Slider segmente avec 3 zones colorees (gris, bleu, vert)
- **Interaction** : Clic sur une position, pas de drag continu
- **Scope** : Niveau utilisateur uniquement (preferences personnelles)
- **Pas encore** : hierarchie, plafonds, granularite

### 5.2 Phase 1 : Integration basique

- **Ajout dans les preferences** : Section "Mon curseur d'automatisation"
- **Persistance** : Table `automation_cursors` avec userId + position
- **Impact UX** : Affecte l'affichage des suggestions agent (Manuel = pas de suggestions, Assiste = suggestions visibles, Auto = execution directe)
- **Feedback** : Toast "Curseur mis a jour" + changement visuel immediat

### 5.3 Phase 2 : Granularite et hierarchie

- **4 niveaux** : Entreprise > Projet > Agent > Action (onglets)
- **Plafond** : Zone grisee avec cadenas et tooltip explicatif
- **Heritage** : Le niveau inferieur herite du superieur par defaut (overridable dans la limite)
- **UI admin** : Le CTO/CEO voit et configure les plafonds dans Parametres > Company

### 5.4 Phase 3+ : Intelligence et recommandation

- **Recommandation** : Basee sur l'historique — "Vous validez systematiquement les tests generes. Passer en Auto ?"
- **Notification non-intrusive** : Badge discret sur le curseur, pas de popup
- **Analytics** : Evolution du curseur dans le temps (graphique dans le dashboard personnel)

---

## 6. Design tokens et variantes par persona/mode

### 6.1 Tokens par mode (Direction C "Adaptive Cockpit")

| Token | Mode Management (Light) | Mode Technique (Dark) |
|-------|------------------------|----------------------|
| `--background` | `oklch(1 0 0)` — blanc | `oklch(0.145 0 0)` — noir bleu |
| `--foreground` | `oklch(0.145 0 0)` — noir | `oklch(0.985 0 0)` — blanc |
| `--card` | `oklch(1 0 0)` — blanc | `oklch(0.205 0 0)` — gris fonce |
| `--muted` | `oklch(0.965 0 0)` — gris clair | `oklch(0.269 0 0)` — gris moyen |
| `--border` | `oklch(0.922 0 0)` — gris bordure | `oklch(0.371 0 0)` — gris bordure dark |
| `--primary` | `oklch(0.55 0.15 255)` — bleu MnM | `oklch(0.65 0.15 255)` — bleu clair |
| `--agent` | `oklch(0.55 0.15 290)` — violet | `oklch(0.65 0.15 290)` — violet clair |

### 6.2 Variantes par persona

| Persona | Mode par defaut | Densite | Sidebar | Contenu prioritaire |
|---------|----------------|---------|---------|-------------------|
| **CEO** | Light | Aere (gap 24px) | Minimale (2-3 items) | Cartes KPI, chat |
| **CTO** | Dark | Dense (gap 12px) | Complete (7+ items) | Graphiques, metriques |
| **Dev** | Dark | Dense (gap 12px) | Moyenne (4-5 items) | Code, chat agent |
| **PO** | Light | Moyen (gap 16px) | Moyenne (4-5 items) | Kanban, chat |
| **PM** | Light | Moyen (gap 16px) | Moyenne (4-5 items) | Brainstorm, roadmap |
| **Lead Tech** | Dark | Dense (gap 12px) | Complete (7+ items) | Reviews, dette tech |
| **QA** | Dark | Dense (gap 12px) | Moyenne (4-5 items) | Tests, couverture |

### 6.3 Tokens par mode d'interaction (5 modes)

| Mode | Fond dominant | Composants cles | Densité |
|------|--------------|-----------------|---------|
| **ORAL** | Light, epure | ChatPanel (plein ecran), MessageBubble | Minimale |
| **VISUEL** | Dark, graphiques | MetricWidget, Chart, DashboardCard | Dense |
| **CODE** | Dark, monospace | Editor, Terminal, SplitView, DiffViewer | Maximale |
| **BOARD** | Light ou dark | Kanban, StoryCard, Burndown | Moyenne |
| **TEST** | Dark | TestSuite, CoverageReport, BugList | Dense |

### 6.4 Mapping mode par defaut -> persona

```
CEO   -> ORAL + VISUEL (light)
CTO   -> VISUEL + CODE (dark)
Dev   -> CODE + BOARD (dark)
PO    -> BOARD + ORAL (light)
PM    -> ORAL + BOARD (light)
Lead  -> CODE + VISUEL + BOARD (dark)
QA    -> TEST + CODE (dark)
DPO   -> BOARD + VISUEL (light)
DSI   -> VISUEL + ORAL (light)
```

L'utilisateur peut toujours override : switch dark/light dans le header, activation/desactivation de modes dans les preferences.

---

## 7. Accessibility requirements par story (WCAG 2.1 AA)

### 7.1 Requirements transverses (toutes les stories)

| Critere WCAG | Exigence | Implementation |
|-------------|----------|----------------|
| 1.1.1 Non-text Content | Toutes les icones ont un `aria-label` | Lucide icons + aria-label |
| 1.3.1 Info and Relationships | Structure semantique : headings, landmarks, tables | HTML5 semantique + aria-landmarks |
| 1.4.3 Contrast Minimum | 4.5:1 texte normal, 3:1 grand texte | Design tokens valides axe-core |
| 1.4.11 Non-text Contrast | 3:1 pour composants UI et graphiques | Bordures et focus visible |
| 2.1.1 Keyboard | Navigation complete au clavier | Tab, Shift+Tab, Enter, Escape, fleches |
| 2.4.3 Focus Order | Ordre de focus logique | tabindex naturel, pas de tabindex > 0 |
| 2.4.7 Focus Visible | Outline 2px `--ring` sur tous les elements | `focus-visible:ring-2` Tailwind |
| 4.1.2 Name Role Value | Composants ARIA complets | Radix UI (base shadcn/ui) |

### 7.2 Requirements specifiques par epic

#### FR-MU : Multi-User
- **Table Membres** : `role="table"`, headers avec `scope="col"`, tri annonce par `aria-sort`
- **Modal Invitation** : focus trap, `aria-modal="true"`, Escape ferme la modale
- **Company Selector** : `role="listbox"`, `aria-activedescendant` pour la selection

#### FR-RBAC : Permissions
- **Matrice Permissions** : `role="grid"`, navigation fleches, `aria-checked` sur checkboxes
- **Badges Role** : `aria-label` descriptif ("Role: Admin"), pas seulement la couleur
- **Page 403** : `role="alert"`, lien de retour focusable, message explicite

#### FR-ORCH : Orchestrateur
- **Pipeline Workflow** : `role="progressbar"`, `aria-valuenow` pour l'etape active, `aria-valuemax` pour le total
- **Drift Alert** : `role="alert"`, `aria-live="assertive"` pour les alertes critiques
- **Pulsation etape** : Respecte `prefers-reduced-motion` — remplacee par indicateur statique

#### FR-OBS : Observabilite
- **Dashboard KPIs** : Chaque carte a un `aria-label` descriptif ("Agents actifs : 12, hausse de 15%")
- **Graphiques** : Alternative textuelle avec les donnees cles, pas juste une image
- **Audit Log** : Table avec pagination annoncee (`aria-live="polite"` sur le compteur)

#### FR-CHAT : Chat Temps Reel
- **Messages** : `role="log"`, `aria-live="polite"` pour les nouveaux messages
- **Indicateur frappe** : `aria-label="L'agent est en train d'ecrire"`, pas seulement l'animation
- **Connexion WebSocket** : `aria-live="assertive"` pour les changements de statut connexion
- **Chat read-only** : `aria-readonly="true"`, message explicite pour les screen readers

#### FR-DUAL : Curseur Automatisation
- **Slider** : `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext` ("Position : Assiste")
- **Zone bloquee** : `aria-disabled="true"` + `aria-describedby` expliquant le plafond
- **Niveaux** : Tabpanel avec `aria-labelledby` pour chaque onglet

#### FR-ONB : Onboarding
- **Chat** : Meme accessibilite que FR-CHAT
- **Organigramme** : `role="tree"`, `aria-expanded` sur les noeuds, navigation fleches
- **Progress** : `role="progressbar"` avec `aria-valuenow`

#### FR-CONT : Containerisation
- **Jauges CPU/RAM** : `role="meter"`, `aria-valuenow`, `aria-valuetext` ("CPU : 34%, normal")
- **Statut container** : Triple encodage obligatoire (couleur + icone + texte)

### 7.3 Tests accessibilite prevus

| Test | Outil | Frequence | Critere de succes |
|------|-------|-----------|-------------------|
| Audit automatise | axe-core dans CI | Chaque PR | 0 erreur critique |
| Score Lighthouse | Lighthouse CI | Chaque PR | Accessibility >= 90 |
| Navigation clavier | Manuel (QA) | Chaque sprint | Tous les flows navigables sans souris |
| Screen reader | NVDA / VoiceOver | Chaque phase | 7 smoke tests annonces correctement |
| Contraste | axe-core + manuel | Chaque PR | 4.5:1 texte, 3:1 UI |
| Motion | `prefers-reduced-motion` | Chaque sprint | Animations desactivees proprement |

---

## 8. Mapping stories vers pages/ecrans

### 8.1 Vue synthetique

| Page/Ecran | URL | Stories concernees | Persona primaire |
|-----------|-----|-------------------|-----------------|
| **Dashboard Executif** | `/dashboard` | REQ-OBS-03 | CEO, DSI |
| **Dashboard Technique** | `/dashboard` (variant CTO) | REQ-OBS-03, REQ-CONT-06 | CTO, Lead Tech |
| **Page Membres** | `/settings/members` | REQ-MU-02, REQ-MU-03, REQ-RBAC-08 | Admin |
| **Matrice Permissions** | `/settings/roles` | REQ-RBAC-02, REQ-RBAC-07 | Admin |
| **Board Personnel** | `/board` | REQ-CHAT-02 (context) | Dev, PO |
| **Detail Story** | `/projects/:id/stories/:id` | REQ-CHAT-02, REQ-ORCH-01 | Dev, PO |
| **Split View Code+Chat** | `/projects/:id/stories/:id/agent` | REQ-CHAT-01, REQ-CHAT-02, REQ-ORCH-01 | Dev |
| **Editeur Workflow** | `/workflows/:id/edit` | REQ-ORCH-08 | CTO |
| **Pipeline Workflow** | `/workflows/:id` | REQ-ORCH-01, REQ-ORCH-02, REQ-ORCH-05 | CTO, Dev |
| **Audit Log** | `/audit` | REQ-OBS-02, REQ-OBS-05 | Admin, CTO |
| **Chat Onboarding** | `/onboarding/chat` | REQ-ONB-01 | CEO |
| **Organigramme** | `/onboarding/org` | REQ-ONB-02 | CEO |
| **Import Wizard** | `/onboarding/import` | REQ-ONB-03 | CTO, Admin |
| **Preferences** | `/settings/preferences` | REQ-DUAL-01, REQ-DUAL-02 | Tous |
| **Config SSO** | `/settings/security/sso` | PRD 4.2 etape 2 | CTO, Admin |
| **Config Credentials** | `/settings/security/credentials` | REQ-CONT-02 | CTO, Admin |
| **Page Profil** | `/profile` | REQ-MU (implicite) | Tous |
| **Page 403** | `/403` | REQ-RBAC-06 | Tous (quand refuse) |
| **Command Palette** | Overlay (Ctrl+K) | REQ-RBAC-06 (filtrage) | Tous |

### 8.2 Navigation par persona

```
CEO:
  /dashboard (executif) -> /onboarding/chat -> /onboarding/org -> /dashboard

CTO:
  /dashboard (technique) -> /workflows/:id/edit -> /workflows/:id
  -> /settings/security/sso -> /audit

Dev:
  /board -> /projects/:id/stories/:id -> /projects/:id/stories/:id/agent
  -> (split view code+chat)

PO:
  /board -> /projects/:id/stories/:id -> chat decomposition
  -> validation DoR

PM:
  /chat (brainstorm) -> /projects/:id/epics/:id -> /roadmap

Admin:
  /settings/members -> /settings/roles -> /audit
  -> /settings/security/sso -> /settings/security/credentials
```

### 8.3 Matrice page x composant custom

| Page | WorkflowPipeline | ChatPanel | DriftAlert | AutomationCursor | OrgChart | MetricWidget |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard Executif | - | Mini | - | - | - | Oui |
| Dashboard Technique | Oui | - | Oui | - | - | Oui |
| Board | - | Mini | - | - | - | - |
| Split View | Barre statut | Oui | - | - | - | - |
| Editeur Workflow | Oui | - | - | - | - | - |
| Audit Log | - | - | - | - | - | - |
| Onboarding | - | Oui | - | - | Oui | - |
| Preferences | - | - | - | Oui | - | - |
| Container Status | - | - | - | - | - | Oui |

---

## Synthese et recommandations

### Priorite de developpement UX

1. **Sprint 0** (prerequis) : Design tokens, composants de base (Button, Card, Badge, Dialog, Table), Sidebar adaptee, Header avec Company Selector
2. **Phase 1** (P0) : Page Membres, Modal Invitation, Sign-out, NavigationGuard, Badges role
3. **Phase 2** (P0-P1) : Matrice Permissions, Pipeline Workflow, ChatPanel, Drift Detection basique
4. **Phase 3** (P1) : Curseur Automatisation v1, Dashboards CEO/CTO, Audit Log
5. **Phase 4** (P1-P2) : Onboarding Cascade, Import Wizard, Editeur Workflow, Containerisation UI

### Composants a prototyper en priorite

1. **WorkflowPipeline** — C'est le composant central de MnM, visible partout
2. **ChatPanel** — Le plus ambitieux techniquement (WebSocket bidirectionnel)
3. **AutomationCursor** — L'innovation UX qui differencie MnM
4. **DriftAlert** — Depend du WorkflowPipeline, critique pour la valeur CTO

### Metriques UX a suivre

| Metrique | Cible | Methode |
|----------|-------|---------|
| Time-to-first-action | < 2 min apres login | Analytics |
| Completion onboarding | > 70% | Funnel tracking |
| Lighthouse Accessibility | >= 90 | CI automatise |
| Interruption agent reussie | 100% | Test E2E |
| Latence feedback visuel | < 200ms | Performance monitoring |

---


---

# PARTIE 7 — Strategie de Test par Epic & Infrastructure de Test

> **Auteur** : Murat (Test Architect)
> **Sources** : Architecture de Test, PRD B2B v1.0, Architecture B2B v1.0


## 1. Stratégie de Test par Epic

Chaque epic possède sa propre stratégie de test, ordonnée par priorité de mise en place. L'ordre de test suit le graphe de dépendances techniques : les fondations (infra, RBAC) sont testées en premier car elles conditionnent la sécurité de tout le reste.

### 1.1 Epic 1 — Multi-User MVP (FR-MU)

**Durée estimée** : ~1 semaine dev + 2-3 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - Validation des schémas Zod pour les invitations (email, expiration 7j, lien signé)
   - Logique de désactivation du signup libre (toggle `requireInvite`)
   - Fonction de sign-out avec invalidation de session côté DB
   - Service d'invitation : création lien signé, calcul expiration, vérification doublons

2. **Intégration (Supertest + PostgreSQL)** — jour 2-3
   - `POST /api/invites` : création invitation, envoi email (mock SMTP), lien valide
   - `POST /api/invites/accept` : acceptation → membership créée → permissions assignées
   - Invitation expirée : tentative après 7j → 410 Gone
   - User déjà membre : tentative → 409 Conflict
   - Race condition : 2 admins invitent le même email simultanément → 1 seule membership
   - Sign-out : token invalide après sign-out (401)
   - `GET /api/members` : liste filtrée par companyId (RLS)
   - `DELETE /api/members/:id` : désactivation → agent cleanup

3. **E2E (Cypress)** — jour 3
   - Flux complet : Admin invite → email reçu → clic lien → signup → dashboard membre
   - Sign-out → token expiré → redirect login
   - Signup désactivé : page signup redirige vers "Contactez votre admin"

**Critères de couverture** :
- Unitaires : ≥80% nouveau code
- Intégration : 100% des routes `/api/invites`, `/api/members`
- E2E : 3 flux critiques (invitation, sign-out, signup désactivé)

**Scénarios PRD couverts** : SC-MU-01, SC-MU-02, SC-MU-03, SC-MU-04, SC-MU-05

---

### 1.2 Epic 2 — RBAC Métier (FR-RBAC)

**Durée estimée** : ~2 semaines dev + 4-5 jours test

**C'est l'epic la plus critique en termes de tests.** Un trou dans le RBAC = escalade de privilèges = compromission de données multi-tenant. Chaque route DOIT être testée avec les 4 rôles.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-3
   - **`hasPermission()` corrigé** (access.ts) : 15 permission keys × scénarios scope (null, projectIds, scope vide, scope malformé) = ~60 cas
   - Presets de rôles : Admin (15/15), Manager (10/15), Contributor (5/15), Viewer (2/15)
   - Scope JSONB validation Zod strict : payloads valides, rejet des payloads malformés
   - Deny > Allow priority : `evaluateGrants()` avec grants conflictuels
   - `canUser()` côté client : retourne correct pour chaque combinaison rôle × permission

2. **Intégration (Supertest + PostgreSQL)** — jour 3-7
   - **Matrice exhaustive route × rôle** : 22 routes API × 4 rôles = ~88 cas d'accès
     - Chaque cellule vérifie : code HTTP correct (200/201/403), body correct, audit event émis
   - Scope JSONB enforcement :
     - Contributor avec scope `{projectIds: ["proj-1"]}` → voit uniquement proj-1
     - Admin avec scope null → voit tout
     - Contributor tente proj-2 → 403
   - Changement de rôle pendant session : token existant reflète le nouveau rôle au prochain appel
   - Dernier admin se rétrograde : bloqué par validation (invariant)
   - Injection SQL via JSONB scope : payloads OWASP → aucun n'injecte

3. **E2E (Cypress)** — jour 7-8
   - Navigation masquée : login Viewer → items admin absents du DOM (pas CSS `display:none`)
   - Attribution de rôle : Admin change Contributor → Manager → accès modifié immédiatement
   - Matrice permissions UI : page admin affiche la matrice configurable
   - Badges couleur par rôle visibles dans la liste membres

**Critères de couverture** :
- `hasPermission()` / `canUser()` : ≥95%
- Matrice route × rôle : 100% des combinaisons critiques
- E2E : 4 flux (navigation masquée, attribution rôle, matrice, scope projet)

**Scénarios PRD couverts** : SC-RBAC-01 à SC-RBAC-05

---

### 1.3 Epic 3 — Orchestrateur Déterministe (FR-ORCH)

**Durée estimée** : ~3-5 semaines dev + 5-7 jours test

**L'orchestrateur est le coeur du produit.** Les tests doivent garantir le déterminisme absolu — un agent ne peut JAMAIS sauter une étape ou contourner une validation.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-4
   - **State machine** (workflow-state-machine.ts) : 12 transitions (CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED + PAUSED, FAILED, COMPACTING, SKIPPED)
     - Chaque transition valide : état source → événement → état destination
     - Transitions invalides : refus strict avec erreur typée
     - Guards : fichiers obligatoires absents → refus transition
   - **WorkflowEnforcer** :
     - Injection pré-prompts par étape
     - Vérification fichiers obligatoires avant transition
     - Persistance résultats intermédiaires
     - Human-in-the-loop : étape configurée pour validation → blocage en VALIDATING
   - **DriftDetector** :
     - Heuristiques de détection : comparaison attendu vs observé
     - Seuils configurables : ratio d'activité, fichiers attendus, durée anormale
     - Alerte émise si drift détecté (<15min)
   - **CompactionHandler** :
     - Kill+relance : contexte frais + résultats intermédiaires injectés
     - Réinjection : pré-prompts critiques réinjectés post-compaction
     - Circuit breaker : max 3 relances → alerte humaine

2. **Intégration (Supertest + PostgreSQL)** — jour 4-7
   - Workflow complet : créer template → lancer instance → step-by-step → complete
   - Saut d'étape interdit : tenter transition STEP-1 → STEP-3 → 400 Bad Request
   - Fichiers obligatoires : transition refusée si `requiredFiles` absents
   - Compaction pendant étape critique : atomique (pas de corruption)
   - Crash mid-workflow : heartbeat <30s → état restauré depuis snapshot
   - Workflow modifié pendant exécution : version isolée (pas d'impact)
   - Boucle infinie : watchdog coupe après N itérations configurables

3. **E2E (Cypress)** — jour 7-9
   - Workflow complet UI : créer template → lancer agent → observer step-by-step → valider
   - Drift intervention : agent dévie → alerte visible → diff attendu/observé → action corrective
   - Éditeur de workflow : drag-and-drop étapes, prompts, fichiers obligatoires

**Critères de couverture** :
- State machine : ≥90% (toutes transitions + guards)
- WorkflowEnforcer : ≥90%
- DriftDetector : ≥80%
- E2E : 3 flux critiques

**Scénarios PRD couverts** : SC-ORCH-01 à SC-ORCH-05

---

### 1.4 Epic 4 — Containerisation & Sécurité (FR-CONT)

**Durée estimée** : ~4-5 semaines dev + 5-7 jours test

**L'epic la plus critique en termes de sécurité.** Les tests doivent prouver qu'aucun agent ne peut s'échapper de son container ni accéder aux credentials d'un autre agent/company.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-3
   - **ContainerManager** (Docker mocké pour tests unitaires) :
     - Création container avec profil (CPU, RAM, disk)
     - Options Docker : `--rm`, `--read-only`, `--no-new-privileges`
     - Timeout avec SIGTERM → SIGKILL (10s)
     - Gestion OOM kill (code 137) → reprofile
   - **Mount Allowlist** :
     - Validation `realpath()` sur chaque path
     - Rejet symlinks : `fs.lstat` → pas de symlink autorisé
     - Rejet null bytes : `\x00` dans le path → erreur immédiate
     - Rejet path traversal : `../../etc/passwd` → bloqué
     - Rejet URL encoding double : `%252e%252e` → bloqué
   - **Credential Proxy** :
     - Résolution secrets : nom → provider (local/AWS/GCP/Vault) → valeur
     - Isolation : agent A ne peut pas résoudre secret de agent B
     - Shadow `.env` : mount bind `/dev/null` vérifié
     - Proxy down : 503 → retry → suspend après 3 échecs

2. **Intégration (Supertest + Docker réel)** — jour 3-6
   - Cycle de vie complet : profil → lancement → credential proxy → exécution → cleanup
   - Container escape test : mount `/etc/shadow` → refusé par allowlist
   - Credential proxy tampering : appel direct aux secrets → 403 + audit event
   - Path traversal : `../../etc/passwd`, null bytes, encodage URL → tous bloqués
   - Isolation réseau : container company A ne peut pas ping container company B
   - Ressources : container dépasse la limite CPU/RAM → throttle/kill approprié
   - Docker daemon indisponible : mode dégradé → alerte admin
   - Épuisement ressources : limite par company → file d'attente

3. **E2E (Cypress)** — jour 6-7
   - Lancer agent containerisé → observer logs temps réel → credential proxy fonctionne → stop
   - Status container visible dans UI (running/stopped/failed)

**Critères de couverture** :
- ContainerManager : ≥90%
- Credential Proxy : ≥95%
- Mount Allowlist : ≥95%
- E2E : 2 flux critiques

**Scénarios PRD couverts** : SC-CONT-01 à SC-CONT-04

---

### 1.5 Epic 5 — Observabilité & Audit (FR-OBS)

**Durée estimée** : ~3 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - AuditLogger : format événement (actorId, actorType, action, targetType, targetId, metadata, ipAddress)
   - Hash chain SHA-256 : calcul, vérification, chaîne intacte
   - AuditSummarizer : résumé LLM (mock provider) retourne texte <500 chars en <5s
   - Filtre audit : 12 filtres (acteur, action, date, target, severity, etc.)
   - AggregationService : k-anonymity (k=5) → aucun groupe avec <5 entrées → supprimé ou agrégé

2. **Intégration (Supertest + PostgreSQL)** — jour 2-4
   - Toute mutation API génère un audit_event dans la table
   - TRIGGER deny UPDATE/DELETE : tentative UPDATE sur audit_events → erreur PostgreSQL
   - Export CSV/JSON : `GET /api/audit/export` retourne données correctes
   - Dashboard agrégé : `GET /api/dashboards/agent-activity` → données agrégées, JAMAIS individuelles
   - Partitionnement mensuel : vérifier que les partitions existent et les queries les utilisent
   - Rétention : simulation 3 ans de données → queries performantes

3. **E2E (Cypress)** — jour 4-5
   - Page audit log : filtres, pagination, tri, recherche
   - Dashboard manager : métriques agrégées visibles, pas de drill-down individuel

**Critères de couverture** :
- AuditLogger : ≥85%
- AggregationService : ≥90% (k-anonymity critique)
- E2E : 2 flux

**Scénarios PRD couverts** : SC-OBS-01 à SC-OBS-04

---

### 1.6 Epic 6 — Chat Temps Réel (FR-CHAT)

**Durée estimée** : ~3 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - ChatService : création channel, envoi message, pipe vers stdin agent
   - Rate limiter : 10 messages/min par user → 11ème message → rejeté avec erreur
   - Reconnexion : buffer serveur 30s → sync messages manqués
   - Message validation : >100KB → troncature, XSS → sanitisé (UTF-8 strict + DOMPurify)
   - `useAgentChat` hook (UI) : connexion WS, envoi, réception, déconnexion, reconnexion

2. **Intégration (Supertest + WebSocket réel)** — jour 2-4
   - Connexion WS → envoi message → réception réponse agent (mock agent stdin/stdout)
   - Rate limiting : 11 messages en <1min → dernier rejeté avec code 429
   - Reconnexion : déconnexion réseau → reconnexion → sync messages manqués via buffer 30s
   - Message après fin exécution : agent terminé → message chat → rejeté (channel fermé)
   - Viewer read-only : WebSocket connecté en lecture → tentative d'écriture → 403
   - XSS via chat : `<script>alert(1)</script>`, SVG malicieux, markdown injection → tous sanitisés

3. **E2E (Cypress)** — jour 4-5
   - Dialogue complet : connecter → envoyer message → recevoir réponse agent → historique visible
   - Reconnexion visible : perte connexion → spinner → reconnexion → messages rattrappés

**Critères de couverture** :
- ChatService : ≥85%
- Rate limiter : ≥90%
- E2E : 2 flux

**Scénarios PRD couverts** : SC-CHAT-01 à SC-CHAT-04

---

### 1.7 Epic 7 — Dual-Speed & Automatisation (FR-DUAL)

**Durée estimée** : ~2-3 semaines dev + 2-3 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - Curseur d'automatisation : 3 positions (Manuel/Assisté/Auto) × 4 niveaux (action/agent/projet/entreprise)
   - Plafond hiérarchique : CEO fixe plafond "Assisté" → Manager ne peut pas passer en "Auto"
   - Catégorisation tâches : mécanique vs jugement → seuils différents par catégorie

2. **Intégration (Supertest + PostgreSQL)** — jour 2-3
   - CRUD automation_cursors : création, mise à jour, lecture par niveau
   - Plafond enforcement : tentative de dépasser le plafond → 403 avec message explicite
   - Hiérarchie complète : CEO(Auto) → CTO(Assisté) → Manager(Manuel) → vérification cascade

3. **E2E (Cypress)** — jour 3
   - UI curseur : slider 3 positions, indicateur de plafond, tooltip d'explication

**Critères de couverture** :
- Curseur + plafond : ≥85%
- E2E : 1 flux

**Scénarios PRD couverts** : SC-DUAL-01 à SC-DUAL-04

---

### 1.8 Epic 8 — Onboarding & Import (FR-ONB)

**Durée estimée** : ~3-4 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - ImportService : mapping Jira → MnM (projets, epics, stories, users, statuts)
   - Validation import : détection doublons, champs obligatoires, formats supportés
   - Cascade onboarding : logique CEO → CTO → Managers → Opérationnels

2. **Intégration (Supertest + PostgreSQL + MSW)** — jour 2-4
   - Import Jira (mock via MSW) : upload → mapping → validation → données importées
   - Import idempotent : même import 2x → pas de doublons
   - Import partiel : erreur au milieu → rollback atomique
   - Cascade hiérarchique : CEO configure → CTO reçoit son onboarding → cascade

3. **E2E (Cypress)** — jour 4-5
   - Import wizard : upload fichier → mapping colonnes → preview → confirmation → succès

**Critères de couverture** :
- ImportService : ≥80%
- E2E : 1 flux

**Scénarios PRD couverts** : REQ-ONB-01 à REQ-ONB-04

---

### 1.9 Epic 9 — Agent-to-Agent Communication (FR-A2A)

**Durée estimée** : ~4-5 semaines dev + 4-5 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - A2ABus : émission requête, validation permissions, routing
   - Anti-boucle : max 5 requêtes A2A par chaîne, détection de cycles
   - Permissions inter-agents : scope, rôle, projet vérifiés

2. **Intégration (Supertest + PostgreSQL)** — jour 2-4
   - Flux complet A2A : Agent A émet → A2ABus vérifie → notification humain → approbation → Agent A reçoit contexte
   - Permissions refusées : agent sans scope approprié → 403
   - Anti-boucle : chaîne de 6 requêtes → coupée à la 5ème avec erreur
   - Cycle detection : A→B→A → détecté et bloqué
   - Audit A2A : chaque transaction produit un audit_event

3. **E2E (Cypress)** — jour 4-5
   - Communication inter-agents visible dans l'UI
   - Notification humaine : approbation/rejet avec raison

**Critères de couverture** :
- A2ABus : ≥85%
- E2E : 2 flux

**Scénarios PRD couverts** : SC-A2A-01 à SC-A2A-03

---

## 2. Test Pyramid par Epic

### 2.1 Ratio par Epic

Le ratio unit(70%)/integration(20%)/E2E(10%) est le ratio **cible global**, mais chaque epic a un ratio adapté à sa nature. Les epics à forte composante sécurité (RBAC, Container) ont un ratio d'intégration plus élevé car la sécurité ne peut être validée qu'avec les vrais composants.

| Epic | Unitaires | Intégration | E2E | Justification |
|------|-----------|-------------|-----|---------------|
| **Multi-User (FR-MU)** | 60% (~15 tests) | 30% (~8 tests) | 10% (~3 tests) | Flux invitations nécessitent DB réelle |
| **RBAC (FR-RBAC)** | 50% (~60 tests) | 40% (~88 tests) | 10% (~4 tests) | Matrice route × rôle = intégration massive |
| **Orchestrateur (FR-ORCH)** | 65% (~80 tests) | 25% (~30 tests) | 10% (~3 tests) | State machine testable en unitaire |
| **Container (FR-CONT)** | 55% (~40 tests) | 35% (~25 tests) | 10% (~2 tests) | Sécurité container = intégration obligatoire |
| **Observabilité (FR-OBS)** | 60% (~30 tests) | 30% (~15 tests) | 10% (~2 tests) | Triggers DB, agrégation = intégration |
| **Chat (FR-CHAT)** | 55% (~25 tests) | 35% (~15 tests) | 10% (~2 tests) | WebSocket = intégration nécessaire |
| **Dual-Speed (FR-DUAL)** | 70% (~20 tests) | 20% (~6 tests) | 10% (~1 test) | Logique pure, peu d'I/O |
| **Onboarding (FR-ONB)** | 60% (~15 tests) | 30% (~8 tests) | 10% (~1 test) | Import = mock MSW + DB réelle |
| **A2A (FR-A2A)** | 55% (~15 tests) | 35% (~10 tests) | 10% (~2 tests) | Bus communication = intégration |
| **TOTAL** | ~300 tests | ~205 tests | ~20 tests | **~525 tests** |

### 2.2 Volume Total Estimé

```
         ┌─────────────────────┐
         │    E2E (Cypress)     │  ~20 scénarios — flux critiques
         │   ~4% du volume      │  Login, workflow, chat, RBAC, containers
         ├─────────────────────┤
         │  Intégration          │  ~205 scénarios — routes API, RBAC,
         │  (Supertest+DB)       │  isolation tenant, WebSocket, containers
         │   ~39% du volume      │
         ├─────────────────────┤
         │  Unitaires            │  ~300 tests — logique métier pure
         │  (Vitest)             │  state machines, parsers, validators,
         │   ~57% du volume      │  permission engine, credential proxy
         └─────────────────────┘
```

**Note** : Le ratio global (57/39/4) penche davantage vers l'intégration que la pyramide classique (70/20/10). C'est intentionnel dans un contexte multi-tenant sécurisé où l'isolation tenant, le RBAC et la containerisation ne peuvent être validés qu'avec les vrais composants.

---

## 3. Infrastructure de Test — Stories

### 3.1 STORY-TEST-001 : Setup Vitest Workspace B2B

**Priorité** : P0 — Prérequis pour tous les tests unitaires
**Effort** : 1 jour
**Sprint** : Sprint 0 (Setup)

**Description** :
Étendre la configuration Vitest workspace existante (5 projets) pour supporter les nouveaux modules B2B. Ajouter les configurations de couverture par module.

**Acceptance Criteria** :
- [ ] Vitest workspace inclut les 5 projets existants + les nouveaux fichiers test
- [ ] Configuration de couverture avec seuils différenciés :
  - Global nouveau code : ≥80% (lines, functions, branches)
  - RBAC engine : ≥95%
  - Credential proxy : ≥95%
  - State machine : ≥90%
- [ ] `pnpm test` exécute tous les tests en <3 minutes
- [ ] `pnpm test:coverage` génère le rapport de couverture avec les seuils

**Tâches** :
1. Étendre `vitest.config.ts` avec les nouveaux patterns de test
2. Configurer coverage thresholds par module dans `vitest.config.ts`
3. Ajouter script `test:coverage` dans le `package.json` racine
4. Vérifier que les tests existants (~55+ server, ~12 CLI) passent toujours

---

### 3.2 STORY-TEST-002 : Setup Cypress E2E

**Priorité** : P0 — Prérequis pour tous les tests E2E
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Installer et configurer Cypress pour MnM. Aucune configuration Cypress n'existe actuellement dans le projet actif (les specs legacy dans `_legacy/web/e2e/` utilisaient Playwright).

**Acceptance Criteria** :
- [ ] `cypress.config.ts` configuré (baseUrl, specPattern, viewportWidth/Height)
- [ ] Support React 18 + Vite pour component testing
- [ ] Custom commands : `cy.login(role)`, `cy.createAgent()`, `cy.asRole(role)`, `cy.resetDB()`
- [ ] `cypress/support/e2e.ts` avec setup global (intercepteurs API, gestion sessions)
- [ ] `pnpm test:e2e` exécute les tests en mode headless
- [ ] `pnpm test:e2e:open` ouvre l'UI Cypress en mode interactif
- [ ] Video désactivée en local, activée en CI
- [ ] Retry : 2 en CI, 0 en local

**Tâches** :
1. `pnpm add -D cypress @cypress/vite-dev-server`
2. Créer `cypress.config.ts` (voir archi-section-5-test-murat.md)
3. Créer `cypress/support/commands.ts` avec custom commands
4. Créer `cypress/support/e2e.ts` avec setup global
5. Créer `cypress/plugins/db-seed.ts` pour le seeding DB avant tests
6. Ajouter scripts dans `package.json`
7. Ajouter un premier test smoke `cypress/e2e/smoke.cy.ts`

---

### 3.3 STORY-TEST-003 : Test Database Setup (PostgreSQL de test)

**Priorité** : P0 — Prérequis pour tous les tests d'intégration
**Effort** : 1.5 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Configurer l'infrastructure de base de données de test pour les tests d'intégration. Le projet utilise déjà `embedded-postgres` pour le développement. Il faut étendre cette configuration pour les tests avec le pattern transaction-rollback.

**Acceptance Criteria** :
- [ ] `docker-compose.test.yml` avec PostgreSQL 16 + Redis 7 en mode tmpfs (RAM)
- [ ] Pattern transaction-rollback : `beforeEach` démarre une transaction, `afterEach` rollback
- [ ] Migrations automatiques au démarrage des tests (`pnpm db:migrate` sur la DB de test)
- [ ] RLS policies actives sur la DB de test (identiques à la production)
- [ ] Port de test différent (5433) pour ne pas confliter avec le dev (5432)
- [ ] Variable `DATABASE_URL` configurable par environnement

**Tâches** :
1. Créer `docker-compose.test.yml`
2. Créer `server/src/__tests__/integration/setup.ts` avec le pattern transaction-rollback
3. Configurer la globalSetup Vitest pour démarrer/migrer la DB de test
4. Vérifier que les RLS policies sont correctement appliquées en test
5. Documenter la procédure de setup dans un README de test

---

### 3.4 STORY-TEST-004 : Test Factories & Fixtures

**Priorité** : P0 — Prérequis pour tests d'intégration et E2E
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Créer les factory functions TypeScript pour générer des données de test cohérentes. Ces factories sont utilisées par les tests unitaires, d'intégration et le seed E2E.

**Acceptance Criteria** :
- [ ] Factories pour toutes les entités du domaine :
  - `createUser()`, `createCompany()`, `createAgent()`, `createWorkflowTemplate()`
  - `createMembership()`, `createPermissionGrant()`, `createProject()`
  - `createChatChannel()`, `createChatMessage()`, `createContainerProfile()`
  - `createAuditEvent()`, `createAutomationCursor()`
- [ ] Chaque factory accepte des overrides typés (`Partial<T>`)
- [ ] IDs auto-générés avec `randomUUID()`
- [ ] Emails auto-générés avec suffixe unique (`@test.mnm.dev`)
- [ ] Export depuis `tests/factories/index.ts`

**Tâches** :
1. Créer `tests/factories/index.ts` avec toutes les factories
2. Créer `tests/factories/helpers.ts` pour les utilitaires (génération emails, noms, etc.)
3. Créer `tests/factories/presets.ts` pour les jeux de données prédéfinis (4 rôles, 2 companies)
4. Tests unitaires sur les factories elles-mêmes (types corrects, IDs uniques)

---

### 3.5 STORY-TEST-005 : E2E Seed Data

**Priorité** : P1 — Nécessaire avant les tests E2E métier
**Effort** : 1.5 jours
**Sprint** : Sprint 0 ou Sprint 1

**Description** :
Créer un jeu de données de seed cohérent pour les tests E2E Cypress. Ce seed représente un cas d'usage réel MnM avec 2 companies, 5 users, 4 rôles, 2 agents, 1 workflow template.

**Acceptance Criteria** :
- [ ] `tests/seed/e2e-seed.ts` crée un jeu de données complet
- [ ] 2 companies (Alpha Corp, Beta Inc) pour tests d'isolation
- [ ] 4 users avec rôles différents dans Alpha (admin, manager, contributor, viewer)
- [ ] 1 user dans Beta (admin) pour tests cross-tenant
- [ ] 1 projet avec scoping dans Alpha
- [ ] 2 agents (1 Alpha, 1 Beta)
- [ ] 1 workflow template avec 3 étapes
- [ ] Permissions avec scope JSONB pour le contributor
- [ ] Script exécutable : `node tests/seed/run.js`
- [ ] Idempotent : peut être exécuté plusieurs fois sans erreur

**Tâches** :
1. Créer `tests/seed/e2e-seed.ts` (voir code dans archi-section-5-test-murat.md)
2. Créer `tests/seed/run.ts` avec exécution standalone
3. Intégrer le seed dans le plugin Cypress (`cypress/plugins/db-seed.ts`)
4. Vérifier que le seed est compatible avec les RLS policies

---

### 3.6 STORY-TEST-006 : Mock Strategy Setup

**Priorité** : P1 — Nécessaire pour les tests unitaires métier
**Effort** : 1 jour
**Sprint** : Sprint 0 ou Sprint 1

**Description** :
Configurer les mocks pour les services externes (LLM providers, Docker daemon, SMTP, services tiers).

**Acceptance Criteria** :
- [ ] Mock LLM provider : `mockLLMProvider` avec `generateSummary()` et `detectDrift()`
- [ ] Mock Docker daemon : `mockDockerClient` pour ContainerManager (tests unitaires uniquement)
- [ ] Mock SMTP : `nodemailer-mock` ou équivalent pour vérifier envoi emails
- [ ] Mock services tiers (Jira, Linear) : MSW (Mock Service Worker) handlers
- [ ] Guide documenté : "Quand mocker quoi" aligné avec la règle "JAMAIS mocker la DB"

**Tâches** :
1. Créer `tests/mocks/llm-provider.ts`
2. Créer `tests/mocks/docker-client.ts`
3. Créer `tests/mocks/smtp.ts`
4. Installer et configurer MSW : `pnpm add -D msw`
5. Créer `tests/mocks/msw-handlers.ts` pour Jira/Linear APIs

---

### 3.7 STORY-TEST-007 : CI Pipeline Quality Gates

**Priorité** : P0 — Doit être en place avant le premier merge sur master
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Implémenter le pipeline CI GitHub Actions avec les 7 quality gates définies dans l'architecture de test.

**Acceptance Criteria** :
- [ ] `.github/workflows/ci.yml` complet avec les 7 QGs
- [ ] QG-0 : TypeScript strict, ESLint, secret scan → bloquant
- [ ] QG-1 : Vitest unitaires avec couverture ≥80% → bloquant
- [ ] QG-2 : Tests intégration avec PostgreSQL service → bloquant
- [ ] QG-3 : OWASP ZAP + dependency audit + secret scan → bloquant (critique/haute)
- [ ] QG-4 : k6 performance → informatif sur PR, bloquant sur master
- [ ] QG-5 : Cypress E2E → bloquant
- [ ] QG-6 : Review humaine → bloquant
- [ ] Parallélisation : QG-1 et QG-2 en parallèle, QG-4 et QG-5 en parallèle
- [ ] Caching : pnpm store, Docker layers, Cypress binary
- [ ] Temps total <22 minutes (chemin critique)

**Tâches** :
1. Créer `.github/workflows/ci.yml` (voir archi-section-5-test-murat.md pour le YAML complet)
2. Configurer les services PostgreSQL dans les jobs d'intégration et E2E
3. Configurer les seuils de couverture dans le job unitaire
4. Ajouter le job OWASP ZAP avec les seuils appropriés
5. Configurer les environment protection rules sur GitHub pour staging/production
6. Ajouter le caching pour pnpm, Cypress, Docker

---

### 3.8 STORY-TEST-008 : Performance Benchmarks Setup (k6)

**Priorité** : P1 — Nécessaire avant le Sprint 2
**Effort** : 2 jours
**Sprint** : Sprint 1

**Description** :
Configurer les benchmarks de performance k6 pour les API REST, WebSocket et containers.

**Acceptance Criteria** :
- [ ] `tests/performance/api-benchmark.js` : 6 endpoints benchmarkés
- [ ] `tests/performance/websocket-benchmark.js` : latence messages, connexions simultanées
- [ ] `tests/performance/container-benchmark.js` : temps démarrage cold/warm
- [ ] `tests/performance/check-thresholds.js` : vérification automatisée des seuils
- [ ] Seuils MVP configurés (API P95 <500ms, WS <50ms, container <10s)
- [ ] Export résultats en JSON pour analyse

**Tâches** :
1. Installer k6 dans le pipeline CI
2. Créer les 3 scripts de benchmark (voir archi-section-5-test-murat.md)
3. Créer le script de vérification des seuils
4. Intégrer dans le job QG-4 du pipeline CI

---

## 4. Performance Testing par Phase

### 4.1 Phase 1 — MVP (Sprints 1-4)

Objectifs de performance MVP : validation que le système répond sous charge normale.

| Métrique | Seuil | Outil | Fréquence |
|----------|-------|-------|-----------|
| API P50 latence | <100ms | k6 | Chaque merge master |
| API P95 latence | <500ms | k6 | Chaque merge master |
| API P99 latence | <1000ms | k6 | Chaque merge master |
| WebSocket message | <50ms | k6 + xk6-websocket | Chaque merge master |
| Container startup cold | <10s | k6 | Sprint 3+ (container ready) |
| Dashboard page load | <2s | Cypress + Performance API | Sprint 2+ |
| 50 users simultanés | 0% error, P95 <500ms | k6 | Hebdomadaire |
| 20 agents actifs | heartbeat stable | k6 | Sprint 3+ |

**Scénarios de charge MVP** :
- **Normal** : 50 VUs pendant 2 minutes → 100% success, P95 <500ms
- **Peak** : 100 VUs pendant 1 minute → <1% errors, P95 <1000ms
- **Soak** : 20 VUs pendant 2 heures → pas de memory leak, pas de connexion leak

### 4.2 Phase 2 — Enterprise (Post-MVP)

| Métrique | Seuil | Outil | Fréquence |
|----------|-------|-------|-----------|
| API P50 latence | <50ms | k6 | Chaque merge master |
| API P95 latence | <200ms | k6 | Chaque merge master |
| WebSocket message | <20ms | k6 + xk6-websocket | Chaque merge master |
| Container startup cold | <5s | k6 | Chaque merge master |
| Dashboard page load | <1s | Lighthouse | Chaque merge master |
| 1000 users simultanés | <1% error | k6 | Hebdomadaire |
| 500 agents actifs | heartbeat stable | k6 | Hebdomadaire |
| 10 000 WebSocket connexions | <20ms latence | k6 | Mensuel |

**Scénarios de charge Enterprise** :
- **Steady** : 500 VUs pendant 10 minutes → CPU <70%, RAM <80%, pool DB <80%
- **Burst** : 1000 VUs pendant 1 minute → saturation gracieuse, file d'attente, pas de crash
- **Soak** : 50 VUs pendant 8 heures → stabilité mémoire, pas de GC long pauses

### 4.3 Benchmarks Base de Données

**Monitoring continu via `pg_stat_statements`** :

| Métrique | Seuil | Action si dépassé |
|----------|-------|-------------------|
| Queries >100ms | <5% du total | EXPLAIN ANALYZE + index candidat |
| Queries >1s | 0% | Alerte immédiate + optimisation obligatoire |
| Seq scans tables >10k rows | 0 | CREATE INDEX obligatoire |
| Pool connexions | <80% max | Alerter si >80% |
| Taille table audit_events | Monitoring mensuel | Vérifier partitionnement |

**Tables critiques à monitorer** :
- `agents` : queries fréquentes avec JOIN heartbeat_runs
- `audit_events` : table partitionnée, volume élevé
- `principal_permission_grants` : queries RBAC sur chaque requête API
- `chat_messages` : volume croissant, queries par channelId

---

## 5. Security Testing

### 5.1 OWASP Testing par Epic

Chaque epic a des vecteurs d'attaque spécifiques. Les tests de sécurité sont intégrés dans les tests d'intégration (pas un effort séparé).

| Epic | Vecteurs OWASP | Tests |
|------|----------------|-------|
| **FR-MU** | A01 Broken Access Control (invitation tampering), A07 Auth Failures (brute force login) | 3 tests |
| **FR-RBAC** | A01 Broken Access Control (escalade horizontale/verticale), A03 Injection (SQL via JSONB scope) | 8 tests |
| **FR-ORCH** | A04 Insecure Design (workflow bypass), A08 Software Integrity (template tampering) | 4 tests |
| **FR-CONT** | A01 Broken Access Control (container escape), A05 Security Misconfiguration (mount paths), A09 Logging Failures (credential leak) | 6 tests |
| **FR-OBS** | A09 Logging Failures (audit tampering), A01 Broken Access Control (données cross-tenant) | 3 tests |
| **FR-CHAT** | A03 Injection (XSS via chat), A07 Auth Failures (WebSocket hijacking) | 4 tests |
| **FR-A2A** | A01 Broken Access Control (A2A sans permission), A04 Insecure Design (boucle infinie) | 3 tests |
| **TOTAL** | | **31 tests de sécurité** |

### 5.2 RBAC Testing Exhaustif

**Matrice de test RBAC** — chaque cellule est un test automatisé :

```
Route                    | Admin | Manager | Contributor | Viewer |
─────────────────────────┼───────┼─────────┼─────────────┼────────┤
POST /api/invites        | 201   | 201     | 403         | 403    |
GET /api/members         | 200   | 200     | 403         | 403    |
PUT /api/members/:id     | 200   | 403     | 403         | 403    |
DELETE /api/members/:id  | 200   | 403     | 403         | 403    |
GET /api/roles           | 200   | 403     | 403         | 403    |
PUT /api/permissions     | 200   | 403     | 403         | 403    |
POST /api/agents         | 201   | 201     | 201(scope)  | 403    |
DELETE /api/agents/:id   | 200   | 200(own)| 403         | 403    |
GET /api/agents          | 200   | 200     | 200(scope)  | 200(scope)|
POST /api/workflows      | 201   | 201     | 403         | 403    |
PUT /api/workflows/:id   | 200   | 200     | 403         | 403    |
POST /api/enforce        | 200   | 200     | 403         | 403    |
GET /api/drift/alerts    | 200   | 200     | 403         | 403    |
GET /api/audit           | 200   | 200     | 403         | 403    |
GET /api/audit/export    | 200   | 403     | 403         | 403    |
GET /api/dashboards      | 200   | 200     | 403         | 403    |
POST /api/containers     | 201   | 201     | 201         | 403    |
GET /api/containers/:id  | 200   | 200     | 200         | 403    |
POST /api/chat/messages  | 201   | 201     | 201         | 403    |
GET /api/chat/history    | 200   | 200     | 200         | 200    |
POST /api/a2a/request    | 201   | 201     | 403         | 403    |
PUT /api/cursors         | 200   | 200     | 200(own)    | 403    |
```

**Total** : 22 routes × 4 rôles = **88 cas de test RBAC**.

### 5.3 Container Isolation Testing

Tests spécifiques à l'isolation des containers, alignés avec les 5 couches Nanoclaw :

| # | Test | Couche | Résultat attendu |
|---|------|--------|-----------------|
| 1 | Mount `/etc/shadow` | Mount allowlist | Refusé par `realpath()` |
| 2 | Symlink vers `/etc/passwd` | Mount allowlist | Refusé (symlink interdit) |
| 3 | Null byte `path%00.txt` | Mount allowlist | Refusé (null byte détecté) |
| 4 | `../../etc/passwd` | Mount allowlist | Refusé (path traversal) |
| 5 | Accès direct secrets | Credential proxy | 403 + audit event |
| 6 | Read `.env` dans container | Shadow .env | Fichier vide (/dev/null) |
| 7 | Ping container autre company | Réseau isolé | Timeout (bridge séparé) |
| 8 | `--privileged` flag | Container config | Refusé par ContainerManager |
| 9 | Fork bomb | Resource limits | cgroup kill |
| 10 | Écriture filesystem | Read-only | Permission denied |

### 5.4 Multi-Tenant Isolation Testing

Test d'isolation critique — chaque test crée 2 companies et vérifie qu'aucune donnée ne fuit :

| # | Test | Vérification |
|---|------|-------------|
| 1 | `GET /api/agents` avec user Alpha | Retourne uniquement agents Alpha, jamais Beta |
| 2 | `GET /api/agents/:betaAgentId` avec user Alpha | 404 Not Found (pas 403 — ne pas révéler l'existence) |
| 3 | SQL direct avec RLS actif | `SET LOCAL app.current_company_id = alpha` → seules les rows Alpha |
| 4 | Redis cache | Clé `tenant:alpha:...` ne retourne jamais données Beta |
| 5 | WebSocket channel | User Alpha ne reçoit pas les events Beta |
| 6 | Audit log | `GET /api/audit` filtré par company, jamais cross-tenant |
| 7 | Container réseau | Bridge Alpha isolé de bridge Beta |

---

## 6. CI/CD Quality Gates — Bloquants vs Informatifs

### 6.1 Matrice Quality Gate × Contexte

| Quality Gate | PR / Feature | Merge Master | Staging | Production |
|-------------|-------------|-------------|---------|-----------|
| **QG-0** Compile + Lint | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-1** Unit Tests | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-2** Integration Tests | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-3** Security Scan | **BLOQUANT** (critique/haute) | **BLOQUANT** | N/A | N/A |
| **QG-4** Performance | INFORMATIF (commentaire PR) | **BLOQUANT** | **BLOQUANT** | N/A |
| **QG-5** E2E Tests | **BLOQUANT** | **BLOQUANT** | Smoke only | Smoke only |
| **QG-6** Review humaine | **BLOQUANT** (1 approbation) | N/A (post-merge) | Manual QA | Sign-off |

### 6.2 Détail des Seuils Bloquants

**QG-0 — Compilation & Standards** (durée : ~2 min)
- `pnpm typecheck` : 0 erreur TypeScript
- `pnpm lint` : 0 erreur ESLint (warnings tolérés en dev, pas en CI)
- `pnpm check:tokens` : 0 token secret détecté dans le code

**QG-1 — Tests Unitaires** (durée : ~3 min)
- 0 test failing
- Couverture nouveau code : ≥80% (lignes, fonctions, branches)
- Couverture RBAC engine : ≥95%
- Couverture credential proxy : ≥95%

**QG-2 — Tests Intégration** (durée : ~5 min)
- 0 test failing
- 100% routes auth-required testées avec les 4 rôles
- 0 data leak cross-company
- Toutes migrations appliquées sans erreur

**QG-3 — Sécurité** (durée : ~4 min)
- `pnpm audit` : 0 vulnérabilité critique/haute
- TruffleHog : 0 secret vérifié trouvé
- OWASP ZAP : 0 alerte haute/critique (informational/low tolérés)

**QG-4 — Performance** (durée : ~5 min)
- MVP : API P95 <500ms, WS <50ms, container startup <10s
- Enterprise : API P95 <200ms, WS <20ms, container <5s
- Sur PR : résultats affichés en commentaire, pas bloquant
- Sur master : bloquant si seuils dépassés

**QG-5 — E2E** (durée : ~8 min)
- Flux P0 : 100% passants (login, workflow, chat, RBAC, container, isolation)
- Flux P1 : ≥90% passants (retry 2x pour les tests flaky)
- Temps total : <20 minutes

**QG-6 — Review & Audit**
- ≥1 approbation requise sur la PR
- Chaque migration a un `up()` ET un `down()` correspondant
- Toute mutation dans la PR émet un audit event (vérifié par reviewer)

### 6.3 Gestion des Tests Flaky

Les tests flaky sont un risque majeur pour la vélocité. Stratégie :

1. **Identification** : tout test qui échoue puis passe au retry est marqué `@flaky`
2. **Budget** : maximum 5% de tests flaky à tout moment
3. **Quarantaine** : un test flaky >3 fois en 1 semaine est isolé et doit être corrigé en priorité
4. **Root causes communes** :
   - Tests E2E avec timing dépendant du réseau → utiliser `cy.intercept()` + `cy.wait()`
   - Tests WebSocket avec race conditions → utiliser des signaux explicites (pas de `setTimeout`)
   - Tests DB avec données partagées → vérifier le pattern transaction-rollback

---

## 7. Test Data Management

### 7.1 Stratégie par Niveau de Test

| Niveau | Source de données | Lifecycle | Isolation |
|--------|------------------|-----------|-----------|
| **Unitaire** | Factories in-memory | Par test | Naturelle (pas de DB) |
| **Intégration** | Factories + insert DB | Transaction rollback par test | Transaction isolation |
| **E2E** | Seed data prédéfini | Avant chaque suite, reset entre suites | DB truncate + reseed |
| **Performance** | Seed data volumétrique | Avant le benchmark, persisté | DB dédiée `mnm_perf` |

### 7.2 Fixtures Prédéfinies

**Jeu de données standard "Alpha-Beta"** — utilisé par tous les tests d'intégration et E2E :

```
Company Alpha Corp (tier: team, maxUsers: 50)
├── admin@alpha.test    (rôle: admin)     — toutes permissions
├── manager@alpha.test  (rôle: manager)   — 10/15 permissions
├── contrib@alpha.test  (rôle: contributor)— 5/15 permissions, scope: {projectIds: ["proj-1"]}
├── viewer@alpha.test   (rôle: viewer)    — 2/15 permissions
├── Projet Test (slug: projet-test)
├── Agent Dev Alpha (adapter: claude_local)
└── Workflow Template (3 étapes: Analyse → Implémentation → Tests)

Company Beta Inc (tier: team, maxUsers: 10)
├── admin@beta.test     (rôle: admin)
└── Agent Dev Beta (adapter: claude_local)
```

### 7.3 Gestion des Données Volumétriques (Performance)

Pour les benchmarks k6, un seed volumétrique est nécessaire :

| Entité | Volume MVP | Volume Enterprise |
|--------|-----------|------------------|
| Companies | 5 | 50 |
| Users | 50 | 1 000 |
| Agents | 20 | 200 |
| Issues | 10 000 | 100 000 |
| Audit events | 50 000 | 1 000 000 |
| Chat messages | 5 000 | 50 000 |
| Workflow instances | 200 | 5 000 |

Script de génération : `tests/seed/perf-seed.ts` — génère les données en batch (insert 1000 rows à la fois) pour un temps de seed <30 secondes.

### 7.4 Environnements de Test

| Environnement | DB | Seed | Usage |
|--------------|-----|------|-------|
| `mnm_test` (port 5433) | PostgreSQL 16 tmpfs | Transaction rollback | Tests intégration locaux + CI |
| `mnm_e2e` (port 5434) | PostgreSQL 16 | Seed complet Alpha-Beta | Tests E2E locaux + CI |
| `mnm_perf` (port 5435) | PostgreSQL 16 | Seed volumétrique | Benchmarks k6 |
| `embedded-postgres` | In-process | Minimal | Tests unitaires rapides |

### 7.5 Nettoyage et Réinitialisation

- **Tests unitaires** : aucun nettoyage nécessaire (in-memory)
- **Tests intégration** : transaction rollback automatique (`afterEach`)
- **Tests E2E** : `cy.resetDB()` custom command qui :
  1. Truncate toutes les tables dans l'ordre des FK
  2. Réapplique le seed Alpha-Beta
  3. Durée : <2 secondes
- **Tests performance** : DB recréée avant chaque run de benchmark

---

## 8. Estimation Effort Testing par Epic

### 8.1 Tableau d'Effort Testing

L'effort de test représente typiquement **30-40% de l'effort de développement** pour un projet B2B avec des exigences de sécurité multi-tenant. Pour MnM, le ratio est plus proche de 35% en raison de la criticité du RBAC et de la containerisation.

| Epic | Effort Dev | Effort Test | % du Dev | Breakdown Test |
|------|-----------|------------|----------|----------------|
| **Multi-User (FR-MU)** | 1 semaine | 2.5 jours | 50% | 1j unitaire, 1j intégration, 0.5j E2E |
| **RBAC (FR-RBAC)** | 2 semaines | 5 jours | 50% | 1.5j unitaire (60 tests), 2.5j intégration (88 cas matrice), 1j E2E |
| **Orchestrateur (FR-ORCH)** | 3-5 semaines | 5-7 jours | 35% | 2j unitaire (state machine), 2-3j intégration, 1-2j E2E |
| **Container (FR-CONT)** | 4-5 semaines | 5-7 jours | 35% | 1.5j unitaire, 3j intégration (Docker réel), 1j E2E |
| **Observabilité (FR-OBS)** | 3 semaines | 3-4 jours | 30% | 1j unitaire, 1.5j intégration, 0.5-1j E2E |
| **Chat (FR-CHAT)** | 3 semaines | 3-4 jours | 30% | 1j unitaire, 1.5j intégration (WS), 0.5-1j E2E |
| **Dual-Speed (FR-DUAL)** | 2-3 semaines | 2-3 jours | 25% | 1j unitaire, 1j intégration, 0.5j E2E |
| **Onboarding (FR-ONB)** | 3-4 semaines | 3-4 jours | 25% | 1j unitaire, 1.5j intégration (MSW), 0.5-1j E2E |
| **A2A (FR-A2A)** | 4-5 semaines | 4-5 jours | 25% | 1j unitaire, 2j intégration, 1-2j E2E |
| **Infra Test (Sprint 0)** | N/A | 8 jours | N/A | Stories TEST-001 à TEST-008 |
| **TOTAL** | ~25-37 sem | ~42-50 jours | **~35%** | |

### 8.2 Justification des Ratios Élevés

- **FR-MU et FR-RBAC (50%)** : Le RBAC est le fondement sécurité. Un bug dans `hasPermission()` compromet tout le système. La matrice 22 routes × 4 rôles = 88 tests d'intégration justifie le ratio élevé.
- **FR-CONT (35%)** : La containerisation manipule Docker, les credentials, le filesystem. Chaque test de sécurité container (10 tests d'isolation) protège contre des vecteurs d'attaque réels.
- **FR-DUAL et FR-ONB (25%)** : Logique métier plus simple, moins de surface d'attaque sécurité.

### 8.3 Sprint 0 — Budget Infrastructure de Test

Le Sprint 0 est entièrement dédié à l'infrastructure de test et de développement. Budget test :

| Story | Effort | Dépendances |
|-------|--------|-------------|
| STORY-TEST-001 : Vitest Workspace | 1 jour | Aucune |
| STORY-TEST-002 : Cypress Setup | 2 jours | Aucune |
| STORY-TEST-003 : Test DB Setup | 1.5 jours | Docker Compose |
| STORY-TEST-004 : Factories | 2 jours | Schema DB |
| STORY-TEST-005 : E2E Seed | 1.5 jours | STORY-TEST-003, TEST-004 |
| STORY-TEST-006 : Mock Setup | 1 jour | Aucune |
| STORY-TEST-007 : CI Pipeline | 2 jours | STORY-TEST-001 à TEST-006 |
| STORY-TEST-008 : k6 Benchmarks | 2 jours | STORY-TEST-003 |
| **TOTAL Sprint 0 Test** | **13 jours** | |

**Note** : Les stories TEST-001, TEST-002, TEST-003 et TEST-006 peuvent être parallélisées (jour 1-2). Les stories TEST-004 et TEST-005 dépendent de TEST-003 (jour 2-4). La story TEST-007 agrège tout le reste (jour 4-5). La story TEST-008 peut être décalée au Sprint 1 si nécessaire.

### 8.4 Calendrier Test par Sprint

| Sprint | Focus Test | Effort Test | Tests Écrits |
|--------|-----------|------------|-------------|
| **Sprint 0** | Infrastructure (8 stories) | 8 jours | ~10 tests (smoke + factories) |
| **Sprint 1** | FR-MU + FR-RBAC (unit + intég) | 5 jours | ~160 tests (15+60 unit, 8+88 intég) |
| **Sprint 2** | FR-RBAC E2E + FR-ORCH (unit) | 5 jours | ~90 tests (4 E2E, 80 unit orch) |
| **Sprint 3** | FR-ORCH (intég + E2E) + FR-CONT (unit) | 6 jours | ~75 tests (30 intég, 3 E2E, 40 unit cont) |
| **Sprint 4** | FR-CONT (intég + E2E) + FR-OBS | 6 jours | ~60 tests (25 intég, 2 E2E, 30+15 obs) |
| **Sprint 5** | FR-CHAT + FR-DUAL | 5 jours | ~70 tests (25+20 unit, 15+6 intég, 2+1 E2E) |
| **Sprint 6** | FR-ONB + FR-A2A | 5 jours | ~50 tests (15+15 unit, 8+10 intég, 1+2 E2E) |
| **Sprint 7** | Performance + sécurité transverse | 4 jours | ~20 tests (k6 scenarios + OWASP) |
| **TOTAL** | | **~44 jours** | **~525 tests** |

---

## Résumé

La stratégie de test MnM B2B repose sur trois piliers :

1. **Sécurité d'abord** : le RBAC et la containerisation sont testés avec une couverture de 95%+. La matrice route × rôle (88 cas) est exhaustive. Les 10 tests d'isolation container prouvent les 5 couches Nanoclaw. Les 7 tests d'isolation multi-tenant vérifient que zéro donnée ne fuit entre companies.

2. **Automatisation complète** : le pipeline CI à 7 quality gates bloque tout code qui ne respecte pas les seuils. Les tests de performance sont informatifs sur les PR et bloquants sur master. Le budget infra test (Sprint 0, 8 stories, 13 jours) garantit que l'infrastructure est prête avant le premier code métier.

3. **Pragmatisme** : le ratio test/dev de 35% est adapté à un produit B2B sécurisé sans être excessif. Les epics avec moins de surface d'attaque (Dual-Speed, Onboarding) ont un ratio plus bas (25%). La règle "jamais mocker la DB" assure que les tests reflètent le comportement réel du système.

**Volume total** : ~525 tests (300 unitaires + 205 intégration + 20 E2E) + 31 tests sécurité + 5 scénarios performance + 7 smoke tests pré-deploy.

---


---

*Sprint Planning B2B v2.0 (document consolide) — 7 parties, 7 auteurs — Bob (structure & stories), Winston (sequencage), John (priorisation), Amelia (estimations), Quinn (DoD & QA), Sally (UX), Murat (tests).*
*47 stories, 12+ epics, 7 sprints, 197 SP planifies (MVP CBA), timeline 13 semaines, ~525 tests prevus, 13 criteres DoD, 31 ACs Given/When/Then, 42 edge cases.*
