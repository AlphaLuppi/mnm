---
id: SEC-T8-12
severity: low
category: CWE-209 Information Exposure Through an Error Message
title: Anthropic API error messages may leak internal configuration details in SSE stream
file: server/src/services/workflow-ai-assistant.ts:376-390 / server/src/routes/governed-workflows-ai.ts:173-179
status: open
---

## Description

When the Anthropic API call fails, the raw error message is forwarded to the client via the SSE stream:

```ts
// workflow-ai-assistant.ts:376-390
.catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  const isMissingKey = /ANTHROPIC_API_KEY/.test(message);
  push({
    type: "error",
    error_code: isMissingKey ? "ANTHROPIC_NOT_CONFIGURED" : "LLM_ERROR",
    message,  // ← raw Anthropic error message forwarded to client
    hints: isMissingKey
      ? ["Set ANTHROPIC_API_KEY in your .mnm/instances/default/.env"]
      : undefined,
  });
});
```

The Anthropic API error response body (parsed via `response.text()` in `defaultAnthropicStreaming`) is included verbatim in the `message` field. Anthropic's error responses may contain:
- The model name and version (`claude-sonnet-4-6`) — currently also hardcoded in source but could be considered internal config.
- API error codes and diagnostic information that reveals rate limiting thresholds.
- In the `ANTHROPIC_NOT_CONFIGURED` case, the **`.mnm/instances/default/.env` path** is sent to the client — this reveals the server's internal directory structure.

The route-level catch block in `governed-workflows-ai.ts` also forwards `err.message` from any unexpected throw:
```ts
writeEvent({
  type: "error",
  error_code: "AI_CHAT_UNEXPECTED",
  message,  // ← arbitrary error message
});
```

## Impact

- **Information disclosure**: Reveals internal file paths (`.mnm/instances/default/.env`), API tier information, and server configuration details to authenticated users.
- **Reconnaissance value**: Knowing the Anthropic model version, the .env path structure, and rate limit thresholds helps an attacker plan targeted attacks.
- **Low severity** because the information is only accessible to authenticated users with `WORKFLOWS_CREATE` permission — not publicly exploitable.

## Recommendation

1. **Sanitize error messages before sending to clients**:
   - Catch Anthropic API errors and return a generic `LLM_ERROR` message without the raw body.
   - Remove the internal path hint from `ANTHROPIC_NOT_CONFIGURED` errors (or make it admin-only).
2. **Log the detailed error server-side** (already done via `logger.error`) and return only a safe summary to the client.
3. **Structured error types**: define a whitelist of safe error message templates; never include raw exception strings.
