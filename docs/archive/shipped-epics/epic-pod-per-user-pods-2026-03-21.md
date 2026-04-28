# Epic POD — Per-User Pods

> **Version** : 1.0 | **Date** : 2026-03-21 | **Statut** : Final
> **Auteur** : Tom
> **Sources** : Architecture Pods & Deployments v1.0, Brainstorming 2026-03-21

---

## Vue d'ensemble

**Objectif** : Fournir à chaque utilisateur un pod Docker persistant (conteneur isolé) pour exécuter des agents avec Claude CLI, gérer des projets et produire des artefacts déployables.
**Phase PRD** : Post-Sprint 6 (extension enterprise)
**Effort total** : ~37 SP | ~4-5 semaines (1 dev)
**Assignation** : Tom
**Dépendances** : TECH-01 (PostgreSQL), TECH-05 (RLS), CONT-01 (containerisation de base)

### Résumé des Stories

| Story | Nom | Effort | Statut |
|-------|-----|--------|--------|
| POD-01 | Dockerfile.agent + image build | S (3 SP) | DONE |
| POD-02 | DB migration user_pods + RLS | S (3 SP) | DONE |
| POD-03 | PodManager service (provision, hibernate, wake, destroy) | L (8 SP) | DONE |
| POD-04 | Pod API routes + RBAC | M (5 SP) | DONE |
| POD-05 | Pod Console (chat-style exec, stdin) | L (8 SP) | DONE |
| POD-06 | Workspace UI page (status + console) | M (5 SP) | DONE |
| POD-07 | Sidebar "My Workspace" link + route registration | S (2 SP) | DONE |
| POD-08 | Pod admin view (list all company pods) | S (3 SP) | TODO |

---

## Stories

### Story POD-01 : Dockerfile.agent + Image Build

**Description** : Créer le Dockerfile de l'image `mnm-agent:latest` qui sert de base à chaque pod utilisateur. L'image inclut Node.js 20, git, Python 3, Claude Code CLI, et un utilisateur non-root `agent` (UID 1000). Le conteneur reste vivant via `sleep infinity` pour servir de pod persistant.

