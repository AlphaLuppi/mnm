# Story 8.2: Builds Linux & Windows

Status: ready-for-dev

## Story

As a **user**,
I want **to build MnM for Linux (.AppImage) and Windows (.exe)**,
So that **MnM is disponible sur les 3 plateformes majeures**.

## Acceptance Criteria

### AC1 — Build Linux .AppImage via npm script

**Given** le projet MnM est complet
**When** je lance `npm run build:linux`
**Then** electron-builder produit un `.AppImage` fonctionnel pour Linux

### AC2 — Build Windows .exe via npm script

**Given** le projet MnM est complet
**When** je lance `npm run build:win`
**Then** electron-builder produit un `.exe` installable pour Windows

### AC3 — Cross-platform test parity (NFR11)

**Given** les builds sont produits sur les 3 plateformes
**When** je lance les tests d'integration filesystem et process
**Then** la meme suite de tests passe sur macOS, Linux et Windows avec un taux de reussite identique (NFR11)

### AC4 — Platform-adaptive keyboard shortcuts

**Given** les raccourcis clavier utilisent `Cmd`
**When** l'app tourne sur Linux ou Windows
**Then** `Cmd` est remplace par `Ctrl` automatiquement (detection `navigator.platform`)

## Tasks / Subtasks

- [ ] Task 1: Add Linux configuration to `electron-builder.yml` (AC: #1)
  - [ ] 1.1 Add `linux` section with target `AppImage`, category `Development`
  - [ ] 1.2 Configure Linux icon: `resources/icon.png` (512x512 PNG)
  - [ ] 1.3 Set `linux.artifactName` pattern for consistent naming
  - [ ] 1.4 Configure `appImage` settings (license, desktop integration)
  - [ ] 1.5 Add `linux.synopsis` and `linux.description` metadata

- [ ] Task 2: Add Windows configuration to `electron-builder.yml` (AC: #2)
  - [ ] 2.1 Add `win` section with target `nsis`, icon `resources/icon.ico`
  - [ ] 2.2 Configure `nsis` settings: `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`
  - [ ] 2.3 Set `win.artifactName` pattern for consistent naming
  - [ ] 2.4 Configure `nsis.installerIcon` and `nsis.uninstallerIcon`
  - [ ] 2.5 Set `win.requestedExecutionLevel: asInvoker` to avoid UAC elevation (NFR10)

- [ ] Task 3: Ensure platform-specific icons exist (AC: #1, #2)
  - [ ] 3.1 Verify `resources/icon.icns` exists (macOS, from Story 8.1)
  - [ ] 3.2 Verify `resources/icon.png` exists (Linux, 512x512 minimum)
  - [ ] 3.3 Ensure `resources/icon.ico` exists (Windows, multi-resolution: 16/32/48/64/128/256)
  - [ ] 3.4 All icons should be generated from a single 1024x1024 source

- [ ] Task 4: Implement platform-adaptive keyboard shortcut utility (AC: #4)
  - [ ] 4.1 Create `src/renderer/src/shared/utils/platform.ts` with `getPlatformModifier()` function
  - [ ] 4.2 Return `'Cmd'` for macOS, `'Ctrl'` for Linux/Windows based on `navigator.platform`
  - [ ] 4.3 Create `formatShortcut(shortcut: string): string` that replaces `Cmd` with `Ctrl` on non-macOS
  - [ ] 4.4 Export `isMac`, `isLinux`, `isWindows` boolean constants
  - [ ] 4.5 Update all shortcut display strings to use `formatShortcut()`
  - [ ] 4.6 Write unit tests for platform detection utility

- [ ] Task 5: Ensure Electron accelerators use platform-aware keys (AC: #4)
  - [ ] 5.1 Review all `globalShortcut.register()` calls in main process
  - [ ] 5.2 Use `CommandOrControl` accelerator prefix (Electron built-in) instead of hardcoded `Cmd` or `Ctrl`
  - [ ] 5.3 Verify `Cmd+K` (command palette) works as `Ctrl+K` on Linux/Windows
  - [ ] 5.4 Verify `Cmd+Shift+D` (drift panel) works as `Ctrl+Shift+D` on Linux/Windows
  - [ ] 5.5 Verify `Cmd+Enter` (primary action) works as `Ctrl+Enter` on Linux/Windows

- [ ] Task 6: Cross-platform test verification (AC: #3)
  - [ ] 6.1 Review all tests that touch filesystem APIs for platform-specific path handling
  - [ ] 6.2 Use `path.join()` / `path.resolve()` instead of hardcoded `/` separators
  - [ ] 6.3 Ensure file watcher tests abstract platform differences (FSEvents vs inotify vs ReadDirectoryChangesW)
  - [ ] 6.4 Ensure process spawn tests use platform-appropriate shell commands
  - [ ] 6.5 Add `process.platform` guards where platform-specific behavior is required
  - [ ] 6.6 Document any tests that can only run on specific platforms

- [ ] Task 7: Verify Linux build (AC: #1)
  - [ ] 7.1 Run `npm run build:linux` (on Linux or via CI)
  - [ ] 7.2 Verify `.AppImage` is produced in `dist/`
  - [ ] 7.3 Verify AppImage launches and displays the cockpit
  - [ ] 7.4 Verify file watching works (inotify backend)
  - [ ] 7.5 Verify no elevated privileges required

- [ ] Task 8: Verify Windows build (AC: #2)
  - [ ] 8.1 Run `npm run build:win` (on Windows or via CI cross-compilation)
  - [ ] 8.2 Verify `.exe` installer is produced in `dist/`
  - [ ] 8.3 Verify installer runs without UAC elevation
  - [ ] 8.4 Verify installed app launches and displays the cockpit
  - [ ] 8.5 Verify file watching works (ReadDirectoryChangesW backend)

## Dev Notes

### FRs Covered

This story does not directly cover functional requirements but addresses:
- **NFR10** — No elevated privileges required on any platform
- **NFR11** — Cross-platform test parity (macOS, Linux, Windows)
- Architecture requirement: "electron-builder + GitHub Releases (Linux .AppImage, Windows .exe)"

### Dependencies on Previous Stories

- **Story 8.1** (electron-builder macOS) — `electron-builder.yml` base configuration must exist, build scripts in `package.json` must be set up
- **Story 1.1** (Project Scaffold) — electron-vite project structure
- **Story 1.2** (Layout) — Keyboard shortcuts defined (need to be made platform-adaptive)

### Updated electron-builder.yml (Linux + Windows additions)

```yaml
# electron-builder.yml (additions to Story 8.1 config)

linux:
  category: Development
  icon: resources/icon.png
  target:
    - target: AppImage
      arch:
        - x64
  synopsis: "AI Agent Supervision IDE"
  description: "MnM is an open-source IDE for AI agent-driven development."
  desktop:
    StartupWMClass: mnm

appImage:
  artifactName: "${productName}-${version}-linux.${ext}"
  license: LICENSE

win:
  icon: resources/icon.ico
  target:
    - target: nsis
      arch:
        - x64
  requestedExecutionLevel: asInvoker
  # No code signing for dev builds
  # certificateFile: ...
  # certificatePassword: ...

nsis:
  artifactName: "${productName}-${version}-win-setup.${ext}"
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
  deleteAppDataOnUninstall: false
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: MnM
```

[Source: architecture.md#Packaging-Distribution]
[Source: epics.md#Story-8.2]

### Platform Detection Utility

```typescript
// src/renderer/src/shared/utils/platform.ts

export const isMac: boolean = navigator.platform.toUpperCase().includes('MAC');
export const isWindows: boolean = navigator.platform.toUpperCase().includes('WIN');
export const isLinux: boolean = !isMac && !isWindows;

export function getPlatformModifier(): 'Cmd' | 'Ctrl' {
  return isMac ? 'Cmd' : 'Ctrl';
}

export function formatShortcut(shortcut: string): string {
  if (isMac) return shortcut;
  return shortcut
    .replace(/Cmd/g, 'Ctrl')
    .replace(/\u2318/g, 'Ctrl');
}

// Usage in components:
// <kbd>{formatShortcut('Cmd+K')}</kbd>
// Renders "Cmd+K" on macOS, "Ctrl+K" on Linux/Windows
```

[Source: ux-design-specification.md#Keyboard-Shortcuts]
[Source: ux-design-specification.md#Implementation-Guidelines]

### Electron Accelerator Pattern (Main Process)

```typescript
// In main process — use Electron's built-in CommandOrControl
import { globalShortcut } from 'electron';

// CommandOrControl maps to Cmd on macOS, Ctrl on Linux/Windows
globalShortcut.register('CommandOrControl+K', () => {
  // Open command palette
  mainWindow.webContents.send('stream:command-palette', { action: 'open' });
});

globalShortcut.register('CommandOrControl+Shift+D', () => {
  // Toggle drift panel
  mainWindow.webContents.send('stream:drift-panel', { action: 'toggle' });
});
```

This is Electron's built-in mechanism. Do NOT manually check `process.platform` for keyboard shortcuts in the main process.

[Source: ux-design-specification.md#Keyboard-Shortcuts]

### Cross-Platform File Path Handling

```typescript
// ALWAYS use path.join() — never hardcode separators
import { join } from 'path';

// Good
const settingsPath = join(projectRoot, '.mnm', 'settings.json');

// Bad — breaks on Windows
// const settingsPath = `${projectRoot}/.mnm/settings.json`;
```

### Platform-Specific chokidar Backends

chokidar automatically selects the optimal backend per platform. No configuration needed:

| Platform | Backend | Notes |
|---|---|---|
| macOS | FSEvents | Native, efficient, NFR2 compliant |
| Linux | inotify | Kernel-level, watch limit may need increasing for large projects |
| Windows | ReadDirectoryChangesW | Native, polling fallback for network drives |

If inotify watch limit is hit on Linux, users may need:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
```

This should be documented in the README, not handled in code.

### Platform-Specific Process Spawn Considerations

```typescript
// Agent harness — platform-aware shell
import { spawn } from 'child_process';

function spawnAgent(command: string, args: string[], cwd: string) {
  return spawn(command, args, {
    cwd,
    // shell: true handles PATH resolution across platforms
    shell: process.platform === 'win32' ? 'cmd.exe' : true,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
```

### Icon Requirements

| Platform | Format | Sizes | File |
|---|---|---|---|
| macOS | `.icns` | 16/32/64/128/256/512/1024 | `resources/icon.icns` |
| Windows | `.ico` | 16/32/48/64/128/256 | `resources/icon.ico` |
| Linux | `.png` | 512x512 minimum | `resources/icon.png` |

Generate all formats from a single 1024x1024 PNG source. Tools:
- macOS: `iconutil` (built-in) or `png2icns`
- Windows: ImageMagick `convert icon.png icon.ico`
- Or use `electron-icon-builder` npm package

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Platform utility | kebab-case `.ts` | `platform.ts` |
| Exported constants | camelCase boolean | `isMac`, `isLinux`, `isWindows` |
| Exported functions | camelCase | `getPlatformModifier()`, `formatShortcut()` |
| Build scripts | kebab-case | `build:linux`, `build:win` |
| Artifact names | template pattern | `${productName}-${version}-linux.${ext}` |

### Testing Strategy

- **Unit tests** — `platform.ts` utility with mocked `navigator.platform` values
- **Cross-platform CI** — Story 8.3 sets up GitHub Actions matrix for macOS, Linux, Windows
- **NFR11 verification** — Same test suite runs on all 3 platforms in CI, same pass rate required
- **Manual smoke tests** — Install and launch on each platform, verify core features
- **Keyboard shortcut tests** — Verify `CommandOrControl` accelerators work correctly per platform

```typescript
// src/renderer/src/shared/utils/platform.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('platform utilities', () => {
  it('formatShortcut replaces Cmd with Ctrl on non-Mac', () => {
    // Mock navigator.platform for Linux
    vi.stubGlobal('navigator', { platform: 'Linux x86_64' });

    // Re-import to pick up mocked value
    const { formatShortcut } = await import('./platform');
    expect(formatShortcut('Cmd+K')).toBe('Ctrl+K');
    expect(formatShortcut('Cmd+Shift+D')).toBe('Ctrl+Shift+D');

    vi.unstubAllGlobals();
  });

  it('formatShortcut preserves Cmd on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' });

    const { formatShortcut } = await import('./platform');
    expect(formatShortcut('Cmd+K')).toBe('Cmd+K');

    vi.unstubAllGlobals();
  });
});
```

### What NOT to Do

- Do NOT use `export default` in any new TypeScript files — named exports only
- Do NOT use `any` type — use `unknown` + type guards
- Do NOT hardcode path separators (`/` or `\\`) — always use `path.join()`
- Do NOT hardcode `Cmd` or `Ctrl` in shortcut display strings — use `formatShortcut()`
- Do NOT manually check `process.platform` for Electron accelerators — use `CommandOrControl`
- Do NOT set `requestedExecutionLevel` to `requireAdministrator` on Windows — NFR10 requires no elevation
- Do NOT bundle platform-specific native modules for all platforms in a single build — electron-builder handles this
- Do NOT include source maps in production builds
- Do NOT create a `tailwind.config.ts` — Tailwind 4 uses CSS-only config

### References

- [Source: architecture.md#Packaging-Distribution] — electron-builder targets: macOS .dmg, Linux .AppImage, Windows .exe
- [Source: architecture.md#Cross-Cutting-Concerns] — Cross-platform abstraction: FSEvents/inotify/ReadDirectoryChangesW
- [Source: architecture.md#Complete-Project-Directory-Structure] — `resources/` directory with icons
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — Cmd+K, Cmd+Shift+D, Cmd+Enter
- [Source: ux-design-specification.md#Implementation-Guidelines] — `navigator.platform` detection for Cmd vs Ctrl
- [Source: ux-design-specification.md#Platform-Strategy] — macOS principal, Linux, Windows
- [Source: epics.md#Story-8.2] — Acceptance criteria
- [Source: epics.md#NonFunctional-Requirements] — NFR10 (no elevated privileges), NFR11 (cross-platform test parity)
- [Source: 8-1-configuration-electron-builder-build-macos.md] — Base electron-builder config

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
