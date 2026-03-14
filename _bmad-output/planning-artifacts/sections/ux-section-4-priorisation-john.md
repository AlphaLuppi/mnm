# Section 4 — Priorisation UX & Alignement PRD

> **Auteur :** John le PM | **Date :** 2026-03-14 | **Sources :** PRD B2B v1.0, Product Brief B2B v2.0
> **Rôle :** Priorisation UX par impact business, alignement User Journeys/FRs, Success Criteria par persona

---

## 1. Priorisation UX par Impact Business

### 1.1 Méthodologie

Chaque expérience UX est évaluée selon deux axes :
- **Impact Business** (1-5) : lien direct avec les 26 Success Criteria du PRD et les KPIs business (ARR, rétention, time-to-value)
- **Effort UX** (1-5) : nombre de composants, pages, interactions complexes, états à designer

Le croisement produit 4 quadrants :
- **Quick Wins** (Impact fort, Effort faible) : livrer en premier
- **Strategic** (Impact fort, Effort fort) : planifier avec soin
- **Nice-to-have** (Impact faible, Effort faible) : intégrer si capacité
- **Defer** (Impact faible, Effort fort) : reporter post-MVP

### 1.2 Phase 1 — Multi-User Livrable (~1 semaine)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Page Membres (tableau, filtres, actions) | 5 | 2 | SC-BIZ-1, SC-BIZ-5, SC-C1 | **Quick Win** |
| Invitation par email (formulaire + lien signé) | 5 | 1 | SC-BIZ-1, SC-C2, SC-BIZ-7 | **Quick Win** |
| Invitation bulk (CSV/liste) | 3 | 2 | SC-C1, SC-C4 | Nice-to-have |
| Sélecteur de Company (multi-company) | 3 | 2 | SC-BIZ-7 | Nice-to-have |
| Sign-out avec feedback visuel | 4 | 1 | SC-BIZ-6 | **Quick Win** |
| Désactivation signup libre (toggle admin) | 4 | 1 | SC-BIZ-1 | **Quick Win** |

**Composants UI requis :** MembersTable, InviteModal, InviteBulkUploader, CompanySelector, SignOutButton
**Pages :** /members, /settings/company

**Verdict Phase 1 :** 4 Quick Wins sur 6 experiences. C'est la phase la plus rentable en ratio impact/effort. Le time-to-value pour CBA (SC-BIZ-5 : <2h) dépend directement de la fluidité de ces écrans.

### 1.3 Phase 2 — RBAC Métier (~2 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Attribution de rôle (Admin/Manager/Contributor/Viewer) | 5 | 2 | SC-BIZ-1, SC-D4, SC-BIZ-4 | **Quick Win** |
| Matrice de permissions visuelle (lecture/écriture) | 5 | 4 | SC-D4, SC-BIZ-6 | **Strategic** |
| Masquage navigation selon permissions | 4 | 3 | SC-BIZ-6, SC-BIZ-4 | **Strategic** |
| Badges couleur par rôle dans l'UI | 2 | 1 | SC-BIZ-6 | Nice-to-have |
| Page admin rôles (presets configurables) | 4 | 3 | SC-D4, SC-BIZ-1 | **Strategic** |
| Feedback visuel "accès refusé" (403 UX) | 3 | 1 | SC-BIZ-6 | **Quick Win** |

**Composants UI requis :** RoleSelector, PermissionMatrix, PermissionEditor, RoleBadge, AccessDeniedPage, NavGuard
**Pages :** /admin/roles, /admin/permissions

**Verdict Phase 2 :** La matrice de permissions est l'experience la plus stratégique. C'est le moment "wow" pour le CTO de CBA — il voit en un coup d'oeil qui peut faire quoi. Impact direct sur SC-D4 (100% validation humaine) et SC-BIZ-1 (POC signé).

