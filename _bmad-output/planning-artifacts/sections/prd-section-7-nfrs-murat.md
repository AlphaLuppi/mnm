# Section PRD — NFRs Testables, Quality Gates, Acceptance Criteria & Performance Benchmarks

**Auteur :** Murat, Test Architect
**Source :** Product Brief B2B v2.0, 23 REQs formels, 57 vérités fondamentales, architecture existante (38 tables, 31 services, 22 routes)
**Date :** 2026-03-13

---

## 1. Exigences Non-Fonctionnelles Testables (NFRs)

Chaque NFR ci-dessous est formulé avec un identifiant unique, un seuil mesurable quantifié, et un scénario de test automatisable au format Given/When/Then. Les seuils sont dérivés des métriques de succès du Product Brief (section 2.4) et des contraintes architecturales (section 6).

---

### 1.1 Performance

**NFR-PERF-01 — Temps de réponse API REST (P95 < 200ms)**

Les 22 routes Express identifiées dans le codebase DOIVENT répondre en moins de 200ms au 95e percentile sous charge nominale.

```gherkin
Given 100 utilisateurs concurrents authentifiés
  And chaque utilisateur envoie des requêtes GET et POST
    aux endpoints critiques (/api/issues, /api/workflows,
    /api/agents, /api/companies, /api/audit-logs)
When le test de charge s'exécute pendant 5 minutes en continu
Then 95% des réponses arrivent en moins de 200ms
  And 99% des réponses arrivent en moins de 500ms
  And aucune réponse ne dépasse 1000ms
  And le taux d'erreur 5xx est de 0%
```

- **Outil :** k6 ou Grafana k6 Cloud avec scénarios par endpoint.
- **Fréquence :** À chaque release candidate et en monitoring continu en production.

**NFR-PERF-02 — Temps de chargement UI (FCP < 2s)**

Le First Contentful Paint DOIT être inférieur à 2 secondes sur les 4 pages critiques : Dashboard, Board (Kanban), Page agents, Workflow editor.

```gherkin
Given un navigateur Chrome émulant une connexion 4G
  (RTT 150ms, débit descendant 1.6 Mbps)
  And le cache navigateur est vide (first visit)
When l'utilisateur navigue vers le dashboard principal
Then le First Contentful Paint (FCP) est inférieur à 2 secondes
  And le Largest Contentful Paint (LCP) est inférieur à 3 secondes
  And le Cumulative Layout Shift (CLS) est inférieur à 0.1
  And le Time to Interactive (TTI) est inférieur à 4 secondes
```

- **Outil :** Lighthouse CI intégré au pipeline GitHub Actions.
- **Seuil bloquant :** Performance score Lighthouse > 90.

**NFR-PERF-03 — Latence WebSocket temps réel (< 100ms P95)**

Les messages WebSocket — événements agent, heartbeat, chat humain-agent, alertes drift — DOIVENT être délivrés en moins de 100ms du serveur au client.

```gherkin
Given 50 connexions WebSocket actives sur une même instance
  And chaque connexion est authentifiée et abonnée aux événements
    de sa company
When un événement agent (heartbeat, status change, output)
  est émis côté serveur
Then 95% des clients abonnés reçoivent le message en moins de 100ms
  And 100% des clients le reçoivent en moins de 500ms
  And aucun message n'est perdu (delivery guarantee at-least-once)
```

- **Outil :** Benchmark custom avec timestamps NTP-synchronisés, métriques Prometheus histogram.

**NFR-PERF-04 — Temps de lancement container agent**

Un container Docker éphémère DOIT démarrer et être prêt à recevoir des commandes en moins de 2 secondes (warm) ou 5 secondes (cold).

```gherkin
Given une image agent Docker de ~500MB
  And l'image est pré-pullée localement (scénario warm)
When le ContainerManager crée et démarre un nouveau container
  avec les mounts, le credential proxy, et le réseau configurés
Then le container est opérationnel (healthcheck pass) en moins de 2 secondes
  And le credential proxy handshake est complété en moins de 200ms
  And la connexion WebSocket bidirectionnelle est établie en moins de 300ms

Given une image agent Docker qui n'est PAS présente localement (cold)
When le ContainerManager pull, crée et démarre le container
Then le container est opérationnel en moins de 5 secondes
```

**NFR-PERF-05 — Temps de détection de drift**

La drift detection DOIT alerter dans les délais suivants : moins de 15 minutes (cible MVP à 3 mois), moins de 2 minutes (cible enterprise à 12 mois).

```gherkin
Given un workflow déterministe "Dev Story" avec 5 étapes définies
  And un agent en cours d'exécution à l'étape 3
When l'agent exécute une action non prévue par l'étape 3
  (fichier hors allowlist, appel API non autorisé, skip d'étape)
Then une alerte drift de type WARNING est émise en moins de 15 minutes
  And l'alerte contient : agent ID, workflow ID, étape attendue,
    action déviante, timestamp, severity
  And l'événement est enregistré dans l'audit log
  And une notification WebSocket est envoyée au dashboard du CTO/Lead
```

**NFR-PERF-06 — Temps de requête audit log (< 500ms pour 1M+ entrées)**

Les requêtes d'audit log filtrées sur les 30 derniers jours DOIVENT retourner en moins de 500ms, même avec plus d'un million d'entrées en base.

```gherkin
Given une base PostgreSQL contenant 1 000 000 entrées dans audit_log
  And les entrées sont réparties sur 12 mois pour 5 companies
When un administrateur filtre par company_id + date range (30 jours)
  + event_type avec pagination (limit 50, offset 0)
Then les résultats sont retournés en moins de 500ms
  And le plan d'exécution utilise les index (vérifié par EXPLAIN ANALYZE,
    pas de sequential scan)
  And la pagination fonctionne sans dégradation jusqu'à l'offset 10000
```

**NFR-PERF-07 — Latence observabilité temps réel (< 5s cible 3 mois, < 2s cible 12 mois)**

Le résumé LLM temps réel de l'activité d'un agent (REQ-OBS-01) DOIT être généré et affiché en moins de 5 secondes après chaque action significative de l'agent.

