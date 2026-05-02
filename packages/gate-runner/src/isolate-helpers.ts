/**
 * Re-export the host-helper bridge from `@mnm/isolate-runtime`.
 *
 * This module historically lived in gate-runner. It was extracted to a
 * standalone package (T2.1, 2026-05-02) so workflow-hooks can share the
 * same bridge without depending on the gate sandbox specifics.
 *
 * The signature is unchanged: `installHelpers(context, jail, helpers)` is
 * still the canonical 3-arg form for gate authors. An optional 4th
 * `options` argument was added in isolate-runtime to expose
 * `helperTimeoutMs` (default 3000) — gate-runner's existing call sites
 * stay on the default.
 */
export { installHelpers, type InstallHelpersOptions } from "@mnm/isolate-runtime";
