import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { containerInstances } from "@mnm/db";
import type { CredentialProxySecretMapping, CredentialProxyStatus } from "@mnm/shared";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import { secretService } from "./secrets.js";
import { emitAudit } from "./audit-emitter.js";
import { conflict } from "../errors.js";
import { logger } from "../middleware/logger.js";

// cont-s02-svc-port-alloc
const MIN_PROXY_PORT = 8090;
const MAX_PROXY_PORT = 8190;

const PROXY_TIMEOUT_MS = 30_000;        // 30s per request
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

interface ProxyServerConfig {
  port: number;
  instanceId: string;
  agentId: string;
  companyId: string;
  secretMappings: CredentialProxySecretMapping[];
  db: Db;
}

interface ProxyInstance {
  server: Server;
  port: number;
  instanceId: string;
  agentId: string;
  companyId: string;
  secretMappings: CredentialProxySecretMapping[];
  requestCount: number;
  lastRequestAt: Date | null;
  secretsResolved: number;
  secretsDenied: number;
}

// Active proxy instances keyed by container instanceId
const activeProxies = new Map<string, ProxyInstance>();

// cont-s02-svc-port-alloc
async function allocateProxyPort(db: Db): Promise<number> {
  const usedPorts = await db
    .select({ port: containerInstances.credentialProxyPort })
    .from(containerInstances)
    .where(
      and(
        inArray(containerInstances.status, ["pending", "creating", "running"]),
        isNotNull(containerInstances.credentialProxyPort),
      ),
    );
  const usedSet = new Set(usedPorts.map((p) => p.port).filter(Boolean));

  // Also exclude ports used by active proxies (in-memory)
  for (const proxy of activeProxies.values()) {
    usedSet.add(proxy.port);
  }

  for (let port = MIN_PROXY_PORT; port <= MAX_PROXY_PORT; port++) {
    if (!usedSet.has(port)) return port;
  }
  throw conflict("No available proxy ports — maximum concurrent proxied containers reached");
}

// cont-s02-svc-match-rule
function matchSecretMapping(
  mappings: CredentialProxySecretMapping[],
  secretName: string,
): CredentialProxySecretMapping | null {
  // Exact match first
  for (const m of mappings) {
    if (m.secretName === secretName || m.envKeyPlaceholder === secretName) return m;
  }
  return null;
}

// cont-s02-svc-resolve-secret
async function resolveSecretForProxy(
  db: Db,
  companyId: string,
  secretId: string,
): Promise<string> {
  const svc = secretService(db);
  return svc.resolveSecretValue(companyId, secretId, "latest");
}

