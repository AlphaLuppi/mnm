import express, { Router, type Request as ExpressRequest } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "@mnm/db";
import { authUsers, companies } from "@mnm/db";
import { eq, inArray } from "drizzle-orm";
import type { DeploymentExposure, DeploymentMode } from "@mnm/shared";
import type { StorageService } from "./storage/types.js";
import type { RedisState } from "./redis.js";
import { httpLogger, errorHandler, createRateLimiter, tenantContextMiddleware } from "./middleware/index.js";
import { tagScopeMiddleware } from "./middleware/tag-scope.js";
import { assertCompanyMembership } from "./middleware/company-access.js";
import { rolesRoutes } from "./routes/roles.js";
import { permissionsRoutes } from "./routes/permissions.js";
import { tagsRoutes } from "./routes/tags.js";
import { actorMiddleware } from "./middleware/auth.js";
import { boardMutationGuard } from "./middleware/board-mutation-guard.js";
import { privateHostnameGuard, resolvePrivateHostnameAllowSet } from "./middleware/private-hostname-guard.js";
import { healthRoutes } from "./routes/health.js";
import { companyRoutes } from "./routes/companies.js";
import { agentRoutes } from "./routes/agents.js";
import { projectRoutes } from "./routes/projects.js";
import { issueRoutes } from "./routes/issues.js";
import { goalRoutes } from "./routes/goals.js";
import { approvalRoutes } from "./routes/approvals.js";
import { secretRoutes } from "./routes/secrets.js";
import { costRoutes } from "./routes/costs.js";
import { activityRoutes } from "./routes/activity.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { sidebarBadgeRoutes } from "./routes/sidebar-badges.js";
import { llmRoutes } from "./routes/llms.js";
import { assetRoutes } from "./routes/assets.js";
import { accessRoutes } from "./routes/access.js";
import { workspaceContextRoutes } from "./routes/workspace-context.js";
import { driftRoutes } from "./routes/drift.js";
import { projectMembershipRoutes } from "./routes/project-memberships.js";
import { auditRoutes } from "./routes/audit.js";
import { chatRoutes } from "./routes/chat.js";
// CHAT-SHARING: Share links, fork, and context links
import { chatSharingRoutes } from "./routes/chat-sharing.js";
import { chatContextLinkRoutes } from "./routes/chat-context-links.js";
import { automationCursorRoutes } from "./routes/automation-cursors.js";
import { a2aRoutes } from "./routes/a2a.js";
// sso-s01-barrel-app
import { ssoRoutes } from "./routes/sso.js";
// sso-s02-barrel-app
import { ssoAuthRoutes } from "./routes/sso-auth.js";
// onb-s01-barrel-app
import { onboardingRoutes } from "./routes/onboarding.js";
// onb-s03-barrel-app
import { jiraImportRoutes } from "./routes/jira-import.js";
// TRACE-03: Trace routes
import { traceRoutes } from "./routes/traces.js";
// CONFIG-LAYERS: credentials + OAuth
import { credentialRoutes } from "./routes/credentials.js";
// POD-04: Sandbox routes (renamed from pods)
import { sandboxRoutes } from "./routes/sandboxes.js";
// POD-05: Sandbox exec (chat console, renamed from pod-exec)
import { sandboxExecRoutes } from "./routes/sandbox-exec.js";
// DEPLOY-04: Deployment routes
import { deploymentRoutes } from "./routes/deployments.js";
// DEPLOY-03: Deployment proxy
import { deploymentProxyMiddleware } from "./middleware/deployment-proxy.js";
// CONFIG-LAYERS: Config layer routes
import { configLayerRoutes } from "./routes/config-layers.js";
// CHAT-ARTIFACTS: Artifact CRUD + versioning
import { artifactRoutes } from "./routes/artifacts.js";
// DOCUMENTS: Document upload, ingestion, and RAG
import { documentRoutes } from "./routes/documents.js";
// FOLDERS: Folder management routes
import { folderRoutes } from "./routes/folders.js";
// FEEDBACK: Feedback vote routes
import { feedbackRoutes } from "./routes/feedback.js";
// ROUTINES: Routine routes
import { routineRoutes } from "./routes/routines.js";
// VIEW-PRESETS: Persona-based dashboard & navigation
import { viewPresetRoutes } from "./routes/view-presets.js";
// BLOCKS-PLATFORM: User widgets + Inbox items
import { userWidgetRoutes } from "./routes/user-widgets.js";
import { inboxItemRoutes } from "./routes/inbox-items.js";
import { blockCatalogueRoutes } from "./routes/block-catalogue.js";
import type { BetterAuthSessionResult } from "./auth/better-auth.js";
import { createMcpRouter, shutdownMcp } from "./mcp/index.js";
import { buildMcpServices } from "./mcp/build-mcp-services.js";

