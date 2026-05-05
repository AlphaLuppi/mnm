/// <reference path="./types/express.d.ts" />
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Request as ExpressRequest, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import {
  createDb,
  ensurePostgresDatabase,
  inspectMigrations,
  applyPendingMigrations,
  reconcilePendingMigrationHistory,
  formatDatabaseBackupResult,
  runDatabaseBackup,
  authUsers,
  companies,
  companyMemberships,
  instanceUserRoles,
} from "@mnm/db";
import detectPort from "detect-port";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";
import { createRedisClient, disconnectRedis } from "./redis.js";
import { setupLiveEventsWebSocketServer } from "./realtime/live-events-ws.js";
import { setupChatWebSocketServer } from "./realtime/chat-ws.js";
import { heartbeatService, routineService, subscribeDashboardRefreshEvents } from "./services/index.js";
import { governedWorkflowService } from "./services/governed-workflows.js";
import { tickWorkflowTriggers } from "./services/workflow-triggers-tick.js";
import { createResolveGitProvider } from "./mcp/build-mcp-services.js";
import { ShaCache } from "@mnm/git-provider";
import { startCaoWatchdog } from "./services/cao-watchdog.js";
import { startLivenessWatchdog } from "./services/governed-workflows-liveness.js";
import { setTenantContext as setLivenessTenantContext } from "./middleware/tenant-context.js";
import { publishLiveEvent as publishLivenessEvent } from "./services/live-events.js";
import { createStorageServiceFromConfig } from "./storage/index.js";
import { printStartupBanner } from "./startup-banner.js";
import { getBoardClaimWarningUrl, initializeBoardClaimChallenge } from "./board-claim.js";
import { backfillSilverEnrichment } from "./services/silver-trace-enrichment.js";
import { goldTraceEnrichment } from "./services/gold-trace-enrichment.js";
import { backfillPermissions } from "./services/permission-seed.js";

type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

const config = loadConfig();

// SECURITY: MNM_E2E_SEED=true disables all rate limiting and exposes
// unauthenticated privilege-escalation routes (/api/e2e-seed/*).
// It MUST NOT be set in authenticated (production) mode.
if (process.env.MNM_E2E_SEED === "true" && config.deploymentMode === "authenticated") {
  throw new Error(
    "FATAL: MNM_E2E_SEED must NEVER be set in authenticated mode — it disables all rate limiting and exposes unauthenticated admin routes",
  );
}

if (process.env.MNM_SECRETS_PROVIDER === undefined) {
  process.env.MNM_SECRETS_PROVIDER = config.secretsProvider;
}
if (process.env.MNM_SECRETS_STRICT_MODE === undefined) {
  process.env.MNM_SECRETS_STRICT_MODE = config.secretsStrictMode ? "true" : "false";
}
if (process.env.MNM_SECRETS_MASTER_KEY_FILE === undefined) {
  process.env.MNM_SECRETS_MASTER_KEY_FILE = config.secretsMasterKeyFilePath;
}

type MigrationSummary =
  | "skipped"
  | "already applied"
  | "applied (empty database)"
  | "applied (pending migrations)"
  | "pending migrations skipped";

function formatPendingMigrationSummary(migrations: string[]): string {
  if (migrations.length === 0) return "none";
  return migrations.length > 3
    ? `${migrations.slice(0, 3).join(", ")} (+${migrations.length - 3} more)`
    : migrations.join(", ");
}

async function promptApplyMigrations(migrations: string[]): Promise<boolean> {
  if (process.env.MNM_MIGRATION_PROMPT === "never") return false;
  if (process.env.MNM_MIGRATION_AUTO_APPLY === "true") return true;
  if (!stdin.isTTY || !stdout.isTTY) return true;

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await prompt.question(
      `Apply pending migrations (${formatPendingMigrationSummary(migrations)}) now? (y/N): `,
    )).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}

type EnsureMigrationsOptions = {
  autoApply?: boolean;
};

