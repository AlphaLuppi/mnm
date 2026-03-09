import crypto from "node:crypto";
import type { DriftReport, DriftItem, DriftSeverity } from "@mnm/shared";

/**
 * In-memory cache of drift reports per project.
 * Key = projectId, Value = array of DriftReports (most recent first).
 */
const reportCache = new Map<string, DriftReport[]>();

const MAX_REPORTS_PER_PROJECT = 50;

/**
 * Mock drift detection — returns realistic fake drifts.
 * Will be replaced by real LLM-based comparison later.
 */
export async function checkDrift(
  projectId: string,
  sourceDoc: string,
  targetDoc: string,
): Promise<DriftReport> {
  // Simulate a small delay like an LLM call
  await new Promise((r) => setTimeout(r, 200));

  const mockDrifts: DriftItem[] = [
    {
      id: crypto.randomUUID(),
      severity: "critical" as DriftSeverity,
      confidence: 0.92,
      description:
        "Le PRD mentionne une authentification OAuth2 mais l'architecture spécifie uniquement des clés API. Contradiction sur le mécanisme d'authentification.",
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
      confidence: 0.78,
      description:
        "Le brief produit exige un support multi-langue (FR/EN) mais aucune story ne couvre l'internationalisation.",
      sourceExcerpt:
        "The product must support French and English locales at launch.",
      targetExcerpt: "",
      sourceDoc,
      targetDoc,
    },
    {
      id: crypto.randomUUID(),
      severity: "minor" as DriftSeverity,
      confidence: 0.65,
      description:
        "La story mentionne un cache Redis alors que l'architecture prévoit un cache en mémoire. Divergence mineure sur la stratégie de cache.",
      sourceExcerpt:
        "Caching layer: in-memory LRU cache with configurable TTL.",
      targetExcerpt:
        "Use Redis for caching API responses with a 5-minute TTL.",
      sourceDoc,
      targetDoc,
    },
  ];

  const report: DriftReport = {
    id: crypto.randomUUID(),
    projectId,
    sourceDoc,
    targetDoc,
    drifts: mockDrifts,
    checkedAt: new Date().toISOString(),
  };

  // Cache the report
  const existing = reportCache.get(projectId) ?? [];
  existing.unshift(report);
  if (existing.length > MAX_REPORTS_PER_PROJECT) {
    existing.length = MAX_REPORTS_PER_PROJECT;
  }
  reportCache.set(projectId, existing);

  return report;
}

/**
 * Returns all cached drift reports for a project.
 */
export function getDriftResults(projectId: string): DriftReport[] {
  return reportCache.get(projectId) ?? [];
}
