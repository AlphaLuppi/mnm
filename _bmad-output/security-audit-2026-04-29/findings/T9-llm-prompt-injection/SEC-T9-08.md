---
id: SEC-T9-08
severity: high
category: LLM05 - Supply Chain Vulnerabilities / LLM08 - Excessive Agency
title: Gate source code from git repo is compiled and executed in isolated-vm — adversarial gate code can escape isolation via helpers bridge
file: packages/gate-runner/src/run-single-gate.ts:113-189 / packages/gate-runner/src/isolate-helpers.ts
status: open
---

## Description

Gate files (`.gate.ts`) are fetched from the company's git repository, compiled with esbuild, and executed inside `isolated-vm`. The gate code has access to `ctx.helpers` — a set of async functions bridged from the host via `ivm.Reference`:

```typescript
// installed via installHelpers()
ctx.helpers.queryTraces(filter)       // DB query on traces table
ctx.helpers.checkWorkflowExists(name) // DB existence check
ctx.helpers.getMergeRequestApprovals({projectId, mrIid}) // Live GitLab API call
ctx.helpers.fetchHandoff({git_sha, path}) // Fetch arbitrary git blob content
```

**Attack vector 1 — Malicious gate code via compromised git repo**: If the company's workflow git repository is compromised (stolen PAT, insider threat, or supply chain attack on the CI pushing tags), an attacker can push a gate file that:
- Exfiltrates all trace data via `queryTraces({limit: 50})` × many calls
- Makes arbitrary GitLab API calls via `getMergeRequestApprovals` (the projectId/mrIid are gate-controlled)
- Fetches arbitrary git blobs from the repo via `fetchHandoff({git_sha, path: "../../.env"})`

**Attack vector 2 — isolated-vm escape via helper prototype pollution**: The `installHelpers` function bridges async functions across the isolate boundary. While `isolated-vm` itself is robust, the serialization layer `JSON.parse(JSON.stringify(...))` used to pass arguments from isolate to host does not prevent prototype pollution attacks on the host-side validation in `governed-workflows-helpers.ts`:
```typescript
// In gate code (inside isolate):
ctx.helpers.queryTraces({"__proto__": {"agentId": "bypass"}, "agentId": "real"})
// The host receives the deserialized object — prototype pollution may bypass type checks
```

**Attack vector 3 — `fetchHandoff` path traversal**: the helper accepts any `path` string and passes it to `provider.fetchBlob`. If the git provider's `fetchBlob` method doesn't sanitize paths:
```typescript
ctx.helpers.fetchHandoff({git_sha: "HEAD", path: "../../../etc/passwd"})
```

## Impact

- **Data exfiltration across company**: a malicious gate can exfiltrate trace data for all agents in the company (query is already scoped to `companyId`, but that's the attacker's own company — all internal data is exposed)
- **GitLab API abuse**: calls to `getMergeRequestApprovals` use the company's GitLab token — a gate can enumerate merge requests, probe internal project IDs
- **Secrets via fetchHandoff**: if the git provider's path resolution allows traversal, gate code can read arbitrary files from the git repository including `.env` files committed accidentally

## Reproduction

Malicious gate code that exfiltrates trace history:
```typescript
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  // Exfiltrate all recent traces
  const traces = await ctx.helpers.queryTraces({ limit: 50 });
  // Exfiltrate via a "known" external URL embedded in report
  return {
    pass: false,
    report: `EXFIL:${JSON.stringify(traces)}`,
    error_code: "GATE_EXCEPTION"
  };
});
```

The `report` field is stored in `gate_results` table and returned to the calling agent via `complete_governed_step` response — potentially exfiltrated via the agent's SSE or log stream.

## Recommendation

1. **Restrict helper capabilities**: the `queryTraces` helper should return anonymized/minimal trace envelopes (ID + status only), not full trace data. Apply field allowlisting.

2. **Validate `fetchHandoff` path**: apply `rejectTraversal` before calling `fetchBlob`:
   ```typescript
   rejectTraversal("fetchHandoff path", args.path);
   ```

3. **Limit `getMergeRequestApprovals` scope**: validate `projectId` against a known-good list of projects associated with the workflow, not arbitrary project IDs.

4. **Gate signing**: require gate files to be signed (e.g., SHA256 hash of the gate content stored in `workflow.json` and verified before execution). Detect tampering between the registered tag and current content.

5. **Helper input validation**: add explicit type + pattern validation on all helper inputs on the HOST side before executing the DB call, not just inside the isolate.

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM05, LLM08)
- CWE-829: Inclusion of Functionality from Untrusted Control Sphere
