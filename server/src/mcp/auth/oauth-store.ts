import { randomUUID, randomBytes, createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { oauthClients, oauthRefreshTokens } from "@mnm/db";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  createdAt: Date;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  companyId: string;
  scopes: string[];
  permissions?: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  resource?: string;
  expiresAt: number;
}

export interface RefreshToken {
  token: string;
  clientId: string;
  userId: string;
  companyId: string;
  scopes: string[];
  permissions?: string[];
  resource?: string;
  expiresAt: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Store ───────────────────────────────────────────────────────────────────

const CODE_TTL_MS = 60 * 1000; // 60 seconds
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class OAuthStore {
  private codes = new Map<string, AuthorizationCode>();
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async registerClient(
    name: string,
    redirectUris: string[],
    grantTypes: string[],
  ): Promise<OAuthClient> {
    const clientSecret = randomBytes(32).toString("hex");

    const [row] = await this.db
      .insert(oauthClients)
      .values({
        clientSecret,
        clientName: name,
        redirectUris,
        grantTypes,
      })
      .returning();

    return {
      clientId: row.clientId,
      clientSecret: row.clientSecret ?? undefined,
      clientName: row.clientName,
      redirectUris: row.redirectUris as string[],
      grantTypes: row.grantTypes as string[],
      createdAt: row.createdAt,
    };
  }

  async getClient(clientId: string): Promise<OAuthClient | undefined> {
    const [row] = await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);

    if (!row) return undefined;

    return {
      clientId: row.clientId,
      clientSecret: row.clientSecret ?? undefined,
      clientName: row.clientName,
      redirectUris: row.redirectUris as string[],
      grantTypes: row.grantTypes as string[],
      createdAt: row.createdAt,
    };
  }

  createCode(params: {
    clientId: string;
    userId: string;
    companyId: string;
    scopes: string[];
    permissions?: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    resource?: string;
  }): string {
    const code = randomBytes(32).toString("hex");

    const entry: AuthorizationCode = {
      code,
      clientId: params.clientId,
      userId: params.userId,
      companyId: params.companyId,
      scopes: params.scopes,
      ...(params.permissions && { permissions: params.permissions }),
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      redirectUri: params.redirectUri,
      resource: params.resource,
      expiresAt: Date.now() + CODE_TTL_MS,
    };

    this.codes.set(code, entry);
    return code;
  }

  consumeCode(code: string): AuthorizationCode | null {
    const entry = this.codes.get(code);
    if (!entry) return null;

    // Single-use: delete immediately
    this.codes.delete(code);

    // Check expiration
    if (Date.now() > entry.expiresAt) return null;

    return entry;
  }

  async createRefreshToken(params: {
    clientId: string;
    userId: string;
    companyId: string;
    scopes: string[];
    permissions?: string[];
    resource?: string;
  }): Promise<string> {
    const token = randomBytes(48).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.db.insert(oauthRefreshTokens).values({
      tokenHash,
      clientId: params.clientId,
      userId: params.userId,
      companyId: params.companyId,
      scopes: params.scopes,
      permissions: params.permissions ?? [],
      resource: params.resource,
      expiresAt,
    });

    return token;
  }

  async consumeRefreshToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = hashToken(token);

    const [row] = await this.db
      .delete(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
      .returning();

    if (!row) return null;

    // Check expiration
    if (new Date() > row.expiresAt) return null;

    const permissions = Array.isArray(row.permissions) ? row.permissions as string[] : [];

    return {
      token,
      clientId: row.clientId,
      userId: row.userId,
      companyId: row.companyId,
      scopes: row.scopes as string[],
      permissions: permissions.length > 0 ? permissions : undefined,
      resource: row.resource ?? undefined,
      expiresAt: row.expiresAt.getTime(),
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean expired in-memory auth codes
    for (const [code, entry] of this.codes) {
      if (now > entry.expiresAt) this.codes.delete(code);
    }

    // Clean expired refresh tokens from DB
    await this.db
      .delete(oauthRefreshTokens)
      .where(lt(oauthRefreshTokens.expiresAt, new Date()));
  }
}
