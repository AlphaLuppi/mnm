# T6 — Secrets & Credentials Audit Summary
**Date:** 2026-04-29  
**Auditor:** Team T6 (whitebox, autonomous)  
**Scope:** MnM monorepo — secrets handling, env vars, logging, Docker, CI, adapters, CLI, DB

---

## Statistics by Severity

| Severity | Count | IDs |
|---|---|---|
| **High** | 4 | SEC-T6-01, SEC-T6-02, SEC-T6-03, SEC-T6-04 |
| **Medium** | 3 | SEC-T6-05, SEC-T6-06, SEC-T6-07, SEC-T6-08 |
| **Low** | 3 | SEC-T6-09, SEC-T6-10, SEC-T6-11 |
| **Info** | 2 | SEC-T6-12, SEC-T6-13 |
| **Total** | 12 | |

---

## Inventory of Critical Env Vars (names only, no values)

### Authentication & JWT
| Variable | Required in | Status |
|---|---|---|
| `BETTER_AUTH_SECRET` | authenticated mode | Documented in `.env.example` (commented), but fallback `"mnm-dev-secret"` still active in code |
| `MNM_AGENT_JWT_SECRET` | non-local deployments | **Missing from `.env.example`**. Hardcoded dev fallback `"mnm-dev-secret"` in `agent-auth-jwt.ts` |
| `MNM_MCP_JWT_SECRET` | authenticated mode | **Missing from `.env.example`**. Hardcoded dev fallback `"mnm-mcp-dev-secret"` in `mcp-auth-config.ts` |

### Encryption Keys
| Variable | Required in | Status |
|---|---|---|
| `MNM_SECRETS_KEY` | production (credential service) | **Missing from `.env.example`**. Ephemeral random key in dev (credential loss on restart) |
| `MNM_SECRETS_MASTER_KEY` | optional (company secrets) | **Missing from `.env.example`**. File-backed fallback exists (`data/secrets/master.key`) |

### OAuth / Social Login
| Variable | Required in | Status |
|---|---|---|
| `GITLAB_OAUTH_CLIENT_ID` | authenticated + GitLab SSO | Documented in `.env.example` (commented) |
| `GITLAB_OAUTH_CLIENT_SECRET` | authenticated + GitLab SSO | Documented in `.env.example` (commented) |
| `GITLAB_OAUTH_ISSUER_URL` | authenticated + GitLab SSO | Documented in `.env.example` (commented) |
| `MICROSOFT_OAUTH_CLIENT_ID` | authenticated + Azure SSO | Not in `.env.example` |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | authenticated + Azure SSO | Not in `.env.example` |
| `MICROSOFT_OAUTH_TENANT_ID` | authenticated + Azure SSO | Not in `.env.example` |

### Storage / External Services
| Variable | Required in | Status |
|---|---|---|
| `RESEND_API_KEY` | email sending | Documented in `.env.example` (commented) |
| `ANTHROPIC_API_KEY` | LLM features | Documented in docker-compose files |
| `OPENAI_API_KEY` | Codex/OpenAI features | Not in `.env.example` |

---

## Redaction Module Coverage Assessment

### `server/src/redaction.ts` — `SECRET_PAYLOAD_KEY_RE`

**Covers:** `api_key`, `api-key`, `apikey`, `access_token`, `access-token`, `auth_token`, `authorization`, `bearer`, `secret`, `passwd`, `password`, `credential`, `jwt`, `private_key`, `cookie`, `connectionstring`

**Gaps identified:**
- `GIT_TOKEN_*` — not matched (pattern requires `access_token` not bare `token`)
- `DATABASE_URL` / `DATABASE_*` — not matched
- `OAUTH` standalone — not matched (only `auth_token` and `authorization` variants)

**Used for:** SSE event payload redaction before broadcast. NOT wired to HTTP request/response logging.

### `packages/adapter-utils/src/server-utils.ts` — `SENSITIVE_ENV_KEY`

**Covers:** `key`, `token`, `secret`, `password`, `passwd`, `authorization`, `cookie`

**Used for:** env var redaction before logging adapter execution context (`redactEnvForLogs()`). Used by `claude-local` and `codex-local` adapters only.