**Assignation** : Tom
**Effort** : S (3 SP, 1-2j)
**Bloqué par** : Aucun
**Débloque** : POD-03 (PodManager a besoin de l'image pour provisionner)

**Acceptance Criteria** :
- Given le Dockerfile.agent When `docker build -f docker/Dockerfile.agent -t mnm-agent:latest .` s'exécute Then l'image est construite sans erreur en < 3 min
- Given l'image mnm-agent:latest When un conteneur démarre Then il tourne en utilisateur non-root `agent` (UID 1000) et reste actif via `sleep infinity`
- Given l'image When on vérifie les outils installés Then `node`, `git`, `python3`, `claude` sont disponibles dans le PATH
- Given le conteneur When il tourne Then aucun accès au socket Docker n'est possible (pas de `/var/run/docker.sock` monté)

**Statut** : DONE

**Fichiers clés** : `docker/Dockerfile.agent`

---

### Story POD-02 : DB Migration user_pods + RLS

**Description** : Créer la table `user_pods` dans PostgreSQL via migration Drizzle. La table stocke l'état de chaque pod (status, containerId, volumes, ressources, claude_auth_status). Un index UNIQUE sur `(company_id, user_id)` garantit un seul pod par utilisateur par company. RLS activé avec policy sur `company_id`.

**Assignation** : Tom
**Effort** : S (3 SP, 1-2j)
**Bloqué par** : TECH-01 (PostgreSQL), TECH-05 (RLS pattern)
**Débloque** : POD-03, POD-04

**Acceptance Criteria** :
- Given la migration When elle s'exécute Then la table `user_pods` est créée avec toutes les colonnes (id, user_id, company_id, docker_container_id, status, volume_name, etc.)
- Given la table user_pods When RLS est activé Then un utilisateur de company A ne peut voir aucun pod de company B
- Given un utilisateur When il tente de créer un second pod dans la même company Then la contrainte UNIQUE empêche l'insertion
- Given le schema Drizzle `user_pods.ts` When le typecheck s'exécute Then il passe sans erreur

**Statut** : DONE

**Fichiers clés** : `packages/db/src/schema/user_pods.ts`, `packages/db/src/migrations/0048_user_pods_and_deployments.sql`

---

### Story POD-03 : PodManager Service (provision, hibernate, wake, destroy)

**Description** : Implémenter le service `PodManager` qui gère le cycle de vie complet des pods : provisionnement (création du conteneur Docker avec volumes nommés), hibernation (arrêt du conteneur en préservant les volumes), réveil (redémarrage du conteneur existant), et destruction (suppression conteneur + volumes). Le service utilise `dockerode` pour piloter le daemon Docker et enforce les quotas (1 pod/user, 25 pods/company).

**Assignation** : Tom
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : POD-01 (image), POD-02 (DB schema)
**Débloque** : POD-04, POD-05, POD-06

**Acceptance Criteria** :
- Given un utilisateur sans pod When il appelle `provisionPod()` Then un conteneur Docker est créé avec l'image `mnm-agent:latest`, volumes nommés montés, et le statut passe à `running`
- Given un pod en état `running` When `hibernatePod()` est appelé Then le conteneur est stoppé, les volumes sont préservés, et le statut passe à `hibernated`
- Given un pod en état `hibernated` When `wakePod()` est appelé Then le conteneur redémarre avec les mêmes volumes et le statut repasse à `running`
- Given un utilisateur qui a déjà un pod actif When il tente de provisionner un second pod Then une erreur 409 Conflict est retournée
- Given une company avec 25 pods actifs When un 26e provisionnement est tenté Then le quota est refusé avec une erreur explicite

**Statut** : DONE

**Fichiers clés** : `server/src/services/pod-manager.ts`, `server/src/services/docker-client.ts`

---

### Story POD-04 : Pod API Routes + RBAC

**Description** : Exposer les endpoints REST pour la gestion des pods : `POST /pods/provision`, `GET /pods/my`, `POST /pods/my/wake`, `POST /pods/my/hibernate`, `DELETE /pods/my`, et `GET /pods` (admin). Chaque route vérifie les permissions RBAC (`agents:launch` pour les opérations sur son propre pod, `agents:manage_containers` pour les opérations admin). Audit trail émis sur chaque action.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : POD-03 (PodManager service)
**Débloque** : POD-05, POD-06

**Acceptance Criteria** :
- Given un utilisateur avec permission `agents:launch` When il POST `/pods/provision` Then un pod est créé et une réponse 202 est retournée avec le podId
- Given un utilisateur viewer (sans `agents:launch`) When il tente de provisionner un pod Then il reçoit 403 Forbidden
- Given un admin avec `agents:manage_containers` When il GET `/pods` Then il voit tous les pods de sa company
- Given une action de pod (provision, wake, hibernate, destroy) When elle réussit Then un événement audit est émis dans la table `audit_events`

**Statut** : DONE

**Fichiers clés** : `server/src/routes/pods.ts`

---

### Story POD-05 : Pod Console (chat-style exec, stdin support)

**Description** : Implémenter un système d'exécution de commandes dans le pod via API REST (style chat console), en remplacement du terminal WebSocket xterm.js initialement prévu. Le endpoint `POST /pods/my/exec` accepte une commande et un stdin optionnel, exécute via `docker exec` dans le conteneur, et retourne stdout/stderr. Le support stdin permet notamment l'authentification interactive Claude (`claude login`).

**Assignation** : Tom
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : POD-03, POD-04
**Débloque** : POD-06

**Acceptance Criteria** :
- Given un pod en état `running` When l'utilisateur POST `/pods/my/exec` avec `{ command: "ls -la" }` Then la sortie stdout/stderr est retournée en JSON
- Given un pod qui n'est pas `running` When une commande exec est envoyée Then une erreur 409 est retournée avec le statut actuel du pod
- Given une commande nécessitant du stdin When le body inclut `{ command: "claude login", stdin: "..." }` Then le stdin est pipé au processus dans le conteneur
- Given un utilisateur sans pod When il tente un exec Then il reçoit 404 avec un message explicite
- Given la permission `agents:launch` When elle est absente Then le endpoint retourne 403

**Statut** : DONE

**Fichiers clés** : `server/src/routes/pod-exec.ts`

---

### Story POD-06 : Workspace UI Page (status + console)

**Description** : Créer la page `/workspace` ("My Workspace") avec la carte de statut du pod (provisioning/running/idle/hibernated/failed) et la console intégrée. La carte affiche le statut avec des icônes colorées, les boutons d'action contextuels (Provision/Wake/Hibernate/Destroy), et les métadonnées du pod (image, ressources, dernière activité). La console PodConsole permet d'exécuter des commandes dans le pod via l'API exec.

**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : POD-04, POD-05
**Débloque** : POD-07

**Acceptance Criteria** :
- Given un utilisateur sans pod When il accède à `/workspace` Then il voit un bouton "Provision Pod" et aucune console
- Given un pod en état `running` When l'utilisateur accède à `/workspace` Then la carte de statut affiche "running" en vert et la console est active
- Given un pod en état `hibernated` When l'utilisateur accède à `/workspace` Then un bouton "Wake" est visible et la console est désactivée
- Given la console When l'utilisateur tape une commande et appuie sur Entrée Then la commande est envoyée via l'API exec et le résultat s'affiche dans la console
- Given un pod avec `claude_auth_status` When la page s'affiche Then le statut d'authentification Claude est visible dans la carte

**Statut** : DONE

**Fichiers clés** : `ui/src/pages/Workspace.tsx`, `ui/src/components/workspace/PodConsole.tsx`, `ui/src/api/pods.ts`

---

### Story POD-07 : Sidebar "My Workspace" Link + Route Registration

**Description** : Ajouter le lien "My Workspace" dans la sidebar de navigation principale avec l'icône Terminal, et enregistrer la route `/workspace` dans le routeur React. Le lien est visible pour tous les utilisateurs ayant la permission `agents:launch`.

**Assignation** : Tom
**Effort** : S (2 SP, 1j)
**Bloqué par** : POD-06 (la page Workspace doit exister)
**Débloque** : Aucun (finition UX)

**Acceptance Criteria** :
- Given la sidebar When un utilisateur avec `agents:launch` la consulte Then le lien "My Workspace" avec l'icône Terminal est visible
- Given le lien "My Workspace" When l'utilisateur clique dessus Then il est navigué vers `/workspace` et la page Workspace se charge
- Given la route `/workspace` When elle est enregistrée dans le routeur Then le composant Workspace est rendu correctement avec le layout company

**Statut** : DONE

**Fichiers clés** : `ui/src/components/Sidebar.tsx`, `ui/src/lib/company-routes.ts`

---

### Story POD-08 : Pod Admin View (list all company pods)

**Description** : Créer une vue d'administration permettant aux admins de visualiser tous les pods de leur company. La vue affiche un tableau avec : utilisateur, statut du pod, image Docker, ressources (CPU/RAM), dernière activité, statut Claude auth. Les admins peuvent forcer l'hibernation ou la destruction des pods d'autres utilisateurs. Accessible via le endpoint existant `GET /pods` (permission `agents:manage_containers`).

**Assignation** : Tom
**Effort** : S (3 SP, 2j)
**Bloqué par** : POD-04 (l'endpoint admin `GET /pods` doit exister)
**Débloque** : Aucun

**Acceptance Criteria** :
- Given un admin When il accède à la vue admin des pods Then il voit un tableau listant tous les pods de sa company avec utilisateur, statut, image, ressources et dernière activité
- Given un utilisateur non-admin When il tente d'accéder à la vue admin Then il reçoit 403 ou la vue n'est pas visible dans la navigation
- Given un admin When il clique "Hibernate" sur le pod d'un autre utilisateur Then le pod est mis en hibernation et le statut se met à jour dans le tableau
- Given un admin When il clique "Destroy" sur un pod Then une confirmation est demandée et le pod est détruit après validation

**Statut** : TODO

**Fichiers clés** : À créer — `ui/src/pages/PodAdmin.tsx` ou intégration dans une page Settings existante

---

## Graphe de Dépendances

```
POD-01 (Dockerfile) ─────┐
                          ├──► POD-03 (PodManager) ──► POD-04 (API) ──► POD-05 (Console) ──► POD-06 (Workspace UI) ──► POD-07 (Sidebar)
POD-02 (DB migration) ───┘                                   │
                                                              └──► POD-08 (Admin view)
```

---

## Notes de Pivot

**POD-05** a été pivoté de "WebSocket terminal relay (xterm.js)" vers "Pod Console (chat-style exec)". Raison : le terminal WebSocket avec xterm.js ajoutait une complexité significative (gestion des resize events, reconnection, binary frames) pour un usage MVP. La console chat-style via API REST exec avec support stdin couvre les cas d'usage critiques (exécution de commandes, authentification Claude) avec une implémentation plus simple et plus stable.
