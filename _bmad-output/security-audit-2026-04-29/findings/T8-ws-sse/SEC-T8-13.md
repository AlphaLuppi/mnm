---
id: SEC-T8-13
severity: low
category: CWE-330 Use of Insufficiently Random Values / CWE-285 Improper Authorization
title: Chat WS mention_agent — agentId not validated against company membership
file: server/src/realtime/chat-ws.ts:397-418 / server/src/services/agent-mention-handler.ts
status: open
---

## Description

The `mention_agent` message type in the chat WS handler passes `payload.agentId` directly to `agentMentionHandler.handleMention` without validating that the `agentId` belongs to the same company as the channel:

```ts
// chat-ws.ts:397-418
case "mention_agent": {
  const handler = agentMentionHandler(db);
  const result = await handler.handleMention(
    companyId,       // from connection context
    channelId,
    payload.agentId, // ← user-controlled, not validated here
    payload.content,
    actorId,
  );
```

The `chatClientMentionAgentSchema` only checks `agentId: z.string()` (no UUID format, no enum). The schema does not verify that `agentId` belongs to `companyId`.

Looking at the `agentMentionHandler.handleMention` source (grep confirmed: `eq(agents.id, agentId), eq(agents.companyId, companyId)` — line 36), the handler does verify company membership in the DB query. However:

1. The validation is inside the service, not at the WS handler boundary — the `payload.agentId` field is never UUID-validated before the DB call.
2. The `content` field in `mention_agent` is `z.string()` with no length limit — an arbitrarily large string is passed to the A2A bus.
3. A malformed non-UUID `agentId` generates a PostgreSQL error (invalid UUID format) that may bubble up as an unhandled exception in the `handleMention` path, potentially leaking DB error details.

## Impact

- **Low severity**: The DB-level company check (`eq(agents.companyId, companyId)`) prevents cross-tenant agent mentions.
- **Potential DoS**: Invalid UUID strings for `agentId` could cause PostgreSQL errors that propagate through the unhandled `.catch` path in `handleMessage`.
- **Missing content length limit**: A `mention_agent` message with a 10 MB `content` field is accepted, allocated, and forwarded to the A2A bus before any size check.

## Recommendation

1. **Add UUID validation** to `chatClientMentionAgentSchema`:
   ```ts
   const chatClientMentionAgentSchema = z.object({
     type: z.literal("mention_agent"),
     agentId: z.string().uuid(),        // ← add uuid()
     content: z.string().min(1).max(4096), // ← add max
     channelId: z.string().optional(),
   });
   ```
2. **Defense-in-depth**: keep the DB-level company check in `agentMentionHandler`, but add the format check at the schema layer to fail fast.
3. **Error handling**: wrap the `handleMention` call in a try-catch that maps DB errors to a generic `INVALID_MESSAGE` response without leaking the PostgreSQL error details.
