# Universal Git Provider Support + Generic Credential Store

**Date:** 2026-04-07
**Status:** Draft — en attente de review
**Auteur:** tom.andrieu
**Epic:** Universal Git Provider & Credential Store
**Priorite:** High

---

## 1. Contexte & Objectif

MnM est un cockpit B2B de supervision d'agents IA. Les agents clonent des repos git dans leurs sandboxes Docker pour travailler sur le code des clients.

**Probleme actuel :**
- GitHub est hardcode partout (validation URL, icone, placeholder) dans `NewProjectDialog.tsx` et `ProjectProperties.tsx`
- Le systeme de credentials est prefixe "MCP" (`user_mcp_credentials`, `mcpCredentialService`, `McpOAuthConnectButton`) alors que la structure est deja generique
- Impossible d'utiliser GitLab, Bitbucket, Gitea, Azure DevOps, ou un serveur git self-hosted
- Pas de gestion de token git pour l'authentification des agents aux repos prives

**Objectif :**
1. **Credential Store generique** — Renommer et generaliser le systeme `user_mcp_credentials` pour servir tout type de secret (MCP, git, API externe)
2. **Git Provider dans Config Layers** — Nouveau `itemType: 'git_provider'` avec onglet dedie, auto-detection du provider, et stockage PAT
3. **UI universelle** — Accepter n'importe quelle URL git, icone dynamique par provider, plus de GitHub hardcode

## 2. Decisions de design

| Question | Decision |
|----------|----------|
| Credential store | Renommer `user_mcp_credentials` → `user_credentials`. Meme table, meme chiffrement AES-256-GCM, meme FK vers `config_layer_items` |
| Git provider | Nouveau `itemType: 'git_provider'` dans config layers, avec onglet dedie dans le LayerEditor |
| Auth MVP | PAT (Personal Access Token) uniquement. Nouveau provider type `'pat'`. OAuth git en V2 |
| Detection provider | Auto-detection par hostname de l'URL (github.com → github, gitlab.com → gitlab, etc.) |
| Token injection | Via env vars au `docker exec` dans heartbeat. L'agent utilise le token pour `git clone` |
| Lien workspace ↔ provider | Matching automatique par hostname, pas de FK explicite |
| UI workspace | Plus de validation GitHub-only. Icone dynamique via `GitProviderIcon` component |
| MCP backward compat | 100% transparent — meme table renommee, memes operations, credential MCP existants migres automatiquement |

## 3. Architecture

### 3.1 Credential Store generique (rename)

**Avant :**
```
user_mcp_credentials (table)
  → mcpCredentialService (service)
  → mcpOauthService (service)
  → /mcp-credentials (routes)
  → McpOAuthConnectButton (UI)
  → ApiKeyCredentialDialog (UI)
  → UserMcpCredential (type)
  → MCP_CREDENTIAL_PROVIDERS (const)
  → MCP_CREDENTIAL_STATUSES (const)
```

**Apres :**
```
user_credentials (table)                    ← rename
  → credentialService (service)             ← rename
  → oauthService (service)                  ← rename
  → /credentials (routes)                   ← rename
  → OAuthConnectButton (UI)                 ← rename
  → CredentialDialog (UI)                   ← rename + generalise
  → UserCredential (type)                   ← rename
  → CREDENTIAL_PROVIDERS (const)            ← rename + extend
  → CREDENTIAL_STATUSES (const)             ← rename
```

**Provider types etendu :**
```typescript
// Avant
export const MCP_CREDENTIAL_PROVIDERS = ['oauth2', 'api_key', 'bearer', 'custom'] as const;

// Apres
export const CREDENTIAL_PROVIDERS = ['oauth2', 'api_key', 'bearer', 'pat', 'custom'] as const;
```

Le type `'pat'` est ajoute pour les Personal Access Tokens git. Structurellement identique a `'api_key'` mais semantiquement distinct.

### 3.2 Migration DB

