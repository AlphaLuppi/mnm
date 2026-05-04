import { and, eq, isNull, sql } from "drizzle-orm";
import * as jose from "jose";
import type { Db } from "@mnm/db";
import {
  githubApps,
  githubAppInstallations,
  oauthConnectors,
  oauthConnectorsAudit,
} from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { encryptSecret, decryptSecret } from "./secret-crypto.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateGitHubAppInput {
  companyId: string;
  connectorId: string;
  userId: string;
  appId: string;
  privateKey: string;
  /** Optional webhook secret stored encrypted for V1 webhook ingestion. */
  webhookSecret?: string | null;
}

export interface GitHubAppDetails {
  id: string;
  appId: string;
  appSlug: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface GitHubAppInstallationRow {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  accountId: bigint | null;
  repositorySelection: "all" | "selected" | null;
  suspendedAt: Date | null;
  createdAt: Date;
}

export class GitHubAppError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "GitHubAppError";
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
const APP_JWT_TTL_SECONDS = 9 * 60; // 9 min — under GitHub's 10-min ceiling.
// GitHub installation tokens TTL is 1h. Cache 55min so we refresh 5min before
// expiry — never a stale token presented to the API.
const INSTALL_TOKEN_TTL_MS = 55 * 60 * 1000;

interface InstallTokenCacheEntry {
  token: string;
  expiresAt: number;
}

interface GitHubAppMintCacheKey {
  githubAppId: string;
  installationId: string;
}

function makeCacheKey(args: GitHubAppMintCacheKey): string {
  return `${args.githubAppId}:${args.installationId}`;
}

// Module-level cache so all instances of the service inside a process share
// the same in-memory token store (matches how `getUserToken` operates).
const installTokenCache = new Map<string, InstallTokenCacheEntry>();

// Test-only escape hatch for cache reset between tests.
export function _resetGitHubAppCacheForTests(): void {
  installTokenCache.clear();
}

// ─── Service factory ──────────────────────────────────────────────────────────

export interface GitHubAppServiceDeps {
  /** Test seam — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function githubAppService(db: Db, deps: GitHubAppServiceDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);

  // ── Audit helper (mirrors connectors.ts pattern, fire-and-forget) ──────────
  async function recordAudit(args: {
    companyId: string;
    connectorId: string | null;
    actorUserId: string | null;
    action:
      | "connector_created"
      | "connector_updated"
      | "connector_deleted"
      | "connector_enabled"
      | "connector_disabled"
      | "user_connected"
      | "user_disconnected"
      | "user_refresh_failed"
      | "user_token_revoked"
      | "token_used"
      | "redirect_after_rejected";
    diffJson?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(oauthConnectorsAudit).values({
        companyId: args.companyId,
        connectorId: args.connectorId,
        actorUserId: args.actorUserId,
        action: args.action,
        diffJson: args.diffJson ?? {},
      });
    } catch (err) {
      logger.warn(
        { err, action: args.action },
        "[github-app] audit insert failed (non-fatal)",
      );
    }
  }

  // ── PEM → CryptoKey + sign App JWT (RS256, iss=appId, exp 9min) ───────────
  async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
    let privateKey;
    try {
      privateKey = await jose.importPKCS8(privateKeyPem, "RS256");
    } catch (err) {
      throw badRequest(
        `Invalid private key — must be a PKCS#8 PEM (-----BEGIN PRIVATE KEY-----). ${
          (err as Error).message
        }`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    return new jose.SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt(now - 60) // 1min clock skew
      .setExpirationTime(now + APP_JWT_TTL_SECONDS)
      .setIssuer(appId)
      .sign(privateKey);
  }

  // ── Validate App credentials by hitting /app with the JWT ─────────────────
  // Returns the App row (`{ slug, ... }`) on success; throws badRequest on 401.
  async function fetchAppMetadata(appId: string, privateKeyPem: string): Promise<{
    id: number;
    slug: string;
    name: string;
  }> {
    const jwt = await signAppJwt(appId, privateKeyPem);
    let res: Response;
    try {
      res = await fetchImpl(`${GITHUB_API_BASE}/app`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "mnm-github-app/0.1",
        },
      });
    } catch (err) {
      throw badRequest(
        `Cannot reach GitHub API to validate App credentials: ${(err as Error).message}`,
      );
    }
    if (res.status === 401) {
      throw badRequest(
        "GitHub rejected the App credentials (401). Check that App ID matches the private key.",
      );
    }
    if (!res.ok) {
      throw badRequest(
        `GitHub returned ${res.status} when validating App credentials.`,
      );
    }
    return (await res.json()) as { id: number; slug: string; name: string };
  }

  // ── createGitHubApp ───────────────────────────────────────────────────────
  async function createGitHubApp(input: CreateGitHubAppInput): Promise<GitHubAppDetails> {
    // 1. Verify the connector exists, is OAuth2 type and matches the company.
    const [connector] = await db
      .select()
      .from(oauthConnectors)
      .where(
        and(
          eq(oauthConnectors.id, input.connectorId),
          eq(oauthConnectors.companyId, input.companyId),
        ),
      )
      .limit(1);
    if (!connector) throw notFound(`Connector not found: ${input.connectorId}`);
    if (connector.type !== "oauth2") {
      throw badRequest(
        `Connector ${connector.providerSlug} is type=${connector.type}; the GitHub App option is only available on oauth2 connectors`,
      );
    }
    if (connector.providerSlug !== "github") {
      throw badRequest(
        `GitHub App can only be attached to a 'github' connector (got '${connector.providerSlug}')`,
      );
    }

    // 2. Fail-fast validation: hit GitHub /app with the JWT before persisting.
    const meta = await fetchAppMetadata(input.appId, input.privateKey);
    if (String(meta.id) !== input.appId.trim()) {
      logger.warn(
        { provided: input.appId, githubReturned: meta.id },
        "[github-app] appId mismatch with GitHub /app response",
      );
      // Soft-warn, don't reject — GitHub treats `iss` on the JWT as the source
      // of truth and would have 401'd if it didn't recognize the appId.
    }

    // 3. Encrypt the private key + optional webhook secret.
    const enc = encryptSecret(input.privateKey);
    const webhookEnc = input.webhookSecret ? encryptSecret(input.webhookSecret) : null;

    // 4. Insert. Catch UNIQUE violation → 409 conflict (one App per connector).
    let row;
    try {
      [row] = await db
        .insert(githubApps)
        .values({
          companyId: input.companyId,
          connectorId: input.connectorId,
          appId: input.appId,
          appSlug: meta.slug,
          privateKeyIv: enc.iv,
          privateKeyCiphertext: enc.ciphertext,
          privateKeyTag: enc.tag,
          webhookSecretIv: webhookEnc?.iv ?? null,
          webhookSecretCiphertext: webhookEnc?.ciphertext ?? null,
          webhookSecretTag: webhookEnc?.tag ?? null,
          createdByUserId: input.userId,
        })
        .returning();
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") {
        throw conflict(
          `A GitHub App is already attached to this connector (use DELETE first to replace it).`,
        );
      }
      throw err;
    }

    await recordAudit({
      companyId: input.companyId,
      connectorId: input.connectorId,
      actorUserId: input.userId,
      action: "connector_updated",
      diffJson: {
        change: "github_app_attached",
        appSlug: meta.slug,
      },
    });

    return {
      id: row!.id,
      appId: row!.appId,
      appSlug: row!.appSlug,
      createdAt: row!.createdAt,
      revokedAt: row!.revokedAt,
    };
  }

  // ── mintInstallationToken ─────────────────────────────────────────────────
  // Returns a fresh installation token (cached 55min, advisory-locked refresh).
  async function mintInstallationToken(args: {
    companyId: string;
    githubAppId: string;
    installationId: string;
  }): Promise<string> {
    const cacheKey = makeCacheKey(args);
    const cached = installTokenCache.get(cacheKey);
    // 5min safety buffer matches INSTALL_TOKEN_TTL_MS = 55min.
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.token;
    }

    // Advisory-locked refresh — mirrors connectors.ts pattern (MED-B1).
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${"mnm:gh-app-mint:" + cacheKey}))`,
      );
      // Re-check inside lock: a concurrent caller may have minted while we waited.
      const inside = installTokenCache.get(cacheKey);
      if (inside && inside.expiresAt > Date.now() + 5 * 60 * 1000) {
        return inside.token;
      }

      const [appRow] = await tx
        .select()
        .from(githubApps)
        .where(
          and(
            eq(githubApps.id, args.githubAppId),
            eq(githubApps.companyId, args.companyId),
            isNull(githubApps.revokedAt),
          ),
        )
        .limit(1);
      if (!appRow) {
        throw notFound(
          `GitHub App ${args.githubAppId} not found for company (or revoked)`,
        );
      }
      // Confirm the installation belongs to this App and is not suspended.
      const [installRow] = await tx
        .select()
        .from(githubAppInstallations)
        .where(
          and(
            eq(githubAppInstallations.githubAppId, args.githubAppId),
            eq(githubAppInstallations.installationId, args.installationId),
            eq(githubAppInstallations.companyId, args.companyId),
          ),
        )
        .limit(1);
      if (!installRow) {
        throw notFound(
          `Installation ${args.installationId} not found on App ${args.githubAppId}`,
        );
      }
      if (installRow.suspendedAt !== null) {
        throw conflict(
          `GitHub App installation ${args.installationId} is suspended (since ${installRow.suspendedAt.toISOString()})`,
        );
      }

      const privateKeyPem = decryptSecret({
        iv: appRow.privateKeyIv,
        ciphertext: appRow.privateKeyCiphertext,
        tag: appRow.privateKeyTag,
      });
      const jwt = await signAppJwt(appRow.appId, privateKeyPem);

      const url = `${GITHUB_API_BASE}/app/installations/${encodeURIComponent(args.installationId)}/access_tokens`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "mnm-github-app/0.1",
        },
      });
      if (res.status === 401 || res.status === 403) {
        // Lazy detection of suspension (R3 in plan): mark the install row
        // suspended so future calls don't loop hitting GitHub.
        await tx
          .update(githubAppInstallations)
          .set({ suspendedAt: new Date() })
          .where(eq(githubAppInstallations.id, installRow.id));
        throw new GitHubAppError(
          "GITHUB_APP_INSTALL_SUSPENDED",
          `GitHub returned ${res.status} for installation ${args.installationId}; marking suspended.`,
        );
      }
      if (!res.ok) {
        throw new GitHubAppError(
          "GITHUB_APP_MINT_FAILED",
          `GitHub returned ${res.status} when minting installation token.`,
        );
      }
      const body = (await res.json()) as { token?: string; expires_at?: string };
      if (!body.token) {
        throw new GitHubAppError(
          "GITHUB_APP_MINT_FAILED",
          "GitHub returned no token in installation token mint response.",
        );
      }

      const cacheTtl = body.expires_at
        ? Math.max(
            5 * 60 * 1000,
            new Date(body.expires_at).getTime() - 5 * 60 * 1000 - Date.now(),
          )
        : INSTALL_TOKEN_TTL_MS;
      installTokenCache.set(cacheKey, {
        token: body.token,
        expiresAt: Date.now() + cacheTtl,
      });

      return body.token;
    });
  }

  // ── listInstallations: sync from GitHub then return DB rows ───────────────
  async function listInstallations(args: {
    companyId: string;
    githubAppId: string;
  }): Promise<GitHubAppInstallationRow[]> {
    const [appRow] = await db
      .select()
      .from(githubApps)
      .where(
        and(
          eq(githubApps.id, args.githubAppId),
          eq(githubApps.companyId, args.companyId),
          isNull(githubApps.revokedAt),
        ),
      )
      .limit(1);
    if (!appRow) {
      throw notFound(
        `GitHub App ${args.githubAppId} not found for company (or revoked)`,
      );
    }

    const privateKeyPem = decryptSecret({
      iv: appRow.privateKeyIv,
      ciphertext: appRow.privateKeyCiphertext,
      tag: appRow.privateKeyTag,
    });
    const jwt = await signAppJwt(appRow.appId, privateKeyPem);

    // Paginate /app/installations — 100/page, hard cap at 50 pages (5000
    // installations is more than any realistic per-company App).
    const remote: Array<{
      id: number;
      account: { login: string; type: "User" | "Organization"; id: number };
      repository_selection: "all" | "selected";
      suspended_at: string | null;
    }> = [];
    let page = 1;
    while (page <= 50) {
      const url = `${GITHUB_API_BASE}/app/installations?per_page=100&page=${page}`;
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "mnm-github-app/0.1",
        },
      });
      if (!res.ok) {
        throw new GitHubAppError(
          "GITHUB_APP_LIST_INSTALLATIONS_FAILED",
          `GitHub returned ${res.status} when listing installations.`,
        );
      }
      const batch = (await res.json()) as typeof remote;
      remote.push(...batch);
      if (batch.length < 100) break;
      page += 1;
    }

    // Upsert each. Bigint conversion via BigInt(number).
    for (const inst of remote) {
      await db
        .insert(githubAppInstallations)
        .values({
          companyId: args.companyId,
          githubAppId: args.githubAppId,
          installationId: String(inst.id),
          accountLogin: inst.account.login,
          accountType: inst.account.type,
          accountId: BigInt(inst.account.id),
          repositorySelection: inst.repository_selection,
          suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
        })
        .onConflictDoUpdate({
          target: [
            githubAppInstallations.githubAppId,
            githubAppInstallations.installationId,
          ],
          set: {
            accountLogin: inst.account.login,
            accountType: inst.account.type,
            accountId: BigInt(inst.account.id),
            repositorySelection: inst.repository_selection,
            suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
          },
        });
    }

    // Return the post-sync DB view. Filter to the App + company so a stale
    // row from a previous App on the same company isn't surfaced.
    const rows = await db
      .select()
      .from(githubAppInstallations)
      .where(
        and(
          eq(githubAppInstallations.githubAppId, args.githubAppId),
          eq(githubAppInstallations.companyId, args.companyId),
        ),
      );
    return rows.map((r) => ({
      id: r.id,
      installationId: r.installationId,
      accountLogin: r.accountLogin,
      accountType: r.accountType as "User" | "Organization",
      accountId: r.accountId,
      repositorySelection: r.repositorySelection as "all" | "selected" | null,
      suspendedAt: r.suspendedAt,
      createdAt: r.createdAt,
    }));
  }

  // ── assertInstallationActive — 409 if suspended_at IS NOT NULL ────────────
  async function assertInstallationActive(
    githubAppId: string,
    installationId: string,
  ): Promise<void> {
    const [row] = await db
      .select({ suspendedAt: githubAppInstallations.suspendedAt })
      .from(githubAppInstallations)
      .where(
        and(
          eq(githubAppInstallations.githubAppId, githubAppId),
          eq(githubAppInstallations.installationId, installationId),
        ),
      )
      .limit(1);
    if (!row) {
      throw notFound(
        `Installation ${installationId} not found on App ${githubAppId}`,
      );
    }
    if (row.suspendedAt !== null) {
      throw conflict(
        `GitHub App installation ${installationId} is suspended (since ${row.suspendedAt.toISOString()})`,
      );
    }
  }

  // ── revokeGitHubApp — soft-delete + purge token cache ─────────────────────
  async function revokeGitHubApp(args: {
    companyId: string;
    githubAppId: string;
    actorUserId: string;
  }): Promise<void> {
    const [row] = await db
      .select()
      .from(githubApps)
      .where(
        and(
          eq(githubApps.id, args.githubAppId),
          eq(githubApps.companyId, args.companyId),
          isNull(githubApps.revokedAt),
        ),
      )
      .limit(1);
    if (!row) throw notFound(`GitHub App ${args.githubAppId} not found or already revoked`);

    await db
      .update(githubApps)
      .set({ revokedAt: new Date() })
      .where(eq(githubApps.id, args.githubAppId));

    // Purge in-memory cache for any installation belonging to this App.
    const installs = await db
      .select({ installationId: githubAppInstallations.installationId })
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.githubAppId, args.githubAppId));
    for (const inst of installs) {
      installTokenCache.delete(
        makeCacheKey({
          githubAppId: args.githubAppId,
          installationId: inst.installationId,
        }),
      );
    }

    await recordAudit({
      companyId: args.companyId,
      connectorId: row.connectorId,
      actorUserId: args.actorUserId,
      action: "connector_updated",
      diffJson: { change: "github_app_revoked" },
    });
  }

  // ── getGitHubAppByConnector — used by REST + the resolver auto-dispatch ──
  async function getGitHubAppByConnector(
    companyId: string,
    connectorId: string,
  ): Promise<GitHubAppDetails | null> {
    const [row] = await db
      .select()
      .from(githubApps)
      .where(
        and(
          eq(githubApps.connectorId, connectorId),
          eq(githubApps.companyId, companyId),
          isNull(githubApps.revokedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      appId: row.appId,
      appSlug: row.appSlug,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  // ── upsertInstallation — used by callback handler when admin installs App ──
  // Caller has already validated the install belongs to the company-owned App
  // (via state JWT). We sync the account_login etc. on insert.
  async function upsertInstallationFromCallback(args: {
    companyId: string;
    githubAppId: string;
    installationId: string;
  }): Promise<{ accountLogin: string; accountType: "User" | "Organization" }> {
    // Mint a JWT for the App, then GET /app/installations/:id to discover
    // account_login / type. We can't trust client-supplied params alone.
    const [appRow] = await db
      .select()
      .from(githubApps)
      .where(
        and(
          eq(githubApps.id, args.githubAppId),
          eq(githubApps.companyId, args.companyId),
          isNull(githubApps.revokedAt),
        ),
      )
      .limit(1);
    if (!appRow) {
      throw notFound(`GitHub App ${args.githubAppId} not found or revoked`);
    }
    const privateKeyPem = decryptSecret({
      iv: appRow.privateKeyIv,
      ciphertext: appRow.privateKeyCiphertext,
      tag: appRow.privateKeyTag,
    });
    const jwt = await signAppJwt(appRow.appId, privateKeyPem);

    const url = `${GITHUB_API_BASE}/app/installations/${encodeURIComponent(args.installationId)}`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mnm-github-app/0.1",
      },
    });
    if (!res.ok) {
      throw new GitHubAppError(
        "GITHUB_APP_INSTALLATION_FETCH_FAILED",
        `GitHub returned ${res.status} when fetching installation metadata.`,
      );
    }
    const body = (await res.json()) as {
      id: number;
      account: { login: string; type: "User" | "Organization"; id: number };
      repository_selection: "all" | "selected";
      suspended_at: string | null;
    };

    await db
      .insert(githubAppInstallations)
      .values({
        companyId: args.companyId,
        githubAppId: args.githubAppId,
        installationId: String(body.id),
        accountLogin: body.account.login,
        accountType: body.account.type,
        accountId: BigInt(body.account.id),
        repositorySelection: body.repository_selection,
        suspendedAt: body.suspended_at ? new Date(body.suspended_at) : null,
      })
      .onConflictDoUpdate({
        target: [
          githubAppInstallations.githubAppId,
          githubAppInstallations.installationId,
        ],
        set: {
          accountLogin: body.account.login,
          accountType: body.account.type,
          accountId: BigInt(body.account.id),
          repositorySelection: body.repository_selection,
          suspendedAt: body.suspended_at ? new Date(body.suspended_at) : null,
        },
      });

    return { accountLogin: body.account.login, accountType: body.account.type };
  }

  return {
    createGitHubApp,
    mintInstallationToken,
    listInstallations,
    assertInstallationActive,
    revokeGitHubApp,
    getGitHubAppByConnector,
    upsertInstallationFromCallback,
  };
}

export type GitHubAppService = ReturnType<typeof githubAppService>;