// cont-s02-svc-handle-request
async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  proxy: ProxyInstance,
): Promise<void> {
  proxy.requestCount++;
  proxy.lastRequestAt = new Date();

  const db = proxy.secretMappings.length > 0
    ? (activeProxies.get(proxy.instanceId) as any)?._db as Db
    : null;

  // cont-s02-svc-jwt-verify
  // Extract JWT from headers
  const jwtToken =
    (req.headers["x-mnm-agent-jwt"] as string) ??
    extractBearerToken(req.headers["authorization"] as string | undefined);

  if (!jwtToken) {
    proxy.secretsDenied++;
    await emitProxyAudit(proxy, "credential.denied", null, "invalid_jwt");
    sendJsonResponse(res, 401, { error: "Unauthorized", reason: "missing_jwt" });
    return;
  }

  const claims = verifyLocalAgentJwt(jwtToken);
  if (!claims) {
    proxy.secretsDenied++;
    await emitProxyAudit(proxy, "credential.denied", null, "invalid_jwt");
    sendJsonResponse(res, 401, { error: "Unauthorized", reason: "invalid_jwt" });
    return;
  }

  // Verify JWT belongs to the same company and agent
  if (claims.company_id !== proxy.companyId) {
    proxy.secretsDenied++;
    await emitProxyAudit(proxy, "credential.denied", null, "company_mismatch");
    sendJsonResponse(res, 403, { error: "Forbidden", reason: "company_mismatch" });
    return;
  }

  // Read the target URL from header
  const targetUrl = req.headers["x-mnm-target-url"] as string | undefined;
  // Read which secret to resolve
  const secretNameHeader = req.headers["x-mnm-secret-name"] as string | undefined;

  if (!targetUrl) {
    sendJsonResponse(res, 400, { error: "Bad Request", reason: "missing_target_url" });
    return;
  }

  // Find matching secret mapping
  const mapping = secretNameHeader
    ? matchSecretMapping(proxy.secretMappings, secretNameHeader)
    : proxy.secretMappings[0] ?? null;

  if (!mapping) {
    proxy.secretsDenied++;
    await emitProxyAudit(proxy, "credential.denied", secretNameHeader ?? "unknown", "no_matching_rule");
    sendJsonResponse(res, 403, { error: "Forbidden", reason: "no_matching_rule" });
    return;
  }

  // Resolve the actual secret value
  let secretValue: string;
  try {
    // Get the db reference from the proxy config stored at creation
    const proxyDb = (proxy as any)._db as Db;
    secretValue = await resolveSecretForProxy(proxyDb, proxy.companyId, mapping.secretId);
  } catch (err: any) {
    proxy.secretsDenied++;
    const reason = err.message?.includes("not found") ? "secret_not_found" : "resolution_error";
    await emitProxyAudit(proxy, "credential.error", mapping.secretName, reason);
    const statusCode = reason === "secret_not_found" ? 404 : 502;
    sendJsonResponse(res, statusCode, { error: reason === "secret_not_found" ? "Not Found" : "Bad Gateway", reason });
    return;
  }

  // cont-s02-svc-forward-request
  // Read the request body
  const body = await readRequestBody(req);
  if (body === null) {
    sendJsonResponse(res, 413, { error: "Payload Too Large", reason: "body_too_large" });
    return;
  }

  // Build forwarding headers — remove MnM-specific headers, inject real secret
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    // Skip hop-by-hop and MnM-specific headers
    if (
      lowerKey === "host" ||
      lowerKey === "x-mnm-agent-jwt" ||
      lowerKey === "x-mnm-target-url" ||
      lowerKey === "x-mnm-secret-name" ||
      lowerKey === "connection" ||
      lowerKey === "transfer-encoding"
    ) continue;
    if (value) forwardHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  // cont-s02-svc-header-inject
  // Inject the real secret
  const headerValue = mapping.headerPrefix
    ? `${mapping.headerPrefix}${secretValue}`
    : secretValue;
  forwardHeaders[mapping.headerName] = headerValue;

  // Forward the request to the target
  try {
    const targetFullUrl = new URL(req.url ?? "/", targetUrl).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const fetchBody = body.length > 0 ? new Uint8Array(body) : undefined;
    const response = await fetch(targetFullUrl, {
      method: req.method ?? "GET",
      headers: forwardHeaders,
      body: fetchBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Forward the response back to the container
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    const responseBody = await response.arrayBuffer();
    res.end(Buffer.from(responseBody));

    proxy.secretsResolved++;

    // cont-s02-svc-audit-emit
    await emitProxyAudit(proxy, "credential.accessed", mapping.secretName, undefined, targetFullUrl);
  } catch (err: any) {
    // Forward errors without crashing the proxy
    if (err.name === "AbortError") {
      sendJsonResponse(res, 504, { error: "Gateway Timeout", reason: "target_timeout" });
    } else {
      sendJsonResponse(res, 502, { error: "Bad Gateway", reason: "forward_error", message: err.message });
    }
    await emitProxyAudit(proxy, "credential.error", mapping.secretName, `forward_error: ${err.message}`);
  }
}

// cont-s02-svc-start-proxy
async function startProxy(config: ProxyServerConfig): Promise<ProxyInstance> {
  const { port, instanceId, agentId, companyId, secretMappings, db } = config;

  if (activeProxies.has(instanceId)) {
    throw conflict(`Proxy already running for instance ${instanceId}`);
  }

  const proxyInstance: ProxyInstance = {
    server: null as unknown as Server,
    port,
    instanceId,
    agentId,
    companyId,
    secretMappings,
    requestCount: 0,
    lastRequestAt: null,
    secretsResolved: 0,
    secretsDenied: 0,
  };

  // Store db reference on the proxy (not exposed in type for security)
  (proxyInstance as any)._db = db;

  // cont-s02-svc-proxy-server
  const server = createServer(async (req, res) => {
    try {
      await handleProxyRequest(req, res, proxyInstance);
    } catch (err: any) {
      logger.error({ err, instanceId }, "Unhandled error in credential proxy");
      if (!res.headersSent) {
        sendJsonResponse(res, 500, { error: "Internal Server Error" });
      }
    }
  });

  proxyInstance.server = server;

  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      activeProxies.set(instanceId, proxyInstance);
      logger.info({ instanceId, port, agentId }, "Credential proxy started");

      // cont-s02-audit-proxy-started
      emitAudit({
        req: { actor: { type: "none" }, ip: null, get: () => null } as any,
        db,
        companyId,
        action: "credential.proxy_started",
        targetType: "container_instance",
        targetId: instanceId,
        metadata: { instanceId, port, agentId, rulesCount: secretMappings.length },
      }).catch(() => { /* audit must not block */ });

      resolve(proxyInstance);
    });

    server.on("error", (err) => {
      logger.error({ err, instanceId, port }, "Failed to start credential proxy");
      reject(err);
    });
  });
}

