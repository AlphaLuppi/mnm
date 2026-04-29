---
id: SEC-T4-11
severity: low
category: OWASP A05 / CWE-693 — Missing Subresource Integrity
title: index.html inline scripts run without CSP nonce/hash — no SRI on built assets
file: ui/index.html:17-32 (inline script), ui/index.html:300 (module script)
status: open
---

## Description

The `ui/index.html` contains two inline `<script>` blocks:
1. **Theme bootstrap script** (lines 17-32): reads `localStorage`, sets `document.documentElement.classList`.
2. **Canvas splash animation script** (lines 76-298): ASCII animation, defines `window.__dismissMnmLoader`.

Neither script has a `nonce` or hash in a `Content-Security-Policy` header (which is absent entirely — see SEC-T4-01). If CSP is ever added, these inline scripts would be blocked by a `script-src 'self'` policy unless a nonce/hash is added.

Additionally, the built assets (`/assets/index-*.js`) are self-hosted (good — no CDN), but the `crossorigin` attribute on the module script tag (`<script type="module" crossorigin src="/assets/index-*.js">`) in `ui/dist/index.html` has no `integrity` attribute (SRI). This is acceptable for self-hosted assets but should be reviewed if a CDN is ever introduced.

**No external CDN scripts were found** — the app is fully self-hosted, which is good practice.

## Impact

- Low: No current exploitability since CSP is absent. This becomes a blocker when CSP is implemented (SEC-T4-01).
- The `window.__dismissMnmLoader` global function is exposed from the inline script and callable from any XSS payload — it only removes a loading overlay, so no security impact beyond UX.

## Recommendation

1. When implementing CSP (SEC-T4-01), generate a server-side nonce and inject it into both inline `<script>` tags in `index.html` via the Vite SSR plugin or a custom express middleware that rewrites `index.html`.
2. Consider extracting the theme bootstrap to a `<script>` element that can be hashed with `sha256-<hash>` rather than requiring a dynamic nonce (it is a static script).
3. If CDNs are introduced in the future, require SRI (`integrity` + `crossorigin="anonymous"`) on all external scripts and stylesheets.

## References

- [MDN Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [Content Security Policy with nonces](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#unsafe_inline_script)
