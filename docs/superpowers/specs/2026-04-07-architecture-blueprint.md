# Architecture Blueprint — Universal Git Provider + Generic Credential Store

**Date:** 2026-04-07
**Auteur:** Analyse automatisée (Architect Agent)
**Basé sur:** `2026-04-07-universal-git-credentials-design.md`

---

## 0. Vue d'ensemble du codebase actuel

### Fichiers touchés par cette epic (inventaire complet)

| Fichier | Couche | Type de modification |
|---------|--------|---------------------|
| `packages/db/src/schema/user_mcp_credentials.ts` | DB | Rename export + table name |
| `packages/db/src/schema/index.ts` | DB | Rename export |
| `packages/db/src/migrations/0061_rename_user_credentials.sql` | DB | Nouvelle migration |
| `packages/shared/src/validators/config-layer.ts` | Shared | Rename constants + add types |
| `packages/shared/src/validators/index.ts` | Shared | Rename re-exports |
| `packages/shared/src/types/config-layer.ts` | Shared | Rename types + add types |
| `packages/shared/src/types/index.ts` | Shared | Rename re-exports |
| `packages/shared/src/index.ts` | Shared | Rename re-exports |
| `packages/shared/src/utils/git-provider.ts` | Shared | NOUVEAU fichier |
| `server/src/services/mcp-credential.ts` | Server | Rename → `credential.ts` |
| `server/src/services/mcp-oauth.ts` | Server | Rename → `oauth.ts` |
| `server/src/services/config-layer-runtime.ts` | Server | Extension git_provider |
| `server/src/services/index.ts` | Server | Rename exports |
| `server/src/routes/mcp-oauth.ts` | Server | Rename → `credentials.ts` |
| `server/src/app.ts` | Server | Update import |
| `ui/src/api/config-layers.ts` | UI | Rename URLs + types |
| `ui/src/components/config-layers/LayerEditor.tsx` | UI | Ajouter tab git_provider |
| `ui/src/components/config-layers/LayerItemList.tsx` | UI | Généraliser credentials |
| `ui/src/components/config-layers/McpOAuthConnectButton.tsx` | UI | Rename → `OAuthConnectButton.tsx` |
| `ui/src/components/config-layers/ApiKeyCredentialDialog.tsx` | UI | Rename → `CredentialDialog.tsx` |
| `ui/src/components/config-layers/GitProviderItemEditor.tsx` | UI | NOUVEAU composant |
| `ui/src/components/GitProviderIcon.tsx` | UI | NOUVEAU composant |
| `ui/src/components/NewProjectDialog.tsx` | UI | Supprimer GitHub hardcode |
| `ui/src/components/ProjectProperties.tsx` | UI | Supprimer GitHub hardcode |
| `packages/adapters/claude-local/src/server/execute.ts` | Adapter | Injection GIT_TOKEN |

**Prochain numéro de migration :** `0061` (le dernier est `0060_cleanup_legacy_columns.sql`)

---

## 1. Phase 1 — Credential Store générique

### Story 1.1 — Migration DB

**Fichier :** `packages/db/src/migrations/0061_rename_user_credentials.sql` (**NOUVEAU**)

```sql
-- Migration 0061: Rename user_mcp_credentials → user_credentials
-- + extend provider CHECK constraint to include 'pat'

ALTER TABLE user_mcp_credentials RENAME TO user_credentials;

ALTER INDEX user_mcp_credentials_user_company_item_uq
  RENAME TO user_credentials_user_company_item_uq;
ALTER INDEX user_mcp_credentials_user_company_idx
  RENAME TO user_credentials_user_company_idx;
ALTER INDEX user_mcp_credentials_expiring_idx
  RENAME TO user_credentials_expiring_idx;

ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_mcp_credentials_provider_check;
ALTER TABLE user_credentials
  ADD CONSTRAINT user_credentials_provider_check
  CHECK (provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom'));
```

---

**Fichier :** `packages/db/src/schema/user_mcp_credentials.ts`

Ligne 13 — Rename de l'export Drizzle et du nom de table :
```typescript
// AVANT
export const userMcpCredentials = pgTable(
  "user_mcp_credentials",
  {

// APRES
export const userCredentials = pgTable(
  "user_credentials",
  {
```

Lignes 30-35 — Rename des index (noms inline) :
```typescript
// AVANT
    userCompanyItemUq: uniqueIndex("user_mcp_credentials_user_company_item_uq")
    userCompanyIdx: index("user_mcp_credentials_user_company_idx")
    expiringIdx: index("user_mcp_credentials_expiring_idx")

// APRES
    userCompanyItemUq: uniqueIndex("user_credentials_user_company_item_uq")
    userCompanyIdx: index("user_credentials_user_company_idx")
    expiringIdx: index("user_credentials_expiring_idx")
```

**Renommer le fichier** de `user_mcp_credentials.ts` → `user_credentials.ts`.

---

**Fichier :** `packages/db/src/schema/index.ts`

Ligne 82 :
```typescript
// AVANT
export { userMcpCredentials } from "./user_mcp_credentials.js";

// APRES
export { userCredentials } from "./user_credentials.js";
```

---

### Story 1.2 — Rename types & constantes (shared)

**Fichier :** `packages/shared/src/validators/config-layer.ts`

