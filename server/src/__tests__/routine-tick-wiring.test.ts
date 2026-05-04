import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 0 lock-down: routine schedule tick + issue→routine_run sync wiring.
 *
 * The bug being prevented:
 *   - `tickScheduledTriggers` exists in the service but was never invoked
 *     at startup → all `kind=schedule` triggers were dead code in production.
 *   - `syncRunStatusForIssue` exists but was never called from the issue
 *     PATCH route → routine_runs stayed `received` even when the linked
 *     issue reached a terminal status.
 *
 * These tests are intentionally file-content based (regex on source) so that
 * removing or renaming the wiring trips a clear failure during typecheck/test.
 * They do NOT replace integration coverage that will land with Phase 1.
 */

const repoRoot = resolve(__dirname, "..", "..", "..");
const indexTs = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8");
const issuesRouteTs = readFileSync(resolve(repoRoot, "server/src/routes/issues.ts"), "utf8");

describe("routine schedule tick — server/src/index.ts wiring", () => {
  it("imports routineService from services barrel", () => {
    expect(indexTs).toMatch(/import\s*\{[^}]*\broutineService\b[^}]*\}\s*from\s*"\.\/services\/index\.js"/);
  });

  it("wires a setInterval that calls tickScheduledTriggers", () => {
    expect(indexTs).toMatch(/setInterval\([\s\S]*?tickScheduledTriggers\(\)/);
  });

  it("respects the MNM_DISABLE_AUTO_TRIGGERS=1 kill switch", () => {
    expect(indexTs).toMatch(/MNM_DISABLE_AUTO_TRIGGERS\s*===\s*"1"/);
  });

  it("guards against overlapping ticks via in-flight flag", () => {
    expect(indexTs).toMatch(/routineTickInFlight/);
  });
});

describe("issue → routine_run sync — server/src/routes/issues.ts wiring", () => {
  it("imports routineService", () => {
    expect(issuesRouteTs).toMatch(/import\s*\{[\s\S]*?routineService[\s\S]*?\}\s*from\s*"\.\.\/services\/index\.js"/);
  });

  it("instantiates routinesSvc inside issueRoutes()", () => {
    expect(issuesRouteTs).toMatch(/const\s+routinesSvc\s*=\s*routineService\(db\)/);
  });

  it("calls syncRunStatusForIssue from the PATCH handler when status changes", () => {
    expect(issuesRouteTs).toMatch(/routinesSvc[\s\S]*?\.syncRunStatusForIssue\(issue\.id\)/);
  });
});
