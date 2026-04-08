export const MCP_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type McpErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];

export interface McpErrorPayload {
  error: string;
  code: McpErrorCode;
  retryable: boolean;
  hint?: string;
  /** Field-level validation errors (for VALIDATION_ERROR code). */
  details?: Array<{ field: string; message: string }>;
  /** Milliseconds to wait before retrying (for RATE_LIMITED code). */
  retryAfterMs?: number;
}
