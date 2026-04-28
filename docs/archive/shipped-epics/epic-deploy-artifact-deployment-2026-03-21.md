# Epic DEPLOY — Artifact Deployment

> **Version** : 1.0 | **Date** : 2026-03-21 | **Statut** : En cours
> **Auteurs** : Claude (Dev Agent), Tom (Implémentation)
> **Sources** : Architecture Pods & Deployments v1.0, PRD B2B v1.0

---

## Vue d'ensemble

**Objectif** : Permettre le déploiement éphémère d'artefacts produits par les agents (sites statiques, apps Node, apps Python) sous forme de containers Docker avec preview URL, TTL automatique, et lien contextuel aux issues.

**Contexte** : Les agents produisent des artefacts (code, sites, apps) dans leurs pods. Ce epic permet de les déployer instantanément en containers isolés avec URL de preview, proxy inverse authentifié, et garbage collection automatique.

**Phase PRD** : Sprint POD/DEPLOY (post-B2B core)
**FRs couverts** : Deployment lifecycle, preview proxy, RBAC, TTL cleanup, issue linking
**Effort total** : ~37 SP | ~4-5 semaines (1 dev)
**Assignation** : Tom

### Statut Global

| Story | Nom | SP | Statut |
|-------|-----|----|--------|
| DEPLOY-01 | DB migration artifact_deployments + RLS | 3 | DONE |
| DEPLOY-02 | DeployManager service | 8 | DONE |
| DEPLOY-03 | DeploymentProxy middleware | 5 | DONE |
| DEPLOY-04 | Deployment API routes + RBAC | 5 | DONE |
| DEPLOY-05 | Deployment garbage collector cron | 3 | DONE |
| DEPLOY-06 | Deployments UI page | 5 | DONE |
| DEPLOY-07 | Bouton "Deploy" sur run detail | 3 | TODO |
| DEPLOY-08 | Issue deployment links panel | 5 | DONE |

---

## Story DEPLOY-01 : DB Migration artifact_deployments + RLS

**Description** : Créer la table `artifact_deployments` avec toutes les colonnes nécessaires (company_id, user_id, issue_id FK, run_id FK, agent_id FK, project_id FK, status, port, source_path, ttl_seconds, pinned, share_token, expires_at). Ajouter les index (company+status, expires_at, issue_id, share_token) et les politiques RLS per-company. Migration SQL dans `0048_user_pods_and_deployments.sql`.

**Assignation** : Tom
**Effort** : S (3 SP, 2j)
**Bloqué par** : TECH-01 (PostgreSQL), TECH-05 (RLS)
**Débloque** : DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, DEPLOY-08

**Acceptance Criteria** :
- Given la migration 0048 When elle s'exécute Then la table `artifact_deployments` est créée avec 18 colonnes (id, company_id, user_id, issue_id, run_id, agent_id, project_id, name, status, project_type, docker_container_id, port, source_path, build_log, ttl_seconds, pinned, share_token, url, expires_at, created_at, updated_at)
- Given la table artifact_deployments When RLS est activé Then seules les lignes de la company courante (via `app.current_company_id`) sont visibles
- Given le schema Drizzle `artifact_deployments.ts` When le serveur démarre Then le schema correspond à la table SQL avec tous les indexes (company_status, expires_at, issue_id, share_token)
- Given une FK issue_id When elle référence une issue existante Then la contrainte est respectée ; quand l'issue_id est null Then l'insertion réussit également

**Statut** : DONE
**Fichiers** :
- `packages/db/src/migrations/0048_user_pods_and_deployments.sql`
- `packages/db/src/schema/artifact_deployments.ts`

---

## Story DEPLOY-02 : DeployManager Service

**Description** : Service central de gestion du cycle de vie des déploiements. Détecte le type de projet (static/node/python), alloue un port dans le pool 9000-9999, crée le container Docker (nginx:alpine pour static, node:20-slim pour node), gère le quota par company (max 10 actifs), et expose les opérations CRUD + pin/unpin + destroy. Inclut le garbage collector intégré (DEPLOY-05).

**Assignation** : Tom
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : DEPLOY-01
**Débloque** : DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, DEPLOY-08

**Acceptance Criteria** :
- Given un appel à `createDeployment` avec un sourcePath When le quota company (<10 actifs) n'est pas atteint Then un container Docker est créé avec le bon image (nginx:alpine ou node:20-slim), un port alloué, et le status passe de "building" à "running"
- Given le pool de ports 9000-9999 When tous les ports sont utilisés Then une erreur `conflict` est levée avec un message explicite
- Given un appel à `destroyDeployment` When le container existe Then il est stoppé (timeout 3s), supprimé de Docker, et le status passe à "destroyed" en DB
- Given un appel à `pinDeployment(true)` When le deployment existe Then `pinned=true` et `expires_at=null` ; inversement `pinDeployment(false)` recalcule `expires_at` depuis maintenant
- Given un appel à `getDeploymentForProxy` When le deployment est en status "running" avec un port Then les infos de proxy (port, companyId, shareToken) sont retournées ; sinon null

