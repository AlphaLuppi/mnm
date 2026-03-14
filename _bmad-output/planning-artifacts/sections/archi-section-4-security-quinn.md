# Section 4 — Architecture de Securite MnM B2B

> **Auteur** : Quinn (QA / Securite) | **Date** : 2026-03-14 | **Statut** : Final
> **Sources** : PRD B2B v1.0 (NFR-SEC-01..10, Section 10.3), code existant (`server/src/services/access.ts`, `server/src/services/secrets.ts`, `server/src/routes/authz.ts`, `packages/shared/src/constants.ts`)
> **Traceabilite** : NFR-SEC-01 a NFR-SEC-10, REQ-CONT-01 a REQ-CONT-07, REQ-AUDIT-01 a REQ-AUDIT-03

---

## 1. RBAC Enforcement Architecture

### 1.1 Diagnostic de l'existant — Le trou critique

L'analyse du code source revele une faille structurelle dans le systeme de permissions actuel.

**`server/src/services/access.ts:45-66`** — La fonction `hasPermission()` ignore completement le champ `scope` JSONB :

```typescript
// ACTUEL — scope IGNORE
async function hasPermission(
  companyId, principalType, principalId, permissionKey
): Promise<boolean> {
  // ... verifie SEULEMENT que le grant existe
  // Le champ scope de principal_permission_grants est JAMAIS lu
  return Boolean(grant);
}
```

**Consequences** :
- Un utilisateur avec `tasks:assign` scope `{projectIds: ["proj-A"]}` peut assigner sur TOUS les projets
- Un agent avec `agents:create` scope restreint peut creer des agents partout
- Le champ `scope` JSONB dans `principal_permission_grants` est stocke mais jamais evalue

**`packages/shared/src/constants.ts:246-254`** — Seulement 6 permission keys :

```typescript
export const PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
] as const;
```

Il manque 9 permission keys critiques pour le B2B enterprise.

### 1.2 Correction de `hasPermission()` — Lecture du scope JSONB

La nouvelle signature integre un parametre `scope` optionnel :

```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  requiredScope?: { projectIds?: string[] }
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  const grants = await db
    .select()
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    );

  if (grants.length === 0) return false;

  // Si aucun scope requis, le grant suffit
  if (!requiredScope) return true;

  // Verifier que au moins un grant couvre le scope requis
  for (const grant of grants) {
    const grantScope = grant.scope as Record<string, unknown> | null;

    // Grant sans scope = acces global (wildcard)
    if (!grantScope) return true;

    // Verifier projectIds
    if (requiredScope.projectIds) {
      const allowedProjects = grantScope.projectIds;
      if (!Array.isArray(allowedProjects)) continue;
      const allCovered = requiredScope.projectIds.every(
        (pid) => allowedProjects.includes(pid)
      );
      if (allCovered) return true;
    }
  }

  return false;
}
```

**Regles d'evaluation du scope** :
- `scope: null` = acces global (wildcard) — couvre tout
- `scope: { projectIds: ["A", "B"] }` = acces restreint aux projets A et B
- Si `requiredScope` est fourni, au moins un grant doit couvrir toutes les `projectIds` demandees
- Les grants sont evalues en OR : si un seul couvre le scope, l'acces est accorde

**Validation du schema JSONB scope** (prevention injection SQL) :

```typescript
import { z } from "zod";

const scopeSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
}).strict().nullable();

// Applique a CHAQUE ecriture de scope dans setPrincipalGrants()
function validateScope(scope: unknown): Record<string, unknown> | null {
  const result = scopeSchema.safeParse(scope);
  if (!result.success) {
    throw unprocessable("Invalid scope: " + result.error.message);
  }
  return result.data;
}
```

Le `.strict()` de Zod rejette toute cle supplementaire, bloquant les tentatives d'injection de champs arbitraires dans le JSONB.

### 1.3 `canUser()` evolue — Signature avec scope

```typescript
async function canUser(
  companyId: string,
  userId: string | null | undefined,
  permissionKey: PermissionKey,
  scope?: { projectIds?: string[] }
): Promise<boolean> {
  if (!userId) return false;
  if (await isInstanceAdmin(userId)) return true;
  return hasPermission(companyId, "user", userId, permissionKey, scope);
}
```

**Usage type dans une route** :

```typescript
// AVANT (pas de scope)
const allowed = await access.canUser(companyId, userId, "tasks:assign");

// APRES (avec scope projet)
const allowed = await access.canUser(companyId, userId, "tasks:assign", {
  projectIds: [issue.projectId]
});
if (!allowed) throw forbidden("Permission denied for this project");
```

