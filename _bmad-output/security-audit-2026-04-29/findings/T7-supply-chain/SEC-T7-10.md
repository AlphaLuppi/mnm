---
id: SEC-T7-10
severity: medium
category: OWASP A06 / CWE-1104
title: esbuild@0.24.2 pinned in packages/mnm-plugin — Dev Server CORS bypass (GHSA-67mh-4wv8-2f99)
file: packages/mnm-plugin/package.json (devDependency: esbuild ^0.24.2)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`packages/mnm-plugin/package.json` pins `esbuild` at `^0.24.2`, which resolves to exactly `0.24.2` (the upper boundary before 0.25.x). This version is affected by **GHSA-67mh-4wv8-2f99**: the esbuild dev server does not set proper CORS/Host header validation, allowing **any website open in the developer's browser** to send requests to the esbuild dev server and read arbitrary responses.

Fixed in `esbuild >= 0.25.0`.

The root `package.json` (devDependency `^0.27.3` → resolves to 0.27.4) and `packages/gate-runner` (`^0.27.3`) are **safe**. Only `mnm-plugin` is affected.

## Impact
- Developer's machine only (not production).
- While `mnm-plugin` is `private: true`, any developer who runs its build workflow while browsing untrusted sites is at risk of exfiltration via the esbuild dev server port.
- The mnm-plugin compiles the `mnm-session-start` binary — source code could be exfiltrated.

## CVE References
- GHSA-67mh-4wv8-2f99 — "esbuild enables any website to send requests to the development server and read the response"

## Recommendation
Bump `esbuild` in `packages/mnm-plugin/package.json` to `^0.27.3`:
```json
"esbuild": "^0.27.3"
```

## References
- https://github.com/advisories/GHSA-67mh-4wv8-2f99
