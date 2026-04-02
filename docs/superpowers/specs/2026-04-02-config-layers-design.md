# Config Layers — MCP / Skills / Hooks / Settings

**Date:** 2026-04-02
**Status:** Spec finale — post-review (6 personas: securite, SQL, produit, backend, frontend, DBA)
**Auteur:** tom.andrieu

---

## 1. Contexte & Objectif

MnM est un cockpit B2B de supervision d'agents IA. Les agents tournent dans des sandboxes Docker (ou en local) et utilisent Claude Code comme runtime principal.

**Objectif :** Remplacer le systeme actuel de configuration agent (`adapterConfig` JSONB) par un systeme structure de config layers avec heritage, RBAC, audit, et partage. L'UI parle directement de "MCP Servers", "Skills", "Hooks", et "Settings" — pas de terme parapluie artificiel.

## 2. Decisions de design

| Question | Decision |
|----------|----------|
| Modele | Catalogue company + base layer agent + layers partages + custom prive |
| Heritage | Company (force) -> Shared layers -> Agent base layer |
| Naming UI | Pas de terme parapluie. L'UI dit "MCP Servers", "Skills", "Hooks", "Settings" |
| adapterConfig | Devient un output calcule (cache), plus un input. Toute config vit dans les layers |
| MCP hosting | Consommateur uniquement — endpoints fournis par l'infra ou providers officiels |
| OAuth | Per-user, lie au createur/owner de l'agent |
| Skills | Structure complete Claude Code (SKILL.md + fichiers support), editeur inline + fetch URL |
| Hooks | Users libres sur tous les types. Guard-rails passifs + audit CAO |
| Stockage | Dans MnM (DB), format proche Claude Code, injection adapter-specific au runtime |
| Futur-proof | Format Claude Code comme lingua franca, mapping minimal vers futurs adapters |
| Conflits | Detection au moment de l'attachement, resolution via UI, company enforced = non-overridable |
| Versioning | Config revisions (after_snapshot + changed_keys) + audit_events, pas de SemVer |
| Supply chain | Analyse LLM (haiku) dans sandbox minimaliste + hash pinning + enabled=false |

## 3. Architecture "tout-en-layers"

### 3.1 Avant (adapterConfig)

```
agents.adapterConfig = { model, cwd, env, extraArgs, chrome, ... }   <- JSONB brut, pas d'audit
agents.runtimeConfig = { heartbeat: { intervalSec, ... } }           <- JSONB brut
```

### 3.2 Apres (tout-en-layers)

```
agents table = STRUCTURAL seulement
  id, name, adapter_type, status, icon, title, reportsTo, capabilities,
  base_layer_id (FK), budgetMonthlyCents, lastHeartbeatAt, created_by_user_id, metadata

Toute la config vit dans les layers :

Company Enforced Layer (priority 999, virtuel — jamais stocke)
├── Setting: model=sonnet (politique entreprise)
├── Hook: PreToolUse -> compliance-check
└── MCP: sentry (obligatoire)

Agent "Base Layer" (auto-cree, priority 500)    <- REMPLACE adapterConfig
├── Setting: model=opus, cwd=/home/agent/project, thinkingEffort=high
├── Setting: timeoutSec=3600, heartbeat.intervalSec=3600
├── Setting: env.NODE_ENV=production, env.API_KEY=@secret:xxx
├── MCP: github
├── Skill: /deploy
└── Hook: PostToolUse -> lint

Shared Layer "QA Pack" (priority 200)
├── Skill: /review
└── Setting: model=opus
```

### 3.3 Modele d'heritage

```
Company Layers (enforced=true, priority=999 virtuel)
  Toujours appliques, non-overridables par les users.
     |
     v  (merge additif)
Agent Base Layer (priority=500, auto-cree)
  Config directe de l'agent — remplace adapterConfig.
     |
     v  (merge additif)
Additional Layers (priority=0..498)
  Layers partages/custom attaches a l'agent.
     |
     v  (merge additif — workflow seulement)
Stage Override Layers
  Override ponctuel pour un stage de workflow.
```

