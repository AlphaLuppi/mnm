# T11 — Wildcard Creative Recon: Security Audit Summary

**Date**: 2026-04-29  
**Auditor**: Team T11 — Wildcard Creative Recon  
**Scope**: Full codebase, focus on business logic, race conditions, side-channels, crypto misuse, MnM-specific patterns  
**Repo root**: `C:/Users/andri/IdeaProjects/AlphaLuppi/mnm`

---

## Stats by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 1 | SEC-T11-01 |
| High     | 3 | SEC-T11-02, SEC-T11-03, SEC-T11-04 |
| Medium   | 4 | SEC-T11-05, SEC-T11-06, SEC-T11-07, SEC-T11-08 |
| Low      | 2 | SEC-T11-09, SEC-T11-10, SEC-T11-11 |
| Info     | 4 | SEC-T11-12, SEC-T11-13, SEC-T11-14, SEC-T11-15 |

_(Note: SEC-T11-09 through SEC-T11-11 span medium/low; counts above use per-finding severity)_

**Total findings**: 15

---

## Angles Explored

| # | Angle | Finding | Notes |
|---|-------|---------|-------|
| 1 | Mass assignment / metadata injection on agents | SEC-T11-01 (CRITICAL) | `metadata.isCAO` can be set by any user with AGENTS_CONFIGURE |
| 2 | SSRF via company portability import | SEC-T11-02 (HIGH) | `type:"url"` fetches arbitrary server-side URLs |
| 3 | RBAC privilege escalation via bypassTagFilter | SEC-T11-03 (HIGH) | Users with ROLES_MANAGE can create admin-visibility roles |
| 4 | Webhook secret storage | SEC-T11-04 (HIGH) | Secrets stored plaintext, not hashed |
| 5 | Board claim race condition (TOCTOU) | SEC-T11-05 (MEDIUM) | Non-atomic check-then-act on in-memory singleton |
| 6 | Agent permission inheritance stale cache | SEC-T11-06 (MEDIUM) | Suspended users' agents retain permissions for 5 minutes |
| 7 | E2E mode production bypass | SEC-T11-07 (MEDIUM) | MNM_E2E_SEED grants instant instance_admin |
| 8 | LLM prompt injection via workflow content | SEC-T11-08 (MEDIUM) | Raw workflow.json embedded in system prompt |
| 9 | Deployment proxy CORS wildcard + auth bypass | SEC-T11-09 (MEDIUM) | CORS:* + stale cache + possible actor check bypass |
| 10 | HTTP adapter SSRF | SEC-T11-10 (MEDIUM) | Agent-configured URLs can probe internal network |
| 11 | Hardcoded JWT dev secret | SEC-T11-11 (LOW) | "mnm-dev-secret" is public knowledge |
| 12 | pg_advisory_lock 32-bit hash collisions | SEC-T11-12 (INFO) | Cross-tenant timing side channel (low practical risk) |
| 13 | AI rate limit anon bucket sharing | SEC-T11-13 (INFO) | Agent AI requests share same concurrency bucket |
| 14 | Board claim timing oracle | SEC-T11-14 (INFO) | Non-constant-time comparison (negligible entropy) |
| 15 | Tag read endpoints missing permission check | SEC-T11-15 (INFO) | Agents tag endpoint lacks assertCompanyAccess |

### Checked, No Finding (RAS)

- **Drizzle ORM `inArray(x, [])`**: Only found in `not(inArray(...))` pattern with explicit empty-array guard. No unchecked `inArray(x, [])` calls that would match all rows.
- **Math.random() for security tokens**: All production security tokens use `crypto.randomBytes()`. `Math.random()` is only used for non-security purposes (test suffixes, instance IDs, simulated latency).
- **UUID v1 usage**: No `uuidv1` found; all UUIDs use `crypto.randomUUID()` (v4) or database-generated UUIDs.
- **AES-CBC / ECB / static IV**: No direct AES usage found. Encryption goes through the `credential.ts` / `local-encrypted-provider.ts` wrappers.
- **`eq(x, undefined)` Drizzle bug**: No production code passes `undefined` directly to `eq()` without a guard. The `tagFilterService` uses `[...scope.tagIds]` spread which would throw before reaching the ORM if empty (protected by `tagIds.size === 0` check).
- **`@cao` user name spoofing**: The agent mention handler routes by `agentId` (UUID), not by display name. A user named "cao" cannot intercept CAO-directed messages.
- **bcrypt rounds**: MnM uses BetterAuth for password hashing; no custom bcrypt. BetterAuth defaults to appropriate rounds.
- **JWT algorithm confusion (none/RS256)**: The custom JWT only accepts `"HS256"` (`header.alg !== JWT_ALGORITHM`). The `none` algorithm is not accepted.
- **Replay window for webhook**: The 300s default is on the large side but not a critical issue given HMAC is correctly implemented.
- **Tag cross-tenant ID collision**: Tags are UUID v4 per company; global uniqueness is guaranteed. No cross-tenant tag ID collision possible.
- **ZIP/decompression bomb on import**: The portability import only fetches URLs and parses JSON/Markdown. No archive decompression found.
- **ReDoS patterns**: Scanned all regex on user input; only simple patterns found (`/^[A-Za-z0-9._-]+$/`, `/^[0-9a-f-]{36}/`). No catastrophic backtracking patterns.
- **Unicode normalization / homoglyph in emails**: SSO email handling normalizes to lowercase via `.toLowerCase()`. BetterAuth handles its own email normalization. Not perfect but not exploitable in the observed flows.

