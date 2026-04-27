import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_META,
  ALL_PERMISSION_SLUGS,
} from "@mnm/shared";
import { ADMIN_PERMS, OWNER_PERMS } from "../permission-seed.js";

describe("permissions contract — workflows:cancel_run", () => {
  it("exposes WORKFLOWS_CANCEL_RUN with the canonical slug", () => {
    expect(PERMISSIONS.WORKFLOWS_CANCEL_RUN).toBe("workflows:cancel_run");
  });

  it("includes workflows:cancel_run in ALL_PERMISSION_SLUGS", () => {
    expect(ALL_PERMISSION_SLUGS).toContain("workflows:cancel_run");
  });

  it("registers PERMISSION_META entry for workflows:cancel_run with the workflows category and a non-empty description", () => {
    const meta = PERMISSION_META["workflows:cancel_run"];
    expect(meta).toBeDefined();
    expect(meta.category).toBe("workflows");
    expect(meta.description).toBeTruthy();
    expect(meta.description.length).toBeGreaterThan(0);
    expect(meta.destructive).toBe(false);
  });
});

describe("permission-seed — workflows:cancel_run wiring", () => {
  it("auto-includes workflows:cancel_run in ADMIN_PERMS", () => {
    expect(ADMIN_PERMS).toContain("workflows:cancel_run");
  });

  it("auto-includes workflows:cancel_run in OWNER_PERMS", () => {
    expect(OWNER_PERMS).toContain("workflows:cancel_run");
  });
});