### 3.4 Regles de merge

1. Company enforced layers sont TOUJOURS inclus (priority virtuel 999, non-removable)
2. Les layers s'additionnent par priority croissante (le plus haut gagne)
3. En cas de conflit (meme itemType + name), le layer de plus haute priority gagne
4. Les conflits sont DETECTES au moment de l'attachement, pas au runtime
5. Un conflit avec un layer enforced est BLOQUANT (impossible d'override)
6. Le base layer de l'agent a priority 500 — les layers additionnels sont 0-498

## 4. Modele de donnees

### 4.1 Modifications a la table `agents` (existante)

Simplification : les colonnes de config migrent vers le base layer.

**Colonnes ajoutees :**
- `base_layer_id` uuid FK -> config_layers ON DELETE RESTRICT

**Colonnes conservees (structural) :**
- id, company_id, name, title, icon, adapter_type, status, reportsTo
- capabilities, budgetMonthlyCents, spentMonthlyCents
- lastHeartbeatAt, isolationMode, scopedToWorkspaceId
- created_by_user_id, metadata, created_at, updated_at

**Colonnes depreciees (migration vers base layer) :**
- `adapterConfig` — reste comme cache, plus lu au runtime si base_layer_id existe
- `runtimeConfig` — idem, settings migres vers le base layer
- `permissions` — migre vers settings dans le base layer

### 4.2 Tables principales

#### `config_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | uuid | PK | |
| `company_id` | uuid | FK -> companies, NOT NULL | |
| `name` | text | NOT NULL | Nom affiche |
| `description` | text | | |
| `icon` | text | | Emoji ou icon ref |
| `scope` | text | NOT NULL, CHECK in ('company','shared','private') | |
| `enforced` | boolean | NOT NULL DEFAULT false | Si true, applique a tous les agents |
| `is_base_layer` | boolean | NOT NULL DEFAULT false | True si c'est le base layer d'un agent |
| `created_by_user_id` | text | FK -> auth_users ON DELETE RESTRICT, NOT NULL | |
| `owner_type` | text | NOT NULL DEFAULT 'user', CHECK in ('user','system') | |
| `visibility` | text | NOT NULL DEFAULT 'private', CHECK in ('public','team','private') | |
| `promotion_status` | text | CHECK in ('proposed','approved','rejected') | NULL = non propose |
| `promotion_content_hash` | text | | SHA256 au moment de l'approbation |
| `archived_at` | timestamptz | | Soft-delete |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | |

**Constraints:**
- `chk_enforced_scope` CHECK (enforced = false OR scope = 'company')
- `chk_scope_visibility` CHECK ((scope='private' AND visibility='private') OR (scope='shared' AND visibility IN ('team','public')) OR (scope='company' AND visibility='public'))
- `chk_base_layer_private` CHECK (is_base_layer = false OR (scope = 'private' AND visibility = 'private'))

**Index:**
- `config_layers_company_scope_idx` ON (company_id, scope) WHERE archived_at IS NULL
- `config_layers_company_enforced_idx` ON (company_id) WHERE enforced = true AND archived_at IS NULL
- `config_layers_owner_idx` ON (company_id, created_by_user_id)
- `config_layers_company_owner_name_uq` UNIQUE ON (company_id, created_by_user_id, name)
- `config_layers_company_name_scope_uq` UNIQUE ON (company_id, name) WHERE scope = 'company' AND archived_at IS NULL

**RLS:** tenant_isolation sur company_id

**Tag isolation :** visibilite `team` derivee des tags du created_by_user_id.

#### `config_layer_items`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | uuid | PK | |
| `company_id` | uuid | FK -> companies, NOT NULL | Denormalise pour RLS |
| `layer_id` | uuid | FK -> config_layers ON DELETE CASCADE, NOT NULL | |
| `item_type` | text | NOT NULL, CHECK in ('mcp','skill','hook','setting') | |
| `name` | text | NOT NULL | Identifiant unique dans le layer |
| `display_name` | text | | Nom affiche |
| `description` | text | | |
| `config_json` | jsonb | NOT NULL | Valide par Zod schema par item_type |
| `source_type` | text | NOT NULL DEFAULT 'inline', CHECK in ('inline','url','git') | |
| `source_url` | text | | HTTPS obligatoire, domaines valides par allowlist |
| `source_content_hash` | text | | SHA256 du contenu fetche |
| `source_fetched_at` | timestamptz | | |
| `enabled` | boolean | NOT NULL DEFAULT true | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | |

**Constraints:**
- `chk_source_url_required` CHECK (source_type = 'inline' OR source_url IS NOT NULL)
- `chk_config_json_size` CHECK (octet_length(config_json::text) <= 262144) — 256KB max
- `config_layer_items_layer_name_uq` UNIQUE ON (layer_id, item_type, name)

**Index:**
- `config_layer_items_layer_enabled_idx` ON (layer_id, item_type, name) WHERE enabled = true

**RLS:** tenant_isolation sur company_id

**config_json par item_type :**

```jsonc
// mcp — McpItemConfigSchema
{
  "type": "http",                          // "http" | "stdio" | "sse"
  "url": "https://mcp.github.com/sse",    // HTTPS obligatoire
  "headers": { "X-Custom": "value" },     // Valeurs sensibles = secret_ref obligatoire
  "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" },
  "oauth": {
    "authorizationUrl": "https://...",
    "tokenUrl": "https://...",
    "scopes": ["repo"],
    "clientId": { "type": "secret_ref", "secretId": "..." },
    "clientSecret": { "type": "secret_ref", "secretId": "..." }
  }
}

// skill — SkillItemConfigSchema
{
  "frontmatter": { "name": "deploy", "description": "...", "allowed-tools": "Bash, Read", ... },
  "content": "## Deploy Skill\n\n..."
}

// hook — HookItemConfigSchema
{
  "event": "PreToolUse",
  "matcher": "Bash",
  "hookType": "command",       // "command" | "http" | "prompt" | "agent"
  "command": "...",            // si command
  "url": "https://...",        // si http
  "prompt": "...",             // si prompt|agent
  "timeout": 30, "async": false, "once": false
}

// setting — SettingItemConfigSchema
{
  "key": "model",              // whitelist de cles autorisees
  "value": "claude-opus-4-6"
}
```

#### `config_layer_files`

Fichiers supplementaires (scripts, templates pour les skills).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | uuid | PK | |
| `company_id` | uuid | FK -> companies, NOT NULL | Pour RLS (CRITIQUE: sans ca, 0 rows en prod) |
| `item_id` | uuid | FK -> config_layer_items ON DELETE CASCADE, NOT NULL | |
| `path` | text | NOT NULL | Chemin relatif valide |
| `content` | text | NOT NULL | |
| `content_hash` | text | NOT NULL | SHA256 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | |

**Constraints:**
- `chk_path_safe` CHECK (path !~ '^\/' AND path !~ '\.\.' AND path ~ '^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\/\.]*$')
- `chk_content_size` CHECK (octet_length(content) <= 1048576) — 1 MB max
- `config_layer_files_item_path_uq` UNIQUE ON (item_id, path)

**Index:** `config_layer_files_item_idx` ON (item_id)

**RLS:** tenant_isolation sur company_id

### 4.3 Tables de liaison

#### `agent_config_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `company_id` | uuid | FK -> companies, NOT NULL | Pour RLS |
| `agent_id` | uuid | FK -> agents ON DELETE CASCADE, NOT NULL | |
| `layer_id` | uuid | FK -> config_layers ON DELETE CASCADE, NOT NULL | |
| `priority` | integer | NOT NULL DEFAULT 0, CHECK (priority >= 0 AND priority <= 498) | Max 498, base layer = 500, enforced = 999 virtuel |
| `attached_by` | text | FK -> auth_users, NOT NULL | |
| `attached_at` | timestamptz | NOT NULL DEFAULT now() | |

**PK:** (agent_id, layer_id)
**RLS:** tenant_isolation sur company_id

Note: le base layer n'est PAS dans cette table. Il est reference via `agents.base_layer_id`.

#### `workflow_template_stage_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `company_id` | uuid | FK -> companies, NOT NULL | |
| `template_id` | uuid | FK -> workflow_templates ON DELETE CASCADE, NOT NULL | |
| `stage_order` | integer | NOT NULL, CHECK (stage_order >= 0) | |
| `layer_id` | uuid | FK -> config_layers ON DELETE CASCADE, NOT NULL | |
| `priority` | integer | NOT NULL DEFAULT 0, CHECK (priority >= 0 AND priority <= 498) | |
| `attached_by` | text | FK -> auth_users, NOT NULL | |
| `attached_at` | timestamptz | NOT NULL DEFAULT now() | |

**PK:** (template_id, stage_order, layer_id)
**RLS:** tenant_isolation sur company_id

#### `workflow_stage_config_layers`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `company_id` | uuid | FK -> companies, NOT NULL | |
| `stage_instance_id` | uuid | FK -> stage_instances ON DELETE CASCADE, NOT NULL | |
| `layer_id` | uuid | FK -> config_layers ON DELETE CASCADE, NOT NULL | |
| `priority` | integer | NOT NULL DEFAULT 0, CHECK (priority >= 0 AND priority <= 498) | |
| `attached_by` | text | FK -> auth_users, NOT NULL | |
| `attached_at` | timestamptz | NOT NULL DEFAULT now() | |

**PK:** (stage_instance_id, layer_id)
**RLS:** tenant_isolation sur company_id

### 4.4 Credentials OAuth per-user

#### `user_mcp_credentials`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | uuid | PK | |
| `user_id` | text | FK -> auth_users, NOT NULL | |
| `company_id` | uuid | FK -> companies, NOT NULL | |
| `item_id` | uuid | FK -> config_layer_items ON DELETE CASCADE, NOT NULL | |
| `provider` | text | NOT NULL, CHECK in ('oauth2','api_key','bearer','custom') | |
| `material` | jsonb | NOT NULL | Chiffre AES-256-GCM |
| `status` | text | NOT NULL DEFAULT 'pending', CHECK in ('pending','connected','expired','revoked','error') | |
| `status_message` | text | | |
| `max_ttl_at` | timestamptz | | Force re-auth apres 90 jours |
| `connected_at` | timestamptz | | |
| `expires_at` | timestamptz | | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | |

**UNIQUE:** (user_id, company_id, item_id)
**Index:** `user_mcp_credentials_user_company_idx` ON (user_id, company_id)
**Index:** `user_mcp_credentials_expiring_idx` ON (expires_at) WHERE status = 'connected' AND expires_at IS NOT NULL
**RLS:** tenant_isolation sur company_id
**Performance:** fillfactor = 70 (frequent refresh updates sur expires_at)

**Material (dechiffre) — pas de rawResponse (risque PII) :**
```jsonc
// oauth2
{ "accessToken": "gho_xxx", "refreshToken": "ghr_xxx", "tokenType": "bearer",
  "expiresAt": "2026-04-02T12:00:00Z", "scopes": ["repo"] }
// api_key
{ "apiKey": "sk-xxxx" }
// bearer
{ "token": "eyJhbG..." }
```

### 4.5 Versioning

#### `config_layer_revisions`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | uuid | PK | |
| `company_id` | uuid | FK -> companies, NOT NULL | |
| `layer_id` | uuid | FK -> config_layers ON DELETE CASCADE, NOT NULL | |
| `version` | integer | NOT NULL | Calcule via SELECT MAX+1 dans la transaction |
| `changed_keys` | jsonb | NOT NULL | |
| `after_snapshot` | jsonb | NOT NULL | REDIGE via sanitizeRecord() — pas de tokens |
| `changed_by` | text | FK -> auth_users, NOT NULL | |
| `change_source` | text | NOT NULL, CHECK in ('ui','api','import','promotion','system','migration') | |
| `change_message` | text | | |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |

Pas de `before_snapshot` — c'est le `after_snapshot` de la revision N-1.
Contenu des fichiers exclu du snapshot (juste path + content_hash).

**UNIQUE:** (layer_id, version)
**Index:**
- `config_layer_revisions_layer_version_idx` ON (layer_id, version DESC)
- `config_layer_revisions_layer_created_idx` ON (layer_id, created_at DESC)

**RLS:** tenant_isolation sur company_id

## 5. Detection de conflits

### 5.1 Algorithme

A chaque attachement d'un layer a un agent, le backend (dans une transaction avec advisory lock sur l'agent) :
1. Recupere tous les items actifs (enforced + base layer + layers attaches)
2. Recupere les items du layer candidat
3. Detecte les collisions (meme item_type + name)
4. Classifie : `enforced_conflict` (BLOQUANT) | `priority_conflict` (RESOLUTION REQUISE) | `override_conflict` (WARNING)

