import { describe, it, expect, vi } from "vitest";
import { connectorService } from "../connectors.js";
import { encryptSecret } from "../secret-crypto.js";

/**
 * T5 — tests for the new service helpers:
 *   - listConnectorsWithStatusForUser
 *   - getUserConnectorStatus
 *   - signAuthorizeUrl
 *   - listConnectorAudit
 *
 * Mocks Drizzle's chainable APIs at the call-count granularity needed by each
 * scenario. Because `listConnectorsWithStatusForUser` issues 1 select for the
 * connector list + N selects (one per connector) for tokens / api_keys, the
 * mock is built around a queue of expected `select` results.
 */

const VALID_COMPANY_UUID = "00000000-0000-0000-0000-00000000000A";

interface QueueRows {
  rows: unknown[];
}

function buildSelectQueue(queue: QueueRows[]) {
  let i = 0;
  return vi.fn(() => {
    const entry = queue[i++] ?? { rows: [] };
    const promise = Promise.resolve(entry.rows);
    const whereResult = Object.assign(promise, {
      limit: () => Promise.resolve(entry.rows),
      orderBy: () => Object.assign(Promise.resolve(entry.rows), {
        limit: () => Promise.resolve(entry.rows),
      }),
    });
    return {
      from: () => ({ where: () => whereResult }),
    };
  });
}

function buildBaseDb(selectImpl: ReturnType<typeof vi.fn>) {
  return {
    execute: vi.fn(async () => []),
    select: selectImpl,
    insert: vi.fn(),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    delete: vi.fn(),
    transaction: vi.fn(),
  } as unknown as Parameters<typeof connectorService>[0];
}

