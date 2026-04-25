/**
 * Build the services object injected into all MCP tool & resource handlers.
 * Each property corresponds to a `services.xxx` call in tool files.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { authAccounts, configLayerItems, configLayers, type Db } from "@mnm/db";
import { GitlabProvider, LocalBareRepoProvider, ShaCache, type GitProvider } from "@mnm/git-provider";
import { governedWorkflowService, GovernedWorkflowError } from "../services/governed-workflows.js";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { projectService } from "../services/projects.js";
import { agentService } from "../services/agents.js";
import { issueService } from "../services/issues.js";
import { configLayerService } from "../services/config-layer.js";
import { configLayerConflictService } from "../services/config-layer-conflict.js";
import { traceService } from "../services/trace-service.js";
import { dashboardService } from "../services/dashboard.js";
import { chatService } from "../services/chat.js";
import { chatSharingService } from "../services/chat-sharing.js";
import { documentService } from "../services/document.js";
import { folderService } from "../services/folder.js";
import { artifactService } from "../services/artifact.js";
import { deployManagerService } from "../services/deploy-manager.js";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { accessService } from "../services/access.js";
import { onboardingService } from "../services/onboarding.js";
import { inviteService } from "../services/invite.js";
import { auditService } from "../services/audit.js";
import { a2aBusService } from "../services/a2a-bus.js";
import { a2aPermissionsService } from "../services/a2a-permissions.js";
import { heartbeatService } from "../services/heartbeat.js";
import type { McpServices } from "./registry/types.js";

/**
 * Arguments for the GitProvider resolver.
 *
 * @property companyId — company whose git backend to resolve (required).
 * @property userId    — BetterAuth user id. When provided in `authenticated`
 *   mode, the resolver first checks the user's GitLab OAuth account in
 *   `authAccounts` and, if a non-expired token is found, returns a
 *   GitlabProvider scoped to that user. This gives each commit a per-user
 *   GitLab identity and a full audit trail tied to the human, not a bot PAT.
 */
export interface ResolveGitProviderArgs {
  companyId: string;
  userId?: string | null;
}

/**
 * Cached entry for per-user providers. The cache key is
 * `${companyId}:${userId}`. We store the expiry so we can invalidate on hit
 * when the token has expired rather than waiting for a 401.
 */
interface UserProviderCacheEntry {
  provider: GitProvider;
  /** Wall-clock time after which this entry should be evicted (ms). */
  expiresAt: number;
}

/**
 * Refresh an expired GitLab access_token using the stored refresh_token.
 * Updates the `account` row in place and returns the new {accessToken,
 * accessTokenExpiresAt}. Returns null if refresh fails (revoked token, GitLab
 * down, etc.) — the caller falls back to company-level config.
 *
 * Why we hit GitLab directly instead of going through BetterAuth: BetterAuth
 * exposes refresh helpers but importing it here would create a circular dep
 * (better-auth.ts → build-mcp-services.ts via the agent registry). Direct
 * fetch keeps this resolver dependency-free.
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

/**
 * Build a { companyId, userId? } -> GitProvider resolver.
 *
 * Resolution order (first match wins):
 *   1. Per-user GitLab OAuth token from `authAccounts` (userId + providerId="gitlab")
 *      — only in `authenticated` mode, only when the token is not expired.
 *   2. Company-level `config_layer_items` where itemType="git_provider"
 *      — set via PUT /git-provider-config. Cached for the process lifetime.
 *   3. Env-var fallback: MNM_GIT_PROVIDER / GITLAB_* / MNM_GIT_LOCAL_PATH
 *      — for dev / local_trusted bootstrapping.
 *
 * Cache strategy:
 *   - Company-level providers: Map keyed by companyId. Lifetime = process.
 *     A restart is required after credential rotation (config-layer UI warns).
 *   - Per-user providers: Map keyed by `${companyId}:${userId}`. Evicted on
 *     hit when `accessTokenExpiresAt` has passed.
 *
 * 401 refresh:
 *   GitlabProvider retries 5xx / 429 automatically. For 401 on a user token,
 *   callers should catch GIT_PROVIDER_UNAUTHORIZED and redirect the user to
 *   re-authenticate (BetterAuth /sign-in/gitlab). We do NOT attempt silent
 *   refresh here because it would require the BetterAuth instance, creating a
 *   circular dep. The error message is user-readable.
 *
 * local_trusted mode:
 *   `userId` is always ignored — the resolver goes straight to company config
 *   or env-var fallback. This preserves the existing dev flow (PUT
 *   /git-provider-config with a PAT) unchanged.
 */
