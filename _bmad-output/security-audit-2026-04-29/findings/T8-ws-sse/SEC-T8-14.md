---
id: SEC-T8-14
severity: low
category: CWE-330 Use of Insufficiently Random Values / CWE-284 Improper Access Control
title: local_trusted mode WS bypass — full board access without any credentials on loopback
file: server/src/realtime/live-events-ws.ts:120-130 / server/src/realtime/chat-ws.ts:153-166
status: open
---

## Description

In `local_trusted` deployment mode, any WebSocket connection without a token or session cookie is automatically granted a full board context with `bypassTagFilter: true`:

```ts
// live-events-ws.ts:121-130
if (opts.deploymentMode === "local_trusted") {
  return {
    companyId,
    actorType: "board",
    actorId: "board",
    tagIds: new Set<string>(),
    bypassTagFilter: true,          // ← sees ALL events across ALL tags
    agentVisibilityCache: new Map(),
  };
}
```

While `local_trusted` mode is intentionally restricted to loopback binding (`isLoopbackHost` check in `index.ts`), this security model has several weaknesses:

1. **Browser-based CSWSH** (compounded by SEC-T8-01): Any web page opened in the local browser (malicious ad, compromised npm package in the dev server) can connect to `ws://localhost:3100/api/companies/*/events/ws` without any credentials and receive all live events with full board visibility.
2. **Docker/container environments**: In Docker, `localhost` inside a container is not the host's localhost — but port mapping (`-p 3100:3100`) re-exposes the server to the container's loopback. Other containers on the same Docker network that share the host network namespace can connect without credentials.
3. **Tailscale/VPN access**: If the binding host is a Tailscale IP (the startup banner explicitly mentions Tailscale), `isLoopbackHost` returns false and `local_trusted` mode is refused. But if users manually bind to `0.0.0.0` (forbidden but not impossible) and run in `local_trusted`, the server rejects at startup only if `host !== loopback` — so the loopback check is enforced. This is acceptable.
4. **The companyId in the URL is never verified against anything** in `local_trusted` mode — the `authorizeUpgrade` function accepts any UUID in the URL path, even one that doesn't exist in the database.

## Impact

- In the intended single-user localhost scenario, this is working as designed.
- The risk emerges when the browser is used on the same machine and has a compromised extension or opens a page with malicious JavaScript. The CSWSH + local_trusted bypass = full real-time read access to all company data without any authentication.
- The companyId bypass (last point) means a crafted URL like `/api/companies/00000000-0000-0000-0000-000000000000/events/ws` succeeds and receives an empty stream — which is low risk but confirms the auth bypass.

## Recommendation

1. **Add Origin validation even in local_trusted mode**: only accept connections with `Origin: http://localhost:<port>` or `Origin: http://127.0.0.1:<port>`. Reject all other origins with 403.
2. **Validate companyId existence** in `local_trusted` mode before granting access (a quick DB lookup).
3. **Document the threat model**: make it clear in the security docs that `local_trusted` mode assumes physical control of the machine and a trusted browser environment.
