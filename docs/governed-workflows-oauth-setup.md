# GitLab OIDC Setup for MnM Governed Workflows

## Why

MnM users authenticate with their CBA identity. That identity lives in Azure AD,
but lab.cbainfo.fr is federated to Azure AD — so users authenticate against GitLab
using their existing Microsoft credentials (MFA, Conditional Access, etc.).

When a user saves a workflow definition in MnM, the server commits the
`workflow.json` file to the GitLab repo. Without OIDC, every commit appears as a
bot user (the company-level PAT). With OIDC, each commit is authored by the
individual who clicked Save — full traceability in the GitLab audit log.

## Chain of Trust

```
MnM browser  →  lab.cbainfo.fr  →  Azure AD  ←  user (MFA / Conditional Access)
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
              GitLab audit log: "tom.andrieu pushed workflow.json"
```

## Admin Setup (one-time, on lab.cbainfo.fr)

This is done once by a GitLab admin. No changes needed in Azure AD — the
GitLab ↔ Azure AD federation already exists.

1. Go to **Admin Area → Applications → New application** (or your group's
   Settings → Applications if you want a group-scoped app).

2. Fill in the form:
   - **Name**: `MnM` (or `MnM - Production` / `MnM - Dev` to distinguish envs)
   - **Redirect URIs**:
     ```
     http://localhost:3100/api/auth/callback/gitlab
     https://<mnm-prod-host>/api/auth/callback/gitlab
     ```
     Add all relevant hostnames (staging, prod, dev). Each line is a separate URI.
   - **Scopes**: check `openid`, `profile`, `email`, `api`, `read_repository`,
     `write_repository`.
   - **Mark as Trusted**: yes — this skips the user consent screen. Appropriate
     here because Azure AD has already handled consent upstream and users have no
     meaningful choice to make on a GitLab consent page that mirrors their
     corporate identity.

3. Click **Save application**. You will see:
   - **Application ID** — this is `GITLAB_OAUTH_CLIENT_ID`.
   - **Secret** — this is `GITLAB_OAUTH_CLIENT_SECRET`. Copy it now; it will not
     be shown again.

## MnM Environment Variables

Add these to your `.env` (or secret manager in prod). All three must be set for
the GitLab login button to appear. If any is missing, BetterAuth silently skips
the provider and only email+password login is available.

```env
GITLAB_OAUTH_CLIENT_ID=<application_id_from_lab.cbainfo.fr>
GITLAB_OAUTH_CLIENT_SECRET=<application_secret_from_lab.cbainfo.fr>
GITLAB_OAUTH_ISSUER_URL=https://lab.cbainfo.fr
```

`GITLAB_OAUTH_ISSUER_URL` is the GitLab base URL. BetterAuth's native GitLab
provider derives the auth/token/userinfo endpoints from it:
- `<issuer>/oauth/authorize`
- `<issuer>/oauth/token`
- `<issuer>/api/v4/user`

## How the Token Flows at Commit Time

1. **Sign in**: the user clicks "Sign in with GitLab" on the MnM login page.
   BetterAuth redirects to lab.cbainfo.fr → Azure AD authenticates the user →
   GitLab issues an OAuth2 access_token + refresh_token.

2. **Token storage**: BetterAuth stores the access_token, refresh_token, and
   access_token_expires_at in the `account` table
   (`userId`, `providerId = "gitlab"`).

3. **Workflow save**: the user clicks Save on a workflow definition in the MnM UI
   (or calls the MCP tool). The REST route handler (or MCP tool handler) calls
   `resolveGitProvider({ companyId, userId })`.

4. **Token lookup**: `resolveGitProvider` queries `authAccounts` for a non-expired
   GitLab token for this user. If found, it builds a `GitlabProvider` using the
   user's `access_token` (providerId = `gitlab:user:<userId>`).

5. **Commit**: `GitlabProvider.commitFile()` calls the GitLab REST API with the
   user's token. The commit appears in GitLab as authored by that user. A semver
   tag is pushed pointing at the commit.

