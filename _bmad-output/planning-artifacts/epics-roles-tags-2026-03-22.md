# Epics & Stories — Roles + Tags + Dynamic Permissions

> **Date** : 2026-03-22 | **Source** : architecture-roles-tags-2026-03-22.md (v2)
> **Total** : 8 Epics, 34 Stories
> **Ordre** : par dépendance (chaque epic débloque le suivant)

---

## Vue d'Ensemble

```
Epic 1: SCHEMA   (5 stories)  ─┐
Epic 2: PERM     (5 stories)   ├── Foundation (doit être fait en premier)
Epic 3: API      (4 stories)  ─┘
Epic 4: ISO      (4 stories)  ── Isolation (dépend de PERM)
Epic 5: TENANT   (3 stories)  ── Single-tenant (indépendant, parallélisable)
Epic 6: AGENT    (4 stories)  ── Agents + Sandbox (dépend de ISO)
Epic 7: UI       (5 stories)  ── Interface (dépend de API + ISO)
Epic 8: CAO      (4 stories)  ── CAO (dépend de tout le reste)
```

---

## Epic 1 — SCHEMA : Nouvelles Tables + Nuke Legacy

> Créer le nouveau data model et supprimer tout le code hardcodé.

### SCHEMA-01 : Tables permissions, roles, role_permissions

**En tant qu'** architecte, **je veux** les tables `permissions`, `roles`, et `role_permissions` en DB **pour que** les rôles et permissions soient entièrement dynamiques.

**Acceptance Criteria :**
- [ ] Table `permissions` créée (id, company_id, slug, description, category, is_custom, created_at)
- [ ] Table `roles` créée (id, company_id, name, slug, description, hierarchy_level, inherits_from_id, bypass_tag_filter, is_system, color, icon, created_at, updated_at)
- [ ] Table `role_permissions` créée (role_id FK, permission_id FK, PK composite)
- [ ] CHECK constraint : `inherits_from_id != id`
- [ ] Unique constraints : `(company_id, slug)` sur permissions et roles
- [ ] RLS activé sur les 3 tables (company_id)
- [ ] Schema Drizzle correspondant dans `packages/db/src/schema/`
- [ ] Export dans `packages/db/src/schema/index.ts`

**Story Points :** 3

---

### SCHEMA-02 : Table tags + tag_assignments

**En tant qu'** architecte, **je veux** les tables `tags` et `tag_assignments` **pour que** les users et agents puissent être taggés pour l'organisation et la visibilité.

**Acceptance Criteria :**
- [ ] Table `tags` créée (id, company_id, name, slug, description, color, icon, archived_at, created_at, updated_at)
- [ ] Table `tag_assignments` créée (id, company_id, target_type, target_id, tag_id, assigned_by, created_at)
- [ ] Unique constraint : `(company_id, target_type, target_id, tag_id)` sur tag_assignments
- [ ] Index `tag_assignments_target_idx` (company_id, target_type, target_id)
- [ ] Index `tag_assignments_tag_idx` (company_id, tag_id)
- [ ] `target_type` accepte 'user' et 'agent'
- [ ] RLS activé sur les 2 tables
- [ ] Schema Drizzle correspondant

**Story Points :** 3

---

### SCHEMA-03 : Modifier company_memberships (role_id FK)

**En tant qu'** architecte, **je veux** remplacer `business_role text` par `role_id UUID FK` sur `company_memberships` **pour que** les rôles soient dynamiques et non hardcodés.

**Acceptance Criteria :**
- [ ] Colonne `business_role` supprimée de `company_memberships`
- [ ] Colonne `role_id UUID NOT NULL REFERENCES roles(id)` ajoutée
- [ ] Schema Drizzle mis à jour
- [ ] Type `CompanyMembership` dans shared mis à jour (roleId au lieu de businessRole)

**Story Points :** 2

---

### SCHEMA-04 : Modifier agents (supprimer role, ajouter created_by_user_id)

**En tant qu'** architecte, **je veux** supprimer la colonne `role` hardcodée des agents et ajouter `created_by_user_id` **pour que** les agents utilisent les tags et que le sandbox routing fonctionne.