```sql
-- Migration 00XX: Rename user_mcp_credentials → user_credentials
-- + extend provider CHECK constraint

ALTER TABLE user_mcp_credentials RENAME TO user_credentials;

-- Rename indexes
ALTER INDEX user_mcp_credentials_user_company_item_uq
  RENAME TO user_credentials_user_company_item_uq;
ALTER INDEX user_mcp_credentials_user_company_idx
  RENAME TO user_credentials_user_company_idx;
ALTER INDEX user_mcp_credentials_expiring_idx
  RENAME TO user_credentials_expiring_idx;

-- Update provider CHECK constraint to include 'pat'
ALTER TABLE user_credentials DROP CONSTRAINT IF EXISTS user_mcp_credentials_provider_check;
ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_provider_check
  CHECK (provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom'));
```

**Impact :** Zero downtime. Les credentials MCP existants continuent de fonctionner — meme table, meme FK, meme chiffrement.

### 3.3 Git Provider — Item Type

**Ajout a `CONFIG_LAYER_ITEM_TYPES` :**
```typescript
export const CONFIG_LAYER_ITEM_TYPES = [
  "mcp", "skill", "hook", "setting",
  "git_provider",  // ← NOUVEAU
] as const;
```

**Config JSON schema :**
```typescript
export const gitProviderItemConfigSchema = z.object({
  host: z.string().min(1),
  providerType: z.enum([
    'github', 'gitlab', 'bitbucket', 'gitea', 'azure_devops', 'generic'
  ]).default('generic'),
  apiUrl: z.string().url().optional().nullable(),  // V2: pour API calls provider-specifiques
});

export type GitProviderItemConfig = z.infer<typeof gitProviderItemConfigSchema>;
```

**Exemple d'item stocke :**
```json
{
  "id": "uuid-xxx",
  "layerId": "agent-base-layer-id",
  "itemType": "git_provider",
  "name": "github.com",
  "displayName": "GitHub",
  "configJson": {
    "host": "github.com",
    "providerType": "github"
  },
  "enabled": true
}
```

**Credential associe :**
```json
{
  "id": "cred-uuid",
  "userId": "user-123",
  "companyId": "company-456",
  "itemId": "uuid-xxx",
  "provider": "pat",
  "material": { "iv": "...", "ciphertext": "...", "tag": "..." },
  "status": "connected"
}
```

Material decrypte :
```json
{
  "token": "ghp_xxxxxxxxxxxx"
}
```

### 3.4 Provider Auto-Detection

```typescript
// packages/shared/src/utils/git-provider.ts

export type GitProviderType =
  | 'github' | 'gitlab' | 'bitbucket'
  | 'gitea' | 'azure_devops' | 'generic';

export interface DetectedGitProvider {
  providerType: GitProviderType;
  host: string;
  label: string;      // "GitHub", "GitLab (self-hosted)", "Git"
  iconName: string;    // pour le composant GitProviderIcon
}

const KNOWN_HOSTS: Record<string, GitProviderType> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
  'dev.azure.com': 'azure_devops',
  'ssh.dev.azure.com': 'azure_devops',
  'vs-ssh.visualstudio.com': 'azure_devops',
};

export function detectGitProvider(urlOrHost: string): DetectedGitProvider {
  // 1. Extraire le hostname
  // 2. Chercher dans KNOWN_HOSTS
  // 3. Si pas trouve, check si le hostname contient "gitlab" ou "gitea"
  // 4. Sinon → 'generic'
}

export function parseRepoUrl(url: string): {
  host: string;
  owner: string;
  repo: string;
} | null {
  // Parse https:// et git@ URLs
}
```

**Regles de detection :**

| Hostname | Provider | Label |
|----------|----------|-------|
| `github.com` | github | GitHub |
| `gitlab.com` | gitlab | GitLab |
| `*.gitlab.*` ou hostname contient "gitlab" | gitlab | GitLab (self-hosted) |
| `bitbucket.org` | bitbucket | Bitbucket |
| `dev.azure.com` | azure_devops | Azure DevOps |
| hostname contient "gitea" | gitea | Gitea |
| tout le reste | generic | Git |

