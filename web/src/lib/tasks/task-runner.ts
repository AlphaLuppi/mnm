import { nanoid } from "nanoid";
import { createChildLogger } from "@/lib/core/logger";
import { getMnMRoot } from "@/lib/core/paths";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { runFullDiscovery } from "@/lib/discovery/discovery-service";
import { indexSpecs } from "@/lib/spec/indexer";
import { detectCrossDocDrift } from "@/lib/drift/cross-doc-detector";
import { scanCommits } from "@/lib/git/commit-scanner";
import { eventBus } from "@/lib/events/event-bus";
import type { TaskType, TaskEntry, TaskRunnerState, TaskLogEntry } from "./types";

const log = createChildLogger({ module: "task-runner" });

// Throttle task notifications to avoid flooding SSE on rapid log output
let _taskNotifyTimer: ReturnType<typeof setTimeout> | null = null;
function notifyTasksThrottled() {
  if (_taskNotifyTimer) return;
  _taskNotifyTimer = setTimeout(() => {
    _taskNotifyTimer = null;
    eventBus.notify("tasks");
  }, 500);
}

function addLog(task: TaskEntry, message: string, level: TaskLogEntry["level"] = "info") {
  task.logs.push({ message, timestamp: Date.now(), level });
  notifyTasksThrottled();
}

const TASK_HANDLERS: Record<TaskType, { label: string; run: (task: TaskEntry) => Promise<void> }> = {
  "rescan-workflows": {
    label: "Re-scanning workflows",
    run: async (task) => {
      const root = getMnMRoot();
      addLog(task, `Starting workflow rescan in ${root}`);
      addLog(task, "Ensuring bootstrap is complete...");
      await ensureBootstrapped();
      addLog(task, "Running full discovery...");
      const result = await runFullDiscovery(root);
      addLog(task, `Found ${result.workflows} workflows, ${result.specs} specs, ${result.agents} agents`);
      addLog(task, `Total items discovered: ${result.total} in ${result.durationMs}ms`);
      task.progress = `Found ${result.workflows} workflows, ${result.specs} specs`;
      task.result = result;
    },
  },
  "rescan-specs": {
    label: "Re-indexing specs",
    run: async (task) => {
      const root = getMnMRoot();
      addLog(task, `Starting spec re-index in ${root}`);
      const result = await indexSpecs(root);
      addLog(task, `Indexed ${result.indexed} specs`);
      task.progress = `Indexed ${result.indexed} specs`;
      task.result = result;
    },
  },
  "scan-drift": {
    label: "Scanning for drift",
    run: async (task) => {
      addLog(task, "Starting drift scan...");
      addLog(task, "Detecting cross-document drift between spec pairs...");
      const results = await detectCrossDocDrift();
      addLog(task, `Scan complete: found ${results.length} drift items`);
      task.progress = `Found ${results.length} drift items`;
      task.result = results;
    },
  },
  "scan-cross-doc-drift": {
    label: "Scanning cross-document drift",
    run: async (task) => {
      addLog(task, "Starting cross-document drift detection...");
      addLog(task, "Loading spec pairs from database...");
      const results = await detectCrossDocDrift();
      addLog(task, `Detection complete: found ${results.length} cross-doc drift items`);
      if (results.length > 0) {
        const bySeverity = { critical: 0, moderate: 0, minor: 0 };
        for (const r of results) {
          if (r.severity in bySeverity) bySeverity[r.severity as keyof typeof bySeverity]++;
        }
        addLog(task, `Breakdown: ${bySeverity.critical} critical, ${bySeverity.moderate} moderate, ${bySeverity.minor} minor`);
      }
      task.progress = `Found ${results.length} cross-doc drift items`;
      task.result = results;
    },
  },
  "discover-project": {
    label: "Discovering project structure",
    run: async (task) => {
      const root = getMnMRoot();
      addLog(task, `Starting project discovery in ${root}`);
      addLog(task, "Scanning repository structure...");
      const result = await runFullDiscovery(root);
      addLog(task, `Discovered ${result.workflows} workflows`);
      addLog(task, `Discovered ${result.specs} specs`);
      addLog(task, `Discovered ${result.agents} agents`);
      addLog(task, `Discovered ${result.commands} commands`);
      addLog(task, `Total: ${result.total} items in ${result.durationMs}ms`);
      task.progress = `Discovered ${result.total} items`;
      task.result = result;
    },
  },
  "git-scan-commits": {
    label: "Scanning git commits",
    run: async (task) => {
      addLog(task, "Starting git commit scan...");
      const result = await scanCommits();
      addLog(task, `Scanned ${result.scanned} commits`);
      task.progress = `Scanned ${result.scanned} commits`;
      task.result = result;
    },
  },
};

