---
id: SEC-T4-07
severity: medium
category: OWASP A01 / CWE-601 — Open Redirect
title: ?next= parameter in /auth route accepts arbitrary paths including external URLs via react-router navigate()
file: ui/src/pages/Auth.tsx:26,42,71
status: open
---

## Description

The `/auth` page reads a `?next=` query parameter and uses it directly as the navigation target after successful authentication:

```typescript
// Auth.tsx:26
const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);

// Auth.tsx:42 and 71
navigate(nextPath, { replace: true });
```

`navigate()` is a thin wrapper around React Router's `useNavigate()` from `lib/router.tsx`. React Router's `navigate()` **does accept full external URLs** (e.g., `http://evil.com`) — if the string starts with `http://`, react-router will call `window.location.href = url` for external navigation.

**Verification of react-router behavior:** React Router v6's `navigate()` function passes the `to` string to the history API. If the string is an absolute URL (contains `://`), React Router performs an external redirect via `window.location.href`. The `applyCompanyPrefix()` helper in `lib/company-routes.ts` only processes paths starting with `/` (line 79: `if (!pathname.startsWith("/")) return path;`) — external URLs are returned unmodified.

**Construction of attack URL:**
```
https://mnm.example.com/auth?next=https%3A%2F%2Fevil.com%2Fphishing
```

A user clicking this link, who then authenticates, is transparently redirected to `evil.com`.

## Impact

- Phishing: attacker distributes a link to `mnm.example.com/auth?next=evil.com` — victims authenticate and land on attacker's site.
- Credential harvesting, session theft if combined with a lookalike page.

**Partially mitigating factors:**
- Requires the user to click the attacker-supplied link.
- Auth page redirects are common attack vectors in phishing campaigns.

## Reproduction

1. Navigate to `/auth?next=https://evil.com`.
2. Sign in.
3. After successful auth, `navigate("https://evil.com", {replace: true})` is called.
4. Verify behavior in react-router v6: the browser navigates to `https://evil.com`.

## Recommendation

Restrict `nextPath` to same-origin relative paths before use:

```typescript
function safePath(raw: string | null): string {
  if (!raw) return "/";
  // Allow only relative paths starting with /
  try {
    // Detect absolute URLs (including //evil.com protocol-relative)
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

const nextPath = useMemo(() => safePath(searchParams.get("next")), [searchParams]);
```

Apply the same guard to all `?next=` usages in `App.tsx`, `OAuthConsent.tsx`, `BoardClaim.tsx`, `InviteLanding.tsx`.

## References

- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- [OWASP Unvalidated Redirects and Forwards](https://owasp.org/www-project-top-ten/2017/A10_2017-Unvalidated_Redirects_and_Forwards)
