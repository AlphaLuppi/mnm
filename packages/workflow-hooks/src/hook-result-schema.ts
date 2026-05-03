import { z } from "zod";

/**
 * Server-side validation of `HookResult` returned from inside the isolate.
 * Mirrors `gateOutputSchema` in `@mnm/governed-workflows`.
 *
 * `.strict()` is intentional: a hook author who returns an unrecognised
 * top-level key sees the call surface as `HOOK_INVALID_OUTPUT` rather than
 * being silently dropped.
 *
 * `inject.context_md` size is NOT enforced here — the runner checks it
 * after schema validation against `HookRunnerOptions.maxInjectBytes` so
 * the error surfaces as `HOOK_INJECT_TOO_LARGE` rather than a generic
 * schema failure.
 */
export const hookResultSchema = z
  .object({
    ok: z.boolean(),
    error_code: z.string().min(1).optional(),
    report: z.string().min(1).optional(),
    hints: z.array(z.string().min(1)).optional(),
    data: z.record(z.unknown()).optional(),
    inject: z
      .object({
        context_md: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type HookResultParsed = z.infer<typeof hookResultSchema>;
