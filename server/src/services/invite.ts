import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { invites } from "@mnm/db";
import { conflict } from "../errors.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const INVITE_TOKEN_PREFIX = "pcp_invite_";
const INVITE_TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const INVITE_TOKEN_SUFFIX_LENGTH = 8;
const INVITE_TOKEN_MAX_RETRIES = 5;
const COMPANY_INVITE_TTL_MS = 10 * 60 * 1000;
const EMAIL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  const bytes = randomBytes(INVITE_TOKEN_SUFFIX_LENGTH);
  let suffix = "";
  for (let idx = 0; idx < INVITE_TOKEN_SUFFIX_LENGTH; idx += 1) {
    suffix += INVITE_TOKEN_ALPHABET[bytes[idx]! % INVITE_TOKEN_ALPHABET.length];
  }
  return `${INVITE_TOKEN_PREFIX}${suffix}`;
}

export function companyInviteExpiresAt(nowMs: number = Date.now(), ttlMs: number = COMPANY_INVITE_TTL_MS) {
  return new Date(nowMs + ttlMs);
}

export function inviteExpired(invite: typeof invites.$inferSelect) {
  return invite.expiresAt.getTime() <= Date.now();
}

function isInviteTokenHashCollisionError(error: unknown) {
  const candidates = [
    error,
    (error as { cause?: unknown } | null)?.cause ?? null,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const code =
      "code" in candidate && typeof candidate.code === "string"
        ? candidate.code
        : null;
    const message =
      "message" in candidate && typeof candidate.message === "string"
        ? candidate.message
        : "";
    const constraint =
      "constraint" in candidate && typeof candidate.constraint === "string"
        ? candidate.constraint
        : null;
    if (code !== "23505") continue;
    if (constraint === "invites_token_hash_unique_idx") return true;
    if (message.includes("invites_token_hash_unique_idx")) return true;
  }
  return false;
}

function mergeInviteDefaults(
  defaultsPayload: Record<string, unknown> | null | undefined,
  agentMessage: string | null,
): Record<string, unknown> | null {
  const merged =
    defaultsPayload && typeof defaultsPayload === "object"
      ? { ...defaultsPayload }
      : {};
  if (agentMessage) {
    merged.agentMessage = agentMessage;
  }
  return Object.keys(merged).length ? merged : null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type InviteRecord = typeof invites.$inferSelect;

export interface InviteCreateInput {
  companyId: string;
  allowedJoinTypes: "human" | "agent" | "both";
  defaultsPayload?: Record<string, unknown> | null;
  agentMessage?: string | null;
  targetEmail?: string | null;
  invitedByUserId?: string | null;
}

export interface InviteCreateResult {
  token: string;
  created: InviteRecord;
  normalizedAgentMessage: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export function inviteService(db: Db) {
  return {
    async create(input: InviteCreateInput): Promise<InviteCreateResult> {
      const normalizedAgentMessage =
        typeof input.agentMessage === "string"
          ? input.agentMessage.trim() || null
          : null;
      const ttl = input.targetEmail ? EMAIL_INVITE_TTL_MS : COMPANY_INVITE_TTL_MS;
      const insertValues = {
        companyId: input.companyId,
        inviteType: "company_join" as const,
        allowedJoinTypes: input.allowedJoinTypes,
        defaultsPayload: mergeInviteDefaults(
          input.defaultsPayload ?? null,
          normalizedAgentMessage,
        ),
        targetEmail: input.targetEmail ?? null,
        expiresAt: companyInviteExpiresAt(Date.now(), ttl),
        invitedByUserId: input.invitedByUserId ?? null,
      };

      let token: string | null = null;
      let created: InviteRecord | null = null;
      for (let attempt = 0; attempt < INVITE_TOKEN_MAX_RETRIES; attempt += 1) {
        const candidateToken = createInviteToken();
        try {
          const row = await db
            .insert(invites)
            .values({
              ...insertValues,
              tokenHash: hashToken(candidateToken),
            })
            .returning()
            .then((rows) => rows[0]);
          token = candidateToken;
          created = row;
          break;
        } catch (error) {
          if (!isInviteTokenHashCollisionError(error)) {
            throw error;
          }
        }
      }
      if (!token || !created) {
        throw conflict("Failed to generate a unique invite token. Please retry.");
      }

      return { token, created, normalizedAgentMessage };
    },

    async getByToken(token: string): Promise<InviteRecord | null> {
      return db
        .select()
        .from(invites)
        .where(eq(invites.tokenHash, hashToken(token)))
        .then((rows) => rows[0] ?? null);
    },

    async listByCompany(companyId: string): Promise<InviteRecord[]> {
      return db
        .select()
        .from(invites)
        .where(eq(invites.companyId, companyId))
        .orderBy(desc(invites.createdAt));
    },

    async hasPendingInviteForEmail(companyId: string, email: string): Promise<boolean> {
      const now = new Date();
      const existing = await db
        .select({ id: invites.id })
        .from(invites)
        .where(
          and(
            eq(invites.companyId, companyId),
            eq(invites.targetEmail, email),
            isNull(invites.revokedAt),
            isNull(invites.acceptedAt),
            gt(invites.expiresAt, now),
          ),
        )
        .then((rows) => rows[0] ?? null);
      return existing !== null;
    },

    async revoke(inviteId: string): Promise<InviteRecord | null> {
      return db
        .update(invites)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(invites.id, inviteId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },
  };
}
