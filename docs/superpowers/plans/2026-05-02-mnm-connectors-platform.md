# MnM Connectors Platform — Hub d'identité OAuth user-level pour tout le système

> **Pour les agents :** SUB-SKILL REQUIS — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. Tâches en checkbox `- [ ]`.

**Goal :** transformer MnM en hub d'identité OAuth user-level. Aujourd'hui seuls GitLab + Microsoft sont supportés (statique, env vars). Demain : un admin company configure n'importe quel connecteur (Jira, ClickUp, Slack, GitHub, Google, Linear, Notion, OpenAI API key, ...) via UI, et tout le système (hooks, agents Claude Code via MCP, futurs jobs Nightly Synthesis) peut consulter les tokens user pour agir au nom de l'utilisateur — invariant traçabilité humaine [`decision-log.md` §1.7](../../decision-log.md).

**Branche :** `feat/connectors-platform`. Atomic commit + push par task (CLAUDE.md).

**Préalable obligatoire pour :** [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](2026-05-01-enterprise-pilot-foundation.md) — les hooks Jira/ClickUp en dépendent. Plan à shipper AVANT le plan Hooks.

**V1 → V2 (changelog)** : plan refondu après review multi-agent (architect / sécu / backend / frontend). Corrections principales :

- **C1 (CRITICAL)** : tokens OAuth ne vivent plus dans `account` BetterAuth (text brut, pas chiffré). Nouvelle table `connector_tokens` MnM-owned, AES-256-GCM via Config Layer + RLS RESTRICTIVE FORCE.
- **C2 (CRITICAL)** : `getUserToken` ajout du cross-tenant guard (`userId ∈ companyId` via `company_members` EXISTS) avant toute lookup token. Empêche l'exfil cross-tenant via hook isolate malveillant.
- **B1 (BLOCKER)** : `pg_advisory_xact_lock` autour du refresh OAuth (pattern `governed-workflows.ts:974`). Prévient race 2 hooks parallèles → 1 token rotated 2× → user déconnecté.
- **B2 (BLOCKER)** : V0 single-process accepté explicitement (note ops "redémarrer en cluster"). V1 cible Postgres `LISTEN/NOTIFY` documenté.
- **B5 (BLOCKER)** : migration renumérotée 0078 → **0079** (0078 déjà pris par `0078_session_bundle_runs.sql`). Plan Foundation décale ses migrations à 0080-0082.
- **H1 (HIGH)** : `redirect_after` whitelisté (chemin relatif `/...` OU origin strict `MNM_PUBLIC_URL`). Tests `evil.example.com` + `//evil.example.com` rejetés.
- **H3 (HIGH)** : MCP `set_user_api_key` redacte `key` dans logs (`pino-http redact: ["req.body.key"]`).
- **Frontend** : routes sous `:companyPrefix` (cohérent App.tsx), `NavItemId` étendu, SSE event `user.connector_status_changed` publié côté serveur ET consommé `LiveUpdatesProvider`, parity desktop = `partial`.
- **Backend** : MCP tools registry manuel (`server/src/mcp/tools/index.ts`), MSW ajouté en devDep, audit fire-and-forget (`void`), nouveau MCP tool `wait_for_connection`.
- **Estimation** : 8j → **10-11j** (1 dev) après review. Scope minimal pilote 7j documenté.

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

