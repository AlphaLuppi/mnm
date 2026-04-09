import { monitorEventLoopDelay } from "node:perf_hooks";
import { logger } from "../middleware/logger.js";

// ── Event Loop Monitor ──────────────────────────────────────────────────────

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// Check every 30s, alert if p99 > 100ms
setInterval(() => {
  const p99 = histogram.percentile(99) / 1e6;
  if (p99 > 100) {
    logger.warn({ p99Ms: Math.round(p99), meanMs: Math.round(histogram.mean / 1e6) }, "mcp.event-loop-lag.high");
  }
  histogram.reset();
}, 30_000).unref();

export function getEventLoopStats() {
  return { p99Ms: Math.round(histogram.percentile(99) / 1e6), meanMs: Math.round(histogram.mean / 1e6) };
}

// ── DB Semaphore (max 15 concurrent MCP queries) ────────────────────────────

export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get active(): number {
    return this.current;
  }
  get waiting(): number {
    return this.queue.length;
  }
}

export const mcpDbSemaphore = new Semaphore(15);
