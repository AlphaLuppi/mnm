import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { DriftReport, DriftItem, DriftSeverity, DriftType, DriftRecommendation } from "@mnm/shared";
import { logger } from "../middleware/logger.js";
import { analyzeDrift, type DriftResultItem } from "./drift-analyzer.js";

/**
 * In-memory cache of drift reports per project.
 * Key = projectId, Value = array of DriftReports (most recent first).
 */
const reportCache = new Map<string, DriftReport[]>();

const MAX_REPORTS_PER_PROJECT = 50;

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

    logger.info({ sourceDoc, targetDoc, projectId }, "Starting drift analysis");

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
