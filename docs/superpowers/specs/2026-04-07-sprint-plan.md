# Sprint Plan — Universal Git Provider + Generic Credential Store

**Date:** 2026-04-07
**PM Lead:** Agent PM
**Ref:** `2026-04-07-universal-git-credentials-design.md` (tech-spec), `2026-04-07-architecture-blueprint.md` (archi), `2026-04-07-ux-design-blueprint.md` (UX)
**Total:** 12 stories, 3 phases, ~8-11j

---

## Graph de dependances (DAG)

```
Phase 1 (sequentielle stricte) :

1.1 (DB migration) → 1.2 (shared types + git-provider utils) → 1.3 (backend services rename)
                                                                         ↓
                                                               1.4 (routes API rename) → 1.5 (UI rename)

Phase 2 (partiellement parallelisable, apres 1.3+ done) :

1.2 + 1.3 → 2.1 (runtime git_provider)
1.2       → 2.4 (GitProviderIcon)         ← parallelisable avec 2.1
1.2 + 1.5 → 2.3 (UI onglet git providers) ← depend de 2.4
1.2       → 2.2 (git provider detection)  ← deja inclus dans 1.2, validation via tests

Phase 3 (apres Phase 2) :

2.1                → 3.1 (credential injection runtime) ← deja inclus dans 2.1
2.1                → 3.2 (heartbeat git token injection)
2.4                → 3.3 (workspace UI universelle)

Parallelisable dans Phase 2 : 2.1 || 2.4
Parallelisable dans Phase 3 : 3.2 || 3.3
```

---

## Phase 1 — Credential Store generique (fondation)

> **Regle:** Stories 1.1→1.5 sont SEQUENTIELLES. Chaque story depend de la precedente.
> Aucune parallelisation possible dans cette phase.

---

### Story 1.1 — Migration DB : rename table + extend provider

**Priorite:** P0
**Dependances:** Aucune (point de depart)
**Fichiers a modifier:**
- `packages/db/src/migrations/0061_rename_user_credentials.sql` (NOUVEAU)
- `packages/db/src/schema/user_mcp_credentials.ts` (RENAME → `user_credentials.ts`)
- `packages/db/src/schema/index.ts`
**Estimation:** XS

#### Taches detaillees

1. [ ] Creer la migration SQL `0061_rename_user_credentials.sql`
   - Fichier: `packages/db/src/migrations/0061_rename_user_credentials.sql`
   - Action: create
   - Detail:
     ```sql
     ALTER TABLE user_mcp_credentials RENAME TO user_credentials;
     ALTER INDEX user_mcp_credentials_user_company_item_uq RENAME TO user_credentials_user_company_item_uq;
     ALTER INDEX user_mcp_credentials_user_company_idx RENAME TO user_credentials_user_company_idx;
     ALTER INDEX user_mcp_credentials_expiring_idx RENAME TO user_credentials_expiring_idx;
     ALTER TABLE user_credentials DROP CONSTRAINT IF EXISTS user_mcp_credentials_provider_check;
     ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_provider_check
       CHECK (provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom'));
     ```

2. [ ] Renommer le fichier schema Drizzle
   - Fichier: `packages/db/src/schema/user_mcp_credentials.ts` → `packages/db/src/schema/user_credentials.ts`
   - Action: rename (git mv)

3. [ ] Modifier le contenu du schema Drizzle renomme
   - Fichier: `packages/db/src/schema/user_credentials.ts`
   - Action: modify
   - Detail:
     - Ligne 13: `export const userMcpCredentials = pgTable("user_mcp_credentials",` → `export const userCredentials = pgTable("user_credentials",`
     - Lignes 30-35: renommer les index inline:
       - `"user_mcp_credentials_user_company_item_uq"` → `"user_credentials_user_company_item_uq"`
       - `"user_mcp_credentials_user_company_idx"` → `"user_credentials_user_company_idx"`
       - `"user_mcp_credentials_expiring_idx"` → `"user_credentials_expiring_idx"`

4. [ ] Mettre a jour l'export barrel du schema
   - Fichier: `packages/db/src/schema/index.ts`
   - Action: modify
   - Detail: Ligne 82: `export { userMcpCredentials } from "./user_mcp_credentials.js";` → `export { userCredentials } from "./user_credentials.js";`

5. [ ] Verifier typecheck
   - Action: run `bun run typecheck`
   - Note: VA ECHOUER car les consommateurs de `userMcpCredentials` ne sont pas encore mis a jour. C'est attendu — la story 1.2 corrige ca.