5. **Storage tokens user — table MnM-owned `connector_tokens` chiffrée** : les tokens OAuth (`access_token`, `refresh_token`) NE vivent PAS dans `account` BetterAuth (les colonnes y sont en `text` brut, pas chiffrées — vérifié dans `packages/db/src/schema/auth.ts`). Ils vivent dans une table dédiée `connector_tokens` (NEW), chiffrée via le pattern Config Layer (AES-256-GCM, clé `MNM_SECRETS_KEY`), avec colonne `company_id` + RLS RESTRICTIVE FORCE. Cela :
   - Lève le risque "tokens OAuth en clair en DB" (gap découvert en review sécu).
   - Permet RLS multi-tenant (la table `account` BetterAuth n'a pas de `company_id` et ne peut pas être RLS-isolée sans casser BetterAuth).
   - Garde `account` BetterAuth uniquement pour les sessions/SSO natifs (GitLab + Microsoft pour login MnM, pas pour les tokens d'orchestration).
   - API keys (type=api_key) vivent dans `user_api_keys` (déjà prévu) — séparées car schéma différent (pas de refresh, pas d'expires_at).

6. **Hot-reload BetterAuth instance — V0 single-process accepté** quand un admin créé/édite/désactive un connecteur. Pattern V0 : la fonction `createBetterAuthInstance` reconstruit l'instance au prochain request, lookup les `oauth_connectors enabled=true` du company actor + injecte dans `socialProviders` via Generic OAuth Plugin. Cache invalidé via SSE event `connector.updated` consommé par le process qui sert le request.

   **Trade-off explicite multi-process** (B2 reviewers) : SSE est process-local. Si Express tourne en cluster (PM2 / Kubernetes replicas), l'invalidation ne se propage pas → autres processes servent une config stale jusqu'au prochain restart. **V0 = single-process accepté** (note ops : "redémarrer en cluster après changement connector"). V1 cible : Postgres `LISTEN/NOTIFY` channel `connector_updated` consommé par tous les processes (pattern non-bloquant pour pilote enterprise solo single-instance).

7. **Conventions de nommage providers** : slug kebab-case (`jira`, `clickup`, `microsoft`, `gitlab-self-hosted`, `google-workspace`). Une company peut avoir 2 connecteurs avec des slugs différents pour le même service (ex: `gitlab-internal` + `gitlab-public`).

8. **Templates de connecteurs prédéfinis** : pour les 10 providers majeurs (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI), ship un template prédéfini avec authorization_url/token_url/scopes pré-remplis. L'admin n'a qu'à coller son client_id/client_secret. Nouveau provider non-listé → mode "Custom" où l'admin remplit tout.

9. **Helper centralisé `getUserToken(userId, providerSlug, companyId)`** dans `server/src/services/connectors.ts`. Toute feature (hooks, agents, jobs, MCP tools) doit passer par ce helper, jamais lire `connector_tokens` directement. Permet d'auditer les usages, de gérer le refresh, de logguer les access.

   **Invariant cross-tenant (C2 reviewers)** : le helper DOIT vérifier explicitement que `userId` appartient à `companyId` via `EXISTS (SELECT 1 FROM company_members WHERE user_id = userId AND company_id = companyId)` AVANT toute lookup token. Sans ce check, un hook isolate du tenant A peut appeler `getUserToken(victimUserIdOfTenantB, "jira", attackerCompanyId)` et exfiltrer un token cross-tenant. Test obligatoire "cross-tenant user_id → throws CONNECTOR_USER_NOT_IN_COMPANY".

   **Invariant host-only (archi N1)** : ce helper ne quitte JAMAIS le host process. Les isolates (gate-runner, hooks workflow) ne reçoivent JAMAIS le token brut — uniquement le résultat HTTP injecté par `helpers.http({provider:"x"})` côté host. Pattern cohérent avec `decision-log.md` §4.4.

10. **Refresh automatique** : si le token a expiré et qu'un `refresh_token` est dispo, `getUserToken` refresh transparent et update `account`. Si refresh fail (token révoqué côté provider) → throw `CONNECTOR_TOKEN_REVOKED`, le caller catch et redirige le user vers re-connecter son compte.

11. **Audit log** sur toutes les opérations (`oauth_connectors_audit`) : créations, modifications, désactivations, premier connect d'un user, déconnexion d'un user, refresh failed, token utilisé (rate sampled — 1/100 pour ne pas exploser le volume).

   **Volume + TTL (archi N2)** : 100 hooks/min × 100 users × sample 1/100 ≈ 144k rows/jour/company. À 10 companies = 1.4M/jour. **TTL 90 jours** : DELETE WHERE `action = 'token_used' AND created_at < now() - interval '90 days'` via cron quotidien. Les autres actions (create/update/connect/disconnect/refresh_failed) sont conservées indéfiniment pour audit forensic.

   **Audit fire-and-forget (backend point 7)** : `maybeAuditTokenUsed` ne doit PAS être awaited dans le hot path de `getUserToken` (sinon latency à chaque hook). Pattern `void Promise.resolve().then(() => audit(...))`.

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
│  RLS RESTRICTIVE FORCE on company_id                                         │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│        BetterAuth instance (V0 single-process, hot-reload SSE-local)        │
│  socialProviders dynamiquement enrichis via Generic OAuth Plugin            │
│  OAuth callback dispatcher écrit dans connector_tokens (PAS dans account)   │
└─────────────────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│  connector_tokens (NEW)     │      │  user_api_keys (NEW)             │
│  company_id, user_id,       │      │  company_id, user_id,            │
│  connector_id, token_layer, │      │  connector_id, key_layer_id,     │
│  refresh_layer, expires_at, │      │  last_used_at                    │
│  scopes_granted             │      │                                   │
│  RLS + AES-256-GCM via      │      │  RLS + AES-256-GCM via           │
│  Config Layer               │      │  Config Layer                    │
└─────────────────────────────┘      └──────────────────────────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             getUserToken(userId, providerSlug, companyId)                    │
│  - Verify userId ∈ companyId (cross-tenant guard, throws if not)            │
│  - Lookup oauth_connector (enabled for company)                             │
│  - Lookup connector_tokens (or user_api_keys if api_key type)               │
│  - If expired + refresh_token → pg_advisory_xact_lock + refresh + update    │
│  - If revoked → throw CONNECTOR_TOKEN_REVOKED                               │
│  - Audit row sampled 1/100 (fire-and-forget, not awaited)                   │
│  - Return { accessToken, expiresAt, scopes, type }                          │
│  HOST-ONLY: never crosses isolate boundary (decision-log §4.4)              │
└─────────────────────────────────────────────────────────────────────────────┘
            │                          │                         │
            ▼                          ▼                         ▼
   ┌────────────────┐       ┌─────────────────┐         ┌────────────────┐
   │  Hooks         │       │  MCP tools      │         │  Workflows     │
   │  helpers.http  │       │  agent actions  │         │  workflow steps│
   │  (host injects │       │  (server side)  │         │  (server side) │
   │   Authorization)│       │                 │         │                │
   └────────────────┘       └─────────────────┘         └────────────────┘
```

> Note : `account` (BetterAuth core) reste utilisé pour les sessions et SSO natifs (login MnM via GitLab/Microsoft). Il NE porte PAS les tokens d'orchestration — séparation claire pour rendre les tokens orchestration RLS-safe et chiffrés sans casser BetterAuth upstream.

---

## File Map

### Created

**DB :**
- `packages/db/src/migrations/0079_connectors_platform.sql` + `.test.ts` (renuméroté depuis 0078 — 0078 déjà pris par `0078_session_bundle_runs.sql`, voir commit `824a1ddb2`. Plan Foundation décale ses migrations à 0080-0082.)
- `packages/db/src/schema/oauth_connectors.ts`
- `packages/db/src/schema/connector_tokens.ts` (NEW — tokens OAuth chiffrés, MnM-owned, RLS multi-tenant)
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

- `server/src/auth/better-auth.ts` — `createBetterAuthInstance` accepte un `dynamicProviders[]` argument résolu par `dynamic-providers.ts`. Hot-reload sur connector change via SSE event `connector.updated` qui invalide le cached instance. **Override mechanism (§3.5)** : DB connector slug `gitlab`/`microsoft` override les env vars `GITLAB_OAUTH_*` / `MICROSOFT_OAUTH_*` (DB wins, env fallback uniquement si DB rien). Test E2E obligatoire (override + fallback + DB désactivé → re-fallback env).
- `server/src/services/governed-workflows.ts` — **11 call sites** `resolveGitProvider` (grep confirmé en review backend) consume le helper `getUserToken("gitlab")` au lieu du fallback `process.env.GITLAB_PAT`. Backward compat : si pas de connecteur enabled → fallback PAT (pour migration). Sub-task explicite Task 8.2 : "audit grep `resolveGitProvider` call sites + branch fallback PAT chacun" pour ne pas en oublier.
- `ui/src/App.tsx` — routes ajoutées dans `boardRoutes()` sous `:companyPrefix` (cohérent avec routing existant — voir review frontend B1) : `/:companyPrefix/connectors`, `/:companyPrefix/connectors/:id`, `/:companyPrefix/settings/accounts`. Le `companyPrefix` est un slug humain résolu en `selectedCompanyId` via `useCompany()`. Bloc `UnprefixedBoardRedirect` à étendre si on veut accepter `/connectors` non-préfixé en redirect (pattern existant).
- `ui/src/lib/nav-registry.ts` — ajouter entries `connectors` (admin, gated `connectors:manage`) et `connected-accounts` (user, no gate).
- `packages/shared/src/types/view-preset.ts` — étendre union type `NavItemId` avec `"connectors" | "connected-accounts"` (sinon TS casse — review frontend N1).
- `ui/src/context/LiveUpdatesProvider.tsx` — handler SSE event `user.connector_status_changed` → invalide queryKey `connectors.userAccounts(companyId)` + dispatch CustomEvent. Handler SSE event `connector.updated` → invalide `connectors.list(companyId)` côté admin. Pattern cohérent `dashboard:refresh` / `governed_run:updated` (review frontend N3).
- `ui/src/pages/UserProfile.tsx` — section "Mes comptes connectés" qui link vers `/settings/accounts`.
- `ui/src/lib/queryKeys.ts` — `connectors`, `userAccounts`.
- `scripts/parity/data.ts` — entries `connectors-admin`, `connectors-user`.

### NOT Modified

- BetterAuth core lui-même — on n'utilise que les API publiques (Generic OAuth Plugin existant). Pas de patch upstream.

---

## Sprint structure

| Sprint | Durée | Tasks | Parallélisation |
|---|---|---|---|
| **Sprint 1** | 5j | T1 (DB) → T2 (service + getUserToken + refresh + callback) → T3 (BetterAuth dyn providers, refactor singleton) → T4 (API keys path) | 1 dev |
| **Sprint 2** | 5-6j | T5 (REST/MCP) ‖ T6 (UI admin) ‖ T7 (UI user) ‖ T8 (templates + helper consume + E2E + parity) | 2-3 devs |

**Total révisé après review : 10-11j (1 dev) / ~6-7j (2 devs)** — augmenté depuis estimate initial 8j à cause de :
- T3 refactor BetterAuth singleton plus invasif que prévu (review backend point 2).
- T8 E2E Playwright OAuth real-flow + 10 templates docs vérifiés (review backend point 8).
- T2 sécurité augmentée (advisory lock, cross-tenant guard, tests sécu obligatoires).

### Décision scope (Tom, 2026-05-02)

**Full plan retenu (option A)** : 10-11j solo avec UI admin + UI user. Les autres users du pilote (tech/produit) voient leur statut connecté et gèrent leurs comptes eux-mêmes — pas de goulot d'étranglement sur l'admin.

**Conséquence pilote** : Connectors ship AVANT le plan Foundation (Hooks). Si la deadline pilote glisse de quelques jours pour ce plan, c'est acceptable — l'invariant traçabilité humaine §1.7 + le pattern OAuth user-level sont des fondations qu'on ne peut pas remplacer par un hack temporaire.

**Ordre d'exécution** :
1. Connectors Platform (ce plan, 10-11j) → ship en priorité.
2. Foundation V2 Hooks (`2026-05-01-enterprise-pilot-foundation.md`, 15j) → consume `getUserToken()` du Connectors.
3. Pilote enterprise = Foundation déployé chez le premier client.

Si la deadline pilote serre vraiment, sacrifiables (dans cet ordre) : T7.2 (preview UserProfile inline → juste un lien "Gérer mes comptes connectés"), puis T6.2 audit log table (peut être ajouté post-pilote), puis T8.3 E2E Playwright (tests unitaires suffisent V0).

---

## Task 1 — Schema DB + migration (~0.5j)

**Files :**
- Create : `packages/db/src/migrations/0079_connectors_platform.sql` + `.test.ts` (renuméroté depuis 0078, voir File Map)
- Create : 4 schemas Drizzle (oauth_connectors, **connector_tokens**, user_api_keys, oauth_connectors_audit)

> Note backend point 6 : `"type"` est mot-réservé Postgres mais marche avec quotes. OK tel quel.
> Note backend point 6 : `auth.ts` a peut-être déjà un index `account(user_id, provider_id)` natif BetterAuth. Vérifier avec grep avant migration — `IF NOT EXISTS` masquerait un doublon silencieux. Index plus nécessaire de toute façon : `getUserToken` lookup `connector_tokens`, pas `account`.

```sql
-- 0079_connectors_platform.sql

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

-- Tokens OAuth chiffrés MnM-owned (RLS, lève C1+H2 review sécu)
CREATE TABLE IF NOT EXISTS "connector_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "connector_id" uuid NOT NULL REFERENCES "oauth_connectors"("id") ON DELETE CASCADE,
  "access_token_layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE RESTRICT,
  "refresh_token_layer_id" uuid REFERENCES "config_layers"("id") ON DELETE RESTRICT,
  "expires_at" timestamptz,
  "scopes_granted" text[] NOT NULL DEFAULT '{}',
  "last_used_at" timestamptz,
  "last_refresh_at" timestamptz,
  "last_refresh_failed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  UNIQUE ("user_id", "connector_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "connector_tokens_company_user_idx"
  ON "connector_tokens"("company_id", "user_id");
--> statement-breakpoint

ALTER TABLE "connector_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connector_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "connector_tokens" AS RESTRICTIVE FOR ALL
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

-- (Retiré : pas d'index sur account, getUserToken lookup connector_tokens uniquement)

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

- [ ] **1.1 — Test migration** : 4 tables (oauth_connectors, connector_tokens, user_api_keys, oauth_connectors_audit) + RLS RESTRICTIVE FORCE × 4 + 2 permissions seedées par company + UNIQUE constraints + CHECK conditionnel oauth_connectors.
- [ ] **1.2 — Schemas Drizzle** + index TS pour les 4 tables.
- [ ] **1.3 — Test cross-tenant** : INSERT connector_tokens depuis company A puis SELECT en setant `app.current_company_id = B` → 0 row (RLS fail-closed).
- [ ] **1.4 — Migration up + tests pass + commit + push**

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

- [ ] **Test TDD** :
  - retourne le token courant, refresh si expiré, throw `CONNECTOR_TOKEN_REVOKED` si refresh fail, throw `CONNECTOR_USER_NOT_CONNECTED` si pas de token row ou api_key, throw `CONNECTOR_NOT_CONFIGURED` si pas de connector enabled.
  - **Cross-tenant guard (C2)** : test "userId de tenant B + companyId de tenant A → throws CONNECTOR_USER_NOT_IN_COMPANY" — obligatoire avant ship.
  - **Refresh concurrent (B1)** : test "2 calls parallèles avec token expiré → 1 seul POST /token au provider, les 2 calls retournent le nouveau token". Mock provider counte les hits.
  - sample audit row 1/100, fire-and-forget (non awaited).
- [ ] **Implémenter** :
  ```ts
  export async function getUserToken(
    userId: string,
    providerSlug: string,
    companyId: string,
  ): Promise<{ accessToken: string; expiresAt: Date | null; scopes: string[]; type: "oauth2"|"api_key" }> {
    // C2 cross-tenant guard — user must belong to companyId
    const isMember = await db.execute(sql`
      SELECT 1 FROM company_members
      WHERE user_id = ${userId} AND company_id = ${companyId}
      LIMIT 1
    `);
    if (!isMember.rows.length) throw new Error("CONNECTOR_USER_NOT_IN_COMPANY");

    const connector = await getActiveConnector(companyId, providerSlug);
    if (!connector) throw new Error("CONNECTOR_NOT_CONFIGURED");

    if (connector.type === "api_key") {
      const apiKey = await getUserApiKey(userId, connector.id);
      if (!apiKey) throw new Error("CONNECTOR_USER_NOT_CONNECTED");
      const decrypted = await configLayerService.decrypt(apiKey.keyLayerId);
      void maybeAuditTokenUsed(connector.id, userId); // fire-and-forget
      return { accessToken: decrypted, expiresAt: null, scopes: [], type: "api_key" };
    }

    // oauth2 — lookup connector_tokens (MnM-owned, RLS-isolated, encrypted)
    const tokenRow = await getConnectorToken(userId, connector.id);
    if (!tokenRow) throw new Error("CONNECTOR_USER_NOT_CONNECTED");

    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      if (!tokenRow.refreshTokenLayerId) throw new Error("CONNECTOR_TOKEN_EXPIRED_NO_REFRESH");
      // B1 advisory lock — pattern existant governed-workflows.ts:974
      const refreshed = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('mnm:oauth_refresh:' || ${tokenRow.id}::text))`);
        // Re-read inside lock — another concurrent call may have refreshed
        const fresh = await getConnectorTokenForUpdate(tx, tokenRow.id);
        if (fresh.expiresAt && fresh.expiresAt > new Date()) return fresh;
        return await refreshOAuthToken(tx, connector, fresh);
      });
      if (!refreshed) throw new Error("CONNECTOR_TOKEN_REVOKED");
      void maybeAuditTokenUsed(connector.id, userId);
      const accessToken = await configLayerService.decrypt(refreshed.accessTokenLayerId);
      return { accessToken, expiresAt: refreshed.expiresAt, scopes: refreshed.scopesGranted, type: "oauth2" };
    }

    void maybeAuditTokenUsed(connector.id, userId);
    const accessToken = await configLayerService.decrypt(tokenRow.accessTokenLayerId);
    return { accessToken, expiresAt: tokenRow.expiresAt, scopes: tokenRow.scopesGranted, type: "oauth2" };
  }
  ```

  **Notes** :
  - `void` devant `maybeAuditTokenUsed` = fire-and-forget pour ne pas bloquer le hot-path (review backend point 7).
  - `pg_advisory_xact_lock` libéré en fin de transaction → 2 appels concurrents : le 1er refresh, le 2e re-read et voit le token frais (re-check inside lock).
  - HOST-ONLY : cette fonction tourne dans le process Express, pas dans un isolate. Le caller isolate (gate-runner / hooks) reçoit la response HTTP, jamais le token brut.

### 2.3 — `refreshOAuthToken(tx, connector, tokenRow)` — refresh logic

- [ ] **Test TDD** : POST `connector.token_url` avec `grant_type=refresh_token + refresh_token + client_id + client_secret`, parse response, encrypt et UPDATE `connector_tokens`. Si 401 → audit `user_token_revoked` + return null. Reçoit la `tx` du caller (déjà sous `pg_advisory_xact_lock`).
- [ ] **Implémenter** standard OAuth 2.0 refresh.
- [ ] **Refresh tokens rotation** support (certains providers genre Microsoft retournent un nouveau refresh_token à chaque refresh — encrypt + UPDATE `refresh_token_layer_id` aussi).
- [ ] **`last_refresh_at` / `last_refresh_failed_at`** updated pour debug / monitoring.

### 2.4 — OAuth callback dispatcher

- [ ] **Route `GET /api/connectors/callback`** : dispatcher générique pour tous les providers OAuth. Lit le `state` (signed JWT HS256 avec `BETTER_AUTH_SECRET`, expire 10 min), vérifie, échange code → token, encrypte tokens via Config Layer, INSERT/UPDATE `connector_tokens` (PAS `account`), audit `user_connected`, redirect vers `redirect_after` (validé) ou défaut `/settings/accounts?connected=<provider>`.

- [ ] **H1 — Validation `redirect_after` whitelist** :
  - Le state JWT contient `redirect_after`. AVANT redirect final, le dispatcher DOIT valider :
    - soit chemin relatif commençant par `/` (et pas `//` qui en HTTP signifie protocol-relative → open redirect),
    - soit URL absolue dont l'origin appartient strictement à `MNM_PUBLIC_URL`.
  - Sinon → log + redirect default `/settings/accounts?connected=<provider>`. Pas d'erreur 400 visible (UX) mais audit `redirect_after_rejected`.
  - Test obligatoire : `redirect_after=https://evil.example.com` → ignoré, redirect default. `redirect_after=//evil.example.com` → ignoré. `redirect_after=/foo/bar` → accepté.

