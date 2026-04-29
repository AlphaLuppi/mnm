# T10 — Infra / DevOps / Tauri Security Audit Summary
**Date:** 2026-04-29  
**Auditors:** Team T10 (whitebox, recon-only — no changes made)  
**Scope:** Dockerfile, docker-compose*.yml, docker/, .dockerignore, apps/desktop (absent), .github/workflows, CLI, playwright.config.ts, package.json scripts, network/host config

---

## Stats by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 1 | SEC-T10-001 |
| High | 4 | SEC-T10-002, SEC-T10-003, SEC-T10-004, SEC-T10-005 |
| Medium | 5 | SEC-T10-006, SEC-T10-007, SEC-T10-008, SEC-T10-009, SEC-T10-010, SEC-T10-011, SEC-T10-012 |
| Low | 3 | SEC-T10-013, SEC-T10-014, SEC-T10-015, SEC-T10-016 |
| Info | 1 | SEC-T10-017 |

**Total: 17 findings**

---

## Top 5 Risks

### 1. CRITICAL — Docker socket bind-mount = host escape (SEC-T10-001)
`/var/run/docker.sock` is mounted into the production container in both `docker-compose.yml` and `docker-compose.dokploy.yml`. The `entrypoint.sh` adds the `mnm` user to the Docker group at runtime. Any server-side code execution vulnerability (SSRF, RCE, dependency compromise) immediately grants full Docker host control. This is architecturally equivalent to root on host.

### 2. HIGH — `claude --dangerously-skip-permissions` invoked server-side (SEC-T10-002)
The drift analyzer CLI fallback invokes Claude Code with `--dangerously-skip-permissions` via `bash -c "cat <tmpFile> | claude ..."`. This bypasses Claude Code's own permission sandbox, running with arbitrary filesystem/network access inside the container. Combined with the Docker socket access above, this is a compounding risk.

### 3. HIGH — Bun installed via curl-bash pipe with no checksum (SEC-T10-003)
`curl -fsSL https://bun.sh/install | bash` runs as root in the base build stage with no version pinning or hash verification. A supply chain compromise of bun.sh or a MITM would silently backdoor all production images.

### 4. HIGH — Hardcoded DB password `mnm:mnm` in production compose (SEC-T10-004)
`docker-compose.yml` commits `POSTGRES_PASSWORD: mnm` and `DATABASE_URL: postgres://mnm:mnm@db:5432/mnm`. The password is identical to the username and is in version control. Any repo access = DB credential access.

### 5. HIGH — Hardcoded e2e test password in version control (SEC-T10-005)
`e2e/fixtures/seed-data.ts` commits `TEST_PASSWORD = "E2eTestPass!2026"` for all test accounts. If `MNM_E2E_SEED=true` is accidentally set on staging/production, this password provides admin access via `admin@novatech.test`.

---

## Tauri Capabilities Matrix

| Capability | Status |
|------------|--------|
| `apps/desktop/src-tauri/` directory | **ABSENT — cannot audit** |
| `tauri.conf.json` | Not found |
| `capabilities/` permissions | Not found |
| `withGlobalTauri` | Unknown |
| CSP / `unsafe-inline` | Unknown |
| IPC command input validation | Unknown |
| `shell.execute` allowlist | Unknown |
| Updater signing pubkey | Unknown |
| `dangerousDisableAssetCspModification` | Unknown |
| `dangerousRemoteDomainIpcAccess` | Unknown |

**Finding SEC-T10-013** documents this gap. The Tauri desktop app may be in a separate repository.

---

## Docker Hardening Status