---

## Top 5 Findings

### 1. SEC-T11-01 (CRITICAL) — metadata.isCAO Mass Assignment
Any user with `AGENTS_CONFIGURE` can set `metadata.isCAO: true` on an agent with `adapterType: "claude_local"`, creating a hidden agent that participates in CAO watchdog flows. The `updateAgentSchema` accepts `metadata: z.record(z.unknown())` with no field stripping.

**Fix effort**: ~10 minutes (add 3 lines to strip `isCAO` from `patchData.metadata` in `routes/agents.ts`).

### 2. SEC-T11-02 (HIGH) — Company Import SSRF
Any authenticated company member can trigger server-side HTTP fetches to arbitrary URLs (including internal services) via `POST /api/companies/import/preview` with `source.type: "url"`. The Zod schema only checks `z.string().url()` — no private IP restriction. The `private-hostname-guard` middleware does not protect outbound calls.

**Fix effort**: ~2 hours (add URL validation function that resolves DNS and checks against blocklist).

### 3. SEC-T11-03 (HIGH) — bypassTagFilter Role Escalation
Any user with `ROLES_MANAGE` can create a role with `bypassTagFilter: true` (the admin-level visibility flag) and assign it to themselves, defeating the entire tag-based isolation model. The hierarchy check only prevents creating roles *above* the actor's level, not granting themselves admin visibility at the same level.

**Fix effort**: ~30 minutes (add bypassTagFilter guard in `POST /roles` and `PATCH /roles/:id`).

### 4. SEC-T11-04 (HIGH) — Webhook Secrets in Plaintext
Webhook trigger secrets are stored as raw hex strings in `routine_triggers.secret_hash`. Despite the "hash" naming, no KDF or encryption is applied. A DB read exposes all webhook secrets for all tenants.

**Fix effort**: ~4 hours (implement at-rest encryption using the existing `MNM_SECRETS_MASTER_KEY` infrastructure).

### 5. SEC-T11-07 (MEDIUM) — E2E Mode Production Bypass
`MNM_E2E_SEED=true` disables all rate limiting and exposes `POST /api/e2e-seed/ensure-access` which grants `instance_admin` to any authenticated user. If accidentally set in production, full platform compromise.

**Fix effort**: ~1 hour (add startup guard + secondary secret requirement).

---

## Pistes pour audit follow-up

These patterns are suspected but require dynamic testing or deeper code review to confirm:

1. **Concurrent workflow cancel+reactivate**: The `FOR UPDATE` locking is correct for cancel/reactivate, but there may be a window between `cancelRun` setting `cancelledAt` and the caller's live-event publish where a reactivate call can observe an inconsistent state. Needs load testing.

2. **Company portability agent `adapterConfig` passthrough**: The portability import writes agent `adapterConfig` directly from the bundle. If the source is attacker-controlled (SEC-T11-02), arbitrary `adapterConfig` fields (including URLs, scripts) are written to agents. Chained with SEC-T11-10, this could create HTTP adapter agents pointing to internal services.

3. **Tag assignment cross-company via tagIds in PUT /agents/:id/tags**: The endpoint replaces tag assignments using `tagIds` from the request body but does not verify that each `tagId` belongs to the `companyId`. An attacker could potentially assign tags from other companies to their agents if they know the UUIDs. Needs verification of whether the DB FK constraint or RLS prevents this.

4. **`resolveResourcePath` in `git-resource-path.ts`**: The `rejectTraversal` function is called for the base path and workflow name. However, the `resolveResourcePath` function was not fully audited for all edge cases in how it handles URL-encoded paths passed via HTTP wildcard params. Dynamic fuzzing recommended.

5. **AI assistant `<file>` proposal with workflow-relative paths that escape via symlinks**: The path validation (`SAFE_SEGMENT`) prevents `../` but not symlink attacks if the git provider resolves symlinks. Depends on git provider implementation.

6. **Agent config revision rollback endpoint**: A `rolledBackFromRevisionId` field is used in config revisions. If an attacker can craft a rollback request pointing to a revision from another agent (different UUID), the permission check may not verify cross-agent ownership. Needs investigation of the rollback route.
