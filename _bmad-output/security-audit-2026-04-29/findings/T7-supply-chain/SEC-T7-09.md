---
id: SEC-T7-09
severity: medium
category: OWASP A06 / CWE-1104
title: DOMPurify@3.3.3 (direct) + @3.2.7 (transitive) — Multiple XSS bypasses (8 advisories)
file: ui/package.json (direct: dompurify ^3.3.3), bun.lock (transitive via mermaid, monaco-editor)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`bun audit` reports 8 advisories against `dompurify < 3.3.2`. The direct dependency `dompurify@3.3.3` in `ui/package.json` is up-to-date, but a **transitive install of `dompurify@3.2.7`** exists in `.bun/dompurify@3.2.7` (pulled by `mermaid` or `monaco-editor`).

The 8 moderate advisories include:
- **GHSA-h8r8-wccr-v5f2** — Mutation-XSS via re-contextualization
- **GHSA-v2wj-7wpq-c8vv** — Cross-site scripting vulnerability
- **GHSA-cjmm-f4jc-qw8r** — ADD_ATTR predicate skips URI validation
- **GHSA-cj63-jhhr-wcxv** — USE_PROFILES prototype pollution allows event handlers
- **GHSA-39q2-94rc-95cp** — FORBID_TAGS bypassed by function-based ADD_TAGS predicate
- **GHSA-h7mw-gpvr-xq4m** — FORBID_ATTR/FORBID_TAGS asymmetry bypass
- **GHSA-crv5-9vww-q3g8** — SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode
- **GHSA-v9jr-rg53-9pgp** — Prototype Pollution to XSS via CUSTOM_ELEMENT_HANDLING fallback

## Impact
- The **direct** `dompurify@3.3.3` is not affected by these CVEs.
- The **transitive** `dompurify@3.2.7` (used inside mermaid/monaco rendering) may allow XSS when rendering untrusted diagram content or code.
- If mermaid renders user-supplied diagram source without going through the safe 3.3.3 version, XSS is possible.

## Reproduction
1. Render a mermaid diagram with a crafted XSS payload in the diagram source.
2. If mermaid uses its bundled `dompurify@3.2.7` internally, the bypass activates.

## Recommendation
1. Override `dompurify` to force `>= 3.3.2` everywhere:
```json
"overrides": {
  "dompurify": "^3.3.4"
}
```
2. Upgrade `mermaid` to a version that depends on `dompurify >= 3.3.2`.
3. Ensure all user-supplied content (workflow diagrams, AI assistant output, markdown) is sanitized using the app's own `dompurify@3.3.3` instance, not mermaid's internal one.

## References
- https://github.com/advisories/GHSA-h8r8-wccr-v5f2
- https://cure53.de/fp2015.pdf (DOMPurify research)
