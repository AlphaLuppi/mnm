---
id: SEC-T7-16
severity: low
category: OWASP A06 / CWE-1104
title: No GitHub Actions CI/CD pipeline — supply chain review vector is absent but so is automated auditing
file: .github/workflows/ (absent)
status: open
---

## Description
No `.github/workflows/` directory exists in the MnM monorepo. This means:
1. No automated dependency vulnerability scanning on PRs (Dependabot, Snyk, Socket.dev CI).
2. No pinned third-party GitHub Actions to review for supply chain attacks.
3. No automated `bun audit` gate preventing vulnerable packages from entering the codebase.

The absence of CI/CD workflows is itself a supply chain risk because vulnerabilities accumulate undetected.

## Impact
- **Positive**: No risk of malicious third-party GitHub Actions (e.g., `actions/checkout@v3` with mutable tag).
- **Negative**: No automated guard prevents a developer from adding a vulnerable package. The current 29 audit findings (1 critical, 9 high, 19 moderate) entered the codebase without automated detection.

## Recommendation
1. Create `.github/workflows/security.yml` with:
   - `bun audit` on every PR (fail on high/critical)
   - Dependabot or Renovate Bot for automated PR generation on dep updates
2. If GitHub Actions are added in future, **always pin to full commit SHA**, not mutable tags:
   ```yaml
   # BAD
   uses: actions/checkout@v4
   # GOOD
   uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
   ```
3. Enable GitHub's dependency graph + secret scanning for the repository.

## References
- https://docs.github.com/en/code-security/dependabot
- https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