export function createResolveGitProvider(
  db: Db,
): (args: ResolveGitProviderArgs) => Promise<GitProvider> {
  // Cache for company-level providers. Key = companyId.
  const companyCache = new Map<string, GitProvider>();
  // Cache for per-user providers. Key = `${companyId}:${userId}`.
  const userCache = new Map<string, UserProviderCacheEntry>();

  return async function resolveGitProvider(args: ResolveGitProviderArgs): Promise<GitProvider> {
    const { companyId, userId } = args;

    // ── Step 1: Per-user token (authenticated mode only) ──────────────────────
    // Skip entirely in local_trusted so dev flow is unaffected.
    const isAuthenticated =
      (process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted") === "authenticated";

    if (isAuthenticated && userId) {
      const userCacheKey = `${companyId}:${userId}`;
      const cachedEntry = userCache.get(userCacheKey);
      if (cachedEntry) {
        if (cachedEntry.expiresAt > Date.now()) {
          // Cache hit and token not yet expired.
          return cachedEntry.provider;
        }
        // Token expired — evict entry and fall through to DB lookup.
        userCache.delete(userCacheKey);
      }

      // Query authAccounts for the user's GitLab OAuth row — including
      // potentially-expired tokens. We attempt a silent refresh below if the
      // access token is past its expiry but a refresh_token is available.
      const accountRows = await db
        .select({
          accessToken: authAccounts.accessToken,
          accessTokenExpiresAt: authAccounts.accessTokenExpiresAt,
          refreshToken: authAccounts.refreshToken,
        })
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, userId),
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
        // GitLab's /oauth/token endpoint. Without this, users hit 401s every
        // ~2 h and have to re-login by hand from the profile page.
        const REFRESH_BUFFER_MS = 30_000;
        const isStale =
          !tokenExpiresAt ||
          tokenExpiresAt.getTime() - Date.now() <= REFRESH_BUFFER_MS;

        if (isStale && row.refreshToken) {
          const refreshed = await refreshGitlabAccessToken(
            db,
            userId,
            row.refreshToken,
          );
          if (refreshed) {
            userToken = refreshed.accessToken;
            tokenExpiresAt = refreshed.accessTokenExpiresAt;
          }
        }

        // Post-refresh check: only trust the token if it's no longer stale.
        // Otherwise fall through to company-level config (refresh failed or
        // there was no refresh_token at all).
        const stillStale =
          !tokenExpiresAt || tokenExpiresAt.getTime() <= Date.now();
        if (!stillStale) {
          // Determine the GitLab base URL and projectId for this user's provider.
          // MVP: reuse the same projectId as the company-level config (or env var
          // fallback). The user's token must have at least read_repository +
          // write_repository scopes on that project.
          const { baseUrl, projectId } = await resolveGitlabCoordinates(
            db,
            companyId,
          );

          const provider = new GitlabProvider({
            providerId: `gitlab:user:${userId}`,
            baseUrl,
            projectId,
            token: userToken,
            // OAuth access_tokens MUST go via Authorization: Bearer.
            // PRIVATE-TOKEN is reserved for PATs and 401s on OAuth tokens.
            tokenScheme: "bearer",
          });

          const expiresAt = tokenExpiresAt
            ? tokenExpiresAt.getTime()
            : Date.now() + 3600_000;
          userCache.set(userCacheKey, { provider, expiresAt });
          return provider;
        }
      }
      // No valid user token found — fall through to company-level resolution.
    }

    // ── Step 2: Company-level config_layer_items lookup ───────────────────────
    const cached = companyCache.get(companyId);
    if (cached) return cached;

    // Direct query over config_layer_items for company-enforced git_provider
    // items. We intentionally do NOT route through mergePreview here because
    // it takes an agentId and this is a company-scoped lookup. The
    // config-layer system guarantees a company has at most one active
    // git_provider item in the company-enforced layer.
    const rows = await db
      .select({ configJson: configLayerItems.configJson })
      .from(configLayerItems)
      .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
      .where(
        and(
          eq(configLayerItems.companyId, companyId),
          eq(configLayerItems.itemType, "git_provider"),
          eq(configLayerItems.enabled, true),
          eq(configLayers.scope, "company"),
          eq(configLayers.enforced, true),
          isNull(configLayers.archivedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      const provider = buildEnvFallbackProvider();
      companyCache.set(companyId, provider);
      return provider;
    }

    const cfg = rows[0]!.configJson as { kind?: string } & Record<string, unknown>;
    let provider: GitProvider;
    if (cfg.kind === "gitlab") {
      const { providerId, baseUrl, projectId, token } = cfg as {
        providerId?: string; baseUrl?: string; projectId?: string; token?: string;
      };
      if (!providerId || !baseUrl || !projectId || !token) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required gitlab fields.`,
          ["Set providerId, baseUrl, projectId, token on the git_provider config layer item."],
        );
      }
      provider = new GitlabProvider({ providerId, baseUrl, projectId, token });
    } else if (cfg.kind === "local") {
      const { providerId, repoDir } = cfg as { providerId?: string; repoDir?: string };
      if (!providerId || !repoDir) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required local fields.`,
          ["Set providerId and repoDir on the git_provider config layer item."],
        );
      }
      provider = new LocalBareRepoProvider({ providerId, repoDir });
    } else {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
        `Company ${companyId} git_provider item has unknown kind: ${String(cfg.kind)}`,
        ["Supported kinds are 'gitlab' and 'local'."],
      );
    }

    companyCache.set(companyId, provider);
    return provider;
  };
}