### 1.4 Middleware de route — Protection des 22 fichiers

**Etat actuel des 22 fichiers de routes** :

| Fichier | `assertCompanyAccess` | `canUser`/`hasPermission` | Statut |
|---------|----------------------|--------------------------|--------|
| `access.ts` | Oui (partiel) | Oui (3 endroits) | A completer |
| `agents.ts` | Oui (17 endroits) | Oui (5 endroits) | A completer |
| `approvals.ts` | Oui (7 endroits) | Non | **CRITIQUE** |
| `assets.ts` | Oui (2 endroits) | Non | **CRITIQUE** |
| `activity.ts` | Oui (3 endroits) | Non | A ajouter |
| `companies.ts` | Oui (5 endroits) | Non | A ajouter |
| `costs.ts` | Oui (4 endroits) | Non | A ajouter |
| `dashboard.ts` | Oui (1 endroit) | Non | A ajouter |
| `drift.ts` | Oui (6 endroits) | Non | A ajouter |
| `goals.ts` | Oui (5 endroits) | Non | A ajouter |
| `issues.ts` | Oui | Oui (1 endroit) | A completer |
| `issues-checkout-wakeup.ts` | A verifier | Non | A ajouter |
| `llms.ts` | A verifier | Non | A ajouter |
| `projects.ts` | A verifier | Non | A ajouter |
| `secrets.ts` | A verifier | Non | **CRITIQUE** |
| `sidebar-badges.ts` | Oui | Oui (2 endroits) | OK |
| `stages.ts` | A verifier | Non | A ajouter |
| `workflows.ts` | A verifier | Non | A ajouter |
| `workspace-context.ts` | Oui | Non | A ajouter |
| `health.ts` | N/A (public) | N/A | OK |
| `authz.ts` | Helper | Helper | OK |
| `index.ts` | Re-export | Re-export | OK |

**Pattern middleware recommande** :

```typescript
// Middleware factory pour protection de route
function requirePermission(
  permissionKey: PermissionKey,
  extractScope?: (req: Request) => { projectIds?: string[] } | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const companyId = req.params.companyId;
    if (!companyId) throw badRequest("companyId required");

    assertCompanyAccess(req, companyId);

    const scope = extractScope?.(req);
    const access = accessService(req.db);

    if (req.actor.type === "board") {
      const allowed = await access.canUser(companyId, req.actor.userId, permissionKey, scope);
      if (!allowed) throw forbidden(`Permission denied: ${permissionKey}`);
    } else if (req.actor.type === "agent") {
      const allowed = await access.hasPermission(
        companyId, "agent", req.actor.agentId!, permissionKey, scope
      );
      if (!allowed) throw forbidden(`Permission denied: ${permissionKey}`);
    }

    next();
  };
}

// Usage
router.post("/companies/:companyId/agents",
  requirePermission("agents:create"),
  async (req, res) => { /* ... */ }
);

router.post("/companies/:companyId/projects/:projectId/issues",
  requirePermission("issues:create", (req) => ({
    projectIds: [req.params.projectId]
  })),
  async (req, res) => { /* ... */ }
);
```

### 1.5 Les 15 Permission Keys

**6 existantes** (conservees telles quelles) :

| Key | Description |
|-----|-------------|
| `agents:create` | Creer/configurer un agent |
| `users:invite` | Inviter un utilisateur |
| `users:manage_permissions` | Modifier les permissions d'un membre |
| `tasks:assign` | Assigner des taches a un agent |
| `tasks:assign_scope` | Definir le perimetre d'assignation |
| `joins:approve` | Approuver les demandes d'adhesion |

**9 nouvelles** (B2B enterprise) :

| Key | Description | Priorite |
|-----|-------------|----------|
| `projects:manage` | Creer/modifier/archiver des projets | P0 |
| `issues:create` | Creer des issues dans un projet | P0 |
| `issues:manage` | Modifier/supprimer des issues | P1 |
| `workflows:manage` | Creer/modifier des workflows et stages | P0 |
| `secrets:manage` | Gerer les secrets de la company | P0 |
| `company:settings` | Modifier les parametres de la company | P1 |
| `agents:manage` | Modifier/supprimer/suspendre un agent | P1 |
| `audit:read` | Consulter les logs d'audit | P1 |
| `costs:read` | Consulter les couts (dashboards, rapports) | P1 |

### 1.6 Presets par role

