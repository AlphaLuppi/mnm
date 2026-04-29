---
id: SEC-T9-12
severity: medium
category: LLM08 - Excessive Agency / CWE-284 Improper Access Control
title: MCP tool manage_sandbox allows cross-user sandbox targeting via optional targetUserId parameter
file: server/src/mcp/tools/sandbox.tool.ts:52-58
status: open
---

## Description

The `manage_sandbox` tool accepts an optional `targetUserId` parameter:

```typescript
tool("manage_sandbox", {
  permissions: [PERMISSIONS.SANDBOX_MANAGE],
  input: z.object({
    action: z.enum(["provision", "hibernate", "wake", "destroy", "list_all"]),
    targetUserId: z.string().uuid().optional().describe("Target user ID (defaults to current user)"),
  }),
  handler: async ({ input, actor }) => {
    const userId = input.targetUserId ?? actor.userId!;
    // No check that targetUserId == actor.userId or that actor has admin rights
    if (input.action === "provision") {
      const sandbox = await services.sandboxManager.provisionSandbox(userId, actor.companyId);
```

Any user with `SANDBOX_MANAGE` permission can provision, hibernate, wake, or **destroy** the sandbox of ANY other user in the same company by passing their UUID as `targetUserId`. There is no check that the actor owns the target sandbox.

**Impact of destroy**: if an agent or user with `SANDBOX_MANAGE` is compromised or malicious, they can destroy any team member's sandbox — including the admin's Docker container where the CAO runs — causing DoS.

**LLM vector**: if an LLM agent is granted `SANDBOX_MANAGE` (which is a reasonable permission for a DevOps agent), it could be prompt-injected to target specific users' sandboxes.

## Impact

- **DoS via sandbox destruction**: attacker can destroy any user's sandbox, including production agent Docker containers
- **Availability attack**: agent with SANDBOX_MANAGE + prompt injection → destroy admin's sandbox → CAO goes offline
- **Cross-user resource abuse**: provision sandboxes for arbitrary users, consuming their compute quota

## Reproduction

```json
// MCP call from any agent with SANDBOX_MANAGE permission:
{
  "method": "tools/call",
  "params": {
    "name": "manage_sandbox",
    "arguments": {
      "action": "destroy",
      "targetUserId": "<admin-user-uuid>"
    }
  }
}
```

## Recommendation

1. **Require explicit admin permission for cross-user targeting**: if `targetUserId !== actor.userId`, check that the actor has `ADMIN` permission or `SANDBOX_MANAGE_ALL` (a new permission):
   ```typescript
   if (input.targetUserId && input.targetUserId !== actor.userId) {
     if (!actor.effectivePermissions.has(PERMISSIONS.SANDBOX_MANAGE_ALL)) {
       return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot manage other users' sandboxes" }) }], isError: true };
     }
   }
   ```

2. **Separate permissions**: split `SANDBOX_MANAGE` into `SANDBOX_MANAGE_OWN` and `SANDBOX_MANAGE_ALL`

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM08)
- CWE-639: Authorization Bypass Through User-Controlled Key