/**
 * Resolve the GitLab base URL and projectId for a user-scoped provider.
 * MVP strategy: read from the company's config_layer_item. If none, fall
 * back to env vars (GITLAB_BASE_URL / GITLAB_PROJECT_ID). The user's OAuth
 * token must have access to this project — it was requested via the `api` +
 * `read_repository` + `write_repository` scopes during BetterAuth sign-in.
 *
 * Future: support per-user or per-workflow repo selection by adding a user
 * preference table or a workflow-level `gitRepo` field.
 */
async function resolveGitlabCoordinates(
  db: Db,
  companyId: string,
): Promise<{ baseUrl: string; projectId: string }> {
  const rows = await db
    .select({ configJson: configLayerItems.configJson })
    .from(configLayerItems)
    .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
    .where(
      and(
        eq(configLayerItems.companyId, companyId),
        eq(configLayerItems.itemType, "git_provider"),
        eq(configLayerItems.enabled, true),
        eq(configLayers.scope, "company"),
        eq(configLayers.enforced, true),
        isNull(configLayers.archivedAt),
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    const cfg = rows[0]!.configJson as { kind?: string } & Record<string, unknown>;
    if (cfg.kind === "gitlab") {
      const { baseUrl, projectId } = cfg as { baseUrl?: string; projectId?: string };
      if (baseUrl && projectId) {
        return { baseUrl, projectId };
      }
    }
  }

  // Env-var fallback (dev / local bootstrap).
  const baseUrl = process.env.GITLAB_OAUTH_ISSUER_URL ?? process.env.GITLAB_BASE_URL ?? "https://gitlab.com";
  const projectId = process.env.GITLAB_PROJECT_ID ?? "";
  return { baseUrl, projectId };
}

function buildEnvFallbackProvider(): GitProvider {
  // In local_trusted (dev) mode, default to a local bare repo at the seed
  // script's canonical path (`~/.mnm/dev-workflows-bare/repo.git`). Devs can
  // run `bun run seed:hello-world` and `bun run dev` without touching env
  // vars. In authenticated (prod) mode the fallback path shouldn't be hit at
  // all — companies are expected to declare a `git_provider` config_layer_item
  // — but if one is missing we still default to gitlab so the startup crash
  // happens at first fetch rather than silently binding to an empty repo.
  const deploymentMode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  const defaultMode = deploymentMode === "local_trusted" ? "local" : "gitlab";
  const mode = process.env.MNM_GIT_PROVIDER ?? defaultMode;
  if (mode === "local") {
    const defaultRepoDir = join(homedir(), ".mnm", "dev-workflows-bare", "repo.git");
    const repoDir = process.env.MNM_GIT_LOCAL_PATH ?? defaultRepoDir;
    return new LocalBareRepoProvider({ providerId: "local:mnm-workflows", repoDir });
  }
  return new GitlabProvider({
    providerId: "gitlab:mnm-workflows",
    baseUrl: process.env.GITLAB_BASE_URL!,
    projectId: process.env.GITLAB_PROJECT_ID!,
    token: process.env.GITLAB_TOKEN!,
  });
}

export function buildMcpServices(db: Db): McpServices {
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  return {
    db,
    resolveGitProvider,
    projects: projectService(db),
    agents: agentService(db),
    issues: issueService(db),
    configLayers: configLayerService(db),
    configLayerConflict: configLayerConflictService(db),
    traces: traceService(db),
    dashboard: dashboardService(db),
    chat: chatService(db),
    chatSharing: chatSharingService(db),
    documents: documentService(db),
    folders: folderService(db),
    artifacts: artifactService(db),
    deployManager: deployManagerService(db),
    sandboxManager: sandboxManagerService(db),
    access: accessService(db),
    onboarding: onboardingService(db),
    invite: inviteService(db),
    audit: auditService(db),
    a2aBus: a2aBusService(db),
    a2aPermissions: a2aPermissionsService(db),
    heartbeat: heartbeatService(db),
    governedWorkflows: governedWorkflowService(db, { resolveGitProvider, shaCache }),
  };
}