#### Definition of Done
- [ ] Migration `0061` creee et syntaxiquement correcte
- [ ] Fichier schema renomme et contenu mis a jour
- [ ] Export barrel mis a jour
- [ ] `bun run typecheck` du package `@mnm/db` passe (les autres packages echoueront jusqu'a story 1.2+)

---

### Story 1.2 — Rename types & constantes (shared) + git-provider utils

**Priorite:** P0
**Dependances:** Story 1.1
**Fichiers a modifier:**
- `packages/shared/src/validators/config-layer.ts`
- `packages/shared/src/validators/index.ts`
- `packages/shared/src/types/config-layer.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/utils/git-provider.ts` (NOUVEAU)
**Estimation:** M

#### Taches detaillees

1. [ ] Ajouter `'git_provider'` a `CONFIG_LAYER_ITEM_TYPES`
   - Fichier: `packages/shared/src/validators/config-layer.ts`
   - Action: modify
   - Detail: Ligne 5: `["mcp", "skill", "hook", "setting"]` → `["mcp", "skill", "hook", "setting", "git_provider"]`

2. [ ] Renommer les constantes de credentials + ajout `'pat'`
   - Fichier: `packages/shared/src/validators/config-layer.ts`
   - Action: modify
   - Detail: Lignes 17-29:
     - `MCP_CREDENTIAL_PROVIDERS` → `CREDENTIAL_PROVIDERS` (+ ajout `"pat"`)
     - `MCP_CREDENTIAL_STATUSES` → `CREDENTIAL_STATUSES`
     - Ajouter backward-compat aliases: `export const MCP_CREDENTIAL_PROVIDERS = CREDENTIAL_PROVIDERS;` et `export const MCP_CREDENTIAL_STATUSES = CREDENTIAL_STATUSES;`

3. [ ] Ajouter le schema Zod `gitProviderItemConfigSchema`
   - Fichier: `packages/shared/src/validators/config-layer.ts`
   - Action: modify
   - Detail: Apres `settingItemConfigSchema` (~ligne 141), ajouter:
     ```typescript
     export const gitProviderItemConfigSchema = z.object({
       host: z.string().min(1),
       providerType: z.enum(["github", "gitlab", "bitbucket", "gitea", "azure_devops", "generic"]).default("generic"),
       apiUrl: z.string().url().optional().nullable(),
     });
     export type GitProviderItemConfig = z.infer<typeof gitProviderItemConfigSchema>;
     ```

4. [ ] Mettre a jour les re-exports du validators barrel
   - Fichier: `packages/shared/src/validators/index.ts`
   - Action: modify
   - Detail: Lignes 346-380: ajouter `CREDENTIAL_PROVIDERS`, `CREDENTIAL_STATUSES`, `gitProviderItemConfigSchema`, `type GitProviderItemConfig`. Garder les anciens aliases `MCP_CREDENTIAL_PROVIDERS`, `MCP_CREDENTIAL_STATUSES`.

5. [ ] Renommer les types dans config-layer.ts (shared types)
   - Fichier: `packages/shared/src/types/config-layer.ts`
   - Action: modify
   - Detail:
     - Lignes 1-8: mettre a jour les imports (`CREDENTIAL_PROVIDERS`, `CREDENTIAL_STATUSES`)
     - Lignes 16-17: `McpCredentialProvider` → `CredentialProvider`, `McpCredentialStatus` → `CredentialStatus` + aliases backward-compat
     - Lignes 133-144: ajouter interface `UserCredential` + alias `UserMcpCredential = UserCredential`
     - Fin de fichier: ajouter interface `ResolvedGitProvider { name, host, providerType, token? }`

6. [ ] Mettre a jour les re-exports du types barrel
   - Fichier: `packages/shared/src/types/index.ts`
   - Action: modify
   - Detail: Ajouter exports `CredentialProvider`, `CredentialStatus`, `UserCredential`, `ResolvedGitProvider`. Garder les anciens aliases.

7. [ ] Creer le module `git-provider.ts` (utils)
   - Fichier: `packages/shared/src/utils/git-provider.ts`
   - Action: create
   - Detail: Code complet du blueprint archi:
     - Types: `GitProviderType`, `DetectedGitProvider`
     - Constantes: `KNOWN_HOSTS`, `PROVIDER_LABELS`
     - Fonctions: `detectGitProvider(urlOrHost)`, `parseRepoUrl(url)`, `sanitizeEnvKey(host)`

8. [ ] Mettre a jour le barrel principal shared
   - Fichier: `packages/shared/src/index.ts`
   - Action: modify
   - Detail:
     - Lignes 326-327: ajouter exports types (`CredentialProvider`, `CredentialStatus`, `UserCredential`, `ResolvedGitProvider`)
     - Lignes 399-410: ajouter exports constantes (`CREDENTIAL_PROVIDERS`, `CREDENTIAL_STATUSES`)
     - Ajouter: `export { detectGitProvider, parseRepoUrl, sanitizeEnvKey } from "./utils/git-provider.js";`
     - Ajouter: `export type { GitProviderType, DetectedGitProvider } from "./utils/git-provider.js";`

9. [ ] Verifier typecheck
   - Action: run `bun run typecheck`
   - Note: Le package `@mnm/shared` doit passer. Les packages server/ui echoueront encore (references a `userMcpCredentials` dans services).

#### Definition of Done
- [ ] `CONFIG_LAYER_ITEM_TYPES` inclut `'git_provider'`
- [ ] `CREDENTIAL_PROVIDERS` inclut `'pat'`
- [ ] `gitProviderItemConfigSchema` defini et exporte
- [ ] Types `CredentialProvider`, `CredentialStatus`, `UserCredential`, `ResolvedGitProvider` exportes
- [ ] Backward-compat aliases en place pour `McpCredentialProvider`, `McpCredentialStatus`, `UserMcpCredential`, `MCP_CREDENTIAL_PROVIDERS`, `MCP_CREDENTIAL_STATUSES`
- [ ] `git-provider.ts` cree avec `detectGitProvider`, `parseRepoUrl`, `sanitizeEnvKey`
- [ ] `bun run typecheck` — package `@mnm/shared` passe

---

### Story 1.3 — Rename services backend

**Priorite:** P0
**Dependances:** Story 1.2
**Fichiers a modifier:**
- `server/src/services/mcp-credential.ts` (RENAME → `credential.ts`)
- `server/src/services/mcp-oauth.ts` (RENAME → `oauth.ts`)
- `server/src/services/config-layer-runtime.ts`
- `server/src/services/index.ts`
**Estimation:** S

#### Taches detaillees

1. [ ] Renommer le fichier mcp-credential.ts
   - Fichier: `server/src/services/mcp-credential.ts` → `server/src/services/credential.ts`
   - Action: rename (git mv)

2. [ ] Modifier le contenu de credential.ts
   - Fichier: `server/src/services/credential.ts`
   - Action: modify
   - Detail:
     - Ligne 4: `import { userMcpCredentials } from "@mnm/db";` → `import { userCredentials } from "@mnm/db";`
     - Ligne 28: `"[mcp-credential]"` → `"[credential]"` (toutes les occurrences)
     - Ligne 58: `export function mcpCredentialService(db: Db)` → `export function credentialService(db: Db)`
     - Toutes references `userMcpCredentials` → `userCredentials` (lignes 76-79, 89-96, 105-113, 127-137, 169-187, 199-208, 213-219, 248-257)
     - Strings audit: `"mcp_credential.stored"` → `"credential.stored"`, `"mcp_credential.decrypt_failed"` → `"credential.decrypt_failed"`, `"mcp_credential.revoked"` → `"credential.revoked"`, `targetType: "mcp_credential"` → `targetType: "credential"`

3. [ ] Renommer le fichier mcp-oauth.ts
   - Fichier: `server/src/services/mcp-oauth.ts` → `server/src/services/oauth.ts`
   - Action: rename (git mv)

4. [ ] Modifier le contenu de oauth.ts
   - Fichier: `server/src/services/oauth.ts`
   - Action: modify
   - Detail:
     - Ligne 6: `import { mcpCredentialService } from "./mcp-credential.js";` → `import { credentialService } from "./credential.js";`
     - Ligne 66: `export function mcpOauthService(db: Db) { const credSvc = mcpCredentialService(db);` → `export function oauthService(db: Db) { const credSvc = credentialService(db);`
     - Strings de log: `"[mcp-oauth]"` → `"[oauth]"`

5. [ ] Mettre a jour config-layer-runtime.ts
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail:
     - Ligne 4: `import { mcpCredentialService } from "./mcp-credential.js";` → `import { credentialService } from "./credential.js";`
     - Ligne 83: `const credSvc = mcpCredentialService(db);` → `const credSvc = credentialService(db);`

6. [ ] Mettre a jour le barrel des services
   - Fichier: `server/src/services/index.ts`
   - Action: modify
   - Detail: Lignes 81-83:
     ```typescript
     export { credentialService } from "./credential.js";
     export { oauthService } from "./oauth.js";
     // Backward-compat aliases (supprimer en V2)
     export { credentialService as mcpCredentialService } from "./credential.js";
     export { oauthService as mcpOauthService } from "./oauth.js";
     ```

7. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] Fichiers renommes (`credential.ts`, `oauth.ts`)
- [ ] Toutes references internes mises a jour
- [ ] Backward-compat aliases exportes depuis `services/index.ts`
- [ ] `bun run typecheck` passe

