import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "../secret-crypto.js";

describe("secret-crypto", () => {
  it("roundtrip — encrypt then decrypt returns the original plaintext", () => {
    const plaintext = "very-secret-token-abcd1234";
    const enc = encryptSecret(plaintext);
    expect(decryptSecret(enc)).toBe(plaintext);
  });

  it("ciphertext is never the plaintext (C1 invariant)", () => {
    const plaintext = "test-access-token-xyz";
    const enc = encryptSecret(plaintext);
    expect(enc.ciphertext).not.toBe(plaintext);
    expect(enc.ciphertext).not.toContain(plaintext);
    // hex output expected (only 0-9a-f), never raw text
    expect(enc.iv).toMatch(/^[0-9a-f]+$/);
    expect(enc.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(enc.tag).toMatch(/^[0-9a-f]+$/);
  });

  it("two consecutive encrypts of the same plaintext yield different ciphertexts (random IV)", () => {
    const plaintext = "deterministic-input";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);
    // IV randomness: must differ
    expect(a.iv).not.toBe(b.iv);
    // Ciphertext must differ as a consequence
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // But both decrypt to the same plaintext
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  it("decrypt fails (throws) when tag is tampered", () => {
    const plaintext = "tamper-test";
    const enc = encryptSecret(plaintext);
    // Flip a hex char in the auth tag
    const tampered = {
      ...enc,
      tag: enc.tag.slice(0, -1) + (enc.tag.endsWith("0") ? "1" : "0"),
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("decrypt fails when ciphertext is tampered (AES-GCM auth)", () => {
    const plaintext = "tamper-test-2";
    const enc = encryptSecret(plaintext);
    const tampered = {
      ...enc,
      ciphertext: enc.ciphertext.slice(0, -2) + "00",
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
