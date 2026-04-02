# CONF-S01 — Schema DB + Migrations (Config Layers)

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONF-S01 |
| **Titre** | Schema DB + Migrations — 8 tables, 3 migrations, RLS |
| **Epic** | Epic CONF — Config Layers |
| **Effort** | L (8 SP, 4-5j) |
| **Priorite** | P0 — Fondation bloquante pour toute l'epic |
| **Assignation** | Tom |
| **Bloque par** | Aucun |
| **Debloque** | CONF-S02, CONF-S03, CONF-S04, CONF-S05 |
| **Statut** | DONE |
| **Type** | DB-only (schema + migrations + RLS, pas de routes ni UI) |

---

## Contexte

Le systeme actuel stocke la configuration des agents dans un champ `adapterConfig JSONB` non structure sur la table `agents`. Ce champ est une boite noire : aucune validation, aucun partage entre agents, aucune visibilite admin, aucun historique.

Pour supporter un systeme de couches de configuration (Config Layers), il faut d'abord poser la fondation DB :
- 8 nouvelles tables avec RLS multi-tenant
- 3 migrations sequentielles (creation tables, ajout FK sur agents, data migration)
- Indexes pour les requetes de merge par priorite
- Contraintes d'integrite (scopes valides, types d'items valides, priorite range)

Cette story est le prerequis bloquant de toute l'epic CONF.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| TECH-01 | DONE | PostgreSQL 16 + Drizzle ORM + systeme de migrations |
| RBAC-S01 | DONE | hasPermission() — pattern RBAC pour RLS policies |
| CONT-S01 | DONE | Tags et TagScope — pattern d'isolation par tags |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Migration 0052 : Creation des 8 tables

**Given** la migration 0052
**When** elle s'execute sur une DB propre
**Then** les 8 tables suivantes sont creees avec toutes leurs colonnes, contraintes, et indexes :
- `config_layers` (id, companyId, name, description, scope, priority, isEnforced, createdByUserId, createdAt, updatedAt)
- `config_layer_items` (id, layerId, itemType, itemKey, itemValue JSONB, isEnabled, createdAt, updatedAt)
- `config_layer_files` (id, layerId, filename, content TEXT, mimeType, createdAt, updatedAt)
- `config_layer_revisions` (id, layerId, version INT, snapshot JSONB, changedBy, changeNote, createdAt)
- `agent_config_layers` (agentId, layerId, attachedAt, attachedBy — PK composite)
- `workflow_template_stage_layers` (stageId, layerId, attachedAt — PK composite)
- `workflow_stage_config_layers` (stageInstanceId, layerId, attachedAt — PK composite)
- `user_mcp_credentials` (id, userId, companyId, mcpServerId, providerName, encryptedToken, encryptedRefreshToken, expiresAt, createdAt, updatedAt)

### AC2 — RLS sur les 8 tables

**Given** chaque table creee par la migration 0052
**When** un user avec un companyId X tente de lire une row d'une company Y
**Then** la RLS policy bloque l'acces et retourne zero rows

### AC3 — Migration 0053 : FK base_layer_id sur agents

**Given** la migration 0053
**When** elle s'execute
**Then** la colonne `base_layer_id TEXT NULLABLE FK config_layers(id)` est ajoutee sur la table `agents`

**And** un agent peut avoir `base_layer_id = NULL` (fallback legacy `adapterConfig`)

### AC4 — Migration 0054 : Data migration adapterConfig vers base layers

**Given** des agents existants avec `adapterConfig` non vide
**When** la migration 0054 s'execute
**Then** pour chaque agent, une `config_layer` de scope "private" et priorite 500 est creee avec les items issus de `adapterConfig`, et `base_layer_id` est mis a jour sur l'agent

**And** les agents avec `adapterConfig` null ou `{}` ne sont pas migres (base_layer_id reste NULL)

**And** la migration est idempotente (re-executer ne cree pas de doublons)

### AC5 — Indexes de performance pour le merge

**Given** la table `config_layer_items`
**When** le merge engine fait une requete `ORDER BY priority DESC`
**Then** l'index `(layerId, itemType, itemKey)` est utilise (EXPLAIN ANALYZE confirme)

### AC6 — Contraintes d'integrite

**Given** une tentative d'insertion dans `config_layers` avec `scope NOT IN ('private','team','public','company')`
**When** la requete s'execute
**Then** PostgreSQL leve une violation de contrainte CHECK

**And** une `config_layer` avec `isEnforced = true` ne peut avoir que `scope = 'company'`

**And** `config_layer_items.itemType` est contraint a `('mcp_server','skill','hook','setting')`

---

## Schema de donnees

