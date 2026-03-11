import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type {
  WorkspaceContext,
  PlanningArtifact,
  WorkspaceEpic,
  WorkspaceStory,
  AcceptanceCriterion,
  WorkspaceTask,
  SprintStatus,
} from "@mnm/shared";

const CONTEXT_ROOT = "_mnm-context";
const LEGACY_ROOT = "_bmad-output"; // backward compat fallback
const PLANNING_DIR = "planning-artifacts";
const IMPLEMENTATION_DIR = "implementation-artifacts";
const SPRINT_STATUS_FILE = "sprint-status.yaml";

const PLANNING_TYPE_MAP: Record<string, string> = {
  "product-brief": "product-brief",
  prd: "prd",
  architecture: "architecture",
  epics: "epics",
};

function classifyPlanningArtifact(filename: string): string {
  const base = filename.replace(/\.md$/i, "").toLowerCase();
  for (const [key, type] of Object.entries(PLANNING_TYPE_MAP)) {
    if (base.includes(key)) return type;
  }
  return "document";
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : "Untitled";
}

export function parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  // Split content into AC sections
  const acHeaderPattern = /^###\s+AC(\d+)\s*[—–-]\s*(.+)$/gm;
  const headers: { index: number; id: string; title: string }[] = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = acHeaderPattern.exec(content)) !== null) {
    headers.push({
      index: headerMatch.index,
      id: `AC${headerMatch[1]}`,
      title: headerMatch[2].trim(),
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const { id, title } = headers[i];
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : content.length;
    const block = content.slice(start, end);

    const givenMatch = block.match(/\*\*Given\*\*\s+(.+)/i);
    const whenMatch = block.match(/\*\*When\*\*\s+(.+)/i);
    const thenLines: string[] = [];

    const thenMatches = block.matchAll(/\*\*(?:Then|And)\*\*\s+(.+)/gi);
    for (const tm of thenMatches) {
      thenLines.push(tm[1].trim());
    }

    criteria.push({
      id,
      title,
      given: givenMatch ? givenMatch[1].trim() : "",
      when: whenMatch ? whenMatch[1].trim() : "",
      then: thenLines,
    });
  }

  return criteria;
}

export function parseTasks(content: string): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];
  const taskPattern = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = taskPattern.exec(content)) !== null) {
    tasks.push({
      done: match[1].toLowerCase() === "x",
      label: match[2].trim(),
    });
  }

  return tasks;
}

function parseStoryFilename(filename: string): { epicNumber: number; storyNumber: number } | null {
  const match = filename.match(/^(\d+)-(\d+)-/);
  if (!match) return null;
  return {
    epicNumber: parseInt(match[1], 10),
    storyNumber: parseInt(match[2], 10),
  };
}

