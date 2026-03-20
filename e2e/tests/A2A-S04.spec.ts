/**
 * A2A-S04 — MCP Connectors: Model Context Protocol integration
 *
 * File-content-based E2E tests verifying:
 * - MCP connector service (createConnector, updateConnector, deleteConnector, etc.)
 * - MCP connector routes (9 routes in a2a.ts)
 * - MCP types (McpConnector, McpTool, transports, auth types, statuses)
 * - MCP validators (create, update, filters, invoke)
 * - Barrel exports (types, validators, service, LiveEvent)
 * - Audit integration
 *
 * 30 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const MCP_SVC_FILE = resolve(ROOT, "server/src/services/mcp-connectors.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/a2a.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/a2a.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VALIDATORS_FILE = resolve(ROOT, "packages/shared/src/validators/a2a.ts");
const VALIDATORS_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const SVC_INDEX = resolve(ROOT, "server/src/services/index.ts");

// ============================================================
// Service: mcp-connectors.ts (T01–T10)
// ============================================================

test.describe("A2A-S04 — Service: mcp-connectors.ts", () => {
  // T01 — Service file exists
  test("T01 — Service file exists at server/src/services/mcp-connectors.ts", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src.length).toBeGreaterThan(100);
  });

  // T02 — Service exports mcpConnectorService factory function
  test("T02 — Service exports mcpConnectorService factory function", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("export function mcpConnectorService");
    // a2a-s04-service-factory marker
    expect(src).toContain("a2a-s04-service-factory");
  });

  // T03 — createConnector function exists with audit.emit call
  test("T03 — createConnector function exists with audit.emit call", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-create-connector");
    expect(src).toContain("async function createConnector");
    // audit.emit within the create function
    const createFn = src.slice(src.indexOf("async function createConnector"));
    const nextFn = createFn.indexOf("async function updateConnector");
    const block = createFn.slice(0, nextFn > 0 ? nextFn : undefined);
    expect(block).toContain("audit.emit");
    expect(block).toContain('"a2a.mcp_connector_created"');
  });

  // T04 — updateConnector function exists with audit.emit call
  test("T04 — updateConnector function exists with audit.emit call", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-update-connector");
    expect(src).toContain("async function updateConnector");
    const updateFn = src.slice(src.indexOf("async function updateConnector"));
    const nextFn = updateFn.indexOf("async function deleteConnector");
    const block = updateFn.slice(0, nextFn > 0 ? nextFn : undefined);
    expect(block).toContain("audit.emit");
    expect(block).toContain('"a2a.mcp_connector_updated"');
  });

  // T05 — deleteConnector function exists with audit.emit call
  test("T05 — deleteConnector function exists with audit.emit call", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-delete-connector");
    expect(src).toContain("async function deleteConnector");
    const deleteFn = src.slice(src.indexOf("async function deleteConnector"));
    const nextFn = deleteFn.indexOf("async function getConnector");
    const block = deleteFn.slice(0, nextFn > 0 ? nextFn : undefined);
    expect(block).toContain("audit.emit");
    expect(block).toContain('"a2a.mcp_connector_deleted"');
  });

  // T06 — testConnector function returns { reachable, latencyMs, toolCount, error }
  test("T06 — testConnector function returns test result shape", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-test-connector");
    expect(src).toContain("async function testConnector");
    const testFn = src.slice(src.indexOf("async function testConnector"));
    const nextFn = testFn.indexOf("async function listTools");
    const block = testFn.slice(0, nextFn > 0 ? nextFn : undefined);
    expect(block).toContain("reachable");
    expect(block).toContain("latencyMs");
    expect(block).toContain("toolCount");
    expect(block).toContain("error");
  });

  // T07 — listTools function returns array of McpTool objects
  test("T07 — listTools function exists and returns tools", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-list-tools");
    expect(src).toContain("async function listTools");
    expect(src).toContain("STUB_TOOLS");
  });

  // T08 — invokeTool function returns McpToolInvocationResult
  test("T08 — invokeTool function returns invocation result", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-invoke-tool");
    expect(src).toContain("async function invokeTool");
    const invokeFn = src.slice(src.indexOf("async function invokeTool"));
    const nextFn = invokeFn.indexOf("async function getStats");
    const block = invokeFn.slice(0, nextFn > 0 ? nextFn : undefined);
    expect(block).toContain("durationMs");
    expect(block).toContain("success");
    expect(block).toContain("toolName");
    expect(block).toContain("connectorId");
  });

  // T09 — getStats function returns McpConnectorStats shape
  test("T09 — getStats function returns stats shape", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s04-get-stats");
    expect(src).toContain("async function getStats");
    const statsFn = src.slice(src.indexOf("async function getStats"));
    expect(statsFn).toContain("totalConnectors");
    expect(statsFn).toContain("activeCount");
    expect(statsFn).toContain("inactiveCount");
    expect(statsFn).toContain("errorCount");
    expect(statsFn).toContain("totalToolInvocations");
    expect(statsFn).toContain("averageLatencyMs");
  });

  // T10 — Service imports auditService and publishLiveEvent
  test("T10 — Service imports auditService and publishLiveEvent", async () => {
    const src = await readFile(MCP_SVC_FILE, "utf-8");
    expect(src).toContain('import { publishLiveEvent }');
    expect(src).toContain('import { auditService }');
  });
});

// ============================================================
// Routes: a2a.ts MCP section (T11–T19)
// ============================================================

test.describe("A2A-S04 — Routes: MCP connector routes in a2a.ts", () => {
  // T11 — POST /mcp-connectors route exists
  test("T11 — POST /mcp-connectors route exists in a2a.ts", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-create");
    expect(src).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors["']/);
  });

  // T12 — GET /mcp-connectors route exists
  test("T12 — GET /mcp-connectors route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-list");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors["']/);
  });

  // T13 — GET /mcp-connectors/stats route exists
  test("T13 — GET /mcp-connectors/stats route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-stats");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/stats["']/);
  });

  // T14 — GET /mcp-connectors/:connectorId route exists
  test("T14 — GET /mcp-connectors/:connectorId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-detail");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId["']/);
  });

  // T15 — PUT /mcp-connectors/:connectorId route exists
  test("T15 — PUT /mcp-connectors/:connectorId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-update");
    expect(src).toMatch(/router\.put\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId["']/);
  });

  // T16 — DELETE /mcp-connectors/:connectorId route exists
  test("T16 — DELETE /mcp-connectors/:connectorId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-delete");
    expect(src).toMatch(/router\.delete\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId["']/);
  });

  // T17 — POST /mcp-connectors/:connectorId/test route exists
  test("T17 — POST /mcp-connectors/:connectorId/test route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-test");
    expect(src).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId\/test["']/);
  });

  // T18 — GET /mcp-connectors/:connectorId/tools route exists
  test("T18 — GET /mcp-connectors/:connectorId/tools route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-tools");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId\/tools["']/);
  });

  // T19 — POST /mcp-connectors/:connectorId/tools/:toolName/invoke route exists
  test("T19 — POST /tools/:toolName/invoke route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s04-route-invoke");
    expect(src).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/a2a\/mcp-connectors\/:connectorId\/tools\/:toolName\/invoke["']/);
  });
});

// ============================================================
// Types: a2a.ts MCP types (T20–T24)
// ============================================================

test.describe("A2A-S04 — Types: MCP types in shared/types/a2a.ts", () => {
  // T20 — MCP_TRANSPORT_TYPES constant exported with 3 values
  test("T20 — MCP_TRANSPORT_TYPES has 3 transport values", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("a2a-s04-types-transport");
    expect(src).toContain("MCP_TRANSPORT_TYPES");
    expect(src).toContain('"stdio"');
    expect(src).toContain('"sse"');
    expect(src).toContain('"streamable-http"');
  });

  // T21 — MCP_AUTH_TYPES constant exported with 4 values
  test("T21 — MCP_AUTH_TYPES has 4 auth types", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("MCP_AUTH_TYPES");
    expect(src).toContain('"none"');
    expect(src).toContain('"bearer"');
    expect(src).toContain('"api_key"');
    expect(src).toContain('"oauth2"');
  });

  // T22 — MCP_CONNECTOR_STATUSES constant exported with 3 values
  test("T22 — MCP_CONNECTOR_STATUSES has 3 statuses", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("MCP_CONNECTOR_STATUSES");
    // Check that the 3 values exist near MCP_CONNECTOR_STATUSES
    const block = src.slice(src.indexOf("MCP_CONNECTOR_STATUSES"));
    expect(block).toContain('"active"');
    expect(block).toContain('"inactive"');
    expect(block).toContain('"error"');
  });

  // T23 — McpConnector interface defined with required fields
  test("T23 — McpConnector interface has required fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("a2a-s04-types-connector");
    expect(src).toContain("interface McpConnector");
    const block = src.slice(src.indexOf("interface McpConnector"));
    const endBlock = block.indexOf("interface McpTool");
    const connectorBlock = block.slice(0, endBlock > 0 ? endBlock : undefined);
    expect(connectorBlock).toContain("id: string");
    expect(connectorBlock).toContain("companyId: string");
    expect(connectorBlock).toContain("name: string");
    expect(connectorBlock).toContain("url: string");
    expect(connectorBlock).toContain("transport: McpTransportType");
    expect(connectorBlock).toContain("authType: McpAuthType");
    expect(connectorBlock).toContain("status: McpConnectorStatus");
    expect(connectorBlock).toContain("toolCount: number");
  });

  // T24 — McpTool interface defined with name, description, inputSchema
  test("T24 — McpTool interface has name, description, inputSchema", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("a2a-s04-types-tool");
    expect(src).toContain("interface McpTool");
    const block = src.slice(src.indexOf("interface McpTool"));
    const endBlock = block.indexOf("interface McpToolInvocationResult");
    const toolBlock = block.slice(0, endBlock > 0 ? endBlock : undefined);
    expect(toolBlock).toContain("name: string");
    expect(toolBlock).toContain("description: string | null");
    expect(toolBlock).toContain("inputSchema: Record<string, unknown>");
  });
});

// ============================================================
// Validators: a2a.ts MCP validators (T25–T28)
// ============================================================

test.describe("A2A-S04 — Validators: MCP validators in shared/validators/a2a.ts", () => {
  // T25 — createMcpConnectorSchema exported
  test("T25 — createMcpConnectorSchema exported", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("a2a-s04-validator-create");
    expect(src).toContain("export const createMcpConnectorSchema");
    // Verify it validates key fields
    const block = src.slice(src.indexOf("createMcpConnectorSchema"));
    expect(block).toContain("name:");
    expect(block).toContain("url:");
    expect(block).toContain("transport:");
  });

  // T26 — updateMcpConnectorSchema exported
  test("T26 — updateMcpConnectorSchema exported", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("a2a-s04-validator-update");
    expect(src).toContain("export const updateMcpConnectorSchema");
    const block = src.slice(src.indexOf("updateMcpConnectorSchema"));
    expect(block).toContain("status:");
  });

  // T27 — mcpConnectorFiltersSchema exported
  test("T27 — mcpConnectorFiltersSchema exported", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("a2a-s04-validator-filters");
    expect(src).toContain("export const mcpConnectorFiltersSchema");
  });

  // T28 — invokeMcpToolSchema exported
  test("T28 — invokeMcpToolSchema exported", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("a2a-s04-validator-invoke");
    expect(src).toContain("export const invokeMcpToolSchema");
    const block = src.slice(src.indexOf("invokeMcpToolSchema"));
    expect(block).toContain("args:");
  });
});

// ============================================================
// Barrel exports (T29–T30)
// ============================================================

test.describe("A2A-S04 — Barrel exports", () => {
  // T29 — Types index exports MCP types
  test("T29 — Types index exports McpConnector, McpTool, MCP constants", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("a2a-s04-barrel-types");
    expect(src).toContain("MCP_TRANSPORT_TYPES");
    expect(src).toContain("MCP_AUTH_TYPES");
    expect(src).toContain("MCP_CONNECTOR_STATUSES");
    expect(src).toContain("McpConnector");
    expect(src).toContain("McpTool");
    expect(src).toContain("McpToolInvocationResult");
    expect(src).toContain("McpConnectorTestResult");
    expect(src).toContain("McpConnectorStats");
    expect(src).toContain("McpConnectorFilters");
  });

  // T30 — Validators index exports MCP validators
  test("T30 — Validators index exports MCP schemas", async () => {
    const src = await readFile(VALIDATORS_INDEX, "utf-8");
    expect(src).toContain("a2a-s04-barrel-validators");
    expect(src).toContain("createMcpConnectorSchema");
    expect(src).toContain("updateMcpConnectorSchema");
    expect(src).toContain("mcpConnectorFiltersSchema");
    expect(src).toContain("invokeMcpToolSchema");
    expect(src).toContain("CreateMcpConnector");
    expect(src).toContain("UpdateMcpConnector");
    expect(src).toContain("McpConnectorFiltersInput");
    expect(src).toContain("InvokeMcpTool");
  });
});
