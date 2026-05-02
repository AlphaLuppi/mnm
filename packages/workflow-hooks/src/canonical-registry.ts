import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Filesystem-backed registry of canonical hooks shipped with the
 * `@mnm/workflow-hooks` package. Mirrors the gate-runner pattern: each
 * canonical hook lives at `canonical/<name>.hook.ts` next to this
 * package's `src/`. The runner loads the source as raw text + computes a
 * stable sha so the `CompiledCache` can memoise across calls.
 *
 * Why filesystem and not a TS import? Hooks must be passed to esbuild
 * as a raw source string so the isolate's CJS bundle can resolve `require
 * (\"@mnm/workflow-hooks\")` to the identity-helper shim. Importing them
 * as TS modules in this package would force tsc to compile them and
 * produce JS that imports the actual package — which the isolate cannot
 * resolve. Reading the .hook.ts file lets us preserve the author's
 * intent exactly.
 *
 * Build / publish concern: when `dist/` is published the package needs
 * the `canonical/` directory at runtime. The package.json `files` field
 * MUST include `canonical/**`, otherwise canonical refs fail at runtime
 * with `unknown canonical hook`. (Currently `files: ["dist"]` — added
 * `canonical` in T2.4 so canonical hooks ship.)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Project layout: this file lives at `packages/workflow-hooks/src/`.
 * Canonical hooks live at `packages/workflow-hooks/canonical/`.
 *
 * In dev (no build): __dirname === ".../src"             → CANONICAL_DIR is "../canonical"
 * In published dist: __dirname === ".../dist"            → CANONICAL_DIR is "../canonical"
 *                    (because dist/ ships canonical/ next to it via "files")
 */
const CANONICAL_DIR = join(__dirname, "..", "canonical");

const KNOWN_HOOKS = new Set([
  "jira-comment-on-complete",
  "jira-create-issue-on-complete",
  "clickup-import-task",
  "clickup-create-task-on-complete",
]);

/**
 * In-process cache. Hooks read via `readFileSync` once per process
 * lifetime — they are immutable shipped artifacts.
 */
const cache = new Map<string, { code: string; sha: string }>();

/**
 * Load a canonical hook by name. Returns null if the name is unknown
 * (resolver translates this to a clear error). Throws on filesystem
 * errors (e.g. canonical dir missing in a misbuilt artifact) since this
 * is a deployment problem, not a user error.
 */
export function loadCanonical(
  name: string,
): { code: string; sha: string } | null {
  if (!KNOWN_HOOKS.has(name)) return null;
  const cached = cache.get(name);
  if (cached) return cached;

  const path = join(CANONICAL_DIR, `${name}.hook.ts`);
  const code = readFileSync(path, "utf8");
  const sha = createHash("sha256").update(code).digest("hex").slice(0, 40);
  const entry = { code, sha };
  cache.set(name, entry);
  return entry;
}

/**
 * Snapshot of all registered canonical hooks. Used by the catalog
 * endpoint (T2.8) to list shipped hooks. Order is alphabetical for
 * stable test fixtures.
 */
export function listCanonicalHooks(): Array<{
  name: string;
  sha: string;
}> {
  return Array.from(KNOWN_HOOKS)
    .sort()
    .map((name) => {
      const entry = loadCanonical(name)!;
      return { name, sha: entry.sha };
    });
}