```gherkin
Given un agent en cours d'exécution dans un container
  And le service d'observabilité est actif
When l'agent effectue une action significative (lecture fichier,
  écriture code, appel API, changement d'étape)
Then un résumé en langage naturel est généré en moins de 5 secondes
  And le résumé est poussé via WebSocket au dashboard de supervision
  And le résumé inclut : action, fichiers en contexte, étape courante,
    progression estimée
```

---

### 1.2 Sécurité

**NFR-SEC-01 — Couverture OWASP Top 10 (zéro vulnérabilité HIGH/CRITICAL)**

L'application DOIT être exempte de toute vulnérabilité HIGH ou CRITICAL selon le référentiel OWASP Top 10 2021.

```gherkin
Given l'application MnM déployée en environnement staging
  And la configuration est identique à la production
When un scan DAST complet est exécuté avec OWASP ZAP
  couvrant les 10 catégories (A01 à A10)
Then aucune alerte de niveau HIGH ou CRITICAL n'est détectée
  And les alertes MEDIUM sont documentées avec plan de remédiation
  And le rapport est archivé avec date et hash de commit
```

Catégories spécifiquement testées dans le contexte MnM :
- **A01-Broken Access Control :** RBAC, isolation multi-tenant, scoping par projet.
- **A02-Crypto Failures :** Secrets versionnés (4 providers), credential proxy.
- **A03-Injection :** Drizzle ORM (parameterized queries par design), validation input.
- **A05-Security Misconfiguration :** Headers HTTP, CORS, rate limiting.
- **A07-XSS :** React (échappement par défaut), sanitisation des inputs utilisateur.
- **A09-Logging :** Audit log ne contient JAMAIS de secrets ou données sensibles.
- **A10-SSRF :** Credential proxy comme unique point de sortie réseau des containers.

**NFR-SEC-02 — Isolation multi-tenant (zéro accès cross-company)**

Aucun utilisateur NE DOIT pouvoir accéder aux données d'une company dont il n'est pas membre. Cette exigence est absolue : zéro tolérance, zéro exception.

```gherkin
Given User-A est membre de Company-Alpha
  And User-B est membre de Company-Beta
  And les deux companies ont des issues, agents, workflows, et projets
When User-A envoie une requête GET/PUT/DELETE à chacun des 22 endpoints
  avec un resource_id appartenant à Company-Beta
Then CHAQUE réponse a le statut 403 Forbidden
  And le body ne contient AUCUNE donnée de Company-Beta
    (pas de leak via message d'erreur)
  And CHAQUE tentative est enregistrée dans l'audit log
    avec type "access_denied_cross_tenant"
  And l'inverse est aussi vrai (User-B ne peut pas accéder à Company-Alpha)
```

- **Couverture :** Matrice automatisée (22 endpoints x 2 directions x 4 rôles = 176 tests minimum).
- **Implémentation :** PostgreSQL Row-Level Security + middleware Express companyId check.

**NFR-SEC-03 — Credential Proxy et isolation des secrets**

Les agents containerisés NE DOIVENT JAMAIS avoir accès direct aux credentials. Tous les accès aux services externes passent obligatoirement par le credential proxy HTTP de MnM.

```gherkin
Given un agent lancé dans un container Docker éphémère (--rm)
  And le container est configuré avec shadow .env (/dev/null)
  And le réseau du container est restreint au credential proxy uniquement
When l'agent tente de lire les variables d'environnement
Then aucune clé API, token, ou credential n'est trouvée

When l'agent tente un accès réseau direct vers un service externe
  (GitHub API, OpenAI, base de données)
Then la connexion est refusée par les règles iptables du container

When l'agent utilise le credential proxy HTTP pour accéder à un service
Then le proxy vérifie les permissions de l'agent (allowlist par workflow)
  And le proxy injecte les credentials côté serveur (jamais exposées à l'agent)
  And l'appel est logué dans l'audit log avec : agent_id, service, endpoint, timestamp
```

**NFR-SEC-04 — Container Isolation : 5 couches de défense en profondeur**

Chaque container agent DOIT implémenter les 5 couches de sécurité validées par le pattern Nanoclaw.

```gherkin
# Couche 1 : Container éphémère
Given un agent a terminé son exécution (succès, échec, ou timeout)
When le ContainerManager nettoie le container
Then le container est détruit (--rm), aucun artefact ne persiste sur le host
  And la vérification `docker ps -a` ne montre plus le container

# Couche 2 : Mount allowlist tamper-proof
Given un workflow définit les fichiers autorisés [file1.ts, file2.ts]
When le container est créé
Then SEULS les fichiers de l'allowlist sont montés en lecture seule
  And l'allowlist est stockée en PostgreSQL (pas dans le container)
  And toute tentative d'accès hors allowlist échoue avec ENOENT

# Couche 3 : Credential proxy (voir NFR-SEC-03)

# Couche 4 : Shadow .env
Given le répertoire de travail contient un fichier .env avec des secrets
When le container est créé
Then le .env réel est remplacé par un mount vers /dev/null
  And `cat .env` dans le container retourne un fichier vide

# Couche 5 : Réseau isolé
Given un container agent en exécution
When le container tente une connexion TCP/UDP vers une IP externe
Then la connexion est refusée SAUF vers le credential proxy (localhost:PROXY_PORT)
```

**NFR-SEC-05 — Authentification, sessions et révocation**

Les sessions DOIVENT être stockées en base de données (Better Auth), avec expiration configurable et révocation immédiate.

```gherkin
Given un utilisateur authentifié avec une session valide
  And la session est stockée dans la table sessions de PostgreSQL
When un administrateur révoque cette session via l'API /api/sessions/:id/revoke
Then la session est marquée comme révoquée en base
  And la prochaine requête de l'utilisateur retourne 401 Unauthorized
  And le délai entre la révocation et le rejet effectif est inférieur à 1 seconde
  And l'événement de révocation est tracé dans l'audit log
```

**NFR-SEC-06 — SSO SAML/OIDC (Tier Enterprise)**

Le SSO DOIT supporter SAML 2.0 et OpenID Connect avec les 3 principaux Identity Providers enterprise.

