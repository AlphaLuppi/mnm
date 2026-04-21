/**
 * Process-lifetime memoization for sha-pinned blob reads.
 *
 * Rationale: commit shas are immutable, so once we've resolved
 * `(providerId, path, sha) -> content`, the content will never change. This
 * cache lives at the consumer boundary (T4 gate runner, T5 MCP loader) so every
 * process reuse of the same workflow version is free.
 *
 * Eviction is FIFO by insertion order (JS `Map` iteration order) bounded by
 * `maxEntries`. Good enough for MVP — MnM runs are short-lived and the working
 * set is small (typically <50 files per active workflow revision).
 */
export interface ShaCacheOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class ShaCache {
  private readonly entries = new Map<string, string>();
  private readonly maxEntries: number;

  constructor(options: ShaCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private key(providerId: string, path: string, sha: string): string {
    return `${providerId}|${path}|${sha}`;
  }

  get(providerId: string, path: string, sha: string): string | undefined {
    return this.entries.get(this.key(providerId, path, sha));
  }

  set(providerId: string, path: string, sha: string, value: string): void {
    const k = this.key(providerId, path, sha);
    // Re-setting an existing key should not count as a new entry.
    if (!this.entries.has(k) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(k, value);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
