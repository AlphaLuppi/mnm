# Sprint Planning — Per-User Pods + Artifact Deployment

> **Date** : 2026-03-21 | **Version** : 1.0
> **Projet** : MnM — Enterprise B2B Supervision Cockpit
> **Epics** : POD (Per-User Pods) + DEPLOY (Artifact Deployment)
> **Estimation totale** : ~74 SP (16 stories)
> **Auteur** : Sprint Planner (BMAD)

---

## 1. Vue d'ensemble

### Contexte

Deux epics ont ete planifees et architecturees le 2026-03-21 pour etendre MnM avec :
- **Per-User Pods** : conteneurs Docker persistants par utilisateur avec terminal WebSocket, authentification Claude integree, et gestion du cycle de vie (provision/hibernate/wake/destroy)
- **Artifact Deployment** : deploiement d'artefacts d'agents sous forme de conteneurs de preview avec reverse proxy, TTL auto-cleanup, et integration sur les pages issues

### Etat actuel

| Metrique | Valeur |
|----------|--------|
| Stories totales | 16 |
| Stories DONE | 14 |
| Stories TODO | 2 |
| SP completees | 68 SP |
| SP restants | 6 SP |
| Progression | **92%** |

La grande majorite du travail est terminee. Il reste 2 stories de priorite P1 (polish/admin) plus quelques bugs a adresser.

---

## 2. Sprint 1 (Complete) — Foundation + Core Features

> **Statut** : TERMINE
> **SP livrees** : 68 SP
> **Scope** : Infrastructure, services, API, UI, integration

### Epic POD — Per-User Pods (7/8 stories DONE)

| Story | Nom | SP | Statut | Notes |
|-------|-----|----|--------|-------|
| POD-01 | Dockerfile.agent + image build pipeline | 3 | DONE | `docker/Dockerfile.agent` cree — image `mnm-agent:latest` avec Node 20, Claude CLI, git, outils de build |
| POD-02 | DB migration : user_pods table + RLS | 3 | DONE | `packages/db/src/migrations/0048_user_pods_and_deployments.sql` + schema `packages/db/src/schema/user_pods.ts` |
| POD-03 | PodManager service (provision, hibernate, wake, destroy) | 8 | DONE | `server/src/services/pod-manager.ts` — cycle de vie complet, quotas, health checks |
| POD-04 | Pod API routes + RBAC | 5 | DONE | `server/src/routes/pods.ts` — provision, my, wake, hibernate, destroy, admin list |
| POD-05 | WebSocket terminal relay (pod-exec) | 8 | DONE | `server/src/routes/pod-exec.ts` — chat-style exec via stdin pipe vers docker exec |
| POD-06 | Workspace UI page (status + terminal) | 5 | DONE | `ui/src/pages/Workspace.tsx` + composants `ui/src/components/workspace/` |
| POD-07 | Sidebar "My Workspace" link + routes | 2 | DONE | `ui/src/components/Sidebar.tsx` + `ui/src/lib/company-routes.ts` mis a jour |

### Epic DEPLOY — Artifact Deployment (7/8 stories DONE)

| Story | Nom | SP | Statut | Notes |
|-------|-----|----|--------|-------|
| DEPLOY-01 | DB migration : artifact_deployments table + RLS | 3 | DONE | Migration combinee avec POD-02 dans `0048_user_pods_and_deployments.sql` + schema `packages/db/src/schema/artifact_deployments.ts` |
| DEPLOY-02 | DeployManager service (detect, build, serve, cleanup) | 8 | DONE | `server/src/services/deploy-manager.ts` — detection type projet, build, port allocation 9000-9999 |
| DEPLOY-03 | DeploymentProxy middleware (reverse proxy) | 5 | DONE | `server/src/middleware/deployment-proxy.ts` — proxy `/preview/:id/*` vers conteneur |
| DEPLOY-04 | Deployment API routes + RBAC | 5 | DONE | `server/src/routes/deployments.ts` — CRUD, pin/unpin, logs |
| DEPLOY-05 | Deployment garbage collector cron | 3 | DONE | TTL-based cleanup integre dans DeployManager |
| DEPLOY-06 | Deployments UI page (list + detail + preview) | 5 | DONE | `ui/src/pages/Deployments.tsx` + composants `ui/src/components/deployments/` |
| DEPLOY-08 | Issue deployment links panel (IssueDetail) | 5 | DONE | Panel "Deployments" sur `ui/src/pages/IssueDetail.tsx` — preview URL, status badge, iframe |

### Modifications transversales (Sprint 1)