```gherkin
Given une company Enterprise configurée avec SSO SAML via Azure AD
  And le mapping de rôles est défini (Azure AD groups -> MnM roles)
When un utilisateur se connecte via le flux SSO (SP-initiated)
Then l'authentification réussit en moins de 3 secondes
  And le rôle MnM est correctement assigné selon le mapping
  And la session est créée en base avec metadata SSO (IdP, assertion_id)
  And l'audit log enregistre l'événement avec type "sso_login"
  And le même flux fonctionne avec Okta et Google Workspace
```

---

### 1.3 Scalabilité

**NFR-SCALE-01 — Agents concurrents (50 -> 500)**

Le système DOIT supporter 50 containers agent concurrents (MVP 3 mois) et 500 containers concurrents (Enterprise 12 mois) sans dégradation de service.

```gherkin
Given une instance MnM avec les ressources de production (MVP: 4 vCPU, 16GB RAM)
When 50 containers agent sont lancés simultanément
  And chaque agent exécute un workflow actif avec heartbeat et WebSocket
Then tous les 50 containers fonctionnent sans erreur OOM ou timeout
  And la latence API reste conforme à NFR-PERF-01 (<200ms P95)
  And l'utilisation CPU reste sous 80%
  And l'utilisation mémoire reste sous 85%
  And les connexions PostgreSQL restent sous 80% du pool max

Given une instance MnM Enterprise (16 vCPU, 64GB RAM, PG partitionné)
When 500 containers agent sont lancés simultanément
Then les mêmes critères sont respectés
```

- **Métriques Prometheus :** `mnm_active_containers`, `mnm_container_cpu_percent`, `mnm_pg_connections_active`.

**NFR-SCALE-02 — Utilisateurs concurrents (100 -> 1000)**

```gherkin
Given un environnement de staging dimensionné comme la production
When 100 utilisateurs simulés naviguent simultanément
  avec un mix réaliste (40% dashboard, 30% board, 20% agent view, 10% admin)
  And chaque utilisateur effectue 1 action par seconde en moyenne
Then le temps de réponse API reste conforme à NFR-PERF-01
  And aucune erreur HTTP 5xx n'est observée
  And les connexions WebSocket restent stables (pas de déconnexion)
  And le même test avec 1000 utilisateurs passe sur l'infra Enterprise
```

**NFR-SCALE-03 — Volume de données (1M -> 100M lignes)**

```gherkin
Given une base PostgreSQL avec 100M lignes dans audit_log
  And 500k lignes dans issues, 10k workflows, 5k agents
  And le partitioning par date est activé sur audit_log et events
When les requêtes typiques sont exécutées
  (filtrage par company + date range + type, avec pagination)
Then les SELECT filtrés retournent en moins de 1 seconde
  And les INSERT unitaires restent sous 5ms
  And EXPLAIN ANALYZE confirme l'utilisation des index et partitions
  And aucun sequential scan n'apparaît sur les tables partitionnées
```

**NFR-SCALE-04 — Connexions WebSocket simultanées (500+)**

```gherkin
Given 500 clients WebSocket connectés et authentifiés
  And répartis sur 10 companies différentes
When un événement broadcast est émis pour une company (50 clients)
Then 95% des clients de cette company reçoivent le message en moins de 200ms
  And les clients des 9 autres companies ne reçoivent PAS le message
  And le serveur gère les 500 connexions avec moins de 500MB de mémoire
```

---

### 1.4 Disponibilité

**NFR-AVAIL-01 — Uptime SLA 99.9%**

Le Tier Enterprise SaaS DOIT garantir 99.9% d'uptime mensuel, soit moins de 43 minutes de downtime par mois.

```gherkin
Given un monitoring synthétique (Pingdom/UptimeRobot)
  vérifiant /health et /api/status toutes les 30 secondes
When le service est en production
Then le taux de disponibilité mensuel est supérieur ou égal à 99.9%
  And toute indisponibilité de plus de 60 secondes déclenche une alerte PagerDuty
  And un rapport de disponibilité mensuel est généré automatiquement
```

**NFR-AVAIL-02 — Recovery Time Objective (RTO < 1 heure)**

```gherkin
Given un incident majeur simulé (crash serveur, corruption base de données)
When la procédure de disaster recovery est déclenchée
Then le service est restauré et fonctionnel en moins de 1 heure
  And la cohérence des données est vérifiée (checksums, intégrité référentielle)
  And les containers agent en cours sont redémarrés avec reprise de contexte
  And un post-mortem est documenté dans les 24 heures
```

- **Procédure :** Documentée dans un runbook, testée trimestriellement via chaos engineering (kill random pod, corrupt WAL, network partition).

**NFR-AVAIL-03 — Data Durability 99.999%**

```gherkin
Given le backup automatique PostgreSQL est configuré
  (WAL archiving continu, snapshots journaliers)
When une restauration point-in-time (PITR) est effectuée
  à un timestamp choisi dans les 30 derniers jours
Then 100% des données jusqu'au point de recovery sont présentes
  And l'intégrité référentielle est vérifiée (foreign keys, contraintes)
  And le delta entre le point de recovery et la dernière transaction
    est inférieur à 5 minutes (RPO)
```

**NFR-AVAIL-04 — Graceful Degradation**

Si un service non-critique tombe, le coeur du système DOIT continuer de fonctionner.

```gherkin
Given le service de drift detection est arrêté (crash ou maintenance)
When un utilisateur lance un workflow normalement
Then le workflow s'exécute correctement (orchestration déterministe fonctionne)
  And le dashboard affiche un bandeau "Mode dégradé : drift detection indisponible"
  And l'audit log continue d'enregistrer les événements
  And une alerte opérationnelle est envoyée à l'équipe

# Services critiques (JAMAIS de dégradation tolérée) :
#   - API REST, Auth, RBAC, Orchestration, PostgreSQL, WebSocket
# Services non-critiques (dégradation gracieuse) :
#   - Drift detection, résumé LLM observabilité, import Jira/Linear,
#     notifications email
```

---

### 1.5 Maintenabilité

**NFR-MAINT-01 — Couverture de tests > 80%**

```gherkin
Given un développeur soumet une merge request avec du code nouveau ou modifié
When le pipeline CI calcule la couverture via Istanbul/c8
Then la couverture des fichiers AJOUTÉS est supérieure à 80%
  And la couverture des fichiers MODIFIÉS ne diminue pas par rapport à main
  And la couverture globale du projet ne descend pas sous 60%
  And si un seuil est franchi, le pipeline REFUSE le merge
```

