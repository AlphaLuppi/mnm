import fs from "node:fs";
import path from "node:path";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

const BMAD_OUTPUT = "_bmad-output";
const DEBOUNCE_MS = 600;

interface WatcherEntry {
  watcher: fs.FSWatcher;
  timer: ReturnType<typeof setTimeout> | null;
  companyId: string;
  projectId: string;
}

const watchers = new Map<string, WatcherEntry>();

export function startWorkspaceContextWatcher(
  projectId: string,
  companyId: string,
  workspacePath: string,
): void {
  if (watchers.has(projectId)) return;

  const watchDir = path.join(workspacePath, BMAD_OUTPUT);

  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(watchDir, { recursive: true }, () => {
      const entry = watchers.get(projectId);
      if (!entry) return;

      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        publishLiveEvent({
          companyId: entry.companyId,
          type: "workspace.context.changed",
          payload: { projectId: entry.projectId },
        });
      }, DEBOUNCE_MS);
    });
  } catch {
    // Directory might not exist yet — ignore and don't watch
    return;
  }

  watcher.on("error", () => {
    const entry = watchers.get(projectId);
    if (entry?.timer) clearTimeout(entry.timer);
    watchers.delete(projectId);
  });

  watchers.set(projectId, { watcher, timer: null, companyId, projectId });
  logger.info({ projectId, watchDir }, "Started workspace context file watcher");
}

export function stopWorkspaceContextWatcher(projectId: string): void {
  const entry = watchers.get(projectId);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.watcher.close();
  watchers.delete(projectId);
  logger.info({ projectId }, "Stopped workspace context file watcher");
}
