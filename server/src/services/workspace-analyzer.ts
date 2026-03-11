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

const CONTEXT_DIR = "_mnm-context";
const CONFIG_FILE = "config.yaml";

/* ── Markdown parsers (exported for tests) ────────────────────── */

export function parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  const acHeaderPattern = /^###\s+AC(\d+)\s*[—–-]\s*(.+)$/gm;
  const headers: { index: number; id: string; title: string }[] = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = acHeaderPattern.exec(content)) !== null) {
    headers.push({ index: headerMatch.index, id: `AC${headerMatch[1]}`, title: headerMatch[2].trim() });
  }
  for (let i = 0; i < headers.length; i++) {
    const { id, title } = headers[i];
    const block = content.slice(headers[i].index, i + 1 < headers.length ? headers[i + 1].index : content.length);
    const givenMatch = block.match(/\*\*Given\*\*\s+(.+)/i);
    const whenMatch = block.match(/\*\*When\*\*\s+(.+)/i);
    const thenLines: string[] = [];
    for (const tm of block.matchAll(/\*\*(?:Then|And)\*\*\s+(.+)/gi)) thenLines.push(tm[1].trim());
    criteria.push({ id, title, given: givenMatch?.[1].trim() ?? "", when: whenMatch?.[1].trim() ?? "", then: thenLines });
  }
  return criteria;
}

export function parseTasks(content: string): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];
  const taskPattern = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = taskPattern.exec(content)) !== null) {
    tasks.push({ done: match[1].toLowerCase() === "x", label: match[2].trim() });
  }
  return tasks;
}

function extractTitle(content: string): string {
  return content.match(/^#\s+(.+)/m)?.[1].trim() ?? "Untitled";
}

function classifyType(filePath: string): string {
  const base = path.basename(filePath).replace(/\.md$/i, "").toLowerCase();
  if (base.includes("product-brief")) return "product-brief";
  if (base.includes("prd")) return "prd";
  if (base.includes("architecture")) return "architecture";
  if (base.includes("epics")) return "epics";
  return "document";
}

/* ── Config format ────────────────────────────────────────────── */

interface ContextConfig {
  planning?: Array<{ path: string; type?: string; title?: string; group?: string }>;
  stories?: Array<{ path: string; epic: number; story: number; epicTitle?: string }>;
  sprint_status?: { path: string };
}

/* ── Hierarchy builder ────────────────────────────────────────── */

function buildHierarchy(stories: WorkspaceStory[], sprintStatus: SprintStatus | null, epicTitles: Map<number, string>): WorkspaceEpic[] {
  const epicMap = new Map<number, WorkspaceEpic>();
  for (const story of stories) {
    let epic = epicMap.get(story.epicNumber);
    if (!epic) {
      epic = {
        number: story.epicNumber,
        title: epicTitles.get(story.epicNumber) ?? null,
        status: sprintStatus?.statuses[`epic-${story.epicNumber}`] ?? null,
        stories: [],
        progress: { done: 0, total: 0 },
      };
      epicMap.set(story.epicNumber, epic);
    }
    if (sprintStatus && !story.status) {
      const key = Object.keys(sprintStatus.statuses).find((k) => k.startsWith(`${story.epicNumber}-${story.storyNumber}-`));
      if (key) story.status = sprintStatus.statuses[key];
    }
    epic.stories.push(story);
  }
  for (const epic of epicMap.values()) {
    epic.stories.sort((a, b) => a.storyNumber - b.storyNumber);
    epic.progress.total = epic.stories.length;
    epic.progress.done = epic.stories.filter((s) => s.status === "done" || s.status === "completed").length;
  }
  return Array.from(epicMap.values()).sort((a, b) => a.number - b.number);
}

/* ── Public API ───────────────────────────────────────────────── */

/**
 * Analyze the workspace context from _mnm-context/config.yaml.
 * Returns null if the config file does not exist or maps no content.
 */
export async function analyzeWorkspace(workspacePath: string): Promise<WorkspaceContext | null> {
  const configPath = path.join(workspacePath, CONTEXT_DIR, CONFIG_FILE);
  let config: ContextConfig;
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    config = (yaml.load(raw) as ContextConfig) ?? {};
  } catch {
    return null;
  }

  const wsBase = path.resolve(workspacePath);

  // Planning artifacts
  const planningArtifacts: PlanningArtifact[] = [];
  for (const entry of config.planning ?? []) {
    if (!entry.path) continue;
    const abs = path.resolve(wsBase, entry.path);
    if (!abs.startsWith(wsBase)) continue;
    try {
      const content = await fs.readFile(abs, "utf-8");
      planningArtifacts.push({
        title: entry.title ?? extractTitle(content),
        type: entry.type ?? classifyType(entry.path),
        filePath: entry.path,
      });
    } catch { /* file missing — skip */ }
  }

  // Stories
  const stories: WorkspaceStory[] = [];
  const epicTitles = new Map<number, string>();
  for (const entry of config.stories ?? []) {
    if (!entry.path || !Number.isInteger(entry.epic) || !Number.isInteger(entry.story)) continue;
    const abs = path.resolve(wsBase, entry.path);
    if (!abs.startsWith(wsBase)) continue;
    if (entry.epicTitle) epicTitles.set(entry.epic, entry.epicTitle);
    try {
      const content = await fs.readFile(abs, "utf-8");
      const tasks = parseTasks(content);
      stories.push({
        id: `${entry.epic}-${entry.story}`,
        epicNumber: entry.epic,
        storyNumber: entry.story,
        title: extractTitle(content),
        status: content.match(/^Status:\s*(.+)$/m)?.[1].trim() ?? null,
        filePath: entry.path,
        acceptanceCriteria: parseAcceptanceCriteria(content),
        tasks,
        taskProgress: { done: tasks.filter((t) => t.done).length, total: tasks.length },
      });
    } catch { /* file missing — skip */ }
  }

  // Sprint status
  let sprintStatus: SprintStatus | null = null;
  if (config.sprint_status?.path) {
    const abs = path.resolve(wsBase, config.sprint_status.path);
    if (abs.startsWith(wsBase)) {
      try {
        const raw = await fs.readFile(abs, "utf-8");
        const parsed = yaml.load(raw) as Record<string, unknown> | null;
        if (parsed) {
          const devStatus = (parsed.development_status ?? {}) as Record<string, string>;
          const statuses: Record<string, string> = {};
          for (const [k, v] of Object.entries(devStatus)) if (typeof v === "string") statuses[k] = v;
          sprintStatus = { project: typeof parsed.project === "string" ? parsed.project : null, statuses };
        }
      } catch { /* missing — skip */ }
    }
  }

  if (planningArtifacts.length === 0 && stories.length === 0 && !sprintStatus) return null;

  return {
    detected: true,
    planningArtifacts,
    epics: buildHierarchy(stories, sprintStatus, epicTitles),
    sprintStatus,
  };
}
