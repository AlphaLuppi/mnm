export class MnMError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MnMError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class AgentError extends MnMError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "AgentError";
  }

  static notFound(id: string) {
    return new AgentError(`Agent not found: ${id}`, "AGENT_NOT_FOUND", { agentId: id });
  }

  static alreadyRunning(id: string) {
    return new AgentError(`Agent already running: ${id}`, "AGENT_ALREADY_RUNNING", { agentId: id });
  }

  static spawnFailed(reason: string) {
    return new AgentError(`Subprocess spawn failed: ${reason}`, "SPAWN_FAILED");
  }
}

export class LockConflictError extends MnMError {
  constructor(filePath: string, lockedByAgentId: string) {
    super(
      `File ${filePath} is locked by agent ${lockedByAgentId}`,
      "LOCK_CONFLICT",
      { filePath, lockedByAgentId }
    );
    this.name = "LockConflictError";
  }
}

export class DriftError extends MnMError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "DriftError";
  }

  static apiError(reason: string) {
    return new DriftError(`Claude API error: ${reason}`, "API_ERROR");
  }

  static invalidResponse(reason: string) {
    return new DriftError(`Invalid drift response: ${reason}`, "INVALID_RESPONSE");
  }

  static specNotFound(specId: string) {
    return new DriftError(`Spec not found: ${specId}`, "SPEC_NOT_FOUND", { specId });
  }
}

export class GitError extends MnMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "GIT_ERROR", details);
    this.name = "GitError";
  }
}

export class DatabaseError extends MnMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DATABASE_ERROR", details);
    this.name = "DatabaseError";
  }
}
