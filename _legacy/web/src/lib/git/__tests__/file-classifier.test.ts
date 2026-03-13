import { describe, it, expect } from "vitest";
import { heuristicClassify } from "@/lib/git/file-classifier";

describe("heuristicClassify", () => {
  it("classifies product-brief files", () => {
    const result = heuristicClassify("docs/product-brief.md");
    expect(result.fileType).toBe("ProductBrief");
    expect(result.confidence).toBe("High");
  });

  it("classifies PRD files", () => {
    const result = heuristicClassify("docs/prd.md");
    expect(result.fileType).toBe("Prd");
  });

  it("classifies story files", () => {
    const result = heuristicClassify("_bmad-output/stories/story-1.2.md");
    expect(result.fileType).toBe("Story");
  });

  it("classifies architecture files", () => {
    const result = heuristicClassify("docs/architecture-web.md");
    expect(result.fileType).toBe("Architecture");
  });

  it("classifies config files", () => {
    const result = heuristicClassify("config.yaml");
    expect(result.fileType).toBe("Config");
  });

  it("classifies JSON config files", () => {
    const result = heuristicClassify("package.json");
    expect(result.fileType).toBe("Config");
  });

  it("defaults to Code for unknown files", () => {
    const result = heuristicClassify("src/index.md");
    expect(result.fileType).toBe("Code");
  });
});
