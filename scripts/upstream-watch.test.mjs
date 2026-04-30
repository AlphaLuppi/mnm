import { describe, it, expect } from "vitest";
import {
  parseLastAuditDate,
  extractPrNumbers,
  extractPrBlurb,
  filterReleasesSince,
  sanitizeMarkdownCell,
  renderRelease,
  renderPatch,
  renderPlan,
} from "./upstream-watch.mjs";

describe("parseLastAuditDate", () => {
  it("returns the date inside a typical upstream-watch.md status row", () => {
    const md = [
      "| | |",
      "|---|---|",
      "| Remote | x |",
      "| Dernier audit complet | **2026-04-29** (releases v2026.318.0 -> v2026.428.0) |",
      "| Prochain audit | **2026-05-28** (mensuel) |",
    ].join("\n");
    expect(parseLastAuditDate(md)).toBe("2026-04-29");
  });

  it("handles minor spacing variations", () => {
    const md = "|Dernier audit complet|2026-03-01 random text|";
    expect(parseLastAuditDate(md)).toBe("2026-03-01");
  });

  it("returns null when the row is missing", () => {
    expect(parseLastAuditDate("# nothing relevant")).toBeNull();
    expect(parseLastAuditDate("")).toBeNull();
    expect(parseLastAuditDate(null)).toBeNull();
  });

  it("does not match the 'Prochain audit' row by accident", () => {
    const md = "| Prochain audit | **2026-05-28** (mensuel) |";
    expect(parseLastAuditDate(md)).toBeNull();
  });
});

describe("extractPrNumbers", () => {
  it("dedups and sorts ascending", () => {
    const body = "* fix #200 by alice\n* chore: relate to #100, #300, also #200";
    expect(extractPrNumbers(body)).toEqual([100, 200, 300]);
  });

  it("ignores tiny noise like #12 (we require >=2 digits but at least 100 in practice)", () => {
    expect(extractPrNumbers("ref #12 and #1234")).toEqual([12, 1234]);
  });

  it("returns [] for non-strings", () => {
    expect(extractPrNumbers(null)).toEqual([]);
    expect(extractPrNumbers(undefined)).toEqual([]);
  });
});

describe("filterReleasesSince", () => {
  const releases = [
    { tag_name: "v3", published_at: "2026-05-02T00:00:00Z" },
    { tag_name: "v2", published_at: "2026-04-30T00:00:00Z" },
    { tag_name: "v1", published_at: "2026-04-29T00:00:00Z" },
  ];

  it("returns strictly newer releases", () => {
    const out = filterReleasesSince(releases, "2026-04-29");
    expect(out.map((r) => r.tag_name)).toEqual(["v3", "v2"]);
  });

  it("returns all releases when sinceIso is null", () => {
    const out = filterReleasesSince(releases, null);
    expect(out.length).toBe(3);
  });

  it("never errors when published_at is missing", () => {
    const out = filterReleasesSince([{ tag_name: "weird" }], "2026-04-29");
    expect(out).toEqual([]);
  });
});

describe("extractPrBlurb", () => {
  it("strips the trailing ` by @user in #NNNN` GitHub release-notes suffix", () => {
    const body = "* feat(security): patch for things by @alice in #4900";
    expect(extractPrBlurb(body, 4900)).toBe("feat(security): patch for things");
  });

  it("falls back to dropping the bare #NNNN marker when no `by @user` suffix", () => {
    const body = "* fix #4900: data loss bug";
    const blurb = extractPrBlurb(body, 4900);
    expect(blurb).toContain("data loss");
    expect(blurb).not.toContain("#4900");
  });

  it("returns empty string when not found", () => {
    expect(extractPrBlurb("nothing", 9999)).toBe("");
  });

  it("caps very long blurbs", () => {
    const blurb = extractPrBlurb(`feat: ${"x".repeat(500)} by @alice in #1234`, 1234);
    expect(blurb.length).toBeLessThanOrEqual(120);
  });
});

describe("sanitizeMarkdownCell", () => {
  it("escapes pipes and replaces newlines", () => {
    expect(sanitizeMarkdownCell("a|b\nc")).toBe("a\\|b c");
  });

  it("trims whitespace", () => {
    expect(sanitizeMarkdownCell("  hi  ")).toBe("hi");
  });
});

describe("renderRelease", () => {
  it("renders a section heading + a row per PR", () => {
    const md = renderRelease({
      tag_name: "v9",
      published_at: "2026-05-01T10:00:00Z",
      html_url: "https://example.test/v9",
      body: "* feat: thing in #100\n* fix: another in #200",
    });
    expect(md).toContain("Release `v9`");
    expect(md).toContain("https://example.test/v9");
    expect(md).toContain("[#100](https://github.com/paperclipai/paperclip/pull/100)");
    expect(md).toContain("[#200](https://github.com/paperclipai/paperclip/pull/200)");
    expect(md).toContain("TODO triage");
  });

  it("notes when no PRs are referenced", () => {
    const md = renderRelease({
      tag_name: "v0",
      published_at: "2026-05-01T10:00:00Z",
      body: "no prs at all",
    });
    expect(md).toContain("No PR references found");
  });
});

describe("renderPatch / renderPlan", () => {
  const sample = [
    {
      tag_name: "v2",
      published_at: "2026-05-02T00:00:00Z",
      body: "* fix #200",
      html_url: "https://example.test/v2",
    },
    {
      tag_name: "v1",
      published_at: "2026-05-01T00:00:00Z",
      body: "* feat #100",
      html_url: "https://example.test/v1",
    },
  ];

  it("renderPatch writes a top-level audit heading and tags range", () => {
    const out = renderPatch({
      todayIso: "2026-05-15",
      releases: sample,
      lastAuditDate: "2026-04-29",
    });
    expect(out.startsWith("## Audit 2026-05-15")).toBe(true);
    expect(out).toContain("v1 -> v2");
    expect(out).toContain("[#100]");
    expect(out).toContain("[#200]");
  });

  it("renderPatch handles empty release list", () => {
    const out = renderPatch({
      todayIso: "2026-05-15",
      releases: [],
      lastAuditDate: "2026-05-14",
    });
    expect(out).toContain("No new upstream releases");
  });

  it("renderPlan starts with the plan H1 heading", () => {
    const out = renderPlan({
      todayIso: "2026-05-15",
      releases: sample,
      lastAuditDate: "2026-04-29",
    });
    expect(out.startsWith("# Plan — Upstream-watch batch 2026-05-15")).toBe(true);
    expect(out).toContain("## Étapes");
    expect(out).toContain("- [ ] Tous les verdicts");
  });
});