**Statut** : DONE
**Fichiers** :
- `server/src/services/deploy-manager.ts`
- `server/src/services/docker-client.ts`

---

## Story DEPLOY-03 : DeploymentProxy Middleware

**Description** : Middleware Express de reverse proxy pour les URLs `/preview/:deploymentId/*`. Résout le port du container via le DeployManager (avec cache 60s), vérifie l'authentification (session cookie OU query param `?token=shareToken`), puis proxie la requête HTTP vers `127.0.0.1:{port}` du container. Ajoute les headers CORS et `X-MnM-Deployment`.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : DEPLOY-01, DEPLOY-02
**Débloque** : DEPLOY-06, DEPLOY-07, DEPLOY-08

**Acceptance Criteria** :
- Given une requête GET `/preview/{uuid}/index.html` When le deployment est en status "running" et l'utilisateur a une session valide Then la requête est proxiée vers le container et le contenu est retourné avec header `X-MnM-Deployment`
- Given une requête avec `?token={shareToken}` When le token correspond au shareToken du deployment Then l'accès est autorisé sans session cookie
- Given une requête sans session ni token valide When elle arrive sur `/preview/:id/*` Then une réponse 401 est retournée avec message explicite
- Given un deployment en status "expired" ou "destroyed" When une requête arrive Then une réponse 404 est retournée
- Given un container inaccessible (port fermé) When le proxy tente la connexion Then une réponse 502 est retournée avec message "Deployment container unreachable"

**Statut** : DONE
**Fichiers** :
- `server/src/middleware/deployment-proxy.ts`

---

## Story DEPLOY-04 : Deployment API Routes + RBAC

**Description** : Routes Express REST pour le CRUD des déploiements avec contrôle RBAC. POST (create, permission `agents:launch`), GET list/detail/logs (permission `agents:launch`), POST pin/unpin (permission `agents:manage_containers`), DELETE destroy (permission `agents:manage_containers`). Validation Zod sur le body de création. Audit trail via `emitAudit` sur create et destroy.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : DEPLOY-01, DEPLOY-02
**Débloque** : DEPLOY-06, DEPLOY-07, DEPLOY-08

**Acceptance Criteria** :
- Given un user avec permission `agents:launch` When il POST `/companies/:companyId/deployments` avec un body valide (sourcePath requis, name/issueId/runId/ttlSeconds optionnels) Then un deployment est créé (status 202) et un audit event `deployment.created` est émis
- Given un user avec permission `agents:launch` When il GET `/companies/:companyId/deployments?issueId=X` Then seuls les deployments liés à cette issue sont retournés (filtre issueId + status supportés)
- Given un user avec permission `agents:manage_containers` When il POST `.../pin` ou `.../unpin` Then le deployment est pinnéd/unpinned avec mise à jour de `expires_at`
- Given un user SANS permission `agents:manage_containers` When il tente DELETE `.../deployments/:id` Then une erreur 403 est retournée
- Given un body de création invalide (sourcePath manquant ou ttlSeconds > 604800) When le POST est envoyé Then une erreur 400 est retournée avec les détails de validation Zod

**Statut** : DONE
**Fichiers** :
- `server/src/routes/deployments.ts`

---

## Story DEPLOY-05 : Deployment Garbage Collector Cron

**Description** : Tâche récurrente (toutes les 5 minutes) qui identifie les deployments expirés (expires_at < now(), status running/building, pinned=false), stoppe et supprime leurs containers Docker, et met à jour le status à "expired". Intégré directement dans le DeployManager service (méthodes `cleanupExpired` + `startGarbageCollector`).

**Assignation** : Tom
**Effort** : S (3 SP, 2j)
**Bloqué par** : DEPLOY-02
**Débloque** : Aucun (fonctionnalité autonome de maintenance)

**Acceptance Criteria** :
- Given un deployment avec `expires_at` dans le passé et `pinned=false` When le garbage collector s'exécute Then le container Docker est stoppé, supprimé, et le status passe à "expired"
- Given un deployment avec `pinned=true` et `expires_at=null` When le garbage collector s'exécute Then le deployment est ignoré (pas nettoyé)
- Given une erreur Docker lors du stop/remove d'un container When le GC traite ce deployment Then l'erreur est loguée (warn) mais le GC continue avec les autres deployments
- Given le GC qui tourne toutes les 5 minutes When aucun deployment n'est expiré Then aucun log n'est émis (silencieux)

**Statut** : DONE (intégré dans DeployManager)
**Fichiers** :
- `server/src/services/deploy-manager.ts` (méthodes `cleanupExpired`, `startGarbageCollector`)

---

## Story DEPLOY-06 : Deployments UI Page

**Description** : Page React `/deployments` affichant la liste de tous les deployments de la company avec cards de status (running/building/failed/expired), badges colorés, icônes animées (spinner pour building), liens "Open Preview" vers `/preview/:id`, indicateur pin, compteur actifs, et auto-refresh toutes les 10 secondes. État vide avec message informatif.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : DEPLOY-04
**Débloque** : DEPLOY-07

