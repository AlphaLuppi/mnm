import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DriftReport,
  DriftItem,
  DriftSeverity,
  DriftType,
  DriftRecommendation,
  DriftDecision,
  DriftScanStatus,
} from "@mnm/shared";
import { logger } from "../middleware/logger.js";
import { analyzeDrift, type DriftResultItem } from "./drift-analyzer.js";
import { loadCustomInstructions } from "./drift-instructions.js";

/**
 * In-memory cache of drift reports per project.
 * Key = projectId, Value = array of DriftReports (most recent first).
 */
const reportCache = new Map<string, DriftReport[]>();

const MAX_REPORTS_PER_PROJECT = 50;

/**
 * Per-project scan status tracking.
 */
const scanStatusMap = new Map<string, DriftScanStatus>();

/** Abort controllers for cancellable scans */
const scanAbortMap = new Map<string, AbortController>();

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
 * Convert an LLM drift result item to a DriftItem.
 */
function toDriftItem(
  item: DriftResultItem,
  sourceDoc: string,
  targetDoc: string,
): DriftItem {
  return {
    id: crypto.randomUUID(),
    severity: item.severity,
    driftType: item.drift_type,
    confidence: item.confidence,
    description: item.description,
    recommendation: item.recommendation,
    sourceExcerpt: item.source_excerpt,
    targetExcerpt: item.target_excerpt,
    sourceDoc,
    targetDoc,
    decision: "pending" as DriftDecision,
  };
}

/**
 * Generate mock drift items for testing when no API key is available.
 */
function generateMockDrifts(sourceDoc: string, targetDoc: string): DriftItem[] {
  return [
    {
      id: crypto.randomUUID(),
      severity: "critical" as DriftSeverity,
      driftType: "approach_change" as DriftType,
      confidence: 0.92,
      description:
        "Le PRD mentionne une authentification OAuth2 mais l'architecture spécifie uniquement des clés API. Contradiction sur le mécanisme d'authentification.",
      recommendation: "recenter_code" as DriftRecommendation,
      sourceExcerpt:
        "Authentication will be handled via OAuth2 with refresh tokens for all user-facing endpoints.",
      targetExcerpt:
        "All endpoints are secured with API key authentication passed via X-Api-Key header.",
      sourceDoc,
      targetDoc,
      decision: "pending" as DriftDecision,
    },
    {
      id: crypto.randomUUID(),
      severity: "moderate" as DriftSeverity,
      driftType: "scope_expansion" as DriftType,
      confidence: 0.78,
      description:
        "Le brief produit exige un support multi-langue (FR/EN) mais aucune story ne couvre l'internationalisation.",
      recommendation: "update_spec" as DriftRecommendation,
      sourceExcerpt:
        "The product must support French and English locales at launch.",
      targetExcerpt: "",
      sourceDoc,
      targetDoc,
      decision: "pending" as DriftDecision,
    },
    {
      id: crypto.randomUUID(),
      severity: "minor" as DriftSeverity,
      driftType: "design_deviation" as DriftType,
      confidence: 0.65,
      description:
        "La story mentionne un cache Redis alors que l'architecture prévoit un cache en mémoire. Divergence mineure sur la stratégie de cache.",
      recommendation: "recenter_code" as DriftRecommendation,
      sourceExcerpt:
        "Caching layer: in-memory LRU cache with configurable TTL.",
      targetExcerpt:
        "Use Redis for caching API responses with a 5-minute TTL.",
      sourceDoc,
      targetDoc,
      decision: "pending" as DriftDecision,
    },
  ];
}

/**
 * Cache a report and enforce the max limit.
 */
function cacheReport(report: DriftReport): void {
  const existing = reportCache.get(report.projectId) ?? [];
  existing.unshift(report);
  if (existing.length > MAX_REPORTS_PER_PROJECT) {
    existing.length = MAX_REPORTS_PER_PROJECT;
  }
  reportCache.set(report.projectId, existing);
}

/**
 * Check drift between two documents.
 *
 * Uses the Claude API if ANTHROPIC_API_KEY is set,
 * otherwise falls back to mock data for development.
 */
