import { describe, expect, it, vi } from "vitest";

import type { VisibilityResource } from "@mnm/shared";
import { canPrincipalAccess, type VisibilityResolvers } from "../visibility.js";

const CREATOR = "principal-creator";
const VIEWER = "principal-viewer";
const RESOURCE_ID = "resource-1";

function buildResource(
  visibility: VisibilityResource["visibility"],
  overrides: Partial<VisibilityResource> = {},
): VisibilityResource {
  return {
    id: RESOURCE_ID,
    visibility,
    createdByPrincipalId: CREATOR,
    ...overrides,
  };
}

function buildResolvers(
  overrides: Partial<VisibilityResolvers> = {},
): VisibilityResolvers {
  return {
    hasTagIntersection: vi.fn().mockResolvedValue(false),
    isPrincipalListed: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe("canPrincipalAccess — tier 3 (company-enforced)", () => {
  it("grants access to anyone, even non-creator, without DB lookup", async () => {
    const resolvers = buildResolvers();
    const ok = await canPrincipalAccess(
      buildResource("company"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(true);
    expect(resolvers.hasTagIntersection).not.toHaveBeenCalled();
    expect(resolvers.isPrincipalListed).not.toHaveBeenCalled();
  });

  it("still grants the creator (no surprise)", async () => {
    const resolvers = buildResolvers();
    const ok = await canPrincipalAccess(
      buildResource("company"),
      CREATOR,
      resolvers,
    );
    expect(ok).toBe(true);
  });
});

describe("canPrincipalAccess — tier 1 (creator)", () => {
  it("grants the creator regardless of visibility", async () => {
    const resolvers = buildResolvers();
    for (const v of ["private", "tags", "principals"] as const) {
      const ok = await canPrincipalAccess(
        buildResource(v),
        CREATOR,
        resolvers,
      );
      expect(ok).toBe(true);
    }
    expect(resolvers.hasTagIntersection).not.toHaveBeenCalled();
    expect(resolvers.isPrincipalListed).not.toHaveBeenCalled();
  });

  it("denies a non-creator on private", async () => {
    const resolvers = buildResolvers();
    const ok = await canPrincipalAccess(
      buildResource("private"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(false);
    expect(resolvers.hasTagIntersection).not.toHaveBeenCalled();
    expect(resolvers.isPrincipalListed).not.toHaveBeenCalled();
  });
});

describe("canPrincipalAccess — tier 2b (principals direct)", () => {
  it("delegates to isPrincipalListed and grants when listed", async () => {
    const resolvers = buildResolvers({
      isPrincipalListed: vi.fn().mockResolvedValue(true),
    });
    const ok = await canPrincipalAccess(
      buildResource("principals"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(true);
    expect(resolvers.isPrincipalListed).toHaveBeenCalledWith(
      RESOURCE_ID,
      VIEWER,
    );
    expect(resolvers.hasTagIntersection).not.toHaveBeenCalled();
  });

  it("denies when not listed", async () => {
    const resolvers = buildResolvers({
      isPrincipalListed: vi.fn().mockResolvedValue(false),
    });
    const ok = await canPrincipalAccess(
      buildResource("principals"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(false);
  });
});

describe("canPrincipalAccess — tier 2a (tag intersection)", () => {
  it("delegates to hasTagIntersection and grants when tags intersect", async () => {
    const resolvers = buildResolvers({
      hasTagIntersection: vi.fn().mockResolvedValue(true),
    });
    const ok = await canPrincipalAccess(
      buildResource("tags"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(true);
    expect(resolvers.hasTagIntersection).toHaveBeenCalledWith(
      RESOURCE_ID,
      VIEWER,
    );
    expect(resolvers.isPrincipalListed).not.toHaveBeenCalled();
  });

  it("denies when no tag intersection", async () => {
    const resolvers = buildResolvers({
      hasTagIntersection: vi.fn().mockResolvedValue(false),
    });
    const ok = await canPrincipalAccess(
      buildResource("tags"),
      VIEWER,
      resolvers,
    );
    expect(ok).toBe(false);
  });
});

describe("canPrincipalAccess — short-circuit ordering", () => {
  it("prefers tier 3 over tier 1 (creator) when visibility=company", async () => {
    const resolvers = buildResolvers();
    const ok = await canPrincipalAccess(
      buildResource("company"),
      CREATOR,
      resolvers,
    );
    expect(ok).toBe(true);
  });

  it("prefers tier 1 over tier 2b/2a when caller is creator", async () => {
    const isPrincipalListed = vi.fn().mockResolvedValue(false);
    const hasTagIntersection = vi.fn().mockResolvedValue(false);
    const resolvers = buildResolvers({
      isPrincipalListed,
      hasTagIntersection,
    });
    // Creator on a `principals` resource where they happen to NOT be listed:
    // tier 1 must win, no DB roundtrip wasted.
    const ok = await canPrincipalAccess(
      buildResource("principals"),
      CREATOR,
      resolvers,
    );
    expect(ok).toBe(true);
    expect(isPrincipalListed).not.toHaveBeenCalled();
    expect(hasTagIntersection).not.toHaveBeenCalled();
  });
});
