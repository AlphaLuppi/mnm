import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { CONNECTOR_TEMPLATES } from "../../services/connector-templates.js";
import { logger } from "../../middleware/logger.js";

/**
 * CONNECTORS-PLATFORM Sprint 2 — Task 5.3 MCP tools.
 *
 * Five tools wired into the registry (`./index.ts`):
 *   - list_connectors            — admin/user, NEVER returns secret material
 *   - get_connector_status       — per-user status (connected / expired / revoked)
 *   - connect_user_to_connector  — returns a signed authorize URL (10min state JWT)
 *   - wait_for_connection        — long-poll until user completes OAuth (max 60s)
 *   - set_user_api_key           — H3 redaction obligatoire (key never logged)
 *
 * The five tool handlers all use `services.connectors`, wired in
 * `build-mcp-services.ts` (`connectors: connectorService(db)`).
 */
export default defineMcpTools(({ tool, services }) => {
  // ─── 1. list_connectors ───────────────────────────────────────────────────
  tool("list_connectors", {
    permissions: [PERMISSIONS.MCP_CONNECT],
    description:
      "[Connectors] List the OAuth and API-key connectors configured for the company.\n" +
      "Returns slug, type, enabled, displayName, scopes and `client_secret_configured: bool`.\n" +
      "**NEVER returns the client_secret or any user token** — secret material stays host-side.",
    input: z.object({
      onlyEnabled: z
        .boolean()
        .optional()
        .describe("If true, omit disabled connectors (default false)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const rows = await services.connectors.listConnectors(actor.companyId);
      const filtered = input.onlyEnabled ? rows.filter((r: any) => r.enabled) : rows;
      const safe = filtered.map((r: any) => ({
        id: r.id,
        providerSlug: r.providerSlug,
        displayName: r.displayName,
        type: r.type,
        enabled: r.enabled,
        scopes: r.scopes,
        apiKeyLabel: r.apiKeyLabel,
        clientSecretConfigured: r.clientSecretConfigured ?? false,
        refreshSupported: r.refreshSupported,
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              connectors: safe,
              templates: CONNECTOR_TEMPLATES.map((t) => ({
                slug: t.slug,
                displayName: t.displayName,
                type: t.type,
                tagline: t.tagline,
              })),
            }),
          },
        ],
      };
    },
  });

  // ─── 2. get_connector_status ──────────────────────────────────────────────
  tool("get_connector_status", {
    permissions: [PERMISSIONS.MCP_CONNECT],
    description:
      "[Connectors] Get the current user's status on a single connector.\n" +
      "Returns one of: `connected` | `disconnected` | `expired` | `revoked`, plus\n" +
      "`scopes_granted`, `expires_at`, `last_used_at`. **NEVER returns the token**.",
    input: z.object({
      connectorId: z.string().uuid().describe("The connector ID (oauth_connectors.id)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "MCP actor must be a user (agent JWTs not supported)" }),
            },
          ],
          isError: true,
        };
      }
      try {
        const status = await services.connectors.getUserConnectorStatus({
          userId: actor.userId,
          companyId: actor.companyId,
          connectorId: input.connectorId,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                connectorId: status.id,
                providerSlug: status.providerSlug,
                displayName: status.displayName,
                type: status.type,
                status: status.status,
                scopesGranted: status.scopesGranted,
                expiresAt: status.expiresAt,
                lastUsedAt: status.lastUsedAt,
              }),
            },
          ],
        };
      } catch (err: any) {
        if (err?.code === "CONNECTOR_USER_NOT_IN_COMPANY") {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
            isError: true,
          };
        }
        throw err;
      }
    },
  });

  // ─── 3. connect_user_to_connector ─────────────────────────────────────────
  tool("connect_user_to_connector", {
    permissions: [PERMISSIONS.MCP_CONNECT],
    description:
      "[Connectors] Initiate the OAuth flow for the current user × connector.\n" +
      "Returns a signed authorize URL (state JWT TTL 10min). The user must open\n" +
      "this URL in their browser to authorize MnM and complete the flow.\n" +
      "**Use `wait_for_connection` after this** to await the user's completion.",
    input: z.object({
      connectorId: z.string().uuid().describe("The OAuth2 connector ID"),
      redirectAfter: z
        .string()
        .optional()
        .describe(
          "Optional redirect path after success (must start with `/` OR match MNM_PUBLIC_URL origin)",
        ),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "MCP actor must be a user (agent JWTs not supported)" }),
            },
          ],
          isError: true,
        };
      }
      try {
        const { authorizeUrl } = await services.connectors.signAuthorizeUrl({
          userId: actor.userId,
          companyId: actor.companyId,
          connectorId: input.connectorId,
          redirectAfter: input.redirectAfter,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                authorizeUrl,
                instructions:
                  "Open `authorizeUrl` in your browser. After authorizing, call `wait_for_connection` (or poll `get_connector_status`) to detect completion.",
              }),
            },
          ],
        };
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.code === "CONNECTOR_USER_NOT_IN_COMPANY") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: err.message ?? "Connector not found" }),
              },
            ],
            isError: true,
          };
        }
        throw err;
      }
    },
  });

  // ─── 4. wait_for_connection (long-poll, max 60s) ──────────────────────────
  tool("wait_for_connection", {
    permissions: [PERMISSIONS.MCP_CONNECT],
    description:
      "[Connectors] Long-poll until the user completes the OAuth flow on a given\n" +
      "connector. Returns when status flips to `connected`, OR after `timeoutS`\n" +
      "seconds (capped at 60s). Use after `connect_user_to_connector` instead of\n" +
      "active polling — saves an MCP round-trip per second.",
    input: z.object({
      connectorId: z.string().uuid().describe("The connector to wait on"),
      timeoutS: z
        .number()
        .int()
        .min(1)
        .max(60)
        .default(30)
        .describe("Max seconds to wait. Capped at 60. Default 30."),
      pollIntervalMs: z
        .number()
        .int()
        .min(500)
        .max(5000)
        .default(1500)
        .describe("Internal poll cadence in ms. Default 1500."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "MCP actor must be a user (agent JWTs not supported)" }),
            },
          ],
          isError: true,
        };
      }
      const deadline = Date.now() + input.timeoutS * 1000;
      while (Date.now() < deadline) {
        try {
          const status = await services.connectors.getUserConnectorStatus({
            userId: actor.userId,
            companyId: actor.companyId,
            connectorId: input.connectorId,
          });
          if (status.status === "connected") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    status: "connected",
                    scopesGranted: status.scopesGranted,
                    expiresAt: status.expiresAt,
                  }),
                },
              ],
            };
          }
          if (status.status === "revoked") {
            // No point waiting if already revoked — user must explicitly reconnect.
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    status: "revoked",
                    message: "Refresh token has been revoked — call connect_user_to_connector again",
                  }),
                },
              ],
              isError: true,
            };
          }
        } catch (err: any) {
          if (err?.code === "CONNECTOR_USER_NOT_IN_COMPANY") {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
              isError: true,
            };
          }
          // Transient errors (DB hiccup) — back off and retry.
          logger.warn({ err }, "[mcp.wait_for_connection] transient error, retrying");
        }
        await new Promise((resolve) => setTimeout(resolve, input.pollIntervalMs));
      }
      // Timeout — surface as non-error so the agent can decide to keep waiting
      // or prompt the user. The status field disambiguates.
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "timeout",
              message: `User did not complete connection within ${input.timeoutS}s — call again to keep waiting, or prompt the user to open the authorize URL.`,
            }),
          },
        ],
      };
    },
  });

  // ─── 5. set_user_api_key (H3 redaction) ───────────────────────────────────
  tool("set_user_api_key", {
    permissions: [PERMISSIONS.MCP_CONNECT],
    description:
      "[Connectors] Store an API key for the current user × api_key connector.\n" +
      "The key is encrypted at rest (AES-256-GCM). **The key is NEVER logged**.\n" +
      "Use this for `api_key` connectors only (e.g. OpenAI, Anthropic). For OAuth\n" +
      "connectors, use `connect_user_to_connector` + `wait_for_connection`.",
    input: z.object({
      connectorId: z.string().uuid().describe("The api_key connector ID"),
      key: z.string().min(1).describe("The API key to store (encrypted, never logged)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "MCP actor must be a user (agent JWTs not supported)" }),
            },
          ],
          isError: true,
        };
      }
      // H3 redaction — log BEFORE any other operation, NEVER include `input.key`.
      logger.info(
        {
          tool: "set_user_api_key",
          companyId: actor.companyId,
          connectorId: input.connectorId,
          userId: actor.userId,
        },
        "[mcp.connectors] user setting api_key (key redacted)",
      );
      try {
        await services.connectors.setUserApiKey({
          userId: actor.userId,
          connectorId: input.connectorId,
          companyId: actor.companyId,
          key: input.key,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ok: true, connectorId: input.connectorId }),
            },
          ],
        };
      } catch (err: any) {
        if (
          err?.code === "CONNECTOR_USER_NOT_IN_COMPANY" ||
          err?.statusCode === 404 ||
          err?.statusCode === 400
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: err.message ?? "Failed to set api_key" }),
              },
            ],
            isError: true,
          };
        }
        throw err;
      }
    },
  });
});
