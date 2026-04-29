# T9 — LLM & Prompt Injection Security Audit Summary

**Date**: 2026-04-29  
**Team**: T9 — LLM & Prompt Injection (whitebox, 6 specialists)  
**Scope**: All LLM call sites, MCP boundary, AI Assistant, trace enrichment, CAO, gate-runner, adapters

---

## Stats by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 3 | SEC-T9-01, SEC-T9-02, SEC-T9-03 |
| High | 5 | SEC-T9-04, SEC-T9-05, SEC-T9-06, SEC-T9-07, SEC-T9-08 |
| Medium | 4 | SEC-T9-09, SEC-T9-10, SEC-T9-11, SEC-T9-12 |
| Low | 3 | SEC-T9-13, SEC-T9-14, SEC-T9-15 |
| **Total** | **15** | |

---

## LLM Call Site Inventory

| Site | File | Model | Auth | Rate-limited? |
|------|------|-------|------|---------------|
| AI Assistant (SSE) | `server/src/routes/governed-workflows-ai.ts` | claude-sonnet-4-6 | WORKFLOWS_CREATE permission | 3 concurrent (in-memory, not persistent) |
| Gold Trace Enrichment (API) | `server/src/services/gold-trace-enrichment.ts:callLlm` | configurable Haiku | None (auto-triggered) | None |
| Gold Trace Enrichment (CLI fallback) | `server/src/services/gold-trace-enrichment.ts:callClaudeCli` | claude-haiku-via-cli | Inherited claude-code auth | None |
| Lens Analysis | `server/src/services/lens-analysis.ts:callLlm` | configurable Haiku | TRACES_READ (implicit) | None |
| Claude-local Adapter | `packages/adapters/claude-local/src/server/execute.ts` | claude-opus-4-6 (default) | Agent JWT | None |
| CAO Agent | `server/src/services/cao.ts` (runs via claude_local adapter) | claude-opus-4-6 | Admin JWT (auto-generated) | Heartbeat cooldown only |
| Codex-local Adapter | `packages/adapters/codex-local/src/server/execute.ts` | OpenAI Codex | Per-agent API key | None |

---

## MCP Tools Exposed Inventory

### Governed Workflows (governed-workflows.tool.ts)
| Tool | Permission Required | Destructive |
|------|--------------------|-----------:|
| list_governed_workflows | WORKFLOWS_READ | No |
| get_governed_workflow | WORKFLOWS_READ | No |
| list_governed_workflow_runs | WORKFLOWS_READ | No |
| get_governed_workflow_run | WORKFLOWS_READ | No |
| launch_governed_workflow | WORKFLOWS_ENFORCE | No |
| launch_governed_step | WORKFLOWS_ENFORCE | No |
| complete_governed_step | WORKFLOWS_ENFORCE | No |
| setup_workspace | WORKFLOWS_READ | No |
| push_local_state | WORKFLOWS_READ | No |
| sync_governed_environment | WORKFLOWS_READ | No |
| create_governed_workflow | WORKFLOWS_CREATE | No |
| register_governed_workflow | WORKFLOWS_CREATE | No |
| update_governed_workflow | WORKFLOWS_CREATE | No |
| archive_governed_workflow | WORKFLOWS_CREATE | **Yes** |
| import_cc_plugin | WORKFLOWS_CREATE | No |
| resume_governed_workflow_run | WORKFLOWS_ENFORCE | No |
| cancel_governed_workflow_run | WORKFLOWS_ENFORCE | **Yes** |
| reactivate_governed_workflow_run | WORKFLOWS_ENFORCE | No |

### Sandbox (sandbox.tool.ts)
| Tool | Permission Required | Cross-user risk |
|------|--------------------|-----------------:|
| get_sandbox_status | SANDBOX_READ | Low |
| manage_sandbox | SANDBOX_MANAGE | **HIGH** (SEC-T9-12) |

### Admin (admin.tool.ts)
| Tool | Permission Required |
|------|-------------------|
| list_roles | ROLES_READ |
| manage_role | ROLES_MANAGE |
| list_tags | TAGS_READ |
| manage_tag | TAGS_MANAGE |
| get_audit_log | AUDIT_READ |
| export_audit | AUDIT_EXPORT |

### Context (context.tool.ts)
| Tool | Permission Required | Note |
|------|--------------------|----|
| get_context | PROJECTS_READ | URI pattern — mnm://projects/{id}, mnm://issues/{id} |

### Other tools: agents, artifacts, chat, config-layers, documents, folders, issues, projects, traces, users, a2a

---

## Top 5 Risks

### 1. SEC-T9-01 — CRITICAL: Shell injection via git credential helper (RCE)
**Package**: `packages/adapters/claude-local/src/server/execute.ts`  
The git credential helper is built from user-controlled repo URL hostnames injected raw into a shell `case` statement. Any user who can set workspace context can achieve arbitrary code execution on the host machine running the adapter. This is the highest-impact finding — it bypasses all LLM-level protections and goes directly to RCE.

