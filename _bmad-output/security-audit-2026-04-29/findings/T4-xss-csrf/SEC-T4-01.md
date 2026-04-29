---
id: SEC-T4-01
severity: critical
category: OWASP A05 / CWE-693 (Missing Security Headers — entire surface)
title: No HTTP security headers on the main application (no CSP, no HSTS, no X-Content-Type-Options, no X-Frame-Options, no Referrer-Policy, no Permissions-Policy)
file: server/src/app.ts
status: fixed
fixed_in: server/src/app.ts — helmet 8.1.0 installed; CSP (enforce, no unsafe-inline on script-src), HSTS (authenticated mode only), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (manual header); trust proxy=1 in authenticated mode
---

## Description

The Express `createApp()` function in `server/src/app.ts` never installs `helmet` or any equivalent security-headers middleware. A grep across the entire server codebase for `helmet`, `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` reveals zero matches on the main HTTP response path.

The only security headers present in the entire server are:
- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'` on the **MCP OAuth consent-data endpoint** (`server/src/mcp/auth/mcp-oauth-router.ts:182-183`) — a single specific route.
- `Access-Control-Allow-Origin: *` on deployment preview proxies (`server/src/middleware/deployment-proxy.ts:63`).

All other responses — including the SPA `index.html`, all API endpoints, the SSE AI assistant stream, and the OAuth callback popup pages — are served with no security headers.

## Impact

| Missing header | Consequence |
|---|---|
| `Content-Security-Policy` | Any XSS (stored or reflected) runs unrestricted, can exfiltrate tokens, modify DOM, phone home. No fallback defense. |
| `X-Frame-Options` / `frame-ancestors` | Any origin can iframe the app — enables clickjacking attacks against authenticated users. |
| `Strict-Transport-Security` | HTTPS not enforced by the browser; MITM downgrade attacks possible on production deployments. |
| `X-Content-Type-Options: nosniff` | Browser MIME sniffing — uploading a file with a safe content type that contains HTML/JS could be executed if served inline. |
| `Referrer-Policy` | Full URL (including auth tokens in query strings) leaked to third-party resources. |
| `Permissions-Policy` | No restrictions on camera, microphone, geolocation, etc. in the browser context. |

## Reproduction

1. Start the server.
2. `curl -I http://localhost:3100/` — observe the complete absence of any of the above headers.
3. The SPA fallback handler (`app.get(/.*/, ...)`) only sets `Cache-Control` and `Content-Type`.

## Recommendation

Install `helmet` as the **first** middleware in `createApp()`:

```typescript
import helmet from "helmet";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],   // Remove 'unsafe-inline' — the loader script in index.html must be hashed
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permissionsPolicy: { /* ... */ },
}));
```

The inline `<script>` in `ui/index.html` (theme bootstrap) requires a nonce or hash to work with `script-src` without `'unsafe-inline'`. Use Vite's `html-plugin` to inject a per-request nonce.

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
