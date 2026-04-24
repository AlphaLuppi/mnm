import type { Request, RequestHandler } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { toNodeHandler } from "better-auth/node";
import type { Db } from "@mnm/db";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@mnm/db";
import { sql } from "drizzle-orm";
import type { Config } from "../config.js";

// ── GitLab OIDC (self-hosted, federated to Azure AD upstream) ─────────────────
// Only active when all three env vars are set. In local_trusted dev without
// the vars, BetterAuth will NOT expose the GitLab login option — no fallback
// to gitlab.com is ever attempted.
//
// BetterAuth's native `gitlab` provider uses `issuer` (the GitLab base URL)
// to derive auth/token/userinfo endpoints:
//   authorization → <issuer>/oauth/authorize
//   token         → <issuer>/oauth/token
//   userinfo      → <issuer>/api/v4/user
//
// The access_token obtained here is later reused by resolveGitProvider to
// commit workflow definitions as the authenticated user (full audit chain).
function buildGitlabProviderConfig(): {
  clientId: string;
  clientSecret: string;
  issuer: string;
  scope: string[];
} | null {
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET;
  // GITLAB_OAUTH_ISSUER_URL is the GitLab base URL, e.g.
  // "https://lab.cbainfo.fr". BetterAuth appends /oauth/authorize etc.
  const issuerUrl = process.env.GITLAB_OAUTH_ISSUER_URL;

  if (!clientId || !clientSecret || !issuerUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    issuer: issuerUrl,
    // api + read_repository + write_repository enable commit-as-user for
    // governed workflow definitions. openid / profile / email are the
    // standard OIDC claims needed for session creation.
    scope: ["openid", "profile", "email", "api", "read_repository", "write_repository"],
  };
}

// ── Microsoft / Entra ID (Azure AD) ──────────────────────────────────────────
// Direct-to-Azure provider, complementary to GitLab OIDC. Useful when a user
// has a CBA identity but no GitLab access (ex: non-dev staff, external
// collaborators with a guest Azure account). Login succeeds, but governed
// workflow commits will then fall back to the company-level PAT — an Azure
// token cannot sign commits on lab.cbainfo.fr.
//
// BetterAuth's native `microsoft` provider:
//   authorization → https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/authorize
//   token         → https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token
//   userinfo      → https://graph.microsoft.com/v1.0/me
//
// tenantId semantics:
//   "common"        → any Azure AD tenant + personal accounts (dev default)
//   "organizations" → any Azure AD tenant (no personal)
//   "<uuid>"        → single tenant (recommended for prod — lock to CBA's tenant)
function buildMicrosoftProviderConfig(): {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  scope: string[];
  prompt: "select_account";
} | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    // Default to "common" (any tenant) so dev works out of the box. In prod,
    // set MICROSOFT_OAUTH_TENANT_ID to CBA's Entra tenant UUID so only CBA
    // identities can sign in — guests from other tenants get a 401.
    tenantId: process.env.MICROSOFT_OAUTH_TENANT_ID ?? "common",
    // openid/profile/email = OIDC claims. User.Read = Graph API baseline
    // (display name, email, UPN). We don't request any write scopes — MnM
    // never acts on behalf of the user against Graph.
    scope: ["openid", "profile", "email", "User.Read"],
    // select_account forces the Microsoft account picker every login. Avoids
    // silent auth as the wrong identity when a user has multiple tenants.
    prompt: "select_account",
  };
}

export type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

type BetterAuthInstance = ReturnType<typeof betterAuth>;

function headersFromNodeHeaders(rawHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(rawHeaders)) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
      continue;
    }
    headers.set(key, raw);
  }
  return headers;
}

function headersFromExpressRequest(req: Request): Headers {
  return headersFromNodeHeaders(req.headers);
}

export function deriveAuthTrustedOrigins(config: Config): string[] {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const trustedOrigins = new Set<string>();

  if (baseUrl) {
    try {
      trustedOrigins.add(new URL(baseUrl).origin);
    } catch {
      // Better Auth will surface invalid base URL separately.
    }
  }
  if (config.deploymentMode === "authenticated") {
    // Derive port from public URL for origin matching (browsers include port in origin)
    const publicUrl = process.env.MNM_PUBLIC_URL ?? baseUrl;
    let port: string | null = null;
    if (publicUrl) {
      try { port = new URL(publicUrl).port || null; } catch { /* ignore */ }
    }
    for (const hostname of config.allowedHostnames) {
      const trimmed = hostname.trim().toLowerCase();
      if (!trimmed) continue;
      trustedOrigins.add(`https://${trimmed}`);
      trustedOrigins.add(`http://${trimmed}`);
      if (port) {
        trustedOrigins.add(`https://${trimmed}:${port}`);
        trustedOrigins.add(`http://${trimmed}:${port}`);
      }
    }
  }

  return Array.from(trustedOrigins);
}

