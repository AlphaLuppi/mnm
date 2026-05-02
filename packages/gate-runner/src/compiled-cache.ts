/**
 * Re-export the compiled JS cache from `@mnm/isolate-runtime`.
 *
 * This module historically lived in gate-runner. It was extracted to a
 * standalone package (T2.1, 2026-05-02) so workflow-hooks can share the
 * same FIFO cache for compiled hook bodies without re-implementing it.
 *
 * The shape is unchanged: `CompiledCache` + `CompiledCacheOptions` keep
 * their existing API. Callers pin entries by `(gitSha, sourcePath)` —
 * the second key was renamed internally from `gateSourcePath` to the
 * generic `sourcePath` since hooks reuse it.
 */
export { CompiledCache, type CompiledCacheOptions } from "@mnm/isolate-runtime";
