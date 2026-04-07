import { and, eq, lt } from "drizzle-orm";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Db } from "@mnm/db";
import { userCredentials } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { auditService } from "./audit.js";

// ─── Encryption ───────────────────────────────────────────────────────────────

interface EncryptedMaterial {
  iv: string;        // hex
  ciphertext: string; // hex
  tag: string;       // hex
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
  // Dev fallback: random key per process (credentials won't survive restarts)
  logger.warn("[credential] MNM_SECRETS_KEY not set — using ephemeral dev key");
  return randomBytes(32);
}

// Singleton key loaded once at service startup
const ENCRYPTION_KEY = loadEncryptionKey();

function encrypt(plaintext: string): EncryptedMaterial {
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

function decrypt(material: EncryptedMaterial): string {
  const iv = Buffer.from(material.iv, "hex");
  const ciphertext = Buffer.from(material.ciphertext, "hex");
  const tag = Buffer.from(material.tag, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── Service ──────────────────────────────────────────────────────────────────

export function credentialService(db: Db) {
  const audit = auditService(db);

  /**
   * Store (or update) a credential for the given user+item.
   * The material is encrypted with AES-256-GCM before storage.
   */
  async function storeCredential(
    userId: string,
    companyId: string,
    itemId: string,
    provider: string,
    material: Record<string, unknown>,
    expiresAt?: Date,
  ): Promise<void> {
    const encryptedMaterial = encrypt(JSON.stringify(material));

    await db
      .insert(userCredentials)
      .values({
        userId,
        companyId,
        itemId,
        provider,
        material: encryptedMaterial as unknown as Record<string, unknown>,
        status: "connected",
        connectedAt: new Date(),
        expiresAt: expiresAt ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          userCredentials.userId,
          userCredentials.companyId,
          userCredentials.itemId,
        ],
        set: {
          provider,
          material: encryptedMaterial as unknown as Record<string, unknown>,
          status: "connected",
          connectedAt: new Date(),
          expiresAt: expiresAt ?? null,
          updatedAt: new Date(),
        },
      });

    await audit.emit({
      companyId,
      actorId: userId,
      actorType: "user",
      action: "credential.stored",
      targetType: "credential",
      targetId: itemId,
      metadata: { provider },
      severity: "info",
    });

    logger.debug({ userId, companyId, itemId, provider }, "[credential] credential stored");
  }

  /**
   * Load and decrypt a credential's material.
   * Returns null if not found or decryption fails.
   */
  async function getDecryptedMaterial(
    userId: string,
    companyId: string,
    itemId: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await db
      .select()
      .from(userCredentials)
      .where(
        and(
          eq(userCredentials.userId, userId),
          eq(userCredentials.companyId, companyId),
          eq(userCredentials.itemId, itemId),
          eq(userCredentials.status, "connected"),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!row) return null;

    try {
      const encMaterial = row.material as unknown as EncryptedMaterial;
      const plaintext = decrypt(encMaterial);
      return JSON.parse(plaintext) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err, userId, companyId, itemId }, "[credential] decryption failed");

      await audit.emit({
        companyId,
        actorId: userId,
        actorType: "user",
        action: "credential.decrypt_failed",
        targetType: "credential",
        targetId: itemId,
        metadata: { error: "decryption_failed" },
        severity: "warning",
      });

      return null;
    }
  }

  /**
   * List credentials for a user in a company — without decrypted material.
   */
  async function listUserCredentials(userId: string, companyId: string) {
    return db
      .select({
        id: userCredentials.id,
        userId: userCredentials.userId,
        companyId: userCredentials.companyId,
        itemId: userCredentials.itemId,
        provider: userCredentials.provider,
        status: userCredentials.status,
        statusMessage: userCredentials.statusMessage,
        connectedAt: userCredentials.connectedAt,
        expiresAt: userCredentials.expiresAt,
        updatedAt: userCredentials.updatedAt,
      })
      .from(userCredentials)
      .where(
        and(
          eq(userCredentials.userId, userId),
          eq(userCredentials.companyId, companyId),
        ),
      );
  }

  /**
   * Revoke a credential — clears material and sets status=revoked.
   */
  async function revoke(
    credentialId: string,
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const row = await db
      .select({ id: userCredentials.id, itemId: userCredentials.itemId })
      .from(userCredentials)
      .where(
        and(
          eq(userCredentials.id, credentialId),
          eq(userCredentials.userId, userId),
          eq(userCredentials.companyId, companyId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!row) return false;

    await db
      .update(userCredentials)
      .set({
        material: {} as Record<string, unknown>,
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.id, credentialId));

    await audit.emit({
      companyId,
      actorId: userId,
      actorType: "user",
      action: "credential.revoked",
      targetType: "credential",
      targetId: row.itemId,
      metadata: { credentialId },
      severity: "info",
    });

    logger.debug({ credentialId, userId, companyId }, "[credential] credential revoked");
    return true;
  }

  /**
   * Scan for credentials expiring within 15 minutes and log a warning.
   * Token refresh is not yet implemented — this is a placeholder hook.
   */
  async function refreshExpiring(): Promise<void> {
    const threshold = new Date(Date.now() + 15 * 60 * 1000);

    const expiring = await db
      .select({
        id: userCredentials.id,
        userId: userCredentials.userId,
        companyId: userCredentials.companyId,
        itemId: userCredentials.itemId,
        provider: userCredentials.provider,
        expiresAt: userCredentials.expiresAt,
      })
      .from(userCredentials)
      .where(
        and(
          eq(userCredentials.status, "connected"),
          lt(userCredentials.expiresAt, threshold),
        ),
      );

    for (const cred of expiring) {
      logger.warn(
        { credentialId: cred.id, userId: cred.userId, itemId: cred.itemId, expiresAt: cred.expiresAt },
        "[credential] credential expiring soon — token refresh not yet implemented",
      );
    }
  }

  return {
    storeCredential,
    getDecryptedMaterial,
    listUserCredentials,
    revoke,
    refreshExpiring,
  };
}
