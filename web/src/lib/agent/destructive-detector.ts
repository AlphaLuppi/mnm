export type DestructiveOperation = {
  type: "file_deletion" | "git_reset" | "large_modification";
  description: string;
  filePath?: string;
  linesChanged?: number;
};

const DESTRUCTIVE_GIT_COMMANDS = [
  "git reset",
  "git revert",
  "git checkout --",
  "git clean -f",
  "git stash drop",
];

export function detectDestructiveOperation(
  output: string
): DestructiveOperation | null {
  // Check for file deletions
  if (/\brm\s+-rf?\b/.test(output) || /\bunlink\b/.test(output)) {
    const match = output.match(/(?:rm\s+-rf?\s+|unlink\s+)["']?([^\s"']+)/);
    return {
      type: "file_deletion",
      description: `File deletion detected: ${match?.[1] ?? "unknown file"}`,
      filePath: match?.[1],
    };
  }

  // Check for destructive git commands
  for (const cmd of DESTRUCTIVE_GIT_COMMANDS) {
    if (output.includes(cmd)) {
      return {
        type: "git_reset",
        description: `Destructive git operation: ${cmd}`,
      };
    }
  }

  // Check for large modifications (> 1000 LOC)
  const locMatch = output.match(
    /(\d+)\s+insertions?.*?(\d+)\s+deletions?/
  );
  if (locMatch) {
    const total = parseInt(locMatch[1]) + parseInt(locMatch[2]);
    if (total > 1000) {
      return {
        type: "large_modification",
        description: `Large modification: ${total} lines changed`,
        linesChanged: total,
      };
    }
  }

  return null;
}