- **Outil :** Vitest avec coverage provider c8 (backend), Vitest + React Testing Library (frontend).

**NFR-MAINT-02 — Dette technique mesurée (SonarQube "A")**

```gherkin
Given le code source est scanné par SonarQube après chaque push
When le rapport de qualité est généré
Then le Maintainability Rating est "A" (dette < 5% du temps de dev)
  And zéro code smell de niveau "Blocker" ou "Critical"
  And la duplication de code est inférieure à 3%
  And la complexité cyclomatique par fonction ne dépasse pas 15
```

**NFR-MAINT-03 — Migration de schéma automatique (Drizzle)**

```gherkin
Given une nouvelle version de MnM avec des migrations Drizzle en attente
When le serveur démarre (npm start ou container restart)
Then les migrations sont détectées et appliquées automatiquement
  And le serveur est opérationnel dans les 30 secondes qui suivent
  And en cas d'échec de migration, le serveur ne démarre PAS
    (fail-fast, pas de state corrompu)
  And un rollback est possible via la migration inverse
```

**NFR-MAINT-04 — Temps de build et déploiement**

```gherkin
Given un commit poussé sur une branche feature
When le pipeline CI/CD complet s'exécute (lint -> test -> build -> deploy staging)
Then le build complet (frontend + backend) termine en moins de 5 minutes
  And le déploiement en staging termine en moins de 10 minutes
  And le pipeline total (commit -> staging opérationnel) est sous 15 minutes
```

**NFR-MAINT-05 — Documentation API exhaustive**

```gherkin
Given les 22 routes Express existantes et tout nouveau endpoint
When un script de validation compare les routes Express à la spec OpenAPI
Then 100% des endpoints publics ont une spécification OpenAPI correspondante
  And chaque spec inclut : method, path, request schema, response schemas (200, 4xx, 5xx),
    auth requirements, permission keys requises
  And le Swagger UI est accessible en staging sur /api/docs
```

---

## 2. Quality Gates — Pipeline de Validation par Phase

Chaque merge request DOIT traverser les 7 gates dans l'ordre séquentiel. Un échec à un gate est **bloquant** : il empêche le passage aux gates suivants et le merge de la MR.

### Gate 0 : Code Quality Static (Automatique, < 2 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Lint JavaScript/TypeScript | ESLint (config projet) | Zero errors (warnings trackées) |
| Formatage | Prettier --check | Tous les fichiers conformes |
| Type checking | `tsc --noEmit` (strict mode) | Zero errors |
| Convention de commit | commitlint | Format conventionnel requis |
| Scan de secrets | gitleaks ou trufflehog | Zero secret détecté |
| Taille de bundle | bundlesize | Pas de régression > 5% |

### Gate 1 : Tests Unitaires (Automatique, < 3 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Exécution tests unitaires | Vitest | 100% des tests passent |
| Couverture fichiers ajoutés | Istanbul/c8 | > 80% |
| Couverture fichiers modifiés | Istanbul/c8 | Pas de régression |
| Isolation | -- | Zero dépendance réseau/DB (mocks uniquement) |

**Scope :** Services, helpers, validators, state machines, utils, composants React (shallow render).

### Gate 2 : Tests d'Intégration (Automatique, < 5 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Tests API endpoints | Vitest + Supertest | 100% passent |
| Tests RBAC middleware | Vitest + PostgreSQL réel | 100% passent |
| Tests WebSocket handlers | Vitest + ws mock | 100% passent |
| Tests credential proxy | Vitest + Docker testcontainer | 100% passent |
| Tests isolation multi-tenant | Matrice automatisée | 176 assertions passent |

**Infrastructure :** PostgreSQL via Docker testcontainer, transactions avec rollback après chaque test. **Pas de mock de base de données** — on teste contre une vraie instance PostgreSQL pour détecter les régressions de migration et les problèmes de RLS.

**Tests obligatoires spécifiques :**
1. **Isolation multi-tenant :** User-A (Company-Alpha) tente d'accéder aux ressources de Company-Beta sur chaque endpoint -> 403 systématique.
2. **RBAC enforcement :** Pour chaque rôle (admin, manager, contributor, viewer), vérifier que les permissions sont exactement celles définies dans les presets.
3. **Workflow enforcement :** Un agent ne peut pas sauter une étape, accéder à un fichier hors allowlist, ou continuer après un drift non résolu.
4. **Audit completeness :** Chaque mutation (create, update, delete) génère un entry dans l'audit log.

### Gate 3 : Tests E2E (Automatique, < 10 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Scénarios critiques par mode UI | Cypress | 100% des scénarios critiques passent |
| Screenshots de régression | Cypress + Percy | Zero différence non approuvée |

**Scénarios E2E obligatoires (alignés sur les 5 modes UI du Product Brief section 5.1) :**

1. **Mode ORAL — Onboarding CEO :** Connexion -> agent d'onboarding -> description entreprise -> création structure -> invitation membres -> premier dashboard visible.
2. **Mode VISUEL — Configuration CTO :** Acceptation invite -> configuration SSO (mock IdP) -> création workflow "Dev Story" (5 étapes) -> visualisation drift detection.
3. **Mode CODE — Quotidien Dev :** Check inbox -> sélection story -> lancement agent -> pilotage temps réel (chat) -> review code -> merge.
4. **Mode BOARD — Workflow PO :** Réception epic -> brainstorm avec agent -> décomposition en stories -> suivi sprint temps réel.
5. **Mode ADMIN — Gestion permissions :** Création membre -> assignation rôle -> modification scope projet -> vérification restrictions effectives -> consultation audit log.

**Environnement :** Docker Compose complet (frontend React + backend Express + PostgreSQL + Redis + mock LLM).

### Gate 4 : Security Scan (Automatique, < 3 min SAST / hebdomadaire DAST)

| Vérification | Outil | Seuil bloquant | Fréquence |
|---|---|---|---|
| SAST code source | SonarQube ou Semgrep | Zero vuln HIGH/CRITICAL | Chaque MR |
| Audit dépendances | `npm audit --production` | Zero vuln critique | Chaque MR |
| Scan images Docker | Trivy | Zero CVE critique | Chaque build image |
| DAST application | OWASP ZAP | Zero alerte HIGH | Hebdomadaire sur staging |
| Scan de secrets | gitleaks (historique complet) | Zero secret dans l'historique | Hebdomadaire |