**Acceptance Criteria :**
- [ ] Colonne `agents.role` supprimée
- [ ] Colonne `agents.created_by_user_id TEXT` ajoutée
- [ ] Schema Drizzle mis à jour
- [ ] Type Agent dans shared mis à jour

**Story Points :** 2

---

### SCHEMA-05 : Nuke code legacy (constantes, presets, grants)

**En tant que** développeur, **je veux** supprimer tout le code hardcodé de rôles/permissions **pour que** le codebase soit clean et n'ait qu'une seule source de vérité (la DB).

**Acceptance Criteria :**
- [ ] `BUSINESS_ROLES`, `BusinessRole`, `BUSINESS_ROLE_LABELS` supprimés de constants.ts
- [ ] `AGENT_ROLES`, `AgentRole`, `AGENT_ROLE_LABELS` supprimés de constants.ts
- [ ] `PERMISSION_KEYS`, `PermissionKey` supprimés de constants.ts (deviennent `string`)
- [ ] `rbac-presets.ts` supprimé entièrement
- [ ] `role-hierarchy.ts` supprimé entièrement
- [ ] `principal_permission_grants` table/schema supprimé
- [ ] Tous les imports cassés corrigés (compilation propre)
- [ ] `bun run typecheck` passe

**Story Points :** 5

---

## Epic 2 — PERM : Permission Resolution

> Réécrire le moteur de permissions avec le nouveau modèle rôle + tags.

### PERM-01 : Réécrire access.ts (hasPermission, canUser)

**En tant que** développeur, **je veux** un nouveau `hasPermission()` qui résout les permissions depuis la table `roles` et vérifie l'intersection des tags **pour que** le contrôle d'accès utilise le nouveau modèle.

**Acceptance Criteria :**
- [ ] `hasPermission(companyId, userId, action, resourceTagIds?)` implémenté
- [ ] Instance admin bypass fonctionne (inchangé)
- [ ] Résolution : membership → role → role_permissions → permission slugs
- [ ] Héritage 1-niveau : role.permissions ∪ parent.permissions (pas de récursion)
- [ ] Si `resourceTagIds` fourni ET `bypass_tag_filter = false` → intersection tags vérifiée
- [ ] `canUser()` utilise le nouveau `hasPermission()`
- [ ] Anciennes fonctions supprimées : `setMemberPermissions`, `setPrincipalGrants`, `getPresetsMatrix`
- [ ] `getEffectivePermissions()` adapté au nouveau modèle

**Story Points :** 5

---

### PERM-02 : TagScope middleware

**En tant que** développeur, **je veux** un middleware `tagScopeMiddleware` qui injecte un `TagScope` opaque dans chaque requête **pour que** le tag filtering soit architecturalement enforced.

**Acceptance Criteria :**
- [ ] Type `TagScope` défini (branded type, userId, tagIds, bypassTagFilter)
- [ ] `tagScopeMiddleware` crée le TagScope à partir du membership+role du user
- [ ] Si `bypass_tag_filter = true` → tagScope avec bypass
- [ ] Si user non-authentifié → pas de TagScope (les routes protégées rejettent)
- [ ] TagScope disponible sur `req.tagScope`
- [ ] Type Express `Request` étendu pour inclure `tagScope`
- [ ] Middleware branché dans la pipeline Express (après auth, avant routes)

**Story Points :** 3

---

### PERM-03 : Cache permissions + tags

**En tant que** développeur, **je veux** un cache in-memory pour les permissions et tags des users **pour que** `hasPermission()` reste O(1) au lieu de faire 3 queries par requête.

**Acceptance Criteria :**
- [ ] `CacheInvalidator` class avec `roleCache` et `tagCache` (Map)
- [ ] Cache role+permissions par userId (TTL 5min)
- [ ] Cache tagIds par userId (TTL 5min)
- [ ] `roleChanged(companyId, affectedUserIds?)` invalide le cache ciblé ou global
- [ ] `tagChanged(companyId, affectedTargetIds?)` invalide le cache ciblé ou global
- [ ] Événements émis sur `liveEvents` pour notifier les WebSocket subscribers
- [ ] Note dans le code : remplacer par Redis si multi-process

