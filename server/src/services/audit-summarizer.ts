import type { Db } from "@mnm/db";
import type { AuditSummary, AuditSummaryPeriod, AuditSummaryStats } from "@mnm/shared";
import { auditService } from "./audit.js";
import { emitAudit } from "./audit-emitter.js";

// obs-s03-cache-ttl
export const CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_CACHE_ENTRIES = 100;

// obs-s03-cache-map
interface CacheEntry {
  summary: AuditSummary;
  expiresAt: number;
}

const summaryCache = new Map<string, CacheEntry>();

function cacheKey(companyId: string, period: AuditSummaryPeriod): string {
  return `${companyId}:${period}`;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of summaryCache) {
    if (entry.expiresAt <= now) {
      summaryCache.delete(key);
    }
  }
}

function evictOldestIfNeeded(): void {
  if (summaryCache.size < MAX_CACHE_ENTRIES) return;
  // FIFO eviction: delete the first entry
  const firstKey = summaryCache.keys().next().value;
  if (firstKey !== undefined) {
    summaryCache.delete(firstKey);
  }
}

function periodToMs(period: AuditSummaryPeriod): number {
  switch (period) {
    case "1h": return 60 * 60 * 1000;
    case "6h": return 6 * 60 * 60 * 1000;
    case "12h": return 12 * 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d": return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
  }
}

function periodLabel(period: AuditSummaryPeriod): string {
  switch (period) {
    case "1h": return "the last hour";
    case "6h": return "the last 6 hours";
    case "12h": return "the last 12 hours";
    case "24h": return "the last 24 hours";
    case "7d": return "the last 7 days";
    case "30d": return "the last 30 days";
  }
}

function groupEventsByDomain(actions: string[]): Record<string, number> {
  const domains: Record<string, number> = {};
  for (const action of actions) {
    const domain = action.split(".")[0] ?? "unknown";
    domains[domain] = (domains[domain] ?? 0) + 1;
  }
  return domains;
}

function groupEventsBySeverity(severities: string[]): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const sev of severities) {
    groups[sev] = (groups[sev] ?? 0) + 1;
  }
  return groups;
}

function topActions(actions: string[], limit: number = 5): Array<{ action: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const action of actions) {
    counts[action] = (counts[action] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([action, count]) => ({ action, count }));
}

