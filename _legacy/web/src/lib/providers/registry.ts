import type { AIProvider, ProviderState } from "./types";
import { ClaudeProvider } from "./claude";

const providers: AIProvider[] = [new ClaudeProvider()];

export async function detectAllProviders(): Promise<ProviderState[]> {
  return Promise.all(providers.map((p) => p.detect()));
}

export function getProviderIds(): string[] {
  return providers.map((p) => p.id);
}
