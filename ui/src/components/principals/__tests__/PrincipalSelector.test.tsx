/**
 * PrincipalSelector pure-logic tests.
 *
 * React Testing Library is not installed in this workspace.
 * We exercise the pure helpers that drive type/exclude
 * filtering and search.
 */
import { describe, expect, it } from "vitest";

import type { EnrichedMember } from "../../../api/access";
import {
  applyPrincipalFilters,
  filterPrincipalsByQuery,
  principalDisplayName,
} from "../PrincipalSelector";

function member(
  partial: Partial<EnrichedMember> & { principalId: string },
): EnrichedMember {
  return {
    id: `member-${partial.principalId}`,
    companyId: "c1",
    principalType: partial.principalType ?? "human",
    status: "active",
    membershipRole: null,
    businessRole: null,
    roleId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    userName: null,
    userEmail: null,
    userImage: null,
    ...partial,
  };
}

describe("filterPrincipalsByQuery", () => {
  const members: EnrichedMember[] = [
    member({
      principalId: "p1",
      userName: "Alice Doe",
      userEmail: "alice@example.com",
    }),
    member({
      principalId: "p2",
      userName: "Bob Smith",
      userEmail: "bob@example.com",
    }),
    member({
      principalId: "p3",
      userName: null,
      userEmail: "agent-ceo@example.com",
      principalType: "agent",
    }),
  ];

  it("returns all members when query is empty", () => {
    expect(filterPrincipalsByQuery(members, "")).toEqual(members);
  });

  it("matches by name (case-insensitive)", () => {
    const result = filterPrincipalsByQuery(members, "bob");
    expect(result.map((m) => m.principalId)).toEqual(["p2"]);
  });

  it("matches by email", () => {
    const result = filterPrincipalsByQuery(members, "agent-ceo");
    expect(result.map((m) => m.principalId)).toEqual(["p3"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterPrincipalsByQuery(members, "nope")).toEqual([]);
  });
});

describe("applyPrincipalFilters", () => {
  const members: EnrichedMember[] = [
    member({ principalId: "human-a", principalType: "human" }),
    member({ principalId: "human-b", principalType: "human" }),
    member({ principalId: "agent-a", principalType: "agent" }),
    member({ principalId: "agent-b", principalType: "agent" }),
    member({ principalId: "weird", principalType: "service" }),
  ];

  it("keeps both kinds by default", () => {
    const result = applyPrincipalFilters(members, {
      types: ["human", "agent"],
      exclude: [],
    });
    expect(result.map((m) => m.principalId)).toEqual([
      "human-a",
      "human-b",
      "agent-a",
      "agent-b",
    ]);
  });

  it("filters out unknown principal types regardless of opts", () => {
    const result = applyPrincipalFilters(members, {
      types: ["human", "agent"],
      exclude: [],
    });
    expect(result.find((m) => m.principalId === "weird")).toBeUndefined();
  });

  it("restricts to humans only", () => {
    const result = applyPrincipalFilters(members, {
      types: ["human"],
      exclude: [],
    });
    expect(result.map((m) => m.principalId)).toEqual(["human-a", "human-b"]);
  });

  it("restricts to agents only", () => {
    const result = applyPrincipalFilters(members, {
      types: ["agent"],
      exclude: [],
    });
    expect(result.map((m) => m.principalId)).toEqual(["agent-a", "agent-b"]);
  });

  it("excludes specific principalIds", () => {
    const result = applyPrincipalFilters(members, {
      types: ["human", "agent"],
      exclude: ["human-a", "agent-b"],
    });
    expect(result.map((m) => m.principalId)).toEqual(["human-b", "agent-a"]);
  });
});

describe("principalDisplayName", () => {
  it("prefers userName when present", () => {
    expect(
      principalDisplayName(
        member({
          principalId: "p",
          userName: "Alice",
          userEmail: "alice@example.com",
        }),
      ),
    ).toBe("Alice");
  });

  it("falls back to userEmail when userName is null", () => {
    expect(
      principalDisplayName(
        member({
          principalId: "p",
          userName: null,
          userEmail: "agent@example.com",
        }),
      ),
    ).toBe("agent@example.com");
  });

  it("falls back to principalId when name and email are null", () => {
    expect(
      principalDisplayName(
        member({ principalId: "principal-xyz", userName: null, userEmail: null }),
      ),
    ).toBe("principal-xyz");
  });
});