### 1.4 Phase 3 — Scoping par Projet (~2-3 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Page d'accès par projet (membres, agents) | 5 | 3 | SC-BIZ-4, SC-C4, SC-A4 | **Strategic** |
| Filtrage sidebar par scope projet | 4 | 3 | SC-BIZ-5, SC-E1 | **Strategic** |
| Assignation agents à un projet | 4 | 2 | SC-A4, SC-D1 | **Quick Win** |
| Vue "mes projets" personnalisée | 3 | 2 | SC-BIZ-5, SC-BIZ-4 | Nice-to-have |
| Indicateur visuel scope actif (breadcrumb) | 3 | 1 | SC-BIZ-6 | Nice-to-have |

**Composants UI requis :** ProjectMembersPanel, ScopeFilter, AgentProjectAssigner, ProjectSwitcher, ScopeBreadcrumb
**Pages :** /project/:id/members, /project/:id/settings

**Verdict Phase 3 :** Le scoping par projet est le pivot vers le vrai multi-tenant. C'est ce qui rend MnM vendable au-delà de CBA. L'experience "page d'accès par projet" est stratégique car elle active SC-C4 (companies avec 3+ niveaux hiérarchiques).

### 1.5 Phase 4 — Enterprise-Grade (~3-4 semaines)

| Experience UX | Impact Business | Effort UX | Success Criteria liés | Quadrant |
|---|---|---|---|---|
| Configuration SSO (formulaire SAML/OIDC) | 5 | 4 | SC-BIZ-2, SC-BIZ-7 | **Strategic** |
| Audit viewer (log immutable, filtres, export) | 5 | 4 | SC-B1, SC-B2, SC-BIZ-1 | **Strategic** |
| Dashboard exécutif CEO (KPIs agrégés) | 5 | 5 | SC-BIZ-3, SC-E1, SC-B3 | **Strategic** |
| Dashboard CTO (drift, santé agents, containers) | 5 | 5 | SC-A2, SC-B5, SC-A1 | **Strategic** |
| Dashboard Dev (board personnel, agent status) | 4 | 3 | SC-E2, SC-E4, SC-BIZ-5 | **Strategic** |
| Dashboard PO/PM (stories, burndown, brainstorm) | 3 | 4 | SC-E3, SC-D2 | Defer |
| Multi-tenant admin (companies, quotas) | 3 | 3 | SC-BIZ-7 | Nice-to-have |

**Composants UI requis :** SSOConfigForm, AuditLogViewer, AuditExportButton, CEODashboard, CTODashboard, DevDashboard, DriftAlertPanel, AgentHealthMonitor, ContainerStatusWidget, TenantAdminPanel
**Pages :** /admin/sso, /audit, /dashboard/ceo, /dashboard/cto, /dashboard/dev, /admin/tenants

**Verdict Phase 4 :** Phase la plus lourde en effort UX mais aussi la plus impactante sur l'ARR (SC-BIZ-2). Les dashboards par rôle sont le "moment de vérité" enterprise — c'est ce qui convertit un POC en contrat annuel.

### 1.6 Matrice de Synthèse — Vue Globale

| Quadrant | Nombre d'experiences | Phases | Action |
|---|---|---|---|
| **Quick Wins** | 8 | Phases 1-2 principalement | Livrer immédiatement, itérer rapidement |
| **Strategic** | 11 | Phases 2-4 | Planifier avec wireframes detaillés, valider avec CBA |
| **Nice-to-have** | 5 | Toutes phases | Intégrer si sprint le permet |
| **Defer** | 1 | Phase 4 | Reporter post-MVP (dashboards PO/PM) |

**Conclusion priorisation :** Les Quick Wins des Phases 1-2 représentent le socle minimum pour le POC CBA (SC-BIZ-1). Les 11 experiences Strategic sont le coeur du produit vendable. Le ratio Quick Wins/Strategic (8/11) confirme que le scope est ambitieux mais réaliste sur 8-10 semaines.

---

## 2. Alignement User Journeys <-> PRD FRs — Matrice de Traçabilité

### 2.1 Matrice FR -> Écrans -> Personas -> Composants UI

