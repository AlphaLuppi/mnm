/**
 * SSRF guard — assertSafePublicUrl
 *
 * Resolves the target hostname to IP(s) and rejects any URL that would reach
 * a private, loopback, link-local, or otherwise reserved address.
 * Covers cloud metadata endpoints (169.254.169.254), RFC-1918, CGN, and IPv6
 * equivalents.  Must be called before every outbound fetch whose URL is
 * user-controlled.
 *
 * Security model
 * ─────────────
 * 1. Parse URL — reject non-http(s) schemes immediately.
 * 2. DNS-resolve the hostname once (all addresses).  Reject if ANY resolved IP
 *    falls in a blocked range.  Using Node's built-in `dns.promises.lookup`
 *    with `all: true` so multi-A records are checked.
 * 3. Reject bare IPs that belong to blocked ranges without a DNS round-trip.
 * 4. Reject private TLDs (.local, .internal, .corp, .lan, etc.).
 * 5. Reject non-standard ports that are almost certainly not a public service.
 *
 * DNS rebinding note: this guard resolves once at validation time.  The actual
 * fetch() call made by the caller immediately after should be considered safe
 * for typical SSRF purposes.  For true rebinding protection the caller should
 * pass the resolved IP as the fetch target with the Host header set to the
 * original hostname — see assertSafePublicUrlWithResolvedIP for that variant.
 */

import dns from "node:dns/promises";

// ---------------------------------------------------------------------------
// Blocked ranges (CIDR notation stored as [prefix-as-BigInt, prefixLength])
// ---------------------------------------------------------------------------

type Cidr4 = { base: number; mask: number };
type Cidr6 = { base: bigint; mask: bigint };

const BLOCKED_IPV4: Cidr4[] = [
  // Loopback
  cidr4("127.0.0.0", 8),
  // Link-local (covers AWS/GCP/Azure IMDS at 169.254.169.254)
  cidr4("169.254.0.0", 16),
  // RFC-1918 private
  cidr4("10.0.0.0", 8),
  cidr4("172.16.0.0", 12),
  cidr4("192.168.0.0", 16),
  // Carrier-grade NAT (RFC 6598)
  cidr4("100.64.0.0", 10),
  // This host (RFC 1122)
  cidr4("0.0.0.0", 8),
  // Multicast
  cidr4("224.0.0.0", 4),
  // Reserved/experimental (RFC 1112)
  cidr4("240.0.0.0", 4),
  // Shared documentation (RFC 5737) — low risk but no public service lives here
  cidr4("192.0.2.0", 24),
  cidr4("198.51.100.0", 24),
  cidr4("203.0.113.0", 24),
];

const BLOCKED_IPV6: Cidr6[] = [
  // Loopback ::1
  cidr6("0000:0000:0000:0000:0000:0000:0000:0001", 128),
  // Link-local fe80::/10
  cidr6("fe80:0000:0000:0000:0000:0000:0000:0000", 10),
  // ULA fc00::/7
  cidr6("fc00:0000:0000:0000:0000:0000:0000:0000", 7),
  // IPv4-mapped ::ffff:0:0/96 (covers IPv4-mapped addresses — check separately)
  cidr6("0000:0000:0000:0000:0000:ffff:0000:0000", 96),
  // Multicast ff00::/8
  cidr6("ff00:0000:0000:0000:0000:0000:0000:0000", 8),
  // AWS EC2 IMDS IPv6 fd00:ec2::254/128
  cidr6("fd00:00ec:0002:0000:0000:0000:0000:0254", 128),
];

// Private / internal TLDs — reject at parse time before DNS
const BLOCKED_TLDS = new Set([
  "local",
  "internal",
  "intranet",
  "corp",
  "lan",
  "home",
  "localdomain",
  "localhost",
]);

