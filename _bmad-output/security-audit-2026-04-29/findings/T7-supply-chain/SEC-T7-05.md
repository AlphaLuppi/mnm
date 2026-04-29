---
id: SEC-T7-05
severity: high
category: OWASP A06 / CWE-1104
title: fast-xml-parser@5.4.1 — Numeric Entity Expansion / XML Injection (GHSA-8gc5-j5rx-235r)
file: bun.lock (transitive via @aws-sdk/client-s3)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`@aws-sdk/client-s3@^3.888.0` (declared in `server/package.json`) resolves `fast-xml-parser@5.4.1`. This version is affected by:

1. **GHSA-8gc5-j5rx-235r** (high) — Numeric entity expansion bypasses all entity expansion limits (incomplete fix for CVE-2026-26278). Allows Billion Laughs-style DoS through crafted XML responses from S3-compatible endpoints.
2. **GHSA-jp2q-39xq-3w4g** (moderate) — Entity expansion limits bypassed when set to zero due to JavaScript falsy evaluation.
3. **GHSA-gh4j-gqv2-49f6** (moderate) — XML Comment and CDATA Injection via unescaped delimiters in `XMLBuilder`.

Fixed in `fast-xml-parser >= 5.5.6`.

## Impact
- If the MnM server processes XML responses from S3 (or a malicious S3-compatible endpoint), it can be hit with an **XML bomb** (DoS) via crafted entity expansion.
- Any user-controlled S3 endpoint configuration (e.g., custom storage backends) could trigger injection.

## CVE References
- GHSA-8gc5-j5rx-235r — "fast-xml-parser affected by numeric entity expansion"
- GHSA-jp2q-39xq-3w4g
- GHSA-gh4j-gqv2-49f6

## Reproduction
1. Configure MnM to use a custom S3 endpoint.
2. Return crafted XML with deeply nested numeric entity references from the endpoint.
3. `fast-xml-parser` enters exponential expansion loop → DoS.

## Recommendation
Force `fast-xml-parser >= 5.5.6` via root override:
```json
"overrides": {
  "fast-xml-parser": "^5.5.6"
}
```
Upgrade `@aws-sdk/client-s3` to a version that bundles the patched parser.

## References
- https://github.com/advisories/GHSA-8gc5-j5rx-235r
- https://github.com/NaturalIntelligence/fast-xml-parser/releases