### 3.5 UI — Onglet Git Providers

**LayerEditor.tsx — Ajout de l'onglet :**
```typescript
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "git_provider", label: "Git Providers" },  // ← NOUVEAU
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];
```

**LayerItemList.tsx — Extension :**
```typescript
// ITEM_TYPE_LABELS
const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  git_provider: "Git Provider",  // ← NOUVEAU
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};

// ItemEditor switch — ajout du case
case "git_provider":
  return <GitProviderItemEditor item={item} onSave={onSave} onCancel={onCancel} />;

// Credential loading — etendre au-dela de MCP
const needsCredentials = itemType === "mcp" || itemType === "git_provider";
```

**Nouveau composant `GitProviderItemEditor.tsx` :**

Champs du formulaire :
1. **URL ou Host** (text input) — l'utilisateur colle une URL de repo ou juste un hostname
2. **Provider detecte** (auto, read-only) — icone + label, detecte depuis le hostname
3. **Access Token** (password input) — le PAT, stocke via credentialService
4. **Status** (badge) — Connected / Pending / Error

Le token est stocke au save via `POST /credentials/:itemId/pat` (pas dans configJson).

**Nouveau composant `GitProviderIcon.tsx` :**

```typescript
// ui/src/components/GitProviderIcon.tsx
import { Github, GitBranch } from "lucide-react";

const PROVIDER_ICONS: Record<GitProviderType, React.FC<IconProps>> = {
  github: Github,         // lucide natif
  gitlab: GitlabIcon,     // SVG custom (lucide n'a pas GitLab)
  bitbucket: BitbucketIcon, // SVG custom
  gitea: GiteaIcon,       // SVG custom
  azure_devops: AzureDevOpsIcon, // SVG custom
  generic: GitBranch,     // lucide natif
};

export function GitProviderIcon({ provider, ...props }: { provider: GitProviderType } & IconProps) {
  const Icon = PROVIDER_ICONS[provider] ?? GitBranch;
  return <Icon {...props} />;
}
```

### 3.6 Credential dans LayerItemList — Pattern unifie

Le pattern de credentials actuellement reserve aux items MCP est generalise. Le code de `LayerItemList.tsx` (lignes 107-175, 278-333) est refactore :

```typescript
// Avant : credentials uniquement pour MCP
const isMcp = itemType === "mcp";
const { data: credentials } = useQuery({
  enabled: isMcp && !!companyId,
  ...
});

// Apres : credentials pour tout item type qui en a besoin
const CREDENTIALED_TYPES: ConfigLayerItemType[] = ["mcp", "git_provider"];
const needsCredentials = CREDENTIALED_TYPES.includes(itemType);
const { data: credentials } = useQuery({
  enabled: needsCredentials && !!companyId,
  ...
});
```

Le bloc de rendu des credentials (status badge, bouton add/update secrets, revoke) est extrait dans un sous-composant `<ItemCredentialActions>` reutilise pour MCP et git_provider.

Pour les items `git_provider`, le bouton "Add secrets" ouvre le `CredentialDialog` (renomme depuis `ApiKeyCredentialDialog`) avec un mode adapte :
- MCP → textarea KEY=VALUE (env vars)
- git_provider → champ unique "Access Token" (PAT)

### 3.7 Runtime — Resolution des Git Providers

**config-layer-runtime.ts — Nouveau type + case :**

```typescript
export interface ResolvedGitProvider {
  name: string;        // ex: "github.com"
  host: string;        // ex: "github.com"
  providerType: string; // ex: "github"
  token?: string;      // decrypte au runtime, JAMAIS persiste en clair
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

**Switch case :**
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

**Credential injection (section 4 du runtime) :**

Generaliser la section "Inject MCP credentials" pour injecter aussi les credentials git :

```typescript
// Avant : uniquement MCP items
const mcpItemIds = mergedRows.filter(r => r.item_type === "mcp").map(r => r.id);

