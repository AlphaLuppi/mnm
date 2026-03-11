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
const CONFIG_FILE = "config.yaml";
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

/* ── Config-driven mode ───────────────────────────────────────── */

interface ContextConfig {
  planning?: Array<{
    path: string;
    type?: string;
    title?: string;
    group?: string;
  }>;
  stories?: Array<{
    path: string;
    epic: number;
    story: number;
    epicTitle?: string;
  }>;
  sprint_status?: { path: string };
}

async function readContextConfig(contextPath: string): Promise<ContextConfig | null> {
  const configFile = path.join(contextPath, CONFIG_FILE);
  try {
    const content = await fs.readFile(configFile, "utf-8");
    const parsed = yaml.load(content) as ContextConfig | null;
    return parsed ?? null;
  } catch {
    return null;
  }
}

async function analyzeFromConfig(
  workspacePath: string,
  config: ContextConfig,
): Promise<WorkspaceContext | null> {
  // Planning artifacts — read real files from workspace root
  const planningArtifacts: PlanningArtifact[] = [];
  for (const entry of config.planning ?? []) {
    if (!entry.path) continue;
    const absPath = path.resolve(workspacePath, entry.path);
    // Security: must stay within workspace
    if (!absPath.startsWith(workspacePath)) continue;
    try {
      const content = await fs.readFile(absPath, "utf-8");
      planningArtifacts.push({
        title: entry.title ?? extractTitle(content),
        type: entry.type ?? classifyPlanningArtifact(path.basename(entry.path)),
        filePath: entry.path, // relative to workspace root
        group: entry.group,
      } as PlanningArtifact & { group?: string });
    } catch {
      // File missing — skip silently
    }
  }

  // Stories — read real files from workspace root
  const stories: WorkspaceStory[] = [];
  const epicTitles = new Map<number, string>();

  for (const entry of config.stories ?? []) {
    if (!entry.path || !Number.isInteger(entry.epic) || !Number.isInteger(entry.story)) continue;
    const absPath = path.resolve(workspacePath, entry.path);
    if (!absPath.startsWith(workspacePath)) continue;
    if (entry.epicTitle) epicTitles.set(entry.epic, entry.epicTitle);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      const title = extractTitle(content);
      const acceptanceCriteria = parseAcceptanceCriteria(content);
      const tasks = parseTasks(content);
      const statusMatch = content.match(/^Status:\s*(.+)$/m);
      const status = statusMatch ? statusMatch[1].trim() : null;
      const doneCount = tasks.filter((t) => t.done).length;

      stories.push({
        id: `${entry.epic}-${entry.story}`,
        epicNumber: entry.epic,
        storyNumber: entry.story,
        title,
        status,
        filePath: entry.path, // relative to workspace root
        acceptanceCriteria,
        tasks,
        taskProgress: { done: doneCount, total: tasks.length },
      });
    } catch {
      // File missing — skip silently
    }
  }

  // Sprint status
  let sprintStatus: SprintStatus | null = null;
  if (config.sprint_status?.path) {
    const absPath = path.resolve(workspacePath, config.sprint_status.path);
    if (absPath.startsWith(workspacePath)) {
      sprintStatus = await parseSprintStatusFromFile(absPath);
    }
  }

  if (planningArtifacts.length === 0 && stories.length === 0 && !sprintStatus) return null;

  const epics = buildHierarchy(stories, sprintStatus, epicTitles);
  return { detected: true, planningArtifacts, epics, sprintStatus };
}

/* ── Legacy scanning mode ─────────────────────────────────────── */

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