| Fichier | Changement |
|---------|------------|
| `server/src/app.ts` | Montage des routes pods, deployments, et du proxy middleware |
| `server/src/services/container-manager.ts` | Adaptation pour supporter pods et deployments |
| `server/src/services/container-pipe.ts` | Pipe stdin/stdout pour exec dans conteneurs |
| `server/src/services/network-isolation.ts` | Isolation reseau pour pods et deployments |
| `server/src/services/docker-client.ts` | Client Docker partage (socket auto-detect Windows/Linux) |
| `packages/db/src/schema/index.ts` | Export des nouveaux schemas user_pods et artifact_deployments |
| `packages/shared/src/types/index.ts` | Export des types pod et deployment |
| `packages/shared/src/types/pod.ts` | Types TypeScript pour UserPod |
| `packages/shared/src/types/deployment.ts` | Types TypeScript pour ArtifactDeployment |
| `ui/src/api/pods.ts` | Client API pods (React Query) |
| `ui/src/api/deployments.ts` | Client API deployments (React Query) |
| `ui/src/lib/queryKeys.ts` | Cles React Query pour pods et deployments |
| `ui/src/App.tsx` | Routes `/workspace` et `/deployments` ajoutees |
| `docker-compose.yml` | Configuration Docker socket mount et reseau |
| `docker/entrypoint.sh` | Entrypoint adapte pour pods |

---

## 3. Sprint 2 (En cours) — Admin Views + Polish

> **Statut** : EN COURS
> **SP restants** : 6 SP
> **Scope** : Admin views, deploy button, bugs

### Stories TODO

| Story | Nom | SP | Priorite | Description |
|-------|-----|----|----------|-------------|
| POD-08 | Pod admin view | 3 | P1 | Vue admin listant tous les pods de la company : statut, utilisateur, ressources, actions (hibernate/destroy). Permission `agents:manage_containers` requise. Endpoint: `GET /api/companies/:companyId/pods` |
| DEPLOY-07 | Bouton "Deploy" sur run detail | 3 | P1 | Ajouter un bouton "Deploy" sur la page de detail d'un run d'agent. Quand un run produit des artefacts deployables, l'utilisateur peut deployer en un clic. Appelle `POST /api/companies/:companyId/deployments` avec `runId` et `sourcePath` |

### Bugs et polish connus

| Bug | Severite | Description | Action |
|-----|----------|-------------|--------|
| Claude auth interactive | Medium | Le flow de login Claude (`claude login`) est interactif — le pipe stdin vers `docker exec` doit etre teste de bout en bout pour s'assurer que l'input clavier arrive correctement dans le conteneur | Tester manuellement avec Docker Desktop actif, documenter le workaround si stdin pipe ne fonctionne pas (fallback: `docker exec -it` depuis terminal host) |
| Docker Desktop requis | Low | L'auto-detection du Docker socket (Windows named pipe `//./pipe/docker_engine` vs Linux `/var/run/docker.sock`) est implementee mais necessite que Docker Desktop soit demarre | Ajouter un health check au demarrage du serveur MnM qui verifie la disponibilite du Docker daemon et affiche un message clair si absent |

### Criteres d'acceptation Sprint 2

- [ ] POD-08 : Un admin peut voir la liste de tous les pods de sa company avec statuts
- [ ] POD-08 : Un admin peut forcer l'hibernation ou la destruction d'un pod d'un autre utilisateur
- [ ] POD-08 : Un viewer/contributor ne peut PAS acceder a la vue admin pods
- [ ] DEPLOY-07 : Un bouton "Deploy" apparait sur la page de detail d'un run
- [ ] DEPLOY-07 : Cliquer sur "Deploy" cree un deployment et redirige vers la page deployments
- [ ] DEPLOY-07 : Le bouton est desactive si aucun artefact deployable n'est detecte
- [ ] Bug : Claude auth flow teste avec stdin pipe fonctionnel
- [ ] Bug : Message d'erreur clair si Docker daemon non disponible

---

## 4. Resume de velocite

| Sprint | SP planifiees | SP livrees | Duree | Stories |
|--------|--------------|------------|-------|---------|
| Sprint 1 | 68 | 68 | 1 session | 14/16 stories |
| Sprint 2 | 6 | 0 (en cours) | Estimation: 1 session | 2 stories + 2 bugs |
| **Total** | **74** | **68** | | **14/16 (92%)** |

### Repartition par epic

| Epic | SP Total | SP Done | SP Restants | Stories Done/Total |
|------|----------|---------|-------------|-------------------|
| POD | 37 | 34 | 3 | 7/8 |
| DEPLOY | 37 | 34 | 3 | 7/8 |
| **Total** | **74** | **68** | **6** | **14/16** |