---

### Story 1.4 — Rename routes API + endpoint PAT

**Priorite:** P0
**Dependances:** Story 1.3
**Fichiers a modifier:**
- `server/src/routes/mcp-oauth.ts` (RENAME → `credentials.ts`)
- `server/src/app.ts`
**Estimation:** S

#### Taches detaillees

1. [ ] Renommer le fichier de routes
   - Fichier: `server/src/routes/mcp-oauth.ts` → `server/src/routes/credentials.ts`
   - Action: rename (git mv)

2. [ ] Modifier les imports dans credentials.ts
   - Fichier: `server/src/routes/credentials.ts`
   - Action: modify
   - Detail: Lignes 5-6:
     - `import { mcpCredentialService } from "../services/mcp-credential.js";` → `import { credentialService } from "../services/credential.js";`
     - `import { mcpOauthService } from "../services/mcp-oauth.js";` → `import { oauthService } from "../services/oauth.js";`

3. [ ] Renommer la fonction exportee + variables locales
   - Fichier: `server/src/routes/credentials.ts`
   - Action: modify
   - Detail: Ligne 9:
     - `export function mcpOauthRoutes(db: Db)` → `export function credentialRoutes(db: Db)`
     - `const credSvc = mcpCredentialService(db);` → `const credSvc = credentialService(db);`
     - `const oauthSvc = mcpOauthService(db);` → `const oauthSvc = oauthService(db);`

