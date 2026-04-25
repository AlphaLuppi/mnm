import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import { setupTestDb, teardownTestDb } from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import { companyMemberships, oauthClients } from "@mnm/db";
import { createMcpOAuthRouter } from "../mcp-oauth-router.js";
import type { BetterAuthSessionResult } from "../../../auth/better-auth.js";

/**
 * T7 DEF-9 — Multi-tenant MCP OAuth authorize MUST NOT silently bind a
 * multi-company user to whichever membership the DB returns first.
 *
 * Coverage:
 *   1. Multi-company user, no company_id  -> 400 invalid_request + available_companies
 *   2. Multi-company user, valid company_id -> 302 redirect (authorize success)
 *   3. Multi-company user, non-member company_id -> 403 access_denied
 *   4. Single-company user, no company_id -> 302 redirect (backward-compat)
 */
describe("MCP OAuth multi-company enforcement (DEF-9)", () => {
  let db: Db;
  let app: express.Express;

  // Randomize per-run to isolate from residual rows left by previous test
  // executions sharing the singleton test DB (teardownTestDb is a no-op).
  const runSuffix = Math.random().toString(36).slice(2, 8);
  const userMultiCo = `user-multi-${runSuffix}`;
  const userSingleCo = `user-single-${runSuffix}`;
  let companyA: string;
  let companyB: string;
  let clientId: string;
  let redirectUri: string;

  // The current authenticated user for the next request — flipped per test.
  let currentUserId: string | null = null;

  function buildApp(): express.Express {
    const a = express();
    const resolveSession = async (): Promise<BetterAuthSessionResult | null> => {
      if (!currentUserId) return null;
      return {
        session: { id: `sess-${currentUserId}`, userId: currentUserId },
        user: { id: currentUserId, email: `${currentUserId}@test.local`, name: currentUserId },
      };
    };
    a.use(createMcpOAuthRouter({
      db,
      resolveSession,
    }));
    return a;
  }

  beforeAll(async () => {
    db = await setupTestDb();

    // Seed two companies with unique issue_prefixes to avoid colliding with
    // other suites sharing the singleton test DB.
    companyA = crypto.randomUUID();
    companyB = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    await db.execute(sql`
      INSERT INTO companies (id, name, issue_prefix)
      VALUES
        (${companyA}, ${"DEF9A-" + suffix}, ${"DEF9A" + suffix}),
        (${companyB}, ${"DEF9B-" + suffix}, ${"DEF9B" + suffix})
      ON CONFLICT (id) DO NOTHING
    `);

    // userMultiCo: active memberships in companyA + companyB.
    // userSingleCo: active membership only in companyA.
    await db.insert(companyMemberships).values([
      { companyId: companyA, principalType: "user", principalId: userMultiCo, status: "active" },
      { companyId: companyB, principalType: "user", principalId: userMultiCo, status: "active" },
      { companyId: companyA, principalType: "user", principalId: userSingleCo, status: "active" },
    ]);

    // Register a minimal OAuth client directly (bypasses the registration
    // rate limiter and gives us deterministic client_id + redirect_uri).
    redirectUri = "http://localhost:9999/callback";
    const [row] = await db
      .insert(oauthClients)
      .values({
        clientName: "def9-test-client",
        redirectUris: [redirectUri],
        grantTypes: ["authorization_code", "refresh_token"],
      })
      .returning();
    clientId = row!.clientId;

    app = buildApp();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(() => {
    currentUserId = null;
  });

  function authorizeQuery(extra: Record<string, string> = {}): string {
    // A dummy code_challenge is sufficient for the GET authorize endpoint —
    // PKCE is only verified at the token exchange step, not here.
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: "dummy-challenge",
      code_challenge_method: "S256",
      state: "xyz",
      ...extra,
    });
    return params.toString();
  }

  it("rejects authorize when multi-company user provides no company_id", async () => {
    currentUserId = userMultiCo;
    const res = await request(app).get(`/oauth/authorize?${authorizeQuery()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
    expect(String(res.body.error_description)).toMatch(/company_id/);
    expect(Array.isArray(res.body.available_companies)).toBe(true);
    expect(res.body.available_companies).toEqual(
      expect.arrayContaining([companyA, companyB]),
    );
    expect(res.body.available_companies).toHaveLength(2);
  });

  it("accepts authorize when multi-company user provides valid company_id", async () => {
    currentUserId = userMultiCo;
    const res = await request(app).get(
      `/oauth/authorize?${authorizeQuery({ company_id: companyA })}`,
    );

    // Success path redirects the browser to the SPA consent page.
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/oauth-consent\?/);
  });

  it("rejects authorize when multi-company user provides non-member company_id", async () => {
    currentUserId = userMultiCo;
    const otherCompanyId = crypto.randomUUID();
    const res = await request(app).get(
      `/oauth/authorize?${authorizeQuery({ company_id: otherCompanyId })}`,
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("access_denied");
    expect(String(res.body.error_description)).toMatch(otherCompanyId);
  });

  it("single-company user succeeds without company_id (backward-compat)", async () => {
    currentUserId = userSingleCo;
    const res = await request(app).get(`/oauth/authorize?${authorizeQuery()}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/oauth-consent\?/);
  });
});
