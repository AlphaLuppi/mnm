---
id: SEC-T7-19
severity: low
category: CWE-1104 / Supply Chain
title: pdf-parse@2.4.5 — unofficial fork with unknown maintainer trust level
file: server/package.json (pdf-parse ^2.4.5)
status: open
---

## Description
The original `pdf-parse@1.x` (by ModuleFactory) was well-known for embedding a network request in its test suite that "phoned home" to a remote server in CI environments. The package appears to have been superseded by this fork: `pdf-parse@2.4.5` by **Mehmet Kozan** (`https://mehmet-kozan.github.io/pdf-parse/`).

This is an **unofficial fork** (not the original package). Key observations:
- Package scope changed from `pdf-parse` 1.x (ModuleFactory) to a 2.x fork by a different author.
- The homepage points to a personal GitHub Pages site.
- The package is ESM-first (good) and appears to be a legitimate modernization fork.
- However, the maintainer's identity and security practices are unverified in the context of this audit.

## Impact
- Low risk as the package parses PDFs server-side.
- If the maintainer's npm account is compromised, a malicious version could be pushed.
- PDF parsing itself can be a vector for malicious content (CVE history in pdf.js).

## Recommendation
1. Verify the fork is actively maintained and the npm account is secured with 2FA.
2. Consider pinning to an exact version in `bun.lock` (already done via sha512 hashes).
3. Evaluate alternatives: `pdfjs-dist` (Mozilla), `unpdf` (maintained by the Nuxt team).
4. Ensure uploaded PDFs are size-limited and validated before being passed to `pdf-parse`.

## References
- https://www.npmjs.com/package/pdf-parse (note the version discrepancy between 1.x original and 2.x fork)