type UiMode = "none" | "static" | "vite-dev";

/** Check if a buffer contains valid UTF-8 byte sequences. */
function isValidUtf8(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    if (b <= 0x7F) continue; // ASCII
    let remaining: number;
    if ((b & 0xE0) === 0xC0) remaining = 1;
    else if ((b & 0xF0) === 0xE0) remaining = 2;
    else if ((b & 0xF8) === 0xF0) remaining = 3;
    else return false; // invalid start byte
    if (i + remaining >= buf.length) return false; // truncated
    for (let j = 1; j <= remaining; j++) {
      if ((buf[i + j]! & 0xC0) !== 0x80) return false; // bad continuation byte
    }
    i += remaining;
  }
  return true;
}

export async function createApp(
  db: Db,
  opts: {
    uiMode: UiMode;
    storageService: StorageService;
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    allowedHostnames: string[];
    bindHost: string;
    authReady: boolean;
    companyDeletionEnabled: boolean;
    redisState?: RedisState | null;
    betterAuthHandler?: express.RequestHandler;
    resolveSession?: (req: ExpressRequest) => Promise<BetterAuthSessionResult | null>;
  },
) {
  const app = express();

  // JSON body parser with cp1252→UTF-8 fallback for Windows agents.
  // On French Windows, Claude Code's shell subprocesses may send request bodies
  // encoded in cp1252 instead of UTF-8, turning 'tâche' into 't�che'.
  // We read the raw bytes first, detect invalid UTF-8, re-decode as cp1252 if needed.
  app.use(express.raw({ type: "application/json", limit: "10mb" }));
  app.use((req, _res, next) => {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      const buf = req.body as Buffer;
      let text: string;
      if (isValidUtf8(buf)) {
        text = buf.toString("utf8");
      } else {
        text = new TextDecoder("windows-1252").decode(buf);
      }
      try {
        req.body = JSON.parse(text);
      } catch {
        // Invalid JSON — leave raw buffer, downstream error handling will deal with it
        req.body = {};
      }
    } else if (req.body === undefined || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
      req.body = {};
    }
    next();
  });
  app.use(httpLogger);
  const privateHostnameGateEnabled =
    opts.deploymentMode === "authenticated" && opts.deploymentExposure === "private";
  const privateHostnameAllowSet = resolvePrivateHostnameAllowSet({
    allowedHostnames: opts.allowedHostnames,
    bindHost: opts.bindHost,
  });
  app.use(
    privateHostnameGuard({
      enabled: privateHostnameGateEnabled,
      allowedHostnames: opts.allowedHostnames,
      bindHost: opts.bindHost,
    }),
  );
  app.use(
    actorMiddleware(db, {
      deploymentMode: opts.deploymentMode,
      resolveSession: opts.resolveSession,
    }),
  );
  // tenantContextMiddleware is mounted inside the api Router (after URL rewrite + assertCompanyMembership)
  // so that req.params.companyId is correctly parsed by Express before setting the RLS context.
  app.get("/api/auth/get-session", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let email: string | null = null;
    let name: string | null = null;

    if (req.actor.source === "session") {
      const row = await db
        .select({ email: authUsers.email, name: authUsers.name })
        .from(authUsers)
        .where(eq(authUsers.id, req.actor.userId))
        .then((rows) => rows[0] ?? null);
      if (row) {
        email = row.email;
        name = row.name;
      }
    } else if (req.actor.source === "local_implicit") {
      name = "Local Board";
    }

    // Resolve company list with names for multi-company selector
    const companyIds = req.actor.companyIds ?? [];
    let userCompanies: { id: string; name: string }[] = [];
    if (companyIds.length > 0) {
      const rows = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(inArray(companies.id, companyIds));
      userCompanies = rows;
    }

    res.json({
      session: {
        id: `mnm:${req.actor.source}:${req.actor.userId}`,
        userId: req.actor.userId,
      },
      user: {
        id: req.actor.userId,
        email,
        name,
        companyIds,
        companies: userCompanies,
      },
    });
  });
  if (opts.betterAuthHandler) {
    app.all("/api/auth/*authPath", opts.betterAuthHandler);
  }
  app.use(llmRoutes(db));

  // Rate limiting — per tenant + per actor for multi-tenant isolation
  const apiRateLimiter = createRateLimiter({
    redisState: opts.redisState ?? null,
    windowMs: 60_000,
    max: 500,
    keyGenerator: (req) => {
      const companyId = req.params.companyId ?? "global";
      const actorId = req.actor?.type === "agent"
        ? req.actor.agentId ?? req.ip ?? "unknown"
        : req.actor?.type === "board"
          ? req.actor.userId ?? req.ip ?? "unknown"
          : req.ip ?? "unknown";
      return `${companyId}:${actorId}`;
    },
  });

  // Mount API routes
  const api = Router();
  api.use(apiRateLimiter);
  api.use(boardMutationGuard());

  // MULTI-TENANT: assertCompanyMembership verifies the actor belongs to the company in the path.
  // Must run BEFORE tenantContextMiddleware so membership is verified before setting the RLS context.
  api.use("/companies/:companyId", assertCompanyMembership());

  // RLS tenant context: sets PostgreSQL app.current_company_id from req.params.companyId.
  // Mounted AFTER URL rewrite + assertCompanyMembership so Express has parsed the :companyId param.
  api.use("/companies/:companyId", tenantContextMiddleware(db));

  // TagScope resolves user's visible tags for the company.
  // Mounting on "/companies/:companyId" ensures Express extracts the param before the middleware reads it.
  api.use("/companies/:companyId", tagScopeMiddleware(db));

  api.use(
    "/health",
    healthRoutes(db, {
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      companyDeletionEnabled: opts.companyDeletionEnabled,
      redisState: opts.redisState ?? null,
    }),
  );
  api.use("/companies", companyRoutes(db));
  api.use(agentRoutes(db));
  api.use(assetRoutes(db, opts.storageService));
  api.use(projectRoutes(db));
  api.use(issueRoutes(db, opts.storageService));
  api.use(goalRoutes(db));
  api.use(approvalRoutes(db));
  api.use(secretRoutes(db));
  api.use(costRoutes(db));
  api.use(activityRoutes(db));
  api.use(dashboardRoutes(db));
  api.use(sidebarBadgeRoutes(db));
  api.use(workspaceContextRoutes(db));
  api.use(driftRoutes(db));
  api.use(projectMembershipRoutes(db));
  api.use(auditRoutes(db));
  api.use(chatRoutes(db));
  // CHAT-SHARING: Share links, fork, and context links
  api.use(chatSharingRoutes(db));
  api.use(chatContextLinkRoutes(db));
  api.use(automationCursorRoutes(db));
  api.use(a2aRoutes(db));
  // sso-s01-barrel-app
  api.use(ssoRoutes(db));
  // sso-s02-barrel-app
  api.use(ssoAuthRoutes(db));
  // onb-s01-barrel-app
  api.use(onboardingRoutes(db));
  // onb-s03-barrel-app
  api.use(jiraImportRoutes(db));
  // TRACE-03: Trace routes
  api.use(traceRoutes(db));
  // CONFIG-LAYERS: credentials + OAuth
  api.use(credentialRoutes(db));
  // POD-04: Sandbox routes
  api.use(sandboxRoutes(db));
  // POD-05: Sandbox exec (chat console)
  api.use(sandboxExecRoutes(db));
  // DEPLOY-04: Deployment routes
  api.use(deploymentRoutes(db));
  // ROLES+TAGS: Dynamic roles + permissions CRUD
  api.use(rolesRoutes(db));
  api.use(permissionsRoutes(db));
  api.use(tagsRoutes(db));
  // CONFIG-LAYERS: Config layer routes
  api.use(configLayerRoutes(db));
  // CHAT-ARTIFACTS: Artifact CRUD + versioning
  api.use(artifactRoutes(db));
  // DOCUMENTS: Document upload, ingestion, and RAG
  api.use(documentRoutes(db, opts.storageService));
  // FOLDERS: Folder management + workspace upload
  api.use(folderRoutes(db, opts.storageService));
  // FEEDBACK: Feedback vote routes
  api.use(feedbackRoutes(db));
  // ROUTINES: Routine routes
  api.use(routineRoutes(db));
  // VIEW-PRESETS: Persona-based dashboard & navigation
  api.use(viewPresetRoutes(db));
  // BLOCKS-PLATFORM: User widgets + Inbox items + Block catalogue
  api.use(userWidgetRoutes(db));
  api.use(inboxItemRoutes(db));
  api.use(blockCatalogueRoutes(db));
  api.use(
    accessRoutes(db, {
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      bindHost: opts.bindHost,
      allowedHostnames: opts.allowedHostnames,
    }),
  );
  app.use("/api", api);

  // DEPLOY-03: Deployment preview proxy (mounted outside /api for clean URLs)
  app.use(deploymentProxyMiddleware(db));

  // E2E seed endpoint — only active when MNM_E2E_SEED=true
  if (process.env.MNM_E2E_SEED === "true") {
    const { e2eSeedRoutes } = await import("./routes/e2e-seed.js");
    app.use("/api", e2eSeedRoutes(db));
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // ── MCP Server (Streamable HTTP + OAuth 2.1 AS) ────────────────────────
  // MUST be mounted AFTER /api routes but BEFORE SPA fallback.
  // express.json() is applied globally above; the router passes req.body
  // to transport.handleRequest() explicitly since the stream is already consumed.
  const mcpRouter = createMcpRouter({
    db,
    services: buildMcpServices(db),
    resolveSession: opts.resolveSession ?? (async () => null),
    getPublicUrl: () =>
      process.env.MNM_PUBLIC_URL
      ?? process.env.MNM_API_URL
      ?? `http://localhost:${process.env.MNM_LISTEN_PORT ?? process.env.PORT ?? 3100}`,
  });
  app.use(mcpRouter);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  if (opts.uiMode === "static") {
    // Try published location first (server/ui-dist/), then monorepo dev location (../../ui/dist)
    const candidates = [
      path.resolve(__dirname, "../ui-dist"),
      path.resolve(__dirname, "../../ui/dist"),
    ];
    const uiDist = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
    if (uiDist) {
      const indexHtml = fs.readFileSync(path.join(uiDist, "index.html"), "utf-8");
      // Hashed assets (Vite puts them in /assets/) → immutable long-term cache
      app.use(
        "/assets",
        express.static(path.join(uiDist, "assets"), {
          maxAge: "1y",
          immutable: true,
        }),
      );
      // Everything else (favicon, manifest, sw.js, etc.) → short cache with revalidation
      app.use(
        express.static(uiDist, {
          maxAge: 0,
          etag: true,
          lastModified: true,
        }),
      );
      // SPA fallback — always serve fresh index.html (no-cache so browser fetches new chunk refs)
      app.get(/.*/, (_req, res) => {
        res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", "no-cache, no-store, must-revalidate")
          .end(indexHtml);
      });
    } else {
      console.warn("[mnm] UI dist not found; running in API-only mode");
    }
  }

  if (opts.uiMode === "vite-dev") {
    const uiRoot = path.resolve(__dirname, "../../ui");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: uiRoot,
      appType: "spa",
      server: {
        middlewareMode: true,
        allowedHosts: privateHostnameGateEnabled ? Array.from(privateHostnameAllowSet) : true,
      },
    });

    app.use(vite.middlewares);
    app.get(/.*/, async (req, res, next) => {
      try {
        const templatePath = path.resolve(uiRoot, "index.html");
        const template = fs.readFileSync(templatePath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(errorHandler);

  return app;
}
