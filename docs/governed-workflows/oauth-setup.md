# OAuth & GitLab Setup pour Governed Workflows

Ce document consolide la configuration OAuth 2.1 (BetterAuth + OIDC GitLab + Microsoft/Entra ID) et la configuration GitLab spécifique (OIDC côté provider et Personal Access Tokens) nécessaires pour faire tourner les Governed Workflows MnM contre un repo GitLab réel comme `gitlab.example.com`.

Il s'adresse à un dev qui n'a jamais setup OAuth pour MnM et couvre :

1. Vue d'ensemble — chaîne de confiance, BetterAuth, OIDC
2. Setup OAuth 2.1 général — variables d'env, fallback hierarchy, expiry des tokens, offboarding
3. Setup GitLab côté provider — création de l'application OIDC sur gitlab.example.com
4. Personal Access Tokens GitLab — config per-company en `local_trusted`
5. Setup Microsoft / Entra ID (complémentaire)
6. Troubleshooting / FAQ

---

## 1. Vue d'ensemble

### Pourquoi OIDC ?

Les utilisateurs MnM s'authentifient avec leur identité entreprise. Cette identité vit dans Azure AD, mais gitlab.example.com est fédéré à Azure AD — donc les utilisateurs s'authentifient contre GitLab via leurs credentials Microsoft existants (MFA, Conditional Access, etc.).

Quand un user sauvegarde une définition de workflow dans MnM, le serveur commit le fichier `workflow.json` dans le repo GitLab. Sans OIDC, chaque commit apparaît comme un bot user (le PAT company-level). Avec OIDC, chaque commit est authored par l'individu qui a cliqué sur Save — full traceability dans l'audit log GitLab.

### Chaîne de confiance

```
MnM browser  →  gitlab.example.com  →  Azure AD  ←  user (MFA / Conditional Access)
                (OIDC provider)     (SAML IdP)
                        |
                        ↓
              BetterAuth stores access_token + refresh_token
              in the `account` table (per BetterAuth userId + providerId="gitlab")
                        |
                        ↓
              resolveGitProvider({ companyId, userId })
              picks up the user's token and constructs a per-user GitlabProvider
                        |
                        ↓
              GitLab commit authored as the user
              GitLab audit log: "your-username pushed workflow.json"
```

### Fallback hierarchy (résumé)

Quand le code résout un GitProvider pour une company donnée, il essaie dans l'ordre :

| Niveau | Source | Quand utilisé |
|--------|--------|---------------|
| Per-user | Table `account` (BetterAuth OAuth) | Mode `authenticated`, user a un token GitLab valide non-expiré |
| Company-level | `config_layer_items` (item `git_provider`) | Configuré via `PUT /companies/:id/governed-workflows/git-provider-config` |
| Env-var | `GITLAB_BASE_URL` / `GITLAB_PROJECT_ID` / `GITLAB_TOKEN` | Dev / fallback ; default en `local_trusted` |

En `local_trusted` mode, le path per-user OAuth n'est **jamais** utilisé, même si un userId est fourni. Le resolver passe directement à la config company ou au fallback env-var. Cela garde le workflow dev inchangé.

---

## 2. Setup OAuth 2.1 général (mode `authenticated`)

### Variables d'environnement MnM

Ajoute ces variables à ton `.env` (ou secret manager en prod). Les trois doivent être set pour que le bouton "Sign in with GitLab" apparaisse. Si l'une manque, BetterAuth skip silencieusement le provider et seul le login email+password est disponible.

```env
GITLAB_OAUTH_CLIENT_ID=<application_id_from_gitlab.example.com>
GITLAB_OAUTH_CLIENT_SECRET=<application_secret_from_gitlab.example.com>
GITLAB_OAUTH_ISSUER_URL=https://gitlab.example.com
```

`GITLAB_OAUTH_ISSUER_URL` est l'URL de base GitLab. Le provider GitLab natif de BetterAuth dérive les endpoints auth/token/userinfo depuis cette URL :

- `<issuer>/oauth/authorize`
- `<issuer>/oauth/token`
- `<issuer>/api/v4/user`

### Comment le token circule au moment d'un commit