### 5.2 Transaction safety

```sql
-- Advisory lock serialise les attachements concurrents au meme agent
SELECT pg_advisory_xact_lock(hashtext('agent_config_' || $agent_id::text));
-- Check conflits
-- INSERT si OK
```

### 5.3 Requete SQL de merge au runtime (hot path)

```sql
WITH active_layers AS (
  -- Company enforced
  SELECT cl.id AS layer_id, 999 AS priority
  FROM config_layers cl
  WHERE cl.company_id = $company_id AND cl.enforced = true AND cl.archived_at IS NULL

  UNION ALL

  -- Agent base layer
  SELECT a.base_layer_id AS layer_id, 500 AS priority
  FROM agents a WHERE a.id = $agent_id AND a.base_layer_id IS NOT NULL

  UNION ALL

  -- Additional layers
  SELECT acl.layer_id, acl.priority
  FROM agent_config_layers acl WHERE acl.agent_id = $agent_id
)
SELECT DISTINCT ON (cli.item_type, cli.name)
  cli.id, cli.item_type, cli.name, cli.config_json, al.priority
FROM active_layers al
JOIN config_layer_items cli ON cli.layer_id = al.layer_id AND cli.enabled = true
ORDER BY cli.item_type, cli.name, al.priority DESC;
```

