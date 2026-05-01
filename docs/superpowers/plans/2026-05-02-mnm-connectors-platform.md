# MnM Connectors Platform — Hub d'identité OAuth user-level pour tout le système

> **Pour les agents :** SUB-SKILL REQUIS — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. Tâches en checkbox `- [ ]`.

**Goal :** transformer MnM en hub d'identité OAuth user-level. Aujourd'hui seuls GitLab + Microsoft sont supportés (statique, env vars). Demain : un admin company configure n'importe quel connecteur (Jira, ClickUp, Slack, GitHub, Google, Linear, Notion, OpenAI API key, ...) via UI, et tout le système (hooks, agents Claude Code via MCP, futurs jobs Nightly Synthesis) peut consulter les tokens user pour agir au nom de l'utilisateur — invariant traçabilité humaine [`decision-log.md` §1.7](../../decision-log.md).

**Branche :** `feat/connectors-platform`. Atomic commit + push par task (CLAUDE.md).

**Préalable obligatoire pour :** [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](2026-05-01-enterprise-pilot-foundation.md) — les hooks Jira/ClickUp en dépendent. Plan à shipper AVANT le plan Hooks.

---

## Pourquoi maintenant (vs hardcoder Jira/ClickUp)

L'invariant §1.7 (traçabilité humaine universelle) impose qu'un hook agisse avec le token OAuth du user qui a triggered le run. Premier pilote enterprise = use-case immédiat (Jira+ClickUp). Mais les vrais use-cases derrière sont multiples :

- **Hooks** : `helpers.http({provider:"jira"})` → token user
- **Agents Claude Code via MCP** : un agent du user lance un GET Calendar Google avec son token user
- **Background jobs** : Nightly Synthesis poste un rapport dans Slack du user
- **Workflows steps** : "publish to Notion" sait quel token user utiliser

Hardcoder Jira+ClickUp dans BetterAuth comme on a fait pour GitLab = 2j de dette technique × N futurs connecteurs. Le pattern Connectors paye dès le 3e provider.

---

## Décisions arrêtées

1. **BetterAuth Generic OAuth Plugin** pour les flows OAuth 2.0 (réutilise machinerie session, account linking, token refresh). Fork minimal du config statique vers une **registry dynamique** rebuilt à chaud quand un admin créé/modifie un connecteur.

2. **2 types de credentials supportés V0** :
   - **OAuth 2.0 / OIDC** (Jira, GitLab, GitHub, Microsoft, Google, Slack, Linear, Notion, ClickUp, ...) — flow standard authorize/callback, refresh_token si fourni, tokens dans `account` BetterAuth.
   - **API Key seul** (OpenAI, Anthropic, Stripe, SendGrid, Twilio, ...) — pas de flow OAuth, juste un input chiffré stocké dans `user_api_keys` (nouvelle table).

   OAuth 1.0a (Twitter legacy) **out of scope V0**.

3. **Multi-tenant : connecteur configuré par company.** Chaque company a son propre client_id/client_secret pour un provider donné (ex: une company configure Jira avec ses propres OAuth app credentials). Permet à 2 companies d'utiliser Jira indépendamment, avec leurs propres apps OAuth — propre mais nécessite l'admin de créer une OAuth app par provider. Pas de shared platform-level provider en V0.

4. **Storage `client_secret` via Config Layer** (existant, AES-256-GCM, advisory locks pour concurrent updates). Nouvelle colonne `client_secret_layer_id` dans `oauth_connectors`. Pattern cohérent avec les autres credentials du système.

5. **Storage tokens user** : OAuth tokens vivent dans `account` (BetterAuth, déjà chiffré at-rest si Postgres pgcrypto activé), API keys vivent dans `user_api_keys` (nouvelle table, chiffrée via Config Layer pattern).

6. **Hot-reload BetterAuth instance** quand un admin créé/édite/désactive un connecteur. Pattern : la fonction `createBetterAuthInstance` reconstruit l'instance au prochain request, lookup les `oauth_connectors enabled=true` du company actor + injecte dans `socialProviders` via Generic OAuth.

