# T7 — Supply Chain & Dependencies Audit Summary
**Date**: 2026-04-29  
**Auditor**: Team T7 (Supply Chain Security)  
**Scope**: MnM monorepo — all package.json, bun.lock, .npmrc, GitHub Actions, Rust (none found)  
**Method**: bun audit + manual lockfile/package inspection + CVE cross-reference  

---

## Stats by Severity

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 5 |
| Medium | 7 |
| Low | 4 |
| Info | 1 |
| **Total** | **18** |

---

## bun audit Raw Output (condensed)

```
29 vulnerabilities (1 critical, 9 high, 19 moderate)

CRITICAL:
  protobufjs < 7.5.5           → dockerode → @grpc/proto-loader
    GHSA-xq3m-2v4x-88gg: Arbitrary code execution in protobufjs

HIGH:
  defu <= 6.1.4                → better-auth
    GHSA-737v-mqg7-c878: Prototype pollution via __proto__ key
  
  vite <= 6.4.1                → server (devDep), ui, db/vitest
    GHSA-p9ff-h696-f583: Arbitrary File Read via Dev Server WebSocket
  
  lodash-es 4.0.0-4.17.23     → mermaid
    GHSA-r5fr-rjxr-66jc: Code Injection via _.template
  
  kysely <= 0.28.13            → better-auth, drizzle-orm (optional peer)
    GHSA-8cpq-38p9-67gx: MySQL SQL Injection via sql.lit()
    GHSA-fr9j-6mvq-frcv: MySQL SQL Injection via JSON path keys
  
  picomatch < 2.3.2            → @changesets/cli → micromatch
    GHSA-c2c7-rcm5-vvqj: ReDoS via extglob quantifiers
    GHSA-3v7f-55p6-f55p: Method Injection in POSIX character classes
  
  path-to-regexp >= 8.0.0 < 8.4.0 → express@5
    GHSA-j3q9-mxjg-w52f: ReDoS via sequential optional groups
    GHSA-27v5-c462-wpq7: ReDoS via multiple wildcards
  
  fast-xml-parser 5.0.0-5.5.5  → @aws-sdk/client-s3
    GHSA-8gc5-j5rx-235r: Numeric entity expansion bypass (XML bomb)
  
MODERATE (not individual findings above threshold but tracked):
  dompurify < 3.3.2            → 8 advisories (mermaid, monaco-editor transitive)
  esbuild <= 0.24.2            → packages/mnm-plugin (devDep ^0.24.2)
  hono < 4.12.14               → @modelcontextprotocol/sdk
  postcss < 8.5.10             → vite (dev)
  uuid < 14.0.0                → dockerode, mermaid
  esbuild 0.18.20, 0.24.2      → tsx, drizzle-kit (dev tools)
```

---

## Critical CVE — Immediate Action Required

| ID | Package | Installed | Fixed In | GHSA | Chain |
|----|---------|-----------|----------|------|-------|
| SEC-T7-01 | `protobufjs` | 7.5.4 | 7.5.5 | GHSA-xq3m-2v4x-88gg | dockerode → @grpc/proto-loader |

**Action**: Add `"overrides": { "protobufjs": "^7.5.5" }` to root `package.json` and run `bun install`.

---

## High CVE Summary

| ID | Package | Installed | Fixed In | GHSA | Risk |
|----|---------|-----------|----------|------|------|
| SEC-T7-02 | `kysely` | 0.28.12 | 0.28.14 | GHSA-8cpq-38p9-67gx + GHSA-fr9j-6mvq-frcv | SQL injection (MySQL adapter) |
| SEC-T7-03 | `path-to-regexp` | 8.3.0 | 8.4.0 | GHSA-j3q9-mxjg-w52f | Unauthenticated DoS on Express server |
| SEC-T7-04 | `defu` | 6.1.4 | 6.1.5 | GHSA-737v-mqg7-c878 | Prototype pollution in better-auth |
| SEC-T7-05 | `fast-xml-parser` | 5.4.1 | 5.5.6 | GHSA-8gc5-j5rx-235r | XML bomb DoS via S3 responses |
| SEC-T7-06 | `vite` | 6.4.1 | 6.4.2 | GHSA-p9ff-h696-f583 | Dev: arbitrary file read via WebSocket |
| SEC-T7-07 | `lodash-es` | 4.17.23 | 5.x (pending) | GHSA-r5fr-rjxr-66jc | Code injection via _.template |
| SEC-T7-08 | `picomatch` | 2.3.1 | 2.3.2 | GHSA-c2c7-rcm5-vvqj | ReDoS in build tools + potential server-side |

---

## Dependency Confusion Risk

