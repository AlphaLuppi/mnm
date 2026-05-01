# MnM Plugin for Claude Code

Supervise AI agent orchestration via Governed Workflows. This plugin wires
Claude Code to your MnM deployment and bootstraps the environment your
workflows need.

## What this plugin ships

- The `mnm` MCP server connection (HTTP, OAuth 2.1).
- A `SessionStart` hook that shows a lightweight dashboard (pending
  workflows, open issues, plugin version).

That is ALL. No bundled agents, skills, or commands — MnM materializes
those dynamically at user scope (`~/.claude/agents/mnm--*.md`) on first
use, driven by MCP tool responses.

## Install

```shell
/plugin install mnm@mnm-platform
```

Claude Code will prompt you for:

- **Company ID** — your MnM company UUID (from your admin).
- **MnM server URL** — e.g. `https://mnm.acme.com`.

## First-run bootstrap

1. Install the plugin (`/plugin install mnm@mnm-platform` — see Marketplace section below).
2. Configure `company_id` and `server_url` in the plugin config dialog.
3. Authenticate (the `mcp__mnm__authenticate` tool will prompt you through the OAuth flow).
4. Run the **first** `launch_governed_step` for any workflow. The server returns an `AGENTS_STALE` error carrying the canonical agent content.
5. Follow the harness prompt: `Write` each returned file to `~/.claude/agents/`, then **run `/reload-plugins`** in the Claude Code session. This step is required — Claude Code does not hot-reload user-level agents mid-session.
6. Re-call `launch_governed_step`. The dispatch now succeeds.

> **Why `/reload-plugins`?** Claude Code freezes the list of available subagents at session start. Writing a new file to `~/.claude/agents/` does not invalidate that list; the only way to pick up new agents without restarting is `/reload-plugins`. This is a one-time action per agent set change.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Task(subagent_type: "mnm--X")` returns `agent not found` | Run `/reload-plugins`. If still failing, fully restart Claude Code. |
| `launch_governed_step` keeps returning `AGENTS_STALE` after a `Write` | You skipped `/reload-plugins`. Run it, then retry. |
| `MISSING_TOOLS` error | Install the plugin/MCP listed in `error.data.required[]`, then `/reload-plugins`. |
| Authentication loop in browser | Check that `server_url` in plugin config points at an HTTPS endpoint serving `/.well-known/oauth-authorization-server`. |
| `invalid_request` with `available_companies[]` during OAuth | Your board user belongs to multiple companies; retry the install with `company_id` set in plugin config. |

## Usage

Once bootstrapped, run workflows by asking Claude naturally:

> "Run the hello-world workflow."

The MnM MCP server orchestrates the steps, dispatches to the right agent,
and validates entry/exit gates server-side.

## Updating agents

Agents auto-update on every step launch: `launchStep` compares your local
agent shas against the canonical git-pinned versions and returns new
content if stale. Claude writes the update, then retries the step.

## Session-bundle runs (timeline reconstruction)

When a workflow step declares the canonical gate
`gates/session-file-bundled.gate.ts` in its `gates.exit` block, MnM materialises
that step as a real **heartbeat run with a full timeline**, reconstructed from
your Claude Code session JSONL.

How it works:

1. **At `launch_governed_step`** the server creates a client-mode `heartbeat_run`
   linked to the step. The response includes a `session_capture` object :
   ```json
   {
     "method": "claude-code-jsonl-v1",
     "path_template": "${HOME}/.claude/projects/${CWD_DASHED}/${SESSION_ID}.jsonl",
     "session_id_source": "any line of the active jsonl, field 'sessionId' (UUID v4)",
     "encoding": "gzip+base64 if size > 5MB else raw string",
     "where_to_put": "artifact.data.session_file",
     "max_size_mb": 100,
     "gzip_threshold_mb": 5,
     "instructions": "..."
   }
   ```
2. **You do the step work normally.** Your `.jsonl` fills up at the resolved
   path (`~/.claude/projects/<cwd-dashed>/<session-uuid>.jsonl`).
   `<cwd-dashed>` = current working dir with `/` → `-` and prefixed `-`.
   `<session-uuid>` = the `sessionId` field on any line of the active JSONL
   (NOT the `CLAUDE_CODE_SESSION_ID` env var, which points to the remote
   session and starts with `cse_`).
3. **At `complete_governed_step`** read the file (`Read` tool) and pass its
   content in `artifact.data.session_file`. If the raw size is over
   `gzip_threshold_mb`, gzip + base64 it and use the wrapped form
   `{ encoding: "gzip-base64", content: "<base64>" }`.
4. The server validates the bundle via the gate, parses the JSONL, materialises
   `traces` + `trace_observations` (one per assistant turn / tool call / user
   message), rolls up tokens, and finalises the heartbeat run.
5. The MnM UI shows a **"Session captured"** badge on the step card, cliquable
   → timeline reconstruite avec coût et tokens.

**Heads-up :** the entire session content is stored server-side. **Don't include
secrets in clear text** in your prompts — a future CAO watcher will alert
admin/users on detected secrets, but for now treat it as you would any log
sent upstream.

Customising the path template (server-side, env vars):

```
MNM_SESSION_CAPTURE_METHOD          # default: claude-code-jsonl-v1
MNM_SESSION_CAPTURE_PATH_TEMPLATE   # default: ${HOME}/.claude/projects/${CWD_DASHED}/${SESSION_ID}.jsonl
MNM_SESSION_CAPTURE_MAX_SIZE_MB     # default: 100
MNM_SESSION_CAPTURE_GZIP_THRESHOLD_MB  # default: 5
```

## Data locations

- **User agents** : `~/.claude/agents/mnm--*.md`
- **Plugin cache** (session state, last-sync marker) : `~/.claude/plugins/data/mnm-<marketplace>/last-session.json`

## Marketplace

This plugin is published at the external marketplace repo
[`mnm-platform/claude-plugins`](https://github.com/mnm-platform/claude-plugins).
The manifest format and publication workflow are described in
[`docs/superpowers/specs/T7-marketplace-manifest.md`](../../docs/superpowers/specs/T7-marketplace-manifest.md)
in the upstream repo.

Install via:

```
/plugin marketplace add https://github.com/mnm-platform/claude-plugins
/plugin install mnm@mnm-platform
```
