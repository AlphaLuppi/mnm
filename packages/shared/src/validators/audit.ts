import { z } from "zod";
import { AUDIT_ACTOR_TYPES, AUDIT_SEVERITY_LEVELS } from "../types/audit.js";

export const auditEventFiltersSchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPES).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  severity: z.enum(AUDIT_SEVERITY_LEVELS).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export type AuditEventFilters = z.infer<typeof auditEventFiltersSchema>;

export const auditExportFiltersSchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPES).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  severity: z.enum(AUDIT_SEVERITY_LEVELS).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
}).strict();

export type AuditExportFilters = z.infer<typeof auditExportFiltersSchema>;

export const auditVerifySchema = z.object({
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
}).strict();

export type AuditVerifyParams = z.infer<typeof auditVerifySchema>;
