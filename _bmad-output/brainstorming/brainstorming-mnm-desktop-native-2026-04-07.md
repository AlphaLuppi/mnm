---
session_topic: "MnM Desktop Native — port multi-OS de la web app"
session_date: 2026-04-07
facilitator: Claude (Opus 4.6)
participant: Nicolas
status: completed
selected_approach: "Progressive Flow"
techniques_used: ["divergence techno", "convergence stack", "feature ideation", "risk mapping"]
ideas_generated: 60
stepsCompleted: [1, 2, 3, 4]
---

# Brainstorming — MnM Desktop Native (multi-OS)

**Date :** 2026-04-07
**Participant :** Nicolas
**Facilitateur :** Claude

---

## 1. Vision & Contraintes

### Objectif
Porter MnM en **application desktop native** pour macOS, Windows et Linux, qui réplique 100% des features de la web app actuelle, avec une UX/perf ≥ web, et qui suit la web app comme master (zéro drift).

### Contraintes validées
- ✅ "Natif" = **app OS-compatible**, pas réécriture from scratch
- ✅ Réutilisation maximale du code React existant (`apps/web` + `packages/ui`)
- ✅ Web reste master → workflow : feature web → puis port desktop
- ✅ Perf cible : ≥ web app, animations identiques (pas de raccourcis)
- ✅ Priorité OS : **macOS → Windows → Linux**
- ✅ Distribution : landing page avec liens download (DMG/MSI/AppImage)
- ✅ Touches OS-specific bienvenues là où pertinent (ex: Liquid Glass macOS 26)
- ✅ Vraie app standalone, pas extension/widget
- ✅ Sécurité maximale (≥ web app, idéalement supérieure)

---

## 2. Choix techno : **Tauri 2** ✅

### Comparaison des options évaluées

**Webview-based (réutilise React) :**
- **Tauri 2** (Rust shell) — 5-15 MB, perf ★★★★, sweet spot ⭐
- Wails v3 (Go) — 10 MB, ★★★★
- Electron (Node) — 120 MB, ★★
- Neutralino (C++) — 2 MB, ★★★

**Cross-platform natif "vrai" (réécriture UI) — REJETÉS :**
- Rust + Slint / egui / Iced — perf ★★★★★ mais 6-12 mois de réécriture
- Rust + Dioxus Desktop — JSX-like, effort moyen
- Flutter Desktop — Dart, ★★★★
- Compose Multiplatform — Kotlin, ★★★★
- .NET MAUI / Avalonia — C#, ★★★★
- Qt / QML — C++, gros effort
- GPUI (Zed) — jeune, énorme

### Justification Tauri 2

