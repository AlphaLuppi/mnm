# Story 8.3: GitHub Actions CI/CD Pipeline

Status: ready-for-dev

## Story

As a **user**,
I want **automated CI/CD that builds, tests, and releases MnM on all platforms**,
So that **every push is validated and releases are automatic on tag**.

## Acceptance Criteria

### AC1 — CI pipeline on push/PR (lint + test + build on 3 platforms)

**Given** un push est fait sur la branche principale
**When** GitHub Actions se declenche (`.github/workflows/ci.yml`)
**Then** le pipeline execute : lint (eslint + eslint-plugin-jsx-a11y), tests (vitest), build sur macOS, Linux, et Windows
**And** le pipeline echoue si un step echoue

### AC2 — Release pipeline on tag (build + GitHub Release with artifacts)

**Given** un tag est cree (ex: `v0.1.0`)
**When** GitHub Actions se declenche (`.github/workflows/release.yml`)
**Then** les builds sont produits pour les 3 plateformes
**And** une GitHub Release est creee automatiquement avec les artefacts (.dmg, .AppImage, .exe)

### AC3 — Accessibility and unit tests in CI

**Given** le pipeline CI tourne
**When** les tests s'executent
**Then** les tests accessibilite (`eslint-plugin-jsx-a11y`) et les tests unitaires (`@testing-library/jest-dom` assertions) sont inclus

### AC4 — Release artifacts downloadable from GitHub Releases

**Given** le pipeline release est termine
**When** je vais sur la page GitHub Releases
**Then** les 3 binaires sont telechargeables avec les notes de release

## Tasks / Subtasks