- [ ] **Algorithme JWT signed state** : HS256 avec `BETTER_AUTH_SECRET`, claims `{ companyId, connectorId, userId, redirectAfter, iat, exp }`, expire `iat + 10min`. Embedde un snapshot du connector (client_id) — review archi mitigation hot-reload race : un connector modifié pendant le flow ne casse pas le callback en cours.

### 2.5 — Tests + commit + push

- [ ] **Ajouter `msw` en devDependency** (review backend point 12 : pas installé). `bun add -d msw`.
- [ ] Tests unitaires + intégration avec mock OAuth provider (msw).
- [ ] Commit `feat(connectors): service + OAuth flow handler + getUserToken`.

---

## Task 3 — Integration BetterAuth dynamic providers (~1j)

**Files :**
- Create : `server/src/auth/dynamic-providers.ts` + `__tests__/`
- Modify : `server/src/auth/better-auth.ts`

- [ ] **3.1 — `dynamic-providers.ts`** : `resolveDynamicProviders(db, companyId): SocialProviders` — lookup `oauth_connectors` enabled type=oauth2 pour la company, retourne un dict `{ <slug>: genericOAuthConfig }`.

- [ ] **3.2 — Modifier `createBetterAuthInstance`** : accepte un argument `dynamicProvidersResolver: () => Promise<SocialProviders>` invoqué lazily au premier request. Reconstruction transparente.