| FR | Écrans / Pages | Personas concernés | Composants UI clés |
|---|---|---|---|
| **FR-MU** (Multi-User) | /members, /settings/company, /invite, /auth/signup, /auth/login | CEO, CTO, Admin | MembersTable, InviteModal, InviteBulkUploader, CompanySelector, AuthForms |
| **FR-RBAC** (Roles & Permissions) | /admin/roles, /admin/permissions, toutes pages (NavGuard) | CTO, Admin, Manager | RoleSelector, PermissionMatrix, PermissionEditor, RoleBadge, AccessDeniedPage |
| **FR-ORCH** (Orchestrateur) | /workflow/editor, /workflow/:id/run, /workflow/:id/monitor | CTO, Dev, Lead Tech, PO | WorkflowEditor (drag-and-drop), StepProgressBar, DriftDiffViewer, WorkflowSimulator |
| **FR-OBS** (Observabilité) | /audit, /dashboard/ceo, /dashboard/cto, /dashboard/dev | CEO, CTO, Lead Tech | AuditLogViewer, AuditExportButton, LLMSummaryPanel, DashboardWidgets, MetricsCards |
| **FR-ONB** (Onboarding) | /onboarding/company, /onboarding/team, /import | CEO, CTO, Manager | OnboardingChat, OrgChartBuilder, ImportWizard, CascadeProgressTracker |
| **FR-A2A** (Agent-to-Agent) | /agents/:id/connections, /approvals | Dev, PO, Lead Tech | A2APermissionPanel, ApprovalQueue, AgentConnectionGraph, QueryLogViewer |
| **FR-DUAL** (Dual-Speed) | /settings/automation, /project/:id/settings | CEO, CTO, Dev, Manager | AutomationCursorSlider, HierarchyOverridePanel, TaskClassificationBadge |
| **FR-CHAT** (Chat Temps Réel) | /agent/:id/chat, panel intégré dans /workflow/:id/run | Dev, PO, QA | AgentChatPanel, MessageBubble, ChatInput, ReconnectionIndicator, ReadOnlyBadge |
| **FR-CONT** (Containerisation) | /admin/containers, /agent/:id/container | CTO, Lead Tech, Admin | ContainerProfileEditor, ContainerStatusWidget, CredentialProxyConfig, ResourceLimitsForm |

### 2.2 Couverture des Personas par FR

| Persona | FRs primaires | FRs secondaires | Nombre d'écrans dédiés |
|---|---|---|---|
| **CEO** | FR-ONB, FR-OBS | FR-MU, FR-DUAL | 3 (onboarding, dashboard CEO, import) |
| **CTO / DSI** | FR-ORCH, FR-RBAC, FR-CONT, FR-OBS | FR-MU, FR-DUAL, FR-A2A | 6 (workflow editor, dashboard CTO, admin roles, SSO, containers, drift monitor) |
| **DPO** | FR-OBS, FR-ORCH | FR-A2A | 2 (dashboard inter-équipes, roadmap) |
| **PM** | FR-ONB, FR-DUAL | FR-A2A, FR-CHAT | 2 (brainstorm, roadmap) |
| **PO** | FR-ORCH, FR-CHAT, FR-A2A | FR-DUAL | 3 (stories board, agent chat, approbations) |
| **Designer** | FR-ORCH | FR-CHAT, FR-A2A | 1 (notifications workflow) |
| **Développeur** | FR-CHAT, FR-ORCH, FR-DUAL | FR-A2A, FR-OBS | 4 (board perso, agent chat, workflow run, dashboard dev) |
| **QA / Testeur** | FR-ORCH, FR-CHAT | FR-OBS | 2 (test workflow, capture savoir) |
| **Lead Tech** | FR-ORCH, FR-OBS, FR-CONT | FR-RBAC, FR-A2A | 4 (dashboard matin, code review, dette technique, containers) |

### 2.3 Gaps de Traçabilité Identifiés

