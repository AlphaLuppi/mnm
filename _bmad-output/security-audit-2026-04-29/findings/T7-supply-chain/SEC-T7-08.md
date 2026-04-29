---
id: SEC-T7-08
severity: high
category: OWASP A06 / CWE-1104
title: picomatch@2.3.1 — ReDoS via extglob quantifiers (GHSA-c2c7-rcm5-vvqj)
file: bun.lock (transitive via @changesets/cli → micromatch → picomatch)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`picomatch@2.3.1` is installed as a transitive dependency of `@changesets/cli` (via `micromatch`). This version is affected by **GHSA-c2c7-rcm5-vvqj**: a **ReDoS vulnerability via extglob quantifiers**. An attacker can craft a glob pattern that causes catastrophic backtracking in the regular expression engine.

Additionally, **GHSA-3v7f-55p6-f55p** covers method injection in POSIX character classes.

Fixed in `picomatch >= 2.3.2`.

The higher-version `picomatch@4.0.3` is also installed (safe) but the 2.3.1 version is still resolved in the dependency tree.

## Impact
- Primarily affects build tooling and CI pipelines that process file patterns.
- If any server-side file matching uses `micromatch` with user-controlled patterns (e.g., file upload filtering, webhook path matching), this could be exploited for DoS.
- Lower risk in production context but real risk in CI/CD environments and development workflows.

## CVE References
- GHSA-c2c7-rcm5-vvqj — "Picomatch has a ReDoS vulnerability via extglob quantifiers"
- GHSA-3v7f-55p6-f55p — "Picomatch: Method Injection in POSIX Character Classes"

## Recommendation
Force `picomatch >= 2.3.2` via root override:
```json
"overrides": {
  "picomatch": "^2.3.2"
}
```

## References
- https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
