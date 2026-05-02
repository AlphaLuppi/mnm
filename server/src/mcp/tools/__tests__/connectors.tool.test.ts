import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { PERMISSIONS } from "@mnm/shared";
import connectorTools from "../connectors.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import * as loggerModule from "../../../middleware/logger.js";
import type { McpActor } from "../../registry/types.js";

/**
 * MCP connectors.tool — T5.4 tests.
 *
 * Critical test (per plan v2 §5.3 H3 redaction obligatoire) :
 *   "Test obligatoire : appeler le tool avec key='test-secret-do-not-log',
 *    grep les logs Express → 0 occurrence."
 *
 * We spy on every logger method (`info`, `warn`, `error`, `debug`) and assert
 * the secret never appears in any logged argument.
 */

const COMPANY_ID = "00000000-0000-0000-0000-000000000a01";
const CONNECTOR_ID = "00000000-0000-0000-0000-000000000c01";
const SECRET_KEY = "test-secret-do-not-log-OPENAI-XYZ-ABC123";

function mkActor(overrides: Partial<McpActor> = {}): McpActor {
  return {
    type: "user",
    userId: "u-1",
    companyId: COMPANY_ID,
    effectivePermissions: new Set([PERMISSIONS.MCP_CONNECT]),
    effectiveTags: [],
    mcpSessionId: "sess-1",
    ...overrides,
  };
}

function mkServices(connectorsOverrides: Record<string, any> = {}) {
  return {
    db: { execute: vi.fn() } as any,
    connectors: {
      listConnectors: vi.fn(async () => []),
      getUserConnectorStatus: vi.fn(async () => ({
        id: CONNECTOR_ID,
        providerSlug: "openai",
        displayName: "OpenAI",
        type: "api_key",
        status: "connected",
        scopesGranted: [],
        expiresAt: null,
        lastUsedAt: new Date(),
      })),
      signAuthorizeUrl: vi.fn(async () => ({
        authorizeUrl: "https://provider.test/authorize?state=xxx&client_id=cid",
      })),
      setUserApiKey: vi.fn(async () => undefined),
      ...connectorsOverrides,
    },
  };
}


// ─── H3 — `set_user_api_key` redaction ─────────────────────────────────────────

describe("MCP set_user_api_key — H3 redaction (CRITICAL)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(loggerModule.logger, "info").mockImplementation(() => undefined as any);
    warnSpy = vi.spyOn(loggerModule.logger, "warn").mockImplementation(() => undefined as any);
    errorSpy = vi.spyOn(loggerModule.logger, "error").mockImplementation(() => undefined as any);
    debugSpy = vi.spyOn(loggerModule.logger, "debug").mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function assertSecretNeverLogged() {
    const allCalls = [
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...debugSpy.mock.calls,
    ];
    for (const call of allCalls) {
      const dump = JSON.stringify(call);
      expect(dump, `Secret leaked into a logger call: ${dump}`).not.toContain(SECRET_KEY);
    }
  }

  it("happy path — does NOT log the key in any logger call", async () => {
    const services = mkServices();
    // Override collectTools' services for this test by getting the tool fresh
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "set_user_api_key")!;

    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID, key: SECRET_KEY },
      actor: mkActor(),
    });

    expect(result.isError).toBeFalsy();
    expect(services.connectors.setUserApiKey).toHaveBeenCalledWith({
      userId: "u-1",
      connectorId: CONNECTOR_ID,
      companyId: COMPANY_ID,
      key: SECRET_KEY,
    });
    assertSecretNeverLogged();
  });

  it("error path — does NOT log the key even when service throws", async () => {
    const services = mkServices({
      setUserApiKey: vi.fn(async () => {
        const err = new Error("BAD") as Error & { statusCode?: number };
        err.statusCode = 400;
        throw err;
      }),
    });
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "set_user_api_key")!;

    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID, key: SECRET_KEY },
      actor: mkActor(),
    });

    expect(result.isError).toBe(true);
    assertSecretNeverLogged();
  });
});

// ─── list_connectors — never returns secret material ─────────────────────────

