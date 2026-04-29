---
id: SEC-T3-7
severity: low
category: OWASP A03 / CWE-89
title: ILIKE search uses correct ESCAPE clause but escapeLikePattern only escapes \\, %, _ — not NUL byte
file: server/src/services/issues.ts:97-99, 434-445
status: open
---

## Description

The ILIKE search implementation correctly escapes LIKE metacharacters:

```ts
// issues.ts:97-99
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
```

And passes an explicit ESCAPE clause:
```ts
sql<boolean>`${issues.title} ILIKE ${startsWithPattern} ESCAPE '\\'`
```

This is **mostly correct**. However:

1. **NUL byte (`\x00`)**: PostgreSQL LIKE/ILIKE pattern matching with NUL bytes can cause truncation. If `value` contains `\x00`, the pattern becomes `%\x00%` which PostgreSQL may handle inconsistently. This doesn't cause SQL injection but could cause incorrect search results or DoS if the pattern engine takes exponential time.

2. **Unicode normalization**: Certain Unicode codepoints that normalize to `%` or `_` in some locales could bypass the escape. This is a theoretical concern with ILIKE's locale-dependent behavior.

3. **Pattern length**: No limit on `rawSearch` length. A search query like `?q=aaaa...aaaa%_aaaa...` (10KB with alternating pattern characters) could cause catastrophic backtracking in PostgreSQL's ILIKE implementation.

4. **Comment confirms correctness**: The `ESCAPE '\\'` clause is correct — it ensures the backslash itself is the escape character. This is the safe pattern.

## Impact

- **DoS via ReDoS-equivalent**: Long patterns with `%` and `_` sequences could cause high CPU usage in PostgreSQL's pattern matcher.
- **No SQL injection risk** in current implementation — Drizzle parameterization and ESCAPE clause are correctly applied.
- **Incorrect results**: NUL bytes could cause truncated pattern matching.

## Reproduction (conceptual PoC)

```
GET /api/companies/{id}/issues?q=aaaaaaaaaaaaaaa%_aaaaaaaaaaaaaaa%_...
```
Pattern: `%aaa%_aaa%_aaa%_...% ` — exponential backtracking in ILIKE.

## Recommendation

1. Add a maximum length limit for search queries: `const rawSearch = (filters?.q?.trim() ?? "").slice(0, 200);`
2. Strip NUL bytes: `rawSearch.replace(/\x00/g, '')`.
3. Consider full-text search (PostgreSQL `to_tsvector`/`to_tsquery`) for better performance and injection resistance.

## References

- PostgreSQL LIKE/ILIKE implementation
- CWE-400: Uncontrolled Resource Consumption
