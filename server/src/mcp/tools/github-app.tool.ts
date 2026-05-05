import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { logger } from "../../middleware/logger.js";
import { HttpError } from "../../errors.js";

/**
 * GITHUB-PROVIDER Phase 1 — MCP parity for the per-company GitHub App config
 * (governed-workflows.md §"Parité REST + MCP est ABSOLUE"). Every endpoint
 * exposed under /companies/:companyId/connectors/:connectorId/github/app must
 * also be reachable from a Claude Code agent over MCP.
 *
 * Four tools mirroring the REST surface :
 *   - create_github_app           — POST  → register App credentials
 *   - get_github_app              — GET   → app config + installations
 *   - sync_github_app_installations — POST .../sync
 *   - revoke_github_app           — DELETE → soft-delete
 *
 * Tenant context is set explicitly with `setTenantContext` at the top of each
 * handler (the registry wrapper handles permissions, audit, errors but not
 * RLS context). H3 redaction: privateKey is NEVER logged.
 */

function safeError(err: unknown) {
  if (err instanceof HttpError) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: err.message,
            status: err.status,
          }),
        },
      ],
      isError: true,
    };
  }
  logger.error({ err }, "[mcp.github-app] unexpected error");
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ error: "Internal error" }) },
    ],
    isError: true,
  };
}

export default defineMcpTools(({ tool, services }) => {
  // ─── 1. create_github_app ───────────────────────────────────────────────
  tool("create_github_app", {
    permissions: [PERMISSIONS.CONNECTORS_MANAGE],
    description:
      "[GitHub App] Register a per-company GitHub App on a `github` connector.\n" +
      "The private key (.pem) is encrypted at rest via secret-crypto.ts.\n" +
      "**The privateKey is NEVER logged.** Validates by signing a JWT and POSTing to GitHub /app.",
    input: z.object({
      connectorId: z
        .string()
        .uuid()
        .describe("UUID of the `github` connector this App is attached to"),
      appId: z
        .string()
        .regex(/^[0-9]+$/, "appId must be the numeric GitHub App id")
        .describe("Numeric GitHub App id (digits only) from your App's settings page"),
      privateKey: z
        .string()
        .min(100)
        .describe(
          "PKCS#8 PEM private key (-----BEGIN PRIVATE KEY-----…). NEVER logged.",
        ),
      webhookSecret: z
        .string()
        .min(8)
        .max(256)
        .optional()
        .describe("Optional webhook secret (V0 not consumed; stored for V1)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "MCP actor must be a user (agent JWTs not supported)",
              }),
            },
          ],
          isError: true,
        };
      }
      // H3 redaction — log BEFORE any operation, NEVER include `input.privateKey`.
      logger.info(
        {
          tool: "create_github_app",
          companyId: actor.companyId,
          connectorId: input.connectorId,
          userId: actor.userId,
          appId: input.appId,
        },
        "[mcp.github-app] user creating App (privateKey redacted)",
      );
      try {
        await setTenantContext(services.db, actor.companyId);
        const out = await services.githubApps.createGitHubApp({
          companyId: actor.companyId,
          connectorId: input.connectorId,
          userId: actor.userId,
          appId: input.appId,
          privateKey: input.privateKey,
          webhookSecret: input.webhookSecret ?? null,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                app: {
                  id: out.id,
                  appId: out.appId,
                  appSlug: out.appSlug,
                  createdAt: out.createdAt,
                },
              }),
            },
          ],
        };
      } catch (err) {
        return safeError(err);
      } finally {
        // HIGH-A3 — clear `app.current_company_id` before the postgres-js
        // connection returns to the pool. Without this cleanup the next
        // request that gets that connection inherits a stale tenant context.
        await clearTenantContext(services.db).catch(() => {});
      }
    },
  });

  // ─── 2. get_github_app ──────────────────────────────────────────────────
  tool("get_github_app", {
    permissions: [PERMISSIONS.CONNECTORS_MANAGE],
    description:
      "[GitHub App] Get the App config + active installations for a connector.\n" +
      "**NEVER returns the private key**, only metadata (appId, slug, createdAt).",
    input: z.object({
      connectorId: z.string().uuid().describe("UUID of the `github` connector"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      try {
        await setTenantContext(services.db, actor.companyId);
        const app = await services.githubApps.getGitHubAppByConnector(
          actor.companyId,
          input.connectorId,
        );
        if (!app) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "No GitHub App attached to this connector",
                }),
              },
            ],
            isError: true,
          };
        }
        const installations = await services.githubApps.listInstallations({
          companyId: actor.companyId,
          githubAppId: app.id,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                app,
                installations: installations.map(
                  (i: {
                    id: string;
                    installationId: string;
                    accountLogin: string;
                    accountType: string;
                    repositorySelection: string | null;
                    suspendedAt: Date | null;
                    createdAt: Date;
                  }) => ({
                    id: i.id,
                    installationId: i.installationId,
                    accountLogin: i.accountLogin,
                    accountType: i.accountType,
                    repositorySelection: i.repositorySelection,
                    suspendedAt: i.suspendedAt,
                    createdAt: i.createdAt,
                  }),
                ),
              }),
            },
          ],
        };
      } catch (err) {
        return safeError(err);
      } finally {
        await clearTenantContext(services.db).catch(() => {});
      }
    },
  });

  // ─── 3. sync_github_app_installations ───────────────────────────────────
  tool("sync_github_app_installations", {
    permissions: [PERMISSIONS.CONNECTORS_MANAGE],
    description:
      "[GitHub App] Re-sync installations for the App attached to a connector.\n" +
      "Hits GitHub /app/installations (paginated) and upserts the local DB rows.",
    input: z.object({
      connectorId: z.string().uuid().describe("UUID of the `github` connector"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async ({ input, actor }) => {
      try {
        await setTenantContext(services.db, actor.companyId);
        const app = await services.githubApps.getGitHubAppByConnector(
          actor.companyId,
          input.connectorId,
        );
        if (!app) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "No GitHub App attached to this connector",
                }),
              },
            ],
            isError: true,
          };
        }
        const installations = await services.githubApps.listInstallations({
          companyId: actor.companyId,
          githubAppId: app.id,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ installations }) },
          ],
        };
      } catch (err) {
        return safeError(err);
      } finally {
        await clearTenantContext(services.db).catch(() => {});
      }
    },
  });

  // ─── 4. revoke_github_app ───────────────────────────────────────────────
  tool("revoke_github_app", {
    permissions: [PERMISSIONS.CONNECTORS_MANAGE],
    description:
      "[GitHub App] Soft-delete (revoke) the App attached to a connector.\n" +
      "Sets `revoked_at = now()` and purges the in-memory installation token cache.\n" +
      "The OAuth side of the connector remains active.",
    input: z.object({
      connectorId: z.string().uuid().describe("UUID of the `github` connector"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (!actor.userId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "MCP actor must be a user (agent JWTs not supported)",
              }),
            },
          ],
          isError: true,
        };
      }
      try {
        await setTenantContext(services.db, actor.companyId);
        const app = await services.githubApps.getGitHubAppByConnector(
          actor.companyId,
          input.connectorId,
        );
        if (!app) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "No GitHub App attached to this connector",
                }),
              },
            ],
            isError: true,
          };
        }
        await services.githubApps.revokeGitHubApp({
          companyId: actor.companyId,
          githubAppId: app.id,
          actorUserId: actor.userId,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ok: true }) },
          ],
        };
      } catch (err) {
        return safeError(err);
      } finally {
        await clearTenantContext(services.db).catch(() => {});
      }
    },
  });
});
