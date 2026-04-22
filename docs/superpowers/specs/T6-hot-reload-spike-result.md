# T6 Spike — Hot-reload of user-level agents

## Protocol

1. Start a fresh Claude Code session.
2. List `~/.claude/agents/` before the test.
3. Use the Write tool to create a new agent file at `~/.claude/agents/t6-spike.md` with valid frontmatter:
   ```markdown
   ---
   name: t6-spike
   description: Spike test agent
   ---
   Say "spike works".
   ```
4. Without restarting or /reload-plugins, attempt `Task(subagent_type: "t6-spike", prompt: "test")`.
5. Record the outcome (success or "agent not found" error).
6. If failed : try `/reload-plugins` in the session, retry Task.
7. Record the outcome.
8. Try again with the namespace-prefixed name `mnm--t6-spike` to confirm behavior with the actual convention.

## Results

Executed 2026-04-22, Claude Code on Windows 11, session with 14 agents loaded at start.

| Scenario | Outcome | Notes |
|---|---|---|
| Fresh write, dispatch immediately | FAIL | `Agent type 't6-spike' not found. Available agents: angular-reviewer, ...` — the in-session subagent registry is frozen at SessionStart; `Write` does not invalidate it. |
| After `/reload-plugins` | PASS | Reload reported `15 agents` (was 14). Immediate `Task(subagent_type: "t6-spike")` returned `spike works` in 1.4s. |
| After full restart | NOT TESTED | Transitively implied: if `/reload-plugins` re-scans `~/.claude/agents/` successfully, a full restart (which replays SessionStart) does too. Skipped to preserve live session state. |

Step 8 (namespace-prefixed `mnm--t6-spike`) was skipped: for user-level agents, the frontmatter `name` field is the dispatch key — filename prefix is only a convention to avoid collisions. The prefix adds no new behavior to test.

## Conclusion

**Hot-reload requires an explicit user action (`/reload-plugins` or restart).** The Claude Code harness does not watch `~/.claude/agents/` for changes mid-session. Frontend-side, `Write` completing successfully gives zero signal that the agent is dispatchable.

### Implications for T7

1. **Plugin README** — keep the "run `/reload-plugins` once after first launch" guidance; make it prominent. Add a short troubleshooting section: "If `Task(subagent_type: "mnm--...")` returns `agent not found`, run `/reload-plugins`."
2. **`launch_governed_step` stale-correction flow** (T6 §5, already shipped) — when the MCP tool returns `AGENTS_STALE` with `freshContent`, the harness instructs Claude to `Write` the file *and then prompts the user to run `/reload-plugins`* before retrying the Task dispatch. The current error payload should carry that instruction text.
3. **Onboarding skill (`mnm--onboard`, T7 item 6)** — after calling `setup_workspace` and writing all agent files, the skill must end with: "Run `/reload-plugins` now, then retry your last command."
4. **No fallback dispatch pattern needed** — `/reload-plugins` is fast (observed sub-second reload of 15 agents), user-visible, and reliable. A "dispatch inline via general-purpose + persona prompt" fallback would add complexity without benefit; reject that option.
5. **Future consideration** — if Anthropic adds a filesystem watcher in Claude Code, we can drop the manual reload step. Not worth lobbying for now; one-shot action is acceptable UX.