- [ ] **3.3 — Hot-reload via SSE (V0 single-process)** : event `connector.updated` côté serveur → invalide le cache de BetterAuth instance (rebuild forcé sur prochain request). Pattern : un `WeakMap<companyId, BetterAuthInstance>` qui se vide sur l'event.
  - **Trade-off explicite** : SSE est process-local. En cluster (PM2 / Kubernetes replicas), invalidation ne se propage pas → autres processes servent stale. **V0 = single-process accepté** (admin doit redémarrer en cluster après changement connector).
  - **V1 cible** (out-of-scope V0) : Postgres `LISTEN/NOTIFY` channel `connector_updated` consommé par tous processes — pattern non-bloquant pour pilote enterprise solo single-instance.

- [ ] **3.4 — Tests** :
  - Connector créé enabled → next request can OAuth login via ce slug.
  - Connector disabled → next request rejette le slug.
  - Refresh token via callback dispatcher fonctionne.

- [ ] **3.5 — Backward compat** : les env vars `GITLAB_OAUTH_*` et `MICROSOFT_OAUTH_*` continuent de fonctionner. Si DB connector existe avec slug `gitlab` ou `microsoft`, il **override** les env vars. Migration douce documentée.
  - **Test E2E explicite (review archi N4)** : 3 cas
    1. `GITLAB_OAUTH_CLIENT_ID=xxx` set + DB connector `gitlab` enabled → DB wins (vérifier `client_id` réel utilisé).
    2. Env var set + DB connector désactivé → fallback env var.
    3. Env var set + DB connector supprimé → fallback env var (re-init instance).