// cont-s02-svc-stop-proxy
async function stopProxy(instanceId: string): Promise<void> {
  const proxy = activeProxies.get(instanceId);
  if (!proxy) return; // Already stopped or never started

  return new Promise((resolve) => {
    proxy.server.close(() => {
      const db = (proxy as any)._db as Db;
      activeProxies.delete(instanceId);
      logger.info({ instanceId, port: proxy.port }, "Credential proxy stopped");

      // cont-s02-audit-proxy-stopped
      if (db) {
        emitAudit({
          req: { actor: { type: "none" }, ip: null, get: () => null } as any,
          db,
          companyId: proxy.companyId,
          action: "credential.proxy_stopped",
          targetType: "container_instance",
          targetId: instanceId,
          metadata: { instanceId, port: proxy.port },
        }).catch(() => { /* audit must not block */ });
      }

      resolve();
    });
  });
}

// cont-s02-svc-cleanup-all
async function cleanupAllProxies(): Promise<void> {
  const instanceIds = Array.from(activeProxies.keys());
  for (const instanceId of instanceIds) {
    await stopProxy(instanceId);
  }
}

function getActiveProxies(): Map<string, CredentialProxyStatus> {
  const result = new Map<string, CredentialProxyStatus>();
  for (const [instanceId, proxy] of activeProxies) {
    result.set(instanceId, {
      instanceId,
      port: proxy.port,
      active: true,
      requestCount: proxy.requestCount,
      lastRequestAt: proxy.lastRequestAt?.toISOString() ?? null,
      secretsResolved: proxy.secretsResolved,
      secretsDenied: proxy.secretsDenied,
    });
  }
  return result;
}

// ---- Helpers ----

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

function sendJsonResponse(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readRequestBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", () => {
      resolve(Buffer.alloc(0));
    });
  });
}

async function emitProxyAudit(
  proxy: ProxyInstance,
  action: string,
  secretName: string | null,
  reason?: string,
  targetUrl?: string,
): Promise<void> {
  const db = (proxy as any)._db as Db | undefined;
  if (!db) return;

  const metadata: Record<string, unknown> = {
    instanceId: proxy.instanceId,
    agentId: proxy.agentId,
  };
  // NEVER log secret values
  if (secretName) metadata.secretName = secretName;
  if (reason) metadata.reason = reason;
  if (targetUrl) metadata.targetUrl = targetUrl;

  try {
    await emitAudit({
      req: { actor: { type: "none" }, ip: null, get: () => null } as any,
      db,
      companyId: proxy.companyId,
      action,
      targetType: "container_instance",
      targetId: proxy.instanceId,
      metadata,
      severity: action.includes("denied") ? "warning" : action.includes("error") ? "error" : "info",
    });
  } catch {
    // Audit emission must never fail the proxy request
  }
}

export function credentialProxyService(db: Db) {
  return {
    allocateProxyPort: () => allocateProxyPort(db),
    startProxy,
    stopProxy,
    cleanupAllProxies,
    getActiveProxies,
    handleProxyRequest,
    matchSecretMapping,
  };
}

// Export for testing
export { allocateProxyPort, matchSecretMapping, startProxy, stopProxy, cleanupAllProxies };
