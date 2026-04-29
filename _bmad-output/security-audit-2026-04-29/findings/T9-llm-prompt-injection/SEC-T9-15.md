---
id: SEC-T9-15
severity: low
category: LLM06 - Sensitive Information Disclosure
title: CAO prompt template stored as plaintext in adapterConfig JSONB — any user with agents:read can retrieve the full CAO system prompt
file: server/src/services/cao.ts:148-149 / server/src/services/cao.ts:126-130
status: open
---

## Description

The CAO's system prompt is stored in the `agents.adapterConfig` JSONB column:

```typescript
adapterConfig: {
  promptTemplate: CAO_PROMPT_TEMPLATE,
},
```

And refreshed on every server start:
```typescript
await db.update(agents).set({
  adapterConfig: { promptTemplate: CAO_PROMPT_TEMPLATE },
  updatedAt: new Date(),
}).where(eq(agents.id, existing.id));
```

The `adapterConfig` column is returned by the agents API (`GET /companies/:companyId/agents/:agentId`). Any user with `AGENTS_READ` permission can retrieve the full CAO system prompt, including:
- The complete list of MnM API endpoints the CAO knows about
- The full agent creation protocol (with privilege escalation instructions)
- The `MNM_API_URL`, `MNM_API_KEY`, `MNM_AGENT_ID` env var names used

While this specific prompt template is defined in source code (not a true secret), the broader pattern is dangerous:
1. Operators who customize `promptTemplate` for their company's CAO are exposing their custom instructions
2. The prompt reveals the exact API surface the CAO uses, aiding attackers in planning social engineering attacks against the CAO
3. Any company-customized `adapterConfig.promptTemplate` fields are similarly exposed to all users with `AGENTS_READ`

## Impact

- **Prompt reconnaissance**: attackers can read the exact system prompt before attempting prompt injection (makes injection more targeted and effective)
- **API surface disclosure**: the CAO prompt lists internal API endpoints that may not be publicly documented
- **Custom prompt leakage**: companies that customize agent prompts with business-specific instructions have those instructions exposed to all employees

## Recommendation

1. **Redact `promptTemplate` from API responses**: in the agents API serializer, exclude or mask `adapterConfig.promptTemplate` from the response for non-admin users
2. **Separate prompt storage**: store system prompts in a dedicated `agent_prompts` table with stricter read permissions (`AGENT_PROMPTS_READ` separate from `AGENTS_READ`)
3. **Prompt hash exposure only**: return a SHA256 hash of the prompt template in the API response (for change detection) instead of the full content

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM06)
- CWE-200: Exposure of Sensitive Information to Unauthorized Actor