4. [ ] Renommer les paths des routes
   - Fichier: `server/src/routes/credentials.ts`
   - Action: modify
   - Detail:
     - GET: `/companies/:companyId/mcp-credentials` → `/companies/:companyId/credentials`
     - POST: `/companies/:companyId/mcp-credentials/:itemId/api-key` → `/companies/:companyId/credentials/:itemId/secret`
     - DELETE: `/companies/:companyId/mcp-credentials/:id` → `/companies/:companyId/credentials/:id`

5. [ ] Ajouter le nouvel endpoint POST PAT
   - Fichier: `server/src/routes/credentials.ts`
   - Action: modify
   - Detail: Ajouter apres le endpoint `secret`:
     ```typescript
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

6. [ ] Ajouter les redirects 301 backward-compat
   - Fichier: `server/src/routes/credentials.ts`
   - Action: modify
   - Detail: Apres les routes principales, ajouter 3 redirects:
     - GET `/companies/:companyId/mcp-credentials` → 301 vers `/api/companies/:companyId/credentials`
     - POST `/companies/:companyId/mcp-credentials/:itemId/api-key` → 307 vers `/api/companies/:companyId/credentials/:itemId/secret`
     - DELETE `/companies/:companyId/mcp-credentials/:id` → 307 vers `/api/companies/:companyId/credentials/:id`

7. [ ] Mettre a jour app.ts
   - Fichier: `server/src/app.ts`
   - Action: modify
   - Detail:
     - Ligne 58: `import { mcpOauthRoutes } from "./routes/mcp-oauth.js";` → `import { credentialRoutes } from "./routes/credentials.js";`
     - Ligne 251: `api.use(mcpOauthRoutes(db));` → `api.use(credentialRoutes(db));`

8. [ ] Verifier typecheck + build
   - Action: run `bun run typecheck && bun run build`

#### Definition of Done
- [ ] Fichier route renomme
- [ ] 4 routes renommees (`GET /credentials`, `POST /credentials/:itemId/secret`, `POST /credentials/:itemId/pat`, `DELETE /credentials/:id`)
- [ ] Endpoint PAT fonctionne
- [ ] Redirects 301/307 backward-compat en place
- [ ] `app.ts` mis a jour
- [ ] `bun run typecheck` passe

---

### Story 1.5 — Rename composants UI

**Priorite:** P0
**Dependances:** Story 1.2 + Story 1.4
**Fichiers a modifier:**
- `ui/src/api/config-layers.ts`
- `ui/src/components/config-layers/McpOAuthConnectButton.tsx` (RENAME → `OAuthConnectButton.tsx`)
- `ui/src/components/config-layers/ApiKeyCredentialDialog.tsx` (RENAME → `CredentialDialog.tsx`)
- `ui/src/components/config-layers/LayerItemList.tsx`
**Estimation:** S

#### Taches detaillees

1. [ ] Mettre a jour l'API client config-layers.ts
   - Fichier: `ui/src/api/config-layers.ts`
   - Action: modify
   - Detail:
     - Ligne 8: `import type { ..., UserMcpCredential }` → `import type { ..., UserCredential, UserMcpCredential }`
     - Ligne 39: ajouter `export type CredentialStatus = ...` et alias `McpCredentialStatus`
     - Lignes 112-117: renommer les URLs:
       - `listCredentials`: `/mcp-credentials` → `/credentials`
       - `storeApiKey`: `/mcp-credentials/:itemId/api-key` → `/credentials/:itemId/secret`
       - `revokeCredential`: `/mcp-credentials/:id` → `/credentials/:id`
     - Ajouter: `storePat: (companyId, itemId, material) => api.post(.../credentials/:itemId/pat, { material })`

2. [ ] Renommer McpOAuthConnectButton.tsx
   - Fichier: `ui/src/components/config-layers/McpOAuthConnectButton.tsx` → `OAuthConnectButton.tsx`
   - Action: rename (git mv)

3. [ ] Modifier le contenu de OAuthConnectButton.tsx
   - Fichier: `ui/src/components/config-layers/OAuthConnectButton.tsx`
   - Action: modify
   - Detail:
     - Renommer export: `McpOAuthConnectButton` → `OAuthConnectButton`
     - Remplacer type: `McpCredentialStatus` → `CredentialStatus`

4. [ ] Renommer ApiKeyCredentialDialog.tsx
   - Fichier: `ui/src/components/config-layers/ApiKeyCredentialDialog.tsx` → `CredentialDialog.tsx`
   - Action: rename (git mv)

5. [ ] Modifier le contenu de CredentialDialog.tsx — generaliser pour MCP + git
   - Fichier: `ui/src/components/config-layers/CredentialDialog.tsx`
   - Action: modify
   - Detail:
     - Renommer export: `ApiKeyCredentialDialog` → `CredentialDialog`
     - Ajouter prop `mode?: "mcp" | "git"` (default `"mcp"`)
     - Mode `"mcp"`: textarea KEY=VALUE (comportement actuel)
     - Mode `"git"`: input password unique "Personal Access Token"
     - `mutationFn`: si mode `"git"` → appeler `configLayersApi.storePat()`, sinon `configLayersApi.storeApiKey()`
     - Code complet fourni dans le blueprint UX section 3

6. [ ] Mettre a jour les imports dans LayerItemList.tsx
   - Fichier: `ui/src/components/config-layers/LayerItemList.tsx`
   - Action: modify
   - Detail:
     - Ligne 17: `import { McpOAuthConnectButton }` → `import { OAuthConnectButton }`
     - Ligne 18: `import { ApiKeyCredentialDialog }` → `import { CredentialDialog }`
     - Ligne 4: `type UserMcpCredential, type McpCredentialStatus` → `type UserCredential, type CredentialStatus`
     - Renommer les usages dans le JSX: `<McpOAuthConnectButton>` → `<OAuthConnectButton>`, `<ApiKeyCredentialDialog>` → `<CredentialDialog>`

7. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] Fichiers UI renommes (`OAuthConnectButton.tsx`, `CredentialDialog.tsx`)
- [ ] API client utilise les nouvelles URLs `/credentials`
- [ ] `storePat` ajoute a l'API client
- [ ] `CredentialDialog` supporte mode `"mcp"` et `"git"`
- [ ] `LayerItemList.tsx` imports mis a jour
- [ ] UI config layers MCP fonctionne comme avant (pas de regression)
- [ ] `bun run typecheck` passe (13/13)

---

### Commit Phase 1
- [ ] `git add -A && git commit -m "feat(credentials): rename mcp-credentials to generic credential store + add PAT provider" && git push`

---

## Phase 2 — Git Provider dans Config Layers

> **Parallelisation possible:** Stories 2.1 et 2.4 peuvent etre faites en parallele.
> Story 2.2 (detection) est deja incluse dans 1.2 (`git-provider.ts`).
> Story 2.3 depend de 2.4 (GitProviderIcon).

---

### Story 2.1 — Item type `git_provider` dans le runtime backend

**Priorite:** P0
**Dependances:** Story 1.2 + Story 1.3
**Fichiers a modifier:**
- `server/src/services/config-layer-runtime.ts`
**Estimation:** M

#### Taches detaillees

1. [ ] Ajouter l'interface `ResolvedGitProvider` et etendre `ResolvedConfig`
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail: Apres l'interface `ResolvedConfig` (ligne 35-41):
     ```typescript
     export interface ResolvedGitProvider {
       name: string;
       host: string;
       providerType: string;
       token?: string;
     }
     ```
     Dans `ResolvedConfig`, ajouter: `gitProviders: ResolvedGitProvider[];`

2. [ ] Ajouter la declaration du tableau `gitProviders` dans `_resolve`
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail: Ligne 228-231: ajouter `const gitProviders: ResolvedGitProvider[] = [];`

3. [ ] Ajouter le case `git_provider` dans le switch
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail: Lignes 236-285, avant `default`:
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

4. [ ] Generaliser l'injection de credentials pour MCP + git_provider
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail: Section "Inject MCP credentials" (lignes 292-333):
     - `const mcpItemIds` → `const CREDENTIALED_ITEM_TYPES = ["mcp", "git_provider"];` + `credentialedItemIds` filtre les deux types
     - Garder la boucle existante pour MCP (env/headers)
     - Ajouter une boucle pour git_provider: si `material.token` est string, injecter dans `gitProviders[gpIdx].token`

5. [ ] Ajouter `gitProviders` au return statement
   - Fichier: `server/src/services/config-layer-runtime.ts`
   - Action: modify
   - Detail: Ligne 349: `return { mcpServers, skills, hooks, settings, gitProviders, warnings };`

6. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] `ResolvedGitProvider` interface definie et exportee
- [ ] `ResolvedConfig.gitProviders` existe
- [ ] Le runtime resout les items `git_provider` correctement
- [ ] Les credentials git sont injectees (tokens decryptes dans `ResolvedGitProvider.token`)
- [ ] `bun run typecheck` passe

---

### Story 2.2 — Git Provider detection (shared)

**Priorite:** P1
**Dependances:** Story 1.2 (deja implementee dans 1.2)
**Fichiers a modifier:** Aucun (deja fait dans Story 1.2, tache 7)
**Estimation:** XS (validation uniquement)

#### Taches detaillees

1. [ ] Valider manuellement la detection des providers
   - Action: test manuel (ou script temporaire)
   - Detail: Verifier que `detectGitProvider()` retourne correctement:
     - `"https://github.com/org/repo"` → `{ providerType: "github", host: "github.com", label: "GitHub" }`
     - `"https://gitlab.com/org/repo"` → `{ providerType: "gitlab", host: "gitlab.com", label: "GitLab" }`
     - `"https://gitlab.corp.com/org/repo"` → `{ providerType: "gitlab", label: "GitLab (self-hosted)" }`
     - `"https://bitbucket.org/org/repo"` → `{ providerType: "bitbucket" }`
     - `"https://dev.azure.com/org/project"` → `{ providerType: "azure_devops" }`
     - `"https://gitea.io/org/repo"` → `{ providerType: "gitea" }`
     - `"https://random.host.com/org/repo"` → `{ providerType: "generic" }`
     - `"git@github.com:org/repo.git"` → parseRepoUrl retourne `{ host: "github.com", owner: "org", repo: "repo" }`

#### Definition of Done
- [ ] Les 7+ cas de detection valides
- [ ] `parseRepoUrl` parse correctement les formats https:// et git@

---

### Story 2.3 — Onglet Git Providers (UI) + editeur + credentials generalisees

**Priorite:** P0
**Dependances:** Story 1.5 + Story 2.4
**Fichiers a modifier:**
- `ui/src/components/config-layers/LayerEditor.tsx`
- `ui/src/components/config-layers/LayerItemList.tsx`
- `ui/src/components/config-layers/GitProviderItemEditor.tsx` (NOUVEAU)
- `ui/src/components/config-layers/ItemCredentialActions.tsx` (NOUVEAU — extraction)
**Estimation:** L

#### Taches detaillees

1. [ ] Ajouter le tab `git_provider` dans LayerEditor.tsx
   - Fichier: `ui/src/components/config-layers/LayerEditor.tsx`
   - Action: modify
   - Detail: Lignes 14-19: ajouter `{ id: "git_provider", label: "Git Providers" }` en position 2 (apres MCP)

2. [ ] Ajouter le label `git_provider` dans ITEM_TYPE_LABELS
   - Fichier: `ui/src/components/config-layers/LayerItemList.tsx`
   - Action: modify
   - Detail: Lignes 58-63: ajouter `git_provider: "Git Provider"`

3. [ ] Creer le composant GitProviderItemEditor.tsx
   - Fichier: `ui/src/components/config-layers/GitProviderItemEditor.tsx`
   - Action: create
   - Detail: Formulaire avec:
     - Input "Repository URL or hostname" (onBlur → detectGitProvider)
     - Section "Provider detecte" (icone + label, visible si URL valide)
     - Boutons Save/Cancel
     - Code complet fourni dans le blueprint UX section 2

4. [ ] Ajouter le case `git_provider` dans le switch ItemEditor
   - Fichier: `ui/src/components/config-layers/LayerItemList.tsx`
   - Action: modify
   - Detail: Ajouter l'import de `GitProviderItemEditor` et le case:
     ```typescript
     case "git_provider":
       return <GitProviderItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
     ```

5. [ ] Generaliser le chargement des credentials au-dela de MCP
   - Fichier: `ui/src/components/config-layers/LayerItemList.tsx`
   - Action: modify
   - Detail: Lignes 108-113:
     - Ajouter `const CREDENTIALED_TYPES: ConfigLayerItemType[] = ["mcp", "git_provider"];`
     - `const needsCredentials = CREDENTIALED_TYPES.includes(itemType);`
     - `enabled: needsCredentials && !!companyId` (remplacer `isMcp`)

6. [ ] Creer le composant ItemCredentialActions.tsx (extraction)
   - Fichier: `ui/src/components/config-layers/ItemCredentialActions.tsx`
   - Action: create
   - Detail: Extraire le bloc credential de LayerItemList.tsx (lignes 277-333) en composant reutilisable.
     - Props: `item`, `companyId`, `credByItemId`, `readOnly`, `onOpenCredentialDialog`, `onRevoke`, `isRevoking`, `mode`
     - Mode `"mcp"`: bouton "Add/Update secrets" + OAuth + Revoke
     - Mode `"git"`: bouton "Add/Update token" + Revoke (pas d'OAuth)
     - Code complet fourni dans le blueprint UX section 4

7. [ ] Remplacer le bloc credential inline par ItemCredentialActions dans LayerItemList.tsx
   - Fichier: `ui/src/components/config-layers/LayerItemList.tsx`
   - Action: modify
   - Detail:
     - Remplacer le bloc `{isMcp && companyId && (...)}` par `{needsCredentials && companyId && (<ItemCredentialActions ... />)}`
     - Ajouter state `credDialogMode` pour passer le bon mode au CredentialDialog
     - Remplacer `<ApiKeyCredentialDialog>` par `<CredentialDialog mode={credDialogMode} />`

8. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] Tab "Git Providers" visible dans LayerEditor
- [ ] On peut ajouter/editer/supprimer un git provider dans l'UI
- [ ] Le credential est stocke via le CredentialDialog mode `"git"` (PAT)
- [ ] Les credentials MCP fonctionnent toujours (pas de regression)
- [ ] `bun run typecheck` passe

---

### Story 2.4 — Composant GitProviderIcon

**Priorite:** P1
**Dependances:** Story 1.2 (pour `GitProviderType` exporte depuis shared)
**Fichiers a modifier:**
- `ui/src/components/GitProviderIcon.tsx` (NOUVEAU)
**Estimation:** XS

> **Parallelisable avec Story 2.1**

#### Taches detaillees

1. [ ] Creer le composant GitProviderIcon.tsx
   - Fichier: `ui/src/components/GitProviderIcon.tsx`
   - Action: create
   - Detail: Code complet du blueprint archi:
     - SVG inline pour GitLab (24x24), Bitbucket (24x24), Azure DevOps (24x24)
     - Lucide natif pour GitHub (`Github`) et Generic (`GitBranch`)
     - Gitea fallback vers `GitBranch`
     - Map `PROVIDER_ICONS: Record<GitProviderType, React.FC<IconProps>>`
     - Export `GitProviderIcon({ provider, className })`

2. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] Composant cree et exporte
- [ ] Chaque provider affiche la bonne icone (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Generic)
- [ ] `bun run typecheck` passe

---

### Commit Phase 2
- [ ] `git add -A && git commit -m "feat(git-provider): add git_provider item type, UI tab, icon, and editor" && git push`

---

## Phase 3 — Integration runtime + workspace UI

> **Parallelisation possible:** Stories 3.2 et 3.3 peuvent etre faites en parallele.
> Story 3.1 est deja incluse dans Story 2.1 (credential injection).

---

### Story 3.1 — Credential injection dans config-layer-runtime

**Priorite:** P0
**Dependances:** Story 2.1 (deja implementee dans 2.1)
**Fichiers a modifier:** Aucun
**Estimation:** XS (validation uniquement)

#### Taches detaillees

1. [ ] Valider que `resolveForAgent()` retourne les git providers avec tokens decryptes
   - Action: test manuel (creer un item git_provider via API, stocker un credential PAT, appeler resolveForAgent)
   - Detail: Le resultat doit inclure `gitProviders: [{ name: "github.com", host: "github.com", providerType: "github", token: "ghp_xxx" }]`

#### Definition of Done
- [ ] `resolveForAgent()` retourne les tokens decryptes dans `gitProviders`

---

### Story 3.2 — Heartbeat git token injection

**Priorite:** P0
**Dependances:** Story 2.1
**Fichiers a modifier:**
- `packages/adapter-utils/src/types.ts`
- `packages/adapters/claude-local/src/server/execute.ts`
- `server/src/services/heartbeat.ts`
**Estimation:** M

#### Taches detaillees

1. [ ] Ajouter `gitProviders` au type `AdapterExecutionContext`
   - Fichier: `packages/adapter-utils/src/types.ts`
   - Action: modify
   - Detail: Ligne 86 (pres de `claudeOauthToken`): ajouter `gitProviders?: Array<{ host: string; token?: string }>;`

2. [ ] Ajouter `gitProviders` au type `ClaudeExecutionInput` dans execute.ts
   - Fichier: `packages/adapters/claude-local/src/server/execute.ts`
   - Action: modify
   - Detail: Dans l'interface `ClaudeExecutionInput`: ajouter `gitProviders?: Array<{ host: string; token?: string }>;`

3. [ ] Ajouter l'import de `parseRepoUrl` et `sanitizeEnvKey`
   - Fichier: `packages/adapters/claude-local/src/server/execute.ts`
   - Action: modify
   - Detail: `import { parseRepoUrl, sanitizeEnvKey } from "@mnm/shared";`

4. [ ] Ajouter l'injection des tokens git dans `buildClaudeRuntimeConfig`
   - Fichier: `packages/adapters/claude-local/src/server/execute.ts`
   - Action: modify
   - Detail: Apres la ligne 268 (injection env vars workspace):
     ```typescript
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

