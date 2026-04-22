/**
 * Persistent cache the SessionStart hook reads from and the harness writes
 * to via the `push_local_state` MCP tool. Lives at
 * `${CLAUDE_PLUGIN_DATA}/last-session.json`.
 */
export interface LastSession {
  /** sha256 of the last syncEnvironment result (see governed-workflows service). */
  lastSyncedSha: string;
  /** ISO 8601 timestamp of the last successful sync. */
  syncedAt: string;
  /** Names of agents currently materialized in ~/.claude/agents/mnm--*.md. */
  agentNames: string[];
  /** Number of governed workflow runs in status=active for the user's company. */
  pendingRuns: number;
  /** Number of issues marked as open requiring user attention. */
  openIssues: number;
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
