# Desktop Roadmap

Consolidated roadmap for the MnM macOS / Windows / Linux desktop app.
This document is the **single entry point** for "what is shipped, what
is next, what is blocked". It aligns three pre-existing sources that
tracked desktop work in parallel:

| Source | Scope | Use it for |
|--------|-------|------------|
| `scripts/parity/data.ts` | Typed, per-feature, web↔desktop status | **Authoritative status** — edit it whenever a feature ships or regresses. |
| `apps/desktop/README.md` § "Sprint 2 TODO" | Checklist of security fundamentals | Technical acceptance criteria for Chantier 2. |
| `_bmad-output/brainstorming/brainstorming-mnm-desktop-native-2026-04-07.md` | Full strategy (choix techno, 33 mesures sécu, 60 idées, 7-sprint plan) | Rationale, alternatives considered, exhaustive feature list. |

This doc groups those into **7 Chantiers**. "Chantier N" maps roughly to
"Sprint N" from the brainstorm, with one exception: **Chantier 1** was
added post-brainstorm once we realised the packaged DMG needed a
connection-profile system before any security hardening could be
meaningful.

---

## Status snapshot (2026-04-15)

| # | Chantier | Status | Blocks |
|---|----------|--------|--------|
| 1 | Connection Profiles | **Done** (7/8 steps — étape 7 waits on GTM) | — |
| 2 | Security foundations | In progress (keychain + dynamic CSP done as part of Ch. 1; CSP nonces + audits + hardened runtime remain) | Chantier 4 |
| 3 | macOS polish & natif | Not started | — |
| 4 | Distribution (signing + notarization + updater) | Not started | **Public release** |
| 5 | Windows port | Not started | Release v0.2 |
| 6 | Linux port | Not started | Release v0.3 |
| 7 | Desktop-only power user | Continuous | — |

Run `bun run parity` for the live feature-level status.

---

## Chantier 1 — Connection Profiles *(done)*

**Goal:** make the packaged DMG a true thin client — pick a backend,
persist credentials in Keychain, talk cross-origin safely.

Not in the original brainstorm. Added in April 2026 after a packaged
DMG smoke-test revealed the app could not talk to any backend that
wasn't same-origin. Every subsequent chantier assumes this is done.

**Feature parity IDs (domain `connection-profiles`):**

| ID | Description | Status |
|----|-------------|--------|
| `profile-storage` | Profile CRUD (add / edit / remove / list) | Done |
| `profile-health-check` | Pre-mount health check + BackendUnreachable UI | Done |
| `profile-keychain-secrets` | Session token in Keychain, cross-origin auth | Done |
| `profile-dynamic-csp` | Strict CSP derived from active profile | Done |
| `profile-switcher-ui` | Slack-style title-bar switcher | Done |
| `first-run-wizard` | Welcome wizard with Local vs Remote cards | Done |
| `backend-setup-link` | Gated link to private-repo setup | Missing — waits on GTM URL / contact form |
| `api-version-compat` | `/api/health.minClientVersion` + update banner | Done |

**Post-hoc fixes caught during packaged smoke-test (Apr 2026):**

- Removed `TauriPreviewGate` vintage gate that shadowed the new boot
- Added `core:window:allow-start-dragging` capability (Tauri 2 default set changed)
- Added `pt-12` to `WizardShell` / `BackendUnreachable` so content clears traffic lights
- Promoted `@tauri-apps/api` from vite-ignored dynamic import to a real dependency
- Added `#[serde(rename_all = "camelCase")]` to profile structs (IPC deserialization)
- Added server-side CORS middleware for `tauri://localhost` + Tauri origins in Better Auth `trustedOrigins`
- Replaced 6 hand-rolled `ws://${window.location.host}` URL builders with `resolveWsUrl()` so CSP pinning still matches

---

## Chantier 2 — Security foundations