5. [ ] Passer les `gitProviders` resolus depuis heartbeat.ts vers l'adapter
   - Fichier: `server/src/services/heartbeat.ts`
   - Action: modify
   - Detail:
     - Apres `const layerConfig = await clRuntime.resolveConfigForRun(...)` (~ligne 1360): extraire `const resolvedGitProviders = layerConfig.gitProviders ?? [];`
     - Lors de l'appel a `adapter.execute(...)` (~ligne 1441): ajouter `gitProviders: resolvedGitProviders` dans l'objet d'input

6. [ ] Verifier typecheck
   - Action: run `bun run typecheck`

#### Definition of Done
- [ ] `AdapterExecutionContext` a le champ `gitProviders`
- [ ] L'adapter claude-local injecte `GIT_TOKEN_<HOST>` dans les env vars Docker
- [ ] Le heartbeat passe les git providers resolus a l'adapter
- [ ] `bun run typecheck` passe

---

### Story 3.3 — Workspace UI universelle (suppression hardcode GitHub)

**Priorite:** P1
**Dependances:** Story 2.4 (GitProviderIcon)
**Fichiers a modifier:**
- `ui/src/components/NewProjectDialog.tsx`
- `ui/src/components/ProjectProperties.tsx`
**Estimation:** S

> **Parallelisable avec Story 3.2**