// Apres : tous les items credentiables
const CREDENTIALED_ITEM_TYPES = ["mcp", "git_provider"];
const credentialedItemIds = mergedRows
  .filter(r => CREDENTIALED_ITEM_TYPES.includes(r.item_type))
  .map(r => r.id);
```

Pour les git providers, le material decrypte `{ token: "ghp_xxx" }` est injecte dans `ResolvedGitProvider.token`.

### 3.8 Heartbeat — Injection dans Docker

**heartbeat.ts — Passage des git credentials a l'agent :**

Quand le heartbeat lance un agent dans sa sandbox Docker :

```typescript
// 1. Resoudre la config de l'agent
const resolved = await configLayerRuntime.resolveForAgent(agentId, companyId, ownerUserId);

// 2. Pour chaque workspace du projet
for (const workspace of projectWorkspaces) {
  if (!workspace.repoUrl) continue;
  const { host } = parseRepoUrl(workspace.repoUrl);

  // 3. Trouver le git provider matching
  const provider = resolved.gitProviders.find(gp => gp.host === host);
  if (provider?.token) {
    // 4. Injecter comme env var dans le docker exec
    envVars[`GIT_TOKEN_${sanitizeEnvKey(host)}`] = provider.token;
    // ex: GIT_TOKEN_GITHUB_COM=ghp_xxxx
  }
}
```

**Cote agent/sandbox :** L'agent utilise le token pour cloner :
```bash
git clone https://${GIT_TOKEN_GITHUB_COM}@github.com/org/repo.git
# ou via git credential helper configure dans l'image Docker
```

### 3.9 Workspace UI — Suppression du hardcode GitHub

**NewProjectDialog.tsx :**

```typescript
// Avant (ligne 103-105)
const isGitHubUrl = hostname === "github.com" || hostname === "www.github.com";

// Apres
// Supprimer la validation GitHub-only
// Accepter toute URL qui ressemble a un repo git
const looksLikeGitUrl = url.includes('/') && (
  url.startsWith('https://') || url.startsWith('git@') || url.endsWith('.git')
);
```

```typescript
// Avant (ligne 355)
placeholder="https://github.com/org/repo"

// Apres
placeholder="https://github.com/org/repo ou toute URL git"
```

```typescript
// Avant (ligne 27) — icone hardcodee
import { Github, GitBranch } from "lucide-react";
// ... <Github className="h-4 w-4" />

