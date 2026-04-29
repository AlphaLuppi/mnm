---
id: SEC-T7-12
severity: medium
category: OWASP A06 / CWE-1104
title: uuid@10.0.0 and uuid@11.1.0 — Missing buffer bounds check (GHSA-w5hq-g745-h8pq)
file: bun.lock (transitive via dockerode@4.0.9 → uuid@10, mermaid → uuid@11)
status: open
---

## Description
Both `uuid@10.0.0` (via `dockerode`) and `uuid@11.1.0` (via `mermaid`) are installed. **GHSA-w5hq-g745-h8pq** affects all `uuid < 14.0.0`: missing buffer bounds check in `v3`/`v5`/`v6` when a `buf` argument is provided can cause a buffer over-read.

Fixed in `uuid >= 14.0.0`.

## Impact
- If user-provided data reaches `uuid.v3()`, `uuid.v4(buf)`, `uuid.v5()`, or `uuid.v6()` calls with a `buf` argument smaller than 16 bytes, memory corruption can occur.
- In practice, MnM uses UUID for Docker container IDs and mermaid diagram IDs — user-controlled UUID generation is uncommon. Risk is **low-to-moderate** in this codebase.

## CVE References
- GHSA-w5hq-g745-h8pq — "uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided"

## Recommendation
Force `uuid >= 14.0.0` via override (note: this is a major version bump — API compatibility review needed):
```json
"overrides": {
  "uuid": "^14.0.0"
}
```
Alternatively, wait for `dockerode` and `mermaid` to upgrade their uuid dependencies.

## References
- https://github.com/advisories/GHSA-w5hq-g745-h8pq
