# Changelog

All notable changes to MnM Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-poc] - 2026-04-07

### Sprint 1 — Bootstrap & POC macOS

#### Added

- **Tauri 2 shell scaffolding** (`apps/desktop/src-tauri/`) with Rust dependencies
- **Rust IPC commands** via tauri-specta:
  - `ping(name: String) → String` — smoke test
  - `appInfo() → AppInfo` — app metadata (version, OS, architecture)
- **Auto-generated TypeScript bindings** in `apps/desktop/src/bindings.ts` (regenerated on every Rust debug build)
- **Window spec**: 1440×900 default, min 1024×640, dark background color `#1c1917` to prevent white flash
- **Universal binary ready** for macOS (Apple Silicon + Intel x64)
- **Brand icon set** auto-generated from `ui/public/android-chrome-512x512.png` (32x32, 128x128, 128x128@2x, ICNS, ICO)
- **Vite config patched** for desktop mode (`base: './'` via `--mode desktop`)
- **Runtime detection helpers**:
  - `isTauri()` function in `ui/src/lib/runtime.ts` to detect Tauri environment
  - `apiBase()` + `resolveWsUrl()` seam helpers for backend connectivity
- **Root workspace scripts**:
  - `bun run dev:desktop` — parallel Vite + Tauri dev mode
  - `bun run build:desktop` — unsigned DMG build
  - `bun run desktop` — shorthand for development

#### Security

- Capabilities scoped to minimal set: `core:default`, `core:window:default`, `core:event:default`
- CSP intentionally set to `null` for POC iteration (hardened in Sprint 2)
- No credentials stored in source code or on disk

#### Known Limitations

- **No code signing** — DMG triggers Gatekeeper warning on first run (right-click → Open to bypass)
- **No notarization** — Apple notarization deferred to Sprint 2
- **No auto-updater** — Manual distribution via landing page in Sprint 1
- **Relaxed CSP** — `null` in Tauri config; Sprint 2 will implement strict CSP with nonce
- **Backend connectivity** — Packaged DMG cannot reach backend without Vite proxy; dev workflow uses localhost:5173
- **No native macOS polish** — Basic window; Liquid Glass, custom traffic lights, and native touches planned for Sprint 3

#### Documentation

- `README.md` with quick-start, prerequisites, architecture, troubleshooting
- `CHANGELOG.md` (this file) for tracking releases
- `NOTES.md` for architectural decisions and rationale

---

## Unreleased

### Sprint 2 — Security Foundations (planned)

- [ ] Strict Content Security Policy with nonce-based inline scripts
- [ ] Extract loader HTML to `public/loader.js` (deferred from POC)
- [ ] Keychain integration for OAuth token storage (`tauri-plugin-keyring`)
- [ ] Tighter IPC capabilities scoping by window
- [ ] `cargo audit` + `bun audit` in CI pipeline
- [ ] Hardened Runtime entitlements for macOS
- [ ] Apple Developer ID code signing via GitHub Actions
- [ ] Notarization automation via tauri-action
- [ ] Signed auto-updater configuration
- [ ] SBOM (Software Bill of Materials) generation

### Sprint 3 — macOS Native Polish (planned)

- [ ] Liquid Glass sidebar effect (NSVisualEffectView)
- [ ] Custom traffic light styling
- [ ] Unified toolbar with window title
- [ ] Tray icon with agent status indicators
- [ ] Native macOS notifications
- [ ] Global hotkey `Cmd+Shift+M` for quick agent prompt
- [ ] Drag & drop files from Finder into chat
- [ ] Universal binary packaging

---

## Notes

- **Versioning:** Following Semantic Versioning. POC releases use `-poc` suffix.
- **Monorepo context:** Desktop app is one of multiple `apps/` in the monorepo; UI is shared via `@mnm/ui` package at `packages/ui/`.
- **Tauri updates:** When upgrading `@tauri-apps/cli` or `tauri` Cargo crate, regenerate bindings and test all IPC calls.
