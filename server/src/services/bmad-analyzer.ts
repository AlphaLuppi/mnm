import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type {
  BmadProject,
  BmadPlanningArtifact,
  BmadEpic,
  BmadStory,
  BmadAcceptanceCriterion,
  BmadTask,
  BmadSprintStatus,
} from "@mnm/shared";

const BMAD_ROOT = "_bmad-output";
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

export function parseAcceptanceCriteria(content: string): BmadAcceptanceCriterion[] {
  const criteria: BmadAcceptanceCriterion[] = [];
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

export function parseTasks(content: string): BmadTask[] {
  const tasks: BmadTask[] = [];
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

async function scanPlanningArtifacts(bmadPath: string): Promise<BmadPlanningArtifact[]> {
  const planningDir = path.join(bmadPath, PLANNING_DIR);
  try {
    const entries = await fs.readdir(planningDir);
    const artifacts: BmadPlanningArtifact[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = path.join(PLANNING_DIR, entry);
      const fullPath = path.join(bmadPath, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      artifacts.push({
        title: extractTitle(content),
        type: classifyPlanningArtifact(entry),
        filePath,
      });
    }

    return artifacts;
  } catch {
    return [];
  }
}

async function parseStoryFile(bmadPath: string, filePath: string): Promise<BmadStory | null> {
  const parsed = parseStoryFilename(path.basename(filePath));
  if (!parsed) return null;

  const fullPath = path.join(bmadPath, filePath);
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

async function scanImplementationArtifacts(bmadPath: string): Promise<BmadStory[]> {
  const implDir = path.join(bmadPath, IMPLEMENTATION_DIR);
  try {
    const entries = await fs.readdir(implDir);
    const stories: BmadStory[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (!/^\d/.test(entry)) continue;
      const filePath = path.join(IMPLEMENTATION_DIR, entry);
      const story = await parseStoryFile(bmadPath, filePath);
      if (story) stories.push(story);
    }

    return stories;
  } catch {
    return [];
  }
}

async function parseSprintStatus(bmadPath: string): Promise<BmadSprintStatus | null> {
  // Check both root and implementation-artifacts
  const candidates = [
    path.join(bmadPath, SPRINT_STATUS_FILE),
    path.join(bmadPath, IMPLEMENTATION_DIR, SPRINT_STATUS_FILE),
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

function buildHierarchy(stories: BmadStory[], sprintStatus: BmadSprintStatus | null): BmadEpic[] {
  const epicMap = new Map<number, BmadEpic>();

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

export async function analyzeBmadWorkspace(workspacePath: string): Promise<BmadProject | null> {
  const bmadPath = path.join(workspacePath, BMAD_ROOT);

  // Check if BMAD structure exists
  try {
    const stat = await fs.stat(bmadPath);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }

  const [planningArtifacts, stories, sprintStatus] = await Promise.all([
    scanPlanningArtifacts(bmadPath),
    scanImplementationArtifacts(bmadPath),
    parseSprintStatus(bmadPath),
  ]);

  // No BMAD content found at all
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