async function ensureMigrations(
  connectionString: string,
  label: string,
  opts?: EnsureMigrationsOptions,
): Promise<MigrationSummary> {
  const autoApply = opts?.autoApply === true;
  let state = await inspectMigrations(connectionString);
  if (state.status === "needsMigrations" && state.reason === "pending-migrations") {
    const repair = await reconcilePendingMigrationHistory(connectionString);
    if (repair.repairedMigrations.length > 0) {
      logger.warn(
        { repairedMigrations: repair.repairedMigrations },
        `${label} had drifted migration history; repaired migration journal entries from existing schema state.`,
      );
      state = await inspectMigrations(connectionString);
      if (state.status === "upToDate") return "already applied";
    }
  }
  if (state.status === "upToDate") return "already applied";
  if (state.status === "needsMigrations" && state.reason === "no-migration-journal-non-empty-db") {
    logger.warn(
      { tableCount: state.tableCount },
      `${label} has existing tables but no migration journal. Run migrations manually to sync schema.`,
    );
    const apply = autoApply ? true : await promptApplyMigrations(state.pendingMigrations);
    if (!apply) {
      logger.warn(
        { pendingMigrations: state.pendingMigrations },
        `${label} has pending migrations; continuing without applying. Run bun run db:migrate to apply before startup.`,
      );
      return "pending migrations skipped";
    }

    logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
    await applyPendingMigrations(connectionString);
    return "applied (pending migrations)";
  }

  const apply = autoApply ? true : await promptApplyMigrations(state.pendingMigrations);
  if (!apply) {
    logger.warn(
      { pendingMigrations: state.pendingMigrations },
      `${label} has pending migrations; continuing without applying. Run bun run db:migrate to apply before startup.`,
    );
    return "pending migrations skipped";
  }

  logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
  await applyPendingMigrations(connectionString);
  return "applied (pending migrations)";
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

const LOCAL_BOARD_USER_ID = "local-board";
const LOCAL_BOARD_USER_EMAIL = "local@mnm.local";
const LOCAL_BOARD_USER_NAME = "Board";

async function ensureLocalTrustedBoardPrincipal(db: any): Promise<void> {
  const now = new Date();
  const existingUser = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.id, LOCAL_BOARD_USER_ID))
    .then((rows: Array<{ id: string }>) => rows[0] ?? null);

  if (!existingUser) {
    await db.insert(authUsers).values({
      id: LOCAL_BOARD_USER_ID,
      name: LOCAL_BOARD_USER_NAME,
      email: LOCAL_BOARD_USER_EMAIL,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const role = await db
    .select({ id: instanceUserRoles.id })
    .from(instanceUserRoles)
    .where(and(eq(instanceUserRoles.userId, LOCAL_BOARD_USER_ID), eq(instanceUserRoles.role, "instance_admin")))
    .then((rows: Array<{ id: string }>) => rows[0] ?? null);
  if (!role) {
    await db.insert(instanceUserRoles).values({
      userId: LOCAL_BOARD_USER_ID,
      role: "instance_admin",
    });
  }

  const companyRows = await db.select({ id: companies.id }).from(companies);
  for (const company of companyRows) {
    const membership = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, company.id),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, LOCAL_BOARD_USER_ID),
        ),
      )
      .then((rows: Array<{ id: string }>) => rows[0] ?? null);
    if (membership) continue;
    await db.insert(companyMemberships).values({
      companyId: company.id,
      principalType: "user",
      principalId: LOCAL_BOARD_USER_ID,
      status: "active",
      membershipRole: "member", // Legacy column — roles are in the `roles` table now
    });
  }
}

