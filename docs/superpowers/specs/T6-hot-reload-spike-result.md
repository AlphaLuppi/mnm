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

| Scenario | Outcome | Notes |
|---|---|---|
| Fresh write, dispatch immediately | TBD | |
| After /reload-plugins | TBD | |
| After full restart | TBD | |

## Conclusion

TBD — either:
- **Hot-reload works** : document that user-level agents are picked up immediately, no friction. Update plugin README to remove the "run /reload-plugins once" note.
- **Hot-reload requires /reload-plugins** : keep the guidance in README, harness instructs user to run it after Write.
- **Requires restart** : adopt fallback "dispatch inline" pattern (Task with subagent_type: "general-purpose" + prompt that assumes the persona). Document in spec §6 "Fallback dispatch mode".
