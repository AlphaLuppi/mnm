---
id: SEC-T4-12
severity: low
category: OWASP A05 / CWE-693 — Sensitive data in localStorage
title: Company ID, UI preferences, and draft content stored in localStorage (XSS-accessible)
file: ui/src/context/CompanyContext.tsx:43, ui/src/components/CommentThread.tsx:65, ui/src/components/NewIssueDialog.tsx:138
status: open
---

## Description

Multiple pieces of data are persisted in `localStorage`, which is accessible to any JavaScript running on the same origin (i.e., any XSS payload):

| Key | Location | Data stored |
|---|---|---|
| `mnm.company` | `CompanyContext.tsx:43` | Selected company ID |
| `mnm.theme` | `ThemeContext.tsx:55` | UI theme preference |
| `comment-draft-*` | `CommentThread.tsx:65` | Comment draft text |
| `mnm.newissue.draft` | `NewIssueDialog.tsx:138` | New issue draft (title + description) |
| `mnm.onboarding.*` | `OnboardingWizard.tsx:186` | Onboarding progress |
| Various | `Dashboard.tsx`, `Drift.tsx`, `Inbox.tsx`, `IssuesList.tsx` | UI state |

**What is NOT in localStorage:** The session token itself. BetterAuth uses `httpOnly` cookies, which are not accessible to JavaScript. This is correct and good.

**What IS at risk from XSS:** Comment drafts may contain sensitive/confidential text typed by users. Issue drafts (title + description) can contain confidential project details. The company ID is not a secret but can be used to craft further API calls in a post-XSS scenario.

No credentials, tokens, or passwords were found in localStorage.

## Impact

- Low: Currently, no authentication material is in localStorage.
- If XSS occurs (e.g., via SEC-T4-03, SEC-T4-04, SEC-T4-05, or SEC-T4-06), the XSS payload can read all localStorage keys and exfiltrate draft content or UI state.
- The primary defence remains preventing XSS — the localStorage exposure is a secondary concern.

## Recommendation

1. Implement CSP (SEC-T4-01) to reduce XSS risk — the localStorage exposure is secondary.
2. Consider encrypting sensitive draft content if it may include confidential data (low priority).
3. Audit if any future feature stores tokens or PII in localStorage — add a lint rule to flag new `localStorage.setItem` calls for review.

## References

- [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage)