### Observations

- **Velocite exceptionnelle** : 68 SP livrees en une seule session, couvrant infrastructure Docker, services backend, API REST, schemas DB, et pages UI completes
- **Architecture respectee** : L'implementation suit fidelement le document d'architecture (pas de derive de scope)
- **Qualite de code** : TypeScript strict, RBAC integre, RLS PostgreSQL, React Query pour le state management

---

## 5. Risques et bloqueurs

### Risques actifs

| Risque | Probabilite | Impact | Mitigation | Owner |
|--------|-------------|--------|------------|-------|
| Docker Desktop non demarre sur Windows dev | Haute | Bloquant | Ajouter check au startup + message explicite. Documenter le prerequis dans README | Dev |
| Claude auth stdin pipe ne fonctionne pas en mode non-interactif | Moyenne | Moyen | Tester avec `docker exec -i` (sans `-t`). Fallback: auth via volume pre-configure ou API key env var | Dev |
| Port conflicts 9000-9999 avec autres services locaux | Faible | Moyen | Rendre la plage configurable via env var. Verifier port disponible avant allocation | Dev |
| Orphan containers apres crash serveur MnM | Moyenne | Faible | Le garbage collector reconcilie l'etat DB vs Docker. Labels `mnm.*` permettent le nettoyage | Auto |

### Bloqueurs resolus (Sprint 1)

| Bloqueur | Resolution |
|----------|-----------|
| Docker socket path Windows vs Linux | Auto-detection implementee dans `docker-client.ts` |
| Routes manquantes dans company-routes.ts | `workspace` et `deployments` ajoutes dans `BOARD_ROUTE_ROOTS` |
| Schema DB : migration unique vs separees | Migration combinee `0048_user_pods_and_deployments.sql` (pods + deployments ensemble) |

### Dependencies externes

| Dependance | Statut | Impact si indisponible |
|------------|--------|----------------------|
| Docker Desktop (dev local) | Requis | Pods et deployments non fonctionnels — reste du MnM OK |
| Docker daemon (production) | Requis | Idem |
| `mnm-agent:latest` image | A builder | `docker build -f docker/Dockerfile.agent -t mnm-agent:latest .` |

---

## Fichiers cles a referencer

### Nouveaux fichiers (Sprint 1)

```
docker/Dockerfile.agent                              — Image agent pour pods
packages/db/src/migrations/0048_user_pods_and_deployments.sql — Migration combinee
packages/db/src/schema/user_pods.ts                  — Schema Drizzle pods
packages/db/src/schema/artifact_deployments.ts       — Schema Drizzle deployments
packages/shared/src/types/pod.ts                     — Types pod
packages/shared/src/types/deployment.ts              — Types deployment
server/src/services/pod-manager.ts                   — Service gestion pods
server/src/services/deploy-manager.ts                — Service gestion deployments
server/src/services/docker-client.ts                 — Client Docker partage
server/src/routes/pods.ts                            — API routes pods
server/src/routes/pod-exec.ts                        — WebSocket exec dans pods
server/src/routes/deployments.ts                     — API routes deployments
server/src/middleware/deployment-proxy.ts             — Reverse proxy preview
ui/src/pages/Workspace.tsx                           — Page workspace
ui/src/pages/Deployments.tsx                         — Page deployments
ui/src/components/workspace/                         — Composants workspace (terminal, status)
ui/src/components/deployments/                       — Composants deployments (logs, preview)
ui/src/api/pods.ts                                   — Client API pods
ui/src/api/deployments.ts                            — Client API deployments
```

### Fichiers modifies (Sprint 1)

```
server/src/app.ts                                    — Montage routes + middleware
server/src/services/container-manager.ts             — Support pods/deployments
server/src/services/container-pipe.ts                — Pipe stdin/stdout
server/src/services/network-isolation.ts             — Isolation reseau
packages/db/src/schema/index.ts                      — Export schemas
packages/shared/src/index.ts                         — Export types
packages/shared/src/types/index.ts                   — Export types pod/deployment
ui/src/App.tsx                                       — Nouvelles routes
ui/src/components/Sidebar.tsx                        — Liens workspace/deployments
ui/src/lib/company-routes.ts                         — BOARD_ROUTE_ROOTS
ui/src/lib/queryKeys.ts                              — Query keys pods/deployments
ui/src/pages/IssueDetail.tsx                         — Panel deployment links
docker-compose.yml                                   — Config Docker socket
docker/entrypoint.sh                                 — Entrypoint adapte
```

---

*Genere par BMAD Method v6 - Sprint Planner*
*Session sprint planning : 2026-03-21*