| Critère | Tauri 2 | Notes |
|---|---|---|
| Réutilisation React | 100% | Pointe sur le build Vite existant |
| Zéro drift web↔desktop | ✅ | Même codebase UI |
| Perf ≥ web | ✅ | WKWebView/WebView2/WebKitGTK natifs |
| RAM | 80-150 MB | 3-5x mieux qu'Electron |
| Binaire | 5-15 MB | vs 120 MB Electron |
| Cold start | 300-600ms | vs 1.5s Electron |
| macOS Liquid Glass | ✅ | Plugin Swift (NSVisualEffectView) |
| Windows Mica | ✅ | window-vibrancy |
| Auto-update signé | ✅ | tauri-plugin-updater |
| Code signing + notarization | ✅ | tauri-action GitHub |
| DMG/MSI/AppImage/deb/rpm | ✅ | `tauri build` génère tout |
| Tray, menus, notifs OS, shortcuts globaux | ✅ | API officielle |
| Deep links (mnm://) | ✅ | Plugin |

### Pourquoi pas Rust pur (Slint/Iced/egui)
- 6-12 mois de réécriture UI
- Perte de features pendant le port
- L'UI MnM est web-shaped (Tailwind, shadcn, grids responsives, syntax highlighting, markdown, PDF viewer) — tout serait à recoder
- Drift garanti vs la web app

---

## 3. Stratégie git : Monorepo + landing séparée

### Structure validée

```
mnm/                    ← monorepo principal (existant)
├── apps/
│   ├── web/            ← existant
│   └── desktop/        ← NEW (Tauri shell)
├── packages/
│   ├── ui/             ← partagé web ↔ desktop
│   ├── api-client/     ← partagé
│   └── shared/

mnm-landing/            ← repo séparé léger (Astro)
```

### Branches
- `master` — stable web prod
- `desktop/main` — branche longue durée pour le projet desktop
- `desktop/feat-tauri-bootstrap`, `desktop/feat-liquid-glass-sidebar`, etc. — feature branches qui mergent dans `desktop/main`
- À maturité → merge `desktop/main` → `master` pour release v2.0

### Pourquoi séparer la landing
- Deploy indépendant ultra-rapide (Vercel ~10s)
- Public-facing, stack différente (Astro vs React+Express)
- Marketing peut itérer sans toucher au repo prod
- Pattern industrie : Linear, Raycast, Arc, Tauri eux-mêmes

### Pattern industrie validé
- **Monorepo** : Linear, Vercel, Supabase, Cal.com, Posthog, Tauri
- **Repo séparé landing** : Linear, Raycast, Arc

---

## 4. Plan sécurité — 33 mesures (TOUTES à appliquer)

### Tauri-specific (CRITIQUE)
1. Allowlist stricte dans `tauri.conf.json` — n'autoriser QUE les API utilisées
2. CSP strict — `default-src 'self'; connect-src 'self' https://api.mnm.com`
3. Pas de `dangerousRemoteDomainIpcAccess`
4. Capabilities scopées par fenêtre/origine (Tauri 2)
5. No `eval` (bloqué par défaut)
6. Webview isolation pattern (Tauri 2 iframe sandbox)

### Stockage local
7. Tokens OAuth chiffrés via Keychain (macOS) / Credential Manager (Win) / Secret Service (Linux) — `tauri-plugin-keyring`
8. Jamais de secrets en clair dans `localStorage`
9. SQLite local chiffré (SQLCipher) pour logs/historiques sensibles

### Réseau
10. Certificate pinning sur l'API backend
11. TLS 1.3 only
12. Mutual TLS optionnel pour clients enterprise

### Build & supply chain
13. Code signing obligatoire (Apple Developer ID, EV cert Windows)
14. Notarization Apple (obligatoire macOS 10.15+)
15. SBOM (Software Bill of Materials) généré au build
16. `cargo audit` + `bun audit` dans la CI
17. Reproducible builds si possible
18. Updater signé avec clé privée
19. Pas de `unsafe` Rust sans review

### Runtime
20. Sandbox macOS (App Sandbox entitlements)
21. Hardened Runtime macOS
22. Permissions explicites (FS, micro, caméra)
23. Auto-lock après inactivité (config admin)
24. Detect jailbreak/debug mode et warn

### Telemetry & privacy
25. Telemetry opt-in EXPLICITE au premier lancement
26. Anonymisation (pas d'IPs, pas de paths utilisateur)
27. GDPR-ready : Export/Delete my data en local
28. Crash reports sans PII (Sentry avec scrubbing)

### Enterprise B2B
29. MDM-friendly (plist Mac / GPO Win)
30. SSO/SAML support (réutilise backend)
31. Audit log local des actions sensibles
32. Kill switch distant (admin désactive installs)
33. Forced update policy pour CVE critiques

---

## 5. Les 60 idées générées

### 🔧 Architecture & code sharing
1. Monorepo bun workspace : `apps/desktop` à côté de `apps/web`, partage 100% `packages/ui/`
2. Build conditionnel `if (window.__TAURI__)` pour features desktop-only
3. Wrapper API HTTP unifié, juste l'URL backend qui change
4. Mode "embedded backend" : Express + Postgres bundlés (offline-first)
5. Mode "remote backend" : connexion à instance MnM cloud/serveur
6. Hybride : choix au premier lancement Local vs Remote

### 🎨 Touches macOS premium (Liquid Glass macOS 26)
7. Sidebar avec vibrancy NSVisualEffectMaterial.sidebar
8. Traffic lights customisés pour matcher le header MnM
9. Toolbar unifiée avec titre fenêtre (look natif)
10. Liquid Glass sur les modals (Settings, Agent details)
11. Icône menubar avec status agents (vert/orange/rouge)
12. Quick Look intégré pour artifacts (PDF, images, vidéos)
13. Spotlight integration (CoreSpotlight pour agents/runs)
14. Continuity Camera / Handoff iPhone (futur)
15. Touch Bar legacy support (vieux MBP)
16. Notification Center widget (agents actifs)

### 🪟 Touches Windows
17. Mica material Windows 11 (look Fluent)
18. Jump List taskbar : "Run last agent", "Open dashboard"
19. Notification Center Windows avec actions
20. Snap Layouts support
21. WinUI 3 controls injectés via plugin Tauri

### 🐧 Touches Linux
22. AppImage + Flatpak + .deb + .rpm
23. D-Bus pour notifs et media keys
24. Tray icon avec libappindicator fallback
25. Wayland-first avec fallback X11

### 🚀 Features desktop-only
26. Global hotkey `Cmd+Shift+M` pour quick-prompt agent
27. Drag & drop fichiers Finder dans conversation agent
28. Notifs OS natives quand run termine/fail
29. Background mode (tray, écoute events agents)
30. Local file system access pour agents (pas d'upload)
31. Clipboard monitoring : Cmd+C → "Send to agent"
32. Screen capture intégré pour debugging visuel
33. Local logs persistance SQLite
34. Offline mode partiel (historique sans serveur)
35. Multi-window : agent en fenêtre détachée
36. Picture-in-Picture run en cours
37. Local model fallback (Ollama si offline)
38. Native deep search Cmd+K avec FTS5 SQLite local
39. Shortcuts macOS app (Raccourcis Apple)
40. AppleScript / URL scheme (`mnm://run/agentId?prompt=...`)

### 📦 Distribution & landing
41. Landing Astro ultra-rapide, hero, démo vidéo, 3 boutons download
42. Auto-detect OS côté JS pour suggérer le bon binaire
43. Stable + beta channels via Tauri updater
44. Page "What's new" intégrée (changelog at startup)
45. Onboarding : "Try web version" vs "Download desktop"
46. Telemetry opt-in PostHog/Plausible
47. Crash reporting Sentry intégré
48. In-app feedback widget desktop-native

### ⚙️ Build & CI/CD
49. GitHub Actions matrix : Mac (x64+arm64), Win (x64+arm64), Linux (x64+arm64)
50. Code signing : Apple Developer ID + Windows EV cert
51. Notarization automatique via tauri-action
52. Universal binary macOS (Intel + Apple Silicon)
53. Release notes auto-générées depuis git log
54. Beta canal via tag `v*-beta`

### 🧪 Risques & mitigations
55. WebView differences (WKWebView vs WebView2 vs WebKitGTK) → tests E2E sur 3 OS
56. Linux WebKitGTK = maillon faible (Ubuntu LTS old) → préciser prérequis
57. CSP strict obligatoire dans Tauri → adapter code web
58. IPC types-safe via `specta` ou `tauri-specta`
59. Bundle size CI gate
60. Visual regression Playwright sur 3 OS

---

## 6. Roadmap — 7 sprints

### Sprint 1 — Bootstrap & POC macOS (1-2 sem)
- Setup `apps/desktop` Tauri 2 dans le monorepo
- Branche `desktop/main` créée
- POC : web app MnM s'affiche dans fenêtre Tauri
- Build DMG non signé qui se lance
- IPC types-safe via `tauri-specta`
- README desktop avec instructions dev

### Sprint 2 — Sécurité fondations (1 sem)
- CSP strict, allowlist Tauri minimale, capabilities scopées
- Keychain integration pour tokens
- `cargo audit` + `bun audit` dans CI
- Hardened runtime macOS
- Updater signé configuré

### Sprint 3 — macOS polish & natif (2 sem)
- Liquid Glass sidebar (plugin Swift)
- Traffic lights stylés
- Toolbar unifiée
- Tray icon avec status agents
- Notifs OS natives
- Global hotkey `Cmd+Shift+M`
- Drag & drop fichiers Finder
- Universal binary (Intel + Apple Silicon)

### Sprint 4 — Distribution macOS (1 sem)
- Apple Developer ID signing
- Notarization automation
- DMG packaging avec installer custom
- Auto-updater end-to-end
- Repo `mnm-landing` setup avec Astro
- Landing basique avec download Mac
- **🎉 Release v0.1 macOS publique**

### Sprint 5 — Windows port (1-2 sem)
- Build matrix CI Windows
- EV cert signing
- MSI/NSIS packaging
- Mica material
- Jump List, Notification Center
- Tests Windows 10 + 11
- Landing : ajout bouton Windows
- **🎉 Release v0.2 Windows**

### Sprint 6 — Linux port (1-2 sem)
- AppImage + .deb + .rpm + Flatpak
- WebKitGTK compat (Ubuntu LTS / Fedora / Arch)
- D-Bus integration
- Tray libappindicator
- Landing : ajout bouton Linux
- **🎉 Release v0.3 Linux — toutes plateformes live**

### Sprint 7 — Features desktop-only (continu)
- Drag & drop avancé
- Local FS access pour agents
- Multi-window
- Spotlight macOS
- Background mode
- Tout le reste des 60 idées priorisées

---

## 7. Landing page `mnm-landing`

### Stack validé
- **Astro 5** (framework principal)
- **Tailwind CSS v4** (cohérent avec web app)
- **shadcn/ui** components pertinents en static
- **MDX** pour pages contenu (changelog, blog éventuel)
- **Framer Motion** pour animations clés
- Hébergement **Vercel** ou **Cloudflare Pages**

### Direction design : Wabi-Sabi Premium 🍃

**Palette :**
- Tons crème / beige / sable
- Noir profond charbon
- Accents terracotta ou indigo ténu
- Beaucoup de blanc / espace négatif

**Typographie :**
- Serif élégant titres : Fraunces, GT Super, Söhne Serif
- Sans-serif neutre corps : Inter, Söhne, Geist

**Principes :**
- Espace négatif énorme — chaque section respire
- Asymétrie maîtrisée, grilles cassées subtilement
- Textures organiques (grain papier, imperfections)
- Animations lentes et douces (fade-in 800ms, ease-out)
- Imagerie naturelle (pierre, bois, encre — pas de stock tech)
- Détails artisanaux (bordures fines, traits dessinés)
- Moins de mots, plus de poids — chaque phrase compte
- Dark mode optionnel : noir charbon + crème vieilli

**Inspirations :**
- linear.app (premium tech sobre)
- arc.net (artisanal premium)
- studiofreight.com (asymétrie créative)
- Aesop, Muji premium (luxe japonais)
- craftdocs.com (typographie + espace)
- tauri.app (landing produit cross-platform)

**Pourquoi Astro et pas Next.js :**
- Zero JS by default → Lighthouse 100/100
- Page chargée en ~50ms
- HTML statique pur → SEO parfait
- Hébergement n'importe où, deploy en 10s
- Tauri eux-mêmes utilisent Astro (validation forte)
- Next.js serait du sur-dimensionnement pour une landing static

### Contenu landing v1
- Hero : titre + tagline + démo vidéo
- Section features (réutilise screenshots web app)
- Section "How it works" (3-4 étapes)
- Section social proof (futur)
- 3 boutons download avec auto-detect OS (Mac visible en premier)
- Lien "Try web version"
- Page changelog
- Footer minimal

---

## 8. Décisions actées

| # | Décision | Statut |
|---|---|---|
| 1 | Stack desktop : **Tauri 2** | ✅ |
| 2 | Réutilisation 100% du React existant via `packages/ui` | ✅ |
| 3 | Monorepo `mnm/apps/desktop` + branche `desktop/main` | ✅ |
| 4 | Landing dans repo séparé `mnm-landing` (Astro) | ✅ |
| 5 | Ordre OS : macOS → Windows → Linux | ✅ |
| 6 | Toutes les 33 mesures de sécurité appliquées | ✅ |
| 7 | Stack landing : Astro + Tailwind v4 + shadcn/ui + MDX | ✅ |
| 8 | Direction design landing : Wabi-Sabi Premium | ✅ |
| 9 | Roadmap 7 sprints validée | ✅ |
| 10 | Touches OS-specific (Liquid Glass macOS, Mica Windows) | ✅ |

---

## 9. Prochaines actions

1. Créer la branche `desktop/main` sur le repo `mnm`
2. Lancer Sprint 1 : bootstrap `apps/desktop` Tauri 2
3. Créer le repo `mnm-landing` séparé
4. Setup signing certificats Apple Developer ID
5. Préparer la matrice CI GitHub Actions

---

_Session brainstorming complétée le 2026-04-07._
