---
id: SEC-T4-05
severity: high
category: OWASP A03 / CWE-79 — Reflected XSS via claudeLoginResult.loginUrl unvalidated href
title: claudeLoginResult.loginUrl rendered as href without protocol validation
file: ui/src/pages/AgentDetail.tsx:1901
status: fixed
fixed_in: ui/src/lib/safeHref.ts (safeExternalHref); ui/src/pages/AgentDetail.tsx:1901
---

## Description

The `claudeLoginResult.loginUrl` value — returned from the server after running `claude login` in a sandbox — is rendered directly as an `<a href>` without any protocol check:

```tsx
// AgentDetail.tsx:1897-1908
{claudeLoginResult?.loginUrl && (
  <p className="text-xs">
    Login URL:
    <a
      href={claudeLoginResult.loginUrl}   // ← no protocol guard
      className="text-blue-600 underline ..."
      target="_blank"
      rel="noreferrer"
    >
      {claudeLoginResult.loginUrl}
    </a>
  </p>
)}
```

The `loginUrl` is derived from the output of `claude login` running inside a sandbox/Docker container. If an attacker can influence the output of that subprocess (e.g., via a malicious Claude version, compromised sandbox image, or SSRF), they could inject a `javascript:` URL that executes when the user clicks "Login URL".

This is a stored-reflected hybrid: the value is not persisted in the database directly, but it is stored in React state from an API response. The attack requires either a compromised server process or a compromised Claude binary.

## Impact

- XSS execution in the authenticated MnM origin when user clicks the login URL.
- The attack vector is low-likelihood in a benign environment but non-zero: any supply chain compromise of the Claude CLI could weaponize this.

## Reproduction

1. Modify the sandbox exec response (or intercept the API) to return `{ loginUrl: "javascript:alert(document.domain)" }`.
2. In `AgentDetail`, trigger the Claude login flow.
3. Click the displayed "Login URL" link.
4. JavaScript executes in the authenticated origin.

## Recommendation

Apply a strict URL guard before rendering the href:

```tsx
const safeCloudeLoginUrl = claudeLoginResult?.loginUrl
  ? /^https?:\/\//.test(claudeLoginResult.loginUrl) ? claudeLoginResult.loginUrl : undefined
  : undefined;
```

Or centralize: create a `safeExternalHref(url: string | undefined): string | undefined` utility and use it consistently across the codebase (see also SEC-T4-04 and SEC-T4-06).

## References

- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