### 2. SEC-T9-02 — CRITICAL: Indirect prompt injection via workflow.json into AI Assistant system prompt
**Package**: `server/src/services/workflow-ai-assistant.ts`  
The entire `workflow.json` (user-editable) is embedded verbatim in the AI assistant system prompt. User A creates a poisoned workflow; User B opens it and the AI assistant executes the injected instructions — including proposing malicious file changes that get committed to the company's git repository.

### 3. SEC-T9-03 — CRITICAL: AI Assistant file proposal parser has no path restriction
**Package**: `server/src/services/workflow-ai-assistant.ts`  
The `parseFileProposals` function does not validate paths proposed by the LLM. Combined with SEC-T9-02, this enables writing arbitrary files (including `.env`, `CLAUDE.md`) outside the workflow subtree via one-click "Appliquer" in the UI.

### 4. SEC-T9-07 — HIGH: CAO prompt hijack via poisoned issue title/description
**Package**: `server/src/services/cao.ts`  
The CAO (Admin permissions + bypass_tag_filter + dangerously-skip-permissions) renders user-controlled issue content into its system prompt without sanitization. A user who can create an issue can hijack the CAO and use it to create backdoor agents, exfiltrate company data, or execute shell commands on the admin's machine.

### 5. SEC-T9-05 — HIGH: dangerouslySkipPermissions defaults to true for all agents
**Package**: `packages/adapters/claude-local/src/server/execute.ts`  
Every claude-local agent runs without Claude Code's tool permission guardrails. Combined with any of the prompt injection vectors above, this means an injected agent has unrestricted shell, file, and tool access on the host machine.

---

## Recommendations by Category

### Input/Output Filtering (Immediate Priority)

1. **Prompt injection guardrails**: wrap all user-controlled content (workflow JSON, issue descriptions, trace observations, lens prompts) in XML-delimited blocks with explicit anti-injection instructions
2. **Path validation in parseFileProposals**: apply `rejectTraversal` and enforce `<workflowName>/` prefix restriction immediately
3. **Sanitize CAO template inputs**: strip known injection patterns from `issueTitle`, `issueDescription`, `mentionCommentBody` before template rendering

### Subprocess Security (Immediate Priority)

4. **Git credential helper**: rewrite to use `.netrc` temp file instead of shell function; never construct shell from user-controlled strings
5. **claude -p stdin usage**: pass prompts via stdin (`--file` or stdin pipe) instead of command-line arguments to prevent procfs exposure

### Prompt Architecture (Short-term)

6. **Separate system/user boundary**: use Anthropic Messages API `system` parameter for trusted instructions; user-controlled data goes in `user` role only — never in the system prompt
7. **Signed gate files**: add SHA256 signature of gate content in `workflow.json`; verify before isolated-vm execution

### Access Control (Short-term)

8. **dangerouslySkipPermissions default**: change to `false`; document that `true` is an explicit operator choice
9. **Sandbox cross-user targeting**: require `SANDBOX_MANAGE_ALL` permission for `targetUserId !== actor.userId`
10. **CAO Bash restriction**: configure `allowedTools` to exclude shell execution; CAO should use MnM API only

### Rate Limiting & Cost Controls (Medium-term)

11. **Per-user LLM cost budget**: implement daily token quota per `{companyId, userId}` with configurable caps
12. **Enrichment queue**: decouple gold enrichment from inline trace completion; use a rate-limited async queue
13. **Per-company cost cap**: add `monthly_llm_budget_cents` to companies table; enforce before LLM calls

### Monitoring & Observability (Medium-term)

14. **LLM cost metrics**: emit per-call cost metrics; alert on budget overruns
15. **Prompt injection detection**: add server-side scanning of incoming messages for known injection signatures (OWASP LLM patterns); log and optionally block

---

## Architecture Assessment

MnM's LLM threat surface is exceptionally wide because the LLM is not just a feature — it is the operational core:

- **4 separate LLM call paths** with different isolation levels
- **Agents run LLMs** (via adapters) that can call the **server's MCP tools** which can **trigger more LLM calls** (gold enrichment, CAO watchdog) — a full recursive LLM chain
- **User-controlled data flows into every LLM context** without sanitization: workflow definitions, issue content, trace logs, lens prompts, agent configs
- **The CAO is both an LLM consumer AND a high-privilege operator** — a "crown jewel" target for prompt injection
- **Gate code is user-supplied TypeScript** compiled and executed (sandboxed, but with host-bridged helpers) — a unique attack vector specific to MnM's governed workflow architecture

The most urgent architectural change is establishing a **trust boundary**: all user-controlled strings must be treated as untrusted data, never trusted instructions, at every LLM injection point.

---

## References

- OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- MITRE ATLAS: https://atlas.mitre.org/
- Anthropic Safety documentation
- isolated-vm security model: https://github.com/laverdet/isolated-vm
