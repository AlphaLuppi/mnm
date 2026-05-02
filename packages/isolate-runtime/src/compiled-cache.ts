/**
 * Process-lifetime memoization for compiled isolate source (e.g. esbuild
 * transforms of TS gate / hook bodies).
 *
 * Rationale: a pinned `(gitSha, sourcePath)` maps to an immutable TS
 * source file, which transforms deterministically to the same JS bundle
 * every time. Caching the transformed JS skips compile overhead (~5 ms
 * per small body) on every subsequent invocation in the same process.
 *
 * Mirrors the `@mnm/git-provider` `ShaCache` pattern (FIFO, Map-backed,
 * bounded by `maxEntries`). Kept as a separate class so consumers can size
 * each cache independently — compiled JS is a few kB per entry whereas blob
 * reads can be anything.
 */
export interface CompiledCacheOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class CompiledCache {
  private readonly entries = new Map<string, string>();
  private readonly maxEntries: number;

  constructor(options: CompiledCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private key(gitSha: string, sourcePath: string): string {
    // JSON encoding prevents separator-collision attacks when a `path`
    // contains the previous `|` separator.
    return JSON.stringify([gitSha, sourcePath]);
  }

  get(gitSha: string, sourcePath: string): string | undefined {
    return this.entries.get(this.key(gitSha, sourcePath));
  }

  set(gitSha: string, sourcePath: string, compiledJs: string): void {
    const k = this.key(gitSha, sourcePath);
    if (!this.entries.has(k) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(k, compiledJs);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
