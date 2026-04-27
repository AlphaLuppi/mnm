/**
 * Persistent cache the SessionStart hook reads from and the harness writes
 * to via the `push_local_state` MCP tool. Lives at
 * `${CLAUDE_PLUGIN_DATA}/last-session.json`.
 *
 * Scope is intentionally narrow: only fields the hook can use truthfully
 * without a network round-trip (which it can't make — it runs hors auth MCP).
 * Live DB state (active runs, open issues) is discovered on demand via
 * MCP tools like `list_governed_workflow_runs` — not cached here, because
 * a stale cache silently lies about workflow status.
 */
export interface LastSession {
  /** Version string from plugin.json at last tool call. Used for update detection. */
  lastPluginVersion: string;
}

/**
 * Shape the SessionStart hook emits on stdout. Claude Code parses this JSON
 * and injects `additionalContext` into the session context. See
 * https://code.claude.com/docs/en/hooks for the full spec.
 */
export interface SessionStartHookOutput {
  hookSpecificOutput: {
    hookEventName: "SessionStart";
    additionalContext: string;
  };
}
