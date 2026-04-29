# CONF-S02 — Backend CRUD + Conflict Detection

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONF-S02 |
| **Titre** | Backend CRUD + Conflict Detection — services, 22+ routes, 8 permissions |
| **Epic** | Epic CONF — Config Layers |
| **Effort** | XL (13 SP, 7-9j) |
| **Priorite** | P0 — Service central de l'epic, bloque frontend et runtime |
| **Assignation** | Tom |
| **Bloque par** | CONF-S01 (tables DB + migrations) |
| **Debloque** | CONF-S03 (Runtime Merge), CONF-S04 (OAuth), CONF-S05 (Frontend) |
| **Statut** | DONE |
| **Type** | Backend (services + routes + seed permissions + tag filter) |

---

## Contexte

Une fois les tables creees (CONF-S01), il faut exposer le systeme config layers via une API REST complete. Cette story est la plus volumineuse de l'epic : elle couvre le cycle de vie complet des layers (CRUD, items, fichiers, revisions, promotion), la detection de conflits entre layers, et la securite (8 nouvelles permissions + filtrage par tags).

Deux services principaux :

1. **`config-layer.ts`** : CRUD layers/items/files/revisions, promotion de scope, liste enrichie (avec nom du createur, breakdown des items par type, nombre d'agents utilisant la layer)

2. **`config-layer-conflict.ts`** : detection de conflits entre les layers attachees a un agent, advisory locks PostgreSQL pour la concurrence, preview du merge avant application

L'ajout des 8 permissions dans le seed garantit que le RBAC dynamique couvre les nouvelles operations sans hardcoder de roles.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| CONF-S01 | DONE | Tables config_layers, config_layer_items, agent_config_layers, etc. |
| RBAC-S01 | DONE | hasPermission(), requirePermission() middleware |
| RBAC-S02 | DONE | Seed de permissions en DB |
| CONT-S01 | DONE | TagScope middleware — filterByTags() pattern |
| OBS-S01 | DONE | auditService.emit() pour les audit events |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — CRUD Config Layers

**Given** un user avec permission `config_layers:create`
**When** il fait `POST /api/config-layers` avec `{name, scope, priority, description}`
**Then** la layer est creee en DB, une revision initiale (version=1) est creee, et la reponse contient l'objet complet

**Given** un user sans permission `config_layers:create`
**When** il fait `POST /api/config-layers`
**Then** 403 Forbidden

**Given** un user avec permission `config_layers:edit`
**When** il fait `PATCH /api/config-layers/:id` sur une layer dont il est le createur
**Then** la layer est mise a jour et une nouvelle revision est creee automatiquement

**Given** un user qui n'est pas le createur et n'est pas admin
**When** il fait `PATCH /api/config-layers/:id`
**Then** 403 Forbidden (ownership check)

**Given** un user avec permission `config_layers:delete`
**When** il fait `DELETE /api/config-layers/:id` sur une layer non-enforced
**Then** la layer est supprimee (soft delete ou cascade selon FK)

**Given** une layer avec `isEnforced = true`
**When** un non-admin tente de la supprimer
**Then** 403 Forbidden

### AC2 — CRUD Items

**Given** un user avec permission `config_layers:edit`
**When** il fait `POST /api/config-layers/:id/items` avec `{itemType, itemKey, itemValue}`
**Then** l'item est cree, une revision de la layer parente est creee

**Given** deux items avec le meme `(itemType, itemKey)` dans la meme layer
**When** le deuxieme est insere
**Then** 409 Conflict avec message "item already exists in this layer"

**Given** un item existant
**When** `PATCH /api/config-layers/:layerId/items/:itemId`
**Then** l'item est mis a jour et la layer incremente sa version

### AC3 — Revision History

**Given** une layer avec plusieurs modifications successives
**When** `GET /api/config-layers/:id/revisions`
**Then** la liste des revisions est retournee en ordre decroissant (version DESC) avec changedBy et changeNote

**Given** une revision specifique
**When** `GET /api/config-layers/:id/revisions/:version`
**Then** le snapshot complet de la layer a cette version est retourne

### AC4 — Promotion de scope

**Given** un admin avec permission `config_layers:promote`
**When** il fait `POST /api/config-layers/:id/promote` avec `{newScope: "public"}`
**Then** le scope de la layer est mis a jour, une revision "scope_promoted" est creee

**Given** un non-admin
**When** il tente de promouvoir une layer
**Then** 403 Forbidden

### AC5 — Attach/Detach d'agents

**Given** un user avec permission `config_layers:attach`
**When** il fait `POST /api/agents/:agentId/config-layers` avec `{layerId}`
**Then** l'attachement est cree dans `agent_config_layers` avec advisory lock

**Given** deux requetes concurrentes pour attacher la meme layer au meme agent
**When** elles arrivent simultanement
**Then** `pg_try_advisory_lock` garantit qu'une seule reussit, l'autre attend ou retourne une erreur appropriee

**Given** un user qui detache une layer
**When** `DELETE /api/agents/:agentId/config-layers/:layerId`
**Then** l'attachement est supprime de `agent_config_layers`

### AC6 — Detection de conflits

**Given** un agent avec deux layers attachees
**When** `GET /api/agents/:agentId/config-layers/conflicts`
**Then** le service retourne la liste des conflits : items de meme `(itemType, itemKey)` presents dans plusieurs layers, avec le detail des valeurs conflictuelles et la resolution par priorite

**Given** aucun conflit
**When** `GET /api/agents/:agentId/config-layers/conflicts`
**Then** `{conflicts: [], hasCritical: false}` est retourne

### AC7 — Merge Preview

**Given** un agent avec ses layers
**When** `GET /api/agents/:agentId/config-layers/merge-preview`
**Then** la config mergee (resultat final apres resolution par priorite) est retournee, sans ecrire en DB

### AC8 — Liste enrichie

**Given** un user avec permission `config_layers:read`
**When** `GET /api/config-layers`
**Then** la liste retourne des objets enrichis : creatorName, breakdown des items (`{mcp_server: 2, skill: 1, hook: 0, setting: 3}`), nombre d'agents utilisant la layer (`agentCount`)

### AC9 — Filtrage par tag (scope visibility)

**Given** une layer de scope "team"
**When** un user sans tag partage avec le createur fait GET /api/config-layers
**Then** la layer n'apparait pas dans sa liste

**Given** une layer de scope "public"
**When** n'importe quel user authentifie fait GET /api/config-layers
**Then** la layer apparait dans sa liste

**Given** une layer de scope "company"
**When** n'importe quel user de la company fait GET /api/config-layers
**Then** la layer apparait dans sa liste

**Given** une layer de scope "private"
**When** un user autre que le createur fait GET /api/config-layers
**Then** la layer n'apparait pas

### AC10 — Seed des 8 permissions

**Given** le serveur qui demarre
**When** il execute le seed de permissions
**Then** les 8 permissions suivantes existent en DB si absentes :
`config_layers:create`, `config_layers:edit`, `config_layers:delete`, `config_layers:read`, `config_layers:manage`, `config_layers:promote`, `config_layers:attach`, `mcp:connect`

---

## Deliverables

### D1 — Service `server/src/services/config-layer.ts`

Fonctions :
- `createLayer(companyId, userId, input)` — cree la layer + revision initiale
- `updateLayer(companyId, layerId, userId, input)` — met a jour + cree revision
- `deleteLayer(companyId, layerId, userId)` — supprime (check ownership + isEnforced)
- `getLayer(companyId, layerId)` — detail avec items et revisions
- `listLayers(companyId, userId, filters)` — liste enrichie avec scope filtering
- `createItem(companyId, layerId, userId, input)` — ajoute un item + revision
- `updateItem(companyId, layerId, itemId, userId, input)` — modifie item + revision
- `deleteItem(companyId, layerId, itemId, userId)` — supprime item + revision
- `attachLayer(companyId, agentId, layerId, userId)` — attach avec advisory lock
- `detachLayer(companyId, agentId, layerId)` — detach
- `promoteLayer(companyId, layerId, userId, newScope)` — promotion + revision
- `getRevisions(companyId, layerId)` — liste revisions
- `getRevisionSnapshot(companyId, layerId, version)` — snapshot a une version

### D2 — Service `server/src/services/config-layer-conflict.ts`

Fonctions :
- `detectConflicts(companyId, agentId)` — retourne la liste des conflits entre layers attachees
- `getMergePreview(companyId, agentId)` — retourne la config mergee finale
- `acquireAdvisoryLock(db, hash)` — wrappeur `pg_try_advisory_lock`
- `releaseAdvisoryLock(db, hash)` — wrappeur `pg_advisory_unlock`

### D3 — Routes `server/src/routes/config-layers.ts`

```
GET    /api/config-layers                              — liste enrichie
POST   /api/config-layers                              — creer une layer
GET    /api/config-layers/:id                          — detail
PATCH  /api/config-layers/:id                          — modifier
DELETE /api/config-layers/:id                          — supprimer
GET    /api/config-layers/:id/revisions                — historique
GET    /api/config-layers/:id/revisions/:version       — snapshot
POST   /api/config-layers/:id/promote                  — promouvoir scope
POST   /api/config-layers/:id/items                    — ajouter item
PATCH  /api/config-layers/:id/items/:itemId            — modifier item
DELETE /api/config-layers/:id/items/:itemId            — supprimer item
POST   /api/config-layers/:id/files                    — uploader fichier
DELETE /api/config-layers/:id/files/:fileId            — supprimer fichier
POST   /api/agents/:agentId/config-layers              — attacher layer
DELETE /api/agents/:agentId/config-layers/:layerId     — detacher layer
GET    /api/agents/:agentId/config-layers              — layers d'un agent
GET    /api/agents/:agentId/config-layers/conflicts    — conflits
GET    /api/agents/:agentId/config-layers/merge-preview — preview merge
POST   /api/config-layers/:id/duplicate                — dupliquer une layer
GET    /api/config-layers/:id/agents                   — agents utilisant la layer
```

### D4 — Validators `packages/shared/src/validators/config-layer.ts`

- `createLayerSchema` (Zod)
- `updateLayerSchema` (Zod)
- `createItemSchema` (Zod)
- `updateItemSchema` (Zod)
- `promoteLayerSchema` (Zod)
- `attachLayerSchema` (Zod)

### D5 — Seed permissions

- `server/src/db/seeds/permissions.ts` — ajout des 8 permissions `config_layers:*` et `mcp:connect`

---

## Notes techniques

- **Ownership check** : `createdByUserId === requestUserId || hasPermission('config_layers:manage')`. Les admins avec `manage` peuvent modifier n'importe quelle layer.
- **Advisory lock hash** : `hashtext(agentId || layerId)` — fonction PostgreSQL, retourne un integer. Utiliser `SELECT pg_try_advisory_xact_lock(hash)` dans une transaction pour auto-release.
- **Revision auto** : chaque mutation (update layer, add/edit/delete item) appelle `createRevision()` en fin de transaction. Pas de revision pour les GET.
- **Liste enrichie** : jointure avec `users` pour le `creatorName`, agregation `COUNT(*)` sur `config_layer_items` groupe par `itemType`, agregation `COUNT(DISTINCT agentId)` sur `agent_config_layers`.
- **Scope filtering** : applique avant de retourner la liste — `private` WHERE `createdByUserId = userId`, `team` WHERE EXISTS tags partages, `public` et `company` sans filtre supplementaire.
- **LiveEvents** : emettre `config_layer.created`, `config_layer.updated`, `config_layer.deleted`, `config_layer.attached`, `config_layer.detached` pour le frontend en temps reel.
