import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { authUsers } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import type { ConnectorService } from "./connectors.js";
import { ConnectorError } from "./connectors.js";

/**
 * D7 strict commit identity resolver.
 *
 * Returns the `{ name, email }` pair that MUST be used for BOTH `author` and
 * `committer` of any git commit MnM creates on behalf of a human user
 * (governed-workflows, CC plugin import, Workflow Studio file ops, …).
 *
 * Resolution order:
 *  1. If the user has connected the provider's user-OAuth connector
 *     (slug = `providerKind`), call the provider's `/user` endpoint and
 *     return the human identity declared in their provider profile. This
 *     keeps commits attributable to the same identity the user already
 *     publishes externally — clean diff in `git log` and clean attribution
 *     on the provider UI.
 *  2. Fallback to BetterAuth user row (`user.name` + `user.email` from the
 *     `user` table). Used in `local_trusted` and whenever the user has not
 *     connected the matching git provider.
 *  3. Last-ditch fallback if even the user row is missing: synthesize
 *     `{ userId, ${userId}@mnm.local }`. This should never trigger in
 *     practice but keeps the function total.
 *
 * Cache: in-memory `Map`, key = `${userId}:${providerKind}`, TTL = 24 h.
 * Different identity per provider per user (a user may publish under
 * different name/email on GitLab vs GitHub). Cache evicts on stale hit
 * rather than on a background timer to keep the module side-effect-free.
 *
 * NEVER LOGS THE TOKEN. The fetch failure path silently falls through to
 * the BetterAuth fallback so a transient 5xx never blocks a commit.
 */

export type CommitIdentityProviderKind = "github" | "gitlab";

export interface CommitIdentity {
  name: string;
  email: string;
}

export interface ResolveCommitIdentityArgs {
  userId: string;
  companyId: string;
  providerKind: CommitIdentityProviderKind;
}

export interface CommitIdentityServiceDeps {
  /** Connector service used to fetch the user's OAuth token for the matching provider. */
  connectors: ConnectorService;
  /**
   * Test seam — defaults to global `fetch`. Tests pass a stub here.
   */
  fetchImpl?: typeof fetch;
  /**
   * Test seam — defaults to `Date.now`. Tests can pass a fake clock.
   */
  now?: () => number;
  /**
   * Cache TTL in milliseconds. Defaults to 24 h. Lowered to 0 in tests.
   */
  cacheTtlMs?: number;
}

interface CacheEntry {
  value: CommitIdentity;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface ProviderCatalogEntry {
  /** Slug used for `connectorService.getUserToken(userId, slug, companyId)`. */
  slug: string;
  /** Endpoint that returns `{ login, name?, email? }` for the bearer's user. */
  userInfoUrl: string;
}

const PROVIDER_CATALOG: Record<CommitIdentityProviderKind, ProviderCatalogEntry> = {
  github: {
    slug: "github",
    userInfoUrl: "https://api.github.com/user",
  },
  gitlab: {
    slug: "gitlab",
    userInfoUrl: `${process.env.GITLAB_BASE_URL ?? "https://gitlab.com"}/api/v4/user`,
  },
};

interface GitHubUserResponse {
  login?: string;
  name?: string | null;
  email?: string | null;
}

interface GitLabUserResponse {
  username?: string;
  name?: string | null;
  email?: string | null;
  public_email?: string | null;
  commit_email?: string | null;
}

export function commitIdentityService(db: Db, deps: CommitIdentityServiceDeps) {
  const cache = new Map<string, CacheEntry>();
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = deps.now ?? (() => Date.now());
  const ttlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  function cacheKey(userId: string, providerKind: CommitIdentityProviderKind): string {
    return `${userId}:${providerKind}`;
  }

  async function fetchProviderIdentity(
    args: ResolveCommitIdentityArgs,
  ): Promise<CommitIdentity | null> {
    const catalog = PROVIDER_CATALOG[args.providerKind];

    let token: string;
    try {
      const tok = await deps.connectors.getUserToken(
        args.userId,
        catalog.slug,
        args.companyId,
      );
      token = tok.accessToken;
    } catch (err) {
      // Common cases: connector not configured, user not connected.
      // Anything ConnectorError-shaped is a graceful "no token, fall back".
      if (err instanceof ConnectorError) return null;
      // Membership / cross-tenant guard errors are also a fallback signal —
      // the caller will use BetterAuth identity instead.
      logger.warn(
        { err, userId: args.userId, providerKind: args.providerKind },
        "[commit-identity] getUserToken non-fatal failure — falling back",
      );
      return null;
    }

    let res: Response;
    try {
      res = await fetchImpl(catalog.userInfoUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "mnm-commit-identity/0.1",
        },
      });
    } catch (err) {
      logger.warn(
        { err, providerKind: args.providerKind },
        "[commit-identity] provider /user fetch network failure — falling back",
      );
      return null;
    }

    if (!res.ok) {
      // 401/403 = token invalid for the userinfo endpoint — fall back. Don't
      // log the token. Status alone is enough for diagnosis.
      logger.warn(
        { status: res.status, providerKind: args.providerKind },
        "[commit-identity] provider /user returned non-2xx — falling back",
      );
      return null;
    }

    if (args.providerKind === "github") {
      const body = (await res.json().catch(() => ({}))) as GitHubUserResponse;
      const login = body.login;
      if (!login || login.length === 0) return null;
      const name = body.name && body.name.length > 0 ? body.name : login;
      const email =
        body.email && body.email.length > 0
          ? body.email
          : `${login}@users.noreply.github.com`;
      return { name, email };
    }

    // gitlab
    const body = (await res.json().catch(() => ({}))) as GitLabUserResponse;
    const username = body.username;
    if (!username || username.length === 0) return null;
    const name = body.name && body.name.length > 0 ? body.name : username;
    const email =
      body.commit_email && body.commit_email.length > 0
        ? body.commit_email
        : body.public_email && body.public_email.length > 0
          ? body.public_email
          : body.email && body.email.length > 0
            ? body.email
            : `${username}@users.noreply.gitlab.com`;
    return { name, email };
  }

  async function fetchBetterAuthIdentity(userId: string): Promise<CommitIdentity | null> {
    const [row] = await db
      .select({ name: authUsers.name, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1);
    if (!row?.email) return null;
    return {
      name: row.name?.trim() || row.email,
      email: row.email,
    };
  }

  async function resolveCommitIdentity(
    args: ResolveCommitIdentityArgs,
  ): Promise<CommitIdentity> {
    const key = cacheKey(args.userId, args.providerKind);
    const cached = cache.get(key);
    if (cached) {
      if (cached.expiresAt > now()) return cached.value;
      cache.delete(key);
    }

    const fromProvider = await fetchProviderIdentity(args);
    if (fromProvider) {
      cache.set(key, { value: fromProvider, expiresAt: now() + ttlMs });
      return fromProvider;
    }

    const fromBetterAuth = await fetchBetterAuthIdentity(args.userId);
    if (fromBetterAuth) {
      cache.set(key, { value: fromBetterAuth, expiresAt: now() + ttlMs });
      return fromBetterAuth;
    }

    // Last-ditch synthesis — keep the function total. Not cached because we
    // want the next call to retry the BetterAuth lookup once the row exists.
    return { name: args.userId, email: `${args.userId}@mnm.local` };
  }

  // Test-only escape hatch — exposed so unit tests can warm/inspect the cache.
  function _resetCacheForTests(): void {
    cache.clear();
  }

  return {
    resolveCommitIdentity,
    _resetCacheForTests,
  };
}

export type CommitIdentityService = ReturnType<typeof commitIdentityService>;
