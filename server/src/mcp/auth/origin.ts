import type { Request } from "express";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function hostnameOnly(host: string): string {
  // Strip port and surrounding brackets (IPv6) so we can match the loopback set.
  const noBrackets = host.replace(/^\[|\]$/g, "");
  const colonAt = noBrackets.lastIndexOf(":");
  if (colonAt < 0) return noBrackets.toLowerCase();
  // IPv6 raw (e.g. "::1") has multiple colons and no port unless bracketed.
  if (noBrackets.indexOf(":") !== colonAt) return noBrackets.toLowerCase();
  return noBrackets.slice(0, colonAt).toLowerCase();
}

/**
 * Canonical origin for OAuth metadata and WWW-Authenticate headers.
 *
 * Why: RFC 9728 / OAuth 2.1 require the `resource` advertised in protected-
 * resource metadata to match exactly the URL the client used to reach the
 * resource. The MCP SDK enforces this — a `localhost` vs `127.0.0.1` mismatch
 * is treated as a different protected resource and auth fails before it starts.
 *
 * Resolution order:
 *  1. If the incoming request comes through a loopback hostname (localhost,
 *     127.0.0.1, ::1), echo back exactly what the client used. Local dev tools
 *     freely mix these hostnames and a configured MNM_PUBLIC_URL would force
 *     one canonical form, breaking the SDK's resource match for the others.
 *  2. Otherwise prefer MNM_PUBLIC_URL — the canonical URL configured by the
 *     deployment (e.g. behind a reverse proxy).
 *  3. Fall back to X-Forwarded-Proto / X-Forwarded-Host (first segment), then
 *     req.protocol + req.get("host"), so the metadata still works without an
 *     explicit MNM_PUBLIC_URL.
 */
export function originFromRequest(req: Request): string {
  const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const proto = fwdProto || req.protocol;
  const host = fwdHost || req.get("host") || "";
  const derived = `${proto}://${host}`;

  if (host && LOOPBACK_HOSTNAMES.has(hostnameOnly(host))) {
    return derived;
  }

  const fromEnv = process.env.MNM_PUBLIC_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return derived;
}
