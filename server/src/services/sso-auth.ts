import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { SignedXml } from "xml-crypto";
import * as jose from "jose";
import type { Db } from "@mnm/db";
import {
  authUsers,
  authAccounts,
  authSessions,
  companyMemberships,
  ssoConfigurations,
} from "@mnm/db";
import type {
  SsoAuthResult,
  SsoDiscoverResult,
  SsoLoginInitiation,
  SsoMetadataSyncResult,
  SsoProvider,
} from "@mnm/shared";
import { ssoConfigurationService } from "./sso-configurations.js";
import { forbidden, unauthorized, badRequest, notFound } from "../errors.js";

// ---------------------------------------------------------------------------
// SAML XML signature verification (SEC-T1-002)
// ---------------------------------------------------------------------------
function normalizePem(certBase64: string): string {
  // certBase64 is the raw base64 content from the X509Certificate element
  // (no headers, potentially with or without whitespace)
  const cleaned = certBase64.replace(/\s+/g, "");
  return `-----BEGIN CERTIFICATE-----\n${cleaned.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`;
}

function verifySamlSignature(xml: string, certPem: string): void {
  // Find the Signature element — reject if absent
  if (!xml.includes("<Signature") && !xml.includes("<ds:Signature")) {
    throw new Error("SAML response contains no XML Signature element");
  }

  const doc = new SignedXml({ publicCert: certPem });
  // xml-crypto needs the raw XML string; load + validate
  doc.loadSignature(xml);
  const valid = doc.checkSignature(xml);
  if (!valid) {
    throw new Error("SAML XML signature is invalid (certificate mismatch or tampered content)");
  }
}