**Story Points :** 3

---

### PERM-04 : Validation permissions au startup

**En tant que** développeur, **je veux** que le serveur valide au démarrage que tous les permission slugs utilisés dans les route guards existent dans la table `permissions` **pour que** les typos soient détectés immédiatement.

**Acceptance Criteria :**
- [ ] Fonction `validatePermissionSlugs()` appelée au startup
- [ ] Compare les slugs utilisés dans les guards vs les slugs en DB
- [ ] En `development` : throw si slug inconnu (crash le serveur)
- [ ] En `production` : log un warning (ne crash pas)
- [ ] Les route guards utilisent des constantes importées d'un module shared (pas des strings inline)

**Story Points :** 3

---

### PERM-05 : Seed permissions standard

**En tant que** développeur, **je veux** une fonction de seed qui crée les ~22 permissions standard dans la table `permissions` à la création d'une company **pour que** l'onboarding ait un set de base.

**Acceptance Criteria :**
- [ ] Fonction `seedPermissions(companyId)` crée les permissions standard
- [ ] Catégories : agents, issues, projects, users, workflows, traces, admin, chat, sandbox
- [ ] Toutes les permissions ont `is_custom = false`
- [ ] Idempotent (peut être relancé sans dupliquer)
- [ ] Appelé automatiquement à la création d'une company

**Story Points :** 2

---

## Epic 3 — API : Routes CRUD Roles, Tags, Permissions

> Exposer les nouveaux modèles via l'API REST.

### API-01 : Routes CRUD Roles

**En tant qu'** admin, **je veux** des endpoints pour gérer les rôles **pour que** je puisse créer, modifier et supprimer les rôles de mon entreprise.

**Acceptance Criteria :**
- [ ] `GET /api/roles` — liste tous les rôles (avec leurs permissions)
- [ ] `POST /api/roles` — crée un rôle (name, slug, permissions[], hierarchyLevel, inheritsFromId?, color?, icon?)
- [ ] `GET /api/roles/:roleId` — détail d'un rôle + permissions
- [ ] `PATCH /api/roles/:roleId` — modifier (name, permissions, level, inheritsFrom, bypass)
- [ ] `DELETE /api/roles/:roleId` — supprimer (interdit si `is_system = true`)
- [ ] Permission requise : `roles:manage`
- [ ] Validation : `inheritsFromId` ne peut pas pointer vers un rôle qui hérite déjà
- [ ] Cache invalidation sur chaque mutation
- [ ] Audit log sur chaque mutation

**Story Points :** 5

---

### API-02 : Routes CRUD Tags

**En tant qu'** admin, **je veux** des endpoints pour gérer les tags **pour que** je puisse organiser mon entreprise en équipes, produits, fonctions.

**Acceptance Criteria :**
- [ ] `GET /api/tags` — liste les tags (exclut archivés par défaut, `?includeArchived=true`)
- [ ] `POST /api/tags` — crée un tag (+ auto-assign au CAO si CAO existe)
- [ ] `GET /api/tags/:tagId` — détail d'un tag + count membres
- [ ] `PATCH /api/tags/:tagId` — modifier (name, description, color, icon)
- [ ] `POST /api/tags/:tagId/archive` — archiver
- [ ] `DELETE /api/tags/:tagId` — supprimer (seulement si 0 assignments)
- [ ] Permission requise : `tags:manage`
- [ ] Audit log sur chaque mutation

**Story Points :** 5

---

### API-03 : Routes Tag Assignments

**En tant qu'** admin, **je veux** des endpoints pour assigner/retirer des tags aux users et agents **pour que** je puisse gérer la visibilité.