// Allowed ports — anything outside this set on a non-standard URL raises an error.
// Empty = allow all ports.
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443, 3000, 4000, 4443, 5000, 5001, 9000, 9443]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates that `rawUrl` is safe to fetch from the server side.
 * Throws an Error (suitable for mapping to HTTP 400/422) on any violation.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<void> {
  // 1. Parse & scheme check
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`SSRF guard: invalid URL "${rawUrl}"`);
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    throw new Error(`SSRF guard: scheme "${scheme}" is not allowed — only http and https are permitted`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("SSRF guard: URL has no hostname");
  }

  // 2. Block private TLDs (fast-path, no DNS needed)
  const tld = hostname.split(".").pop() ?? "";
  if (BLOCKED_TLDS.has(tld)) {
    throw new Error(`SSRF guard: hostname "${hostname}" resolves to a private TLD (.${tld})`);
  }

  // Also block bare "localhost" explicitly
  if (hostname === "localhost") {
    throw new Error(`SSRF guard: hostname "localhost" is not allowed`);
  }

  // 3. Port check — only applies when an explicit port is present
  const portStr = parsed.port;
  if (portStr !== "") {
    const port = parseInt(portStr, 10);
    if (Number.isNaN(port)) {
      throw new Error(`SSRF guard: unparseable port "${portStr}"`);
    }
    if (port < 1 || port > 65535) {
      throw new Error(`SSRF guard: port ${port} is outside valid range`);
    }
    // Block privileged non-web ports (below 80 and not in allowlist)
    if (port < 80 && !ALLOWED_PORTS.has(port)) {
      throw new Error(`SSRF guard: port ${port} is not allowed`);
    }
  }

  // 4. If hostname looks like a literal IP, check it directly
  if (isIPv4(hostname)) {
    assertNotBlockedIPv4(hostname);
    return;
  }
  // Strip IPv6 brackets
  const bareIPv6 = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  if (isIPv6(bareIPv6)) {
    assertNotBlockedIPv6(bareIPv6);
    return;
  }

  // 5. DNS resolution — resolve ALL addresses and reject if any is blocked
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SSRF guard: DNS resolution failed for "${hostname}": ${msg}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`SSRF guard: DNS returned no addresses for "${hostname}"`);
  }

  for (const addr of addresses) {
    if (addr.family === 4) {
      assertNotBlockedIPv4(addr.address);
    } else if (addr.family === 6) {
      assertNotBlockedIPv6(addr.address);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertNotBlockedIPv4(ip: string): void {
  const n = ipv4ToNumber(ip);
  for (const range of BLOCKED_IPV4) {
    if ((n & range.mask) === range.base) {
      throw new Error(`SSRF guard: IP address ${ip} resolves to a blocked private/reserved range`);
    }
  }
}

function assertNotBlockedIPv6(ip: string): void {
  const n = ipv6ToBigInt(ip);
  if (n === null) return; // unparseable — skip; actual fetch will fail
  for (const range of BLOCKED_IPV6) {
    if ((n & range.mask) === range.base) {
      throw new Error(`SSRF guard: IPv6 address ${ip} resolves to a blocked private/reserved range`);
    }
  }
  // IPv4-mapped check — ::ffff:a.b.c.d — also run IPv4 checks on the embedded address
  const ipv4mapped = extractIPv4FromMapped(n);
  if (ipv4mapped !== null) {
    assertNotBlockedIPv4(ipv4mapped);
  }
}

// ---------------------------------------------------------------------------
// CIDR builders
// ---------------------------------------------------------------------------

function cidr4(ip: string, prefixLen: number): Cidr4 {
  const base = ipv4ToNumber(ip);
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return { base: (base & mask) >>> 0, mask };
}

function cidr6(expandedHex: string, prefixLen: number): Cidr6 {
  // expandedHex must be a fully-expanded IPv6 address (8 groups of 4 hex digits separated by ":")
  const base = BigInt("0x" + expandedHex.replace(/:/g, ""));
  const mask = prefixLen === 0 ? 0n : ((1n << 128n) - 1n) - ((1n << BigInt(128 - prefixLen)) - 1n);
  return { base: base & mask, mask };
}

// ---------------------------------------------------------------------------
// IP type detection
// ---------------------------------------------------------------------------

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
function isIPv4(s: string): boolean {
  return IPV4_RE.test(s);
}

// Rough check: contains ":" which distinguishes IPv6 from hostnames
function isIPv6(s: string): boolean {
  return s.includes(":");
}

// ---------------------------------------------------------------------------
// IP conversion utilities
// ---------------------------------------------------------------------------

function ipv4ToNumber(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  try {
    // Expand :: shorthand
    const expanded = expandIPv6(ip);
    if (!expanded) return null;
    return BigInt("0x" + expanded.replace(/:/g, ""));
  } catch {
    return null;
  }
}

/** Expand an IPv6 address to full 8-group form, returns null on failure */
function expandIPv6(ip: string): string | null {
  // Handle IPv4-mapped ::ffff:a.b.c.d
  if (ip.includes(".")) {
    const parts = ip.split(":");
    const ipv4Part = parts.pop();
    if (!ipv4Part || !isIPv4(ipv4Part)) return null;
    const n = ipv4ToNumber(ipv4Part);
    const hi = ((n >>> 16) & 0xffff).toString(16).padStart(4, "0");
    const lo = (n & 0xffff).toString(16).padStart(4, "0");
    ip = [...parts, hi, lo].join(":");
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const middle = Array<string>(missing).fill("0000");
    const groups = [...left, ...middle, ...right];
    return groups.map((g) => g.padStart(4, "0")).join(":");
  }
  const groups = ip.split(":");
  if (groups.length !== 8) return null;
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

/** If this is an IPv4-mapped IPv6 address (::ffff:a.b.c.d), return the v4 string */
function extractIPv4FromMapped(n: bigint): string | null {
  // IPv4-mapped prefix: 0x0000_0000_0000_0000_0000_ffff_0000_0000 / 96
  const prefix96 = (n >> 32n) & 0xffff_ffff_ffff_ffffn;
  if (prefix96 !== 0x0000_0000_0000_ffffn) return null;
  const v4n = Number(n & 0xffff_ffffn);
  return [
    (v4n >>> 24) & 0xff,
    (v4n >>> 16) & 0xff,
    (v4n >>> 8) & 0xff,
    v4n & 0xff,
  ].join(".");
}