// obs-s03-fallback-summary
function buildFallbackSummary(
  companyId: string,
  period: AuditSummaryPeriod,
  events: Array<{ action: string; severity: string }>,
  periodStart: Date,
  periodEnd: Date,
): AuditSummary {
  const actions = events.map((e) => e.action);
  const severities = events.map((e) => e.severity);
  const eventsByDomain = groupEventsByDomain(actions);
  const eventsBySeverity = groupEventsBySeverity(severities);
  const topActs = topActions(actions, 5);

  const title = `Activity summary for ${periodLabel(period)}`;

  // Build body from top categories
  const domainEntries = Object.entries(eventsByDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const bodyParts: string[] = [];
  bodyParts.push(`${events.length} audit events recorded during ${periodLabel(period)}.`);
  if (domainEntries.length > 0) {
    const domainStr = domainEntries
      .map(([domain, count]) => `${domain} (${count})`)
      .join(", ");
    bodyParts.push(`Top activity domains: ${domainStr}.`);
  }
  if (eventsBySeverity.warning || eventsBySeverity.error || eventsBySeverity.critical) {
    const alertParts: string[] = [];
    if (eventsBySeverity.warning) alertParts.push(`${eventsBySeverity.warning} warnings`);
    if (eventsBySeverity.error) alertParts.push(`${eventsBySeverity.error} errors`);
    if (eventsBySeverity.critical) alertParts.push(`${eventsBySeverity.critical} critical`);
    bodyParts.push(`Alerts: ${alertParts.join(", ")}.`);
  }

  const stats: AuditSummaryStats = {
    totalEvents: events.length,
    topActions: topActs,
    eventsByDomain,
    eventsBySeverity,
  };

  return {
    id: `summary-${companyId}-${period}-${Date.now()}`,
    companyId,
    title,
    body: bodyParts.join(" "),
    stats,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    source: "fallback" as const,
  };
}

// obs-s03-llm-call
async function generateSummaryViaLlm(
  events: Array<{ action: string; severity: string }>,
  period: AuditSummaryPeriod,
  stats: AuditSummaryStats,
): Promise<{ title: string; body: string } | null> {
  // Attempt to use LLM provider if available
  // This is a pluggable interface — in production, inject your LLM client
  try {
    // Check if LLM provider is configured via environment
    const llmEndpoint = process.env.MNM_LLM_SUMMARY_ENDPOINT;
    const llmApiKey = process.env.MNM_LLM_SUMMARY_API_KEY;

    if (!llmEndpoint || !llmApiKey) {
      return null; // No LLM configured — fall back to stats-based
    }

    const prompt = buildLlmPrompt(events, period, stats);

    const response = await fetch(llmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${llmApiKey}`,
        "x-api-key": llmApiKey,
      },
      body: JSON.stringify({
        model: process.env.MNM_LLM_SUMMARY_MODEL ?? "claude-3-haiku-20240307",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!response.ok) {
      console.warn(`[audit-summarizer] LLM call failed with status ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      content?: Array<{ text: string }>;
    };

    const text = data?.content?.[0]?.text;
    if (!text) return null;

    // Parse response: first line is title, rest is body
    const lines = text.trim().split("\n");
    const title = lines[0]?.replace(/^#+\s*/, "").trim() ?? `Activity summary for ${periodLabel(period)}`;
    const body = lines.slice(1).join(" ").trim() || title;

    return { title, body };
  } catch (err) {
    console.warn("[audit-summarizer] LLM call error, using fallback:", err);
    return null;
  }
}

function buildLlmPrompt(
  events: Array<{ action: string; severity: string }>,
  period: AuditSummaryPeriod,
  stats: AuditSummaryStats,
): string {
  const domainSummary = Object.entries(stats.eventsByDomain)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => `  - ${domain}: ${count} events`)
    .join("\n");

  const topActionsSummary = stats.topActions
    .map((a) => `  - ${a.action}: ${a.count} occurrences`)
    .join("\n");

  const severitySummary = Object.entries(stats.eventsBySeverity)
    .map(([sev, count]) => `  - ${sev}: ${count}`)
    .join("\n");

  return `You are an AI assistant summarizing audit activity for a software development team management platform. Provide a concise, human-readable summary.

Period: ${periodLabel(period)}
Total events: ${stats.totalEvents}

Events by domain:
${domainSummary}

Top actions:
${topActionsSummary}

Events by severity:
${severitySummary}

Write a 1-line title and 2-5 sentence summary in plain English. Focus on what happened, highlight any warnings/errors/critical events, and note the most active areas. Format: first line is the title, then a blank line, then the body paragraphs.`;
}

// ---------- Main Service ----------

export function auditSummarizerService(db: Db) {
  const audit = auditService(db);

  return {
    // obs-s03-summarize-fn
    summarize: async (
      companyId: string,
      period: AuditSummaryPeriod,
      options?: { forceRefresh?: boolean; req?: import("express").Request },
    ): Promise<AuditSummary> => {
      const key = cacheKey(companyId, period);

      // Check cache first (unless forced)
      if (!options?.forceRefresh) {
        evictExpired();
        const cached = summaryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.summary;
        }
      }

      // Calculate period bounds
      const now = new Date();
      const periodMs = periodToMs(period);
      const periodStart = new Date(now.getTime() - periodMs);
      const periodEnd = now;

      // Fetch audit events for the period
      const result = await audit.list({
        companyId,
        dateFrom: periodStart.toISOString(),
        dateTo: periodEnd.toISOString(),
        limit: 200, // Cap for summary
        offset: 0,
        sortOrder: "desc",
      });

      const events = result.data.map((e) => ({
        action: e.action,
        severity: e.severity,
      }));

      // Build stats
      const actions = events.map((e) => e.action);
      const severities = events.map((e) => e.severity);
      const stats: AuditSummaryStats = {
        totalEvents: result.total,
        topActions: topActions(actions, 5),
        eventsByDomain: groupEventsByDomain(actions),
        eventsBySeverity: groupEventsBySeverity(severities),
      };

      // Try LLM, fall back to stats-based
      let summary: AuditSummary;
      const llmResult = await generateSummaryViaLlm(events, period, stats);

      if (llmResult) {
        summary = {
          id: `summary-${companyId}-${period}-${Date.now()}`,
          companyId,
          title: llmResult.title,
          body: llmResult.body,
          stats,
          period,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          generatedAt: new Date().toISOString(),
          source: "llm" as const,
        };
      } else {
        summary = buildFallbackSummary(companyId, period, events, periodStart, periodEnd);
      }

      // Store in cache
      evictOldestIfNeeded();
      summaryCache.set(key, {
        summary,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      // Emit audit event (obs-s03-audit-emit)
      if (options?.req) {
        emitAudit({
          req: options.req,
          db,
          companyId,
          action: "audit.summary_generated",
          targetType: "audit_summary",
          targetId: summary.id,
          metadata: {
            period,
            source: summary.source,
            totalEvents: stats.totalEvents,
          },
          severity: "info",
        });
      }

      return summary;
    },

    // obs-s03-get-summary-fn
    getSummary: async (
      companyId: string,
      period: AuditSummaryPeriod,
    ): Promise<AuditSummary | null> => {
      evictExpired();
      const key = cacheKey(companyId, period);
      const cached = summaryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.summary;
      }
      return null;
    },

    // obs-s03-list-summaries-fn
    listSummaries: async (
      companyId: string,
      options?: { limit?: number; offset?: number },
    ): Promise<{ data: AuditSummary[]; total: number; limit: number; offset: number }> => {
      evictExpired();
      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;

      const allForCompany: AuditSummary[] = [];
      for (const [key, entry] of summaryCache) {
        if (key.startsWith(`${companyId}:`) && entry.expiresAt > Date.now()) {
          allForCompany.push(entry.summary);
        }
      }

      // Sort by generatedAt descending
      allForCompany.sort((a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
      );

      const paged = allForCompany.slice(offset, offset + limit);

      return {
        data: paged,
        total: allForCompany.length,
        limit,
        offset,
      };
    },

    // obs-s03-invalidate-cache-fn
    invalidateCache: (companyId: string): number => {
      let removed = 0;
      for (const key of [...summaryCache.keys()]) {
        if (key.startsWith(`${companyId}:`)) {
          summaryCache.delete(key);
          removed++;
        }
      }
      return removed;
    },
  };
}