Lignes 17-29 — Rename constants + ajout `'pat'` :
```typescript
// AVANT
export const MCP_CREDENTIAL_PROVIDERS = [
  "oauth2",
  "api_key",
  "bearer",
  "custom",
] as const;
export const MCP_CREDENTIAL_STATUSES = [

// APRES
export const CREDENTIAL_PROVIDERS = [
  "oauth2",
  "api_key",
  "bearer",
  "pat",
  "custom",
] as const;
// Backward-compat alias (supprimer en V2)
export const MCP_CREDENTIAL_PROVIDERS = CREDENTIAL_PROVIDERS;

export const CREDENTIAL_STATUSES = [
// ... memes valeurs ...
] as const;
// Backward-compat alias (supprimer en V2)
export const MCP_CREDENTIAL_STATUSES = CREDENTIAL_STATUSES;
```

Ligne 5 — Ajouter `'git_provider'` dans `CONFIG_LAYER_ITEM_TYPES` :
```typescript
// AVANT
export const CONFIG_LAYER_ITEM_TYPES = ["mcp", "skill", "hook", "setting"] as const;

// APRES
export const CONFIG_LAYER_ITEM_TYPES = ["mcp", "skill", "hook", "setting", "git_provider"] as const;
```

Après la définition de `settingItemConfigSchema` (ligne ~141), ajouter :
```typescript
// ─── Git Provider item config ─────────────────────────────────────────────────

export const gitProviderItemConfigSchema = z.object({
  host: z.string().min(1),
  providerType: z.enum([
    "github", "gitlab", "bitbucket", "gitea", "azure_devops", "generic"
  ]).default("generic"),
  apiUrl: z.string().url().optional().nullable(),
});

export type GitProviderItemConfig = z.infer<typeof gitProviderItemConfigSchema>;
```

---

**Fichier :** `packages/shared/src/validators/index.ts`

Lignes 346-380 (section `config-layer-barrel-validators`), changer :
```typescript
// AVANT
  MCP_CREDENTIAL_PROVIDERS,
  MCP_CREDENTIAL_STATUSES,

// APRES
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_STATUSES,
  // Backward-compat aliases
  MCP_CREDENTIAL_PROVIDERS,
  MCP_CREDENTIAL_STATUSES,
```

Ajouter les exports des nouveaux types :
```typescript
  gitProviderItemConfigSchema,
  type GitProviderItemConfig,
```

---

**Fichier :** `packages/shared/src/types/config-layer.ts`

Lignes 1-8 (imports) :
```typescript
// AVANT
import type {
  ...
  MCP_CREDENTIAL_PROVIDERS,
  MCP_CREDENTIAL_STATUSES,
} from "../validators/config-layer.js";

// APRES
import type {
  ...
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_STATUSES,
  MCP_CREDENTIAL_PROVIDERS,   // backward-compat
  MCP_CREDENTIAL_STATUSES,    // backward-compat
} from "../validators/config-layer.js";
```

Lignes 16-17 (type aliases) :
```typescript
// AVANT
export type McpCredentialProvider = (typeof MCP_CREDENTIAL_PROVIDERS)[number];
export type McpCredentialStatus = (typeof MCP_CREDENTIAL_STATUSES)[number];

// APRES
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];
// Backward-compat aliases
export type McpCredentialProvider = CredentialProvider;
export type McpCredentialStatus = CredentialStatus;
```

Lignes 133-144 (interface `UserMcpCredential`) — ajouter l'interface renommée + alias :
```typescript
// APRES le bloc existant UserMcpCredential :

export interface UserCredential {
  id: string;
  userId: string;
  companyId: string;
  itemId: string;
  provider: CredentialProvider;
  status: CredentialStatus;
  statusMessage: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

// Backward-compat alias
export type UserMcpCredential = UserCredential;
```

Ajouter les types pour `git_provider` en fin de fichier :
```typescript
// ─── Resolved Git Provider ────────────────────────────────────────────────────

export interface ResolvedGitProvider {
  name: string;
  host: string;
  providerType: string;
  token?: string; // decrypte au runtime, JAMAIS persiste
}
```

---

**Fichier :** `packages/shared/src/types/index.ts`

Ajouter dans les exports (section config-layer) :
```typescript
  CredentialProvider,
  CredentialStatus,
  UserCredential,
  ResolvedGitProvider,
  // Backward-compat
  McpCredentialProvider,  // deja present — garder
  McpCredentialStatus,    // deja present — garder
  UserMcpCredential,      // deja present — garder
```

---

**Fichier :** `packages/shared/src/index.ts`

Lignes 326-327 (exports config-layer) — ajouter à côté des anciens :
```typescript
  CredentialProvider,
  CredentialStatus,
  UserCredential,
  ResolvedGitProvider,
```

Lignes 399-410 (config-layer constants) — ajouter :
```typescript
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_STATUSES,
  // MCP_CREDENTIAL_PROVIDERS et MCP_CREDENTIAL_STATUSES restent en backward-compat
```

---

**Nouveau fichier :** `packages/shared/src/utils/git-provider.ts`

```typescript
// packages/shared/src/utils/git-provider.ts

export type GitProviderType =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "gitea"
  | "azure_devops"
  | "generic";

export interface DetectedGitProvider {
  providerType: GitProviderType;
  host: string;
  label: string;
  iconName: string;
}

const KNOWN_HOSTS: Record<string, GitProviderType> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
  "dev.azure.com": "azure_devops",
  "ssh.dev.azure.com": "azure_devops",
  "vs-ssh.visualstudio.com": "azure_devops",
};

const PROVIDER_LABELS: Record<GitProviderType, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  gitea: "Gitea",
  azure_devops: "Azure DevOps",
  generic: "Git",
};

export function detectGitProvider(urlOrHost: string): DetectedGitProvider {
  let host = urlOrHost.trim();
  // Extract hostname from a full URL
  try {
    const parsed = new URL(host.includes("://") ? host : `https://${host}`);
    host = parsed.hostname.toLowerCase();
  } catch {
    host = host.toLowerCase().replace(/^[^@]+@/, "").split(":")[0] ?? host.toLowerCase();
  }

  // Remove www. prefix
  host = host.replace(/^www\./, "");

  let providerType: GitProviderType = KNOWN_HOSTS[host] ?? "generic";

  // Heuristics for self-hosted
  if (providerType === "generic") {
    if (host.includes("gitlab")) providerType = "gitlab";
    else if (host.includes("gitea")) providerType = "gitea";
    else if (host.includes("bitbucket")) providerType = "bitbucket";
  }

  const isKnownHost = host in KNOWN_HOSTS;
  const label =
    providerType === "gitlab" && !isKnownHost
      ? "GitLab (self-hosted)"
      : providerType === "gitea" && !isKnownHost
        ? "Gitea"
        : PROVIDER_LABELS[providerType];

  return {
    providerType,
    host,
    label,
    iconName: providerType,
  };
}

