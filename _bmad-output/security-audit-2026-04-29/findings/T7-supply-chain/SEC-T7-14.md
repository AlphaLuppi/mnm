---
id: SEC-T7-14
severity: medium
category: CWE-1104 (Use of Unmaintained Third Party Components) / Dependency Confusion
title: Dependency Confusion — 9 @mnm/* packages published as public without private:true
file: packages/*/package.json, server/package.json
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
The following internal workspace packages have `publishConfig.access: "public"` but are **missing `"private": true`**:

| Package | private | publishConfig.access |
|---------|---------|---------------------|
| `@mnm/adapter-utils` | NOT_SET | public |
| `@mnm/db` | NOT_SET | public |
| `@mnm/gate-runner` | NOT_SET | public |
| `@mnm/git-provider` | NOT_SET | public |
| `@mnm/governed-workflows` | NOT_SET | public |
| `@mnm/shared` | NOT_SET | public |
| `@mnm/adapter-claude-local` | NOT_SET | public |
| `@mnm/server` | NOT_SET | public |
| `mnm` (cli) | NOT_SET | public |

By contrast, `@mnm/ui`, `@mnm/plugin`, and `@mnm/test-utils` correctly have `"private": true`.

**Dependency confusion attack**: If an attacker registers any of these package names on the public npm registry with a **higher version number** than the currently published packages (or before they are published), `bun install` will prefer the public npm version over the workspace version when resolving. This is the same attack vector used in the Alex Birsan dependency confusion attack (2021).

Additionally, the `@mnm` npm scope may or may not be claimed — if not claimed, anyone can publish `@mnm/anything` to npm.

## Impact
- **High in theory**: attacker publishes `@mnm/db@99.0.0` to npm → all team members who run `bun install` from scratch get the malicious package.
- **Mitigated in practice**: bun workspace protocol (`workspace:*`) in `bun.lock` should prefer local packages, BUT only if the lockfile is committed and used. A clean install without the lockfile is vulnerable.
- The `auto-install-peers=true` in `.npmrc` increases attack surface.

## Reproduction
1. Attacker publishes `@mnm/db@999.0.0` to npm registry.
2. Developer clones repo fresh, runs `bun install`.
3. bun resolves `@mnm/db` from npm (999.0.0 > local 0.2.7) — unless workspace: protocol strictly overrides.

## Recommendation
1. **Immediate**: Add `"private": true` to all non-publishable workspace packages (`adapter-utils`, `db`, `gate-runner`, `git-provider`, `governed-workflows`, `shared`, all adapters).
2. **For packages intended to be published** (`@mnm/server`, `mnm` CLI): claim the npm scope `@mnm` and publish them, or add scope-registry mapping in `.npmrc`:
   ```
   @mnm:registry=https://npm.pkg.github.com
   ```
3. Verify the `@mnm` npm scope is registered and owned by Alpha Luppi.

## References
- https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610
- https://docs.npmjs.com/cli/v11/configuring-npm/package-json#private
