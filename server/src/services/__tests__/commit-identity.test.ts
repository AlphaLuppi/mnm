import { describe, it, expect, vi, beforeEach } from "vitest";
import { commitIdentityService } from "../commit-identity.js";
import { ConnectorError } from "../connectors.js";
import type { ConnectorService } from "../connectors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FakeAuthUserRow {
  name: string | null;
  email: string | null;
}

function makeFakeDb(authUserRow: FakeAuthUserRow | null) {
  // Drizzle chain: db.select(...).from(...).where(...).limit(...). Each step
  // returns the next; the final await resolves to an array of rows.
  const limit = vi.fn(async () => (authUserRow ? [authUserRow] : []));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, _spies: { select, from, where, limit } } as unknown as Parameters<typeof commitIdentityService>[0];
}

function makeFakeConnectors(opts: {
  token?: string;
  throwError?: ConnectorError;
}): ConnectorService {
  const getUserToken = vi.fn(async () => {
    if (opts.throwError) throw opts.throwError;
    return {
      accessToken: opts.token ?? "tok-abc",
      expiresAt: null,
      scopes: [],
      type: "oauth2" as const,
    };
  });
  return { getUserToken } as unknown as ConnectorService;
}

function makeFetchOk(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function makeFetchStatus(status: number): typeof fetch {
  return vi.fn(async () => {
    return {
      ok: false,
      status,
      json: async () => ({}),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("commitIdentityService.resolveCommitIdentity", () => {
  describe("github", () => {
    it("returns the user's GitHub name+email when /user responds 200", async () => {
      const db = makeFakeDb({ name: "Fallback Name", email: "fallback@example.com" });
      const connectors = makeFakeConnectors({ token: "gho_abc" });
      const fetchImpl = makeFetchOk({
        login: "octouser",
        name: "Octo User",
        email: "octo@example.com",
      });
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "github",
      });

      expect(id).toEqual({ name: "Octo User", email: "octo@example.com" });
      expect(connectors.getUserToken).toHaveBeenCalledWith("user-1", "github", "co-1");
    });

    it("falls back to noreply email when GitHub returns no public email", async () => {
      const db = makeFakeDb({ name: "Fallback", email: "fallback@example.com" });
      const connectors = makeFakeConnectors({ token: "gho_abc" });
      const fetchImpl = makeFetchOk({ login: "octouser", name: null, email: null });
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "github",
      });

      expect(id).toEqual({
        name: "octouser",
        email: "octouser@users.noreply.github.com",
      });
    });

    it("falls back to BetterAuth when no GitHub connector is configured", async () => {
      const db = makeFakeDb({ name: "MnM User", email: "user@mnm.example" });
      const connectors = makeFakeConnectors({
        throwError: new ConnectorError("CONNECTOR_NOT_CONFIGURED", "no github connector"),
      });
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "github",
      });

      expect(id).toEqual({ name: "MnM User", email: "user@mnm.example" });
      // We must NOT have hit the fetchImpl when there is no token at all.
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("falls back to BetterAuth when /user returns 401", async () => {
      const db = makeFakeDb({ name: "MnM User", email: "user@mnm.example" });
      const connectors = makeFakeConnectors({ token: "gho_abc" });
      const fetchImpl = makeFetchStatus(401);
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "github",
      });

      expect(id).toEqual({ name: "MnM User", email: "user@mnm.example" });
    });

    it("falls back to a synthesized identity when both provider and BetterAuth are unavailable", async () => {
      const db = makeFakeDb(null);
      const connectors = makeFakeConnectors({
        throwError: new ConnectorError("CONNECTOR_NOT_CONFIGURED"),
      });
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-42",
        companyId: "co-1",
        providerKind: "github",
      });

      expect(id).toEqual({ name: "user-42", email: "user-42@mnm.local" });
    });
  });

  describe("gitlab", () => {
    it("returns the user's GitLab name+email when /user responds 200", async () => {
      const db = makeFakeDb({ name: "Fallback", email: "fallback@example.com" });
      const connectors = makeFakeConnectors({ token: "glpat_abc" });
      const fetchImpl = makeFetchOk({
        username: "glab",
        name: "Gitlab User",
        email: "glab@example.com",
      });
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "gitlab",
      });

      expect(id).toEqual({ name: "Gitlab User", email: "glab@example.com" });
      expect(connectors.getUserToken).toHaveBeenCalledWith("user-1", "gitlab", "co-1");
    });

    it("prefers commit_email over email when present", async () => {
      const db = makeFakeDb(null);
      const connectors = makeFakeConnectors({ token: "glpat_abc" });
      const fetchImpl = makeFetchOk({
        username: "glab",
        name: "Gitlab User",
        email: "primary@example.com",
        commit_email: "commits@example.com",
      });
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const id = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "gitlab",
      });

      expect(id.email).toBe("commits@example.com");
    });
  });

  describe("cache", () => {
    it("returns cached value within TTL without re-hitting the provider", async () => {
      const db = makeFakeDb(null);
      const connectors = makeFakeConnectors({ token: "gho_abc" });
      const fetchImpl = makeFetchOk({
        login: "octouser",
        name: "Octo User",
        email: "octo@example.com",
      }) as unknown as typeof fetch & { mock: { calls: unknown[] } };
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const args = { userId: "user-1", companyId: "co-1", providerKind: "github" as const };
      const id1 = await svc.resolveCommitIdentity(args);
      const id2 = await svc.resolveCommitIdentity(args);

      expect(id1).toEqual(id2);
      expect(connectors.getUserToken).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("evicts and re-fetches when the cached entry is stale", async () => {
      const db = makeFakeDb(null);
      const connectors = makeFakeConnectors({ token: "gho_abc" });
      const fetchImpl = makeFetchOk({
        login: "octouser",
        name: "Octo User",
        email: "octo@example.com",
      });
      let nowMs = 1_000_000;
      const svc = commitIdentityService(db, {
        connectors,
        fetchImpl,
        now: () => nowMs,
        cacheTtlMs: 1000,
      });

      const args = { userId: "user-1", companyId: "co-1", providerKind: "github" as const };
      await svc.resolveCommitIdentity(args);
      // Advance past TTL.
      nowMs += 5000;
      await svc.resolveCommitIdentity(args);

      expect(connectors.getUserToken).toHaveBeenCalledTimes(2);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("scopes cache by providerKind", async () => {
      const db = makeFakeDb(null);
      const connectors = makeFakeConnectors({ token: "tok" });
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes("github.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ login: "gh", name: "GH", email: "gh@x" }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ username: "gl", name: "GL", email: "gl@x" }),
        } as unknown as Response;
      }) as unknown as typeof fetch;
      const svc = commitIdentityService(db, { connectors, fetchImpl });

      const ghId = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "github",
      });
      const glId = await svc.resolveCommitIdentity({
        userId: "user-1",
        companyId: "co-1",
        providerKind: "gitlab",
      });

      expect(ghId.email).toBe("gh@x");
      expect(glId.email).toBe("gl@x");
    });
  });
});
