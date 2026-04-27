import { GitlabProvider, type GitProvider } from "@mnm/git-provider";
import { eq, and, isNull } from "drizzle-orm";
import { configLayers, configLayerItems, authAccounts, type Db } from "@mnm/db";

export interface BuildSourceProviderInput {
  db: Db;
  companyId: string;
  /**
   * The full HTTPS URL of the plugin repo, e.g.
   * https://lab.cbainfo.fr/genia/hub/creation/symfony-upgrade-tests
   */
  url: string;
  /** BetterAuth user id. When provided in `authenticated` mode, the resolver
   * first tries the user's GitLab OAuth token before falling back to the
   * company PAT — same pattern as createResolveGitProvider Step 1. */
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
  const { baseUrl: parsedBaseUrl, projectPath } = parseGitlabRepoUrl(input.url);

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
  };

  if (config.kind !== "gitlab") {
    throw new Error(
      `Source provider build only supports kind=gitlab in V1, got kind=${config.kind ?? "unknown"}`,
    );
  }
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

      // Silent refresh: if access_token is expired (or expires within 30 s)
      // and a refresh_token is on file, swap for a fresh access_token via
      // GitLab's /oauth/token endpoint.
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

      // Post-refresh check: only trust the token if it's no longer stale.
      // Otherwise fall through to company-level PAT fallback.
      const stillStale =
        !tokenExpiresAt || tokenExpiresAt.getTime() <= Date.now();
      if (!stillStale) {
        return new GitlabProvider({
          providerId: `gitlab:user:${input.userId}`,
          baseUrl: config.baseUrl,
          projectId: projectPath,
          token: userToken,
          // OAuth access_tokens MUST go via Authorization: Bearer.
          // PRIVATE-TOKEN is reserved for PATs and 401s on OAuth tokens.
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
