---
id: SEC-T3-8
severity: info
category: OWASP A03 / CWE-913
title: Gate runner executes arbitrary JS in isolated-vm — SQL injection boundary if DB helpers added
file: packages/gate-runner/src/run-single-gate.ts:141-147, packages/gate-runner/src/isolate-helpers.ts
status: open
---

## Description

The gate runner executes arbitrary JavaScript (gate source code compiled from TypeScript) inside an `isolated-vm` isolate. The V8 isolation context runs `context.eval()` with gate-supplied code, and also with a JSON-serialized context object:

```ts
// run-single-gate.ts:147
await context.eval(`globalThis.ctx = JSON.parse(${JSON.stringify(ctxJson)});`);
```

The `jsCode` is compiled from gate source TypeScript files retrieved from a git repository. The security boundary relies on:
1. `isolated-vm` V8 isolation (memory limit 256MB, timeout 5s)
2. No `require()` available except `@mnm/governed-workflows`
3. No filesystem/network access in the sandbox
4. `helpers` is currently empty `{}` — no host capabilities exposed

Key observations:

1. **`JSON.stringify(ctxJson)` in eval string**: The pattern `context.eval("globalThis.ctx = JSON.parse(" + JSON.stringify(ctxJson) + ");")` is safe because `JSON.stringify` always produces valid JSON — it escapes all special characters. No injection possible here.

2. **`installHelpers` and host function bridge**: The helpers bridge passes args from the isolate to host with `copy:true`. Currently helpers is `{}` (empty), so no host capabilities are exposed.

3. **No SQL queries in gate runner**: Gates do NOT have direct DB access. The gate output `{ pass, report }` is validated by Zod schema and stored as text — not executed as SQL.

4. **No current DB injection path from gates** — this is an INFO finding about a future risk boundary.

## Impact

- **Current state**: LOW — gates run in isolated-vm with no DB access and no SQL execution path.
- **Future risk**: If a `helpers` object with DB query capabilities is ever exposed to gate code, arbitrary code execution in the isolate becomes a SQL injection vector via the helper bridge.
- **DoS**: Gate infinite loops are killed by the 5s timeout. Memory is bounded at 256MB.

## Recommendation

1. Document the security contract: gates MUST NOT receive helpers that have direct DB query capabilities.
2. If DB helpers are ever added (e.g., `ctx.helpers.query`), implement strict query whitelisting at the bridge level — only allow SELECT from pre-approved table/column combinations.
3. Add a security test: verify that gate code cannot exfiltrate `companyId` via the report string in a way that bypasses Zod schema validation.
4. Monitor `isolated-vm` CVEs — the package has had security issues in the past.

## References

- isolated-vm security model
- CWE-913: Improper Control of Dynamically-Managed Code Resources
- OWASP A03 (indirect — code injection leading to SQL)