### 5.4 API

```
POST /api/companies/:companyId/agents/:agentId/config-layers/check
GET  /api/companies/:companyId/agents/:agentId/config-layers/preview  <- merge preview (debug)
```

### 5.5 Background check

Job periodique sur modification de layers enforced -> notification aux owners des agents en conflit.

## 6. API Routes

### 6.1 Config Layers CRUD

```
GET    /companies/:companyId/config-layers                    <- liste (tag-filtered)
POST   /companies/:companyId/config-layers                    <- creer
GET    /config-layers/:id                                     <- detail (items + files)
PATCH  /config-layers/:id                                     <- modifier metadata
DELETE /config-layers/:id                                     <- soft-delete (archive)
GET    /config-layers/:id/revisions                           <- historique
```

### 6.2 Items CRUD

```
POST   /config-layers/:id/items                               <- ajouter item
PATCH  /config-layers/:id/items/:itemId                        <- modifier item
DELETE /config-layers/:id/items/:itemId                        <- supprimer item
POST   /config-layers/:id/items/:itemId/files                  <- upload fichier
DELETE /config-layers/:id/items/:itemId/files/:fileId           <- supprimer fichier
```

### 6.3 Agent attachment

```
GET    /companies/:companyId/agents/:agentId/config-layers     <- layers attaches
POST   /companies/:companyId/agents/:agentId/config-layers     <- attacher
DELETE /companies/:companyId/agents/:agentId/config-layers/:lid <- detacher
POST   /companies/:companyId/agents/:agentId/config-layers/check   <- conflict check
GET    /companies/:companyId/agents/:agentId/config-layers/preview <- merge preview
```

