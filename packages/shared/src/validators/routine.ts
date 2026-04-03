import { z } from "zod";

// ── Variable schema ──────────────────────────────────────────────
const routineVariableSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  label: z.string().max(128).nullable().default(null),
  type: z.enum(["text", "textarea", "number", "boolean", "select"]).default("text"),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).default(null),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
});

// ── Routine CRUD ─────────────────────────────────────────────────
export const createRoutineSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  parentIssueId: z.string().uuid().nullable().optional(),
  assigneeAgentId: z.string().uuid(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("medium"),
  status: z.enum(["active", "paused"]).default("active"),
  concurrencyPolicy: z.enum(["coalesce_if_active", "skip_if_active", "always_enqueue"]).default("coalesce_if_active"),
  catchUpPolicy: z.enum(["skip_missed", "enqueue_missed_with_cap"]).default("skip_missed"),
  variables: z.array(routineVariableSchema).max(20).default([]),
});
export type CreateRoutine = z.infer<typeof createRoutineSchema>;

export const updateRoutineSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  parentIssueId: z.string().uuid().nullable().optional(),
  assigneeAgentId: z.string().uuid().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  concurrencyPolicy: z.enum(["coalesce_if_active", "skip_if_active", "always_enqueue"]).optional(),
  catchUpPolicy: z.enum(["skip_missed", "enqueue_missed_with_cap"]).optional(),
  variables: z.array(routineVariableSchema).max(20).optional(),
});
export type UpdateRoutine = z.infer<typeof updateRoutineSchema>;

// ── Trigger CRUD ─────────────────────────────────────────────────
export const createRoutineTriggerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("schedule"),
    label: z.string().max(128).nullable().optional(),
    cronExpression: z.string().min(9).max(128),
    timezone: z.string().max(64).default("UTC"),
  }),
  z.object({
    kind: z.literal("webhook"),
    label: z.string().max(128).nullable().optional(),
    signingMode: z.enum(["bearer", "hmac_sha256"]).default("bearer"),
    replayWindowSec: z.number().int().min(30).max(86400).default(300),
  }),
  z.object({
    kind: z.literal("api"),
    label: z.string().max(128).nullable().optional(),
  }),
]);
export type CreateRoutineTrigger = z.infer<typeof createRoutineTriggerSchema>;

export const updateRoutineTriggerSchema = z.object({
  label: z.string().max(128).nullable().optional(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().min(9).max(128).optional(),
  timezone: z.string().max(64).optional(),
  signingMode: z.enum(["bearer", "hmac_sha256"]).optional(),
  replayWindowSec: z.number().int().min(30).max(86400).optional(),
});
export type UpdateRoutineTrigger = z.infer<typeof updateRoutineTriggerSchema>;

// ── Run ──────────────────────────────────────────────────────────
export const runRoutineSchema = z.object({
  source: z.enum(["manual", "api"]).default("manual"),
  triggerId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
  variables: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(256).optional(),
});
export type RunRoutine = z.infer<typeof runRoutineSchema>;

// ── Variable utilities (from upstream routine-variables.ts) ──────
const ROUTINE_VARIABLE_MATCHER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function extractRoutineVariableNames(template: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of template.matchAll(ROUTINE_VARIABLE_MATCHER)) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function syncRoutineVariablesWithTemplate(
  template: string,
  existing: z.infer<typeof routineVariableSchema>[] | null,
): z.infer<typeof routineVariableSchema>[] {
  const names = extractRoutineVariableNames(template);
  const existingByName = new Map((existing ?? []).map((v) => [v.name, v]));
  return names.map((name) => {
    const prev = existingByName.get(name);
    return prev ?? { name, label: null, type: "text" as const, defaultValue: null, required: false, options: [] };
  });
}

export function interpolateRoutineTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  return template.replace(ROUTINE_VARIABLE_MATCHER, (match, rawName: string) => {
    if (!(rawName in values)) return match;
    const val = values[rawName];
    if (val == null) return "";
    return String(val);
  });
}

export function resolveRoutineVariableValues(
  variables: z.infer<typeof routineVariableSchema>[],
  input: { payload?: Record<string, unknown> | null; variables?: Record<string, unknown> | null },
): Record<string, string | number | boolean> {
  const provided: Record<string, unknown> = { ...input.payload, ...input.variables };
  const resolved: Record<string, string | number | boolean> = {};
  const missing: string[] = [];

  for (const v of variables) {
    const raw = provided[v.name] !== undefined ? provided[v.name] : v.defaultValue;
    if (raw == null || raw === "") {
      if (v.required) missing.push(v.name);
      continue;
    }
    if (v.type === "number") {
      resolved[v.name] = Number(raw);
    } else if (v.type === "boolean") {
      resolved[v.name] = raw === true || raw === "true";
    } else {
      resolved[v.name] = String(raw);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required routine variables: ${missing.join(", ")}`);
  }
  return resolved;
}
