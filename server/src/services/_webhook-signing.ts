/**
 * Webhook signing & at-rest encryption helpers.
 *
 * Extracted from `routines.ts` (Phase 2 of WORKFLOW-TRIGGERS) so the
 * routine webhook fire path and the unified workflow_triggers webhook
 * fire path share one verified implementation. Both modes — `bearer`
 * and `hmac_sha256` — are agnostic of the header names: callers pass
 * the values in, the helper returns a verdict.
 *
 * **At rest encryption (SEC-T11-04)**
 *
 *   Webhook secrets are encrypted with AES-256-GCM using the same master
 *   key as the local-encrypted secrets provider (`MNM_SECRETS_MASTER_KEY`
 *   env var or `data/secrets/master.key` file). The DB column keeps its
 *   `text` type; encrypted blobs are prefixed with `enc:` so legacy
 *   plaintext rows degrade gracefully (returned as-is, re-encrypted on
 *   next rotation).
 *
 * **Constant-time comparison**
 *
 *   `timingSafeCompare` returns false for length mismatch first (does
 *   *not* leak whether prefixes match), then defers to
 *   `crypto.timingSafeEqual` for the equal-length compare. Used for
 *   bearer + HMAC verdicts.
 */
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { badRequest } from "../errors.js";

const WEBHOOK_SECRET_ENC_PREFIX = "enc:";

function loadWebhookMasterKey(): Buffer {
  const envKeyRaw = process.env.MNM_SECRETS_MASTER_KEY;
  if (envKeyRaw && envKeyRaw.trim().length > 0) {
    const t = envKeyRaw.trim();
    if (/^[A-Fa-f0-9]{64}$/.test(t)) return Buffer.from(t, "hex");
    const b64 = Buffer.from(t, "base64");
    if (b64.length === 32) return b64;
    const utf8buf = Buffer.from(t, "utf8");
    if (utf8buf.length === 32) return utf8buf;
    throw new Error("Invalid MNM_SECRETS_MASTER_KEY — expected 32-byte hex/base64/utf8");
  }
  const keyPath = (process.env.MNM_SECRETS_MASTER_KEY_FILE ?? "").trim()
    || `${process.cwd()}/data/secrets/master.key`;
  if (existsSync(keyPath)) {
    const raw = readFileSync(keyPath, "utf8").trim();
    if (/^[A-Fa-f0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
    throw new Error(`Invalid secrets master key at ${keyPath}`);
  }
  // Auto-generate and persist (first-run bootstrap)
  const dir = keyPath.substring(0, keyPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  const generated = crypto.randomBytes(32);
  writeFileSync(keyPath, generated.toString("base64"), { encoding: "utf8", mode: 0o600 });
  try { chmodSync(keyPath, 0o600); } catch { /* best effort */ }
  return generated;
}

export function encryptWebhookSecret(plaintext: string): string {
  const masterKey = loadWebhookMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return WEBHOOK_SECRET_ENC_PREFIX + JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ciphertext.toString("base64"),
  });
}

export function decryptWebhookSecret(stored: string): string {
  if (!stored.startsWith(WEBHOOK_SECRET_ENC_PREFIX)) {
    // Legacy plaintext row — return as-is so existing webhooks keep working.
    return stored;
  }
  const masterKey = loadWebhookMasterKey();
  const payload = JSON.parse(stored.slice(WEBHOOK_SECRET_ENC_PREFIX.length)) as {
    iv: string; tag: string; ct: string;
  };
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ct = Buffer.from(payload.ct, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a fresh webhook secret. 32 random bytes hex-encoded → 64-char
 * string suitable for `Authorization: Bearer ...` or as the HMAC key
 * component on the user side (the encrypted version is stored in DB).
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a public id for a webhook trigger. 16 random bytes hex-encoded
 * → 32-char URL-safe path component (no need for leading discriminator —
 * the surrounding path scopes it to a kind, e.g. `/routine-triggers/public/<id>`).
 */
export function generatePublicId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Verify a `Bearer <token>` header against a plaintext secret using a
 * constant-time compare. Throws `badRequest` on any mismatch — never
 * silently false, so callers don't have to remember to check the result.
 */
export function verifyBearerSecret(token: string | undefined, secret: string): void {
  const stripped = token?.replace(/^Bearer\s+/i, "");
  if (!stripped || !timingSafeCompare(stripped, secret)) {
    throw badRequest("Invalid bearer token");
  }
}

export interface VerifyHmacArgs {
  /** Hex-encoded HMAC-SHA256 signature provided by the caller. */
  signature: string | undefined;
  /** Unix-epoch seconds string the caller signed alongside the body. */
  timestamp: string | undefined;
  /** Raw request body — verbatim, no JSON re-serialisation allowed. */
  rawBody: string;
  /** Plaintext webhook secret (post-decrypt). */
  secret: string;
  /**
   * Replay window in seconds. The signed timestamp must be within
   * ±replayWindowSec of `now`, otherwise the request is rejected.
   * Default 300 (5 min). Pass an env override at call site if needed.
   */
  replayWindowSec?: number;
  /** Override clock for tests. Defaults to `Date.now()`. */
  now?: () => number;
}

/**
 * Verify an HMAC-SHA256 signature against `${timestamp}.${rawBody}` keyed
 * with `secret`. Replays outside the window throw, missing headers
 * throw, signature mismatch throws — all via `badRequest` so the route
 * layer never has to map error shapes.
 */
export function verifyHmacSignature(args: VerifyHmacArgs): void {
  if (!args.signature || !args.timestamp) {
    throw badRequest("Missing signature or timestamp headers");
  }

  const tsNumber = parseInt(args.timestamp, 10);
  if (!Number.isFinite(tsNumber)) {
    throw badRequest("Invalid timestamp header");
  }
  const windowSec = args.replayWindowSec ?? 300;
  const nowSec = Math.floor((args.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - tsNumber) > windowSec) {
    throw badRequest("Timestamp outside replay window");
  }

  const expected = crypto
    .createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${args.rawBody}`)
    .digest("hex");

  if (!timingSafeCompare(args.signature, expected)) {
    throw badRequest("Invalid HMAC signature");
  }
}
