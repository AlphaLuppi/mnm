---
id: SEC-T8-05
severity: high
category: CWE-862 Missing Authorization / OWASP A01:2021 Broken Access Control
title: SSE AI assistant rate limiter collapses all unauthenticated users to single "anon" bucket
file: server/src/routes/governed-workflows-ai.ts:104-121
status: open
---

## Description

The SSE endpoint rate limiter uses `companyId:userId` as its key. When `userId` is null (which can happen for agent-type actors or when `req.actor?.type !== "board"`), the key becomes `companyId:anon`:

```ts
const userId =
  req.actor?.type === "board" ? req.actor.userId ?? null : null;
// ...
const limitKey = `${companyId}:${userId ?? "anon"}`;
if (!concurrency.acquire(limitKey)) {
  return apiError(res, 429, "AI_RATE_LIMIT", ...);
}
```

This means ALL non-board actors (agents, CAO, any future actor type) sharing the same `companyId` are pooled into a single rate-limit bucket. The limit is 3 concurrent requests.

**Scenario A — DoS via starvation**: A single misbehaving agent that sends 3 concurrent AI chat requests blocks ALL other agents in the same company from using the AI assistant until those requests complete (up to 120s each, given the Anthropic timeout).

**Scenario B — Miscount**: If `userId` is legitimately null for board actors (e.g. `req.actor.userId` is unset in some edge case), multiple distinct users are all counted as "anon" and share the 3-slot pool, causing unexpected 429s.

**Scenario C — Rate limit bypass by changing actor type**: If an actor can change its `type` attribute (through another vulnerability) from `board` to something else, it escapes per-user tracking and gets the shared anon bucket — potentially with fewer competitors.

## Impact

- **Targeted DoS**: An attacker with any valid agent API key for company X can consume all 3 concurrent AI slots, preventing all other agents/users in company X from accessing the AI assistant.
- **Cost amplification**: Without proper per-actor limits, a single agent can sustain 3 parallel 120-second LLM streams (= 6 minutes of continuous Claude Sonnet token generation per rolling window).
- **Incorrect rate-limiting logic**: The anon bucket conflation is a logic error that may silently affect production behavior.

## Reproduction

1. Obtain 3 agent API keys for company X (or one key used 3 times in parallel).
2. Send 3 concurrent POST requests to `/api/companies/X/governed-workflows/my-wf/ai/chat` with large messages.
3. A 4th request from any other actor (including a board user's agent) in company X receives HTTP 429.
4. Observe that the 429 message says "for this user" but the bucket was shared.

## Recommendation

1. **Use a stable actor identifier for all actor types**: change the key to `${companyId}:${req.actor?.type === "agent" ? req.actor.agentId : req.actor?.userId ?? "anon"}`. This gives each agent its own 3-slot bucket.
2. **Separate limits per actor type**: board users get N slots, agents get M slots — prevents one type from starving the other.
3. **Cap the absolute per-company total** regardless of actor type: e.g. max 20 concurrent across all actors in a company.
4. **Use Redis for the counter** in multi-instance deployments (the current in-memory `Map` is per-process only, noted in the source comment).
