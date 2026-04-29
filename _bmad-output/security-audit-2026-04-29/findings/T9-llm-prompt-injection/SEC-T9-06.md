---
id: SEC-T9-06
severity: high
category: LLM09 - Overreliance / LLM04 - Model Denial of Service
title: No per-user/per-company rate limit on LLM API costs — cost amplification attack via AI Assistant and trace enrichment
file: server/src/routes/governed-workflows-ai.ts:53 / server/src/services/gold-trace-enrichment.ts:161
status: open
---

## Description

**AI Assistant endpoint (`POST /ai/chat`)**: Limited to 3 concurrent requests per `{companyId, userId}` pair (in-memory, not persisted). This limits concurrency but NOT total request volume. A user can serially send thousands of requests, each up to 10,000 characters × 50 messages = 500KB context + 8,192 output tokens, with no per-hour or per-day cost cap.

```typescript
// routes/governed-workflows-ai.ts
const MAX_CONCURRENT_PER_ACTOR = 3; // concurrency only, no total volume limit
const AI_MODEL = "claude-sonnet-4-6"; // ~$3/1M input, ~$15/1M output tokens
const MAX_TOKENS = 8_192;
```

**Gold trace enrichment**: No rate limit at all. The `backfillGoldEnrichment` function processes ALL completed traces without silver phases in batches of 5 with 2-second delays. If an attacker creates thousands of traces (via the heartbeat API), they can trigger a backfill that calls the LLM thousands of times. Even the per-trace path (`enrichTraceGold`) is called automatically on trace completion — no per-company daily limit.

**Lens analysis (`lens-analysis.ts`)**: No rate limit on `callLlm`. Any user with trace read access can trigger LLM calls via `POST /traces/:id/lens/:lensId/analyze`.

**Window attack**: The `MNM_LLM_GOLD_MODEL` env var is configurable. If an attacker can influence environment config (e.g., via a compromised CI that sets the model), they could switch from Haiku to GPT-4o or Claude Opus, multiplying cost by 10-30x.

## Impact

- **Unbounded API cost**: a single user can generate hundreds of dollars of API costs in minutes by:
  - Sending maximum-size AI chat messages in a tight loop (3 concurrent × serial = effectively unlimited)
  - Creating thousands of agent traces that auto-trigger gold enrichment
- **Denial of Service**: if the Anthropic API key hits rate limits or billing caps, the entire enrichment pipeline stops — legitimate gold analyses fail
- **Cost attribution blindness**: there is no per-company cost tracking for LLM calls (only per-trace token counts)

## Reproduction

```bash
# 1. Authenticated as a user with WORKFLOWS_CREATE permission
# 2. Send 100 sequential max-size AI chat requests
for i in {1..100}; do
  curl -X POST "https://mnm.example.com/api/companies/$CID/governed-workflows/my-wf/ai/chat" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "'$(python3 -c "print('A'*9999)")'"}]}'
done
# Each call = ~10K input + ~8K output ≈ $0.50 per call × 100 = $50 in minutes
```

## Recommendation

1. **Per-user daily token budget**: add a token counter per `{companyId, userId}` with a configurable daily cap (default 100K tokens/day). Store in Redis or PostgreSQL with TTL.

2. **Per-company cost cap**: add `monthly_llm_budget_cents` to the companies table; check against accumulated `costs` before each LLM call.

3. **Enrichment queue with back-pressure**: instead of triggering gold enrichment inline on trace completion, push to a queue with per-company rate limiting (e.g., max 10 enrichments/minute/company).

4. **Request size limits**: the AI assistant already limits content to 10,000 chars per message and 50 messages. Add a total context token estimate check before calling the API.

5. **Cost monitoring alerts**: emit metrics for LLM call costs; alert when a company exceeds a threshold in a time window.

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM04, LLM09)
- CWE-400: Uncontrolled Resource Consumption