// Apres — icone dynamique
import { GitProviderIcon, detectGitProvider } from "../GitProviderIcon";
// ... <GitProviderIcon provider={detectGitProvider(repoUrl).providerType} className="h-4 w-4" />
```

**ProjectProperties.tsx :** Memes changements (lignes 174-176, 499, 17).

### 3.10 Company Portability — Hors scope MVP

`company-portability.ts` (lignes 407-542) utilise les APIs GitHub (`raw.githubusercontent.com`) pour l'import. **Hors scope de cette epic.** On garde le code GitHub existant tel quel. L'abstraction multi-provider pour l'import sera un follow-up.

## 4. Schemas de donnees

### 4.1 Table `user_credentials` (renommee)

```
user_credentials
├── id           UUID PK
├── user_id      TEXT NOT NULL
├── company_id   UUID NOT NULL FK → companies.id
├── item_id      UUID NOT NULL FK → config_layer_items.id ON DELETE CASCADE
├── provider     TEXT NOT NULL CHECK ('oauth2','api_key','bearer','pat','custom')
├── material     JSONB NOT NULL  (chiffre AES-256-GCM: {iv, ciphertext, tag})
├── status       TEXT NOT NULL DEFAULT 'pending' CHECK ('pending','connected','expired','revoked','error')
├── status_message TEXT
├── max_ttl_at   TIMESTAMPTZ
├── connected_at TIMESTAMPTZ
├── expires_at   TIMESTAMPTZ
├── updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
│
├── UNIQUE (user_id, company_id, item_id)
├── INDEX  (user_id, company_id)
├── INDEX  (expires_at) WHERE status='connected'
└── RLS    tenant_isolation ON company_id
```

### 4.2 Config Layer Item — git_provider

```
config_layer_items (existant, nouveau item_type)
├── item_type = 'git_provider'
├── name = hostname (ex: "github.com")
├── display_name = label UI (ex: "GitHub")
├── config_json = {
│     host: string,
│     providerType: 'github'|'gitlab'|'bitbucket'|'gitea'|'azure_devops'|'generic',
│     apiUrl?: string  // V2
│   }
└── ... (autres colonnes standard)
```

## 5. API Endpoints

### 5.1 Routes renommees (credentials)

| Avant | Apres | Methode | Description |
|-------|-------|---------|-------------|
| `/companies/:cid/mcp-credentials` | `/companies/:cid/credentials` | GET | Lister les credentials de l'utilisateur |
| `/companies/:cid/mcp-credentials/:itemId/api-key` | `/companies/:cid/credentials/:itemId/secret` | POST | Stocker un secret (api_key ou pat) |
| `/companies/:cid/mcp-credentials/:id` | `/companies/:cid/credentials/:id` | DELETE | Revoquer un credential |
| `/oauth/authorize/:itemId` | `/oauth/authorize/:itemId` | GET | Initier OAuth (inchange) |
| `/oauth/callback` | `/oauth/callback` | GET | Callback OAuth (inchange) |

**Nouveau endpoint :**

| Route | Methode | Description |
|-------|---------|-------------|
| `/companies/:cid/credentials/:itemId/pat` | POST | Stocker un PAT git |

**Body :**
```json
{
  "material": {
    "token": "ghp_xxxxxxxxxxxx"
  }
}
```

**Note :** L'ancien endpoint `/mcp-credentials` est garde temporairement comme alias (redirect 301) pour backward compatibility le temps que tous les clients UI soient deployes. A supprimer en V2.

### 5.2 Routes config layer items (inchangees)

Les routes CRUD pour `config_layer_items` (`POST /config-layers/:layerId/items`, etc.) fonctionnent deja de maniere generique — aucun changement necessaire. Le nouveau `itemType: 'git_provider'` passe par les memes routes.

## 6. Plan d'implementation — Stories

### Phase 1 : Credential Store generique (fondation)

**Story 1.1 — Migration DB : rename table + extend provider**
- Migration SQL : `user_mcp_credentials` → `user_credentials`
- Rename index, update CHECK constraint pour inclure `'pat'`
- Update schema Drizzle : `userMcpCredentials` → `userCredentials`
- Update exports dans `packages/db/src/schema/index.ts`
- **Acceptance :** Migration up/down fonctionne, `bun run typecheck` passe

**Story 1.2 — Rename types & constantes (shared)**
- `MCP_CREDENTIAL_PROVIDERS` → `CREDENTIAL_PROVIDERS` (+ ajout `'pat'`)
- `MCP_CREDENTIAL_STATUSES` → `CREDENTIAL_STATUSES`
- `McpCredentialProvider` → `CredentialProvider`
- `McpCredentialStatus` → `CredentialStatus`
- `UserMcpCredential` → `UserCredential`
- Update tous les imports dans shared
- **Acceptance :** `bun run typecheck` passe (13/13 packages)

**Story 1.3 — Rename services backend**
- `mcp-credential.ts` → `credential.ts`, `mcpCredentialService` → `credentialService`
- `mcp-oauth.ts` → `oauth.ts`, `mcpOauthService` → `oauthService`
- Update tous les imports dans `server/src/services/`, `server/src/routes/`
- Update `config-layer-runtime.ts` imports
- **Acceptance :** `bun run typecheck` passe, server demarre

**Story 1.4 — Rename routes API**
- `routes/mcp-oauth.ts` → `routes/credentials.ts`
- `/mcp-credentials` → `/credentials`
- `/mcp-credentials/:itemId/api-key` → `/credentials/:itemId/secret`
- Ajouter 301 redirect temporaire depuis les anciens paths
- Update `app.ts` imports
- Ajouter endpoint `POST /credentials/:itemId/pat`
- **Acceptance :** Les 5 endpoints credentials repondent correctement

**Story 1.5 — Rename composants UI**
- `McpOAuthConnectButton.tsx` → `OAuthConnectButton.tsx`
- `ApiKeyCredentialDialog.tsx` → `CredentialDialog.tsx` (generique)
- Update imports dans `LayerItemList.tsx`
- Update API client `ui/src/api/config-layers.ts` (URLs)
- **Acceptance :** UI config layers MCP fonctionne comme avant, `bun run typecheck` passe

### Phase 2 : Git Provider dans Config Layers

**Story 2.1 — Item type `git_provider` (shared + backend)**
- Ajouter `'git_provider'` a `CONFIG_LAYER_ITEM_TYPES`
- Creer `gitProviderItemConfigSchema` (Zod)
- Ajouter type `GitProviderItemConfig`
- Ajouter case `"git_provider"` dans `config-layer-runtime.ts`
- Ajouter `ResolvedGitProvider` interface et `gitProviders[]` dans `ResolvedConfig`
- **Acceptance :** On peut creer un item `git_provider` via API, le runtime le resout

**Story 2.2 — Git Provider detection (shared)**
- Creer `packages/shared/src/utils/git-provider.ts`
- Fonctions : `detectGitProvider(urlOrHost)`, `parseRepoUrl(url)`
- Types : `GitProviderType`, `DetectedGitProvider`
- Table de mapping KNOWN_HOSTS + heuristiques (hostname contains)
- Tests unitaires
- **Acceptance :** Detection correcte pour github.com, gitlab.com, gitlab.corp.com, bitbucket.org, dev.azure.com, gitea.io, random.host.com

**Story 2.3 — Onglet Git Providers (UI)**
- Ajouter tab `{ id: "git_provider", label: "Git Providers" }` dans `LayerEditor.tsx`
- Ajouter label `git_provider: "Git Provider"` dans `LayerItemList.tsx`
- Creer `GitProviderItemEditor.tsx` : formulaire avec host input, detection auto, PAT input
- Ajouter case dans `ItemEditor` switch
- Generaliser le chargement des credentials (`needsCredentials` au lieu de `isMcp`)
- Extraire `<ItemCredentialActions>` composant pour la section credentials
- **Acceptance :** On peut ajouter/editer/supprimer un git provider dans l'UI, le credential est stocke

**Story 2.4 — GitProviderIcon composant (UI)**
- Creer `ui/src/components/GitProviderIcon.tsx`
- Icones : GitHub (lucide), GitLab (SVG), Bitbucket (SVG), Gitea (SVG), Azure DevOps (SVG), Generic (lucide GitBranch)
- Export `GitProviderIcon` + `detectGitProvider` wrapper UI
- **Acceptance :** Chaque provider affiche la bonne icone

### Phase 3 : Integration runtime + workspace UI

**Story 3.1 — Credential injection dans config-layer-runtime**
- Generaliser l'injection credentials (section 4 du runtime) pour `git_provider` en plus de `mcp`
- Pour git_provider : decrypter le material, injecter `token` dans `ResolvedGitProvider`
- **Acceptance :** `resolveForAgent()` retourne les git providers avec tokens decryptes

**Story 3.2 — Heartbeat git token injection**
- Dans `heartbeat.ts` : resoudre les git providers de l'agent
- Pour chaque workspace, matcher le host avec un git provider
- Injecter `GIT_TOKEN_<HOST>` dans les env vars du `docker exec`
- **Acceptance :** L'agent dans Docker recoit les env vars git token

**Story 3.3 — Workspace UI universelle**
- `NewProjectDialog.tsx` : supprimer validation GitHub, accepter toute URL git, icone dynamique
- `ProjectProperties.tsx` : meme refactoring
- Placeholder generique, detection auto du provider
- Warning si pas de credential configure pour le host
- **Acceptance :** On peut ajouter un repo GitLab/Bitbucket/self-hosted, l'icone s'adapte

## 7. Hors scope (explicite)

- **OAuth git** (GitHub App, GitLab OAuth) — V2, le MVP utilise PAT uniquement
- **Company portability** (`company-portability.ts`) — garde le code GitHub, pas de multi-provider import
- **Webhooks git** — pas dans cette epic
- **SSH keys** — PAT over HTTPS uniquement
- **API provider-specifiques** (create PR, list branches via API) — V2, le `apiUrl` dans configJson est prepare mais pas utilise
- **Token refresh** — les PATs n'expirent pas (ou tres rarement), pas de refresh flow
- **Token validation** (test de connexion) — V2, on fait confiance au user pour coller le bon token

## 8. Securite

| Aspect | Mesure |
|--------|--------|
| Stockage token | AES-256-GCM, cle dans `MNM_SECRETS_KEY` env var |
| Token en transit | HTTPS only, jamais en clair dans les logs |
| RLS | `tenant_isolation` policy sur `user_credentials` |
| Audit | Chaque store/revoke/decrypt_failure → `audit_events` |
| Injection Docker | Token passe en env var au `docker exec`, jamais ecrit sur le filesystem sandbox |
| configJson | JAMAIS de token dans `config_layer_items.configJson` — uniquement dans `user_credentials.material` |
| UI | Token masque (type=password), jamais retourne par l'API (material n'est pas dans le GET) |

## 9. Criteres d'acceptance globaux

- [ ] `user_mcp_credentials` renommee en `user_credentials` (migration + schema + code)
- [ ] Tous les prefixes `Mcp`/`mcp` supprimes du systeme de credentials
- [ ] Nouveau provider type `'pat'` fonctionne
- [ ] `CONFIG_LAYER_ITEM_TYPES` inclut `'git_provider'`
- [ ] Onglet "Git Providers" visible dans le LayerEditor
- [ ] On peut ajouter un git provider (host + PAT) et le voir dans la liste
- [ ] Le credential est stocke chiffre et revocable
- [ ] Detection automatique du provider (icone + label) depuis une URL
- [ ] Workspace UI accepte n'importe quelle URL git avec icone dynamique
- [ ] L'agent dans Docker recoit le token git via env var
- [ ] Les credentials MCP existants continuent de fonctionner apres migration
- [ ] `bun run typecheck` passe (13/13)
- [ ] `bun run build` passe

## 10. Risques

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Migration rename casse les credentials existants | Haut | Faible | Migration SQL simple (ALTER TABLE RENAME), pas de perte de donnees. Tester en staging d'abord |
| Renaming massif introduit des regressions | Moyen | Moyen | Faire le rename en une seule story atomique par couche (DB, shared, backend, routes, UI), typecheck a chaque etape |
| Token git mal injecte dans Docker | Haut | Faible | Tests d'integration dans le heartbeat, verifier que l'env var arrive bien dans le container |
| Provider detection incorrecte | Faible | Faible | Table KNOWN_HOSTS + fallback `generic` — le pire cas c'est une icone generique au lieu de la bonne |
| Backward compat routes `/mcp-credentials` | Moyen | Faible | 301 redirect temporaire, suppression planifiee en V2 |

## 11. Estimation

| Phase | Stories | Estimation |
|-------|---------|------------|
| Phase 1 : Credential Store generique | 5 stories | ~3-4j |
| Phase 2 : Git Provider config layers | 4 stories | ~3-4j |
| Phase 3 : Integration runtime + workspace UI | 3 stories | ~2-3j |
| **Total** | **12 stories** | **~8-11j** |

---

*Generated by BMAD Method v6 — Product Manager*