| Permission | Admin | Manager | Contributor | Viewer |
|------------|-------|---------|-------------|--------|
| `agents:create` | scope: null | scope: null | scope: projets | - |
| `agents:manage` | scope: null | scope: null | - | - |
| `users:invite` | scope: null | scope: null | - | - |
| `users:manage_permissions` | scope: null | - | - | - |
| `tasks:assign` | scope: null | scope: null | scope: projets | - |
| `tasks:assign_scope` | scope: null | scope: null | - | - |
| `joins:approve` | scope: null | scope: null | - | - |
| `projects:manage` | scope: null | scope: null | - | - |
| `issues:create` | scope: null | scope: null | scope: projets | - |
| `issues:manage` | scope: null | scope: null | scope: projets | - |
| `workflows:manage` | scope: null | scope: null | - | - |
| `secrets:manage` | scope: null | - | - | - |
| `company:settings` | scope: null | - | - | - |
| `audit:read` | scope: null | scope: null | - | - |
| `costs:read` | scope: null | scope: null | scope: projets | - |

**Regles** :
- `scope: null` = acces global (toute la company)
- `scope: projets` = restreint aux projets explicitement assignes
- `-` = permission non accordee
- Admin = tous les droits, scope global
- Viewer = lecture seule, aucune permission d'ecriture

---

## 2. Multi-tenant Isolation

### 2.1 PostgreSQL RLS (Row-Level Security)

**Principe** : Chaque requete SQL est filtree au niveau de la base de donnees par `companyId`, rendant impossible l'acces aux donnees d'une autre company meme en cas de bug applicatif.

**Implementation** :

```sql
-- Activer RLS sur toutes les tables tenant-scoped
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

-- Variable de session pour le companyId courant
-- Set par le middleware Express AVANT chaque requete
-- SET LOCAL app.current_company_id = 'uuid-company';

-- Policy standard (appliquee a chaque table)
CREATE POLICY tenant_isolation ON agents
  USING (company_id = current_setting('app.current_company_id')::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id')::uuid);

-- Policy pour l'application (bypass RLS pour les migrations et admin ops)
-- Le role applicatif standard (mnm_app) est soumis a RLS
-- Le role admin (mnm_admin) bypass RLS pour les migrations
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
```

**Middleware Express pour setter la variable de session** :

```typescript
// middleware/tenant-context.ts
async function setTenantContext(req: Request, res: Response, next: NextFunction) {
  const companyId = extractCompanyId(req);
  if (companyId) {
    await req.db.execute(
      sql`SET LOCAL app.current_company_id = ${companyId}`
    );
  }
  next();
}
```

**Tables exclues de RLS** (cross-tenant par design) :
- `companies` — liste des companies (filtrage par membership au niveau applicatif)
- `company_memberships` — mappings user/company
- `principal_permission_grants` — grants (filtres par companyId au niveau applicatif)
- `auth_users` — utilisateurs (cross-company)
- `instance_user_roles` — roles globaux
- `invites` — invitations (cross-company par nature)
- `join_requests` — demandes d'adhesion

### 2.2 Filtrage API — `assertCompanyAccess` sur chaque route

**`server/src/routes/authz.ts:10-23`** — L'implementation actuelle est correcte mais insuffisante :

```typescript
export function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw unauthorized();
  if (req.actor.type === "agent" && req.actor.companyId !== companyId)
    throw forbidden("Agent key cannot access another company");
  if (req.actor.type === "board" && req.actor.source !== "local_implicit"
      && !req.actor.isInstanceAdmin) {
    const allowedCompanies = req.actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId))
      throw forbidden("User does not have access to this company");
  }
}
```

**Ameliorations requises** :
1. **Appel systematique** : Chaque route recevant un `companyId` DOIT appeler `assertCompanyAccess` en premier
2. **Routes sans companyId explicite** : Les routes qui chargent une entite (agent, issue, projet) par ID doivent verifier le `companyId` de l'entite chargee
3. **Double verification** : RLS au niveau DB + `assertCompanyAccess` au niveau applicatif = defense en profondeur

### 2.3 Cache isolation

**Regle** : Toute cle de cache DOIT etre prefixee par le `companyId`.

```typescript
// Pattern cache tenant-aware
function cacheKey(companyId: string, resource: string, id: string): string {
  return `tenant:${companyId}:${resource}:${id}`;
}

// Exemple
const key = cacheKey(companyId, "agent", agentId);
// => "tenant:uuid-company:agent:uuid-agent"
```

**Interdictions** :
- Pas de cache global partage entre companies
- Pas de cache sans prefixe `companyId`
- Invalidation du cache lors du changement de company d'un utilisateur
- TTL maximum 5 minutes pour les caches de permissions (coherence apres changement de role)