describe("MCP list_connectors — never returns secret material", () => {
  it("only emits non-secret fields (no clientSecret, no tokens)", async () => {
    const services = mkServices({
      listConnectors: vi.fn(async () => [
        {
          id: CONNECTOR_ID,
          providerSlug: "jira",
          displayName: "Jira",
          type: "oauth2",
          enabled: true,
          scopes: ["read"],
          clientId: "client-id-xyz",
          clientSecretConfigured: true,
          apiKeyLabel: null,
          refreshSupported: true,
        },
      ]),
    });
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "list_connectors")!;

    const result = await tool.handler({
      input: {},
      actor: mkActor(),
    });
    const text = result.content[0].text;
    const parsed = JSON.parse(text) as { connectors: Array<Record<string, unknown>> };
    // The boolean `clientSecretConfigured` is intentionally exposed (it's a
    // status flag, not material). The actual secret-bearing fields must be
    // absent from the output.
    expect(parsed.connectors[0]).not.toHaveProperty("clientSecret");
    expect(parsed.connectors[0]).not.toHaveProperty("clientSecretCiphertext");
    expect(parsed.connectors[0]).not.toHaveProperty("clientSecretIv");
    expect(parsed.connectors[0]).not.toHaveProperty("clientSecretTag");
    expect(parsed.connectors[0]).not.toHaveProperty("accessToken");
    expect(parsed.connectors[0]).not.toHaveProperty("refreshToken");
    expect(parsed.connectors[0].clientSecretConfigured).toBe(true);
  });
});

// ─── get_connector_status — happy path + cross-tenant ─────────────────────────

describe("MCP get_connector_status", () => {
  it("returns status for the current user", async () => {
    const services = mkServices();
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "get_connector_status")!;
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID },
      actor: mkActor(),
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("connected");
    expect(parsed.connectorId).toBe(CONNECTOR_ID);
  });

  it("rejects cleanly when CONNECTOR_USER_NOT_IN_COMPANY thrown", async () => {
    const services = mkServices({
      getUserConnectorStatus: vi.fn(async () => {
        const err = new Error("not in company") as Error & { code?: string };
        err.code = "CONNECTOR_USER_NOT_IN_COMPANY";
        throw err;
      }),
    });
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "get_connector_status")!;
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID },
      actor: mkActor(),
    });
    expect(result.isError).toBe(true);
  });
});

// ─── connect_user_to_connector ────────────────────────────────────────────────

describe("MCP connect_user_to_connector", () => {
  it("returns a signed authorize URL and instructions", async () => {
    const services = mkServices();
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "connect_user_to_connector")!;
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID },
      actor: mkActor(),
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.authorizeUrl).toContain("provider.test/authorize");
    expect(parsed.instructions).toBeTruthy();
  });
});

// ─── wait_for_connection — short timeout for test speed ──────────────────────

describe("MCP wait_for_connection", () => {
  it("returns immediately when status is already 'connected'", async () => {
    const services = mkServices();
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "wait_for_connection")!;
    const start = Date.now();
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID, timeoutS: 5, pollIntervalMs: 500 },
      actor: mkActor(),
    });
    const elapsed = Date.now() - start;
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("connected");
    expect(elapsed).toBeLessThan(2000); // far below the 5s timeout
  });

  it("returns 'revoked' early when status is revoked", async () => {
    const services = mkServices({
      getUserConnectorStatus: vi.fn(async () => ({
        id: CONNECTOR_ID,
        providerSlug: "jira",
        displayName: "Jira",
        type: "oauth2",
        status: "revoked",
        scopesGranted: [],
        expiresAt: null,
        lastUsedAt: null,
      })),
    });
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "wait_for_connection")!;
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID, timeoutS: 5, pollIntervalMs: 500 },
      actor: mkActor(),
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("revoked");
    expect(result.isError).toBe(true);
  });

  it("returns 'timeout' status (not error) when never connects", async () => {
    const services = mkServices({
      getUserConnectorStatus: vi.fn(async () => ({
        id: CONNECTOR_ID,
        providerSlug: "jira",
        displayName: "Jira",
        type: "oauth2",
        status: "disconnected",
        scopesGranted: [],
        expiresAt: null,
        lastUsedAt: null,
      })),
    });
    const fakeDb = { execute: vi.fn() } as any;
    const tools = collectTools(connectorTools, services as any, fakeDb);
    const tool = tools.find((t) => t.name === "wait_for_connection")!;
    const result = await tool.handler({
      input: { connectorId: CONNECTOR_ID, timeoutS: 1, pollIntervalMs: 500 },
      actor: mkActor(),
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("timeout");
    expect(result.isError).toBeFalsy();
  });
});
