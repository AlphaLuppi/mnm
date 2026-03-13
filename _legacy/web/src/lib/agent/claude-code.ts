import { spawn, type ChildProcess } from "child_process";
import { AgentError } from "@/lib/core/errors";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "claude-code" });

export class ClaudeCodeBridge {
  private constructor(public readonly process: ChildProcess) {}

  static spawn(
    specPath: string,
    scope: string[],
    repoRoot: string
  ): ClaudeCodeBridge {
    log.info({ specPath, scope, repoRoot }, "Spawning Claude Code subprocess");

    const child = spawn(
      "claude",
      [
        "--print",
        "--output-format",
        "stream-json",
        "-p",
        `Implement the spec at ${specPath}. Only modify files in scope: ${scope.join(", ")}`,
      ],
      {
        cwd: repoRoot,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        log.error({ specPath }, "Claude CLI not found in PATH");
      } else {
        log.error({ error: err.message, specPath }, "Subprocess error");
      }
    });

    return new ClaudeCodeBridge(child);
  }

  get stdout() {
    return this.process.stdout;
  }
  get stderr() {
    return this.process.stderr;
  }
  get stdin() {
    return this.process.stdin;
  }
  get pid() {
    return this.process.pid;
  }

  pause(): void {
    this.process.kill("SIGSTOP");
  }

  resume(): void {
    this.process.kill("SIGCONT");
  }

  terminate(): void {
    this.process.kill("SIGTERM");
  }

  get exitCode(): number | null {
    return this.process.exitCode;
  }

  sendCommand(data: string): boolean {
    if (!this.stdin || !this.stdin.writable) return false;
    return this.stdin.write(data + "\n");
  }
}
