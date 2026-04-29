// DEPLOY-03: Reverse proxy middleware for deployment previews
import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import type { DeploymentMode } from "@mnm/shared";
import { deployManagerService } from "../services/deploy-manager.js";
import { logger } from "./logger.js";

interface DeploymentProxyOptions {
  deploymentMode: DeploymentMode;
  /** Origins allowed to read proxied responses (e.g. the MnM UI origin). */
  allowedOrigins?: string[];
}

/**
 * Returns true when the actor has a genuine, authenticated identity —
 * i.e. type "board" (web user) or type "agent" (API key / JWT), but NOT
 * the unauthenticated sentinel `{ type: "none" }` that actorMiddleware
 * injects for every request before auth is resolved.
 *
 * In local_trusted mode actorMiddleware always sets type="board", so this
 * correctly passes all requests through in dev.
 */
function isAuthenticatedActor(actor: any): boolean {
  return actor?.type === "board" || actor?.type === "agent";
}

/**
 * Compare two strings with constant-time equality to prevent timing attacks
 * on share tokens. Returns false if either argument is falsy.
 */
function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function deploymentProxyMiddleware(db: Db, opts: DeploymentProxyOptions = { deploymentMode: "local_trusted" }) {
  const manager = deployManagerService(db);

  // Cache port lookups; reduced TTL so revoked deployments/tokens expire quickly.
  const portCache = new Map<string, { port: number; companyId: string; shareToken: string | null; cachedAt: number }>();
  const CACHE_TTL_MS = 5_000; // 5 s (down from 60 s — SEC-T11-09)

  // Build the set of origins that are permitted to make cross-origin reads.
  // Deployment previews are NOT public APIs — no wildcard.
  const allowedOriginSet = new Set<string>(opts.allowedOrigins ?? []);

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

      // ── Auth check (SEC-T2-003, SEC-T5-013, SEC-T11-09) ──────────────────
      //
      // Two valid paths:
      //   1. Session / API key auth: actor.type must be "board" or "agent"
      //      (NOT the "none" sentinel that actorMiddleware injects for every
      //       request before credentials are resolved).
      //      AND the actor must belong to the company that owns this deployment.
      //
      //   2. Share-token path: a non-null ?token= param that matches the
      //      deployment's shareToken via constant-time comparison.
      //      This path does NOT require session auth, enabling public share links,
      //      but still confirms the token is valid for THIS deployment.
      //
      // In local_trusted mode actorMiddleware always sets type="board", so
      // the company check uses "local-board" — the company check below is
      // bypassed with an explicit mode guard to preserve dev ergonomics.
      const shareTokenParam = req.query.token as string | undefined;
      const actor = (req as any).actor;
      const isAuthenticated = isAuthenticatedActor(actor);

      // Validate share token with constant-time comparison
      const hasValidToken = info.shareToken
        ? safeTokenCompare(shareTokenParam ?? "", info.shareToken)
        : false;

      if (!isAuthenticated && !hasValidToken) {
        res.status(401).json({ error: "Authentication required. Use session cookie or ?token=<shareToken>" });
        return;
      }

      // ── Company membership check (IDOR fix — SEC-T2-003) ─────────────────
      //
      // If the actor is authenticated (session/key path), ensure they belong to
      // the same company as the deployment. Share-token holders skip this check
      // because the token itself scopes access to a single deployment.
      //
      // Skip in local_trusted mode: the implicit board actor has no companyIds
      // array, and in a single-company dev env all deployments belong to the
      // one auto-created company.
      if (isAuthenticated && !hasValidToken && opts.deploymentMode !== "local_trusted") {
        const actorCompanyIds: string[] =
          actor.type === "board"
            ? (actor.companyIds ?? [])
            : actor.companyId
              ? [actor.companyId]
              : [];

        if (!actorCompanyIds.includes(info.companyId)) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      // ── CORS hardening (SEC-T4-02, SEC-T11-09) ───────────────────────────
      //
      // Replace Access-Control-Allow-Origin: * with an explicit allowlist.
      // Deployment previews are opened in a browser tab — cross-origin reads
      // from arbitrary third-party sites must not be allowed.
      const requestOrigin = req.headers.origin;
      if (requestOrigin && allowedOriginSet.has(requestOrigin)) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        res.setHeader("Vary", "Origin");
      }
      // If the origin is not in the allowlist, we do NOT set the CORS header —
      // the browser will block the cross-origin read.

      // Proxy to deployment container
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