async function waitForDatabase(url: string, label: string, maxRetries = 10): Promise<void> {
  const pgLib = await import("postgres");
  const pg = pgLib.default;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const testSql = pg(url, { max: 1, connect_timeout: 5 });
      try {
        await testSql`SELECT 1`;
      } finally {
        await testSql.end();
      }
      logger.info(`${label} is reachable (attempt ${attempt}/${maxRetries})`);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        logger.error({ err }, `${label} not reachable after ${maxRetries} attempts`);
        throw err;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
      logger.warn(`${label} not reachable (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function findOrphanPostgresPidsForDataDir(dataDir: string): Promise<number[]> {
  if (process.platform !== "win32") return [];
  return new Promise((resolveResult) => {
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    ps.stdout.on("data", (chunk) => { out += String(chunk); });
    ps.on("error", () => resolveResult([]));
    ps.on("close", () => {
      try {
        const trimmed = out.trim();
        if (!trimmed) { resolveResult([]); return; }
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const needle = dataDir.toLowerCase().replace(/\//g, "\\");
        const pids = list
          .filter((p) => typeof p?.CommandLine === "string" && p.CommandLine.toLowerCase().includes(needle))
          .map((p) => Number(p.ProcessId))
          .filter((n) => Number.isInteger(n) && n > 0);
        resolveResult(pids);
      } catch {
        resolveResult([]);
      }
    });
  });
}

let db;
let embeddedPostgres: EmbeddedPostgresInstance | null = null;
let embeddedPostgresStartedByThisProcess = false;
let migrationSummary: MigrationSummary = "skipped";
let activeDatabaseConnectionString: string;
let startupDbInfo:
  | { mode: "external-postgres"; connectionString: string }
  | { mode: "embedded-postgres"; dataDir: string; port: number };
if (config.databaseUrl) {
  await waitForDatabase(config.databaseUrl, "PostgreSQL");
  migrationSummary = await ensureMigrations(config.databaseUrl, "PostgreSQL");

  db = createDb(config.databaseUrl);
  logger.info("Using external PostgreSQL via DATABASE_URL/config");
  activeDatabaseConnectionString = config.databaseUrl;
  startupDbInfo = { mode: "external-postgres", connectionString: config.databaseUrl };
} else {
  const moduleName = "embedded-postgres";
  let EmbeddedPostgres: EmbeddedPostgresCtor;
  try {
    const mod = await import(moduleName);
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL mode requires dependency `embedded-postgres`. Reinstall dependencies (without omitting required packages), or set DATABASE_URL for external Postgres.",
    );
  }

  const dataDir = resolve(config.embeddedPostgresDataDir);
  const configuredPort = config.embeddedPostgresPort;
  let port = configuredPort;
  const embeddedPostgresLogBuffer: string[] = [];
  const EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT = 120;
  const verboseEmbeddedPostgresLogs = process.env.MNM_EMBEDDED_POSTGRES_VERBOSE === "true";
  const appendEmbeddedPostgresLog = (message: unknown) => {
    const text = typeof message === "string" ? message : message instanceof Error ? message.message : String(message ?? "");
    for (const lineRaw of text.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line) continue;
      embeddedPostgresLogBuffer.push(line);
      if (embeddedPostgresLogBuffer.length > EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT) {
        embeddedPostgresLogBuffer.splice(0, embeddedPostgresLogBuffer.length - EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT);
      }
      if (verboseEmbeddedPostgresLogs) {
        logger.info({ embeddedPostgresLog: line }, "embedded-postgres");
      }
    }
  };
  const logEmbeddedPostgresFailure = (phase: "initialise" | "start", err: unknown) => {
    if (embeddedPostgresLogBuffer.length > 0) {
      logger.error(
        {
          phase,
          recentLogs: embeddedPostgresLogBuffer,
          err,
        },
        "Embedded PostgreSQL failed; showing buffered startup logs",
      );
    }
  };

  if (config.databaseMode === "postgres") {
    logger.warn("Database mode is postgres but no connection string was set; falling back to embedded PostgreSQL");
  }

  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  const clusterAlreadyInitialized = existsSync(clusterVersionFile);
  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  const isPidRunning = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const getRunningPid = (): number | null => {
    if (!existsSync(postmasterPidFile)) return null;
    try {
      const pidLine = readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim();
      const pid = Number(pidLine);
      if (!Number.isInteger(pid) || pid <= 0) return null;
      if (!isPidRunning(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  };

  const runningPid = getRunningPid();
  if (runningPid) {
    logger.warn(`Embedded PostgreSQL already running; reusing existing process (pid=${runningPid}, port=${port})`);
  } else {
    const detectedPort = await detectPort(configuredPort);
    if (detectedPort !== configuredPort) {
      logger.warn(`Embedded PostgreSQL port is in use; using next free port (requestedPort=${configuredPort}, selectedPort=${detectedPort})`);
    }
    port = detectedPort;
    logger.info(`Using embedded PostgreSQL because no DATABASE_URL set (dataDir=${dataDir}, port=${port})`);
    embeddedPostgres = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "mnm",
      password: "mnm",
      port,
      persistent: true,
      onLog: appendEmbeddedPostgresLog,
      onError: appendEmbeddedPostgresLog,
    });

    if (!clusterAlreadyInitialized) {
      try {
        await embeddedPostgres.initialise();
      } catch (err) {
        logEmbeddedPostgresFailure("initialise", err);
        throw err;
      }
    } else {
      logger.info(`Embedded PostgreSQL cluster already exists (${clusterVersionFile}); skipping init`);
    }

    if (existsSync(postmasterPidFile)) {
      logger.warn("Removing stale embedded PostgreSQL lock file");
      rmSync(postmasterPidFile, { force: true });
    }

    // On Windows, a crashed postgres may leave behind IPC shared memory objects
    // that prevent a new instance from starting. Run `pg_ctl stop -m immediate`
    // on the data directory to force-release them before trying to start.
    if (process.platform === "win32") {
      try {
        const { pg_ctl } = await import("@embedded-postgres/windows-x64");
        await new Promise<void>((done) => {
          const proc = spawn(pg_ctl, ["stop", "-D", dataDir, "-m", "immediate", "-s"], {
            stdio: "ignore",
          });
          proc.on("close", () => done());
          proc.on("error", () => done());
        });
      } catch {
        // pg_ctl unavailable or data dir not initialised — safe to ignore
      }
    }

    let started = false;
    try {
      await embeddedPostgres.start();
      started = true;
    } catch (err) {
      // Windows often leaves orphan postgres.exe processes when the parent dies
      // without firing SIGINT (terminal closed, taskkill /F, IDE stop button).
      // The orphan keeps owning the shmem block but the postmaster.pid file may
      // already be gone, so pg_ctl can't reach it. Recover by enumerating
      // postgres.exe processes whose command line points at OUR data dir and
      // killing only those — the data files stay intact, postgres replays WAL
      // on the next start.
      const recentLogs = embeddedPostgresLogBuffer.join("\n");
      const isShmemConflict = process.platform === "win32"
        && /pre-existing shared memory block is still in use/i.test(recentLogs);
      const orphanPids = isShmemConflict ? await findOrphanPostgresPidsForDataDir(dataDir) : [];
      if (orphanPids.length === 0) {
        logEmbeddedPostgresFailure("start", err);
        throw err;
      }
      logger.warn(`Killing orphan PostgreSQL processes holding ${dataDir} (pids=${orphanPids.join(", ")})`);
      for (const pid of orphanPids) {
        await new Promise<void>((done) => {
          const proc = spawn("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore" });
          proc.on("close", () => done());
          proc.on("error", () => done());
        });
      }
      await new Promise((r) => setTimeout(r, 1000));
      embeddedPostgresLogBuffer.length = 0;
      try {
        await embeddedPostgres.start();
        started = true;
        logger.info("Embedded PostgreSQL recovered from orphan process");
      } catch (retryErr) {
        logEmbeddedPostgresFailure("start", retryErr);
        throw retryErr;
      }
    }
    if (started) embeddedPostgresStartedByThisProcess = true;
  }

  const embeddedAdminConnectionString = `postgres://mnm:mnm@127.0.0.1:${port}/postgres`;
  const dbStatus = await ensurePostgresDatabase(embeddedAdminConnectionString, "mnm");
  if (dbStatus === "created") {
    logger.info("Created embedded PostgreSQL database: mnm");
  }

  const embeddedConnectionString = `postgres://mnm:mnm@127.0.0.1:${port}/mnm`;
  const shouldAutoApplyFirstRunMigrations = !clusterAlreadyInitialized || dbStatus === "created";
  if (shouldAutoApplyFirstRunMigrations) {
    logger.info("Detected first-run embedded PostgreSQL setup; applying pending migrations automatically");
  }
  migrationSummary = await ensureMigrations(embeddedConnectionString, "Embedded PostgreSQL", {
    autoApply: shouldAutoApplyFirstRunMigrations,
  });

  db = createDb(embeddedConnectionString);
  logger.info("Embedded PostgreSQL ready");
  logger.warn(
    "⚠️  You are using embedded PostgreSQL. For B2B/production workloads, " +
      "use an external PostgreSQL instance instead. " +
      "Quick start: bun run db:dev (runs docker compose -f docker-compose.dev.yml up -d) " +
      "then set DATABASE_URL=postgres://mnm:mnm_dev@127.0.0.1:5432/mnm",
  );
  activeDatabaseConnectionString = embeddedConnectionString;
  startupDbInfo = { mode: "embedded-postgres", dataDir, port };
}

// SEC-T2-008: FATAL guard — local_trusted must never run in a production environment.
// Multi-tenant isolation is completely disabled in this mode.
if (
  config.deploymentMode === "local_trusted" &&
  (process.env.NODE_ENV === "production" || process.env.MNM_PROD === "true")
) {
  throw new Error(
    "FATAL: local_trusted mode is not allowed when NODE_ENV=production or MNM_PROD=true. " +
      "Set MNM_DEPLOYMENT_MODE=authenticated for production deployments.",
  );
}

if (config.deploymentMode === "local_trusted" && !isLoopbackHost(config.host)) {
  throw new Error(
    `local_trusted mode requires loopback host binding (received: ${config.host}). ` +
      "Use authenticated mode for non-loopback deployments.",
  );
}

if (config.deploymentMode === "local_trusted" && config.deploymentExposure !== "private") {
  throw new Error("local_trusted mode only supports private exposure");
}

if (config.deploymentMode === "authenticated") {
  if (config.authBaseUrlMode === "explicit" && !config.authPublicBaseUrl) {
    throw new Error("auth.baseUrlMode=explicit requires auth.publicBaseUrl");
  }
  if (config.deploymentExposure === "public") {
    if (config.authBaseUrlMode !== "explicit") {
      throw new Error("authenticated public exposure requires auth.baseUrlMode=explicit");
    }
    if (!config.authPublicBaseUrl) {
      throw new Error("authenticated public exposure requires auth.publicBaseUrl");
    }
  }
}

let authReady = config.deploymentMode === "local_trusted";
let betterAuthHandler: RequestHandler | undefined;
let resolveSession:
  | ((req: ExpressRequest) => Promise<BetterAuthSessionResult | null>)
  | undefined;
let resolveSessionFromHeaders:
  | ((headers: Headers) => Promise<BetterAuthSessionResult | null>)
  | undefined;
if (config.deploymentMode === "local_trusted") {
  await ensureLocalTrustedBoardPrincipal(db as any);
  // In local_trusted mode there's no real OAuth — but the MCP OAuth router
  // still wants a resolveSession to issue codes/tokens. We return a synthetic
  // session for the local-board user so the MCP OAuth flow (consent page
  // included) can complete without bouncing the browser to /auth.
  resolveSession = async () => ({
    session: { id: "local-implicit", userId: LOCAL_BOARD_USER_ID },
    user: { id: LOCAL_BOARD_USER_ID, email: null, name: "Local Board" },
  });
  resolveSessionFromHeaders = async () => ({
    session: { id: "local-implicit", userId: LOCAL_BOARD_USER_ID },
    user: { id: LOCAL_BOARD_USER_ID, email: null, name: "Local Board" },
  });
}
if (config.deploymentMode === "authenticated") {
  const {
    createBetterAuthHandler,
    createBetterAuthInstance,
    deriveAuthTrustedOrigins,
    resolveBetterAuthSession,
    resolveBetterAuthSessionFromHeaders,
  } = await import("./auth/better-auth.js");
  const betterAuthSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ?? process.env.MNM_AGENT_JWT_SECRET?.trim();
  if (!betterAuthSecret) {
    throw new Error(
      "authenticated mode requires BETTER_AUTH_SECRET (or MNM_AGENT_JWT_SECRET) to be set",
    );
  }
  const derivedTrustedOrigins = deriveAuthTrustedOrigins(config);
  const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const effectiveTrustedOrigins = Array.from(new Set([...derivedTrustedOrigins, ...envTrustedOrigins]));
  logger.info(
    {
      authBaseUrlMode: config.authBaseUrlMode,
      authPublicBaseUrl: config.authPublicBaseUrl ?? null,
      trustedOrigins: effectiveTrustedOrigins,
      trustedOriginsSource: {
        derived: derivedTrustedOrigins.length,
        env: envTrustedOrigins.length,
      },
    },
    "Authenticated mode auth origin configuration",
  );
  const auth = createBetterAuthInstance(db as any, config, effectiveTrustedOrigins);
  betterAuthHandler = createBetterAuthHandler(auth);
  resolveSession = (req) => resolveBetterAuthSession(auth, req);
  resolveSessionFromHeaders = (headers) => resolveBetterAuthSessionFromHeaders(auth, headers);
  await initializeBoardClaimChallenge(db as any, { deploymentMode: config.deploymentMode });
  authReady = true;
}

const redisState = createRedisClient(config.redisUrl);

const uiMode = config.uiDevMiddleware ? "vite-dev" : config.serveUi ? "static" : "none";
const storageService = createStorageServiceFromConfig(config);
const app = await createApp(db as any, {
  uiMode,
  storageService,
  deploymentMode: config.deploymentMode,
  deploymentExposure: config.deploymentExposure,
  allowedHostnames: config.allowedHostnames,
  bindHost: config.host,
  authReady,
  companyDeletionEnabled: config.companyDeletionEnabled,
  redisState,
  betterAuthHandler,
  resolveSession,
});
const server = createServer(app as unknown as Parameters<typeof createServer>[0]);
const listenPort = await detectPort(config.port);

if (listenPort !== config.port) {
  logger.warn(`Requested port is busy; using next free port (requestedPort=${config.port}, selectedPort=${listenPort})`);
}

const runtimeListenHost = config.host;
const runtimeApiHost =
  runtimeListenHost === "0.0.0.0" || runtimeListenHost === "::"
    ? "localhost"
    : runtimeListenHost;
process.env.MNM_LISTEN_HOST = runtimeListenHost;
process.env.MNM_LISTEN_PORT = String(listenPort);
process.env.MNM_API_URL = process.env.MNM_PUBLIC_URL || `http://${runtimeApiHost}:${listenPort}`;

const liveEventsWss = setupLiveEventsWebSocketServer(server, db as any, {
  deploymentMode: config.deploymentMode,
  resolveSessionFromHeaders,
});

const { wss: chatWss } = setupChatWebSocketServer(server, db as any, {
  deploymentMode: config.deploymentMode,
  resolveSessionFromHeaders,
  redisState,
});

// DASH-S03: Initialize dashboard refresh emitter (debounced live event relay)
subscribeDashboardRefreshEvents();

// CAO-03: Start the CAO watchdog (monitors agent run anomalies, auto-comments)
startCaoWatchdog(db as any);

// PHASE-4: Start the governed-run liveness watchdog (stalled-run detection +
// optional auto-recovery via LIVENESS_AUTO_RECOVERY=true). Default behaviour
// is advisory-only — operators must opt-in per-run or via env. Single-leader
// concern: in dev/desktop the server process owns the lease; multi-instance
// deployments need an external scheduler/advisory-lock (TODO).
const stopLivenessWatchdog = startLivenessWatchdog({
  db: db as any,
  publishLiveEvent: publishLivenessEvent,
  setTenantContext: setLivenessTenantContext,
  // intervalMs defaults to 30_000 (half the default 60s stall threshold)
  // autoRecover left undefined → reads LIVENESS_AUTO_RECOVERY env at tick time
});
process.on("beforeExit", () => stopLivenessWatchdog());

// ROUTINE-TICK: Schedule the cron tick that fires due routine_triggers (kind=schedule).
// Single-leader assumption (mono-instance) — tickInFlight guard prevents overlap on
// long ticks. Multi-instance deployments will need an advisory-lock, tracked in the
// workflow_triggers unification plan (2026-05-04-workflow-autonomous-triggers.md §0.1).
if (process.env.MNM_DISABLE_AUTO_TRIGGERS === "1") {
  logger.warn("Routine schedule tick disabled (MNM_DISABLE_AUTO_TRIGGERS=1)");
} else {
  const routineTickMs = Number(process.env.MNM_ROUTINE_TICK_MS ?? 30_000);
  const routines = routineService(db as any);
  let routineTickInFlight = false;
  setInterval(() => {
    if (routineTickInFlight) return;
    routineTickInFlight = true;
    void routines
      .tickScheduledTriggers()
      .then((results) => {
        if (results.length > 0) {
          logger.info({ fired: results.length, results }, "routine schedule tick fired triggers");
        }
      })
      .catch((err) => {
        logger.error({ err }, "routine schedule tick failed");
      })
      .finally(() => {
        routineTickInFlight = false;
      });
  }, routineTickMs);
  logger.info({ intervalMs: routineTickMs }, "Routine schedule tick enabled");
}

// WORKFLOW-TRIGGER-TICK: Phase 2 — fire due workflow_triggers (kind=schedule).
// Same kill switch / interval shape as the routine tick above. Constructs the
// Governed Workflows service once at startup and reuses it across ticks.
if (process.env.MNM_DISABLE_AUTO_TRIGGERS === "1") {
  logger.warn("Workflow trigger schedule tick disabled (MNM_DISABLE_AUTO_TRIGGERS=1)");
} else {
  const workflowTriggerTickMs = Number(
    process.env.MNM_WORKFLOW_TRIGGER_TICK_MS ?? process.env.MNM_ROUTINE_TICK_MS ?? 30_000,
  );
  const wtResolveGitProvider = createResolveGitProvider(db);
  const wtShaCache = new ShaCache();
  const wtGoverned = governedWorkflowService(db as any, {
    resolveGitProvider: wtResolveGitProvider,
    shaCache: wtShaCache,
  });
  let workflowTriggerTickInFlight = false;
  setInterval(() => {
    if (workflowTriggerTickInFlight) return;
    workflowTriggerTickInFlight = true;
    void tickWorkflowTriggers(db as any, wtGoverned)
      .then((results) => {
        if (results.length > 0) {
          logger.info({ fired: results.length, results }, "workflow trigger schedule tick fired");
        }
      })
      .catch((err) => {
        logger.error({ err }, "workflow trigger schedule tick failed");
      })
      .finally(() => {
        workflowTriggerTickInFlight = false;
      });
  }, workflowTriggerTickMs);
  logger.info(
    { intervalMs: workflowTriggerTickMs },
    "Workflow trigger schedule tick enabled",
  );
}

// PERM-BACKFILL: Ensure all companies have up-to-date permission slugs (roles are NOT force-created)
void backfillPermissions(db as any).catch((err) => {
  logger.error({ err }, "startup permission backfill failed");
});

// VIEW-PRESET-BACKFILL: Ensure all companies have default view presets
import { backfillViewPresets } from "./services/view-preset-seed.js";
void backfillViewPresets(db as any).catch((err) => {
  logger.error({ err }, "startup view-preset backfill failed");
});

if (config.heartbeatSchedulerEnabled) {
  const heartbeat = heartbeatService(db as any);

  // Reap orphaned runs at startup (no threshold -- runningProcesses is empty)
  void heartbeat.reapOrphanedRuns().catch((err) => {
    logger.error({ err }, "startup reap of orphaned heartbeat runs failed");
  });

  // Silver → Gold enrichment backfill: silver first (phases), then gold (LLM/deterministic analysis)
  void backfillSilverEnrichment(db as any)
    .then(() => goldTraceEnrichment(db as any).backfillGoldEnrichment())
    .catch((err) => {
      logger.error({ err }, "startup silver→gold enrichment backfill failed");
    });

  setInterval(() => {
    void heartbeat
      .tickTimers(new Date())
      .then((result) => {
        if (result.enqueued > 0) {
          logger.info({ ...result }, "heartbeat timer tick enqueued runs");
        }
      })
      .catch((err) => {
        logger.error({ err }, "heartbeat timer tick failed");
      });

    // Periodically reap orphaned runs (5-min staleness threshold)
    void heartbeat
      .reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })
      .catch((err) => {
        logger.error({ err }, "periodic reap of orphaned heartbeat runs failed");
      });
  }, config.heartbeatSchedulerIntervalMs);
}

