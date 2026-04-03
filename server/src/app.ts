import express, { Router, type Request as ExpressRequest } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "@mnm/db";
import { authUsers } from "@mnm/db";
import { eq } from "drizzle-orm";
import type { DeploymentExposure, DeploymentMode } from "@mnm/shared";
import type { StorageService } from "./storage/types.js";
import type { RedisState } from "./redis.js";
import { httpLogger, errorHandler, createRateLimiter, tenantContextMiddleware } from "./middleware/index.js";
import { tagScopeMiddleware } from "./middleware/tag-scope.js";
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
import { workflowRoutes } from "./routes/workflows.js";
import { stageRoutes } from "./routes/stages.js";
import { workspaceContextRoutes } from "./routes/workspace-context.js";
import { driftRoutes } from "./routes/drift.js";
import { projectMembershipRoutes } from "./routes/project-memberships.js";
import { auditRoutes } from "./routes/audit.js";
import { orchestratorRoutes } from "./routes/orchestrator.js";
import { chatRoutes } from "./routes/chat.js";
// CHAT-SHARING: Share links, fork, and context links
import { chatSharingRoutes } from "./routes/chat-sharing.js";
import { chatContextLinkRoutes } from "./routes/chat-context-links.js";
import { compactionRoutes } from "./routes/compaction.js";
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
// CONFIG-LAYERS: MCP OAuth + credentials
import { mcpOauthRoutes } from "./routes/mcp-oauth.js";
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
import type { BetterAuthSessionResult } from "./auth/better-auth.js";

type UiMode = "none" | "static" | "vite-dev";

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

  app.use(express.json());
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
  app.use(tenantContextMiddleware(db));
  app.use(tagScopeMiddleware(db));
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

    res.json({
      session: {
        id: `mnm:${req.actor.source}:${req.actor.userId}`,
        userId: req.actor.userId,
      },
      user: {
        id: req.actor.userId,
        email,
        name,
      },
    });
  });
  if (opts.betterAuthHandler) {
    app.all("/api/auth/*authPath", opts.betterAuthHandler);
  }
  app.use(llmRoutes(db));

  // Rate limiting
  const apiRateLimiter = createRateLimiter({
    redisState: opts.redisState ?? null,
    windowMs: 60_000,
    max: 1000,
  });

  // Mount API routes
  const api = Router();
  api.use(apiRateLimiter);
  api.use(boardMutationGuard());

  // TENANT-02: Rewrite routes without /companies/:companyId/ prefix
  // Agents and simplified API calls use /api/issues, /api/agents, etc.
  // This middleware rewrites them to /api/companies/:companyId/... using the auto-injected companyId.
  api.use((req, _res, next) => {
    const companyId = req.params.companyId;
    if (companyId && req.path.startsWith("/companies/")) {
      // Already has companies prefix — pass through
      next();
      return;
    }
    // Skip paths that don't need rewriting
    if (req.path.startsWith("/health") || req.path.startsWith("/auth/") ||
        req.path.startsWith("/companies") || req.path === "/") {
      next();
      return;
    }
    // Rewrite: /agents/xxx → /companies/:companyId/agents/xxx
    if (companyId) {
      req.url = `/companies/${companyId}${req.path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
    }
    next();
  });
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
  api.use(workflowRoutes(db));
  api.use(stageRoutes(db));
  api.use(workspaceContextRoutes(db));
  api.use(driftRoutes(db));
  api.use(projectMembershipRoutes(db));
  api.use(auditRoutes(db));
  api.use(orchestratorRoutes(db));
  api.use(chatRoutes(db));
  // CHAT-SHARING: Share links, fork, and context links
  api.use(chatSharingRoutes(db));
  api.use(chatContextLinkRoutes(db));
  api.use(compactionRoutes(db));
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
  // CONFIG-LAYERS: MCP OAuth + credentials
  api.use(mcpOauthRoutes(db));
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
      app.use(express.static(uiDist));
      app.get(/.*/, (_req, res) => {
        res.status(200).set("Content-Type", "text/html").end(indexHtml);
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