6. **Fallback hierarchy** (first match wins):
   ```
   Per-user GitLab OAuth token (authenticated mode + valid token)
     ↓ (no valid user token)
   Company-level config_layer_item (PUT /git-provider-config PAT)
     ↓ (no company config)
   Env vars: GITLAB_BASE_URL + GITLAB_PROJECT_ID + GITLAB_TOKEN
   ```

## Fallback Hierarchy Details

| Level | Source | When used |
|-------|--------|-----------|
| Per-user | `account` table (BetterAuth OAuth) | `authenticated` mode, user has a valid non-expired GitLab token |
| Company-level | `config_layer_items` (git_provider item) | Set via `PUT /companies/:id/governed-workflows/git-provider-config` |
| Env-var | `GITLAB_BASE_URL` / `GITLAB_PROJECT_ID` / `GITLAB_TOKEN` | Dev / fallback; local_trusted default |

Note: in `local_trusted` mode the per-user OAuth path is **never** used, even if
a userId is provided. The resolver goes directly to the company config or env-var
fallback. This keeps the dev workflow unchanged.

## Token Expiry and Refresh

GitLab OAuth2 access tokens expire (typically in 2 hours for lab.cbainfo.fr).
`resolveGitProvider` checks `accessTokenExpiresAt` on every lookup and evicts the
cache entry when the token is expired, falling through to the company-level config.

At this stage, MnM does not attempt silent token refresh (which would require
calling the BetterAuth refresh endpoint from the git-provider resolver, creating
a circular dependency). When the user's token expires:

- Reads and writes that were using the user token fall back to the company-level
  PAT — they continue to work, just without per-user attribution.
- To restore per-user commits, the user simply signs out and signs back in with
  GitLab; BetterAuth issues a fresh token pair.

A future improvement would be to call BetterAuth's `/api/auth/refresh` before the
token expires (e.g. in a background job or on 401 from GitLab).

## Offboarding

When a user is disabled in Azure AD:
- Their next GitLab sign-in attempt fails (Azure AD rejects the federation token).
- Their existing BetterAuth session expires (default session lifetime is 7 days).
- Once the session expires, the user cannot obtain a new GitLab token via MnM.
- Commits that were in-flight before expiry will fall back to the company-level PAT.

No manual action is required in MnM. The Azure AD admin disabling the account
propagates automatically within one session lifetime.

## Dev Mode (local_trusted)

In `local_trusted` mode, no OIDC is involved. Use the existing PAT flow:

```bash
# Set a company-level PAT (restart dev server after):
curl -X PUT http://localhost:3100/api/companies/<companyId>/governed-workflows/git-provider-config \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "gitlab",
    "providerId": "cba-lab",
    "baseUrl": "https://lab.cbainfo.fr",
    "projectId": "tom.andrieu/mnm-workflows-tom",
    "token": "glpat-xxxx"
  }'
```

See `docs/governed-workflows-gitlab-setup.md` for the full PAT walkthrough.

## Troubleshooting

### "GitLab login button does not appear"
Check that all three env vars are set:
```bash
echo $GITLAB_OAUTH_CLIENT_ID
echo $GITLAB_OAUTH_CLIENT_SECRET
echo $GITLAB_OAUTH_ISSUER_URL
```
Any missing or empty var causes BetterAuth to skip the provider silently.

### "callback URL mismatch" on redirect
Verify the redirect URI registered on lab.cbainfo.fr exactly matches the one
BetterAuth uses:
```
<MNM_PUBLIC_URL>/api/auth/callback/gitlab
```
For local dev this is `http://localhost:3100/api/auth/callback/gitlab`.
For prod, the URL must match `MNM_PUBLIC_URL` in your env.

### "scope mismatch / api scope not granted"
Re-open the GitLab application settings on lab.cbainfo.fr and ensure `api`,
`read_repository`, and `write_repository` are checked. Then have users sign out
and sign back in to get a new token with the updated scopes.

