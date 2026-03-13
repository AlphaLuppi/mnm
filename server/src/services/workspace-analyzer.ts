import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type {
  WorkspaceContext,
  ContextNode,
  PlanningArtifact,
  WorkspaceEpic,
  WorkspaceStep,
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

function isDone(status: string | null): boolean {
  return status === "done" || status === "completed";
}

/* ── Config format ─────────────────────────────────────────────── */

/** Old flat format: each entry is a story with epic/story numbers */
interface OldStoryEntry {
  path: string;
  epic: number;
  story: number;
  epicTitle?: string;
}

/** New nested format: each entry is a step with epics and stories inside */
interface NewStepEntry {
  step: number;
  title?: string;
  overview?: string;
  epics?: Array<{
    epic: number;
    title?: string;
    stories?: Array<{ story: number; path: string }>;
  }>;
}

interface ContextConfig {
  planning?: Array<{ path: string; type?: string; title?: string; group?: string }>;
  stories?: Array<OldStoryEntry | NewStepEntry>;
  sprint_status?: { path: string };
}

function isNewStepFormat(entries: Array<OldStoryEntry | NewStepEntry>): entries is NewStepEntry[] {
  if (entries.length === 0) return false;
  const first = entries[0] as unknown as Record<string, unknown>;
  return "step" in first && "epics" in first;
}

/* ── Story file reader ─────────────────────────────────────────── */

async function readStory(
  storyPath: string,
  epicNumber: number,
  storyNumber: number,
  wsBase: string,
): Promise<WorkspaceStory | null> {
  const abs = path.resolve(wsBase, storyPath);
  if (!abs.startsWith(wsBase)) return null;
  try {
    const content = await fs.readFile(abs, "utf-8");
    const tasks = parseTasks(content);
    return {
      id: storyPath,
      epicNumber,
      storyNumber,
      title: extractTitle(content),
      status: content.match(/^Status:\s*(.+)$/m)?.[1].trim() ?? null,
      filePath: storyPath,
      acceptanceCriteria: parseAcceptanceCriteria(content),
      tasks,
      taskProgress: { done: tasks.filter((t) => t.done).length, total: tasks.length },
    };
  } catch {
    return null;
  }
}

/* ── Legacy hierarchy builder (old flat format) ───────────────── */

function buildHierarchy(
  stories: WorkspaceStory[],
  sprintStatus: SprintStatus | null,
  epicTitles: Map<number, string>,
): WorkspaceEpic[] {
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
    epic.progress.done = epic.stories.filter((s) => isDone(s.status)).length;
  }
  return Array.from(epicMap.values()).sort((a, b) => a.number - b.number);
}

/* ── Nested step builder (new format) ─────────────────────────── */

async function buildSteps(
  stepEntries: NewStepEntry[],
  wsBase: string,
  sprintStatus: SprintStatus | null,
): Promise<WorkspaceStep[]> {
  const steps: WorkspaceStep[] = [];
  for (const stepEntry of stepEntries) {
    const epics: WorkspaceEpic[] = [];
    for (const epicEntry of stepEntry.epics ?? []) {
      const stories: WorkspaceStory[] = [];
      for (const storyEntry of epicEntry.stories ?? []) {
        if (!storyEntry.path) continue;
        const story = await readStory(storyEntry.path, epicEntry.epic, storyEntry.story, wsBase);
        if (!story) continue;
        // Apply sprint status if no status in file
        if (sprintStatus && !story.status) {
          const key = Object.keys(sprintStatus.statuses).find(
            (k) => k.startsWith(`e${stepEntry.step}-${epicEntry.epic}-${storyEntry.story}`),
          );
          if (key) story.status = sprintStatus.statuses[key];
        }
        stories.push(story);
      }
      stories.sort((a, b) => a.storyNumber - b.storyNumber);
      epics.push({
        number: epicEntry.epic,
        title: epicEntry.title ?? null,
        status: sprintStatus?.statuses[`e${stepEntry.step}-epic-${epicEntry.epic}`] ?? null,
        stories,
        progress: {
          done: stories.filter((s) => isDone(s.status)).length,
          total: stories.length,
        },
      });
    }
    const allStories = epics.flatMap((e) => e.stories);
    steps.push({
      number: stepEntry.step,
      title: stepEntry.title ?? null,
      epics,
      progress: {
        done: allStories.filter((s) => isDone(s.status)).length,
        total: allStories.length,
      },
    });
  }
  return steps;
}

/* ── Tree builder (converts legacy structures into ContextNode[]) ── */

function storyToNode(story: WorkspaceStory, epicId: string): ContextNode {
  return {
    id: `${epicId}/${story.id}`,
    title: `${story.epicNumber}.${story.storyNumber} ${story.title}`,
    path: story.filePath,
    status: story.status,
    children: [],
    progress: story.taskProgress,
    detail: {
      acceptanceCriteria: story.acceptanceCriteria,
      tasks: story.tasks,
      taskProgress: story.taskProgress,
      epicNumber: story.epicNumber,
      storyNumber: story.storyNumber,
    },
  };
}

function epicToNode(epic: WorkspaceEpic, epicId: string): ContextNode {
  return {
    id: epicId,
    title: `E${epic.number}${epic.title ? `: ${epic.title}` : ""}`,
    status: epic.status,
    children: epic.stories.map((s) => storyToNode(s, epicId)),
    progress: epic.progress,
  };
}

function buildTree(epics: WorkspaceEpic[], steps: WorkspaceStep[]): ContextNode[] {
  if (steps.length > 0) {
    return steps.map((step) => {
      const stepId = String(step.number);
      return {
        id: stepId,
        title: step.title ? `Étape ${step.number} — ${step.title}` : `Étape ${step.number}`,
        children: step.epics.map((epic) => epicToNode(epic, `${stepId}-${epic.number}`)),
        progress: step.progress,
      };
    });
  }
  return epics.map((epic) => epicToNode(epic, String(epic.number)));
}

/* ── Public API ───────────────────────────────────────────────── */

/**
 * Analyze the workspace context from _mnm-context/config.yaml.
 * Returns null if the config file does not exist or maps no content.
 *
 * Supports two story formats:
 *   - Old flat format: `{ path, epic, story, epicTitle? }`
 *   - New nested format: `{ step, title?, epics: [{ epic, title?, stories: [{ story, path }] }] }`
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

  // Stories: detect format and parse accordingly
  let epics: WorkspaceEpic[] = [];
  let steps: WorkspaceStep[] = [];

  const storiesEntries = config.stories ?? [];
  if (storiesEntries.length > 0) {
    if (isNewStepFormat(storiesEntries)) {
      // New nested format: step > epic > story
      steps = await buildSteps(storiesEntries, wsBase, sprintStatus);
    } else {
      // Old flat format: epic + story numbers
      const flatEntries = storiesEntries as OldStoryEntry[];
      const stories: WorkspaceStory[] = [];
      const epicTitles = new Map<number, string>();
      for (const entry of flatEntries) {
        if (!entry.path || !Number.isInteger(entry.epic) || !Number.isInteger(entry.story)) continue;
        if (entry.epicTitle) epicTitles.set(entry.epic, entry.epicTitle);
        const story = await readStory(entry.path, entry.epic, entry.story, wsBase);
        if (story) stories.push(story);
      }
      epics = buildHierarchy(stories, sprintStatus, epicTitles);
    }
  }

  const tree = buildTree(epics, steps);

  if (planningArtifacts.length === 0 && tree.length === 0 && !sprintStatus) return null;

  return {
    detected: true,
    planningArtifacts,
    tree,
    epics,
    steps,
    sprintStatus,
  };
}
