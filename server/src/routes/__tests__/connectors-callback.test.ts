import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { generateKeyPairSync } from "node:crypto";
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

// ─── MEDIUM-3 — GitHub App install callback HTTP integration tests ────────────
//
// Mirrors the OAuth callback test patterns above. Covers the new endpoint
// `GET /api/connectors/github/app-install/callback` added in Phase 1 §step 5
// (server/src/routes/connectors-callback.ts:275-372). The handler does:
//   1. parse `installation_id`, `setup_action`, `state`  (400 on missing)
//   2. verify state JWT                                     (400 on invalid)
//   3. assertUserInCompany inside tx                        (rejects + redirect on failure)
//   4. getConnectorById                                     (idem)
//   5. getGitHubAppByConnector                              (no-op + safe redirect when null)
//   6. upsertInstallationFromCallback (calls GitHub API)    (redirect to error param on throw)
//   7. publishLiveEvent + recordAudit
//   8. redirect to /admin/connectors/:id?focus=app-installations

const GITHUB_API_BASE = "https://api.github.com";

let TEST_PRIVATE_KEY_PEM = "";
beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  TEST_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
});

interface GhMockDbConfig {
  membership?: unknown[];
  connector?: unknown[];
  /** List of github_apps rows returned to consecutive selects on that table. */
  githubApps?: unknown[];
}

/**
 * GitHub App install callback uses 4 selects in order :
 *   1. company_membership (assertUserInCompany)
 *   2. oauth_connectors   (getConnectorById)
 *   3. github_apps        (getGitHubAppByConnector)
 *   4. github_apps        (upsertInstallationFromCallback inner select; only
 *      reached when row 3 is non-null)
 */
function buildGhMockDb(cfg: GhMockDbConfig) {
  const membership = cfg.membership ?? [{ id: "membership-1" }];
  const connector = cfg.connector ?? [
    {
      id: "connector-gh-1",
      companyId: VALID_COMPANY_UUID,
      type: "oauth2",
      enabled: true,
      providerSlug: "github",
    },
  ];
  const githubApps = cfg.githubApps ?? [];

  let selectCallCount = 0;
  const selectImpl = vi.fn(() => {
    const callIdx = selectCallCount++;
    const rows =
      callIdx === 0
        ? membership
        : callIdx === 1
          ? connector
          : githubApps;
    const promise = Promise.resolve(rows);
    const whereResult: { limit: () => Promise<unknown[]> } & Promise<unknown[]> =
      Object.assign(promise, { limit: () => Promise.resolve(rows) });
    return {
      from: () => ({ where: () => whereResult }),
    };
  });

  const insertSpy = vi.fn(() => ({
    values: () => ({
      returning: () => Promise.resolve([{ id: "row-1" }]),
      onConflictDoUpdate: () => Promise.resolve(),
    }),
  }));

  const tx = {
    execute: vi.fn(async () => []),
    select: selectImpl,
    insert: insertSpy,
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    delete: vi.fn(() => ({ where: () => Promise.resolve() })),
  };
  const db = {
    execute: vi.fn(async () => []),
    select: selectImpl,
    insert: insertSpy,
    update: tx.update,
    delete: tx.delete,
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  };
  return { db, insertSpy, selectImpl };
}

function ghAppRow(overrides: Record<string, unknown> = {}) {
  const enc = encryptSecret(TEST_PRIVATE_KEY_PEM);
  return {
    id: "gh-app-row-1",
    companyId: VALID_COMPANY_UUID,
    connectorId: "connector-gh-1",
    appId: "12345",
    appSlug: "mnm-app",
    privateKeyIv: enc.iv,
    privateKeyCiphertext: enc.ciphertext,
    privateKeyTag: enc.tag,
    createdAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

describe("GET /api/connectors/github/app-install/callback — MEDIUM-3 (5 cases)", () => {
  let app: express.Express;

  function mountWith(db: unknown) {
    app = express();
    app.use(connectorsCallbackRoutes(db as Parameters<typeof connectorsCallbackRoutes>[0], { publicUrl: PUBLIC_URL }));
  }

  it("[1] missing installation_id → 400", async () => {
    mountWith(buildGhMockDb({}).db);
    const res = await request(app).get(
      "/api/connectors/github/app-install/callback?setup_action=install",
    );
    expect(res.status).toBe(400);
    expect(res.text).toContain("Missing installation_id");
  });

  it("[2] missing state → 400", async () => {
    mountWith(buildGhMockDb({}).db);
    const res = await request(app).get(
      "/api/connectors/github/app-install/callback?installation_id=999",
    );
    expect(res.status).toBe(400);
    expect(res.text).toContain("Missing state");
  });

  it("[3] invalid state JWT → 400", async () => {
    mountWith(buildGhMockDb({}).db);
    const res = await request(app).get(
      "/api/connectors/github/app-install/callback?installation_id=999&state=not.a.valid.jwt",
    );
    expect(res.status).toBe(400);
    expect(res.text).toContain("Invalid or expired state");
  });

  it("[4] happy path → 302 redirect to /admin/connectors/:id?focus=app-installations", async () => {
    // GitHub /app/installations/:id returns the install metadata.
    mswServer.use(
      http.get(`${GITHUB_API_BASE}/app/installations/:installationId`, () =>
        HttpResponse.json({
          id: 999,
          account: { login: "acme", type: "Organization", id: 42 },
          repository_selection: "all",
          suspended_at: null,
        }),
      ),
    );
    const mocks = buildGhMockDb({ githubApps: [ghAppRow()] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: "connector-gh-1",
      userId: "user-1",
    });
    const res = await request(app).get(
      `/api/connectors/github/app-install/callback?installation_id=999&setup_action=install&state=${state}`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/admin/connectors/connector-gh-1?focus=app-installations`,
    );
  });

  it("[5] GitHub API throws → redirect with INSTALL_CALLBACK_FAILED (no crash)", async () => {
    // /app/installations/:id returns 500 → upsertInstallationFromCallback
    // throws GitHubAppError; the handler must catch + redirect with the
    // error param instead of crashing.
    mswServer.use(
      http.get(`${GITHUB_API_BASE}/app/installations/:installationId`, () =>
        new HttpResponse("github crashed", { status: 500 }),
      ),
    );
    const mocks = buildGhMockDb({ githubApps: [ghAppRow()] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: "connector-gh-1",
      userId: "user-1",
    });
    const res = await request(app).get(
      `/api/connectors/github/app-install/callback?installation_id=999&setup_action=install&state=${state}`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/admin/connectors/connector-gh-1?error=INSTALL_CALLBACK_FAILED`,
    );
  });

  it("[6] no matching App row → graceful redirect (no error param)", async () => {
    // getGitHubAppByConnector returns null → the tx body returns early (no
    // throw, no upsert), and the handler still redirects to the success URL.
    const mocks = buildGhMockDb({ githubApps: [] });
    mountWith(mocks.db);

    const state = await signConnectorState({
      companyId: VALID_COMPANY_UUID,
      connectorId: "connector-gh-1",
      userId: "user-1",
    });
    const res = await request(app).get(
      `/api/connectors/github/app-install/callback?installation_id=999&setup_action=install&state=${state}`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${PUBLIC_URL}/admin/connectors/connector-gh-1?focus=app-installations`,
    );
  });
});
