---
id: SEC-T8-07
severity: medium
category: CWE-613 Insufficient Session Expiration / CWE-262 Not Using Password Aging
title: Agent API keys never expire — no expiresAt column, no TTL enforcement
file: packages/db/src/schema/agent_api_keys.ts / server/src/realtime/live-events-ws.ts:177-183
status: open
---

## Description

The `agent_api_keys` table schema has no `expiresAt` / `expires_at` column:

```ts
export const agentApiKeys = pgTable("agent_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

The only lifecycle control is `revokedAt` (manual, admin-initiated). There is no automatic TTL. The WS authorization query (`authorizeUpgrade`) only checks `isNull(agentApiKeys.revokedAt)`:

```ts
.where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
```

Keys issued at project inception may still be valid years later with no requirement for rotation.

## Impact

- **Long-lived credential exposure**: A key leaked via logs (SEC-T8-02), a compromised agent, or a disgruntled employee gives indefinite WS access to the agent's company.
- **No rotation incentive**: Without expiry, operators have no operational mechanism or reminder to rotate keys.
- **Audit gap**: `lastUsedAt` is updated on each WS upgrade, but there is no record of when a key was last actively used for more than a quick probe — a key used once and abandoned remains valid.
- Compounded by: no WS mid-session revalidation (SEC-T8-04), so even if expiry were added, existing connections would not be terminated.

## Recommendation

1. **Add `expiresAt` column** to `agent_api_keys` with a default TTL (e.g. 90 days).
2. **Enforce in `authorizeUpgrade`**: add `isNull(agentApiKeys.expiresAt) OR agentApiKeys.expiresAt > NOW()` to the query.
3. **Notify agents** (via WS close frame or a `key_expiring` live event) 7 days before expiry.
4. **Auto-rotate mechanism**: expose a `POST /api/companies/:cid/agents/:aid/api-keys/:kid/rotate` endpoint that issues a new key and revokes the old one atomically.
5. **Fix SEC-T8-04** in conjunction: terminate open WS connections when their key expires.
