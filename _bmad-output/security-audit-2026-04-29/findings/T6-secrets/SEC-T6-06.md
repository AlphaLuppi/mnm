---
id: SEC-T6-06
severity: medium
category: CWE-312 / OWASP A02
title: Hardcoded embedded-postgres credentials committed in source and docker-compose
file: server/src/index.ts:474-480 + docker-compose.yml:21-25 + packages/db/src/backup.ts:72
status: open
---

## Description

Multiple locations contain hardcoded embedded PostgreSQL credentials `postgres://mnm:mnm@...`:

1. **`server/src/index.ts:474`** — `postgres://mnm:mnm@127.0.0.1:${port}/postgres` (admin connection string)
2. **`server/src/index.ts:480`** — `postgres://mnm:mnm@127.0.0.1:${port}/mnm` (app connection string)
3. **`packages/db/src/backup.ts:72`** — fallback for embedded mode
4. **`docker-compose.yml:22-24`** — `POSTGRES_PASSWORD: mnm` (for the production-intended `docker-compose.yml`)
5. **`docker-compose.dev.yml:21`** — `POSTGRES_PASSWORD: mnm_dev`

The `docker-compose.yml` (production stack) hardcodes the Postgres password as the literal `"mnm"` directly in the compose file. While the database port is not exposed to the host, if the DB container is ever misconfigured or the Docker network is breached, this is a trivially guessable credential.

For the embedded-postgres mode, the hardcoded password is intentional and acceptable as the DB is loopback-only. However the `docker-compose.yml` is described as a production stack.

## Impact

- **Production DB password hardcoded**: A `docker-compose.yml` user deploying to production retains the default `mnm/mnm` credentials unless they modify the file, which is not called out in documentation.
- **Credential rotation**: There is no documented procedure for changing the embedded or compose Postgres password.

## Reproduction (conceptual)

1. Deploy `docker-compose.yml` without modification.
2. The PostgreSQL service is accessible within the Docker network at `postgres://mnm:mnm@db:5432/mnm`.
3. If the Docker network is compromised or a container breakout occurs, the database is accessible with known credentials.

## Recommendation

- Change `docker-compose.yml` to use an env-var-driven password:
  ```yaml
  POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
  DATABASE_URL: "postgres://mnm:${POSTGRES_PASSWORD}@db:5432/mnm"
  ```
- Add `POSTGRES_PASSWORD` to `.env.example` with a note to generate a random value.
- For embedded-postgres (loopback only), the hardcoded credential is acceptable risk — document this explicitly.

## References

- `docker-compose.yml:22-24`
- `server/src/index.ts:474-480`
- CWE-312: Cleartext Storage of Sensitive Information

## Status
**Fixed** : 2026-04-29
**Commit** : 00ee0f9a8100e9cfa632bab2d326d1358d04a724
**Fix description** : `docker-compose.yml` production stack: `POSTGRES_PASSWORD: mnm` replaced with `"${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set (generate: openssl rand -hex 16)}"` (Docker Compose fail-fast syntax). `DATABASE_URL` updated to `"postgres://mnm:${POSTGRES_PASSWORD}@db:5432/mnm"`. Header comment updated to list `POSTGRES_PASSWORD` as a required env var. `docker-compose.dev.yml` left unchanged but annotated with a comment clarifying it is local-only and intentionally uses a static dev password. `POSTGRES_PASSWORD` added to `.env.example`. Embedded-postgres hardcoded credentials (`server/src/index.ts:474-480`) not touched — they are loopback-only and acceptable risk per the finding recommendation.