**Coverage gap:** This regex is broader than `SECRET_PAYLOAD_KEY_RE` (catches `GIT_TOKEN_*`), but is only applied in adapter execution logs, not in event payloads.

---

## Top 5 Risks

### 1. `SEC-T6-01` — BetterAuth fallback to "mnm-dev-secret" (HIGH)
A production deployment without `BETTER_AUTH_SECRET` set uses a publicly known constant as the JWT signing secret. Session forgery is trivial. Historical fix attempt was reverted.

### 2. `SEC-T6-03` — HTTP error handler logs raw request body (HIGH)
Failed login attempts, secret creation failures, and validation errors all write the full request body (including plaintext passwords and secret values) to the disk log at debug level. No redaction applied.

### 3. `SEC-T6-04` — Auth tokens in WebSocket URL query string (HIGH)
JWTs appear as `?token=eyJ...` in WebSocket upgrade URLs, making them visible in server logs, reverse proxy logs, and browser history. The `Authorization: Bearer` header path exists but the query param fallback is also supported.

### 4. `SEC-T6-05` — Three production secrets undocumented (MEDIUM→HIGH in ops context)
`MNM_SECRETS_KEY`, `MNM_MCP_JWT_SECRET`, and `MNM_AGENT_JWT_SECRET` are absent from `.env.example`. Operators have no discovery mechanism for these critical variables unless they read the source code.

### 5. `SEC-T6-08` — Ephemeral credential encryption key silently breaks storage (MEDIUM)
Without `MNM_SECRETS_KEY`, the credential service uses a random key per-process. OAuth tokens stored between restarts become permanently unreadable with only a `warn` log. Silent data loss in staging environments.

---

## Strategic Recommendations

### Immediate (block release)
1. **SEC-T6-01**: Remove the unconditional `"mnm-dev-secret"` fallback from `createBetterAuthInstance()`. Gate it on `deploymentMode === "local_trusted"` or throw.
2. **SEC-T6-03**: Wire `sanitizeRecord()` from `redaction.ts` to the `customProps.reqBody` path in `pino-http` configuration.

### Short-term (next sprint)
3. **SEC-T6-04**: Replace WebSocket `?token=` query param auth with short-lived pre-auth tokens (exchange endpoint).
4. **SEC-T6-05**: Document `MNM_SECRETS_KEY`, `MNM_MCP_JWT_SECRET`, `MNM_AGENT_JWT_SECRET`, Microsoft OAuth vars in `.env.example`.
5. **SEC-T6-08**: Add file-backed key persistence to `credential.ts` (mirror `local-encrypted-provider.ts` pattern).

### Medium-term (architecture)
6. **SEC-T6-12**: Implement `kid`-based JWT key rotation with a two-key transition window for zero-downtime secret rotation.
7. **SEC-T6-13**: Consolidate dual encryption keyrings into a single key hierarchy.
8. **SEC-T6-06**: Parameterize `docker-compose.yml` Postgres password via env var.

### Tooling
9. Add `gitleaks` or `detect-secrets` as a pre-commit hook and CI step.
10. Add a startup-time secrets validation pass that checks all required vars are set for the configured deployment mode before accepting HTTP traffic.

---

## Positive Findings (not flagged as issues)

- **`local-encrypted-provider.ts`** uses AES-256-GCM with random 12-byte IV and GCM auth tag — implementation is cryptographically sound.
- **`credential.ts`** also uses AES-256-GCM correctly.
- **Agent JWT** implementation uses `timingSafeEqual` for signature comparison — safe against timing attacks.
- **`redactEnvForLogs()`** is called in both `claude-local` and `codex-local` adapters before writing env to run metadata — correct.
- **Docker build** does NOT copy `.env` into the image (`Dockerfile` uses selective COPY patterns; `.dockerignore` excludes `.env`).
- **Git history** — no `.env` files were ever committed to the repository.
- **`e2e/.auth/`** is correctly gitignored.
- **Backup SQL files** do not contain raw plaintext secrets (credential materials are AES-encrypted JSONB columns).
- **`secretService`** correctly returns only metadata (name, provider, latestVersion) on `list()` — never exposes ciphertext or resolved values via API.
