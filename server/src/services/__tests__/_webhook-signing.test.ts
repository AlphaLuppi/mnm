import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import {
  encryptWebhookSecret,
  decryptWebhookSecret,
  generateWebhookSecret,
  generatePublicId,
  verifyBearerSecret,
  verifyHmacSignature,
  timingSafeCompare,
} from "../_webhook-signing.js";

beforeAll(() => {
  // Deterministic master key for tests. 32 bytes hex = 64 chars.
  process.env.MNM_SECRETS_MASTER_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("_webhook-signing / encryption round-trip", () => {
  it("encrypts and decrypts a plaintext secret", () => {
    const plain = "super-secret-value-42";
    const encrypted = encryptWebhookSecret(plain);
    expect(encrypted.startsWith("enc:")).toBe(true);
    expect(decryptWebhookSecret(encrypted)).toBe(plain);
  });

  it("returns legacy plaintext rows verbatim (no enc: prefix)", () => {
    const legacy = "legacy-plaintext-secret";
    expect(decryptWebhookSecret(legacy)).toBe(legacy);
  });

  it("yields a different ciphertext on each encrypt (random IV)", () => {
    const a = encryptWebhookSecret("same-input");
    const b = encryptWebhookSecret("same-input");
    expect(a).not.toBe(b);
    expect(decryptWebhookSecret(a)).toBe("same-input");
    expect(decryptWebhookSecret(b)).toBe("same-input");
  });
});

describe("_webhook-signing / generators", () => {
  it("generateWebhookSecret returns 64-char hex (32 bytes)", () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generatePublicId returns 32-char hex (16 bytes)", () => {
    const id = generatePublicId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("_webhook-signing / timingSafeCompare", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeCompare("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeCompare("abc", "xyz")).toBe(false);
  });

  it("returns false for length mismatch (does not throw)", () => {
    expect(timingSafeCompare("abc", "abcd")).toBe(false);
  });
});

describe("_webhook-signing / verifyBearerSecret", () => {
  const secret = "bearer-secret-1234567890abcdef";

  it("accepts a valid Bearer header", () => {
    expect(() => verifyBearerSecret(`Bearer ${secret}`, secret)).not.toThrow();
  });

  it("accepts a case-insensitive Bearer prefix", () => {
    expect(() => verifyBearerSecret(`bearer ${secret}`, secret)).not.toThrow();
  });

  it("rejects a missing header", () => {
    expect(() => verifyBearerSecret(undefined, secret)).toThrow(/bearer/i);
  });

  it("rejects an empty token after prefix strip", () => {
    expect(() => verifyBearerSecret("Bearer ", secret)).toThrow(/bearer/i);
  });

  it("rejects a wrong token", () => {
    expect(() => verifyBearerSecret("Bearer wrong-value", secret)).toThrow(/bearer/i);
  });
});

describe("_webhook-signing / verifyHmacSignature", () => {
  const secret = "hmac-secret-abcdef0123456789abcdef0123456789";
  const rawBody = `{"hello":"world"}`;

  function signedAt(unixSec: number) {
    const ts = String(unixSec);
    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    return { ts, sig };
  }

  it("accepts a valid signature within the replay window", () => {
    const now = 1_785_000_000;
    const { ts, sig } = signedAt(now);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: ts,
        rawBody,
        secret,
        replayWindowSec: 60,
        now: () => now * 1000,
      }),
    ).not.toThrow();
  });

  it("rejects a missing signature header", () => {
    const now = 1_785_000_000;
    const { ts } = signedAt(now);
    expect(() =>
      verifyHmacSignature({
        signature: undefined,
        timestamp: ts,
        rawBody,
        secret,
        now: () => now * 1000,
      }),
    ).toThrow(/missing signature/i);
  });

  it("rejects a missing timestamp header", () => {
    const now = 1_785_000_000;
    const { sig } = signedAt(now);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: undefined,
        rawBody,
        secret,
        now: () => now * 1000,
      }),
    ).toThrow(/missing signature/i);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(() =>
      verifyHmacSignature({
        signature: "deadbeef",
        timestamp: "not-a-number",
        rawBody,
        secret,
      }),
    ).toThrow(/invalid timestamp/i);
  });

  it("rejects a timestamp outside the replay window (past)", () => {
    const now = 1_785_000_000;
    const past = now - 600;
    const { ts, sig } = signedAt(past);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: ts,
        rawBody,
        secret,
        replayWindowSec: 60,
        now: () => now * 1000,
      }),
    ).toThrow(/replay window/i);
  });

  it("rejects a timestamp outside the replay window (future)", () => {
    const now = 1_785_000_000;
    const future = now + 600;
    const { ts, sig } = signedAt(future);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: ts,
        rawBody,
        secret,
        replayWindowSec: 60,
        now: () => now * 1000,
      }),
    ).toThrow(/replay window/i);
  });

  it("rejects a signature signed with a different secret", () => {
    const now = 1_785_000_000;
    const ts = String(now);
    const wrongSig = crypto
      .createHmac("sha256", "different-secret")
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    expect(() =>
      verifyHmacSignature({
        signature: wrongSig,
        timestamp: ts,
        rawBody,
        secret,
        replayWindowSec: 60,
        now: () => now * 1000,
      }),
    ).toThrow(/invalid hmac/i);
  });

  it("rejects when the body has been tampered with", () => {
    const now = 1_785_000_000;
    const { ts, sig } = signedAt(now);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: ts,
        rawBody: rawBody + "\nINJECTED",
        secret,
        replayWindowSec: 60,
        now: () => now * 1000,
      }),
    ).toThrow(/invalid hmac/i);
  });

  it("uses the default 300s window when none is provided", () => {
    const now = 1_785_000_000;
    const inWindow = now - 200;
    const { ts, sig } = signedAt(inWindow);
    expect(() =>
      verifyHmacSignature({
        signature: sig,
        timestamp: ts,
        rawBody,
        secret,
        now: () => now * 1000,
      }),
    ).not.toThrow();
  });
});
