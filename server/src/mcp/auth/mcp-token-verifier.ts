import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@mnm/db";
import { verifyLocalAgentJwt } from "../../agent-auth-jwt.js";
import { accessService } from "../../services/access.js";
import { permissionsForScopes, type McpScope, type PermissionSlug } from "@mnm/shared";
import type { McpActor } from "../registry/types.js";
import { getMcpJwtSecret, MCP_TOKEN_AUDIENCE } from "./mcp-auth-config.js";

export type { McpActor };

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function verifyHmac(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, claimsB64, signature] = parts;

  const signingInput = `${headerB64}.${claimsB64}`;
  const expectedSig = createHmac("sha256", secret).update(signingInput).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const claims = parseJson(base64UrlDecode(claimsB64));
  if (!claims) return null;

  // Check expiration
  const exp = typeof claims.exp === "number" ? claims.exp : null;
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return claims;
}

/** Decode JWT without verifying signature — only to read the `iss` claim. */
function decodeIssuer(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const claims = parseJson(base64UrlDecode(parts[1]));
  if (!claims) return null;
  return typeof claims.iss === "string" ? claims.iss : null;
}

// ── Verifier ────────────────────────────────────────────────────────────────

export async function verifyMcpToken(
  db: Db,
  authorizationHeader: string,
): Promise<Omit<McpActor, "mcpSessionId"> | null> {
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : authorizationHeader;

  if (!token) return null;

  const issuer = decodeIssuer(token);

  // ── OAuth token (iss = "mnm-oauth") ───────────────────────────────────
  if (issuer === "mnm-oauth") {
    let secret: string;
    try {
      secret = getMcpJwtSecret();
    } catch {
      return null;
    }

    const claims = verifyHmac(token, secret);
    if (!claims) return null;

    const aud = typeof claims.aud === "string" ? claims.aud : null;
    if (aud !== MCP_TOKEN_AUDIENCE) return null;

    const userId = typeof claims.sub === "string" ? claims.sub : null;
    const companyId = typeof claims.company_id === "string" ? claims.company_id : null;
    const scopeStr = typeof claims.scope === "string" ? claims.scope : "";
    if (!userId || !companyId) return null;

    const scopes = scopeStr.split(" ").filter(Boolean) as McpScope[];
    const scopePermissions = permissionsForScopes(scopes);

    // Intersect with user's actual role permissions
    const access = accessService(db);
    const userRole = await access.resolveRole(companyId, "user", userId);
    const userPermissions = userRole?.permissionSlugs ?? new Set<string>();

    const effectivePermissions = new Set<PermissionSlug>();
    for (const perm of scopePermissions) {
      if (userPermissions.has(perm)) effectivePermissions.add(perm);
    }

    const effectiveTags = await access.getTagIds(companyId, "user", userId);

    return {
      type: "user",
      userId,
      companyId,
      effectivePermissions,
      effectiveTags: [...effectiveTags],
    };
  }

  // ── Agent JWT (iss = "mnm-agent" or "mnm" legacy) ────────────────────
  if (issuer === "mnm-agent" || issuer === "mnm") {
    const agentClaims = verifyLocalAgentJwt(token);
    if (!agentClaims) return null;

    const agentId = agentClaims.sub;
    const companyId = agentClaims.company_id;
    const createdBy = agentClaims.created_by;

    const access = accessService(db);

    // Resolve agent permissions from DB (role + direct permissions)
    const agentRole = await access.resolveRole(companyId, "agent", agentId);
    const effectivePermissions = new Set<PermissionSlug>(
      [...(agentRole?.permissionSlugs ?? [])].filter(
        (s): s is PermissionSlug => true,
      ),
    );

    // Resolve tags: intersection of creator tags and agent tags
    const agentTags = await access.getTagIds(companyId, "agent", agentId);
    let effectiveTags: string[];

    if (createdBy) {
      const creatorTags = await access.getTagIds(companyId, "user", createdBy);
      effectiveTags = [];
      for (const tagId of agentTags) {
        if (creatorTags.has(tagId)) effectiveTags.push(tagId);
      }
    } else {
      effectiveTags = [...agentTags];
    }

    return {
      type: "agent",
      agentId,
      companyId,
      effectivePermissions,
      effectiveTags,
    };
  }

  return null;
}
