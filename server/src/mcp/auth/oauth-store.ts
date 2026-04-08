import { randomUUID, randomBytes } from "node:crypto";

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
  resource?: string;
  expiresAt: number;
}

// ── Store ───────────────────────────────────────────────────────────────────

const CODE_TTL_MS = 60 * 1000; // 60 seconds
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class OAuthStore {
  private clients = new Map<string, OAuthClient>();
  private codes = new Map<string, AuthorizationCode>();
  private refreshTokens = new Map<string, RefreshToken>();

  registerClient(
    name: string,
    redirectUris: string[],
    grantTypes: string[],
  ): OAuthClient {
    const clientId = randomUUID();
    const clientSecret = randomBytes(32).toString("hex");

    const client: OAuthClient = {
      clientId,
      clientSecret,
      clientName: name,
      redirectUris,
      grantTypes,
      createdAt: new Date(),
    };

    this.clients.set(clientId, client);
    return client;
  }

  getClient(clientId: string): OAuthClient | undefined {
    return this.clients.get(clientId);
  }

  createCode(params: {
    clientId: string;
    userId: string;
    companyId: string;
    scopes: string[];
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

  createRefreshToken(params: {
    clientId: string;
    userId: string;
    companyId: string;
    scopes: string[];
    resource?: string;
  }): string {
    const token = randomBytes(48).toString("hex");

    const entry: RefreshToken = {
      token,
      clientId: params.clientId,
      userId: params.userId,
      companyId: params.companyId,
      scopes: params.scopes,
      resource: params.resource,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    };

    this.refreshTokens.set(token, entry);
    return token;
  }

  consumeRefreshToken(token: string): RefreshToken | null {
    const entry = this.refreshTokens.get(token);
    if (!entry) return null;

    // Rotate on use: delete old token
    this.refreshTokens.delete(token);

    // Check expiration
    if (Date.now() > entry.expiresAt) return null;

    return entry;
  }

  cleanup(): void {
    const now = Date.now();

    for (const [code, entry] of this.codes) {
      if (now > entry.expiresAt) this.codes.delete(code);
    }

    for (const [token, entry] of this.refreshTokens) {
      if (now > entry.expiresAt) this.refreshTokens.delete(token);
    }
  }
}
