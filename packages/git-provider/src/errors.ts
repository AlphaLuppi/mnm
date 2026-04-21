/**
 * Closed-set error codes returned by every GitProvider implementation.
 * Callers (gate runner, MCP orchestrator) pattern-match on `.code` to decide
 * retry vs surface-to-user vs fail-closed.
 */
export const GIT_PROVIDER_ERROR_CODES = Object.freeze({
  not_found: "not_found",
  unauthorized: "unauthorized",
  rate_limited: "rate_limited",
  timeout: "timeout",
  network: "network",
  conflict: "conflict",
  unknown: "unknown",
} as const);

export type GitProviderErrorCode =
  (typeof GIT_PROVIDER_ERROR_CODES)[keyof typeof GIT_PROVIDER_ERROR_CODES];

export interface GitProviderErrorOptions {
  status?: number;
  cause?: unknown;
}

export class GitProviderError extends Error {
  readonly code: GitProviderErrorCode;
  readonly status: number | undefined;

  constructor(
    code: GitProviderErrorCode,
    message: string,
    options: GitProviderErrorOptions = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "GitProviderError";
    this.code = code;
    this.status = options.status;
  }
}