const VALID_TASK_TYPES = new Set<string>(Object.keys(TASK_HANDLERS));

const _tasks = new Map<string, TaskEntry>();

export function isValidTaskType(type: string): type is TaskType {
  return VALID_TASK_TYPES.has(type);
}

export function launchTask(type: TaskType): TaskEntry {
  const handler = TASK_HANDLERS[type];
  const entry: TaskEntry = {
    id: nanoid(),
    type,
    label: handler.label,
    status: "pending",
    logs: [],
    startedAt: Date.now(),
  };

  _tasks.set(entry.id, entry);

  // Fire-and-forget async execution
  void (async () => {
    entry.status = "running";
    addLog(entry, `Task started: ${handler.label}`);
    log.info({ taskId: entry.id, type }, "Task started");

    try {
      await handler.run(entry);
      entry.status = "completed";
      entry.completedAt = Date.now();
      addLog(entry, `Task completed in ${entry.completedAt - entry.startedAt}ms`);
      log.info({ taskId: entry.id, type, durationMs: entry.completedAt - entry.startedAt }, "Task completed");
    } catch (err) {
      entry.status = "failed";
      entry.error = err instanceof Error ? err.message : String(err);
      entry.completedAt = Date.now();
      addLog(entry, `Task failed: ${entry.error}`, "error");
      log.error({ taskId: entry.id, type, error: entry.error }, "Task failed");
    }

    // Immediate notify for terminal status change + flush any pending throttled notify
    if (_taskNotifyTimer) { clearTimeout(_taskNotifyTimer); _taskNotifyTimer = null; }
    eventBus.notify("tasks");
    // Notify related channels when task-produced data changes
    notifyRelatedChannels(type);
  })();

  return entry;
}

export function getTask(id: string): TaskEntry | undefined {
  return _tasks.get(id);
}

export function getAllTasks(): TaskEntry[] {
  return Array.from(_tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function cancelTask(id: string): boolean {
  const task = _tasks.get(id);
  if (!task) return false;
  if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") return false;

  task.status = "cancelled";
  task.completedAt = Date.now();
  addLog(task, "Task cancelled by user", "warn");
  log.info({ taskId: id, type: task.type }, "Task cancelled");
  eventBus.notify("tasks");
  return true;
}

/**
 * When a task completes, notify channels whose data may have changed.
 */
function notifyRelatedChannels(type: TaskType) {
  const related: Record<TaskType, import("@/lib/events/event-bus").EventChannel[]> = {
    "rescan-workflows": ["workflows", "discovery", "dashboard"],
    "rescan-specs": ["dashboard"],
    "scan-drift": ["drift", "drift-status", "dashboard"],
    "scan-cross-doc-drift": ["cross-doc-drift", "drift-status", "dashboard"],
    "discover-project": ["workflows", "discovery", "dashboard"],
    "git-scan-commits": ["dashboard"],
  };
  const channels = related[type];
  if (channels) eventBus.notifyMany(channels);
}

export function getState(): TaskRunnerState {
  const tasks = getAllTasks();
  const running = tasks.filter((t) => t.status === "running" || t.status === "pending").length;
  return { tasks, running };
}

const CLEAR_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function clearCompleted(): number {
  const now = Date.now();
  let cleared = 0;

  for (const [id, task] of _tasks) {
    if (
      (task.status === "completed" || task.status === "failed") &&
      task.completedAt &&
      now - task.completedAt > CLEAR_THRESHOLD_MS
    ) {
      _tasks.delete(id);
      cleared++;
    }
  }

  return cleared;
}
