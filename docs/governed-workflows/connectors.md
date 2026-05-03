# Connectors Platform — Hub OAuth user-level pour MnM

Ce document est le guide opérationnel de la **Connectors Platform** MnM (introduite Sprint `feat/connectors-platform`, plan [`2026-05-02-mnm-connectors-platform.md`](../superpowers/plans/2026-05-02-mnm-connectors-platform.md)).

Il s'adresse à :

- **Admins company** qui configurent les connecteurs OAuth (Jira, GitHub, ClickUp, …).
- **Users** qui connectent leurs comptes via `/settings/accounts`.
- **Auteurs de hooks / agents / steps de workflow** qui consomment les tokens user via `getUserToken()`.

> Pour le contexte et les décisions structurantes (pourquoi MnM-owned tokens, séparés de BetterAuth `account`), voir [`decision-log.md` §4.6](../decision-log.md) et l'invariant traçabilité humaine [§1.7](../decision-log.md).

---

## 1. Vue d'ensemble

### Pourquoi un hub d'identité

Avant Connectors Platform, MnM supportait `gitlab` et `microsoft` en dur, configurés via env vars (`GITLAB_OAUTH_*`, `MICROSOFT_OAUTH_*`). Pour ajouter Jira ou ClickUp, il fallait toucher au code. Avec Connectors Platform, un admin company configure n'importe quel provider OAuth 2.0 (ou API key) via UI, et tout le système (hooks, agents Claude Code via MCP, futurs jobs Nightly Synthesis) peut consulter les tokens user pour agir au nom de l'utilisateur.

Invariant traçabilité humaine : `decision-log.md §1.7` impose qu'un hook ou un agent agisse avec le token OAuth du user qui a triggered le run — pas avec un service account anonyme.

### Architecture (résumé)

```
oauth_connectors  (config admin, per-company)
        │
        ▼
OAuth callback /api/connectors/callback
        │
        ▼
connector_tokens  (AES-256-GCM, RLS RESTRICTIVE FORCE on company_id)
user_api_keys     (idem pour les types api_key)
        │
        ▼
getUserToken(userId, providerSlug, companyId)
   - cross-tenant guard (userId ∈ companyId via company_memberships)
   - refresh transparent + pg_advisory_xact_lock
   - retourne { accessToken, expiresAt, scopes, type }
   - HOST-ONLY (jamais traverse l'isolate boundary)
        │
        ▼
Hooks / Agents MCP / Workflow steps / Jobs background
```

Détails du schema DB : `packages/db/src/schema/oauth_connectors.ts`, `connector_tokens.ts`, `user_api_keys.ts`. Migration `0079_connectors_platform.sql`. Config layer crypto : `secret-crypto.ts` (AES-256-GCM, clé `MNM_SECRETS_KEY`).

---

## 2. Guide admin — configurer un connecteur

### Prérequis

1. La permission `connectors:manage` sur la company.
2. Une **OAuth app créée côté provider** (voir §4 par template). L'admin récupère un `client_id` + `client_secret`.
3. La variable serveur `MNM_PUBLIC_URL` correctement définie — c'est le hostname utilisé pour générer la `redirect_uri` côté provider (`{MNM_PUBLIC_URL}/api/connectors/callback`).

### Workflow UI