**Goal:** lock down everything the `_bmad-output/brainstorming` doc calls
"the 33 mesures". Half already done via Chantier 1 (keychain, dynamic
CSP, capability scoping). This chantier closes the rest.

Brainstorm reference: **Sprint 2 — Sécurité fondations**.
Checklist mirror: `apps/desktop/README.md` § "Sprint 2 TODO".

**Outstanding work:**

- [ ] **Strict CSP with nonces** — replace `'unsafe-inline'` on
  `script-src` / `style-src` with per-request nonces. Requires
  integrating a nonce generator with Vite and Tauri's asset protocol.
  Feature ID: `strict-csp`.
- [ ] **Extract the loader into `public/loader.js`** so the CSP can
  drop `'unsafe-inline'` on `<script>` tags.
- [ ] **Tighter capability scoping** — move from `core:window:default`
  / `core:event:default` to the exact commands used, scoped per window
  if we ever add more.
- [ ] **`cargo audit` + `bun audit` in CI** — a GitHub Actions job that
  fails on known CVEs in deps. Feature ID: `sbom-supply-chain`.
- [ ] **Hardened Runtime entitlements** — `.entitlements` plist with
  only `com.apple.security.network.client` and
  `com.apple.security.keychain-access-groups`. Feature ID:
  `hardened-runtime`.
- [ ] **SBOM generation** — `cargo sbom` + `cyclonedx-bom` committed
  with each release.

**Out of scope for this chantier** (deferred to later, tracked in
brainstorm § "33 mesures"): certificate pinning, TLS 1.3 enforcement,
SQLCipher local store, telemetry opt-in flow, MDM policies.

Effort estimate: ~1 sprint. Mostly config + CI, minimal product code.

---

## Chantier 3 — macOS polish & natif

**Goal:** make the DMG feel like a native macOS app, not a webview
wrapper. Differentiator vs the web build.

Brainstorm reference: **Sprint 3 — macOS polish & natif**.

**Outstanding work (parity domain `desktop-native`):**

| ID | Description |
|----|-------------|
| `native-menus-traffic-lights` | Native File / Edit / View / Window menus + aligned traffic-light styling |
| `liquid-glass-sidebar` | `NSVisualEffectView` backdrop for the sidebar (iOS 26 / macOS 26 Liquid Glass) |
| `tray-icon-status` | Menu-bar tray with live agent status (running / errors count) |
| `native-notifications` | `tauri-plugin-notification` for new issues, approvals, drift alerts |

Also in scope (not yet in parity domain):

- Universal binary (Intel + Apple Silicon) — single DMG supports both archs
- Toolbar unifiée (macOS unified title + toolbar)

Effort estimate: ~2 sprints. Liquid Glass requires a small Swift plugin.

---

## Chantier 4 — Distribution macOS

**Goal:** ship a signed, notarized DMG that Gatekeeper accepts on
first launch, with an auto-updater for subsequent releases.

Brainstorm reference: **Sprint 4 — Distribution macOS**.
**Blocks public release** — every feature above ship-internally only
until this is done.

**Outstanding work:**

| ID | Description |
|----|-------------|
| `dmg-codesign` | Apple Developer ID cert + notarization via `tauri-action` |
| `auto-updater` | Signed updater with manifest on GitHub releases |
| (landing work) | `mnm-landing` download page that auto-detects platform |

**Prerequisites:**

- Apple Developer ID enrolment (99 USD/year)
- Cert + provisioning profile in GitHub Actions secrets:
  `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`
- Landing repo `mnm-landing` already exists — needs download page wired up

**Exit criteria:**

- Fresh Mac (never had the unsigned DMG) can double-click the signed
  DMG and run the app with only a standard macOS confirmation dialog
- Auto-update from v0.0.x → v0.1.0 works on a user's laptop without
  re-downloading the full DMG

Effort estimate: ~1 sprint. Gated on Apple Dev cert paperwork.

### 🎉 Exit of Chantier 4 = public v0.1 macOS release.

---