### 2.4 Container isolation

Chaque company dispose d'un reseau Docker isole :

```yaml
# Reseau par company (cree dynamiquement)
docker network create --internal --driver bridge mnm-tenant-${companyId}
```

- Les containers d'une company ne peuvent pas communiquer avec ceux d'une autre
- Le flag `--internal` empeche l'acces internet direct
- Le credential proxy est le seul point de sortie autorise (voir Section 3)

---

## 3. Container Security (5 couches)

### Couche 1 : Container ephemere `--rm` avec `--read-only`

```bash
docker run \
  --rm \                          # Suppression automatique apres arret
  --read-only \                   # Filesystem en lecture seule
  --tmpfs /tmp:rw,noexec,size=100m \  # /tmp writable mais noexec
  --tmpfs /home/agent:rw,size=500m \  # Workspace agent writable
  --security-opt no-new-privileges \  # Pas d'escalade de privileges
  --cap-drop ALL \                # Drop toutes les capabilities Linux
  --cap-add NET_BIND_SERVICE \    # Autoriser bind sur ports
  --user 1000:1000 \              # Non-root
  --pids-limit 256 \              # Limiter le nombre de processus
  mnm-agent:latest
```

**Justification** :
- `--rm` : Pas de donnees persistantes dans le container
- `--read-only` : L'agent ne peut pas modifier le systeme de fichiers de base
- `no-new-privileges` : Meme si l'agent exploite une faille, pas d'escalade vers root
- `--cap-drop ALL` : Surface d'attaque minimale

### Couche 2 : Mount allowlist (realpath + symlinks interdits + null bytes)

**Validation des chemins de mount** :

```typescript
import { realpath } from "node:fs/promises";
import path from "node:path";

const ALLOWED_MOUNT_ROOTS = [
  "/data/workspaces",
  "/data/shared-readonly",
];

async function validateMountPath(requestedPath: string): Promise<string> {
  // 1. Bloquer null bytes
  if (requestedPath.includes("\0")) {
    throw forbidden("Null bytes in path");
  }

  // 2. Bloquer encodages URL
  if (requestedPath.includes("%")) {
    throw forbidden("URL-encoded characters in path");
  }

  // 3. Resoudre le chemin reel (suit les symlinks)
  const resolved = await realpath(requestedPath);

  // 4. Verifier que le chemin reel est dans un root autorise
  const isAllowed = ALLOWED_MOUNT_ROOTS.some(
    (root) => resolved.startsWith(root + "/") || resolved === root
  );
  if (!isAllowed) {
    throw forbidden(`Mount path not in allowlist: ${resolved}`);
  }

  // 5. Verifier que le chemin original et le chemin resolu sont identiques
  // (detecte les symlinks malveillants)
  const normalizedOriginal = path.resolve(requestedPath);
  if (normalizedOriginal !== resolved) {
    throw forbidden("Symlinks detected in mount path");
  }

  return resolved;
}
```

**Attaques bloquees** :
- `../../etc/shadow` → realpath resout, pas dans allowlist → rejete
- `/data/workspaces/../../../etc/passwd` → realpath resout → rejete
- `/data/workspaces/link-to-etc` (symlink) → original != resolved → rejete
- `/data/workspaces/foo%00/etc/shadow` → null byte detecte → rejete

### Couche 3 : Credential proxy HTTP (injection sans exposition)

**Architecture** :

```
Agent Container          Credential Proxy           Secret Store
     |                        |                         |
     |--- GET /creds/MY_KEY ->|                         |
     |                        |--- resolveSecretValue ->|
     |                        |<-- "sk-abc123..." ------|
     |<-- 200 "sk-abc123..." -|                         |
     |                        |                         |
```

**Implementation** :

```typescript
// credential-proxy.ts — Tourne HORS du container agent
const app = express();

app.get("/creds/:key", async (req, res) => {
  const { key } = req.params;
  const { companyId, agentId, runId } = req.proxyContext;

  // 1. Verifier que l'agent a acces a cette cle
  const envConfig = await getAgentEnvConfig(agentId);
  if (!envConfig[key]) {
    return res.status(403).json({ error: "Key not authorized" });
  }

  // 2. Resoudre la valeur du secret
  const binding = envConfig[key];
  if (binding.type === "plain") {
    return res.json({ value: binding.value });
  }

  const value = await secretService.resolveSecretValue(
    companyId, binding.secretId, binding.version
  );

  // 3. Audit log
  await logActivity({
    companyId, action: "secret.accessed",
    metadata: { key, agentId, runId, secretId: binding.secretId }
  });

  // 4. Retourner la valeur (jamais logguee)
  res.json({ value });
});
```