export async function checkDrift(
  projectId: string,
  sourceDoc: string,
  targetDoc: string,
  customInstructions?: string,
): Promise<DriftReport> {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  let drifts: DriftItem[];

  if (hasApiKey) {
    // Real LLM-powered drift analysis
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

    drifts = results.map((r) => toDriftItem(r, sourceDoc, targetDoc));
    logger.info(
      { driftCount: drifts.length, sourceDoc, targetDoc },
      "Drift analysis complete",
    );
  } else {
    // Mock mode for development
    logger.info(
      { sourceDoc, targetDoc },
      "Using mock drift data (no ANTHROPIC_API_KEY set)",
    );
    await new Promise((r) => setTimeout(r, 200));
    drifts = generateMockDrifts(sourceDoc, targetDoc);
  }

  const report: DriftReport = {
    id: crypto.randomUUID(),
    projectId,
    sourceDoc,
    targetDoc,
    drifts,
    checkedAt: new Date().toISOString(),
  };

  cacheReport(report);
  return report;
}

/**
 * Returns all cached drift reports for a project.
 */
export function getDriftResults(projectId: string): DriftReport[] {
  return reportCache.get(projectId) ?? [];
}

/**
 * Resolve a drift item (accept or reject).
 * Returns the updated DriftItem or null if not found.
 */
export function resolveDrift(
  projectId: string,
  driftId: string,
  decision: "accepted" | "rejected",
  remediationNote?: string,
): DriftItem | null {
  const reports = reportCache.get(projectId);
  if (!reports) return null;

  for (const report of reports) {
    const drift = report.drifts.find((d) => d.id === driftId);
    if (drift) {
      drift.decision = decision;
      drift.decidedAt = new Date().toISOString();
      if (remediationNote) {
        drift.remediationNote = remediationNote;
      }
      logger.info(
        { driftId, decision, projectId },
        "Drift resolved",
      );
      return drift;
    }
  }
  return null;
}

/**
 * Get scan status for a project.
 */
export function getDriftScanStatus(projectId: string): DriftScanStatus {
  return scanStatusMap.get(projectId) ?? getDefaultScanStatus();
}

/**
 * Cancel an ongoing scan for a project.
 */
export function cancelDriftScan(projectId: string): boolean {
  const controller = scanAbortMap.get(projectId);
  if (controller) {
    controller.abort();
    scanAbortMap.delete(projectId);
    const status = scanStatusMap.get(projectId);
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
  const pairs: Array<{ source: string; target: string; label: string }> = [];

  try {
    const entries = await fs.readdir(bmadDir);
    const mdFiles = entries
      .filter((e) => e.endsWith(".md"))
      .map((e) => path.join(bmadDir, e));

    if (scope !== "all") {
      // Scan specific artifact against all others
      const targetPath = path.join(bmadDir, scope);
      const targetExists = mdFiles.some((f) => f === targetPath);
      if (!targetExists) return [];

      for (const file of mdFiles) {
        if (file === targetPath) continue;
        pairs.push({
          source: targetPath,
          target: file,
          label: `${path.basename(targetPath, ".md")} ↔ ${path.basename(file, ".md")}`,
        });
      }
    } else {
      // Full scan: compare each pair once
      for (let i = 0; i < mdFiles.length; i++) {
        for (let j = i + 1; j < mdFiles.length; j++) {
          pairs.push({
            source: mdFiles[i],
            target: mdFiles[j],
            label: `${path.basename(mdFiles[i], ".md")} ↔ ${path.basename(mdFiles[j], ".md")}`,
          });
        }
      }
    }
  } catch {
    logger.warn({ workspacePath }, "Could not read planning artifacts for scan");
  }

  return pairs;
}

/**
 * Run a full drift scan for a project.
 * Scans all planning artifact pairs (or a specific artifact vs all others).
 * Runs in the background and updates status as it progresses.
 */
export async function runDriftScan(
  projectId: string,
  workspacePath: string,
  scope: string,
): Promise<void> {
  const existingStatus = scanStatusMap.get(projectId);
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
  scanStatusMap.set(projectId, status);

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
      const report = await checkDrift(projectId, pair.source, pair.target);
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

  logger.info(
    { projectId, pairs: pairs.length, totalIssues },
    "Drift scan complete",
  );
}
