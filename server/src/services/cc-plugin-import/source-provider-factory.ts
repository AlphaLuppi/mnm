import { GitlabProvider, GitHubProvider, type GitProvider } from "@mnm/git-provider";
import { eq, and, isNull } from "drizzle-orm";
import {
  configLayers,
  configLayerItems,
  authAccounts,
  githubAppInstallations,
  type Db,
} from "@mnm/db";
import { connectorService, ConnectorError } from "../connectors.js";
import { githubAppService } from "../github-app.js";

export interface BuildSourceProviderInput {
  db: Db;
  companyId: string;
  /**
   * The full HTTPS URL of the plugin repo, e.g.
   * - https://gitlab.example.com/example-org/hub/creation/lint-pack (GitLab)
   * - https://github.com/alphaluppi/lint-pack (GitHub)
   */
  url: string;
  /** BetterAuth user id. When provided in `authenticated` mode, the resolver
   * first tries the user's per-provider OAuth token (Connectors Platform for
   * github, BetterAuth account row for gitlab) before falling back to the
   * company PAT. Same pattern as createResolveGitProvider Step 1a / 1. */
  userId?: string | null;
}

export interface ParsedRepoUrl {
  baseUrl: string;
  projectPath: string;
}

export function parseGitlabRepoUrl(url: string): ParsedRepoUrl {
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}`;
  const projectPath = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  if (!projectPath || projectPath.indexOf("/") < 0) {
    throw new Error(`Cannot parse GitLab project path from URL: ${url}`);
  }
  return { baseUrl, projectPath };
}

export interface ParsedGitHubRepo {
  baseUrl: string;
  owner: string;
  repo: string;
}

/**
 * Parse a github.com plugin URL into `{baseUrl, owner, repo}`. Accepts the
 * standard form `https://github.com/<owner>/<repo>` with optional `.git`
 * suffix and trailing slash. V0 (D2): rejects anything that isn't a
 * github.com host — no GitHub Enterprise Server support yet.
 */