### 6.4 Workflow stage attachment

```
POST   /workflow-templates/:tid/stages/:order/config-layers     <- attacher a stage template
DELETE /workflow-templates/:tid/stages/:order/config-layers/:lid <- detacher
POST   /stage-instances/:sid/config-layers                      <- attacher a stage instance
DELETE /stage-instances/:sid/config-layers/:lid                  <- detacher
```

### 6.5 Promotion

```
POST   /config-layers/:id/promote                              <- proposer
POST   /config-layers/:id/promotion/approve                    <- approuver (expectedContentHash)
POST   /config-layers/:id/promotion/reject                     <- rejeter (motif)
```

### 6.6 OAuth / Credentials

```
GET    /companies/:companyId/mcp-credentials                   <- mes connexions
GET    /api/oauth/authorize/:itemId                            <- initier OAuth flow
GET    /api/oauth/callback                                     <- OAuth callback
DELETE /mcp-credentials/:id                                    <- revoquer
```

## 7. Runtime — Merge & Injection

### 7.1 Service architecture

| Service | Responsabilite | Fichier |
|---------|---------------|---------|
| `config-layer.ts` | CRUD layers + items + files + revisions | server/src/services/ |
| `config-layer-conflict.ts` | Detection conflits, classification, preview | server/src/services/ |
| `config-layer-runtime.ts` | Merge runtime, generation fichiers, injection env vars | server/src/services/ |
| `mcp-credential.ts` | CRUD credentials, chiffrement, refresh, revocation | server/src/services/ |
| `mcp-oauth.ts` | OAuth2 flow (PKCE, state, callback) | server/src/services/ |
| `config-layer-supply-chain.ts` | Fetch URL/git, analyse LLM, hash pinning | server/src/services/ |