1. Aller sur `/admin/connectors` (ou via le menu Settings → Connecteurs).
2. Onglet **Ajouter** → cliquer une tile (Jira / GitHub / GitLab / Microsoft / Google / Slack / ClickUp / Linear / Notion / OpenAI / Custom).
3. Wizard 2 étapes (OAuth) ou 1 étape (API key) :
   - **Étape 1** : `display_name` (libre, ex `Jira interne`) + `scopes` (préremplis depuis le template).
   - **Étape 2** : `client_id` + `client_secret` (OAuth) OU rien (api_key — l'utilisateur fournira sa clé via `/settings/accounts`).
4. Click **Créer** → audit log `connector_created`, le connecteur apparaît `enabled`.

### Workflow REST (programmatique)

```http
POST /api/companies/:companyId/connectors
Content-Type: application/json
Authorization: Bearer <token>
X-MnM-Permission: connectors:manage

{
  "templateSlug": "jira",
  "displayName": "Jira interne",
  "clientId": "xxx",
  "clientSecret": "yyy",
  "redirectUri": "https://mnm.example.com/api/connectors/callback"
}
```

### Endpoints disponibles

| Méthode | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/companies/:companyId/connectors/templates` | (public read) | 10 templates pré-définis |
| `GET` | `/companies/:companyId/connectors` | `connectors:manage` | Liste les connecteurs configurés |
| `POST` | `/companies/:companyId/connectors` | `connectors:manage` | Créer depuis template ou custom |
| `PATCH` | `/companies/:companyId/connectors/:id` | `connectors:manage` | Update (enable/disable, scopes, secret) |
| `DELETE` | `/companies/:companyId/connectors/:id` | `connectors:manage` | Supprimer (cascade users) |
| `GET` | `/companies/:companyId/connectors/:id/audit` | `connectors:audit` | Audit log |

### Audit log

Toutes les opérations sont auditées dans `oauth_connectors_audit` :

- `connector_created`, `connector_updated`, `connector_deleted`, `connector_enabled`, `connector_disabled`
- `user_connected`, `user_disconnected`, `user_refresh_failed`, `user_token_revoked`
- `redirect_after_rejected` (callback dispatcher a refusé un redirect non-whitelisté — voir H1)
- `token_used` (sampled 1/100, TTL 90 jours)

---

## 3. Guide user — connecter mes comptes

### Workflow UI

1. Aller sur `/settings/accounts`.
2. Pour chaque connecteur configuré par mon admin, je vois mon statut :
   - **Non connecté** → bouton « Connecter » (OAuth) ou « Définir la clé API » (api_key).
   - **Connecté ✓** → bouton « Déconnecter ».
   - **Expiré ⚠** → bouton « Reconnecter ».
   - **Révoqué ✗** → bouton « Reconnecter » (le provider a invalidé mon token).
3. Click « Connecter » (OAuth) → ouvre une fenêtre vers le provider, j'autorise, je suis redirigé vers `/settings/accounts?connected=jira`. Le SSE event `user.connector_status_changed` (visibility `actor-only`) refresh la page.
4. Click « Définir la clé API » (api_key, ex OpenAI) → ouvre un dialog avec un input password, je colle ma clé, submit. La clé n'est jamais stockée en localStorage UI ni loguée serveur (H3 redaction).

### Workflow REST

```http
POST /api/companies/:companyId/me/connect/:connectorId
Authorization: Bearer <user-token>
X-MnM-Permission: mcp:connect

{ "redirectAfter": "/governed-workflows/some-workflow" }
```

Réponse :

```json
{ "authorizeUrl": "https://auth.atlassian.com/authorize?response_type=code&..." }
```

Le UI ouvre cette URL dans un nouveau tab. Le state JWT (HS256, `BETTER_AUTH_SECRET`, TTL 10 min) embarque `companyId + connectorId + userId + redirectAfter`.

### Workflow MCP (agent Claude Code)

Un agent peut aider l'utilisateur à se connecter via les MCP tools :

- `list_connectors()` → liste les connecteurs disponibles.
- `get_connector_status({ connector_id })` → statut perso (connecté / expiré / révoqué). **Jamais le token.**
- `connect_user_to_connector({ connector_id })` → retourne l'URL OAuth signée. L'agent dit à l'utilisateur : « tu n'as pas connecté Jira, voici le lien : … ».
- `wait_for_connection({ connector_id, timeout_s })` — long-poll côté serveur (max 60s) ; retourne dès que le user a complété le flow.
- `set_user_api_key({ connector_id, key })` — pour les connecteurs api_key. **La clé est redactée dans tous les logs (H3).**

---

## 4. Templates — comment créer l'OAuth app côté provider

> 10 templates pré-définis (`server/src/services/connector-templates.ts`). L'admin n'a qu'à coller son `client_id` + `client_secret` après avoir créé l'OAuth app sur le provider. La `redirect_uri` à déclarer côté provider est toujours `{MNM_PUBLIC_URL}/api/connectors/callback`.

### Jira (Atlassian Cloud)

- Console : https://developer.atlassian.com/console/myapps/
- Créer une **OAuth 2.0 (3LO) integration**. Permissions → Jira API → cocher `read:jira-work`, `write:jira-work`, `read:jira-user`, `offline_access` (refresh token).
- Authorization URL : `https://auth.atlassian.com/authorize`
- Token URL : `https://auth.atlassian.com/oauth/token`
- Redirect URI : `{MNM_PUBLIC_URL}/api/connectors/callback`
- Refresh : ✅ supporté (avec scope `offline_access`).

### GitHub (OAuth Apps)

- Settings → Developer settings → **OAuth Apps** → New OAuth App.
- Authorization callback URL : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Scopes : `repo`, `read:user`, `user:email`.
- Refresh : ❌ pas supporté (OAuth Apps issue long-lived tokens). Utiliser une **GitHub App** si refresh requis (flow différent, hors V0).
- Doc : https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app

### GitLab (gitlab.com ou self-hosted)

- Admin Area → Applications → New application.
- Redirect URI : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Scopes recommandés : `api`, `read_user`, `read_repository`, `write_repository`.
- Refresh : ✅ supporté.
- Note : ce connecteur **override** les env vars `GITLAB_OAUTH_*` historiques. Si DB connector `gitlab` enabled → DB wins. Si désactivé/supprimé → fallback env. Voir §3.5 du plan Connectors et T8.2.

### Microsoft 365 / Entra ID

- Azure Portal → App registrations → New registration.
- Redirect URI (Web) : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- API permissions → Microsoft Graph → Delegated → `User.Read`, `offline_access`, `openid`, `profile`, `email`.
- Refresh : ✅ supporté (avec `offline_access`).
- Note : refresh token rotation activée — chaque refresh produit un nouveau `refresh_token`. Le service `connectors.ts` gère ça (`upsertConnectorToken` réécrit le refresh).

### Google Workspace

- https://console.cloud.google.com/apis/credentials → Create credentials → OAuth client ID → Web application.
- Authorized redirect URI : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Activer l'API désirée (Calendar, Drive, Gmail, …) dans Library.
- Scopes recommandés : `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.readonly` (à ajuster).
- Refresh : ✅ supporté (le token de refresh est délivré uniquement à la **première** autorisation — l'utilisateur doit déconnecter+reconnecter si on étend les scopes).
- Doc : https://developers.google.com/identity/protocols/oauth2

### Slack

- https://api.slack.com/apps → Create New App.
- OAuth & Permissions → Redirect URLs : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Bot Token Scopes : `channels:read`, `chat:write`, `users:read` (ajuster selon usage).
- Refresh : ❌ pas supporté en V2 par défaut (long-lived bot token). Activable via **Token Rotation** opt-in (out of scope V0).

### ClickUp

- https://app.clickup.com/settings/team/integrations → Create app.
- Redirect URL : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Pas de scopes granulaires (full access).
- Refresh : ❌ pas supporté.

### Linear

- https://linear.app/settings/api/applications → New OAuth application.
- Callback URLs : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Scopes : `read`, `write`.
- Refresh : ❌ pas supporté.

### Notion

- https://www.notion.so/my-integrations → New integration → **Public integration**.
- Redirect URI : `{MNM_PUBLIC_URL}/api/connectors/callback`.
- Notion utilise un access_token longue durée (pas de refresh).
- Le scope est implicite (l'utilisateur choisit les pages partagées au moment de l'autorisation).

### OpenAI (api_key)

- https://platform.openai.com/api-keys → Create new secret key.
- Pas de flow OAuth — l'utilisateur colle simplement sa clé `sk-...` via `/settings/accounts`.
- La clé est chiffrée AES-256-GCM avant stockage dans `user_api_keys`.
- **Jamais loguée** (H3 redaction obligatoire dans le route handler et MCP tool).

### Custom (provider non-listé)

- Wizard custom → l'admin remplit `authorization_url`, `token_url`, `userinfo_url` (optionnel), `scopes`, `client_id`, `client_secret`.
- Validation stricte côté serveur (HTTPS only, pas IP privée).

---

## 5. Guide auteur de hook / agent — consommer un token user

### Le helper unique : `getUserToken`

Toute feature qui doit appeler une API externe **au nom d'un user** doit passer par ce helper :

```ts
import { connectorService } from "../services/connectors.js";

const svc = connectorService(db);
const { accessToken, expiresAt, scopes, type } = await svc.getUserToken({
  userId,
  companyId,
  providerSlug: "jira",
});

// Utiliser accessToken dans une requête HTTP
const res = await fetch("https://api.atlassian.com/ex/jira/.../issue", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

### Garanties du helper

1. **Cross-tenant guard (C2)** — le helper vérifie EXPLICITEMENT que `userId` appartient à `companyId` via `company_memberships`. Si non → throw `CONNECTOR_USER_NOT_IN_COMPANY`. Empêche un hook isolate du tenant A d'exfiltrer un token du tenant B.
2. **Refresh transparent** — si `expiresAt < now` et qu'un `refresh_token` est disponible, refresh via le `token_url` du connecteur, update DB, retourne le nouveau token. Sinon → throw `CONNECTOR_TOKEN_EXPIRED_NO_REFRESH` ou `CONNECTOR_TOKEN_REVOKED`.
3. **Concurrent-safe (B1)** — `pg_advisory_xact_lock(hashtext('mnm:oauth_refresh:' || tokenRow.id))` autour du refresh. Deux hooks parallèles avec token expiré → 1 seul POST `/token` au provider.
4. **Audit fire-and-forget** — sample 1/100, non-awaited (n'ajoute pas de latency au hot path).
5. **HOST-ONLY** — ce helper ne doit JAMAIS être appelé depuis un isolate (gate-runner / hooks workflow). Les isolates reçoivent uniquement la **réponse HTTP** injectée par `helpers.http({ provider: "jira" })` côté host. Le token brut ne traverse jamais la frontière isolate (cohérent avec [`decision-log.md §4.4`](../decision-log.md)).

### Codes d'erreur ConnectorError

| Code | Quand | Réaction caller |
|---|---|---|
| `CONNECTOR_USER_NOT_IN_COMPANY` | userId ∉ companyId | 403 Forbidden, log warn |
| `CONNECTOR_NOT_CONFIGURED` | Pas de connector enabled pour ce slug | Return 404 ou suggérer admin to configure |
| `CONNECTOR_USER_NOT_CONNECTED` | User n'a jamais autorisé / pas de api_key set | 422, redirect user vers `/settings/accounts` |
| `CONNECTOR_TOKEN_EXPIRED_NO_REFRESH` | Token expiré, pas de refresh dispo | 422, redirect user vers reconnect |
| `CONNECTOR_TOKEN_REVOKED` | Provider a invalidé (refresh 401) | 422, redirect user vers reconnect |
| `CONNECTOR_REFRESH_FAILED` | Erreur réseau / 5xx provider | 502, retry exponentiel |

### Anti-patterns à bannir

- ❌ **Lire `connector_tokens` directement** — toujours passer par `getUserToken`. Sinon : pas d'audit, pas de refresh, pas de cross-tenant guard.
- ❌ **Cacher le token en mémoire** — il peut être révoqué côté provider à tout moment. Re-fetch via `getUserToken` à chaque opération critique.
- ❌ **Logger `accessToken` même tronqué** — interdit, même les 8 premiers caractères. Utiliser `logger.info({ provider, userId }, "...")` sans le token.
- ❌ **Passer le token dans un isolate** — host-only invariant. L'isolate doit appeler `helpers.http({ provider: "jira", path: "..." })` qui résout le token côté host.

---

## 6. Sécurité — defense in depth

| Couche | Garantie |
|---|---|
| **Storage** | Tokens chiffrés AES-256-GCM via `secret-crypto.ts` (clé `MNM_SECRETS_KEY` 32 bytes). Inline 3-column `*_iv`, `*_ciphertext`, `*_tag`. |
| **RLS multi-tenant** | `connector_tokens` + `user_api_keys` ont `tenant_isolation` RESTRICTIVE FORCE sur `company_id`. PERMISSIVE baseline depuis migration `0080_rls_permissive_baseline.sql` (NEW-S1). |
| **Cross-tenant (C2)** | `getUserToken` vérifie `userId ∈ companyId` via `company_memberships` (status='active') AVANT lookup. |
| **OAuth callback (HIGH-A1)** | Re-vérifie `userId ∈ companyId` à l'arrivée du callback (TOCTOU defense — l'appartenance peut avoir été révoquée entre authorize et callback). |
| **OAuth callback (HIGH-A3)** | Tout le workflow callback est dans `db.transaction()` avec `set_config(..., is_local=true)` pour pin la connexion. |
| **State JWT** | Signed HS256 avec `BETTER_AUTH_SECRET`, TTL 10 min, embarque `companyId + connectorId + userId + redirectAfter`. |
| **Redirect whitelist (H1)** | `redirect_after` validé : path relatif `/foo` accepté, `//evil` ou `https://evil.example.com` refusé. Audit `redirect_after_rejected`. |
| **HTTPS only (HIGH-S1)** | En production, `tokenUrl` / `authorizationUrl` doivent être HTTPS. Localhost autorisé en dev. |
| **API key redaction (H3)** | Le route handler `set api-key` et le MCP tool `set_user_api_key` loggent uniquement `{ companyId, connectorId, userId }` (pas le `key`). |
| **Refresh race (B1)** | `pg_advisory_xact_lock` + re-read inside lock. |
| **Null refresh on 401 (MED-B1)** | Si refresh retourne 401, on `null`-e les colonnes `refresh_token_*` pour forcer reconnect propre. |

---

## 7. Migration depuis le pattern hardcodé GitLab/Microsoft (T8.2 follow-up)

Avant Connectors Platform, `server/src/services/governed-workflows.ts:resolveAuthor` choisissait l'identité git via :

1. PAT user-level (table `account` BetterAuth + GitLab providerId).
2. Fallback PAT company-level (`config_layer_items`).
3. Fallback env var `GITLAB_TOKEN`.

**Nouveau pattern** (T8.2, à shipper après ce doc) :

1. `getUserToken(userId, "gitlab", companyId)` → si DB connector `gitlab` enabled → token user.
2. Fallback historique (PAT BetterAuth account / config_layer / env var) — pour migration douce, supprimable une fois tous les pilotes migrés.

Test E2E obligatoire (override + fallback + DB désactivé → re-fallback env) — voir §3.5 du plan.

### 7.1 — Strict mode (`MNM_REQUIRE_USER_CONNECTOR`)

Depuis 2026-05-03, le cascade est en **mode strict par défaut**. Effet :

- Quand `getUserToken` échoue avec `CONNECTOR_NOT_CONFIGURED` ou
  `CONNECTOR_USER_NOT_CONNECTED`, le resolver throw `connectorRequired("gitlab")`
  (HTTP 412, payload `{ code: "CONNECTOR_REQUIRED", connectorSlug, connectFlowUrl }`)
  au lieu de retomber sur le fallback BetterAuth/PAT/env.
- Les actions system-context (`userId === null`, ex: cron, scheduler) ne sont
  pas affectées — elles tombent toujours sur la config company-level.
- Le frontend (`ConnectorRequiredDialog.tsx`) intercepte le payload et
  redirige vers `/settings/accounts?focus={slug}` avec la card highlightée.

**Opt-out** par instance avec `MNM_REQUIRE_USER_CONNECTOR=false` — réservé aux
pilotes qui dépendent encore d'un PAT BetterAuth/env-var le temps que tous
leurs users connectent leur compte depuis `/settings/accounts`.

---

## 8. Troubleshooting

### `CONNECTOR_USER_NOT_IN_COMPANY` lors d'un hook

Le user dont le token est demandé n'est plus membre actif de la company. Vérifier `company_memberships` (`status = 'active'`). Si l'utilisateur a quitté l'org, le hook doit échouer proprement (pas tenter d'utiliser un token orphelin).

### `CONNECTOR_REFRESH_FAILED` répété

Le provider est down, ou `client_id`/`client_secret` ont été rotated côté provider sans update MnM. Vérifier `oauth_connectors_audit` pour `connector_updated` récent. Update via `PATCH /connectors/:id`.

### Le user complète l'OAuth mais reste `non connecté` côté UI

Vérifier que le SSE est bien connecté (`/events/ws` open en réseau). Le callback dispatcher publie `user.connector_status_changed` (visibility `actor-only`) — `LiveUpdatesProvider.tsx` invalide la query `connectors.myAccounts(companyId)`.

Si le tab UI est sur un autre browser que celui qui a fait l'OAuth : refresh manuel — le SSE est session-scoped.

### J'ai changé un connecteur enabled/scopes mais les tokens existants ne sont pas re-issued

Comportement attendu V0. Les tokens issued avant le change utilisent les anciens scopes — ce qui est sûr (pas d'élévation rétroactive). Si on étend les scopes, demander aux users de **déconnecter + reconnecter** via `/settings/accounts`. Bulk re-auth automatique = out of scope V0.

### Le hot-reload BetterAuth ne propage pas le change en cluster

Connu. V0 = single-process accepté. Si Express tourne en cluster (PM2 / Kubernetes replicas), redémarrer la stack après tout `connector_updated`. V1 cible = Postgres `LISTEN/NOTIFY` channel `connector_updated`.

---

## Voir aussi

- [`decision-log.md §4.6`](../decision-log.md) — Connectors Platform decisions
- [`decision-log.md §1.7`](../decision-log.md) — invariant traçabilité humaine
- [`decision-log.md §4.4`](../decision-log.md) — host-only invariant pour les isolates
- Plan Superpowers : [`2026-05-02-mnm-connectors-platform.md`](../superpowers/plans/2026-05-02-mnm-connectors-platform.md)
- [`oauth-setup.md`](oauth-setup.md) — setup OAuth historique (gitlab/microsoft env vars, pre-Connectors)
- Code : `server/src/services/connectors.ts`, `routes/connectors.ts`, `routes/connectors-callback.ts`, `mcp/tools/connectors.tool.ts`
