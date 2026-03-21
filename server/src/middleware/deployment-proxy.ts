// DEPLOY-03: Reverse proxy middleware for deployment previews
import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { deployManagerService } from "../services/deploy-manager.js";
import { logger } from "./logger.js";

export function deploymentProxyMiddleware(db: Db) {
  const manager = deployManagerService(db);

  // Cache port lookups for 60 seconds
  const portCache = new Map<string, { port: number; companyId: string; shareToken: string | null; cachedAt: number }>();
  const CACHE_TTL_MS = 60_000;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Match /preview/:deploymentId/*
    const match = req.path.match(/^\/preview\/([0-9a-f-]{36})(\/.*)?$/);
    if (!match) return next();

    const deploymentId = match[1]!;
    const subPath = match[2] ?? "/";

    try {
      // Check cache
      let info = portCache.get(deploymentId);
      if (!info || Date.now() - info.cachedAt > CACHE_TTL_MS) {
        const dbInfo = await manager.getDeploymentForProxy(deploymentId);
        if (!dbInfo) {
          res.status(404).json({ error: "Deployment not found or not running" });
          return;
        }
        info = { ...dbInfo, cachedAt: Date.now() };
        portCache.set(deploymentId, info);
      }

      // Auth check: require session cookie OR valid share token
      const shareTokenParam = req.query.token as string | undefined;
      const hasSession = !!(req as any).actor;
      const hasValidToken = shareTokenParam && shareTokenParam === info.shareToken;

      if (!hasSession && !hasValidToken) {
        res.status(401).json({ error: "Authentication required. Use session cookie or ?token=<shareToken>" });
        return;
      }

      // Proxy to deployment container
      const target = `http://127.0.0.1:${info.port}`;

      // Simple proxy using native http
      const http = await import("http");
      const proxyReq = http.request(
        {
          hostname: "127.0.0.1",
          port: info.port,
          path: subPath,
          method: req.method,
          headers: {
            ...req.headers,
            host: `127.0.0.1:${info.port}`,
          },
        },
        (proxyRes) => {
          // Set CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("X-MnM-Deployment", deploymentId);
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        },
      );

      proxyReq.on("error", (err) => {
        logger.warn(`Proxy error for deployment ${deploymentId}: ${err.message}`);
        if (!res.headersSent) {
          res.status(502).json({ error: "Deployment container unreachable" });
        }
      });

      req.pipe(proxyReq, { end: true });
    } catch (err: any) {
      logger.error(`Deployment proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Proxy error" });
      }
    }
  };
}
