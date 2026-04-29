---
id: SEC-T7-07
severity: high
category: OWASP A06 / CWE-1104
title: lodash-es@4.17.23 — Code Injection via _.template (GHSA-r5fr-rjxr-66jc)
file: bun.lock (transitive via mermaid → lodash-es)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`mermaid@^11.12.0` (in `ui/package.json`) pulls in `lodash-es@4.17.23`. This version is affected by **GHSA-r5fr-rjxr-66jc**: `_.template` with untrusted `imports` key names allows arbitrary code injection.

Additionally, **GHSA-f23m-r3pf-42rh** covers prototype pollution via array path bypass in `_.unset` and `_.omit`.

The entire `lodash-es@4.17.x` line remains vulnerable; there is no clean patch within the 4.x series for the template injection (the project has been largely unmaintained for `_.template` security issues).

## Impact
- If any code path in mermaid or application code calls `_.template` with user-controlled import key names, **arbitrary JS code execution in the browser** (XSS-equivalent) is possible.
- Prototype pollution via `_.unset`/`_.omit` with user-controlled array paths can contaminate shared object state in the UI.

## CVE References
- GHSA-r5fr-rjxr-66jc — "lodash vulnerable to Code Injection via `_.template` imports key names"
- GHSA-f23m-r3pf-42rh — "lodash vulnerable to Prototype Pollution via array path bypass"

## Reproduction
Direct exploitation requires code to call `_.template` with user-controlled template options. Most likely surface: mermaid diagram template rendering from user-provided diagram source.

## Recommendation
1. Upgrade `mermaid` to a version that removes the `lodash-es` dependency (mermaid has been progressively removing lodash).
2. As a workaround, add a Content Security Policy that prevents inline script execution in the UI.
3. Override if a patch exists: `"overrides": { "lodash-es": "latest" }` — but note lodash 5.x is still in development.

## References
- https://github.com/advisories/GHSA-r5fr-rjxr-66jc
- https://github.com/mermaid-js/mermaid/releases
