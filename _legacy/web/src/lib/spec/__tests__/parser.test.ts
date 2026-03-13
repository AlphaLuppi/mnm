import { describe, it, expect } from "vitest";
import { parseMarkdown, parseJson, parseSpecFile } from "@/lib/spec/parser";

describe("SpecParser", () => {
  describe("parseMarkdown", () => {
    it("extracts title from frontmatter", () => {
      const raw = `---
title: My Product Brief
spec_type: product_brief
---

# Heading

Body content.`;
      const result = parseMarkdown("docs/brief.md", raw);
      expect(result.title).toBe("My Product Brief");
      expect(result.specType).toBe("product_brief");
      expect(result.frontmatter).toEqual({
        title: "My Product Brief",
        spec_type: "product_brief",
      });
    });

    it("extracts title from H1 when no frontmatter title", () => {
      const raw = `# My Architecture Doc

Some content here.`;
      const result = parseMarkdown("docs/architecture.md", raw);
      expect(result.title).toBe("My Architecture Doc");
      expect(result.specType).toBe("architecture");
    });

    it("classifies spec type by file path", () => {
      expect(parseMarkdown("docs/prd.md", "# PRD\nContent").specType).toBe("prd");
      expect(parseMarkdown("stories/story-1.md", "# Story 1\nContent").specType).toBe("story");
      expect(parseMarkdown("docs/product-brief.md", "# Brief\nContent").specType).toBe("product_brief");
      expect(parseMarkdown("random/notes.md", "# Notes\nContent").specType).toBe("config");
    });

    it("generates a content hash", () => {
      const result = parseMarkdown("test.md", "# Test\nContent");
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns null frontmatter when none present", () => {
      const result = parseMarkdown("test.md", "# No frontmatter\nJust content");
      expect(result.frontmatter).toBeNull();
    });
  });

  describe("parseJson", () => {
    it("parses valid JSON with title", () => {
      const raw = JSON.stringify({ title: "API Spec", version: "1.0" });
      const result = parseJson("specs/api.json", raw);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("API Spec");
    });

    it("returns null for invalid JSON", () => {
      const result = parseJson("bad.json", "not json {{{");
      expect(result).toBeNull();
    });
  });

  describe("parseSpecFile", () => {
    it("delegates to markdown parser for .md files", () => {
      const result = parseSpecFile("test.md", "# Hello\nWorld");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Hello");
    });

    it("delegates to JSON parser for .json files", () => {
      const result = parseSpecFile("test.json", '{"title":"Test"}');
      expect(result).not.toBeNull();
    });

    it("returns null for unsupported extensions", () => {
      const result = parseSpecFile("test.txt", "content");
      expect(result).toBeNull();
    });
  });
});
