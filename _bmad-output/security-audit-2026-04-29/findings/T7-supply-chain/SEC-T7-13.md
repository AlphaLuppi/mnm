---
id: SEC-T7-13
severity: medium
category: CWE-506 (Embedded Malicious Code) / OWASP A06
title: es5-ext@0.10.64 — Geopolitical postinstall script executed on npm install
file: node_modules/.old_modules-0b2d62a9ab6c3133/es5-ext/_postinstall.js
status: open
---

## Description
`es5-ext@0.10.64` contains a `postinstall` script that executes `_postinstall.js` at install time. This script **probes the system timezone** to detect Russian locales and, if found, displays a "Call for peace" message via `process._rawDebug`.

While the content is non-destructive (no data exfiltration, no code execution beyond timezone probing), this represents a **supply chain attack pattern**: a package executing arbitrary code at install time to inspect system state.

The package is in `.old_modules` (a bun residual directory) indicating it was previously installed, possibly as a transitive dep. It should still be treated as a finding because:
1. It demonstrates the postinstall attack surface is not disabled.
2. The `_rawDebug` call uses an undocumented Node.js internal, indicating adversarial awareness.
3. Future versions of `es5-ext` or similar packages could escalate this pattern.

## Impact
- At its current severity: benign (timezone probe + console output).
- Pattern risk: the same technique can be used for credential exfiltration, environment variable capture, or C2 beacon calls.
- MnM has no `--ignore-scripts` flag in `.npmrc` or `bunfig.toml` — **all postinstall scripts from any package execute on `bun install`**.

## Reproduction
`bun install` → es5-ext `postinstall` runs `node _postinstall.js` → timezone check → output (if Russian locale).

## Recommendation
1. Add `ignore-scripts=true` to `.npmrc` (or `bunfig.toml` equivalent for bun) — then manually allowlist known-safe native module builds (`isolated-vm`, `ssh2/cpu-features`).
2. Consider using `socket.dev` or `snyk` to audit packages for postinstall behaviors before adding new dependencies.
3. Remove residual `.old_modules-*` directories from the repository.

## References
- https://socket.dev/npm/package/es5-ext/files/0.10.64/_postinstall.js
- https://github.com/medikoo/es5-ext/blob/main/CHANGELOG.md
