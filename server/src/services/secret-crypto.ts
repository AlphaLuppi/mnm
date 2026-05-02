import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "../middleware/logger.js";

export interface EncryptedMaterial {
  iv: string;
  ciphertext: string;
  tag: string;
}

function loadEncryptionKey(): Buffer {
  const envKey = process.env.MNM_SECRETS_KEY;
  if (envKey && envKey.trim().length > 0) {
    const trimmed = envKey.trim();
    if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, "hex");
    }
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) return decoded;
    throw new Error("MNM_SECRETS_KEY must be a 32-byte hex (64 chars) or base64 value");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: MNM_SECRETS_KEY must be set in production — credentials cannot be encrypted without it",
    );
  }
  logger.warn("[secret-crypto] MNM_SECRETS_KEY not set — using ephemeral dev key");
  return randomBytes(32);
}

const ENCRYPTION_KEY = loadEncryptionKey();

export function encryptSecret(plaintext: string): EncryptedMaterial {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const cipherBuf = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    ciphertext: cipherBuf.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptSecret(material: EncryptedMaterial): string {
  const iv = Buffer.from(material.iv, "hex");
  const ciphertext = Buffer.from(material.ciphertext, "hex");
  const tag = Buffer.from(material.tag, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
