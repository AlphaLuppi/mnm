import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { nanoid } from "nanoid";
import { closeDb } from "@/lib/db";
import { resetBootstrap } from "@/lib/bootstrap";
import { getMnMRoot, setMnMRoot } from "./paths";
import { createChildLogger } from "./logger";

const log = createChildLogger({ module: "project-registry" });

export interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastOpenedAt: number;
}

export interface ProjectRegistry {
  version: 1;
  activeProjectId: string;
  projects: ProjectEntry[];
}

const REGISTRY_DIR = path.join(os.homedir(), ".mnm");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "projects.json");

export function loadRegistry(): ProjectRegistry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return createDefaultRegistry();
  }
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
    return JSON.parse(raw) as ProjectRegistry;
  } catch {
    log.warn("Corrupt projects.json, recreating");
    return createDefaultRegistry();
  }
}

function createDefaultRegistry(): ProjectRegistry {
  const currentRoot = getMnMRoot();
  const entry: ProjectEntry = {
    id: nanoid(),
    name: path.basename(currentRoot),
    path: currentRoot,
    addedAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
  const registry: ProjectRegistry = {
    version: 1,
    activeProjectId: entry.id,
    projects: [entry],
  };
  saveRegistry(registry);
  return registry;
}

export function saveRegistry(registry: ProjectRegistry): void {
  if (!fs.existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  }
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

export function getActiveProject(): ProjectEntry | undefined {
  const registry = loadRegistry();
  return registry.projects.find((p) => p.id === registry.activeProjectId);
}

export function addProject(
  name: string,
  projectPath: string
): ProjectEntry {
  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(path.join(absPath, ".git"))) {
    throw new Error(`No .git directory found at ${absPath}`);
  }

  const registry = loadRegistry();
  const existing = registry.projects.find((p) => p.path === absPath);
  if (existing) {
    throw new Error(`Project at ${absPath} already registered`);
  }

  const entry: ProjectEntry = {
    id: nanoid(),
    name,
    path: absPath,
    addedAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
  registry.projects.push(entry);
  saveRegistry(registry);
  log.info({ id: entry.id, name, path: absPath }, "Project added");
  return entry;
}

export function removeProject(id: string): void {
  const registry = loadRegistry();
  if (registry.activeProjectId === id) {
    throw new Error("Cannot remove the active project");
  }
  registry.projects = registry.projects.filter((p) => p.id !== id);
  saveRegistry(registry);
  log.info({ id }, "Project removed");
}

export function switchProject(id: string): ProjectEntry {
  const registry = loadRegistry();
  const project = registry.projects.find((p) => p.id === id);
  if (!project) {
    throw new Error(`Project ${id} not found`);
  }
  if (!fs.existsSync(project.path)) {
    throw new Error(`Project path no longer exists: ${project.path}`);
  }

  // 1. Close current DB connection
  closeDb();

  // 2. Reset bootstrap cache
  resetBootstrap();

  // 3. Point paths to new root
  setMnMRoot(project.path);

  // 4. Update registry
  project.lastOpenedAt = Date.now();
  registry.activeProjectId = id;
  saveRegistry(registry);

  log.info({ id, name: project.name, path: project.path }, "Switched project");
  return project;
}