export function parseRepoUrl(url: string): { host: string; owner: string; repo: string } | null {
  const trimmed = url.trim();
  try {
    // Handle git@ SSH format: git@github.com:org/repo.git
    const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return {
        host: sshMatch[1]!.toLowerCase(),
        owner: sshMatch[2]!,
        repo: sshMatch[3]!,
      };
    }
    // Handle https:// format
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return {
      host: parsed.hostname.toLowerCase(),
      owner: segments[0]!,
      repo: segments[1]!.replace(/\.git$/i, ""),
    };
  } catch {
    return null;
  }
}

/**
 * Sanitize a hostname to use as part of an env var key.
 * e.g. "github.com" → "GITHUB_COM"
 */
export function sanitizeEnvKey(host: string): string {
  return host.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
```

Ajouter l'export dans `packages/shared/src/index.ts` :
```typescript
export { detectGitProvider, parseRepoUrl, sanitizeEnvKey } from "./utils/git-provider.js";
export type { GitProviderType, DetectedGitProvider } from "./utils/git-provider.js";
```

---

### Story 1.3 — Rename services backend

**Opération :** Renommer `server/src/services/mcp-credential.ts` → `server/src/services/credential.ts`

Changements dans le fichier `credential.ts` (anciennement `mcp-credential.ts`) :

Ligne 4 : changer l'import de la table
```typescript
// AVANT
import { userMcpCredentials } from "@mnm/db";

// APRES
import { userCredentials } from "@mnm/db";
```

Ligne 28 : changer le warning log
```typescript
// AVANT
logger.warn("[mcp-credential] MNM_SECRETS_KEY not set — using ephemeral dev key");

// APRES
logger.warn("[credential] MNM_SECRETS_KEY not set — using ephemeral dev key");
```

Ligne 58 : renommer la fonction exportée
```typescript
// AVANT
export function mcpCredentialService(db: Db) {

// APRES
export function credentialService(db: Db) {
```

**Toutes les références à `userMcpCredentials`** dans ce fichier (lignes 76-79, 89-96, 105-113, 127-137, 169-187, 199-208, 213-219, 248-257) → remplacer par `userCredentials`.

**Toutes les strings de log** `"[mcp-credential]"` → `"[credential]"`.

**Strings d'audit** `"mcp_credential.stored"`, `"mcp_credential.decrypt_failed"`, `"mcp_credential.revoked"` → `"credential.stored"`, `"credential.decrypt_failed"`, `"credential.revoked"`. Idem pour `targetType: "mcp_credential"` → `targetType: "credential"`.

---

**Opération :** Renommer `server/src/services/mcp-oauth.ts` → `server/src/services/oauth.ts`

Changements dans `oauth.ts` :

Ligne 6 : changer l'import
```typescript
// AVANT
import { mcpCredentialService } from "./mcp-credential.js";

// APRES
import { credentialService } from "./credential.js";
```

Ligne 66 : renommer la fonction
```typescript
// AVANT
export function mcpOauthService(db: Db) {
  const credSvc = mcpCredentialService(db);

// APRES
export function oauthService(db: Db) {
  const credSvc = credentialService(db);
```

Strings de log `"[mcp-oauth]"` → `"[oauth]"`.

---

**Fichier :** `server/src/services/config-layer-runtime.ts`

Ligne 4 :
```typescript
// AVANT
import { mcpCredentialService } from "./mcp-credential.js";

// APRES
import { credentialService } from "./credential.js";
```

Ligne 83 :
```typescript
// AVANT
  const credSvc = mcpCredentialService(db);

// APRES
  const credSvc = credentialService(db);
```

---

**Fichier :** `server/src/services/index.ts`

Lignes 81-83 :
```typescript
// AVANT
export { configLayerRuntimeService, type ResolvedConfig } from "./config-layer-runtime.js";
export { mcpCredentialService } from "./mcp-credential.js";
export { mcpOauthService } from "./mcp-oauth.js";

// APRES
export { configLayerRuntimeService, type ResolvedConfig } from "./config-layer-runtime.js";
export { credentialService } from "./credential.js";
export { oauthService } from "./oauth.js";
// Backward-compat aliases (supprimer en V2)
export { credentialService as mcpCredentialService } from "./credential.js";
export { oauthService as mcpOauthService } from "./oauth.js";
```

---

### Story 1.4 — Rename routes API

**Opération :** Renommer `server/src/routes/mcp-oauth.ts` → `server/src/routes/credentials.ts`

Changements dans `credentials.ts` :

Lignes 5-6 :
```typescript
// AVANT
import { mcpCredentialService } from "../services/mcp-credential.js";
import { mcpOauthService } from "../services/mcp-oauth.js";

// APRES
import { credentialService } from "../services/credential.js";
import { oauthService } from "../services/oauth.js";
```

Ligne 9 — renommer la fonction exportée :
```typescript
// AVANT
export function mcpOauthRoutes(db: Db) {
  const router = Router();
  const credSvc = mcpCredentialService(db);
  const oauthSvc = mcpOauthService(db);

// APRES
export function credentialRoutes(db: Db) {
  const router = Router();
  const credSvc = credentialService(db);
  const oauthSvc = oauthService(db);
```

**Route GET credentials (ligne 14-28)** :
```typescript
// AVANT
router.get(
  "/companies/:companyId/mcp-credentials",
  ...
// APRES
router.get(
  "/companies/:companyId/credentials",
  ...
```

**Route POST api-key (ligne 114-130)** :
```typescript
// AVANT
router.post(
  "/companies/:companyId/mcp-credentials/:itemId/api-key",
  ...
  await credSvc.storeCredential(userId, companyId, itemId, "api_key", material);

// APRES
router.post(
  "/companies/:companyId/credentials/:itemId/secret",
  ...
  await credSvc.storeCredential(userId, companyId, itemId, "api_key", material);
```

**Nouveau endpoint PAT** (ajouter après le endpoint `secret`) :
```typescript
// POST /companies/:companyId/credentials/:itemId/pat
router.post(
  "/companies/:companyId/credentials/:itemId/pat",
  requirePermission(db, "mcp:connect"),
  async (req, res) => {
    const itemId = req.params.itemId as string;
    const userId = req.actor.userId!;
    const companyId = req.params.companyId as string;

    const { material } = req.body as { material?: Record<string, unknown> };
    if (!material?.token || typeof material.token !== "string") {
      throw badRequest("material.token is required");
    }

    await credSvc.storeCredential(userId, companyId, itemId, "pat", material);
    res.status(201).json({ ok: true });
  },
);
```

**Route DELETE (ligne 133-149)** :
```typescript
// AVANT
router.delete(
  "/companies/:companyId/mcp-credentials/:id",

// APRES
router.delete(
  "/companies/:companyId/credentials/:id",
```

**Ajouter les redirects 301 backward-compat** (après les routes principales) :
```typescript
// ── Backward-compat redirects (supprimer en V2) ───────────────────────────────
router.get(
  "/companies/:companyId/mcp-credentials",
  (req, res) => res.redirect(301, `/api/companies/${req.params.companyId}/credentials`),
);
router.post(
  "/companies/:companyId/mcp-credentials/:itemId/api-key",
  (req, res) => res.redirect(307, `/api/companies/${req.params.companyId}/credentials/${req.params.itemId}/secret`),
);
router.delete(
  "/companies/:companyId/mcp-credentials/:id",
  (req, res) => res.redirect(307, `/api/companies/${req.params.companyId}/credentials/${req.params.id}`),
);
```

---

**Fichier :** `server/src/app.ts`

Lignes 58-59 :
```typescript
// AVANT
// CONFIG-LAYERS: MCP OAuth + credentials
import { mcpOauthRoutes } from "./routes/mcp-oauth.js";

// APRES
// CONFIG-LAYERS: credentials + OAuth
import { credentialRoutes } from "./routes/credentials.js";
```

Lignes 251-252 :
```typescript
// AVANT
  // CONFIG-LAYERS: MCP OAuth + credentials
  api.use(mcpOauthRoutes(db));

// APRES
  // CONFIG-LAYERS: credentials + OAuth
  api.use(credentialRoutes(db));
```

---

### Story 1.5 — Rename composants UI

**Fichier :** `ui/src/api/config-layers.ts`

Ligne 8 — changer le type importé :
```typescript
// AVANT
import type {
  ...
  UserMcpCredential,
} from "@mnm/shared";
// ...
export type { ..., UserMcpCredential };

// APRES
import type {
  ...
  UserCredential,
  UserMcpCredential, // backward-compat
} from "@mnm/shared";
// ...
export type { ..., UserCredential, UserMcpCredential };
```

Ligne 39 — type local à mettre à jour :
```typescript
// Garder "disconnected" comme status local UI (pas dans le shared)
export type CredentialStatus = "pending" | "connected" | "expired" | "revoked" | "error" | "disconnected";
// Backward-compat alias
export type McpCredentialStatus = CredentialStatus;
```

Lignes 112-117 (section Credentials) :
```typescript
// AVANT
  listCredentials: (companyId: string) =>
    api.get<UserMcpCredential[]>(`/companies/${companyId}/mcp-credentials`),
  storeApiKey: (companyId: string, itemId: string, material: Record<string, unknown>) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/mcp-credentials/${itemId}/api-key`, { material }),
  revokeCredential: (companyId: string, credentialId: string) =>
    api.delete<void>(`/companies/${companyId}/mcp-credentials/${credentialId}`),

// APRES
  listCredentials: (companyId: string) =>
    api.get<UserCredential[]>(`/companies/${companyId}/credentials`),
  storeApiKey: (companyId: string, itemId: string, material: Record<string, unknown>) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/credentials/${itemId}/secret`, { material }),
  storePat: (companyId: string, itemId: string, token: string) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/credentials/${itemId}/pat`, { material: { token } }),
  revokeCredential: (companyId: string, credentialId: string) =>
    api.delete<void>(`/companies/${companyId}/credentials/${credentialId}`),
```

---

**Opération :** Renommer `McpOAuthConnectButton.tsx` → `OAuthConnectButton.tsx`

Seul changement dans le fichier : renommer l'export de la fonction :
```typescript
// AVANT
export function McpOAuthConnectButton({

// APRES
export function OAuthConnectButton({
```

Et le type `McpCredentialStatus` → `CredentialStatus` dans l'import.

---

**Opération :** Renommer `ApiKeyCredentialDialog.tsx` → `CredentialDialog.tsx`

Renommer l'export :
```typescript
// AVANT
export function ApiKeyCredentialDialog({

// APRES
export function CredentialDialog({
```

Ajouter un paramètre `mode?: "env" | "pat"` pour supporter les deux cas d'utilisation. Mode `"env"` = comportement actuel (textarea KEY=VALUE). Mode `"pat"` = champ unique "Access Token".

Interface Props complète après refactor :
```typescript
export function CredentialDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  companyId,
  mode = "env", // "env" pour MCP, "pat" pour git providers
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  companyId: string;
  mode?: "env" | "pat";
}) {
```

---

**Fichier :** `ui/src/components/config-layers/LayerItemList.tsx`

Ligne 17-18 — Changer les imports :
```typescript
// AVANT
import { McpOAuthConnectButton } from "./McpOAuthConnectButton";
import { ApiKeyCredentialDialog } from "./ApiKeyCredentialDialog";

// APRES
import { OAuthConnectButton } from "./OAuthConnectButton";
import { CredentialDialog } from "./CredentialDialog";
```

Ligne 4 — Ajouter les types renommés :
```typescript
// AVANT
  type UserMcpCredential,
  type McpCredentialStatus,

// APRES
  type UserCredential,
  type CredentialStatus,
```

---

## 2. Phase 2 — Git Provider dans Config Layers

### Story 2.1 — Item type `git_provider` (runtime)

**Fichier :** `server/src/services/config-layer-runtime.ts`

Après l'interface `ResolvedConfig` (ligne 35-41), ajouter l'interface `ResolvedGitProvider` et étendre `ResolvedConfig` :

```typescript
export interface ResolvedGitProvider {
  name: string;
  host: string;
  providerType: string;
  token?: string; // decrypte au runtime, JAMAIS loggue
}

export interface ResolvedConfig {
  mcpServers: ResolvedMcpServer[];
  skills: ResolvedSkill[];
  hooks: ResolvedHook[];
  settings: Record<string, unknown>;
  gitProviders: ResolvedGitProvider[];  // ← NOUVEAU
  warnings: string[];
}
```

Dans la fonction `_resolve`, ligne 228-231 — ajouter la déclaration du tableau :
```typescript
    const mcpServers: ResolvedMcpServer[] = [];
    const skills: ResolvedSkill[] = [];
    const hooks: ResolvedHook[] = [];
    const settings: Record<string, unknown> = {};
    const gitProviders: ResolvedGitProvider[] = [];  // ← NOUVEAU
```

Dans le switch (ligne 236-285), ajouter un nouveau `case` avant `default` :
```typescript
        case "git_provider": {
          const gp: ResolvedGitProvider = {
            name: row.name,
            host: (cfg.host as string) ?? row.name,
            providerType: (cfg.providerType as string) ?? "generic",
          };
          gitProviders.push(gp);
          break;
        }
```

Section "Inject MCP credentials" (lignes 292-333) — généraliser :
```typescript
    // ── 4. Inject credentials for all credentialed item types ────────────────
    // MCP: credential material.env/headers merged into server config
    // git_provider: credential material.token injected into ResolvedGitProvider

    const CREDENTIALED_ITEM_TYPES = ["mcp", "git_provider"];
    const credentialedItemIds = mergedRows
      .filter((r) => CREDENTIALED_ITEM_TYPES.includes(r.item_type))
      .map((r) => r.id);

    if (credentialedItemIds.length > 0 && ownerUserId) {
      const credByItemId = new Map<string, Record<string, unknown>>();

      await Promise.all(
        credentialedItemIds.map(async (itemId) => {
          try {
            const material = await credSvc.getDecryptedMaterial(ownerUserId, companyId, itemId);
            if (material) credByItemId.set(itemId, material);
          } catch {
            // Decryption failure already logged by credSvc
          }
        }),
      );

      // Inject into MCP servers
      let mcpIdx = 0;
      for (const row of mergedRows) {
        if (row.item_type !== "mcp") continue;
        const material = credByItemId.get(row.id);
        if (material) {
          const server = mcpServers[mcpIdx];
          if (material.env && typeof material.env === "object") {
            server.env = { ...(server.env ?? {}), ...(material.env as Record<string, string>) };
          }
          if (material.headers && typeof material.headers === "object") {
            server.headers = { ...(server.headers ?? {}), ...(material.headers as Record<string, string>) };
          }
        }
        mcpIdx++;
      }

      // Inject tokens into git providers
      let gpIdx = 0;
      for (const row of mergedRows) {
        if (row.item_type !== "git_provider") continue;
        const material = credByItemId.get(row.id);
        if (material?.token && typeof material.token === "string") {
          gitProviders[gpIdx]!.token = material.token;
        }
        gpIdx++;
      }
    }
```

Return statement ligne 349 — ajouter `gitProviders` :
```typescript
    return { mcpServers, skills, hooks, settings, gitProviders, warnings };
```

---

### Story 2.2 — Onglet Git Providers (UI)

**Fichier :** `ui/src/components/config-layers/LayerEditor.tsx`

Ligne 12 — Changer le type `Tab` pour inclure `git_provider` :
```typescript
// AVANT
type Tab = ConfigLayerItemType;

// ConfigLayerItemType est déjà "mcp" | "skill" | "hook" | "setting" | "git_provider"
// après Story 1.2 — aucun changement nécessaire ici
```

Lignes 14-19 — Ajouter l'onglet dans le tableau `TABS` :
```typescript
// AVANT
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];

// APRES
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "git_provider", label: "Git Providers" },
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];
```

---

**Fichier :** `ui/src/components/config-layers/LayerItemList.tsx`

Lignes 58-63 — Ajouter `git_provider` dans `ITEM_TYPE_LABELS` :
```typescript
// AVANT
const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};

// APRES
const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  git_provider: "Git Provider",
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};
```

Lignes 1-19 — Ajouter l'import du nouveau composant :
```typescript
import { GitProviderItemEditor } from "./GitProviderItemEditor";
```

Lignes 31-56 — Ajouter le `case "git_provider"` dans le switch `ItemEditor` :
```typescript
    case "git_provider":
      return <GitProviderItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
```

Lignes 108-113 — Généraliser le chargement des credentials :
```typescript
// AVANT
  const isMcp = itemType === "mcp";
  const { data: credentials } = useQuery({
    queryKey: queryKeys.configLayers.credentials(companyId!),
    queryFn: () => configLayersApi.listCredentials(companyId!),
    enabled: isMcp && !!companyId,
  });

// APRES
  const isMcp = itemType === "mcp";
  const isGitProvider = itemType === "git_provider";
  const needsCredentials = isMcp || isGitProvider;
  const { data: credentials } = useQuery({
    queryKey: queryKeys.configLayers.credentials(companyId!),
    queryFn: () => configLayersApi.listCredentials(companyId!),
    enabled: needsCredentials && !!companyId,
  });
```

Ligne 278 — Étendre le rendu des credentials au-delà de MCP :
```typescript
// AVANT
              {/* Credential status for MCP items */}
              {isMcp && companyId && (

// APRES
              {/* Credential status for credentialed items */}
              {needsCredentials && companyId && (
```

Pour les git providers, le bouton "Add secrets" doit passer `mode="pat"` au `CredentialDialog` (au lieu de `mode="env"`). Ajouter une branche dans le gestionnaire :
```typescript
// Dans le JSX du bouton "Add secrets" (ligne ~295-304)
// Remplacer l'ouverture directe par un handler qui transmet le mode :
onClick={() => {
  setApiKeyItemId(it.id);
  setApiKeyItemName(it.displayName ?? it.name);
  setApiKeyMode(isGitProvider ? "pat" : "env");  // ← NOUVEAU state
}}

// Ajouter state ligne ~102 :
const [apiKeyMode, setApiKeyMode] = useState<"env" | "pat">("env");

// Dans le CredentialDialog (ligne ~368) :
<CredentialDialog
  ...
  mode={apiKeyMode}
/>
```

---

**Nouveau fichier :** `ui/src/components/config-layers/GitProviderItemEditor.tsx`

Modèle structurel basé sur `McpItemEditor.tsx` :

```typescript
import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { detectGitProvider } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitProviderIcon } from "../GitProviderIcon";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function GitProviderItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as { host?: string; providerType?: string } | undefined;
  const [hostInput, setHostInput] = useState(existing?.host ?? "");

  const detected = hostInput.trim() ? detectGitProvider(hostInput.trim()) : null;

  function handleSave() {
    if (!detected) return;
    onSave({
      name: detected.host,
      host: detected.host,
      providerType: detected.providerType,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1.5">
        <Label>URL du repo ou hostname</Label>
        <Input
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          placeholder="github.com ou https://github.com/org/repo"
          autoFocus
        />
      </div>

      {detected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitProviderIcon provider={detected.providerType} className="h-4 w-4" />
          <span>{detected.label}</span>
          <span className="font-mono text-xs">{detected.host}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!detected}>
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
```

---

**Nouveau fichier :** `ui/src/components/GitProviderIcon.tsx`

```typescript
import { Github, GitBranch } from "lucide-react";
import type { GitProviderType } from "@mnm/shared";

type IconProps = {
  className?: string;
};

// SVG inline pour les providers sans icone lucide native
function GitLabIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

function BitbucketIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.878 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z"/>
    </svg>
  );
}

function AzureDevOpsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 17.182V6.727L6.545 0l3.273 1.636v3.273L16.364 3l7.636 2.727V18L16.364 21l-9.818-2.182v2.545L0 17.182zm16.364-1.091l4.363-1.273V8.182l-4.363-1.455v9.364zM2.182 15.818l4.364.818V7.364L2.182 8.727v7.091z"/>
    </svg>
  );
}

const PROVIDER_ICONS: Record<GitProviderType, React.FC<IconProps>> = {
  github: ({ className }) => <Github className={className} />,
  gitlab: GitLabIcon,
  bitbucket: BitbucketIcon,
  gitea: ({ className }) => <GitBranch className={className} />, // fallback
  azure_devops: AzureDevOpsIcon,
  generic: ({ className }) => <GitBranch className={className} />,
};

export function GitProviderIcon({
  provider,
  className,
}: {
  provider: GitProviderType | string;
  className?: string;
}) {
  const Icon = PROVIDER_ICONS[provider as GitProviderType] ?? PROVIDER_ICONS.generic;
  return <Icon className={className} />;
}
```

---

## 3. Phase 3 — Intégration runtime + workspace UI

### Story 3.1 — Credential injection dans config-layer-runtime

Déjà couvert dans Story 2.1 (section "Inject credentials for all credentialed item types").

---

### Story 3.2 — Heartbeat git token injection

**Fichier :** `packages/adapters/claude-local/src/server/execute.ts`

Ajouter l'import en tête du fichier :
```typescript
import { parseRepoUrl, sanitizeEnvKey } from "@mnm/shared";
```

La fonction `buildClaudeRuntimeConfig` reçoit déjà `context.mnmWorkspaces` (ligne 186) et `input.claudeOauthToken`. Il faut passer les `gitProviders` en plus.

**Modifier le type `ClaudeExecutionInput`** pour inclure les git providers :
```typescript
// Dans le type d'input (chercher l'interface ClaudeExecutionInput)
interface ClaudeExecutionInput {
  // ... champs existants ...
  gitProviders?: Array<{ host: string; token?: string }>;
}
```

Après la ligne 268 (injection des env vars workspace), ajouter l'injection des tokens git :
```typescript
  // GIT CREDENTIALS: inject per-host tokens for workspace repos
  if (input.gitProviders && input.gitProviders.length > 0 && workspaceHints.length > 0) {
    for (const hint of workspaceHints) {
      const repoUrl = hint.repoUrl;
      if (!repoUrl) continue;
      const parsed = parseRepoUrl(repoUrl as string);
      if (!parsed) continue;
      const matchingProvider = input.gitProviders.find((gp) => gp.host === parsed.host);
      if (matchingProvider?.token) {
        const envKey = `GIT_TOKEN_${sanitizeEnvKey(parsed.host)}`;
        env[envKey] = matchingProvider.token;
      }
    }
  }
```

**Fichier :** `server/src/services/heartbeat.ts`

Dans la section "CONFIG-LAYERS: resolve merged config from layers" (lignes 1350-1376), après `const layerConfig = await clRuntime.resolveConfigForRun(...)`, passer les git providers à l'adapter :

```typescript
        // Extraire les git providers resolus (avec tokens)
        const resolvedGitProviders = layerConfig.gitProviders ?? [];
```

Et lors de l'appel à `adapter.execute` (ligne 1441), passer `gitProviders` dans le contexte :
```typescript
      const adapterResult = await adapter.execute({
        runId: run.id,
        agent,
        runtime: runtimeForAdapter,
        config: resolvedConfig,
        context,
        onLog,
        onMeta: onAdapterMeta,
        authToken: authToken ?? undefined,
        dockerContainerId,
        claudeOauthToken,
        gitProviders: resolvedGitProviders,  // ← NOUVEAU
      });
```

**Fichier :** `packages/adapter-utils/src/types.ts`

Ligne 86 (déjà référencé par CLAUDE_CODE_OAUTH_TOKEN) — ajouter dans `AdapterExecutionContext` :
```typescript
  /** Git provider tokens resolved from config layers */
  gitProviders?: Array<{ host: string; token?: string }>;
```

---

### Story 3.3 — Workspace UI universelle

**Fichier :** `ui/src/components/NewProjectDialog.tsx`

Ligne 27 — Modifier les imports d'icones :
```typescript
// AVANT
import {
  ...
  Github,
  GitBranch,
} from "lucide-react";

// APRES
import {
  ...
  GitBranch,   // garder pour "Both"
} from "lucide-react";
import { GitProviderIcon } from "./GitProviderIcon";
import { detectGitProvider } from "@mnm/shared";
// Supprimer Github de l'import lucide
```

Lignes 99-109 — Remplacer `isGitHubRepoUrl` par `isGitUrl` :
```typescript
// AVANT
  const isGitHubRepoUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };

// APRES
  const isGitUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    // git@ SSH format
    if (/^git@[^:]+:[^/]+\/.+/.test(trimmed)) return true;
    // https:// with at least owner/repo
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };
```

Ligne 144 — Changer la validation :
```typescript
// AVANT
    if (repoRequired && !isGitHubRepoUrl(repoUrl)) {
      setWorkspaceError("Repo workspace must use a valid GitHub repo URL.");

// APRES
    if (repoRequired && !isGitUrl(repoUrl)) {
      setWorkspaceError("L'URL du repo doit être une URL git valide (https:// ou git@).");
```

Ligne 117-126 — Mettre à jour `deriveWorkspaceNameFromRepo` :
```typescript
  const deriveWorkspaceNameFromRepo = (value: string) => {
    try {
      // Handle git@ format
      const sshMatch = value.match(/^git@[^:]+:([^/]+)\/([^.]+)/);
      if (sshMatch) return sshMatch[2] ?? "repo";
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
      return repo || "repo";
    } catch {
      return "repo";
    }
  };
```

Lignes 307-318 — Changer l'icone et le label du bouton "A github repo" :
```typescript
// AVANT
            <button ... onClick={() => toggleWorkspaceSetup("repo")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Github className="h-4 w-4" />
                A github repo
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Paste a GitHub URL.</p>
            </button>

// APRES
            <button ... onClick={() => toggleWorkspaceSetup("repo")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <GitBranch className="h-4 w-4" />
                A git repo
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Paste any git URL.</p>
            </button>
```

Ligne 350-358 — Mettre à jour le label du champ repo et le placeholder :
```typescript
// AVANT
              <label className="mb-1 block text-xs text-muted-foreground">GitHub repo URL</label>
              <input
                ...
                placeholder="https://github.com/org/repo"
              />

// APRES
              <label className="mb-1 block text-xs text-muted-foreground">Git repo URL</label>
              <input
                ...
                placeholder="https://github.com/org/repo ou https://gitlab.com/org/repo"
              />
```

Ajouter un aperçu du provider détecté sous le champ URL (après le `<input>`) :
```typescript
              {workspaceRepoUrl.trim() && (() => {
                const p = detectGitProvider(workspaceRepoUrl.trim());
                return (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <GitProviderIcon provider={p.providerType} className="h-3 w-3" />
                    <span>{p.label}</span>
                  </div>
                );
              })()}
```

---

**Fichier :** `ui/src/components/ProjectProperties.tsx`

Ligne 17 — Modifier les imports :
```typescript
// AVANT
import { ExternalLink, Github, Loader2, Plus, ScanSearch, Trash2, X } from "lucide-react";

// APRES
import { ExternalLink, GitBranch, Loader2, Plus, ScanSearch, Trash2, X } from "lucide-react";
import { GitProviderIcon } from "./GitProviderIcon";
import { detectGitProvider } from "@mnm/shared";
```

Lignes 170-180 — Remplacer `isGitHubRepoUrl` par `isGitUrl` (même implémentation que `NewProjectDialog.tsx`).

Lignes 226-231 — Changer la validation :
```typescript
// AVANT
    if (!isGitHubRepoUrl(repoUrl)) {
      setWorkspaceError("Repo workspace must use a valid GitHub repo URL.");

// APRES
    if (!isGitUrl(repoUrl)) {
      setWorkspaceError("L'URL du repo doit être une URL git valide.");
```

Lignes 408-419 — Icone dynamique pour le `workspace.repoUrl` affiché :
```typescript
// AVANT
                      <a href={workspace.repoUrl} ...>
                        <Github className="h-3 w-3 shrink-0" />
                        <span className="truncate">{formatGitHubRepo(workspace.repoUrl)}</span>

// APRES
                      <a href={workspace.repoUrl} ...>
                        {(() => {
                          const p = detectGitProvider(workspace.repoUrl);
                          return <GitProviderIcon provider={p.providerType} className="h-3 w-3 shrink-0" />;
                        })()}
                        <span className="truncate">{formatGitHubRepo(workspace.repoUrl)}</span>
```

Ligne 499 — Changer le placeholder :
```typescript
// AVANT
                placeholder="https://github.com/org/repo"

// APRES
                placeholder="https://github.com/org/repo ou https://gitlab.com/org/repo"
```

---

## 4. Ordre d'implémentation et dépendances

```
Phase 1 (fondation — doit être faite dans cet ordre strict) :
  1.1 Migration DB                        → dépend de rien
  1.2 Rename shared types + CONFIG_LAYER_ITEM_TYPES + git-provider.ts utils
      → dépend de 1.1 (DB renommée)
  1.3 Rename services backend             → dépend de 1.2 (types renommés)
  1.4 Rename routes                       → dépend de 1.3
  1.5 Rename composants UI                → dépend de 1.2 + 1.4

Phase 2 (peut commencer après 1.2) :
  2.1 Runtime git_provider               → dépend de 1.2 + 1.3
  2.2 UI onglet + GitProviderItemEditor  → dépend de 1.2 + 1.5
  2.3 GitProviderIcon                    → dépend de 1.2 (git-provider.ts)

Phase 3 (après Phase 2) :
  3.1 Credential injection runtime       → déjà inclus dans 2.1
  3.2 Heartbeat git token injection      → dépend de 2.1
  3.3 Workspace UI universelle           → dépend de 2.3 (GitProviderIcon)
```

---

## 5. Risques techniques identifiés

### Risque 1 — TypeScript strict sur `ResolvedConfig`
La propriété `gitProviders` est optionnelle dans la spec, mais le type doit être `gitProviders: ResolvedGitProvider[]` (pas optionnel) pour éviter les `?.` partout. Initialiser à `[]` dans tous les paths de `_resolve`.

### Risque 2 — Backward-compat exports shared
Les types `McpCredentialProvider`, `McpCredentialStatus`, `UserMcpCredential`, `MCP_CREDENTIAL_PROVIDERS`, `MCP_CREDENTIAL_STATUSES` sont exportés depuis `packages/shared/src/index.ts` (ligne 326, 405). Les garder comme aliases sinon tous les consommateurs cassent. Vérifier s'il y a des fichiers supplémentaires hors de ce scope qui les importent avec `grep`.

### Risque 3 — Cache invalidation dans config-layer-runtime
La propriété `gitProviders` est dans le résultat caché (TTL 1 minute). Si un token est révoqué, l'agent peut avoir une ancienne version jusqu'à 1 min. Acceptable pour le MVP.

### Risque 4 — `AdapterExecutionContext` dans adapter-utils
Le type `AdapterExecutionContext` (`packages/adapter-utils/src/types.ts` ligne 86) est partagé entre plusieurs adapters (process, http, claude-local). Ajouter `gitProviders` comme optionnel pour ne pas casser les autres adapters.

### Risque 5 — Fenêtre OAuth popup (McpOAuthConnectButton)
La popup utilise `event.data?.type === "mcp-oauth-result"`. Après le rename, le popup HTML côté serveur (`buildPopupHtml`) envoie aussi ce type. Les deux doivent être modifiés ensemble pour rester cohérents. Préférer garder `"mcp-oauth-result"` inchangé pour ne pas casser les sessions ouvertes.

### Risque 6 — git@ SSH URLs dans `isGitUrl`
Les URLs `git@github.com:org/repo.git` ne passent pas par `new URL()`. Le regex ajouté couvre ce cas mais doit être testé sur les cas edge (sous-domaines, ports).

### Risque 7 — Migration 0061 — numéros en collision
Deux migrations avec le même numéro existent déjà (0055, 0056). Confirmer avec l'équipe que `0061` est le prochain numéro non pris (le dernier est `0060_cleanup_legacy_columns.sql`).

---

## 6. Checklist de vérification par story

Pour chaque story, vérifier :
1. `bun run typecheck` passe (13/13 packages)
2. `bun run build` passe
3. Server démarre sans erreur
4. Tests existants de config-layers passent

Story 1.1 spécifiquement : tester migration up ET down.
Story 1.4 spécifiquement : tester les 5 endpoints avec curl/Postman.
Story 2.1 spécifiquement : créer un item `git_provider` via API et vérifier que `resolveConfigForRun` retourne un `gitProviders` non vide.
Story 3.2 spécifiquement : vérifier dans les logs Docker que `GIT_TOKEN_*` env var est bien présente dans le container.
