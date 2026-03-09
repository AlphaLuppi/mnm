import { describe, it, expect } from "vitest";
import { parseUnifiedDiff } from "@/lib/git/diff-parser";

describe("DiffParser", () => {
  it("parses a simple unified diff", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
-line2
+line2_modified
+line2_added
 line3`;

    const result = parseUnifiedDiff(diff, "file.ts");
    expect(result.filePath).toBe("file.ts");
    expect(result.hunks).toHaveLength(1);
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);

    const hunk = result.hunks[0];
    expect(hunk.oldStart).toBe(1);
    expect(hunk.newStart).toBe(1);
    expect(hunk.lines).toHaveLength(5);
    expect(hunk.lines[0].type).toBe("unchanged");
    expect(hunk.lines[1].type).toBe("removed");
    expect(hunk.lines[2].type).toBe("added");
    expect(hunk.lines[3].type).toBe("added");
    expect(hunk.lines[4].type).toBe("unchanged");
  });

  it("handles multiple hunks", () => {
    const diff = `@@ -1,2 +1,2 @@
-old1
+new1
 same
@@ -10,2 +10,2 @@
-old10
+new10
 same10`;

    const result = parseUnifiedDiff(diff);
    expect(result.hunks).toHaveLength(2);
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(2);
  });

  it("handles empty diff", () => {
    const result = parseUnifiedDiff("");
    expect(result.hunks).toHaveLength(0);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  it("tracks line numbers correctly", () => {
    const diff = `@@ -5,3 +5,3 @@
 context
-removed
+added
 context2`;

    const result = parseUnifiedDiff(diff);
    const lines = result.hunks[0].lines;

    expect(lines[0].oldLineNumber).toBe(5);
    expect(lines[0].newLineNumber).toBe(5);
    expect(lines[1].oldLineNumber).toBe(6);
    expect(lines[1].newLineNumber).toBeNull();
    expect(lines[2].oldLineNumber).toBeNull();
    expect(lines[2].newLineNumber).toBe(6);
    expect(lines[3].oldLineNumber).toBe(7);
    expect(lines[3].newLineNumber).toBe(7);
  });
});
