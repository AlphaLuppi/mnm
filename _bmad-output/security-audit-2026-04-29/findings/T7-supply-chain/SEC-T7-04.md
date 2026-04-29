---
id: SEC-T7-04
severity: high
category: OWASP A06 / CWE-1104
title: defu@6.1.4 — Prototype Pollution via __proto__ key (GHSA-737v-mqg7-c878)
file: bun.lock (transitive via better-auth@1.4.18)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`better-auth@1.4.18` depends on `defu@^6.1.4`. The installed version is **6.1.4**, which is the exact boundary version for **GHSA-737v-mqg7-c878**: prototype pollution via the `__proto__` key in the `defaults` argument.

Fixed in `defu >= 6.1.5`.

`bun.lock` entry:
```
"defu": ["defu@6.1.4", "", {}, ...]
```

## Impact
- An attacker who can control input passed to `better-auth` configuration or merge functions can pollute `Object.prototype`, potentially leading to:
  - Authentication bypass (if `isAdmin`, `isAuthenticated` or similar flags are set on the prototype)
  - Logic errors cascading from tainted base objects
- Risk is **higher** because `better-auth` handles authentication state directly.

## CVE References
- GHSA-737v-mqg7-c878 — "defu: Prototype pollution via `__proto__` key in defaults argument"

## Reproduction
Requires controlled input to reach a `defu(userInput, defaults)` call inside `better-auth`. The exact trigger depends on `better-auth` internals — the library's plugin/option merging is the likely surface.

## Recommendation
Force `defu >= 6.1.5` via root override:
```json
"overrides": {
  "defu": "^6.1.5"
}
```
Also upgrade `better-auth` to a version that ships with the patched `defu` when available.

## References
- https://github.com/advisories/GHSA-737v-mqg7-c878
