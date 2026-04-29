---
id: SEC-T6-07
severity: medium
category: CWE-532 / OWASP A09
title: redaction.ts SECRET_PAYLOAD_KEY_RE does not cover GIT_TOKEN_* env var pattern
file: server/src/redaction.ts:2 + packages/adapter-utils/src/server-utils.ts:29
status: open
---

## Description

Two different redaction/sanitization regexes exist in the codebase:

**`redaction.ts` (event payload redaction):**
```
SECRET_PAYLOAD_KEY_RE = /(api[-_]?key|access[-_]?token|auth(?:_?token)?|authorization|bearer|secret|passwd|password|credential|jwt|private[-_]?key|cookie|connectionstring)/i
```

**`server-utils.ts` (env var redaction for adapter run logs):**
```
SENSITIVE_ENV_KEY = /(key|token|secret|password|passwd|authorization|cookie)/i
```

The `server-utils.ts` pattern correctly matches `GIT_TOKEN_GITHUB_COM` (contains "token"). However, `redaction.ts`'s `SECRET_PAYLOAD_KEY_RE` does **not** match `GIT_TOKEN_*` because:
- It requires `access[-_]?token` (not plain "token")
- Pattern `auth(?:_?token)?` also doesn't match `GIT_TOKEN_*`

If an event payload includes a `GIT_TOKEN_GITHUB_COM` key (e.g., in trace metadata or agent config), it will **not** be redacted by `redactEventPayload()`.

Additionally, `DATABASE_URL` (which contains a password) is not caught by either regex — it would only be redacted if it matched the key patterns, which it doesn't ("URL" doesn't match any pattern).

## Impact

- Git repository access tokens injected as `GIT_TOKEN_<HOST>` env vars could leak through SSE event payloads if those payloads reflect the agent environment configuration.
- Database connection strings appearing in event context (e.g., error details) would not be redacted.

## Recommendation

Align both regexes or create a shared module. Consider adding to `SECRET_PAYLOAD_KEY_RE`:
- `\btoken\b` — covers standalone "token" in key names
- `connectionstring|database.?url|dsn` — covers connection strings
- `oauth` — covers `CLAUDE_CODE_OAUTH_TOKEN` if key name changes

Also consider testing the redaction coverage in `server/src/__tests__/redaction.test.ts` with `GIT_TOKEN_*` and `DATABASE_URL` inputs.

## References

- `server/src/redaction.ts:2`
- `packages/adapter-utils/src/server-utils.ts:29`
- `server/src/__tests__/redaction.test.ts` — existing coverage
- CWE-532
