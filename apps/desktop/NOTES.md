# Architectural Notes — MnM Desktop Sprint 1

Quick reference for design decisions and rationale. Update when making structural changes.

## Tauri 2 Choice

**Why Tauri 2 over alternatives?**
- Smallest footprint (5-15 MB vs 120 MB Electron)
- Native WebView (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux)
- **100% React reuse** — no UI rewrite, zero drift vs web app
- 3x faster cold start than Electron (300-600ms vs 1.5s)
- Cross-platform: macOS → Windows → Linux with single codebase
- See full analysis in `_bmad-output/brainstorming/brainstorming-mnm-desktop-native-2026-04-07.md` section 2.

## tauri-specta Version Pin

**Fixed at `tauri-specta = "=2.0.0-rc.21"`**

- tauri-specta is pre-v2 release candidate; pins ensure reproducible builds
- Auto-generates TypeScript bindings at compile time
- Never manually edit `src/bindings.ts` — it regenerates on every debug build
- Version must match Tauri CLI major.minor (2.x here)
- If upgrading Tauri, update tauri-specta to next RC or release

## Window Background Color `#1c1917`

**Why this specific dark stone color?**
- Matches MnM brand dark palette (existing `ui/` Tailwind theme)
- Eliminates white flash on startup during app initialization
- Consistent with native dark mode on macOS Ventura+
- Users see brand color immediately, not a jarring white window
- Fallback prevents flicker before Vite dev server connects

## Mode-Based Vite Configuration

**Dev vs Prod UI loading:**
- Dev: `http://localhost:5173` (Vite dev server with HMR)
- Prod: `../../../ui/dist/` (prebuilt static files via relative path)

**Why mode instead of env var?**
```bash
bun run dev:desktop      # Uses --mode desktop in Tauri dev config
bun run build:desktop    # Uses --mode desktop for Tauri build
```

Tauri config specifies `devUrl` (dev) and `frontendDist` (prod). No need for env var overhead — mode switches both cleanly.

## Inline Loader Script (Deferred)

**Currently:** Direct HTML loader in `public/index.html`

**Sprint 2 plan:** Extract to `public/loader.js` and load via `<script src="...">` to allow strict CSP.

Deferred because POC has relaxed CSP (`null`). When Sprint 2 hardens CSP, inline scripts will be blocked unless we:
1. Use nonces (requires dynamic HTML generation)
2. Extract script to external file

Option 2 is cleaner. No urgency for Sprint 1.

## Icon Generation Source

**Icon source:** `ui/public/android-chrome-512x512.png` (512px square PNG)

**Generated set:**
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.icns (macOS)
- icon.ico (Windows)

**Why this source?**
- Web app already has it for PWA manifest
- High quality (512px) scales down well to all sizes
- Single source of truth — matches brand across web and desktop

**Regenerate if brand changes:**
```bash
cd apps/desktop
cargo tauri icon ../../ui/public/android-chrome-512x512.png
```

## CSP Strategy (Sprint 1 → Sprint 2)

**Sprint 1 (POC):** `"csp": null` in `tauri.conf.json`
- Relaxed for fast iteration
- Allows inline scripts and external content loading
- Safe for development, not for production

**Sprint 2 (Hardening):**
```json
"csp": "default-src 'self'; connect-src 'self' https://api.mnm.com; script-src 'self'"
```

Requires:
- Extract inline loader → `public/loader.js`
- Nonces for any remaining inline scripts (React hydration, etc.)
- Whitelist specific external resources (API endpoints, analytics)

## Capabilities Scoping

**Sprint 1:** Minimal set in `src-tauri/capabilities/default.json`
```json
{
  "permissions": ["core:default", "core:window:default", "core:event:default"]
}
```

**Why this set?**
- `core:default` — essential window lifecycle
- `core:window:default` — minimize, maximize, close, focus
- `core:event:default` — custom IPC events

**What's NOT included (deferred to later sprints):**
- FS access (needed for file upload features)
- Clipboard (for paste-to-agent)
- Microphone, camera (future recording features)

Each capability added explicitly only when feature uses it.

## Backend Connectivity Roadmap

**Sprint 1 (Dev only):** Vite proxy via dev server
- `http://localhost:5173` with proxy rules in `vite.config.ts`
- Requests to `/api/*` redirect to backend
- Works only in dev mode (`bun run dev:desktop`)

**Sprint 2 (Planned):** Configurable backend URL
- User sets backend URL on first launch
- Tokens stored in Keychain (macOS) / Credential Manager (Windows)
- Packaged DMG connects to remote backend
- Offline mode fallback (local SQLite cache)

**Sprint 1 limitation:** Packaged DMG has no backend connectivity because:
- No config UI for backend URL yet
- No Keychain integration for tokens
- No proxy middleware in bundled app
- Web backend assumes web origin security headers

Sprint 2 removes all of these.

## File Organization

```
src-tauri/
├── src/
│   ├── main.rs         # Entry point, delegates to lib
│   ├── lib.rs          # Init, register commands, window setup
│   └── commands.rs     # IPC handlers (must be exported in lib.rs)
├── tauri.conf.json     # Window, security, bundle config
├── Cargo.toml          # Rust deps (tauri, tauri-specta, serde)
└── capabilities/
    └── default.json    # Permission scopes
```

**Principle:** Keep Rust code minimal. Desktop-specific logic goes in `commands.rs`; share service logic with backend via `packages/` if needed.

## macOS Minimum Version

**Set to 11.0** (Big Sur, 2020)

- macOS 11+ has native WebKit improvements and M1/M2 support
- Older versions still in widespread use but pre-2020; skip them
- Can be lowered to 10.15 (Catalina) if needed by adjusting `tauri.conf.json` but test thoroughly

## Universal Binary (M1/Intel)

**Config:** `macOS.minimumSystemVersion: "11.0"` supports both architectures automatically.

**Build output:** Creates separate binaries in CI:
- `MnM_0.1.0_aarch64.dmg` (Apple Silicon)
- `MnM_0.1.0_x86_64.dmg` (Intel)

Sprint 3 will merge these into a single universal binary for cleaner distribution.

## References

- Brainstorm: `/Users/batum/Projects/mnm/_bmad-output/brainstorming/brainstorming-mnm-desktop-native-2026-04-07.md`
- Tauri docs: https://tauri.app/v1/docs/
- tauri-specta: https://github.com/oscartbeaumont/tauri-specta
- MnM web app: `/Users/batum/Projects/mnm/packages/ui/`