export function parseGitHubRepoUrl(url: string): ParsedGitHubRepo {
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}`;
  if (u.host !== "github.com") {
    throw new Error(
      `Plugin URL host (${u.host}) is not github.com. V0 only supports github.com (D2 — no GHES).`,
    );
  }
  const path = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "").replace(/\/+$/, "");
  const segments = path.split("/");
  if (segments.length < 2 || !segments[0] || !segments[1]) {
    throw new Error(`Cannot parse GitHub owner/repo from URL: ${url}`);
  }
  return { baseUrl, owner: segments[0], repo: segments[1] };
}

/**
 * Look up the company's git_provider config layer item and build a
 * GitlabProvider pointing at the plugin URL (different projectId).
 *
 * Resolution order (mirrors createResolveGitProvider):
 *   1. Per-user GitLab OAuth token from `authAccounts` — authenticated mode
 *      only, skipped in local_trusted. Silent-refresh if stale.
 *   2. Company PAT from the enforced git_provider config layer item.
 *
 * The same-instance check (plugin URL host == company GitLab base) is
 * enforced on BOTH paths using the company config as the authoritative source.
 *
 * V1 demo constraint: plugin repo must live on the same GitLab instance as
 * the company workflows repo.
 */
export async function buildSourceProvider(
  input: BuildSourceProviderInput,
): Promise<GitProvider> {
  // Always look up the company git_provider config first — used for the
  // same-instance check on both paths, and as the PAT fallback when OAuth
  // doesn't apply or fails.
  const rows = await input.db
    .select({ configJson: configLayerItems.configJson })
    .from(configLayerItems)
    .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
    .where(
      and(
        eq(configLayerItems.companyId, input.companyId),
        eq(configLayerItems.itemType, "git_provider"),
        eq(configLayerItems.enabled, true),
        eq(configLayers.scope, "company"),
        eq(configLayers.enforced, true),
        isNull(configLayers.archivedAt),
      ),
    );

  if (rows.length === 0) {
    throw new Error("GIT_PROVIDER_MISCONFIG: company has no git_provider configured");
  }

  const config = (rows[0]!.configJson ?? {}) as {
    kind?: string;
    baseUrl?: string;
    token?: string;
    owner?: string;
    repo?: string;
  };

  if (config.kind === "gitlab") {
    return buildGitlabSourceProvider(input, config);
  }
  if (config.kind === "github") {
    return buildGithubSourceProvider(input, config);
  }
  throw new Error(
    `Source provider build only supports kind=gitlab|github, got kind=${config.kind ?? "unknown"}`,
  );
}

/**
 * GitLab plugin source provider. Same-instance check against the company's
 * GitLab base URL; per-user OAuth via BetterAuth `account` row with silent
 * refresh, fallback to company PAT.
 */
async function buildGitlabSourceProvider(
  input: BuildSourceProviderInput,
  config: { baseUrl?: string; token?: string },
): Promise<GitProvider> {
  const { baseUrl: parsedBaseUrl, projectPath } = parseGitlabRepoUrl(input.url);
  if (!config.baseUrl) {
    throw new Error("GIT_PROVIDER_MISCONFIG: kind=gitlab but baseUrl missing");
  }
  if (config.baseUrl.replace(/\/$/, "") !== parsedBaseUrl.replace(/\/$/, "")) {
    throw new Error(
      `Plugin URL host (${parsedBaseUrl}) differs from company GitLab base (${config.baseUrl}). V1 only supports same instance.`,
    );
  }

  // ── Step 1: Per-user token (authenticated mode only) ──────────────────────
  // Skip entirely in local_trusted so dev flow is unaffected.
  // Mirrors createResolveGitProvider Step 1 in build-mcp-services.ts exactly.
  const isAuthenticated =
    (process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted") === "authenticated";

  if (isAuthenticated && input.userId) {
    const accountRows = await input.db
      .select({
        accessToken: authAccounts.accessToken,
        accessTokenExpiresAt: authAccounts.accessTokenExpiresAt,
        refreshToken: authAccounts.refreshToken,
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, input.userId),
          eq(authAccounts.providerId, "gitlab"),
        ),
      )
      .limit(1);

    if (accountRows.length > 0 && accountRows[0]!.accessToken) {
      const row = accountRows[0]!;
      let userToken = row.accessToken!;
      let tokenExpiresAt: Date | null = row.accessTokenExpiresAt;

      const REFRESH_BUFFER_MS = 30_000;
      const isStale =
        !tokenExpiresAt ||
        tokenExpiresAt.getTime() - Date.now() <= REFRESH_BUFFER_MS;

      if (isStale && row.refreshToken) {
        const refreshed = await refreshGitlabAccessToken(
          input.db,
          input.userId,
          row.refreshToken,
        );
        if (refreshed) {
          userToken = refreshed.accessToken;
          tokenExpiresAt = refreshed.accessTokenExpiresAt;
        }
      }

      const stillStale =
        !tokenExpiresAt || tokenExpiresAt.getTime() <= Date.now();
      if (!stillStale) {
        return new GitlabProvider({
          providerId: `gitlab:user:${input.userId}`,
          baseUrl: config.baseUrl,
          projectId: projectPath,
          token: userToken,
          tokenScheme: "bearer",
        });
      }
    }
    // No valid user token found — fall through to company PAT.
  }

  // ── Step 2: Fallback to company PAT ───────────────────────────────────────
  if (!config.token) {
    throw new Error("GIT_PROVIDER_MISCONFIG: PAT missing for fallback");
  }
  return new GitlabProvider({
    providerId: `gitlab:plugin-source:${projectPath}`,
    baseUrl: config.baseUrl,
    projectId: projectPath,
    token: config.token,
  });
}

/**
 * GitHub plugin source provider. The plugin URL must point at github.com (V0
 * D2 — no GHES). Per-user OAuth via Connectors Platform `getUserToken("github")`
 * (D7-strict identity), fallback to company PAT in the config layer item.
 */
async function buildGithubSourceProvider(
  input: BuildSourceProviderInput,
  config: { token?: string; owner?: string; repo?: string },
): Promise<GitProvider> {
  const { owner: pluginOwner, repo: pluginRepo } = parseGitHubRepoUrl(input.url);

  // ── Step 0: Per-company App auto-dispatch (GITHUB-PROVIDER Phase 3 compl.)
  // If the company has a GitHub App registered on its `github` connector AND
  // an installation matching `pluginOwner` exists (NOT suspended), use mode
  // `app-installation` and bypass user OAuth entirely. This is the same
  // dispatch logic as `createResolveGitProvider` — D7 still holds because
  // commits made through this provider take their author/committer from the
  // commit-identity service.
  const githubAppsService = githubAppService(input.db);
  const connSvc = connectorService(input.db);
  const ghConnector = await connSvc.getActiveConnectorBySlug(input.companyId, "github");
  if (ghConnector) {
    const appRow = await githubAppsService.getGitHubAppByConnector(
      input.companyId,
      ghConnector.id,
    );
    if (appRow) {
      const matching = await input.db
        .select({ installationId: githubAppInstallations.installationId })
        .from(githubAppInstallations)
        .where(
          and(
            eq(githubAppInstallations.companyId, input.companyId),
            eq(githubAppInstallations.githubAppId, appRow.id),
            eq(githubAppInstallations.accountLogin, pluginOwner),
            isNull(githubAppInstallations.suspendedAt),
          ),
        )
        .limit(1);
      if (matching.length > 0) {
        const installationId = matching[0]!.installationId;
        return new GitHubProvider({
          providerId: `github:app:${input.userId ?? "system"}:${pluginOwner}/${pluginRepo}`,
          owner: pluginOwner,
          repo: pluginRepo,
          auth: {
            mode: "app-installation",
            mintToken: () =>
              githubAppsService.mintInstallationToken({
                companyId: input.companyId,
                githubAppId: appRow.id,
                installationId,
              }),
          },
        });
      }
    }
  }

  // ── Step 1a: Per-user OAuth token via Connectors Platform ─────────────────
  // Same pattern as createResolveGitProvider Step 1a — preserves D7 (the
  // user's GitHub identity is the committer of any commit made through
  // this provider, not a bot).
  const isAuthenticated =
    (process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted") === "authenticated";
  if (isAuthenticated && input.userId) {
    try {
      const tok = await connSvc.getUserToken(input.userId, "github", input.companyId);
      return new GitHubProvider({
        providerId: `github:user:${input.userId}:${pluginOwner}/${pluginRepo}`,
        owner: pluginOwner,
        repo: pluginRepo,
        auth: { mode: "user-oauth", token: tok.accessToken },
      });
    } catch (err) {
      // CONNECTOR_NOT_CONFIGURED / CONNECTOR_USER_NOT_CONNECTED → fall through
      // to PAT. Other ConnectorErrors (REVOKED, EXPIRED_NO_REFRESH) surface.
      if (
        err instanceof ConnectorError &&
        err.code !== "CONNECTOR_NOT_CONFIGURED" &&
        err.code !== "CONNECTOR_USER_NOT_CONNECTED"
      ) {
        throw err;
      }
      // Fall through to PAT.
    }
  }

  // ── Step 2: Fallback to company PAT (config_layer_item.token) ─────────────
  if (!config.token) {
    throw new Error("GIT_PROVIDER_MISCONFIG: github PAT missing for fallback");
  }
  return new GitHubProvider({
    providerId: `github:plugin-source:${pluginOwner}/${pluginRepo}`,
    owner: pluginOwner,
    repo: pluginRepo,
    auth: { mode: "user-oauth", token: config.token },
  });
}

/**
 * Refresh an expired GitLab access_token using the stored refresh_token.
 * Inlined from build-mcp-services.ts — do NOT factor this out yet (would
 * require a shared package or circular dep). Mirrors the original exactly.
 *
 * Returns null if refresh fails (revoked token, GitLab down, env vars
 * missing) — the caller falls back to the company PAT.
 */
async function refreshGitlabAccessToken(
  db: Db,
  userId: string,
  refreshToken: string,
): Promise<{ accessToken: string; accessTokenExpiresAt: Date } | null> {
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET;
  const issuer = process.env.GITLAB_OAUTH_ISSUER_URL;
  if (!clientId || !clientSecret || !issuer) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let res: Response;
  try {
    res = await fetch(`${issuer}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return null; // Network error — fall through.
  }

  if (!res.ok) {
    // 400 invalid_grant → user revoked or rotation drift; force re-auth.
    return null;
  }

  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!json?.access_token) return null;

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 7200;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

  // Persist the rotated tokens. GitLab rotates the refresh_token on each
  // use, so we MUST store the new one or the next refresh will 400.
  await db
    .update(authAccounts)
    .set({
      accessToken: json.access_token,
      accessTokenExpiresAt: newExpiresAt,
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(authAccounts.userId, userId),
        eq(authAccounts.providerId, "gitlab"),
      ),
    );

  return { accessToken: json.access_token, accessTokenExpiresAt: newExpiresAt };
}