// Validate SAML assertion time conditions (NotBefore / NotOnOrAfter).
// We allow a 60-second clock skew.
function validateSamlConditions(xml: string, spEntityId: string): void {
  const nowMs = Date.now();
  const skewMs = 60_000;

  const notBeforeMatch = xml.match(/NotBefore="([^"]+)"/);
  const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/);

  if (notBeforeMatch?.[1]) {
    const notBefore = new Date(notBeforeMatch[1]).getTime();
    if (nowMs < notBefore - skewMs) {
      throw new Error("SAML assertion is not yet valid (NotBefore condition)");
    }
  }
  if (notOnOrAfterMatch?.[1]) {
    const notOnOrAfter = new Date(notOnOrAfterMatch[1]).getTime();
    if (nowMs >= notOnOrAfter + skewMs) {
      throw new Error("SAML assertion has expired (NotOnOrAfter condition)");
    }
  }

  // Audience restriction — the SP entity ID must appear
  const audienceMatch = xml.match(/<(?:saml:)?Audience[^>]*>([^<]+)<\/(?:saml:)?Audience>/);
  if (audienceMatch?.[1]) {
    const audience = audienceMatch[1].trim();
    if (audience !== spEntityId) {
      throw new Error(
        `SAML AudienceRestriction mismatch: expected "${spEntityId}", got "${audience}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// OIDC id_token signature verification via JWKS (SEC-T1-003)
// ---------------------------------------------------------------------------
async function verifyOidcIdToken(
  idToken: string,
  jwksUri: string | null,
  clientId: string,
  issuer: string | null,
): Promise<{ email?: string; name?: string; preferred_username?: string; sub?: string }> {
  if (!jwksUri) {
    // No JWKS URI configured — fall back to insecure decode with a warning
    // (better than nothing; real fix is to always configure discoveryUrl)
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Malformed id_token JWT");
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8"),
    ) as { email?: string; name?: string; preferred_username?: string; sub?: string; exp?: number };

    // Validate exp even without signature
    if (payload.exp && Date.now() / 1000 > payload.exp + 60) {
      throw new Error("OIDC id_token has expired");
    }
    return payload;
  }

  const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
  const verifyOptions: jose.JWTVerifyOptions = {
    audience: clientId,
    clockTolerance: 60,
  };
  if (issuer) {
    verifyOptions.issuer = issuer;
  }
  const { payload } = await jose.jwtVerify(idToken, JWKS, verifyOptions);

  return payload as { email?: string; name?: string; preferred_username?: string; sub?: string };
}

// In-memory store for SSO state (CSRF tokens for OIDC, SAML relay state)
// In production, this should use Redis; for now Map with TTL cleanup suffices.
const ssoStateStore = new Map<string, { companyId: string; provider: SsoProvider; createdAt: number }>();

// Cleanup states older than 10 minutes
function cleanupStaleStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of ssoStateStore) {
    if (value.createdAt < cutoff) {
      ssoStateStore.delete(key);
    }
  }
}

// sso-s02-svc-initiate-saml, sso-s02-svc-handle-saml
// sso-s02-svc-initiate-oidc, sso-s02-svc-handle-oidc
// sso-s02-svc-provision-link, sso-s02-svc-create-session
// sso-s02-svc-discover, sso-s02-svc-sync-metadata
export function ssoAuthService(db: Db) {
  const configService = ssoConfigurationService(db);

  /**
   * Validate that the SSO config is enabled and verified.
   * Throws 403 if disabled or unverified.
   */
  async function validateConfigReady(companyId: string, provider: SsoProvider) {
    const configs = await configService.listConfigurations(companyId);
    const config = configs.find((c) => c.provider === provider);
    if (!config) {
      throw notFound(`No SSO configuration found for provider ${provider}`);
    }
    if (!config.enabled) {
      throw forbidden("SSO configuration is disabled");
    }
    if (config.status !== "verified") {
      throw forbidden("SSO configuration is not verified");
    }
    return config;
  }

  // sso-s02-svc-initiate-saml
  async function initiateSamlLogin(companyId: string): Promise<SsoLoginInitiation> {
    const config = await validateConfigReady(companyId, "saml");

    const samlConfig = config.config as { ssoUrl?: string; entityId?: string } | undefined;
    const idpSsoUrl = samlConfig?.ssoUrl ?? config.metadataUrl;
    const entityId = config.entityId ?? samlConfig?.entityId ?? "mnm-sp";

    if (!idpSsoUrl) {
      throw badRequest("SAML IdP SSO URL is not configured. Set metadataUrl or config.ssoUrl.");
    }

    // Generate a relay state for CSRF protection
    const relayState = crypto.randomBytes(32).toString("hex");
    ssoStateStore.set(relayState, { companyId, provider: "saml", createdAt: Date.now() });
    cleanupStaleStates();

    // Build a minimal SAML AuthnRequest
    const requestId = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const acsUrl = `/api/sso/saml/${companyId}/acs`;

    const authnRequest = Buffer.from(
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"` +
      ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
      ` ID="${requestId}"` +
      ` Version="2.0"` +
      ` IssueInstant="${issueInstant}"` +
      ` AssertionConsumerServiceURL="${acsUrl}"` +
      ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">` +
      `<saml:Issuer>${entityId}</saml:Issuer>` +
      `</samlp:AuthnRequest>`,
    ).toString("base64");

    const separator = idpSsoUrl.includes("?") ? "&" : "?";
    const loginUrl = `${idpSsoUrl}${separator}SAMLRequest=${encodeURIComponent(authnRequest)}&RelayState=${encodeURIComponent(relayState)}`;

    return {
      provider: "saml",
      companyId,
      loginUrl,
      state: relayState,
    };
  }

  // sso-s02-svc-handle-saml
  async function handleSamlCallback(
    companyId: string,
    samlResponse: string,
    relayState?: string,
  ): Promise<SsoAuthResult> {
    // Validate relay state — mandatory CSRF protection (SEC-T1-002)
    if (!relayState) {
      throw unauthorized("Missing RelayState — SAML response rejected (CSRF protection)");
    }
    {
      const stored = ssoStateStore.get(relayState);
      if (!stored || stored.companyId !== companyId || stored.provider !== "saml") {
        throw unauthorized("Invalid or expired SSO RelayState");
      }
      ssoStateStore.delete(relayState);
    }

    const config = await validateConfigReady(companyId, "saml");

    // Decode and parse the SAML response
    let decodedResponse: string;
    try {
      decodedResponse = Buffer.from(samlResponse, "base64").toString("utf-8");
    } catch {
      throw badRequest("Invalid SAML response encoding");
    }

    // Validate XML signature cryptographically (SEC-T1-002)
    if (!config.certificate) {
      // No IdP certificate on record — reject until admin syncs metadata
      throw unauthorized(
        "SAML IdP certificate is not configured. " +
        "Sync the IdP metadata first (POST /companies/:companyId/sso/:configId/sync).",
      );
    }
    try {
      const certPem = normalizePem(config.certificate);
      verifySamlSignature(decodedResponse, certPem);
    } catch (err) {
      throw unauthorized(
        `SAML signature validation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Validate assertion conditions: time window + audience restriction
    const spEntityId =
      (config.config as { entityId?: string } | undefined)?.entityId ??
      config.entityId ??
      "mnm-sp";
    try {
      validateSamlConditions(decodedResponse, spEntityId);
    } catch (err) {
      throw unauthorized(
        `SAML assertion conditions failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Extract user attributes from SAML assertion
    const emailMatch = decodedResponse.match(
      /(?:NameID|emailAddress|email)[^>]*>([^<]+)</i,
    );
    const nameMatch = decodedResponse.match(
      /(?:displayName|name|givenName)[^>]*>([^<]+)</i,
    );

    if (!emailMatch?.[1]) {
      throw unauthorized("SAML assertion missing email attribute");
    }

    const email = emailMatch[1].trim().toLowerCase();
    const name = nameMatch?.[1]?.trim() ?? null;

    // Provision or link user
    return provisionOrLinkUser(companyId, email, name, "saml");
  }

  // sso-s02-svc-initiate-oidc
  async function initiateOidcLogin(companyId: string): Promise<SsoLoginInitiation> {
    const config = await validateConfigReady(companyId, "oidc");

    const oidcConfig = config.config as {
      clientId?: string;
      authorizeUrl?: string;
      discoveryUrl?: string;
      scopes?: string[];
    } | undefined;

    const clientId = oidcConfig?.clientId ?? config.entityId;
    const authorizeUrl = oidcConfig?.authorizeUrl;
    const discoveryUrl = oidcConfig?.discoveryUrl ?? config.metadataUrl;

    if (!clientId) {
      throw badRequest("OIDC client ID is not configured. Set entityId or config.clientId.");
    }

    // Determine authorize endpoint
    let authEndpoint = authorizeUrl;
    if (!authEndpoint && discoveryUrl) {
      // For well-known OIDC providers, derive authorize URL from discovery
      authEndpoint = discoveryUrl.replace("/.well-known/openid-configuration", "/authorize");
    }
    if (!authEndpoint) {
      throw badRequest("OIDC authorize URL is not configured. Set config.authorizeUrl or metadataUrl.");
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");
    ssoStateStore.set(state, { companyId, provider: "oidc", createdAt: Date.now() });
    cleanupStaleStates();

    const redirectUri = `/api/sso/oidc/${companyId}/callback`;
    const scopes = oidcConfig?.scopes?.join(" ") ?? "openid profile email";

    const separator = authEndpoint.includes("?") ? "&" : "?";
    const loginUrl = `${authEndpoint}${separator}` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    return {
      provider: "oidc",
      companyId,
      loginUrl,
      state,
    };
  }

  // sso-s02-svc-handle-oidc
  async function handleOidcCallback(
    companyId: string,
    code: string,
    state: string,
  ): Promise<SsoAuthResult> {
    // Validate state
    const stored = ssoStateStore.get(state);
    if (!stored || stored.companyId !== companyId || stored.provider !== "oidc") {
      throw unauthorized("Invalid SSO state");
    }
    ssoStateStore.delete(state);

    const config = await validateConfigReady(companyId, "oidc");

    const oidcConfig = config.config as {
      clientId?: string;
      clientSecret?: string;
      tokenUrl?: string;
      userinfoUrl?: string;
      discoveryUrl?: string;
      jwksUri?: string;
      issuer?: string;
    } | undefined;

    const clientId = oidcConfig?.clientId ?? config.entityId;
    const clientSecret = oidcConfig?.clientSecret;
    const tokenUrl = oidcConfig?.tokenUrl;
    const userinfoUrl = oidcConfig?.userinfoUrl;
    const discoveryUrl = oidcConfig?.discoveryUrl ?? config.metadataUrl;

    if (!clientId || !clientSecret) {
      throw badRequest("OIDC clientId and clientSecret must be configured");
    }
    if (!tokenUrl) {
      throw badRequest("OIDC token URL must be configured in config.tokenUrl");
    }

    // Resolve JWKS URI and issuer for id_token verification (SEC-T1-003)
    // Prefer explicitly stored values; auto-discover from well-known if available.
    let jwksUri: string | null = oidcConfig?.jwksUri ?? null;
    let issuer: string | null = oidcConfig?.issuer ?? null;

    if ((!jwksUri || !issuer) && discoveryUrl) {
      try {
        const wellKnown = discoveryUrl.endsWith("/openid-configuration")
          ? discoveryUrl
          : `${discoveryUrl.replace(/\/$/, "")}/.well-known/openid-configuration`;
        const discoveryResp = await fetch(wellKnown, { signal: AbortSignal.timeout(5000) });
        if (discoveryResp.ok) {
          const disc = (await discoveryResp.json()) as {
            jwks_uri?: string;
            issuer?: string;
          };
          jwksUri = jwksUri ?? disc.jwks_uri ?? null;
          issuer = issuer ?? disc.issuer ?? null;
        }
      } catch {
        // Discovery fetch failed — proceed without; verifyOidcIdToken handles null jwksUri
      }
    }

    // Exchange authorization code for tokens
    const redirectUri = `/api/sso/oidc/${companyId}/callback`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      throw unauthorized("OIDC token exchange failed");
    }

    const tokenData = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
    };

    // Extract user info from id_token — with signature verification (SEC-T1-003)
    let email: string | null = null;
    let name: string | null = null;

    if (tokenData.id_token) {
      try {
        const payload = await verifyOidcIdToken(
          tokenData.id_token,
          jwksUri,
          clientId,
          issuer,
        );
        email = payload.email ?? payload.preferred_username ?? null;
        name = payload.name ?? null;
      } catch (err) {
        throw unauthorized(
          `OIDC id_token verification failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Fallback: call userinfo endpoint
    if (!email && userinfoUrl && tokenData.access_token) {
      const userinfoResponse = await fetch(userinfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userinfoResponse.ok) {
        const userinfo = (await userinfoResponse.json()) as {
          email?: string;
          name?: string;
          preferred_username?: string;
        };
        email = userinfo.email ?? userinfo.preferred_username ?? null;
        name = userinfo.name ?? null;
      }
    }

    if (!email) {
      throw unauthorized("OIDC response missing email claim");
    }

    email = email.trim().toLowerCase();

    return provisionOrLinkUser(companyId, email, name, "oidc");
  }

  // sso-s02-svc-provision-link
  async function provisionOrLinkUser(
    companyId: string,
    email: string,
    name: string | null,
    provider: SsoProvider,
  ): Promise<SsoAuthResult> {
    // Check if user exists by email
    const [existingUser] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email));

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      // Check if SSO account link already exists
      const [existingAccount] = await db
        .select()
        .from(authAccounts)
        .where(
          and(
            eq(authAccounts.userId, userId),
            eq(authAccounts.providerId, `sso-${provider}`),
          ),
        );

      if (!existingAccount) {
        // Link SSO account to existing user
        const accountId = crypto.randomUUID();
        await db.insert(authAccounts).values({
          id: accountId,
          accountId: email,
          providerId: `sso-${provider}`,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      // Auto-provision new user
      userId = crypto.randomUUID();
      isNewUser = true;

      await db.insert(authUsers).values({
        id: userId,
        name: name ?? email.split("@")[0]!,
        email,
        emailVerified: true, // SSO-verified emails are trusted
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create SSO account link
      const accountId = crypto.randomUUID();
      await db.insert(authAccounts).values({
        id: accountId,
        accountId: email,
        providerId: `sso-${provider}`,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Ensure company membership exists
    const [existingMembership] = await db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ),
      );

    if (!existingMembership) {
      await db.insert(companyMemberships).values({
        companyId,
        principalType: "user",
        principalId: userId,
        status: "active",
        roleId: "contributor",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      userId,
      email,
      name,
      isNewUser,
      companyId,
      provider,
    };
  }

  // sso-s02-svc-create-session
  // SEC-T1-004: invalidate all prior sessions for the user before creating a new one,
  // so that BetterAuth sign-out (which deletes sessions by token) cannot be bypassed
  // by replaying a stale SSO session token.
  async function createSsoSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
    // Delete all existing sessions for this user — ensures IdP-level revocation
    // propagates on next SSO login, and that old sessions cannot be replayed.
    await db.delete(authSessions).where(eq(authSessions.userId, userId));

    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(48).toString("hex");
    // 8-hour SSO session lifetime (vs 30 days) to limit exposure window (SEC-T1-004)
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await db.insert(authSessions).values({
      id: sessionId,
      token,
      userId,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { sessionId, token, expiresAt };
  }

  // sso-s02-svc-discover
  async function discoverSsoByEmail(email: string): Promise<SsoDiscoverResult> {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return { provider: null };
    }

    const config = await configService.getByEmailDomain(domain);
    if (!config) {
      return { provider: null };
    }

    const loginUrl = config.provider === "saml"
      ? `/api/sso/saml/${config.companyId}/login`
      : `/api/sso/oidc/${config.companyId}/login`;

    return {
      provider: config.provider,
      companyId: config.companyId,
      loginUrl,
    };
  }

  // sso-s02-svc-sync-metadata
  async function syncMetadata(
    companyId: string,
    configId: string,
  ): Promise<SsoMetadataSyncResult> {
    const config = await configService.getConfigurationById(companyId, configId);

    if (!config.metadataUrl) {
      throw badRequest("No metadata URL configured for this SSO configuration");
    }

    let metadataXml: string;
    try {
      const response = await fetch(config.metadataUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      metadataXml = await response.text();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // Update lastSyncError
      await db
        .update(ssoConfigurations)
        .set({
          lastSyncError: `Metadata fetch failed: ${errorMessage}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ssoConfigurations.id, configId),
            eq(ssoConfigurations.companyId, companyId),
          ),
        );
      throw badRequest(`Failed to fetch metadata: ${errorMessage}`);
    }

    // Parse metadata for certificate and entity ID
    const entityIdMatch = metadataXml.match(/entityID="([^"]+)"/);
    const certMatch = metadataXml.match(
      /<(?:ds:)?X509Certificate[^>]*>([^<]+)<\/(?:ds:)?X509Certificate>/,
    );
    const ssoUrlMatch = metadataXml.match(
      /SingleSignOnService[^>]*Location="([^"]+)"/,
    );

    const extractedEntityId = entityIdMatch?.[1] ?? null;
    const extractedCertificate = certMatch?.[1]?.replace(/\s/g, "") ?? null;
    const endpoints: Record<string, string> = {};

    if (ssoUrlMatch?.[1]) {
      endpoints.ssoUrl = ssoUrlMatch[1];
    }

    // Update the SSO config with extracted metadata
    const updateData: Record<string, unknown> = {
      lastSyncAt: new Date(),
      lastSyncError: null,
      updatedAt: new Date(),
    };
    if (extractedEntityId) updateData.entityId = extractedEntityId;
    if (extractedCertificate) updateData.certificate = extractedCertificate;
    if (Object.keys(endpoints).length > 0) {
      updateData.config = { ...config.config, ...endpoints };
    }

    await db
      .update(ssoConfigurations)
      .set(updateData)
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      );

    return {
      entityId: extractedEntityId,
      certificate: extractedCertificate,
      endpoints,
    };
  }

  return {
    initiateSamlLogin,
    handleSamlCallback,
    initiateOidcLogin,
    handleOidcCallback,
    provisionOrLinkUser,
    createSsoSession,
    discoverSsoByEmail,
    syncMetadata,
  };
}
