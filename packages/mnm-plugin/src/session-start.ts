import { promises as fs } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LastSession, SessionStartHookOutput } from "./types.js";

/**
 * Pure function form of the hook. Takes CLAUDE_PLUGIN_ROOT and
 * CLAUDE_PLUGIN_DATA (as if they were env vars) and returns the hook
 * output object. Accepts the paths as injectable args so tests can exercise
 * temp dirs without mutating process.env.
 *
 * Fail-open philosophy: if ANYTHING unexpected happens (missing manifest,
 * corrupted cache, etc.) the hook returns a safe empty or first-run message.
 * Claude Code should never fail to start a session because of the MnM hook.
 */
export async function runSessionStart(params: {
  root: string;
  data: string;
}): Promise<SessionStartHookOutput> {
  let currentVersion: string;
  try {
    const manifestPath = join(params.root, ".claude-plugin", "plugin.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    currentVersion = typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    // Manifest unreadable — should never happen in a correctly-installed
    // plugin, but never block the session. Return empty context.
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "",
      },
    };
  }

  let state: LastSession | null = null;
  try {
    const statePath = join(params.data, "last-session.json");
    state = JSON.parse(await fs.readFile(statePath, "utf8")) as LastSession;
  } catch {
    // ENOENT (first run) or malformed JSON — both fall back to first-run
    // guidance. No logging because stdout is reserved for the JSON output
    // and stderr would surface a spurious transcript warning.
  }

  if (state === null) {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `MnM plugin v${currentVersion}. First run detected. ` +
          `To provision your workspace, ask: "Set me up for MnM".`,
      },
    };
  }

  // Steady state: stay silent. The hook has no network access, so any
  // cached counter (active runs, open issues) is stale by definition —
  // surfacing one would mislead the model. Active state is discoverable
  // on demand via list_governed_workflow_runs.
  if (state.lastPluginVersion === currentVersion) {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "",
      },
    };
  }

  // Plugin upgraded: agents materialized in ~/.claude/agents/mnm--*.md may
  // be out of sync with the new server-side definitions. Prompt re-sync.
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        `MnM plugin v${currentVersion}. ` +
        `Plugin updated from v${state.lastPluginVersion} — run "Set me up for MnM" to refresh agents.`,
    },
  };
}

// Entry point when executed as a binary (via hooks/hooks.json). Reads the
// two env vars Claude Code exports to plugin hook processes and writes the
// JSON result to stdout. Exits 0 on success — exits 0 even on unexpected
// failures because SessionStart does not support blocking (exit 2 would
// just print a warning in the transcript).
// Use pathToFileURL to produce a normalized URL (file:///C:/… on Windows,
// file:///… on POSIX) that matches import.meta.url regardless of platform.
const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  const data = process.env.CLAUDE_PLUGIN_DATA;
  if (!root || !data) {
    // Running outside a plugin context — emit empty context silently.
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: "",
        },
      }),
    );
    process.exit(0);
  }
  runSessionStart({ root, data })
    .then((out) => {
      process.stdout.write(JSON.stringify(out));
      process.exit(0);
    })
    .catch(() => {
      // Unexpected — fail open.
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: "",
          },
        }),
      );
      process.exit(0);
    });
}
