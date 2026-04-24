/**
 * Tests for the pure helper extracted from useWorkflowFiles.
 *
 * @testing-library/react-hooks is NOT installed in this workspace — so we
 * test the change-computation logic directly rather than driving the hook
 * through a mounted React tree. The hook itself is thin glue around the
 * reducer/state transitions + TanStack Query; the interesting bit is how a
 * mixed set of dirty/deleted/new files collapses into the batchCommitFiles
 * payload.
 */
import { describe, it, expect } from "vitest";
import {
  computeChangesFromFiles,
  type FileBuffer,
} from "../useWorkflowFiles.js";

function file(buf: Partial<FileBuffer>): FileBuffer {
  return {
    content: "",
    originalContent: "",
    dirty: false,
    ...buf,
  };
}

describe("computeChangesFromFiles", () => {
  it("emits nothing for an empty map", () => {
    expect(computeChangesFromFiles({})).toEqual([]);
  });

  it("emits nothing for a fully clean map", () => {
    const files: Record<string, FileBuffer> = {
      "workflow.json": file({ content: "{}", originalContent: "{}", dirty: false }),
      "gates/lint.gate.ts": file({
        content: "export default 1;",
        originalContent: "export default 1;",
        dirty: false,
      }),
    };
    expect(computeChangesFromFiles(files)).toEqual([]);
  });

  it("emits a content change for a modified existing file", () => {
    const files: Record<string, FileBuffer> = {
      "workflow.json": file({
        content: "{\"name\":\"wf\"}",
        originalContent: "{}",
        dirty: true,
      }),
    };
    expect(computeChangesFromFiles(files)).toEqual([
      { path: "workflow.json", content: "{\"name\":\"wf\"}" },
    ]);
  });

  it("emits content for a brand-new file (originalContent empty)", () => {
    const files: Record<string, FileBuffer> = {
      "gates/new.gate.ts": file({
        content: "export default () => true;",
        originalContent: "",
        dirty: true,
      }),
    };
    expect(computeChangesFromFiles(files)).toEqual([
      { path: "gates/new.gate.ts", content: "export default () => true;" },
    ]);
  });

  it("emits delete:true for a tombstoned file regardless of content state", () => {
    const files: Record<string, FileBuffer> = {
      "obsolete.json": file({
        content: "doesn't matter",
        originalContent: "{}",
        dirty: true,
        deleted: true,
      }),
    };
    expect(computeChangesFromFiles(files)).toEqual([
      { path: "obsolete.json", delete: true },
    ]);
  });

  it("mixes modify + add + delete correctly in one payload", () => {
    const files: Record<string, FileBuffer> = {
      "workflow.json": file({
        content: "{\"version\":2}",
        originalContent: "{\"version\":1}",
        dirty: true,
      }),
      "gates/new.gate.ts": file({
        content: "export default 42;",
        originalContent: "",
        dirty: true,
      }),
      "gates/old.gate.ts": file({
        content: "legacy",
        originalContent: "legacy",
        dirty: false,
        deleted: true,
      }),
      "README.md": file({
        content: "unchanged",
        originalContent: "unchanged",
        dirty: false,
      }),
    };
    const changes = computeChangesFromFiles(files);
    expect(changes).toHaveLength(3);
    expect(changes).toContainEqual({
      path: "workflow.json",
      content: "{\"version\":2}",
    });
    expect(changes).toContainEqual({
      path: "gates/new.gate.ts",
      content: "export default 42;",
    });
    expect(changes).toContainEqual({ path: "gates/old.gate.ts", delete: true });
  });

  it("deleted+originalEmpty (tombstoned brand-new file) still emits delete — but production code prunes these via discardFile", () => {
    // Edge case — this shouldn't happen in practice because deleteFile
    // short-circuits to a full removal when originalContent === "". But the
    // pure helper is defensive: if the state ever contains such a tombstone,
    // the server will reject it cleanly rather than silently succeeding.
    const files: Record<string, FileBuffer> = {
      "ghost.json": file({
        content: "",
        originalContent: "",
        dirty: true,
        deleted: true,
      }),
    };
    expect(computeChangesFromFiles(files)).toEqual([
      { path: "ghost.json", delete: true },
    ]);
  });
});
