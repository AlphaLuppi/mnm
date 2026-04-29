---
id: SEC-T9-13
severity: medium
category: LLM06 - Sensitive Information Disclosure
title: AI Assistant error messages leak internal workflow error details and git provider error messages to users
file: server/src/services/workflow-ai-assistant.ts:415-428 / server/src/routes/governed-workflows-ai.ts:173-180
status: open
---

## Description

The AI Assistant SSE handler forwards error messages from multiple layers directly to the user:

**Layer 1 — `errorEventFromWorkflowError`**:
```typescript
function errorEventFromWorkflowError(err: unknown): AiAssistantEvent {
  if (err instanceof GovernedWorkflowError) {
    return {
      type: "error",
      error_code: err.code,
      message: err.message,  // Full error message leaked
      hints: err.hints.length > 0 ? err.hints : undefined,
    };
  }
  return {
    type: "error",
    error_code: "WORKFLOW_PARSE_FAILED",
    message: err instanceof Error ? err.message : String(err), // Raw exception message
  };
}
```

**Layer 2 — Anthropic streaming error**:
```typescript
.catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  const isMissingKey = /ANTHROPIC_API_KEY/.test(message);
  push({
    type: "error",
    error_code: isMissingKey ? "ANTHROPIC_NOT_CONFIGURED" : "LLM_ERROR",
    message, // Raw API error message, may include internal details
```

**Layer 3 — Unexpected errors in the route handler**:
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  writeEvent({ type: "error", error_code: "AI_CHAT_UNEXPECTED", message }); // Raw exception
}
```

Git provider errors (from `GovernedWorkflowError` wrapping `GitProviderError`) can include: git repo URLs, internal path structures, authentication failure details. Anthropic API errors can include: rate limit status, account quota details, model-specific errors.

## Impact

- **Information leakage**: attackers can probe the AI assistant endpoint to enumerate:
  - Whether specific workflow names exist (different errors for "not found" vs "parse failed")
  - Git repository URL structure and layout (from git provider errors)
  - Internal path conventions (from `GovernedWorkflowError.hints`)
  - Whether the Anthropic API key is configured and valid (explicit `ANTHROPIC_NOT_CONFIGURED` code)

## Recommendation

1. **Sanitize error messages before client delivery**: map internal error types to generic user-facing messages; log full details server-side only:
   ```typescript
   function sanitizeErrorForClient(code: string, message: string): string {
     switch(code) {
       case "WORKFLOW_NOT_FOUND": return "Workflow not found";
       case "GIT_PROVIDER_ERROR": return "Unable to load workflow files";
       default: return "An error occurred. Please try again.";
     }
   }
   ```

2. **Log full details server-side**: use the existing `logger` to capture full error context for debugging, while sending sanitized messages to clients

3. **Do not expose ANTHROPIC_NOT_CONFIGURED externally**: replace the API key presence check with a generic "AI service unavailable" message

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM06)
- CWE-209: Generation of Error Message Containing Sensitive Information