**Securite du proxy** :
- Le proxy tourne dans le reseau host, pas dans le container agent
- L'agent n'a pas acces aux variables d'environnement du proxy
- Chaque requete est auditee
- Le proxy valide que l'agent est autorise a acceder a chaque cle specifique
- TLS entre le proxy et le container (mTLS recommande en enterprise)

### Couche 4 : Shadow `.env` vers `/dev/null`

```bash
# Monter un fichier vide en lecture seule sur .env
docker run \
  -v /dev/null:/workspace/.env:ro \
  -v /dev/null:/home/agent/.env:ro \
  ...
```

**Objectif** : Meme si un agent tente de lire `.env`, il obtient un fichier vide. Les secrets passent uniquement par le credential proxy.

**Chemins couverts** :
- `/workspace/.env`
- `/home/agent/.env`
- `/workspace/.env.local`
- `/workspace/.env.production`

### Couche 5 : Reseau isole (pas d'acces internet direct)

```bash
# Reseau interne sans acces Internet
docker network create --internal mnm-tenant-${companyId}

# Le container agent est connecte UNIQUEMENT a ce reseau
docker run --network mnm-tenant-${companyId} ...

# Le credential proxy est connecte a ce reseau ET au reseau externe
# Il sert de passerelle controlee
```

**Regles de routage** :
- Les containers agents n'ont PAS d'acces internet direct
- Le credential proxy est la seule passerelle
- Les requetes vers des APIs externes (GitHub, LLM providers) passent par un proxy HTTP sortant avec allowlist de domaines
- Le proxy sortant log toutes les requetes

### Resource limits par profil

| Profil | CPU | RAM | Disk | PIDs | Timeout | Cas d'usage |
|--------|-----|-----|------|------|---------|-------------|
| `light` | 0.5 | 512 Mo | 200 Mo | 64 | 5 min | Taches simples (lint, format) |
| `standard` | 1.0 | 1 Go | 500 Mo | 128 | 15 min | Dev standard (code, test) |
| `heavy` | 2.0 | 2 Go | 1 Go | 256 | 30 min | Build, CI, analyse |
| `gpu` | 2.0 + GPU | 4 Go | 2 Go | 256 | 60 min | ML, inference locale |

**Enforcement** :

```bash
docker run \
  --cpus=1.0 \
  --memory=1g \
  --memory-swap=1g \          # Pas de swap (evite les OOM lents)
  --storage-opt size=500m \
  --pids-limit 128 \
  ...
```

**Gestion du timeout** :
1. Timer dans le host (pas dans le container)
2. A expiration : `SIGTERM` envoye au container
3. Si pas d'arret dans 10s : `SIGKILL`
4. Reset du timer a chaque output (stdout/stderr) detecte

---

## 4. Input Validation & Injection Prevention

### 4.1 XSS via chat

**Vecteurs d'attaque** :
- Messages chat contenant `<script>`, `<img onerror=...>`, `<svg onload=...>`
- Markdown malveillant (liens javascript:, images avec handlers)
- Caracteres Unicode speciaux (homoglyphs, zero-width characters)

**Defenses** :

```typescript
// 1. UTF-8 strict — rejeter les sequences invalides
function validateUtf8(input: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    return decoder.decode(encoder.encode(input));
  } catch {
    throw unprocessable("Invalid UTF-8 input");
  }
}

// 2. Sanitization HTML — cote serveur
import DOMPurify from "isomorphic-dompurify";

function sanitizeChatMessage(content: string): string {
  // Valider UTF-8
  const clean = validateUtf8(content);

  // Limiter la taille
  if (clean.length > 100_000) {
    throw unprocessable("Message too large (max 100KB)");
  }

  // Sanitiser le HTML (autoriser uniquement le Markdown rendu)
  return DOMPurify.sanitize(clean, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "code", "pre", "a", "ul", "ol", "li", "blockquote"],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
```

**3. CSP Headers** :

```typescript
// middleware/security-headers.ts
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +             // Pas de scripts inline
    "style-src 'self' 'unsafe-inline'; " +  // Styles inline pour CSS-in-JS
    "img-src 'self' data: https:; " +    // Images depuis self et HTTPS
    "connect-src 'self' wss:; " +        // WebSocket
    "frame-ancestors 'none'; " +         // Pas de framing (clickjacking)
    "base-uri 'self'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
```

### 4.2 SQL injection via scope JSONB

