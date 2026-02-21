import { indexSpecs } from "@/lib/spec/indexer";
import { scanCommits } from "@/lib/git/commit-scanner";
import { initDriftDetection } from "@/lib/drift";
import { detectAllProviders } from "@/lib/providers/registry";
import { runIncrementalDiscovery } from "@/lib/discovery/discovery-service";
import type { ProviderState } from "@/lib/providers/types";
import type { DiscoverySummary } from "@/lib/discovery/discovery-service";
import { createChildLogger } from "@/lib/core/logger";
import { getMnMRoot } from "@/lib/core/paths";

const log = createChildLogger({ module: "bootstrap" });

export interface BootstrapResult {
  specsIndexed: number;
  commitsScanned: number;
  providers: ProviderState[];
  discovery: DiscoverySummary | null;
}

let _result: BootstrapResult | null = null;
let _promise: Promise<BootstrapResult> | null = null;

export async function ensureBootstrapped(): Promise<BootstrapResult> {
  if (_result) return _result;
  if (_promise) return _promise;
  _promise = runBootstrap();
  _result = await _promise;
  return _result;
}

async function runBootstrap(): Promise<BootstrapResult> {
  const repoRoot = getMnMRoot();
  log.info({ repoRoot }, "Starting bootstrap");

  // Run spec indexing and commit scanning in parallel
  const [indexResult, scanResult] = await Promise.all([
    indexSpecs(repoRoot).catch((err) => {
      log.error({ err }, "Spec indexing failed during bootstrap");
      return { indexed: 0 } as { indexed: number };
    }),
    scanCommits().catch((err) => {
      log.error({ err }, "Commit scanning failed during bootstrap");
      return { scanned: 0 } as { scanned: number };
    }),
  ]);

  // Initialize drift detection (event listener setup)
  initDriftDetection();

  // Detect providers
  const providers = await detectAllProviders();

  // Run discovery (incremental if a previous scan exists)
  const discovery = await runIncrementalDiscovery(repoRoot).catch((err) => {
    log.error({ err }, "Discovery failed during bootstrap");
    return null;
  });

  const result: BootstrapResult = {
    specsIndexed: indexResult.indexed,
    commitsScanned: scanResult.scanned,
    providers,
    discovery,
  };

  log.info(
    {
      specsIndexed: result.specsIndexed,
      commitsScanned: result.commitsScanned,
      providerCount: result.providers.length,
      discoveryTotal: discovery?.total ?? 0,
    },
    "Bootstrap completed"
  );

  return result;
}

export function resetBootstrap(): void {
  _result = null;
  _promise = null;
}

export async function refreshProviders(): Promise<ProviderState[]> {
  const providers = await detectAllProviders();
  if (_result) {
    _result.providers = providers;
  }
  return providers;
}
