---
id: SEC-T9-09
severity: medium
category: LLM06 - Sensitive Information Disclosure / LLM07 - Insecure Plugin Design
title: MCP tool inventory disclosed to all authenticated agents — tool discovery leaks internal architecture
file: server/src/mcp/index.ts:128-130 / server/src/mcp/registry/tool-registry.ts
status: open
---

## Description

When an MCP session is initialized, the server logs the full tool and resource inventory:

```typescript
logger.info(
  { tools: toolRegistry.allTools.length, resources: resourceRegistry.allResources.length },
  "mcp.registry.loaded",
);
```

More critically, every connected MCP client receives the **full tool list** via MCP's `tools/list` response. The tool list contains:
- Tool descriptions (rich documentation of internal architecture)
- Input schemas (reveal DB table structure, permission model)
- Tool names (reveal feature capabilities like `sync_governed_environment`, `import_cc_plugin`, `push_local_state`)

While tools are **filtered by `actor.effectivePermissions`** (good), the filtered list still reveals:
1. What permissions the token has (by what tools appear)
2. Internal feature names and architecture patterns
3. The existence of privileged tools (even if not callable — their descriptions explain what they do and hint at attack surfaces)

Additionally, the **legacy SSE endpoint** (`GET /mcp/sse`) initializes a session without rate-limiting the initial token verification overhead, only the session count. An attacker can enumerate token permissions by establishing a session and listing tools, then disconnecting.

**Agent-to-agent confused deputy**: An agent authenticating via `mnm-agent` JWT has permissions inherited from its creator. If an agent's creator has `ROLES_MANAGE` permission, the agent can call `manage_role`, `manage_tag`, and `get_audit_log` — including exporting the full audit log via `export_audit`. This is by design but creates a confused deputy pattern where a compromised agent can act as its creator with full administrative capabilities.

## Impact

- **Architecture disclosure**: the full tool inventory with rich descriptions is an intelligence windfall for attackers planning more targeted attacks
- **Permission enumeration**: an attacker with a low-privilege token can determine exactly which permissions their account has by observing which tools appear in the filtered list
- **Confused deputy escalation**: any agent created by an Admin user inherits Admin permissions and can perform Admin-level MCP operations

## Reproduction

```bash
# Establish MCP session with any valid token
curl -X POST https://mnm.example.com/mcp \
  -H "Authorization: Bearer $LOW_PRIV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'

# Call tools/list — reveals all tools the token can access
# Each tool description reveals internal architecture:
# "sync_governed_environment: Return the agent + config payload to stage in ~/.mnm/cache/"
# "push_local_state: Returns the payload the harness MUST write to ${CLAUDE_PLUGIN_DATA}/last-session.json"
```

## Recommendation

1. **Redact tool descriptions for non-admin actors**: return minimal descriptions for sensitive tools to agents; full descriptions only for users
2. **Tool category disclosure**: instead of exposing full `description` strings in tool lists, expose only `name` and `category` — the agent/LLM can call the tool and read the schema from the error if needed
3. **Agent permission isolation**: add `creatorPermissions` as a field in the agent JWT and intersect with the agent's own role at token verification time — prevent agents from having more permissions than explicitly granted at agent creation
4. **Audit MCP tool list calls**: log every `tools/list` request with the actor ID and tools returned, for anomaly detection

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM06, LLM07)
- MCP Specification: Tool Discovery security considerations