1. **Sign in** : l'user clique "Sign in with GitLab" sur la page de login MnM. BetterAuth redirige vers gitlab.example.com → Azure AD authentifie l'user → GitLab émet un access_token + refresh_token OAuth2.

2. **Token storage** : BetterAuth stocke `access_token`, `refresh_token`, et `access_token_expires_at` dans la table `account` (`userId`, `providerId = "gitlab"`).

3. **Workflow save** : l'user clique Save sur une définition de workflow dans l'UI MnM (ou appelle le tool MCP). Le route handler REST (ou MCP tool handler) appelle `resolveGitProvider({ companyId, userId })`.

4. **Token lookup** : `resolveGitProvider` query `authAccounts` pour un token GitLab non-expiré pour cet user. S'il en trouve un, il construit un `GitlabProvider` avec l'`access_token` de l'user (providerId = `gitlab:user:<userId>`).

5. **Commit** : `GitlabProvider.commitFile()` appelle l'API REST GitLab avec le token de l'user. Le commit apparaît dans GitLab comme authored par cet user. Un tag semver est pushé pointant sur le commit.

6. **Fallback hierarchy** (premier match gagne) :
   ```
   Per-user GitLab OAuth token (mode authenticated + valid token)
     ↓ (no valid user token)
   Company-level config_layer_item (PUT /git-provider-config PAT)
     ↓ (no company config)
   Env vars: GITLAB_BASE_URL + GITLAB_PROJECT_ID + GITLAB_TOKEN
   ```

### Token expiry et refresh

Les access tokens OAuth2 GitLab expirent (typiquement 2 heures pour gitlab.example.com). `resolveGitProvider` vérifie `accessTokenExpiresAt` à chaque lookup et évince l'entrée du cache quand le token est expiré, en tombant sur la config company-level.