export function createBetterAuthInstance(db: Db, config: Config, trustedOrigins?: string[]): BetterAuthInstance {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.MNM_AGENT_JWT_SECRET ?? "mnm-dev-secret";
  const effectiveTrustedOrigins = trustedOrigins ?? deriveAuthTrustedOrigins(config);

  const publicUrl = process.env.MNM_PUBLIC_URL ?? baseUrl;
  const isHttpOnly = publicUrl ? publicUrl.startsWith("http://") : false;

  // Disable rate limiting when running E2E tests (prevents "Too Many Requests" during parallel tests)
  const isE2eMode = process.env.MNM_E2E_SEED === "true";

  // Conditionally add social providers — only when their env vars are present.
  // Guards against accidentally wiring an incomplete provider (e.g. missing
  // secret) which would make BetterAuth throw at startup.
  const gitlabProviderConfig = buildGitlabProviderConfig();
  const microsoftProviderConfig = buildMicrosoftProviderConfig();

  const authConfig = {
    baseURL: baseUrl,
    secret,
    trustedOrigins: effectiveTrustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: config.authDisableSignUp,
    },
    ...(gitlabProviderConfig || microsoftProviderConfig
      ? {
          socialProviders: {
            ...(gitlabProviderConfig ? { gitlab: gitlabProviderConfig } : {}),
            ...(microsoftProviderConfig ? { microsoft: microsoftProviderConfig } : {}),
          },
        }
      : {}),
    ...(isHttpOnly ? { advanced: { useSecureCookies: false } } : {}),
    ...(isE2eMode ? { rateLimit: { enabled: false } } : {}),
    // SANDBOX-AUTH-AUTOBOOTSTRAP: first user signup → auto instance_admin
    // Atomic INSERT: only succeeds if zero instance_admin rows exist (race-safe)
    databaseHooks: {
      user: {
        create: {
          after: async (user: { id: string }) => {
            try {
              await db.execute(sql`
                INSERT INTO instance_user_roles (id, user_id, role, created_at, updated_at)
                SELECT gen_random_uuid(), ${user.id}, 'instance_admin', now(), now()
                WHERE NOT EXISTS (
                  SELECT 1 FROM instance_user_roles WHERE role = 'instance_admin'
                )
              `);
            } catch (err) {
              console.error("[autobootstrap] failed to promote first user to instance_admin:", err);
            }
          },
        },
      },
    },
  };

  if (!baseUrl) {
    delete (authConfig as { baseURL?: string }).baseURL;
  }

  return betterAuth(authConfig);
}

export function createBetterAuthHandler(auth: BetterAuthInstance): RequestHandler {
  const handler = toNodeHandler(auth);
  return (req, res, next) => {
    void Promise.resolve(handler(req, res)).catch(next);
  };
}

export async function resolveBetterAuthSessionFromHeaders(
  auth: BetterAuthInstance,
  headers: Headers,
): Promise<BetterAuthSessionResult | null> {
  const api = (auth as unknown as { api?: { getSession?: (input: unknown) => Promise<unknown> } }).api;
  if (!api?.getSession) return null;

  const sessionValue = await api.getSession({
    headers,
  });
  if (!sessionValue || typeof sessionValue !== "object") return null;

  const value = sessionValue as {
    session?: { id?: string; userId?: string } | null;
    user?: { id?: string; email?: string | null; name?: string | null } | null;
  };
  const session = value.session?.id && value.session.userId
    ? { id: value.session.id, userId: value.session.userId }
    : null;
  const user = value.user?.id
    ? {
        id: value.user.id,
        email: value.user.email ?? null,
        name: value.user.name ?? null,
      }
    : null;

  if (!session || !user) return null;
  return { session, user };
}

export async function resolveBetterAuthSession(
  auth: BetterAuthInstance,
  req: Request,
): Promise<BetterAuthSessionResult | null> {
  return resolveBetterAuthSessionFromHeaders(auth, headersFromExpressRequest(req));
}