### Gate 5 : Performance Benchmark (Avant release, < 15 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Load test API | k6 | P95 < 200ms, P99 < 500ms, 0 erreur |
| Lighthouse UI | Lighthouse CI | Performance > 90, Accessibility > 90 |
| Benchmark WebSocket | Script custom | Latence P95 < 100ms |
| Requêtes DB critiques | EXPLAIN ANALYZE automatisé | Zero seq scan sur tables > 10k lignes |
| Régression performance | Comparaison N vs N-1 | Pas de dégradation > 10% sur aucun percentile |

### Gate 6 : Review Humaine (Manuelle, bloquante)

- **Code review :** Minimum 1 approbation d'un pair développeur.
- **Architecture review :** **Requis** si le changement touche : schéma DB (migration), système de permissions (RBAC/scoping), architecture de containerisation, credential proxy, ou WebSocket protocol.
- **Security review :** **Requis** si le changement touche : authentification, gestion de secrets, isolation multi-tenant, ou endpoints publics.

**Checklist de review obligatoire :**
- [ ] Pas de régression de sécurité (RBAC, isolation tenant, secrets).
- [ ] Pas de changement de schéma sans migration correspondante.
- [ ] Impact sur la performance évalué et documenté.
- [ ] Documentation API (OpenAPI) mise à jour si nouvel endpoint.
- [ ] Les NFRs pertinents sont couverts par des tests.
- [ ] L'audit log couvre les nouvelles mutations.

---

## 3. Acceptance Criteria Patterns — 5 Templates Réutilisables

### Pattern AC-UI : Feature Interface Utilisateur

```gherkin
# --- Template AC-UI ---
# Applicable à : Dashboard, Board, Page agents, Workflow editor,
#   Admin panel, Onboarding, tout composant React visible

Given l'utilisateur est authentifié avec le rôle {ROLE}
  And l'utilisateur est membre de {COMPANY}
  And l'utilisateur a accès au projet {PROJECT} (si scoping actif)
When l'utilisateur navigue vers {PAGE/COMPOSANT}
Then {ÉLÉMENT_UI} est visible et interactif
  And les données affichées sont correctes et à jour
  And le temps de chargement est < 2s (NFR-PERF-02)
  And l'interface est responsive :
    | Breakpoint | Largeur | Comportement attendu |
    | Mobile     | 375px   | Navigation collapsée, contenu empilé |
    | Tablet     | 768px   | Sidebar rétractable, grille 2 colonnes |
    | Desktop    | 1280px  | Layout complet, sidebar fixe |
  And les labels sont en français (langue par défaut)
  And les couleurs respectent le contrast ratio WCAG AA (4.5:1)

# --- Variante : Restriction par rôle ---
Given l'utilisateur est authentifié avec le rôle VIEWER
When l'utilisateur navigue vers {PAGE_AVEC_ACTIONS}
Then les données sont visibles en lecture seule
  And les boutons d'action (créer, modifier, supprimer) sont absents du DOM
  And les routes d'action directes (/create, /edit) redirigent vers 403

# --- Variante : Données agrégées management (REQ-OBS-03) ---
Given l'utilisateur a le rôle CEO ou DSI
When l'utilisateur consulte le dashboard
Then les métriques sont TOUJOURS agrégées (par équipe, par BU, par projet)
  And AUCUNE métrique individuelle par personne n'est affichée
  And le drill-down s'arrête au niveau équipe, jamais au niveau individu
```

### Pattern AC-API : Endpoint REST

```gherkin
# --- Template AC-API ---
# Applicable à : Tous les endpoints /api/* (22 routes + nouvelles)

Given l'utilisateur est authentifié avec un token de session valide
  And l'utilisateur a la permission {PERMISSION_KEY}
  And la permission est scopée à {SCOPE} (company entière ou projets spécifiques)
When une requête {METHOD} est envoyée à {ENDPOINT}
  avec le payload {REQUEST_BODY}
Then la réponse a le statut HTTP {STATUS_CODE}
  And le body correspond au schéma JSON attendu {RESPONSE_SCHEMA}
  And le temps de réponse est < 200ms (NFR-PERF-01)
  And l'action est enregistrée dans l'audit log avec :
    { user_id, company_id, action, resource_type, resource_id, timestamp, ip }
  And les headers de sécurité sont présents
    (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security)

# --- Variante : Erreur d'autorisation ---
Given l'utilisateur N'A PAS la permission {PERMISSION_KEY}
When une requête {METHOD} est envoyée à {ENDPOINT}
Then la réponse a le statut 403 Forbidden
  And le body contient :
    { "error": "Forbidden", "requiredPermission": "{PERMISSION_KEY}" }
  And AUCUNE donnée de la ressource n'est incluse dans la réponse
  And la tentative est logguée dans l'audit log avec type "access_denied"

# --- Variante : Isolation multi-tenant ---
Given l'utilisateur appartient à Company-Alpha
When une requête {METHOD} est envoyée avec un resource_id de Company-Beta
Then la réponse a le statut 403 Forbidden
  And le body ne révèle PAS si la ressource existe ou non
    (pas de différence entre 403 et 404 pour les ressources cross-tenant)
  And la tentative est logguée avec type "cross_tenant_access_denied"

# --- Variante : Validation d'entrée ---
Given un payload avec des champs invalides (type incorrect, valeur hors range,
  champ manquant, injection SQL/XSS dans un string)
When la requête est envoyée
Then la réponse a le statut 400 Bad Request
  And le body contient les erreurs de validation structurées par champ
  And aucune query SQL n'est exécutée (validation avant traitement)
```

### Pattern AC-WORKFLOW : Workflow Déterministique

