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

## First run

After restarting Claude Code (or `/reload-plugins`), the SessionStart hook
runs and tells you:

> MnM plugin v0.1.0. First run detected. To provision your workspace, ask:
> "Set me up for MnM".

Type that prompt. Claude will trigger the `setup_workspace` MCP tool which
returns the list of agents to materialize under `~/.claude/agents/`.
Claude writes them via its Write tool. OAuth 2.1 login runs the first time
(browser flow).

After provisioning, you may need to run `/reload-plugins` once so Claude
Code picks up the new agents.

## Usage

Once bootstrapped, run workflows by asking Claude naturally:

> "Run the hello-world workflow."

The MnM MCP server orchestrates the steps, dispatches to the right agent,
and validates entry/exit gates server-side.

## Updating agents

Agents auto-update on every step launch: `launchStep` compares your local
agent shas against the canonical git-pinned versions and returns new
content if stale. Claude writes the update, then retries the step.

## Data locations

- **User agents** : `~/.claude/agents/mnm--*.md`
- **Plugin cache** (session state, last-sync marker) : `~/.claude/plugins/data/mnm-<marketplace>/last-session.json`

## Troubleshooting

- **Hook does nothing on SessionStart** : ensure the plugin binary is
  executable. Reinstall the plugin if corrupted.
- **OAuth loop** : clear the credential with `claude mcp logout mnm`.
- **Agent not found after `Write`** : run `/reload-plugins` once.