if (config.databaseBackupEnabled) {
  const backupIntervalMs = config.databaseBackupIntervalMinutes * 60 * 1000;
  let backupInFlight = false;

  const runScheduledBackup = async () => {
    if (backupInFlight) {
      logger.warn("Skipping scheduled database backup because a previous backup is still running");
      return;
    }

    backupInFlight = true;
    try {
      const result = await runDatabaseBackup({
        connectionString: activeDatabaseConnectionString,
        backupDir: config.databaseBackupDir,
        retentionDays: config.databaseBackupRetentionDays,
        filenamePrefix: "mnm",
      });
      logger.info(
        {
          backupFile: result.backupFile,
          sizeBytes: result.sizeBytes,
          prunedCount: result.prunedCount,
          backupDir: config.databaseBackupDir,
          retentionDays: config.databaseBackupRetentionDays,
        },
        `Automatic database backup complete: ${formatDatabaseBackupResult(result)}`,
      );
    } catch (err) {
      logger.error({ err, backupDir: config.databaseBackupDir }, "Automatic database backup failed");
    } finally {
      backupInFlight = false;
    }
  };

  logger.info(
    {
      intervalMinutes: config.databaseBackupIntervalMinutes,
      retentionDays: config.databaseBackupRetentionDays,
      backupDir: config.databaseBackupDir,
    },
    "Automatic database backups enabled",
  );
  setInterval(() => {
    void runScheduledBackup();
  }, backupIntervalMs);
}