#### Taches detaillees

1. [ ] Modifier les imports dans NewProjectDialog.tsx
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Supprimer `Github` de l'import lucide. Ajouter:
     ```typescript
     import { GitProviderIcon } from "./GitProviderIcon";
     import { detectGitProvider } from "@mnm/shared";
     ```

2. [ ] Remplacer `isGitHubRepoUrl` par `isGitUrl` dans NewProjectDialog.tsx
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Lignes 99-109: remplacer la validation GitHub-only par une validation generique qui accepte `https://`, `http://`, et `git@` avec au moins owner/repo dans le path.

3. [ ] Mettre a jour la validation dans `handleSubmit`
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Ligne 144: `isGitHubRepoUrl(repoUrl)` → `isGitUrl(repoUrl)`, message d'erreur generique

4. [ ] Mettre a jour `deriveWorkspaceNameFromRepo`
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Lignes 117-126: supporter le format `git@` en plus de `https://`, fallback "repo" au lieu de "GitHub repo"

5. [ ] Remplacer l'icone et le label du bouton "A github repo"
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Lignes 307-318:
     - `<Github className="h-4 w-4" />` → `<GitBranch className="h-4 w-4" />` (ou `GitProviderIcon`)
     - `"A github repo"` → `"A git repo"`
     - `"Paste a GitHub URL."` → `"Paste any git URL."`