```gherkin
# --- Template AC-WORKFLOW ---
# Applicable à : Tout workflow créé via l'éditeur ou importé
# Couvre : REQ-ORCH-01 à REQ-ORCH-05

Given un workflow "{WORKFLOW_NAME}" est défini avec {N} étapes :
  | Étape | Nom | Fichiers obligatoires | Prompt injecté | Validation |
  | 1     | ... | [file1, file2]        | "..."          | humaine    |
  | 2     | ... | [file3]               | "..."          | auto       |
  | ...   | ... | ...                   | ...            | ...        |
  And un agent de type {AGENT_TYPE} est assigné au workflow
When l'agent est lancé sur l'étape {N}
Then l'agent reçoit EXACTEMENT les fichiers de l'étape {N} (pas plus, pas moins)
  And le prompt de l'étape {N} est injecté dans le contexte de l'agent
  And l'agent NE PEUT PAS passer à l'étape {N+1} tant que l'étape {N}
    n'est pas validée (selon le mode : humaine ou auto)
  And chaque action de l'agent est tracée dans l'audit log (REQ-OBS-02)
  And si l'agent tente une action hors du périmètre de l'étape,
    une alerte drift est émise (REQ-ORCH-05)

# --- Variante : Gestion de compaction ---
Given un agent en cours d'exécution à l'étape {K} sur {N}
  And les résultats des étapes 1 à {K-1} sont stockés
When la fenêtre de contexte de l'agent est épuisée (compaction détectée)
Then la stratégie configurée est appliquée :
  | Stratégie | Comportement |
  | kill+relance | Container détruit, nouveau container lancé avec contexte frais |
  | réinjection  | Pré-prompts critiques réinjectés dans le contexte actuel |
  And les résultats intermédiaires des étapes 1 à {K-1} sont préservés intégralement
  And les pré-prompts critiques du workflow sont réinjectés (REQ-ORCH-02)
  And l'agent reprend à l'étape {K} (pas de régression)
  And l'événement "compaction_handled" est tracé dans l'audit log

# --- Variante : Curseur d'automatisation (mode ASSISTÉ) ---
Given le curseur d'automatisation pour cette étape est en mode ASSISTÉ
When l'agent termine la génération d'un artefact (code, document, test)
Then l'artefact est présenté à l'humain propriétaire dans l'UI
  And l'humain peut : Approuver (-> étape suivante), Rejeter (-> agent recommence),
    ou Modifier (-> agent intègre les modifications)
  And l'agent est en pause et ATTEND la décision humaine
  And le temps d'attente n'est pas limité (pas de timeout sur la validation humaine)
  And la décision humaine est tracée dans l'audit log
```

### Pattern AC-AGENT : Comportement Agent Containerisé

```gherkin
# --- Template AC-AGENT ---
# Applicable à : Tout agent des 8 types d'adapters
#   (claude_local, codex, openclaw, etc.)
# Couvre : Containerisation, credential proxy, WebSocket, heartbeat

Given un agent de type {AGENT_TYPE} est lancé dans un container Docker éphémère
  And le container respecte les 5 couches de sécurité (NFR-SEC-04)
  And l'agent est connecté au serveur MnM via WebSocket bidirectionnel
  And l'agent a accès au credential proxy HTTP pour les services externes
When l'agent exécute une action {ACTION_TYPE}
  (lecture fichier, écriture code, appel API, changement d'étape)
Then l'action est exécutée dans l'environnement isolé du container
  And le résultat est transmis via WebSocket en < 100ms (NFR-PERF-03)
  And un heartbeat est émis toutes les {HEARTBEAT_INTERVAL} secondes
    (configurable, défaut 10s)
  And l'audit log enregistre l'action avec :
    { agent_id, container_id, action_type, workflow_id, stage_id,
      files_in_context, timestamp, duration_ms }

# --- Variante : Communication inter-agents (REQ-A2A-01) ---
Given Agent-Dev (propriétaire: développeur Alice) dans Company-Alpha
  And Agent-PO (propriétaire: PO Bob) dans la même Company-Alpha
  And Agent-Dev a besoin du contexte d'une story gérée par Agent-PO
When Agent-Dev envoie une requête inter-agent :
  { "target": "agent-po-id", "query": "contexte story #42", "fields": ["description", "acceptance_criteria"] }
Then une notification de demande d'accès est envoyée à Bob (PO)
  And Bob peut : Approuver (Agent-PO retourne les données demandées),
    Approuver partiellement (certains champs seulement),
    ou Refuser (Agent-Dev reçoit un refus avec raison)
  And l'échange complet est tracé dans l'audit log
  And les données retournées respectent le scope de permissions de Bob

# --- Variante : Timeout et recovery ---
Given un agent en exécution dans un container
When l'agent ne produit aucun output pendant 30 secondes (timeout configurable)
Then le ContainerManager envoie un SIGTERM au container
  And si le container ne s'arrête pas en 3 secondes, un SIGKILL est envoyé
  And l'état "timeout" est tracé dans l'audit log
  And le workflow peut être relancé manuellement ou automatiquement
    selon la configuration
```

### Pattern AC-PERMISSION : Contrôle d'Accès RBAC + Curseur

```gherkin
# --- Template AC-PERMISSION ---
# Applicable à : Toute vérification de droit d'accès
# Couvre : REQ-ENT-01, REQ-DUAL-01, invariant "Permission Scope"

Given un utilisateur avec le rôle {ROLE} dans Company-Alpha
  | Rôle         | Permissions                                              |
  | admin        | Toutes (CRUD sur toutes les ressources + config company) |
  | manager      | CRUD issues/workflows/agents + gestion membres projet    |
  | contributor  | CRU issues/agents + exécution workflows assignés         |
  | viewer       | R uniquement sur les ressources dans son scope            |
  And le scope de l'utilisateur est limité aux projets {PROJECT_IDS}
    (ou toute la company si scope = null)
When l'utilisateur tente l'action {ACTION} sur la ressource {RESOURCE}
Then le middleware hasPermission() vérifie :
  1. L'utilisateur a la permission {PERMISSION_KEY} via son rôle
  2. La ressource est dans le scope de l'utilisateur
  3. Les deux conditions sont satisfaites -> 200 OK
  4. Si l'une échoue -> 403 Forbidden
  And le résultat (succès ou refus) est tracé dans l'audit log

# --- Variante : Hiérarchie du curseur d'automatisation ---
Given le CEO a défini un plafond company-wide :
  "Aucun merge en production sans validation humaine"
  And un manager a défini pour le projet X :
  "Tests automatiques = mode AUTO"
  And le contributeur Alice a son curseur personnel :
  "Tout en AUTOMATIQUE"
When l'agent d'Alice tente un merge automatique en production
Then le merge est BLOQUÉ par le plafond CEO (hiérarchie l'emporte)
  And une notification est envoyée à Alice :
    "Validation requise : politique entreprise (définie par CEO)"
  And Alice doit valider manuellement le merge
  And la validation est tracée dans l'audit log

When l'agent d'Alice lance des tests automatiquement
Then les tests s'exécutent en mode AUTO (autorisé par le manager)
  And aucune intervention humaine n'est requise

# --- Variante : Rôles composites (REQ-ENT-01) ---
Given un utilisateur avec un rôle composite "Lead Tech"
  = contributor + permissions additionnelles [manage_workflows, view_audit_log]
When l'utilisateur tente de créer un workflow
Then l'action est autorisée (manage_workflows inclus dans le composite)
When l'utilisateur tente de modifier les paramètres SSO de la company
Then l'action est refusée (admin_company non inclus dans le composite)
```

