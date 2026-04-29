---
id: SEC-T8-09
severity: medium
category: CWE-400 Uncontrolled Resource Consumption / CWE-770 Allocation without Limits
title: SSE AI assistant rate limiter is per-process in-memory only — bypassable in multi-instance deployments
file: server/src/routes/governed-workflows-ai.ts:51-75
status: open
---

## Description

The concurrency counter for the SSE AI chat endpoint is an in-process JavaScript `Map`:

```ts
// governed-workflows-ai.ts — factory-level (per Router instance)
function createConcurrencyCounter(max: number): ConcurrencyCounter {
  const counts = new Map<string, number>();
  ...
}
const concurrency = createConcurrencyCounter(MAX_CONCURRENT_PER_ACTOR);
```

This counter is shared across all requests handled by the same Node.js process, but is invisible to other processes. In a horizontally scaled deployment (multiple server instances behind a load balancer, or a cluster with Node.js `cluster` module), each process has its own independent counter.

A user who can reach multiple server processes (which is the normal case with a load balancer in round-robin mode) can bypass the 3-concurrent-request limit by sending each request to a different process:

- Process A: 3 slots occupied (limit reached).
- Process B: 3 slots occupied (limit reached, independently).
- Total: 6 concurrent Claude Sonnet streams per user, instead of 3.
- With N processes: N × 3 concurrent streams.

The source code acknowledges this: the comment in `governedWorkflowsAiRoutes` says "Best-effort in-memory Map; no cluster coordination."

The standard HTTP rate limiter (`createRateLimiter` in `app.ts`) explicitly supports Redis for multi-instance coordination. The AI concurrency counter does not.

## Impact

- **LLM cost amplification**: In a 10-instance cluster, a user can run 30 concurrent Claude Sonnet sessions simultaneously. At current Sonnet pricing (~$3/MTok output), sustained abuse could generate significant unexpected costs.
- **Cluster-wide resource exhaustion**: Each Anthropic streaming call holds an open HTTP connection to the Anthropic API for up to 120 seconds. Thirty concurrent streams per attacker (times multiple attackers) can exhaust file descriptor limits or Anthropic rate limits.
- **Bypass of intended access controls**: The 3-concurrent limit is a deliberate design decision; in production it is ineffective without distributed state.

## Reproduction

1. Deploy 2+ server instances behind a load balancer (or use the `cluster` module).
2. Send 6 POST requests to `/ai/chat` — route 3 to instance A, 3 to instance B.
3. All 6 proceed; no 429 is returned.

## Recommendation

1. **Use Redis for the concurrency counter** (same pattern as `createRateLimiter`):
   - `INCR companyId:userId:ai_concurrent` with `EXPIRE` / `SET NX PX`.
   - Or use a Redis MULTI/EXEC transaction for atomic check-and-increment.
2. **Alternatively**: use the existing `apiRateLimiter` (Redis-backed when available) with a tighter window for the `/ai/chat` route rather than a separate in-memory counter.
3. **Short-term mitigation**: document that the limit is best-effort only in single-process deployments; add an explicit warning for cluster deployments.
