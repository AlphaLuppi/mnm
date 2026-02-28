# MnM POC - Claude Code Session Monitor

Real-time web dashboard that monitors all Claude Code sessions running on your machine by watching `~/.claude/` file changes.

## Quick Start

```bash
cd poc
npm install
npm run dev
```

Open **http://localhost:3005** in your browser.

## What It Does

The dashboard observes Claude Code's internal files (JSONL session logs, tasks, todos) via filesystem watching and displays:

1. **All sessions** — Lists every session across all projects, with active/inactive filtering
2. **Sub-agents** — Shows spawned sub-agents per session with file size and activity status
3. **Context ingested** — Files read, URLs fetched, searches performed (deduplicated with counts)
4. **Status detection** — Whether a session is working, processing, waiting for input, or idle
5. **Context window %** — Token usage as a percentage of Claude's 200K context window
6. **Current activity** — Last assistant output, active tools being used, task list progress
7. **Agent chat** — Click any sub-agent to view its full conversation history

## Architecture

```
Single Node.js process (no build step)
├── Express server (port 3005)
│   ├── Static files ── public/index.html + style.css + app.js
│   ├── REST API ────── /api/sessions, /api/sessions/:id, etc.
│   └── SSE endpoint ── /api/events (real-time push)
│
├── Chokidar watcher
│   └── Watches ~/.claude/ recursively (usePolling for Windows)
│
└── In-memory SessionStore (Map<sessionId, state>)
```

### Data Sources

| Data | Location | Format |
|------|----------|--------|
| Session logs | `~/.claude/projects/{project}/{sessionId}.jsonl` | JSONL (one JSON per line) |
| Session index | `~/.claude/projects/{project}/sessions-index.json` | JSON |
| Sub-agents | `~/.claude/projects/{project}/{sessionId}/subagents/agent-*.jsonl` | JSONL |
| Tasks | `~/.claude/tasks/{sessionId}/{taskId}.json` | JSON |
| Todos | `~/.claude/todos/{sessionId}-agent-{agentId}.json` | JSON array |

### Real-Time Updates

The server uses **Server-Sent Events (SSE)** to push updates to the browser. When chokidar detects a file change (polled every 500ms), the server:

1. Reads only the new lines from the JSONL file (incremental parsing)
2. Updates the in-memory session state
3. Broadcasts the change to all connected browsers via SSE

### Status Detection Logic

- **working** — Last message is from assistant with `stop_reason: "tool_use"` (executing a tool)
- **processing** — Last message is from user (assistant is generating a response)
- **waiting** — Last message is from assistant with `stop_reason: "end_turn"` (needs user input)
- **idle** — No recent activity

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `node server.js` | Start the web dashboard on port 3005 |
| `npm run watch` | `node watch-session.js` | CLI-only watcher (terminal output, no web UI) |

## Key Findings (POC Validation)

- **chokidar** works on Windows with `usePolling: true` — required for detecting JSONL appends
- **sessions-index.json** is not always up-to-date — the server also scans for .jsonl files directly
- **Token usage** is available per assistant message in `message.usage` fields
- **Sub-agent JSONL** files follow the same format as main session files
- Multi-session monitoring works — tested with 2+ concurrent Claude Code sessions

## Dependencies

- `express` — HTTP server + static files + REST API
- `chokidar` — Cross-platform filesystem watcher
- `chalk` — Terminal colors (used by the CLI watcher only)
