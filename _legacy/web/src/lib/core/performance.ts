import { createChildLogger } from "./logger";

const log = createChildLogger({ module: "performance" });

interface Measurement {
  label: string;
  duration: number;
  timestamp: number;
}

const MAX_BUFFER_SIZE = 1000;
const measurements: Measurement[] = [];

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    recordMeasurement(label, duration);
  }
}

function recordMeasurement(label: string, duration: number): void {
  measurements.push({ label, duration, timestamp: Date.now() });
  if (measurements.length > MAX_BUFFER_SIZE) {
    measurements.shift();
  }

  // Log warnings for slow operations
  const thresholds: Record<string, number> = {
    "git.status": 500,
    "git.diff": 500,
    "git.log": 500,
    "drift.analyze": 5000,
  };

  const threshold = thresholds[label];
  if (threshold && duration > threshold) {
    log.warn(
      { label, duration, threshold },
      `Performance warning: ${label} took ${Math.round(duration)}ms (threshold: ${threshold}ms)`
    );
  }
}

export interface AggregateMetrics {
  label: string;
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export function getAggregates(): AggregateMetrics[] {
  const byLabel = new Map<string, number[]>();

  for (const m of measurements) {
    if (!byLabel.has(m.label)) byLabel.set(m.label, []);
    byLabel.get(m.label)!.push(m.duration);
  }

  const results: AggregateMetrics[] = [];

  for (const [label, durations] of byLabel) {
    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;
    const avg = sorted.reduce((a, b) => a + b, 0) / count;
    const p50 = sorted[Math.floor(count * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(count * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(count * 0.99)] ?? 0;

    results.push({ label, count, avg: Math.round(avg), p50: Math.round(p50), p95: Math.round(p95), p99: Math.round(p99) });
  }

  return results;
}

export function clearMeasurements(): void {
  measurements.length = 0;
}
