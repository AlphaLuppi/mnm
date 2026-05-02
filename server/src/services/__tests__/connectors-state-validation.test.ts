import { describe, it, expect } from "vitest";
import {
  signConnectorState,
  verifyConnectorState,
  validateRedirectAfter,
} from "../connectors.js";

describe("connectors — state JWT (HS256, BETTER_AUTH_SECRET)", () => {
  it("sign then verify roundtrip preserves payload", async () => {
    const payload = {
      companyId: "00000000-0000-0000-0000-000000000001",
      connectorId: "00000000-0000-0000-0000-000000000002",
      userId: "user-abc-123",
      redirectAfter: "/settings/accounts",
    };
    const token = await signConnectorState(payload);
    const verified = await verifyConnectorState(token);
    expect(verified.companyId).toBe(payload.companyId);
    expect(verified.connectorId).toBe(payload.connectorId);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.redirectAfter).toBe(payload.redirectAfter);
  });

  it("verify fails for malformed token", async () => {
    await expect(verifyConnectorState("not-a-jwt")).rejects.toThrow();
  });

  it("verify fails for tampered token", async () => {
    const token = await signConnectorState({
      companyId: "c",
      connectorId: "co",
      userId: "u",
    });
    const tampered = token.slice(0, -3) + "AAA";
    await expect(verifyConnectorState(tampered)).rejects.toThrow();
  });
});

describe("connectors — H1 redirect_after whitelist", () => {
  const PUBLIC_URL = "http://localhost:3100";

  it("accepts plain relative path starting with /", () => {
    expect(validateRedirectAfter("/foo/bar", PUBLIC_URL)).toBe("/foo/bar");
    expect(validateRedirectAfter("/settings/accounts", PUBLIC_URL)).toBe(
      "/settings/accounts",
    );
  });

  it("rejects protocol-relative path //evil.example.com (would be a redirect)", () => {
    expect(validateRedirectAfter("//evil.example.com", PUBLIC_URL)).toBeNull();
    expect(
      validateRedirectAfter("//evil.example.com/foo?x=1", PUBLIC_URL),
    ).toBeNull();
  });

  it("rejects absolute URLs whose origin does not match MNM_PUBLIC_URL", () => {
    expect(
      validateRedirectAfter("https://evil.example.com/foo", PUBLIC_URL),
    ).toBeNull();
    expect(
      validateRedirectAfter("http://attacker.example.com", PUBLIC_URL),
    ).toBeNull();
    // Different scheme — origin includes scheme so it's rejected
    expect(
      validateRedirectAfter("https://localhost:3100/foo", PUBLIC_URL),
    ).toBeNull();
    // Different port — also rejected
    expect(
      validateRedirectAfter("http://localhost:9999/foo", PUBLIC_URL),
    ).toBeNull();
  });

  it("accepts absolute URL whose origin matches MNM_PUBLIC_URL exactly", () => {
    expect(validateRedirectAfter(`${PUBLIC_URL}/foo`, PUBLIC_URL)).toBe(
      `${PUBLIC_URL}/foo`,
    );
  });

  it("returns null for empty/undefined", () => {
    expect(validateRedirectAfter(undefined, PUBLIC_URL)).toBeNull();
    expect(validateRedirectAfter("", PUBLIC_URL)).toBeNull();
  });

  it("rejects non-URL garbage", () => {
    expect(validateRedirectAfter("javascript:alert(1)", PUBLIC_URL)).toBeNull();
    expect(validateRedirectAfter("data:text/html,<script>", PUBLIC_URL)).toBeNull();
    expect(validateRedirectAfter("not even a url", PUBLIC_URL)).toBeNull();
  });
});