| Gap | FR concerné | Impact | Recommandation |
|---|---|---|---|
| FR-ONB n'a pas d'écran dédié pour la cascade hiérarchique visualisée | FR-ONB | Moyen — le CEO ne voit pas la progression d'onboarding de son org | Ajouter un OrgOnboardingTracker dans le dashboard CEO |
| FR-DUAL n'a pas de feedback visuel sur le plafond hiérarchique actif | FR-DUAL | Moyen — l'utilisateur ne comprend pas pourquoi il ne peut pas monter le curseur | Ajouter un tooltip "Plafond défini par [Rôle]" sur le curseur |
| FR-A2A manque une vue "graph de connexions" entre agents | FR-A2A | Faible — Phase post-MVP | Prévoir le composant AgentConnectionGraph pour Phase 4+ |
| Le Designer n'a qu'un seul écran dédié | Transverse | Faible — le Designer utilise principalement des outils externes | Notifications push + intégration Figma en post-MVP |

---

## 3. UX Success Criteria par Persona

### 3.1 CEO — Le Pilote Stratégique

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier dashboard fonctionnel avec données | <48h après signup |
| **Fréquence d'usage** | Consultation dashboard | 2-3x par semaine |
| **Actions principales** | Consulter KPIs, poser une question stratégique, valider cascade | |
| **Actions secondaires** | Inviter managers, ajuster priorités, consulter audit | |
| **Task completion rate** | Onboarding complet (structure + invitations) | >85% |
| **Error rate** | Erreurs pendant l'onboarding conversationnel | <5% |
| **Satisfaction (CSAT)** | Satisfaction dashboard exécutif | >4.0/5 |
| **Wow moment** | "J'ouvre le dashboard et je vois toute mon organisation en un coup d'oeil — agents actifs, projets en cours, alertes. Comme un cockpit d'avion." |

### 3.2 CTO / DSI — Le Garant Technique

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier workflow déterministe fonctionnel | <4h après onboarding |
| **Fréquence d'usage** | Monitoring + config | Quotidien (5-10 min/jour) |
| **Actions principales** | Créer/éditer workflows, monitorer drift, configurer SSO, reviewer containers | |
| **Actions secondaires** | Définir permissions, consulter audit, ajuster sensibilité drift | |
| **Task completion rate** | Création workflow complet (étapes + prompts + fichiers) | >90% |
| **Error rate** | Erreurs de configuration workflow | <3% |
| **Satisfaction (CSAT)** | Satisfaction drift detection et monitoring | >4.2/5 |
| **Wow moment** | "Un agent a dévié de son workflow. J'ai reçu l'alerte en 5 minutes, j'ai vu le diff attendu vs observé, et j'ai relancé en un clic. Avant, on ne l'aurait jamais su." |

### 3.3 Développeur — L'Artisan du Code

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier agent lancé sur une story | <30 min après premier login |
| **Fréquence d'usage** | Travail quotidien avec agent | Quotidien (continu pendant les heures de dev) |
| **Actions principales** | Lancer agent, piloter en temps réel via chat, reviewer code, merger | |
| **Actions secondaires** | Ajuster curseur automatisation, consulter contexte inter-agents | |
| **Task completion rate** | Story livrée avec agent (de sélection à merge) | >80% |
| **Error rate** | Interventions manuelles nécessaires pendant exécution agent | <15% |
| **Satisfaction (CSAT)** | Satisfaction dialogue temps réel avec agent | >4.0/5 |
| **Wow moment** | "Je lance mon agent sur la story, je vois le code s'écrire en live, je lui dis 'Utilise le pattern Repository' en chat, et il ajuste immédiatement. C'est comme un pair programmer ultra-rapide." |

### 3.4 PO — Le Traducteur de Besoins

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Première story générée et validée par agent | <1h après onboarding |
| **Fréquence d'usage** | Validation stories, enrichissement savoir | Quotidien (30-60 min/jour) |
| **Actions principales** | Valider stories générées, enrichir le savoir tacite, approuver A2A | |
| **Actions secondaires** | Décomposer epics via brainstorm, consulter burndown | |
| **Task completion rate** | Stories validées sans retour à l'agent | >70% |
| **Error rate** | Stories rejetées nécessitant re-generation | <20% |
| **Satisfaction (CSAT)** | Gain de temps perçu sur la mise en forme | >4.0/5 |
| **Wow moment** | "L'agent a écrit 5 stories à partir de l'epic. J'ai juste validé et ajusté les acceptance criteria. En 15 minutes au lieu de 2 heures." |

