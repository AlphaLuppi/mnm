---
id: SEC-T7-11
severity: medium
category: OWASP A06 / CWE-1104
title: hono@4.12.12 — HTML Injection via JSX attribute names (GHSA-458j-xx4x-4375)
file: bun.lock (transitive via @modelcontextprotocol/sdk@1.29.0)
status: open
---

## Description
`@modelcontextprotocol/sdk@^1.29.0` depends on `hono`. The installed version is **4.12.12**, which is affected by **GHSA-458j-xx4x-4375**: improper handling of JSX attribute names allows HTML injection in `hono/jsx` SSR mode.

Fixed in `hono >= 4.12.14`.

## Impact
- Exploitable only if MnM uses `hono/jsx` SSR rendering with user-controlled attribute names.
- MnM's MCP server integration (`@modelcontextprotocol/sdk`) uses hono as transport. If any SSR-rendered HTML response incorporates user data into JSX attributes (e.g., tool names, workflow names), HTML injection is possible.
- Severity is moderate because JSX SSR is not the primary MnM rendering path, but MCP tool registration data could flow through this path.

## CVE References
- GHSA-458j-xx4x-4375 — "hono Improperly Handles JSX Attribute Names Allows HTML Injection in hono/jsx SSR"

## Recommendation
Force `hono >= 4.12.14` via override:
```json
"overrides": {
  "hono": "^4.12.14"
}
```
Or upgrade `@modelcontextprotocol/sdk` when a patched version is released.

## References
- https://github.com/advisories/GHSA-458j-xx4x-4375