7. **Conventions de nommage providers** : slug kebab-case (`jira`, `clickup`, `microsoft`, `gitlab-self-hosted`, `google-workspace`). Une company peut avoir 2 connecteurs avec des slugs différents pour le même service (ex: `gitlab-internal` + `gitlab-public`).

8. **Templates de connecteurs prédéfinis** : pour les 10 providers majeurs (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI), ship un template prédéfini avec authorization_url/token_url/scopes pré-remplis. L'admin n'a qu'à coller son client_id/client_secret. Nouveau provider non-listé → mode "Custom" où l'admin remplit tout.

9. **Helper centralisé `getUserToken(userId, providerSlug, companyId)`** dans `server/src/services/connectors.ts`. Toute feature (hooks, agents, jobs, MCP tools) doit passer par ce helper, jamais lire `account` directement. Permet d'auditer les usages, de gérer le refresh, de logguer les access.

10. **Refresh automatique** : si le token a expiré et qu'un `refresh_token` est dispo, `getUserToken` refresh transparent et update `account`. Si refresh fail (token révoqué côté provider) → throw `CONNECTOR_TOKEN_REVOKED`, le caller catch et redirige le user vers re-connecter son compte.

11. **Audit log** sur toutes les opérations (`oauth_connectors_audit`) : créations, modifications, désactivations, premier connect d'un user, déconnexion d'un user, refresh failed, token utilisé (rate sampled — 1/100 pour ne pas exploser le volume).

12. **Pas d'API "user-impersonation par admin"** : un admin ne peut PAS utiliser le token d'un autre user, même en tant qu'admin. Si un user est OOO et qu'on a besoin de ses tokens, le pattern correct est : (1) demander au user de re-déléguer via OAuth dual-grant, ou (2) configurer un service account dédié hors du système Connectors (tier 3 enforced exception).

