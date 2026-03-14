import fs from "node:fs/promises";
import path from "node:path";
import type { Db } from "@mnm/db";
import type {
  DriftReport,
  DriftItem,
  DriftDecision,
  DriftScanStatus,
  DriftReportFilters,
  DriftItemFilters,
} from "@mnm/shared";
import { logger } from "../middleware/logger.js";
import { analyzeDrift, type DriftResultItem } from "./drift-analyzer.js";
import { loadCustomInstructions } from "./drift-instructions.js";
import { driftPersistenceService } from "./drift-persistence.js";

/** Abort controllers for cancellable scans — remains in-memory (process state) */
const scanAbortMap = new Map<string, AbortController>();

/** In-memory tracking for active scan progress (non-persistent process state) */
const activeScanStatus = new Map<string, DriftScanStatus>();

function getDefaultScanStatus(): DriftScanStatus {
  return {
    scanning: false,
    progress: null,
    completed: 0,
    total: 0,
    lastScanAt: null,
    lastScanIssueCount: null,
  };
}

/**
 * Read file content for drift analysis.
 * Returns the file content or null if the file can't be read.
 */
async function readDocContent(docPath: string): Promise<string | null> {
  try {
    return await fs.readFile(docPath, "utf-8");
  } catch {
    logger.warn({ docPath }, "Could not read document for drift analysis");
    return null;
  }
}

/**
 * Convert an LLM drift result item to an input for persistence.
 */
function toDriftItemInput(
  item: DriftResultItem,
  sourceDoc: string,
  targetDoc: string,
) {
  return {
    severity: item.severity,
    driftType: item.drift_type,
    confidence: item.confidence,
    description: item.description,
    recommendation: item.recommendation,
    sourceExcerpt: item.source_excerpt,
    targetExcerpt: item.target_excerpt,
    sourceDoc,
    targetDoc,
  };
}

/**
 * Check drift between two documents.
 *
 * Uses the Claude API if ANTHROPIC_API_KEY is set,
 * otherwise falls back to mock data for development.
 *
 * Persists results to PostgreSQL via drift-persistence service.
 */
export async function checkDrift(
  db: Db,
  companyId: string,
  projectId: string,
  sourceDoc: string,
  targetDoc: string,
  customInstructions?: string,
): Promise<DriftReport> {
  // Real LLM-powered drift analysis (via API or Claude CLI fallback)
  const [sourceContent, targetContent] = await Promise.all([
    readDocContent(sourceDoc),
    readDocContent(targetDoc),
  ]);

  if (!sourceContent || !targetContent) {
    const missing = !sourceContent ? sourceDoc : targetDoc;
    throw new Error(`Could not read document: ${missing}`);
  }

  // Auto-load custom instructions from .mnm/drift-instructions.md if not provided
  if (!customInstructions) {
    const repoRoot = path.dirname(path.dirname(sourceDoc));
    customInstructions = await loadCustomInstructions(repoRoot) ?? undefined;
  }

  logger.info({ sourceDoc, targetDoc, projectId, hasCustomInstructions: !!customInstructions }, "Starting drift analysis");

  const results = await analyzeDrift(
    sourceDoc,
    sourceContent,
    targetDoc,
    targetContent,
    customInstructions,
  );

  const items = results.map((r) => toDriftItemInput(r, sourceDoc, targetDoc));
  logger.info(
    { driftCount: items.length, sourceDoc, targetDoc },
    "Drift analysis complete",
  );

  // Persist to DB via drift-persistence service (atomic transaction)
  const svc = driftPersistenceService(db);
  const report = await svc.createReport({
    companyId,
    projectId,
    sourceDoc,
    targetDoc,
    items,
  });

  return report;
}

/**
 * Returns drift reports for a project from the database.
 * Supports pagination and filters.
 */
export async function getDriftResults(
  db: Db,
  companyId: string,
  projectId: string,
  filters?: { limit?: number; offset?: number; status?: string },
): Promise<{ data: DriftReport[]; total: number }> {
  const svc = driftPersistenceService(db);
  return svc.listReports({
    companyId,
    projectId,
    status: filters?.status,
    limit: filters?.limit,
    offset: filters?.offset,
  });
}

/**
 * Resolve a drift item (accept or reject).
 * Persists the decision to the database.
 * Returns the updated DriftItem or null if not found.
 */
export async function resolveDrift(
  db: Db,
  companyId: string,
  itemId: string,
  decision: DriftDecision,
  decidedBy: string,
  remediationNote?: string,
): Promise<DriftItem | null> {
  const svc = driftPersistenceService(db);
  const updated = await svc.resolveItem(companyId, itemId, decision, decidedBy, remediationNote);

  if (updated) {
    logger.info(
      { driftId: itemId, decision, decidedBy },
      "Drift resolved",
    );
  }

  return updated;
}

/**
 * Get scan status for a project.
 * Merges in-memory active scan state with DB-derived last scan info.
 */