- [ ] **3.6 — Commit + push**

---

## Task 4 — API Keys storage + retrieval (~0.5j)

**Files :**
- Modify : `server/src/services/connectors.ts` (extend with API key methods)

- [ ] **4.1 — `setUserApiKey(userId, connectorId, key, companyId)`** : C2 cross-tenant guard (user ∈ company), encrypt via Config Layer, INSERT/UPDATE row, audit `user_connected`. Logge `{...params, key: "[REDACTED]"}` (H3).
- [ ] **4.2 — `deleteUserApiKey(userId, connectorId, companyId)`** : C2 guard, delete row + Config Layer, audit `user_disconnected`.
- [ ] **4.3 — Tests** :
  - Encryption roundtrip (encrypt → decrypt = original).
  - RLS respecté (cross-tenant SELECT → 0 row).
  - Multi-user isolation : intra-company, user A ne peut PAS lire user_api_keys de user B même via service (filter explicite `user_id = currentUserId` côté service, RLS company seul ne suffit pas).
  - Test cross-tenant `setUserApiKey` avec userId d'une autre company → throws `CONNECTOR_USER_NOT_IN_COMPANY`.
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

> **Modifier `server/src/mcp/tools/index.ts`** : enregistrer les nouveaux tools dans `allToolDefiners` (registry manuel — pas d'auto-discovery par filename, review backend blocker #2).

- [ ] `list_connectors({company_id?})` — admin & user. Retourne **JAMAIS** le `client_secret` ni les tokens. Juste : slug, type, enabled, display_name, scopes, `client_secret_configured: bool`.
- [ ] `get_connector_status({connector_id})` — pour mon user. Retourne statut (connecté/non/expiré/révoqué) + scopes_granted. **JAMAIS le token**.
- [ ] `connect_user_to_connector({connector_id})` — retourne URL OAuth signed (state JWT 10 min) + instructions ("ouvre cette URL dans ton browser pour autoriser").
- [ ] `wait_for_connection({connector_id, timeout_s})` — long-poll côté serveur (max 60s, throttle), retourne dès que le user a complété l'OAuth flow OU timeout (review archi N3). Évite à l'agent de re-polling actif.
- [ ] `set_user_api_key({connector_id, key})` — type=api_key only.
  - **H3 redaction obligatoire** : le handler logge `{...params, key: "[REDACTED]"}` AVANT toute autre opération. Vérifier que le middleware `pino-http` (ou équivalent) sur la route MCP n'inclut pas le body brut dans ses access logs (whitelist body fields ou `redact: ["req.body.key", "req.body.params.key"]` côté logger).
  - Test obligatoire : appeler le tool avec `key="test-secret-do-not-log"`, grep les logs Express → 0 occurrence.

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
- [ ] Empty state admin (0 connecteur configuré) : composant `<EmptyState icon={Plug}>` (existant, voir `GovernedWorkflowsList.tsx`) avec CTA "Ajouter un connecteur" → switch tab. Copy en français (convention user-facing repo).
- [ ] Tab Ajouter : grille de 10 `ConnectorTemplateCard` (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI) + tile "Connecteur custom".
- [ ] Click sur template → wizard 2 étapes : `display_name` + scopes (pre-checked recommended) → `client_id` + `client_secret` (input "set up OAuth app" lien vers doc provider). **Pattern à copier** : `JiraImport.tsx` (state `currentStep` dans la même page, plus simple qu'un Stepper primitive — review frontend N2).
- [ ] Click sur OpenAI ou autre api_key → wizard 1 étape : `display_name` + `api_key_label`.
- [ ] Liste connecteurs existants : nom, type badge, # users connectés, last_used, toggle enabled.
- [ ] Validation côté UI des URLs OAuth (https only, regex strict, pas IP privée). Server fait re-validation (defense-in-depth).

### 6.2 — Page détail

- [ ] `<Sheet>` avec form de config + `<VisibilityPicker>` pas applicable ici (connecteur company-wide), audit log table en bas.
- [ ] Bouton "Test connection" : pour OAuth → HEAD `authorization_url` 200 + fetch metadata `/.well-known/openid-configuration` si OIDC. Pour api_key → l'admin n'a pas la clé du user, donc disable ce bouton (juste un "Configuration valide" check d'URL/scopes).
- [ ] Pendant test : Loader inline. Si fail : message lisible (ex "URL invalide : doit être HTTPS" plutôt que "OAUTH_INVALID_CLIENT").
- [ ] Bouton "Disable" / "Enable" / "Delete" (DELETE = prompt confirmation, cascade users disconnected via `ON DELETE CASCADE` sur `connector_tokens` + `user_api_keys`).

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
- [ ] **Retour user après OAuth** : SSE event `user.connector_status_changed` consommé par `LiveUpdatesProvider.tsx` → invalide `queryKeys.connectors.userAccounts(companyId)` → UI re-fetch automatique. Pas de polling, pas de BroadcastChannel (review frontend N4).
- [ ] Click "Set API Key" → `<Sheet>` avec input password (autocomplete=off) + bouton "Tester" → soumet via REST `/me/api-key/:connectorId`. Le UI ne stocke jamais la clé en mémoire après submit.
- [ ] Empty state si aucun connecteur configuré dans la company : composant `<EmptyState>` "Demande à ton admin de configurer un connecteur depuis Settings > Connecteurs".

**Note** : pour qu'`user.connector_status_changed` fonctionne, le backend (Task 5.x routes user) doit publier l'event via `publishLiveEvent` après chaque connect/disconnect/refresh — review frontend N3, à intégrer dans Task 5.

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

- [x] **8.1.1 — Lister les 10 templates** avec leurs URL/scopes corrects (vérifier docs officielles Jira/GitHub/etc.). → `server/src/services/connector-templates.ts` (commit `35f2b59a6`).
- [x] **8.1.2 — Tests** que chaque template a la bonne shape selon son type. → 67 tests `connector-templates.test.ts` (commit `8a2d30b97`).
- [x] **8.1.3 — Doc** dans `docs/governed-workflows/connectors.md` avec un exemple par template (comment créer l'OAuth app côté provider). → commit `8a2d30b97`.

### 8.2 — `getUserToken` consumer dans `governed-workflows.ts`

- [x] **Refactor `createResolveGitProvider`** dans `server/src/mcp/build-mcp-services.ts` (le vrai resolveur de token, pas `resolveAuthor` qui ne touche que `{name,email}`) : Step 1a ajouté `getUserToken("gitlab", userId, companyId)` AVANT le fallback BetterAuth `account`. Fall-through transparent sur `CONNECTOR_NOT_CONFIGURED` / `CONNECTOR_USER_NOT_CONNECTED` (migration douce). Surface des autres erreurs (REVOKED, EXPIRED). 8 tests unit `resolve-git-provider-connectors.test.ts` (commit `53a817f7c`).

### 8.3 — Tests E2E

- [ ] ~~**Test E2E Playwright**~~ → **SACRIFIÉ V0** (sacrifiable selon plan §scope, 2026-05-02). Couverture déjà excellente : 7 cases callback dispatcher (msw + supertest) + 11 tests connectors-service + 8 tests resolve-git-provider Step 1a + 10 tests status + 9 tests MCP tools + 67 tests templates = 112 tests sur la feature server-side. À ajouter post-pilote si bug réel observé.

### 8.4 — Parity + doc + commit final

- [x] `scripts/parity/data.ts` : entries `admin-connectors` + `settings-accounts` (web: partial, desktop: partial — Tauri OAuth flow nécessite `tauri-plugin-shell openUrl` + URL handler retour). → commits `6a1fa8c8d` + `f4e1b13d9`.
- [x] Doc `docs/governed-workflows/connectors.md` (admin + user). → commit `8a2d30b97`.
- [x] Decision-log §4.6 + §7.1 — patterns tokens MnM-owned + RLS PERMISSIVE baseline. → commits `5e2b3fe50` + `136f5874f`.
- [x] Commit final + push. → branche `feat/connectors-platform`, 13 commits, prête à merger.

---

## Risks

| Risque | Impact | Mitigation |
|---|---|---|
| `client_secret` leak via list endpoint | CRITICAL | Endpoint GET ne retourne JAMAIS le secret, juste un boolean `client_secret_configured`. Update via PATCH avec nouveau secret obligatoirement. **MCP tools** `list_connectors` + `get_connector_status` filtrent pareil — JAMAIS de retour secret/token. |
| Tokens OAuth en clair en DB (review sécu C1) | CRITICAL → résolu | Tokens NE vivent PAS dans `account` BetterAuth (text brut). Vivent dans `connector_tokens` (NEW), chiffrés AES-256-GCM via Config Layer (`MNM_SECRETS_KEY`). RLS RESTRICTIVE FORCE sur `company_id`. |
| Cross-tenant token exfil via `getUserToken` (review sécu C2) | CRITICAL → résolu | Helper vérifie EXPLICITEMENT que `userId ∈ companyId` via `EXISTS (SELECT 1 FROM company_members …)` AVANT toute lookup token. Test obligatoire "cross-tenant userId → throws CONNECTOR_USER_NOT_IN_COMPANY". |
| Open redirect via `redirect_after` dans state JWT (review sécu H1) | HIGH → résolu | Validation whitelist : chemin relatif `/...` (pas `//...`) OU origin strict `MNM_PUBLIC_URL`. Sinon → redirect default + audit `redirect_after_rejected`. Tests obligatoires. |
| MCP `set_user_api_key` clé en clair dans logs Express (review sécu H3) | HIGH → résolu | Handler logge `{...params, key: "[REDACTED]"}` AVANT toute opération. Logger `pino-http` configured `redact: ["req.body.key", "req.body.params.key"]`. Test grep logs après injection clé sentinel. |
| Refresh OAuth concurrent — 2 hooks parallèles refresh même token (review archi B1) | HIGH → résolu | `pg_advisory_xact_lock(hashtext('mnm:oauth_refresh:' || tokenRow.id))` dans transaction de `getUserToken`. Re-read inside lock → 2e call voit token frais. Pattern existant `governed-workflows.ts:974`. |
| Hot-reload BetterAuth multi-process stale config (review archi B2) | MED | V0 = single-process accepté (note ops "redémarrer en cluster après changement"). V1 = `LISTEN/NOTIFY` Postgres. Pour pilote enterprise solo single-instance → trade-off acceptable. |
| Token user volé via XSS UI | HIGH | Tokens stockés DB only chiffrés, jamais en localStorage UI. UI consomme un endpoint `/me/connected-accounts` qui ne retourne pas les tokens. Helpers MCP retournent les tokens uniquement aux agents host-side, jamais à des sessions web. |
| Mass OAuth provider misconfiguration → users bloqués | HIGH | Bouton "Test connection" obligatoire avant enable. Validation stricte des URL côté UI ET serveur (https only, pas IP privée). Journaux clairs en cas de fail. |
| Refresh token rotation cassée (user perd accès) | MED | Test E2E spécifique sur Microsoft (qui rotate). Audit `user_refresh_failed`. UI affiche statut "Reconnecte stp" avec bouton retry. |
| Hot-reload BetterAuth crée race condition (user en plein OAuth flow) | MED | Le state JWT signed embedded contient le connector snapshot (`client_id` figé) + expire 10 min — même si le connector change DB, le flow en cours utilise le snapshot. |
| 2 connecteurs avec même slug (race insert) | LOW | UNIQUE constraint `(company_id, provider_slug)`. Service catch et retourne 409. |
| Connecteur supprimé pendant que des users ont des tokens | LOW | `ON DELETE CASCADE` sur `connector_tokens.connector_id` + `user_api_keys.connector_id` → tokens supprimés automatiquement. Audit `connector_deleted` retient le diff. Documentation : "supprimer un connecteur déconnecte tous les users". |
| RLS gap sur `user_api_keys` / `connector_tokens` (cross-user intra-company via user_id) | HIGH | RLS RESTRICTIVE FORCE + filtre `company_id` (cross-tenant). **PLUS** : tous les SELECTs côté service ajoutent `AND user_id = currentUserId` (intra-company). Test cross-user obligatoire. |
| Audit `token_used` volume explose | MED | Sample 1/100 + TTL 90 jours via cron quotidien (DELETE). Autres actions audit sans TTL. Partitioning par mois envisagé V1+ si volume dépasse 10M rows. |

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

### V1 (fonctionnel)

- [ ] Pattern OAuth user-level applicable à n'importe quel provider OAuth 2.0 standard (Jira, GitHub, GitLab, Microsoft, Google, Slack, Linear, Notion, ClickUp).
- [ ] API keys (OpenAI, Anthropic, Stripe) supportées via path séparé `user_api_keys`.
- [ ] Helper unique `getUserToken()` consommé par hooks + agents + jobs + MCP tools.
- [ ] Backward compat : `GITLAB_OAUTH_*` + `MICROSOFT_OAUTH_*` env vars marchent encore (migration douce).
- [ ] Test E2E end-to-end : admin créé connecteur Jira mock → user le connecte → helper retourne le token.
- [ ] Hot-reload BetterAuth fonctionne single-process (créer connecteur sans restart server).

### V2 (sécurité — fixes review obligatoires avant ship)

- [ ] **C1 résolu** : tokens OAuth chiffrés AES-256-GCM dans `connector_tokens` (pas dans `account` brut). Test : SELECT direct DB sur `connector_tokens.access_token_layer_id` retourne juste un UUID, jamais un token.
- [ ] **C2 résolu** : `getUserToken` throw `CONNECTOR_USER_NOT_IN_COMPANY` quand `userId` ∉ `companyId`. Test cross-tenant obligatoire.
- [ ] **B1 résolu** : `pg_advisory_xact_lock` dans `getUserToken` refresh path. Test parallèle confirme 1 seul POST `/token` au provider.
- [ ] **B2 trade-off explicite** : V0 single-process documenté en clair pour ops.
- [ ] **H1 résolu** : `redirect_after` whitelisté (relatif `/...` OU origin strict `MNM_PUBLIC_URL`). Tests `evil.example.com` + `//evil.example.com` rejetés.
- [ ] **H3 résolu** : MCP `set_user_api_key` redacte `key` dans logs. Test grep sentinel.
- [ ] Aucun secret leaké via API list/MCP tools (juste `client_secret_configured: bool`, jamais le token brut).
- [ ] RLS `connector_tokens` testé cross-tenant + intra-company cross-user.

### V2 (frontend — fixes review obligatoires)

- [ ] Routes `/connectors`, `/settings/accounts` sous `:companyPrefix` (cohérent App.tsx existant).
- [ ] `NavItemId` étendu (`packages/shared/src/types/view-preset.ts`) — sinon TS casse.
- [ ] SSE event `user.connector_status_changed` publié côté serveur (Task 5) ET consommé `LiveUpdatesProvider.tsx` (Task 7).
- [ ] Parity tracker desktop = `partial` (pas `n/a`).