**Acceptance Criteria :**
- [ ] `GET /api/users/:userId/tags` — tags d'un user
- [ ] `PUT /api/users/:userId/tags` — set (replace all) les tags d'un user
- [ ] `POST /api/users/:userId/tags/:tagId` — ajouter un tag
- [ ] `DELETE /api/users/:userId/tags/:tagId` — retirer un tag
- [ ] Mêmes 4 routes pour `/api/agents/:agentId/tags`
- [ ] `GET /api/tags/:tagId/members` — tous les users + agents avec ce tag
- [ ] Permissions : `users:manage` pour user tags, `agents:configure` pour agent tags
- [ ] Cache invalidation sur chaque mutation
- [ ] Audit log (tag_assignment.created, tag_assignment.removed)

**Story Points :** 5

---

### API-04 : Routes Permissions + Member Role

**En tant qu'** admin, **je veux** voir les permissions disponibles et changer le rôle des membres **pour que** je puisse configurer finement les accès.

**Acceptance Criteria :**
- [ ] `GET /api/permissions` — liste des permissions (seed + custom)
- [ ] `POST /api/permissions` — créer une permission custom (is_custom=true)
- [ ] `PATCH /api/members/:memberId/role` — changer le rôle d'un membre
- [ ] Contrôle hiérarchique : rôle cible doit avoir `hierarchy_level >= acteur`
- [ ] Permission requise : `roles:manage` (permissions), `users:manage` (member role)
- [ ] Cache invalidation + audit log

**Story Points :** 3

---

## Epic 4 — ISO : Tag-Based Isolation

> Enforcer le filtrage par tags dans tous les services qui retournent des données.

### ISO-01 : Tag filtering sur les agents

**En tant que** user, **je veux** ne voir que les agents qui partagent au moins un de mes tags **pour que** je n'accède pas aux agents d'autres équipes.

**Acceptance Criteria :**
- [ ] `listAgents()` exige un `TagScope` en paramètre
- [ ] Si `bypass_tag_filter` → retourne tous les agents
- [ ] Sinon → INNER JOIN `tag_assignments` filtré par `scope.tagIds`
- [ ] `getAgent(id)` vérifie aussi l'intersection de tags avant de retourner
- [ ] Un agent sans tags est invisible par tous (sauf bypass)
- [ ] Test E2E : user avec Tag-A ne voit pas un agent tagué Tag-B uniquement

**Story Points :** 5

---

### ISO-02 : Tag filtering sur les issues

**En tant que** user, **je veux** ne voir que les issues de mes tags ou assignées directement à moi **pour que** je n'accède pas aux issues d'autres équipes.

**Acceptance Criteria :**
- [ ] `listIssues()` exige un `TagScope`
- [ ] Visible si : `assignee_tag_id ∈ scope.tagIds` OU `assignee_user_id = scope.userId`
- [ ] Issues pool global (3 assignees NULL) → visibles UNIQUEMENT si `bypass_tag_filter`
- [ ] Query param `?pool=true` → filtre les issues sans assignee direct
- [ ] Query param `?tagId=uuid` → filtre par tag spécifique
- [ ] Test E2E : user avec Tag-A ne voit pas issue assignée à Tag-B

**Story Points :** 5

---

### ISO-03 : Tag filtering sur traces et runs

**En tant que** user, **je veux** ne voir que les traces des agents que je peux voir **pour que** l'observabilité respecte l'isolation par tags.

**Acceptance Criteria :**
- [ ] `listTraces()` filtre via la visibilité de l'agent parent
- [ ] Si user ne voit pas l'agent → il ne voit pas ses traces
- [ ] `getTrace(id)` vérifie la visibilité de l'agent avant de retourner
- [ ] Les runs (heartbeat_runs) sont filtrés de la même façon

**Story Points :** 3

---

### ISO-04 : Tests E2E isolation inter-tags

**En tant que** QA, **je veux** des tests E2E qui vérifient l'isolation entre tags **pour que** toute régression de sécurité soit détectée.

**Acceptance Criteria :**
- [ ] Fixture : 2 users avec des tags différents (Tag-A, Tag-B)
- [ ] Fixture : 1 agent avec Tag-A, 1 agent avec Tag-B
- [ ] Fixture : 1 issue assignée à Tag-A, 1 à Tag-B
- [ ] Test : User-A voit agent Tag-A, ne voit PAS agent Tag-B
- [ ] Test : User-B voit agent Tag-B, ne voit PAS agent Tag-A
- [ ] Test : Même chose pour les issues
- [ ] Test : Admin voit tout (bypass_tag_filter)
- [ ] Test : User sans tags ne voit rien