13. **UI admin "Connecteurs"** : page `ui/src/pages/Connectors.tsx` (route `/companies/:companyId/connectors` côté API REST, mais UI route `/connectors` selon la convention frontend §4 — pas scopée companyId dans l'URL UI).

14. **UI user "Mes comptes connectés"** : page `ui/src/pages/UserAccounts.tsx` (route `/settings/accounts`). Liste les connecteurs disponibles, statut (connecté/non-connecté/expiré/révoqué), bouton connect/disconnect/reconnect. Étend `UserProfile.tsx` existant (route `/settings/profile`).

15. **MCP tools `list_connectors`, `get_connector_status`, `connect_user_to_connector` (return URL)** : permet à un agent Claude Code d'aider l'user à se connecter (ex: agent dit "tu n'as pas connecté Jira, voici le lien à cliquer").

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         oauth_connectors (NEW)                                │
│  Per-company OAuth connector configs (admin-managed)                         │
│  client_id, client_secret_layer_id, scopes, urls, type=oauth2|api_key        │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           BetterAuth instance (rebuilt on connector change)                  │
│  socialProviders dynamiquement enrichis depuis oauth_connectors              │
│  Generic OAuth Plugin pour providers non-natifs                              │
└─────────────────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│   account (BetterAuth)      │      │  user_api_keys (NEW)             │
│   user_id, provider_id,     │      │  user_id, provider_id, key_layer │
│   access_token, refresh,    │      │  encrypted, last_used_at         │
│   expires_at                │      │                                   │
└─────────────────────────────┘      └──────────────────────────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             getUserToken(userId, providerSlug, companyId)                    │
│  - Lookup oauth_connector (active for company)                               │
│  - Lookup account (or user_api_keys if api_key type)                         │
│  - If expired + refresh_token → refresh + update                             │
│  - If revoked → throw CONNECTOR_TOKEN_REVOKED                                │
│  - Audit row sampled 1/100                                                   │
│  - Return { access_token, expires_at, scopes }                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │                          │                         │
            ▼                          ▼                         ▼
   ┌────────────────┐       ┌─────────────────┐         ┌────────────────┐
   │  Hooks         │       │  MCP tools      │         │  Workflows     │
   │  helpers.http  │       │  agent actions  │         │  workflow steps│
   └────────────────┘       └─────────────────┘         └────────────────┘
```

---

## File Map

### Created

**DB :**
- `packages/db/src/migrations/0078_connectors_platform.sql` + `.test.ts`
- `packages/db/src/schema/oauth_connectors.ts`
- `packages/db/src/schema/user_api_keys.ts`
- `packages/db/src/schema/oauth_connectors_audit.ts`

**Server :**
- `server/src/services/connectors.ts` — `getUserToken`, `listConnectors`, `createConnector`, `updateConnector`, `deleteConnector`, `connectUser`, `disconnectUser`, refresh logic
- `server/src/services/__tests__/connectors.test.ts`
- `server/src/services/connectors-templates.ts` — 10 templates Jira/GitHub/GitLab/Microsoft/Google/Slack/ClickUp/Linear/Notion/OpenAI
- `server/src/services/__tests__/connectors-templates.test.ts`
- `server/src/auth/dynamic-providers.ts` — résout les providers BetterAuth depuis `oauth_connectors`
- `server/src/auth/__tests__/dynamic-providers.test.ts`
- `server/src/routes/connectors.ts` — REST CRUD admin + endpoints user connect/disconnect
- `server/src/routes/connectors-callback.ts` — OAuth callback dispatcher
- `server/src/mcp/tools/connectors.tool.ts` — tools MCP

**UI :**
- `ui/src/pages/Connectors.tsx` — admin page (liste + création depuis template ou custom)
- `ui/src/pages/ConnectorDetail.tsx` — détail config + audit log
- `ui/src/pages/UserAccounts.tsx` — user page "Mes comptes connectés"
- `ui/src/api/connectors.ts`
- `ui/src/components/connectors/ConnectorTemplateCard.tsx` — card pour chaque template prédéfini
- `ui/src/components/connectors/ConnectorStatusBadge.tsx` — badge connecté/expiré/révoqué/non-connecté

### Modified

- `server/src/auth/better-auth.ts` — `createBetterAuthInstance` accepte un `dynamicProviders[]` argument résolu par `dynamic-providers.ts`. Hot-reload sur connector change via SSE event `connector.updated` qui invalide le cached instance.
- `packages/db/src/schema/auth.ts` — ajouter index sur `account(user_id, provider_id)` pour lookups rapides depuis `getUserToken`.
- `server/src/services/governed-workflows.ts` — `resolveAuthor()` consume le helper `getUserToken("gitlab")` au lieu du fallback `process.env.GITLAB_PAT`. Backward compat : si pas de connecteur enabled → fallback PAT (pour migration).
- `ui/src/App.tsx` — routes `/connectors`, `/connectors/:id`, `/settings/accounts` (companyId via context, pas dans l'URL UI — rule frontend.md §4).
- `ui/src/pages/UserProfile.tsx` — section "Mes comptes connectés" qui link vers `/settings/accounts`.
- `ui/src/lib/queryKeys.ts` — `connectors`, `userAccounts`.
- `scripts/parity/data.ts` — entries `connectors-admin`, `connectors-user`.

### NOT Modified

- BetterAuth core lui-même — on n'utilise que les API publiques (Generic OAuth Plugin existant). Pas de patch upstream.

---

## Sprint structure

| Sprint | Durée | Tasks | Parallélisation |
|---|---|---|---|
| **Sprint 1** | 4j | T1 (DB) → T2 (service) → T3 (BetterAuth dyn providers) → T4 (API keys path) | 1 dev |
| **Sprint 2** | 4j | T5 (REST/MCP) ‖ T6 (UI admin) ‖ T7 (UI user) ‖ T8 (templates + helper + tests + parity) | 2-3 devs |

**Total : 8j (1 dev) / ~5j (2 devs)**.

---

## Task 1 — Schema DB + migration (~0.5j)

**Files :**
- Create : `packages/db/src/migrations/0078_connectors_platform.sql` + `.test.ts`
- Create : 3 schemas Drizzle
- Modify : `packages/db/src/schema/auth.ts` (ajout index)

```sql
-- 0078_connectors_platform.sql

CREATE TABLE IF NOT EXISTS "oauth_connectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "provider_slug" text NOT NULL,                      -- "jira", "clickup", "gitlab-internal", ...
  "display_name" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('oauth2', 'api_key')),

  -- OAuth 2.0 fields (NULL pour type=api_key)
  "authorization_url" text,
  "token_url" text,
  "userinfo_url" text,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "redirect_uri" text,                                 -- résolu par défaut depuis publicUrl
  "client_id" text,
  "client_secret_layer_id" uuid REFERENCES "config_layers"("id") ON DELETE RESTRICT,
  "refresh_supported" boolean NOT NULL DEFAULT true,

  -- API Key fields (NULL pour type=oauth2)
  "api_key_label" text,                                -- "API Key", "Secret Key", custom label

  "enabled" boolean NOT NULL DEFAULT true,
  "created_by_principal_id" uuid NOT NULL REFERENCES "principals"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  UNIQUE ("company_id", "provider_slug"),
  CHECK (
    ("type" = 'oauth2' AND "authorization_url" IS NOT NULL AND "token_url" IS NOT NULL
      AND "client_id" IS NOT NULL AND "client_secret_layer_id" IS NOT NULL)
    OR
    ("type" = 'api_key' AND "api_key_label" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "oauth_connectors_company_enabled_idx"
  ON "oauth_connectors"("company_id", "enabled");
--> statement-breakpoint

ALTER TABLE "oauth_connectors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connectors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_connectors" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- API keys user-level (par user × company × provider)
CREATE TABLE IF NOT EXISTS "user_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "connector_id" uuid NOT NULL REFERENCES "oauth_connectors"("id") ON DELETE CASCADE,
  "key_layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE RESTRICT,
  "last_used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  UNIQUE ("user_id", "connector_id")
);
--> statement-breakpoint

ALTER TABLE "user_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_api_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_api_keys" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Audit log
CREATE TABLE IF NOT EXISTS "oauth_connectors_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "connector_id" uuid REFERENCES "oauth_connectors"("id") ON DELETE SET NULL,
  "actor_user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL CHECK ("action" IN (
    'connector_created','connector_updated','connector_deleted','connector_enabled','connector_disabled',
    'user_connected','user_disconnected','user_refresh_failed','user_token_revoked',
    'token_used'  -- sampled 1/100
  )),
  "diff_json" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "oauth_connectors_audit_company_action_idx"
  ON "oauth_connectors_audit"("company_id","action","created_at" DESC);
