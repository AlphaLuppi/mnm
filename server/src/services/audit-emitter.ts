import type { Request } from "express";
import type { Db } from "@mnm/db";
import type { AuditSeverity } from "@mnm/shared";
import { auditService } from "./audit.js";

export interface EmitAuditParams {
  req: Request;
  db: Db;
  companyId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}

/**
 * Emit an immutable audit event from a route handler.
 * Extracts actor info from req.actor, IP from req, user-agent from headers.
 * Non-blocking: errors are logged but do not fail the request.
 */
export async function emitAudit(params: EmitAuditParams): Promise<void> {
  const { req, db, companyId, action, targetType, targetId, metadata, severity } = params;

  try {
    const svc = auditService(db);

    const actorType = req.actor.type === "agent" ? "agent" as const
      : req.actor.type === "board" ? "user" as const
      : "system" as const;

    const actorId = req.actor.type === "agent"
      ? (req.actor.agentId ?? "unknown-agent")
      : req.actor.type === "board"
        ? (req.actor.userId ?? "unknown-user")
        : "system";

    await svc.emit({
      companyId,
      actorId,
      actorType,
      action,
      targetType,
      targetId,
      metadata: metadata ?? null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: req.get("user-agent") ?? null,
      severity: severity ?? "info",
    });
  } catch (err) {
    // Audit emission must NEVER fail the business operation.
    // Log the error but do not rethrow.
    console.error("[audit-emitter] Failed to emit audit event:", action, err);
  }
}
