import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getMnMRoot } from "@/lib/core/paths";
import { createChildLogger } from "@/lib/core/logger";
import type {
  AIProvider,
  ProviderState,
  ProviderPresence,
  ProviderSession,
  ProviderAgent,
  ProviderTeam,
  ProviderCommand,
} from "./types";

const log = createChildLogger({ module: "provider-claude" });

const HOME = process.env.HOME ?? "/tmp";
const CLAUDE_DIR = path.join(HOME, ".claude");

export class ClaudeProvider implements AIProvider {
  id = "claude";
  name = "Claude Code";

  async detect(): Promise<ProviderState> {
    const repoRoot = getMnMRoot();
    const [presence, sessions, teams, commands] = await Promise.all([
      this.detectPresence(repoRoot),
      this.detectSessions(repoRoot),
      this.detectTeams(),
      this.detectCommands(repoRoot),
    ]);

    return {
      provider: this.id,
      presence,
      sessions,
      teams,
      commands,
    };
  }

  private async detectPresence(repoRoot: string): Promise<ProviderPresence> {
    let installed = false;
    let version: string | undefined;

    try {
      // Use 'where' on Windows, 'which' on Unix
      const checkCmd = process.platform === "win32" ? "where claude" : "which claude";
      const whichResult = execSync(checkCmd, {
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      installed = !!whichResult;
    } catch {
      // not installed
    }

    if (installed) {
      try {
        version = execSync("claude --version", {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
      } catch {
        // version check failed but still installed
      }
    }

    const configured = fs.existsSync(path.join(repoRoot, ".claude"));

    return { installed, configured, version };
  }

  private async detectSessions(repoRoot: string): Promise<ProviderSession[]> {
    const encodedPath = repoRoot.replace(/\//g, "-").replace(/^-/, "");
    const projectDir = path.join(CLAUDE_DIR, "projects", encodedPath);

    if (!fs.existsSync(projectDir)) {
      return [];
    }

    // Find running claude processes
    const runningPids = this.getRunningClaudePids();

    const sessions: ProviderSession[] = [];

    try {
      const entries = fs.readdirSync(projectDir);
      const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        try {
          const sessionId = file.replace(".jsonl", "");
          const filePath = path.join(projectDir, file);
          const session = this.parseSession(
            sessionId,
            filePath,
            projectDir,
            runningPids
          );
          if (session) {
            sessions.push(session);
          }
        } catch (err) {
          log.warn({ file, err }, "Failed to parse session file");
        }
      }
    } catch (err) {
      log.warn({ projectDir, err }, "Failed to read sessions directory");
    }

    // Sort by last activity, most recent first
    sessions.sort((a, b) => b.lastActivity - a.lastActivity);

    return sessions;
  }

  private parseSession(
    sessionId: string,
    filePath: string,
    projectDir: string,
    runningPids: Set<number>
  ): ProviderSession | null {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (fileSize === 0) return null;

    // Read last chunk of the file to get recent records
    let lastLines: string[] = [];
    const TAIL_BYTES = 8192;

    const fd = fs.openSync(filePath, "r");
    try {
      const readStart = Math.max(0, fileSize - TAIL_BYTES);
      const buf = Buffer.alloc(Math.min(TAIL_BYTES, fileSize));
      fs.readSync(fd, buf, 0, buf.length, readStart);
      const text = buf.toString("utf-8");
      lastLines = text.split("\n").filter((l) => l.trim());

      // If we started mid-line, discard the first partial line
      if (readStart > 0 && lastLines.length > 0) {
        lastLines.shift();
      }
    } finally {
      fs.closeSync(fd);
    }

    let branch: string | undefined;
    let lastTimestamp = stat.mtimeMs;

    // Parse last lines for metadata
    for (const line of lastLines) {
      try {
        const record = JSON.parse(line);
        if (record.timestamp) {
          const ts = new Date(record.timestamp).getTime();
          if (ts > lastTimestamp) lastTimestamp = ts;
        }
        if (record.gitBranch) branch = record.gitBranch;
      } catch {
        // skip malformed lines
      }
    }

    // Detect subagents
    const agents = this.detectSubagents(sessionId, projectDir);

    // Check if session is active (process running or recent activity)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const isActive = runningPids.size > 0 && lastTimestamp > fiveMinAgo;

    return {
      id: sessionId,
      provider: this.id,
      branch,
      lastActivity: lastTimestamp,
      isActive,
      agentCount: agents.length,
      agents,
    };
  }

  private detectSubagents(
    sessionId: string,
    projectDir: string
  ): ProviderAgent[] {
    const subagentDir = path.join(projectDir, sessionId, "subagents");
    if (!fs.existsSync(subagentDir)) return [];

    const agents: ProviderAgent[] = [];
    try {
      const files = fs.readdirSync(subagentDir);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const agentHash = file.replace(".jsonl", "");

        // Try to read slug from the first few lines
        let name = agentHash;
        try {
          const agentPath = path.join(subagentDir, file);
          const fd = fs.openSync(agentPath, "r");
          const headBuf = Buffer.alloc(4096);
          const bytesRead = fs.readSync(fd, headBuf, 0, 4096, 0);
          fs.closeSync(fd);

          const headText = headBuf.toString("utf-8", 0, bytesRead);
          const headLines = headText.split("\n").filter((l) => l.trim());

          for (const line of headLines) {
            try {
              const rec = JSON.parse(line);
              if (rec.slug) {
                name = rec.slug;
                break;
              }
              if (rec.agentId) {
                name = rec.agentId;
                break;
              }
            } catch {
              // skip
            }
          }
        } catch {
          // use hash as name
        }

        agents.push({ id: agentHash, name, sessionId });
      }
    } catch {
      // subagent dir read failed
    }

    return agents;
  }

  private async detectTeams(): Promise<ProviderTeam[]> {
    const teamsDir = path.join(CLAUDE_DIR, "teams");
    if (!fs.existsSync(teamsDir)) return [];

    const teams: ProviderTeam[] = [];

    try {
      const teamDirs = fs.readdirSync(teamsDir);
      for (const teamName of teamDirs) {
        const configPath = path.join(teamsDir, teamName, "config.json");
        if (!fs.existsSync(configPath)) continue;

        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const members = (config.members ?? []).map(
            (m: { name?: string; agentType?: string }) => ({
              name: m.name ?? "unknown",
              agentType: m.agentType ?? "general",
            })
          );

          // Count tasks
          let taskCount = 0;
          const tasksDir = path.join(CLAUDE_DIR, "tasks", teamName);
          if (fs.existsSync(tasksDir)) {
            const taskFiles = fs.readdirSync(tasksDir);
            taskCount = taskFiles.filter(
              (f) => !f.startsWith(".") && f.endsWith(".json")
            ).length;
          }

          teams.push({ name: teamName, members, taskCount });
        } catch (err) {
          log.warn({ teamName, err }, "Failed to parse team config");
        }
      }
    } catch (err) {
      log.warn({ err }, "Failed to read teams directory");
    }

    return teams;
  }

  private async detectCommands(repoRoot: string): Promise<ProviderCommand[]> {
    const commandsDir = path.join(repoRoot, ".claude", "commands");
    if (!fs.existsSync(commandsDir)) return [];

    const commands: ProviderCommand[] = [];

    try {
      const files = fs.readdirSync(commandsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const nameRaw = file.replace(".md", "");
        let category = "other";
        if (nameRaw.includes("agent")) {
          category = "agent";
        } else if (nameRaw.includes("workflow") || nameRaw.includes("bmm")) {
          category = "workflow";
        }

        const name = nameRaw
          .replace(/^bmad-/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        commands.push({
          name,
          filePath: path.join(commandsDir, file),
          category,
        });
      }
    } catch (err) {
      log.warn({ err }, "Failed to read commands directory");
    }

    return commands;
  }

  private getRunningClaudePids(): Set<number> {
    const pids = new Set<number>();
    try {
      if (process.platform === "win32") {
        // Windows: use tasklist to find claude processes
        const output = execSync('tasklist /FI "IMAGENAME eq claude.exe" /FO CSV /NH', {
          encoding: "utf-8",
          timeout: 3000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        // Parse CSV output: "claude.exe","1234","Console","1","12,345 K"
        for (const line of output.split("\n")) {
          const match = line.match(/"claude\.exe","(\d+)"/i);
          if (match) {
            const pid = parseInt(match[1], 10);
            if (!isNaN(pid)) pids.add(pid);
          }
        }
      } else {
        // Unix: use pgrep
        const output = execSync("pgrep -f claude", {
          encoding: "utf-8",
          timeout: 3000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        for (const line of output.split("\n")) {
          const pid = parseInt(line.trim(), 10);
          if (!isNaN(pid)) pids.add(pid);
        }
      }
    } catch {
      // pgrep/tasklist returns exit code 1 if no matches
    }
    return pids;
  }
}
