import { z, type RefinementCtx } from "zod";

// ─── Constants ───────────────────────────────────────────────────────────────

export const CONFIG_LAYER_ITEM_TYPES = ["mcp", "skill", "hook", "setting"] as const;
export const CONFIG_LAYER_SCOPES = ["company", "shared", "private"] as const;
export const CONFIG_LAYER_VISIBILITIES = ["public", "team", "private"] as const;
export const CONFIG_LAYER_SOURCE_TYPES = ["inline", "url", "git"] as const;
export const CONFIG_LAYER_CHANGE_SOURCES = [
  "ui",
  "api",
  "import",
  "promotion",
  "system",
  "migration",
] as const;
export const MCP_CREDENTIAL_PROVIDERS = [
  "oauth2",
  "api_key",
  "bearer",
  "custom",
] as const;
export const MCP_CREDENTIAL_STATUSES = [
  "pending",
  "connected",
  "expired",
  "revoked",
  "error",
] as const;
export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PreSubagentStart",
  "PostSubagentComplete",
  "Notification",
  "Stop",
  "SubagentStop",
  "SessionStart",
  "SessionEnd",
  "PreCompact",
  "PostCompact",
  "PrePlanModeActivation",
  "PostPlanModeActivation",
  "PrePlanModeDeactivation",
  "PostPlanModeDeactivation",
  "PreEdit",
  "PostEdit",
  "PreWrite",
  "PostWrite",
  "PreBash",
  "PostBash",
  "PreNotebookEdit",
  "PostNotebookEdit",
  "McpToolResult",
] as const;
export const HOOK_TYPES = ["command", "http", "prompt", "agent"] as const;
export const SETTING_KEYS = [
  "model",
  "cwd",
  "thinkingEffort",
  "timeoutSec",
  "heartbeat.intervalSec",
  "heartbeat.maxRetries",
  "chrome.enabled",
  "chrome.headless",
] as const;

// ─── Item-type config schemas ─────────────────────────────────────────────────

export const mcpItemConfigSchema = z.object({
  type: z.enum(["http", "stdio", "sse"]),
  url: z.string().url().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  oauth: z.record(z.unknown()).optional(),
});

export type McpItemConfig = z.infer<typeof mcpItemConfigSchema>;

export const skillItemConfigSchema = z.object({
  frontmatter: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      "allowed-tools": z.array(z.string()).optional(),
    })
    .optional(),
  content: z.string(),
});

export type SkillItemConfig = z.infer<typeof skillItemConfigSchema>;

export const hookItemConfigSchema = z
  .object({
    event: z.enum(HOOK_EVENTS),
    matcher: z.string().optional(),
    hookType: z.enum(HOOK_TYPES),
    command: z.string().optional(),
    url: z.string().url().optional(),
    prompt: z.string().optional(),
    timeout: z.number().int().positive().optional(),
    async: z.boolean().optional(),
    once: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.hookType === "command" && !value.command) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "command is required when hookType is 'command'",
        path: ["command"],
      });
    }
    if (value.hookType === "http" && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "url is required when hookType is 'http'",
        path: ["url"],
      });
    }
    if (
      (value.hookType === "prompt" || value.hookType === "agent") &&
      !value.prompt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "prompt is required when hookType is 'prompt' or 'agent'",
        path: ["prompt"],
      });
    }
  });

export type HookItemConfig = z.infer<typeof hookItemConfigSchema>;

export const settingItemConfigSchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.unknown(),
});

export type SettingItemConfig = z.infer<typeof settingItemConfigSchema>;

// ─── CRUD schemas ─────────────────────────────────────────────────────────────

export const createConfigLayerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  scope: z.enum(CONFIG_LAYER_SCOPES),
  enforced: z.boolean().optional().default(false),
  visibility: z.enum(CONFIG_LAYER_VISIBILITIES).optional().default("public"),
});

export type CreateConfigLayer = z.infer<typeof createConfigLayerSchema>;

export const updateConfigLayerSchema = createConfigLayerSchema
  .omit({ scope: true })
  .partial();

export type UpdateConfigLayer = z.infer<typeof updateConfigLayerSchema>;

export const createConfigLayerItemSchema = z.object({
  itemType: z.enum(CONFIG_LAYER_ITEM_TYPES),
  name: z.string().min(1).max(100),
  displayName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  configJson: z.record(z.unknown()).optional().default({}),
  sourceType: z.enum(CONFIG_LAYER_SOURCE_TYPES).optional().default("inline"),
  sourceUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().optional().default(true),
});

export type CreateConfigLayerItem = z.infer<typeof createConfigLayerItemSchema>;

export const updateConfigLayerItemSchema = createConfigLayerItemSchema
  .omit({ itemType: true })
  .partial();

export type UpdateConfigLayerItem = z.infer<typeof updateConfigLayerItemSchema>;

export const createConfigLayerFileSchema = z.object({
  path: z
    .string()
    .regex(/^[a-zA-Z0-9_\-/.]+$/, "path must contain only alphanumeric, underscore, hyphen, dot, or slash characters"),
  content: z
    .string()
    .max(1024 * 1024, "content must not exceed 1MB"),
});

export type CreateConfigLayerFile = z.infer<typeof createConfigLayerFileSchema>;

export const attachConfigLayerSchema = z.object({
  layerId: z.string().uuid(),
  priority: z.number().int().min(0).max(498),
});

export type AttachConfigLayer = z.infer<typeof attachConfigLayerSchema>;

export const approvePromotionSchema = z.object({
  expectedContentHash: z.string(),
});

export type ApprovePromotion = z.infer<typeof approvePromotionSchema>;

export const rejectPromotionSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type RejectPromotion = z.infer<typeof rejectPromotionSchema>;
