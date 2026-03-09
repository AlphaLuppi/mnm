import picomatch from "picomatch";
import path from "node:path";

export function isInScope(filePath: string, scope: string[]): boolean {
  if (scope.length === 0) return true;

  const normalized = path.normalize(filePath);

  for (const pattern of scope) {
    const normalizedPattern = path.normalize(pattern);
    if (normalized === normalizedPattern || normalized.startsWith(normalizedPattern + path.sep)) {
      return true;
    }
    if (picomatch.isMatch(normalized, normalizedPattern)) {
      return true;
    }
  }

  return false;
}

export interface ScopeViolation {
  agentId: string;
  filePath: string;
  operation: string;
  scope: string[];
  timestamp: number;
}

export function createScopeViolation(
  agentId: string,
  filePath: string,
  operation: string,
  scope: string[]
): ScopeViolation {
  return {
    agentId,
    filePath,
    operation,
    scope,
    timestamp: Date.now(),
  };
}
