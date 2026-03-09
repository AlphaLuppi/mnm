import { describe, it, expect } from "vitest";
import {
  MnMError,
  AgentError,
  LockConflictError,
  DriftError,
  GitError,
  DatabaseError,
} from "@/lib/core/errors";

describe("Error hierarchy", () => {
  it("MnMError serializes to JSON", () => {
    const err = new MnMError("test error", "TEST_CODE", { key: "val" });
    expect(err.toJSON()).toEqual({
      error: {
        code: "TEST_CODE",
        message: "test error",
        details: { key: "val" },
      },
    });
  });

  it("AgentError.notFound creates correct error", () => {
    const err = AgentError.notFound("agent-123");
    expect(err).toBeInstanceOf(AgentError);
    expect(err).toBeInstanceOf(MnMError);
    expect(err.code).toBe("AGENT_NOT_FOUND");
    expect(err.message).toContain("agent-123");
  });

  it("AgentError.alreadyRunning creates correct error", () => {
    const err = AgentError.alreadyRunning("agent-456");
    expect(err.code).toBe("AGENT_ALREADY_RUNNING");
  });

  it("AgentError.spawnFailed creates correct error", () => {
    const err = AgentError.spawnFailed("binary not found");
    expect(err.code).toBe("SPAWN_FAILED");
    expect(err.message).toContain("binary not found");
  });

  it("LockConflictError includes file and agent details", () => {
    const err = new LockConflictError("src/main.ts", "agent-789");
    expect(err).toBeInstanceOf(MnMError);
    expect(err.code).toBe("LOCK_CONFLICT");
    expect(err.details).toEqual({
      filePath: "src/main.ts",
      lockedByAgentId: "agent-789",
    });
  });

  it("DriftError factory methods work", () => {
    const apiErr = DriftError.apiError("timeout");
    expect(apiErr.code).toBe("API_ERROR");

    const invalidErr = DriftError.invalidResponse("missing field");
    expect(invalidErr.code).toBe("INVALID_RESPONSE");

    const notFoundErr = DriftError.specNotFound("spec-123");
    expect(notFoundErr.code).toBe("SPEC_NOT_FOUND");
  });

  it("GitError and DatabaseError extend MnMError", () => {
    const gitErr = new GitError("repo not found");
    expect(gitErr).toBeInstanceOf(MnMError);
    expect(gitErr.code).toBe("GIT_ERROR");

    const dbErr = new DatabaseError("connection failed");
    expect(dbErr).toBeInstanceOf(MnMError);
    expect(dbErr.code).toBe("DATABASE_ERROR");
  });
});