async function collectMdFiles(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMdFiles(fullPath, baseDir);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

async function scanPlanningArtifacts(contextPath: string): Promise<PlanningArtifact[]> {
  const planningDir = path.join(contextPath, PLANNING_DIR);
  try {
    const relativePaths = await collectMdFiles(planningDir, contextPath);
    const artifacts: PlanningArtifact[] = [];

    for (const filePath of relativePaths) {
      const fullPath = path.join(contextPath, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      artifacts.push({
        title: extractTitle(content),
        type: classifyPlanningArtifact(path.basename(filePath)),
        filePath,
      });
    }

    return artifacts;
  } catch {
    return [];
  }
}

async function parseStoryFile(contextPath: string, filePath: string): Promise<WorkspaceStory | null> {
  const parsed = parseStoryFilename(path.basename(filePath));
  if (!parsed) return null;

  const fullPath = path.join(contextPath, filePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const title = extractTitle(content);
  const acceptanceCriteria = parseAcceptanceCriteria(content);
  const tasks = parseTasks(content);

  // Extract status from frontmatter-like "Status: xxx" line
  const statusMatch = content.match(/^Status:\s*(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim() : null;

  const doneCount = tasks.filter((t) => t.done).length;

  return {
    id: `${parsed.epicNumber}-${parsed.storyNumber}`,
    epicNumber: parsed.epicNumber,
    storyNumber: parsed.storyNumber,
    title,
    status,
    filePath,
    acceptanceCriteria,
    tasks,
    taskProgress: { done: doneCount, total: tasks.length },
  };
}

async function scanImplementationArtifacts(contextPath: string): Promise<WorkspaceStory[]> {
  const implDir = path.join(contextPath, IMPLEMENTATION_DIR);
  try {
    const entries = await fs.readdir(implDir);
    const stories: WorkspaceStory[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (!/^\d/.test(entry)) continue;
      const filePath = path.join(IMPLEMENTATION_DIR, entry);
      const story = await parseStoryFile(contextPath, filePath);
      if (story) stories.push(story);
    }

    return stories;
  } catch {
    return [];
  }
}

async function parseSprintStatus(contextPath: string): Promise<SprintStatus | null> {
  // Check both root and implementation-artifacts
  const candidates = [
    path.join(contextPath, SPRINT_STATUS_FILE),
    path.join(contextPath, IMPLEMENTATION_DIR, SPRINT_STATUS_FILE),
  ];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = yaml.load(content) as Record<string, unknown> | null;
      if (!parsed) continue;

      const devStatus = (parsed.development_status ?? {}) as Record<string, string>;
      const statuses: Record<string, string> = {};
      for (const [key, value] of Object.entries(devStatus)) {
        if (typeof value === "string") {
          statuses[key] = value;
        }
      }

      return {
        project: typeof parsed.project === "string" ? parsed.project : null,
        statuses,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildHierarchy(stories: WorkspaceStory[], sprintStatus: SprintStatus | null): WorkspaceEpic[] {
  const epicMap = new Map<number, WorkspaceEpic>();

  for (const story of stories) {
    let epic = epicMap.get(story.epicNumber);
    if (!epic) {
      const epicKey = `epic-${story.epicNumber}`;
      epic = {
        number: story.epicNumber,
        title: null,
        status: sprintStatus?.statuses[epicKey] ?? null,
        stories: [],
        progress: { done: 0, total: 0 },
      };
      epicMap.set(story.epicNumber, epic);
    }

    // Merge sprint status into story if available
    if (sprintStatus) {
      const storyKey = Object.keys(sprintStatus.statuses).find(
        (k) => k.startsWith(`${story.epicNumber}-${story.storyNumber}-`),
      );
      if (storyKey && !story.status) {
        story.status = sprintStatus.statuses[storyKey];
      }
    }

    epic.stories.push(story);
  }

  // Compute progress and sort
  for (const epic of epicMap.values()) {
    epic.stories.sort((a, b) => a.storyNumber - b.storyNumber);
    epic.progress.total = epic.stories.length;
    epic.progress.done = epic.stories.filter(
      (s) => s.status === "done" || s.status === "completed",
    ).length;
  }

  return Array.from(epicMap.values()).sort((a, b) => a.number - b.number);
}

/** Resolve the context root directory, preferring _mnm-context with fallback to _bmad-output. */
export async function resolveContextRoot(workspacePath: string): Promise<string | null> {
  const primary = path.join(workspacePath, CONTEXT_ROOT);
  try {
    const stat = await fs.stat(primary);
    if (stat.isDirectory()) return primary;
  } catch {
    // not found — try legacy
  }

  const legacy = path.join(workspacePath, LEGACY_ROOT);
  try {
    const stat = await fs.stat(legacy);
    if (stat.isDirectory()) return legacy;
  } catch {
    // not found
  }

  return null;
}

export async function analyzeWorkspace(workspacePath: string): Promise<WorkspaceContext | null> {
  const contextPath = await resolveContextRoot(workspacePath);
  if (!contextPath) return null;

  const [planningArtifacts, stories, sprintStatus] = await Promise.all([
    scanPlanningArtifacts(contextPath),
    scanImplementationArtifacts(contextPath),
    parseSprintStatus(contextPath),
  ]);

  // No content found at all
  if (planningArtifacts.length === 0 && stories.length === 0 && !sprintStatus) {
    return null;
  }

  const epics = buildHierarchy(stories, sprintStatus);

  return {
    detected: true,
    planningArtifacts,
    epics,
    sprintStatus,
  };
}