### 3.5 PM — Le Stratège Produit

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier brainstorm structuré avec output exploitable | <2h après premier login |
| **Fréquence d'usage** | Sessions de brainstorm, suivi roadmap | 3-4x par semaine |
| **Actions principales** | Brainstormer avec agent, transformer en epics, consulter roadmap | |
| **Actions secondaires** | Analyser conflits roadmap, ajuster priorités | |
| **Task completion rate** | Brainstorm → epic structurée en une session | >75% |
| **Error rate** | Output brainstorm inutilisable | <10% |
| **Satisfaction (CSAT)** | Inversion du ratio exécution/réflexion | >4.2/5 |
| **Wow moment** | "J'ai brainstormé 30 minutes avec l'agent. Il a challengé mes hypothèses, structuré mes idées, et proposé 3 epics avec KPIs. Mon ancien process prenait une semaine." |

### 3.6 Lead Tech — Le Gardien de l'Architecture

| Dimension | Critère | Cible |
|---|---|---|
| **Time-to-value** | Premier dashboard matin avec dette technique + reviews | <1h après config |
| **Fréquence d'usage** | Dashboard quotidien, reviews augmentées | Quotidien (15-30 min/jour) |
| **Actions principales** | Consulter dashboard matin (dette, reviews, drift, couverture), reviewer MR augmentées | |
| **Actions secondaires** | Définir workflows dette technique, monitorer patterns | |
| **Task completion rate** | Code reviews completées avec annotations agent | >90% |
| **Error rate** | Faux positifs dans les alertes drift/patterns | <10% |
| **Satisfaction (CSAT)** | Réduction temps passé sur le mécanique (scrum, reviews basiques) | >4.0/5 |
| **Wow moment** | "Mon dashboard matin me montre : 3 reviews pré-analysées, 1 alerte drift, dette technique en baisse de 12%. En 10 minutes, j'ai la vision complète. Avant, ça me prenait 2 heures de scrum." |

### 3.7 Synthèse Time-to-Value par Persona

| Persona | Time-to-Value cible | Première action à valeur | Fréquence |
|---|---|---|---|
| CEO | <48h | Dashboard exécutif avec données réelles | 2-3x/semaine |
| CTO | <4h | Premier workflow déterministe actif | Quotidien |
| Dev | <30 min | Agent lancé sur une story | Continu |
| PO | <1h | Story validée générée par agent | Quotidien |
| PM | <2h | Brainstorm structuré exploitable | 3-4x/semaine |
| Lead Tech | <1h | Dashboard matin opérationnel | Quotidien |

---

## 4. Roadmap UX

### 4.1 Phase 1 — Écrans Multi-User (Semaine 1)

**Objectif :** Permettre au CEO CBA d'inviter son équipe et de voir les membres.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Membres** (/members) | MembersTable, StatusBadge, SearchFilter, BulkActionBar | P0 | 2j |
| **Modal Invitation** | InviteModal (email, rôle, message personnalisé), InviteBulkUploader | P0 | 1j |
| **Page Auth refactorée** | LoginForm, SignupForm (désactivable), SignOutButton | P0 | 1j |
| **Sélecteur Company** | CompanySelector (dropdown header) | P1 | 0.5j |
| **Settings Company** | CompanySettingsForm (toggle signup, nom, logo) | P0 | 0.5j |

**Total Phase 1 :** ~5 composants majeurs, 3 pages, 5 jours de design UX.

**Critère de succès Phase 1 :** Le CEO CBA peut inviter 5 personnes par email, voir la liste des membres, et les invités peuvent se connecter et accéder à l'app.

### 4.2 Phase 2 — Écrans RBAC (Semaines 2-3)

