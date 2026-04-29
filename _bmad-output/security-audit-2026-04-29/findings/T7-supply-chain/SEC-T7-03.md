---
id: SEC-T7-03
severity: high
category: OWASP A06 / CWE-1104
title: path-to-regexp@8.3.0 — ReDoS via sequential optional groups (GHSA-j3q9-mxjg-w52f)
file: bun.lock (transitive via express@5.2.1)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`express@5.2.1` (declared as `^5.1.0` in `server/package.json`) pulls in `path-to-regexp@8.3.0`. This version is vulnerable to **Denial of Service via Regular Expression** (GHSA-j3q9-mxjg-w52f) through sequential optional groups in route patterns. An attacker sending a crafted URL path to the Express server can pin a CPU core until the process becomes unresponsive.

A second advisory (GHSA-27v5-c462-wpq7) covers multiple wildcard patterns and also applies to 8.3.0.

`bun.lock` entry:
```
"path-to-regexp": ["path-to-regexp@8.3.0", "", {...}]
```
Fixed in `path-to-regexp >= 8.4.0`.

## Impact
- **Unauthenticated DoS** on the MnM server process: any route registered with optional groups (e.g., `/companies/:companyId/:resource?/:id?`) can be targeted.
- The MnM server exposes public-facing REST endpoints (`/companies/:companyId/*`) which match the vulnerable pattern type.

## CVE References
- GHSA-j3q9-mxjg-w52f — path-to-regexp DoS via sequential optional groups
- GHSA-27v5-c462-wpq7 — path-to-regexp DoS via multiple wildcards

## Reproduction
1. Start MnM server (`bun run dev`).
2. Send a crafted request with a deeply nested optional path pattern.
3. Node.js event loop becomes blocked for the duration of the ReDoS.

## Recommendation
Force `path-to-regexp >= 8.4.0` via root override:
```json
"overrides": {
  "path-to-regexp": "^8.4.0"
}
```
Also check that express@5 ships a patched version directly when it bumps.

## References
- https://github.com/advisories/GHSA-j3q9-mxjg-w52f
- https://github.com/advisories/GHSA-27v5-c462-wpq7
