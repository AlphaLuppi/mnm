# CONF-S04 — OAuth + MCP Credentials

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONF-S04 |
| **Titre** | OAuth + MCP Credentials — AES-256-GCM, PKCE flow, popup postMessage |
| **Epic** | Epic CONF — Config Layers |
| **Effort** | M (5 SP, 2-3j) |
| **Priorite** | P1 — Necessaire pour les MCP servers OAuth (non-bloquant pour le reste de l'epic) |
| **Assignation** | Tom |
| **Bloque par** | CONF-S01 (table user_mcp_credentials) |
| **Debloque** | CONF-S05 (McpOAuthConnectButton UI) |
| **Statut** | DONE |
| **Type** | Backend (services crypto + OAuth routes) |

---

## Contexte

Certains MCP servers necessitent une authentification OAuth2 (ex : GitHub, Notion, Google Drive). L'utilisateur doit autoriser MnM a acceder a ces services en son nom. Les tokens OAuth ne doivent jamais etre stockes en clair en DB.

Cette story implemente :
1. **Stockage securise** : chiffrement AES-256-GCM des tokens OAuth dans `user_mcp_credentials`
2. **Flow OAuth2 PKCE** : autorisation via popup navigateur avec postMessage de retour
3. **Gestion du cycle de vie** : refresh automatique des tokens expires, revocation

Le PKCE (Proof Key for Code Exchange) est le standard recommande pour les flows OAuth natifs/SPA. Il evite l'exposition du `client_secret` cote client.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| CONF-S01 | DONE | Table `user_mcp_credentials` avec colonnes encryptedToken, encryptedRefreshToken, expiresAt |
| MU-S01 | DONE | Systeme d'auth utilisateur, userId disponible dans le contexte de requete |
| RBAC-S01 | DONE | requirePermission('mcp:connect') middleware |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Stockage chiffre AES-256-GCM

**Given** un token OAuth recu lors du callback
**When** `storeCredential(userId, mcpServerId, tokenData)` est appele
**Then** le token access et le refresh token sont chiffres individuellement en AES-256-GCM avec un IV aleatoire de 12 bytes
**And** le texte chiffre (IV + tag + ciphertext en base64) est stocke dans `encryptedToken` et `encryptedRefreshToken`
**And** le token en clair n'est jamais logue ni stocke en DB

**Given** une cle de chiffrement `MNM_ENCRYPTION_KEY` non definie dans l'env
**When** le service demarre
**Then** une erreur est levee au demarrage (fail-fast)

### AC2 — Dechiffrement a la lecture

**Given** un credential stocke en DB
**When** `getCredential(userId, mcpServerId)` est appele
**Then** le token chiffre est dechiffre et retourne en memoire (jamais serialise en JSON de reponse API)

**Given** une corruption du token stocke (IV invalide ou tag d'authentification incorrect)
**When** `getCredential()` est appele
**Then** une erreur `CredentialDecryptionError` est levee et le credential est marque comme invalide

### AC3 — Flow OAuth2 PKCE : etape authorize

**Given** un user avec permission `mcp:connect`
**When** il fait `GET /api/mcp/oauth/authorize?mcpServerId=xxx`
**Then** un `code_verifier` (64 bytes aleatoires en base64url) est genere et stocke en session
**And** un `code_challenge` (SHA-256 du code_verifier en base64url) est calcule
**And** la reponse retourne l'URL d'autorisation du provider avec `code_challenge`, `code_challenge_method=S256`, `redirect_uri`, et `state`

### AC4 — Flow OAuth2 PKCE : callback

**Given** le provider OAuth qui redirige vers `/api/mcp/oauth/callback?code=xxx&state=yyy`
**When** le callback est traite
**Then** le `code_verifier` est recupere de la session via le `state`
**And** l'echange code → token est effectue avec le `code_verifier`
**And** le token est stocke chiffre via `storeCredential()`
**And** la page de callback emet `window.opener.postMessage({status: 'success', mcpServerId}, origin)` et se ferme

**Given** une erreur du provider (access_denied, invalid_grant)
**When** le callback est traite
**Then** `window.opener.postMessage({status: 'error', error: 'access_denied'}, origin)` est emis

### AC5 — Refresh automatique

**Given** un credential avec `expiresAt` dans moins de 5 minutes
**When** `getCredential()` est appele
**Then** `refreshCredential()` est appele automatiquement avant de retourner le token

**Given** un refresh token invalide (revoque cote provider)
**When** `refreshCredential()` echoue avec 401
**Then** le credential est marque comme `status: 'expired'` en DB et une erreur `CredentialExpiredError` est levee

### AC6 — Revocation

**Given** un user qui veut deconnecter un MCP server
**When** `DELETE /api/mcp/credentials/:mcpServerId`
**Then** le token est revoque cote provider (appel a l'endpoint de revocation si supporte)
**And** le credential est supprime de `user_mcp_credentials`

### AC7 — Liste des credentials connectes

**Given** un user
**When** `GET /api/mcp/credentials`
**Then** la liste de ses MCP servers connectes est retournee avec `{mcpServerId, providerName, connectedAt, expiresAt, status}` — sans les tokens

---

## Deliverables

### D1 — Service `server/src/services/mcp-credential.ts`

Fonctions :
- `storeCredential(userId, companyId, mcpServerId, providerName, tokenData)` — chiffre et stocke
- `getCredential(userId, companyId, mcpServerId)` — dechiffre et retourne (avec auto-refresh si proche expiration)
- `refreshCredential(userId, companyId, mcpServerId)` — echange refresh_token contre nouveau access_token
- `revokeCredential(userId, companyId, mcpServerId)` — revoke + supprime
- `listCredentials(userId, companyId)` — liste sans tokens (metadonnees seulement)
- `encrypt(plaintext, key)` — AES-256-GCM, retourne `${iv}:${tag}:${ciphertext}` en base64
- `decrypt(encrypted, key)` — inverse de encrypt, leve CredentialDecryptionError si invalide

### D2 — Service `server/src/services/mcp-oauth.ts`

Fonctions :
- `getAuthorizationUrl(mcpServerId, userId, redirectUri)` — genere URL + code_challenge, stocke verifier en session
- `handleCallback(code, state, sessionData)` — echange code → token, appelle storeCredential
- `buildProviderConfig(mcpServerId)` — retourne {authorizationUrl, tokenUrl, revokeUrl, clientId, scopes} depuis la config MCP server item

### D3 — Routes `server/src/routes/mcp-oauth.ts`

```
GET    /api/mcp/oauth/authorize              — genere URL d'autorisation
GET    /api/mcp/oauth/callback               — callback provider, stocke token, postMessage
GET    /api/mcp/credentials                  — liste credentials de l'user
DELETE /api/mcp/credentials/:mcpServerId     — revoquer
```

### D4 — Types `packages/shared/src/types/mcp-credential.ts`

- `McpCredential` — metadonnees (sans token en clair)
- `McpCredentialStatus` — 'active' | 'expired' | 'invalid'
- `OAuthCallbackResult` — payload du postMessage

---

## Notes techniques

- **Cle de chiffrement** : `MNM_ENCRYPTION_KEY` doit etre une chaine de 32 bytes minimum (256 bits). Derivee via `crypto.scryptSync` si la valeur brute n'est pas 32 bytes exactement.
- **IV aleatoire** : `crypto.randomBytes(12)` par operation de chiffrement. Ne jamais reutiliser un IV avec la meme cle pour GCM.
- **Format stocke** : `base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)`. Parsing au dechiffrement par split(':').
- **State CSRF** : le `state` OAuth est un UUID v4 genere par authorize, stocke en session (cle = `oauth_state_${state}`), verifie dans le callback pour prevenir les attaques CSRF.
- **Popup pattern** : le frontend ouvre `window.open(authUrl, 'mcp_oauth', 'width=600,height=700')`. Le callback ferme le popup avec `window.close()` apres le postMessage. Timeout cote parent si le popup est ferme sans postMessage (user a annule).
- **Provider config** : les URLs OAuth (authorizationUrl, tokenUrl) sont stockees dans `config_layer_items.itemValue` pour les items de type `mcp_server`. Le service `mcp-oauth.ts` lit cette config depuis la DB.
- **Pas de client_secret cote client** : le PKCE elimine le besoin du client_secret pour les flows publics. Pour les flows confidentiels (server-to-server), le client_secret est stocke dans les env vars du serveur, jamais expose a l'UI.
