import { spawn } from "child_process";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "claude-cli" });

export interface ClaudeCLIStatus {
  installed: boolean;
  authenticated: boolean;
  version?: string;
}

export interface ClaudeCLIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Check if Claude CLI is installed.
 *
 * Note: We no longer check authentication status via subprocess because:
 * 1. OAuth tokens from interactive sessions don't work in subprocesses
 * 2. Running `claude -p` requires separate auth (setup-token or API key)
 * 3. The embedded terminal is now the recommended way to use Claude
 */
export async function getClaudeCLIStatus(): Promise<ClaudeCLIStatus> {
  const status: ClaudeCLIStatus = {
    installed: false,
    authenticated: false, // Always false - use embedded terminal instead
  };

  try {
    // Check if claude command exists
    const version = await runCommand("claude", ["--version"], 5000);
    if (version) {
      status.installed = true;
      status.version = version.trim();
    }
  } catch {
    // CLI not installed
  }

  return status;
}

/**
 * Send a prompt to Claude CLI and get the response
 */
export async function sendPromptToCLI(
  prompt: string,
  systemPrompt?: string,
  timeoutMs: number = 60000
): Promise<ClaudeCLIResponse> {
  try {
    const args = [
      "-p",
      prompt,
      "--max-turns",
      "1",
    ];

    if (systemPrompt) {
      args.push("--system-prompt", systemPrompt);
    }

    const result = await runCommand("claude", args, timeoutMs);

    return {
      success: true,
      content: result.trim(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    log.error({ error: errorMsg }, "Claude CLI prompt failed");
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Stream a prompt to Claude CLI (for real-time responses)
 */
export function streamPromptToCLI(
  prompt: string,
  systemPrompt: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  timeoutMs: number = 60000
): { abort: () => void } {
  const args = ["-p", prompt, "--max-turns", "1", "--output-format", "stream-json"];

  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }

  // Use shell on Windows to resolve command from PATH, but pass empty args
  // to avoid DEP0190 warning. On Unix, spawn can find commands in PATH directly.
  const isWindows = process.platform === "win32";
  const proc = isWindows
    ? spawn(`claude ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`, [], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      })
    : spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

  let aborted = false;
  const timeout = setTimeout(() => {
    if (!aborted) {
      proc.kill();
      onError("Request timed out");
    }
  }, timeoutMs);

  proc.stdout.on("data", (data) => {
    if (!aborted) {
      onChunk(data.toString());
    }
  });

  proc.stderr.on("data", (data) => {
    const errText = data.toString();
    // Ignore some common non-error stderr output
    if (!errText.includes("Compiling") && !errText.includes("warning")) {
      log.debug({ stderr: errText }, "Claude CLI stderr");
    }
  });

  proc.on("close", (code) => {
    clearTimeout(timeout);
    if (!aborted) {
      if (code === 0) {
        onDone();
      } else {
        onError(`Process exited with code ${code}`);
      }
    }
  });

  proc.on("error", (err) => {
    clearTimeout(timeout);
    if (!aborted) {
      onError(err.message);
    }
  });

  return {
    abort: () => {
      aborted = true;
      clearTimeout(timeout);
      proc.kill();
    },
  };
}

/**
 * Helper to run a command and get output
 */
function runCommand(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    // Use shell on Windows to resolve command from PATH, but pass empty args
    // to avoid DEP0190 warning. On Unix, spawn can find commands in PATH directly.
    const isWindows = process.platform === "win32";
    const proc = isWindows
      ? spawn(`${command} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`, [], {
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        })
      : spawn(command, args, {
          stdio: ["pipe", "pipe", "pipe"],
        });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Command timed out"));
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errorOutput || `Exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
