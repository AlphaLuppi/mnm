import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { transformSync } from "esbuild";
import type { HookMetadata } from "./types.js";

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
 * with `unknown canonical hook`. (Currently `files: ["dist", "canonical"]`.)
 *
 * Metadata extraction (P4-G): in addition to caching the source +
 * sha, the registry now also extracts the `HookMetadata` payload that
 * authors attach via the `defineHook({ ...metadata, execute })` form.
 * Extraction runs once per process per hook, host-side, by:
 *
 *   1. esbuild-transforming the .hook.ts source to CJS (synchronous).
 *   2. Evaluating the result inside a fresh `node:vm` context with a
 *      minimal `defineHook` shim that captures the metadata argument.
 *   3. Reading the shim's captured object.
 *
 * The vm context is intentionally trusted (these are first-party hooks
 * we ship in the package — not user input). The catalog endpoint surfaces
 * the captured metadata to UI clients so they can render typed inputs /
 * inline help. Hooks authored via the legacy `defineHook(fn)` form
 * surface as an empty metadata object — the catalog falls back to a
 * bare entry, never crashes.
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

interface CachedEntry {
  code: string;
  sha: string;
  metadata: HookMetadata;
}

/**
 * In-process cache. Hooks read via `readFileSync` once per process
 * lifetime — they are immutable shipped artifacts. Metadata extraction
 * is amortised on first access alongside the source read.
 */
const cache = new Map<string, CachedEntry>();

/**
 * Extract `HookMetadata` from a `.hook.ts` source string by transpiling
 * to CJS and evaluating in a sandboxed vm context with a `defineHook`
 * shim that records the argument.
 *
 * Failure modes (never throw to the caller — the registry MUST always
 * return a usable entry, even for hooks authored without metadata):
 *  - Legacy form (`defineHook(fn)`) → captured arg is a function →
 *    returns `{}` (no metadata).
 *  - Compile / vm error → logs to stderr (dev visibility), returns `{}`.
 *  - Captured value is non-object → returns `{}`.
 */
function extractMetadata(source: string, hookName: string): HookMetadata {
  let captured: unknown;
  try {
    const { code: jsCode } = transformSync(source, {
      loader: "ts",
      format: "cjs",
      target: "es2022",
      sourcefile: `canonical/${hookName}.hook.ts`,
      legalComments: "none",
    });

    const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
    const sandbox: Record<string, unknown> = {
      module: moduleObj,
      exports: moduleObj.exports,
      require(id: string) {
        if (id === "@mnm/workflow-hooks" || id === "@mnm/governed-workflows") {
          return {
            defineHook(arg: unknown) {
              captured = arg;
              // Return a function so callers that immediately invoke it
              // (none of our canonical hooks do, but be defensive) won't
              // crash with TypeError. The runtime body is irrelevant —
              // we only care about capturing the metadata argument.
              return typeof arg === "function" ? arg : () => undefined;
            },
          };
        }
        throw new Error(`require() not available in metadata sandbox: ${id}`);
      },
      console,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsCode, ctx, {
      filename: `canonical/${hookName}.hook.ts`,
      timeout: 1_000,
    });
  } catch (cause) {
    // Surface the failure in dev so a malformed hook is noticed, but
    // never block the catalog. Production logs ride on console; the
    // runner side has its own classification when the hook actually runs.
    // eslint-disable-next-line no-console
    console.warn(
      `[canonical-registry] metadata extraction failed for ${hookName}:`,
      cause instanceof Error ? cause.message : String(cause),
    );
    return {};
  }

  if (
    !captured ||
    typeof captured !== "object" ||
    typeof (captured as { execute?: unknown }).execute !== "function"
  ) {
    // Legacy form (function) or anything we don't recognise → no metadata.
    return {};
  }

  const def = captured as Record<string, unknown>;
  const meta: HookMetadata = {};
  if (typeof def.description === "string") meta.description = def.description;
  if (
    def.phase === "before_run" ||
    def.phase === "before_step" ||
    def.phase === "after_step" ||
    def.phase === "after_run"
  ) {
    meta.phase = def.phase;
  }
  if (
    Array.isArray(def.requiredScopes) &&
    def.requiredScopes.every((s) => typeof s === "string")
  ) {
    meta.requiredScopes = def.requiredScopes as string[];
  }
  if (def.configSchema && typeof def.configSchema === "object") {
    meta.configSchema = def.configSchema as HookMetadata["configSchema"];
  }
  if (def.defaultConfig && typeof def.defaultConfig === "object") {
    meta.defaultConfig = def.defaultConfig as Record<string, unknown>;
  }
  return meta;
}

/**
 * Load a canonical hook by name. Returns null if the name is unknown
 * (resolver translates this to a clear error). Throws on filesystem
 * errors (e.g. canonical dir missing in a misbuilt artifact) since this
 * is a deployment problem, not a user error.
 */
export function loadCanonical(
  name: string,
): { code: string; sha: string } | null {
  const entry = loadEntry(name);
  if (!entry) return null;
  return { code: entry.code, sha: entry.sha };
}

function loadEntry(name: string): CachedEntry | null {
  if (!KNOWN_HOOKS.has(name)) return null;
  const cached = cache.get(name);
  if (cached) return cached;

  const path = join(CANONICAL_DIR, `${name}.hook.ts`);
  const code = readFileSync(path, "utf8");
  const sha = createHash("sha256").update(code).digest("hex").slice(0, 40);
  const metadata = extractMetadata(code, name);
  const entry: CachedEntry = { code, sha, metadata };
  cache.set(name, entry);
  return entry;
}

/**
 * Catalog metadata for a single canonical hook. Combines the pinned
 * sha (from `loadCanonical`) with the author-provided `HookMetadata`
 * (from the new `defineHook({...})` form). Consumed by the catalog
 * endpoint so the picker UI can render description, phase, schema,
 * defaults, and required scopes without an extra round-trip.
 *
 * Returns null if the hook name is unknown — same contract as
 * `loadCanonical` so callers can mirror their guard.
 */
export interface CanonicalMetadata extends HookMetadata {
  name: string;
  sha: string;
}

export function getCanonicalMetadata(name: string): CanonicalMetadata | null {
  const entry = loadEntry(name);
  if (!entry) return null;
  return { name, sha: entry.sha, ...entry.metadata };
}

/**
 * Snapshot of all registered canonical hooks. Used by the catalog
 * endpoint (T2.8) to list shipped hooks. Order is alphabetical for
 * stable test fixtures.
 *
 * Each entry now embeds the captured `HookMetadata` so a single call
 * gives the picker UI everything it needs (description, phase,
 * configSchema, defaultConfig, requiredScopes). Hooks authored without
 * metadata surface as `{name, sha}` only — never crash.
 */
export function listCanonicalHooks(): Array<CanonicalMetadata> {
  return Array.from(KNOWN_HOOKS)
    .sort()
    .map((name) => {
      const entry = loadEntry(name)!;
      return { name, sha: entry.sha, ...entry.metadata };
    });
}