- [ ] Task 1: Create CI workflow (`.github/workflows/ci.yml`) (AC: #1, #3)
  - [ ] 1.1 Create `.github/workflows/` directory structure
  - [ ] 1.2 Configure workflow trigger: `push` to `main`/`master`, `pull_request` to `main`/`master`
  - [ ] 1.3 Set up matrix strategy for 3 OS: `ubuntu-latest`, `macos-latest`, `windows-latest`
  - [ ] 1.4 Add step: checkout code (`actions/checkout@v4`)
  - [ ] 1.5 Add step: setup Node.js (`actions/setup-node@v4`, node version from `.nvmrc` or `package.json`)
  - [ ] 1.6 Add step: cache `node_modules` (`actions/cache@v4`, key based on `package-lock.json` hash)
  - [ ] 1.7 Add step: `npm ci` (clean install)
  - [ ] 1.8 Add step: lint (`npm run lint`) — includes eslint + eslint-plugin-jsx-a11y
  - [ ] 1.9 Add step: type-check (`npm run typecheck` or `npx tsc --noEmit`)
  - [ ] 1.10 Add step: test (`npm run test`) — vitest with coverage
  - [ ] 1.11 Add step: build (`npm run build`) — electron-vite build (no packaging, just compilation)
  - [ ] 1.12 Ensure lint and typecheck run only once (not per-OS), tests and build run on all 3 OS

- [ ] Task 2: Create Release workflow (`.github/workflows/release.yml`) (AC: #2, #4)
  - [ ] 2.1 Configure workflow trigger: `push` tags matching `v*` pattern
  - [ ] 2.2 Set up matrix strategy for 3 OS builds
  - [ ] 2.3 Add step: checkout code
  - [ ] 2.4 Add step: setup Node.js with cache
  - [ ] 2.5 Add step: `npm ci`
  - [ ] 2.6 Add step: build macOS on `macos-latest` (`npm run build:mac`)
  - [ ] 2.7 Add step: build Linux on `ubuntu-latest` (`npm run build:linux`)
  - [ ] 2.8 Add step: build Windows on `windows-latest` (`npm run build:win`)
  - [ ] 2.9 Add step: upload build artifacts (`actions/upload-artifact@v4`)
  - [ ] 2.10 Add job: create GitHub Release after all builds succeed
  - [ ] 2.11 Use `softprops/action-gh-release@v2` to create release with artifacts
  - [ ] 2.12 Configure release notes from tag message or CHANGELOG
  - [ ] 2.13 Attach `.dmg`, `.AppImage`, `.exe` to the release

- [ ] Task 3: Add required npm scripts for CI (AC: #1, #3)
  - [ ] 3.1 Ensure `"lint": "eslint . --ext .ts,.tsx"` exists in `package.json`
  - [ ] 3.2 Ensure `"typecheck": "tsc --noEmit"` exists in `package.json`
  - [ ] 3.3 Ensure `"test": "vitest run"` exists in `package.json` (non-watch mode for CI)
  - [ ] 3.4 Ensure `"test:coverage": "vitest run --coverage"` exists for coverage reports

- [ ] Task 4: Configure node_modules caching (AC: #1, #2)
  - [ ] 4.1 Use `actions/cache@v4` with path `~/.npm` or `node_modules`
  - [ ] 4.2 Cache key: `${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}`
  - [ ] 4.3 Restore keys for partial cache hits
  - [ ] 4.4 Verify cache hit/miss in CI logs

- [ ] Task 5: Configure environment for electron-builder in CI (AC: #1, #2)
  - [ ] 5.1 Linux: install required system packages (`libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, etc.) if needed
  - [ ] 5.2 macOS: configure code signing env vars as secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`) — optional for initial setup
  - [ ] 5.3 macOS: set `CSC_IDENTITY_AUTO_DISCOVERY=false` for unsigned CI builds
  - [ ] 5.4 Windows: no special setup needed for NSIS installer
  - [ ] 5.5 Set `GH_TOKEN` secret for `softprops/action-gh-release` to create releases

- [ ] Task 6: Verify CI pipeline (AC: #1, #3)
  - [ ] 6.1 Push a test commit and verify CI triggers
  - [ ] 6.2 Verify lint step catches ESLint errors
  - [ ] 6.3 Verify test step runs all vitest tests
  - [ ] 6.4 Verify build step compiles on all 3 OS
  - [ ] 6.5 Verify pipeline fails correctly when a step fails
  - [ ] 6.6 Verify `eslint-plugin-jsx-a11y` rules are enforced in lint step

- [ ] Task 7: Verify Release pipeline (AC: #2, #4)
  - [ ] 7.1 Create a test tag (`v0.0.1-test`) and push
  - [ ] 7.2 Verify release workflow triggers
  - [ ] 7.3 Verify builds produce artifacts on all 3 OS
  - [ ] 7.4 Verify GitHub Release is created with the 3 binaries
  - [ ] 7.5 Verify artifacts are downloadable from the release page
  - [ ] 7.6 Delete test tag and release after verification

## Dev Notes

### FRs Covered

This story does not directly cover functional requirements but addresses:
- **NFR11** — Cross-platform test parity: "Les integrations filesystem et process doivent passer la meme suite de tests sur macOS, Linux et Windows avec un taux de reussite identique"
- Architecture requirement: "CI/CD : GitHub Actions -- build + test sur les 3 plateformes, release automatique sur tag"

### Dependencies on Previous Stories

- **Story 8.1** (electron-builder macOS) — `electron-builder.yml` config, `build:mac` script
- **Story 8.2** (Linux + Windows builds) — `build:linux`, `build:win` scripts, platform-specific electron-builder config
- **Story 1.1** (Project Scaffold) — `package.json` with dev scripts, vitest config, ESLint config

### CI Workflow (`.github/workflows/ci.yml`)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint (ESLint + jsx-a11y)
        run: npm run lint

      - name: Type check
        run: npm run typecheck

  test:
    name: Test (${{ matrix.os }})
    needs: lint-and-typecheck
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

  build:
    name: Build (${{ matrix.os }})
    needs: test
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (compile only)
        run: npm run build
```

[Source: architecture.md#Complete-Project-Directory-Structure]
[Source: epics.md#Story-8.3]

### Release Workflow (`.github/workflows/release.yml`)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            build_cmd: npm run build:mac
            artifact_pattern: "dist/*.dmg"
          - os: ubuntu-latest
            build_cmd: npm run build:linux
            artifact_pattern: "dist/*.AppImage"
          - os: windows-latest
            build_cmd: npm run build:win
            artifact_pattern: "dist/*.exe"
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Build for platform
        run: ${{ matrix.build_cmd }}
        env:
          # Skip code signing for now (unsigned builds)
          CSC_IDENTITY_AUTO_DISCOVERY: false
          # GH_TOKEN needed for electron-builder auto-update (future)
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            dist/*.dmg
            dist/*.AppImage
            dist/*.exe
          if-no-files-found: ignore

  release:
    name: Create GitHub Release
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: List artifacts
        run: find artifacts -type f | head -20

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/**/*.dmg
            artifacts/**/*.AppImage
            artifacts/**/*.exe
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

[Source: architecture.md#Complete-Project-Directory-Structure]
[Source: architecture.md#Packaging-Distribution]

### CI Pipeline Architecture

```
Push/PR to main
    |
    v
[lint-and-typecheck] (ubuntu-latest only)
    |  - npm run lint (eslint + jsx-a11y)
    |  - npm run typecheck (tsc --noEmit)
    |
    v
[test] (matrix: macOS, Linux, Windows)
    |  - npm run test (vitest)
    |  - NFR11: same tests, same pass rate
    |
    v
[build] (matrix: macOS, Linux, Windows)
    |  - npm run build (electron-vite compile)
    |
    v
  Done (all green or fail)


Tag push (v*)
    |
    v
[build] (matrix: macOS → .dmg, Linux → .AppImage, Windows → .exe)
    |  - npm run test
    |  - npm run build:{platform}
    |  - upload artifacts
    |
    v
[release] (ubuntu-latest)
    |  - download all artifacts
    |  - create GitHub Release
    |  - attach .dmg, .AppImage, .exe
    |
    v
  GitHub Release page with 3 binaries
```

### Concurrency Configuration

The CI workflow uses `concurrency` with `cancel-in-progress: true` to cancel redundant runs when new commits are pushed to the same branch/PR:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This prevents wasted CI minutes on superseded commits.

### Node.js Version Management

Use `.nvmrc` file at project root to pin the Node.js version:

```
# .nvmrc
22
```

Both `actions/setup-node@v4` and developers' local environments use this file. Node.js 22 is the current LTS as of February 2026.

### Caching Strategy

```yaml
# npm cache (faster than caching node_modules directly)
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: 'npm'   # Built-in npm caching in setup-node
```

The `actions/setup-node@v4` has built-in npm/yarn/pnpm caching. No need for a separate `actions/cache` step. Cache key is automatically derived from `package-lock.json`.

### Required npm Scripts Summary

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:linux": "electron-vite build && electron-builder --linux",
    "build:win": "electron-vite build && electron-builder --win",
    "build:all": "electron-vite build && electron-builder --mac --linux --win",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

### Linux CI Dependencies

electron-builder on Linux may require system packages for building. Add this step before `npm ci`:

```yaml
- name: Install Linux build dependencies
  if: runner.os == 'Linux'
  run: |
    sudo apt-get update
    sudo apt-get install -y libarchive-tools
```

For most Electron apps, `ubuntu-latest` has sufficient packages. The `libarchive-tools` provides `bsdtar` which electron-builder uses for AppImage creation.

### macOS Code Signing in CI

For unsigned builds (initial setup), set:
```yaml
env:
  CSC_IDENTITY_AUTO_DISCOVERY: false
```

For signed builds (future distribution), add GitHub Secrets:
- `CSC_LINK` — Base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` — Certificate password
- `APPLE_ID` — Apple Developer account email
- `APPLE_ID_PASSWORD` — App-specific password for notarization
- `APPLE_TEAM_ID` — Apple Developer Team ID

### Prerelease Detection

The release workflow automatically marks prereleases:

```yaml
prerelease: ${{ contains(github.ref_name, '-') }}
```

Tags like `v0.1.0-beta.1` or `v0.1.0-rc.1` are marked as prerelease. Tags like `v0.1.0` are marked as stable.

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Workflow files | kebab-case `.yml` | `ci.yml`, `release.yml` |
| Job names | kebab-case | `lint-and-typecheck`, `build` |
| Step names | Sentence case | `Install dependencies`, `Run tests` |
| npm scripts | kebab-case | `build:mac`, `test:coverage` |
| Secrets | UPPER_SNAKE_CASE | `CSC_LINK`, `GITHUB_TOKEN` |
| Tags | semver with `v` prefix | `v0.1.0`, `v1.0.0-beta.1` |

### Testing Strategy

- **CI workflow verification** — Push to main, verify all jobs pass (lint, typecheck, test x3 OS, build x3 OS)
- **Release workflow verification** — Create test tag, verify release is created with 3 artifacts
- **NFR11 enforcement** — Test matrix ensures same suite passes on all 3 platforms. `fail-fast: false` ensures all platforms are tested even if one fails
- **Accessibility in CI** — `eslint-plugin-jsx-a11y` rules enforced in lint step
- **Regression safety** — CI runs on every PR, blocking merge if tests fail

### What NOT to Do

- Do NOT use `export default` in any new TypeScript files — named exports only
- Do NOT use `any` type
- Do NOT store secrets (API keys, certificates) in workflow files — use GitHub Secrets
- Do NOT use `fail-fast: true` in test matrix — all platforms must be tested even if one fails
- Do NOT skip tests in the release workflow — tests must pass before artifacts are published
- Do NOT use `actions/create-release` (deprecated) — use `softprops/action-gh-release@v2`
- Do NOT hardcode Node.js version in workflows — use `.nvmrc` file
- Do NOT cache `node_modules` directly — use `actions/setup-node` built-in caching
- Do NOT run lint/typecheck on all 3 OS — these are platform-independent, run once on Ubuntu
- Do NOT use `--force` or `--legacy-peer-deps` with npm — fix dependency issues properly
- Do NOT create a `tailwind.config.ts` — Tailwind 4 uses CSS-only config

### References

- [Source: architecture.md#Packaging-Distribution] — "CI/CD : GitHub Actions -- build + test sur les 3 plateformes, release automatique sur tag"
- [Source: architecture.md#Complete-Project-Directory-Structure] — `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- [Source: architecture.md#Decision-Impact-Analysis] — Packaging + CI/CD as final implementation step
- [Source: epics.md#Story-8.3] — Acceptance criteria
- [Source: epics.md#NonFunctional-Requirements] — NFR11 (cross-platform test parity)
- [Source: epics.md#Additional-Requirements] — "CI/CD : GitHub Actions -- build + test sur les 3 plateformes, release automatique sur tag"
- [Source: ux-design-specification.md#Testing-Strategy] — eslint-plugin-jsx-a11y in CI, @testing-library/jest-dom assertions
- [Source: 8-1-configuration-electron-builder-build-macos.md] — electron-builder base config
- [Source: 8-2-builds-linux-windows.md] — Linux/Windows build config

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