Le heartbeat appelle `configLayerRuntime.resolveConfigForRun()` — UNE seule methode, pas de logique de merge dans heartbeat.ts.

### 7.2 Flow au moment du run

```
1. Heartbeat wakeup pour agentId
2. configLayerRuntime.resolveConfigForRun(companyId, agentId, ownerUserId)
   a. Execute requete merge (5.3) — avec cache TTL 1 min
   b. Pour chaque MCP: dechiffre credentials OAuth du owner (graceful: skip si echec)
   c. Genere .mcp.json (tokens via ${MNM_MCP_*_TOKEN} placeholders)
   d. Genere settings.json (hooks + settings merges)
   e. Genere skills/ directory (SKILL.md + fichiers support)
3. Injecte dans le sandbox (tmpfs /dev/shm ou volume temporaire)
4. Lance adapter.execute() avec env vars d'auth
5. Post-run: cleanup fichiers temporaires
```

### 7.3 Graceful degradation

- Echec dechiffrement credential -> skip ce MCP, log warning, audit event, notification user
- LLM analyse down -> rapport `analysis_unavailable`, item reste enabled=false
- Fetch URL timeout -> 30s max, 3 retries, item reste enabled=false

### 7.4 Cache du merge

Pattern existant `access.ts` (Map + TTL 1 min). Cache sur le resultat AVANT resolution des credentials. Invalidation via live event `config_layer.changed`.

## 8. Sharing & Promotion

### 8.1 Visibilite

| scope | visibility | Qui voit | Qui utilise |
|-------|-----------|----------|-------------|
| private | private | Createur seul | Createur seul |
| shared | team | Users partageant >= 1 tag avec le createur | Ceux qui le voient |
| shared | public | Tous les users de la company | Tous |
| company | public | Tous | Tous (si enforced, applique auto) |

### 8.2 Promotion flow

