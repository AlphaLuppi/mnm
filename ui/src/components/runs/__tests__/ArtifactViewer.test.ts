/**
 * ARTIFACT-VIEWER T4.2 — file classification helpers used to dispatch a
 * persisted artifact onto the right renderer (markdown / monaco / pre /
 * download).
 *
 * Heavy renderers (Monaco, MarkdownBody) are not mounted here — they are
 * lazy-loaded and exercised via Playwright in T6. The unit suite locks
 * down the classification table since regressions would silently switch
 * a markdown spec from rendered to <pre>.
 */
import { describe, it, expect } from "vitest";
import { __test__ as Helpers } from "../ArtifactViewer.js";

describe("ArtifactViewer — file classification", () => {
  it("recognises .md / .markdown as markdown", () => {
    expect(Helpers.isMarkdown("/spec.md")).toBe(true);
    expect(Helpers.isMarkdown("docs/INDEX.markdown")).toBe(true);
  });

  it("does NOT classify .txt as markdown", () => {
    expect(Helpers.isMarkdown("notes.txt")).toBe(false);
  });

  it("recognises common code extensions as textual", () => {
    expect(Helpers.isText("a.ts")).toBe(true);
    expect(Helpers.isText("a.tsx")).toBe(true);
    expect(Helpers.isText("a.py")).toBe(true);
    expect(Helpers.isText("config.yaml")).toBe(true);
    expect(Helpers.isText("data.json")).toBe(true);
  });

  it("returns false for binary extensions", () => {
    expect(Helpers.isText("logo.png")).toBe(false);
    expect(Helpers.isText("archive.zip")).toBe(false);
    expect(Helpers.isText("doc.pdf")).toBe(false);
  });

  it("maps .ts/.tsx to typescript Monaco language", () => {
    expect(Helpers.monacoLanguage("foo.ts")).toBe("typescript");
    expect(Helpers.monacoLanguage("foo.tsx")).toBe("typescript");
  });

  it("maps yaml variants to yaml", () => {
    expect(Helpers.monacoLanguage("a.yaml")).toBe("yaml");
    expect(Helpers.monacoLanguage("a.yml")).toBe("yaml");
  });

  it("returns null for unknown extension", () => {
    expect(Helpers.monacoLanguage("logo.png")).toBeNull();
  });

  it("getExtension is case-insensitive", () => {
    expect(Helpers.getExtension("Spec.MD")).toBe("md");
    expect(Helpers.getExtension("Foo.TSX")).toBe("tsx");
  });

  it("getExtension returns empty string when no dot", () => {
    expect(Helpers.getExtension("Dockerfile")).toBe("");
  });
});
