---
id: SEC-T7-18
severity: low
category: CWE-1104 / Supply Chain
title: embedded-postgres beta version (18.1.0-beta.16) — reduced security scrutiny and no stable provenance
file: server/package.json (embedded-postgres ^18.1.0-beta.16)
status: open
---

## Description
`server/package.json` declares `embedded-postgres: "^18.1.0-beta.16"`. Beta packages receive less security scrutiny, have less public CVE tracking, and are more likely to introduce breaking changes or undiscovered vulnerabilities.

The `@embedded-postgres/windows-x64` package's `postinstall` script runs `node scripts/hydrate-symlinks.js` — likely fetching or symlinking a PostgreSQL binary downloaded at install time. This introduces an implicit binary download supply chain dependency.

## Impact
- Beta software may contain security vulnerabilities not yet publicly known.
- Binary download at postinstall time creates an unverified binary execution surface.
- If the embedded-postgres CDN is compromised, a malicious PostgreSQL binary could be installed on developer machines.

## Recommendation
1. Monitor `embedded-postgres` for a stable release and upgrade.
2. Verify the SHA checksum of the downloaded PostgreSQL binary against the official PostgreSQL project's published checksums.
3. In CI, consider using a Docker-based PostgreSQL instead of the embedded variant to avoid binary download supply chain risk.

## References
- https://github.com/leinelissen/embedded-postgres
