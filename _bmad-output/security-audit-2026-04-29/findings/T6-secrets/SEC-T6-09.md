---
id: SEC-T6-09
severity: low
category: CWE-311 / OWASP A02
title: .env file present in repository root — real credentials may be on-disk
file: .env (exists at repo root)
status: open
---

## Description

The repository's `.gitignore` correctly excludes `.env` and `.env.*` (except `.env.example`). The file is not tracked by git. However, `find` confirms that `.env` physically exists at `/c/Users/andri/IdeaProjects/AlphaLuppi/mnm/.env`.

This audit has **not read the contents of the real `.env`** per the audit scope rules. The finding is structural:

1. The file exists at repo root, adjacent to committed code.
2. Git history shows no prior committed `.env` (safe).
3. However, developer tooling (IDEs, file explorers, accidental `git add .`) could inadvertently stage the file. The `!.env.example` gitignore exception is correct but does not prevent accidental adds.

Additionally, worktrees at `.claude/worktrees/*/` each contain `.env.example` files copied from the main tree, but any developer-created `.env` in a worktree would not be in `.gitignore` by default since worktrees use the parent repo's gitignore.

## Impact

Low risk (file is properly gitignored). Primary risk is developer workflow error exposing real credentials.

## Recommendation

- Consider using a pre-commit hook (e.g., `detect-secrets`, `gitleaks`) to prevent accidental `.env` commits.
- Add to the project's developer onboarding docs: never `git add -A` or `git add .` — always stage files explicitly.
- Confirm worktree `.env` files (if any) are covered by the root `.gitignore`.

## References

- `.gitignore:14` — `.env` pattern
- `.gitignore:15` — `.env.*` pattern
- CWE-311: Missing Encryption of Sensitive Data
