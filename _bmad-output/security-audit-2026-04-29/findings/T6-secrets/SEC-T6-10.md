---
id: SEC-T6-10
severity: low
category: CWE-312 / OWASP A02
title: E2E test password and seed user credentials committed in plaintext
file: e2e/fixtures/seed-data.ts:110
status: open
---

## Description

The E2E test fixture file exports a shared test password as a module constant:

```typescript
// e2e/fixtures/seed-data.ts:110
export const TEST_PASSWORD = "E2eTestPass!2026";
```

All 5 test users (admin, manager, contributor, viewer, atelierAdmin) use this single hardcoded password. The users' email addresses are also exposed (`admin@novatech.test`, `manager@novatech.test`, etc.).

While these are test-only credentials against `*.test` domains and the E2E test DB is isolated, there are risks:

1. **Password pattern reuse**: Developers may inadvertently use similar patterns for real environments.
2. **Publicly visible test DB seed**: If CI runs against a shared staging environment (not fully isolated), these credentials could become real attack vectors.
3. **No rotation mechanism**: The password is a literal — changing it requires a code commit.

Additionally, `e2e/global-setup.ts` creates these users by calling the actual sign-up API, which means the password flows through HTTP (and potentially HTTP logs if a 4xx occurs).

## Impact

Low (test environment only). Risk escalates if the staging environment shares infrastructure with production.

## Recommendation

- Move test credentials to environment variables or a CI secret (e.g., `E2E_TEST_PASSWORD`):
  ```typescript
  export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass!2026";
  ```
- Ensure E2E tests run against a fully isolated database with no shared state with production.
- Document that `e2e/.auth/` (Playwright auth state files containing session tokens) is gitignored — this is currently correct.

## References

- `e2e/fixtures/seed-data.ts:110`
- `e2e/.auth/` — correctly gitignored at `.gitignore:4`
- CWE-312
