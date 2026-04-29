---
id: SEC-T3-4
severity: medium
category: OWASP A03 / CWE-89
title: JSONB operator queries with Drizzle sql template — input flow analysis required
file: server/src/services/activity.ts:104, server/src/routes/agents.ts:1706
status: open
---

## Description

Several queries use the JSONB `->>` operator inside Drizzle `sql\`\`` template literals to filter by JSON field values:

```ts
// activity.ts:104
sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`,

// routes/agents.ts:1706
sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issue.id}`,
```

These patterns are **correctly parameterized** — `${issueId}` and `${issue.id}` are Drizzle template interpolations that become bound parameters. However, two concerns remain:

### Concern 1: issueId source validation
- `issueId` in `activity.ts` comes from a caller that passes it from `req.params.issueId`. The route validates: `const isIdentifier = /^[A-Z]+-\d+$/i.test(rawId)` — if not a project identifier format, it queries by UUID with `issueSvc.getById(rawId)`.
- The UUID is then the `issue.id` returned from DB — clean.
- `issueId` passed to `runsForIssue()` (activity service) comes from the same already-validated route layer → SAFE.

### Concern 2: The `activityLog` subquery inside sql``
```ts
sql`exists (
  select 1
  from ${activityLog}
  where ${activityLog.companyId} = ${companyId}
    and ${activityLog.entityType} = 'issue'
    and ${activityLog.entityId} = ${issueId}
    and ${activityLog.runId} = ${heartbeatRuns.id}
)`,
```

`${activityLog}` is a Drizzle table reference (safe identifier). `${issueId}` is bound. This is safe.

### Real concern: unvalidated JSONB key names
The operator uses a **static key** `'issueId'` (string literal in SQL, not user-controlled). This is safe. But if any future code passes user-controlled key names to JSONB operators like `${table.field} ->> ${userKey}`, that would be vulnerable. This finding documents the pattern as an audit anchor.

## Impact

- Current code: LOW — parameterization is correctly applied, keys are static.
- Future code: HIGH if user-controlled keys are ever passed into JSONB operators without validation.

## Reproduction

No current PoC — this is a pattern monitoring finding.

## Recommendation

1. Add a code comment or lint rule: JSONB key names used in `->>` must NEVER come from user input unless validated against a whitelist.
2. Document that `sql\`${table.column} ->> 'hardcoded_key'\`` is the only safe JSONB query pattern.
3. Consider a custom ESLint rule that flags `${variable}` in JSONB operator positions within `sql\`\`` templates.

## References

- Drizzle ORM: Tagged template parameterization
- PostgreSQL JSONB operators
- CWE-89