async function scanPlanningArtifacts(workspacePath: string, contextPath: string): Promise<PlanningArtifact[]> {
  const planningDir = path.join(contextPath, PLANNING_DIR);
  try {
    // Paths relative to contextPath, then re-expressed relative to workspacePath
    const relativePaths = await collectMdFiles(planningDir, contextPath);
    const artifacts: PlanningArtifact[] = [];

    for (const filePath of relativePaths) {
      const fullPath = path.join(contextPath, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      artifacts.push({
        title: extractTitle(content),
        type: classifyPlanningArtifact(path.basename(filePath)),
        filePath: path.relative(workspacePath, fullPath), // relative to workspace root
      });
    }

    return artifacts;
  } catch {
    return [];
  }
}

async function parseStoryFromContent(
  content: string,
  epicNumber: number,
  storyNumber: number,
  filePath: string,
): Promise<WorkspaceStory> {
  const title = extractTitle(content);
  const acceptanceCriteria = parseAcceptanceCriteria(content);
  const tasks = parseTasks(content);
  const statusMatch = content.match(/^Status:\s*(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim() : null;
  const doneCount = tasks.filter((t) => t.done).length;

  return {
    id: `${epicNumber}-${storyNumber}`,
    epicNumber,
    storyNumber,
    title,
    status,
    filePath,
    acceptanceCriteria,
    tasks,
    taskProgress: { done: doneCount, total: tasks.length },
  };
}

async function scanImplementationArtifacts(workspacePath: string, contextPath: string): Promise<WorkspaceStory[]> {
  const implDir = path.join(contextPath, IMPLEMENTATION_DIR);
  try {
    const entries = await fs.readdir(implDir);
    const stories: WorkspaceStory[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (!/^\d/.test(entry)) continue;
      const match = entry.match(/^(\d+)-(\d+)-/);
      if (!match) continue;
      const epicNumber = parseInt(match[1], 10);
      const storyNumber = parseInt(match[2], 10);
      const fullPath = path.join(implDir, entry);
      const content = await fs.readFile(fullPath, "utf-8").catch(() => null);
      if (!content) continue;
      const filePath = path.relative(workspacePath, fullPath); // relative to workspace root
      stories.push(await parseStoryFromContent(content, epicNumber, storyNumber, filePath));
    }

    return stories;
  } catch {
    return [];
  }
}

async function parseSprintStatusFromFile(filePath: string): Promise<SprintStatus | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = yaml.load(content) as Record<string, unknown> | null;
    if (!parsed) return null;

    const devStatus = (parsed.development_status ?? {}) as Record<string, string>;
    const statuses: Record<string, string> = {};
    for (const [key, value] of Object.entries(devStatus)) {
      if (typeof value === "string") statuses[key] = value;
    }

    return {
      project: typeof parsed.project === "string" ? parsed.project : null,
      statuses,
    };
  } catch {
    return null;
  }
}

async function scanSprintStatus(contextPath: string): Promise<SprintStatus | null> {
  const candidates = [
    path.join(contextPath, SPRINT_STATUS_FILE),
    path.join(contextPath, IMPLEMENTATION_DIR, SPRINT_STATUS_FILE),
  ];
  for (const filePath of candidates) {
    const result = await parseSprintStatusFromFile(filePath);
    if (result) return result;
  }
  return null;
}

/* ── Hierarchy builder ────────────────────────────────────────── */

function buildHierarchy(
  stories: WorkspaceStory[],
  sprintStatus: SprintStatus | null,
  epicTitles?: Map<number, string>,
): WorkspaceEpic[] {
  const epicMap = new Map<number, WorkspaceEpic>();

  for (const story of stories) {
    let epic = epicMap.get(story.epicNumber);
    if (!epic) {
      const epicKey = `epic-${story.epicNumber}`;
      epic = {
        number: story.epicNumber,
        title: epicTitles?.get(story.epicNumber) ?? null,
        status: sprintStatus?.statuses[epicKey] ?? null,
        stories: [],
        progress: { done: 0, total: 0 },
      };
      epicMap.set(story.epicNumber, epic);
    }

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

  for (const epic of epicMap.values()) {
    epic.stories.sort((a, b) => a.storyNumber - b.storyNumber);
    epic.progress.total = epic.stories.length;
    epic.progress.done = epic.stories.filter(
      (s) => s.status === "done" || s.status === "completed",
    ).length;
  }

  return Array.from(epicMap.values()).sort((a, b) => a.number - b.number);
}

/* ── Public API ───────────────────────────────────────────────── */

/** Resolve the _mnm-context directory path (with _bmad-output fallback). */
export async function resolveContextRoot(workspacePath: string): Promise<string | null> {
  for (const root of [CONTEXT_ROOT, LEGACY_ROOT]) {
    const dir = path.join(workspacePath, root);
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) return dir;
    } catch {
      // not found — try next
    }
  }
  return null;
}

/**
 * Analyze the workspace context panel.
 *
 * Priority:
 *   1. Config-driven: _mnm-context/config.yaml → reads real project files in-place
 *   2. Legacy scanning: _mnm-context/ or _bmad-output/ subdirectories
 */
export async function analyzeWorkspace(workspacePath: string): Promise<WorkspaceContext | null> {
  const contextPath = await resolveContextRoot(workspacePath);
  if (!contextPath) return null;

  // Config-driven mode: read config.yaml and resolve real files
  const config = await readContextConfig(contextPath);
  if (config) {
    return analyzeFromConfig(workspacePath, config);
  }

  // Legacy scanning mode: scan planning-artifacts/ and implementation-artifacts/
  const [planningArtifacts, stories, sprintStatus] = await Promise.all([
    scanPlanningArtifacts(workspacePath, contextPath),
    scanImplementationArtifacts(workspacePath, contextPath),
    scanSprintStatus(contextPath),
  ]);

  if (planningArtifacts.length === 0 && stories.length === 0 && !sprintStatus) return null;

  const epics = buildHierarchy(stories, sprintStatus);
  return { detected: true, planningArtifacts, epics, sprintStatus };
}