**Story Points :** 5

---

## Epic 5 — TENANT : Single-Tenant Simplification

> Simplifier pour le cas 1 instance = 1 entreprise.

### TENANT-01 : Auto-inject companyId middleware

**En tant que** développeur, **je veux** que le companyId soit auto-injecté pour la seule company existante **pour que** les routes n'aient plus besoin du paramètre `:companyId`.

**Acceptance Criteria :**
- [ ] Middleware : si 1 seule company en DB → auto-inject dans `req`
- [ ] `tenant-context.ts` adapté pour le mode single-tenant
- [ ] Toutes les routes `/api/companies/:companyId/*` fonctionnent aussi en `/api/*`
- [ ] Le RLS continue de fonctionner (set_config toujours appelé)

**Story Points :** 3

---

### TENANT-02 : Supprimer companyId des URL paths

**En tant que** développeur, **je veux** supprimer `:companyId` des routes API **pour que** l'API soit plus simple en single-tenant.

**Acceptance Criteria :**
- [ ] Toutes les routes `/api/companies/:companyId/...` deviennent `/api/...`
- [ ] Le frontend n'envoie plus de companyId dans les URLs
- [ ] Les hooks React Query mis à jour
- [ ] L'API agent (JWT) continue de fonctionner

**Story Points :** 5

---

### TENANT-03 : Supprimer company UI

**En tant que** user, **je veux** que la sidebar ne montre plus de sélecteur de company **pour que** l'interface soit plus simple.

**Acceptance Criteria :**
- [ ] Company selector sidebar supprimé
- [ ] Company creation flow supprimé (ou caché)
- [ ] Company switching supprimé
- [ ] Le nom de la company reste visible dans les settings

**Story Points :** 2

---

## Epic 6 — AGENT : Visibilité Agents + Sandbox Routing

> Les agents sont visibles par tags et s'exécutent dans le sandbox du triggering user.

### AGENT-01 : Agent creation avec tags obligatoires

**En tant que** user, **je veux** assigner des tags à un agent à sa création **pour que** les bonnes personnes puissent le voir et le lancer.

**Acceptance Criteria :**
- [ ] Le formulaire de création d'agent affiche un sélecteur de tags (multi-select)
- [ ] Au moins 1 tag obligatoire (validation frontend + backend)
- [ ] Pré-sélection = les tags du créateur (suggestion)
- [ ] Le champ `role` dropdown est supprimé (remplacé par les tags)
- [ ] `created_by_user_id` rempli automatiquement
- [ ] `tag_assignments` créés pour l'agent

**Story Points :** 3

---

### AGENT-02 : Partage d'agent par ajout de tag

**En tant que** user, **je veux** ajouter un tag à un agent **pour que** les membres de ce tag puissent le voir et le lancer.

**Acceptance Criteria :**
- [ ] Sur la page agent detail, section "Tags" éditable
- [ ] Ajouter un tag = l'agent devient visible par tous les users avec ce tag
- [ ] Retirer un tag = l'agent n'est plus visible pour ce groupe
- [ ] Permission requise : `agents:configure`
- [ ] Audit log sur chaque changement de tag agent

**Story Points :** 3

---

### AGENT-03 : Sandbox routing — resolveRunActor

**En tant que** développeur, **je veux** que `executeRun()` résolve l'acteur du run pour l'exécuter dans le bon sandbox **pour que** chaque exécution soit personnelle.

**Acceptance Criteria :**
- [ ] `resolveRunActor()` implémenté avec la priority chain :
  1. `wakeupRequest.requestedByActorId` (clic manual)
  2. `issue.assigneeUserId` (issue)
  3. `issue.createdByUserId` (issue fallback)
  4. `agent.createdByUserId` (timer, A2A)
