import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { connectorsCallbackRoutes } from "../connectors-callback.js";
import { signConnectorState } from "../../services/connectors.js";
import { encryptSecret } from "../../services/secret-crypto.js";

// ─── HIGH-Q2 — connectors-callback msw + supertest tests (7 cases) ────────────
//
// We mock:
//   • the upstream OAuth provider's /token endpoint via msw
//   • the Drizzle Db with controlled select / insert / transaction chains
// and drive the callback through real express + supertest.

const PUBLIC_URL = "https://app.test";
const VALID_COMPANY_UUID = "00000000-0000-0000-0000-000000000aaa";
const PROVIDER_TOKEN_URL = "https://provider.example/token";

const mswServer = setupServer();

interface MockDbConfig {
  membership?: unknown[];
  connector?: unknown[];
  upsertSpy?: ReturnType<typeof vi.fn>;
  auditSpy?: ReturnType<typeof vi.fn>;
}

/**
 * A Drizzle-shaped mock that runs the callback's tx body. Because the
 * callback wraps everything in `db.transaction(async (tx) => ...)`, we
 * delegate every chain on the outer `db` to the same shape returned to the
 * tx callback.
 *
 * Inside the tx the service issues, in order:
 *   1. `tx.execute(...)`                                         — set_config
 *   2. `tx.select().from().where().limit()`                       — assertUserInCompany
 *   3. `tx.select().from().where()` for connector                 — getConnectorById
 *   4. `tx.insert(connector_tokens).values(...).onConflictDoUpdate({...}).returning()`
 *   5. `tx.insert(oauth_connectors_audit).values(...)` × 1..2
 */
function buildMockDb(cfg: MockDbConfig) {
  const membership = cfg.membership ?? [{ id: "membership-1" }];
  const connector = cfg.connector ?? [];

  let selectCallCount = 0;
  const selectImpl = vi.fn(() => {
    const callIdx = selectCallCount++;
    const rows = callIdx === 0 ? membership : connector;
    const promise = Promise.resolve(rows);
    const whereResult: { limit: () => Promise<unknown[]> } & Promise<unknown[]> =
      Object.assign(promise, { limit: () => Promise.resolve(rows) });
    return {
      from: () => ({ where: () => whereResult }),
    };
  });

  const upsertSpy =
    cfg.upsertSpy ??
    vi.fn(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([{ id: "token-1" }]),
        }),
      }),
    }));

  const auditSpy =
    cfg.auditSpy ??
    vi.fn(() => ({
      values: () => Promise.resolve(),
    }));

  // We dispatch insert by counting calls: 1st is the connector_tokens upsert,
  // following ones are oauth_connectors_audit inserts.
  let insertCallCount = 0;
  const insertImpl = vi.fn((..._args: unknown[]) => {
    const idx = insertCallCount++;
    return idx === 0 ? upsertSpy(_args) : auditSpy(_args);
  });

  const tx = {
    execute: vi.fn(async () => []),
    select: selectImpl,
    insert: insertImpl,
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    delete: vi.fn(() => ({ where: () => Promise.resolve() })),
  };

  const db = {
    execute: vi.fn(async () => []),
    select: selectImpl,
    insert: insertImpl,
    update: tx.update,
    delete: tx.delete,
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  };

  return { db, upsertSpy, auditSpy, selectImpl, insertImpl };
}

function buildOauth2Connector(overrides: Record<string, unknown> = {}) {
  const clientSecretEnc = encryptSecret("client-secret-shh");
  return {
    id: "connector-1",
    companyId: VALID_COMPANY_UUID,
    type: "oauth2",
    enabled: true,
    providerSlug: "jira",
    tokenUrl: PROVIDER_TOKEN_URL,
    clientId: "jira-client-id",
    clientSecretIv: clientSecretEnc.iv,
    clientSecretCiphertext: clientSecretEnc.ciphertext,
    clientSecretTag: clientSecretEnc.tag,
    redirectUri: `${PUBLIC_URL}/api/connectors/callback`,
    scopes: ["read", "write"],
    ...overrides,
  };
}

beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe("connectors-callback — HIGH-Q2 msw + supertest (7 cases)", () => {
  let app: express.Express;
  let mocks: ReturnType<typeof buildMockDb>;

  function mountWith(db: unknown) {
    app = express();
    app.use(connectorsCallbackRoutes(db as Parameters<typeof connectorsCallbackRoutes>[0], { publicUrl: PUBLIC_URL }));
  }

  beforeEach(() => {
    mocks = buildMockDb({});
    mountWith(mocks.db);
  });

  it("[1] missing code or state → 400", async () => {
    const res = await request(app).get("/api/connectors/callback?code=abc");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Missing code or state");
  });

  it("[2] invalid state JWT → 400", async () => {
    const res = await request(app).get(
      "/api/connectors/callback?code=abc&state=not.a.valid.jwt",
    );
    expect(res.status).toBe(400);
    expect(res.text).toContain("Invalid or expired state");
  });

  it("[3] provider error in query → redirect with error param", async () => {
    const res = await request(app).get(
      "/api/connectors/callback?error=access_denied&error_description=user_refused",
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/settings/accounts?error=access_denied`,
    );
  });

  it("[4] HIGH-A1 — user not in company (TOCTOU) → redirect USER_NOT_IN_COMPANY", async () => {
    mocks = buildMockDb({ membership: [] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: "connector-1",
      userId: "user-orphan",
    });
    const res = await request(app).get(`/api/connectors/callback?code=AUTHCODE&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/settings/accounts?error=USER_NOT_IN_COMPANY`,
    );
    // Critically: no upsert reached.
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("[5] connector disabled → redirect CONNECTOR_NOT_AVAILABLE", async () => {
    const disabled = buildOauth2Connector({ enabled: false });
    mocks = buildMockDb({ connector: [disabled] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: disabled.id,
      userId: "user-1",
    });
    const res = await request(app).get(`/api/connectors/callback?code=AUTHCODE&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/settings/accounts?error=CONNECTOR_NOT_AVAILABLE`,
    );
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("[6] provider /token returns 500 → redirect TOKEN_EXCHANGE_FAILED", async () => {
    mswServer.use(
      http.post(PROVIDER_TOKEN_URL, () =>
        new HttpResponse("provider crashed", { status: 500 }),
      ),
    );
    const connector = buildOauth2Connector();
    mocks = buildMockDb({ connector: [connector] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: connector.id,
      userId: "user-1",
    });
    const res = await request(app).get(`/api/connectors/callback?code=AUTHCODE&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/settings/accounts?error=TOKEN_EXCHANGE_FAILED`,
    );
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("[7] happy path — provider returns access_token → upsert + redirect connected=", async () => {
    mswServer.use(
      http.post(PROVIDER_TOKEN_URL, async () =>
        HttpResponse.json({
          access_token: "AT_xyz",
          refresh_token: "RT_xyz",
          expires_in: 3600,
          scope: "read write",
        }),
      ),
    );
    const connector = buildOauth2Connector();
    mocks = buildMockDb({ connector: [connector] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: connector.id,
      userId: "user-1",
    });
    const res = await request(app).get(`/api/connectors/callback?code=AUTHCODE&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/settings/accounts?connected=jira`);
    expect(mocks.upsertSpy).toHaveBeenCalledTimes(1);
  });
});