**Vecteur d'attaque** : Un utilisateur malveillant pourrait tenter d'injecter du SQL dans le champ `scope` JSONB de `principal_permission_grants`.

**Defense** : Validation stricte du schema JSONB avec Zod (voir Section 1.2).

```typescript
// INTERDIT : Accepter un scope arbitraire
grants.map((grant) => ({
  scope: grant.scope  // DANGER — l'utilisateur controle le contenu
}));

// CORRECT : Valider strictement
grants.map((grant) => ({
  scope: validateScope(grant.scope)  // Zod strict, seulement projectIds:uuid[]
}));
```

**Protection supplementaire** : Drizzle ORM utilise des requetes parametrees nativement. Le JSONB est passe comme parametre, pas interpole dans le SQL. Mais la validation Zod ajoute une couche de defense en profondeur.

### 4.3 CSRF Protection

```typescript
// 1. Token CSRF synchronise
import csurf from "csurf";

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  }
});

// Appliquer sur toutes les routes POST/PUT/DELETE
app.use("/api", csrfProtection);

// 2. Verification Origin/Referer
function validateOrigin(req: Request): void {
  const origin = req.header("Origin");
  const referer = req.header("Referer");
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];

  if (req.method === "GET" || req.method === "HEAD") return;

  if (origin && !allowedOrigins.includes(origin)) {
    throw forbidden("Invalid origin");
  }
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowedOrigins.includes(refererOrigin)) {
      throw forbidden("Invalid referer");
    }
  }
}

// 3. Cookie SameSite=Strict
// Configure dans Better Auth / session middleware
{
  cookie: {
    name: "mnm_session",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60,  // 24 heures
  }
}
```

### 4.4 Path traversal

La protection est deja couverte dans la Couche 2 (Mount allowlist) de la Section 3. Resume des defenses :

1. **Null bytes** : Rejet immediat si `\0` detecte dans un chemin
2. **Encodage URL** : Rejet si `%` present (double-encodage)
3. **Realpath** : Resolution complete du chemin reel
4. **Symlinks** : Comparaison chemin original vs chemin resolu
5. **Allowlist** : Seuls les chemins dans les roots autorises sont acceptes
6. **Normalisation** : `path.resolve()` avant toute operation

**Application dans les routes d'assets** :

```typescript
// server/src/routes/assets.ts — Verification supplementaire
router.get("/assets/:assetId/download", async (req, res) => {
  const asset = await assetService.getById(req.params.assetId);
  assertCompanyAccess(req, asset.companyId);

  // Valider que le chemin de stockage est safe
  const resolvedPath = await validateMountPath(asset.storagePath);

  // Streamer le fichier
  res.sendFile(resolvedPath);
});
```

---

## 5. Auth & Session Security

### 5.1 Session management

**Configuration Better Auth** :

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| Duree session | 24 heures | Balance securite/UX |
| Idle timeout | 2 heures | Deconnexion apres inactivite |
| Renouvellement | Sliding window | Prolonge si actif |
| Fixation prevention | Regenerer session ID apres login | OWASP standard |
| Stockage | PostgreSQL (pas cookie) | Invalidation serveur possible |
| Cookie flags | `httpOnly`, `secure`, `sameSite=strict` | Protection XSS/CSRF |

**Invalidation de session** :

```typescript
// Invalidation immediate lors de :
// 1. Logout explicite
await sessionStore.delete(sessionId);

// 2. Changement de mot de passe
await sessionStore.deleteAllForUser(userId);

// 3. Changement de role/permissions
// Invalider le cache de permissions (pas la session)
await permissionCache.invalidate(userId, companyId);

// 4. Suspension du compte
await sessionStore.deleteAllForUser(userId);
```

### 5.2 Rate limiting

```typescript
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";

// Rate limits par endpoint
const rateLimits = {
  login: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 5,                  // 5 tentatives
    keyGenerator: (req) => req.ip + ":" + req.body?.email,
    message: { error: "Too many login attempts, try again in 1 minute" },
    standardHeaders: true,
  }),

  invitations: rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 heure
    max: 20,                    // 20 invitations
    keyGenerator: (req) => req.actor.userId ?? req.ip,
    message: { error: "Too many invitations, try again in 1 hour" },
  }),

  chat: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 10,                 // 10 messages
    keyGenerator: (req) => req.actor.userId ?? req.ip,
    message: { error: "Too many messages, slow down" },
  }),

  api: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 100,                // 100 requetes
    keyGenerator: (req) => req.actor.userId ?? req.actor.agentId ?? req.ip,
    message: { error: "API rate limit exceeded" },
  }),
};

// Application
app.post("/auth/login", rateLimits.login);
app.post("/api/companies/:id/invites", rateLimits.invitations);
app.post("/api/companies/:id/chat", rateLimits.chat);
app.use("/api", rateLimits.api);
```

