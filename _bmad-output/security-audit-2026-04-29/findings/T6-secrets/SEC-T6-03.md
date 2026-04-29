---
id: SEC-T6-03
severity: high
category: CWE-532 / OWASP A09
title: HTTP error handler logs raw request body — may persist plaintext passwords/tokens to disk
file: server/src/middleware/logger.ts:60-85 + server/src/middleware/error-handler.ts:26-28
status: open
---

## Description

The `httpLogger` (pino-http) middleware is configured with a `customProps` callback that, **on any 4xx or 5xx response**, captures and logs the raw `req.body` object:

```typescript
// logger.ts:72-79
if (body && typeof body === "object" && Object.keys(body).length > 0) {
  props.reqBody = body;
}
```

Similarly, `error-handler.ts` attaches `req.body` verbatim to `res.__errorContext.reqBody`.

The `pino-pretty` transport writes at `debug` level to `server.log` (disk file). There is **no redaction applied** to `reqBody` in this path. The `redaction.ts` module (which uses `SECRET_PAYLOAD_KEY_RE`) is never called on HTTP request bodies — it is only called on event payloads before SSE emission.

**Affected routes with sensitive payloads:**
- `POST /auth/sign-in` — body contains `email` + `password`
- `POST /auth/sign-up` — body contains `password`
- `POST /companies/:id/secrets` — body contains `value` (the actual secret being stored)
- `POST /companies/:id/secrets/:id/rotate` — body contains `value`
- Any config-layer route that includes inline `env.SOME_KEY = "plaintext"` bindings

Any 4xx response on these routes (wrong password, validation error, auth failure) will write the full request body — including plaintext credentials — to the log file at `debug` level.

## Impact

- **Password disclosure**: failed login attempts persist the attempted password to disk in plaintext.
- **Secret exfiltration**: if a secret creation request is rejected (e.g., duplicate name, wrong provider), the secret value is logged.
- **Persistent log residue**: log file retention of 30+ days means old credentials remain on disk long after the event.

## Reproduction (conceptual)

1. Send a `POST /auth/sign-in` with incorrect credentials (intentional 401).
2. Inspect `~/.mnm/instances/default/logs/server.log` — the `reqBody` field contains `{ email: "...", password: "...plaintext..." }`.

## Recommendation

Apply redaction before writing `reqBody` to logs. Two approaches:

**Option A — Inline field-based redaction in `customProps`:**
```typescript
import { sanitizeRecord } from "../redaction.js";
// ...
props.reqBody = sanitizeRecord(body);
```

**Option B — Blocklist specific routes:**
Add a middleware that removes known-sensitive fields (`password`, `value`, `secret`, `token`) from the req body before the logger runs.

Additionally, consider raising the log level for `reqBody` from `debug` to only log on 5xx, or strip it from the file transport entirely.

## References

- `server/src/middleware/logger.ts:60-85`
- `server/src/middleware/error-handler.ts:26-28`
- `server/src/redaction.ts` — existing redaction module not wired to HTTP logging
- CWE-532: Insertion of Sensitive Information into Log File
- OWASP Logging Cheat Sheet

## Status
**Fixed** : 2026-04-29
**Commit** : 00ee0f9a8100e9cfa632bab2d326d1358d04a724
**Fix description** : `server/src/middleware/logger.ts` now imports `sanitizeRecord` from `../redaction.js` and applies it to `req.body` (and `ctx.reqBody`) before writing to the log in `customProps`. `server/src/middleware/error-handler.ts` likewise applies `sanitizeRecord` to `req.body` before attaching it to `__errorContext`. Fields matching `SECRET_PAYLOAD_KEY_RE` (password, secret, token, key, etc.) are replaced with `***REDACTED***`.