// Validate permission slugs at startup (catches typos in route guards)
import { validatePermissionSlugs } from "./services/permission-validator.js";
validatePermissionSlugs();

// Ensure CAO exists for all companies at startup (self-healing if accidentally deleted)
import { ensureCao } from "./services/cao.js";
import { companies as companiesTable } from "@mnm/db";
(async () => {
  try {
    const allCompanies = await (db as any).select({ id: companiesTable.id }).from(companiesTable);
    for (const company of allCompanies) {
      await ensureCao(db as any, company.id);
    }
    if (allCompanies.length > 0) logger.info(`CAO ensured for ${allCompanies.length} company(ies)`);
  } catch (err) {
    logger.warn({ err }, "Failed to ensure CAO at startup (non-blocking)");
  }
})();

server.listen(listenPort, config.host, () => {
  logger.info(`Server listening on ${config.host}:${listenPort}`);
  if (process.env.MNM_OPEN_ON_LISTEN === "true") {
    const openHost = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
    const url = `http://${openHost}:${listenPort}`;
    void import("open")
      .then((mod) => mod.default(url))
      .then(() => {
        logger.info(`Opened browser at ${url}`);
      })
      .catch((err) => {
        logger.warn({ err, url }, "Failed to open browser on startup");
      });
  }
  printStartupBanner({
    host: config.host,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authReady,
    requestedPort: config.port,
    listenPort,
    uiMode,
    db: startupDbInfo,
    migrationSummary,
    heartbeatSchedulerEnabled: config.heartbeatSchedulerEnabled,
    heartbeatSchedulerIntervalMs: config.heartbeatSchedulerIntervalMs,
    databaseBackupEnabled: config.databaseBackupEnabled,
    databaseBackupIntervalMinutes: config.databaseBackupIntervalMinutes,
    databaseBackupRetentionDays: config.databaseBackupRetentionDays,
    databaseBackupDir: config.databaseBackupDir,
  });

  const boardClaimUrl = getBoardClaimWarningUrl(config.host, listenPort);
  if (boardClaimUrl) {
    const red = "\x1b[41m\x1b[30m";
    const yellow = "\x1b[33m";
    const reset = "\x1b[0m";
    console.log(
      [
        `${red}  BOARD CLAIM REQUIRED  ${reset}`,
        `${yellow}This instance was previously local_trusted and still has local-board as the only admin.${reset}`,
        `${yellow}Sign in with a real user and open this one-time URL to claim ownership:${reset}`,
        `${yellow}${boardClaimUrl}${reset}`,
        `${yellow}If you are connecting over Tailscale, replace the host in this URL with your Tailscale IP/MagicDNS name.${reset}`,
      ].join("\n"),
    );
  }
});

let shuttingDown = false;
const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");

  // Close all WebSocket connections
  for (const client of liveEventsWss.clients) client.terminate();
  for (const client of chatWss.clients) client.terminate();

  // Stop accepting new connections
  server.close(() => {
    logger.info("HTTP server closed");
  });

  // Give in-flight requests time to finish (10s)
  const forceExitTimer = setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  await disconnectRedis(redisState);

  if (embeddedPostgres && embeddedPostgresStartedByThisProcess) {
    try {
      await embeddedPostgres.stop();
      logger.info("Embedded PostgreSQL stopped");
    } catch (err) {
      logger.error({ err }, "Failed to stop embedded PostgreSQL cleanly");
    }
  }

  process.exit(0);
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