describe("connectors — listConnectorsWithStatusForUser (T5 status projection)", () => {
  it("api_key connector → status='connected' when row exists", async () => {
    const enc = encryptSecret("sk-secret");
    const apiKeyRow = {
      id: "k1",
      keyIv: enc.iv,
      keyCiphertext: enc.ciphertext,
      keyTag: enc.tag,
      lastUsedAt: new Date("2026-04-01"),
    };
    const db = buildBaseDb(
      buildSelectQueue([
        // listConnectors → 1 connector row (api_key)
        {
          rows: [
            {
              id: "c-openai",
              providerSlug: "openai",
              displayName: "OpenAI",
              type: "api_key",
              enabled: true,
              scopes: [],
              clientId: null,
              clientSecretConfigured: false,
              apiKeyLabel: "OPENAI_API_KEY",
              refreshSupported: false,
              authorizationUrl: null,
              tokenUrl: null,
              userinfoUrl: null,
              redirectUri: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        // getUserApiKey → return the key row
        { rows: [apiKeyRow] },
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("connected");
    expect(list[0].providerSlug).toBe("openai");
    expect(list[0].lastUsedAt).toEqual(new Date("2026-04-01"));
  });

  it("api_key connector → status='disconnected' when no row", async () => {
    const db = buildBaseDb(
      buildSelectQueue([
        {
          rows: [
            {
              id: "c-openai",
              providerSlug: "openai",
              displayName: "OpenAI",
              type: "api_key",
              enabled: true,
              scopes: [],
              clientId: null,
              clientSecretConfigured: false,
              apiKeyLabel: "OPENAI_API_KEY",
              refreshSupported: false,
              authorizationUrl: null,
              tokenUrl: null,
              userinfoUrl: null,
              redirectUri: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        { rows: [] }, // getUserApiKey empty
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    expect(list[0].status).toBe("disconnected");
    expect(list[0].scopesGranted).toEqual([]);
    expect(list[0].expiresAt).toBeNull();
  });

  it("oauth2 connector with valid future expiresAt → status='connected'", async () => {
    const tokenRow = {
      id: "t1",
      expiresAt: new Date(Date.now() + 60_000),
      refreshTokenIv: "iv",
      refreshTokenCiphertext: "ct",
      refreshTokenTag: "tag",
      scopesGranted: ["read"],
      lastUsedAt: null,
    };
    const db = buildBaseDb(
      buildSelectQueue([
        {
          rows: [
            {
              id: "c-jira",
              providerSlug: "jira",
              displayName: "Jira",
              type: "oauth2",
              enabled: true,
              scopes: ["read"],
              clientId: "cid",
              clientSecretConfigured: true,
              apiKeyLabel: null,
              refreshSupported: true,
              authorizationUrl: "https://a.test/auth",
              tokenUrl: "https://a.test/token",
              userinfoUrl: null,
              redirectUri: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        { rows: [tokenRow] },
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    expect(list[0].status).toBe("connected");
    expect(list[0].scopesGranted).toEqual(["read"]);
  });

  it("oauth2 connector expired w/ refresh material → status='expired'", async () => {
    const tokenRow = {
      id: "t1",
      expiresAt: new Date(Date.now() - 60_000),
      refreshTokenIv: "iv",
      refreshTokenCiphertext: "ct",
      refreshTokenTag: "tag",
      scopesGranted: ["read"],
      lastUsedAt: null,
    };
    const db = buildBaseDb(
      buildSelectQueue([
        {
          rows: [
            {
              id: "c-jira",
              providerSlug: "jira",
              displayName: "Jira",
              type: "oauth2",
              enabled: true,
              scopes: [],
              clientSecretConfigured: true,
              apiKeyLabel: null,
              refreshSupported: true,
            },
          ],
        },
        { rows: [tokenRow] },
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    expect(list[0].status).toBe("expired");
  });

  it("oauth2 connector expired without refresh (MED-B1 cleared) → status='revoked'", async () => {
    const tokenRow = {
      id: "t1",
      expiresAt: new Date(Date.now() - 60_000),
      refreshTokenIv: null,
      refreshTokenCiphertext: null,
      refreshTokenTag: null,
      scopesGranted: ["read"],
      lastUsedAt: null,
    };
    const db = buildBaseDb(
      buildSelectQueue([
        {
          rows: [
            {
              id: "c-jira",
              providerSlug: "jira",
              displayName: "Jira",
              type: "oauth2",
              enabled: true,
              scopes: [],
              clientSecretConfigured: true,
              apiKeyLabel: null,
              refreshSupported: true,
            },
          ],
        },
        { rows: [tokenRow] },
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    expect(list[0].status).toBe("revoked");
  });

  it("never returns secret material in the projection", async () => {
    const enc = encryptSecret("sk-VERY-SECRET");
    const apiKeyRow = {
      id: "k1",
      keyIv: enc.iv,
      keyCiphertext: enc.ciphertext,
      keyTag: enc.tag,
      lastUsedAt: null,
    };
    const db = buildBaseDb(
      buildSelectQueue([
        {
          rows: [
            {
              id: "c-openai",
              providerSlug: "openai",
              displayName: "OpenAI",
              type: "api_key",
              enabled: true,
              scopes: [],
              apiKeyLabel: "OPENAI_API_KEY",
              refreshSupported: false,
              clientSecretConfigured: false,
            },
          ],
        },
        { rows: [apiKeyRow] },
      ]),
    );
    const svc = connectorService(db);
    const list = await svc.listConnectorsWithStatusForUser("u1", VALID_COMPANY_UUID);
    const json = JSON.stringify(list);
    expect(json).not.toContain("sk-VERY-SECRET");
    expect(json).not.toContain(enc.ciphertext);
    expect(json).not.toContain(enc.iv);
    expect(json).not.toContain(enc.tag);
  });
});

describe("connectors — signAuthorizeUrl (T5)", () => {
  it("rejects when user is not in company", async () => {
    const db = buildBaseDb(buildSelectQueue([{ rows: [] }])); // membership empty
    const svc = connectorService(db);
    await expect(
      svc.signAuthorizeUrl({
        userId: "u1",
        companyId: VALID_COMPANY_UUID,
        connectorId: "c1",
      }),
    ).rejects.toMatchObject({ code: "CONNECTOR_USER_NOT_IN_COMPANY" });
  });

  it("rejects when connector type is api_key (no OAuth flow)", async () => {
    const db = buildBaseDb(
      buildSelectQueue([
        { rows: [{ id: "m1" }] }, // membership
        {
          rows: [
            {
              id: "c-openai",
              providerSlug: "openai",
              type: "api_key",
              enabled: true,
              companyId: VALID_COMPANY_UUID,
              authorizationUrl: null,
            },
          ],
        },
      ]),
    );
    const svc = connectorService(db);
    await expect(
      svc.signAuthorizeUrl({
        userId: "u1",
        companyId: VALID_COMPANY_UUID,
        connectorId: "c-openai",
      }),
    ).rejects.toThrow(/api_key|OAuth/i);
  });

  it("rejects when connector is disabled", async () => {
    const db = buildBaseDb(
      buildSelectQueue([
        { rows: [{ id: "m1" }] },
        {
          rows: [
            {
              id: "c-jira",
              providerSlug: "jira",
              type: "oauth2",
              enabled: false,
              companyId: VALID_COMPANY_UUID,
            },
          ],
        },
      ]),
    );
    const svc = connectorService(db);
    await expect(
      svc.signAuthorizeUrl({
        userId: "u1",
        companyId: VALID_COMPANY_UUID,
        connectorId: "c-jira",
      }),
    ).rejects.toThrow(/not enabled/i);
  });

  it("returns a signed authorize URL containing state JWT and required OAuth params", async () => {
    const db = buildBaseDb(
      buildSelectQueue([
        { rows: [{ id: "m1" }] },
        {
          rows: [
            {
              id: "c-jira",
              providerSlug: "jira",
              type: "oauth2",
              enabled: true,
              companyId: VALID_COMPANY_UUID,
              authorizationUrl: "https://provider.test/authorize",
              clientId: "client-xyz",
              redirectUri: null,
              scopes: ["read", "write"],
            },
          ],
        },
      ]),
    );
    const svc = connectorService(db);
    const { authorizeUrl } = await svc.signAuthorizeUrl({
      userId: "u1",
      companyId: VALID_COMPANY_UUID,
      connectorId: "c-jira",
    });
    const parsed = new URL(authorizeUrl);
    expect(parsed.origin + parsed.pathname).toBe("https://provider.test/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("client-xyz");
    expect(parsed.searchParams.get("scope")).toBe("read write");
    const state = parsed.searchParams.get("state");
    expect(state).toBeTruthy();
    // JWT 3-segment
    expect(state!.split(".").length).toBe(3);
  });
});