---

## 4. Performance Benchmarks — Cibles Quantifiées par Opération

### 4.1 Benchmarks API REST

| Opération | P50 | P95 | P99 | Max absolu | Concurrence cible |
|---|---|---|---|---|---|
| `GET /api/issues` (liste paginée, 50/page) | < 50ms | < 150ms | < 300ms | < 1s | 100 users |
| `POST /api/issues` (création) | < 100ms | < 200ms | < 400ms | < 1s | 50 users |
| `GET /api/issues/:id` (détail) | < 30ms | < 80ms | < 150ms | < 500ms | 100 users |
| `GET /api/workflows/:id` (avec stages) | < 30ms | < 100ms | < 200ms | < 500ms | 100 users |
| `POST /api/workflows/:id/run` (lancement agent) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/agents/:id/status` (polling rapide) | < 20ms | < 50ms | < 100ms | < 200ms | 200 users |
| `GET /api/audit-logs` (filtré 30j, paginé) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/dashboard` (agrégation multi-projet) | < 300ms | < 800ms | < 1.5s | < 3s | 50 users |
| `POST /api/auth/login` (authentification) | < 100ms | < 200ms | < 400ms | < 1s | 50 users |
| `POST /api/auth/sso/callback` (SSO) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/companies/:id/members` (liste) | < 50ms | < 100ms | < 200ms | < 500ms | 50 users |
| `PUT /api/agents/:id/automation-level` (curseur) | < 50ms | < 100ms | < 200ms | < 500ms | 50 users |

### 4.2 Benchmarks WebSocket

| Type de message | Direction | Latence P50 | Latence P95 | Débit max cible |
|---|---|---|---|---|
| Agent heartbeat | serveur -> client | < 20ms | < 50ms | 500 msg/s |
| Agent event (action, output) | serveur -> client | < 50ms | < 100ms | 200 msg/s |
| Chat humain -> agent | client -> serveur -> container | < 50ms | < 100ms | 100 msg/s |
| Chat agent -> humain | container -> serveur -> client | < 50ms | < 100ms | 100 msg/s |
| Broadcast company (status update) | serveur -> N clients | < 100ms | < 200ms | 50 msg/s |
| Drift alert | serveur -> dashboard | < 200ms | < 500ms | 10 msg/s |
| Observabilité résumé LLM | serveur -> dashboard | < 2s | < 5s | 5 msg/s |

### 4.3 Benchmarks Container Agent

| Opération | Cible | Condition | Métrique Prometheus |
|---|---|---|---|
| Cold start (pull + create + start) | < 5s | Image ~500MB, pas en cache | `mnm_container_start_duration_seconds` |
| Warm start (image locale) | < 2s | Image pré-pullée | `mnm_container_start_duration_seconds` |
| Credential proxy handshake | < 200ms | Par container | `mnm_proxy_handshake_duration_seconds` |
| WebSocket connection setup | < 300ms | Container -> serveur | `mnm_ws_connect_duration_seconds` |
| Arrêt graceful (SIGTERM) | < 3s | -- | `mnm_container_stop_duration_seconds` |
| Kill forcé (après timeout) | < 1s | Après 30s inactivité | `mnm_container_kill_duration_seconds` |
| Cleanup post-run (--rm) | < 1s | Filesystem éphémère | `mnm_container_cleanup_duration_seconds` |
| Mémoire par container | < 512MB | Agent standard | `mnm_container_memory_bytes` |
| CPU par container | < 1 vCPU | Agent standard | `mnm_container_cpu_percent` |

### 4.4 Benchmarks Base de Données PostgreSQL

| Opération | Cible | Volume de données | Index requis |
|---|---|---|---|
| INSERT audit_log (single) | < 5ms | Toute taille | -- |
| INSERT audit_log (batch 100) | < 50ms | Toute taille | -- |
| SELECT audit_log (filtré company+date+type, paginé) | < 500ms | 1M lignes | company_id + created_at + event_type |
| SELECT audit_log (même requête) | < 1s | 100M lignes | Idem + partitioning par mois |
| SELECT issues (par project, paginé 50) | < 100ms | 100k issues | project_id + status + created_at |
| SELECT agents (par company, avec status) | < 50ms | 1000 agents | company_id + status |
| SELECT workflows (par company, avec stages) | < 100ms | 500 workflows | company_id |
| SELECT dashboard aggregation (multi-project) | < 500ms | 100k issues, 500 workflows | Index composites |
| Migration schema (up, table < 1M lignes) | < 30s | -- | -- |
| Migration schema (up, table > 10M lignes) | < 5min | -- | -- |
| pg_dump (backup complet) | < 10min | < 50GB | -- |
| Point-in-time recovery (PITR) | < 30min | < 50GB | -- |
| Connection pool saturation | Never | -- | Pool max = 80% max_connections |

### 4.5 Benchmarks Onboarding & Import

| Opération | Cible | Conditions | Notes |
|---|---|---|---|
| Import Jira (100 issues + métadonnées) | < 1 min | API Jira Cloud | Mapping automatique statuts/priorités |
| Import Jira (10 000 issues) | < 10 min | Batch processing (100/batch) | Progress bar en temps réel via WebSocket |
| Import Linear (1000 issues) | < 5 min | API Linear GraphQL | Mapping labels -> tags MnM |
| Import ClickUp (1000 tasks) | < 5 min | API ClickUp | Mapping spaces -> projects |
| Onboarding company (CEO flow conversationnel) | < 30 min | Mode ORAL | Création structure + rôles + invitations |
| Onboarding CTO (configuration technique) | < 1h | Mode VISUEL | SSO + workflows + monitoring |
| Création workflow template (drag-and-drop) | < 2 min | Mode VISUEL | 5 étapes standard |
| Premier dashboard fonctionnel (post-import) | < 48h | Après import + config | Données agrégées visibles |

### 4.6 Matrice de Charge Progressive

| Phase | Timeline | Users simultanés | Agents simultanés | Volume DB | WebSocket conn. | Infrastructure |
|---|---|---|---|---|---|---|
| **MVP** | 0-3 mois | 100 | 50 | 1M rows | 200 | 1 serveur (4 vCPU, 16GB) + 1 PG |
| **Scale** | 3-6 mois | 500 | 200 | 10M rows | 500 | 2 serveurs + PG replica read |
| **Enterprise** | 6-12 mois | 1000 | 500 | 100M rows | 1000 | Cluster 4 nodes + PG partitioned + Redis |
| **Multi-tenant SaaS** | 12+ mois | 5000 | 2000 | 1B rows | 5000 | K8s auto-scale + PG Citus + Redis Cluster |

---

## 5. Stratégie de Test par Feature — Matrice de Couverture

### 5.1 Matrice Feature x Type de Test x Priorité

| Feature (REQ) | Unit | Integ | E2E | Perf | Sec | Priorité |
|---|---|---|---|---|---|---|
| REQ-ORCH-01 (Workflow enforcement déterministe) | X | X | X | | | **P0** |
| REQ-ORCH-02 (Compaction : réinjection pré-prompts) | X | X | | X | | **P0** |
| REQ-ORCH-03 (2 stratégies compaction) | X | X | | | | P1 |
| REQ-ORCH-04 (Fichiers/prompts obligatoires par étape) | X | X | X | | | **P0** |
| REQ-ORCH-05 (Drift detection) | X | X | | X | | P1 |
| REQ-OBS-01 (Résumé LLM temps réel) | X | X | X | X | | P1 |
| REQ-OBS-02 (Audit log centralisé) | X | X | X | X | X | **P0** |
| REQ-OBS-03 (Dashboards agrégés, jamais individuels) | X | | X | | | **P0** |
| REQ-OBS-04 (Traçage décisions) | X | X | | | | P1 |
| REQ-ONB-01 (Onboarding cascade hiérarchique) | X | | X | | | P1 |
| REQ-ONB-02 (Dual-mode : conversationnel + visuel) | X | | X | | | P2 |
| REQ-ONB-03 (Import Jira/Linear/ClickUp) | X | X | X | X | | P1 |
| REQ-ONB-04 (MnM = source unique post-import) | X | X | | | | P1 |
| REQ-A2A-01 (Accès inter-agents + validation humaine) | X | X | X | | X | P1 |
| REQ-A2A-02 (Connecteurs auto-générés) | X | X | | | X | P2 |
| REQ-A2A-03 (MnM modifiable par ses agents) | X | X | | | X | P2 |
| REQ-A2A-04 (Query directe contexte inter-agents) | X | X | | | | P1 |
| REQ-DUAL-01 (Curseur automatisation individuel) | X | X | X | | | P1 |
| REQ-DUAL-02 (Distinction mécanique vs jugement) | X | | | | | P2 |
| REQ-DUAL-03 (Dialogue pendant exécution) | X | X | X | X | | **P0** |
| REQ-DUAL-04 (Brainstorm -> workflow) | X | | X | | | P2 |
| REQ-ENT-01 (Rôles composites) | X | X | X | | X | **P0** |
| REQ-ENT-02 (3 niveaux workflow) | X | X | | | | P1 |
| REQ-ENT-03 (Présentation élévation) | | | X | | | P2 |
| REQ-ENT-04 (CEO query agents) | X | X | X | | | P1 |
| Isolation multi-tenant (invariant 1) | | X | X | | X | **P0** |
| Container isolation (5 couches) | X | X | | | X | **P0** |
| Credential proxy | X | X | | | X | **P0** |
| SSO SAML/OIDC | X | X | X | | X | P1 |
| WebSocket bidirectionnel | X | X | X | X | | **P0** |
| Rate limiting + throttling | X | X | | X | X | P1 |

### 5.2 Pyramide de Tests — Ratios Cibles

```
            /\
           /  \      E2E (Cypress) -- 10% des tests (~30 scénarios)
          / E2E\     5 user journeys complets par mode UI
         /------\
        /  Integ \   Tests d'intégration -- 30% des tests (~150 tests)
       / ration   \  API, RBAC matrice, DB réelle, WebSocket, Container
      /------------\
     /   Unitaire    \  Tests unitaires -- 60% des tests (~300 tests)
    / (Vitest + RTL)  \ Services, validators, state machines, composants
   /--------------------\
```

**Ratio cible :** 60% unitaires / 30% intégration / 10% E2E.
**Estimation totale :** ~480 tests au MVP, ~1200 tests à 12 mois.

---

*Ce document constitue le référentiel qualité complet pour le PRD B2B de MnM. Chaque NFR porte un identifiant unique pour la traçabilité (NFR-PERF-xx, NFR-SEC-xx, NFR-SCALE-xx, NFR-AVAIL-xx, NFR-MAINT-xx). Les quality gates définissent un pipeline de validation séquentiel et bloquant. Les 5 patterns d'acceptance criteria fournissent des templates réutilisables pour chaque FR du PRD. Les benchmarks quantifient les cibles de performance avec des percentiles précis par opération critique.*

*Tous les seuils sont alignés sur : les métriques de succès du Product Brief (section 2.4), les contraintes architecturales (section 6), la stack technique existante (React 18, Express, PostgreSQL, WebSocket, Docker, Drizzle ORM, Better Auth), et la matrice de charge progressive (MVP -> Scale -> Enterprise).*