--> statement-breakpoint

ALTER TABLE "oauth_connectors_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connectors_audit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_connectors_audit" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Index sur account pour lookup rapide depuis getUserToken
CREATE INDEX IF NOT EXISTS "account_user_provider_idx"
  ON "account"("user_id", "provider_id");
--> statement-breakpoint

-- Permissions
INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, p.slug, p.description, 'connectors', false
FROM "companies" c
CROSS JOIN (VALUES
  ('connectors:manage',  'CRUD on OAuth connectors and API key connectors'),
  ('connectors:audit',   'Read audit log of connector changes')
) AS p(slug, description)
ON CONFLICT ("company_id", "slug") DO NOTHING;
--> statement-breakpoint
```

- [ ] **1.1 — Test migration** : 3 tables + RLS + 2 permissions seedées + index account.
- [ ] **1.2 — Schemas Drizzle** + index TS.
- [ ] **1.3 — Migration up + tests pass + commit + push**

---

## Task 2 — Service `connectors.ts` + OAuth flow handler (~1.5j)

**Files :**
- Create : `server/src/services/connectors.ts` + `__tests__/`
- Create : `server/src/routes/connectors-callback.ts`

### 2.1 — CRUD connecteurs

- [ ] **`createConnector(input, actor)`** : valide schema (oauth2 vs api_key shape), crée le `client_secret` dans Config Layer (chiffré), insert row, audit row.
- [ ] **`updateConnector`**, **`deleteConnector`**, **`enableConnector`**, **`disableConnector`** — patterns standards + audit.
- [ ] **`listConnectors(companyId)`** — liste avec status (combien d'users connectés, dernière utilisation).

### 2.2 — `getUserToken(userId, providerSlug, companyId)` — helper central

- [ ] **Test TDD** : retourne le token courant, refresh si expiré, throw `CONNECTOR_TOKEN_REVOKED` si refresh fail, throw `CONNECTOR_USER_NOT_CONNECTED` si pas d'account ou api_key, sample audit row 1/100.
- [ ] **Implémenter** :
  ```ts
  export async function getUserToken(
    userId: string,
    providerSlug: string,
    companyId: string,
  ): Promise<{ accessToken: string; expiresAt: Date | null; scopes: string[]; type: "oauth2"|"api_key" }> {
    const connector = await getActiveConnector(companyId, providerSlug);
    if (!connector) throw new Error("CONNECTOR_NOT_CONFIGURED");

    if (connector.type === "api_key") {
      const apiKey = await getUserApiKey(userId, connector.id);
      if (!apiKey) throw new Error("CONNECTOR_USER_NOT_CONNECTED");
      const decrypted = await configLayerService.decrypt(apiKey.keyLayerId);
      maybeAuditTokenUsed(connector.id, userId);
      return { accessToken: decrypted, expiresAt: null, scopes: [], type: "api_key" };
    }

    // oauth2
    const account = await getAccountForUserAndProvider(userId, providerSlug);
    if (!account) throw new Error("CONNECTOR_USER_NOT_CONNECTED");

    if (account.expiresAt && account.expiresAt < new Date()) {
      if (!account.refreshToken) throw new Error("CONNECTOR_TOKEN_EXPIRED_NO_REFRESH");
      const refreshed = await refreshOAuthToken(connector, account);
      if (!refreshed) throw new Error("CONNECTOR_TOKEN_REVOKED");
      account = refreshed;
    }
    maybeAuditTokenUsed(connector.id, userId);
    return { accessToken: account.accessToken, expiresAt: account.expiresAt, scopes: connector.scopes, type: "oauth2" };
  }
  ```

### 2.3 — `refreshOAuthToken(connector, account)` — refresh logic

- [ ] **Test TDD** : POST `connector.token_url` avec `grant_type=refresh_token + refresh_token + client_id + client_secret`, parse response, update `account`. Si 401 → audit `user_token_revoked` + return null.
- [ ] **Implémenter** standard OAuth 2.0 refresh.
- [ ] **Refresh tokens rotation** support (certains providers genre Microsoft retournent un nouveau refresh_token à chaque refresh — handle).

### 2.4 — OAuth callback dispatcher

- [ ] **Route `GET /api/connectors/callback`** : dispatcher générique pour tous les providers OAuth. Lit le `state` (signed JWT contenant companyId + connectorId + redirect_after), vérifie, échange code → token, crée/update `account`, audit `user_connected`, redirect vers `/settings/accounts?connected=<provider>`.

### 2.5 — Tests + commit + push

- [ ] Tests unitaires + intégration avec mock OAuth provider (msw).
- [ ] Commit `feat(connectors): service + OAuth flow handler + getUserToken`.

---

## Task 3 — Integration BetterAuth dynamic providers (~1j)

**Files :**
- Create : `server/src/auth/dynamic-providers.ts` + `__tests__/`
- Modify : `server/src/auth/better-auth.ts`

- [ ] **3.1 — `dynamic-providers.ts`** : `resolveDynamicProviders(db, companyId): SocialProviders` — lookup `oauth_connectors` enabled type=oauth2 pour la company, retourne un dict `{ <slug>: genericOAuthConfig }`.

- [ ] **3.2 — Modifier `createBetterAuthInstance`** : accepte un argument `dynamicProvidersResolver: () => Promise<SocialProviders>` invoqué lazily au premier request. Reconstruction transparente.

- [ ] **3.3 — Hot-reload via SSE** : event `connector.updated` côté serveur → invalide le cache de BetterAuth instance (ou rebuild forcé sur prochain request). Pattern : un `WeakMap<companyId, BetterAuthInstance>` qui se vide sur l'event.

- [ ] **3.4 — Tests** :
  - Connector créé enabled → next request can OAuth login via ce slug.
  - Connector disabled → next request rejette le slug.
  - Refresh token via callback dispatcher fonctionne.

- [ ] **3.5 — Backward compat** : les env vars `GITLAB_OAUTH_*` et `MICROSOFT_OAUTH_*` continuent de fonctionner. Si DB connector existe avec slug `gitlab` ou `microsoft`, il **override** les env vars. Migration douce documentée.

- [ ] **3.6 — Commit + push**

---

## Task 4 — API Keys storage + retrieval (~0.5j)

**Files :**
- Modify : `server/src/services/connectors.ts` (extend with API key methods)

- [ ] **4.1 — `setUserApiKey(userId, connectorId, key)`** : encrypt via Config Layer, INSERT/UPDATE row, audit `user_connected`.
- [ ] **4.2 — `deleteUserApiKey(userId, connectorId)`** : delete row + Config Layer, audit `user_disconnected`.
- [ ] **4.3 — Tests** : encryption roundtrip, RLS respecté, multi-user isolation.
- [ ] **4.4 — Commit + push**

---

## Task 5 — REST + MCP parité (~0.5j)

**Files :**
- Create : `server/src/routes/connectors.ts`
- Create : `server/src/mcp/tools/connectors.tool.ts`

### 5.1 — REST admin

- [ ] `GET    /api/companies/:companyId/connectors` (list + status) — `connectors:manage`
- [ ] `POST   /api/companies/:companyId/connectors` (create from template or custom)
- [ ] `PATCH  /api/companies/:companyId/connectors/:id` (update — change scopes, secret, enable/disable)
- [ ] `DELETE /api/companies/:companyId/connectors/:id`
- [ ] `GET    /api/companies/:companyId/connectors/:id/audit` — `connectors:audit`
- [ ] `GET    /api/companies/:companyId/connectors/templates` — list 10 templates prédéfinis (read public, no perm)

### 5.2 — REST user (self-service)

- [ ] `GET    /api/companies/:companyId/me/connected-accounts` — list connectors avec mon statut perso (connecté/non/expiré).
- [ ] `POST   /api/companies/:companyId/me/connect/:connectorId` — initie OAuth flow, retourne URL.
- [ ] `POST   /api/companies/:companyId/me/api-key/:connectorId` — set API key (type=api_key seulement).
- [ ] `DELETE /api/companies/:companyId/me/connected-accounts/:connectorId` — disconnect.

### 5.3 — MCP tools

- [ ] `list_connectors({company_id?})` — admin & user.
- [ ] `get_connector_status({connector_id})` — pour mon user.
- [ ] `connect_user_to_connector({connector_id})` — retourne URL OAuth à ouvrir + instructions ("ouvre cette URL dans ton browser pour autoriser").
- [ ] `set_user_api_key({connector_id, key})` — type=api_key only.

- [ ] **5.4 — Tests + commit + push**

---

## Task 6 — UI admin "Connecteurs" (~1j)

**Files :**
- Create : `ui/src/pages/Connectors.tsx`, `ConnectorDetail.tsx`
- Create : `ui/src/components/connectors/ConnectorTemplateCard.tsx`, `ConnectorStatusBadge.tsx`
- Create : `ui/src/api/connectors.ts`
- Modify : `ui/src/App.tsx` (route `/connectors`, `/connectors/:id`)
- Modify : `ui/src/lib/queryKeys.ts`

### 6.1 — Page liste

- [ ] **Tabs : "Mes connecteurs" / "Ajouter"**.
- [ ] Tab Ajouter : grille de 10 `ConnectorTemplateCard` (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI) + tile "Connecteur custom".
- [ ] Click sur template → wizard 2 étapes : `display_name` + scopes (pre-checked recommended) → `client_id` + `client_secret` (input "set up OAuth app" lien vers doc provider).
- [ ] Click sur OpenAI ou autre api_key → wizard 1 étape : `display_name` + `api_key_label`.
- [ ] Liste connecteurs existants : nom, type badge, # users connectés, last_used, toggle enabled.

### 6.2 — Page détail

- [ ] `<Sheet>` avec form de config + `<VisibilityPicker>` pas applicable ici (connecteur company-wide), audit log table en bas.
- [ ] Bouton "Test connection" : tente un OAuth flow ou test API key contre `userinfo_url` ou endpoint test.
- [ ] Bouton "Disable" / "Enable" / "Delete" (DELETE = prompt confirmation, cascade users disconnected).

### 6.3 — Tests Vitest + tester en browser + parity + commit

---

## Task 7 — UI user "Mes comptes connectés" (~1j)

**Files :**
- Create : `ui/src/pages/UserAccounts.tsx`
- Modify : `ui/src/pages/UserProfile.tsx` (lien vers `/settings/accounts`)
- Modify : `ui/src/App.tsx` (route `/settings/accounts`)

- [ ] **7.1 — Page** : liste les connecteurs disponibles dans la company avec mon statut perso.
- [ ] Pour chaque connector : icône provider + display_name + statut badge (Connecté ✓ / Non connecté / Expiré ⚠ / Révoqué ✗) + bouton action (Connecter / Reconnecter / Déconnecter / Set API Key).
- [ ] Click "Connecter" pour OAuth → ouvre l'URL retournée par `/me/connect/:id` dans nouveau tab.
- [ ] Click "Set API Key" → `<Sheet>` avec input password + bouton "Tester" → soumet.
- [ ] Live update via SSE event `user.connector_status_changed` quand le user revient depuis le tab OAuth.
- [ ] Empty state si aucun connecteur configuré dans la company : "Demande à ton admin de configurer un connecteur depuis Settings > Connecteurs".

- [ ] **7.2 — Lien depuis `UserProfile.tsx`** : section "Comptes connectés" avec preview (3 premiers, "+N") + bouton "Gérer".

- [ ] **7.3 — Tests + browser + parity + commit**

---

## Task 8 — Templates + helper consume + tests + parity + doc (~1.5j)

### 8.1 — Templates prédéfinis

**File :** `server/src/services/connectors-templates.ts`

```ts
export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    slug: "jira",
    display_name: "Jira",
    type: "oauth2",
    icon: "jira",
    authorization_url: "https://auth.atlassian.com/authorize",
    token_url: "https://auth.atlassian.com/oauth/token",
    userinfo_url: "https://api.atlassian.com/me",
    recommended_scopes: ["read:jira-work", "write:jira-work", "offline_access"],
    setup_doc_url: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
  },
  // GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion
  {
    slug: "openai",
    display_name: "OpenAI",
    type: "api_key",
    icon: "openai",
    api_key_label: "API Key",
    setup_doc_url: "https://platform.openai.com/api-keys",
  },
  // ...
];
```

- [ ] **8.1.1 — Lister les 10 templates** avec leurs URL/scopes corrects (vérifier docs officielles Jira/GitHub/etc.).
- [ ] **8.1.2 — Tests** que chaque template a la bonne shape selon son type.
- [ ] **8.1.3 — Doc** dans `docs/governed-workflows/connectors.md` avec un exemple par template (comment créer l'OAuth app côté provider).

### 8.2 — `getUserToken` consumer dans `governed-workflows.ts`

- [ ] **Refactor `resolveAuthor`** dans `server/src/services/governed-workflows.ts` : si user a connecté un connector slug `gitlab`, utiliser son token. Fallback PAT env var pour migration.

### 8.3 — Tests E2E

- [ ] **Test E2E Playwright** : login user → page Connecteurs admin → créer connecteur Jira (mock OAuth) → switch user → page Mes Comptes → connecter Jira → vérifier `account` row + `getUserToken` retourne le token.

### 8.4 — Parity + doc + commit final

- [ ] `scripts/parity/data.ts` : entries `connectors-admin`, `connectors-user`.
- [ ] Doc `docs/governed-workflows/connectors.md` (admin + user).
- [ ] Decision-log §1.8 ou similaire si besoin de graver le pattern Generic OAuth dynamic.
- [ ] Commit final + push.

---

## Risks

| Risque | Impact | Mitigation |
|---|---|---|
| `client_secret` leak via list endpoint | CRITICAL | Endpoint GET ne retourne JAMAIS le secret, juste un boolean `client_secret_configured`. Update via PATCH avec nouveau secret obligatoirement. |
| Token user volé via XSS UI | HIGH | Tokens stockés DB only, jamais en localStorage UI. UI consomme un endpoint `/me/connector-status` qui ne retourne pas les tokens. Helpers MCP qui retournent les tokens uniquement à des agents JWT légitimes (pas web sessions). |
| Mass OAuth provider misconfiguration → users bloqués | HIGH | Bouton "Test connection" obligatoire avant enable. Validation stricte des URL (https only, pas IP privée). Journaux clairs en cas de fail. |
| Refresh token rotation cassée (user perd accès) | MED | Test E2E spécifique sur Microsoft (qui rotate). Audit `user_refresh_failed` + email user "ton compte X s'est déconnecté, reconnecte stp". |
| Hot-reload BetterAuth crée race condition (user en plein OAuth flow) | MED | Le state JWT signed embedded contient le connector snapshot — même si le connector change DB, le flow en cours utilise le snapshot original. |
| 2 connecteurs avec même slug (race insert) | LOW | UNIQUE constraint DB. Service catch et retourne 409. |
| Connecteur supprimé pendant que des users ont des tokens | LOW | ON DELETE CASCADE sur `account` via cleanup job (BetterAuth account survit, mais inutile). Audit `connector_deleted`. Documentation : "supprimer un connecteur déconnecte tous les users". |
| RLS gap sur `user_api_keys` (cross-tenant via user_id) | HIGH | RLS RESTRICTIVE FORCE + filtre company_id. Test migration vérifie. Index sur (company_id, user_id) pas juste user_id. |

---

## Out of scope (V1+)

- **OAuth 1.0a** (Twitter legacy, Trello legacy) — flow différent, peu de demande enterprise.
- **SAML / SCIM** pour SSO admin — autre feature (déjà esquissée dans `services/sso-auth.ts` côté MnM, plan dédié).
- **Connecteur partagé platform-level** (tous les tenants utilisent une même app OAuth de MnM) — risque de scope contention chez les providers (rate limits, throttling cross-tenant).
- **Token vault dédié** (HashiCorp Vault, AWS Secrets Manager) au lieu de Config Layer Postgres — V1 enterprise pour clients très paranoïaques.
- **Per-scope user consent UI** (granularité fine type "tu autorise X seulement à voir tes Calendar events") — V1 si demande.
- **Bulk re-auth** quand un connecteur est mis à jour avec nouveaux scopes — V1.

---

## Dépendances downstream

- **[`2026-05-01-enterprise-pilot-foundation.md`](2026-05-01-enterprise-pilot-foundation.md)** Task 2 (Workflow Hooks) consume `getUserToken()` au runtime de `helpers.http`. La table `workflow_hooks_providers_whitelist` du plan pilote devient obsolète — remplacée par une référence à `oauth_connectors`. Patch du plan pilote à faire après ce plan.
- **Futurs MCP tools agent** (publish to Slack, create Notion page, ...) consument `getUserToken()` pour agir au nom de l'agent's `createdByUserId`.
- **Trace enrichment** (LLM provider-agnostic, decision-log §4.5) consume potentiellement les API keys user via `getUserToken("openai")` ou `getUserToken("anthropic")`.

---

## Validation Tom

- [ ] Pattern OAuth user-level applicable à n'importe quel provider OAuth 2.0 standard (Jira, GitHub, GitLab, Microsoft, Google, Slack, Linear, Notion, ClickUp).
- [ ] API keys (OpenAI, Anthropic, Stripe) supportées via path séparé `user_api_keys`.
- [ ] Helper unique `getUserToken()` consommé par hooks + agents + jobs + MCP tools.
- [ ] Backward compat : `GITLAB_OAUTH_*` + `MICROSOFT_OAUTH_*` env vars marchent encore (migration douce).
- [ ] Aucun secret leaké via API list (juste `client_secret_configured: bool`).
- [ ] Test E2E end-to-end : admin créé connecteur Jira mock → user le connecte → helper retourne le token.
- [ ] Hot-reload BetterAuth fonctionne (créer connecteur sans restart server).
