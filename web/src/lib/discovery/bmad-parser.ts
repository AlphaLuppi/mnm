import fs from "node:fs";
import path from "node:path";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "bmad-parser" });

export interface ParsedWorkflow {
  name: string;
  description: string;
  phase: string;
  sourcePath: string;
  steps: ParsedStep[];
  metadata: Record<string, string>;
}

export interface ParsedStep {
  name: string;
  filePath: string;
  order: number;
}

export interface ParsedAgent {
  name: string;
  displayName: string;
  title: string;
  role: string;
  module: string;
  sourcePath: string;
}

/** Parse all BMAD workflow definitions from the workflows directory. */
export function parseWorkflows(repoRoot: string): ParsedWorkflow[] {
  const workflowsDir = path.join(repoRoot, "_bmad", "bmm", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    log.info({ workflowsDir }, "BMAD workflows directory not found");
    return [];
  }

  const results: ParsedWorkflow[] = [];

  // Phase mapping based on directory names
  const phaseMap: Record<string, string> = {
    "1-analysis": "analysis",
    "2-plan-workflows": "planning",
    "3-solutioning": "solutioning",
    "4-implementation": "implementation",
    "bmad-quick-flow": "quick-flow",
    "document-project": "documentation",
    "generate-project-context": "documentation",
    "qa": "qa",
  };

  const phaseDirs = readdirSafe(workflowsDir);

  for (const phaseDir of phaseDirs) {
    const phasePath = path.join(workflowsDir, phaseDir);
    if (!fs.statSync(phasePath).isDirectory()) continue;

    const phase = phaseMap[phaseDir] ?? phaseDir;

    // Check the phase directory itself for workflow files (e.g., generate-project-context/workflow.md)
    const phaseLevel = parseWorkflowDir(phasePath, phase, repoRoot);
    if (phaseLevel.length > 0) {
      results.push(...phaseLevel);
    }

    // Then check subdirectories (e.g., 2-plan-workflows/create-prd/)
    const workflowDirs = readdirSafe(phasePath);

    for (const wfDir of workflowDirs) {
      const wfPath = path.join(phasePath, wfDir);
      if (!fs.statSync(wfPath).isDirectory()) continue;

      const parsed = parseWorkflowDir(wfPath, phase, repoRoot);
      if (parsed.length > 0) {
        results.push(...parsed);
      }
    }
  }

  log.info({ count: results.length }, "Parsed BMAD workflows");
  return results;
}

/** Parse a single workflow directory, which may contain one or more workflow files. */
function parseWorkflowDir(
  dirPath: string,
  phase: string,
  repoRoot: string
): ParsedWorkflow[] {
  const files = readdirSafe(dirPath);
  const workflowFiles = files.filter(
    (f) =>
      (f.startsWith("workflow") && (f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml")))
  );

  if (workflowFiles.length === 0) return [];

  const results: ParsedWorkflow[] = [];

  for (const wfFile of workflowFiles) {
    const absPath = path.join(dirPath, wfFile);
    const relPath = path.relative(repoRoot, absPath);
    const content = fs.readFileSync(absPath, "utf-8");

    const name = extractField(content, "name") ?? path.basename(dirPath);
    const description =
      extractField(content, "description") ?? "";

    // Find step files
    const steps = findSteps(dirPath, repoRoot);

    const metadata: Record<string, string> = {};
    const author = extractField(content, "author");
    if (author) metadata.author = author;

    results.push({
      name,
      description,
      phase,
      sourcePath: relPath,
      steps,
      metadata,
    });
  }

  return results;
}

/** Extract a field value from YAML frontmatter or YAML body. */
function extractField(content: string, field: string): string | undefined {
  // Try YAML frontmatter first
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const searchContent = fmMatch ? fmMatch[1] : content;

  // Match field: "value" or field: value
  const regex = new RegExp(`^${field}:\\s*"?([^"\\n]+)"?`, "m");
  const match = searchContent.match(regex);
  return match?.[1]?.trim();
}

/** Find step files in a workflow directory.
 *  Handles steps/, steps-v/, steps-c/, steps-e/, and any other steps-* directories.
 */
function findSteps(dirPath: string, repoRoot: string): ParsedStep[] {
  const steps: ParsedStep[] = [];

  // Find all steps directories: "steps", "steps-v", "steps-c", "steps-e", etc.
  const allEntries = readdirSafe(dirPath);
  const stepsDirs = allEntries.filter((entry) => {
    if (entry !== "steps" && !entry.startsWith("steps-")) return false;
    const fullPath = path.join(dirPath, entry);
    try {
      return fs.statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  });

  if (stepsDirs.length === 0) return steps;

  for (const stepsEntry of stepsDirs) {
    const stepsDir = path.join(dirPath, stepsEntry);
    // Variant suffix: "steps-v" → "v", "steps-c" → "c", "steps" → ""
    const variant = stepsEntry.startsWith("steps-")
      ? stepsEntry.slice(6)
      : "";

    const files = readdirSafe(stepsDir)
      .filter(
        (f) =>
          f.startsWith("step-") &&
          (f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml"))
      )
      .sort();

    for (let i = 0; i < files.length; i++) {
      const relPath = path.relative(repoRoot, path.join(stepsDir, files[i]));
      // Extract step number from filenames like:
      //   "step-01-init.md", "step-v-01-discovery.md", "step-e-01-discovery.md"
      const numMatch = files[i].match(/step-(?:[a-z]+-)?(\d+)/);
      const order = numMatch ? parseInt(numMatch[1], 10) : i + 1;

      const baseName = files[i].replace(/\.(md|yaml|yml)$/, "");
      steps.push({
        name: variant ? `[${variant}] ${baseName}` : baseName,
        filePath: relPath,
        order,
      });
    }
  }

  // Sort all steps by order, then by name for stability
  steps.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return steps;
}

/** Parse BMAD agent manifest to get agent definitions. */
export function parseAgents(repoRoot: string): ParsedAgent[] {
  const manifestPath = path.join(repoRoot, "_bmad", "_config", "agent-manifest.csv");
  if (!fs.existsSync(manifestPath)) {
    log.info("BMAD agent manifest not found");
    return [];
  }

  const content = fs.readFileSync(manifestPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const agents: ParsedAgent[] = [];

  // Skip header line, parse CSV rows
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 11) continue;

    agents.push({
      name: fields[0],
      displayName: fields[1],
      title: fields[2],
      role: fields[4],
      module: fields[9],
      sourcePath: fields[10],
    });
  }

  log.info({ count: agents.length }, "Parsed BMAD agents");
  return agents;
}

/** Simple CSV line parser that handles quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  return fields;
}

function readdirSafe(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}