À ce stade, MnM ne tente pas de silent refresh (qui requerrait d'appeler le BetterAuth refresh endpoint depuis le git-provider resolver, créant une dépendance circulaire). Quand le token de l'user expire :

- Reads et writes qui utilisaient le user token tombent sur le PAT company-level — ils continuent à marcher, juste sans attribution per-user.
- Pour restaurer les commits per-user, l'user signe simplement out et signe back in avec GitLab ; BetterAuth émet une nouvelle paire de tokens.

Une amélioration future serait d'appeler `/api/auth/refresh` de BetterAuth avant l'expiration du token (e.g. en background job ou sur 401 de GitLab).

### Offboarding

Quand un user est désactivé dans Azure AD :

- Sa prochaine tentative de sign-in GitLab échoue (Azure AD reject le federation token).
- Sa session BetterAuth existante expire (default session lifetime = 7 jours).
- Une fois la session expirée, l'user ne peut plus obtenir un nouveau token GitLab via MnM.
- Les commits in-flight avant l'expiration tombent sur le PAT company-level.

Aucune action manuelle requise dans MnM. La désactivation Azure AD propage automatiquement dans la fenêtre d'une session lifetime.

---

## 3. Setup GitLab côté provider (gitlab.example.com)

### Admin Setup (one-time, sur gitlab.example.com)

Fait une seule fois par un GitLab admin. Pas de changement nécessaire dans Azure AD — la fédération GitLab ↔ Azure AD existe déjà.

1. Va dans **Admin Area → Applications → New application** (ou Settings → Applications de ton groupe si tu veux une app group-scoped).

2. Remplis le formulaire :
   - **Name** : `MnM` (ou `MnM - Production` / `MnM - Dev` pour distinguer les envs)
   - **Redirect URIs** :
     ```
     http://localhost:3100/api/auth/callback/gitlab
     https://<mnm-prod-host>/api/auth/callback/gitlab
     ```
     Ajoute tous les hostnames pertinents (staging, prod, dev). Chaque ligne est une URI séparée.
   - **Scopes** : check `openid`, `profile`, `email`, `api`, `read_repository`, `write_repository`.
   - **Mark as Trusted** : oui — ça skip l'écran de consent user. Approprié ici parce qu'Azure AD a déjà handle le consent en amont et les users n'ont pas de choix significatif à faire sur une page de consent GitLab qui mirror leur identité corporate.

3. Click **Save application**. Tu vas voir :
   - **Application ID** — c'est `GITLAB_OAUTH_CLIENT_ID`.
   - **Secret** — c'est `GITLAB_OAUTH_CLIENT_SECRET`. Copie-le maintenant ; il ne sera plus jamais affiché.

---

## 4. Personal Access Tokens GitLab (mode `local_trusted` ou fallback company)

Par défaut, en mode `local_trusted`, MnM stocke les `workflow.json` dans un repo bare local (`~/.mnm/dev-workflows-bare/repo.git`). Cette section explique comment pointer une company vers un **vrai** repo GitLab — par exemple `https://gitlab.example.com/your-username/mnm-workflows-demo` — pour que `create_governed_workflow` (UI + MCP) y commit directement.

Le mécanisme est per-company via un `config_layer_item` de type `git_provider`.

### Prérequis

1. **Un repo GitLab vide**. Va sur https://gitlab.example.com, crée un projet (ex. `mnm-workflows-demo`) initialisé avec un README. Note son **path** (`your-username/mnm-workflows-demo`) ou son **numeric project ID** (visible dans Settings → General).

2. **Un Personal Access Token (PAT)** avec les scopes :
   - `api`
   - `read_repository`
   - `write_repository`

   GitLab → User Settings → Access Tokens → Create token. **Copie-le immédiatement** — GitLab ne le ré-affiche pas.

3. **Le companyId MnM** que tu veux configurer. En local :
   ```bash
   curl -sS http://localhost:3100/api/companies | jq -r '.[0].id'
   # ex: 00000000-0000-4000-8000-000000000001
   ```

### Configuration

Un seul appel REST `PUT /api/companies/:companyId/governed-workflows/git-provider-config`. Idempotent — ré-exécuter met à jour la config existante.

```bash
export COMPANY_ID="00000000-0000-4000-8000-000000000001"
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxx"

curl -sS -X PUT \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/git-provider-config" \
  -H "Content-Type: application/json" \
  -d "{
    \"kind\": \"gitlab\",
    \"providerId\": \"gitlab-self-hosted\",
    \"baseUrl\": \"https://gitlab.example.com\",
    \"projectId\": \"your-username/mnm-workflows-demo\",
    \"token\": \"$GITLAB_TOKEN\"
  }"
```

Réponse attendue :

```json
{
  "ok": true,
  "kind": "gitlab",
  "layerId": "...",
  "restartRequired": true,
  "hint": "The resolveGitProvider cache is process-lifetime — restart the MnM dev server once for this change to take effect."
}
```

### Restart requis

Le `createResolveGitProvider` cache le `GitProvider` par `companyId` au premier appel et ne l'invalide jamais. Tu dois donc **redémarrer `bun run dev` une fois** après cette config pour que les prochains `create_governed_workflow` / `launch_governed_step` utilisent GitLab.

### Vérification

Après restart :

```bash
# 1. Crée un workflow — il doit commit sur gitlab.example.com
curl -sS -X POST \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "definition": {
      "apiVersion": "mnm/v1",
      "kind": "GovernedWorkflow",
      "name": "gitlab-smoke",
      "description": "Smoke test pour vérifier le push GitLab",
      "steps": [{"id":"s1","agent":"claude_code","prompt_context":{"task":"echo"}}]
    },
    "commitMessage": "feat(gitlab-smoke): initial"
  }'
```

Réponse attendue : `{commitSha, newGitTag: "gitlab-smoke/v1.0.0", created: true}`.

Puis va voir ton repo GitLab : tu dois trouver le fichier `gitlab-smoke/workflow.json` sur `main` et le tag `gitlab-smoke/v1.0.0`.

### Rollback vers le local bare repo

```bash
curl -sS -X PUT \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/git-provider-config" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "local",
    "providerId": "local:dev",
    "repoDir": "/Users/your-username/.mnm/dev-workflows-bare/repo.git"
  }'
```

(Adapter le chemin pour Windows : `C:/Users/your-username/.mnm/dev-workflows-bare/repo.git`.)

Puis redémarrer le dev server.

### Sécurité

- Le PAT est stocké **en clair** dans `config_layer_items.config_json` (JSONB). Ne commit jamais le PAT ailleurs. En prod, utiliser un secret manager.
- Le endpoint `PUT /git-provider-config` est gardé par `workflows:create`. En production, préférer une permission admin dédiée.
- Le PAT a accès à **toute la portée** de ses scopes sur GitLab — ne pas le réutiliser pour d'autres usages.

### Prod vs dev

- En `local_trusted` (dev), fallback = local bare repo. Override = cette section.
- En `authenticated` (prod), il n'y a pas de fallback utile — chaque company DOIT avoir son `git_provider` configuré, sinon `GIT_PROVIDER_MISCONFIG` à la première requête. Prévoir un onboarding qui exige cette config.

### Dev mode rappel

En `local_trusted` mode, pas d'OIDC impliqué. Use le flow PAT existant :

```bash
# Set un PAT company-level (restart dev server après) :
curl -X PUT http://localhost:3100/api/companies/<companyId>/governed-workflows/git-provider-config \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "gitlab",
    "providerId": "gitlab-self-hosted",
    "baseUrl": "https://gitlab.example.com",
    "projectId": "your-username/mnm-workflows-demo",
    "token": "glpat-xxxx"
  }'
```

---

## 5. Microsoft / Entra ID (Azure AD) provider

Complémentaire au GitLab OIDC. Active-le quand tu veux que les users of your enterprise sans accès GitLab puissent sign in (non-devs, guest accounts, admin-only users). Le login Microsoft est OIDC-standard et va directement contre `login.microsoftonline.com` — pas de hop GitLab entre.

**Tradeoff à connaître** : le token reçu par MnM est un token Azure/Graph, PAS un token GitLab. Les users qui sign in via Microsoft peuvent voir les workflows et lancer des runs, mais `create_governed_workflow` / `update_governed_workflow` tomberont sur le PAT company-level (depuis `config_layer_items.git_provider`) parce qu'il n'y a pas de token GitLab associé à leur session. Pour avoir l'attribution de commit per-user, ces users doivent soit :

- Aussi sign in via GitLab au moins une fois (BetterAuth account linking merge les identités — use le bouton "Connect GitLab" dans la page profile MnM).
- Soit générer un PAT GitLab personnel et l'attacher via un alternate flow (future feature).

### Admin Entra setup (once)

1. Azure Portal → Microsoft Entra ID → App registrations → **New registration**.
2. **Name** : `MnM` (ou `MnM - Production`, `MnM - Dev`).
3. **Supported account types** :
   - Pour single-tenant prod (recommended) : "Accounts in this organizational directory only (your-org only)".
   - Pour multi-tenant dev : "Accounts in any organizational directory + personal Microsoft accounts".
4. **Redirect URI** (Web) : `http://localhost:3100/api/auth/callback/microsoft` (dev) ou `https://<mnm-prod-host>/api/auth/callback/microsoft` (prod).
5. Après registration, note l'**Application (client) ID** et le **Directory (tenant) ID**.
6. Certificates & Secrets → **New client secret**. Copie la **Value** immédiatement (elle n'est affichée qu'une fois).
7. API permissions → Add Microsoft Graph delegated permissions : `openid`, `profile`, `email`, `User.Read`. Grant admin consent si requis par ta tenant policy.

### MnM env vars

```bash
MICROSOFT_OAUTH_CLIENT_ID=<application (client) id>
MICROSOFT_OAUTH_CLIENT_SECRET=<client secret value>
# Optional: pin to a single Entra tenant for prod. In dev, omit for "common".
# For enterprise prod: set to the enterprise tenant directory id (GUID shown in Azure Portal).
MICROSOFT_OAUTH_TENANT_ID=<tenant guid or "common" or "organizations">
```

Restart MnM. Un bouton "Sign in with Microsoft" apparaît à côté de email/password et GitLab (si aussi configuré).

### Behavior par tenantId

- `common` — n'importe quel compte Microsoft, y compris perso. Dev-friendly, pas prod-safe.
- `organizations` — n'importe quel tenant Azure AD, pas de perso. Multi-tenant SaaS.
- `<enterprise tenant UUID>` — uniquement employés EnterpriseCustomer. **Use this in production.** Le UUID est sous Azure Portal → Entra ID → Overview.

### Prompt behavior

MnM set `prompt=select_account` sur la requête authorize Microsoft, ce qui force le picker de compte Microsoft à chaque login. Évite que le SSO silencieux pick la mauvaise identité quand un user a plusieurs tenants (typique pour les consultants).

### Offboarding

Même chaîne que GitLab : quand un compte Entra est désactivé, BetterAuth fail le prochain refresh de token contre `login.microsoftonline.com` et la session MnM expire. Pas de cleanup manuel nécessaire.

---

## 6. Troubleshooting

### OAuth GitLab

#### "GitLab login button does not appear"

Vérifie que les trois env vars sont set :

```bash
echo $GITLAB_OAUTH_CLIENT_ID
echo $GITLAB_OAUTH_CLIENT_SECRET
echo $GITLAB_OAUTH_ISSUER_URL
```

N'importe laquelle missing ou empty cause à BetterAuth de skip silencieusement le provider.

#### "callback URL mismatch" sur le redirect

Vérifie que la redirect URI enregistrée sur gitlab.example.com match exactement celle utilisée par BetterAuth :

```
<MNM_PUBLIC_URL>/api/auth/callback/gitlab
```

Pour le local dev c'est `http://localhost:3100/api/auth/callback/gitlab`. Pour la prod, l'URL doit match `MNM_PUBLIC_URL` dans ton env.

#### "scope mismatch / api scope not granted"

Re-ouvre les settings de l'application GitLab sur gitlab.example.com et assure-toi que `api`, `read_repository`, et `write_repository` sont checked. Puis fais sign out / sign back in les users pour avoir un nouveau token avec les scopes updated.

#### "SSL certificate error" (self-signed cert en dev)

Si gitlab.example.com utilise un cert self-signed en environnement dev, Node.js va reject l'OIDC token exchange. Set :

```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Ne jamais utiliser ça en production.

#### "commit falls back to company PAT after user logs in"

Le token de l'user a peut-être expiré. Check `account.access_token_expires_at` dans la DB. L'user devrait sign out et sign back in pour avoir un fresh token.

#### "user token returns 401 from GitLab"

Vérifie que l'application GitLab sur gitlab.example.com est encore active et que le secret n'a pas été rotated. Si le secret a été rotated, update `GITLAB_OAUTH_CLIENT_SECRET` et restart MnM. Les sessions existantes vont continuer à utiliser leurs tokens stockés jusqu'à expiry ; les nouveaux sign-ins utiliseront le nouveau secret.

### PAT GitLab / git-provider-config

| Symptôme | Cause probable | Fix |
|---|---|---|
| Réponse `GIT_PROVIDER_MISCONFIG` au prochain create | Un champ obligatoire est vide dans `configJson` | Re-PUT avec tous les champs (baseUrl, projectId, token, providerId) |
| `401 Unauthorized` depuis le `commitFile` | Scopes PAT insuffisants | Regénère un PAT avec `api` + `read_repository` + `write_repository` |
| `403 Forbidden` sur `createTag` | Branche `main` protégée sur GitLab OU PAT sans `write_repository` | Autorise les push de tag sur `main` dans Settings → Repository → Protected branches / tags |
| `404 Not Found` sur `POST /projects/:id/repository/...` | Mauvais `projectId` | Utilise soit le numeric ID (visible sur la page du projet), soit le path URL-encodé `your-username%2Fmnm-workflows-demo` |
| Les anciens workflows (local) ont disparu de `list_governed_workflows` | Normal : MnM ne liste que ce qui est dans le provider actuel. Les rows DB pointent encore vers l'ancien sha/tag et ne trouveront plus les fichiers | Soit tu archives les anciennes rows, soit tu les recrées dans GitLab |
| Changement pas pris en compte | Cache `resolveGitProvider` pas invalidé | **Redémarre `bun run dev`** après chaque PUT git-provider-config |