### 5.3 Brute force protection

```typescript
// Lockout progressif apres tentatives echouees
const loginAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

function checkBruteForce(email: string): void {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key);

  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    const remainingMs = record.lockedUntil.getTime() - Date.now();
    throw new HttpError(429, `Account locked. Try again in ${Math.ceil(remainingMs / 1000)}s`);
  }
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
  record.count += 1;

  // Lockout progressif
  if (record.count >= 5) {
    const lockoutMinutes = Math.min(2 ** (record.count - 5), 60);  // 1, 2, 4, 8, ... 60 min max
    record.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }

  loginAttempts.set(key, record);
}

function recordSuccessfulLogin(email: string): void {
  loginAttempts.delete(email.toLowerCase());
}
```

**Stockage en production** : Redis au lieu de Map en memoire (persistance et partage entre instances).

---

## 6. Audit Trail Security

### 6.1 Immutabilite — TRIGGER deny UPDATE/DELETE

```sql
-- Table audit_events (append-only)
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  actor_type TEXT NOT NULL,          -- 'user' | 'agent' | 'system'
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'agent.created', 'secret.accessed', etc.
  resource_type TEXT,                -- 'agent', 'issue', 'secret', etc.
  resource_id TEXT,
  metadata JSONB,                    -- Details complementaires
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIGGER : Interdire UPDATE et DELETE
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

-- Meme le role applicatif ne peut pas contourner ces triggers
-- Seul un SUPERUSER pourrait les desactiver (et c'est audite par PostgreSQL)

-- Index pour les requetes frequentes
CREATE INDEX audit_events_company_action_idx
  ON audit_events (company_id, action, created_at DESC);
CREATE INDEX audit_events_actor_idx
  ON audit_events (actor_type, actor_id, created_at DESC);
CREATE INDEX audit_events_resource_idx
  ON audit_events (resource_type, resource_id, created_at DESC);
```

### 6.2 Non-repudiation — Hash chain optionnel (P2)

```sql
-- Ajout colonne hash chain (P2 Enterprise)
ALTER TABLE audit_events ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_events ADD COLUMN event_hash TEXT;

-- Le hash est calcule cote application
-- event_hash = SHA-256(prev_hash + actor_id + action + resource_id + metadata + created_at)
```

```typescript
import { createHash } from "node:crypto";

async function appendAuditEvent(
  db: Db,
  event: AuditEventInput,
  enableHashChain: boolean = false
): Promise<void> {
  let prevHash: string | null = null;
  let eventHash: string | null = null;

  if (enableHashChain) {
    // Recuperer le dernier hash de la company
    const lastEvent = await db.execute(sql`
      SELECT event_hash FROM audit_events
      WHERE company_id = ${event.companyId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    prevHash = lastEvent.rows[0]?.event_hash ?? "GENESIS";

    // Calculer le hash de l'evenement courant
    const payload = JSON.stringify({
      prevHash,
      actorId: event.actorId,
      action: event.action,
      resourceId: event.resourceId,
      metadata: event.metadata,
      createdAt: event.createdAt,
    });
    eventHash = createHash("sha256").update(payload).digest("hex");
  }

  await db.insert(auditEvents).values({
    ...event,
    prevHash,
    eventHash,
  });
}
```

**Verification d'integrite** :

```typescript
// Verifier que la chaine de hash n'a pas ete alteree
async function verifyAuditChain(db: Db, companyId: string): Promise<{
  valid: boolean;
  brokenAt?: string;
}> {
  const events = await db.execute(sql`
    SELECT * FROM audit_events
    WHERE company_id = ${companyId}
    ORDER BY created_at ASC
  `);

  let expectedPrevHash = "GENESIS";
  for (const event of events.rows) {
    if (event.prev_hash !== expectedPrevHash) {
      return { valid: false, brokenAt: event.id };
    }
    // Recalculer le hash et comparer
    const payload = JSON.stringify({
      prevHash: event.prev_hash,
      actorId: event.actor_id,
      action: event.action,
      resourceId: event.resource_id,
      metadata: event.metadata,
      createdAt: event.created_at,
    });
    const computedHash = createHash("sha256").update(payload).digest("hex");
    if (computedHash !== event.event_hash) {
      return { valid: false, brokenAt: event.id };
    }
    expectedPrevHash = event.event_hash;
  }

  return { valid: true };
}
```

### 6.3 Retention 3 ans minimum

```sql
-- Partitionnement par mois pour faciliter la retention
CREATE TABLE audit_events (
  -- ... colonnes ...
) PARTITION BY RANGE (created_at);

