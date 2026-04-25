import type { Request } from "express";

/**
 * Canonical origin for OAuth metadata and WWW-Authenticate headers.
 *
 * Why: RFC 9728 / OAuth 2.1 require the `resource` advertised in protected-
 * resource metadata to match exactly the URL the client used to reach the
 * resource. The MCP SDK enforces this — a `localhost` vs `127.0.0.1` mismatch
 * is treated as a different protected resource and auth fails before it starts.
 *
 * Resolution order:
 *  1. MNM_PUBLIC_URL when set — production canonical URL behind a reverse proxy.
 *  2. X-Forwarded-Proto / X-Forwarded-Host (first segment) — trusted proxy hop.
 *  3. req.protocol + req.get("host") — bare connection origin.
 *
 * This guarantees that whatever hostname the client used (localhost, 127.0.0.1,
 * a Tauri custom scheme, an ngrok URL, …) is echoed back in the metadata so the
 * SDK's protected-resource check passes.
 */
export function originFromRequest(req: Request): string {
  const fromEnv = process.env.MNM_PUBLIC_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const proto = fwdProto || req.protocol;
  const host = fwdHost || req.get("host") || "";
  return `${proto}://${host}`;
}