- [ ] Error si aucun acteur résolvable (jamais d'exécution sans acteur)
- [ ] L'acteur résolu est passé au sandbox manager pour l'exécution Docker

**Story Points :** 3

---

### AGENT-04 : Liste agents filtrée dans le dashboard

**En tant que** user, **je veux** voir seulement les agents de mes tags dans le dashboard **pour que** l'interface montre ce qui me concerne.

**Acceptance Criteria :**
- [ ] Page Agents utilise le nouveau endpoint filtré par TagScope
- [ ] Les tags de chaque agent sont affichés (badges colorés)
- [ ] Filtre par tag disponible dans l'UI (dropdown)
- [ ] Count agents visible = seulement ceux de mes tags

**Story Points :** 3

---

## Epic 7 — UI : Admin Panel + Onboarding

> Refaire l'interface d'administration et l'onboarding wizard.

### UI-01 : Admin panel — Gestion des rôles

**En tant qu'** admin, **je veux** un panel pour gérer les rôles de mon entreprise **pour que** je puisse définir les permissions de chaque rôle.

**Acceptance Criteria :**
- [ ] Page `/settings/roles` avec la liste des rôles
- [ ] Formulaire de création de rôle (nom, description, couleur, icône)
- [ ] Éditeur de permissions : checkbox grid (catégories × permissions)
- [ ] Héritage : dropdown pour sélectionner un rôle parent
- [ ] `hierarchy_level` : slider ou input numérique
- [ ] Les rôles `is_system` ne peuvent pas être supprimés
- [ ] Confirmation avant suppression d'un rôle non-system

**Story Points :** 5

---

### UI-02 : Admin panel — Gestion des tags

**En tant qu'** admin, **je veux** un panel pour gérer les tags **pour que** je puisse organiser mon entreprise.

**Acceptance Criteria :**
- [ ] Page `/settings/tags` avec la liste des tags (actifs et archivés)
- [ ] Formulaire de création de tag (nom, description, couleur, icône)
- [ ] Voir les membres d'un tag (users + agents) avec count
- [ ] Archiver/désarchiver un tag
- [ ] Supprimer un tag (seulement si 0 assignments)
- [ ] Badge "archivé" sur les tags archivés

**Story Points :** 5

---

### UI-03 : Admin panel — Gestion des membres (rôles + tags)

**En tant qu'** admin, **je veux** gérer les rôles et tags des membres **pour que** je puisse contrôler les accès et la visibilité.

**Acceptance Criteria :**
- [ ] Page `/settings/members` : liste des membres avec rôle et tags
- [ ] Dropdown pour changer le rôle d'un membre
- [ ] Multi-select pour gérer les tags d'un membre
- [ ] Contrôle hiérarchique (ne peut pas assigner un rôle plus élevé que le sien)
- [ ] Filtrer les membres par tag ou par rôle

**Story Points :** 5

---

### UI-04 : Onboarding wizard repensé (5 steps)

**En tant que** nouvel admin, **je veux** un onboarding guidé **pour que** je puisse configurer mon instance rapidement.

**Acceptance Criteria :**
- [ ] Step 1 : Company Info (nom, logo, secteur)
- [ ] Step 2 : Rôles — 3 presets ("Startup", "Structurée", "Custom") + éditeur de permissions
- [ ] Step 3 : Tags — création des premiers tags (par équipe, produit, ou custom)
- [ ] Step 4 : Inviter les membres (email + rôle + tags, batch possible)
- [ ] Step 5 : Premier agent (avec tags pré-sélectionnés)
- [ ] Le rôle Admin + CAO sont créés automatiquement (is_system)
- [ ] Les permissions sont seedées au step 1
- [ ] Navigation avant/arrière entre les steps

**Story Points :** 8

---

### UI-05 : Issue assignment par tag (Task Pool)

**En tant que** user, **je veux** assigner une issue à un tag **pour que** tous les membres de ce tag la voient dans leur pool.

**Acceptance Criteria :**
- [ ] Dans le formulaire d'issue, nouveau champ "Assigner à un tag" (dropdown tags)
- [ ] Mutuellement compatible avec assignee_user_id et assignee_agent_id
- [ ] Vue "Pool" : filtre les issues assignées à un de mes tags sans assignee direct
- [ ] Action "Prendre" : self-assign une issue du pool
- [ ] Badge tag sur les issues dans la liste

**Story Points :** 5

---

## Epic 8 — CAO : Chief Agent Officer

> L'agent système qui surveille et conseille.

### CAO-01 : Agent CAO system (adapter_type, auto-création)

**En tant que** développeur, **je veux** un agent CAO auto-créé au setup **pour que** le watchdog soit toujours présent.

**Acceptance Criteria :**
- [ ] Nouveau `adapter_type = "system"` ajouté aux constantes
- [ ] Le CAO est créé automatiquement à la création d'une company (après seed)
- [ ] `is_system = true` sur la row agents (non-supprimable)
- [ ] Rôle Admin assigné, `bypass_tag_filter = true`
- [ ] Tous les tags existants assignés au CAO

**Story Points :** 3

---

### CAO-02 : Hook auto-tagging (nouveau tag → CAO)

**En tant que** développeur, **je veux** que chaque nouveau tag créé soit automatiquement assigné au CAO **pour que** le CAO ne perde jamais de visibilité.

**Acceptance Criteria :**
- [ ] Fonction `onTagCreated()` insère un `tag_assignments` pour le CAO
- [ ] Idempotent (onConflictDoNothing)
- [ ] Appelé dans le service de création de tags (API-02)
- [ ] Test : créer un tag → vérifier que le CAO a le tag

**Story Points :** 2

---

### CAO-03 : CAO watchdog (mode silencieux)

**En tant qu'** admin, **je veux** que le CAO détecte les anomalies et les signale **pour que** je sois alerté des problèmes sans être bloqué.

**Acceptance Criteria :**
- [ ] Hook sur `issue.created` : vérifier si le tag assigné existe et n'est pas archivé
- [ ] Hook sur `agent.error` : détecter les erreurs récurrentes (3+ en 1h)
- [ ] Détection : users sans tags
- [ ] Détection : agents sans tags
- [ ] Le CAO commente les issues avec ses warnings
- [ ] Les warnings sont loggés dans l'audit trail
- [ ] Le CAO ne BLOQUE jamais (warnings seulement)

**Story Points :** 5

---

### CAO-04 : CAO interactif (@cao)

**En tant que** user, **je veux** pouvoir poser des questions au CAO via @cao dans un commentaire **pour que** j'obtienne des réponses contextualisées.

**Acceptance Criteria :**
- [ ] Détection de `@cao` dans les commentaires d'issues
- [ ] Le CAO répond via le système de chat existant
- [ ] Utilise `claude -p --model sonnet` pour les réponses
- [ ] Le CAO a accès au contexte de l'issue (description, comments, tags, agent)
- [ ] Réponses type : "quels agents sont dispo", "résume l'état", "qui devrait prendre ça"

**Story Points :** 5

---

## Résumé

| Epic | Stories | Points | Dépend de |
|------|---------|--------|-----------|
| **SCHEMA** | 5 | 15 | — |
| **PERM** | 5 | 16 | SCHEMA |
| **API** | 4 | 18 | SCHEMA, PERM |
| **ISO** | 4 | 18 | PERM |
| **TENANT** | 3 | 10 | — (parallélisable) |
| **AGENT** | 4 | 12 | ISO |
| **UI** | 5 | 28 | API, ISO |
| **CAO** | 4 | 15 | SCHEMA, PERM, API |
| **TOTAL** | **34** | **132** | |

### Ordre Recommandé

```
Sprint 1 : SCHEMA (15 SP) + TENANT (10 SP)     = 25 SP
Sprint 2 : PERM (16 SP) + API (18 SP)           = 34 SP
Sprint 3 : ISO (18 SP) + AGENT-01..02 (6 SP)    = 24 SP
Sprint 4 : AGENT-03..04 (6 SP) + UI (28 SP)     = 34 SP
Sprint 5 : CAO (15 SP)                          = 15 SP
```
