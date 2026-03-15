/**
 * A2A-S04: MCP Connector Service — Model Context Protocol integration
 *
 * Manages MCP server connectors for a company:
 * - CRUD operations on MCP connectors (in-memory storage, P2)
 * - Stubbed connectivity testing
 * - Stubbed tool listing and invocation
 * - Statistics aggregation
 * - Audit trail for all operations
 * - LiveEvent notifications
 *
 * Pattern: Same service factory as a2a-bus.ts, a2a-permissions.ts
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@mnm/db";
import type {
  McpConnector,
  McpConnectorStatus,
  McpTransportType,
  McpTool,
  McpToolInvocationResult,
  McpConnectorTestResult,
  McpConnectorStats,
  McpConnectorFilters,
} from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { auditService } from "./audit.js";
import { logger as parentLogger } from "../middleware/logger.js";

const logger = parentLogger.child({ module: "mcp-connectors" });

// --- In-memory storage (P2: no DB table yet) ---

interface ConnectorStore {
  connectors: Map<string, McpConnector>;
  toolInvocationCount: number;
  totalLatencyMs: number;
}

const storeByCompany = new Map<string, ConnectorStore>();

function getStore(companyId: string): ConnectorStore {
  let store = storeByCompany.get(companyId);
  if (!store) {
    store = { connectors: new Map(), toolInvocationCount: 0, totalLatencyMs: 0 };
    storeByCompany.set(companyId, store);
  }
  return store;
}

// --- Stubbed MCP tools per connector ---

const STUB_TOOLS: McpTool[] = [
  {
    name: "search_documents",
    description: "Search documents in the connected knowledge base",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_weather",
    description: "Get current weather for a location",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or coordinates" },
      },
      required: ["location"],
    },
  },
  {
    name: "run_query",
    description: "Execute a read-only SQL query against the data warehouse",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query (SELECT only)" },
      },
      required: ["sql"],
    },
  },
];

// --- Helper: mask authConfig in audit/response ---

function maskAuthConfig(authConfig: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!authConfig) return null;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(authConfig)) {
    if (typeof value === "string" && value.length > 4) {
      masked[key] = value.slice(0, 4) + "****";
    } else {
      masked[key] = "****";
    }
  }
  return masked;
}

// --- Service factory ---

// a2a-s04-service-factory
export function mcpConnectorService(db: Db) {
  const audit = auditService(db);

  // a2a-s04-create-connector
  async function createConnector(
    companyId: string,
    input: {
      name: string;
      description?: string | null;
      url: string;
      transport: McpTransportType;
      authType?: string;
      authConfig?: Record<string, unknown> | null;
    },
  ): Promise<McpConnector> {
    const store = getStore(companyId);
    const now = new Date().toISOString();
    const id = randomUUID();

    const connector: McpConnector = {
      id,
      companyId,
      name: input.name,
      description: input.description ?? null,
      url: input.url,
      transport: input.transport,
      authType: (input.authType ?? "none") as McpConnector["authType"],
      authConfig: input.authConfig ?? null,
      status: "active",
      toolCount: STUB_TOOLS.length,
      lastTestedAt: null,
      lastTestResult: null,
      createdAt: now,
      updatedAt: now,
    };

    store.connectors.set(id, connector);

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.mcp_connector_created",
      targetType: "mcp_connector",
      targetId: id,
      metadata: {
        name: connector.name,
        url: connector.url,
        transport: connector.transport,
        authType: connector.authType,
      },
      severity: "info",
    });

    // LiveEvent
    publishLiveEvent({
      companyId,
      type: "a2a.mcp_connector_changed",
      payload: { action: "created", connectorId: id, name: connector.name },
    });

    logger.info({ connectorId: id, companyId, name: connector.name }, "MCP connector created");

    // Return connector with masked authConfig
    return { ...connector, authConfig: maskAuthConfig(connector.authConfig) };
  }

  // a2a-s04-update-connector
  async function updateConnector(
    companyId: string,
    connectorId: string,
    input: {
      name?: string;
      description?: string | null;
      url?: string;
      transport?: McpTransportType;
      authType?: string;
      authConfig?: Record<string, unknown> | null;
      status?: McpConnectorStatus;
    },
  ): Promise<McpConnector> {
    const store = getStore(companyId);
    const existing = store.connectors.get(connectorId);

    if (!existing || existing.companyId !== companyId) {
      throw Object.assign(new Error("MCP connector not found"), { statusCode: 404 });
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();

    if (input.name !== undefined) existing.name = input.name;
    if (input.description !== undefined) existing.description = input.description;
    if (input.url !== undefined) existing.url = input.url;
    if (input.transport !== undefined) existing.transport = input.transport;
    if (input.authType !== undefined) existing.authType = input.authType as McpConnector["authType"];
    if (input.authConfig !== undefined) existing.authConfig = input.authConfig;
    if (input.status !== undefined) existing.status = input.status;
    existing.updatedAt = now;

    store.connectors.set(connectorId, existing);

    const metadata: Record<string, unknown> = { changes: Object.keys(input) };
    if (input.status !== undefined && input.status !== previousStatus) {
      metadata.statusChange = `${previousStatus}\u2192${input.status}`;
    }

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.mcp_connector_updated",
      targetType: "mcp_connector",
      targetId: connectorId,
      metadata,
      severity: "info",
    });

    // LiveEvent
    publishLiveEvent({
      companyId,
      type: "a2a.mcp_connector_changed",
      payload: { action: "updated", connectorId, name: existing.name },
    });

    logger.info({ connectorId, companyId }, "MCP connector updated");

    return { ...existing, authConfig: maskAuthConfig(existing.authConfig) };
  }

  // a2a-s04-delete-connector
  async function deleteConnector(companyId: string, connectorId: string): Promise<void> {
    const store = getStore(companyId);
    const existing = store.connectors.get(connectorId);

    if (!existing || existing.companyId !== companyId) {
      throw Object.assign(new Error("MCP connector not found"), { statusCode: 404 });
    }

    store.connectors.delete(connectorId);

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.mcp_connector_deleted",
      targetType: "mcp_connector",
      targetId: connectorId,
      metadata: { name: existing.name, url: existing.url },
      severity: "info",
    });

    // LiveEvent
    publishLiveEvent({
      companyId,
      type: "a2a.mcp_connector_changed",
      payload: { action: "deleted", connectorId, name: existing.name },
    });

    logger.info({ connectorId, companyId }, "MCP connector deleted");
  }

  // a2a-s04-get-connector
  async function getConnector(companyId: string, connectorId: string): Promise<McpConnector | null> {
    const store = getStore(companyId);
    const connector = store.connectors.get(connectorId);

    if (!connector || connector.companyId !== companyId) {
      return null;
    }

    return { ...connector, authConfig: maskAuthConfig(connector.authConfig) };
  }

  // a2a-s04-list-connectors
  async function listConnectors(
    companyId: string,
    filters: McpConnectorFilters = {},
  ): Promise<McpConnector[]> {
    const store = getStore(companyId);
    let connectors = Array.from(store.connectors.values());

    if (filters.status) {
      connectors = connectors.filter((c) => c.status === filters.status);
    }
    if (filters.transport) {
      connectors = connectors.filter((c) => c.transport === filters.transport);
    }

    // Sort by createdAt desc
    connectors.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Pagination
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    connectors = connectors.slice(offset, offset + limit);

    // Mask authConfig in response
    return connectors.map((c) => ({ ...c, authConfig: maskAuthConfig(c.authConfig) }));
  }

  // a2a-s04-test-connector
  async function testConnector(
    companyId: string,
    connectorId: string,
  ): Promise<McpConnectorTestResult> {
    const store = getStore(companyId);
    const connector = store.connectors.get(connectorId);

    if (!connector || connector.companyId !== companyId) {
      throw Object.assign(new Error("MCP connector not found"), { statusCode: 404 });
    }

    // Stubbed connectivity test
    const now = new Date().toISOString();
    const latencyMs = Math.floor(Math.random() * 200) + 50;
    const result: McpConnectorTestResult = {
      reachable: true,
      latencyMs,
      toolCount: STUB_TOOLS.length,
      error: null,
      testedAt: now,
    };

    // Update connector with test result
    connector.lastTestedAt = now;
    connector.lastTestResult = result;
    connector.toolCount = result.toolCount;
    connector.updatedAt = now;
    store.connectors.set(connectorId, connector);

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.mcp_connector_tested",
      targetType: "mcp_connector",
      targetId: connectorId,
      metadata: { reachable: result.reachable, latencyMs: result.latencyMs, toolCount: result.toolCount },
      severity: "info",
    });

    // LiveEvent
    publishLiveEvent({
      companyId,
      type: "a2a.mcp_connector_changed",
      payload: { action: "tested", connectorId, reachable: result.reachable },
    });

    logger.info({ connectorId, companyId, reachable: result.reachable, latencyMs }, "MCP connector tested");

    return result;
  }

  // a2a-s04-list-tools
  async function listTools(
    companyId: string,
    connectorId: string,
  ): Promise<McpTool[]> {
    const store = getStore(companyId);
    const connector = store.connectors.get(connectorId);

    if (!connector || connector.companyId !== companyId) {
      throw Object.assign(new Error("MCP connector not found"), { statusCode: 404 });
    }

    if (connector.status !== "active") {
      throw Object.assign(new Error("MCP connector is not active"), { statusCode: 400 });
    }

    // Stubbed: return static tool list
    return STUB_TOOLS;
  }

  // a2a-s04-invoke-tool
  async function invokeTool(
    companyId: string,
    connectorId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolInvocationResult> {
    const store = getStore(companyId);
    const connector = store.connectors.get(connectorId);

    if (!connector || connector.companyId !== companyId) {
      throw Object.assign(new Error("MCP connector not found"), { statusCode: 404 });
    }

    if (connector.status !== "active") {
      throw Object.assign(new Error("MCP connector is not active"), { statusCode: 400 });
    }

    const tool = STUB_TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      throw Object.assign(new Error(`Tool '${toolName}' not found on connector`), { statusCode: 404 });
    }

    const startTime = Date.now();

    // Stubbed invocation — return a mock result
    const mockResult = {
      tool: toolName,
      args,
      output: `Stubbed result for ${toolName} with args ${JSON.stringify(args)}`,
      timestamp: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime + Math.floor(Math.random() * 100);

    const result: McpToolInvocationResult = {
      connectorId,
      toolName,
      success: true,
      result: mockResult,
      error: null,
      durationMs,
      invokedAt: new Date().toISOString(),
    };

    // Update stats
    store.toolInvocationCount += 1;
    store.totalLatencyMs += durationMs;

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.mcp_tool_invoked",
      targetType: "mcp_connector",
      targetId: connectorId,
      metadata: {
        toolName,
        durationMs,
        success: result.success,
        connectorName: connector.name,
      },
      severity: "info",
    });

    // LiveEvent
    publishLiveEvent({
      companyId,
      type: "a2a.mcp_connector_changed",
      payload: { action: "tool_invoked", connectorId, toolName, durationMs },
    });

    logger.info({ connectorId, companyId, toolName, durationMs }, "MCP tool invoked");

    return result;
  }

  // a2a-s04-get-stats
  async function getStats(companyId: string): Promise<McpConnectorStats> {
    const store = getStore(companyId);
    const connectors = Array.from(store.connectors.values());

    return {
      totalConnectors: connectors.length,
      activeCount: connectors.filter((c) => c.status === "active").length,
      inactiveCount: connectors.filter((c) => c.status === "inactive").length,
      errorCount: connectors.filter((c) => c.status === "error").length,
      totalToolInvocations: store.toolInvocationCount,
      averageLatencyMs: store.toolInvocationCount > 0
        ? Math.round(store.totalLatencyMs / store.toolInvocationCount)
        : null,
    };
  }

  return {
    createConnector,
    updateConnector,
    deleteConnector,
    getConnector,
    listConnectors,
    testConnector,
    listTools,
    invokeTool,
    getStats,
  };
}