**Objectif :** Le CTO CBA peut attribuer des rôles et voir la matrice de permissions.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Admin Rôles** (/admin/roles) | RoleList, RolePresetSelector, RoleDetailPanel | P0 | 2j |
| **Matrice Permissions** (/admin/permissions) | PermissionMatrix (grille FR x Rôle), PermissionToggle, ScopeSelector | P1 | 3j |
| **RoleSelector intégré** | RoleSelector (dropdown dans MembersTable et InviteModal) | P0 | 0.5j |
| **NavGuard** | Composant invisible : masque les liens/boutons selon permissions | P1 | 1j |
| **Page 403** | AccessDeniedPage (message clair, bouton retour, lien contact admin) | P0 | 0.5j |
| **Badges rôle** | RoleBadge (couleur par rôle : rouge/bleu/vert/gris) | P2 | 0.5j |

**Total Phase 2 :** ~8 composants majeurs, 2 pages + intégrations, 7.5 jours de design UX.

**Critère de succès Phase 2 :** Un Viewer ne peut accéder qu'aux pages autorisées. Le CTO voit la matrice complète. Les routes API retournent 403 pour les accès non-autorisés.

### 4.3 Phase 3 — Écrans Scoping Projet (Semaines 4-6)

**Objectif :** Isolation par projet avec membres et agents assignés.

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Page Membres Projet** (/project/:id/members) | ProjectMembersPanel, MemberRoleInProject, AddMemberToProject | P0 | 2j |
| **Filtrage Sidebar** | ScopeFilter (projets accessibles uniquement), ProjectSwitcher | P0 | 2j |
| **Assignation Agents** | AgentProjectAssigner (drag-and-drop ou select), AgentScopeIndicator | P0 | 1.5j |
| **Breadcrumb Scope** | ScopeBreadcrumb (Company > Projet > Écran actuel) | P1 | 0.5j |
| **Vue Mes Projets** (/projects/mine) | ProjectGrid, ProjectCard (métriques résumées), EmptyState | P1 | 1.5j |

**Total Phase 3 :** ~8 composants majeurs, 2 pages + intégrations sidebar, 7.5 jours de design UX.

**Critère de succès Phase 3 :** Un Contributor sur le Projet A ne voit pas les données du Projet B. La sidebar ne montre que les projets accessibles. Les agents sont assignés à des projets spécifiques.

### 4.4 Phase 4 — Écrans Enterprise (Semaines 7-10)

**Objectif :** SSO, audit complet, dashboards par rôle — le "vendable enterprise".

| Écran | Composants clés | Priorité | Effort |
|---|---|---|---|
| **Config SSO** (/admin/sso) | SSOConfigForm (SAML/OIDC), TestConnectionButton, SSOStatusBadge | P1 | 2j |
| **Audit Viewer** (/audit) | AuditLogViewer (timeline + filtres), AuditDetailPanel, AuditExportButton (CSV/JSON) | P0 | 3j |
| **Dashboard CEO** (/dashboard/ceo) | KPICards (avancement BU, agents actifs, alertes), OrgOverviewChart, QuestionInput (query stratégique) | P1 | 4j |
| **Dashboard CTO** (/dashboard/cto) | DriftAlertPanel, AgentHealthMonitor, ContainerStatusWidget, CompactionMetrics, WorkflowComplianceChart | P1 | 4j |
| **Dashboard Dev** (/dashboard/dev) | PersonalBoard (stories assignées), AgentStatusWidget, QuickLaunchButton, RecentActivity | P1 | 2j |
| **Workflow Editor** (/workflow/editor) | WorkflowCanvas (drag-and-drop), StepConfigPanel, PromptEditor, FileRequirementsList, WorkflowSimulator | P1 | 5j |
| **Drift Monitor** (/workflow/:id/drift) | DriftDiffViewer (attendu vs observé), DriftTimeline, ActionButtons (recharger/kill/ignorer) | P1 | 2j |

**Total Phase 4 :** ~20 composants majeurs, 6 pages, 22 jours de design UX.

**Critère de succès Phase 4 :** Le CEO CBA ouvre son dashboard et comprend l'état de son organisation en <30 secondes. Le CTO configure SSO en <15 minutes. L'audit log montre toutes les actions des 3 derniers mois.

### 4.5 Vue d'Ensemble Roadmap UX

