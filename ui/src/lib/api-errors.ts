/**
 * Helpers to turn raw API errors (Zod validation messages, generic Error) into
 * human-readable French strings for display in the UI.
 *
 * Server-side validation comes from Zod via `safeParse`, which produces messages
 * like:
 *
 *   "Invalid hook config payload: hookRef: hookRef must match canonical|shared|local:[a-z0-9-]+"
 *
 * That's accurate but not friendly. `formatApiError` rewrites known patterns to
 * actionable, user-friendly messages and falls back to the raw message when no
 * known rule matches.
 *
 * Pure (no React, no DOM) so it can be tested with Vitest unit tests.
 */

import { ApiError } from "../api/client";

/** Known rewrite rules. Order matters: first match wins. */
interface Rule {
  /** Regex tested against the error message. */
  pattern: RegExp;
  /** Replacement message (or function for capture-group rewrites). */
  replace: string | ((m: RegExpMatchArray) => string);
}

const RULES: Rule[] = [
  {
    pattern: /hookRef.*must match.*canonical\|shared\|local/i,
    replace:
      "Le ref du hook doit être 'canonical:<nom>', 'shared:<nom>' ou 'local:<nom>' (ex: canonical:jira-comment-on-complete).",
  },
  {
    pattern: /name.*(too short|min|required)/i,
    replace: "Le nom est obligatoire.",
  },
  {
    pattern: /defaultConfigJson.*(object|invalid)/i,
    replace:
      "La default config doit être un objet JSON valide (ex: { \"issueKey\": \"PROJ-123\" }).",
  },
  {
    pattern: /enforcedPhases.*invalid/i,
    replace:
      "Les phases enforced doivent être parmi : before_run, before_step, after_step, after_run.",
  },
  {
    pattern: /visibility.*invalid/i,
    replace:
      "La visibilité doit être 'private', 'tags', 'principals' ou 'company-enforced'.",
  },
];

/**
 * Format any API error (ApiError, generic Error, unknown) into a French
 * user-friendly message. Idempotent: if the message is already friendly,
 * returns it as-is.
 */
export function formatApiError(err: unknown): string {
  const raw = extractRawMessage(err);
  for (const rule of RULES) {
    const match = raw.match(rule.pattern);
    if (match) {
      return typeof rule.replace === "string"
        ? rule.replace
        : rule.replace(match);
    }
  }
  return raw;
}

/**
 * Extract the most useful message from an unknown error value.
 * Exported for testing.
 */
export function extractRawMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // ApiError already pulls `error` from the JSON body when available.
    return err.message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Une erreur inattendue s'est produite.";
}
