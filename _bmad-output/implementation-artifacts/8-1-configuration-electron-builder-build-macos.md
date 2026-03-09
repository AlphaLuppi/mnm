# Story 8.1: Configuration Electron Builder & Build macOS

Status: ready-for-dev

## Story

As a **user**,
I want **to build MnM as a native macOS .dmg application**,
So that **I can install and use MnM like any desktop app on my Mac**.

## Acceptance Criteria

### AC1 — Build macOS .dmg via npm script

**Given** le projet MnM est complet
**When** je lance `npm run build:mac`
**Then** electron-builder produit un `.dmg` installable pour macOS
**And** l'app se lance correctement apres installation

### AC2 — macOS app starts and works without elevated privileges

**Given** le .dmg est installe
**When** je lance MnM
**Then** l'app demarre en < 5 secondes (NFR5)
**And** toutes les fonctionnalites (file watching, agent harness, git) fonctionnent sans privileges eleves (NFR10)

### AC3 — electron-builder configuration is correct and complete

**Given** le build est configure
**When** je regarde `electron-builder.yml`
**Then** les targets sont definis : macOS (.dmg), avec icone, nom d'app, et metadata corrects

## Tasks / Subtasks

- [ ] Task 1: Create and configure `electron-builder.yml` (AC: #3)
  - [ ] 1.1 Create `electron-builder.yml` at project root with appId, productName, directories config
  - [ ] 1.2 Configure macOS-specific settings: target `dmg`, category `public.app-category.developer-tools`, icon `resources/icon.icns`
  - [ ] 1.3 Configure `dmg` settings: window size, icon positions, background
  - [ ] 1.4 Configure `files` patterns to include all built assets and exclude dev files
  - [ ] 1.5 Configure `directories.output` to `dist` and `directories.buildResources` to `resources`
  - [ ] 1.6 Configure `asar: true` for app packaging
  - [ ] 1.7 Set `protocols` if needed for deep linking (future-proof, optional)

- [ ] Task 2: Add macOS app icon (AC: #3)
  - [ ] 2.1 Ensure `resources/icon.icns` exists (macOS icon format, 1024x1024 source)
  - [ ] 2.2 Ensure `resources/icon.png` exists (512x512, used as fallback and for Linux)
  - [ ] 2.3 Verify icon renders correctly in Finder and Dock after build

- [ ] Task 3: Add build scripts to `package.json` (AC: #1)
  - [ ] 3.1 Add `"build:mac": "electron-vite build && electron-builder --mac"` to scripts
  - [ ] 3.2 Add `"build": "electron-vite build"` if not already present (compile step only)
  - [ ] 3.3 Add `electron-builder` as devDependency if not already installed
  - [ ] 3.4 Verify `npm run build:mac` produces a `.dmg` in `dist/` directory

- [ ] Task 4: Configure electron-builder for proper file inclusion (AC: #1, #3)
  - [ ] 4.1 Ensure `electron.vite.config.ts` output paths align with electron-builder `files` patterns
  - [ ] 4.2 Verify `out/` directory (electron-vite output) is correctly referenced by electron-builder
  - [ ] 4.3 Ensure native dependencies (if any) are rebuilt for the target platform
  - [ ] 4.4 Add `.gitignore` entry for `dist/` (build output directory)

- [ ] Task 5: Verify macOS build quality (AC: #1, #2)
  - [ ] 5.1 Install the built `.dmg` on macOS and verify app launches
  - [ ] 5.2 Verify cold start < 5 seconds (NFR5)
  - [ ] 5.3 Verify no privilege elevation prompts appear (NFR10)
  - [ ] 5.4 Verify file watching, git service, and agent harness work in packaged app
  - [ ] 5.5 Verify app icon appears correctly in Dock and Finder
  - [ ] 5.6 Verify `About` dialog shows correct app name and version

- [ ] Task 6: Code signing configuration (optional for dev, documented) (AC: #3)
  - [ ] 6.1 Document code signing setup for distribution (Apple Developer certificate)
  - [ ] 6.2 Add `CSC_LINK` and `CSC_KEY_PASSWORD` env var references in electron-builder config
  - [ ] 6.3 Configure `mac.identity` to `null` for unsigned dev builds (skip signing in local dev)
  - [ ] 6.4 Add `afterSign` notarization hook placeholder for future distribution

## Dev Notes

### FRs Covered

This story does not directly cover functional requirements but addresses:
- **NFR5** — Cold start < 5 seconds (verified post-packaging)
- **NFR10** — No elevated privileges required (verified post-packaging)
- Architecture requirement: "electron-builder + GitHub Releases (macOS .dmg)"

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold) — electron-vite project must be scaffolded with `electron.vite.config.ts` and `package.json` configured
- All Epics 1-7 stories that produce application code — the build packages everything

### electron-builder.yml Configuration

```yaml
# electron-builder.yml
appId: com.mnm.app
productName: MnM
copyright: Copyright (c) 2026 MnM Team

directories:
  buildResources: resources
  output: dist

files:
  - out/**/*
  - "!out/**/*.map"
  - package.json

asar: true
compression: normal

mac:
  category: public.app-category.developer-tools
  icon: resources/icon.icns
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  darkModeSupport: true
  hardenedRuntime: true
  gatekeeperAssess: false
  # For unsigned dev builds, set identity to null
  # identity: null

dmg:
  artifactName: "${productName}-${version}-mac.${ext}"
  window:
    width: 540
    height: 380
  contents:
    - x: 410
      y: 190
      type: link
      path: /Applications
    - x: 130
      y: 190
      type: file

# Notarization (requires Apple Developer account)
# afterSign: scripts/notarize.js
```

[Source: architecture.md#Packaging-Distribution]

### package.json Build Scripts

```json
{
  "scripts": {
    "build": "electron-vite build",
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:linux": "electron-vite build && electron-builder --linux",
    "build:win": "electron-vite build && electron-builder --win",
    "build:all": "electron-vite build && electron-builder --mac --linux --win"
  },
  "devDependencies": {
    "electron-builder": "^26.0.0"
  }
}
```

[Source: architecture.md#Packaging-Distribution]

### electron-vite Build Output Alignment

electron-vite compiles to `out/` by default:
- `out/main/index.js` — Main process bundle
- `out/preload/index.js` — Preload script bundle
- `out/renderer/` — Renderer HTML + assets

electron-builder `files` pattern must include `out/**/*` to package these correctly.

```
Project Root
├── out/                    # electron-vite build output
│   ├── main/index.js
│   ├── preload/index.js
│   └── renderer/
│       ├── index.html
│       └── assets/
├── dist/                   # electron-builder output (.dmg, .AppImage, .exe)
├── resources/              # Build resources (icons)
│   ├── icon.icns           # macOS icon
│   ├── icon.ico            # Windows icon
│   └── icon.png            # Linux / fallback icon
└── electron-builder.yml
```

### macOS Code Signing Notes

For local development, code signing can be skipped by setting `mac.identity` to `null` in electron-builder config or via environment variable:

```bash
# Skip code signing for local dev builds
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

For distribution builds (CI/CD), code signing requires:
1. Apple Developer ID Application certificate
2. `CSC_LINK` — Base64-encoded .p12 certificate file
3. `CSC_KEY_PASSWORD` — Certificate password
4. Notarization via `@electron/notarize` (macOS 10.15+)

Notarization script placeholder:

```javascript
// scripts/notarize.js
// const { notarize } = require('@electron/notarize');
// exports.default = async function notarizing(context) {
//   const { electronPlatformName, appOutDir } = context;
//   if (electronPlatformName !== 'darwin') return;
//   await notarize({
//     appBundleId: 'com.mnm.app',
//     appPath: `${appOutDir}/${context.packager.appInfo.productFilename}.app`,
//     appleId: process.env.APPLE_ID,
//     appleIdPassword: process.env.APPLE_ID_PASSWORD,
//     teamId: process.env.APPLE_TEAM_ID,
//   });
// };
```

### Universal Build (arm64 + x64)

The electron-builder config targets both `x64` and `arm64` architectures for macOS. On Apple Silicon Macs, this produces a universal or per-arch `.dmg`. For CI/CD, GitHub Actions `macos-latest` runners support both architectures.

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Build config | kebab-case YAML | `electron-builder.yml` |
| Build scripts | kebab-case | `build:mac`, `build:linux` |
| Output directory | lowercase | `dist/` |
| Resources | lowercase | `resources/icon.icns` |

### Testing Strategy

- **Manual testing** — Install `.dmg` on macOS, verify launch, verify features work
- **NFR5 verification** — Time cold start from click to cockpit displayed (< 5 seconds)
- **NFR10 verification** — Confirm no `sudo` or admin prompts during install or runtime
- **Icon verification** — Check Dock icon, Finder icon, DMG background
- **Smoke test** — Open a Git project, verify file watcher and IPC round-trip work in packaged build
- **CI integration** — Story 8.3 will automate the macOS build in GitHub Actions

### What NOT to Do

- Do NOT use `electron-builder.config.js` — use `electron-builder.yml` as per architecture convention
- Do NOT hardcode signing certificates in the config file — use environment variables
- Do NOT include source maps in production build (`.map` files excluded in `files` pattern)
- Do NOT use `export default` in any new TypeScript files
- Do NOT use `any` type
- Do NOT set `nodeIntegration: true` or `contextIsolation: false` in the BrowserWindow config
- Do NOT include `node_modules` in the build — electron-builder handles dependencies via `asar`
- Do NOT use `electron-packager` — the project uses `electron-builder`
- Do NOT create a `tailwind.config.ts` — Tailwind 4 uses CSS-only config

### References

- [Source: architecture.md#Packaging-Distribution] — electron-builder + GitHub Releases decision
- [Source: architecture.md#Complete-Project-Directory-Structure] — `electron-builder.yml`, `resources/` directory
- [Source: architecture.md#Decision-Impact-Analysis] — Packaging as step 10 in implementation sequence
- [Source: epics.md#Story-8.1] — Acceptance criteria
- [Source: epics.md#Additional-Requirements] — "electron-builder + GitHub Releases (macOS .dmg, Linux .AppImage, Windows .exe)"
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md#electron-vite-Config-Pattern] — Build configuration base

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