```
Semaine   1    2    3    4    5    6    7    8    9    10
          ├────┤
          Phase 1 : Multi-User
          [5 composants, 3 pages]
               ├─────────┤
               Phase 2 : RBAC
               [8 composants, 2 pages]
                         ├──────────────┤
                         Phase 3 : Scoping
                         [8 composants, 2 pages]
                                        ├────────────────────┤
                                        Phase 4 : Enterprise
                                        [20 composants, 6 pages]

Total : ~41 composants UI, 13 pages, ~42 jours de design UX
```

### 4.6 Composants Transverses (Design System)

Ces composants sont utilisés dans plusieurs phases et doivent etre designés en amont :

| Composant | Utilisé dans | Priorité |
|---|---|---|
| DataTable (tri, filtres, pagination, actions bulk) | MembersTable, AuditLogViewer, ProjectList | P0 — Phase 1 |
| Modal (confirmation, formulaire, détail) | InviteModal, RoleDetail, AuditDetail | P0 — Phase 1 |
| Badge (statut, rôle, scope) | RoleBadge, StatusBadge, ScopeBadge | P0 — Phase 1 |
| Sidebar (navigation scopée) | ScopeFilter, NavGuard | P0 — Phase 1 |
| DashboardCard (KPI, métrique, alerte) | Tous dashboards Phase 4 | P1 — Phase 3 |
| DragAndDrop (réordonner, assigner) | WorkflowEditor, AgentAssigner | P1 — Phase 3 |
| ChatPanel (messages, input, reconnexion) | AgentChatPanel | P1 — Phase 3 |
| DiffViewer (attendu vs observé) | DriftDiffViewer, CodeReviewPanel | P1 — Phase 4 |

### 4.7 Dépendances UX Critiques

| Dépendance | Impact | Mitigation |
|---|---|---|
| Design System (tokens, composants de base) doit etre pret avant Phase 1 | Bloquant | Sprint 0 de 2-3 jours pour tokens + composants de base |
| La matrice de permissions Phase 2 dépend du modèle RBAC backend | Bloquant | Designer et backend en parallèle, contrat API défini en amont |
| Les dashboards Phase 4 dépendent des données d'observabilité | Partiellement bloquant | Dashboards avec données mockées d'abord, real data ensuite |
| Le WorkflowEditor est le composant le plus complexe (5j) | Risque planning | Prototyper l'interaction dès Phase 2, implémenter en Phase 4 |

---

## Conclusion — Recommandations PM

### Priorité absolue (POC CBA, Semaines 1-3)
1. **Quick Wins Phase 1** — Page Membres + Invitations + Auth = le minimum pour que CBA puisse utiliser MnM avec 5+ personnes
2. **RBAC Phase 2** — Attribution de rôles + matrice permissions = la preuve que MnM gère les accès enterprise

### Priorité haute (MVP vendable, Semaines 4-6)
3. **Scoping Phase 3** — Isolation par projet = le prérequis pour le multi-projet enterprise
4. **Design System Sprint 0** — Les composants transverses (DataTable, Modal, Badge, Sidebar) conditionnent la vélocité de toutes les phases

### Priorité stratégique (Contrat annuel, Semaines 7-10)
5. **Audit Viewer** — L'argument compliance #1 pour les entreprises
6. **Dashboard CTO** — Le "daily driver" qui rend MnM indispensable
7. **Dashboard CEO** — Le "wow moment" qui convainc le budget

### KPI de suivi pour cette roadmap UX
- **Couverture persona** : Chaque persona a au moins 1 écran dédié à la fin de Phase 2, 2+ à la fin de Phase 4
- **Ratio Quick Wins livrés** : 100% des Quick Wins Phase 1-2 livrés en semaine 3
- **Time-to-first-value CBA** : CEO fonctionnel en <48h, CTO en <4h, Dev en <30 min
- **Nombre de composants réutilisables** : >60% des composants utilisés dans 2+ contextes

---

*Section 4 — ~2200 mots — John le PM — Priorisation UX, Traçabilité FR, Success Criteria par Persona, Roadmap UX*
*Sources : PRD B2B v1.0 (26 Success Criteria, 9 FR groupes, 4 phases), Product Brief B2B v2.0 (9 Personas, 5 Noyaux de Valeur)*
