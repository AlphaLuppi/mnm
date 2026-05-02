/**
 * TagSelector pure-logic tests.
 *
 * React Testing Library is not installed in this workspace
 * (see ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx
 * for the established convention). We exercise the pure helpers
 * that drive selection and filtering — the JSX shell over Popover
 * + Command primitives is covered by their own primitives tests
 * and by integration via Members page.
 */
import { describe, expect, it } from "vitest";

import type { Tag } from "../../../api/tags";
import { filterTagsByQuery, toggleSelection } from "../TagSelector";

function tag(partial: Partial<Tag> & { id: string; name: string }): Tag {
  return {
    companyId: "c1",
    slug: partial.name.toLowerCase().replace(/\s+/g, "-"),
    description: null,
    color: null,
    icon: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    memberCount: 0,
    ...partial,
  };
}

describe("filterTagsByQuery", () => {
  const tags: Tag[] = [
    tag({ id: "1", name: "Engineering" }),
    tag({ id: "2", name: "Product", description: "PM team" }),
    tag({ id: "3", name: "Design", slug: "design-team" }),
  ];

  it("returns all tags when query is empty or whitespace", () => {
    expect(filterTagsByQuery(tags, "")).toEqual(tags);
    expect(filterTagsByQuery(tags, "   ")).toEqual(tags);
  });

  it("matches by name (case-insensitive)", () => {
    const result = filterTagsByQuery(tags, "engin");
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("matches by slug", () => {
    const result = filterTagsByQuery(tags, "design-team");
    expect(result.map((t) => t.id)).toEqual(["3"]);
  });

  it("matches by description", () => {
    const result = filterTagsByQuery(tags, "PM");
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterTagsByQuery(tags, "marketing")).toEqual([]);
  });
});

describe("toggleSelection", () => {
  it("adds an id when missing (multiple)", () => {
    expect(toggleSelection(["a"], "b", true)).toEqual(["a", "b"]);
  });

  it("removes an id when present (multiple)", () => {
    expect(toggleSelection(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("preserves order of remaining ids on remove", () => {
    expect(toggleSelection(["a", "b", "c"], "b", true)).toEqual(["a", "c"]);
  });

  it("replaces selection when single (multiple=false)", () => {
    expect(toggleSelection(["a"], "b", false)).toEqual(["b"]);
  });

  it("clears when toggling the only selected id (multiple=false)", () => {
    expect(toggleSelection(["a"], "a", false)).toEqual([]);
  });

  it("handles empty input", () => {
    expect(toggleSelection([], "a", true)).toEqual(["a"]);
    expect(toggleSelection([], "a", false)).toEqual(["a"]);
  });
});
