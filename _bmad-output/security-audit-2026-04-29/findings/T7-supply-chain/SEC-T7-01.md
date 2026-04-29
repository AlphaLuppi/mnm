---
id: SEC-T7-01
severity: critical
category: OWASP A06 (Vulnerable and Outdated Components) / CWE-1104
title: protobufjs@7.5.4 — Arbitrary Code Execution (GHSA-xq3m-2v4x-88gg)
file: bun.lock (transitive via dockerode → @grpc/proto-loader → protobufjs)
status: fixed
fixed_commit: ae53182d
fixed_date: 2026-04-29
---

## Description
The resolved version of `protobufjs` in `bun.lock` is **7.5.4**. The CVE fix landed in **7.5.5**. The vulnerability (GHSA-xq3m-2v4x-88gg) allows an attacker who controls a `.proto` file — or the gRPC endpoint being introspected — to trigger arbitrary code execution via a crafted prototype field in the proto file. The package is loaded at runtime by `dockerode` (used by `@mnm/server`) through `@grpc/proto-loader@0.7.15` and `@grpc/proto-loader@0.8.0`.

`bun.lock` entry:
```
"protobufjs": ["protobufjs@7.5.4", "", { "dependencies": ... }, "sha512-CvexbZtbov6jW..."]
```

## Impact
- Arbitrary code execution on the server if a malicious `.proto` schema is parsed (e.g., via user-controlled gRPC service discovery or a manipulated docker daemon's gRPC endpoint).
- Severity is **critical** because the gRPC channel is opened to the local Docker daemon; if an attacker has write access to Docker's gRPC interface or can influence the proto loader path, ACE is achievable.

## CVE References
- GHSA-xq3m-2v4x-88gg — "Arbitrary code execution in protobufjs" (published 2024)
- CVE-2023-36665 (parent CVE family)

## Reproduction
1. Craft a `.proto` file with a `__proto__` key polluting prototype chain.
2. Pass to a service that uses `dockerode`'s gRPC transport (e.g., Docker API health checks).
3. Triggers `JSON.parse` / object merge with tainted prototype — results in RCE in some configurations.

## Recommendation
Add an override in the root `package.json` to force `protobufjs >= 7.5.5`:
```json
"overrides": {
  "protobufjs": "^7.5.5"
}
```
Then run `bun install` to update `bun.lock`.

## References
- https://github.com/advisories/GHSA-xq3m-2v4x-88gg
- https://github.com/protobufjs/protobuf.js/releases/tag/v7.5.5
