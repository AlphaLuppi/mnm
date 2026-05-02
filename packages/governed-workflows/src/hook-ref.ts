import { z } from "zod";

/**
 * One hook entry in a workflow's step.hooks.{before,after} array, or in
 * the workflow root's hooks.{before,after} array.
 *
 * Validation rules (T2.6):
 *  - `name` MUST match `^(canonical|shared|local):[a-z0-9-]+$`. The
 *    resolver in `@mnm/workflow-hooks` enforces the same regex; doing
 *    it here at the workflow.json level surfaces typos at validation
 *    time (Monaco editor + Studio AI assistant) rather than at run
 *    time.
 *  - `with` is the per-step config object passed to the hook as
 *    `ctx.config`. Open shape — each canonical / custom hook validates
 *    its own config inside the body.
 */
export const hookRefSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(
        /^(canonical|shared|local):[a-z0-9-]+$/,
        "Hook ref must match canonical|shared|local:[a-z0-9-]+ (kebab-case)",
      )
      .describe(
        'Référence du hook au format "canonical:<name>" | "shared:<name>" | "local:<name>"',
      ),
    with: z
      .record(z.unknown())
      .optional()
      .describe(
        "Config du hook (forme libre par hook ; chaque hook valide son propre config)",
      ),
  })
  .strict();

export type HookRef = z.infer<typeof hookRefSchema>;

/**
 * `before` / `after` blocks on a step or workflow root. Wrapping the
 * arrays in their own object so the schema can extend later (e.g.
 * `parallel: true` or per-block timeout overrides) without breaking
 * existing workflow.json files.
 */
export const hookBlockSchema = z
  .object({
    before: z.array(hookRefSchema).default([]),
    after: z.array(hookRefSchema).default([]),
  })
  .strict();

export type HookBlock = z.infer<typeof hookBlockSchema>;
