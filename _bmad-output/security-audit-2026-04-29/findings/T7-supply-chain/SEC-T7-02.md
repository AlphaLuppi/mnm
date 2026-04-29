---
id: SEC-T7-02
severity: high
category: OWASP A06 / CWE-1104
title: kysely@0.28.12 — MySQL SQL Injection via sql.lit() and JSON path keys (GHSA-8cpq-38p9-67gx, GHSA-fr9j-6mvq-frcv)
file: bun.lock (transitive via better-auth@1.4.18 and drizzle-orm@0.45.2)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`kysely@0.28.12` is resolved in `bun.lock`. Two SQL injection CVEs affect versions <= 0.28.13:

1. **GHSA-8cpq-38p9-67gx** — `sql.lit(string)` does insufficient backslash escaping on MySQL, allowing SQL injection via crafted string literals.
2. **GHSA-fr9j-6mvq-frcv** — JSON path keys with backslash escape bypass in non-type-safe usage.

The MnM project uses PostgreSQL (not MySQL), which **reduces the practical exploitability** of these specific escape-bypass vectors. However, `better-auth` uses kysely internally for its user/session tables, and `drizzle-orm` lists `kysely` as an optional peer — meaning any future integration or plugin could exercise the vulnerable path.

`bun.lock` entry:
```
"kysely": ["kysely@0.28.12", "", {}, "sha512-kWiueDWXh..."]
```

## Impact
- If the MnM deployment ever uses MySQL as an auth backend (or if a plugin is added), SQL injection is directly exploitable via `better-auth`'s kysely adapter.
- Even on PostgreSQL, the prototype pollution risk from kysely's query builder internals remains.

## CVE References
- GHSA-8cpq-38p9-67gx
- GHSA-fr9j-6mvq-frcv

## Reproduction
Specific to MySQL adapter path in `better-auth`. Not directly triggerable on the current PostgreSQL configuration.

## Recommendation
Force `kysely >= 0.28.14` via root `package.json` override:
```json
"overrides": {
  "kysely": "^0.28.14"
}
```
Monitor `better-auth` releases for a version that ships with the patched kysely.

## References
- https://github.com/advisories/GHSA-8cpq-38p9-67gx
- https://github.com/advisories/GHSA-fr9j-6mvq-frcv
