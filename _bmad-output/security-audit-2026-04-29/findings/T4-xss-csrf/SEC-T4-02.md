---
id: SEC-T4-02
severity: high
category: OWASP A05 / CWE-693 — Wildcard CORS on deployment preview proxy
title: Access-Control-Allow-Origin: * on /preview/:deploymentId/* allows any origin to read authenticated deployment content
file: server/src/middleware/deployment-proxy.ts:63
status: fixed
---

## Description

The deployment preview proxy unconditionally sets `Access-Control-Allow-Origin: *` on all proxied responses regardless of the request origin:

```typescript
// deployment-proxy.ts:62-63
// Set CORS headers
res.setHeader("Access-Control-Allow-Origin", "*");
```

This endpoint is authentication-gated (session cookie OR a `?token=<shareToken>` query parameter), but the wildcard CORS header means **any third-party origin** can make cross-origin requests to `/preview/:deploymentId/*` and read the response body — as long as it can construct a URL with a valid `?token=`.

Since the proxy forwards requests to `http://127.0.0.1:<port>`, a malicious page could exfiltrate the full content of any deployment preview if it knows (or can guess) the share token. Share tokens are UUID-like but their entropy and distribution mechanism are not reviewed here.

Additionally, `Access-Control-Allow-Origin: *` cannot be combined with `Access-Control-Allow-Credentials: true`; if cookies are ever added here, browsers would reject it — but the current misconfiguration is still problematic for token-based access.

## Impact

- Cross-origin read of authenticated deployment content by arbitrary third-party web pages.
- Combined with a phishing or reflected-XSS vector that leaks a share token, an attacker can silently exfiltrate deployment output.
- The wildcard header applies to every HTTP method, including POST/PUT/DELETE if proxied.

## Reproduction

1. Obtain a share token for a running deployment.
2. From an arbitrary origin (e.g., `http://evil.com`):
   ```javascript
   fetch(`https://mnm.example.com/preview/<deploymentId>/?token=<shareToken>`)
     .then(r => r.text())
     .then(console.log);
   ```
3. The response body is readable because the server returns `Access-Control-Allow-Origin: *`.

## Recommendation

Replace the wildcard with a strict allowlist of trusted origins:

```typescript
const requestOrigin = req.headers.origin;
const allowedOrigins = new Set([process.env.MNM_PUBLIC_URL, ...config.allowedHostnames.map(h => `https://${h}`)]);
if (requestOrigin && allowedOrigins.has(requestOrigin)) {
  res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  res.setHeader("Vary", "Origin");
} else {
  res.removeHeader("Access-Control-Allow-Origin");
}
```

If cross-origin use is not required at all (previews are opened in a browser tab, not fetched from third-party sites), remove the CORS header entirely.

## References

- [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin)
