import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalAgentJwt, verifyLocalAgentJwt } from "../agent-auth-jwt.js";

describe("agent local JWT", () => {
  const secretEnv = "MNM_AGENT_JWT_SECRET";
  const ttlEnv = "MNM_AGENT_JWT_TTL_SECONDS";
  const issuerEnv = "MNM_AGENT_JWT_ISSUER";
  const audienceEnv = "MNM_AGENT_JWT_AUDIENCE";
  const betterAuthSecretEnv = "BETTER_AUTH_SECRET";
  const deploymentModeEnv = "MNM_DEPLOYMENT_MODE";

  const originalEnv = {
    secret: process.env[secretEnv],
    ttl: process.env[ttlEnv],
    issuer: process.env[issuerEnv],
    audience: process.env[audienceEnv],
    betterAuthSecret: process.env[betterAuthSecretEnv],
    deploymentMode: process.env[deploymentModeEnv],
  };

  beforeEach(() => {
    process.env[secretEnv] = "test-secret";
    process.env[ttlEnv] = "3600";
    delete process.env[issuerEnv];
    delete process.env[audienceEnv];
    delete process.env[betterAuthSecretEnv];
    delete process.env[deploymentModeEnv];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv.secret === undefined) delete process.env[secretEnv];
    else process.env[secretEnv] = originalEnv.secret;
    if (originalEnv.ttl === undefined) delete process.env[ttlEnv];
    else process.env[ttlEnv] = originalEnv.ttl;
    if (originalEnv.issuer === undefined) delete process.env[issuerEnv];
    else process.env[issuerEnv] = originalEnv.issuer;
    if (originalEnv.audience === undefined) delete process.env[audienceEnv];
    else process.env[audienceEnv] = originalEnv.audience;
    if (originalEnv.betterAuthSecret === undefined) delete process.env[betterAuthSecretEnv];
    else process.env[betterAuthSecretEnv] = originalEnv.betterAuthSecret;
    if (originalEnv.deploymentMode === undefined) delete process.env[deploymentModeEnv];
    else process.env[deploymentModeEnv] = originalEnv.deploymentMode;
  });

  it("creates and verifies a token", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    const claims = verifyLocalAgentJwt(token!);
    expect(claims).toMatchObject({
      sub: "agent-1",
      company_id: "company-1",
      adapter_type: "claude_local",
      run_id: "run-1",
      iss: "mnm-agent",
      aud: "mnm-mcp",
    });
  });

  it("uses mnm-dev-secret fallback in local_trusted when no secret env vars are set", () => {
    // beforeEach already deletes BETTER_AUTH_SECRET and MNM_DEPLOYMENT_MODE
    // (defaults to local_trusted). Setting MNM_AGENT_JWT_SECRET to "" simulates
    // the legacy "missing secret" condition; the dev fallback should kick in.
    process.env[secretEnv] = "";

    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    // Token must verify with the same dev fallback secret.
    const claims = verifyLocalAgentJwt(token!);
    expect(claims).toMatchObject({
      sub: "agent-1",
      company_id: "company-1",
    });

    // Garbage tokens still return null.
    expect(verifyLocalAgentJwt("abc.def.ghi")).toBeNull();
  });

  it("rejects expired tokens", () => {
    process.env[ttlEnv] = "1";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    expect(verifyLocalAgentJwt(token!)).toBeNull();
  });

  it("rejects issuer/audience mismatch", () => {
    process.env[issuerEnv] = "custom-issuer";
    process.env[audienceEnv] = "custom-audience";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "codex_local", "run-1");

    process.env[issuerEnv] = "mnm";
    process.env[audienceEnv] = "mnm-api";
    expect(verifyLocalAgentJwt(token!)).toBeNull();
  });

  // Regression for upstream Paperclip PR #2866 — fall back to BETTER_AUTH_SECRET
  // when MNM_AGENT_JWT_SECRET is absent. Operators only need to configure
  // one secret in production.
  it("falls back to BETTER_AUTH_SECRET when MNM_AGENT_JWT_SECRET is absent", () => {
    delete process.env[secretEnv];
    process.env[betterAuthSecretEnv] = "fallback-better-auth-secret";
    process.env[deploymentModeEnv] = "authenticated";

    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    const claims = verifyLocalAgentJwt(token!);
    expect(claims).toMatchObject({
      sub: "agent-1",
      company_id: "company-1",
      adapter_type: "claude_local",
      run_id: "run-1",
    });
  });

  it("throws when both MNM_AGENT_JWT_SECRET and BETTER_AUTH_SECRET are absent in authenticated mode", () => {
    delete process.env[secretEnv];
    delete process.env[betterAuthSecretEnv];
    process.env[deploymentModeEnv] = "authenticated";

    expect(() =>
      createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1"),
    ).toThrow(/MNM_AGENT_JWT_SECRET.*or BETTER_AUTH_SECRET.*non-local/);
  });

  it("prefers MNM_AGENT_JWT_SECRET over BETTER_AUTH_SECRET when both are set", () => {
    process.env[secretEnv] = "primary-secret";
    process.env[betterAuthSecretEnv] = "fallback-secret";
    process.env[deploymentModeEnv] = "authenticated";

    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    // Switch to BETTER_AUTH_SECRET only — token must NOT verify
    // (proves the primary was used for signing, not the fallback).
    delete process.env[secretEnv];
    expect(verifyLocalAgentJwt(token!)).toBeNull();

    // Restore the primary — token verifies.
    process.env[secretEnv] = "primary-secret";
    expect(verifyLocalAgentJwt(token!)).not.toBeNull();
  });
});
