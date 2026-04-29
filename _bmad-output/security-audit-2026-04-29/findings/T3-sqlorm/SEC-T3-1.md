---
id: SEC-T3-1
severity: high
category: OWASP A03 / CWE-89
title: Vector embedding string injected raw into SQL template literal without parameterization
file: server/src/services/rag.ts:26-43
status: open
---

## Description

In `ragService.searchChunks`, the pgvector query embedding is converted to a string with:

```ts
const vectorStr = `[${queryEmbedding.join(",")}]`;
```

This string is then interpolated directly as a Drizzle template literal value in two places:

```ts
1 - (embedding <=> ${vectorStr}::vector) as similarity
ORDER BY embedding <=> ${vectorStr}::vector
```

When Drizzle receives a string value inside `sql\`...\``, it treats it as a **parameterized bind value** and postgres serializes it as a bound parameter literal. However, the **`::vector` cast is concatenated as raw SQL after the bind** — the actual issue is that `vectorStr` is a *JavaScript-built string* that bypasses type safety. If `queryEmbedding` contains non-numeric elements (e.g., objects with `.toString()` returning `'1]); DROP TABLE document_chunks; --'`), the parameter value could break the cast expression.

More critically: `queryEmbedding` is typed as `number[]` but arrives from OpenAI's API response parsed via `(await response.json()) as any` in `embedding.ts:48`. If the API response is tampered or the OpenAI provider is replaced, arbitrary strings could flow into this array.

## Impact

- In the current OpenAI-only path: Low practical risk because the array comes from a trusted external API.
- If `queryEmbedding` is ever derived from user input or an untrusted external source (e.g., future cached embeddings stored in DB and retrieved, user-provided pre-computed vectors), this becomes a high-severity SQL injection vector.
- The `::vector` cast means malformed input could cause a PostgreSQL parse error, enabling DoS.
- Since `document_chunks` is RLS-protected, data exfiltration would require bypass, but error-based information leakage is possible.

## Reproduction (conceptual PoC)

If `queryEmbedding` could contain a string element such as:
```
queryEmbedding = ["0.1", "0.2', (SELECT current_setting('app.current_company_id'))::float, '0"]
```
The resulting `vectorStr` would be:
```
[0.1, 0.2', (SELECT current_setting('app.current_company_id'))::float, '0]
```
This would produce malformed SQL. With type coercion or future code paths accepting user-provided vectors, this could escalate.

## Recommendation

1. Validate that every element of `queryEmbedding` is a finite number before building `vectorStr`:
```ts
if (!queryEmbedding.every(v => typeof v === 'number' && Number.isFinite(v))) {
  throw new Error('Invalid embedding vector: non-finite values');
}
```
2. Consider using Drizzle's `sql.placeholder` or passing the vector as a properly typed parameter using `::vector` cast with the whole literal as a parameterized string (Drizzle will quote it).

## References

- CWE-89: Improper Neutralization of Special Elements used in an SQL Command
- Drizzle ORM docs: tagged template literal parameterization behavior