-- Partitions creees automatiquement par un cron job mensuel
CREATE TABLE audit_events_2026_03
  PARTITION OF audit_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Politique de retention : pas de suppression avant 3 ans
-- Le cron de cleanup ne supprime que les partitions > 3 ans
-- Politique configurable par company (enterprise : retention illimitee)
```

**Archivage** :
- Les partitions > 1 an sont deplacees vers un tablespace froid (stockage moins couteux)
- Les partitions > 3 ans sont exportees en CSV/Parquet avant suppression
- Chaque export est signe (SHA-256 + signature) pour prouver l'integrite

### 6.4 Interface read-only

**API d'audit** :

```typescript
router.get("/companies/:companyId/audit", async (req, res) => {
  assertCompanyAccess(req, companyId);
  const allowed = await access.canUser(companyId, req.actor.userId, "audit:read");
  if (!allowed) throw forbidden("audit:read permission required");

  const { action, actorId, resourceType, from, to, page, limit } = req.query;

  const events = await auditService.query({
    companyId,
    filters: { action, actorId, resourceType, from, to },
    pagination: { page, limit: Math.min(limit ?? 50, 200) },
  });

  res.json(events);
});

// Export CSV (P2)
router.get("/companies/:companyId/audit/export", async (req, res) => {
  assertCompanyAccess(req, companyId);
  const allowed = await access.canUser(companyId, req.actor.userId, "audit:read");
  if (!allowed) throw forbidden("audit:read permission required");

  // ... streaming CSV
});
```

**Regles** :
- Aucune route `POST`/`PUT`/`DELETE` sur `/audit`
- Les evenements d'audit sont crees automatiquement par les services, pas par les utilisateurs
- L'interface UI affiche un filtre par action, acteur, ressource, date
- L'export CSV est rate-limite (1 export/10 min par utilisateur)

---

## Matrice de Traceabilite NFR → Implementation

| NFR | Section | Implementation | Priorite |
|-----|---------|---------------|----------|
| NFR-SEC-01 | 2.1, 2.2 | RLS PostgreSQL + assertCompanyAccess | P0 |
| NFR-SEC-02 | (infra) | TLS 1.3 via reverse proxy + AES-256 local_encrypted | P0 |
| NFR-SEC-03 | 3.3 | Credential proxy HTTP, injection sans exposition | P0 |
| NFR-SEC-04 | 6.1 | TRIGGER deny UPDATE/DELETE sur audit_events | P1 |
| NFR-SEC-05 | (auth) | Better Auth extensible pour SAML/OIDC | P1 Enterprise |
| NFR-SEC-06 | 3.1, 3.5 | --rm, --read-only, cap-drop ALL, resource limits | P1 |
| NFR-SEC-07 | 4.1, 4.2 | DOMPurify + CSP + Zod strict sur scope JSONB | P0 |
| NFR-SEC-08 | 4.3 | CSRF tokens + Origin/Referer + SameSite=Strict | P1 |
| NFR-SEC-09 | 5.2 | express-rate-limit : login 5/min, chat 10/min | P1 |
| NFR-SEC-10 | 3.2 | realpath + symlinks interdits + null bytes + allowlist | P0 |

---

## Synthese des Priorites d'Implementation

### Phase 1 — P0 (Sprint 1-2)
1. Corriger `hasPermission()` pour lire le scope JSONB
2. Ajouter les 9 nouvelles permission keys
3. Deployer `requirePermission()` middleware sur les routes critiques
4. Activer RLS PostgreSQL sur les tables tenant-scoped
5. Implementer la validation Zod stricte du scope
6. Deployer les CSP headers et la sanitization XSS
7. Implementer la validation des mount paths (realpath + allowlist)

### Phase 2 — P1 (Sprint 3-4)
1. Completer la couverture `canUser()` sur les 22 fichiers de routes
2. Deployer le credential proxy HTTP
3. Implementer les rate limits par endpoint
4. Configurer le lockout brute force
5. Creer la table `audit_events` avec triggers d'immutabilite
6. Configurer les profils de resources pour containers

### Phase 3 — P2 Enterprise (Sprint 5+)
1. Hash chain pour non-repudiation
2. Partitionnement et archivage des audit events
3. SSO SAML/OIDC via Better Auth
4. mTLS entre credential proxy et containers
5. Interface d'export CSV des audits