**Acceptance Criteria** :
- Given la page Deployments When elle se charge Then la liste des deployments est affichée avec cards contenant : nom, badge status coloré, icône status, issue liée, agent, date relative, et expiration
- Given un deployment en status "running" When il est affiché Then un lien "Open Preview" avec icône ExternalLink est visible et ouvre `/preview/:id` dans un nouvel onglet
- Given aucun deployment dans la company When la page se charge Then un état vide est affiché avec icône Globe et message explicatif
- Given des deployments actifs (running/building) When la page est affichée Then un badge compteur "X active" est visible dans le header
- Given la page ouverte When 10 secondes passent Then les données sont rafraîchies automatiquement (refetchInterval) avec indicateur de refresh animé

**Statut** : DONE
**Fichiers** :
- `ui/src/pages/Deployments.tsx`
- `ui/src/api/deployments.ts`

---

## Story DEPLOY-07 : Bouton "Deploy" sur Run Detail Page

**Description** : Ajouter un bouton "Deploy" sur la page de détail d'un agent run. Ce bouton déclenche la création d'un deployment à partir des artefacts produits par le run (sourcePath déduit du workspace de l'agent). Le bouton est visible uniquement pour les runs terminés avec succès et les users ayant la permission `agents:launch`. Feedback visuel avec état de progression.

**Assignation** : Tom
**Effort** : S (3 SP, 2j)
**Bloqué par** : DEPLOY-04, DEPLOY-06
**Débloque** : Aucun

**Acceptance Criteria** :
- Given un run terminé avec succès When l'utilisateur a la permission `agents:launch` Then un bouton "Deploy" est visible sur la page RunDetail
- Given le clic sur "Deploy" When la requête POST est envoyée Then un spinner de chargement s'affiche pendant la création, puis un lien vers le deployment apparaît
- Given un run en cours ou échoué When la page RunDetail est affichée Then le bouton "Deploy" n'est PAS visible
- Given un user avec rôle viewer (sans `agents:launch`) When la page RunDetail est affichée Then le bouton "Deploy" n'est PAS visible

**Statut** : TODO
**Fichiers** :
- `ui/src/pages/RunDetail.tsx` (à modifier)

---

## Story DEPLOY-08 : Issue Deployment Links Panel

**Description** : Composant `IssueDeploymentLinks` intégré sur la page IssueDetail affichant tous les deployments liés à cette issue. Chaque entrée montre : badge status coloré, nom tronqué, indicateur pin, bouton copier URL, lien "Open" vers preview, nom du déployeur, date relative, et warning d'expiration. Auto-refresh toutes les 15 secondes. Le panel se masque automatiquement si aucun deployment n'est lié à l'issue.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : DEPLOY-04
**Débloque** : Aucun

**Acceptance Criteria** :
- Given une issue avec des deployments liés When la page IssueDetail se charge Then le panel "Deployments (N)" est affiché avec les cards de chaque deployment (status, nom, preview link, date)
- Given un deployment running sur l'issue When il est affiché Then un bouton "Copy URL" et un lien "Open" (nouvelle fenêtre) sont visibles
- Given une issue sans aucun deployment When la page IssueDetail se charge Then le panel de deployments n'est PAS rendu (masqué silencieusement, pas de skeleton)
- Given un deployment expiré bientôt (`expires_at` proche, `pinned=false`) When il est affiché Then un warning "expires {timeAgo}" en couleur amber est visible
- Given le panel affiché When 15 secondes passent Then les données sont rafraîchies automatiquement via `refetchInterval`

**Statut** : DONE
**Fichiers** :
- `ui/src/components/deployments/IssueDeploymentLinks.tsx`
- `ui/src/pages/IssueDetail.tsx` (intégration ligne ~744)

---

## Graphe de Dépendances

```
TECH-01 ──▶ DEPLOY-01 ──▶ DEPLOY-02 ──▶ DEPLOY-03
                │              │              │
                │              ▼              │
                │         DEPLOY-05           │
                │              │              │
                ▼              ▼              ▼
           DEPLOY-04 ◀────────────────────────┘
                │
                ├──▶ DEPLOY-06 ──▶ DEPLOY-07
                │
                └──▶ DEPLOY-08
```

---

## Récapitulatif

| Métrique | Valeur |
|----------|--------|
| Stories totales | 8 |
| Stories DONE | 7 |
| Stories TODO | 1 |
| SP totaux | 37 |
| SP restants | 3 (DEPLOY-07) |
| Assignation | Tom (100%) |
| Permissions RBAC | `agents:launch`, `agents:manage_containers` |
| Tables DB | 1 (`artifact_deployments`) |
| Routes API | 7 (POST create, GET list, GET detail, GET logs, POST pin, POST unpin, DELETE destroy) |
| Middleware | 1 (`deployment-proxy.ts`) |
| Pages UI | 1 (`Deployments.tsx`) |
| Composants UI | 1 (`IssueDeploymentLinks.tsx`) |