9 internal `@mnm/*` packages have `publishConfig.access: "public"` but **missing `"private": true`**:
- `@mnm/adapter-utils`, `@mnm/db`, `@mnm/gate-runner`, `@mnm/git-provider`
- `@mnm/governed-workflows`, `@mnm/shared`, `@mnm/adapter-claude-local`
- `@mnm/server`, `mnm` (cli)

**If the `@mnm` npm scope is not registered**, an attacker can publish higher-versioned packages to npm and inject them on fresh installs. See **SEC-T7-14**.

---

## Postinstall Scripts (Attack Surface)

No `ignore-scripts` protection. The following packages execute code at install time:

| Package | Version | Script | Nature |
|---------|---------|--------|--------|
| `isolated-vm` | 6.1.2 | `node-gyp rebuild` | Native compilation |
| `ssh2` | 1.17.0 | `node-gyp rebuild` | Native compilation |
| `cpu-features` | 0.0.10 | `node-gyp rebuild` | Native compilation |
| `esbuild` | 0.27.4 | `node install.js` | Binary download |
| `protobufjs` | 7.5.4 | `node scripts/postinstall` | Proto compilation |
| `@embedded-postgres/windows-x64` | 18.1.0-beta.16 | `hydrate-symlinks.js` | Binary symlink/download |
| `es5-ext` | 0.10.64 | `_postinstall.js` | Timezone probe (geopolitical) |

See **SEC-T7-15** and **SEC-T7-13**.

---

## Lockfile Status

| Check | Status |
|-------|--------|
| `bun.lock` present | ✓ |
| `bun.lock` tracked in git | ✓ (`git ls-files bun.lock` confirmed) |
| Conflicting lockfiles (yarn.lock, package-lock.json) | None |
| `latest` tag used anywhere | None detected |
| Wildcard `*` versions | None detected |
| All packages resolved with sha512 integrity hashes | ✓ (1,418 entries) |

---

## GitHub Actions

**No `.github/workflows/` directory exists.** Positive: no third-party action supply chain risk. Negative: no automated vulnerability scanning. See **SEC-T7-16**.

---

## Rust / Tauri Desktop

**No `Cargo.toml` or `Cargo.lock` found.** Desktop app appears to be in a separate repo or not yet implemented. See **SEC-T7-17** (info only).

---

## Recommendations Priority Order

### Immediate (P0 — this sprint)
1. **SEC-T7-01**: Override `protobufjs >= 7.5.5` — CRITICAL ACE.
2. **SEC-T7-03**: Override `path-to-regexp >= 8.4.0` — unauthenticated DoS on production server.
3. **SEC-T7-06**: Bump `vite` to `^6.4.2` — dev file read (affects all developers).
4. **SEC-T7-14**: Add `"private": true` to all non-publishable workspace packages.

### Short-term (P1 — next sprint)
5. **SEC-T7-04**: Override `defu >= 6.1.5` — prototype pollution in auth stack.
6. **SEC-T7-05**: Override `fast-xml-parser >= 5.5.6` — XML bomb via S3.
7. **SEC-T7-02**: Override `kysely >= 0.28.14` — SQL injection (MySQL path).
8. **SEC-T7-15**: Add `ignore-scripts=true` to `.npmrc` + explicit rebuild allowlist.

### Medium-term (P2)
9. **SEC-T7-07**: Upgrade `mermaid` to drop `lodash-es` dependency.
10. **SEC-T7-09**: Override `dompurify >= 3.3.4` for transitive versions.
11. **SEC-T7-10**: Bump `esbuild` in `packages/mnm-plugin` to `^0.27.3`.
12. **SEC-T7-11**: Override `hono >= 4.12.14`.
13. **SEC-T7-16**: Add `.github/workflows/security.yml` with `bun audit` gate.

### Long-term (P3)
14. **SEC-T7-18**: Upgrade `embedded-postgres` to stable once available.
15. **SEC-T7-19**: Evaluate `pdf-parse@2.x` fork trustworthiness.
16. Set up **Renovate Bot** or **Dependabot** for automated dependency updates.
17. Integrate **socket.dev** or **Snyk** for proactive supply chain monitoring.

---

## Consolidated Override Block (root package.json patch)

```json
"overrides": {
  "protobufjs": "^7.5.5",
  "path-to-regexp": "^8.4.0",
  "defu": "^6.1.5",
  "fast-xml-parser": "^5.5.6",
  "kysely": "^0.28.14",
  "hono": "^4.12.14",
  "picomatch": "^2.3.2",
  "dompurify": "^3.3.4"
}
```

**WARNING**: Test all overrides in a branch — some may conflict with peer dependency version constraints.
