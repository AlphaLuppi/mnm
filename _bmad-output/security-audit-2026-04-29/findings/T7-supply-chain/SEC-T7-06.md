---
id: SEC-T7-06
severity: high
category: OWASP A06 / CWE-1104
title: vite@6.4.1 — Arbitrary File Read via Dev Server WebSocket (GHSA-p9ff-h696-f583)
file: server/package.json, ui/package.json (direct devDependency), packages/db/package.json (via vitest)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
`vite@6.4.1` is installed across multiple workspaces. This version is affected by **GHSA-p9ff-h696-f583**: the Vite dev server WebSocket can be exploited by any website that can communicate with the dev server (on `localhost:5173` by default) to read **arbitrary files from the filesystem** — including environment files, private keys, and source code.

Fixed in `vite >= 6.4.2` (or `>= 5.4.18` for the 5.x branch).

A second advisory **GHSA-4w7w-66w2-5vf9** covers arbitrary file reads via optimized dependency `.map` file handling.

Note: `vite/node_modules/esbuild` bundles `esbuild@0.25.12` (safe), but the Vite version itself is still vulnerable.

## Impact
- **During local development**: any website open in the developer's browser can send crafted WebSocket messages to the Vite dev server and exfiltrate `.env` files, database credentials, private keys.
- Less relevant in production (Vite dev server is not used), but all contributors running `bun run dev` are exposed.

## CVE References
- GHSA-p9ff-h696-f583 — "Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket"
- GHSA-4w7w-66w2-5vf9 — "Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling"

## Reproduction
1. Run `bun run dev:ui` (starts Vite dev server on localhost:5173).
2. Open a browser tab with a malicious page (e.g., from localhost:3000).
3. Page sends a crafted WebSocket handshake to ws://localhost:5173 with path traversal payload.
4. Receives contents of `../../.env` or `/c/Users/andri/.ssh/id_rsa`.

## Recommendation
Upgrade `vite` to `>= 6.4.2` in `server/package.json`, `ui/package.json`:
```json
"vite": "^6.4.2"
```
Run `bun install` and verify `bun.lock` reflects the new version. Also ensure `vitest` (which bundles vite) is updated.

## References
- https://github.com/advisories/GHSA-p9ff-h696-f583
- https://github.com/vitejs/vite/security/advisories
