---
id: SEC-T7-15
severity: medium
category: CWE-1104 / Supply Chain
title: Native module postinstall scripts execute arbitrary code at install time — no ignore-scripts
file: .npmrc, packages with install scripts: isolated-vm, ssh2, cpu-features, esbuild, protobufjs, embedded-postgres
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
The following packages execute code at install time via `install` or `postinstall` lifecycle scripts:

| Package | Version | Script type | Content |
|---------|---------|-------------|---------|
| `isolated-vm` | 6.1.2 | `install` | `node-gyp-build \|\| node-gyp rebuild` (native compile) |
| `ssh2` | 1.17.0 | `install` | `node-gyp rebuild` for optional crypto binding |
| `cpu-features` | 0.0.10 | `install` | `node-gyp rebuild` |
| `esbuild` | 0.27.4 | `postinstall` | `node install.js` (downloads platform binary) |
| `protobufjs` | 7.5.4 | `postinstall` | `node scripts/postinstall` |
| `@embedded-postgres/windows-x64` | 18.1.0-beta.16 | `postinstall` | `node scripts/hydrate-symlinks.js` (downloads embedded postgres binary) |
| `es5-ext` | 0.10.64 | `postinstall` | Geopolitical probe (see SEC-T7-13) |

No `ignore-scripts` directive exists in `.npmrc`, `bunfig.toml`, or any package.json. This means every `bun install` runs these scripts without restriction.

## Impact
- Any compromise of any of these packages' publish accounts would allow arbitrary code execution on every developer machine running `bun install`.
- `esbuild` and `@embedded-postgres` download binaries from the internet at install time — MITM or registry compromise can serve malicious binaries.
- `embedded-postgres@18.1.0-beta.16` is a **beta** version, indicating lower maturity and possibly less security scrutiny.

## Recommendation
1. Add `ignore-scripts=true` to `.npmrc` (bun respects this flag).
2. Create a curated allowlist of packages allowed to run scripts (native builds only):
   ```
   # .npmrc
   ignore-scripts=true
   ```
   Then run `bun rebuild isolated-vm ssh2 cpu-features` explicitly in CI and onboarding scripts.
3. Pin `esbuild` and `protobufjs` to exact SHAs in the lockfile (already done via `bun.lock`) — verify the sha512 hashes match expected values.
4. Replace `embedded-postgres@18.1.0-beta.16` with a stable release version.
5. Add a CI step to fail if new packages with postinstall scripts are added (socket.dev GitHub app or similar).

## References
- https://blog.npmjs.org/post/141702881055/package-install-scripts-vulnerability
- https://socket.dev (automated supply chain monitoring)
