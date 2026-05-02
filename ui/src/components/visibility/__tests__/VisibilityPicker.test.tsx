/**
 * VisibilityPicker pure-logic tests.
 *
 * React Testing Library is not installed in this workspace
 * (convention: ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx).
 * The JSX shell is a thin assembly over Tabs + TagSelector + PrincipalSelector
 * — those are covered by their own tests. We exercise the transition rules
 * that drive the picker.
 */
import { describe, expect, it } from "vitest";

import { EMPTY_VISIBILITY_VALUE, type VisibilityValue } from "@mnm/shared";
import { nextVisibilityValue } from "../VisibilityPicker";

const BASE: VisibilityValue = {
  ...EMPTY_VISIBILITY_VALUE,
  tagIds: ["tag-a"],
  principalIds: ["principal-a"],
};

describe("nextVisibilityValue", () => {
  it("returns null when target tier matches current (no-op)", () => {
    expect(
      nextVisibilityValue(BASE, "private", { companyEnforcedAvailable: true }),
    ).toBeNull();
  });

  it("rejects transition to `company` when not available", () => {
    expect(
      nextVisibilityValue(BASE, "company", {
        companyEnforcedAvailable: false,
      }),
    ).toBeNull();
  });

  it("allows transition to `company` when available", () => {
    const result = nextVisibilityValue(BASE, "company", {
      companyEnforcedAvailable: true,
    });
    expect(result).toEqual({ ...BASE, visibility: "company" });
  });

  it("preserves tagIds and principalIds across transitions", () => {
    const toTags = nextVisibilityValue(BASE, "tags", {
      companyEnforcedAvailable: false,
    });
    expect(toTags).toEqual({ ...BASE, visibility: "tags" });
    expect(toTags?.tagIds).toEqual(["tag-a"]);
    expect(toTags?.principalIds).toEqual(["principal-a"]);

    const toPrincipals = nextVisibilityValue(toTags!, "principals", {
      companyEnforcedAvailable: false,
    });
    expect(toPrincipals).toEqual({ ...BASE, visibility: "principals" });
    expect(toPrincipals?.tagIds).toEqual(["tag-a"]);
    expect(toPrincipals?.principalIds).toEqual(["principal-a"]);
  });

  it("transitions back to private without dropping arrays", () => {
    const tagsValue: VisibilityValue = { ...BASE, visibility: "tags" };
    const result = nextVisibilityValue(tagsValue, "private", {
      companyEnforcedAvailable: false,
    });
    expect(result).toEqual({ ...BASE, visibility: "private" });
  });
});