## Chantier 5 — Windows port

Brainstorm reference: **Sprint 5**. Feature parity with macOS release.

- Build matrix with Windows runner in GitHub Actions
- EV cert signing (different from Apple Dev ID, ~400 USD/year for a
  cheap EV cert, required to bypass Windows SmartScreen)
- MSI / NSIS installer packaging
- Mica material (Windows 11 visual style, equivalent of Liquid Glass)
- Jump List integration (right-click taskbar icon → recent agents /
  issues)
- Windows Notification Center wiring (via `tauri-plugin-notification`)
- Tests on Windows 10 + 11

### 🎉 Exit = v0.2 Windows release.

---

## Chantier 6 — Linux port

Brainstorm reference: **Sprint 6**. Completes the "any platform"
promise.

- AppImage (universal) + .deb (Ubuntu/Debian) + .rpm (Fedora/RHEL) +
  Flatpak (any distro)
- WebKitGTK compat across Ubuntu LTS, Fedora, Arch
- D-Bus integration for notifications
- Tray via `libappindicator`
- Tests on Ubuntu LTS + Fedora

### 🎉 Exit = v0.3 Linux release — toutes plateformes live.

---

## Chantier 7 — Desktop-only power user *(continuous)*

Brainstorm reference: **Sprint 7 — Features desktop-only (continu)**.
Not a single sprint — items here land opportunistically after the
platform is stable.

Currently in the parity tracker:

| ID | Description |
|----|-------------|
| `global-hotkey` | `⌘⇧M` quick agent prompt from anywhere on macOS |
| `drag-drop-files` | Drop files from Finder into chat (needs `tauri-plugin-fs` + drop zones) |
| `smart-claude-token-pickup` | Auto-detect `~/.claude/config.json` and offer to push to backend |
| `command-palette` | Wire Tauri global shortcut for the in-app ⌘K palette (currently "partial") |

Additional ideas parked in the brainstorm § "60 idées" (not yet in
parity tracker): local FS access for agents, multi-window, Spotlight
indexing of issues, background mode, clipboard monitoring hooks, etc.

---

## Shared blockers (see `parityData.sharedBlockers`)

| Key | Lifts when |
|-----|-----------|
| `desktop-connection-profiles` | Chantier 1 lands — **done** ✓ |
| `desktop-sse-connectivity` | WS cross-origin verified in packaged DMG — **done** in Apr 2026 (see post-hoc fix list above) |
| `desktop-packaged-verification` | Campaign of manual verification of each `dev-only` feature in the packaged DMG — **in progress** |
| `desktop-codesign-notarization` | Chantier 4 lands |

---

## Remaining validation work

After Chantier 1's post-hoc fixes, 50 features in the parity tracker
still sit at `dev-only` waiting for packaged verification. Run
`bun run parity --missing` for the live list.

Typical verification pass for one feature:
1. Open the page in the packaged DMG
2. Check DevTools Console has zero errors
3. Perform one CRUD or read action that exercises its data path
4. If OK, edit `scripts/parity/data.ts` to flip
   `status: "dev-only"` → `status: "done"`

Once auth + SSE are confirmed on a representative sample (~5 pages),
it is reasonable to bulk-promote the rest behind a single validation
commit, since the remaining risk is per-component data shape issues
rather than platform plumbing.

---

## Maintenance contract

- **Whenever a chantier step ships:** update both this file *and*
  `scripts/parity/data.ts`. They are the two sources of truth — neither
  is authoritative alone.
- **Whenever a new chantier opens:** append a section here, don't
  invent a parallel doc. Cross-link from `apps/desktop/README.md` if
  needed.
- **Terminology:** "Chantier N" is the new primary label. Keep the
  brainstorm "Sprint N" as a reference (see top table) for anyone who
  already has the old mental model.
- **Commit messages:** use `feat(desktop): <…> (Chantier N étape M)` so
  the chantier lineage stays greppable in `git log`.