1. User propose -> `promotion_status = 'proposed'`
2. Admin review (diff complet items/hooks/skills/fichiers)
3. Approve -> scope='company', visibility='public', `promotion_content_hash = SHA256(contenu)`
4. Si contenu modifie apres approbation (hash mismatch) -> repasse a 'proposed'
5. L'endpoint approve prend `expectedContentHash` pour anti-race condition (409 si mismatch)

### 8.3 Ownership transfer

Avant suppression d'un user, transfert obligatoire des layers (surtout enforced). L'admin recoit un flow "Transferer N layers de [user] vers [nouveau owner]".

## 9. OAuth Flow pour MCP

### 9.1 Connexion (popup window, pas redirect)

1. User clique "Connecter" -> popup `window.open()` vers `/api/oauth/authorize/:itemId`
2. Backend genere state (lie userId + sessionId) + code_verifier (PKCE), stocke Redis TTL 10 min
3. Redirect vers provider
4. User s'authentifie
5. Callback -> verifie state + userId + companyId + redirect_uri strict
6. Echange code -> tokens, chiffre AES-256-GCM, stocke dans `user_mcp_credentials`
7. `max_ttl_at = now() + 90 jours`
8. Popup se ferme, `postMessage` -> parent invalide queries, badge passe a "Connected"

### 9.2 Refresh automatique

Job toutes les 5 min: credentials avec `expires_at < now() + 15 min`. Refresh ou expire + notification.

### 9.3 Revocation

Material supprime immediatement (meme si revocation upstream echoue). Log warning si revocation echoue.

## 10. RBAC, Tags & Securite

### 10.1 Permissions (seed)

| Slug | Categorie | Admin | Member |
|------|-----------|-------|--------|
| `config_layers:create` | config | x | x |
| `config_layers:edit` | config | x | x |
| `config_layers:delete` | config | x | x |
| `config_layers:read` | config | x | x (+ Viewer) |
| `config_layers:manage` | config | x | |
| `config_layers:promote` | config | x | |
| `config_layers:attach` | config | x | x |
| `mcp:connect` | config | x | x |

Verification a l'attachement : user est owner de l'agent OU partage un tag OU bypassTagFilter.

### 10.2 Tag isolation

`tagFilterService.listConfigLayersFiltered()` — meme pattern que agents/issues. Visibilite `team` derivee des tags du createur.

### 10.3 Securite hooks

Users libres. Guard-rails passifs : Zod validation, URL HTTPS, audit events, audit CAO periodique.

### 10.4 Securite skills

Skills privees libres. Warning heuristique non-bloquant. Promotion = review admin obligatoire.

### 10.5 Supply chain

Fetch URL/git -> sandbox minimaliste (bun+git) -> analyse LLM (haiku) -> rapport -> enabled=false -> user review et decide. Hash pinning + allowlist domaines company.

### 10.6 Validation donnees

- Zod schemas stricts par item_type (discriminated union)
- Champs sensibles = secret_ref obligatoire (rejet sinon)
- URLs : HTTPS, blocklist (localhost, 169.254.*, host.docker.internal)
- Paths : regex safe, pas de `..`, pas de chemins absolus
- Taille : config_json max 256KB, files max 1MB

### 10.7 Sandbox

- Jamais monter Docker socket
- Tokens via env vars, jamais dans fichiers
- Blocklist reseau (metadata service, host.docker.internal sauf MnM API)
- User non-root (/home/agent)

### 10.8 Proxy MCP (futur epic)

Proxy cote host qui injecte les credentials de maniere transparente. Hors scope MVP.

## 11. Decisions finalisees

| Sujet | Decision |
|-------|----------|
| Hooks | Users libres, guard-rails passifs + audit CAO |
| Skills | Privees libres, warning heuristique, promotion = review |
| Supply chain | Sandbox LLM + hash pinning + enabled=false |
| Proxy MCP | Hors scope MVP |
| adapterConfig | Output calcule, toute config dans les layers |
| Naming UI | "MCP Servers", "Skills", "Hooks", "Settings" — pas de terme parapluie |
| OAuth UX | Popup window, pas redirect |
| Priority UX | Auto-increment + fleches up/down, pas de champ numerique expose |
| AgentConfigForm | Tab "Layers" separe dans AgentDetail, PAS dans le form existant |