### Table `config_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | text | PK, uuid default | Identifiant unique |
| companyId | text | FK companies, NOT NULL, INDEX | Tenant isolation |
| name | text | NOT NULL | Nom affiche dans l'UI |
| description | text | NULLABLE | Description optionnelle |
| scope | text | NOT NULL, CHECK(private/team/public/company) | Visibilite |
| priority | integer | NOT NULL, DEFAULT 500, CHECK(0..999) | Priorite de merge |
| isEnforced | boolean | NOT NULL, DEFAULT false | Layer company non contournable |
| createdByUserId | text | FK users, NOT NULL | Createur |
| createdAt | timestamp | NOT NULL, DEFAULT now() | |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | |

### Table `config_layer_items`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | text | PK, uuid default | |
| layerId | text | FK config_layers, NOT NULL, INDEX | Layer parente |
| itemType | text | NOT NULL, CHECK(mcp_server/skill/hook/setting) | Type d'item |
| itemKey | text | NOT NULL | Cle unique dans la layer (ex: nom du MCP server) |
| itemValue | jsonb | NOT NULL | Configuration de l'item |
| isEnabled | boolean | NOT NULL, DEFAULT true | Actif ou desactive |
| createdAt | timestamp | NOT NULL, DEFAULT now() | |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | |

**Contrainte UNIQUE** : `(layerId, itemType, itemKey)`

### Table `config_layer_revisions`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | text | PK, uuid default | |
| layerId | text | FK config_layers, NOT NULL, INDEX | Layer versionnee |
| version | integer | NOT NULL | Numero de version (auto-increment par layerId) |
| snapshot | jsonb | NOT NULL | Etat complet de la layer a ce moment |
| changedBy | text | FK users, NOT NULL | Auteur du changement |
| changeNote | text | NULLABLE | Note optionnelle |
| createdAt | timestamp | NOT NULL, DEFAULT now() | |

### Table `agent_config_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| agentId | text | FK agents, NOT NULL | Agent |
| layerId | text | FK config_layers, NOT NULL | Layer attachee |
| attachedAt | timestamp | NOT NULL, DEFAULT now() | Date d'attachement |
| attachedBy | text | FK users, NOT NULL | Qui a attache |

**PK composite** : `(agentId, layerId)`

### Indexes supplementaires

- `config_layers_company_idx` on `config_layers(companyId)`
- `config_layers_scope_idx` on `config_layers(companyId, scope)`
- `config_layer_items_layer_idx` on `config_layer_items(layerId)`
- `config_layer_items_merge_idx` on `config_layer_items(layerId, itemType, itemKey)`
- `config_layer_revisions_layer_idx` on `config_layer_revisions(layerId, version DESC)`
- `agent_config_layers_agent_idx` on `agent_config_layers(agentId)`
- `user_mcp_credentials_user_idx` on `user_mcp_credentials(userId, companyId)`

---

## Deliverables

### D1 — Schemas Drizzle

- `packages/db/src/schema/config-layers.ts` — tables `config_layers`, `config_layer_items`, `config_layer_files`, `config_layer_revisions`
- `packages/db/src/schema/agent-config-layers.ts` — tables `agent_config_layers`, `workflow_template_stage_layers`, `workflow_stage_config_layers`
- `packages/db/src/schema/user-mcp-credentials.ts` — table `user_mcp_credentials`
- `packages/db/src/schema/index.ts` — exports des nouvelles tables

### D2 — Migrations SQL

- `packages/db/src/migrations/0052_config_layers.sql` — creation des 8 tables + indexes + RLS
- `packages/db/src/migrations/0053_agents_base_layer.sql` — ajout FK `base_layer_id` sur agents
- `packages/db/src/migrations/0054_migrate_adapter_config.sql` — PL/pgSQL : migration des adapterConfig existants

### D3 — Types partages

- `packages/shared/src/types/config-layer.ts` — interfaces ConfigLayer, ConfigLayerItem, ConfigLayerRevision, AgentConfigLayer
- `packages/shared/src/types/index.ts` — re-export

---

## Notes techniques

- **RLS pattern** : identique aux autres tables — policy `USING (company_id = current_setting('app.company_id'))` activee avec `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **Migration 0054 idempotente** : `WHERE base_layer_id IS NULL AND adapter_config IS NOT NULL AND adapter_config != '{}'::jsonb`
- **PL/pgSQL data migration** : utiliser une fonction anonyme `DO $$ ... $$` pour iterer sur les agents et creer les layers
- **Drizzle schema** : utiliser `pgTable` avec `relations()` pour les FK, indexes via `index()` et `uniqueIndex()`
- **Priority range** : CHECK `priority >= 0 AND priority <= 999`. La layer company est fixee a 999. Les agents base layers sont a 500. Les layers supplementaires entre 0 et 498.
