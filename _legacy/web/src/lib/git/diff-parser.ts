export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface ParsedDiff {
  filePath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

const HUNK_HEADER = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

export function parseUnifiedDiff(diffText: string, filePath: string = ""): ParsedDiff {
  const lines = diffText.split("\n");
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER);

    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: parseInt(hunkMatch[2] ?? "1", 10),
        newStart: parseInt(hunkMatch[3], 10),
        newCount: parseInt(hunkMatch[4] ?? "1", 10),
        lines: [],
      };
      hunks.push(currentHunk);
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "added",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine++,
      });
      additions++;
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "removed",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: null,
      });
      deletions++;
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "unchanged",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  }

  return { filePath, hunks, additions, deletions };
}