6. [ ] Mettre a jour le placeholder et le label du champ URL
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail:
     - Ligne 350: `"GitHub repo URL"` → `"Git repo URL"`
     - Ligne 354: `placeholder="https://github.com/org/repo"` → `placeholder="https://github.com/org/repo ou https://gitlab.com/org/repo"`

7. [ ] Ajouter un apercu du provider detecte sous le champ URL
   - Fichier: `ui/src/components/NewProjectDialog.tsx`
   - Action: modify
   - Detail: Apres le `<input>` du repo URL, ajouter:
     ```tsx
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

8. [ ] Appliquer les memes changements a ProjectProperties.tsx
   - Fichier: `ui/src/components/ProjectProperties.tsx`
   - Action: modify
   - Detail:
     - Ligne 17: supprimer `Github` de l'import lucide, ajouter `GitBranch`. Ajouter imports `GitProviderIcon` et `detectGitProvider`.
     - Lignes 170-180: remplacer `isGitHubRepoUrl` par `isGitUrl`
     - Lignes 226-231: mettre a jour la validation et le message d'erreur
     - Lignes 408-419: remplacer `<Github className="h-3 w-3 shrink-0" />` par `<GitProviderIcon provider={detectGitProvider(workspace.repoUrl).providerType} className="h-3 w-3 shrink-0" />`
     - Ligne 499: placeholder generique

9. [ ] Verifier typecheck + build
   - Action: run `bun run typecheck && bun run build`

#### Definition of Done
- [ ] Plus aucune reference a "GitHub" hardcode dans NewProjectDialog et ProjectProperties
- [ ] On peut ajouter un repo GitLab/Bitbucket/self-hosted/Azure DevOps
- [ ] L'icone s'adapte dynamiquement au provider detecte
- [ ] Placeholder et labels generiques
- [ ] `bun run typecheck` passe
- [ ] `bun run build` passe

---

### Commit Phase 3
- [ ] `git add -A && git commit -m "feat(git-provider): heartbeat token injection + universal workspace UI" && git push`

---

## Verification finale

### Criteres d'acceptance globaux

- [ ] `user_mcp_credentials` renommee en `user_credentials` (migration + schema + code)
- [ ] Tous les prefixes `Mcp`/`mcp` supprimes du systeme de credentials (aliases backward-compat en place)
- [ ] Nouveau provider type `'pat'` fonctionne
- [ ] `CONFIG_LAYER_ITEM_TYPES` inclut `'git_provider'`
- [ ] Onglet "Git Providers" visible dans le LayerEditor
- [ ] On peut ajouter un git provider (host + PAT) et le voir dans la liste
- [ ] Le credential est stocke chiffre et revocable
- [ ] Detection automatique du provider (icone + label) depuis une URL
- [ ] Workspace UI accepte n'importe quelle URL git avec icone dynamique
- [ ] L'agent dans Docker recoit le token git via env var `GIT_TOKEN_<HOST>`
- [ ] Les credentials MCP existants continuent de fonctionner apres migration
- [ ] `bun run typecheck` passe (13/13)
- [ ] `bun run build` passe

### Taches de verification finale

1. [ ] Run `bun run typecheck` (13/13 packages)
2. [ ] Run `bun run build`
3. [ ] Demarrer le serveur (`bun run dev`) et verifier qu'il boot sans erreur
4. [ ] Test manuel: creer un git provider dans l'UI, stocker un PAT, verifier dans la liste
5. [ ] Test manuel: creer un projet avec un repo GitLab, verifier l'icone dynamique
6. [ ] Test manuel: verifier que les credentials MCP existants fonctionnent toujours

---

## Resume des estimations

| Phase | Stories | Estimation | Parallelisable |
|-------|---------|------------|----------------|
| Phase 1 : Credential Store generique | 1.1, 1.2, 1.3, 1.4, 1.5 | ~3-4j | Non (sequentiel strict) |
| Phase 2 : Git Provider config layers | 2.1, 2.2, 2.3, 2.4 | ~3-4j | 2.1 ∥ 2.4 |
| Phase 3 : Integration runtime + workspace UI | 3.1, 3.2, 3.3 | ~2-3j | 3.2 ∥ 3.3 |
| **Total** | **12 stories** | **~8-11j** | |

---

*Generated by PM Lead Agent — Sprint plan pret pour implementation*
