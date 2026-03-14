# Sprint Planning — Section 5 : Acceptance Criteria, Definition of Done & Quality Gates

*Par Quinn le QA* | Sprint Planning Task #5 | 2026-03-14

---

## 1. Definition of Done — Templates par Niveau

### 1.1 Story DoD (chaque user story)

Une story est considérée DONE lorsque **tous** les critères suivants sont remplis :

| # | Critère | Vérifié par |
|---|---------|-------------|
| S-01 | Le code compile sans erreur TypeScript (`tsc --noEmit`) | CI QG-0 |
| S-02 | Le linter passe sans warning (`eslint --max-warnings 0`) | CI QG-0 |
| S-03 | Les tests unitaires couvrent >=80% du nouveau code | CI QG-1 |
| S-04 | Tous les tests existants passent (0 régression) | CI QG-1 |
| S-05 | Les tests d'intégration couvrent les routes API touchées | CI QG-2 |
| S-06 | L'audit log est émis pour toute mutation (INV-03) | Test intégration |
| S-07 | L'isolation tenant est respectée (companyId filtré, RLS actif) | Test intégration |
| S-08 | Le code est revu par au moins 1 pair | GitHub PR review |
| S-09 | La documentation API (si nouvel endpoint) est à jour | Review |
| S-10 | Pas de secret, clé API ou credential dans le code | CI QG-3 (secret scan) |
| S-11 | Les ACs de la story sont tous vérifiés et passent | QA manuel ou automatisé |
| S-12 | L'UI est responsive >= 768px (si composant frontend) | Cypress viewport test |
| S-13 | Accessible WCAG 2.1 AA (si composant frontend) : labels, contraste, clavier | Axe-core automated |

### 1.2 Epic DoD (chaque epic complétée)

Une epic est DONE lorsque **toutes les stories sont DONE** et en plus :

| # | Critère | Vérifié par |
|---|---------|-------------|
| E-01 | Toutes les stories de l'epic satisfont la Story DoD | QA |
| E-02 | Les tests E2E Cypress couvrent les flux critiques de l'epic | CI QG-5 |
| E-03 | Les tests de sécurité OWASP sont passés pour le périmètre de l'epic | CI QG-3 |
| E-04 | Les tests de performance vérifient les NFRs applicables (API <500ms P95) | CI QG-4 (k6) |
| E-05 | La suite de régression de l'epic est écrite et intégrée au CI | QA + Dev |
| E-06 | L'intégration avec les epics précédentes est vérifiée (pas de régression cross-epic) | Suite régression |
| E-07 | Les edge cases critiques de l'epic sont couverts par des tests | QA review |
| E-08 | La migration DB (si applicable) est réversible et testée | DBA review |
| E-09 | Les permissions RBAC sont auditées sur toutes les routes de l'epic | Test intégration RBAC |

### 1.3 Sprint DoD (chaque sprint complété)

| # | Critère | Vérifié par |
|---|---------|-------------|
| SP-01 | Toutes les stories engagées satisfont la Story DoD | Scrum Master |
| SP-02 | Les 7 smoke tests pré-deploy passent | CI automatisé |
| SP-03 | La couverture de tests globale ne diminue pas par rapport au sprint précédent | CI coverage diff |
| SP-04 | Aucun bug P0 ou P1 ouvert à la fin du sprint | Bug tracker |
| SP-05 | La suite de régression complète passe (toutes les phases antérieures) | CI nightly |
| SP-06 | Le build de production est déployable (`docker compose up` fonctionne) | CI build |
| SP-07 | Les métriques de performance ne se sont pas dégradées (>10% régression = blocage) | k6 comparatif |
| SP-08 | Les vulnérabilités de dépendances sont à jour (`pnpm audit --audit-level moderate`) | CI QG-3 |
| SP-09 | La démo sprint est préparée et exécutable | Scrum Master + PO |

### 1.4 Release DoD (chaque release vers production)

| # | Critère | Vérifié par |
|---|---------|-------------|
| R-01 | Le Sprint DoD est satisfait pour tous les sprints inclus | QA Lead |
| R-02 | Les 7 smoke tests passent sur l'environnement staging | CI staging |
| R-03 | Les tests de charge k6 passent avec les cibles Enterprise (1000 req simultanées) | Performance team |
| R-04 | L'audit de sécurité OWASP ZAP est passé (0 critical, 0 high) | Sécurité |
| R-05 | Les migrations DB sont testées sur une copie de production | DBA |
| R-06 | Le plan de rollback est documenté et testé | Ops |
| R-07 | Le changelog est à jour | PM |
| R-08 | Les tests d'accessibilité WCAG 2.1 AA passent sur tous les écrans | QA |
| R-09 | La conformité RGPD est vérifiée (droit effacement, consentement, export) | DPO |
| R-10 | Zero secret en dur dans le code (scan automatique) | CI secret scan |
| R-11 | Le canary deployment (10% -> 50% -> 100%) est suivi sans erreur | Ops monitoring |

---

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

*Sprint Section 5 — QA Quinn — ~3200 mots — Acceptance Criteria, Definition of Done, Quality Gates, Edge Cases, Regression Strategy.*
*Ce document complète la Section 8 du PRD (prd-section-8-qa-quinn.md) en ajoutant les templates DoD, les ACs Given/When/Then détaillés, et la stratégie de régression par phase.*