export async function getDriftScanStatus(
  db: Db,
  companyId: string,
  projectId: string,
): Promise<DriftScanStatus> {
  // Check for active in-memory scan first
  const activeStatus = activeScanStatus.get(projectId);
  if (activeStatus?.scanning) {
    return activeStatus;
  }

  // Derive from DB
  const svc = driftPersistenceService(db);
  return svc.getScanStatus(companyId, projectId);
}

/**
 * Cancel an ongoing scan for a project.
 */
export function cancelDriftScan(projectId: string): boolean {
  const controller = scanAbortMap.get(projectId);
  if (controller) {
    controller.abort();
    scanAbortMap.delete(projectId);
    const status = activeScanStatus.get(projectId);
    if (status) {
      status.scanning = false;
      status.progress = "Scan cancelled";
    }
    logger.info({ projectId }, "Drift scan cancelled");
    return true;
  }
  return false;
}

/**
 * Build the list of artifact pairs to compare for drift scanning.
 * Compares each planning artifact against every other one (e.g., PRD vs Architecture).
 */
async function buildScanPairs(
  workspacePath: string,
  scope: string,
): Promise<Array<{ source: string; target: string; label: string }>> {
  const bmadDir = path.join(workspacePath, "_bmad-output", "planning-artifacts");
  const implDir = path.join(workspacePath, "_bmad-output", "implementation-artifacts");
  const pairs: Array<{ source: string; target: string; label: string }> = [];

  try {
    // 1. Planning artifacts cross-comparison
    const planEntries = await fs.readdir(bmadDir).catch(() => [] as string[]);
    const planFiles = planEntries
      .filter((e) => e.endsWith(".md"))
      .map((e) => path.join(bmadDir, e));

    if (scope === "all" || scope === "planning") {
      for (let i = 0; i < planFiles.length; i++) {
        for (let j = i + 1; j < planFiles.length; j++) {
          pairs.push({
            source: planFiles[i],
            target: planFiles[j],
            label: `${path.basename(planFiles[i], ".md")} \u2194 ${path.basename(planFiles[j], ".md")}`,
          });
        }
      }
    }

    // 2. Implementation stories vs Epics/PRD
    if (scope === "all" || scope === "implementation") {
      const epicsFile = planFiles.find((f) => path.basename(f).includes("epic"));
      const prdFile = planFiles.find((f) => path.basename(f).includes("prd"));

      const implEntries = await fs.readdir(implDir).catch(() => [] as string[]);
      const storyFiles = implEntries
        .filter((e) => e.endsWith(".md"))
        .map((e) => path.join(implDir, e));

      // Compare each story against the epics doc
      if (epicsFile && storyFiles.length > 0) {
        for (const story of storyFiles) {
          pairs.push({
            source: epicsFile,
            target: story,
            label: `epics \u2194 ${path.basename(story, ".md")}`,
          });
        }
      }

      // Compare each story against PRD for scope drift
      if (prdFile && storyFiles.length > 0) {
        for (const story of storyFiles) {
          pairs.push({
            source: prdFile,
            target: story,
            label: `prd \u2194 ${path.basename(story, ".md")}`,
          });
        }
      }
    }
  } catch {
    logger.warn({ workspacePath }, "Could not read artifacts for scan");
  }

  return pairs;
}

/**
 * Run a full drift scan for a project.
 * Scans all planning artifact pairs (or a specific artifact vs all others).
 * Runs in the background and updates status as it progresses.
 */
export async function runDriftScan(
  db: Db,
  companyId: string,
  projectId: string,
  workspacePath: string,
  scope: string,
): Promise<void> {
  const existingStatus = activeScanStatus.get(projectId);
  if (existingStatus?.scanning) {
    throw new Error("A scan is already in progress for this project");
  }

  const abortController = new AbortController();
  scanAbortMap.set(projectId, abortController);

  const pairs = await buildScanPairs(workspacePath, scope);

  const status: DriftScanStatus = {
    scanning: true,
    progress: `Starting scan (${pairs.length} pairs)...`,
    completed: 0,
    total: pairs.length,
    lastScanAt: null,
    lastScanIssueCount: null,
  };
  activeScanStatus.set(projectId, status);

  if (pairs.length === 0) {
    status.scanning = false;
    status.progress = "No planning artifacts found to scan";
    status.lastScanAt = new Date().toISOString();
    status.lastScanIssueCount = 0;
    return;
  }

  let totalIssues = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (abortController.signal.aborted) break;

    const pair = pairs[i];
    status.progress = `Analyzing ${pair.label} (${i + 1}/${pairs.length})`;
    status.completed = i;

    try {
      const report = await checkDrift(db, companyId, projectId, pair.source, pair.target);
      totalIssues += report.drifts.length;
    } catch (err) {
      logger.warn({ pair, err }, "Failed to check drift for pair");
    }
  }

  status.scanning = false;
  status.completed = pairs.length;
  status.progress = null;
  status.lastScanAt = new Date().toISOString();
  status.lastScanIssueCount = totalIssues;
  scanAbortMap.delete(projectId);

  // Clean up active status after scan completes (keep for a short time for status queries)
  setTimeout(() => {
    activeScanStatus.delete(projectId);
  }, 60_000);

  logger.info(
    { projectId, pairs: pairs.length, totalIssues },
    "Drift scan complete",
  );
}
