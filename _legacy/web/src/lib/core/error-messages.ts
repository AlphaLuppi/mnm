interface ErrorMapping {
  title: string;
  description: string;
  suggestion: string;
  isCritical: boolean;
}

const ERROR_MAP: Record<string, ErrorMapping> = {
  AGENT_NOT_FOUND: {
    title: "Agent Not Found",
    description: "The requested agent does not exist or has been removed.",
    suggestion: "Check the agent ID or return to the agents list.",
    isCritical: false,
  },
  AGENT_ALREADY_RUNNING: {
    title: "Agent Already Running",
    description: "This agent is already active and cannot be started again.",
    suggestion: "Wait for the current run to complete or terminate it first.",
    isCritical: false,
  },
  SPAWN_FAILED: {
    title: "Agent Launch Failed",
    description: "Could not start the agent subprocess.",
    suggestion: "Check that Claude Code CLI is installed and the API key is valid.",
    isCritical: true,
  },
  LOCK_CONFLICT: {
    title: "File Lock Conflict",
    description: "Another agent is currently modifying this file.",
    suggestion: "Wait for the other agent to finish or terminate it.",
    isCritical: false,
  },
  API_ERROR: {
    title: "Claude API Error",
    description: "The Claude API request failed.",
    suggestion: "Check your API key in Settings and verify your network connection.",
    isCritical: false,
  },
  INVALID_RESPONSE: {
    title: "Invalid API Response",
    description: "Received an unexpected response from the Claude API.",
    suggestion: "Try again. If the problem persists, report an issue.",
    isCritical: false,
  },
  SPEC_NOT_FOUND: {
    title: "Specification Not Found",
    description: "The referenced spec file could not be located.",
    suggestion: "Re-index your specs or verify the file path.",
    isCritical: false,
  },
  GIT_ERROR: {
    title: "Git Operation Failed",
    description: "A git operation did not complete successfully.",
    suggestion: "Check that you are in a git-initialized repository.",
    isCritical: false,
  },
  DATABASE_ERROR: {
    title: "Database Error",
    description: "An error occurred while accessing the local database.",
    suggestion: "Try restarting MnM. If the issue persists, clear the database in Settings.",
    isCritical: true,
  },
};

export function getErrorMapping(code: string): ErrorMapping {
  return (
    ERROR_MAP[code] ?? {
      title: "Unexpected Error",
      description: "Something went wrong.",
      suggestion: "Try again or report an issue if the problem persists.",
      isCritical: false,
    }
  );
}