### "SSL certificate error" (self-signed cert in dev)
If lab.cbainfo.fr uses a self-signed cert in a dev environment, Node.js will
reject the OIDC token exchange. Set:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```
Never use this in production.

### "commit falls back to company PAT after user logs in"
The user's token may have expired. Check `account.access_token_expires_at` in
the database. The user should sign out and sign back in to get a fresh token.

### "user token returns 401 from GitLab"
Verify the GitLab application on lab.cbainfo.fr is still active and the secret
has not been rotated. If the secret was rotated, update `GITLAB_OAUTH_CLIENT_SECRET`
and restart MnM. Existing sessions will continue using their stored tokens until
those expire; new sign-ins will use the new secret.

---

## Microsoft / Entra ID (Azure AD) provider

Complementary to GitLab OIDC. Enable when you want CBA users without GitLab
access to be able to sign in (non-devs, guest accounts, admin-only users).
The Microsoft login is OIDC-standard and goes directly against
`login.microsoftonline.com` — no GitLab hop in between.

**Tradeoff to know:** the token MnM receives is an Azure/Graph token, NOT a
GitLab token. Users who sign in via Microsoft can view workflows and launch
runs, but `create_governed_workflow` / `update_governed_workflow` will fall
back to the company-level PAT (from `config_layer_items.git_provider`)
because there is no GitLab token associated with their session. For per-user
commit attribution, those users must either:
- Also sign in via GitLab at least once (BetterAuth account linking merges
  the identities — use the "Connect GitLab" button in the MnM profile page).
- Or generate a personal GitLab PAT and attach it via an alternate flow
  (future feature).

### Admin Entra setup (once)

1. Azure Portal → Microsoft Entra ID → App registrations → **New registration**.
2. **Name**: `MnM` (or `MnM - Production`, `MnM - Dev`).
3. **Supported account types**:
   - For single-tenant prod (recommended): "Accounts in this organizational directory only (CBA only)".
   - For multi-tenant dev: "Accounts in any organizational directory + personal Microsoft accounts".
4. **Redirect URI** (Web): `http://localhost:3100/api/auth/callback/microsoft` (dev)
   or `https://<mnm-prod-host>/api/auth/callback/microsoft` (prod).
5. After registration, note the **Application (client) ID** and the **Directory (tenant) ID**.
6. Certificates & Secrets → **New client secret**. Copy the **Value** immediately
   (it is shown only once).
7. API permissions → Add Microsoft Graph delegated permissions: `openid`,
   `profile`, `email`, `User.Read`. Grant admin consent if required by your
   tenant policy.

### MnM env vars

```bash
MICROSOFT_OAUTH_CLIENT_ID=<application (client) id>
MICROSOFT_OAUTH_CLIENT_SECRET=<client secret value>
# Optional: pin to a single Entra tenant for prod. In dev, omit for "common".
# For CBA prod: set to the CBA tenant directory id (GUID shown in Azure Portal).
MICROSOFT_OAUTH_TENANT_ID=<tenant guid or "common" or "organizations">
```

Restart MnM. A "Sign in with Microsoft" button appears alongside email/password
and GitLab (if also configured).

### Behavior by tenantId

- `common` — any Microsoft account, including personal. Dev-friendly, not prod-safe.
- `organizations` — any Azure AD tenant, no personal. Multi-tenant SaaS.
- `<CBA tenant UUID>` — only CBA employees. **Use this in production.** The
  UUID is under Azure Portal → Entra ID → Overview.

### Prompt behavior

MnM sets `prompt=select_account` on the Microsoft authorize request, which
forces the Microsoft account picker every login. Avoids silent SSO picking
the wrong identity when a user has multiple tenants (typical for consultants).

### Offboarding

Same chain as GitLab: when an Entra account is disabled, BetterAuth fails
the next token refresh against `login.microsoftonline.com` and the MnM
session expires. No manual cleanup needed.