## 12. Frontend architecture

### 12.1 Composants principaux (13)

**Tier 1 — Editeur :** LayerEditor, McpItemEditor, SkillItemEditor, HookItemEditor, SettingItemEditor, LayerItemList
**Tier 2 — Agent :** AgentLayersTab, ConflictResolutionDialog, MergePreviewPanel
**Tier 3 — OAuth/Marketplace :** McpOAuthConnectButton, UserConnectionsPage, LayerMarketplace, PromotionReviewDialog

### 12.2 Integration agent

Nouveau tab "Layers" dans AgentDetail (a cote de overview/configure/runs). PAS dans AgentConfigForm.

### 12.3 State management

TanStack Query pour le server state. useReducer local pour l'editeur. Merge preview = endpoint backend, jamais calcule cote client. Live events WebSocket pour OAuth status changes.

### 12.4 Phasing frontend

| Phase | Contenu | Jours |
|-------|---------|-------|
| 1 | MCP + Attach + MergePreview + API layer | 5-7j |
| 2 | Skills + Hooks + Settings editors | 4-5j |
| 3 | OAuth popup + Connexions page + live events | 3-4j |
| 4 | Marketplace + Promotion + Conflits | 3-4j |
| 5 | Supply chain + polish | 2-3j |

### 12.5 Prerequis

Schemas Zod partages dans `packages/shared` AVANT de commencer le frontend.

## 13. Audit events (table existante)

- `config_layer.created/updated/deleted/archived`
- `config_layer.attached/detached` (avec agent_id/stage_id)
- `config_layer.promoted/promotion_approved/promotion_rejected`
- `mcp_credential.connected/refreshed/refresh_failed/revoked/decryption_failed`
- `mcp_credential.runtime_auth_failure` (token expire pendant un run)
- `config_layer.source_fetched` (URL, hash before/after)
- `config_layer.runtime_injected` (run_id, hash config genere)

Severity `critical` pour layers enforced. Severity `warn` pour echecs refresh et hash changes.

## 14. Migration strategy

### 14.1 Migration 0052 — Tables config layers

Ordre FK : config_layers -> items -> files -> revisions -> agent_config_layers -> workflow tables -> user_mcp_credentials. RLS + CHECK. Safe en une transaction (~100-500ms lock sur tables parentes, tables vides).

### 14.2 Migration 0053 — Ajout base_layer_id sur agents

```sql
ALTER TABLE agents ADD COLUMN base_layer_id uuid REFERENCES config_layers(id) ON DELETE RESTRICT;
```

### 14.3 Migration 0054 — Migration des adapterConfig existants

Script qui pour chaque agent avec adapterConfig :
1. Cree un base layer (scope=private, is_base_layer=true)
2. Extrait les settings (model, cwd, env, timeoutSec, etc.) -> items type 'setting'
3. Extrait les MCP existants si presents -> items type 'mcp'
4. Set `agents.base_layer_id = new_layer.id`
5. `change_source = 'migration'` dans la revision

### 14.4 Permission seed

8 nouvelles permissions dans `permission-seed.ts`.

### 14.5 Tag filter extension

`listConfigLayersFiltered()` dans `tag-filter.ts`.

## 15. Estimation

| Composant | Complexite |
|-----------|------------|
| DB Schema + Migrations + RLS | M |
| Migration adapterConfig -> base layers | M |
| Permission seed + RBAC | S |
| Tag filter extension | S |
| API CRUD Layers (6 services) | L |
| Conflict Detection + advisory lock | M |
| Runtime Merge & Injection | L |
| OAuth Flow MCP (PKCE + popup) | L |
| Supply chain LLM analysis | M |
| Schemas Zod partages | M |
| Frontend Phase 1-5 | XL (17-23j) |
| Background Jobs | M |
| Audit Events | S |
