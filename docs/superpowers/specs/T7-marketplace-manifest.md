# T7 — Marketplace manifest spec

## Goal

Publish the MnM Governed Workflows plugin so Claude Code users can install it via:

```
/plugin marketplace add https://github.com/mnm-platform/claude-plugins
/plugin install mnm@mnm-platform
```

## Repo structure

Create `github.com/mnm-platform/claude-plugins` with:

```
claude-plugins/
├── marketplace.json
├── README.md
└── mnm/
    └── (contents mirrored from this repo's plugins/mnm/)
```

## marketplace.json

```json
{
  "schemaVersion": 1,
  "id": "mnm-platform",
  "name": "MnM Platform",
  "description": "Plugins published by the MnM Governed Workflows team.",
  "plugins": [
    {
      "id": "mnm",
      "name": "MnM Governed Workflows",
      "description": "Supervise AI agent orchestration for your company.",
      "path": "mnm",
      "homepage": "https://github.com/AlphaLuppi/mnm",
      "license": "MIT"
    }
  ]
}
```

## Publication workflow

1. From this repo, copy `plugins/mnm/` into the marketplace repo's `mnm/` folder (preserve the `.claude-plugin/`, `.mcp.json`, `hooks/`, `bin/`, `skills/`, `README.md` subtree).
2. Commit to the marketplace repo: `chore: publish mnm@0.1.0`.
3. Tag and push: `git tag mnm-v0.1.0 && git push --tags`.

## Sync strategy

For now, the marketplace repo is a **manual** mirror — cut a new commit each time `plugins/mnm/` changes on master. Automate via a GitHub Action in T8 if/when release cadence demands it.

## Verification

After publishing:

1. In a fresh Claude Code session, run `/plugin marketplace add https://github.com/mnm-platform/claude-plugins`.
2. Run `/plugin install mnm@mnm-platform`.
3. Restart Claude Code. Confirm the SessionStart hook fires (`bin/mnm-session-start`) and the `mcp__mnm__*` tools appear.
4. Run the `mnm--onboard` skill (Task 5) to complete first-run.