| Control | Status |
|---------|--------|
| Non-root runtime user | Partial — gosu drop via entrypoint, no `USER` directive |
| HEALTHCHECK | Present (main Dockerfile) |
| `.dockerignore` covers `.env`, `.git`, `node_modules` | Yes — core exclusions present |
| `.dockerignore` covers IDE files, docs, test artifacts | **No** — gaps identified (SEC-T10-009) |
| Resource limits (CPU/memory) | **None** (SEC-T10-008) |
| `no-new-privileges` | **None** (SEC-T10-014) |
| `cap_drop: ALL` | **None** (SEC-T10-014) |
| `read_only` root filesystem | **None** |
| DB port not exposed to host | Yes (production) |
| Redis port not exposed to host | Yes (production) |
| Docker socket mounted | **YES — critical** (SEC-T10-001) |
| Base image SHA-pinned | **No** — uses mutable tags (SEC-T10-015) |
| Base image: `node:lts-trixie-slim` | Not pinned to version or SHA |
| Agent image: `node:20-slim` | Version-pinned, no SHA |
| Bun install verified | **No** — curl-bash (SEC-T10-003) |
| DB password parameterized | **No** — hardcoded `mnm` (SEC-T10-004) |
| Multi-stage build — secrets leak | Low risk (no ARG secrets), but `COPY . .` includes extras (SEC-T10-009) |

---

## CI/CD Security Posture

| Control | Status |
|---------|--------|
| GitHub Actions workflows present | **NONE** |
| Dependency vulnerability scanning | Unknown / not automated |
| Docker image scanning (Trivy/Scout) | Unknown / not automated |
| Image signing (cosign) | Unknown |
| SLSA provenance | Unknown |
| Branch protection on main | Unknown |
| Release signing | Unknown — `./scripts/release.sh` not reviewed |
| Third-party actions pinned to SHA | N/A (no workflows) |
| Secrets in workflow env | N/A (no workflows) |

**SEC-T10-010** covers this gap comprehensively.

---

## Network / CLI Security Notes

| Area | Finding |
|------|---------|
| Server binds `0.0.0.0` in Docker ENV | Correct for container, risk if no firewall (SEC-T10-011) |
| Dev server host | `127.0.0.1` (safe default) |
| WebSocket | Same port as HTTP (3100) — single surface |
| CLI config path | Resolved from `MNM_HOME` / `XDG_CONFIG_HOME` / OS-appropriate defaults — no obvious path traversal |
| CLI JWT secret file | Written with `chmod 0o600` — correct |
| CLI `auth-bootstrap-ceo` | Direct DB write, uses `sha256` token hash — reasonable |
| openclaw-smoke `/events` | **Unauthenticated** (SEC-T10-012) |
| `deploy-manager` `sh -c port` | Needs trace validation (SEC-T10-017) |

---

## Positive Security Observations

1. Production `docker-compose.yml` enforces required secrets with `:?` syntax (`BETTER_AUTH_SECRET`, `MNM_SECRETS_KEY`, `MNM_MCP_JWT_SECRET`).
2. Database port is not exposed to the host in production (`# Uncomment to debug`).
3. Redis has `maxmemory 256mb` to prevent runaway consumption.
4. HEALTHCHECK is properly configured on the main container.
5. Multi-stage build correctly separates deps/build/production, avoiding dev dependency leakage to the final image.
6. CLI JWT secret file is written with `mode: 0o600` — proper permissions.
7. `MNM_E2E_SEED=false` is explicitly set in `docker-compose.dokploy.yml` (production deployment).
8. Server config defaults to `HOST=127.0.0.1` in non-Docker mode — safe default.
9. `e2e/.auth/` is in `.gitignore` — correct.
10. `Dockerfile.agent` uses a non-root `agent` user with `USER agent` directive — model for the main Dockerfile.

---

## Audit Gaps (Not Assessed)

- **Tauri desktop app** — `apps/desktop/` does not exist in this branch (SEC-T10-013).
- **GitHub Actions** — no workflow files present to audit.
- **`scripts/release.sh`** — not read during this session; release signing status unknown.
- **Server-side routes, auth, RBAC, RLS** — out of scope for T10.
- **Dependency vulnerability scan** — requires running `bun audit` / `trivy fs` against the lock file.
