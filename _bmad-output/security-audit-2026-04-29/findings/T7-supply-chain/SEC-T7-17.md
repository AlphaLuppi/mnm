---
id: SEC-T7-17
severity: low
category: CWE-1104 / Supply Chain
title: No Rust desktop app found — Tauri supply chain scope out of scope (informational)
file: N/A (Cargo.toml not present)
status: info
---

## Description
The CLAUDE.md references a Tauri desktop app (`apps/desktop/src-tauri/`), and `scripts/parity/data.ts` describes a desktop app that "ships as a thin client." However, **no `Cargo.toml`, `Cargo.lock`, or `apps/desktop/` directory exists** in the monorepo root or any subdirectory.

The desktop app is either:
1. In a separate private repository not present in this monorepo.
2. Not yet implemented (the parity tracker shows many features as `missing` on desktop).

## Impact
- **None** for this audit scope — no Rust supply chain surface to audit.
- Future work: when the Tauri desktop app is added, a separate `cargo audit` sweep should be conducted.

## Recommendation
When the desktop Tauri app is created:
1. Add `cargo audit` to CI.
2. Pin all Rust crate versions in `Cargo.lock` and commit the lockfile.
3. Audit `build.rs` scripts for arbitrary code execution.
4. Use `cargo-deny` for license compliance and banned crates.

## References
- https://github.com/rustsec/rustsec
- https://crates.io/crates/cargo-audit
