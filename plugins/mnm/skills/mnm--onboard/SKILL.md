---
name: mnm--onboard
description: Guide the user through first-run bootstrap of the MnM Governed Workflows plugin — calls setup_workspace, writes agent files, prompts /reload-plugins, and runs a verification push_local_state. Use when the user installs the plugin, runs /mnm--onboard explicitly, or asks how to "get started with MnM".
---

# MnM Onboarding

You are guiding a user through first-run setup of the MnM Governed Workflows plugin. Execute these steps in order — do not skip or reorder.

## Step 1: Confirm authentication

Before any MCP call, verify the user is authenticated. Attempt:

```
mcp__mnm__authenticate
```

If it returns `already_authenticated`, continue. If it returns an auth URL, wait for the user to complete the OAuth flow, then call `mcp__mnm__complete_authentication` with the returned code.

If the user has multiple company memberships, the OAuth flow will return `invalid_request` with `available_companies[]`. Ask the user which `company_id` to use and re-attempt authentication with that value.

## Step 2: Call setup_workspace

```
mnm.setup_workspace
```

The response shape:

```json
{
  "agents": [
    { "name": "mnm--<id>", "content": "...", "sha": "...", "target_path": "~/.claude/agents/mnm--<id>.md" }
  ],
  "session_tools": [...]
}
```

## Step 3: Write every agent file

For each entry in `agents[]`, use the `Write` tool with `file_path = target_path` and `content = content`. Expand `~` to the user's home directory resolved from the Claude Code harness environment (on Windows: `$HOME` maps to `C:\Users\<username>`).

Do not batch the writes in a single tool call — call `Write` once per agent. Report progress as you go.

## Step 4: Prompt /reload-plugins — MANDATORY

After all writes succeed, emit exactly this message to the user:

> **Action required** — I've written N agent files to `~/.claude/agents/`. Claude Code does not hot-reload these mid-session. Please run `/reload-plugins` now and then send me any short message (even "ok") so I can continue.

STOP. Do not proceed to Step 5 until the user confirms.

## Step 5: Persist plugin version cache

After the user confirms, call:

```
mnm.push_local_state  with  { plugin_version: "<version from plugin.json>" }
```

The response is `{ target_relative_path: "last-session.json", content: { lastPluginVersion: "<version>" } }`.
Write `content` to `${CLAUDE_PLUGIN_DATA}/last-session.json` so the SessionStart hook can detect plugin upgrades on the next session and prompt re-sync.

## Step 6: Offer next steps

Tell the user onboarding is complete and list two options:

1. "Launch the hello-world workflow" — call `mnm.list_governed_workflows`, pick the `hello-world` entry, then `mnm.launch_governed_workflow`, then walk through each step with `mnm.launch_governed_step`.
2. "Install a custom workflow" — direct them to `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`.

## Error handling

- `AGENTS_STALE` from launch_governed_step after onboarding means the user skipped Step 4. Ask them to run `/reload-plugins` and retry.
- `MISSING_TOOLS` means the plugin is misconfigured — surface `error.data.required[]` verbatim and stop.
- Any other error: surface `error.code` and `error.hints[]` verbatim; do not attempt to recover silently.
