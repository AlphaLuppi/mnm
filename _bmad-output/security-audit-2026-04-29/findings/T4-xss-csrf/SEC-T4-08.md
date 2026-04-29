---
id: SEC-T4-08
severity: medium
category: OWASP A05 / CWE-693 — Missing CSRF protection on state-mutating API endpoints
title: No CSRF token on REST API mutations — relies solely on SameSite=Lax cookies
file: server/src/app.ts, server/src/routes/sso-auth.ts:82-84
status: open
---

## Description

The main API endpoints (`/api/companies/:companyId/...`) have no CSRF token mechanism. There is no `csurf` middleware, no double-submit cookie pattern, and no `Origin`/`Referer` header check on mutations.

The session cookie is set by BetterAuth's own mechanism (better-auth's default) and by the SSO-auth route (`sso-auth.ts:82-84`) as:

```typescript
res.cookie("better-auth.session_token", session.token, {
  httpOnly: true,
  // secure: derived from isHttpOnly flag
  sameSite: "lax",
});
```

`SameSite=Lax` provides **partial** CSRF protection:
- It blocks cross-site requests with unsafe methods (POST, PUT, DELETE, PATCH) in most browsers.
- **However**, it does NOT protect against:
  - Cross-subdomain requests (if app is deployed on `app.example.com` and another subdomain is compromised).
  - Navigation-based CSRF (a top-level navigation to a GET endpoint that has side effects).
  - Pre-flight-exempt simple requests (application/x-www-form-urlencoded POST).
  - Older browsers without proper SameSite support.

The MCP OAuth flow **does** implement CSRF tokens for the consent form (mcp-oauth-router.ts:145-194). But the main API has no such protection.

The AI assistant chat endpoint is worth special attention: a CSRF attack against `/api/companies/:companyId/governed-workflows/:name/ai/chat` could trigger expensive Anthropic API calls at the victim's company quota.

## Impact

- Cross-site state mutation for any logged-in user if an attacker can bypass SameSite=Lax (subdomain takeover, old browser, top-level navigation to POST via form).
- Financial impact: CSRF against AI chat endpoints triggers billable Anthropic API calls.
- Data exfiltration via CSRF on GET endpoints that return sensitive data in JSON with `Access-Control-Allow-Origin` misconfiguration (see SEC-T4-02).

## Recommendation

1. **Short-term:** Add an explicit `Origin` header check on all state-mutating endpoints:
   ```typescript
   app.use("/api", (req, res, next) => {
     if (["POST","PUT","PATCH","DELETE"].includes(req.method)) {
       const origin = req.headers.origin;
       if (origin && !trustedOrigins.has(origin)) {
         return res.status(403).json({ error: "Forbidden: Origin not allowed" });
       }
     }
     next();
   });
   ```
2. **Medium-term:** Implement the synchronizer token pattern or double-submit cookie for mutation endpoints.
3. Upgrade session cookies to `SameSite=Strict` where login flows allow it.

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [SameSite Cookie Limitations](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
